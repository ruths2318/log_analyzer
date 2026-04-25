from __future__ import annotations

from uuid import UUID

from flask import Blueprint, abort, jsonify, request

from auth import admin_required
from db import db
from models import User


users_blueprint = Blueprint("users", __name__, url_prefix="/api/users")


@users_blueprint.get("")
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.asc()).all()
    return jsonify({"users": [user.to_dict() for user in users]})


@users_blueprint.patch("/<user_id>")
@admin_required
def update_user(user_id: str):
    try:
        parsed_id = UUID(user_id)
    except ValueError:
        abort(404)

    user = db.session.get(User, parsed_id)
    if user is None:
        abort(404)

    payload = request.get_json(silent=True) or {}
    is_admin = payload.get("isAdmin")
    if not isinstance(is_admin, bool):
        return jsonify({"error": "isAdmin boolean is required"}), 400

    user.is_admin = is_admin
    db.session.commit()
    return jsonify({"user": user.to_dict()})
