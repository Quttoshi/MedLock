import base64
import hashlib

from Crypto.Cipher import AES

from app.config import settings


def _get_master_key() -> bytes:
    return hashlib.sha256(settings.AES_SECRET_KEY.encode()).digest()


def encrypt_file(file_bytes: bytes) -> tuple[bytes, str]:
    key = _get_master_key()
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(file_bytes)
    # Pack as nonce(16) + tag(16) + ciphertext
    encrypted_data = cipher.nonce + tag + ciphertext
    key_ref = base64.b64encode(cipher.nonce).decode()
    return encrypted_data, key_ref


def decrypt_file(encrypted_data: bytes, key_ref: str) -> bytes:
    key = _get_master_key()
    nonce = base64.b64decode(key_ref)
    tag = encrypted_data[16:32]
    ciphertext = encrypted_data[32:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag)


def sha256_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()
