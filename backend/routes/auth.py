from __future__ import annotations

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from auth import get_current_user, login_required
from db import db
from models import Upload, User


auth_blueprint = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_blueprint.get("/me")
def me():
    user = get_current_user()
    if user is None:
        return jsonify({"user": None}), 200
    return jsonify({"user": user.to_dict()})


@auth_blueprint.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    if user is None or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401

    session.clear()
    session["user_id"] = str(user.id)
    return jsonify({"user": user.to_dict()})


@auth_blueprint.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user is not None:
        return jsonify({"error": "username already exists"}), 409

    is_first_user = User.query.count() == 0
    user = User(
        username=username,
        password_hash=generate_password_hash(password),
        is_admin=is_first_user,
    )
    db.session.add(user)
    db.session.commit()

    if is_first_user:
        Upload.query.filter(Upload.user_id.is_(None)).update({"user_id": user.id})
        db.session.commit()

    session.clear()
    session["user_id"] = str(user.id)
    return jsonify({"user": user.to_dict()}), 201


@auth_blueprint.post("/logout")
@login_required
def logout():
    session.clear()
    return jsonify({"ok": True})
