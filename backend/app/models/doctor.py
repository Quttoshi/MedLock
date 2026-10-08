import uuid

from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    specialization = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # How the doctor was verified: "medical_center" (affiliation approved by a hospital)
    # or "admin" (independent doctor checked against the PMDC register).
    verification_method = Column(String, nullable=True)
    verified_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    # Verification lapses when the license does.
    license_expires_at = Column(Date, nullable=True)
    verification_note = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="doctor", foreign_keys=[user_id])
    verified_by = relationship("User", foreign_keys=[verified_by_user_id])
    affiliations = relationship(
        "DoctorAffiliation", back_populates="doctor",
        order_by="DoctorAffiliation.joined_at", cascade="all, delete-orphan", passive_deletes=True,
    )
    access_requests = relationship("AccessRequest", back_populates="doctor")
    affiliation_requests = relationship("AffiliationRequest", back_populates="doctor")
    verification_requests = relationship(
        "DoctorVerificationRequest", back_populates="doctor",
        order_by="DoctorVerificationRequest.submitted_at.desc()",
        cascade="all, delete-orphan", passive_deletes=True,
    )
