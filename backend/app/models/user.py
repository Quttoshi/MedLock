import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum("patient", "doctor", "medical_center", "admin", name="user_role"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="user", uselist=False)
    doctor = relationship("Doctor", back_populates="user", uselist=False)
    medical_center = relationship("MedicalCenter", back_populates="user", uselist=False)
    admin = relationship("Admin", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="performed_by_user")
    notifications = relationship("Notification", back_populates="recipient_user")
