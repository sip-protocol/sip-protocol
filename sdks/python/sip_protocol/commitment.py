"""
Pedersen Commitment Implementation for SIP Protocol.

Cryptographically secure Pedersen commitments on secp256k1.

Security Properties:
- Hiding (Computational): Cannot determine value from commitment
- Binding (Computational): Cannot open commitment to different value
- Homomorphic: C(v1) + C(v2) = C(v1 + v2) when blindings sum

Generator H Construction:
H is constructed using "nothing-up-my-sleeve" (NUMS) method to ensure
nobody knows the discrete log of H w.r.t. G.
"""

import hashlib
import secrets
from typing import Tuple, Dict

from coincurve import PublicKey, PrivateKey
from coincurve._libsecp256k1 import ffi, lib

from .types import HexString, PedersenCommitment
from .crypto import hex_to_bytes, bytes_to_hex


# Domain separation tag for H generation
H_DOMAIN = "SIP-PEDERSEN-GENERATOR-H-v1"

# secp256k1 curve order
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


def _generate_h() -> bytes:
    """
    Generate the independent generator H using NUMS method.

    Uses try-and-increment approach:
    1. Hash the domain separator to get a candidate x-coordinate
    2. Try to lift x to a curve point
    3. If it fails, increment counter and retry
    """
    for counter in range(256):
        # Create candidate x-coordinate
        input_data = f"{H_DOMAIN}:{counter}".encode("utf-8")
        hash_bytes = hashlib.sha256(input_data).digest()

        try:
            # Try to create a point from this x-coordinate (with even y)
            # The '02' prefix indicates compressed point with even y
            point_bytes = bytes([0x02]) + hash_bytes

            # Validate this is a valid curve point
            PublicKey(point_bytes)

            # Check it's not the identity or base point
            # (coincurve doesn't easily expose G, but this hash won't collide)
            return point_bytes
        except Exception:
            # Not a valid point, try next counter
            continue

    raise RuntimeError("Failed to generate H point - this should never happen")


# The independent generator H (NUMS point)
_H_BYTES = _generate_h()


def _point_multiply(scalar: int, point_bytes: bytes) -> bytes:
    """Multiply a point by a scalar."""
    # Use coincurve for point operations
    point = PublicKey(point_bytes)
    result = point.multiply(scalar.to_bytes(32, "big"))
    return result.format(compressed=True)


def _point_add(point1_bytes: bytes, point2_bytes: bytes) -> bytes:
    """Add two curve points."""
    point1 = PublicKey(point1_bytes)
    result = point1.combine([PublicKey(point2_bytes)])
    return result.format(compressed=True)


def _get_generator_g() -> bytes:
    """Get the base generator G."""
    # G is the public key for private key = 1
    priv = PrivateKey(b"\x00" * 31 + b"\x01")
    return priv.public_key.format(compressed=True)


_G_BYTES = _get_generator_g()


def commit(value: int, blinding: bytes = None) -> Tuple[HexString, HexString]:
    """
    Create a Pedersen commitment to a value.

    C = v*G + r*H

    Where:
    - v = value (the amount being committed)
    - r = blinding factor (random, keeps value hidden)
    - G = base generator
    - H = independent generator (NUMS)

    Args:
        value: The value to commit to (must be < curve order)
        blinding: Optional blinding factor (random 32 bytes if not provided)

    Returns:
        Tuple of (commitment, blinding) as hex strings

    Example:
        >>> commitment, blinding = commit(100)
        >>> verify_opening(commitment, 100, blinding)
        True
    """
    if value < 0:
        raise ValueError("Value must be non-negative")
    if value >= CURVE_ORDER:
        raise ValueError("Value must be less than curve order")

    # Generate or use provided blinding factor
    if blinding is None:
        blinding = secrets.token_bytes(32)
    elif len(blinding) != 32:
        raise ValueError("Blinding must be 32 bytes")

    # Ensure blinding is in valid range (mod n)
    r_scalar = int.from_bytes(blinding, "big") % CURVE_ORDER
    if r_scalar == 0:
        raise RuntimeError("CRITICAL: Zero blinding scalar - investigate RNG")

    # C = v*G + r*H
    if value == 0:
        # Only blinding contributes: C = r*H
        c_bytes = _point_multiply(r_scalar, _H_BYTES)
    else:
        # Normal case: C = v*G + r*H
        v_g = _point_multiply(value, _G_BYTES)
        r_h = _point_multiply(r_scalar, _H_BYTES)
        c_bytes = _point_add(v_g, r_h)

    return (bytes_to_hex(c_bytes), bytes_to_hex(blinding))


def verify_opening(commitment: HexString, value: int, blinding: HexString) -> bool:
    """
    Verify that a commitment opens to a specific value.

    Recomputes C' = v*G + r*H and checks if C' == C

    Args:
        commitment: The commitment point to verify
        value: The claimed value
        blinding: The blinding factor used

    Returns:
        True if the commitment opens correctly
    """
    try:
        # Parse the commitment point
        c_bytes = hex_to_bytes(commitment)

        # Recompute expected commitment
        blinding_bytes = hex_to_bytes(blinding)
        r_scalar = int.from_bytes(blinding_bytes, "big") % CURVE_ORDER

        if value == 0:
            expected = _point_multiply(r_scalar, _H_BYTES)
        else:
            v_g = _point_multiply(value, _G_BYTES)
            r_h = _point_multiply(r_scalar, _H_BYTES)
            expected = _point_add(v_g, r_h)

        return c_bytes == expected
    except Exception:
        return False


def commit_zero(blinding: bytes) -> Tuple[HexString, HexString]:
    """
    Create a commitment to zero with a specific blinding factor.

    C = 0*G + r*H = r*H

    Useful for creating balance proofs.

    Args:
        blinding: The blinding factor

    Returns:
        Tuple of (commitment, blinding)
    """
    return commit(0, blinding)


def add_commitments(c1: HexString, c2: HexString) -> HexString:
    """
    Add two commitments homomorphically.

    C1 + C2 = (v1*G + r1*H) + (v2*G + r2*H) = (v1+v2)*G + (r1+r2)*H

    Note: The blinding factors also add. If you need to verify the sum,
    you must also sum the blinding factors.

    Args:
        c1: First commitment point
        c2: Second commitment point

    Returns:
        Sum of commitments
    """
    c1_bytes = hex_to_bytes(c1)
    c2_bytes = hex_to_bytes(c2)
    result = _point_add(c1_bytes, c2_bytes)
    return bytes_to_hex(result)


def subtract_commitments(c1: HexString, c2: HexString) -> HexString:
    """
    Subtract two commitments homomorphically.

    C1 - C2 = (v1-v2)*G + (r1-r2)*H

    Args:
        c1: First commitment point
        c2: Second commitment point (to subtract)

    Returns:
        Difference of commitments
    """
    c1_bytes = hex_to_bytes(c1)
    c2_bytes = hex_to_bytes(c2)

    # Negate c2 by negating the y-coordinate (flip parity byte)
    c2_negated = bytes([0x03 if c2_bytes[0] == 0x02 else 0x02]) + c2_bytes[1:]

    result = _point_add(c1_bytes, c2_negated)
    return bytes_to_hex(result)


def add_blindings(b1: HexString, b2: HexString) -> HexString:
    """
    Add blinding factors (for use with homomorphic addition).

    Args:
        b1: First blinding factor
        b2: Second blinding factor

    Returns:
        Sum of blindings (mod curve order)
    """
    r1 = int.from_bytes(hex_to_bytes(b1), "big")
    r2 = int.from_bytes(hex_to_bytes(b2), "big")
    result = (r1 + r2) % CURVE_ORDER
    return bytes_to_hex(result.to_bytes(32, "big"))


def subtract_blindings(b1: HexString, b2: HexString) -> HexString:
    """
    Subtract blinding factors (for use with homomorphic subtraction).

    Args:
        b1: First blinding factor
        b2: Second blinding factor (to subtract)

    Returns:
        Difference of blindings (mod curve order)
    """
    r1 = int.from_bytes(hex_to_bytes(b1), "big")
    r2 = int.from_bytes(hex_to_bytes(b2), "big")
    result = (r1 - r2 + CURVE_ORDER) % CURVE_ORDER
    return bytes_to_hex(result.to_bytes(32, "big"))


def generate_blinding() -> HexString:
    """Generate a random blinding factor."""
    return bytes_to_hex(secrets.token_bytes(32))


def get_generators() -> Dict[str, Dict[str, HexString]]:
    """
    Get the generators for ZK proof integration.

    Returns the G and H points for use in ZK circuits.
    """
    g_point = PublicKey(_G_BYTES)
    h_point = PublicKey(_H_BYTES)

    # Get uncompressed format to extract x, y coordinates
    g_uncompressed = g_point.format(compressed=False)
    h_uncompressed = h_point.format(compressed=False)

    return {
        "G": {
            "x": bytes_to_hex(g_uncompressed[1:33]),
            "y": bytes_to_hex(g_uncompressed[33:]),
        },
        "H": {
            "x": bytes_to_hex(h_uncompressed[1:33]),
            "y": bytes_to_hex(h_uncompressed[33:]),
        },
    }
