from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AccessRequestByEmail(BaseModel):
    """The patient is identified by email, or by CNIC together with date of birth."""
    patient_email: Optional[str] = None
    patient_cnic: Optional[str] = None
    patient_dob: Optional[date] = None
    reason: Optional[str] = None


class ShareRecordsRequest(BaseModel):
    doctor_id: UUID
    # Optional note to the doctor, e.g. why the patient is sharing
    note: Optional[str] = None


class AccessRequestResponse(BaseModel):
    id: UUID
    status: str
    # "doctor" (the doctor asked) or "patient" (the patient shared directly)
    initiated_by: str = "doctor"
    reason: Optional[str] = None
    requested_at: datetime
    decided_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    # Doctor info (for patient view)
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    doctor_verified: Optional[bool] = None
    doctor_verification_label: Optional[str] = None

    # Patient info (for doctor view)
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None

    class Config:
        from_attributes = True
