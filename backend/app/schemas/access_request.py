from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AccessRequestCreate(BaseModel):
    report_id: UUID
    reason: str


class AccessRequestResponse(BaseModel):
    id: UUID
    status: str
    reason: str
    requested_at: datetime
    decided_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    # Doctor info (for patient view)
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None

    # Report info
    report_name: Optional[str] = None
    report_type: Optional[str] = None

    # Doctor view extras
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True
