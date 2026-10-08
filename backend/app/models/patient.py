import uuid

from sqlalchemy import Column, String, Date, ForeignKey, LargeBinary, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String(5), nullable=True)
    gender = Column(SAEnum("male", "female", "other", name="gender_type"), nullable=True)
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    # National ID (CNIC, B-Form or NICOP; 13 digits). Never stored in plain text: the
    # encrypted copy is only for showing the patient their own number, and lookups use a
    # keyed fingerprint (see patient_identity_service).
    cnic_hash = Column(String(64), unique=True, index=True, nullable=True)
    cnic_encrypted = Column(LargeBinary, nullable=True)
    cnic_key_ref = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="patient")
    medical_reports = relationship("MedicalReport", back_populates="patient")
    access_requests = relationship("AccessRequest", back_populates="patient")
