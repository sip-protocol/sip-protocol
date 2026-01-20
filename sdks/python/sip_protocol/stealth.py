"""
Stealth Address Implementation for SIP Protocol.

Implements EIP-5564 style stealth addresses using secp256k1.
Used for Ethereum, Polygon, Arbitrum, Optimism, Base, Bitcoin, Zcash.

Stealth addresses provide unlinkable payments:
1. Sender generates one-time address from recipient's public meta-address
2. Recipient scans blockchain using view tag for efficient filtering
3. Only recipient can derive the private key to spend
"""

import hashlib
import secrets
from typing import Tuple, Optional

from coincurve import PublicKey, PrivateKey
from Crypto.Hash import keccak

from .types import (
    HexString,
    ChainId,
    StealthMetaAddress,
    StealthAddress,
    StealthAddressRecovery,
)
from .crypto import hex_to_bytes, bytes_to_hex


# secp256k1 curve order
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


def generate_stealth_meta_address(
    chain: ChainId, label: Optional[str] = None
) -> Tuple[StealthMetaAddress, HexString, HexString]:
    """
    Generate a new stealth meta-address keypair.

    Args:
        chain: The blockchain this address is for
        label: Optional human-readable label

    Returns:
        Tuple of (meta_address, spending_private_key, viewing_private_key)

    Example:
        >>> meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
        >>> print(meta.spending_key)
        '0x02abc...'
    """
    # Generate random private keys
    spending_private = secrets.token_bytes(32)
    viewing_private = secrets.token_bytes(32)

    # Derive public keys
    spending_pub = PrivateKey(spending_private).public_key.format(compressed=True)
    viewing_pub = PrivateKey(viewing_private).public_key.format(compressed=True)

    meta_address = StealthMetaAddress(
        spending_key=bytes_to_hex(spending_pub),
        viewing_key=bytes_to_hex(viewing_pub),
        chain=chain,
        label=label,
    )

    return (
        meta_address,
        bytes_to_hex(spending_private),
        bytes_to_hex(viewing_private),
    )


def generate_stealth_address(
    recipient_meta_address: StealthMetaAddress,
) -> Tuple[StealthAddress, HexString]:
    """
    Generate a one-time stealth address for a recipient.

    Protocol:
    1. Sender generates ephemeral keypair (r, R = r*G)
    2. Compute shared secret: S = r * P_spend
    3. Compute stealth address: A = Q_view + hash(S)*G
    4. View tag = first byte of hash(S) for efficient scanning

    Args:
        recipient_meta_address: The recipient's stealth meta-address

    Returns:
        Tuple of (stealth_address, shared_secret)

    Example:
        >>> stealth, secret = generate_stealth_address(recipient_meta)
        >>> print(stealth.address)
        '0x02def...'
    """
    # Generate ephemeral keypair
    ephemeral_private = secrets.token_bytes(32)
    ephemeral_pub = PrivateKey(ephemeral_private).public_key.format(compressed=True)

    # Parse recipient's keys
    spending_key_bytes = hex_to_bytes(recipient_meta_address.spending_key)
    viewing_key_bytes = hex_to_bytes(recipient_meta_address.viewing_key)

    # Compute shared secret: S = r * P_spend
    spending_point = PublicKey(spending_key_bytes)
    shared_secret_point = spending_point.multiply(ephemeral_private)
    shared_secret_bytes = shared_secret_point.format(compressed=True)

    # Hash the shared secret for use as a scalar
    shared_secret_hash = hashlib.sha256(shared_secret_bytes).digest()

    # Compute stealth address: A = Q_view + hash(S)*G
    # hash(S)*G
    hash_scalar = int.from_bytes(shared_secret_hash, "big") % CURVE_ORDER
    hash_times_g = PrivateKey(hash_scalar.to_bytes(32, "big")).public_key

    # Q_view + hash(S)*G
    viewing_point = PublicKey(viewing_key_bytes)
    stealth_point = viewing_point.combine([hash_times_g])
    stealth_address_bytes = stealth_point.format(compressed=True)

    # View tag (first byte of hash for efficient scanning)
    view_tag = shared_secret_hash[0]

    stealth_address = StealthAddress(
        address=bytes_to_hex(stealth_address_bytes),
        ephemeral_public_key=bytes_to_hex(ephemeral_pub),
        view_tag=view_tag,
    )

    return (stealth_address, bytes_to_hex(shared_secret_hash))


def derive_stealth_private_key(
    stealth_address: StealthAddress,
    spending_private_key: HexString,
    viewing_private_key: HexString,
) -> StealthAddressRecovery:
    """
    Derive the private key for a stealth address.

    Protocol:
    1. Compute shared secret: S = p_spend * R_ephemeral
    2. Derive stealth private key: q_view + hash(S) mod n

    Args:
        stealth_address: The stealth address to recover
        spending_private_key: Recipient's spending private key
        viewing_private_key: Recipient's viewing private key

    Returns:
        StealthAddressRecovery with the derived private key

    Example:
        >>> recovery = derive_stealth_private_key(stealth, spending_priv, viewing_priv)
        >>> # Use recovery.private_key to sign transactions
    """
    spending_priv_bytes = hex_to_bytes(spending_private_key)
    viewing_priv_bytes = hex_to_bytes(viewing_private_key)
    ephemeral_pub_bytes = hex_to_bytes(stealth_address.ephemeral_public_key)

    # Compute shared secret: S = p_spend * R_ephemeral
    ephemeral_point = PublicKey(ephemeral_pub_bytes)
    shared_secret_point = ephemeral_point.multiply(spending_priv_bytes)
    shared_secret_bytes = shared_secret_point.format(compressed=True)

    # Hash the shared secret
    shared_secret_hash = hashlib.sha256(shared_secret_bytes).digest()

    # Derive stealth private key: q_view + hash(S) mod n
    viewing_scalar = int.from_bytes(viewing_priv_bytes, "big")
    hash_scalar = int.from_bytes(shared_secret_hash, "big")
    stealth_private_scalar = (viewing_scalar + hash_scalar) % CURVE_ORDER

    stealth_private_key = stealth_private_scalar.to_bytes(32, "big")

    return StealthAddressRecovery(
        stealth_address=stealth_address.address,
        ephemeral_public_key=stealth_address.ephemeral_public_key,
        private_key=bytes_to_hex(stealth_private_key),
    )


def check_stealth_address(
    stealth_address: StealthAddress,
    spending_private_key: HexString,
    viewing_private_key: HexString,
) -> bool:
    """
    Check if a stealth address belongs to this recipient.

    Uses view tag for efficient filtering, then does full verification.

    Args:
        stealth_address: The stealth address to check
        spending_private_key: Recipient's spending private key
        viewing_private_key: Recipient's viewing private key

    Returns:
        True if the stealth address belongs to this recipient

    Example:
        >>> is_mine = check_stealth_address(stealth, spending_priv, viewing_priv)
    """
    spending_priv_bytes = hex_to_bytes(spending_private_key)
    viewing_priv_bytes = hex_to_bytes(viewing_private_key)
    ephemeral_pub_bytes = hex_to_bytes(stealth_address.ephemeral_public_key)

    try:
        # Compute shared secret
        ephemeral_point = PublicKey(ephemeral_pub_bytes)
        shared_secret_point = ephemeral_point.multiply(spending_priv_bytes)
        shared_secret_bytes = shared_secret_point.format(compressed=True)
        shared_secret_hash = hashlib.sha256(shared_secret_bytes).digest()

        # Quick view tag check
        if shared_secret_hash[0] != stealth_address.view_tag:
            return False

        # Full verification: derive expected stealth address
        viewing_scalar = int.from_bytes(viewing_priv_bytes, "big")
        hash_scalar = int.from_bytes(shared_secret_hash, "big")
        stealth_private_scalar = (viewing_scalar + hash_scalar) % CURVE_ORDER

        # Compute expected public key
        expected_pub = PrivateKey(
            stealth_private_scalar.to_bytes(32, "big")
        ).public_key.format(compressed=True)

        # Compare with provided stealth address
        provided_address = hex_to_bytes(stealth_address.address)
        return expected_pub == provided_address

    except Exception:
        return False


def public_key_to_eth_address(public_key: HexString) -> HexString:
    """
    Convert a secp256k1 public key to an Ethereum address.

    Algorithm (EIP-55):
    1. Decompress the public key to uncompressed form (65 bytes)
    2. Remove the 0x04 prefix (take last 64 bytes)
    3. keccak256 hash of the 64 bytes
    4. Take the last 20 bytes as the address
    5. Apply EIP-55 checksum

    Args:
        public_key: Compressed or uncompressed secp256k1 public key

    Returns:
        Checksummed Ethereum address

    Example:
        >>> eth_addr = public_key_to_eth_address(stealth.address)
        >>> print(eth_addr)
        '0x1234...abcd'
    """
    key_bytes = hex_to_bytes(public_key)

    # Decompress if needed
    if len(key_bytes) == 33:
        point = PublicKey(key_bytes)
        key_bytes = point.format(compressed=False)
    elif len(key_bytes) != 65:
        raise ValueError(f"Invalid public key length: {len(key_bytes)}")

    # Remove 0x04 prefix and keccak256 hash
    pub_key_without_prefix = key_bytes[1:]
    h = keccak.new(digest_bits=256)
    h.update(pub_key_without_prefix)
    address_hash = h.digest()

    # Take last 20 bytes
    address_bytes = address_hash[-20:]
    address_hex = address_bytes.hex()

    # Apply EIP-55 checksum
    h = keccak.new(digest_bits=256)
    h.update(address_hex.encode("ascii"))
    checksum_hash = h.hexdigest()

    checksummed = ""
    for i, char in enumerate(address_hex):
        if char in "0123456789":
            checksummed += char
        else:
            checksummed += char.upper() if int(checksum_hash[i], 16) >= 8 else char.lower()

    return HexString(f"0x{checksummed}")


def encode_stealth_meta_address(meta_address: StealthMetaAddress) -> str:
    """
    Encode a stealth meta-address to SIP format.

    Format: sip:<chain>:<spending_key>:<viewing_key>

    Args:
        meta_address: The meta-address to encode

    Returns:
        Encoded string

    Example:
        >>> encoded = encode_stealth_meta_address(meta)
        >>> print(encoded)
        'sip:ethereum:0x02abc...:0x03def...'
    """
    return f"sip:{meta_address.chain}:{meta_address.spending_key}:{meta_address.viewing_key}"


def decode_stealth_meta_address(encoded: str) -> StealthMetaAddress:
    """
    Decode a SIP-encoded stealth meta-address.

    Args:
        encoded: The encoded string (sip:<chain>:<spending>:<viewing>)

    Returns:
        StealthMetaAddress object

    Raises:
        ValueError: If the format is invalid
    """
    parts = encoded.split(":")
    if len(parts) != 4 or parts[0] != "sip":
        raise ValueError(f"Invalid stealth meta-address format: {encoded}")

    return StealthMetaAddress(
        chain=ChainId(parts[1]),
        spending_key=HexString(parts[2]),
        viewing_key=HexString(parts[3]),
    )
