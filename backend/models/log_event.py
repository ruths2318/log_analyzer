from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now
from models.upload import Upload


class LogEvent(db.Model):
    __tablename__ = "log_events"
    __table_args__ = (
        UniqueConstraint("upload_id", "row_number", name="uq_log_events_upload_row_number"),
        Index("ix_log_events_upload_id_event_time", "upload_id", "event_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    protocol: Mapped[str | None] = mapped_column(Text)
    request_method: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    hostname: Mapped[str | None] = mapped_column(Text)
    url_category: Mapped[str | None] = mapped_column(Text)
    url_class: Mapped[str | None] = mapped_column(Text)
    url_supercategory: Mapped[str | None] = mapped_column(Text)
    user_name: Mapped[str | None] = mapped_column(Text)
    client_ip: Mapped[str | None] = mapped_column(INET)
    server_ip: Mapped[str | None] = mapped_column(INET)
    status_code: Mapped[int | None] = mapped_column(Integer)
    app_name: Mapped[str | None] = mapped_column(Text)
    app_class: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text)
    file_type: Mapped[str | None] = mapped_column(Text)
    page_risk: Mapped[str | None] = mapped_column(Text)
    threat_category: Mapped[str | None] = mapped_column(Text)
    threat_class: Mapped[str | None] = mapped_column(Text)
    threat_name: Mapped[str | None] = mapped_column(Text)
    raw_event: Mapped[dict[str, str]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    upload: Mapped[Upload] = relationship(back_populates="log_events")
