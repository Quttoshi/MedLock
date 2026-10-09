import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import results as api


def _db(*firsts):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = list(firsts)
    return db


def _doctor(verified=True):
    return SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4(), is_verified=verified)


def _patient():
    return SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4(), gender="female")


class TestDoctorAccess:
    def test_consented_access(self, monkeypatch):
        doctor, patient = _doctor(), _patient()
        monkeypatch.setattr(api, "has_consented_access", lambda d, p, db: True)
        _, found, in_emergency = api._doctor_patient(patient.id, SimpleNamespace(id=doctor.user_id), _db(doctor, patient))
        assert found is patient and in_emergency is False

    def test_emergency_access_is_marked(self, monkeypatch):
        doctor, patient = _doctor(), _patient()
        monkeypatch.setattr(api, "has_consented_access", lambda d, p, db: False)
        monkeypatch.setattr(api.emergency, "has_active_emergency", lambda d, p, db: True)
        assert api._doctor_patient(patient.id, SimpleNamespace(id=uuid.uuid4()), _db(doctor, patient))[2] is True

    def test_no_access_is_refused(self, monkeypatch):
        monkeypatch.setattr(api, "has_consented_access", lambda d, p, db: False)
        monkeypatch.setattr(api.emergency, "has_active_emergency", lambda d, p, db: False)
        with pytest.raises(HTTPException) as exc:
            api._doctor_patient(uuid.uuid4(), SimpleNamespace(id=uuid.uuid4()), _db(_doctor(), _patient()))
        assert exc.value.status_code == 403

    def test_unverified_doctor_is_refused(self):
        with pytest.raises(HTTPException) as exc:
            api._doctor_patient(uuid.uuid4(), SimpleNamespace(id=uuid.uuid4()), _db(_doctor(verified=False)))
        assert exc.value.status_code == 403

    def test_results_viewed_under_emergency_are_recorded(self, monkeypatch):
        doctor, patient = _doctor(), _patient()
        reports = [SimpleNamespace(id=uuid.uuid4()), SimpleNamespace(id=uuid.uuid4())]
        recorded = []
        monkeypatch.setattr(api.emergency, "record_report_opened",
                            lambda d, r, db, has_consent: recorded.append((r.id, has_consent)))
        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.distinct.return_value.all.return_value = reports
        api._record_emergency_views(doctor, patient, db)
        assert recorded == [(reports[0].id, False), (reports[1].id, False)]


class TestConfirmPermissions:
    def _result(self, patient):
        return SimpleNamespace(id=uuid.uuid4(), patient_id=patient.id, report_id=uuid.uuid4(), test_code="hemoglobin",
                               value=1.09, flag="critical_low", status="unconfirmed")

    @pytest.fixture(autouse=True)
    def stubs(self, monkeypatch):
        monkeypatch.setattr(api, "log_action", lambda db, **kw: None)
        monkeypatch.setattr(api, "confirm", lambda r, uid, db, value: setattr(r, "status", "corrected" if value else "confirmed"))

    def test_patient_can_correct_their_own(self):
        patient = _patient()
        result = self._result(patient)
        user = SimpleNamespace(id=patient.user_id, role="patient")
        out = api.confirm_result(result.id, api.ConfirmRequest(value=10.9), None, user, _db(result, patient))
        assert out["status"] == "corrected"

    def test_other_patients_cannot(self):
        result = self._result(_patient())
        user = SimpleNamespace(id=uuid.uuid4(), role="patient")
        with pytest.raises(HTTPException) as exc:
            api.confirm_result(result.id, api.ConfirmRequest(), None, user, _db(result, _patient()))
        assert exc.value.status_code == 404

    def test_doctor_needs_access_the_patient_granted(self, monkeypatch):
        patient, doctor = _patient(), _doctor()
        result = self._result(patient)
        user = SimpleNamespace(id=doctor.user_id, role="doctor")
        monkeypatch.setattr(api, "has_consented_access", lambda d, p, db: False)
        with pytest.raises(HTTPException):
            api.confirm_result(result.id, api.ConfirmRequest(), None, user, _db(result, doctor))
        monkeypatch.setattr(api, "has_consented_access", lambda d, p, db: True)
        assert api.confirm_result(result.id, api.ConfirmRequest(), None, user, _db(result, doctor))["status"] == "confirmed"
