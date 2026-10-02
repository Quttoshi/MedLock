"""Imaging (DICOM) endpoints for patients, medical centers and doctors."""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.routers.medical_center import _get_mc
from app.services import imaging_service
from app.services.access_request_service import check_doctor_has_access
from app.services.audit_service import log_action

router = APIRouter(tags=["Imaging"])

NO_STORE = {"Cache-Control": "private, no-store"}


def _upload_response(report: MedicalReport) -> dict:
    return {
        "id": str(report.id),
        "original_filename": report.original_filename,
        "report_type": report.report_type,
        "upload_source": report.upload_source,
        "processing_status": report.imaging_study.processing_status,
        "series_count": report.imaging_study.series_count,
        "instance_count": report.imaging_study.instance_count,
        "uploaded_at": report.uploaded_at,
    }


def _patient_imaging_report(report_id: str, current_user: User, db: Session) -> MedicalReport:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report or not imaging_service.is_imaging(report):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging study not found")
    return report


def _doctor_imaging_report(patient_id: str, report_id: str, current_user: User, db: Session) -> MedicalReport:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    if not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not verified yet")
    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == uuid.UUID(patient_id),
    ).first()
    # Medical-center uploads the patient has not approved are not part of their record yet.
    if not report or not imaging_service.is_imaging(report) or not report.is_approved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging study not found")
    if not check_doctor_has_access(doctor, report.id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this report")
    return report


def _preview(report: MedicalReport, series_id: str) -> Response:
    series = imaging_service.find_series(report, series_id)
    png = imaging_service.read_preview(series)
    if png is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No preview is available for this series")
    return Response(content=png, media_type="image/png", headers=NO_STORE)


def _slices(report: MedicalReport, series_id: str) -> Response:
    series = imaging_service.find_series(report, series_id)
    stack = imaging_service.read_slice_stack(series)
    if stack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slices are not available for this series yet")
    return Response(content=stack, media_type="application/zip", headers=NO_STORE)


# ── Patient ───────────────────────────────────────────────────────────────────

@router.post("/reports/imaging/upload", status_code=201)
def upload_imaging(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    report = imaging_service.create_imaging_upload(file, patient, db)
    background_tasks.add_task(imaging_service.process_study_by_id, report.imaging_study.id)
    log_action(
        db, action="imaging_upload", performed_by=current_user.id, entity_type="medical_report",
        entity_id=report.id, details={"filename": report.original_filename}, request=request,
    )
    return _upload_response(report)


@router.get("/reports/{report_id}/imaging")
def get_imaging_study(
    report_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    return imaging_service.study_response(_patient_imaging_report(report_id, current_user, db))


@router.get("/reports/{report_id}/imaging/series/{series_id}/preview")
def get_series_preview(
    report_id: str,
    series_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    return _preview(_patient_imaging_report(report_id, current_user, db), series_id)


@router.get("/reports/{report_id}/imaging/series/{series_id}/slices")
def get_series_slices(
    report_id: str,
    series_id: str,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Every slice of the series as numbered JPEGs in a zip, for the slice viewer."""
    return _slices(_patient_imaging_report(report_id, current_user, db), series_id)


# ── Medical center ────────────────────────────────────────────────────────────

@router.post("/mc/imaging/upload", status_code=201)
def mc_upload_imaging(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_email: str = Form(...),
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """Upload a study for a patient; it joins their record only after they approve it."""
    mc = _get_mc(current_user, db)
    patient_user = db.query(User).filter(User.email == patient_email, User.role == "patient").first()
    patient = db.query(Patient).filter(Patient.user_id == patient_user.id).first() if patient_user else None
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No patient found with that email")
    report = imaging_service.create_imaging_upload(file, patient, db, medical_center=mc)
    background_tasks.add_task(imaging_service.process_study_by_id, report.imaging_study.id)
    log_action(
        db, action="mc_imaging_upload", performed_by=current_user.id, entity_type="medical_report",
        entity_id=report.id, details={"filename": report.original_filename, "patient_email": patient_email},
        request=request,
    )
    return {**_upload_response(report), "patient_email": patient_email}


# ── Doctor ────────────────────────────────────────────────────────────────────

@router.get("/doctor/patients/{patient_id}/reports/{report_id}/imaging")
def doctor_get_imaging_study(
    patient_id: str,
    report_id: str,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    return imaging_service.study_response(_doctor_imaging_report(patient_id, report_id, current_user, db))


@router.get("/doctor/patients/{patient_id}/reports/{report_id}/imaging/series/{series_id}/preview")
def doctor_get_series_preview(
    patient_id: str,
    report_id: str,
    series_id: str,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    return _preview(_doctor_imaging_report(patient_id, report_id, current_user, db), series_id)


@router.get("/doctor/patients/{patient_id}/reports/{report_id}/imaging/series/{series_id}/slices")
def doctor_get_series_slices(
    patient_id: str,
    report_id: str,
    series_id: str,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    return _slices(_doctor_imaging_report(patient_id, report_id, current_user, db), series_id)
