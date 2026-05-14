import uuid
from datetime import datetime

from sqlalchemy import Column, Text, DateTime, ForeignKey, String, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class OcrResult(Base):
    __tablename__ = "ocr_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), unique=True, nullable=False)
    extracted_text = Column(Text, nullable=True)
    structured_data = Column(JSONB, nullable=True)
    abnormal_values = Column(JSONB, nullable=True)
    status = Column(String, default="completed", nullable=False)
    error_message = Column(Text, nullable=True)
    parser_version = Column(String, default="medical-ocr-v2", nullable=False)
    ocr_engine = Column(String, nullable=True)
    raw_text_length = Column(Integer, default=0, nullable=False)
    structured_count = Column(Integer, default=0, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    medical_report = relationship("MedicalReport", back_populates="ocr_result")
