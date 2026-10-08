import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import center_verification_service as cv

NEXT_YEAR = date.today() + timedelta(days=365)
YESTERDAY = date.today() - timedelta(days=1)


def _center(approved=False, regulator="PHC", email="admin@shifa.com.pk", rejection=None, expires=NEXT_YEAR):
    return SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name="Shifa International", license_number="PHC-123",
        address="Islamabad", regulator=regulator, license_expires_at=expires, verification_note=None,
        is_approved=approved, approved_by=None, approved_at=None, rejection_reason=rejection,
        user=SimpleNamespace(email=email),
    )


def _db(first=None, all_=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = first
    db.query.return_value.filter.return_value.all.return_value = all_ or []
    return db


@pytest.fixture
def sent(monkeypatch):
    record = {"center": [], "admins": []}
    monkeypatch.setattr(cv, "create_notification",
                        lambda db, user_id, kind, message, link=None: record["center"].append((kind, message)))
    monkeypatch.setattr(cv, "notify_admins",
                        lambda db, kind, message, link=None: record["admins"].append((kind, message)))
    return record


class TestApprove:
    def test_approval_records_the_checked_expiry_and_note(self):
        center = _center()
        cv.approve(center, uuid.uuid4(), NEXT_YEAR, " PHC portal - name and address match ", _db())
        assert center.is_approved is True
        assert center.license_expires_at == NEXT_YEAR
        assert center.verification_note == "PHC portal - name and address match"

    def test_approval_needs_a_note(self):
        with pytest.raises(HTTPException) as exc:
            cv.approve(_center(), uuid.uuid4(), NEXT_YEAR, "  ", _db())
        assert exc.value.status_code == 400

    def test_approval_needs_a_current_licence(self):
        with pytest.raises(HTTPException):
            cv.approve(_center(), uuid.uuid4(), YESTERDAY, "Checked", _db())
        with pytest.raises(HTTPException):
            cv.approve(_center(), uuid.uuid4(), None, "Checked", _db())

    def test_center_without_a_regulator_cannot_be_approved(self):
        with pytest.raises(HTTPException) as exc:
            cv.approve(_center(regulator=None), uuid.uuid4(), NEXT_YEAR, "Checked", _db())
        assert "regulator" in exc.value.detail

    def test_rejection_reason_is_cleared_on_approval(self):
        center = _center(rejection="Wrong licence number")
        cv.approve(center, uuid.uuid4(), NEXT_YEAR, "Checked", _db())
        assert center.rejection_reason is None


class TestResubmit:
    def test_rejected_center_goes_back_for_review(self, sent):
        center = _center(rejection="Licence not found on the register")
        cv.resubmit(center, "SHCC", " SHCC-9 ", NEXT_YEAR, " Karachi ", _db(first=None))
        assert center.rejection_reason is None
        assert (center.regulator, center.license_number, center.address) == ("SHCC", "SHCC-9", "Karachi")
        assert cv.center_status(center) == "pending"
        assert sent["admins"][0][0] == "medical_center_registered"

    def test_licence_number_of_another_center_is_refused(self, sent):
        with pytest.raises(HTTPException):
            cv.resubmit(_center(), "PHC", "PHC-999", NEXT_YEAR, "Lahore", _db(first=_center()))

    def test_unknown_regulator_and_expired_licence_are_refused(self, sent):
        with pytest.raises(HTTPException):
            cv.resubmit(_center(), "XYZ", "1", NEXT_YEAR, "Lahore", _db())
        with pytest.raises(HTTPException):
            cv.resubmit(_center(), "PHC", "1", YESTERDAY, "Lahore", _db())

    def test_approved_center_cannot_resubmit(self, sent):
        with pytest.raises(HTTPException):
            cv.resubmit(_center(approved=True), "PHC", "1", NEXT_YEAR, "Lahore", _db())


class TestSummaries:
    def test_free_email_is_flagged_for_the_admin(self):
        assert cv.admin_summary(_center(email="shifa.hospital@gmail.com"))["free_email"] is True
        summary = cv.admin_summary(_center())
        assert summary["free_email"] is False
        assert summary["email_domain"] == "shifa.com.pk"
        assert summary["regulator_url"] == "https://os.phc.org.pk/verify.aspx"

    def test_labels(self):
        assert cv.licence_label(_center(approved=True)) == "Licensed by PHC · verified by MedLock"
        assert cv.licence_label(_center(approved=True, regulator=None)) == "Approved before licence checks"
        assert cv.licence_label(_center()) is None

    def test_status(self):
        assert cv.center_status(_center()) == "pending"
        assert cv.center_status(_center(rejection="No")) == "rejected"
        assert cv.center_status(_center(approved=True)) == "approved"


class TestLapse:
    def test_expired_licence_withdraws_approval(self, sent):
        center = _center(approved=True, expires=YESTERDAY)
        assert cv.expire_lapsed_center_licences(_db(all_=[center])) == 1
        assert center.is_approved is False
        assert "expired" in center.rejection_reason
        assert cv.center_status(center) == "rejected"
        assert sent["center"][0][0] == "medical_center_licence_expired"


def test_registration_refuses_an_expired_licence():
    with pytest.raises(HTTPException):
        cv.check_licence_expiry(YESTERDAY)
    cv.check_licence_expiry(NEXT_YEAR)
