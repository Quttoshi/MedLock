"""Doctor memberships of medical centers.

A doctor can be an active member of several centers at once, which is common in
Pakistan (a public hospital by day, their own clinic in the evening). Labs only upload
reports and take no doctors. A doctor verified through a center stays verified while
they belong to at least one center; when the last one ends, verification lapses and
they can join another center or ask an admin to check them on the PMDC register.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.affiliation_request import AffiliationRequest
from app.models.doctor import Doctor
from app.models.doctor_affiliation import DoctorAffiliation
from app.models.medical_center import MedicalCenter
from app.models.user import User
from app.services.audit_service import log_action
from app.services.doctor_verification_service import _notify_doctor, clear_verification
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

CENTER_TYPE_LABELS = {"hospital": "Hospital", "clinic": "Clinic", "lab": "Diagnostic lab"}


def is_lab(center: MedicalCenter) -> bool:
    return center.center_type == "lab"


def active_affiliations(doctor: Doctor) -> list:
    return [a for a in (doctor.affiliations or []) if a.status == "active"]


def active_centers(doctor: Doctor) -> list:
    return [a.medical_center for a in active_affiliations(doctor) if a.medical_center]


def center_summary(center: MedicalCenter) -> dict:
    return {"id": str(center.id), "name": center.name, "center_type": center.center_type}


def membership_summary(affiliation: DoctorAffiliation) -> dict:
    return {
        **center_summary(affiliation.medical_center),
        "address": affiliation.medical_center.address,
        "joined_at": affiliation.joined_at,
    }


def _active_affiliation(doctor_id, center_id, db: Session) -> Optional[DoctorAffiliation]:
    return db.query(DoctorAffiliation).filter(
        DoctorAffiliation.doctor_id == doctor_id,
        DoctorAffiliation.medical_center_id == center_id,
        DoctorAffiliation.status == "active",
    ).first()


# ── Joining ───────────────────────────────────────────────────────────────────

def check_can_request(doctor: Doctor, center: MedicalCenter, db: Session) -> None:
    """Refuse an affiliation request the doctor cannot make with this center."""
    if is_lab(center):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diagnostic labs do not take affiliated doctors. Choose a hospital or clinic.",
        )
    if _active_affiliation(doctor.id, center.id, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You are already affiliated with {center.name}",
        )
    pending = db.query(AffiliationRequest).filter(
        AffiliationRequest.doctor_id == doctor.id,
        AffiliationRequest.medical_center_id == center.id,
        AffiliationRequest.status == "pending",
    ).first()
    if pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending affiliation request already exists for this medical center",
        )


def add_affiliation(doctor: Doctor, center: MedicalCenter, request: AffiliationRequest, db: Session) -> DoctorAffiliation:
    """Make the doctor an active member of the center (the caller commits)."""
    affiliation = _active_affiliation(doctor.id, center.id, db)
    if affiliation:
        return affiliation
    affiliation = DoctorAffiliation(
        doctor_id=doctor.id,
        medical_center_id=center.id,
        affiliation_request_id=request.id if request else None,
        status="active",
        joined_at=datetime.utcnow(),
    )
    db.add(affiliation)
    doctor.affiliations.append(affiliation)
    return affiliation


# ── Leaving ───────────────────────────────────────────────────────────────────

def get_active_affiliation_or_404(doctor_id, center_id, db: Session) -> DoctorAffiliation:
    affiliation = _active_affiliation(doctor_id, center_id, db)
    if not affiliation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active affiliation found")
    return affiliation


def end_affiliation(
    affiliation: DoctorAffiliation, ended_by: User, reason: Optional[str], db: Session, request=None,
) -> None:
    """End a membership, by the doctor leaving or the center removing them, then apply
    the verification lapse rule and tell the other side."""
    doctor = affiliation.doctor
    center = affiliation.medical_center
    reason = (reason or "").strip() or None

    affiliation.status = "ended"
    affiliation.ended_at = datetime.utcnow()
    affiliation.ended_by_user_id = ended_by.id
    affiliation.end_reason = reason
    lapsed = _apply_lapse_rule(doctor, center)
    db.commit()

    by_doctor = ended_by.id == doctor.user_id
    log_action(
        db, action="affiliation_left" if by_doctor else "affiliation_removed", performed_by=ended_by.id,
        entity_type="doctor", entity_id=doctor.id,
        details={"medical_center_id": str(center.id), "reason": reason, "verification_lapsed": lapsed},
        request=request,
    )

    doctor_name = doctor.user.full_name if doctor.user else "A doctor"
    try:
        if by_doctor:
            create_notification(
                db, center.user_id, "affiliation_ended",
                f"Dr. {doctor_name} left {center.name}.",
            )
        else:
            suffix = f" Reason: {reason}" if reason else ""
            create_notification(
                db, doctor.user_id, "affiliation_ended",
                f"{center.name} ended your affiliation.{suffix}",
            )
    except Exception:
        logger.exception("Could not notify about ended affiliation %s", affiliation.id)

    if lapsed:
        _notify_doctor(
            doctor, "doctor_verification_revoked",
            "You no longer belong to any medical center, so your verification has lapsed. "
            "Join a hospital or clinic, or request PMDC verification, to open patient records again.",
            db,
        )


def _verified_by_center(doctor: Doctor, center: MedicalCenter) -> bool:
    """Whether this center is the one that verified the doctor. Doctors verified before
    verifiers were recorded have no verifier; treat any of their centers as it."""
    if doctor.verification_method != "medical_center":
        return False
    return doctor.verified_by_user_id is None or doctor.verified_by_user_id == center.user_id


def _apply_lapse_rule(doctor: Doctor, ended_center: MedicalCenter) -> bool:
    """Move a center verification to another active center, or clear it when none is
    left. Returns True when the verification lapsed."""
    if not doctor.is_verified or not _verified_by_center(doctor, ended_center):
        return False
    remaining = [c for c in active_centers(doctor) if c.id != ended_center.id]
    if remaining:
        # Every center checks the license number when it approves an affiliation, so
        # another current center can vouch for the doctor.
        other = remaining[0]
        doctor.verified_by = other.user
        doctor.verification_note = f"License checked by {other.name}"
        return False
    clear_verification(doctor, "Verification lapsed: no active medical center affiliation")
    return True
