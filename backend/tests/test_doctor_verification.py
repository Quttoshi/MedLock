import io
import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import doctor_verification_service as dv

FUTURE = date.today() + timedelta(days=365)
PAST = date.today() - timedelta(days=1)


def _doctor(verified=False, license_number="PMDC-12345-N", medical_center=None):
    return SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), license_number=license_number, specialization="Cardiology",
        is_verified=verified, verification_method=None, verified_by_user_id=None, verified_at=None,
        license_expires_at=None, verification_note=None, medical_center=medical_center,
        medical_center_id=getattr(medical_center, "id", None), user=SimpleNamespace(full_name="Dr. Test"),
        verification_requests=[],
    )


def _db(first=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = first
    return db


@pytest.fixture
def notifications(monkeypatch):
    sent = {"doctor": [], "admins": []}
    monkeypatch.setattr(dv, "create_notification", lambda db, user, kind, msg, link=None: sent["doctor"].append((kind, link)))
    monkeypatch.setattr(dv, "notify_admins", lambda db, kind, msg, link=None: sent["admins"].append((kind, link)))
    return sent


class TestLabels:
    def test_unverified(self):
        assert dv.verification_label(_doctor()) == "Not verified"

    def test_verified_by_medical_center_names_it(self):
        doctor = _doctor(verified=True, medical_center=SimpleNamespace(id=uuid.uuid4(), name="Shifa International"))
        doctor.verification_method = "medical_center"
        assert dv.verification_label(doctor) == "Verified by Shifa International"

    def test_verified_by_admin_mentions_pmdc(self):
        doctor = _doctor(verified=True)
        doctor.verification_method = "admin"
        assert dv.verification_label(doctor) == "License verified via PMDC by MedLock"


class TestSubmitRequest:
    def test_valid_request_is_created_and_admins_notified(self, notifications):
        req = dv.submit_request(_doctor(), " pmdc-12345-n ", FUTURE, None, _db())
        assert req.status == "pending"
        assert notifications["admins"] == [("doctor_verification_requested", "/admin/doctors")]

    def test_registration_number_must_match_the_registered_license(self, notifications):
        with pytest.raises(HTTPException) as exc:
            dv.submit_request(_doctor(), "PMDC-99999-N", FUTURE, None, _db())
        assert exc.value.status_code == 400

    def test_already_verified_doctor_cannot_request(self, notifications):
        with pytest.raises(HTTPException):
            dv.submit_request(_doctor(verified=True), "PMDC-12345-N", FUTURE, None, _db())

    def test_second_pending_request_is_rejected(self, notifications):
        with pytest.raises(HTTPException) as exc:
            dv.submit_request(_doctor(), "PMDC-12345-N", FUTURE, None, _db(first=SimpleNamespace(status="pending")))
        assert exc.value.status_code == 409

    def test_expired_license_is_rejected(self, notifications):
        with pytest.raises(HTTPException):
            dv.submit_request(_doctor(), "PMDC-12345-N", PAST, None, _db())

    def test_certificate_is_encrypted_before_storage(self, notifications, monkeypatch):
        stored = {}
        monkeypatch.setattr(dv, "upload_file", lambda data, path: stored.__setitem__(path, data))
        cert = SimpleNamespace(filename="pmdc.pdf", content_type="application/pdf", file=io.BytesIO(b"%PDF-1.4 cert"))
        req = dv.submit_request(_doctor(), "PMDC-12345-N", FUTURE, cert, _db())
        assert req.certificate_path in stored
        assert b"%PDF" not in stored[req.certificate_path]

    def test_certificate_type_is_checked(self, notifications):
        cert = SimpleNamespace(filename="x.exe", content_type="application/x-msdownload", file=io.BytesIO(b"MZ"))
        with pytest.raises(HTTPException):
            dv.submit_request(_doctor(), "PMDC-12345-N", FUTURE, cert, _db())


class TestReview:
    def _pending(self):
        doctor = _doctor()
        req = SimpleNamespace(
            id=uuid.uuid4(), status="pending", doctor=doctor, doctor_id=doctor.id, registration_number="PMDC-12345-N",
            license_expires_at=None, reviewed_by_user_id=None, reviewed_at=None, admin_note=None,
        )
        return req, doctor

    def test_approve_verifies_doctor_with_expiry_and_notifies(self, notifications):
        req, doctor = self._pending()
        admin = SimpleNamespace(id=uuid.uuid4())
        dv.approve_request(str(req.id), admin, FUTURE, "Checked on pmdc.pk", _db(first=req))
        assert req.status == "approved"
        assert doctor.is_verified and doctor.verification_method == "admin"
        assert doctor.license_expires_at == FUTURE and doctor.verified_by_user_id == admin.id
        assert notifications["doctor"] == [("doctor_verification_approved", "/doctor/affiliation")]

    def test_approve_requires_expiry_from_register(self, notifications):
        req, _ = self._pending()
        with pytest.raises(HTTPException):
            dv.approve_request(str(req.id), SimpleNamespace(id=uuid.uuid4()), None, None, _db(first=req))

    def test_reject_requires_reason_and_notifies(self, notifications):
        req, doctor = self._pending()
        with pytest.raises(HTTPException):
            dv.reject_request(str(req.id), SimpleNamespace(id=uuid.uuid4()), "  ", _db(first=req))
        dv.reject_request(str(req.id), SimpleNamespace(id=uuid.uuid4()), "Number not on register", _db(first=req))
        assert req.status == "rejected" and not doctor.is_verified
        assert notifications["doctor"][-1][0] == "doctor_verification_rejected"

    def test_hospital_verification_closes_pending_request(self, notifications):
        req, doctor = self._pending()
        doctor.verification_requests = [req]
        dv.mark_verified(doctor, "medical_center", SimpleNamespace(id=uuid.uuid4()), "License checked by hospital1")
        assert req.status == "closed" and "verified before" in req.admin_note

    def test_request_for_already_verified_doctor_cannot_be_approved(self, notifications):
        req, doctor = self._pending()
        doctor.is_verified, doctor.verification_method = True, "admin"
        with pytest.raises(HTTPException) as exc:
            dv.approve_request(str(req.id), SimpleNamespace(id=uuid.uuid4()), FUTURE, None, _db(first=req))
        assert "already verified" in exc.value.detail

    def test_already_reviewed_request_cannot_be_reviewed_again(self, notifications):
        req, _ = self._pending()
        req.status = "approved"
        with pytest.raises(HTTPException):
            dv.reject_request(str(req.id), SimpleNamespace(id=uuid.uuid4()), "reason", _db(first=req))


class TestAdminOverride:
    def test_verify_requires_reason(self, notifications):
        with pytest.raises(HTTPException):
            dv.admin_verify(_doctor(), SimpleNamespace(id=uuid.uuid4()), "", None, MagicMock())

    def test_verify_and_revoke_notify_the_doctor(self, notifications):
        doctor = _doctor()
        dv.admin_verify(doctor, SimpleNamespace(id=uuid.uuid4()), "Independent GP, checked register", FUTURE, MagicMock())
        assert doctor.is_verified and doctor.verification_method == "admin"
        dv.admin_revoke(doctor, "License suspended", MagicMock())
        assert not doctor.is_verified and doctor.verification_method is None
        assert [kind for kind, _ in notifications["doctor"]] == ["doctor_verification_approved", "doctor_verification_revoked"]


class TestExpiry:
    def test_lapsed_license_removes_verification(self, notifications):
        doctor = _doctor(verified=True)
        doctor.verification_method, doctor.license_expires_at = "admin", PAST
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [doctor]
        assert dv.expire_lapsed_licenses(db) == 1
        assert not doctor.is_verified
        assert "expired" in doctor.verification_note
        assert notifications["doctor"] == [("doctor_verification_revoked", "/doctor/affiliation")]
