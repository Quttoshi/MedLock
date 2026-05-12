from typing import Optional, Any
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserListItem(BaseModel):
    id: UUID
    name: Optional[str] = None
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class DoctorListItem(BaseModel):
    id: UUID
    user_id: UUID
    name: Optional[str] = None
    email: str
    specialization: str
    license_number: str
    is_verified: bool

    class Config:
        from_attributes = True


class MedicalCenterListItem(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    email: str
    license_number: str
    address: str
    is_approved: bool
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogItem(BaseModel):
    id: UUID
    performed_by: Optional[UUID] = None
    performer_name: Optional[str] = None
    performer_email: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    ip_address: Optional[str] = None
    details: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True
