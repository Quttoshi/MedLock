import threading
import time
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.services import blockchain_service as bc


def _entry(**overrides):
    fields = dict(
        id=uuid.uuid4(), report_id=uuid.uuid4(), file_hash="ab" * 32, event_type="upload",
        status="pending", attempts=0, transaction_hash=None, last_error=None,
    )
    fields.update(overrides)
    return SimpleNamespace(**fields)


class TestAttemptSend:
    def test_success_stores_tx_hash_and_clears_error(self, monkeypatch):
        monkeypatch.setattr(bc, "_send_log_transaction", lambda *args: "0xabc")
        entry = _entry(last_error="earlier failure")
        bc._attempt_send(entry, MagicMock())
        assert entry.transaction_hash == "0xabc"
        assert entry.attempts == 1
        assert entry.last_error is None
        assert entry.status == "pending"  # confirmed later, once mined

    def test_failure_below_max_attempts_stays_pending_for_retry(self, monkeypatch):
        monkeypatch.setattr(bc, "_send_log_transaction", MagicMock(side_effect=RuntimeError("rpc down")))
        notify = MagicMock()
        monkeypatch.setattr(bc, "notify_admins", notify)
        entry = _entry()
        bc._attempt_send(entry, MagicMock())
        assert entry.status == "pending"
        assert entry.attempts == 1
        assert "rpc down" in entry.last_error
        notify.assert_not_called()

    def test_failure_at_max_attempts_marks_failed_and_notifies_admins(self, monkeypatch):
        monkeypatch.setattr(bc, "_send_log_transaction", MagicMock(side_effect=RuntimeError("rpc down")))
        notify = MagicMock()
        monkeypatch.setattr(bc, "notify_admins", notify)
        entry = _entry(attempts=settings.BLOCKCHAIN_MAX_ATTEMPTS - 1)
        bc._attempt_send(entry, MagicMock())
        assert entry.status == "failed"
        assert entry.attempts == settings.BLOCKCHAIN_MAX_ATTEMPTS
        notify.assert_called_once()
        assert notify.call_args.args[1] == "blockchain_failed"


class TestLogEvent:
    def test_not_configured_saves_failed_row_with_reason(self):
        db = MagicMock()
        entry = bc.log_event(uuid.uuid4(), "ab" * 32, "upload", db)
        assert entry.status == "failed"
        assert "not configured" in entry.last_error
        db.commit.assert_called()

    def test_configured_makes_one_send_attempt(self, monkeypatch):
        monkeypatch.setattr(bc, "_is_configured", lambda: True)
        monkeypatch.setattr(bc, "_send_log_transaction", lambda *args: "0xdef")
        entry = bc.log_event(uuid.uuid4(), "ab" * 32, "upload", MagicMock())
        assert entry.transaction_hash == "0xdef"
        assert entry.attempts == 1
        assert entry.network == settings.ETHEREUM_NETWORK


class TestFees:
    def _fake_w3(self, base_gwei, priority_gwei):
        gwei = 10**9
        w3 = MagicMock()
        w3.eth.get_block.return_value = {"baseFeePerGas": int(base_gwei * gwei)}
        w3.eth.max_priority_fee = int(priority_gwei * gwei)
        return w3

    def test_max_fee_leaves_room_for_base_fee_to_double(self, monkeypatch):
        monkeypatch.setattr(bc, "_w3", self._fake_w3(base_gwei=2, priority_gwei=1))
        max_fee, priority = bc._fee_params()
        assert priority == 1 * 10**9
        assert max_fee == 5 * 10**9  # 2 * base + priority

    def test_max_fee_is_capped(self, monkeypatch):
        monkeypatch.setattr(settings, "BLOCKCHAIN_MAX_FEE_GWEI", 4.0)
        monkeypatch.setattr(bc, "_w3", self._fake_w3(base_gwei=2, priority_gwei=1))
        max_fee, _ = bc._fee_params()
        assert max_fee == 4 * 10**9

    def test_fee_above_cap_raises_so_the_send_is_retried_later(self, monkeypatch):
        monkeypatch.setattr(settings, "BLOCKCHAIN_MAX_FEE_GWEI", 2.0)
        monkeypatch.setattr(bc, "_w3", self._fake_w3(base_gwei=5, priority_gwei=1))
        with pytest.raises(RuntimeError, match="exceeds"):
            bc._fee_params()


class TestNonceLock:
    def test_concurrent_sends_use_distinct_nonces(self, monkeypatch):
        """Without the lock both threads would read the same pending nonce."""
        state = {"pending": 7}
        used_nonces = []

        def send_raw_transaction(tx):
            time.sleep(0.05)  # widen the race window
            used_nonces.append(tx["nonce"])
            state["pending"] += 1
            return bytes(32)

        w3 = MagicMock()
        w3.eth.get_transaction_count.side_effect = lambda address, block: state["pending"]
        w3.eth.send_raw_transaction.side_effect = send_raw_transaction
        call = MagicMock()
        call.estimate_gas.return_value = 30_000
        call.build_transaction.side_effect = lambda tx: tx
        contract = MagicMock()
        contract.functions.logEvent.return_value = call
        account = MagicMock(address="0xMedLock")
        account.sign_transaction.side_effect = lambda tx: SimpleNamespace(raw_transaction=tx)

        monkeypatch.setattr(bc, "_w3", w3)
        monkeypatch.setattr(bc, "_contract", contract)
        monkeypatch.setattr(bc, "_account", account)
        monkeypatch.setattr(bc, "_fee_params", lambda: (2, 1))

        threads = [
            threading.Thread(target=bc._send_log_transaction, args=(uuid.uuid4(), "ab" * 32, "upload"))
            for _ in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(used_nonces) == [7, 8]


class TestTxHashHelpers:
    def test_normalize_adds_missing_prefix(self):
        assert bc.normalize_tx_hash("abc123") == "0xabc123"

    def test_normalize_keeps_existing_prefix(self):
        assert bc.normalize_tx_hash("0xabc123") == "0xabc123"

    def test_normalize_passes_through_empty(self):
        assert bc.normalize_tx_hash(None) is None

    def test_explorer_url_uses_normalized_hash(self):
        assert bc.explorer_tx_url("abc") == f"{settings.ETHERSCAN_BASE_URL}/tx/0xabc"

    def test_explorer_url_none_without_hash(self):
        assert bc.explorer_tx_url(None) is None
