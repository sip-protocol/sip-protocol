"""
Type definitions for SIP Protocol Python SDK.

These types mirror the TypeScript definitions in @sip-protocol/types.
"""

from dataclasses import dataclass
from enum import Enum
from typing import NewType, Optional

# Type aliases
HexString = NewType("HexString", str)
"""A hex string with 0x prefix (e.g., '0x1234abcd')"""

ChainId = NewType("ChainId", str)
"""Chain identifier (e.g., 'ethereum', 'solana', 'near')"""

Hash = NewType("Hash", str)
"""A 32-byte hash as hex string with 0x prefix"""


@dataclass(frozen=True)
class StealthMetaAddress:
    """
    A stealth meta-address containing public keys for generating one-time addresses.

    Attributes:
        spending_key: Compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
        viewing_key: Compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
        chain: The blockchain this address is for
        label: Optional human-readable label
    """

    spending_key: HexString
    viewing_key: HexString
    chain: ChainId
    label: Optional[str] = None


@dataclass(frozen=True)
class StealthAddress:
    """
    A one-time stealth address derived from a meta-address.

    Attributes:
        address: The stealth address (compressed public key)
        ephemeral_public_key: The sender's ephemeral public key
        view_tag: First byte of shared secret hash for efficient scanning
    """

    address: HexString
    ephemeral_public_key: HexString
    view_tag: int


@dataclass(frozen=True)
class StealthAddressRecovery:
    """
    Recovery data for spending from a stealth address.

    Attributes:
        stealth_address: The stealth address being recovered
        ephemeral_public_key: The ephemeral key used to generate the address
        private_key: The derived private key for spending
    """

    stealth_address: HexString
    ephemeral_public_key: HexString
    private_key: HexString


@dataclass(frozen=True)
class PedersenCommitment:
    """
    A Pedersen commitment with its blinding factor.

    C = v*G + r*H where:
    - v = value (hidden)
    - r = blinding factor (random)
    - G, H = independent generators

    Attributes:
        commitment: The commitment point (compressed, 33 bytes)
        blinding: The blinding factor (32 bytes, secret)
    """

    commitment: HexString
    blinding: HexString


@dataclass(frozen=True)
class ViewingKey:
    """
    A viewing key for selective disclosure.

    Attributes:
        key: The viewing key (32 bytes)
        key_hash: SHA-256 hash of the key for indexing
        created_at: Unix timestamp of key creation
        label: Optional human-readable label
    """

    key: HexString
    key_hash: HexString
    created_at: int
    label: Optional[str] = None


class PrivacyLevel(str, Enum):
    """
    Privacy levels for SIP transactions.

    Attributes:
        TRANSPARENT: No privacy, all data public
        SHIELDED: Full privacy, sender/amount/recipient hidden
        COMPLIANT: Privacy with viewing key for auditors
    """

    TRANSPARENT = "transparent"
    SHIELDED = "shielded"
    COMPLIANT = "compliant"


@dataclass(frozen=True)
class EncryptedPayload:
    """
    Encrypted data with nonce for decryption.

    Attributes:
        ciphertext: The encrypted data (hex)
        nonce: The nonce/IV used for encryption (hex)
    """

    ciphertext: HexString
    nonce: HexString
