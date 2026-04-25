from __future__ import annotations

from uuid import UUID

from flask import Blueprint, abort, jsonify, request

from db import db
from models import LogEvent, Upload
from routes.uploads import create_upload_record


api_blueprint = Blueprint("api", __name__, url_prefix="/api")


@api_blueprint.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api_blueprint.get("/uploads")
def list_uploads():
    uploads = Upload.query.order_by(Upload.created_at.desc()).all()
    return jsonify({"uploads": [upload.to_dict() for upload in uploads]})


@api_blueprint.get("/uploads/<upload_id>")
def get_upload(upload_id: str):
    upload = get_upload_or_404(upload_id)
    return jsonify({"upload": upload.to_dict()})


@api_blueprint.get("/uploads/<upload_id>/events")
def get_upload_events(upload_id: str):
    upload = get_upload_or_404(upload_id)
    limit = min(request.args.get("limit", default=200, type=int), 1000)
    offset = max(request.args.get("offset", default=0, type=int), 0)
    events = (
        LogEvent.query.filter_by(upload_id=upload.id)
        .order_by(LogEvent.row_number.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = LogEvent.query.filter_by(upload_id=upload.id).count()
    return jsonify(
        {
            "upload": upload.to_dict(),
            "events": [event.to_dict() for event in events],
            "pagination": {"limit": limit, "offset": offset, "total": total},
        }
    )


@api_blueprint.post("/uploads")
def create_upload():
    uploaded_file = request.files.get("file")
    if uploaded_file is None or uploaded_file.filename == "":
        return jsonify({"error": "file is required"}), 400

    upload, error = create_upload_record(uploaded_file)
    if error is not None:
        return jsonify({"upload": upload.to_dict(), "error": error}), 400
    return jsonify({"upload": upload.to_dict()}), 201


def get_upload_or_404(upload_id: str) -> Upload:
    try:
        parsed_id = UUID(upload_id)
    except ValueError:
        abort(404)

    upload = db.session.get(Upload, parsed_id)
    if upload is None:
        abort(404)
    return upload
