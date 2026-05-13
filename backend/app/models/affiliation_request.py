import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AffiliationRequest(Base):
    __tablename__ = "affiliation_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    medical_center_id = Column(UUID(as_uuid=True), ForeignKey("medical_centers.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String, nullable=True)
    status = Column(
        SAEnum("pending", "approved", "rejected", name="affiliation_status"),
        default="pending",
        nullable=False,
    )
    rejection_reason = Column(String, nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at = Column(DateTime, nullable=True)

    # Relationships
    doctor = relationship("Doctor", back_populates="affiliation_requests")
    medical_center = relationship("MedicalCenter", back_populates="affiliation_requests")
