import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.services import access_request_service as svc


def _db(existing):
    """db.query(Model).filter(...).first() returns a fixture per model."""
    doctor = SimpleNamespace(id=uuid.uuid4())
    patient_user = SimpleNamespace(id=uuid.uuid4(), full_name="Pat", email="pat@example.com")
    patient = SimpleNamespace(id=uuid.uuid4())
    results = {Doctor: doctor, User: patient_user, Patient: patient, AccessRequest: existing}

    def query(model):
        q = MagicMock()
        q.filter.return_value.first.return_value = results[model]
        return q

    db = MagicMock()
    db.query.side_effect = query
    return db


def _request(status, expires_at=None):
    return SimpleNamespace(
        id=uuid.uuid4(), status=status, reason="old reason",
        requested_at=datetime(2026, 1, 1), decided_at=datetime(2026, 1, 2), expires_at=expires_at,
    )


@pytest.fixture(autouse=True)
def no_notifications(monkeypatch):
    monkeypatch.setattr(svc, "create_notification", MagicMock())


def _submit(db):
    data = SimpleNamespace(patient_email="pat@example.com", reason="follow-up")
    return svc.create_access_request_by_email(data, SimpleNamespace(id=uuid.uuid4(), full_name="Doc"), db)


@pytest.mark.parametrize("previous", ["denied", "revoked"])
def test_previous_closed_request_is_reopened_not_duplicated(previous):
    existing = _request(previous)
    db = _db(existing)
    result = _submit(db)
    assert result["status"] == "pending"
    assert existing.status == "pending"
    assert existing.reason == "follow-up"
    assert existing.decided_at is None and existing.expires_at is None
    db.add.assert_not_called()  # no second row, so no unique-constraint violation


def test_expired_approval_is_reopened():
    existing = _request("approved", expires_at=datetime.utcnow() - timedelta(days=1))
    result = _submit(_db(existing))
    assert result["status"] == "pending"


@pytest.mark.parametrize("current", ["pending", "approved"])
def test_open_request_still_conflicts(current):
    expires = datetime.utcnow() + timedelta(days=5) if current == "approved" else None
    with pytest.raises(HTTPException) as exc:
        _submit(_db(_request(current, expires_at=expires)))
    assert exc.value.status_code == 409


def test_first_request_creates_a_row():
    db = _db(None)
    assert _submit(db)["status"] == "pending"
    db.add.assert_called_once()
