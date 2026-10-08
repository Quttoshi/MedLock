import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.schemas.access_request import AccessRequestByEmail, AccessRequestResponse
from app.services.doctor_verification_service import verification_label
from app.services.notification_service import create_notification
from app.services.blockchain_service import log_event as blockchain_log

ACCESS_EXPIRY_DAYS = 30


def display_status(req: AccessRequest) -> str:
    """The stored status, except that an approval past its expiry shows as "expired",
    so it is not listed with current approvals or confused with a patient's revocation."""
    if req.status == "approved" and _is_expired(req):
        return "expired"
    return req.status


def _build_response(req: AccessRequest) -> AccessRequestResponse:
    patient_user = req.patient.user if req.patient else None
    doctor_user = req.doctor.user if req.doctor else None
    return AccessRequestResponse(
        id=req.id,
        status=display_status(req),
        reason=req.reason or "",
        requested_at=req.requested_at,
        decided_at=req.decided_at,
        expires_at=req.expires_at,
        doctor_name=doctor_user.full_name if doctor_user else None,
        doctor_specialization=req.doctor.specialization if req.doctor else None,
        doctor_verified=req.doctor.is_verified if req.doctor else None,
        doctor_verification_label=verification_label(req.doctor) if req.doctor else None,
        patient_name=patient_user.full_name if patient_user else None,
        patient_email=patient_user.email if patient_user else None,
    )


def create_access_request_by_email(data: AccessRequestByEmail, current_user: User, db: Session) -> dict:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    patient_user = db.query(User).filter(User.email == data.patient_email, User.role == "patient").first()
    if not patient_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No patient found with that email")

    patient = db.query(Patient).filter(Patient.user_id == patient_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    # A doctor-patient pair has at most one request row (uq_doctor_patient_access).
    existing = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor.id,
        AccessRequest.patient_id == patient.id,
    ).first()
    if existing and existing.status == "approved" and _is_expired(existing):
        existing.status = "revoked"
    if existing and existing.status in ("pending", "approved"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An access request for this patient is already {existing.status}",
        )

    if existing:
        # Denied, revoked or expired before: reopen the same row as a new request.
        req = existing
        req.status = "pending"
        req.reason = data.reason or ""
        req.requested_at = datetime.now(timezone.utc)
        req.decided_at = None
        req.expires_at = None
    else:
        req = AccessRequest(
            id=uuid.uuid4(),
            doctor_id=doctor.id,
            patient_id=patient.id,
            reason=data.reason or "",
            status="pending",
        )
        db.add(req)
    db.commit()
    db.refresh(req)

    try:
        create_notification(
            db,
            recipient_id=patient_user.id,
            notification_type="access_request",
            message=f"Dr. {current_user.full_name} has requested access to your medical records.",
        )
    except Exception:
        pass

    return {
        "id": str(req.id),
        "patient_name": patient_user.full_name,
        "patient_email": patient_user.email,
        "status": req.status,
    }


def get_requests_for_patient(current_user: User, db: Session) -> list[AccessRequestResponse]:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    requests = db.query(AccessRequest).filter(AccessRequest.patient_id == patient.id).order_by(
        AccessRequest.requested_at.desc()
    ).all()
    return [_build_response(r) for r in requests]


def get_requests_for_doctor(current_user: User, db: Session) -> list[AccessRequestResponse]:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    requests = db.query(AccessRequest).filter(AccessRequest.doctor_id == doctor.id).order_by(
        AccessRequest.requested_at.desc()
    ).all()
    return [_build_response(r) for r in requests]


def approve_request(request_id: str, current_user: User, db: Session) -> AccessRequestResponse:
    req = _get_patient_owned_request(request_id, current_user, db)

    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be approved")

    req.status = "approved"
    req.decided_at = datetime.now(timezone.utc)
    req.expires_at = datetime.now(timezone.utc) + timedelta(days=ACCESS_EXPIRY_DAYS)
    db.commit()
    db.refresh(req)

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_approved",
            message=f"Your request to access {req.patient.user.full_name}'s records has been approved. Access expires in {ACCESS_EXPIRY_DAYS} days.",
            link=f"/doctor/patients/{req.patient_id}/reports",
        )
    except Exception:
        pass

    return _build_response(req)


def deny_request(request_id: str, current_user: User, db: Session) -> AccessRequestResponse:
    req = _get_patient_owned_request(request_id, current_user, db)

    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be denied")

    req.status = "denied"
    req.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_denied",
            message=f"Your request to access {req.patient.user.full_name}'s records has been denied.",
        )
    except Exception:
        pass

    return _build_response(req)


def revoke_request(request_id: str, current_user: User, db: Session) -> AccessRequestResponse:
    req = _get_patient_owned_request(request_id, current_user, db)

    if req.status != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved requests can be revoked")

    req.status = "revoked"
    req.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_revoked",
            message=f"Your access to {req.patient.user.full_name}'s records has been revoked.",
        )
    except Exception:
        pass

    return _build_response(req)


def check_doctor_has_access(doctor: Doctor, report_id: uuid.UUID, db: Session) -> bool:
    report = db.query(MedicalReport).filter(MedicalReport.id == report_id).first()
    # Medical-center uploads join the patient's record only once the patient approves them.
    if not report or not report.is_approved:
        return False

    req = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor.id,
        AccessRequest.patient_id == report.patient_id,
        AccessRequest.status == "approved",
    ).first()

    # An expired approval keeps its stored status and is shown as "expired"
    # (see display_status); it no longer grants access.
    return bool(req) and not _is_expired(req)


def _is_expired(req: AccessRequest) -> bool:
    return bool(req.expires_at) and datetime.now(timezone.utc) > req.expires_at.replace(tzinfo=timezone.utc)


def _get_patient_owned_request(request_id: str, current_user: User, db: Session) -> AccessRequest:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    req = db.query(AccessRequest).filter(
        AccessRequest.id == uuid.UUID(request_id),
        AccessRequest.patient_id == patient.id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    return req
