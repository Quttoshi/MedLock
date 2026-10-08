""""Break the glass" emergency access.

When a patient cannot consent (unconscious, unable to communicate, life-threatening
condition), a verified doctor working at a hospital can open their records for 24 hours.
The doctor finds the patient with the CNIC and date of birth printed on the card in their
wallet, gives a reason and a justification, and declares that the patient cannot
consent. The patient, the admins and the doctor's hospital are told immediately; every
report opened is recorded once on the blockchain, so the patient can see exactly what was
read; the patient can end the access early and report misuse for an admin to review.
"""
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.emergency_access import EmergencyAccess, EmergencyAccessView
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.user import User
from app.services import patient_identity_service as identity
from app.services.audit_service import log_action
from app.services.blockchain_service import log_event as blockchain_log
from app.services.notification_service import create_notification, notify_admins

logger = logging.getLogger(__name__)

DURATION = timedelta(hours=24)
DAILY_LIMIT = 3
MIN_JUSTIFICATION = 20
REASONS = {
    "unconscious": "Patient is unconscious",
    "cannot_communicate": "Patient cannot communicate",
    "life_threatening": "Life-threatening condition",
    "other": "Other emergency",
}


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def is_active(access: EmergencyAccess, now: Optional[datetime] = None) -> bool:
    now = now or datetime.utcnow()
    return access.ended_at is None and access.expires_at > now


def state(access: EmergencyAccess) -> str:
    if access.ended_at is not None:
        return "ended"
    return "active" if is_active(access) else "expired"


def active_access(doctor_id, patient_id, db: Session) -> Optional[EmergencyAccess]:
    return db.query(EmergencyAccess).filter(
        EmergencyAccess.doctor_id == doctor_id,
        EmergencyAccess.patient_id == patient_id,
        EmergencyAccess.ended_at.is_(None),
        EmergencyAccess.expires_at > datetime.utcnow(),
    ).first()


def hospitals_for(doctor: Doctor) -> list:
    """Approved hospitals the doctor currently belongs to; emergency access is for
    hospital emergency departments, not clinics or labs."""
    return [
        a.medical_center for a in (doctor.affiliations or [])
        if a.status == "active" and a.medical_center
        and a.medical_center.center_type == "hospital" and a.medical_center.is_approved
    ]


def used_today(doctor_id, db: Session) -> int:
    since = datetime.utcnow() - timedelta(hours=24)
    return db.query(EmergencyAccess).filter(
        EmergencyAccess.doctor_id == doctor_id, EmergencyAccess.started_at >= since,
    ).count()


def eligibility(doctor: Doctor, db: Session) -> dict:
    hospitals = hospitals_for(doctor)
    used = used_today(doctor.id, db)
    if not doctor.is_verified:
        reason = "Only verified doctors can use emergency access."
    elif not hospitals:
        reason = "Emergency access is for doctors working at a hospital on MedLock."
    elif used >= DAILY_LIMIT:
        reason = f"You have used emergency access {DAILY_LIMIT} times in the last 24 hours."
    else:
        reason = None
    return {
        "can_use": reason is None,
        "reason": reason,
        "hospitals": [{"id": str(h.id), "name": h.name} for h in hospitals],
        "used_today": used,
        "daily_limit": DAILY_LIMIT,
        "duration_hours": int(DURATION.total_seconds() // 3600),
        "reasons": [{"code": code, "label": label} for code, label in REASONS.items()],
    }


# ── Shapes returned to the client ─────────────────────────────────────────────

def _age(born: Optional[date]) -> Optional[int]:
    if not born:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def doctor_view(access: EmergencyAccess) -> dict:
    """What the treating doctor sees: enough to identify the patient and call their family."""
    patient = access.patient
    return {
        **_common(access),
        "patient": {
            "id": str(patient.id),
            "name": patient.user.full_name if patient.user else None,
            "age": _age(patient.date_of_birth),
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "emergency_contact_name": patient.emergency_contact_name,
            "emergency_contact_phone": patient.emergency_contact_phone,
        },
    }


def patient_view(access: EmergencyAccess) -> dict:
    """What the patient sees: who, where, why, and exactly which reports were opened."""
    doctor = access.doctor
    return {
        **_common(access),
        "doctor_name": doctor.user.full_name if doctor and doctor.user else None,
        "doctor_specialization": doctor.specialization if doctor else None,
        "justification": access.justification,
        "reports_opened": [
            {"id": str(v.report_id), "filename": v.report.original_filename if v.report else None,
             "first_viewed_at": v.first_viewed_at}
            for v in access.views
        ],
        "flagged_at": access.flagged_at,
        "flag_note": access.flag_note,
        "reviewed_at": access.reviewed_at,
    }


def admin_view(access: EmergencyAccess) -> dict:
    return {
        **patient_view(access),
        "patient_name": access.patient.user.full_name if access.patient and access.patient.user else None,
        "review_note": access.review_note,
    }


def _common(access: EmergencyAccess) -> dict:
    return {
        "id": str(access.id),
        "status": state(access),
        "hospital": access.medical_center.name if access.medical_center else None,
        "reason_code": access.reason_code,
        "reason": REASONS.get(access.reason_code, access.reason_code),
        "started_at": access.started_at,
        "expires_at": access.expires_at,
        "ended_at": access.ended_at,
    }


# ── Starting and ending ───────────────────────────────────────────────────────

def start(
    doctor: Doctor, doctor_user: User, cnic: str, date_of_birth: Optional[date], medical_center_id: str,
    reason_code: str, justification: str, declaration: bool, db: Session, request=None,
) -> dict:
    if not doctor.is_verified:
        raise _forbidden("Only verified doctors can use emergency access.")
    hospital = next((h for h in hospitals_for(doctor) if str(h.id) == str(medical_center_id)), None)
    if hospital is None:
        raise _forbidden("Choose a hospital you currently work at.")
    if reason_code not in REASONS:
        raise _bad_request("Choose the reason for emergency access.")
    justification = (justification or "").strip()
    if len(justification) < MIN_JUSTIFICATION:
        raise _bad_request(f"Explain the emergency in at least {MIN_JUSTIFICATION} characters.")
    if not declaration:
        raise _bad_request("Confirm that the patient cannot consent and that delay would put them at risk.")
    if not cnic:
        raise _bad_request("Enter the patient's CNIC and date of birth from their card.")

    patient = identity.find_patient(db, cnic=cnic, date_of_birth=date_of_birth)

    existing = active_access(doctor.id, patient.id, db)
    if existing:
        return doctor_view(existing)
    if used_today(doctor.id, db) >= DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You have used emergency access {DAILY_LIMIT} times in the last 24 hours.",
        )

    now = datetime.utcnow()
    access = EmergencyAccess(
        doctor_id=doctor.id, patient_id=patient.id, medical_center_id=hospital.id,
        reason_code=reason_code, justification=justification, started_at=now, expires_at=now + DURATION,
    )
    access.doctor, access.patient, access.medical_center = doctor, patient, hospital
    db.add(access)
    db.commit()
    db.refresh(access)

    log_action(
        db, action="emergency_access_started", performed_by=doctor_user.id, entity_type="patient",
        entity_id=patient.id,
        details={"emergency_access_id": str(access.id), "hospital": hospital.name, "reason": reason_code,
                 "justification": justification},
        request=request,
    )
    _notify_started(access, doctor_user, db)
    return doctor_view(access)


def _notify_started(access: EmergencyAccess, doctor_user: User, db: Session) -> None:
    reason = REASONS[access.reason_code].lower()
    doctor_name = doctor_user.full_name
    hospital = access.medical_center.name
    patient_name = access.patient.user.full_name if access.patient.user else "a patient"
    try:
        create_notification(
            db, access.patient.user_id, "emergency_access_started",
            f"Dr. {doctor_name} at {hospital} used emergency access to your records ({reason}). "
            "It lasts 24 hours. Review it on your dashboard, end it, or report misuse.",
            link="/patient/dashboard#emergency",
        )
        notify_admins(
            db, "emergency_access_started",
            f"Dr. {doctor_name} used emergency access to {patient_name}'s records at {hospital} ({reason}).",
            link="/admin/emergency",
        )
        create_notification(
            db, access.medical_center.user_id, "emergency_access_started",
            f"Dr. {doctor_name} used emergency access to a patient's records at {hospital} ({reason}).",
        )
    except Exception:
        logger.exception("Could not send emergency access notifications for %s", access.id)


def end(access_id, user: User, db: Session, request=None) -> dict:
    """The doctor, or the patient whose records they are, ends the access early."""
    access = db.query(EmergencyAccess).filter(EmergencyAccess.id == access_id).first()
    if not access or user.id not in (access.doctor.user_id, access.patient.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency access not found")
    if not is_active(access):
        raise _bad_request("This emergency access has already ended.")
    access.ended_at = datetime.utcnow()
    access.ended_by_user_id = user.id
    db.commit()

    by_patient = user.id == access.patient.user_id
    log_action(db, action="emergency_access_ended", performed_by=user.id, entity_type="patient",
               entity_id=access.patient_id,
               details={"emergency_access_id": str(access.id), "ended_by": "patient" if by_patient else "doctor"},
               request=request)
    if by_patient:
        try:
            create_notification(
                db, access.doctor.user_id, "emergency_access_ended",
                f"The patient ended your emergency access to their records at {access.medical_center.name}.",
            )
        except Exception:
            logger.exception("Could not notify doctor about ended emergency access %s", access.id)
    return patient_view(access) if by_patient else doctor_view(access)


# ── Reports opened ────────────────────────────────────────────────────────────

def has_active_emergency(doctor_id, patient_id, db: Session) -> bool:
    return active_access(doctor_id, patient_id, db) is not None


def record_report_opened(doctor: Doctor, report: MedicalReport, db: Session, has_consent: bool) -> None:
    """Record the first time each report is opened under emergency access, on the
    blockchain too. Access the patient granted themselves is not recorded here."""
    if has_consent:
        return
    access = active_access(doctor.id, report.patient_id, db)
    if not access:
        return
    seen = db.query(EmergencyAccessView).filter(
        EmergencyAccessView.emergency_access_id == access.id,
        EmergencyAccessView.report_id == report.id,
    ).first()
    if seen:
        return
    db.add(EmergencyAccessView(emergency_access_id=access.id, report_id=report.id, first_viewed_at=datetime.utcnow()))
    db.commit()
    try:
        blockchain_log(report.id, report.file_hash_sha256, "emergency_access", db)
    except Exception:
        logger.exception("Could not log emergency access to report %s on the blockchain", report.id)


# ── Patient: misuse reports; admin: review ────────────────────────────────────

def flag(access_id, user: User, note: Optional[str], db: Session, request=None) -> dict:
    access = db.query(EmergencyAccess).filter(EmergencyAccess.id == access_id).first()
    if not access or access.patient.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency access not found")
    note = (note or "").strip()
    if not note:
        raise _bad_request("Tell us why you think this access was not a real emergency.")
    access.flagged_at = datetime.utcnow()
    access.flag_note = note
    db.commit()
    log_action(db, action="emergency_access_flagged", performed_by=user.id, entity_type="patient",
               entity_id=access.patient_id, details={"emergency_access_id": str(access.id)}, request=request)
    try:
        notify_admins(
            db, "emergency_access_flagged",
            f"A patient reported Dr. {access.doctor.user.full_name}'s emergency access at "
            f"{access.medical_center.name if access.medical_center else 'a hospital'} as possible misuse.",
            link="/admin/emergency",
        )
    except Exception:
        logger.exception("Could not notify admins about flagged emergency access %s", access.id)
    return patient_view(access)


def review(access_id, admin_user: User, note: Optional[str], db: Session, request=None) -> dict:
    access = db.query(EmergencyAccess).filter(EmergencyAccess.id == access_id).first()
    if not access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency access not found")
    note = (note or "").strip()
    if not note:
        raise _bad_request("Write what you found when reviewing this access.")
    access.reviewed_at = datetime.utcnow()
    access.reviewed_by_user_id = admin_user.id
    access.review_note = note
    db.commit()
    log_action(db, action="emergency_access_reviewed", performed_by=admin_user.id, entity_type="patient",
               entity_id=access.patient_id, details={"emergency_access_id": str(access.id)}, request=request)
    return admin_view(access)


# ── Lists ─────────────────────────────────────────────────────────────────────

def for_doctor(doctor: Doctor, db: Session) -> list[dict]:
    rows = db.query(EmergencyAccess).filter(
        EmergencyAccess.doctor_id == doctor.id,
        EmergencyAccess.ended_at.is_(None),
        EmergencyAccess.expires_at > datetime.utcnow(),
    ).order_by(EmergencyAccess.started_at.desc()).all()
    return [doctor_view(a) for a in rows]


def for_patient(patient: Patient, db: Session) -> list[dict]:
    rows = db.query(EmergencyAccess).filter(EmergencyAccess.patient_id == patient.id).order_by(
        EmergencyAccess.started_at.desc()
    ).all()
    return [patient_view(a) for a in rows]


def for_admin(db: Session) -> list[dict]:
    rows = db.query(EmergencyAccess).order_by(EmergencyAccess.started_at.desc()).all()
    # Unreviewed misuse reports first, then everything else newest first.
    rows.sort(key=lambda a: 0 if a.flagged_at and not a.reviewed_at else 1)
    return [admin_view(a) for a in rows]
