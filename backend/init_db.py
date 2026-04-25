from __future__ import annotations

from sqlalchemy import inspect, text

from app import create_app
from db import db
import models  # noqa: F401


def main() -> int:
    app = create_app()
    with app.app_context():
        db.create_all()
        ensure_upload_user_column()

    print("database schema initialized")
    return 0
def ensure_upload_user_column() -> None:
    inspector = inspect(db.engine)
    upload_columns = {column["name"] for column in inspector.get_columns("uploads")}
    if "user_id" in upload_columns:
        return

    with db.engine.begin() as connection:
        connection.execute(text("ALTER TABLE uploads ADD COLUMN user_id uuid"))
        connection.execute(
            text(
                "ALTER TABLE uploads "
                "ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_uploads_user_id ON uploads (user_id)"))


if __name__ == "__main__":
    raise SystemExit(main())
