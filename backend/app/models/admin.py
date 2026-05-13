import uuid

from sqlalchemy import Column, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    admin_level = Column(SAEnum("super", "standard", name="admin_level_type"), nullable=False, default="standard")

    # Relationships
    user = relationship("User", back_populates="admin")
    approved_medical_centers = relationship("MedicalCenter", back_populates="approved_by_admin")
