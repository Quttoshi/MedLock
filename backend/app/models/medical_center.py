import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MedicalCenter(Base):
    __tablename__ = "medical_centers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False)
    address = Column(String, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="medical_center")
    approved_by_admin = relationship("Admin", back_populates="approved_medical_centers")
    doctors = relationship("Doctor", back_populates="medical_center")
    medical_reports = relationship("MedicalReport", back_populates="medical_center")
    affiliation_requests = relationship("AffiliationRequest", back_populates="medical_center")
