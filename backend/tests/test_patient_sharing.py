import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import access_request_service as ars

patient_user = SimpleNamespace(id=uuid.uuid4(), full_name="Ayesha Khan")


def _doctor(verified=True):
    return SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), is_verified=verified, specialization="Cardiology",
        verification_method="admin", user=SimpleNamespace(full_name="Ahmed"), affiliations=[],
    )


def _existing(doctor, status, expires_in_days=None):
    expires = datetime.now(timezone.utc) + timedelta(days=expires_in_days) if expires_in_days is not None else None
    return SimpleNamespace(
        id=uuid.uuid4(), doctor_id=doctor.id, patient_id=uuid.uuid4(), status=status, reason="Follow-up",
        initiated_by="doctor", requested_at=datetime(2026, 1, 1), decided_at=None, expires_at=expires,
        doctor=doctor, patient=SimpleNamespace(user=patient_user),
    )


def _db(doctor, existing=None):
    """The patient lookup, the doctor lookup, then the existing request (if any)."""
    db = MagicMock()
    patient = SimpleNamespace(id=uuid.uuid4(), user=patient_user)
    db.query.return_value.filter.return_value.first.side_effect = [patient, doctor, existing]
    return db


@pytest.fixture
def notices(monkeypatch):
    sent = []
    monkeypatch.setattr(ars, "create_notification", lambda db, **kw: sent.append(kw))
    # The response builder reads relationships; keep it simple for these tests.
    monkeypatch.setattr(ars, "_build_response", lambda req: req)
    return sent


def test_sharing_with_a_new_doctor_grants_30_days(notices):
    doctor = _doctor()
    db = _db(doctor)
    req = ars.share_with_doctor(doctor.id, "  Seeing him for chest pain  ", patient_user, db)
    added = db.add.call_args.args[0]
    assert added is req
    assert (req.status, req.initiated_by, req.reason) == ("approved", "patient", "Seeing him for chest pain")
    assert (req.expires_at - req.decided_at).days == ars.ACCESS_EXPIRY_DAYS
    assert notices[0]["notification_type"] == "records_shared"
    assert notices[0]["recipient_id"] == doctor.user_id


def test_unverified_doctors_cannot_be_shared_with(notices):
    doctor = _doctor(verified=False)
    with pytest.raises(HTTPException) as exc:
        ars.share_with_doctor(doctor.id, None, patient_user, _db(doctor))
    assert exc.value.status_code == 400


def test_doctor_who_already_has_access_is_refused(notices):
    doctor = _doctor()
    with pytest.raises(HTTPException) as exc:
        ars.share_with_doctor(doctor.id, None, patient_user, _db(doctor, _existing(doctor, "approved", 10)))
    assert exc.value.status_code == 409


def test_sharing_answers_a_pending_request_from_that_doctor(notices):
    doctor = _doctor()
    existing = _existing(doctor, "pending")
    req = ars.share_with_doctor(doctor.id, "Please check my HbA1c", patient_user, _db(doctor, existing))
    assert req is existing
    assert (req.status, req.initiated_by) == ("approved", "doctor")
    assert "Please check my HbA1c" in req.reason
    assert notices[0]["notification_type"] == "access_approved"


@pytest.mark.parametrize("previous, days", [("revoked", None), ("denied", None), ("approved", -1)])
def test_revoked_denied_or_expired_access_can_be_shared_again(notices, previous, days):
    doctor = _doctor()
    existing = _existing(doctor, previous, days)
    req = ars.share_with_doctor(doctor.id, None, patient_user, _db(doctor, existing))
    assert req is existing
    assert (req.status, req.initiated_by, req.reason) == ("approved", "patient", "")
    assert ars.display_status(req) == "approved"


def test_note_length_is_limited(notices):
    doctor = _doctor()
    with pytest.raises(HTTPException):
        ars.share_with_doctor(doctor.id, "x" * (ars.MAX_SHARE_NOTE_LENGTH + 1), patient_user, _db(doctor))


def test_short_searches_return_nothing():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id=uuid.uuid4())
    assert ars.search_doctors("ah", patient_user, db) == []


def _search_db(doctors, existing=()):
    """A query mock whose join/filter/order_by/limit calls all return the same query, so
    the test does not depend on how the search is built. Records filter calls."""
    q = MagicMock()
    for name in ("join", "filter", "order_by", "limit"):
        getattr(q, name).return_value = q
    q.all.side_effect = [list(doctors), list(existing)]
    q.first.return_value = SimpleNamespace(id=uuid.uuid4())  # the patient
    db = MagicMock()
    db.query.return_value = q
    return db, q


def test_search_results_show_no_contact_details_and_current_access():
    doctor = _doctor()
    doctor.user.email = "ahmed@example.com"
    db, _ = _search_db([doctor], [_existing(doctor, "pending")])
    [result] = ars.search_doctors("Ahmed", patient_user, db)
    assert result["name"] == "Ahmed"
    assert result["access_status"] == "pending"
    assert "email" not in result


def test_hospital_search_lists_its_doctors_without_typing():
    doctor = _doctor()
    doctor.affiliations = [SimpleNamespace(status="active", medical_center=SimpleNamespace(name="Shifa International"))]
    db, q = _search_db([doctor])
    [result] = ars.search_doctors("", patient_user, db, center_id=uuid.uuid4())
    assert result["medical_centers"] == ["Shifa International"]
    # Joined to the doctor's active memberships of that center
    assert q.join.call_count == 2


def test_hospital_search_can_narrow_by_name():
    db, q = _search_db([])
    ars.search_doctors("Fatima", patient_user, db, center_id=uuid.uuid4())
    filters = [str(c.args[0]) for c in q.filter.call_args_list if c.args]
    assert any("full_name" in f for f in filters)
