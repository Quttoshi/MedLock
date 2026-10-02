"""Periodic maintenance run inside the API process: blockchain retries/confirmations
and cleanup of expired revoked tokens."""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.exc import OperationalError
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models.revoked_token import RevokedToken
from app.services.blockchain_service import confirm_pending_logs, retry_pending_logs
from app.services.doctor_verification_service import expire_lapsed_licenses
from app.services.imaging_service import backfill_slice_stacks, process_pending_studies

logger = logging.getLogger(__name__)


def purge_expired_revoked_tokens(db) -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    deleted = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()
    return deleted


JOBS = (
    # Imaging first: a processed study queues its blockchain log for the jobs below.
    ("process pending imaging studies", process_pending_studies),
    ("render viewer slices for older imaging studies", backfill_slice_stacks),
    ("retry pending blockchain logs", retry_pending_logs),
    ("confirm pending blockchain logs", confirm_pending_logs),
    ("purge expired revoked tokens", purge_expired_revoked_tokens),
    ("remove verification from doctors with expired licenses", expire_lapsed_licenses),
)


def run_jobs_once() -> None:
    """Run every job with its own session; one failing job never stops the others.
    If the database itself is unreachable, skip this round with a one-line warning."""
    for name, job in JOBS:
        db = SessionLocal()
        try:
            job(db)
        except OperationalError as exc:
            db.rollback()
            reason = str(exc.orig).strip().splitlines()[0] if exc.orig else str(exc)
            logger.warning("Database unreachable, skipping background jobs this round (%s)", reason)
            return
        except Exception:
            db.rollback()
            logger.exception("Background job failed: %s", name)
        finally:
            db.close()


async def run_forever() -> None:
    while True:
        await run_in_threadpool(run_jobs_once)
        await asyncio.sleep(settings.BACKGROUND_JOBS_INTERVAL_SECONDS)
