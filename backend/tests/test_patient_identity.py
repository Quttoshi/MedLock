import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import patient_identity_service as identity

DOB = date(1990, 5, 17)


def _patient(cnic=None, dob=DOB):
    p = SimpleNamespace(id=uuid.uuid4(), date_of_birth=dob, cnic_hash=None, cnic_encrypted=None, cnic_key_ref=None,
                        user=SimpleNamespace(full_name="Ayesha Khan"))
    if cnic:
        identity.set_cnic(p, cnic, _db())
    return p


def _db(first=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = first
    return db


class TestFormat:
    @pytest.mark.parametrize("value", ["12345-1234567-1", "1234512345671", " 12345 1234567 1 "])
    def test_accepted_formats(self, value):
        assert identity.normalize_cnic(value) == "1234512345671"

    @pytest.mark.parametrize("value", ["", "12345-123456-1", "12345-1234567-12", "1234A-1234567-1", None])
    def test_rejected_formats(self, value):
        with pytest.raises(HTTPException) as exc:
            identity.normalize_cnic(value)
        assert exc.value.status_code == 400


class TestStorage:
    def test_cnic_is_never_stored_in_plain_text(self):
        p = _patient("12345-1234567-1")
        assert b"1234512345671" not in p.cnic_encrypted
        assert "1234512345671" not in p.cnic_hash
        assert len(p.cnic_hash) == 64

    def test_the_patient_sees_it_masked(self):
        assert identity.masked_cnic(_patient("12345-1234567-1")) == "•••••-••••567-1"
        assert identity.masked_cnic(_patient()) is None

    def test_fingerprint_is_stable_and_keyed(self):
        assert identity.cnic_fingerprint("1234512345671") == identity.cnic_fingerprint("1234512345671")
        import hashlib
        assert identity.cnic_fingerprint("1234512345671") != hashlib.sha256(b"1234512345671").hexdigest()

    def test_a_cnic_belongs_to_one_account(self):
        other = SimpleNamespace(id=uuid.uuid4())
        with pytest.raises(HTTPException) as exc:
            identity.set_cnic(_patient(), "12345-1234567-1", _db(first=other))
        assert exc.value.status_code == 409

    def test_the_owner_can_save_their_own_cnic_again(self):
        p = _patient()
        identity.set_cnic(p, "12345-1234567-1", _db(first=p))
        assert p.cnic_hash


class TestFindPatient:
    def test_cnic_and_matching_date_of_birth_find_the_patient(self):
        p = _patient("12345-1234567-1")
        assert identity.find_patient(_db(first=p), cnic="12345-1234567-1", date_of_birth=DOB) is p

    def test_wrong_date_of_birth_gives_the_same_message_as_no_match(self):
        p = _patient("12345-1234567-1")
        with pytest.raises(HTTPException) as wrong_dob:
            identity.find_patient(_db(first=p), cnic="12345-1234567-1", date_of_birth=DOB + timedelta(days=1))
        with pytest.raises(HTTPException) as unknown:
            identity.find_patient(_db(first=None), cnic="99999-9999999-9", date_of_birth=DOB)
        assert wrong_dob.value.status_code == unknown.value.status_code == 404
        assert wrong_dob.value.detail == unknown.value.detail == identity.NO_MATCH

    def test_cnic_without_date_of_birth_is_refused(self):
        with pytest.raises(HTTPException) as exc:
            identity.find_patient(_db(), cnic="12345-1234567-1")
        assert exc.value.status_code == 400

    def test_email_lookup_ignores_case(self):
        p = _patient()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [SimpleNamespace(id=uuid.uuid4()), p]
        assert identity.find_patient(db, email="  Ayesha@Example.COM ") is p

    def test_nothing_given_is_refused(self):
        with pytest.raises(HTTPException) as exc:
            identity.find_patient(_db())
        assert exc.value.status_code == 400


def test_future_date_of_birth_is_refused():
    with pytest.raises(HTTPException):
        identity.check_date_of_birth(date.today() + timedelta(days=1))
