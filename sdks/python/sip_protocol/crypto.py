"""
Cryptographic utilities for SIP Protocol.

Provides low-level cryptographic primitives including:
- Hash functions (SHA-256)
- Random number generation
- Intent ID generation
"""

import hashlib
import secrets
from typing import Union

from .types import HexString, Hash


def hash_sha256(data: Union[str, bytes]) -> Hash:
    """
    Compute SHA-256 hash of data.

    Args:
        data: Input data as UTF-8 string or raw bytes

    Returns:
        32-byte hash as hex string with 0x prefix

    Example:
        >>> hash_sha256("Hello, SIP Protocol!")
        '0xabc123...'
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    return Hash(f"0x{digest}")


def generate_random_bytes(length: int) -> HexString:
    """
    Generate cryptographically secure random bytes.

    Uses the platform's secure random source.

    Args:
        length: Number of random bytes to generate

    Returns:
        Random bytes as hex string with 0x prefix

    Example:
        >>> generate_random_bytes(32)  # 32-byte private key
        '0xabc123...def'
    """
    random_bytes = secrets.token_bytes(length)
    return HexString(f"0x{random_bytes.hex()}")


def generate_intent_id() -> str:
    """
    Generate a unique intent identifier.

    Creates a cryptographically random intent ID with the `sip-` prefix.
    IDs are globally unique with negligible collision probability (128-bit).

    Returns:
        Intent ID string in format: `sip-<32 hex chars>`

    Example:
        >>> generate_intent_id()
        'sip-a1b2c3d4e5f67890a1b2c3d4e5f67890'
    """
    random_bytes = secrets.token_bytes(16)
    return f"sip-{random_bytes.hex()}"


def hex_to_bytes(hex_str: str) -> bytes:
    """
    Convert hex string to bytes.

    Args:
        hex_str: Hex string with or without 0x prefix

    Returns:
        Raw bytes
    """
    if hex_str.startswith("0x"):
        hex_str = hex_str[2:]
    return bytes.fromhex(hex_str)


def bytes_to_hex(data: bytes) -> HexString:
    """
    Convert bytes to hex string with 0x prefix.

    Args:
        data: Raw bytes

    Returns:
        Hex string with 0x prefix
    """
    return HexString(f"0x{data.hex()}")
