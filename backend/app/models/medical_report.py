import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Enum as SAEnum
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
    # Read from the report's text: lab_report or other (only lab reports produce results),
    # the date the sample was collected, and the lab that produced it.
    document_kind = Column(String, nullable=True)
    collected_on = Column(Date, nullable=True)
    lab_name = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="medical_reports")
    medical_center = relationship("MedicalCenter", back_populates="medical_reports")
    # Deleting a report deletes these too (the foreign keys are ON DELETE CASCADE);
    # without this, SQLAlchemy would try to null their non-nullable report_id.
    ocr_result = relationship(
        "OcrResult", back_populates="medical_report", uselist=False,
        cascade="all, delete-orphan", passive_deletes=True,
    )
    blockchain_logs = relationship(
        "BlockchainLog", back_populates="medical_report",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    lab_results = relationship(
        "LabResult", back_populates="report",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    threads = relationship(
        "ReportThread", back_populates="report",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    imaging_study = relationship(
        "ImagingStudy", back_populates="medical_report", uselist=False,
        cascade="all, delete-orphan", passive_deletes=True,
    )
