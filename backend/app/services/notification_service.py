import logging
import smtplib
import threading
import uuid
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import Notification
from app.services.email_templates import render_email
from app.models.user import User

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15

# Subject line and heading for each notification type's email
EMAIL_TITLES = {
    "access_request": "New request to access your medical records",
    "access_approved": "Your access request was approved",
    "access_denied": "Your access request was declined",
    "access_revoked": "Your access to a patient's records was revoked",
    "report_uploaded": "A new report was added to your records",
    "report_approval_required": "A report is waiting for your approval",
    "medical_center_approved": "Your medical center has been approved",
    "medical_center_rejected": "Update on your medical center registration",
    "medical_center_registered": "A new medical center is awaiting approval",
    "medical_center_licence_expired": "Your center's licence has expired",
    "report_consent_approved": "A patient approved your uploaded report",
    "report_consent_rejected": "A patient declined your uploaded report",
    "affiliation_approved": "Your affiliation request was approved",
    "affiliation_rejected": "Update on your affiliation request",
    "affiliation_ended": "A medical center affiliation has ended",
    "blockchain_failed": "Action needed: blockchain logging failed",
    "imaging_processed": "An imaging study is ready to view",
    "imaging_processing_failed": "An imaging study could not be processed",
    "doctor_verification_requested": "A doctor is waiting for license verification",
    "doctor_verification_approved": "Your license has been verified",
    "doctor_verification_rejected": "Update on your license verification",
    "doctor_verification_revoked": "Your verification has been removed",
    "report_question": "New question about a report",
    "report_reply": "New reply about a report",
}

# Page a notification opens, by recipient role and notification type, used when the
# caller does not give a more specific link (e.g. a particular report).
DEFAULT_LINKS = {
    "patient": {
        "access_request": "/patient/access-requests",
        "report_uploaded": "/patient/reports",
        "report_approval_required": "/patient/reports",
        "imaging_processed": "/patient/reports",
        "imaging_processing_failed": "/patient/reports",
    },
    "doctor": {
        "access_approved": "/doctor/patients",
        "access_denied": "/doctor/access-requests",
        "access_revoked": "/doctor/access-requests",
        "affiliation_approved": "/doctor/affiliation",
        "affiliation_rejected": "/doctor/affiliation",
        "affiliation_ended": "/doctor/affiliation",
        "doctor_verification_approved": "/doctor/affiliation",
        "doctor_verification_rejected": "/doctor/affiliation",
        "doctor_verification_revoked": "/doctor/affiliation",
    },
    "medical_center": {
        "medical_center_approved": "/mc/dashboard",
        "medical_center_rejected": "/mc/dashboard",
        "medical_center_licence_expired": "/mc/dashboard",
        "report_consent_approved": "/mc/reports",
        "report_consent_rejected": "/mc/reports",
        "affiliation_ended": "/mc/doctors",
        "imaging_processed": "/mc/reports",
        "imaging_processing_failed": "/mc/reports",
    },
    "admin": {
        "medical_center_registered": "/admin/medical-centers",
        "blockchain_failed": "/admin/audit-logs",
        "doctor_verification_requested": "/admin/doctors",
    },
}
# Fallback page per role when a notification type has no specific page
ROLE_HOME = {
    "patient": "/patient/notifications",
    "doctor": "/doctor/notifications",
    "medical_center": "/mc/notifications",
    "admin": "/admin/notifications",
}


def default_link(role: str, notification_type: str) -> str:
    return DEFAULT_LINKS.get(role, {}).get(notification_type) or ROLE_HOME.get(role, "/login")


def create_notification(
    db: Session,
    recipient_id: uuid.UUID,
    notification_type: str,
    message: str,
    link: str | None = None,
    send_email: bool = True,
) -> None:
    """Store an in-app notification (opening `link`, or the default page for its type) and,
    unless `send_email` is False, email it."""
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if link is None and recipient is not None:
        link = default_link(recipient.role, notification_type)
    notification = Notification(
        recipient_id=recipient_id,
        type=notification_type,
        message=message,
        link=link,
    )
    db.add(notification)
    db.commit()

    if send_email and recipient and recipient.email and _can_email(recipient):
        subject, text, html = _notification_email(recipient, notification_type, message, link)
        send_email_async(recipient.email, subject, text, html)


def notify_admins(db: Session, notification_type: str, message: str, link: str | None = None) -> None:
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(db, admin.id, notification_type, message, link)


def _can_email(user: User) -> bool:
    """Only email confirmed addresses when confirmation is enforced, so unconfirmed
    (possibly mistyped or fake) addresses don't collect bounces."""
    return not settings.EMAIL_VERIFICATION_REQUIRED or user.email_verified_at is not None


def _notification_email(
    recipient: User, notification_type: str, message: str, link: str | None = None,
) -> tuple[str, str, str]:
    """The email's button opens the same page as the in-app notification."""
    title = EMAIL_TITLES.get(notification_type, notification_type.replace("_", " ").capitalize())
    path = link or default_link(recipient.role, notification_type)
    link = f"{settings.FRONTEND_URL.rstrip('/')}{path}"
    text, html = render_email(
        name=recipient.full_name,
        heading=title,
        paragraphs=[message, "You can find the full details in your MedLock account."],
        button_text="View in MedLock",
        button_url=link,
    )
    return f"MedLock – {title}", text, html


def _mail_configured() -> bool:
    return bool(settings.MAIL_SERVER and settings.MAIL_FROM)


def send_email_async(to_address: str, subject: str, text: str, html: str | None = None) -> None:
    """Send on a background thread so a slow or failing mail server never delays the request."""
    if not _mail_configured():
        return
    threading.Thread(target=send_email, args=(to_address, subject, text, html), daemon=True).start()


def send_email(to_address: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send a plain-text email, with an HTML version when given (clients show the best they support)."""
    email = EmailMessage()
    email["From"] = settings.MAIL_FROM
    email["To"] = to_address
    email["Subject"] = subject
    email.set_content(text)
    if html:
        email.add_alternative(html, subtype="html")

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
