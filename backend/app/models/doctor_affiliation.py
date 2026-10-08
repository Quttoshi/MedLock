import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class DoctorAffiliation(Base):
    """A doctor's membership of a medical center. A doctor can be an active member of
    several centers at once (e.g. a public hospital and their own evening clinic)."""
    __tablename__ = "doctor_affiliations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    medical_center_id = Column(
        UUID(as_uuid=True), ForeignKey("medical_centers.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # The approved request that created this membership (absent for memberships migrated
    # from the old single medical_center_id column).
    affiliation_request_id = Column(
        UUID(as_uuid=True), ForeignKey("affiliation_requests.id", ondelete="SET NULL"), nullable=True,
    )
    # active -> ended
    status = Column(String, default="active", nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    ended_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    end_reason = Column(String, nullable=True)

    __table_args__ = (
        # One active membership per doctor and center; ended ones are kept as history.
        Index(
            "uq_doctor_affiliations_active", "doctor_id", "medical_center_id",
            unique=True, postgresql_where=text("status = 'active'"),
        ),
    )

    doctor = relationship("Doctor", back_populates="affiliations")
    medical_center = relationship("MedicalCenter", back_populates="affiliations")
