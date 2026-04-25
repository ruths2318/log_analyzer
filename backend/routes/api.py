from __future__ import annotations

from flask import Blueprint


api_blueprint = Blueprint("api", __name__, url_prefix="/api")


@api_blueprint.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
