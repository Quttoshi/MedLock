import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class BlockchainLog(Base):
    __tablename__ = "blockchain_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False)
    transaction_hash = Column(String, nullable=True)
    event_type = Column(SAEnum("upload", "access_grant", "access_deny", "revoke", "delete", name="blockchain_event_type"), nullable=False)
    file_hash = Column(String, nullable=False)
    block_number = Column(Integer, nullable=True)
    network = Column(String, default="sepolia", nullable=False)
    status = Column(SAEnum("pending", "confirmed", "failed", name="blockchain_status_type"), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    medical_report = relationship("MedicalReport", back_populates="blockchain_logs")
