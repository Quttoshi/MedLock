"""Doctor license verification.

Two routes lead to a verified doctor:
- affiliated doctors are verified by a medical center when it approves their
  affiliation and the license number on their credential matches (they stay verified
  while they belong to at least one center; see affiliation_service);
- independent doctors submit a request, and an admin checks their registration on the
  public PMDC register (https://pmdc.pk) before approving or rejecting it.
Verification records who verified the doctor, how, and until when the license is valid.
"""
import logging
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.doctor_verification_request import DoctorVerificationRequest
from app.models.user import User
from app.services.encryption_service import decrypt_file, encrypt_file
from app.services.notification_service import create_notification, notify_admins
from app.services.storage_service import download_file, upload_file

logger = logging.getLogger(__name__)

PMDC_REGISTER_URL = "https://pmdc.pk/"
CERTIFICATE_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024
DOCTOR_VERIFICATION_PAGE = "/doctor/affiliation"
ADMIN_DOCTORS_PAGE = "/admin/doctors"


def normalize_license(value: str) -> str:
    return "".join((value or "").split()).upper()


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# ── Verification state ────────────────────────────────────────────────────────

def _current_centers(doctor: Doctor) -> list:
    return [a.medical_center for a in (doctor.affiliations or []) if a.status == "active" and a.medical_center]


def _verifying_center_name(doctor: Doctor) -> str:
    verifier = doctor.verified_by.medical_center if doctor.verified_by else None
    if verifier:
        return verifier.name
    # Verified before the verifying center was recorded: name a current center.
    centers = _current_centers(doctor)
    return centers[0].name if centers else "their medical center"


def verification_label(doctor: Doctor) -> str:
    if not doctor.is_verified:
        return "Not verified"
    if doctor.verification_method == "medical_center":
        return f"Verified by {_verifying_center_name(doctor)}"
    if doctor.verification_method == "admin":
        return "License verified via PMDC by MedLock"
    return "Verified"


def verification_summary(doctor: Doctor) -> dict:
    latest = doctor.verification_requests[0] if doctor.verification_requests else None
    return {
        "is_verified": doctor.is_verified,
        "method": doctor.verification_method,
        "label": verification_label(doctor),
        "verified_at": doctor.verified_at,
        "license_number": doctor.license_number,
        "license_expires_at": doctor.license_expires_at,
        "note": doctor.verification_note,
        "affiliated": bool(_current_centers(doctor)),
        "medical_centers": [
            {"id": str(c.id), "name": c.name, "center_type": c.center_type} for c in _current_centers(doctor)
        ],
        "latest_request": request_summary(latest) if latest else None,
    }


def request_summary(req: DoctorVerificationRequest) -> dict:
    return {
        "id": str(req.id),
        "status": req.status,
        "registration_number": req.registration_number,
        "license_expires_at": req.license_expires_at,
        "has_certificate": bool(req.certificate_path),
        "certificate_filename": req.certificate_filename,
        "admin_note": req.admin_note,
        "submitted_at": req.submitted_at,
        "reviewed_at": req.reviewed_at,
    }


def mark_verified(
    doctor: Doctor,
    method: str,
    verified_by: User,
    note: Optional[str] = None,
    license_expires_at: Optional[date] = None,
) -> None:
    doctor.is_verified = True
    doctor.verification_method = method
    doctor.verified_by_user_id = verified_by.id
    doctor.verified_at = datetime.utcnow()
    doctor.verification_note = note
    if license_expires_at is not None:
        doctor.license_expires_at = license_expires_at
    # A request still waiting for admin review is no longer needed once the doctor is
    # verified another way (e.g. their hospital approved their affiliation first).
    for req in doctor.verification_requests or []:
        if req.status == "pending":
            req.status = "closed"
            req.reviewed_at = doctor.verified_at
            req.admin_note = "Closed automatically: the doctor was verified before this request was reviewed"


def clear_verification(doctor: Doctor, note: Optional[str] = None) -> None:
    doctor.is_verified = False
    doctor.verification_method = None
    doctor.verified_by_user_id = None
    doctor.verified_at = None
    doctor.verification_note = note


def _check_expiry(license_expires_at: Optional[date]) -> None:
    if license_expires_at is not None and license_expires_at < date.today():
        raise _bad_request("This license has already expired, so it cannot be verified.")


# ── Independent doctors: request and admin review ─────────────────────────────

def submit_request(
    doctor: Doctor,
    registration_number: str,
    license_expires_at: Optional[date],
    certificate: Optional[UploadFile],
    db: Session,
) -> DoctorVerificationRequest:
    if doctor.is_verified:
        raise _bad_request("Your account is already verified.")
    pending = db.query(DoctorVerificationRequest).filter(
        DoctorVerificationRequest.doctor_id == doctor.id,
        DoctorVerificationRequest.status == "pending",
    ).first()
    if pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have a verification request awaiting review.")
    if normalize_license(registration_number) != normalize_license(doctor.license_number):
        raise _bad_request("Enter the PMDC registration number you registered your MedLock account with.")
    _check_expiry(license_expires_at)

    req = DoctorVerificationRequest(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        registration_number=registration_number.strip(),
        license_expires_at=license_expires_at,
        status="pending",
    )
    if certificate is not None and certificate.filename:
        _store_certificate(req, doctor, certificate)
    db.add(req)
    db.commit()
    db.refresh(req)

    try:
        notify_admins(
            db,
            "doctor_verification_requested",
            f"Dr. {doctor.user.full_name} ({doctor.specialization}) requested license verification "
            f"for PMDC registration {req.registration_number}. Please check it on the PMDC register.",
            link=ADMIN_DOCTORS_PAGE,
        )
    except Exception:
        logger.exception("Could not notify admins about verification request %s", req.id)
    return req


def _store_certificate(req: DoctorVerificationRequest, doctor: Doctor, certificate: UploadFile) -> None:
    if certificate.content_type not in CERTIFICATE_TYPES:
        raise _bad_request("The certificate must be a PDF, JPEG or PNG file.")
    data = certificate.file.read(MAX_CERTIFICATE_BYTES + 1)
    if len(data) > MAX_CERTIFICATE_BYTES:
        raise _bad_request("The certificate must not exceed 5 MB.")
    encrypted, key_ref = encrypt_file(data)
    path = f"doctor-verification/{doctor.id}/{req.id}.enc"
    upload_file(encrypted, path)
    req.certificate_path = path
    req.certificate_key_ref = key_ref
    req.certificate_filename = certificate.filename
    req.certificate_content_type = certificate.content_type


def read_certificate(req: DoctorVerificationRequest) -> bytes:
    if not req.certificate_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No certificate was uploaded with this request")
    return decrypt_file(download_file(req.certificate_path), req.certificate_key_ref)


def _pending_request(request_id: str, db: Session) -> DoctorVerificationRequest:
    req = db.query(DoctorVerificationRequest).filter(DoctorVerificationRequest.id == uuid.UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")
    if req.status != "pending":
        raise _bad_request(f"This request was already {req.status}.")
    if req.doctor.is_verified:
        raise _bad_request(f"This doctor is already verified ({verification_label(req.doctor)}).")
    return req


def approve_request(
    request_id: str, admin: User, license_expires_at: Optional[date], note: Optional[str], db: Session,
) -> DoctorVerificationRequest:
    req = _pending_request(request_id, db)
    if license_expires_at is None:
        raise _bad_request("Enter the license expiry date shown on the PMDC register.")
    _check_expiry(license_expires_at)

    req.status = "approved"
    req.reviewed_by_user_id = admin.id
    req.reviewed_at = datetime.utcnow()
    req.admin_note = (note or "").strip() or "Registration confirmed on the PMDC register"
    req.license_expires_at = license_expires_at
    mark_verified(req.doctor, "admin", admin, req.admin_note, license_expires_at)
    db.commit()

    _notify_doctor(
        req.doctor, "doctor_verification_approved",
        f"Your license has been verified against the PMDC register. It is valid until "
        f"{license_expires_at:%d %B %Y}, and you can now access the records patients share with you.",
        db,
    )
    return req


def reject_request(request_id: str, admin: User, reason: str, db: Session) -> DoctorVerificationRequest:
    reason = (reason or "").strip()
    if not reason:
        raise _bad_request("Give a reason for rejecting the request; it is shared with the doctor.")
    req = _pending_request(request_id, db)
    req.status = "rejected"
    req.reviewed_by_user_id = admin.id
    req.reviewed_at = datetime.utcnow()
    req.admin_note = reason
    db.commit()

    _notify_doctor(
        req.doctor, "doctor_verification_rejected",
        f"Your license verification request was not approved. Reason: {reason}. "
        "You can correct the details and submit a new request.",
        db,
    )
    return req


# ── Admin override (verify or revoke directly) ───────────────────────────────

def admin_verify(doctor: Doctor, admin: User, reason: str, license_expires_at: Optional[date], db: Session) -> None:
    reason = (reason or "").strip()
    if not reason:
        raise _bad_request("Give a reason for verifying this doctor directly.")
    if doctor.is_verified:
        raise _bad_request("Doctor is already verified")
    _check_expiry(license_expires_at)
    mark_verified(doctor, "admin", admin, reason, license_expires_at)
    db.commit()
    _notify_doctor(
        doctor, "doctor_verification_approved",
        "Your account has been verified by a MedLock administrator. "
        "You can now access the records patients share with you.",
        db,
    )


def admin_revoke(doctor: Doctor, reason: str, db: Session) -> None:
    reason = (reason or "").strip()
    if not reason:
        raise _bad_request("Give a reason for removing this doctor's verification; it is shared with the doctor.")
    if not doctor.is_verified:
        raise _bad_request("Doctor is not verified")
    clear_verification(doctor, f"Verification removed: {reason}")
    db.commit()
    _notify_doctor(
        doctor, "doctor_verification_revoked",
        f"Your verification was removed by a MedLock administrator. Reason: {reason}. "
        "You cannot open patient records until you are verified again.",
        db,
    )


# ── Periodic job ──────────────────────────────────────────────────────────────

def expire_lapsed_licenses(db: Session) -> int:
    """Remove verification from doctors whose license has expired."""
    lapsed = db.query(Doctor).filter(
        Doctor.is_verified.is_(True),
        Doctor.license_expires_at.isnot(None),
        Doctor.license_expires_at < date.today(),
    ).all()
    for doctor in lapsed:
        expired_on = doctor.license_expires_at
        clear_verification(doctor, f"License expired on {expired_on:%d %B %Y}")
        db.commit()
        _notify_doctor(
            doctor, "doctor_verification_revoked",
            f"Your license expired on {expired_on:%d %B %Y}, so your MedLock verification has lapsed. "
            "Renew your PMDC license and submit a new verification request to regain access.",
            db,
        )
    return len(lapsed)


def _notify_doctor(doctor: Doctor, notification_type: str, message: str, db: Session) -> None:
    try:
        create_notification(db, doctor.user_id, notification_type, message, link=DOCTOR_VERIFICATION_PAGE)
    except Exception:
        logger.exception("Could not notify doctor %s (%s)", doctor.id, notification_type)
