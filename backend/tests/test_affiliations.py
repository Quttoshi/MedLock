import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import medical_center as mc_router
from app.services import affiliation_service as aff


def _center(name="Shifa International", center_type="hospital"):
    return SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name=name, center_type=center_type, address="Islamabad",
        user=SimpleNamespace(id=uuid.uuid4()),
    )


def _doctor(verified=False, method=None, verified_by_center=None):
    doctor = SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), license_number="PMDC-12345", user=SimpleNamespace(full_name="Ali"),
        is_verified=verified, verification_method=method, verified_at=None, verification_note=None,
        verified_by_user_id=verified_by_center.user_id if verified_by_center else None, verified_by=None,
        affiliations=[], verification_requests=[],
    )
    return doctor


def _join(doctor, center):
    membership = SimpleNamespace(
        id=uuid.uuid4(), doctor=doctor, medical_center=center, status="active",
        ended_at=None, ended_by_user_id=None, end_reason=None,
    )
    doctor.affiliations.append(membership)
    return membership


def _db(first=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = first
    return db


@pytest.fixture
def sent(monkeypatch):
    """Capture notifications and audit entries made while ending affiliations."""
    record = {"notifications": [], "audit": []}
    monkeypatch.setattr(
        aff, "create_notification",
        lambda db, user_id, kind, message, link=None: record["notifications"].append((user_id, kind, message)),
    )
    monkeypatch.setattr(
        aff, "_notify_doctor",
        lambda doctor, kind, message, db: record["notifications"].append((doctor.user_id, kind, message)),
    )
    monkeypatch.setattr(aff, "log_action", lambda db, **kw: record["audit"].append(kw))
    return record


# ── Requesting ────────────────────────────────────────────────────────────────

class TestRequest:
    def test_doctor_can_request_a_second_center(self):
        doctor = _doctor(verified=True, method="medical_center")
        _join(doctor, _center("PIMS"))
        aff.check_can_request(doctor, _center("Evening Clinic", "clinic"), _db(None))

    def test_labs_take_no_doctors(self):
        with pytest.raises(HTTPException) as exc:
            aff.check_can_request(_doctor(), _center("City Lab", "lab"), _db(None))
        assert exc.value.status_code == 400

    def test_existing_membership_with_the_same_center_is_refused(self):
        center = _center()
        doctor = _doctor()
        membership = _join(doctor, center)
        with pytest.raises(HTTPException) as exc:
            aff.check_can_request(doctor, center, _db(membership))
        assert exc.value.status_code == 409

    def test_pending_request_with_the_same_center_is_refused(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [None, SimpleNamespace(status="pending")]
        with pytest.raises(HTTPException) as exc:
            aff.check_can_request(_doctor(), _center(), db)
        assert exc.value.status_code == 409


# ── Approving ─────────────────────────────────────────────────────────────────

@pytest.fixture
def approval(monkeypatch):
    def make(doctor, center):
        req = SimpleNamespace(id=uuid.uuid4(), status="pending", doctor=doctor, decided_at=None, rejection_reason=None)
        db = MagicMock()
        # The request lookup, then the check for an existing active membership.
        db.query.return_value.filter.return_value.first.side_effect = [req, None]
        notify = MagicMock()
        monkeypatch.setattr(mc_router, "_get_mc", lambda user, db: center)
        monkeypatch.setattr(mc_router, "log_action", MagicMock())
        monkeypatch.setattr(mc_router, "create_notification", notify)
        center_user = SimpleNamespace(id=center.user_id)
        mc_router.approve_affiliation(str(req.id), {"license_number": "pmdc-12345"}, None, center_user, db)
        return SimpleNamespace(req=req, notify=notify)
    return make


class TestApprove:
    def test_first_center_verifies_the_doctor(self, approval):
        doctor, center = _doctor(), _center()
        result = approval(doctor, center)
        assert doctor.is_verified is True
        assert doctor.verification_method == "medical_center"
        assert doctor.verified_by_user_id == center.user_id
        assert [a.medical_center_id for a in doctor.affiliations] == [center.id]
        assert "verified your license" in result.notify.call_args.args[3]

    def test_second_center_keeps_the_existing_verification(self, approval):
        admin_user_id = uuid.uuid4()
        doctor = _doctor(verified=True, method="admin")
        doctor.verified_by_user_id = admin_user_id
        result = approval(doctor, _center("Evening Clinic", "clinic"))
        assert doctor.verification_method == "admin"
        assert doctor.verified_by_user_id == admin_user_id
        assert len(doctor.affiliations) == 1
        assert "verified your license" not in result.notify.call_args.args[3]

    def test_lab_cannot_approve_affiliations(self, monkeypatch):
        lab = _center("City Lab", "lab")
        monkeypatch.setattr(mc_router, "_get_mc", lambda user, db: lab)
        with pytest.raises(HTTPException) as exc:
            mc_router.approve_affiliation(str(uuid.uuid4()), {"license_number": "x"}, None, SimpleNamespace(id=lab.user_id), _db())
        assert exc.value.status_code == 400


# ── Leaving and removal ───────────────────────────────────────────────────────

class TestEndAffiliation:
    def test_doctor_leaving_notifies_the_center(self, sent):
        center = _center()
        doctor = _doctor(verified=True, method="admin")
        membership = _join(doctor, center)
        aff.end_affiliation(membership, SimpleNamespace(id=doctor.user_id), None, MagicMock())
        assert membership.status == "ended"
        assert membership.ended_by_user_id == doctor.user_id
        assert sent["notifications"] == [(center.user_id, "affiliation_ended", "Dr. Ali left Shifa International.")]
        assert sent["audit"][0]["action"] == "affiliation_left"

    def test_center_removing_notifies_the_doctor_with_reason(self, sent):
        center = _center()
        doctor = _doctor(verified=True, method="admin")
        membership = _join(doctor, center)
        aff.end_affiliation(membership, SimpleNamespace(id=center.user_id), " No longer on staff ", MagicMock())
        assert membership.end_reason == "No longer on staff"
        assert sent["notifications"][0][:2] == (doctor.user_id, "affiliation_ended")
        assert "No longer on staff" in sent["notifications"][0][2]
        assert sent["audit"][0]["action"] == "affiliation_removed"


class TestLapseRule:
    def test_leaving_the_last_center_ends_center_verification(self, sent):
        center = _center()
        doctor = _doctor(verified=True, method="medical_center", verified_by_center=center)
        membership = _join(doctor, center)
        aff.end_affiliation(membership, SimpleNamespace(id=doctor.user_id), None, MagicMock())
        assert doctor.is_verified is False
        assert doctor.verification_method is None
        assert ("doctor_verification_revoked" in [kind for _, kind, _ in sent["notifications"]])

    def test_verification_moves_to_another_current_center(self, sent):
        hospital, clinic = _center("PIMS"), _center("Evening Clinic", "clinic")
        doctor = _doctor(verified=True, method="medical_center", verified_by_center=hospital)
        membership = _join(doctor, hospital)
        _join(doctor, clinic)
        aff.end_affiliation(membership, SimpleNamespace(id=hospital.user_id), None, MagicMock())
        assert doctor.is_verified is True
        assert doctor.verified_by is clinic.user
        assert doctor.verification_note == "License checked by Evening Clinic"
        assert "doctor_verification_revoked" not in [kind for _, kind, _ in sent["notifications"]]

    def test_leaving_a_center_that_did_not_verify_changes_nothing(self, sent):
        hospital, clinic = _center("PIMS"), _center("Evening Clinic", "clinic")
        doctor = _doctor(verified=True, method="medical_center", verified_by_center=hospital)
        _join(doctor, hospital)
        membership = _join(doctor, clinic)
        aff.end_affiliation(membership, SimpleNamespace(id=doctor.user_id), None, MagicMock())
        assert doctor.is_verified is True
        assert doctor.verified_by_user_id == hospital.user_id

    def test_admin_verified_doctor_stays_verified_without_centers(self, sent):
        center = _center()
        doctor = _doctor(verified=True, method="admin")
        membership = _join(doctor, center)
        aff.end_affiliation(membership, SimpleNamespace(id=doctor.user_id), None, MagicMock())
        assert doctor.is_verified is True
        assert doctor.verification_method == "admin"

    def test_unrecorded_verifier_lapses_when_no_center_is_left(self, sent):
        center = _center()
        doctor = _doctor(verified=True, method="medical_center")
        membership = _join(doctor, center)
        aff.end_affiliation(membership, SimpleNamespace(id=doctor.user_id), None, MagicMock())
        assert doctor.is_verified is False


class TestSummaries:
    def test_only_active_memberships_count(self):
        doctor = _doctor()
        current = _join(doctor, _center("PIMS"))
        old = _join(doctor, _center("Old Clinic", "clinic"))
        old.status = "ended"
        assert aff.active_affiliations(doctor) == [current]
        assert [c.name for c in aff.active_centers(doctor)] == ["PIMS"]
