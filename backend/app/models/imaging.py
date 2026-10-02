import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ImagingStudy(Base):
    """A DICOM study (CT, X-ray, MRI...) uploaded as an imaging report.

    The study's files are stored as encrypted parts listed in an encrypted manifest;
    the parent medical report's file_url/file_hash_sha256 refer to that manifest.
    """
    __tablename__ = "imaging_studies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(
        UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), unique=True, nullable=False,
    )
    study_uid = Column(String, nullable=False, index=True)
    modality = Column(String, nullable=True)
    body_part = Column(String, nullable=True)
    study_date = Column(Date, nullable=True)
    study_description = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    series_count = Column(Integer, default=0, nullable=False)
    instance_count = Column(Integer, default=0, nullable=False)

    # pending -> processing -> completed | failed
    processing_status = Column(String, default="pending", nullable=False, index=True)
    processing_error = Column(Text, nullable=True)
    processing_attempts = Column(Integer, default=0, nullable=False)
    processing_started_at = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    # Encrypted upload awaiting processing (local file) and its AES-GCM nonce reference
    staging_path = Column(String, nullable=True)
    staging_key_ref = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    medical_report = relationship("MedicalReport", back_populates="imaging_study")
    series = relationship(
        "ImagingSeries", back_populates="study", order_by="ImagingSeries.series_number",
        cascade="all, delete-orphan", passive_deletes=True,
    )


class ImagingSeries(Base):
    __tablename__ = "imaging_series"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_id = Column(UUID(as_uuid=True), ForeignKey("imaging_studies.id", ondelete="CASCADE"), nullable=False, index=True)
    series_uid = Column(String, nullable=False)
    series_number = Column(Integer, nullable=True)
    modality = Column(String, nullable=True)
    description = Column(String, nullable=True)
    body_part = Column(String, nullable=True)
    instance_count = Column(Integer, default=0, nullable=False)
    rows = Column(Integer, nullable=True)
    columns = Column(Integer, nullable=True)
    slice_thickness_mm = Column(Float, nullable=True)
    pixel_spacing_mm = Column(JSONB, nullable=True)  # [row spacing, column spacing]
    # MRI acquisition details (empty for other modalities)
    sequence_name = Column(String, nullable=True)
    magnetic_field_strength_t = Column(Float, nullable=True)
    repetition_time_ms = Column(Float, nullable=True)
    echo_time_ms = Column(Float, nullable=True)
    contrast_agent = Column(String, nullable=True)

    # Storage paths of this series' encrypted parts (key references live in the encrypted manifest)
    part_paths = Column(JSONB, nullable=False, default=list)
    preview_path = Column(String, nullable=True)
    preview_key_ref = Column(String, nullable=True)
    # Slice viewer: every slice as JPEG, zipped, encrypted and stored in parts.
    # Each part: {"path", "key_ref", "sha256"}. Empty until rendered.
    slice_count = Column(Integer, default=0, nullable=False)
    slice_stack_parts = Column(JSONB, nullable=False, default=list)

    study = relationship("ImagingStudy", back_populates="series")
