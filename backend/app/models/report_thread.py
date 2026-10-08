import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ReportThread(Base):
    """A private question-and-answer thread between a patient and one doctor about one
    report. Each doctor gets their own thread; other doctors never see it."""
    __tablename__ = "report_threads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    # open -> resolved -> open (a new message reopens a resolved thread)
    status = Column(String, default="open", nullable=False)
    resolved_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Unread tracking: a thread is unread for a side when its last message is newer.
    patient_last_read_at = Column(DateTime, nullable=True)
    doctor_last_read_at = Column(DateTime, nullable=True)
    # At most one email per side per thread a day; in-app notifications are not limited.
    patient_last_emailed_at = Column(DateTime, nullable=True)
    doctor_last_emailed_at = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("report_id", "doctor_id", name="uq_report_thread_doctor"),)

    report = relationship("MedicalReport", back_populates="threads")
    doctor = relationship("Doctor")
    patient = relationship("Patient")
    messages = relationship(
        "ReportThreadMessage", back_populates="thread", order_by="ReportThreadMessage.sent_at",
        cascade="all, delete-orphan", passive_deletes=True,
    )


class ReportThreadMessage(Base):
    """One message in a report thread. Messages cannot be edited or deleted; the text is
    stored encrypted with the same AES-256-GCM scheme as report files."""
    __tablename__ = "report_thread_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey("report_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sender_role = Column(String, nullable=False)  # patient | doctor
    body_encrypted = Column(LargeBinary, nullable=False)
    body_key_ref = Column(String, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    thread = relationship("ReportThread", back_populates="messages")
    sender = relationship("User")
