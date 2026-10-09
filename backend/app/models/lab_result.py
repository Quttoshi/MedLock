import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class LabResult(Base):
    """One test result from a lab report, normalised to the catalog's canonical unit
    (see lab_catalog). These rows feed the result tables, trend charts and summaries."""
    __tablename__ = "lab_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    test_code = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    # The lab's printed range when the report has one ("lab"), otherwise the catalog's ("standard")
    ref_low = Column(Float, nullable=True)
    ref_high = Column(Float, nullable=True)
    ref_source = Column(String, nullable=False, default="standard")
    # low | normal | high | critical_low | critical_high
    flag = Column(String, nullable=False, default="normal")
    # When the sample was taken (from the report); falls back to the upload date
    collected_on = Column(Date, nullable=False, index=True)
    # high: read from a PDF's text with a known unit; medium: OCR or unit assumed; low: needs checking
    confidence = Column(String, nullable=False, default="medium")
    review_reasons = Column(JSONB, nullable=False, default=list)
    # unconfirmed -> confirmed (checked against the original) or corrected (value fixed by a person)
    status = Column(String, nullable=False, default="unconfirmed")
    extracted_value = Column(Float, nullable=True)
    confirmed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    source_text = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("report_id", "test_code", name="uq_lab_result_report_test"),)

    report = relationship("MedicalReport", back_populates="lab_results")
