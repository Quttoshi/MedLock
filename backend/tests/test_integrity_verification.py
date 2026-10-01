import hashlib
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.services import blockchain_service as bc

ORIGINAL = b"Hemoglobin 13.5 g/dL"
ORIGINAL_HASH = hashlib.sha256(ORIGINAL).hexdigest()
CONTRACT = "0x00000000000000000000000000000000000000C0"
WALLET = "0x00000000000000000000000000000000000000A1"


@pytest.fixture
def report():
    return SimpleNamespace(
        id=uuid.uuid4(), file_url="p/r.enc", encryption_key_ref="key", file_hash_sha256=ORIGINAL_HASH,
    )


def _db_with_log(log):
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = log
    return db


def _confirmed_log():
    return SimpleNamespace(transaction_hash="abc123", block_number=42)


@pytest.fixture
def chain(monkeypatch, report):
    """Configured chain whose upload event matches the report; tests override pieces to break it."""
    monkeypatch.setattr(settings, "ETHEREUM_CONTRACT_ADDRESS", CONTRACT)
    monkeypatch.setattr(bc, "_is_configured", lambda: True)
    monkeypatch.setattr(bc, "_ensure_web3", lambda: None)
    monkeypatch.setattr(bc, "download_file", lambda path: b"ciphertext")
    monkeypatch.setattr(bc, "decrypt_file", lambda data, key: ORIGINAL)
    monkeypatch.setattr(bc, "_w3", MagicMock())
    monkeypatch.setattr(bc, "_account", SimpleNamespace(address=WALLET))

    event = {
        "address": CONTRACT,
        "args": {
            "reportId": bc._uuid_to_bytes32(report.id),
            "fileHash": bc._hex_to_bytes32(ORIGINAL_HASH),
            "caller": WALLET,
        },
    }
    contract = MagicMock()
    contract.events.RecordLogged.return_value.process_receipt.return_value = [event]
    monkeypatch.setattr(bc, "_contract", contract)
    return event


class TestVerifyReportIntegrity:
    def test_untouched_report_is_verified(self, chain, report):
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        assert result["status"] == "verified"
        assert all(c["passed"] for c in result["checks"])
        assert result["transaction_hash"] == "0xabc123"
        assert result["block_number"] == 42
        assert result["explorer_url"].endswith("/tx/0xabc123")

    def test_modified_file_content_is_tampered(self, chain, report, monkeypatch):
        monkeypatch.setattr(bc, "decrypt_file", lambda data, key: b"Hemoglobin 99.9 g/dL")
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        assert result["status"] == "tampered"
        assert result["checks"][0]["check"] == "stored_file"
        assert result["checks"][0]["passed"] is False

    def test_ciphertext_failing_decryption_is_tampered(self, chain, report, monkeypatch):
        def fail(data, key):
            raise ValueError("MAC check failed")
        monkeypatch.setattr(bc, "decrypt_file", fail)
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        assert result["status"] == "tampered"
        assert "modified" in result["checks"][0]["detail"]

    def test_database_hash_edited_to_match_new_file_is_caught_by_chain(self, chain, report, monkeypatch):
        """An insider who swaps the file AND updates the stored hash still disagrees with the chain."""
        forged = b"forged report"
        report.file_hash_sha256 = hashlib.sha256(forged).hexdigest()
        monkeypatch.setattr(bc, "decrypt_file", lambda data, key: forged)
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        by_name = {c["check"]: c for c in result["checks"]}
        assert by_name["stored_file"]["passed"] is True
        assert by_name["chain_hash"]["passed"] is False
        assert result["status"] == "tampered"

    def test_record_written_by_another_wallet_is_rejected(self, chain, report):
        chain["args"]["caller"] = "0x00000000000000000000000000000000000000BAD"
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        by_name = {c["check"]: c for c in result["checks"]}
        assert by_name["chain_source"]["passed"] is False
        assert result["status"] == "tampered"

    def test_transaction_without_this_report_is_tampered(self, chain, report):
        chain["args"]["reportId"] = bc._uuid_to_bytes32(uuid.uuid4())
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        assert result["status"] == "tampered"

    def test_no_confirmed_record_is_unverifiable(self, chain, report):
        result = bc.verify_report_integrity(report, _db_with_log(None))
        assert result["status"] == "unverifiable"
        assert "no confirmed blockchain record" in result["reason"]

    def test_not_configured_is_unverifiable(self, chain, report, monkeypatch):
        monkeypatch.setattr(bc, "_is_configured", lambda: False)
        result = bc.verify_report_integrity(report, _db_with_log(_confirmed_log()))
        assert result["status"] == "unverifiable"

    def test_modified_file_without_chain_record_is_still_tampered(self, chain, report, monkeypatch):
        monkeypatch.setattr(bc, "decrypt_file", lambda data, key: b"changed")
        result = bc.verify_report_integrity(report, _db_with_log(None))
        assert result["status"] == "tampered"
