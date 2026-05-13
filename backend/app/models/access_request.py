import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String, nullable=False, default="")
    status = Column(SAEnum("pending", "approved", "denied", "revoked", name="access_request_status"), default="pending", nullable=False)
    expires_at = Column(DateTime, nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("doctor_id", "patient_id", name="uq_doctor_patient_access"),
    )

    # Relationships
    doctor = relationship("Doctor", back_populates="access_requests")
    patient = relationship("Patient", back_populates="access_requests")
