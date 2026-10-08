import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from datetime import datetime, timezone

from app.models.affiliation_request import AffiliationRequest
from app.models.doctor import Doctor
from app.models.doctor_affiliation import DoctorAffiliation
from app.models.medical_center import MedicalCenter
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.schemas.medical_center import UpdateRegistrationRequest
from app.services import affiliation_service as affiliations
from app.services import center_verification_service as center_checks
from app.services.audit_service import log_action
from app.services.blockchain_service import log_event as blockchain_log
from app.services.encryption_service import encrypt_file, sha256_hash
from app.services.doctor_verification_service import mark_verified
from app.services.notification_service import create_notification
from app.services.ocr_service import run_ocr
from app.services.storage_service import upload_file, BUCKET_NAME

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
}
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
        "center_type": mc.center_type,
        "is_approved": mc.is_approved,
        "rejection_reason": mc.rejection_reason,
        **center_checks.licence_summary(mc),
        "approved_at": mc.approved_at,
    }


@router.patch("/registration")
def update_registration(
    body: UpdateRegistrationRequest,
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """A center waiting for approval (or rejected) corrects its licence details and goes
    back for review."""
    mc = db.query(MedicalCenter).filter(MedicalCenter.user_id == current_user.id).first()
    if not mc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center profile not found")
    center_checks.resubmit(mc, body.regulator, body.license_number, body.license_expires_at, body.address, db)
    log_action(
        db, action="medical_center_resubmitted", performed_by=current_user.id, entity_type="medical_center",
        entity_id=mc.id, details={"regulator": mc.regulator, "license_number": mc.license_number}, request=request,
    )
    return {"status": center_checks.center_status(mc), **center_checks.licence_summary(mc)}


@router.get("/doctors")
def get_doctors(
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """List the doctors currently affiliated with this medical center."""
    mc = _get_mc(current_user, db)
    affiliations = db.query(DoctorAffiliation).filter(
        DoctorAffiliation.medical_center_id == mc.id,
        DoctorAffiliation.status == "active",
    ).order_by(DoctorAffiliation.joined_at).all()
    return [
        {
            "id": str(a.doctor.id),
            "name": a.doctor.user.full_name if a.doctor.user else None,
            "email": a.doctor.user.email if a.doctor.user else None,
            "specialization": a.doctor.specialization,
            "license_number": a.doctor.license_number,
            "is_verified": a.doctor.is_verified,
            "joined_at": a.joined_at,
        }
        for a in affiliations
    ]


@router.post("/doctors/{doctor_id}/remove")
def remove_doctor(
    doctor_id: str,
    body: dict = None,
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """End a doctor's affiliation with this medical center."""
    mc = _get_mc(current_user, db)
    affiliation = affiliations.get_active_affiliation_or_404(uuid.UUID(doctor_id), mc.id, db)
    affiliations.end_affiliation(affiliation, current_user, (body or {}).get("reason"), db, request)
    return {"doctor_id": doctor_id, "status": "ended"}


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
        is_approved=False,
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
            link=f"/patient/reports/{report.id}",
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


@router.get("/affiliation-requests")
def get_affiliation_requests(
    status_filter: str = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """List all affiliation requests sent to this medical center."""
    mc = _get_mc(current_user, db)
    q = db.query(AffiliationRequest).filter(AffiliationRequest.medical_center_id == mc.id)
    if status_filter:
        q = q.filter(AffiliationRequest.status == status_filter)
    requests = q.order_by(AffiliationRequest.requested_at.desc()).all()
    return [
        {
            "id": str(r.id),
            "doctor_name": r.doctor.user.full_name if r.doctor and r.doctor.user else None,
            "doctor_email": r.doctor.user.email if r.doctor and r.doctor.user else None,
            "specialization": r.doctor.specialization if r.doctor else None,
            # Hidden while pending: the MC must enter it from the doctor's credential to verify them.
            "license_number": r.doctor.license_number if r.doctor and r.status != "pending" else None,
            "reason": r.reason,
            "status": r.status,
            "rejection_reason": r.rejection_reason,
            "requested_at": r.requested_at,
            "decided_at": r.decided_at,
        }
        for r in requests
    ]


@router.patch("/affiliation-requests/{request_id}/approve")
def approve_affiliation(
    request_id: str,
    body: dict = None,
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """Approve a doctor's affiliation after checking the license number the medical center
    reads from the doctor's credential against the one they registered. A doctor who is
    not yet verified becomes verified by this center."""
    mc = _get_mc(current_user, db)
    if affiliations.is_lab(mc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Diagnostic labs do not take affiliated doctors")
    req = db.query(AffiliationRequest).filter(
        AffiliationRequest.id == uuid.UUID(request_id),
        AffiliationRequest.medical_center_id == mc.id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be approved")

    entered_license = (body or {}).get("license_number", "")
    if not entered_license.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the doctor's license number to verify them",
        )
    if _normalize_license(entered_license) != _normalize_license(req.doctor.license_number):
        log_action(
            db, action="doctor_verification_failed", performed_by=current_user.id,
            entity_type="doctor", entity_id=req.doctor.id, request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License number does not match the one the doctor registered with",
        )

    req.status = "approved"
    req.decided_at = datetime.now(timezone.utc)
    affiliations.add_affiliation(req.doctor, mc, req, db)
    # A doctor already verified (by another center or an admin) keeps that verification.
    newly_verified = not req.doctor.is_verified
    if newly_verified:
        mark_verified(req.doctor, "medical_center", current_user, f"License checked by {mc.name}")
    db.commit()

    log_action(
        db, action="doctor_verified_by_mc" if newly_verified else "affiliation_approved",
        performed_by=current_user.id, entity_type="doctor", entity_id=req.doctor.id,
        details={"affiliation_request_id": str(req.id), "medical_center_id": str(mc.id)}, request=request,
    )
    message = (
        f"{mc.name} approved your affiliation and verified your license. You can now access patient records you are granted."
        if newly_verified else f"{mc.name} approved your affiliation. You are now listed as one of its doctors."
    )
    create_notification(db, req.doctor.user_id, "affiliation_approved", message)

    return {"id": str(req.id), "status": req.status, "doctor_name": req.doctor.user.full_name, "is_verified": True}


@router.patch("/affiliation-requests/{request_id}/reject")
def reject_affiliation(
    request_id: str,
    body: dict = None,
    request: Request = None,
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    mc = _get_mc(current_user, db)
    req = db.query(AffiliationRequest).filter(
        AffiliationRequest.id == uuid.UUID(request_id),
        AffiliationRequest.medical_center_id == mc.id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be rejected")

    req.status = "rejected"
    req.decided_at = datetime.now(timezone.utc)
    req.rejection_reason = (body or {}).get("reason", "")
    db.commit()

    log_action(
        db, action="affiliation_rejected", performed_by=current_user.id,
        entity_type="doctor", entity_id=req.doctor.id,
        details={"reason": req.rejection_reason}, request=request,
    )
    reason = f" Reason: {req.rejection_reason}" if req.rejection_reason else ""
    create_notification(
        db, req.doctor.user_id, "affiliation_rejected",
        f"{mc.name} rejected your affiliation request.{reason}",
    )

    return {"id": str(req.id), "status": req.status}


def _normalize_license(license_number: str) -> str:
    return "".join(license_number.split()).upper()


@router.get("/reports")
def get_uploaded_reports(
    current_user: User = Depends(require_role(["medical_center"])),
    db: Session = Depends(get_db),
):
    """List all reports this medical center has uploaded."""
    mc = _get_mc(current_user, db)
    reports = db.query(MedicalReport).filter(MedicalReport.medical_center_id == mc.id).order_by(
        MedicalReport.uploaded_at.desc()
    ).all()
    return [
        {
            "id": str(r.id),
            "original_filename": r.original_filename,
            "report_type": r.report_type,
            "patient_name": r.patient.user.full_name if r.patient and r.patient.user else None,
            "patient_email": r.patient.user.email if r.patient and r.patient.user else None,
            "is_approved": r.is_approved,
            "uploaded_at": r.uploaded_at,
        }
        for r in reports
    ]
