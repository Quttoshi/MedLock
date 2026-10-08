import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.rbac import require_role
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.thread import PostMessageRequest, StartThreadRequest
from app.services import thread_service as threads

router = APIRouter(tags=["Report threads"])

# Sending is limited per client and URL (i.e. per thread, or per report when starting
# one) so a stuck button or script cannot flood a conversation.
SEND_LIMIT = "20/minute"

participant = require_role(["patient", "doctor"])


@router.get("/reports/{report_id}/threads")
def list_report_threads(
    report_id: uuid.UUID,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    """Patient: every thread on the report and the doctors they can ask.
    Doctor: their own thread on the report, if there is one."""
    return threads.list_threads(report_id, threads.get_viewer(current_user, db), db)


@router.post("/reports/{report_id}/threads", status_code=201)
@limiter.limit(SEND_LIMIT)
def start_report_thread(
    request: Request,
    report_id: uuid.UUID,
    body: StartThreadRequest,
    background: BackgroundTasks,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    """Start a thread with a first message, or add to the existing one."""
    viewer = threads.get_viewer(current_user, db)
    return threads.start_thread(report_id, viewer, body.body, body.doctor_id, db, request, background)


@router.get("/threads/unread")
def unread_threads(
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    """Unread threads per report id, for the badges on report lists."""
    return threads.unread_counts(threads.get_viewer(current_user, db), db)


@router.get("/threads/{thread_id}/messages")
def thread_messages(
    thread_id: uuid.UUID,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    """The thread's messages; opening them marks the thread as read."""
    return threads.get_messages(thread_id, threads.get_viewer(current_user, db), db)


@router.post("/threads/{thread_id}/messages", status_code=201)
@limiter.limit(SEND_LIMIT)
def reply_to_thread(
    request: Request,
    thread_id: uuid.UUID,
    body: PostMessageRequest,
    background: BackgroundTasks,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    viewer = threads.get_viewer(current_user, db)
    return threads.post_message(thread_id, viewer, body.body, db, request, background)


@router.patch("/threads/{thread_id}/resolve")
def resolve_thread(
    thread_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    return threads.set_resolved(thread_id, threads.get_viewer(current_user, db), True, db, request, background)


@router.patch("/threads/{thread_id}/reopen")
def reopen_thread(
    thread_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    current_user: User = Depends(participant),
    db: Session = Depends(get_db),
):
    return threads.set_resolved(thread_id, threads.get_viewer(current_user, db), False, db, request, background)
