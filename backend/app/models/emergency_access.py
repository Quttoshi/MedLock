import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class EmergencyAccess(Base):
    """"Break the glass": a hospital doctor opens a patient's records without consent
    because the patient cannot give it (e.g. unconscious). It lasts 24 hours, the patient
    is told immediately, and every report opened is recorded on the blockchain."""
    __tablename__ = "emergency_accesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    # The hospital the doctor was working at
    medical_center_id = Column(UUID(as_uuid=True), ForeignKey("medical_centers.id", ondelete="SET NULL"), nullable=True)
    reason_code = Column(String, nullable=False)
    justification = Column(Text, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    # Ended early by the doctor or the patient (expiry needs no record)
    ended_at = Column(DateTime, nullable=True)
    ended_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # The patient can report misuse; an admin then reviews it
    flagged_at = Column(DateTime, nullable=True)
    flag_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_note = Column(Text, nullable=True)

    doctor = relationship("Doctor")
    patient = relationship("Patient")
    medical_center = relationship("MedicalCenter")
    views = relationship(
        "EmergencyAccessView", back_populates="access", order_by="EmergencyAccessView.first_viewed_at",
        cascade="all, delete-orphan", passive_deletes=True,
    )


class EmergencyAccessView(Base):
    """A report opened during an emergency access (the first time only)."""
    __tablename__ = "emergency_access_views"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emergency_access_id = Column(
        UUID(as_uuid=True), ForeignKey("emergency_accesses.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    report_id = Column(UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False)
    first_viewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("emergency_access_id", "report_id", name="uq_emergency_view_report"),)

    access = relationship("EmergencyAccess", back_populates="views")
    report = relationship("MedicalReport")
