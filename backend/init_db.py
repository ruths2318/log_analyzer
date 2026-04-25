from __future__ import annotations

from app import create_app
from db import db
import models  # noqa: F401


def main() -> int:
    app = create_app()
    with app.app_context():
        db.create_all()

    print("database schema initialized")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
