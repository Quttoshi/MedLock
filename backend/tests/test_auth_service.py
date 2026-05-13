import pytest
from fastapi import HTTPException
from app.services.auth_service import (
    _hash_password,
    _verify_password,
    _check_lockout,
    _record_failed_attempt,
    _clear_failed_attempts,
    MAX_ATTEMPTS,
    LOCKOUT_MINUTES,
)
from app.services import auth_service


class TestPasswordHashing:
    def test_hash_returns_string(self):
        result = _hash_password("SecurePass123!")
        assert isinstance(result, str)

    def test_hash_is_not_plaintext(self):
        password = "SecurePass123!"
        assert _hash_password(password) != password

    def test_verify_correct_password(self):
        password = "SecurePass123!"
        hashed = _hash_password(password)
        assert _verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        hashed = _hash_password("CorrectPassword!")
        assert _verify_password("WrongPassword!", hashed) is False

    def test_same_password_produces_different_hashes(self):
        password = "SamePassword!"
        hash1 = _hash_password(password)
        hash2 = _hash_password(password)
        assert hash1 != hash2

    def test_empty_password_hashes(self):
        hashed = _hash_password("")
        assert _verify_password("", hashed) is True

    def test_unicode_password(self):
        password = "Pässöwrd123!"
        hashed = _hash_password(password)
        assert _verify_password(password, hashed) is True


class TestBruteForceProtection:
    def test_no_lockout_initially(self):
        _check_lockout("user@example.com")

    def test_lockout_after_max_attempts(self):
        email = "attacker@example.com"
        for _ in range(MAX_ATTEMPTS):
            _record_failed_attempt(email)
        with pytest.raises(HTTPException) as exc_info:
            _check_lockout(email)
        assert exc_info.value.status_code == 429

    def test_lockout_message_indicates_locked(self):
        email = "attacker2@example.com"
        for _ in range(MAX_ATTEMPTS):
            _record_failed_attempt(email)
        with pytest.raises(HTTPException) as exc_info:
            _check_lockout(email)
        detail = str(exc_info.value.detail).lower()
        assert "lock" in detail or "again" in detail

    def test_below_max_attempts_no_lockout(self):
        email = "user2@example.com"
        for _ in range(MAX_ATTEMPTS - 1):
            _record_failed_attempt(email)
        _check_lockout(email)

    def test_clear_removes_lockout(self):
        email = "user3@example.com"
        for _ in range(MAX_ATTEMPTS):
            _record_failed_attempt(email)
        _clear_failed_attempts(email)
        _check_lockout(email)

    def test_different_emails_tracked_separately(self):
        email_a = "a@example.com"
        email_b = "b@example.com"
        for _ in range(MAX_ATTEMPTS):
            _record_failed_attempt(email_a)
        _check_lockout(email_b)
        with pytest.raises(HTTPException):
            _check_lockout(email_a)

    def test_attempts_stored_in_module_dict(self):
        email = "track@example.com"
        _record_failed_attempt(email)
        _record_failed_attempt(email)
        assert email in auth_service._failed_attempts
        assert auth_service._failed_attempts[email]["count"] == 2
