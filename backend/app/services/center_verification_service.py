"""Medical center licence checks.

Every hospital, clinic and lab in Pakistan must be licensed by its provincial
regulator. A center registers with its regulator, licence number and licence expiry; an
admin checks the licence on the regulator's register (Punjab has an online lookup),
confirms the center really is that establishment (official email domain, or a callback
to the number on the register), and approves it with a note on how it was checked.
Approval lapses when the licence expires. Centers approved before these checks keep
working and are marked as such.
"""
import logging
from datetime import date, datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.medical_center import MedicalCenter
from app.models.user import User
from app.services.notification_service import create_notification, notify_admins

logger = logging.getLogger(__name__)

# Provincial healthcare regulators: code -> (name, page to check a licence, if known)
REGULATORS = {
    "PHC": ("Punjab Healthcare Commission", "https://os.phc.org.pk/verify.aspx"),
    "SHCC": ("Sindh Healthcare Commission", None),
    "KPHCC": ("Khyber Pakhtunkhwa Health Care Commission", "https://www.hcc.kp.gov.pk/"),
    "IHRA": ("Islamabad Healthcare Regulatory Authority", "https://ihra.gov.pk/"),
}

# A center registering from one of these is less convincing than from its own domain,
# so the admin is told to confirm it by phone.
FREE_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com",
    "live.com", "msn.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "mail.com", "gmx.com",
}

ADMIN_CENTERS_PAGE = "/admin/medical-centers"


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def regulator_name(code: Optional[str]) -> Optional[str]:
    return REGULATORS[code][0] if code in REGULATORS else None


def check_licence_expiry(expires_at: Optional[date]) -> None:
    if expires_at is None:
        raise _bad_request("Enter the licence expiry date.")
    if expires_at < date.today():
        raise _bad_request("This licence has already expired, so it cannot be used to register.")


def center_status(center: MedicalCenter) -> str:
    """approved, rejected (including a lapsed licence) or pending."""
    if center.is_approved:
        return "approved"
    return "rejected" if center.rejection_reason else "pending"


def licence_label(center: MedicalCenter) -> Optional[str]:
    """Shown on approved centers, e.g. "Licensed by PHC · verified by MedLock"."""
    if not center.is_approved:
        return None
    if not center.regulator:
        return "Approved before licence checks"
    return f"Licensed by {center.regulator} · verified by MedLock"


def email_domain(center: MedicalCenter) -> str:
    email = center.user.email if center.user else ""
    return email.rsplit("@", 1)[-1].lower() if "@" in email else ""


def licence_summary(center: MedicalCenter) -> dict:
    """Licence details shown to the center itself and to admins."""
    return {
        "regulator": center.regulator,
        "regulator_name": regulator_name(center.regulator),
        "license_number": center.license_number,
        "license_expires_at": center.license_expires_at,
        "status": center_status(center),
        "licence_label": licence_label(center),
    }


def admin_summary(center: MedicalCenter) -> dict:
    domain = email_domain(center)
    return {
        **licence_summary(center),
        "regulator_url": REGULATORS[center.regulator][1] if center.regulator in REGULATORS else None,
        "verification_note": center.verification_note,
        "email_domain": domain,
        "free_email": domain in FREE_EMAIL_DOMAINS,
    }


# ── Admin decisions ───────────────────────────────────────────────────────────

def approve(center: MedicalCenter, admin_id, license_expires_at: Optional[date], note: Optional[str], db: Session) -> None:
    if center.is_approved:
        raise _bad_request("Medical center is already approved")
    if not center.regulator:
        raise _bad_request(
            "This center has not given its regulator yet. Reject it with a request to add its licence details."
        )
    check_licence_expiry(license_expires_at)
    note = (note or "").strip()
    if not note:
        raise _bad_request("Note how you checked the licence, e.g. \"PHC portal - name and address match\".")

    center.is_approved = True
    center.approved_by = admin_id
    center.approved_at = datetime.utcnow()
    center.rejection_reason = None
    center.license_expires_at = license_expires_at
    center.verification_note = note
    db.commit()
    db.refresh(center)


# ── Center resubmits after rejection ──────────────────────────────────────────

def resubmit(
    center: MedicalCenter, regulator: str, license_number: str, license_expires_at: Optional[date],
    address: str, db: Session,
) -> None:
    """A pending or rejected center corrects its licence details and goes back for review."""
    if center.is_approved:
        raise _bad_request("Your center is already approved.")
    if regulator not in REGULATORS:
        raise _bad_request("Choose your center's regulator.")
    license_number = (license_number or "").strip()
    address = (address or "").strip()
    if not license_number or not address:
        raise _bad_request("Enter your licence number and address.")
    check_licence_expiry(license_expires_at)
    taken = db.query(MedicalCenter).filter(
        MedicalCenter.license_number == license_number, MedicalCenter.id != center.id,
    ).first()
    if taken:
        raise _bad_request("License number already registered")

    center.regulator = regulator
    center.license_number = license_number
    center.license_expires_at = license_expires_at
    center.address = address
    center.rejection_reason = None
    db.commit()

    try:
        notify_admins(
            db, "medical_center_registered",
            f"'{center.name}' updated its licence details ({regulator} licence {license_number}) "
            "and is waiting for review again.",
            link=ADMIN_CENTERS_PAGE,
        )
    except Exception:
        logger.exception("Could not notify admins about resubmitted center %s", center.id)


# ── Periodic job ──────────────────────────────────────────────────────────────

def expire_lapsed_center_licences(db: Session) -> int:
    """Withdraw approval from centers whose licence has expired."""
    lapsed = db.query(MedicalCenter).filter(
        MedicalCenter.is_approved.is_(True),
        MedicalCenter.license_expires_at.isnot(None),
        MedicalCenter.license_expires_at < date.today(),
    ).all()
    for center in lapsed:
        expired_on = center.license_expires_at
        center.is_approved = False
        center.rejection_reason = (
            f"Your licence expired on {expired_on:%d %B %Y}. Update your licence details to be reviewed again."
        )
        db.commit()
        try:
            create_notification(
                db, center.user_id, "medical_center_licence_expired",
                f"Your {center.regulator or 'regulator'} licence expired on {expired_on:%d %B %Y}, so "
                f"'{center.name}' can no longer use MedLock. Renew it and update your licence details.",
                link="/mc/dashboard",
            )
        except Exception:
            logger.exception("Could not notify center %s about its expired licence", center.id)
    return len(lapsed)
