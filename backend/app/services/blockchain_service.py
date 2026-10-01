"""
Ethereum blockchain logging service.

Logs medical record events (upload, access_grant, access_deny, revoke, delete) as
on-chain transactions against the deployed MedLock.sol contract, and verifies a
report's integrity against its on-chain record.

Sends are attempted immediately; failures stay "pending" and are retried by the
background job until BLOCKCHAIN_MAX_ATTEMPTS, after which the row is marked
"failed" and admins are notified. When Web3 is not configured, rows are saved
as "failed" so the rest of the application keeps working without a wallet.
"""
import logging
import threading
import uuid as uuid_module
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.blockchain_log import BlockchainLog
from app.models.medical_report import MedicalReport
from app.services.encryption_service import decrypt_file, sha256_hash
from app.services.notification_service import notify_admins
from app.services.storage_service import download_file

logger = logging.getLogger(__name__)

# ABI matches MedLock.sol exactly
_MEDLOCK_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "reportId",  "type": "bytes32"},
            {"internalType": "bytes32", "name": "fileHash",  "type": "bytes32"},
            {"internalType": "string",  "name": "eventType", "type": "string"},
        ],
        "name": "logEvent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "internalType": "bytes32", "name": "reportId",  "type": "bytes32"},
            {"indexed": False, "internalType": "bytes32", "name": "fileHash",  "type": "bytes32"},
            {"indexed": False, "internalType": "string",  "name": "eventType", "type": "string"},
            {"indexed": True,  "internalType": "address", "name": "caller",    "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
        ],
        "name": "RecordLogged",
        "type": "event",
    },
]

# estimate_gas is exact for the current state; the margin covers small changes before mining.
GAS_MARGIN = 1.2
# A sent transaction the network no longer knows about after this long was dropped; resend it.
DROPPED_TX_AFTER = timedelta(minutes=10)

_w3 = None
_contract = None
_account = None
# One transaction at a time, so concurrent requests never reuse the same nonce.
_send_lock = threading.Lock()


def _is_configured() -> bool:
    return bool(
        settings.WEB3_PROVIDER_URL
        and settings.ETHEREUM_PRIVATE_KEY
        and settings.ETHEREUM_PRIVATE_KEY not in ("", "your-wallet-private-key")
        and settings.ETHEREUM_CONTRACT_ADDRESS
        and settings.ETHEREUM_CONTRACT_ADDRESS not in ("", "your-contract-address")
    )


def _ensure_web3():
    global _w3, _contract, _account
    if _w3 is not None:
        return

    from web3 import Web3

    _w3 = Web3(Web3.HTTPProvider(settings.WEB3_PROVIDER_URL))
    _account = _w3.eth.account.from_key(settings.ETHEREUM_PRIVATE_KEY)
    _contract = _w3.eth.contract(
        address=Web3.to_checksum_address(settings.ETHEREUM_CONTRACT_ADDRESS),
        abi=_MEDLOCK_ABI,
    )


def _uuid_to_bytes32(uid) -> bytes:
    """Convert a UUID to a 32-byte value (UUID occupies the first 16 bytes)."""
    return uuid_module.UUID(str(uid)).bytes.ljust(32, b"\x00")


def _hex_to_bytes32(hex_str: str) -> bytes:
    """Convert a hex SHA-256 string to exactly 32 bytes."""
    clean = hex_str.replace("0x", "").strip()
    b = bytes.fromhex(clean)
    return b[:32].ljust(32, b"\x00")


def normalize_tx_hash(tx_hash: Optional[str]) -> Optional[str]:
    """Older rows were stored without the 0x prefix; RPC calls and explorer links need it."""
    if not tx_hash:
        return tx_hash
    return tx_hash if tx_hash.startswith("0x") else f"0x{tx_hash}"


def explorer_tx_url(tx_hash: Optional[str]) -> Optional[str]:
    tx_hash = normalize_tx_hash(tx_hash)
    return f"{settings.ETHERSCAN_BASE_URL}/tx/{tx_hash}" if tx_hash else None


# ── Sending ───────────────────────────────────────────────────────────────────

def log_event(
    report_id,
    file_hash_sha256: str,
    event_type: str,
    db: Session,
) -> BlockchainLog:
    """
    Record an event for a report: save a BlockchainLog row and make one send attempt.

    On success the row stays "pending" with its tx hash until the transaction is
    mined (see confirm_log). On failure it stays "pending" without a tx hash and
    the background job retries it. Never raises.
    """
    entry = BlockchainLog(
        report_id=report_id,
        file_hash=file_hash_sha256,
        event_type=event_type,
        network=settings.ETHEREUM_NETWORK,
        status="pending",
        attempts=0,
    )
    db.add(entry)
    db.flush()

    if not _is_configured():
        entry.status = "failed"
        entry.last_error = "Blockchain logging is not configured"
    else:
        _attempt_send(entry, db)

    db.commit()
    db.refresh(entry)
    return entry


def _attempt_send(entry: BlockchainLog, db: Session) -> None:
    """Try to send once, updating the row in place. The caller commits."""
    entry.attempts = (entry.attempts or 0) + 1
    try:
        entry.transaction_hash = _send_log_transaction(entry.report_id, entry.file_hash, entry.event_type)
        entry.last_error = None
    except Exception as exc:
        entry.last_error = str(exc)[:500]
        logger.warning(
            "Blockchain send failed for log %s (attempt %s/%s): %s",
            entry.id, entry.attempts, settings.BLOCKCHAIN_MAX_ATTEMPTS, exc,
        )
        if entry.attempts >= settings.BLOCKCHAIN_MAX_ATTEMPTS:
            _mark_failed(entry, db)


def _send_log_transaction(report_id, file_hash_sha256: str, event_type: str) -> str:
    from web3 import Web3

    with _send_lock:
        _ensure_web3()
        call = _contract.functions.logEvent(
            _uuid_to_bytes32(report_id), _hex_to_bytes32(file_hash_sha256), event_type,
        )
        # "pending" counts transactions sent but not yet mined, so back-to-back sends get new nonces.
        nonce = _w3.eth.get_transaction_count(_account.address, "pending")
        gas = int(call.estimate_gas({"from": _account.address}) * GAS_MARGIN)
        max_fee, priority_fee = _fee_params()
        tx = call.build_transaction({
            "from": _account.address,
            "nonce": nonce,
            "gas": gas,
            "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": priority_fee,
            "chainId": settings.ETHEREUM_CHAIN_ID,
        })
        signed = _account.sign_transaction(tx)
        return Web3.to_hex(_w3.eth.send_raw_transaction(signed.raw_transaction))


def _fee_params() -> tuple[int, int]:
    """EIP-1559 fees: room for the base fee to double, capped at BLOCKCHAIN_MAX_FEE_GWEI."""
    from web3 import Web3

    base_fee = _w3.eth.get_block("latest")["baseFeePerGas"]
    priority_fee = _w3.eth.max_priority_fee
    cap = Web3.to_wei(settings.BLOCKCHAIN_MAX_FEE_GWEI, "gwei")
    if base_fee + priority_fee > cap:
        # Waiting is cheaper than overpaying; the background job retries later.
        raise RuntimeError(
            f"Network fee {Web3.from_wei(base_fee + priority_fee, 'gwei'):.2f} gwei "
            f"exceeds the {settings.BLOCKCHAIN_MAX_FEE_GWEI} gwei cap"
        )
    return min(2 * base_fee + priority_fee, cap), priority_fee


def _mark_failed(entry: BlockchainLog, db: Session) -> None:
    entry.status = "failed"
    try:
        notify_admins(
            db,
            "blockchain_failed",
            f"Blockchain logging failed for a '{entry.event_type}' event on report {entry.report_id} "
            f"after {entry.attempts} attempt(s): {entry.last_error or 'transaction reverted'}",
        )
    except Exception:
        logger.exception("Could not notify admins about failed blockchain log %s", entry.id)


# ── Confirmation and retries (used by the background job and the confirm endpoint) ──

def confirm_log(blockchain_log_id, db: Session) -> Optional[BlockchainLog]:
    """
    Check whether a pending transaction has been mined.
    Updates block_number and status in-place; returns the refreshed entry.
    Returns None if Web3 is not configured or the entry has no tx_hash.
    """
    if not _is_configured():
        return None

    entry = db.query(BlockchainLog).filter(BlockchainLog.id == blockchain_log_id).first()
    if not entry or not entry.transaction_hash:
        return None

    from web3.exceptions import TransactionNotFound

    try:
        _ensure_web3()
        tx_hash = normalize_tx_hash(entry.transaction_hash)
        try:
            receipt = _w3.eth.get_transaction_receipt(tx_hash)
        except TransactionNotFound:
            receipt = None

        if receipt:
            entry.block_number = receipt["blockNumber"]
            if receipt["status"] == 1:
                entry.status = "confirmed"
            else:
                entry.last_error = "Transaction reverted"
                _mark_failed(entry, db)
            db.commit()
            db.refresh(entry)
        elif _was_dropped(tx_hash, entry):
            # Clear the hash so the retry job sends it again (still bounded by max attempts).
            entry.transaction_hash = None
            entry.last_error = "Transaction was dropped by the network"
            db.commit()
            db.refresh(entry)
    except Exception:
        logger.exception("Could not confirm blockchain log %s", blockchain_log_id)

    return entry


def _was_dropped(tx_hash: str, entry: BlockchainLog) -> bool:
    from web3.exceptions import TransactionNotFound

    if datetime.utcnow() - entry.created_at < DROPPED_TX_AFTER:
        return False
    try:
        _w3.eth.get_transaction(tx_hash)
        return False  # still known to the network, just not mined yet
    except TransactionNotFound:
        return True


def retry_pending_logs(db: Session) -> int:
    """Resend pending rows that have no transaction yet. Returns how many were attempted."""
    if not _is_configured():
        return 0
    entries = db.query(BlockchainLog).filter(
        BlockchainLog.status == "pending",
        BlockchainLog.transaction_hash.is_(None),
    ).all()
    for entry in entries:
        _attempt_send(entry, db)
        db.commit()
    return len(entries)


def confirm_pending_logs(db: Session) -> int:
    """Check receipts for sent-but-unconfirmed rows. Returns how many were checked."""
    if not _is_configured():
        return 0
    ids = [row.id for row in db.query(BlockchainLog.id).filter(
        BlockchainLog.status == "pending",
        BlockchainLog.transaction_hash.isnot(None),
    ).all()]
    for log_id in ids:
        confirm_log(log_id, db)
    return len(ids)


# ── Integrity verification ────────────────────────────────────────────────────

def verify_report_integrity(report: MedicalReport, db: Session) -> dict:
    """
    Check a report end to end:
      1. the stored encrypted file still decrypts and hashes to the recorded SHA-256;
      2. the confirmed on-chain upload event carries that same hash for this report;
      3. that event was written by MedLock's wallet to MedLock's contract.
    Status is "verified" when all pass, "tampered" when any fails, and
    "unverifiable" when there is no confirmed on-chain record to compare against.
    """
    checks = []
    result = {
        "report_id": str(report.id),
        "recorded_hash": report.file_hash_sha256,
        "network": settings.ETHEREUM_NETWORK,
        "transaction_hash": None,
        "block_number": None,
        "explorer_url": None,
        "checks": checks,
    }

    checks.append(_check_stored_file(report))

    upload_log = db.query(BlockchainLog).filter(
        BlockchainLog.report_id == report.id,
        BlockchainLog.event_type == "upload",
        BlockchainLog.status == "confirmed",
    ).order_by(BlockchainLog.created_at).first()

    if not _is_configured() or not upload_log:
        result["status"] = "tampered" if not checks[0]["passed"] else "unverifiable"
        result["reason"] = (
            "Blockchain verification is not configured on this server."
            if not _is_configured()
            else "This report has no confirmed blockchain record yet."
        )
        return result

    tx_hash = normalize_tx_hash(upload_log.transaction_hash)
    result.update(
        transaction_hash=tx_hash,
        block_number=upload_log.block_number,
        explorer_url=explorer_tx_url(tx_hash),
    )
    checks.extend(_check_chain_record(report, tx_hash))

    result["status"] = "verified" if all(c["passed"] for c in checks) else "tampered"
    return result


def _check_stored_file(report: MedicalReport) -> dict:
    check = {"check": "stored_file", "label": "Stored file matches its recorded hash", "passed": False}
    try:
        plaintext = decrypt_file(download_file(report.file_url), report.encryption_key_ref)
    except ValueError:
        # AES-GCM authentication fails if a single byte of the stored ciphertext changed.
        check["detail"] = "The stored file failed decryption, so it was modified."
        return check
    except Exception as exc:
        check["detail"] = f"The stored file could not be read: {exc}"
        return check
    actual_hash = sha256_hash(plaintext)
    check["passed"] = actual_hash == report.file_hash_sha256
    if not check["passed"]:
        check["detail"] = f"The stored file hashes to {actual_hash}."
    return check


def _check_chain_record(report: MedicalReport, tx_hash: str) -> list[dict]:
    from web3 import Web3
    from web3.logs import DISCARD

    hash_check = {"check": "chain_hash", "label": "Recorded hash matches the blockchain", "passed": False}
    source_check = {"check": "chain_source", "label": "Blockchain record was written by MedLock", "passed": False}
    try:
        _ensure_web3()
        receipt = _w3.eth.get_transaction_receipt(tx_hash)
        events = _contract.events.RecordLogged().process_receipt(receipt, errors=DISCARD)
    except Exception as exc:
        hash_check["detail"] = f"The blockchain record could not be read: {exc}"
        return [hash_check, source_check]

    report_key = _uuid_to_bytes32(report.id)
    event = next((e for e in events if bytes(e["args"]["reportId"]) == report_key), None)
    if event is None:
        hash_check["detail"] = "The transaction contains no record for this report."
        return [hash_check, source_check]

    on_chain_hash = bytes(event["args"]["fileHash"])
    hash_check["passed"] = on_chain_hash == _hex_to_bytes32(report.file_hash_sha256)
    if not hash_check["passed"]:
        hash_check["detail"] = f"The blockchain records hash {on_chain_hash.hex()}."

    contract_address = Web3.to_checksum_address(settings.ETHEREUM_CONTRACT_ADDRESS)
    source_check["passed"] = (
        event["args"]["caller"] == _account.address
        and event["address"] == contract_address
    )
    if not source_check["passed"]:
        source_check["detail"] = (
            f"Record was written by {event['args']['caller']} to {event['address']}, "
            f"not MedLock's wallet {_account.address} and contract {contract_address}."
        )
    return [hash_check, source_check]
