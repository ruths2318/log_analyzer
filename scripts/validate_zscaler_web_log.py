#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import ipaddress
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse


FIELD_NAMES = [
    "datetime",
    "reason",
    "event_id",
    "protocol",
    "action",
    "transactionsize",
    "responsesize",
    "requestsize",
    "ClientIP",
    "appclass",
    "appname",
    "bwthrottle",
    "clientpublicIP",
    "contenttype",
    "department",
    "devicehostname",
    "deviceowner",
    "dlpdictionaries",
    "dlpengine",
    "fileclass",
    "filetype",
    "hostname",
    "keyprotectiontype",
    "location",
    "pagerisk",
    "product",
    "refererURL",
    "requestmethod",
    "serverip",
    "status",
    "threatcategory",
    "threatclass",
    "threatname",
    "unscannabletype",
    "url",
    "urlcategory",
    "urlclass",
    "urlsupercategory",
    "user",
    "useragent",
    "vendor",
]

TIMESTAMP_FORMATS = ("%a %b %d %H:%M:%S %Y", "%a %b %e %H:%M:%S %Y", "%Y-%m-%d %H:%M:%S")
VALID_ACTIONS = {"Allowed", "Blocked", "Cautioned", "Redirected", "Isolated"}
VALID_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT"}
SUSPICIOUS_UA_MARKERS = ("curl", "python-requests", "wget", "powershell", "go-http-client")
RISKY_CATEGORIES = {
    "Phishing",
    "Malware",
    "Botnets",
    "Spyware",
    "Suspicious",
    "Command and Control",
}
DOWNLOAD_FILE_TYPES = {"exe", "zip", "js", "docm", "xlsm", "iso", "dll", "ps1"}


@dataclass
class ValidationResult:
    errors: list[str]
    warnings: list[str]

    def ok(self) -> bool:
        return not self.errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate Zscaler Web NSS CSV data and assert expected detection scenarios."
    )
    parser.add_argument("path", type=Path, help="Path to the CSV-style Zscaler web log file")
    parser.add_argument("--min-rows", type=int, default=1, help="Minimum number of records required")
    parser.add_argument(
        "--require-action",
        action="append",
        default=[],
        help="Require at least one event with this action value",
    )
    parser.add_argument(
        "--require-user-agent",
        action="append",
        default=[],
        help="Require at least one event whose user agent contains this substring",
    )
    parser.add_argument(
        "--require-category",
        action="append",
        default=[],
        help="Require at least one event with this URL category",
    )
    parser.add_argument(
        "--require-offhours",
        action="store_true",
        help="Require at least one event outside 06:00-20:00",
    )
    parser.add_argument(
        "--require-download",
        action="store_true",
        help="Require at least one event with a suspicious downloadable file type",
    )
    parser.add_argument(
        "--require-threat",
        action="store_true",
        help="Require at least one event with threat fields populated",
    )
    parser.add_argument(
        "--require-burst",
        action="store_true",
        help="Require at least one user/IP burst over the configured threshold",
    )
    parser.add_argument("--burst-threshold", type=int, default=10, help="Events needed to count as a burst")
    parser.add_argument(
        "--burst-window-minutes",
        type=int,
        default=5,
        help="Window size for burst detection in minutes",
    )
    return parser.parse_args()


def parse_timestamp(value: str) -> datetime | None:
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def is_ip(value: str) -> bool:
    if value in {"", "None", "NA", "N/A", "0.0.0.0"}:
        return True
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def is_int_like(value: str) -> bool:
    if value in {"", "None", "NA", "N/A"}:
        return True
    return bool(re.fullmatch(r"-?\d+", value))


def is_status(value: str) -> bool:
    if value in {"", "None", "NA", "N/A"}:
        return True
    return bool(re.fullmatch(r"\d{3}", value))


def is_url_like(value: str) -> bool:
    if value in {"", "None", "NA", "N/A"}:
        return True
    candidate = value if "://" in value else f"http://{value}"
    parsed = urlparse(candidate)
    return bool(parsed.netloc)


def is_email_like(value: str) -> bool:
    if value in {"", "None", "NA", "N/A"}:
        return True
    return "@" in value


def validate_row(row_num: int, row: list[str]) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    if len(row) != len(FIELD_NAMES):
        errors.append(
            f"row {row_num}: expected {len(FIELD_NAMES)} fields, found {len(row)}"
        )
        return ValidationResult(errors=errors, warnings=warnings)

    event = dict(zip(FIELD_NAMES, row))

    if not parse_timestamp(event["datetime"]):
        errors.append(f"row {row_num}: invalid datetime {event['datetime']!r}")

    if event["action"] not in VALID_ACTIONS:
        warnings.append(f"row {row_num}: uncommon action {event['action']!r}")

    if event["requestmethod"] not in VALID_METHODS and event["requestmethod"] not in {"", "None", "NA", "N/A"}:
        warnings.append(f"row {row_num}: uncommon request method {event['requestmethod']!r}")

    for name in ("transactionsize", "responsesize", "requestsize"):
        if not is_int_like(event[name]):
            errors.append(f"row {row_num}: {name} is not numeric: {event[name]!r}")

    for name in ("ClientIP", "clientpublicIP", "serverip"):
        if not is_ip(event[name]):
            errors.append(f"row {row_num}: invalid IP in {name}: {event[name]!r}")

    if not is_status(event["status"]):
        errors.append(f"row {row_num}: invalid status {event['status']!r}")

    for name in ("url", "refererURL", "hostname"):
        if not is_url_like(event[name]) and name != "hostname":
            errors.append(f"row {row_num}: invalid {name}: {event[name]!r}")
        if name == "hostname" and event[name] not in {"", "None", "NA", "N/A"} and "." not in event[name]:
            warnings.append(f"row {row_num}: hostname does not look like an FQDN: {event[name]!r}")

    if not is_email_like(event["user"]):
        warnings.append(f"row {row_num}: user is not email-like: {event['user']!r}")

    return ValidationResult(errors=errors, warnings=warnings)


def iter_rows(path: Path) -> Iterable[list[str]]:
    with path.open(newline="") as handle:
        reader = csv.reader(handle)
        yield from reader


def count_bursts(events: list[dict[str, str]], threshold: int, window_minutes: int) -> int:
    grouped: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    for event in events:
        ts = parse_timestamp(event["datetime"])
        if not ts:
            continue
        grouped[(event["user"], event["ClientIP"])].append(ts)

    bursts = 0
    window = timedelta(minutes=window_minutes)
    for timestamps in grouped.values():
        timestamps.sort()
        left = 0
        for right, ts in enumerate(timestamps):
            while ts - timestamps[left] > window:
                left += 1
            if right - left + 1 >= threshold:
                bursts += 1
                break
    return bursts


def summarize(events: list[dict[str, str]], args: argparse.Namespace) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    actions = Counter(event["action"] for event in events)
    categories = Counter(event["urlcategory"] for event in events)
    offhours = 0
    suspicious_ua = 0
    threats = 0
    downloads = 0

    for event in events:
        ts = parse_timestamp(event["datetime"])
        if ts and (ts.hour < 6 or ts.hour >= 20):
            offhours += 1

        ua = event["useragent"].lower()
        if any(marker in ua for marker in SUSPICIOUS_UA_MARKERS):
            suspicious_ua += 1

        if any(event[field] not in {"", "None", "NA", "N/A"} for field in ("threatcategory", "threatclass", "threatname")):
            threats += 1

        if event["filetype"].lower() in DOWNLOAD_FILE_TYPES:
            downloads += 1

    bursts = count_bursts(events, args.burst_threshold, args.burst_window_minutes)

    if len(events) < args.min_rows:
        errors.append(f"dataset: expected at least {args.min_rows} rows, found {len(events)}")

    for action in args.require_action:
        if actions[action] == 0:
            errors.append(f"dataset: missing required action {action!r}")

    for marker in args.require_user_agent:
        if not any(marker.lower() in event["useragent"].lower() for event in events):
            errors.append(f"dataset: no user agent contains {marker!r}")

    for category in args.require_category:
        if categories[category] == 0:
            errors.append(f"dataset: missing required category {category!r}")

    if args.require_offhours and offhours == 0:
        errors.append("dataset: missing off-hours activity")

    if args.require_download and downloads == 0:
        errors.append("dataset: missing suspicious download activity")

    if args.require_threat and threats == 0:
        errors.append("dataset: missing populated threat fields")

    if args.require_burst and bursts == 0:
        errors.append(
            "dataset: missing burst activity "
            f"(threshold={args.burst_threshold}, window={args.burst_window_minutes}m)"
        )

    if events and suspicious_ua == 0:
        warnings.append("dataset: no suspicious/script-like user agents were observed")

    if events and not any(category in RISKY_CATEGORIES for category in categories):
        warnings.append("dataset: no risky URL categories were observed")

    print(f"rows={len(events)}")
    print(f"actions={dict(actions)}")
    print(f"top_url_categories={dict(categories.most_common(5))}")
    print(f"offhours_events={offhours}")
    print(f"suspicious_user_agents={suspicious_ua}")
    print(f"threat_events={threats}")
    print(f"suspicious_download_events={downloads}")
    print(f"bursty_entities={bursts}")

    return ValidationResult(errors=errors, warnings=warnings)


def main() -> int:
    args = parse_args()
    if not args.path.exists():
        print(f"error: file not found: {args.path}", file=sys.stderr)
        return 2

    row_errors: list[str] = []
    row_warnings: list[str] = []
    events: list[dict[str, str]] = []

    for row_num, row in enumerate(iter_rows(args.path), start=1):
        result = validate_row(row_num, row)
        row_errors.extend(result.errors)
        row_warnings.extend(result.warnings)
        if len(row) == len(FIELD_NAMES):
            events.append(dict(zip(FIELD_NAMES, row)))

    summary = summarize(events, args)
    row_errors.extend(summary.errors)
    row_warnings.extend(summary.warnings)

    for warning in row_warnings:
        print(f"warning: {warning}", file=sys.stderr)

    for error in row_errors:
        print(f"error: {error}", file=sys.stderr)

    if row_errors:
        print("validation=failed")
        return 1

    print("validation=passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
