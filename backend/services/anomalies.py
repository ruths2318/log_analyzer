from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from statistics import mean, pstdev


def generate_upload_anomalies(events: list[dict[str, object]]) -> list[dict[str, object]]:
    anomalies: list[dict[str, object]] = []
    anomalies.extend(detect_blocked_bursts(events))
    anomalies.extend(detect_request_bursts(events))
    anomalies.extend(detect_user_destination_spread(events))
    anomalies.extend(detect_error_spikes(events))
    anomalies.extend(detect_rare_user_host(events))
    anomalies.sort(key=lambda item: (item["confidence_score"], severity_rank(item["severity"])), reverse=True)
    return anomalies[:50]


def detect_blocked_bursts(events: list[dict[str, object]]) -> list[dict[str, object]]:
    blocked = [event for event in events if as_text(event.get("action"), "").lower() == "blocked" and event.get("client_ip")]
    return detect_bucket_bursts(
        events=blocked,
        anomaly_type="blocked_burst_by_ip",
        title="Blocked burst from client IP",
        key_name="clientIp",
        getter=lambda event: as_text(event.get("client_ip")),
        count_floor=6,
    )


def detect_request_bursts(events: list[dict[str, object]]) -> list[dict[str, object]]:
    with_ip = [event for event in events if event.get("client_ip")]
    return detect_bucket_bursts(
        events=with_ip,
        anomaly_type="request_burst_by_ip",
        title="Request burst from client IP",
        key_name="clientIp",
        getter=lambda event: as_text(event.get("client_ip")),
        count_floor=15,
    )


def detect_bucket_bursts(
    *,
    events: list[dict[str, object]],
    anomaly_type: str,
    title: str,
    key_name: str,
    getter,
    count_floor: int,
) -> list[dict[str, object]]:
    buckets: dict[tuple[str, datetime], list[dict[str, object]]] = defaultdict(list)
    for event in events:
        event_time = event.get("event_time")
        if not isinstance(event_time, datetime):
            continue
        bucket = event_time.replace(minute=(event_time.minute // 15) * 15, second=0, microsecond=0)
        buckets[(getter(event), bucket)].append(event)

    counts = [len(bucket_events) for bucket_events in buckets.values()]
    if not counts:
        return []

    baseline_mean = mean(counts)
    baseline_std = pstdev(counts) if len(counts) > 1 else 0
    threshold = max(count_floor, int(baseline_mean + max(2.0, baseline_std * 2)))

    anomalies: list[dict[str, object]] = []
    for (group_key, bucket_start), bucket_events in buckets.items():
        count = len(bucket_events)
        if count < threshold:
          continue
        bucket_end = bucket_start + timedelta(minutes=15)
        confidence = clamp(0.7 + min(0.25, (count - threshold) / max(threshold, 1) * 0.2))
        anomalies.append(
            {
                "event_id": None,
                "row_number": min((event.get("row_number") for event in bucket_events if isinstance(event.get("row_number"), int)), default=None),
                "anomaly_type": anomaly_type,
                "title": title,
                "reason": f"{key_name} {group_key} generated {count} events between {bucket_start.isoformat()} and {bucket_end.isoformat()}, which is unusually high for this upload.",
                "confidence_score": confidence,
                "severity": "high" if confidence >= 0.85 else "medium",
                "group_key": group_key,
                "time_range_start": bucket_start,
                "time_range_end": bucket_end,
                "context": {
                    key_name: group_key,
                    "count": count,
                    "threshold": threshold,
                    "windowMinutes": 15,
                },
            }
        )
    return anomalies


def detect_user_destination_spread(events: list[dict[str, object]]) -> list[dict[str, object]]:
    by_user: dict[str, set[str]] = defaultdict(set)
    by_category: dict[str, set[str]] = defaultdict(set)
    for event in events:
        user = as_text(event.get("user_name"))
        host = as_text(event.get("hostname"))
        category = as_text(event.get("url_category"))
        if user != "Unknown":
            by_user[user].add(host)
            by_category[user].add(category)

    host_counts = [len(hosts) for hosts in by_user.values()]
    if not host_counts:
        return []
    threshold = max(8, int(mean(host_counts) + max(2.0, pstdev(host_counts) * 2 if len(host_counts) > 1 else 2)))

    anomalies: list[dict[str, object]] = []
    for user, hosts in by_user.items():
        host_count = len(hosts)
        category_count = len(by_category[user])
        if host_count < threshold:
            continue
        anomalies.append(
            {
                "event_id": None,
                "row_number": None,
                "anomaly_type": "user_destination_spread",
                "title": "User touched an unusually broad set of destinations",
                "reason": f"User {user} accessed {host_count} distinct hosts across {category_count} categories, which is high relative to peers in this upload.",
                "confidence_score": clamp(0.72 + min(0.18, host_count / max(threshold, 1) * 0.08)),
                "severity": "medium",
                "group_key": user,
                "time_range_start": None,
                "time_range_end": None,
                "context": {
                    "userName": user,
                    "distinctHostCount": host_count,
                    "distinctCategoryCount": category_count,
                    "threshold": threshold,
                },
            }
        )
    return anomalies


def detect_error_spikes(events: list[dict[str, object]]) -> list[dict[str, object]]:
    host_errors: Counter[str] = Counter()
    host_totals: Counter[str] = Counter()
    for event in events:
        host = as_text(event.get("hostname"))
        host_totals[host] += 1
        status_code = event.get("status_code")
        if isinstance(status_code, int) and status_code >= 400:
            host_errors[host] += 1

    anomalies: list[dict[str, object]] = []
    for host, error_count in host_errors.items():
        total = host_totals[host]
        ratio = error_count / max(total, 1)
        if error_count < 4 or ratio < 0.5:
            continue
        anomalies.append(
            {
                "event_id": None,
                "row_number": None,
                "anomaly_type": "error_spike_by_host",
                "title": "Destination host is producing concentrated errors",
                "reason": f"Host {host} returned {error_count} 4xx/5xx responses out of {total} events ({round(ratio * 100)}%), which is suspiciously high.",
                "confidence_score": clamp(0.68 + min(0.22, ratio * 0.3)),
                "severity": "medium" if ratio < 0.75 else "high",
                "group_key": host,
                "time_range_start": None,
                "time_range_end": None,
                "context": {
                    "hostname": host,
                    "errorCount": error_count,
                    "totalCount": total,
                    "errorRatio": round(ratio, 3),
                },
            }
        )
    return anomalies


def detect_rare_user_host(events: list[dict[str, object]]) -> list[dict[str, object]]:
    host_counts = Counter(as_text(event.get("hostname")) for event in events)
    combo_counts = Counter((as_text(event.get("user_name")), as_text(event.get("hostname"))) for event in events)
    anomalies: list[dict[str, object]] = []

    for event in events:
        user = as_text(event.get("user_name"))
        host = as_text(event.get("hostname"))
        if user == "Unknown" or host == "Unknown":
            continue
        if host_counts[host] > 2 or combo_counts[(user, host)] > 1:
            continue
        anomalies.append(
            {
                "event_id": event.get("event_id"),
                "row_number": event.get("row_number"),
                "anomaly_type": "rare_user_host",
                "title": "Rare user to host combination",
                "reason": f"User {user} accessed host {host}, which appears rarely in this upload and only once for this user.",
                "confidence_score": 0.66,
                "severity": "low",
                "group_key": f"{user}:{host}",
                "time_range_start": None,
                "time_range_end": None,
                "context": {
                    "userName": user,
                    "hostname": host,
                    "hostFrequency": host_counts[host],
                    "pairFrequency": combo_counts[(user, host)],
                },
            }
        )

    return anomalies[:20]


def as_text(value: object, fallback: str = "Unknown") -> str:
    if value is None:
        return fallback
    if isinstance(value, str):
        return value or fallback
    return str(value)


def clamp(value: float) -> float:
    return max(0.5, min(0.99, round(value, 2)))


def severity_rank(severity: str) -> int:
    return {"high": 3, "medium": 2, "low": 1}.get(severity, 0)
