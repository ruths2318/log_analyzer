from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Callable

from services.zscaler_web import FIELD_NAMES

ANALYSIS_VERSION = 1

RAW_KEY_TO_PIVOT_FIELD = {
    "protocol": "protocol",
    "action": "action",
    "ClientIP": "clientIp",
    "appclass": "appClass",
    "appname": "appName",
    "department": "department",
    "filetype": "fileType",
    "hostname": "hostname",
    "location": "location",
    "pagerisk": "riskLabel",
    "requestmethod": "requestMethod",
    "threatcategory": "threatCategory",
    "threatclass": "threatClass",
    "threatname": "threatName",
    "urlcategory": "urlCategory",
    "urlclass": "urlClass",
    "urlsupercategory": "urlSupercategory",
    "user": "userName",
    "useragent": "userAgent",
    "serverip": "serverIp",
    "status": "statusBand",
}

RAW_KEY_LABELS = {
    "ClientIP": "Client IP",
    "appclass": "App class",
    "appname": "App name",
    "bwthrottle": "Bandwidth throttle",
    "clientpublicIP": "Client public IP",
    "contenttype": "Content type",
    "devicehostname": "Device hostname",
    "deviceowner": "Device owner",
    "dlpdictionaries": "DLP dictionaries",
    "dlpengine": "DLP engine",
    "event_id": "Event ID",
    "fileclass": "File class",
    "filetype": "File type",
    "keyprotectiontype": "Key protection type",
    "pagerisk": "Page risk",
    "refererURL": "Referer URL",
    "requestmethod": "Request method",
    "serverip": "Server IP",
    "threatcategory": "Threat category",
    "threatclass": "Threat class",
    "threatname": "Threat name",
    "unscannabletype": "Unscannable type",
    "urlcategory": "URL category",
    "urlclass": "URL class",
    "urlsupercategory": "URL supercategory",
    "useragent": "User agent",
}


def generate_upload_insights(events: list[dict[str, object]]) -> dict[str, object]:
    summary = build_summary(events)
    focus_sections = build_focus_sections(events)
    field_distributions = build_field_distributions(events)
    spotlight_cards = build_spotlight_cards(events, focus_sections, summary)
    key_findings = build_key_findings(events, summary, focus_sections)
    return {
        "analysis_version": ANALYSIS_VERSION,
        "summary": summary,
        "spotlight_cards": spotlight_cards,
        "key_findings": key_findings,
        "focus_sections": focus_sections,
        "field_distributions": field_distributions,
    }


def build_summary(events: list[dict[str, object]]) -> dict[str, object]:
    blocked_events = [event for event in events if is_blocked(event)]
    risky_events = [event for event in events if is_risky(event)]
    threat_events = [event for event in events if event.get("threat_category")]

    return {
        "totalEvents": len(events),
        "blockedEvents": len(blocked_events),
        "allowedEvents": sum(1 for event in events if as_text(event.get("action"), "").lower() == "allowed"),
        "riskyEvents": len(risky_events),
        "threatEvents": len(threat_events),
        "uniqueUsers": count_unique(events, lambda event: as_text(event.get("user_name"))),
        "uniqueClientIps": count_unique(events, lambda event: as_text(event.get("client_ip"))),
        "uniqueHosts": count_unique(events, lambda event: as_text(event.get("hostname"))),
        "uniqueCategories": count_unique(events, lambda event: as_text(event.get("url_category"))),
        "uniqueApps": count_unique(events, lambda event: as_text(event.get("app_name"))),
        "status4xxEvents": sum(1 for event in events if status_band(event.get("status_code")) == "4xx"),
        "status5xxEvents": sum(1 for event in events if status_band(event.get("status_code")) == "5xx"),
    }


def build_spotlight_cards(
    events: list[dict[str, object]],
    focus_sections: list[dict[str, object]],
    summary: dict[str, object],
) -> list[dict[str, object]]:
    cards: list[dict[str, object]] = []
    peak_bucket = find_peak_time_bucket(events, minutes=15)
    if peak_bucket:
        cards.append(
            {
                "id": "peak-burst-window",
                "title": "Peak burst window",
                "value": f"{peak_bucket['count']} events",
                "context": f"{peak_bucket['label']} · {peak_bucket['blockedCount']} blocked",
                "severity": "high" if peak_bucket["blockedCount"] else "medium",
                "timeRangeStart": peak_bucket["start"],
                "timeRangeEnd": peak_bucket["end"],
            }
        )

    for section_id, card_id, title, context_template, severity in [
        ("blocked-source-ips", "top-blocked-source", "Most blocked source", "{value} blocked events · {share} of blocked traffic", "high"),
        ("risky-users", "top-risky-user", "Top risky user", "{value} risky events · {share} of risky traffic", "high"),
        ("threat-family", "top-threat-family", "Threat family", "{value} threat-tagged events", "high"),
        ("top-categories", "dominant-category", "Dominant destination category", "{value} events across observed traffic", "medium"),
    ]:
        section = next((section for section in focus_sections if section["id"] == section_id), None)
        if not section or not section["items"]:
            continue
        top_item = section["items"][0]
        cards.append(
            {
                "id": card_id,
                "title": title,
                "value": top_item["label"],
                "context": context_template.format(value=top_item["value"], share=pct(top_item["share"])),
                "severity": severity,
                "pivotField": top_item.get("pivotField"),
                "pivotValue": top_item.get("pivotValue"),
            }
        )

    if summary["status5xxEvents"]:
        cards.append(
            {
                "id": "server-errors",
                "title": "Server error volume",
                "value": f"{summary['status5xxEvents']} events",
                "context": "5xx responses deserve backend or destination review",
                "severity": "medium",
                "pivotField": "statusBand",
                "pivotValue": "5xx",
            }
        )

    return cards[:6]


def build_key_findings(
    events: list[dict[str, object]],
    summary: dict[str, object],
    focus_sections: list[dict[str, object]],
) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []

    blocked_section = next((section for section in focus_sections if section["id"] == "blocked-source-ips"), None)
    if blocked_section and blocked_section["items"]:
        top_item = blocked_section["items"][0]
        if top_item["share"] >= 0.25:
            findings.append(
                {
                    "title": "Blocked traffic is concentrated on one source",
                    "detail": f"{top_item['label']} generated {top_item['value']} blocked events, or {pct(top_item['share'])} of blocked requests.",
                    "severity": "high",
                    "pivotField": top_item.get("pivotField"),
                    "pivotValue": top_item.get("pivotValue"),
                }
            )

    risky_section = next((section for section in focus_sections if section["id"] == "risky-users"), None)
    if risky_section and risky_section["items"]:
        top_item = risky_section["items"][0]
        findings.append(
            {
                "title": "Risk is concentrated on a specific user",
                "detail": f"{top_item['label']} accounts for {top_item['value']} risky events and is the first user worth pivoting into.",
                "severity": "high",
                "pivotField": top_item.get("pivotField"),
                "pivotValue": top_item.get("pivotValue"),
            }
        )

    peak_bucket = find_peak_time_bucket(events, minutes=15)
    if peak_bucket:
        findings.append(
            {
                "title": "Burst window detected",
                "detail": f"The busiest 15-minute window is {peak_bucket['label']} with {peak_bucket['count']} events and {peak_bucket['blockedCount']} blocked actions.",
                "severity": "high" if peak_bucket["blockedCount"] else "medium",
                "timeRangeStart": peak_bucket["start"],
                "timeRangeEnd": peak_bucket["end"],
            }
        )

    if summary["status4xxEvents"] or summary["status5xxEvents"]:
        findings.append(
            {
                "title": "HTTP error activity is present",
                "detail": f"{summary['status4xxEvents']} events landed in 4xx and {summary['status5xxEvents']} landed in 5xx. This can indicate policy failures, broken links, or unstable destinations.",
                "severity": "medium",
                "pivotField": "statusBand",
                "pivotValue": "4xx" if summary["status4xxEvents"] else "5xx",
            }
        )

    threat_section = next((section for section in focus_sections if section["id"] == "threat-family"), None)
    if threat_section and threat_section["items"]:
        top_item = threat_section["items"][0]
        findings.append(
            {
                "title": "Threat-tagged family appears in the dataset",
                "detail": f"{top_item['label']} appears in {top_item['value']} events and should be reviewed against known controls or recent incidents.",
                "severity": "high",
                "pivotField": top_item.get("pivotField"),
                "pivotValue": top_item.get("pivotValue"),
            }
        )

    category_section = next((section for section in focus_sections if section["id"] == "top-categories"), None)
    if category_section and category_section["items"]:
        top_item = category_section["items"][0]
        findings.append(
            {
                "title": "Traffic mix is dominated by one category",
                "detail": f"{top_item['label']} accounts for {top_item['value']} events, which may be normal baseline traffic or a signal to compare against policy expectations.",
                "severity": "low",
                "pivotField": top_item.get("pivotField"),
                "pivotValue": top_item.get("pivotValue"),
            }
        )

    return findings[:8]


def build_focus_sections(events: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        build_section(
            section_id="action-split",
            title="Action split",
            description="Allowed versus blocked activity over the full upload.",
            events=events,
            getter=lambda event: as_text(event.get("action")),
            pivot_field="action",
        ),
        build_section(
            section_id="blocked-source-ips",
            title="Blocked source IPs",
            description="Source addresses driving blocked activity.",
            events=[event for event in events if is_blocked(event)],
            getter=lambda event: as_text(event.get("client_ip")),
            pivot_field="clientIp",
        ),
        build_section(
            section_id="risky-users",
            title="Risky users",
            description="Users tied to page risk or threat-tagged events.",
            events=[event for event in events if is_risky(event)],
            getter=lambda event: as_text(event.get("user_name")),
            pivot_field="userName",
        ),
        build_section(
            section_id="top-hosts",
            title="Top hosts",
            description="Most contacted destinations.",
            events=events,
            getter=lambda event: as_text(event.get("hostname")),
            pivot_field="hostname",
        ),
        build_section(
            section_id="top-categories",
            title="Top categories",
            description="Destination categories carrying the most traffic.",
            events=events,
            getter=lambda event: as_text(event.get("url_category")),
            pivot_field="urlCategory",
        ),
        build_section(
            section_id="status-bands",
            title="Status bands",
            description="HTTP response classes across the upload.",
            events=events,
            getter=lambda event: status_band(event.get("status_code")),
            pivot_field="statusBand",
        ),
        build_section(
            section_id="threat-family",
            title="Threat families",
            description="Threat-tagged activity by family name.",
            events=[event for event in events if event.get("threat_name")],
            getter=lambda event: as_text(event.get("threat_name")),
            pivot_field="threatName",
        ),
        build_section(
            section_id="top-apps",
            title="Top apps",
            description="Applications with the most activity.",
            events=events,
            getter=lambda event: as_text(event.get("app_name")),
            pivot_field="appName",
        ),
        build_section(
            section_id="file-types",
            title="File types",
            description="Observed file types in the upload.",
            events=events,
            getter=lambda event: as_text(event.get("file_type")),
            pivot_field="fileType",
        ),
        build_section(
            section_id="departments",
            title="Departments",
            description="Traffic distribution by department when present.",
            events=events,
            getter=lambda event: as_text(event.get("department")),
            pivot_field="department",
        ),
    ]


def build_field_distributions(events: list[dict[str, object]]) -> list[dict[str, object]]:
    sections = [
        build_section(
            section_id=f"field-{key}",
            title=RAW_KEY_LABELS.get(key, key.replace("_", " ").title()),
            description=f"Top values for parser field `{key}`.",
            events=events,
            getter=lambda event, raw_key=key: as_text((event.get("raw_event") or {}).get(raw_key)),
            pivot_field=RAW_KEY_TO_PIVOT_FIELD.get(key),
            field_key=key,
        )
        for key in FIELD_NAMES
    ]
    sections.append(
        build_section(
            section_id="field-status-band",
            title="Status band",
            description="Derived HTTP response grouping.",
            events=events,
            getter=lambda event: status_band(event.get("status_code")),
            pivot_field="statusBand",
            field_key="statusBand",
        )
    )
    return sections


def build_section(
    *,
    section_id: str,
    title: str,
    description: str,
    events: list[dict[str, object]],
    getter: Callable[[dict[str, object]], str],
    pivot_field: str | None,
    field_key: str | None = None,
) -> dict[str, object]:
    counts = Counter(getter(event) for event in events)
    total = sum(counts.values())
    return {
        "id": section_id,
        "title": title,
        "description": description,
        "fieldKey": field_key,
        "pivotField": pivot_field,
        "items": [
            {
                "label": label,
                "value": value,
                "share": 0 if total == 0 else value / total,
                "pivotField": pivot_field,
                "pivotValue": label if pivot_field else None,
            }
            for label, value in counts.most_common(5)
        ],
    }


def find_peak_time_bucket(events: list[dict[str, object]], minutes: int) -> dict[str, object] | None:
    counts: dict[datetime, dict[str, int]] = {}
    for event in events:
        event_time = event.get("event_time")
        if not isinstance(event_time, datetime):
            continue
        bucket = event_time.replace(minute=(event_time.minute // minutes) * minutes, second=0, microsecond=0)
        stats = counts.setdefault(bucket, {"count": 0, "blocked": 0})
        stats["count"] += 1
        if is_blocked(event):
            stats["blocked"] += 1

    if not counts:
        return None

    peak_start, stats = max(counts.items(), key=lambda item: (item[1]["count"], item[0]))
    peak_end = peak_start + timedelta(minutes=minutes)
    return {
        "label": f"{peak_start.isoformat()} to {peak_end.isoformat()}",
        "start": peak_start.isoformat(),
        "end": peak_end.isoformat(),
        "count": stats["count"],
        "blockedCount": stats["blocked"],
    }


def is_blocked(event: dict[str, object]) -> bool:
    return as_text(event.get("action"), "").lower() == "blocked"


def is_risky(event: dict[str, object]) -> bool:
    return bool(event.get("page_risk") or event.get("threat_category") or event.get("threat_name"))


def status_band(status_code: object) -> str:
    if not isinstance(status_code, int):
        return "Unknown"
    if status_code >= 500:
        return "5xx"
    if status_code >= 400:
        return "4xx"
    if status_code >= 300:
        return "3xx"
    if status_code >= 200:
        return "2xx"
    return "Other"


def as_text(value: object, fallback: str = "Unknown") -> str:
    if value is None:
        return fallback
    if isinstance(value, str):
        return value or fallback
    return str(value)


def count_unique(events: list[dict[str, object]], getter: Callable[[dict[str, object]], str]) -> int:
    return len({getter(event) for event in events if getter(event) != "Unknown"})


def pct(value: float) -> str:
    return f"{round(value * 100)}%"
