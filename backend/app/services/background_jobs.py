"""Periodic maintenance run inside the API process: blockchain retries/confirmations
and cleanup of expired revoked tokens."""
import asyncio
import logging
from datetime import datetime, timezone

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models.revoked_token import RevokedToken
from app.services.blockchain_service import confirm_pending_logs, retry_pending_logs

logger = logging.getLogger(__name__)


def purge_expired_revoked_tokens(db) -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    deleted = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()
    return deleted


JOBS = (
    ("retry pending blockchain logs", retry_pending_logs),
    ("confirm pending blockchain logs", confirm_pending_logs),
    ("purge expired revoked tokens", purge_expired_revoked_tokens),
)


def run_jobs_once() -> None:
    """Run every job with its own session; one failing job never stops the others."""
    for name, job in JOBS:
        db = SessionLocal()
        try:
            job(db)
        except Exception:
            db.rollback()
            logger.exception("Background job failed: %s", name)
        finally:
            db.close()


async def run_forever() -> None:
    while True:
        await run_in_threadpool(run_jobs_once)
        await asyncio.sleep(settings.BACKGROUND_JOBS_INTERVAL_SECONDS)
