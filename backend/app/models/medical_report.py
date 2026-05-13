import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    medical_center_id = Column(UUID(as_uuid=True), ForeignKey("medical_centers.id", ondelete="SET NULL"), nullable=True)
    original_filename = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    encryption_key_ref = Column(String, nullable=False)
    file_hash_sha256 = Column(String, nullable=False)
    upload_source = Column(SAEnum("patient", "medical_center", name="upload_source_type"), nullable=False)
    is_approved = Column(Boolean, default=True, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="medical_reports")
    medical_center = relationship("MedicalCenter", back_populates="medical_reports")
    ocr_result = relationship("OcrResult", back_populates="medical_report", uselist=False)
    blockchain_logs = relationship("BlockchainLog", back_populates="medical_report")
