import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.schemas.access_request import AccessRequestCreate, AccessRequestResponse
from app.services.notification_service import create_notification
from app.services.blockchain_service import log_event as blockchain_log

ACCESS_EXPIRY_DAYS = 30


def _build_response(req: AccessRequest) -> AccessRequestResponse:
    return AccessRequestResponse(
        id=req.id,
        status=req.status,
        reason=req.reason,
        requested_at=req.requested_at,
        decided_at=req.decided_at,
        expires_at=req.expires_at,
        doctor_name=req.doctor.user.full_name if req.doctor and req.doctor.user else None,
        doctor_specialization=req.doctor.specialization if req.doctor else None,
        report_name=req.medical_report.original_filename if req.medical_report else None,
        report_type=req.medical_report.report_type if req.medical_report else None,
        patient_name=req.medical_report.patient.user.full_name if req.medical_report and req.medical_report.patient else None,
    )


def create_access_request(data: AccessRequestCreate, current_user: User, db: Session) -> AccessRequestResponse:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    report = db.query(MedicalReport).filter(MedicalReport.id == data.report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    existing = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor.id,
        AccessRequest.report_id == data.report_id,
        AccessRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A pending request already exists for this report")

    req = AccessRequest(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        report_id=data.report_id,
        reason=data.reason,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Notify the patient
    try:
        patient_user_id = report.patient.user_id
        create_notification(
            db,
            recipient_id=patient_user_id,
            notification_type="access_request",
            message=f"Dr. {current_user.full_name} has requested access to your report '{report.original_filename}'.",
        )
    except Exception:
        pass

    return _build_response(req)


def get_requests_for_patient(current_user: User, db: Session) -> list[AccessRequestResponse]:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    report_ids = [r.id for r in patient.medical_reports]
    requests = db.query(AccessRequest).filter(AccessRequest.report_id.in_(report_ids)).all()
    return [_build_response(r) for r in requests]


def get_requests_for_doctor(current_user: User, db: Session) -> list[AccessRequestResponse]:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    requests = db.query(AccessRequest).filter(AccessRequest.doctor_id == doctor.id).all()
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
        blockchain_log(req.report_id, req.medical_report.file_hash_sha256, "access_grant", db)
    except Exception:
        pass

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_approved",
            message=f"Your request to access '{req.medical_report.original_filename}' has been approved. Access expires in {ACCESS_EXPIRY_DAYS} days.",
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
        blockchain_log(req.report_id, req.medical_report.file_hash_sha256, "access_deny", db)
    except Exception:
        pass

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_denied",
            message=f"Your request to access '{req.medical_report.original_filename}' has been denied.",
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
        blockchain_log(req.report_id, req.medical_report.file_hash_sha256, "revoke", db)
    except Exception:
        pass

    try:
        create_notification(
            db,
            recipient_id=req.doctor.user_id,
            notification_type="access_revoked",
            message=f"Your access to '{req.medical_report.original_filename}' has been revoked.",
        )
    except Exception:
        pass

    return _build_response(req)


def check_doctor_has_access(doctor: Doctor, report_id: uuid.UUID, db: Session) -> bool:
    req = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor.id,
        AccessRequest.report_id == report_id,
        AccessRequest.status == "approved",
    ).first()

    if not req:
        return False

    if req.expires_at and datetime.now(timezone.utc) > req.expires_at.replace(tzinfo=timezone.utc):
        req.status = "revoked"
        db.commit()
        return False

    return True


def _get_patient_owned_request(request_id: str, current_user: User, db: Session) -> AccessRequest:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    req = db.query(AccessRequest).filter(AccessRequest.id == uuid.UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    report = db.query(MedicalReport).filter(
        MedicalReport.id == req.report_id,
        MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your report")

    return req
