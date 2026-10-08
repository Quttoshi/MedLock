from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.patient import Patient
from app.models.user import User
from app.services import patient_identity_service as identity
from app.services.audit_service import log_action

router = APIRouter(prefix="/patients", tags=["Patients"])


class IdentityUpdate(BaseModel):
    cnic: str
    date_of_birth: date


def _patient(current_user: User, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return patient


@router.get("/me/identity")
def my_identity(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Whether the patient has added their CNIC (shown masked) and date of birth."""
    return identity.identity_summary(_patient(current_user, db))


@router.put("/me/identity")
def update_identity(
    body: IdentityUpdate,
    request: Request,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Add or correct the patient's CNIC and date of birth, used by hospitals, labs and
    doctors to find them (both are needed together)."""
    patient = _patient(current_user, db)
    patient.date_of_birth = identity.check_date_of_birth(body.date_of_birth)
    identity.set_cnic(patient, body.cnic, db)
    db.commit()
    # The CNIC itself is never written to the audit log.
    log_action(db, action="identity_updated", performed_by=current_user.id,
               entity_type="patient", entity_id=patient.id, request=request)
    return identity.identity_summary(patient)
