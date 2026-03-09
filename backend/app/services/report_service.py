import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.services.encryption_service import encrypt_file, sha256_hash
from app.services.storage_service import upload_file, delete_file

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def upload_report(file: UploadFile, report_type: str, current_user: User, db: Session) -> MedicalReport:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, JPEG, and PNG files are allowed")

    file_bytes = file.file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size must not exceed 10 MB")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    file_hash = sha256_hash(file_bytes)
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
        original_filename=file.filename,
        report_type=report_type,
        file_url=file_url,
        encryption_key_ref=key_ref,
        file_hash_sha256=file_hash,
        upload_source="patient",
        is_approved=True,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return report


def get_my_reports(current_user: User, db: Session) -> list[MedicalReport]:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    return db.query(MedicalReport).filter(MedicalReport.patient_id == patient.id).all()
