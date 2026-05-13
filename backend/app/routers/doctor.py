import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.access_request import AccessRequest
from app.models.affiliation_request import AffiliationRequest
from app.models.doctor import Doctor
from app.models.medical_center import MedicalCenter
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.models.ocr_result import OcrResult
from datetime import datetime, timezone

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
        patient = req.patient
        if not patient or str(patient.id) in seen_patients:
            continue
        seen_patients[str(patient.id)] = {
            "id": str(patient.id),
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


@router.get("/medical-centers")
def list_medical_centers(
    search: str = None,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """List approved medical centers, optionally filtered by name search."""
    q = db.query(MedicalCenter).filter(MedicalCenter.is_approved == True)
    if search:
        q = q.filter(MedicalCenter.name.ilike(f"%{search}%"))
    centers = q.all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "address": c.address,
        }
        for c in centers
    ]


@router.post("/affiliations/request", status_code=201)
def request_affiliation(
    body: dict,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Doctor requests affiliation with a medical center."""
    doctor = _get_doctor(current_user, db)

    if doctor.medical_center_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already affiliated with a medical center. Revoke it first.",
        )

    mc_id = body.get("medical_center_id")
    reason = body.get("reason", "").strip() or None

    if not mc_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="medical_center_id is required")

    mc = db.query(MedicalCenter).filter(MedicalCenter.id == uuid.UUID(mc_id), MedicalCenter.is_approved == True).first()
    if not mc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center not found or not approved")

    existing = db.query(AffiliationRequest).filter(
        AffiliationRequest.doctor_id == doctor.id,
        AffiliationRequest.medical_center_id == mc.id,
        AffiliationRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A pending affiliation request already exists for this medical center")

    req = AffiliationRequest(
        doctor_id=doctor.id,
        medical_center_id=mc.id,
        reason=reason,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "id": str(req.id),
        "medical_center": mc.name,
        "status": req.status,
        "requested_at": req.requested_at,
    }


@router.get("/affiliations")
def my_affiliation_requests(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """View all affiliation requests submitted by this doctor."""
    doctor = _get_doctor(current_user, db)
    requests = db.query(AffiliationRequest).filter(AffiliationRequest.doctor_id == doctor.id).all()
    return [
        {
            "id": str(r.id),
            "medical_center": r.medical_center.name if r.medical_center else None,
            "status": r.status,
            "reason": r.reason,
            "rejection_reason": r.rejection_reason,
            "requested_at": r.requested_at,
            "decided_at": r.decided_at,
        }
        for r in requests
    ]


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
    content_type_map = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
    }
    content_type = content_type_map.get(ext, "application/octet-stream")

    return Response(
        content=original_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{report.original_filename}"'},
    )
