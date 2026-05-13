import uuid
import pytest
from app.services.blockchain_service import _uuid_to_bytes32, _hex_to_bytes32, _is_configured


class TestUuidToBytes32:
    def test_returns_bytes(self):
        result = _uuid_to_bytes32(uuid.uuid4())
        assert isinstance(result, bytes)

    def test_length_is_32(self):
        result = _uuid_to_bytes32(uuid.uuid4())
        assert len(result) == 32

    def test_deterministic_for_same_uuid(self):
        uid = uuid.uuid4()
        assert _uuid_to_bytes32(uid) == _uuid_to_bytes32(uid)

    def test_different_uuids_differ(self):
        assert _uuid_to_bytes32(uuid.uuid4()) != _uuid_to_bytes32(uuid.uuid4())

    def test_accepts_string_uuid(self):
        uid_str = str(uuid.uuid4())
        result = _uuid_to_bytes32(uid_str)
        assert isinstance(result, bytes)
        assert len(result) == 32

    def test_string_and_uuid_object_same_result(self):
        uid = uuid.uuid4()
        assert _uuid_to_bytes32(uid) == _uuid_to_bytes32(str(uid))


class TestHexToBytes32:
    def test_returns_bytes(self):
        result = _hex_to_bytes32("ab" * 16)
        assert isinstance(result, bytes)

    def test_length_is_32(self):
        result = _hex_to_bytes32("ab" * 16)
        assert len(result) == 32

    def test_strips_0x_prefix(self):
        with_prefix = _hex_to_bytes32("0x" + "ab" * 16)
        without_prefix = _hex_to_bytes32("ab" * 16)
        assert with_prefix == without_prefix

    def test_known_all_zeros(self):
        result = _hex_to_bytes32("00" * 32)
        assert result == b"\x00" * 32

    def test_short_hex_padded_to_32(self):
        result = _hex_to_bytes32("ff")
        assert len(result) == 32

    def test_deterministic(self):
        hex_str = "deadbeef" * 4
        assert _hex_to_bytes32(hex_str) == _hex_to_bytes32(hex_str)


class TestIsConfigured:
    def test_returns_bool(self):
        assert isinstance(_is_configured(), bool)

    def test_false_when_provider_url_missing(self, monkeypatch):
        monkeypatch.setattr("app.services.blockchain_service.settings.WEB3_PROVIDER_URL", "")
        assert _is_configured() is False

    def test_false_when_private_key_placeholder(self, monkeypatch):
        monkeypatch.setattr("app.services.blockchain_service.settings.WEB3_PROVIDER_URL", "https://sepolia.infura.io/v3/test")
        monkeypatch.setattr("app.services.blockchain_service.settings.ETHEREUM_PRIVATE_KEY", "your-wallet-private-key")
        assert _is_configured() is False

    def test_false_when_contract_placeholder(self, monkeypatch):
        monkeypatch.setattr("app.services.blockchain_service.settings.WEB3_PROVIDER_URL", "https://sepolia.infura.io/v3/test")
        monkeypatch.setattr("app.services.blockchain_service.settings.ETHEREUM_PRIVATE_KEY", "0xrealkey")
        monkeypatch.setattr("app.services.blockchain_service.settings.ETHEREUM_CONTRACT_ADDRESS", "your-contract-address")
        assert _is_configured() is False
