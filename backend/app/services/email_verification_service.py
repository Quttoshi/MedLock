"""Email address confirmation: signed links sent at registration, checked at login."""
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.notification_service import send_email_async

# Marks a token as an email-confirmation token; get_current_user refuses any token
# carrying a purpose, so a confirmation link can never be used to log in.
EMAIL_VERIFY_PURPOSE = "email_verify"

# email -> time of the last resend, to stop the endpoint being used to spam an inbox
_last_resend: dict[str, float] = {}


def is_verification_required() -> bool:
    return settings.EMAIL_VERIFICATION_REQUIRED


def is_verified(user: User) -> bool:
    return user.email_verified_at is not None


def create_verification_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        # Tying the token to the address means it stops working if the email changes.
        "email": user.email,
        "purpose": EMAIL_VERIFY_PURPOSE,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def send_verification_email(user: User) -> None:
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={create_verification_token(user)}"
    body = (
        f"Hi {user.full_name or 'there'},\n\n"
        "Please confirm your email address to activate your MedLock account:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours. "
        "If you did not create a MedLock account, you can ignore this email."
    )
    send_email_async(user.email, "MedLock: Confirm your email address", body)


def verify_email_token(token: str, db: Session) -> User:
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This confirmation link is invalid or has expired. Request a new one from the login page.",
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise invalid
    if payload.get("purpose") != EMAIL_VERIFY_PURPOSE:
        raise invalid

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or user.email != payload.get("email"):
        raise invalid
    if not is_verified(user):
        user.email_verified_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    return user


def resend_verification_email(email: str, db: Session) -> None:
    """Send a new link if the account exists and is unconfirmed. Callers always respond
    the same way, so this cannot be used to discover which emails are registered."""
    now = time.monotonic()
    last = _last_resend.get(email)
    if last is not None and now - last < settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait a minute before requesting another confirmation email.",
        )
    _last_resend[email] = now

    user = db.query(User).filter(User.email == email).first()
    if user and not is_verified(user):
        send_verification_email(user)
