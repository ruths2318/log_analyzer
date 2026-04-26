from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now

if TYPE_CHECKING:
    from models.upload import Upload


class UploadInsight(db.Model):
    __tablename__ = "upload_insights"
    __table_args__ = (UniqueConstraint("upload_id", name="uq_upload_insights_upload_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    analysis_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    summary: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    spotlight_cards: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    key_findings: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    focus_sections: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    field_distributions: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    upload: Mapped["Upload"] = relationship(back_populates="upload_insight")

    def to_dict(self) -> dict[str, object]:
        return {
            "uploadId": str(self.upload_id),
            "analysisVersion": self.analysis_version,
            "summary": self.summary,
            "spotlightCards": self.spotlight_cards,
            "keyFindings": self.key_findings,
            "focusSections": self.focus_sections,
            "fieldDistributions": self.field_distributions,
            "generatedAt": self.generated_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }
