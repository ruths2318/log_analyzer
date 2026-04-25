from __future__ import annotations

from functools import wraps
from typing import Callable, ParamSpec, TypeVar
from uuid import UUID

from flask import abort, session

from db import db
from models import Upload, User

P = ParamSpec("P")
R = TypeVar("R")


def get_current_user() -> User | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    try:
        parsed_id = UUID(user_id)
    except ValueError:
        return None
    return db.session.get(User, parsed_id)


def login_required(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        if get_current_user() is None:
            abort(401)
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        user = get_current_user()
        if user is None:
            abort(401)
        if not user.is_admin:
            abort(403)
        return fn(*args, **kwargs)

    return wrapper


def require_upload_access(upload: Upload, user: User) -> None:
    if user.is_admin:
        return
    if upload.user_id != user.id:
        abort(404)
