from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from io import StringIO


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


@dataclass(frozen=True)
class ParseError(Exception):
    row_number: int
    message: str

    def __str__(self) -> str:
        return f"row {self.row_number}: {self.message}"


def parse_zscaler_web_log(content: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    reader = csv.reader(StringIO(content))

    for row_number, row in enumerate(reader, start=1):
        if not row:
            continue
        if len(row) != len(FIELD_NAMES):
            raise ParseError(row_number, f"expected {len(FIELD_NAMES)} fields, found {len(row)}")

        raw_event = dict(zip(FIELD_NAMES, row))
        event_time = parse_timestamp(raw_event["datetime"], row_number)
        status_code = parse_int(raw_event["status"])

        events.append(
            {
                "row_number": row_number,
                "event_time": event_time,
                "action": required_text(raw_event["action"], row_number, "action"),
                "protocol": nullable_text(raw_event["protocol"]),
                "request_method": nullable_text(raw_event["requestmethod"]),
                "url": nullable_text(raw_event["url"]),
                "hostname": nullable_text(raw_event["hostname"]),
                "url_category": nullable_text(raw_event["urlcategory"]),
                "url_class": nullable_text(raw_event["urlclass"]),
                "url_supercategory": nullable_text(raw_event["urlsupercategory"]),
                "user_name": nullable_text(raw_event["user"]),
                "client_ip": nullable_text(raw_event["ClientIP"]),
                "server_ip": nullable_text(raw_event["serverip"]),
                "status_code": status_code,
                "app_name": nullable_text(raw_event["appname"]),
                "app_class": nullable_text(raw_event["appclass"]),
                "department": nullable_text(raw_event["department"]),
                "location": nullable_text(raw_event["location"]),
                "user_agent": nullable_text(raw_event["useragent"]),
                "file_type": nullable_text(raw_event["filetype"]),
                "page_risk": nullable_text(raw_event["pagerisk"]),
                "threat_category": nullable_text(raw_event["threatcategory"]),
                "threat_class": nullable_text(raw_event["threatclass"]),
                "threat_name": nullable_text(raw_event["threatname"]),
                "raw_event": raw_event,
            }
        )

    return events


def parse_timestamp(value: str, row_number: int) -> datetime:
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ParseError(row_number, f"invalid datetime {value!r}")


def parse_int(value: str) -> int | None:
    normalized = nullable_text(value)
    if normalized is None:
        return None
    return int(normalized)


def nullable_text(value: str) -> str | None:
    if value in {"", "None", "NA", "N/A"}:
        return None
    return value


def required_text(value: str, row_number: int, field_name: str) -> str:
    normalized = nullable_text(value)
    if normalized is None:
        raise ParseError(row_number, f"missing required field {field_name!r}")
    return normalized
