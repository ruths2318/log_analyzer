from __future__ import annotations

from datetime import datetime
from pathlib import Path
import threading
from typing import IO

from flask import current_app
from werkzeug.utils import secure_filename

from db import db
from models import LogEvent, Upload, UploadAiReview, UploadAnomaly, UploadInsight, UploadStatus, User
from services import ParseError, generate_upload_ai_review, generate_upload_anomalies, generate_upload_insights, parse_zscaler_web_log


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
    upload.insights_status = "pending"
    upload.anomalies_status = "pending"
    upload.ai_review_status = "pending"
    upload.insights_error_message = None
    upload.anomalies_error_message = None
    upload.ai_review_error_message = None
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
        upload.status = UploadStatus.PARSED
        upload.error_message = None
        db.session.commit()
        schedule_post_parse_analysis(upload.id)
        refreshed_upload = db.session.get(Upload, upload.id)
        if refreshed_upload is None:
            raise RuntimeError("upload disappeared after parsing")
        return refreshed_upload, None
    except (ParseError, UnicodeDecodeError, ValueError) as exc:
        current_app.logger.exception("Upload parsing failed for upload %s", upload.id)
        db.session.rollback()
        refreshed_upload = db.session.get(Upload, upload.id)
        if refreshed_upload is None:
            raise RuntimeError("upload was lost during processing") from exc
        refreshed_upload.status = UploadStatus.FAILED
        refreshed_upload.error_message = str(exc)
        db.session.commit()
        return refreshed_upload, str(exc)


def schedule_post_parse_analysis(upload_id) -> None:
    app = current_app._get_current_object()
    current_app.logger.warning("Scheduling background analysis for upload %s", upload_id)
    worker = threading.Thread(target=run_post_parse_analysis_background, args=(app, upload_id), daemon=True)
    worker.start()


def run_post_parse_analysis_background(app, upload_id) -> None:
    with app.app_context():
        run_post_parse_analysis(upload_id, include_insights=True, include_anomalies=True, include_ai_review=True)


def run_post_parse_analysis(upload_id, *, include_insights: bool, include_anomalies: bool, include_ai_review: bool) -> Upload | None:
    upload = db.session.get(Upload, upload_id)
    if upload is None:
        return None

    current_app.logger.warning(
        "Starting analysis for upload %s (insights=%s, anomalies=%s, ai_review=%s)",
        upload_id,
        include_insights,
        include_anomalies,
        include_ai_review,
    )

    analysis_events = load_events_for_analysis(upload_id)

    if include_insights:
        upload.insights_status = "running"
        upload.insights_error_message = None
    if include_anomalies:
        upload.anomalies_status = "running"
        upload.anomalies_error_message = None
    if include_ai_review:
        upload.ai_review_status = "running"
        upload.ai_review_error_message = None
    db.session.commit()

    insight_payload = None
    if include_insights:
        try:
            current_app.logger.warning("Generating insights for upload %s", upload_id)
            insight_payload = generate_upload_insights(analysis_events)
            db.session.query(UploadInsight).filter_by(upload_id=upload_id).delete()
            db.session.add(
                UploadInsight(
                    upload_id=upload_id,
                    analysis_version=insight_payload["analysis_version"],
                    summary=insight_payload["summary"],
                    spotlight_cards=insight_payload["spotlight_cards"],
                    key_findings=insight_payload["key_findings"],
                    focus_sections=insight_payload["focus_sections"],
                    field_distributions=insight_payload["field_distributions"],
                )
            )
            upload.insights_status = "ready"
            upload.insights_error_message = None
            db.session.commit()
            current_app.logger.warning("Insights ready for upload %s", upload_id)
        except Exception as exc:  # noqa: BLE001
            current_app.logger.exception("Insight generation failed for upload %s", upload_id)
            db.session.rollback()
            upload = db.session.get(Upload, upload_id)
            if upload is not None:
                upload.insights_status = "failed"
                upload.insights_error_message = str(exc)
                db.session.commit()

    anomaly_payloads = None
    if include_anomalies:
        try:
            current_app.logger.warning("Generating anomalies for upload %s", upload_id)
            anomaly_payloads = generate_upload_anomalies(analysis_events)
            db.session.query(UploadAnomaly).filter_by(upload_id=upload_id).delete()
            db.session.add_all(
                [
                    UploadAnomaly(
                        upload_id=upload_id,
                        event_id=payload["event_id"],
                        row_number=payload["row_number"],
                        anomaly_type=payload["anomaly_type"],
                        title=payload["title"],
                        reason=payload["reason"],
                        confidence_score=payload["confidence_score"],
                        severity=payload["severity"],
                        group_key=payload["group_key"],
                        time_range_start=payload["time_range_start"],
                        time_range_end=payload["time_range_end"],
                        context=payload["context"],
                    )
                    for payload in anomaly_payloads
                ]
            )
            upload = db.session.get(Upload, upload_id)
            if upload is not None:
                upload.anomalies_status = "ready"
                upload.anomalies_error_message = None
            db.session.commit()
            current_app.logger.warning("Anomalies ready for upload %s", upload_id)
        except Exception as exc:  # noqa: BLE001
            current_app.logger.exception("Anomaly generation failed for upload %s", upload_id)
            db.session.rollback()
            upload = db.session.get(Upload, upload_id)
            if upload is not None:
                upload.anomalies_status = "failed"
                upload.anomalies_error_message = str(exc)
                db.session.commit()

    if include_ai_review:
        try:
            current_app.logger.warning("Generating AI review for upload %s", upload_id)
            upload = db.session.get(Upload, upload_id)
            stored_insight = UploadInsight.query.filter_by(upload_id=upload_id).first()
            stored_anomalies = UploadAnomaly.query.filter_by(upload_id=upload_id).order_by(UploadAnomaly.confidence_score.desc()).all()
            ai_payload = generate_upload_ai_review(
                analysis_events,
                insight_payload if insight_payload is not None else (stored_insight.to_dict() if stored_insight else {}),
                [anomaly.to_dict() for anomaly in stored_anomalies],
            )
            db.session.query(UploadAiReview).filter_by(upload_id=upload_id).delete()
            db.session.add(
                UploadAiReview(
                    upload_id=upload_id,
                    analysis_version=ai_payload["analysis_version"],
                    provider=ai_payload["provider"],
                    model_name=ai_payload["model_name"],
                    executive_summary=ai_payload["executive_summary"],
                    analyst_summary=ai_payload["analyst_summary"],
                    top_concerns=ai_payload["top_concerns"],
                    recommended_next_steps=ai_payload["recommended_next_steps"],
                    suggested_views=ai_payload["suggested_views"],
                    anomaly_reviews=ai_payload["anomaly_reviews"],
                )
            )
            if upload is not None:
                upload.ai_review_status = "ready"
                upload.ai_review_error_message = None
            db.session.commit()
            current_app.logger.warning("AI review ready for upload %s", upload_id)
        except Exception as exc:  # noqa: BLE001
            current_app.logger.exception("AI review generation failed for upload %s", upload_id)
            db.session.rollback()
            upload = db.session.get(Upload, upload_id)
            if upload is not None:
                upload.ai_review_status = "failed"
                upload.ai_review_error_message = str(exc)
                db.session.commit()

    current_app.logger.warning("Analysis finished for upload %s", upload_id)
    return db.session.get(Upload, upload_id)


def load_events_for_analysis(upload_id) -> list[dict[str, object]]:
    events = LogEvent.query.filter_by(upload_id=upload_id).order_by(LogEvent.row_number.asc()).all()
    return [
        {
            "event_id": event.id,
            "row_number": event.row_number,
            "event_time": event.event_time,
            "action": event.action,
            "protocol": event.protocol,
            "request_method": event.request_method,
            "url": event.url,
            "hostname": event.hostname,
            "url_category": event.url_category,
            "url_class": event.url_class,
            "url_supercategory": event.url_supercategory,
            "user_name": event.user_name,
            "client_ip": event.client_ip,
            "server_ip": event.server_ip,
            "status_code": event.status_code,
            "app_name": event.app_name,
            "app_class": event.app_class,
            "department": event.department,
            "location": event.location,
            "user_agent": event.user_agent,
            "file_type": event.file_type,
            "page_risk": event.page_risk,
            "threat_category": event.threat_category,
            "threat_class": event.threat_class,
            "threat_name": event.threat_name,
            "raw_event": event.raw_event,
            "created_at": event.created_at,
        }
        for event in events
    ]
