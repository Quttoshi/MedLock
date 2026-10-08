"""Private question threads between a patient and a doctor about one report.

Each doctor has their own thread with the patient on a report; other doctors never see
it. The patient sees every thread on their report. Posting is allowed only while the
thread's doctor is verified and has access to the report; otherwise the thread is
read-only for both sides. This is checked on every request, so a thread comes back on its
own when access is granted again. A doctor keeps read-only access to their own thread
after their access ends, so advice they gave stays visible to them (the report itself
stays behind check_doctor_has_access).

Messages are encrypted at rest and never appear in notifications, emails or the audit log.

The database can be far from users, so each request loads what it needs in a few joined
queries, checks access once, commits once, and leaves notifications and audit entries to
run after the response (when the router passes BackgroundTasks).
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Callable, Optional

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import SessionLocal
from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.report_thread import ReportThread, ReportThreadMessage
from app.models.user import User
from app.services.access_request_service import _is_expired
from app.services.audit_service import log_action
from app.services.encryption_service import decrypt_file, encrypt_file
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000
EMAIL_INTERVAL = timedelta(hours=24)

# Everything a thread summary needs, loaded with the thread.
_THREAD_CONTEXT = (
    joinedload(ReportThread.report),
    joinedload(ReportThread.doctor).joinedload(Doctor.user),
    joinedload(ReportThread.patient).joinedload(Patient.user),
)


# ── Who is asking ─────────────────────────────────────────────────────────────

class Viewer:
    """The patient or doctor making a request."""

    def __init__(self, user: User, role: str, profile):
        self.user = user
        self.role = role
        self.profile = profile

    @property
    def is_patient(self) -> bool:
        return self.role == "patient"


def get_viewer(current_user: User, db: Session) -> Viewer:
    if current_user.role == "patient":
        profile = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    elif current_user.role == "doctor":
        profile = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    else:
        profile = None
    if profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients and doctors can use report questions")
    return Viewer(current_user, current_user.role, profile)


def _not_found(what: str = "Report") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


# ── Access ────────────────────────────────────────────────────────────────────

def _current_grants(patient_id, db: Session, doctor_id=None) -> dict:
    """Doctors with current (approved, unexpired) access to the patient, by doctor id."""
    q = db.query(AccessRequest).options(joinedload(AccessRequest.doctor).joinedload(Doctor.user)).filter(
        AccessRequest.patient_id == patient_id, AccessRequest.status == "approved",
    )
    if doctor_id is not None:
        q = q.filter(AccessRequest.doctor_id == doctor_id)
    return {g.doctor_id: g for g in q.all() if not _is_expired(g)}


def _doctor_can_use(doctor: Doctor, report: MedicalReport, grants: dict) -> bool:
    """A doctor may start or post in a thread while verified and with current access to
    the (approved) report. Mirrors check_doctor_has_access without re-querying."""
    return bool(doctor and doctor.is_verified and report and report.is_approved and doctor.id in grants)


def can_post(thread: ReportThread, db: Session) -> bool:
    """Both sides can post only while the thread's doctor is verified and has access."""
    grants = _current_grants(thread.patient_id, db, doctor_id=thread.doctor_id)
    return _doctor_can_use(thread.doctor, thread.report, grants)


def _patient_report(report_id: uuid.UUID, patient: Patient, db: Session) -> MedicalReport:
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id, MedicalReport.patient_id == patient.id,
    ).first()
    if not report:
        raise _not_found()
    # A medical-center upload joins the record (and can be discussed) only once approved.
    if not report.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approve this report before discussing it with a doctor",
        )
    return report


def _thread_for_viewer(thread_id: uuid.UUID, viewer: Viewer, db: Session, with_messages: bool = False) -> ReportThread:
    options = list(_THREAD_CONTEXT)
    if with_messages:
        options.append(selectinload(ReportThread.messages).joinedload(ReportThreadMessage.sender))
    thread = db.query(ReportThread).options(*options).filter(ReportThread.id == thread_id).first()
    if not thread:
        raise _not_found("Thread")
    owner_id = thread.patient_id if viewer.is_patient else thread.doctor_id
    if owner_id != viewer.profile.id:
        raise _not_found("Thread")
    return thread


# ── Shapes returned to the client ─────────────────────────────────────────────

def _is_unread(thread: ReportThread, viewer: Viewer) -> bool:
    last_read = thread.patient_last_read_at if viewer.is_patient else thread.doctor_last_read_at
    return last_read is None or thread.last_message_at > last_read


def _doctor_summary(doctor: Doctor) -> dict:
    return {
        "id": str(doctor.id),
        "name": doctor.user.full_name if doctor.user else None,
        "specialization": doctor.specialization,
    }


def thread_summary(thread: ReportThread, viewer: Viewer, postable: bool) -> dict:
    return {
        "id": str(thread.id),
        "report_id": str(thread.report_id),
        "report_filename": thread.report.original_filename if thread.report else None,
        "doctor": _doctor_summary(thread.doctor),
        "patient_name": thread.patient.user.full_name if thread.patient and thread.patient.user else None,
        "status": thread.status,
        "resolved_at": thread.resolved_at,
        "last_message_at": thread.last_message_at,
        "unread": _is_unread(thread, viewer),
        "can_post": postable,
    }


def _message_view(message: ReportThreadMessage, viewer: Viewer) -> dict:
    return {
        "id": str(message.id),
        "sender_role": message.sender_role,
        "sender_name": message.sender.full_name if message.sender else None,
        "is_mine": message.sender_user_id == viewer.user.id,
        "body": decrypt_file(message.body_encrypted, message.body_key_ref).decode("utf-8"),
        "sent_at": message.sent_at,
    }


# ── Reading ───────────────────────────────────────────────────────────────────

def list_threads(report_id: uuid.UUID, viewer: Viewer, db: Session) -> dict:
    if viewer.is_patient:
        report = _patient_report(report_id, viewer.profile, db)
        threads = db.query(ReportThread).options(*_THREAD_CONTEXT).filter(
            ReportThread.report_id == report.id
        ).order_by(ReportThread.last_message_at.desc()).all()
        grants = _current_grants(report.patient_id, db)
        with_thread = {t.doctor_id for t in threads}
        askable = [g.doctor for g in grants.values() if _doctor_can_use(g.doctor, report, grants)]
        return {
            "report_id": str(report.id),
            "report_filename": report.original_filename,
            "threads": [thread_summary(t, viewer, _doctor_can_use(t.doctor, report, grants)) for t in threads],
            "askable_doctors": [{**_doctor_summary(d), "has_thread": d.id in with_thread} for d in askable],
        }

    doctor = viewer.profile
    thread = db.query(ReportThread).options(*_THREAD_CONTEXT).filter(
        ReportThread.report_id == report_id, ReportThread.doctor_id == doctor.id,
    ).first()
    report = thread.report if thread else db.query(MedicalReport).filter(MedicalReport.id == report_id).first()
    if not report:
        raise _not_found()
    grants = _current_grants(report.patient_id, db, doctor_id=doctor.id)
    has_access = _doctor_can_use(doctor, report, grants)
    if not thread and not has_access:
        raise _not_found()
    return {
        "report_id": str(report_id),
        "report_filename": report.original_filename,
        "threads": [thread_summary(thread, viewer, has_access)] if thread else [],
        "can_start": has_access,
    }


def get_messages(thread_id: uuid.UUID, viewer: Viewer, db: Session) -> dict:
    thread = _thread_for_viewer(thread_id, viewer, db, with_messages=True)
    result = {
        **thread_summary(thread, viewer, can_post(thread, db)),
        "unread": False,
        "messages": [_message_view(m, viewer) for m in thread.messages],
    }
    _mark_read(thread, viewer)
    db.commit()
    return result


def unread_counts(viewer: Viewer, db: Session) -> dict:
    """Number of unread threads per report, for the badges on report lists."""
    column = ReportThread.patient_id if viewer.is_patient else ReportThread.doctor_id
    threads = db.query(ReportThread).filter(column == viewer.profile.id).all()
    counts: dict = {}
    for thread in threads:
        if _is_unread(thread, viewer):
            key = str(thread.report_id)
            counts[key] = counts.get(key, 0) + 1
    return counts


def _mark_read(thread: ReportThread, viewer: Viewer) -> None:
    if viewer.is_patient:
        thread.patient_last_read_at = datetime.utcnow()
    else:
        thread.doctor_last_read_at = datetime.utcnow()


# ── Writing ───────────────────────────────────────────────────────────────────

def _clean_body(body: Optional[str]) -> str:
    body = (body or "").strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write a message first")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Messages can be at most {MAX_MESSAGE_LENGTH} characters",
        )
    return body


def _read_only() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This conversation is read-only because the doctor no longer has access to the report",
    )


def start_thread(
    report_id: uuid.UUID, viewer: Viewer, body: Optional[str], doctor_id: Optional[str], db: Session,
    request=None, background: Optional[BackgroundTasks] = None,
) -> dict:
    """Start the thread between the patient and a doctor on this report, or add to it if
    it already exists. The patient chooses the doctor; a doctor always starts their own."""
    body = _clean_body(body)
    if viewer.is_patient:
        report = _patient_report(report_id, viewer.profile, db)
        if not doctor_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a doctor to ask")
        try:
            chosen = uuid.UUID(doctor_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a doctor to ask")
        grants = _current_grants(report.patient_id, db, doctor_id=chosen)
        doctor = next(iter(grants.values())).doctor if grants else None
        if not _doctor_can_use(doctor, report, grants):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only ask a verified doctor who currently has access to your records",
            )
    else:
        doctor = viewer.profile
        report = db.query(MedicalReport).filter(MedicalReport.id == report_id).first()
        grants = _current_grants(report.patient_id, db, doctor_id=doctor.id) if report else {}
        if not _doctor_can_use(doctor, report, grants):
            raise _not_found()

    thread = db.query(ReportThread).options(*_THREAD_CONTEXT).filter(
        ReportThread.report_id == report.id, ReportThread.doctor_id == doctor.id,
    ).first()
    is_new = thread is None
    if is_new:
        thread = ReportThread(
            id=uuid.uuid4(), report_id=report.id, doctor_id=doctor.id, patient_id=report.patient_id,
            status="open", messages=[],
        )
        thread.report, thread.doctor, thread.patient = report, doctor, report.patient
        db.add(thread)

    message = _add_message(thread, viewer, body, db)
    result = _sent_result(thread, viewer, message)
    notify = _prepare_notification(thread, viewer, is_new)
    db.commit()

    if is_new:
        _after_response(
            background, db, log_action, action="thread_started", performed_by=viewer.user.id,
            entity_type="medical_report", entity_id=report.id,
            details={"thread_id": str(thread.id), "doctor_id": str(doctor.id)}, request=request,
        )
    _after_response(background, db, _send_notification, **notify)
    return result


def post_message(
    thread_id: uuid.UUID, viewer: Viewer, body: Optional[str], db: Session,
    request=None, background: Optional[BackgroundTasks] = None,
) -> dict:
    body = _clean_body(body)
    thread = _thread_for_viewer(thread_id, viewer, db)
    if not can_post(thread, db):
        raise _read_only()
    reopened = thread.status == "resolved"
    message = _add_message(thread, viewer, body, db)
    result = _sent_result(thread, viewer, message)
    notify = _prepare_notification(thread, viewer, False)
    db.commit()

    if reopened:
        _log_status(thread, viewer, "thread_reopened", db, request, background)
    _after_response(background, db, _send_notification, **notify)
    return result


def _add_message(thread: ReportThread, viewer: Viewer, body: str, db: Session) -> ReportThreadMessage:
    encrypted, key_ref = encrypt_file(body.encode("utf-8"))
    now = datetime.utcnow()
    message = ReportThreadMessage(
        id=uuid.uuid4(), thread_id=thread.id, sender_user_id=viewer.user.id, sender_role=viewer.role,
        body_encrypted=encrypted, body_key_ref=key_ref, sent_at=now,
    )
    message.sender = viewer.user
    # Added directly rather than through thread.messages, so sending does not load the
    # whole conversation.
    db.add(message)
    thread.last_message_at = now
    # A new message reopens a resolved thread.
    if thread.status == "resolved":
        thread.status = "open"
        thread.resolved_at = None
        thread.resolved_by_user_id = None
    # The sender has read their own message.
    _mark_read(thread, viewer)
    return message


def _sent_result(thread: ReportThread, viewer: Viewer, message: ReportThreadMessage) -> dict:
    """The thread and the new message, built before committing so nothing is reloaded.
    Sending is only possible while posting is allowed."""
    return {
        **thread_summary(thread, viewer, True),
        "message": {
            "id": str(message.id),
            "sender_role": message.sender_role,
            "sender_name": viewer.user.full_name,
            "is_mine": True,
            "body": decrypt_file(message.body_encrypted, message.body_key_ref).decode("utf-8"),
            "sent_at": message.sent_at,
        },
    }


def set_resolved(
    thread_id: uuid.UUID, viewer: Viewer, resolved: bool, db: Session,
    request=None, background: Optional[BackgroundTasks] = None,
) -> dict:
    thread = _thread_for_viewer(thread_id, viewer, db)
    if not can_post(thread, db):
        raise _read_only()
    target = "resolved" if resolved else "open"
    changed = thread.status != target
    if changed:
        thread.status = target
        thread.resolved_at = datetime.utcnow() if resolved else None
        thread.resolved_by_user_id = viewer.user.id if resolved else None
    result = thread_summary(thread, viewer, True)
    if changed:
        db.commit()
        _log_status(thread, viewer, "thread_resolved" if resolved else "thread_reopened", db, request, background)
    return result


def _log_status(thread: ReportThread, viewer: Viewer, action: str, db: Session, request, background) -> None:
    _after_response(
        background, db, log_action, action=action, performed_by=viewer.user.id, entity_type="medical_report",
        entity_id=thread.report_id, details={"thread_id": str(thread.id)}, request=request,
    )


# ── After the response ────────────────────────────────────────────────────────

def _with_own_session(fn: Callable, **kwargs) -> None:
    """Run `fn(db, ...)` with its own session; the request's session is closed by then."""
    db = SessionLocal()
    try:
        fn(db, **kwargs)
    except Exception:
        logger.exception("Background thread task %s failed", getattr(fn, "__name__", fn))
    finally:
        db.close()


def _after_response(background: Optional[BackgroundTasks], db: Session, fn: Callable, **kwargs) -> None:
    """Run work the reply does not depend on after the response is sent, or right away
    when there is no BackgroundTasks (e.g. in tests)."""
    if background is not None:
        background.add_task(_with_own_session, fn, **kwargs)
    else:
        fn(db, **kwargs)


# ── Notifications ─────────────────────────────────────────────────────────────

def notification_text(thread: ReportThread, sender_role: str, is_new: bool) -> str:
    """What the other side is told. It never includes the message itself."""
    filename = thread.report.original_filename if thread.report else "a report"
    if sender_role == "doctor":
        name = thread.doctor.user.full_name if thread.doctor and thread.doctor.user else "Your doctor"
        verb = "asked a question about" if is_new else "replied about"
        return f"Dr. {name} {verb} {filename}."
    name = thread.patient.user.full_name if thread.patient and thread.patient.user else "Your patient"
    verb = "asked you a question about" if is_new else "replied about"
    return f"{name} {verb} {filename}."


def notification_link(thread: ReportThread, recipient_role: str) -> str:
    if recipient_role == "patient":
        return f"/patient/reports/{thread.report_id}#questions"
    return f"/doctor/patients/{thread.patient_id}/reports/{thread.report_id}/view#questions"


def _prepare_notification(thread: ReportThread, sender: Viewer, is_new: bool) -> dict:
    """Work out the other side's notification before committing, and record the email
    (at most one per side per thread a day, so a busy conversation doesn't flood the
    inbox; every message still gets an in-app notification)."""
    recipient_role = "doctor" if sender.is_patient else "patient"
    recipient_user_id = thread.doctor.user_id if recipient_role == "doctor" else thread.patient.user_id
    now = datetime.utcnow()
    field = f"{recipient_role}_last_emailed_at"
    last_emailed = getattr(thread, field)
    send_email = last_emailed is None or now - last_emailed >= EMAIL_INTERVAL
    if send_email:
        setattr(thread, field, now)
    return {
        "recipient_id": recipient_user_id,
        "notification_type": "report_question" if is_new else "report_reply",
        "message": notification_text(thread, sender.role, is_new),
        "link": notification_link(thread, recipient_role),
        "send_email": send_email,
    }


def _send_notification(db: Session, **notification) -> None:
    try:
        create_notification(db, **notification)
    except Exception:
        logger.exception("Could not send a report thread notification")
