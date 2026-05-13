from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AccessRequestByEmail(BaseModel):
    patient_email: str
    reason: Optional[str] = None


class AccessRequestResponse(BaseModel):
    id: UUID
    status: str
    reason: Optional[str] = None
    requested_at: datetime
    decided_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    # Doctor info (for patient view)
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None

    # Patient info (for doctor view)
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None

    class Config:
        from_attributes = True
