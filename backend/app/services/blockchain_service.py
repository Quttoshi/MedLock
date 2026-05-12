"""
Ethereum Sepolia blockchain logging service.

Logs medical record events (upload, access_grant, access_deny, revoke) as
on-chain transactions against the deployed MedLock.sol contract.

Gracefully degrades to status="failed" when Web3 is not configured so the
rest of the application continues to function without a wallet / contract.
"""
import uuid as uuid_module
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.blockchain_log import BlockchainLog

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

_SEPOLIA_CHAIN_ID = 11155111

_w3 = None
_contract = None
_account = None


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


def log_event(
    report_id,
    file_hash_sha256: str,
    event_type: str,
    db: Session,
) -> BlockchainLog:
    """
    Submit an on-chain event and persist a BlockchainLog row.

    The transaction is fire-and-forget — we store the tx_hash immediately
    with status="pending". Call confirm_log() later to update block_number
    and flip status to "confirmed".

    If Web3 is not configured the log is saved with status="failed" and
    no exception is raised.
    """
    entry = BlockchainLog(
        report_id=report_id,
        file_hash=file_hash_sha256,
        event_type=event_type,
        network="sepolia",
        status="pending",
    )
    db.add(entry)
    db.flush()

    if not _is_configured():
        entry.status = "failed"
        db.commit()
        db.refresh(entry)
        return entry

    try:
        _ensure_web3()

        report_bytes = _uuid_to_bytes32(report_id)
        hash_bytes = _hex_to_bytes32(file_hash_sha256)

        nonce = _w3.eth.get_transaction_count(_account.address)
        tx = _contract.functions.logEvent(report_bytes, hash_bytes, event_type).build_transaction(
            {
                "from": _account.address,
                "nonce": nonce,
                "gas": 100_000,
                "gasPrice": _w3.eth.gas_price,
                "chainId": _SEPOLIA_CHAIN_ID,
            }
        )
        signed = _account.sign_transaction(tx)
        tx_hash = _w3.eth.send_raw_transaction(signed.raw_transaction)
        entry.transaction_hash = tx_hash.hex()
        entry.status = "pending"

    except Exception:
        entry.status = "failed"

    db.commit()
    db.refresh(entry)
    return entry


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

    try:
        _ensure_web3()
        receipt = _w3.eth.get_transaction_receipt(entry.transaction_hash)
        if receipt:
            entry.block_number = receipt["blockNumber"]
            entry.status = "confirmed" if receipt["status"] == 1 else "failed"
            db.commit()
            db.refresh(entry)
    except Exception:
        pass

    return entry
