import uuid

from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    medical_center_id = Column(UUID(as_uuid=True), ForeignKey("medical_centers.id", ondelete="SET NULL"), nullable=True)
    specialization = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="doctor")
    medical_center = relationship("MedicalCenter", back_populates="doctors")
    access_requests = relationship("AccessRequest", back_populates="doctor")
