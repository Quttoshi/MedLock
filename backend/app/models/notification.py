import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(SAEnum(
        "access_request",
        "access_approved",
        "access_denied",
        "access_revoked",
        "report_uploaded",
        "report_approval_required",
        "medical_center_approved",
        "medical_center_rejected",
        "medical_center_registered",
        "report_consent_approved",
        "report_consent_rejected",
        "affiliation_approved",
        "affiliation_rejected",
        "blockchain_failed",
        "imaging_processed",
        "imaging_processing_failed",
        "doctor_verification_requested",
        "doctor_verification_approved",
        "doctor_verification_rejected",
        "doctor_verification_revoked",
        name="notification_type"
    ), nullable=False)
    message = Column(String, nullable=False)
    # In-app path the notification opens when clicked, e.g. /patient/reports/<id>
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    recipient_user = relationship("User", back_populates="notifications")
