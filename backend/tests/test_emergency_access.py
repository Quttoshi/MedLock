import uuid
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import emergency_service as em

DOB = date(1985, 3, 2)
JUSTIFICATION = "Brought in unconscious after a road accident; need history urgently."


def _center(center_type="hospital", approved=True, name="PIMS"):
    return SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4(), name=name, center_type=center_type, is_approved=approved)


def _doctor(verified=True, centers=None):
    user = SimpleNamespace(id=uuid.uuid4(), full_name="Ahmed")
    affiliations = [SimpleNamespace(status="active", medical_center=c) for c in (centers or [])]
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, user=user, is_verified=verified,
                           specialization="Emergency medicine", affiliations=affiliations)


def _patient():
    user = SimpleNamespace(id=uuid.uuid4(), full_name="Ayesha Khan")
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, user=user, date_of_birth=DOB, gender="female",
                           blood_group="B+", emergency_contact_name="Bilal Khan", emergency_contact_phone="+92 300 1234567")


@pytest.fixture
def world(monkeypatch):
    hospital = _center()
    doctor = _doctor(centers=[hospital])
    patient = _patient()
    sent, audit = [], []
    monkeypatch.setattr(em.identity, "find_patient", lambda db, cnic=None, date_of_birth=None: patient)
    monkeypatch.setattr(em, "active_access", lambda d, p, db: None)
    monkeypatch.setattr(em, "used_today", lambda d, db: 0)
    monkeypatch.setattr(em, "create_notification",
                        lambda db, user_id, kind, message, link=None: sent.append((user_id, kind)))
    monkeypatch.setattr(em, "notify_admins", lambda db, kind, message, link=None: sent.append(("admins", kind)))
    monkeypatch.setattr(em, "log_action", lambda db, **kw: audit.append(kw))
    return SimpleNamespace(hospital=hospital, doctor=doctor, patient=patient, sent=sent, audit=audit, db=MagicMock())


def _start(w, **overrides):
    args = dict(cnic="12345-1234567-1", date_of_birth=DOB, medical_center_id=str(w.hospital.id),
                reason_code="unconscious", justification=JUSTIFICATION, declaration=True)
    args.update(overrides)
    return em.start(w.doctor, w.doctor.user, args["cnic"], args["date_of_birth"], args["medical_center_id"],
                    args["reason_code"], args["justification"], args["declaration"], w.db)


class TestStart:
    def test_grants_24_hours_and_shows_the_emergency_contact(self, world):
        view = _start(world)
        added = world.db.add.call_args.args[0]
        assert added.expires_at - added.started_at == timedelta(hours=24)
        assert view["status"] == "active"
        assert view["patient"]["emergency_contact_phone"] == "+92 300 1234567"
        assert view["patient"]["age"] >= 40
        assert world.audit[0]["action"] == "emergency_access_started"
        assert world.audit[0]["details"]["justification"] == JUSTIFICATION

    def test_patient_admins_and_hospital_are_told(self, world):
        _start(world)
        assert (world.patient.user_id, "emergency_access_started") in world.sent
        assert ("admins", "emergency_access_started") in world.sent
        assert (world.hospital.user_id, "emergency_access_started") in world.sent

    def test_unverified_doctor_is_refused(self, world):
        world.doctor.is_verified = False
        with pytest.raises(HTTPException) as exc:
            _start(world)
        assert exc.value.status_code == 403

    @pytest.mark.parametrize("center_type", ["clinic", "lab"])
    def test_only_hospital_doctors_can_use_it(self, world, center_type):
        clinic = _center(center_type)
        world.doctor.affiliations = [SimpleNamespace(status="active", medical_center=clinic)]
        with pytest.raises(HTTPException) as exc:
            _start(world, medical_center_id=str(clinic.id))
        assert exc.value.status_code == 403

    def test_needs_a_reason_justification_and_declaration(self, world):
        for bad in ({"reason_code": "bored"}, {"justification": "urgent"}, {"declaration": False}):
            with pytest.raises(HTTPException) as exc:
                _start(world, **bad)
            assert exc.value.status_code == 400

    def test_daily_limit(self, world, monkeypatch):
        monkeypatch.setattr(em, "used_today", lambda d, db: em.DAILY_LIMIT)
        with pytest.raises(HTTPException) as exc:
            _start(world)
        assert exc.value.status_code == 429

    def test_an_active_access_is_reused_not_duplicated(self, world, monkeypatch):
        existing = SimpleNamespace(
            id=uuid.uuid4(), patient=world.patient, medical_center=world.hospital, reason_code="unconscious",
            started_at=datetime.utcnow(), expires_at=datetime.utcnow() + timedelta(hours=5), ended_at=None,
        )
        monkeypatch.setattr(em, "active_access", lambda d, p, db: existing)
        assert _start(world)["id"] == str(existing.id)
        world.db.add.assert_not_called()


def _access(w, hours_left=10, ended=False):
    now = datetime.utcnow()
    return SimpleNamespace(
        id=uuid.uuid4(), doctor=w.doctor, doctor_id=w.doctor.id, patient=w.patient, patient_id=w.patient.id,
        medical_center=w.hospital, reason_code="unconscious", justification=JUSTIFICATION,
        started_at=now - timedelta(hours=1), expires_at=now + timedelta(hours=hours_left),
        ended_at=now if ended else None, ended_by_user_id=None, views=[], flagged_at=None, flag_note=None,
        reviewed_at=None, reviewed_by_user_id=None, review_note=None,
    )


def _db_returning(obj):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = obj
    return db


class TestEndAndState:
    def test_patient_can_end_it_and_the_doctor_is_told(self, world):
        access = _access(world)
        em.end(access.id, world.patient.user, _db_returning(access))
        assert access.ended_at is not None
        assert em.state(access) == "ended"
        assert (world.doctor.user_id, "emergency_access_ended") in world.sent

    def test_strangers_cannot_end_it(self, world):
        access = _access(world)
        with pytest.raises(HTTPException) as exc:
            em.end(access.id, SimpleNamespace(id=uuid.uuid4()), _db_returning(access))
        assert exc.value.status_code == 404

    def test_expiry(self, world):
        assert em.state(_access(world, hours_left=-1)) == "expired"
        assert em.is_active(_access(world)) is True


class TestReportsOpened:
    def test_first_opening_is_recorded_on_the_blockchain_once(self, world, monkeypatch):
        access = _access(world)
        report = SimpleNamespace(id=uuid.uuid4(), patient_id=world.patient.id, file_hash_sha256="ab" * 32)
        chain = []
        monkeypatch.setattr(em, "active_access", lambda d, p, db: access)
        monkeypatch.setattr(em, "blockchain_log", lambda rid, h, kind, db: chain.append((rid, kind)))
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [None, SimpleNamespace()]
        em.record_report_opened(world.doctor, report, db, has_consent=False)
        em.record_report_opened(world.doctor, report, db, has_consent=False)
        assert chain == [(report.id, "emergency_access")]

    def test_consented_access_is_not_recorded_as_emergency(self, world, monkeypatch):
        chain = []
        monkeypatch.setattr(em, "blockchain_log", lambda *a: chain.append(a))
        report = SimpleNamespace(id=uuid.uuid4(), patient_id=world.patient.id, file_hash_sha256="ab" * 32)
        em.record_report_opened(world.doctor, report, MagicMock(), has_consent=True)
        assert chain == []


class TestMisuse:
    def test_patient_report_reaches_admins_and_admin_reviews(self, world):
        access = _access(world)
        em.flag(access.id, world.patient.user, "I was at home, not in hospital", _db_returning(access))
        assert access.flagged_at and ("admins", "emergency_access_flagged") in world.sent
        em.review(access.id, SimpleNamespace(id=uuid.uuid4()), "Confirmed with PIMS ER log", _db_returning(access))
        assert access.reviewed_at and access.review_note == "Confirmed with PIMS ER log"

    def test_flag_needs_a_note_and_the_owner(self, world):
        access = _access(world)
        with pytest.raises(HTTPException):
            em.flag(access.id, world.patient.user, " ", _db_returning(access))
        with pytest.raises(HTTPException):
            em.flag(access.id, SimpleNamespace(id=uuid.uuid4()), "Not me", _db_returning(access))


def test_eligibility_lists_only_approved_hospitals(world):
    world.doctor.affiliations += [
        SimpleNamespace(status="active", medical_center=_center("clinic", name="Evening Clinic")),
        SimpleNamespace(status="active", medical_center=_center(approved=False, name="Pending Hospital")),
        SimpleNamespace(status="ended", medical_center=_center(name="Old Hospital")),
    ]
    result = em.eligibility(world.doctor, MagicMock())
    assert [h["name"] for h in result["hospitals"]] == ["PIMS"]
    assert result["can_use"] is True
