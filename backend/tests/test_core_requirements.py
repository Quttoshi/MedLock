import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.config import settings
from app.dependencies import jwt as jwt_dep
from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.routers import medical_center as mc_router
from app.services import background_jobs, notification_service


# ── Notifications and email ──────────────────────────────────────────────────

class TestNotifications:
    def test_notify_admins_notifies_every_admin(self, monkeypatch):
        admins = [SimpleNamespace(id=uuid.uuid4()), SimpleNamespace(id=uuid.uuid4())]
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = admins
        sent = MagicMock()
        monkeypatch.setattr(notification_service, "create_notification", sent)

        notification_service.notify_admins(db, "blockchain_failed", "msg")

        assert [c.args[1] for c in sent.call_args_list] == [a.id for a in admins]

    def test_email_skipped_when_mail_not_configured(self, monkeypatch):
        started = MagicMock()
        monkeypatch.setattr(notification_service.threading, "Thread", started)
        notification_service.send_email_async("a@b.com", "subject", "body")
        started.assert_not_called()

    def test_send_email_uses_starttls_and_login(self, monkeypatch):
        monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.example.com")
        monkeypatch.setattr(settings, "MAIL_FROM", "medlock@example.com")
        monkeypatch.setattr(settings, "MAIL_USERNAME", "user")
        monkeypatch.setattr(settings, "MAIL_PASSWORD", "pass")
        monkeypatch.setattr(settings, "MAIL_PORT", 587)
        smtp = MagicMock()
        monkeypatch.setattr(notification_service.smtplib, "SMTP", MagicMock(return_value=smtp))

        assert notification_service.send_email("a@b.com", "subject", "body") is True
        smtp.starttls.assert_called_once()
        smtp.login.assert_called_once_with("user", "pass")
        sent = smtp.send_message.call_args.args[0]
        assert sent["To"] == "a@b.com"

    def test_send_email_failure_is_swallowed(self, monkeypatch):
        monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.example.com")
        monkeypatch.setattr(settings, "MAIL_FROM", "medlock@example.com")
        monkeypatch.setattr(notification_service.smtplib, "SMTP", MagicMock(side_effect=OSError("refused")))
        assert notification_service.send_email("a@b.com", "subject", "body") is False


# ── Logout invalidates the token ─────────────────────────────────────────────

def _db_for_auth(revoked: bool, user=None):
    def query(model):
        q = MagicMock()
        if model is RevokedToken:
            q.filter.return_value.first.return_value = RevokedToken(jti="x") if revoked else None
        elif model is User:
            q.filter.return_value.first.return_value = user
        return q
    db = MagicMock()
    db.query.side_effect = query
    return db


def _creds(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class TestTokenRevocation:
    def test_tokens_carry_a_unique_id(self):
        first = jwt.get_unverified_claims(jwt_dep.create_access_token({"sub": "u1"}))
        second = jwt.get_unverified_claims(jwt_dep.create_access_token({"sub": "u1"}))
        assert first["jti"] and first["jti"] != second["jti"]

    def test_valid_token_is_accepted(self):
        user = SimpleNamespace(id="u1")
        token = jwt_dep.create_access_token({"sub": "u1"})
        assert jwt_dep.get_current_user(_creds(token), _db_for_auth(revoked=False, user=user)) is user

    def test_revoked_token_is_rejected(self):
        token = jwt_dep.create_access_token({"sub": "u1"})
        with pytest.raises(HTTPException) as exc:
            jwt_dep.get_current_user(_creds(token), _db_for_auth(revoked=True, user=SimpleNamespace(id="u1")))
        assert exc.value.status_code == 401

    def test_revoke_token_stores_jti_until_expiry(self):
        token = jwt_dep.create_access_token({"sub": "u1"})
        claims = jwt.get_unverified_claims(token)
        db = _db_for_auth(revoked=False)

        jwt_dep.revoke_token(token, db)

        stored = db.add.call_args.args[0]
        assert stored.jti == claims["jti"]
        assert stored.expires_at == datetime.fromtimestamp(claims["exp"], tz=timezone.utc).replace(tzinfo=None)

    def test_revoke_ignores_invalid_token(self):
        db = MagicMock()
        jwt_dep.revoke_token("not-a-token", db)
        db.add.assert_not_called()


# ── Doctor verification by medical center ────────────────────────────────────

@pytest.fixture
def affiliation(monkeypatch):
    doctor = SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), license_number="PMDC-12345",
        is_verified=False, medical_center_id=None, user=SimpleNamespace(full_name="Dr. Test"),
    )
    req = SimpleNamespace(id=uuid.uuid4(), status="pending", doctor=doctor, decided_at=None, rejection_reason=None)
    mc = SimpleNamespace(id=uuid.uuid4(), name="City Lab")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = req
    notify = MagicMock()
    monkeypatch.setattr(mc_router, "_get_mc", lambda user, db: mc)
    monkeypatch.setattr(mc_router, "log_action", MagicMock())
    monkeypatch.setattr(mc_router, "create_notification", notify)
    return SimpleNamespace(req=req, doctor=doctor, mc=mc, db=db, notify=notify)


class TestAffiliationVerification:
    def _approve(self, a, license_number):
        return mc_router.approve_affiliation(
            str(a.req.id), {"license_number": license_number}, None, SimpleNamespace(id=uuid.uuid4()), a.db,
        )

    def test_matching_license_verifies_and_links_doctor(self, affiliation):
        result = self._approve(affiliation, " pmdc-12345 ")
        assert result["is_verified"] is True
        assert affiliation.doctor.is_verified is True
        assert affiliation.doctor.medical_center_id == affiliation.mc.id
        assert affiliation.notify.call_args.args[2] == "affiliation_approved"

    def test_wrong_license_is_rejected_and_doctor_stays_unverified(self, affiliation):
        with pytest.raises(HTTPException) as exc:
            self._approve(affiliation, "PMDC-99999")
        assert exc.value.status_code == 400
        assert affiliation.doctor.is_verified is False
        assert affiliation.req.status == "pending"

    def test_missing_license_is_rejected(self, affiliation):
        with pytest.raises(HTTPException) as exc:
            self._approve(affiliation, "  ")
        assert exc.value.status_code == 400

    def test_rejection_notifies_doctor_with_reason(self, affiliation):
        mc_router.reject_affiliation(
            str(affiliation.req.id), {"reason": "Not on staff"}, None, SimpleNamespace(id=uuid.uuid4()), affiliation.db,
        )
        assert affiliation.req.status == "rejected"
        assert affiliation.notify.call_args.args[2] == "affiliation_rejected"
        assert "Not on staff" in affiliation.notify.call_args.args[3]


# ── Background jobs ──────────────────────────────────────────────────────────

class TestBackgroundJobs:
    def test_one_failing_job_does_not_stop_the_others(self, monkeypatch):
        ran = []

        def broken(db):
            raise RuntimeError("boom")

        monkeypatch.setattr(background_jobs, "SessionLocal", MagicMock())
        monkeypatch.setattr(background_jobs, "JOBS", (
            ("broken", broken),
            ("healthy", lambda db: ran.append("healthy")),
        ))
        background_jobs.run_jobs_once()
        assert ran == ["healthy"]

    def test_purge_deletes_only_expired_tokens(self):
        db = MagicMock()
        background_jobs.purge_expired_revoked_tokens(db)
        db.query.assert_called_once_with(RevokedToken)
        db.commit.assert_called_once()
