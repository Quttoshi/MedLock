import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.dependencies.jwt import create_access_token
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.medical_center import MedicalCenter
from app.services.center_verification_service import ADMIN_CENTERS_PAGE, check_licence_expiry
from app.models.admin import Admin
from app.schemas.auth import (
    PatientRegisterRequest,
    DoctorRegisterRequest,
    MedicalCenterRegisterRequest,
    AdminRegisterRequest,
    LoginRequest,
)
from app.config import settings
from app.services.email_verification_service import is_verification_required, is_verified
from app.services.notification_service import notify_admins

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Track failed login attempts
_failed_attempts: dict = {}
MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _check_lockout(email: str):
    record = _failed_attempts.get(email)
    if not record:
        return
    if record.get("lockout_until"):
        if datetime.now(timezone.utc) < record["lockout_until"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again after {record['lockout_until'].strftime('%H:%M:%S')} UTC"
            )
        else:
            _failed_attempts.pop(email, None)


def _record_failed_attempt(email: str):
    from datetime import timedelta
    record = _failed_attempts.get(email, {"count": 0, "lockout_until": None})
    record["count"] += 1
    if record["count"] >= MAX_ATTEMPTS:
        record["lockout_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
    _failed_attempts[email] = record


def _clear_failed_attempts(email: str):
    _failed_attempts.pop(email, None)


def register_patient(data: PatientRegisterRequest, db: Session) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = User(
        id=uuid.uuid4(),
        full_name=data.name,
        email=data.email,
        password_hash=_hash_password(data.password),
        role="patient"
    )
    db.add(user)
    db.flush()

    patient = Patient(
        id=uuid.uuid4(),
        user_id=user.id,
        date_of_birth=data.date_of_birth,
        blood_group=data.blood_group,
        gender=data.gender,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone
    )
    db.add(patient)
    db.commit()
    db.refresh(user)
    return user


def register_doctor(data: DoctorRegisterRequest, db: Session) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if db.query(Doctor).filter(Doctor.license_number == data.license_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="License number already registered")

    user = User(
        id=uuid.uuid4(),
        full_name=data.name,
        email=data.email,
        password_hash=_hash_password(data.password),
        role="doctor",
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        id=uuid.uuid4(),
        user_id=user.id,
        specialization=data.specialization,
        license_number=data.license_number,
        is_verified=False,
    )
    db.add(doctor)
    db.commit()
    db.refresh(user)
    return user


CENTER_TYPE_NAMES = {"hospital": "hospital", "clinic": "clinic", "lab": "diagnostic lab"}


def register_medical_center(data: MedicalCenterRegisterRequest, db: Session) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    check_licence_expiry(data.license_expires_at)
    if db.query(MedicalCenter).filter(MedicalCenter.license_number == data.license_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="License number already registered")

    user = User(
        id=uuid.uuid4(),
        full_name=data.name,
        email=data.email,
        password_hash=_hash_password(data.password),
        role="medical_center",
    )
    db.add(user)
    db.flush()

    center = MedicalCenter(
        id=uuid.uuid4(),
        user_id=user.id,
        name=data.center_name,
        license_number=data.license_number,
        address=data.address,
        center_type=data.center_type,
        regulator=data.regulator,
        license_expires_at=data.license_expires_at,
        is_approved=False,
    )
    db.add(center)
    db.commit()
    db.refresh(user)

    try:
        notify_admins(
            db,
            "medical_center_registered",
            f"New {CENTER_TYPE_NAMES[data.center_type]} '{data.center_name}' ({data.regulator} licence "
            f"{data.license_number}) registered and is awaiting approval. Check the licence on the regulator's register.",
            link=ADMIN_CENTERS_PAGE,
        )
    except Exception:
        logger.exception("Could not notify admins about medical center registration %s", center.id)
    return user


def register_admin(data: AdminRegisterRequest, db: Session) -> User:
    if data.admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin secret")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if data.admin_level not in ("super", "standard"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="admin_level must be 'super' or 'standard'")

    user = User(
        id=uuid.uuid4(),
        full_name=data.name,
        email=data.email,
        password_hash=_hash_password(data.password),
        role="admin",
    )
    db.add(user)
    db.flush()

    admin = Admin(
        id=uuid.uuid4(),
        user_id=user.id,
        admin_level=data.admin_level,
    )
    db.add(admin)
    db.commit()
    db.refresh(user)
    return user


def login_user(data: LoginRequest, db: Session) -> dict:
    _check_lockout(data.email)

    user = db.query(User).filter(User.email == data.email).first()
    if not user or not _verify_password(data.password, user.password_hash):
        _record_failed_attempt(data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    _clear_failed_attempts(data.email)

    if is_verification_required() and not is_verified(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "email_not_verified",
                "message": "Please confirm your email address before logging in. Check your inbox for the confirmation link.",
            },
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}
