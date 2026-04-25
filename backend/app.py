from __future__ import annotations

from flask import Flask

from config import load_config
from db import db


def create_app() -> Flask:
    app = Flask(__name__)
    config = load_config()

    app.config["SQLALCHEMY_DATABASE_URI"] = config.database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_STORAGE_DIR"] = config.upload_storage_dir

    db.init_app(app)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
