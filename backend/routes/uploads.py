from __future__ import annotations

from pathlib import Path
from typing import IO

from flask import current_app
from werkzeug.utils import secure_filename

from db import db
from models import LogEvent, Upload, UploadInsight, UploadStatus, User
from services import ParseError, generate_upload_insights, parse_zscaler_web_log


def create_upload_record(uploaded_file: IO[bytes], user: User) -> tuple[Upload, str | None]:
    safe_name = secure_filename(uploaded_file.filename) or "upload.log"
    upload = Upload(
        user_id=user.id,
        original_filename=uploaded_file.filename,
        storage_path="",
        file_size_bytes=0,
        status=UploadStatus.UPLOADED,
    )
    db.session.add(upload)
    db.session.flush()

    storage_dir = Path(current_app.config["UPLOAD_STORAGE_DIR"]) / str(upload.id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_path = storage_dir / safe_name
    uploaded_file.save(storage_path)

    upload.storage_path = str(storage_path)
    upload.file_size_bytes = storage_path.stat().st_size
    upload.status = UploadStatus.PARSING
    db.session.commit()

    try:
        events = parse_zscaler_web_log(storage_path.read_text(encoding="utf-8-sig"))
        db.session.query(LogEvent).filter_by(upload_id=upload.id).delete()
        db.session.add_all(
            [
                LogEvent(
                    upload_id=upload.id,
                    row_number=event["row_number"],
                    event_time=event["event_time"],
                    action=event["action"],
                    protocol=event["protocol"],
                    request_method=event["request_method"],
                    url=event["url"],
                    hostname=event["hostname"],
                    url_category=event["url_category"],
                    url_class=event["url_class"],
                    url_supercategory=event["url_supercategory"],
                    user_name=event["user_name"],
                    client_ip=event["client_ip"],
                    server_ip=event["server_ip"],
                    status_code=event["status_code"],
                    app_name=event["app_name"],
                    app_class=event["app_class"],
                    department=event["department"],
                    location=event["location"],
                    user_agent=event["user_agent"],
                    file_type=event["file_type"],
                    page_risk=event["page_risk"],
                    threat_category=event["threat_category"],
                    threat_class=event["threat_class"],
                    threat_name=event["threat_name"],
                    raw_event=event["raw_event"],
                )
                for event in events
            ]
        )
        insight_payload = generate_upload_insights(events)
        db.session.query(UploadInsight).filter_by(upload_id=upload.id).delete()
        db.session.add(
            UploadInsight(
                upload_id=upload.id,
                analysis_version=insight_payload["analysis_version"],
                summary=insight_payload["summary"],
                spotlight_cards=insight_payload["spotlight_cards"],
                key_findings=insight_payload["key_findings"],
                focus_sections=insight_payload["focus_sections"],
                field_distributions=insight_payload["field_distributions"],
            )
        )
        upload.status = UploadStatus.PARSED
        upload.error_message = None
        db.session.commit()
        refreshed_upload = db.session.get(Upload, upload.id)
        if refreshed_upload is None:
            raise RuntimeError("upload disappeared after parsing")
        return refreshed_upload, None
    except (ParseError, UnicodeDecodeError, ValueError) as exc:
        db.session.rollback()
        refreshed_upload = db.session.get(Upload, upload.id)
        if refreshed_upload is None:
            raise RuntimeError("upload was lost during processing") from exc
        refreshed_upload.status = UploadStatus.FAILED
        refreshed_upload.error_message = str(exc)
        db.session.commit()
        return refreshed_upload, str(exc)
