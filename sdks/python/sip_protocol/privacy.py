"""
Privacy and Viewing Key Implementation for SIP Protocol.

Provides:
- Viewing key generation and derivation
- XChaCha20-Poly1305 encryption/decryption
- Selective disclosure for compliance
"""

import hashlib
import secrets
import time
from typing import Optional

from Crypto.Cipher import ChaCha20_Poly1305

from .types import HexString, ViewingKey, EncryptedPayload, PrivacyLevel
from .crypto import hex_to_bytes, bytes_to_hex


def generate_viewing_key(label: Optional[str] = None) -> ViewingKey:
    """
    Generate a new viewing key for selective disclosure.

    Args:
        label: Optional human-readable label

    Returns:
        ViewingKey object with key and hash

    Example:
        >>> vk = generate_viewing_key("audit-2024")
        >>> print(vk.key_hash)
        '0xabc123...'
    """
    key = secrets.token_bytes(32)
    key_hash = hashlib.sha256(key).digest()
    created_at = int(time.time() * 1000)

    return ViewingKey(
        key=bytes_to_hex(key),
        key_hash=bytes_to_hex(key_hash),
        created_at=created_at,
        label=label,
    )


def derive_viewing_key_hash(viewing_key: HexString) -> HexString:
    """
    Derive the hash of a viewing key.

    This hash is used for indexing and verification without
    exposing the actual key.

    Args:
        viewing_key: The viewing key (32 bytes)

    Returns:
        SHA-256 hash of the viewing key

    Example:
        >>> key_hash = derive_viewing_key_hash(vk.key)
    """
    key_bytes = hex_to_bytes(viewing_key)
    hash_bytes = hashlib.sha256(key_bytes).digest()
    return bytes_to_hex(hash_bytes)


def encrypt_for_viewing_key(
    viewing_key: HexString, plaintext: bytes
) -> EncryptedPayload:
    """
    Encrypt data for viewing key holders.

    Uses XChaCha20-Poly1305 for authenticated encryption.

    Args:
        viewing_key: The viewing key (32 bytes)
        plaintext: Data to encrypt

    Returns:
        EncryptedPayload with ciphertext and nonce

    Example:
        >>> payload = encrypt_for_viewing_key(vk.key, b"secret data")
    """
    key_bytes = hex_to_bytes(viewing_key)

    # XChaCha20-Poly1305 requires 24-byte nonce
    nonce = secrets.token_bytes(24)

    cipher = ChaCha20_Poly1305.new(key=key_bytes, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    # Append tag to ciphertext for authenticated decryption
    ciphertext_with_tag = ciphertext + tag

    return EncryptedPayload(
        ciphertext=bytes_to_hex(ciphertext_with_tag),
        nonce=bytes_to_hex(nonce),
    )


def decrypt_with_viewing_key(
    viewing_key: HexString, payload: EncryptedPayload
) -> bytes:
    """
    Decrypt data using a viewing key.

    Args:
        viewing_key: The viewing key (32 bytes)
        payload: The encrypted payload (ciphertext + nonce)

    Returns:
        Decrypted plaintext

    Raises:
        ValueError: If decryption fails (wrong key or corrupted data)

    Example:
        >>> plaintext = decrypt_with_viewing_key(vk.key, payload)
    """
    key_bytes = hex_to_bytes(viewing_key)
    nonce_bytes = hex_to_bytes(payload.nonce)
    ciphertext_with_tag = hex_to_bytes(payload.ciphertext)

    # Split ciphertext and tag (tag is last 16 bytes)
    ciphertext = ciphertext_with_tag[:-16]
    tag = ciphertext_with_tag[-16:]

    cipher = ChaCha20_Poly1305.new(key=key_bytes, nonce=nonce_bytes)

    try:
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext
    except ValueError as e:
        raise ValueError(f"Decryption failed: {e}")


def validate_privacy_level(level: str) -> PrivacyLevel:
    """
    Validate and convert a string to PrivacyLevel enum.

    Args:
        level: String representation of privacy level

    Returns:
        PrivacyLevel enum value

    Raises:
        ValueError: If level is not valid
    """
    try:
        return PrivacyLevel(level.lower())
    except ValueError:
        valid = [e.value for e in PrivacyLevel]
        raise ValueError(f"Invalid privacy level: {level}. Valid options: {valid}")


def should_encrypt(level: PrivacyLevel) -> bool:
    """
    Determine if encryption should be used for a privacy level.

    Args:
        level: The privacy level

    Returns:
        True if data should be encrypted
    """
    return level in (PrivacyLevel.SHIELDED, PrivacyLevel.COMPLIANT)


def should_include_viewing_key(level: PrivacyLevel) -> bool:
    """
    Determine if viewing key should be included for a privacy level.

    Args:
        level: The privacy level

    Returns:
        True if viewing key should be included
    """
    return level == PrivacyLevel.COMPLIANT
