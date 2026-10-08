"""Patient identity: CNIC (or B-Form / NICOP) and finding a patient.

Hospitals, labs and doctors usually know a patient's CNIC (it is on their file and on
the card in their wallet) rather than their email. A CNIC is sensitive, so it is never
stored in plain text: an AES-encrypted copy lets the patient see their own number, and
lookups use a keyed fingerprint (HMAC), so the database alone cannot be used to look a
CNIC up. A CNIC lookup always needs the date of birth too, so a mistyped CNIC fails
instead of matching someone else, and nobody can probe which CNICs are registered.
"""
import hashlib
import hmac
from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.patient import Patient
from app.models.user import User
from app.services.encryption_service import decrypt_file, encrypt_file

CNIC_DIGITS = 13
# One message for every failed lookup, so it never reveals which detail was wrong.
NO_MATCH = "No patient matches these details"


def _fingerprint_key() -> bytes:
    # Derived from the server secret, separately from the file-encryption key.
    return hashlib.sha256(b"medlock-cnic-fingerprint:" + settings.AES_SECRET_KEY.encode()).digest()


def normalize_cnic(value: Optional[str]) -> str:
    """13 digits, accepting the usual 12345-1234567-1 format."""
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(digits) != CNIC_DIGITS or len(digits) != len((value or "").replace("-", "").replace(" ", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a 13-digit CNIC, B-Form or NICOP number, e.g. 12345-1234567-1",
        )
    return digits


def cnic_fingerprint(digits: str) -> str:
    return hmac.new(_fingerprint_key(), digits.encode(), hashlib.sha256).hexdigest()


def format_cnic(digits: str) -> str:
    return f"{digits[:5]}-{digits[5:12]}-{digits[12]}"


def masked_cnic(patient: Patient) -> Optional[str]:
    """e.g. •••••-••••567-1: enough for the patient to recognise their number."""
    if not patient.cnic_encrypted:
        return None
    digits = decrypt_file(patient.cnic_encrypted, patient.cnic_key_ref).decode()
    return f"•••••-••••{digits[9:12]}-{digits[12]}"


def check_cnic_available(digits: str, db: Session, patient_id=None) -> None:
    taken = db.query(Patient).filter(Patient.cnic_hash == cnic_fingerprint(digits)).first()
    if taken and taken.id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This CNIC is already registered to another MedLock account. Contact support if it is yours.",
        )


def set_cnic(patient: Patient, cnic: str, db: Session) -> None:
    """Store a patient's CNIC (the caller commits)."""
    digits = normalize_cnic(cnic)
    check_cnic_available(digits, db, patient.id)
    encrypted, key_ref = encrypt_file(digits.encode())
    patient.cnic_hash = cnic_fingerprint(digits)
    patient.cnic_encrypted = encrypted
    patient.cnic_key_ref = key_ref


def check_date_of_birth(value: Optional[date]) -> date:
    if value is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter the date of birth.")
    if value > date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The date of birth cannot be in the future.")
    return value


def identity_summary(patient: Patient) -> dict:
    return {
        "has_cnic": bool(patient.cnic_hash),
        "cnic_masked": masked_cnic(patient),
        "date_of_birth": patient.date_of_birth,
    }


# ── Finding a patient ─────────────────────────────────────────────────────────

def find_patient(
    db: Session, email: Optional[str] = None, cnic: Optional[str] = None, date_of_birth: Optional[date] = None,
) -> Patient:
    """Find a patient by email, or by CNIC together with date of birth. Every failure
    gives the same message."""
    if cnic:
        digits = normalize_cnic(cnic)
        if date_of_birth is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enter the patient's date of birth together with their CNIC.",
            )
        patient = db.query(Patient).filter(Patient.cnic_hash == cnic_fingerprint(digits)).first()
        if not patient or patient.date_of_birth != date_of_birth:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NO_MATCH)
        return patient

    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the patient's email, or their CNIC and date of birth.",
        )
    user = db.query(User).filter(func.lower(User.email) == email, User.role == "patient").first()
    patient = db.query(Patient).filter(Patient.user_id == user.id).first() if user else None
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NO_MATCH)
    return patient
