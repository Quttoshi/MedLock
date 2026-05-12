import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.models.ocr_result import OcrResult
from app.services.encryption_service import decrypt_file
from app.services.storage_service import get_supabase, BUCKET_NAME
from app.services.access_request_service import check_doctor_has_access

router = APIRouter(prefix="/doctor", tags=["Doctor"])


def _get_doctor(current_user: User, db: Session) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return doctor


@router.get("/profile")
def get_profile(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    doctor = _get_doctor(current_user, db)
    return {
        "id": str(doctor.id),
        "name": current_user.full_name,
        "email": current_user.email,
        "specialization": doctor.specialization,
        "license_number": doctor.license_number,
        "is_verified": doctor.is_verified,
        "medical_center": doctor.medical_center.name if doctor.medical_center else None,
    }


@router.get("/patients")
def get_accessible_patients(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Returns distinct patients whose reports this doctor has approved access to."""
    doctor = _get_doctor(current_user, db)

    approved = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == doctor.id,
            AccessRequest.status == "approved",
        )
        .all()
    )

    seen_patients = {}
    for req in approved:
        report = req.medical_report
        if not report:
            continue
        patient = report.patient
        if not patient or str(patient.id) in seen_patients:
            continue
        seen_patients[str(patient.id)] = {
            "patient_id": str(patient.id),
            "name": patient.user.full_name if patient.user else None,
            "email": patient.user.email if patient.user else None,
            "date_of_birth": patient.date_of_birth,
            "blood_group": patient.blood_group,
            "gender": patient.gender,
        }

    return list(seen_patients.values())


@router.get("/patients/{patient_id}/reports")
def get_patient_reports(
    patient_id: str,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Returns all reports of a patient that this doctor has approved access to."""
    doctor = _get_doctor(current_user, db)

    patient = db.query(Patient).filter(Patient.id == uuid.UUID(patient_id)).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    reports = db.query(MedicalReport).filter(MedicalReport.patient_id == patient.id).all()

    accessible = []
    for report in reports:
        if check_doctor_has_access(doctor, report.id, db):
            accessible.append({
                "id": str(report.id),
                "original_filename": report.original_filename,
                "report_type": report.report_type,
                "file_hash_sha256": report.file_hash_sha256,
                "upload_source": report.upload_source,
                "uploaded_at": report.uploaded_at,
            })

    return accessible


@router.get("/patients/{patient_id}/reports/{report_id}/download")
def download_patient_report(
    patient_id: str,
    report_id: str,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    doctor = _get_doctor(current_user, db)

    if not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not verified yet")

    report = db.query(MedicalReport).filter(
        MedicalReport.id == uuid.UUID(report_id),
        MedicalReport.patient_id == uuid.UUID(patient_id),
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    if not check_doctor_has_access(doctor, report.id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this report")

    client = get_supabase()
    encrypted_bytes = client.storage.from_(BUCKET_NAME).download(report.file_url)
    original_bytes = decrypt_file(encrypted_bytes, report.encryption_key_ref)

    ext = report.original_filename.rsplit(".", 1)[-1].lower() if "." in report.original_filename else ""
    content_type_map = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    content_type = content_type_map.get(ext, "application/octet-stream")

    return Response(
        content=original_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{report.original_filename}"'},
    )
