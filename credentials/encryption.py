"""
Credential encryption — AES-256-GCM.
Tokens are encrypted at rest; the key lives only in env / secrets manager.
"""
import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _derive_key(raw: str) -> bytes:
    """Pad / truncate raw key string to exactly 32 bytes."""
    key_bytes = raw.encode()
    return (key_bytes * ((32 // len(key_bytes)) + 1))[:32]


def encrypt_credential(data: dict, raw_key: str) -> str:
    """Encrypt a credential dict → base64(nonce + ciphertext)."""
    key = _derive_key(raw_key)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    plaintext = json.dumps(data).encode()
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    blob = base64.urlsafe_b64encode(nonce + ciphertext).decode()
    return blob


def decrypt_credential(blob: str, raw_key: str) -> dict:
    """Decrypt base64(nonce + ciphertext) → credential dict."""
    key = _derive_key(raw_key)
    aesgcm = AESGCM(key)
    raw = base64.urlsafe_b64decode(blob.encode())
    nonce, ciphertext = raw[:12], raw[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext)
