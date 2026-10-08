import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
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
from app.services import emergency_service as emergency
from app.services.access_request_service import check_doctor_has_access, display_status, has_consented_access
from app.services.audit_service import log_action
from app.services.blockchain_service import verify_report_integrity
from app.services import affiliation_service as affiliations
from app.services import center_verification_service as center_checks
from app.services import doctor_verification_service as verification

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
        "medical_centers": [affiliations.center_summary(c) for c in affiliations.active_centers(doctor)],
    }


@router.get("/patients")
def get_accessible_patients(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Returns distinct patients whose reports this doctor currently has access to
    (approved and not expired)."""
    doctor = _get_doctor(current_user, db)

    approved = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == doctor.id,
            AccessRequest.status == "approved",
        )
        .order_by(AccessRequest.decided_at.desc())
        .all()
    )

    seen_patients = {}
    for req in approved:
        patient = req.patient
        if not patient or str(patient.id) in seen_patients or display_status(req) == "expired":
            continue
        seen_patients[str(patient.id)] = {
            "id": str(patient.id),
            "name": patient.user.full_name if patient.user else None,
            "email": patient.user.email if patient.user else None,
            "date_of_birth": patient.date_of_birth,
            "blood_group": patient.blood_group,
            "gender": patient.gender,
        }

    for access in emergency.for_doctor(doctor, db):
        info = access["patient"]
        if info["id"] in seen_patients:
            seen_patients[info["id"]]["emergency_until"] = access["expires_at"]
            continue
        patient = db.query(Patient).filter(Patient.id == uuid.UUID(info["id"])).first()
        seen_patients[info["id"]] = {
            "id": info["id"],
            "name": info["name"],
            "email": None,
            "date_of_birth": patient.date_of_birth if patient else None,
            "blood_group": info["blood_group"],
            "gender": info["gender"],
            "emergency_until": access["expires_at"],
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

    reports = db.query(MedicalReport).filter(MedicalReport.patient_id == patient.id).order_by(
        MedicalReport.uploaded_at.desc()
    ).all()

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
    """List approved hospitals and clinics a doctor can join (labs take no doctors),
    optionally filtered by name search."""
    q = db.query(MedicalCenter).filter(MedicalCenter.is_approved == True, MedicalCenter.center_type != "lab")
    if search:
        q = q.filter(MedicalCenter.name.ilike(f"%{search}%"))
    centers = q.order_by(MedicalCenter.name).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "address": c.address,
            "center_type": c.center_type,
            "licence_label": center_checks.licence_label(c),
        }
        for c in centers
    ]


@router.post("/affiliations/request", status_code=201)
def request_affiliation(
    body: dict,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Doctor requests affiliation with a hospital or clinic. A doctor can belong to
    several centers at once."""
    doctor = _get_doctor(current_user, db)

    mc_id = body.get("medical_center_id")
    reason = body.get("reason", "").strip() or None

    if not mc_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="medical_center_id is required")

    mc = db.query(MedicalCenter).filter(MedicalCenter.id == uuid.UUID(mc_id), MedicalCenter.is_approved == True).first()
    if not mc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical center not found or not approved")

    affiliations.check_can_request(doctor, mc, db)

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
    requests = db.query(AffiliationRequest).filter(AffiliationRequest.doctor_id == doctor.id).order_by(
        AffiliationRequest.requested_at.desc()
    ).all()
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


@router.get("/memberships")
def my_memberships(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """The hospitals and clinics this doctor currently belongs to."""
    doctor = _get_doctor(current_user, db)
    return [affiliations.membership_summary(a) for a in affiliations.active_affiliations(doctor)]


@router.post("/affiliations/{medical_center_id}/leave")
def leave_affiliation(
    medical_center_id: str,
    request: Request = None,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Leave a medical center. Leaving the last one ends a center-based verification."""
    doctor = _get_doctor(current_user, db)
    affiliation = affiliations.get_active_affiliation_or_404(doctor.id, uuid.UUID(medical_center_id), db)
    affiliations.end_affiliation(affiliation, current_user, None, db, request)
    return {"medical_center_id": medical_center_id, "status": "ended", "is_verified": doctor.is_verified}


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
    emergency.record_report_opened(
        doctor, report, db, has_consent=has_consented_access(doctor.id, report.patient_id, db),
    )
    if report.report_type == "imaging":
        from app.routers.reports import imaging_archive_response
        return imaging_archive_response(report)

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


@router.get("/patients/{patient_id}/reports/{report_id}/verify")
def verify_patient_report(
    patient_id: str,
    report_id: str,
    request: Request = None,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Check a report the doctor has access to against its blockchain record."""
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

    result = verify_report_integrity(report, db)
    log_action(
        db,
        action="integrity_verified",
        performed_by=current_user.id,
        entity_type="medical_report",
        entity_id=report.id,
        details={"status": result["status"]},
        request=request,
    )
    return result


# ── License verification ─────────────────────────────────

@router.get("/verification")
def get_my_verification(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """The doctor's verification status, how they were verified, and their latest request."""
    summary = verification.verification_summary(_get_doctor(current_user, db))
    return {**summary, "pmdc_register_url": verification.PMDC_REGISTER_URL}


@router.post("/verification-requests", status_code=201)
def submit_verification_request(
    registration_number: str = Form(...),
    license_expires_at: str = Form(None),
    certificate: UploadFile = File(None),
    request: Request = None,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db),
):
    """Independent doctors ask an admin to verify their license against the PMDC register."""
    doctor = _get_doctor(current_user, db)
    expires = None
    if license_expires_at:
        try:
            expires = datetime.strptime(license_expires_at, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="License expiry must be a date (YYYY-MM-DD)")
    req = verification.submit_request(doctor, registration_number, expires, certificate, db)
    log_action(
        db, action="doctor_verification_requested", performed_by=current_user.id, entity_type="doctor",
        entity_id=doctor.id, details={"registration_number": req.registration_number}, request=request,
    )
    return verification.request_summary(req)
