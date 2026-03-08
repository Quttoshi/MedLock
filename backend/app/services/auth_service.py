import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.dependencies.jwt import create_access_token
from app.models.user import User
from app.models.patient import Patient
from app.schemas.auth import PatientRegisterRequest, LoginRequest

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Track failed login attempts: { email: { count: int, lockout_until: datetime | None } }
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

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}
