import logging
import smtplib
import threading
import uuid
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15


def create_notification(
    db: Session,
    recipient_id: uuid.UUID,
    notification_type: str,
    message: str,
) -> None:
    notification = Notification(
        recipient_id=recipient_id,
        type=notification_type,
        message=message,
    )
    db.add(notification)
    db.commit()

    recipient = db.query(User).filter(User.id == recipient_id).first()
    if recipient and recipient.email and _can_email(recipient):
        send_email_async(recipient.email, _email_subject(notification_type), message)


def notify_admins(db: Session, notification_type: str, message: str) -> None:
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(db, admin.id, notification_type, message)


def _can_email(user: User) -> bool:
    """Only email confirmed addresses when confirmation is enforced, so unconfirmed
    (possibly mistyped or fake) addresses don't collect bounces."""
    return not settings.EMAIL_VERIFICATION_REQUIRED or user.email_verified_at is not None


def _email_subject(notification_type: str) -> str:
    return f"MedLock: {notification_type.replace('_', ' ').capitalize()}"


def _mail_configured() -> bool:
    return bool(settings.MAIL_SERVER and settings.MAIL_FROM)


def send_email_async(to_address: str, subject: str, body: str) -> None:
    """Send on a background thread so a slow or failing mail server never delays the request."""
    if not _mail_configured():
        return
    threading.Thread(target=send_email, args=(to_address, subject, body), daemon=True).start()


def send_email(to_address: str, subject: str, body: str) -> bool:
    email = EmailMessage()
    email["From"] = settings.MAIL_FROM
    email["To"] = to_address
    email["Subject"] = subject
    email.set_content(f"{body}\n\n— MedLock")

    try:
        if settings.MAIL_PORT == 465:
            server = smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=SMTP_TIMEOUT_SECONDS)
        else:
            server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=SMTP_TIMEOUT_SECONDS)
            server.starttls()
        with server:
            if settings.MAIL_USERNAME:
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.send_message(email)
        return True
    except Exception:
        logger.exception("Failed to send '%s' email to %s", subject, to_address)
        return False
