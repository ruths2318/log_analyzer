from __future__ import annotations

from enum import Enum


class UploadStatus(str, Enum):
    UPLOADED = "uploaded"
    PARSING = "parsing"
    PARSED = "parsed"
    ANALYSIS_RUNNING = "analysis_running"
    ANALYSIS_COMPLETE = "analysis_complete"
    FAILED = "failed"
