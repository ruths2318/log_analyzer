from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


AI_ANALYSIS_VERSION = 1
UI_FIELD_KEYS = [
    "action",
    "userName",
    "clientIp",
    "serverIp",
    "hostname",
    "urlCategory",
    "urlClass",
    "urlSupercategory",
    "requestMethod",
    "protocol",
    "appName",
    "appClass",
    "department",
    "location",
    "userAgent",
    "fileType",
    "riskLabel",
    "statusBand",
    "threatCategory",
    "threatClass",
    "threatName",
]


def generate_upload_ai_review(
    events: list[dict[str, object]],
    insights: dict[str, object],
    anomalies: list[dict[str, object]],
) -> dict[str, object]:
    fallback_payload = build_fallback_ai_review(events, insights, anomalies)
    api_key = os.getenv("OPENAI_API_KEY")
    model_name = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    fallback_enabled = os.getenv("AI_REVIEW_FALLBACK_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
    request_timeout_seconds = get_int_env("OPENAI_TIMEOUT_SECONDS", 90)
    summary_max_output_tokens = get_int_env("OPENAI_SUMMARY_MAX_OUTPUT_TOKENS", 900)
    views_max_output_tokens = get_int_env("OPENAI_VIEWS_MAX_OUTPUT_TOKENS", 2200)
    anomaly_max_output_tokens = get_int_env("OPENAI_ANOMALY_MAX_OUTPUT_TOKENS", 1400)

    if not api_key:
        if fallback_enabled:
            return {
                **fallback_payload,
                "analysis_version": AI_ANALYSIS_VERSION,
                "provider": "heuristic-fallback",
                "model_name": None,
            }
        raise RuntimeError("OPENAI_API_KEY is not configured for AI review")

    try:
        ai_context = build_ai_context(events, insights, anomalies)
        with ThreadPoolExecutor(max_workers=3) as executor:
            summary_future = executor.submit(
                request_openai_summary_review,
                api_key=api_key,
                model_name=model_name,
                context=ai_context,
                timeout_seconds=request_timeout_seconds,
                max_output_tokens=summary_max_output_tokens,
            )
            views_future = executor.submit(
                request_openai_suggested_views,
                api_key=api_key,
                model_name=model_name,
                context=ai_context,
                timeout_seconds=request_timeout_seconds,
                max_output_tokens=views_max_output_tokens,
            )
            anomaly_future = executor.submit(
                request_openai_anomaly_reviews,
                api_key=api_key,
                model_name=model_name,
                context=ai_context,
                timeout_seconds=request_timeout_seconds,
                max_output_tokens=anomaly_max_output_tokens,
            )
            summary_payload = summary_future.result()
            views_payload = views_future.result()
            anomaly_payload = anomaly_future.result()

        return {
            "analysis_version": AI_ANALYSIS_VERSION,
            "provider": "openai",
            "model_name": model_name,
            "executive_summary": as_text(summary_payload.get("executiveSummary")) or fallback_payload["executive_summary"],
            "analyst_summary": as_text(summary_payload.get("analystSummary")) or fallback_payload["analyst_summary"],
            "top_concerns": as_string_list(summary_payload.get("topConcerns")) or fallback_payload["top_concerns"],
            "recommended_next_steps": as_string_list(summary_payload.get("recommendedNextSteps")) or fallback_payload["recommended_next_steps"],
            "suggested_views": normalize_suggested_views(views_payload.get("suggestedViews")) or fallback_payload["suggested_views"],
            "anomaly_reviews": normalize_anomaly_reviews(anomaly_payload.get("anomalyReviews")) or fallback_payload["anomaly_reviews"],
        }
    except Exception:
        if fallback_enabled:
            return {
                **fallback_payload,
                "analysis_version": AI_ANALYSIS_VERSION,
                "provider": "heuristic-fallback",
                "model_name": None,
            }
        raise


def build_fallback_ai_review(
    events: list[dict[str, object]],
    insights: dict[str, object],
    anomalies: list[dict[str, object]],
) -> dict[str, object]:
    summary = insights.get("summary", {})
    total_events = int(summary.get("totalEvents", len(events)))
    blocked_events = int(summary.get("blockedEvents", 0))
    risky_events = int(summary.get("riskyEvents", 0))
    threat_events = int(summary.get("threatEvents", 0))
    top_anomalies = anomalies[:5]

    top_concerns = [anomaly["title"] for anomaly in top_anomalies]
    if blocked_events:
        top_concerns.append(f"{blocked_events} blocked events were observed in the upload.")
    if threat_events:
        top_concerns.append(f"{threat_events} threat-tagged events deserve analyst review.")

    recommended_next_steps = []
    for anomaly in top_anomalies[:3]:
        recommended_next_steps.append(build_next_step(anomaly))
    if not recommended_next_steps:
        recommended_next_steps.append("Review the busiest time window and compare blocked activity against top users and source IPs.")

    return {
        "executive_summary": build_executive_summary(total_events, blocked_events, risky_events, threat_events, top_anomalies),
        "analyst_summary": build_analyst_summary(top_anomalies),
        "top_concerns": top_concerns[:6],
        "recommended_next_steps": recommended_next_steps[:6],
        "suggested_views": build_suggested_views(insights, anomalies),
        "anomaly_reviews": build_anomaly_reviews(anomalies),
    }


def build_executive_summary(total_events: int, blocked_events: int, risky_events: int, threat_events: int, anomalies: list[dict[str, object]]) -> str:
    anomaly_clause = f"{len(anomalies)} suspicious detections" if anomalies else "no strong anomaly detections"
    return (
        f"This upload contains {total_events} events with {blocked_events} blocked actions, "
        f"{risky_events} risky events, and {threat_events} threat-tagged events. "
        f"Current review found {anomaly_clause} that should guide analyst pivots."
    )


def build_analyst_summary(anomalies: list[dict[str, object]]) -> str:
    if not anomalies:
        return "No strong detections were generated, so the best starting points remain blocked traffic, error bands, and concentrated destination categories."
    primary = anomalies[0]
    confidence_score = get_numeric(anomaly_value(primary, "confidence_score", "confidenceScore"), 0.7)
    return (
        f"The top detection is '{primary['title']}' with detector confidence "
        f"{int(round(confidence_score * 100))}%. "
        "Suggested investigation should start with the linked view tabs, then expand into supporting hosts, users, and time windows."
    )


def build_next_step(anomaly: dict[str, object]) -> str:
    if anomaly_value(anomaly, "time_range_start", "timeRangeStart") and anomaly_value(anomaly, "time_range_end", "timeRangeEnd"):
        return f"Pivot into the time window for '{anomaly['title']}' and compare blocked and allowed activity inside that range."
    group_key = anomaly_value(anomaly, "group_key", "groupKey")
    if group_key:
        return f"Pivot on '{group_key}' for '{anomaly['title']}' and compare supporting hosts, categories, and status bands."
    return f"Review the supporting events for '{anomaly['title']}' and compare them against baseline traffic."


def build_suggested_views(insights: dict[str, object], anomalies: list[dict[str, object]]) -> list[dict[str, object]]:
    views: list[dict[str, object]] = []
    for anomaly in anomalies[:12]:
        view = view_from_anomaly(anomaly)
        if view:
            views.append(view)

    focus_sections = {section["id"]: section for section in insights.get("focus_sections", [])}
    for section_id in (
        "action-split",
        "blocked-source-ips",
        "risky-users",
        "top-hosts",
        "top-categories",
        "status-bands",
        "threat-family",
        "top-apps",
        "file-types",
    ):
        section = focus_sections.get(section_id)
        if section and section.get("items"):
            view = view_from_focus_section(section)
            if view:
                views.append(view)

    peak_bucket = next(
        (card for card in insights.get("spotlight_cards", []) if card.get("id") == "peak-burst-window" and card.get("timeRangeStart") and card.get("timeRangeEnd")),
        None,
    )
    if peak_bucket:
        views.append(
            {
                "id": "peak-burst-window",
                "title": "Peak burst window",
                "summary": peak_bucket.get("context", "Review the busiest time window in the upload."),
                "widgets": ["clientIp", "hostname", "urlCategory", "statusBand"],
                "pivots": [],
                "timeRange": {"start": peak_bucket["timeRangeStart"], "end": peak_bucket["timeRangeEnd"]},
                "tableFields": ["clientIp", "hostname", "urlCategory", "statusBand", "threatCategory"],
                "showOnlyAnomalies": False,
            }
        )

    return dedupe_views(views)[:16]


def view_from_anomaly(anomaly: dict[str, object]) -> dict[str, object] | None:
    anomaly_type = as_text(anomaly_value(anomaly, "anomaly_type", "anomalyType"))
    context = anomaly.get("context", {})
    if anomaly_type is None:
        return None
    view_id = build_view_id(anomaly_type, anomaly)
    if anomaly_type in {"blocked_burst_by_ip", "request_burst_by_ip"} and isinstance(context.get("clientIp"), str):
        pivots = [{"field": "clientIp", "value": context["clientIp"]}]
        if anomaly_type == "blocked_burst_by_ip":
            pivots.insert(0, {"field": "action", "value": "blocked"})
        return {
            "id": view_id,
            "title": "Burst traffic review" if anomaly_type == "request_burst_by_ip" else "Blocked burst review",
            "summary": anomaly["reason"],
            "widgets": ["clientIp", "hostname", "urlCategory", "statusBand"],
            "pivots": pivots,
            "timeRange": build_time_range(anomaly),
            "tableFields": ["hostname", "urlCategory", "statusBand", "threatCategory"],
            "showOnlyAnomalies": True,
        }
    if anomaly_type == "user_destination_spread" and isinstance(context.get("userName"), str):
        return {
            "id": view_id,
            "title": "User spread review",
            "summary": anomaly["reason"],
            "widgets": ["userName", "hostname", "urlCategory", "appName"],
            "pivots": [{"field": "userName", "value": context["userName"]}],
            "timeRange": None,
            "tableFields": ["hostname", "urlCategory", "appName", "threatCategory"],
            "showOnlyAnomalies": True,
        }
    if anomaly_type == "error_spike_by_host" and isinstance(context.get("hostname"), str):
        return {
            "id": view_id,
            "title": "Host error spike review",
            "summary": anomaly["reason"],
            "widgets": ["hostname", "statusBand", "urlCategory", "userName"],
            "pivots": [{"field": "hostname", "value": context["hostname"]}, {"field": "statusBand", "value": "4xx"}],
            "timeRange": None,
            "tableFields": ["hostname", "statusBand", "urlCategory", "userName"],
            "showOnlyAnomalies": True,
        }
    if anomaly_type == "rare_user_host" and isinstance(context.get("userName"), str) and isinstance(context.get("hostname"), str):
        return {
            "id": view_id,
            "title": "Rare destination pairing",
            "summary": anomaly["reason"],
            "widgets": ["userName", "hostname", "urlCategory", "threatCategory"],
            "pivots": [{"field": "userName", "value": context["userName"]}, {"field": "hostname", "value": context["hostname"]}],
            "timeRange": None,
            "tableFields": ["hostname", "urlCategory", "threatCategory", "statusBand"],
            "showOnlyAnomalies": True,
        }
    return None


def view_from_focus_section(section: dict[str, object]) -> dict[str, object] | None:
    section_id = as_text(section.get("id"))
    items = section.get("items")
    if section_id is None or not isinstance(items, list) or not items:
        return None

    top_item = items[0]
    pivot_field = as_text(section.get("pivotField"), None)
    pivot_value = as_text(top_item.get("pivotValue"), None)
    widgets_map = {
        "action-split": ["action", "userName", "clientIp", "hostname"],
        "blocked-source-ips": ["clientIp", "hostname", "urlCategory", "statusBand"],
        "risky-users": ["userName", "hostname", "urlCategory", "threatCategory"],
        "top-hosts": ["hostname", "urlCategory", "statusBand", "userName"],
        "top-categories": ["urlCategory", "hostname", "userName", "statusBand"],
        "status-bands": ["statusBand", "hostname", "urlCategory", "userName"],
        "threat-family": ["threatName", "threatCategory", "hostname", "userName"],
        "top-apps": ["appName", "hostname", "userName", "urlCategory"],
        "file-types": ["fileType", "hostname", "userName", "urlCategory"],
    }
    table_fields_map = {
        "action-split": ["action", "hostname", "urlCategory", "statusBand"],
        "blocked-source-ips": ["clientIp", "hostname", "urlCategory", "statusBand", "threatCategory"],
        "risky-users": ["userName", "hostname", "urlCategory", "threatCategory", "statusBand"],
        "top-hosts": ["hostname", "urlCategory", "userName", "statusBand"],
        "top-categories": ["urlCategory", "hostname", "userName", "statusBand"],
        "status-bands": ["statusBand", "hostname", "urlCategory", "userName"],
        "threat-family": ["threatName", "threatCategory", "hostname", "userName"],
        "top-apps": ["appName", "hostname", "userName", "urlCategory"],
        "file-types": ["fileType", "hostname", "userName", "urlCategory"],
    }

    return {
        "id": f"focus-{section_id}",
        "title": as_text(section.get("title"), "Suggested focus"),
        "summary": as_text(section.get("description"), "AI recommends starting from this concentration view."),
        "widgets": widgets_map.get(section_id, ["userName", "clientIp", "hostname", "urlCategory"]),
        "pivots": [{"field": pivot_field, "value": pivot_value}] if pivot_field and pivot_value else [],
        "timeRange": None,
        "tableFields": table_fields_map.get(section_id, ["hostname", "urlCategory", "statusBand", "userName"]),
        "showOnlyAnomalies": section_id in {"blocked-source-ips", "risky-users", "threat-family"},
    }


def build_time_range(anomaly: dict[str, object]) -> dict[str, str] | None:
    start = anomaly_value(anomaly, "time_range_start", "timeRangeStart")
    end = anomaly_value(anomaly, "time_range_end", "timeRangeEnd")
    if isinstance(start, str) and isinstance(end, str):
        return {"start": start, "end": end}
    return None


def build_anomaly_reviews(anomalies: list[dict[str, object]]) -> list[dict[str, object]]:
    reviews = []
    for anomaly in anomalies[:12]:
        confidence_score = get_numeric(anomaly_value(anomaly, "confidence_score", "confidenceScore"), 0.7)
        reviews.append(
            {
                "anomalyId": as_text(anomaly.get("id")),
                "aiSummary": anomaly["reason"],
                "aiConfidenceScore": clamp(min(0.99, confidence_score + 0.05)),
                "threatHypothesis": hypothesis_for_anomaly(anomaly),
                "whyItMatters": why_it_matters_for_anomaly(anomaly),
                "recommendedPivotField": recommended_pivot_field(anomaly),
                "recommendedPivotValue": recommended_pivot_value(anomaly),
            }
        )
    return reviews


def hypothesis_for_anomaly(anomaly: dict[str, object]) -> str:
    return {
        "blocked_burst_by_ip": "Possible scripted browsing, malware egress, or aggressive misconfiguration from a single client IP.",
        "request_burst_by_ip": "Traffic concentration may reflect automation, scanning, or a bursty application workflow.",
        "user_destination_spread": "This pattern can indicate account misuse, exploratory browsing, or a user operating far outside normal scope.",
        "error_spike_by_host": "Concentrated error responses may indicate broken integrations, unstable destinations, or policy failures worth validating.",
        "rare_user_host": "Rare user-to-host access can indicate niche but benign workflows or truly unusual destination access that deserves validation.",
    }.get(as_text(anomaly_value(anomaly, "anomaly_type", "anomalyType"), ""), "This finding deserves targeted analyst review for unusual behavior.")


def why_it_matters_for_anomaly(anomaly: dict[str, object]) -> str:
    if anomaly_value(anomaly, "time_range_start", "timeRangeStart") and anomaly_value(anomaly, "time_range_end", "timeRangeEnd"):
        return "A narrow time window makes this detection easier to validate quickly against surrounding normal traffic."
    return "This finding narrows the investigation to a smaller slice of users, hosts, or status patterns for faster triage."


def recommended_pivot_field(anomaly: dict[str, object]) -> str | None:
    return {
        "blocked_burst_by_ip": "clientIp",
        "request_burst_by_ip": "clientIp",
        "user_destination_spread": "userName",
        "error_spike_by_host": "hostname",
        "rare_user_host": "hostname",
    }.get(as_text(anomaly_value(anomaly, "anomaly_type", "anomalyType"), ""))


def recommended_pivot_value(anomaly: dict[str, object]) -> str | None:
    context = anomaly.get("context", {})
    if not isinstance(context, dict):
        return None
    for key in ("clientIp", "userName", "hostname"):
        value = context.get(key)
        if isinstance(value, str):
            return value
    group_key = anomaly_value(anomaly, "group_key", "groupKey")
    return group_key if isinstance(group_key, str) else None


def anomaly_value(anomaly: dict[str, object], *keys: str) -> object:
    for key in keys:
        if key in anomaly:
            return anomaly[key]
    return None


def get_numeric(value: object, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def get_int_env(name: str, fallback: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return fallback
    try:
        return int(raw_value)
    except ValueError:
        return fallback


def extract_response_output_text(payload: dict[str, Any]) -> str | None:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text:
        return output_text

    output = payload.get("output")
    if not isinstance(output, list):
        return None

    chunks: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for content_item in content:
            if not isinstance(content_item, dict):
                continue
            if content_item.get("type") == "output_text" and isinstance(content_item.get("text"), str):
                chunks.append(content_item["text"])

    if chunks:
        return "".join(chunks)
    return None


def build_ai_context(events: list[dict[str, object]], insights: dict[str, object], anomalies: list[dict[str, object]]) -> dict[str, object]:
    representative_events = []
    grouped: defaultdict[str, list[dict[str, object]]] = defaultdict(list)
    for event in events[:250]:
        user = as_text(event.get("user_name"))
        grouped[user].append(event)

    for _, user_events in list(grouped.items())[:4]:
        representative_events.extend(
            {
                "rowNumber": event.get("row_number"),
                "eventTime": event.get("event_time").isoformat() if isinstance(event.get("event_time"), datetime) else None,
                "action": event.get("action"),
                "userName": event.get("user_name"),
                "clientIp": event.get("client_ip"),
                "hostname": event.get("hostname"),
                "urlCategory": event.get("url_category"),
                "statusCode": event.get("status_code"),
                "pageRisk": event.get("page_risk"),
                "threatCategory": event.get("threat_category"),
            }
            for event in user_events[:2]
        )
        if len(representative_events) >= 10:
            break

    return {
        "summary": insights.get("summary", {}),
        "spotlightCards": insights.get("spotlight_cards", []),
        "keyFindings": insights.get("key_findings", []),
        "focusSections": insights.get("focus_sections", []),
        "topAnomalies": anomalies[:8],
        "representativeEvents": representative_events[:10],
    }


def request_openai_summary_review(
    *,
    api_key: str,
    model_name: str,
    context: dict[str, object],
    timeout_seconds: int,
    max_output_tokens: int,
) -> dict[str, Any]:
    schema = {
        "name": "soc_ai_summary",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "executiveSummary": {"type": "string"},
                "analystSummary": {"type": "string"},
                "topConcerns": {"type": "array", "items": {"type": "string"}},
                "recommendedNextSteps": {"type": "array", "items": {"type": "string"}},
            },
            "required": [
                "executiveSummary",
                "analystSummary",
                "topConcerns",
                "recommendedNextSteps",
            ],
        },
    }
    instructions = (
        "You are helping a SOC analyst review proxy log analysis. "
        "Summarize risk carefully, avoid overclaiming, and write a concise SOC-style review. "
        "Return structured JSON only."
    )
    user_input = {
        "summary": context.get("summary", {}),
        "spotlightCards": context.get("spotlightCards", []),
        "keyFindings": context.get("keyFindings", []),
        "topAnomalies": context.get("topAnomalies", [])[:5],
    }
    return request_openai_json(
        api_key=api_key,
        model_name=model_name,
        request_name="summary",
        schema=schema,
        instructions=instructions,
        user_input=user_input,
        timeout_seconds=timeout_seconds,
        max_output_tokens=max_output_tokens,
    )


def request_openai_suggested_views(
    *,
    api_key: str,
    model_name: str,
    context: dict[str, object],
    timeout_seconds: int,
    max_output_tokens: int,
) -> dict[str, Any]:
    schema = {
        "name": "soc_ai_views",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "suggestedViews": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "title": {"type": "string"},
                            "summary": {"type": "string"},
                            "widgets": {"type": "array", "items": {"type": "string", "enum": UI_FIELD_KEYS}},
                            "pivots": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "field": {"type": "string", "enum": UI_FIELD_KEYS},
                                        "value": {"type": "string"},
                                    },
                                    "required": ["field", "value"],
                                },
                            },
                            "timeRange": {
                                "anyOf": [
                                    {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "properties": {
                                            "start": {"type": "string"},
                                            "end": {"type": "string"},
                                        },
                                        "required": ["start", "end"],
                                    },
                                    {"type": "null"},
                                ]
                            },
                            "tableFields": {"type": "array", "items": {"type": "string", "enum": UI_FIELD_KEYS}},
                            "showOnlyAnomalies": {"type": "boolean"},
                        },
                        "required": ["id", "title", "summary", "widgets", "pivots", "timeRange", "tableFields", "showOnlyAnomalies"],
                    },
                }
            },
            "required": ["suggestedViews"],
        },
    }
    instructions = (
        "You are helping a SOC analyst review proxy log analysis. "
        "Propose as many distinct useful investigation views as the evidence supports, preferably between 8 and 16. "
        "Maximize coverage so the analyst rarely needs to manually choose pivots or widgets. "
        "Make each suggested view materially different in pivot path, widgets, or time range coverage. "
        "Widgets must be exact field keys supported by the frontend, not chart names or descriptions. "
        "Table fields must also be exact frontend field keys only. "
        "Pivots must use exact frontend field keys and concrete values from the provided context only. "
        "Do not invent synthetic fields like timestamp, count, anomalyType, firstSeen, lastSeen, or uniqueHostnames. "
        "Use timeRange only when the provided evidence includes an exact range. "
        "Return structured JSON only."
    )
    user_input = {
        "summary": context.get("summary", {}),
        "spotlightCards": context.get("spotlightCards", []),
        "keyFindings": context.get("keyFindings", []),
        "focusSections": context.get("focusSections", []),
        "topAnomalies": context.get("topAnomalies", []),
        "allowedFields": UI_FIELD_KEYS,
    }
    return request_openai_json(
        api_key=api_key,
        model_name=model_name,
        request_name="views",
        schema=schema,
        instructions=instructions,
        user_input=user_input,
        timeout_seconds=timeout_seconds,
        max_output_tokens=max_output_tokens,
    )


def request_openai_anomaly_reviews(
    *,
    api_key: str,
    model_name: str,
    context: dict[str, object],
    timeout_seconds: int,
    max_output_tokens: int,
) -> dict[str, Any]:
    schema = {
        "name": "soc_ai_anomaly_reviews",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "anomalyReviews": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "anomalyId": {"type": "string"},
                            "aiSummary": {"type": "string"},
                            "aiConfidenceScore": {"type": "number"},
                            "threatHypothesis": {"type": "string"},
                            "whyItMatters": {"type": "string"},
                            "recommendedPivotField": {"type": ["string", "null"]},
                            "recommendedPivotValue": {"type": ["string", "null"]},
                        },
                        "required": [
                            "anomalyId",
                            "aiSummary",
                            "aiConfidenceScore",
                            "threatHypothesis",
                            "whyItMatters",
                            "recommendedPivotField",
                            "recommendedPivotValue",
                        ],
                    },
                }
            },
            "required": ["anomalyReviews"],
        },
    }
    instructions = (
        "You are helping a SOC analyst review proxy log anomalies. "
        "For each anomaly, provide an AI confidence score and concise SOC triage explanation. "
        "Return structured JSON only."
    )
    user_input = {
        "topAnomalies": context.get("topAnomalies", []),
    }
    return request_openai_json(
        api_key=api_key,
        model_name=model_name,
        request_name="anomaly_reviews",
        schema=schema,
        instructions=instructions,
        user_input=user_input,
        timeout_seconds=timeout_seconds,
        max_output_tokens=max_output_tokens,
    )


def request_openai_json(
    *,
    api_key: str,
    model_name: str,
    request_name: str,
    schema: dict[str, Any],
    instructions: str,
    user_input: dict[str, object],
    timeout_seconds: int,
    max_output_tokens: int,
) -> dict[str, Any]:
    body = {
        "model": model_name,
        "instructions": instructions,
        "input": json.dumps(user_input),
        "max_output_tokens": max_output_tokens,
        "reasoning": {"effort": "low"},
        "text": {"format": {"type": "json_schema", "name": schema["name"], "schema": schema["schema"]}},
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    print(
        f"[ai_review] requesting OpenAI {request_name} with model={model_name}, "
        f"max_output_tokens={max_output_tokens}, timeout_seconds={timeout_seconds}"
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        error_body = ""
        if exc.fp is not None:
            try:
                error_body = exc.fp.read().decode("utf-8")
            except Exception:
                error_body = ""
        raise RuntimeError(f"AI review request failed: {exc}. Response body: {error_body}") from exc
    except URLError as exc:
        raise RuntimeError(f"AI review request failed: {exc}") from exc

    if payload.get("status") == "incomplete":
        raise RuntimeError(
            f"AI review response incomplete: {payload.get('incomplete_details')}. "
            f"Usage: {payload.get('usage')}"
        )

    output_text = extract_response_output_text(payload)
    if not isinstance(output_text, str):
        raise RuntimeError(f"AI review response did not include output_text. Payload keys: {list(payload.keys())}")
    try:
        return json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"AI review JSON decode failed: {exc}. "
            f"Response status={payload.get('status')}, incomplete_details={payload.get('incomplete_details')}, "
            f"output_tail={output_text[-400:]}"
        ) from exc


def dedupe_views(views: list[dict[str, object]]) -> list[dict[str, object]]:
    deduped: list[dict[str, object]] = []
    seen = set()
    for view in views:
        view_id = view.get("id")
        if not isinstance(view_id, str) or view_id in seen:
            continue
        seen.add(view_id)
        deduped.append(view)
    return deduped


def build_view_id(anomaly_type: str, anomaly: dict[str, object]) -> str:
    group_key = as_text(anomaly_value(anomaly, "group_key", "groupKey"), "")
    start = as_text(anomaly_value(anomaly, "time_range_start", "timeRangeStart"), "")
    return f"{anomaly_type}:{group_key}:{start}"


def normalize_suggested_views(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, object]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        widget_fields = normalize_field_list(item.get("widgets"))
        pivot_items = normalize_pivots(item.get("pivots"))
        table_fields = normalize_field_list(item.get("tableFields"))
        normalized.append(
            {
                "id": as_text(item.get("id"), "suggested-view"),
                "title": as_text(item.get("title"), "Suggested view"),
                "summary": as_text(item.get("summary")),
                "widgets": widget_fields,
                "pivots": pivot_items,
                "timeRange": normalize_time_range(item.get("timeRange")),
                "tableFields": table_fields,
                "showOnlyAnomalies": bool(item.get("showOnlyAnomalies")),
            }
        )
    return normalized


def normalize_anomaly_reviews(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "anomalyId": as_text(item.get("anomalyId"), ""),
                "aiSummary": as_text(item.get("aiSummary")),
                "aiConfidenceScore": clamp(float(item.get("aiConfidenceScore", 0.7))),
                "threatHypothesis": as_text(item.get("threatHypothesis")),
                "whyItMatters": as_text(item.get("whyItMatters")),
                "recommendedPivotField": as_text(item.get("recommendedPivotField"), None),
                "recommendedPivotValue": as_text(item.get("recommendedPivotValue"), None),
            }
        )
    return normalized


def normalize_pivots(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    pivots = []
    for item in value:
        if not isinstance(item, dict):
            continue
        field = normalize_ui_field(item.get("field"))
        pivot_value = item.get("value")
        if isinstance(field, str) and isinstance(pivot_value, str):
            pivots.append({"field": field, "value": pivot_value})
    return pivots


def normalize_field_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        field = normalize_ui_field(item)
        if field and field not in normalized:
            normalized.append(field)
    return normalized


def normalize_ui_field(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    if value in UI_FIELD_KEYS:
        return value

    compact = "".join(character for character in value.lower() if character.isalnum())
    aliases = {
        "clientip": "clientIp",
        "topclientips": "clientIp",
        "sourceip": "clientIp",
        "user": "userName",
        "username": "userName",
        "hostname": "hostname",
        "host": "hostname",
        "urlcategory": "urlCategory",
        "category": "urlCategory",
        "urlclass": "urlClass",
        "urlsupercategory": "urlSupercategory",
        "requestmethod": "requestMethod",
        "method": "requestMethod",
        "protocol": "protocol",
        "appname": "appName",
        "app": "appName",
        "appclass": "appClass",
        "department": "department",
        "location": "location",
        "useragent": "userAgent",
        "filetype": "fileType",
        "risk": "riskLabel",
        "risklabel": "riskLabel",
        "statusband": "statusBand",
        "status": "statusBand",
        "threatcategory": "threatCategory",
        "threatclass": "threatClass",
        "threatname": "threatName",
        "serverip": "serverIp",
    }
    if compact in aliases:
        return aliases[compact]

    for alias, field in aliases.items():
        if alias in compact:
            return field
    return None


def normalize_time_range(value: object) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    start = value.get("start")
    end = value.get("end")
    if isinstance(start, str) and isinstance(end, str):
        return {"start": start, "end": end}
    return None


def as_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def as_text(value: object, fallback: str | None = "") -> str | None:
    if value is None:
        return fallback
    if isinstance(value, str):
        return value or fallback
    return str(value)


def clamp(value: float) -> float:
    return max(0.5, min(0.99, round(value, 2)))
