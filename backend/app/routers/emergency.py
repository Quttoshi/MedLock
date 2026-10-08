import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.services import emergency_service as emergency

router = APIRouter(prefix="/emergency", tags=["Emergency access"])


class StartEmergencyRequest(BaseModel):
    # From the CNIC card the patient carries
    patient_cnic: str
    patient_dob: date
    medical_center_id: str
    reason_code: str
    justification: str
    # The doctor confirms the patient cannot consent and delay would put them at risk
    declaration: bool = False


class FlagRequest(BaseModel):
    note: str


def _doctor(user: User, db: Session) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return doctor


def _patient(user: User, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return patient


# ── Doctor ────────────────────────────────────────────────────────────────────

@router.get("/eligibility")
def eligibility(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Whether the doctor can use emergency access, at which hospitals, and how many uses are left."""
    return emergency.eligibility(_doctor(current_user, db), db)


@router.post("", status_code=201)
def start_emergency(
    body: StartEmergencyRequest,
    request: Request,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Open a patient's records without consent in an emergency, for 24 hours."""
    return emergency.start(
        _doctor(current_user, db), current_user, body.patient_cnic, body.patient_dob, body.medical_center_id,
        body.reason_code, body.justification, body.declaration, db, request,
    )


@router.get("/active")
def my_active_emergencies(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    return emergency.for_doctor(_doctor(current_user, db), db)


# ── Patient ───────────────────────────────────────────────────────────────────

@router.get("/mine")
def emergencies_on_my_records(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Every emergency access to the patient's records, with the reports opened."""
    return emergency.for_patient(_patient(current_user, db), db)


@router.post("/{access_id}/flag")
def report_misuse(
    access_id: uuid.UUID,
    body: FlagRequest,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    return emergency.flag(access_id, current_user, body.note, db, request)


# ── Doctor or patient ─────────────────────────────────────────────────────────

@router.post("/{access_id}/end")
def end_emergency(
    access_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role(["doctor", "patient"])),
    db: Session = Depends(get_db),
):
    """End an emergency access early (the doctor who started it, or the patient)."""
    return emergency.end(access_id, current_user, db, request)
