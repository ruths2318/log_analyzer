#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from validate_zscaler_web_log import FIELD_NAMES


SEED = 20260424
START_TIME = datetime(2026, 4, 24, 8, 15, 0)


@dataclass(frozen=True)
class UserProfile:
    user: str
    client_ip: str
    public_ip: str
    department: str
    device: str
    owner: str
    location: str


USERS = [
    UserProfile(
        user="maya.chen@example.com",
        client_ip="172.17.3.49",
        public_ip="198.51.100.42",
        department="Finance",
        device="fin-laptop-014",
        owner="maya.chen@example.com",
        location="San Jose HQ",
    ),
    UserProfile(
        user="jordan.patel@example.com",
        client_ip="172.17.3.87",
        public_ip="198.51.100.42",
        department="Engineering",
        device="eng-mbp-022",
        owner="jordan.patel@example.com",
        location="San Jose HQ",
    ),
    UserProfile(
        user="olivia.martinez@example.com",
        client_ip="172.17.4.18",
        public_ip="203.0.113.77",
        department="Sales",
        device="sales-win-031",
        owner="olivia.martinez@example.com",
        location="Austin Branch",
    ),
    UserProfile(
        user="samir.rao@example.com",
        client_ip="172.17.5.66",
        public_ip="203.0.113.91",
        department="IT",
        device="it-linux-007",
        owner="samir.rao@example.com",
        location="Remote",
    ),
]


NORMAL_SITES = [
    ("docs.google.com", "https://docs.google.com/document/u/0/", "Business Use", "Collaboration", "Productivity", "Business and Economy", "Business Tools"),
    ("github.com", "https://github.com/org/repo", "Software", "Developer Tools", "Productivity", "Information Technology", "Developer Tools"),
    ("slack.com", "https://slack.com/api/client", "Collaboration", "Messaging", "Productivity", "Internet Communication", "Collaboration"),
    ("salesforce.com", "https://salesforce.com/lightning/page/home", "Business Use", "CRM", "Productivity", "Business and Economy", "Business Tools"),
    ("microsoft.com", "https://microsoft.com/en-us/security", "Business Use", "Technology", "Productivity", "Information Technology", "Computer and Internet Info"),
    ("okta.com", "https://okta.com/app/UserHome", "Business Use", "Identity", "Productivity", "Information Technology", "Security"),
]

SHOPPING_SITES = [
    ("ebay.com", "http://ebay.com/", "Ebay"),
    ("amazon.com", "https://amazon.com/deals", "Amazon"),
    ("bestbuy.com", "https://bestbuy.com/site/searchpage.jsp", "Best Buy"),
]

RISKY_SITES = [
    ("secure-login-update.example.net", "http://secure-login-update.example.net/account/verify", "Phishing", "Credential Phishing", "Suspicious Login Portal", "High"),
    ("cdn-update-check.example.org", "http://cdn-update-check.example.org/dropper.js", "Malware", "Trojan Downloader", "Malicious JavaScript Dropper", "Critical"),
    ("paste-share.example.biz", "http://paste-share.example.biz/a/finance-export.zip", "Suspicious", "Data Exfiltration", "Suspicious Archive Download", "Medium"),
]

PHISHING_PATHS = [
    "/account/verify",
    "/mfa",
    "/session",
    "/password-reset",
    "/billing/update",
    "/signin/continue",
]

RARE_DESTINATIONS = [
    ("invoice-review.example.top", "/download/invoice-review.docm", "docm"),
    ("newcdn-assets.example.ru", "/assets/profile-sync.js", "js"),
    ("storage-sync.example.cc", "/client/update.zip", "zip"),
    ("cdn-mirror.example.info", "/static/bootstrap.dat", "dat"),
    ("hr-policy-view.example.click", "/view/benefits-change", "None"),
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17328; Pro)",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate deterministic synthetic Zscaler Web NSS logs.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/synthetic_zscaler_web.log"),
        help="Output path for generated CSV log records",
    )
    return parser.parse_args()


def row(
    *,
    ts: datetime,
    profile: UserProfile,
    hostname: str,
    url: str,
    action: str = "Allowed",
    reason: str = "Allowed",
    event_id: int,
    protocol: str = "HTTPS",
    requestmethod: str = "GET",
    status: str = "200",
    appclass: str = "Business Use",
    appname: str = "Web Browsing",
    urlcategory: str = "Business and Economy",
    urlclass: str = "Productivity",
    urlsupercategory: str = "Business",
    useragent: str | None = None,
    serverip: str = "93.184.216.34",
    contenttype: str = "text/html",
    referer: str = "None",
    fileclass: str = "None",
    filetype: str = "None",
    pagerisk: str = "Low",
    threatcategory: str = "None",
    threatclass: str = "None",
    threatname: str = "None",
    dlpengine: str = "None",
    dlpdictionaries: str = "None",
    unscannabletype: str = "None",
    keyprotectiontype: str = "None",
    product: str = "ZIA",
    vendor: str = "Zscaler",
    bwthrottle: str = "No",
) -> dict[str, str]:
    rng = random.Random(f"{event_id}-{hostname}-{profile.user}")
    request_size = rng.randint(180, 1600)
    response_size = rng.randint(900, 180000)
    transaction_size = request_size + response_size

    return {
        "datetime": ts.strftime("%a %b %d %H:%M:%S %Y"),
        "reason": reason,
        "event_id": str(event_id),
        "protocol": protocol,
        "action": action,
        "transactionsize": str(transaction_size),
        "responsesize": str(response_size),
        "requestsize": str(request_size),
        "ClientIP": profile.client_ip,
        "appclass": appclass,
        "appname": appname,
        "bwthrottle": bwthrottle,
        "clientpublicIP": profile.public_ip,
        "contenttype": contenttype,
        "department": profile.department,
        "devicehostname": profile.device,
        "deviceowner": profile.owner,
        "dlpdictionaries": dlpdictionaries,
        "dlpengine": dlpengine,
        "fileclass": fileclass,
        "filetype": filetype,
        "hostname": hostname,
        "keyprotectiontype": keyprotectiontype,
        "location": profile.location,
        "pagerisk": pagerisk,
        "product": product,
        "refererURL": referer,
        "requestmethod": requestmethod,
        "serverip": serverip,
        "status": status,
        "threatcategory": threatcategory,
        "threatclass": threatclass,
        "threatname": threatname,
        "unscannabletype": unscannabletype,
        "url": url,
        "urlcategory": urlcategory,
        "urlclass": urlclass,
        "urlsupercategory": urlsupercategory,
        "user": profile.user,
        "useragent": useragent or rng.choice(USER_AGENTS),
        "vendor": vendor,
    }


def generate_events() -> list[dict[str, str]]:
    rng = random.Random(SEED)
    events: list[dict[str, str]] = []
    event_id = 100000

    for minute in range(0, 240, 3):
        profile = rng.choice(USERS)
        hostname, url, appclass, appname, urlclass, urlsupercategory, urlcategory = rng.choice(NORMAL_SITES)
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=minute, seconds=rng.randint(0, 50)),
                profile=profile,
                hostname=hostname,
                url=url,
                event_id=event_id,
                appclass=appclass,
                appname=appname,
                urlclass=urlclass,
                urlsupercategory=urlsupercategory,
                urlcategory=urlcategory,
                serverip=f"104.18.{rng.randint(1, 220)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    # Blocked shopping/social style policy noise from Finance.
    for offset, site in enumerate(SHOPPING_SITES * 6):
        hostname, url, appname = site
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=25 + offset, seconds=rng.randint(0, 30)),
                profile=USERS[0],
                hostname=hostname,
                url=url,
                action="Blocked",
                reason="Blocked by URL Filtering policy",
                event_id=event_id,
                protocol="HTTP" if hostname == "ebay.com" else "HTTPS",
                status="403",
                appclass="Consumer Apps",
                appname=appname,
                urlcategory="Online Shopping",
                urlclass="Shopping and Auctions",
                urlsupercategory="Personal Use",
                serverip=f"23.45.{rng.randint(1, 220)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    # A tight burst from one Engineering workstation against many hosts.
    burst_hosts = [
        "npmjs.com",
        "pypi.org",
        "api.github.com",
        "raw.githubusercontent.com",
        "registry.npmjs.org",
        "objects.githubusercontent.com",
    ]
    for i in range(32):
        hostname = burst_hosts[i % len(burst_hosts)]
        useragent = rng.choice(USER_AGENTS)
        if i % 5 == 0:
            useragent = "python-requests/2.31.0"
        elif i % 8 == 0:
            useragent = "Go-http-client/1.1"

        events.append(
            row(
                ts=START_TIME + timedelta(minutes=67, seconds=i * 7),
                profile=USERS[1],
                hostname=hostname,
                url=f"https://{hostname}/package/{i}",
                event_id=event_id,
                appclass="Software",
                appname="Developer Tools",
                urlcategory="Developer Tools",
                urlclass="Productivity",
                urlsupercategory="Information Technology",
                useragent=useragent,
                serverip=f"185.199.{rng.randint(1, 4)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    # Risky security events with threat metadata populated.
    for offset, site in enumerate(RISKY_SITES):
        hostname, url, category, threat_class, threat_name, risk = site
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=96 + offset * 4, seconds=17),
                profile=USERS[2],
                hostname=hostname,
                url=url,
                action="Blocked",
                reason="Blocked by Security policy",
                event_id=event_id,
                protocol="HTTP",
                status="403",
                appclass="Security Risk",
                appname="Unknown",
                urlcategory=category,
                urlclass="Security Risk",
                urlsupercategory="Security",
                fileclass="Archive" if url.endswith(".zip") else "Executable Content",
                filetype="zip" if url.endswith(".zip") else "js",
                pagerisk=risk,
                threatcategory=category,
                threatclass=threat_class,
                threatname=threat_name,
                useragent="curl/8.4.0",
                serverip=f"45.83.{rng.randint(1, 220)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    # A credential phishing sequence that is easy to explain in the analyst timeline.
    for i, path in enumerate(PHISHING_PATHS):
        is_landed = i == 0
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=91, seconds=i * 35),
                profile=USERS[0],
                hostname="secure-login-update.example.net",
                url=f"http://secure-login-update.example.net{path}",
                action="Allowed" if is_landed else "Blocked",
                reason="Allowed" if is_landed else "Blocked by Security policy",
                event_id=event_id,
                protocol="HTTP",
                status="200" if is_landed else "403",
                appclass="Security Risk",
                appname="Unknown",
                urlcategory="Phishing",
                urlclass="Security Risk",
                urlsupercategory="Security",
                pagerisk="High",
                threatcategory="Phishing" if not is_landed else "None",
                threatclass="Credential Phishing" if not is_landed else "None",
                threatname="Suspicious Login Portal" if not is_landed else "None",
                serverip=f"45.83.19.{80 + i}",
            )
        )
        event_id += 1

    # Rare destinations that should score highly on destination novelty and page risk.
    for i, (hostname, path, filetype) in enumerate(RARE_DESTINATIONS):
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=118 + i * 2, seconds=9),
                profile=USERS[1],
                hostname=hostname,
                url=f"https://{hostname}{path}",
                action="Allowed",
                reason="Allowed",
                event_id=event_id,
                appclass="Unknown",
                appname="Unknown",
                urlcategory="Suspicious",
                urlclass="Security Risk",
                urlsupercategory="Security",
                fileclass="Executable Content" if filetype in {"docm", "js", "zip"} else "None",
                filetype=filetype,
                pagerisk="High" if i < 3 else "Medium",
                contenttype="application/octet-stream" if filetype != "None" else "text/html",
                serverip=f"91.219.{rng.randint(1, 220)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    # Off-hours scripted access from IT to create a clear time-based anomaly.
    for i in range(14):
        events.append(
            row(
                ts=datetime(2026, 4, 24, 22, 30, 0) + timedelta(seconds=i * 23),
                profile=USERS[3],
                hostname="admin-tools.example.internal",
                url=f"https://admin-tools.example.internal/api/audit?page={i}",
                event_id=event_id,
                appclass="Business Use",
                appname="Internal Admin Portal",
                urlcategory="Business Tools",
                urlclass="Productivity",
                urlsupercategory="Business",
                useragent="curl/8.4.0",
                serverip="10.24.7.15",
                contenttype="application/json",
            )
        )
        event_id += 1

    # Repeated denied admin requests make the off-hours sequence more investigation-ready.
    for i in range(6):
        events.append(
            row(
                ts=datetime(2026, 4, 24, 22, 37, 0) + timedelta(seconds=i * 31),
                profile=USERS[3],
                hostname="admin-tools.example.internal",
                url=f"https://admin-tools.example.internal/api/users/{1000 + i}/roles",
                action="Blocked",
                reason="Admin access denied",
                event_id=event_id,
                requestmethod="POST",
                status="403",
                appclass="Business Use",
                appname="Internal Admin Portal",
                urlcategory="Business Tools",
                urlclass="Productivity",
                urlsupercategory="Business",
                useragent="curl/8.4.0",
                serverip="10.24.7.15",
                contenttype="application/json",
            )
        )
        event_id += 1

    # DLP-style uploads from Sales with populated DLP fields.
    for i in range(14):
        blocked = i >= 8
        events.append(
            row(
                ts=START_TIME + timedelta(minutes=132 + i, seconds=11),
                profile=USERS[2],
                hostname="personal-drive.example.com",
                url=f"https://personal-drive.example.com/upload/customer-list-{i}.csv",
                action="Blocked" if blocked else "Allowed",
                reason="DLP policy matched" if blocked else "Allowed",
                event_id=event_id,
                requestmethod="POST",
                status="403" if blocked else "200",
                appclass="Consumer Apps",
                appname="Personal Cloud Storage",
                urlcategory="File Sharing",
                urlclass="Personal Use",
                urlsupercategory="File Storage and Sharing",
                fileclass="Document",
                filetype="csv",
                dlpengine="Exact Data Match" if blocked else "None",
                dlpdictionaries="Customer PII" if blocked else "None",
                serverip=f"34.117.{rng.randint(1, 220)}.{rng.randint(1, 240)}",
            )
        )
        event_id += 1

    events.sort(key=lambda event: datetime.strptime(event["datetime"], "%a %b %d %H:%M:%S %Y"))
    return events


def main() -> int:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    events = generate_events()

    with args.output.open("w", newline="") as handle:
        writer = csv.writer(handle, quoting=csv.QUOTE_ALL)
        for event in events:
            writer.writerow([event[name] for name in FIELD_NAMES])

    print(f"wrote {len(events)} records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
