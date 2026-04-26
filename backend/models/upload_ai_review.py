from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import db
from models.common import utc_now

if TYPE_CHECKING:
    from models.upload import Upload


class UploadAiReview(db.Model):
    __tablename__ = "upload_ai_reviews"
    __table_args__ = (UniqueConstraint("upload_id", name="uq_upload_ai_reviews_upload_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    analysis_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    provider: Mapped[str | None] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(Text)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    analyst_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    top_concerns: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    recommended_next_steps: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    suggested_views: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    anomaly_reviews: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    upload: Mapped["Upload"] = relationship(back_populates="upload_ai_review")

    def to_dict(self) -> dict[str, object]:
        return {
            "uploadId": str(self.upload_id),
            "analysisVersion": self.analysis_version,
            "provider": self.provider,
            "modelName": self.model_name,
            "executiveSummary": self.executive_summary,
            "analystSummary": self.analyst_summary,
            "topConcerns": self.top_concerns,
            "recommendedNextSteps": self.recommended_next_steps,
            "suggestedViews": self.suggested_views,
            "anomalyReviews": self.anomaly_reviews,
            "generatedAt": self.generated_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }
