from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now

if TYPE_CHECKING:
    from models.upload import Upload


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    uploads: Mapped[list["Upload"]] = relationship(back_populates="user")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": str(self.id),
            "username": self.username,
            "isAdmin": self.is_admin,
            "createdAt": self.created_at.isoformat(),
        }
