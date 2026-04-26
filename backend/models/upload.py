from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now
from models.upload_status import UploadStatus

if TYPE_CHECKING:
    from models.upload_anomaly import UploadAnomaly
    from models.log_event import LogEvent
    from models.upload_insight import UploadInsight
    from models.user import User


class Upload(db.Model):
    __tablename__ = "uploads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
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
    insights_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    anomalies_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    insights_error_message: Mapped[str | None] = mapped_column(Text)
    anomalies_error_message: Mapped[str | None] = mapped_column(Text)
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
    user: Mapped["User"] = relationship(back_populates="uploads")
    upload_insight: Mapped["UploadInsight | None"] = relationship(
        back_populates="upload",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    upload_anomalies: Mapped[list["UploadAnomaly"]] = relationship(
        back_populates="upload",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "id": str(self.id),
            "userId": str(self.user_id) if self.user_id else None,
            "ownerUsername": self.user.username if self.user else None,
            "originalFilename": self.original_filename,
            "storagePath": self.storage_path,
            "fileSizeBytes": self.file_size_bytes,
            "status": self.status.value,
            "errorMessage": self.error_message,
            "insightsStatus": self.insights_status,
            "anomaliesStatus": self.anomalies_status,
            "insightsErrorMessage": self.insights_error_message,
            "anomaliesErrorMessage": self.anomalies_error_message,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "eventCount": len(self.log_events),
        }
