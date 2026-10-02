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
from app.schemas.auth import LoginRequest
from app.services import auth_service, email_verification_service as ev, notification_service


def _user(verified=False, email="pat@example.com"):
    return SimpleNamespace(
        id=uuid.uuid4(), email=email, full_name="Pat", role="patient",
        password_hash=auth_service._hash_password("CorrectPass1!"),
        email_verified_at=datetime(2026, 1, 1) if verified else None,
    )


def _db_returning(user):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    return db


@pytest.fixture(autouse=True)
def reset_resend_state():
    ev._last_resend.clear()
    yield
    ev._last_resend.clear()


class TestVerificationToken:
    def test_valid_link_confirms_the_account(self):
        user = _user()
        db = _db_returning(user)
        ev.verify_email_token(ev.create_verification_token(user), db)
        assert user.email_verified_at is not None
        db.commit.assert_called_once()

    def test_already_confirmed_account_is_left_unchanged(self):
        user = _user(verified=True)
        original = user.email_verified_at
        ev.verify_email_token(ev.create_verification_token(user), _db_returning(user))
        assert user.email_verified_at == original

    def test_expired_link_is_rejected(self):
        user = _user()
        token = jwt.encode(
            {"sub": str(user.id), "email": user.email, "purpose": ev.EMAIL_VERIFY_PURPOSE,
             "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
            settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
        )
        with pytest.raises(HTTPException) as exc:
            ev.verify_email_token(token, _db_returning(user))
        assert exc.value.status_code == 400

    def test_login_token_cannot_confirm_an_email(self):
        user = _user()
        access_token = jwt_dep.create_access_token({"sub": str(user.id), "role": user.role})
        with pytest.raises(HTTPException):
            ev.verify_email_token(access_token, _db_returning(user))
        assert user.email_verified_at is None

    def test_link_stops_working_if_email_changed(self):
        user = _user()
        token = ev.create_verification_token(user)
        user.email = "new@example.com"
        with pytest.raises(HTTPException):
            ev.verify_email_token(token, _db_returning(user))

    def test_tampered_link_is_rejected(self):
        with pytest.raises(HTTPException):
            ev.verify_email_token("not.a.token", _db_returning(_user()))


class TestConfirmationLinkCannotLogIn:
    def test_confirmation_token_is_refused_as_api_credentials(self):
        user = _user()
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=ev.create_verification_token(user))
        with pytest.raises(HTTPException) as exc:
            jwt_dep.get_current_user(creds, _db_returning(user))
        assert exc.value.status_code == 401


class TestLogin:
    def _login(self, user):
        return auth_service.login_user(LoginRequest(email=user.email, password="CorrectPass1!"), _db_returning(user))

    def test_unconfirmed_account_cannot_log_in(self):
        with pytest.raises(HTTPException) as exc:
            self._login(_user())
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "email_not_verified"

    def test_confirmed_account_logs_in(self):
        assert self._login(_user(verified=True))["access_token"]

    def test_unconfirmed_account_logs_in_when_verification_disabled(self, monkeypatch):
        monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", False)
        assert self._login(_user())["access_token"]

    def test_wrong_password_still_reported_before_verification(self):
        user = _user()
        with pytest.raises(HTTPException) as exc:
            auth_service.login_user(LoginRequest(email=user.email, password="wrong"), _db_returning(user))
        assert exc.value.status_code == 401


class TestResend:
    def test_unconfirmed_account_gets_a_new_email(self, monkeypatch):
        sent = MagicMock()
        monkeypatch.setattr(ev, "send_verification_email", sent)
        user = _user()
        ev.resend_verification_email(user.email, _db_returning(user))
        sent.assert_called_once_with(user)

    def test_confirmed_or_unknown_accounts_get_nothing(self, monkeypatch):
        sent = MagicMock()
        monkeypatch.setattr(ev, "send_verification_email", sent)
        ev.resend_verification_email("a@example.com", _db_returning(_user(verified=True)))
        ev.resend_verification_email("b@example.com", _db_returning(None))
        sent.assert_not_called()

    def test_repeat_request_within_cooldown_is_refused(self, monkeypatch):
        monkeypatch.setattr(ev, "send_verification_email", MagicMock())
        user = _user()
        ev.resend_verification_email(user.email, _db_returning(user))
        with pytest.raises(HTTPException) as exc:
            ev.resend_verification_email(user.email, _db_returning(user))
        assert exc.value.status_code == 429


class TestVerificationEmail:
    def test_email_contains_link_to_frontend_with_token(self, monkeypatch):
        sent = MagicMock()
        monkeypatch.setattr(ev, "send_email_async", sent)
        user = _user()
        ev.send_verification_email(user)
        to, subject, text, html = sent.call_args.args
        assert to == user.email
        assert f"{settings.FRONTEND_URL}/verify-email?token=" in text
        assert f"{settings.FRONTEND_URL}/verify-email?token=" in html


class TestNotificationEmailsOnlyToConfirmedAddresses:
    def _notify(self, user, monkeypatch):
        sent = MagicMock()
        monkeypatch.setattr(notification_service, "send_email_async", sent)
        notification_service.create_notification(_db_returning(user), user.id, "access_request", "msg")
        return sent

    def test_unconfirmed_address_is_not_emailed(self, monkeypatch):
        assert not self._notify(_user(), monkeypatch).called

    def test_confirmed_address_is_emailed(self, monkeypatch):
        assert self._notify(_user(verified=True), monkeypatch).called

    def test_everyone_emailed_when_verification_disabled(self, monkeypatch):
        monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", False)
        assert self._notify(_user(), monkeypatch).called
