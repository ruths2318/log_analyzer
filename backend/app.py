from __future__ import annotations

from flask import Flask

from config import load_config
from db import db
from routes import api_blueprint, auth_blueprint, uploads_blueprint, users_blueprint
from schema_sync import ensure_database_schema


def create_app() -> Flask:
    app = Flask(__name__)
    config = load_config()

    app.config["SECRET_KEY"] = config.secret_key
    app.config["SQLALCHEMY_DATABASE_URI"] = config.database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_STORAGE_DIR"] = config.upload_storage_dir
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    with app.app_context():
        ensure_database_schema()
    app.register_blueprint(api_blueprint)
    app.register_blueprint(auth_blueprint)
    app.register_blueprint(uploads_blueprint)
    app.register_blueprint(users_blueprint)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
