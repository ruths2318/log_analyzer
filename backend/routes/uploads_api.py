from __future__ import annotations

from uuid import UUID

from flask import Blueprint, abort, jsonify, request

from auth import get_current_user, login_required, require_upload_access
from db import db
from models import LogEvent, Upload, UploadInsight
from routes.uploads import create_upload_record


uploads_blueprint = Blueprint("uploads", __name__, url_prefix="/api/uploads")


@uploads_blueprint.get("")
@login_required
def list_uploads():
    current_user = get_current_user()
    assert current_user is not None

    limit = min(request.args.get("limit", default=20, type=int), 100)
    offset = max(request.args.get("offset", default=0, type=int), 0)
    owner_id = request.args.get("ownerId")
    scope = request.args.get("scope", default="mine", type=str)

    query = Upload.query.order_by(Upload.created_at.desc())
    if not current_user.is_admin or scope == "mine":
        query = query.filter_by(user_id=current_user.id)
    elif owner_id:
        query = query.filter_by(user_id=owner_id)

    total = query.count()
    uploads = query.offset(offset).limit(limit).all()
    return jsonify(
        {
            "uploads": [upload.to_dict() for upload in uploads],
            "pagination": {"limit": limit, "offset": offset, "total": total},
        }
    )


@uploads_blueprint.get("/<upload_id>")
@login_required
def get_upload(upload_id: str):
    current_user = get_current_user()
    assert current_user is not None
    upload = get_upload_or_404(upload_id)
    require_upload_access(upload, current_user)
    return jsonify({"upload": upload.to_dict()})


@uploads_blueprint.get("/<upload_id>/events")
@login_required
def get_upload_events(upload_id: str):
    current_user = get_current_user()
    assert current_user is not None
    upload = get_upload_or_404(upload_id)
    require_upload_access(upload, current_user)

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


@uploads_blueprint.get("/<upload_id>/insights")
@login_required
def get_upload_insights(upload_id: str):
    current_user = get_current_user()
    assert current_user is not None
    upload = get_upload_or_404(upload_id)
    require_upload_access(upload, current_user)

    insight = UploadInsight.query.filter_by(upload_id=upload.id).first()
    if insight is None:
        return jsonify({"error": "insights are not available for this upload"}), 404
    return jsonify({"upload": upload.to_dict(), "insights": insight.to_dict()})


@uploads_blueprint.post("")
@login_required
def create_upload():
    current_user = get_current_user()
    assert current_user is not None

    uploaded_file = request.files.get("file")
    if uploaded_file is None or uploaded_file.filename == "":
        return jsonify({"error": "file is required"}), 400

    upload, error = create_upload_record(uploaded_file, current_user)
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
