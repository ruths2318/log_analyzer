from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now
from models.upload_status import UploadStatus

if TYPE_CHECKING:
    from models.log_event import LogEvent


class Upload(db.Model):
    __tablename__ = "uploads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[UploadStatus] = mapped_column(
        SqlEnum(UploadStatus, name="upload_status"),
        nullable=False,
        default=UploadStatus.UPLOADED,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
    log_events: Mapped[list["LogEvent"]] = relationship(
        back_populates="upload",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "id": str(self.id),
            "originalFilename": self.original_filename,
            "storagePath": self.storage_path,
            "fileSizeBytes": self.file_size_bytes,
            "status": self.status.value,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "eventCount": len(self.log_events),
        }
