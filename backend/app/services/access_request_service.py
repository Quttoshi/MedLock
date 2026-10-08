import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.doctor_affiliation import DoctorAffiliation
from app.models.medical_center import MedicalCenter
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.schemas.access_request import AccessRequestByEmail, AccessRequestResponse
from app.services.doctor_verification_service import verification_label
from app.services.emergency_service import has_active_emergency
from app.services.patient_identity_service import find_patient
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
        initiated_by=req.initiated_by or "doctor",
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

    patient = find_patient(db, email=data.patient_email, cnic=data.patient_cnic, date_of_birth=data.patient_dob)
    patient_user = patient.user

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
        req.initiated_by = "doctor"
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
            initiated_by="doctor",
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
        # A doctor who found the patient by CNIC does not learn their email from this.
        "patient_email": patient_user.email if not data.patient_cnic else None,
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

    # Access the patient granted (an expired approval no longer counts), or else an
    # active emergency ("break the glass") access.
    return has_consented_access(doctor.id, report.patient_id, db) or has_active_emergency(
        doctor.id, report.patient_id, db
    )


def has_consented_access(doctor_id, patient_id, db: Session) -> bool:
    """Whether the patient has granted this doctor access that has not expired."""
    req = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor_id,
        AccessRequest.patient_id == patient_id,
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


# ── Patient-initiated sharing ────────────────────────────────────────────────

MIN_SEARCH_LENGTH = 3
MAX_SEARCH_RESULTS = 10
# All doctors at one hospital, which the patient filters by specialty and name
MAX_CENTER_DOCTORS = 300
MAX_SHARE_NOTE_LENGTH = 300


def _normalize_licence(value: str) -> str:
    return "".join((value or "").split()).upper()


def _patient_for(current_user: User, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return patient


def share_centers(current_user: User, db: Session) -> list[dict]:
    """Approved hospitals and clinics, for the patient to pick where their doctor works.
    Labs take no doctors, so they are left out."""
    _patient_for(current_user, db)
    centers = db.query(MedicalCenter).filter(
        MedicalCenter.is_approved.is_(True), MedicalCenter.center_type != "lab",
    ).order_by(MedicalCenter.name).all()
    return [
        {"id": str(c.id), "name": c.name, "center_type": c.center_type, "address": c.address}
        for c in centers
    ]


def search_doctors(query: str, current_user: User, db: Session, center_id=None) -> list[dict]:
    """Verified doctors a patient can share their records with, and no contact details.

    With a center: every verified doctor currently working there (the patient then
    narrows by specialty or name). Without one: a name search of at least 3 characters;
    a PMDC number also works, for patients who have it from a prescription."""
    patient = _patient_for(current_user, db)
    query = (query or "").strip()
    q = db.query(Doctor).join(User, Doctor.user_id == User.id).filter(Doctor.is_verified.is_(True))
    if center_id is not None:
        q = q.join(DoctorAffiliation, DoctorAffiliation.doctor_id == Doctor.id).filter(
            DoctorAffiliation.medical_center_id == center_id,
            DoctorAffiliation.status == "active",
        )
        if query:
            q = q.filter(User.full_name.ilike(f"%{query}%"))
        limit = MAX_CENTER_DOCTORS
    else:
        if len(query) < MIN_SEARCH_LENGTH:
            return []
        licence = _normalize_licence(query)
        q = q.filter(
            or_(
                User.full_name.ilike(f"%{query}%"),
                func.upper(func.replace(Doctor.license_number, " ", "")).like(f"{licence}%"),
            )
        )
        limit = MAX_SEARCH_RESULTS
    doctors = q.order_by(User.full_name).limit(limit).all()
    existing = {}
    if doctors:
        existing = {
            r.doctor_id: r for r in db.query(AccessRequest).filter(
                AccessRequest.patient_id == patient.id,
                AccessRequest.doctor_id.in_([d.id for d in doctors]),
            ).all()
        }
    return [
        {
            "id": str(d.id),
            "name": d.user.full_name if d.user else None,
            "specialization": d.specialization,
            "verification_label": verification_label(d),
            "medical_centers": [
                a.medical_center.name for a in (d.affiliations or []) if a.status == "active" and a.medical_center
            ],
            # The doctor's current access to this patient, if any (e.g. "approved", "pending")
            "access_status": display_status(existing[d.id]) if d.id in existing else None,
        }
        for d in doctors
    ]


def share_with_doctor(doctor_id, note, current_user: User, db: Session) -> AccessRequestResponse:
    """The patient gives a verified doctor access to their records without waiting for a
    request. It is the same 30-day, revocable access as approving a request; a pending
    request from that doctor is simply approved."""
    patient = _patient_for(current_user, db)
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    if not doctor.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only share your records with a verified doctor",
        )
    note = (note or "").strip()
    if len(note) > MAX_SHARE_NOTE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The note can be at most {MAX_SHARE_NOTE_LENGTH} characters",
        )

    now = datetime.now(timezone.utc)
    req = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == doctor.id,
        AccessRequest.patient_id == patient.id,
    ).first()
    if req and display_status(req) == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This doctor already has access until {req.expires_at:%d %B %Y}",
        )
    if req and req.status == "pending":
        # The doctor already asked: sharing answers their request.
        if note:
            req.reason = f"{req.reason} | Patient's note: {note}" if req.reason else note
    elif req:
        # Denied, revoked or expired before: the same row becomes a fresh grant.
        req.initiated_by = "patient"
        req.reason = note
        req.requested_at = now
    else:
        req = AccessRequest(
            id=uuid.uuid4(), doctor_id=doctor.id, patient_id=patient.id,
            reason=note, status="pending", initiated_by="patient", requested_at=now,
        )
        db.add(req)
    req.status = "approved"
    req.decided_at = now
    req.expires_at = now + timedelta(days=ACCESS_EXPIRY_DAYS)
    db.commit()
    db.refresh(req)

    shared = req.initiated_by == "patient"
    try:
        create_notification(
            db,
            recipient_id=doctor.user_id,
            notification_type="records_shared" if shared else "access_approved",
            message=(
                f"{current_user.full_name} shared their medical records with you. "
                f"Access lasts {ACCESS_EXPIRY_DAYS} days."
                if shared else
                f"Your request to access {current_user.full_name}'s records has been approved. "
                f"Access expires in {ACCESS_EXPIRY_DAYS} days."
            ),
        )
    except Exception:
        pass
    return _build_response(req)
