import pytest
from jose import jwt, JWTError
from app.dependencies.jwt import create_access_token
from app.config import settings


class TestCreateAccessToken:
    def test_returns_string(self):
        token = create_access_token({"sub": "user-id-123", "role": "patient"})
        assert isinstance(token, str)

    def test_three_part_jwt_structure(self):
        token = create_access_token({"sub": "user-id-123", "role": "patient"})
        assert token.count(".") == 2

    def test_sub_claim_present(self):
        token = create_access_token({"sub": "abc-123", "role": "patient"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "abc-123"

    def test_role_claim_present(self):
        token = create_access_token({"sub": "abc-123", "role": "doctor"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "doctor"

    def test_exp_claim_present(self):
        token = create_access_token({"sub": "abc-123", "role": "patient"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "exp" in payload

    def test_patient_role(self):
        token = create_access_token({"sub": "u1", "role": "patient"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "patient"

    def test_doctor_role(self):
        token = create_access_token({"sub": "u2", "role": "doctor"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "doctor"

    def test_admin_role(self):
        token = create_access_token({"sub": "u3", "role": "admin"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "admin"

    def test_medical_center_role(self):
        token = create_access_token({"sub": "u4", "role": "medical_center"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "medical_center"

    def test_wrong_secret_raises(self):
        token = create_access_token({"sub": "u1", "role": "patient"})
        with pytest.raises(JWTError):
            jwt.decode(token, "wrong-secret-key", algorithms=[settings.JWT_ALGORITHM])

    def test_different_users_produce_different_tokens(self):
        t1 = create_access_token({"sub": "user-1", "role": "patient"})
        t2 = create_access_token({"sub": "user-2", "role": "patient"})
        assert t1 != t2

    def test_extra_claims_preserved(self):
        token = create_access_token({"sub": "u1", "role": "patient", "custom": "value"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["custom"] == "value"
