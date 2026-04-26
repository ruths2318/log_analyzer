from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now

if TYPE_CHECKING:
    from models.log_event import LogEvent
    from models.upload import Upload


class UploadAnomaly(db.Model):
    __tablename__ = "upload_anomalies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("log_events.id", ondelete="SET NULL"), nullable=True, index=True)
    row_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anomaly_type: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    group_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_range_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_range_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    context: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    upload: Mapped["Upload"] = relationship(back_populates="upload_anomalies")
    event: Mapped["LogEvent | None"] = relationship()

    def to_dict(self) -> dict[str, object]:
        return {
            "id": str(self.id),
            "uploadId": str(self.upload_id),
            "eventId": str(self.event_id) if self.event_id else None,
            "rowNumber": self.row_number,
            "anomalyType": self.anomaly_type,
            "title": self.title,
            "reason": self.reason,
            "confidenceScore": float(self.confidence_score),
            "severity": self.severity,
            "groupKey": self.group_key,
            "timeRangeStart": self.time_range_start.isoformat() if self.time_range_start else None,
            "timeRangeEnd": self.time_range_end.isoformat() if self.time_range_end else None,
            "context": self.context,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }
