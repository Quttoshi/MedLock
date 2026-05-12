import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.doctor import Doctor
from app.models.medical_center import MedicalCenter
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.services.audit_service import log_action
from app.services.blockchain_service import log_event as blockchain_log
from app.services.encryption_service import encrypt_file, sha256_hash
from app.services.notification_service import create_notification
from app.services.ocr_service import run_ocr
from app.services.storage_service import upload_file, BUCKET_NAME

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024

router = APIRouter(prefix="/mc", tags=["Medical Center"])


def _get_mc(current_user: User, db: Session) -> MedicalCenter:
    mc = db.query(MedicalCenter).filter(MedicalCenter.user_id == current_user.id).first()
    if not mc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center profile not found")
    if not mc.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your medical center has not been approved yet")
    return mc


@router.get("/profile")
def get_profile(
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    mc = db.query(MedicalCenter).filter(MedicalCenter.user_id == current_user.id).first()
    if not mc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center profile not found")
    return {
        "id": str(mc.id),
        "name": mc.name,
        "email": current_user.email,
        "license_number": mc.license_number,
        "address": mc.address,
        "is_approved": mc.is_approved,
        "approved_at": mc.approved_at,
    }


@router.get("/doctors")
def get_doctors(
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """List all doctors registered under this medical center."""
    mc = _get_mc(current_user, db)
    doctors = db.query(Doctor).filter(Doctor.medical_center_id == mc.id).all()
    return [
        {
            "id": str(d.id),
            "name": d.user.full_name if d.user else None,
            "email": d.user.email if d.user else None,
            "specialization": d.specialization,
            "license_number": d.license_number,
            "is_verified": d.is_verified,
        }
        for d in doctors
    ]


@router.post("/reports/upload", status_code=201)
def upload_report_for_patient(
    file: UploadFile = File(...),
    report_type: str = Form(...),
    patient_email: str = Form(...),
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """Upload a medical report on behalf of a patient (identified by email)."""
    mc = _get_mc(current_user, db)

    # Resolve patient by email
    patient_user = db.query(User).filter(User.email == patient_email, User.role == "patient").first()
    if not patient_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No patient found with that email")

    patient = db.query(Patient).filter(Patient.user_id == patient_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, JPEG, and PNG files are allowed")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size must not exceed 10 MB")

    file_hash = sha256_hash(file_bytes)

    duplicate = db.query(MedicalReport).filter(
        MedicalReport.patient_id == patient.id,
        MedicalReport.file_hash_sha256 == file_hash,
    ).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This file has already been uploaded for this patient")

    encrypted_bytes, key_ref = encrypt_file(file_bytes)
    report_id = uuid.uuid4()
    storage_path = f"{patient.id}/{report_id}.enc"

    try:
        file_url = upload_file(encrypted_bytes, storage_path, content_type=file.content_type)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Storage upload failed: {str(e)}")

    report = MedicalReport(
        id=report_id,
        patient_id=patient.id,
        medical_center_id=mc.id,
        original_filename=file.filename,
        report_type=report_type,
        file_url=file_url,
        encryption_key_ref=key_ref,
        file_hash_sha256=file_hash,
        upload_source="medical_center",
        is_approved=True,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        blockchain_log(report.id, report.file_hash_sha256, "upload", db)
    except Exception:
        pass

    try:
        run_ocr(report, file_bytes, db)
    except Exception:
        pass

    try:
        create_notification(
            db,
            recipient_id=patient_user.id,
            notification_type="report_uploaded",
            message=f"{mc.name} has uploaded a report '{file.filename}' to your medical records.",
        )
    except Exception:
        pass

    log_action(
        db,
        action="mc_report_upload",
        performed_by=current_user.id,
        entity_type="medical_report",
        entity_id=report.id,
        details={"report_type": report_type, "patient_email": patient_email, "filename": file.filename},
        request=request,
    )

    return {
        "id": str(report.id),
        "original_filename": report.original_filename,
        "report_type": report.report_type,
        "patient_email": patient_email,
        "upload_source": report.upload_source,
        "uploaded_at": report.uploaded_at,
    }


@router.get("/reports")
def get_uploaded_reports(
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """List all reports this medical center has uploaded."""
    mc = _get_mc(current_user, db)
    reports = db.query(MedicalReport).filter(MedicalReport.medical_center_id == mc.id).all()
    return [
        {
            "id": str(r.id),
            "original_filename": r.original_filename,
            "report_type": r.report_type,
            "patient_name": r.patient.user.full_name if r.patient and r.patient.user else None,
            "patient_email": r.patient.user.email if r.patient and r.patient.user else None,
            "uploaded_at": r.uploaded_at,
        }
        for r in reports
    ]
