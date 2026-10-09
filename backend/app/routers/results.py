import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.doctor import Doctor
from app.models.lab_result import LabResult
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.services import emergency_service as emergency
from app.services import health_analysis_service as analysis
from app.services.access_request_service import has_consented_access
from app.services.audit_service import log_action
from app.services.lab_results_service import confirm

router = APIRouter(tags=["Lab results"])


class ConfirmRequest(BaseModel):
    # Leave out to confirm the value as read; give a number to correct it.
    value: Optional[float] = None


def _not_found(what: str = "Patient") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _own_patient(user: User, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise _not_found("Patient profile")
    return patient


def _doctor_patient(patient_id: uuid.UUID, user: User, db: Session) -> tuple[Doctor, Patient, bool]:
    """The patient, if this verified doctor may see their records: access the patient
    granted, or an active emergency access (returned as True so views can be recorded)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise _not_found("Doctor profile")
    if not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not verified yet")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise _not_found()
    consented = has_consented_access(doctor.id, patient.id, db)
    in_emergency = not consented and emergency.has_active_emergency(doctor.id, patient.id, db)
    if not (consented or in_emergency):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this patient's records")
    return doctor, patient, in_emergency


def _record_emergency_views(doctor: Doctor, patient: Patient, db: Session, report_ids: Optional[set] = None) -> None:
    """Under emergency access, showing results counts as opening the reports they came
    from, so each is recorded (once) for the patient to see and on the blockchain."""
    q = db.query(MedicalReport).join(LabResult, LabResult.report_id == MedicalReport.id).filter(
        MedicalReport.patient_id == patient.id, MedicalReport.is_approved.is_(True),
    )
    if report_ids is not None:
        q = q.filter(MedicalReport.id.in_(report_ids))
    for report in q.distinct().all():
        emergency.record_report_opened(doctor, report, db, has_consent=False)


# ── Patient ───────────────────────────────────────────────────────────────────────

@router.get("/results/me/summary")
def my_health_summary(current_user: User = Depends(require_role(["patient"])), db: Session = Depends(get_db)):
    """The dashboard card: what needs attention, what changed, and each panel's status."""
    return analysis.patient_summary(_own_patient(current_user, db), db)


@router.get("/results/me/trends")
def my_trends(current_user: User = Depends(require_role(["patient"])), db: Session = Depends(get_db)):
    """Every test with its history, grouped into panels by body system."""
    return analysis.trends(_own_patient(current_user, db), db)


@router.get("/results/me/tests/{test_code}")
def my_test(test_code: str, current_user: User = Depends(require_role(["patient"])), db: Session = Depends(get_db)):
    result = analysis.single_test(_own_patient(current_user, db), test_code, db)
    if result is None:
        raise _not_found("Test")
    return result


@router.get("/results/me/reports/{report_id}")
def my_report_results(report_id: uuid.UUID, current_user: User = Depends(require_role(["patient"])),
                      db: Session = Depends(get_db)):
    """One report's results with range bars (also for uploads awaiting the patient's approval)."""
    patient = _own_patient(current_user, db)
    report = db.query(MedicalReport).filter(MedicalReport.id == report_id, MedicalReport.patient_id == patient.id).first()
    if not report:
        raise _not_found("Report")
    return analysis.report_results(report, patient)


# ── Doctor ────────────────────────────────────────────────────────────────────────

@router.get("/doctor/patients/{patient_id}/results/overview")
def patient_overview(patient_id: uuid.UUID, current_user: User = Depends(require_role(["doctor"])),
                     db: Session = Depends(get_db)):
    """Critical results, calculated values (eGFR, HbA1c category) and latest values per panel."""
    doctor, patient, in_emergency = _doctor_patient(patient_id, current_user, db)
    data = analysis.doctor_overview(patient, db)
    if in_emergency:
        _record_emergency_views(doctor, patient, db)
    return data


@router.get("/doctor/patients/{patient_id}/results/table")
def patient_cumulative_table(patient_id: uuid.UUID, current_user: User = Depends(require_role(["doctor"])),
                             db: Session = Depends(get_db)):
    """Tests by collection date, newest first, with flags."""
    doctor, patient, in_emergency = _doctor_patient(patient_id, current_user, db)
    data = analysis.cumulative_table(patient, db)
    if in_emergency:
        _record_emergency_views(doctor, patient, db)
    return data


@router.get("/doctor/patients/{patient_id}/results/trends")
def patient_trends(patient_id: uuid.UUID, tests: Optional[str] = None,
                   current_user: User = Depends(require_role(["doctor"])), db: Session = Depends(get_db)):
    """Histories for chosen tests (comma-separated codes, e.g. creatinine,egfr), or all
    tests grouped into panels when none are given."""
    doctor, patient, in_emergency = _doctor_patient(patient_id, current_user, db)
    if tests:
        codes = {c.strip() for c in tests.split(",") if c.strip()}
        series = analysis.series_by_test(patient, db, codes)
        sex = patient.gender if patient.gender in ("male", "female") else None
        data = {"tests": [analysis.test_summary(code, series.get(code, []), sex)
                          for code in codes if code in analysis.catalog.TESTS]}
        report_ids = {uuid.UUID(p["report_id"]) for pts in series.values() for p in pts}
    else:
        data = analysis.trends(patient, db)
        report_ids = None
    if in_emergency:
        _record_emergency_views(doctor, patient, db, report_ids)
    return data


@router.get("/doctor/patients/{patient_id}/reports/{report_id}/results")
def patient_report_results(patient_id: uuid.UUID, report_id: uuid.UUID,
                           current_user: User = Depends(require_role(["doctor"])), db: Session = Depends(get_db)):
    doctor, patient, in_emergency = _doctor_patient(patient_id, current_user, db)
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id, MedicalReport.patient_id == patient.id, MedicalReport.is_approved.is_(True),
    ).first()
    if not report:
        raise _not_found("Report")
    if in_emergency:
        emergency.record_report_opened(doctor, report, db, has_consent=False)
    return analysis.report_results(report, patient)


# ── Confirming or correcting a value ──────────────────────────────────────────────

@router.patch("/results/{result_id}")
def confirm_result(result_id: uuid.UUID, body: ConfirmRequest, request: Request,
                   current_user: User = Depends(require_role(["patient", "doctor"])), db: Session = Depends(get_db)):
    """The patient, or a doctor with access the patient granted, confirms a value against
    the original report or corrects it. (Emergency access is read-only.)"""
    result = db.query(LabResult).filter(LabResult.id == result_id).first()
    if not result:
        raise _not_found("Result")
    if current_user.role == "patient":
        if _own_patient(current_user, db).id != result.patient_id:
            raise _not_found("Result")
    else:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor or not doctor.is_verified or not has_consented_access(doctor.id, result.patient_id, db):
            raise _not_found("Result")
    before = result.value
    confirm(result, current_user.id, db, body.value)
    log_action(
        db, action="lab_result_corrected" if body.value is not None else "lab_result_confirmed",
        performed_by=current_user.id, entity_type="medical_report", entity_id=result.report_id,
        details={"test": result.test_code, "from": before, "to": result.value}, request=request,
    )
    return {"id": str(result.id), "value": result.value, "flag": result.flag, "status": result.status}
