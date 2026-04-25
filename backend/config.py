from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class AppConfig:
    database_url: str
    upload_storage_dir: str


def load_config() -> AppConfig:
    return AppConfig(
        database_url=os.environ.get(
            "DATABASE_URL",
            "postgresql://log_analyzer:log_analyzer_dev@localhost:5432/log_analyzer",
        ),
        upload_storage_dir=os.environ.get("UPLOAD_STORAGE_DIR", "uploads"),
    )
