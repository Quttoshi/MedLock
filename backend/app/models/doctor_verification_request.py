import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class DoctorVerificationRequest(Base):
    """An independent doctor's request to have their license verified by an admin,
    who checks it against the PMDC register."""
    __tablename__ = "doctor_verification_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    registration_number = Column(String, nullable=False)
    # Expiry as stated by the doctor; the admin confirms it from the register on approval.
    license_expires_at = Column(Date, nullable=True)
    # Optional PMDC certificate, stored encrypted
    certificate_path = Column(String, nullable=True)
    certificate_key_ref = Column(String, nullable=True)
    certificate_filename = Column(String, nullable=True)
    certificate_content_type = Column(String, nullable=True)
    # pending -> approved | rejected
    status = Column(String, default="pending", nullable=False, index=True)
    admin_note = Column(String, nullable=True)
    reviewed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    doctor = relationship("Doctor", back_populates="verification_requests")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])
