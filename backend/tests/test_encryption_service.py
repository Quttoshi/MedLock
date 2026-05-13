import pytest
import base64
from app.services.encryption_service import encrypt_file, decrypt_file, sha256_hash


class TestAESEncryption:
    def test_encrypt_returns_bytes_and_str(self):
        encrypted, key_ref = encrypt_file(b"hello world")
        assert isinstance(encrypted, bytes)
        assert isinstance(key_ref, str)

    def test_roundtrip_recovers_original(self):
        original = b"This is a medical report content."
        encrypted, key_ref = encrypt_file(original)
        decrypted = decrypt_file(encrypted, key_ref)
        assert decrypted == original

    def test_encrypted_differs_from_original(self):
        data = b"plaintext content"
        encrypted, _ = encrypt_file(data)
        assert encrypted != data

    def test_encrypted_length_overhead(self):
        data = b"x" * 100
        encrypted, _ = encrypt_file(data)
        assert len(encrypted) > len(data)

    def test_different_plaintexts_differ(self):
        enc1, _ = encrypt_file(b"content A")
        enc2, _ = encrypt_file(b"content B")
        assert enc1 != enc2

    def test_same_plaintext_different_nonce_each_call(self):
        data = b"same content"
        enc1, key1 = encrypt_file(data)
        enc2, key2 = encrypt_file(data)
        assert enc1 != enc2
        assert key1 != key2

    def test_wrong_key_ref_raises(self):
        data = b"sensitive data"
        encrypted, _ = encrypt_file(data)
        bad_nonce = base64.b64encode(b"\x00" * 16).decode()
        with pytest.raises(Exception):
            decrypt_file(encrypted, bad_nonce)

    def test_empty_file_roundtrip(self):
        encrypted, key_ref = encrypt_file(b"")
        decrypted = decrypt_file(encrypted, key_ref)
        assert decrypted == b""

    def test_large_file_roundtrip(self):
        data = b"A" * (5 * 1024 * 1024)
        encrypted, key_ref = encrypt_file(data)
        decrypted = decrypt_file(encrypted, key_ref)
        assert decrypted == data

    def test_binary_content_roundtrip(self):
        data = bytes(range(256)) * 100
        encrypted, key_ref = encrypt_file(data)
        assert decrypt_file(encrypted, key_ref) == data


class TestSHA256Hash:
    def test_returns_string(self):
        result = sha256_hash(b"test")
        assert isinstance(result, str)

    def test_known_empty_hash(self):
        expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        assert sha256_hash(b"") == expected

    def test_deterministic(self):
        data = b"deterministic content"
        assert sha256_hash(data) == sha256_hash(data)

    def test_different_content_different_hash(self):
        assert sha256_hash(b"abc") != sha256_hash(b"xyz")

    def test_hash_length_is_64_chars(self):
        assert len(sha256_hash(b"anything")) == 64

    def test_hash_is_hex(self):
        result = sha256_hash(b"hex test")
        int(result, 16)
