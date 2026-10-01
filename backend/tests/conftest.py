import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/testdb")
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "placeholder-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-at-least-32-chars-long!")
os.environ.setdefault("AES_SECRET_KEY", "test-aes-secret-key-for-unit-tests-ok!")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")

# Never send real email or blockchain transactions from tests, even when .env configures them.
for _var in ("MAIL_SERVER", "MAIL_FROM", "WEB3_PROVIDER_URL", "ETHEREUM_PRIVATE_KEY", "ETHEREUM_CONTRACT_ADDRESS"):
    os.environ[_var] = ""
os.environ["BACKGROUND_JOBS_ENABLED"] = "false"

import pytest


@pytest.fixture(autouse=True)
def clear_lockout_state():
    from app.services import auth_service
    auth_service._failed_attempts.clear()
    yield
    auth_service._failed_attempts.clear()
