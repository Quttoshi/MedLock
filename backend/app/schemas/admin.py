from typing import Any, List, Optional
from datetime import date, datetime
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
    verification_method: Optional[str] = None
    verification_label: Optional[str] = None
    verified_at: Optional[datetime] = None
    license_expires_at: Optional[date] = None
    verification_note: Optional[str] = None
    medical_center_names: List[str] = []
    has_pending_request: bool = False

    class Config:
        from_attributes = True


class AdminVerifyDoctorRequest(BaseModel):
    reason: str
    license_expires_at: Optional[date] = None


class AdminRevokeDoctorRequest(BaseModel):
    reason: str


class ApproveVerificationRequest(BaseModel):
    # Confirmed by the admin from the PMDC register
    license_expires_at: date
    note: Optional[str] = None


class RejectVerificationRequest(BaseModel):
    reason: str


class MedicalCenterListItem(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    email: str
    license_number: str
    address: str
    center_type: str = "hospital"
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
