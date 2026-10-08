import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.access_request_service import check_doctor_has_access


def _db(report, access):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [report, access]
    return db


def _report(approved=True):
    return SimpleNamespace(id=uuid.uuid4(), patient_id=uuid.uuid4(), is_approved=approved)


def _access():
    return SimpleNamespace(status="approved", expires_at=datetime.utcnow() + timedelta(days=7))


doctor = SimpleNamespace(id=uuid.uuid4())


def test_doctor_with_approved_access_can_open_report():
    report = _report()
    assert check_doctor_has_access(doctor, report.id, _db(report, _access())) is True


def test_unapproved_medical_center_upload_is_hidden_from_doctor():
    report = _report(approved=False)
    assert check_doctor_has_access(doctor, report.id, _db(report, _access())) is False


def test_no_access_request_means_no_access():
    report = _report()
    assert check_doctor_has_access(doctor, report.id, _db(report, None)) is False


def test_expired_access_is_refused_and_shown_as_expired():
    from app.services.access_request_service import display_status
    report = _report()
    access = SimpleNamespace(status="approved", expires_at=datetime.utcnow() - timedelta(minutes=1))
    assert check_doctor_has_access(doctor, report.id, _db(report, access)) is False
    # Expiry is not recorded as a revocation by the patient.
    assert access.status == "approved"
    assert display_status(access) == "expired"


def test_current_and_other_statuses_are_shown_as_stored():
    from app.services.access_request_service import display_status
    assert display_status(_access()) == "approved"
    for status in ("pending", "denied", "revoked"):
        assert display_status(SimpleNamespace(status=status, expires_at=None)) == status
