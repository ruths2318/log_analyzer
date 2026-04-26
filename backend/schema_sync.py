from __future__ import annotations

from sqlalchemy import inspect, text

from db import db


def ensure_database_schema() -> None:
    db.create_all()
    ensure_upload_user_column()
    ensure_upload_analysis_columns()


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


def ensure_upload_analysis_columns() -> None:
    inspector = inspect(db.engine)
    upload_columns = {column["name"] for column in inspector.get_columns("uploads")}
    alterations = [
        ("insights_status", "ALTER TABLE uploads ADD COLUMN insights_status text DEFAULT 'pending' NOT NULL"),
        ("anomalies_status", "ALTER TABLE uploads ADD COLUMN anomalies_status text DEFAULT 'pending' NOT NULL"),
        ("insights_error_message", "ALTER TABLE uploads ADD COLUMN insights_error_message text"),
        ("anomalies_error_message", "ALTER TABLE uploads ADD COLUMN anomalies_error_message text"),
    ]

    with db.engine.begin() as connection:
        for column_name, statement in alterations:
            if column_name not in upload_columns:
                connection.execute(text(statement))
