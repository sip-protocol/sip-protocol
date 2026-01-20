// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPedersenVerifier} from "./interfaces/IPedersenVerifier.sol";

/**
 * @title PedersenVerifier
 * @author SIP Protocol Team
 * @notice On-chain Pedersen commitment verification for secp256k1
 *
 * ## Overview
 *
 * A Pedersen commitment to value `v` with blinding factor `r` is:
 *
 * ```
 * C = v * G + r * H
 * ```
 *
 * Where:
 * - `v` = value (the amount being committed)
 * - `r` = blinding factor (random, keeps value hidden)
 * - `G` = secp256k1 base generator point
 * - `H` = independent generator point (NUMS construction)
 *
 * ## Security Properties
 *
 * - **Hiding**: Cannot determine value from commitment (information-theoretic)
 * - **Binding**: Cannot open commitment to different value (computational)
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
 *
 * ## Gas Costs
 *
 * Using ecMul and ecAdd precompiles:
 * - EC multiplication: ~6,000 gas
 * - EC addition: ~500 gas
 * - Full verification: ~15,000 gas
 *
 * ## Note
 *
 * This contract uses Ethereum's precompiled contracts for elliptic curve
 * operations (ecAdd at 0x06, ecMul at 0x07).
 */
contract PedersenVerifier is IPedersenVerifier {
    // ═══════════════════════════════════════════════════════════════════════════
    // Constants - secp256k1 curve parameters
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice secp256k1 field modulus p
    uint256 internal constant P =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;

    /// @notice secp256k1 curve order n
    uint256 internal constant N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    /// @notice Generator G x-coordinate
    uint256 internal constant Gx =
        0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;

    /// @notice Generator G y-coordinate
    uint256 internal constant Gy =
        0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;

    /// @notice Generator H x-coordinate (NUMS point for SIP)
    /// @dev Generated using hash-to-curve with domain separator "SIP-PEDERSEN-GENERATOR-H-v1"
    uint256 internal constant Hx =
        0x50929B74C1A04954B78B4B6035E97A5E078A5A0F28EC96D547BFEE9ACE803AC0;

    /// @notice Generator H y-coordinate
    uint256 internal constant Hy =
        0x31D3C6863973926E049E637CB1B5F40A36DAC28AF1766968C30C2313F3A38904;

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidCommitmentFormat();
    error InvalidScalar();
    error ECOperationFailed();
    error InvalidPointFormat();

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Verify a Pedersen commitment
     * @param commitment The commitment point (33 bytes compressed or 64 bytes uncompressed)
     * @param value The claimed value
     * @param blinding The blinding factor
     * @return True if C == value*G + blinding*H
     */
    function verifyCommitment(
        bytes calldata commitment,
        uint256 value,
        bytes32 blinding
    ) external view override returns (bool) {
        // Decompress commitment if needed
        (uint256 cx, uint256 cy) = _decompressPoint(commitment);

        // Compute expected commitment: C' = value*G + blinding*H
        (uint256 expectedX, uint256 expectedY) = _computeCommitment(value, uint256(blinding));

        // Check equality
        return (cx == expectedX && cy == expectedY);
    }

    /**
     * @notice Check if commitment has valid format
     * @param commitment The commitment bytes
     * @return True if valid compressed point format
     */
    function isValidFormat(bytes calldata commitment) external pure override returns (bool) {
        if (commitment.length == 33) {
            // Compressed format: 0x02 or 0x03 prefix
            uint8 prefix = uint8(commitment[0]);
            return prefix == 0x02 || prefix == 0x03;
        } else if (commitment.length == 64) {
            // Uncompressed format (just x, y coordinates)
            return true;
        }
        return false;
    }

    /**
     * @notice Verify that two commitments sum correctly (homomorphic property)
     * @param c1 First commitment (64 bytes: x, y)
     * @param c2 Second commitment (64 bytes: x, y)
     * @param cSum Expected sum commitment (64 bytes: x, y)
     * @return True if c1 + c2 == cSum
     */
    function verifyCommitmentSum(
        bytes calldata c1,
        bytes calldata c2,
        bytes calldata cSum
    ) external view returns (bool) {
        (uint256 c1x, uint256 c1y) = _decompressPoint(c1);
        (uint256 c2x, uint256 c2y) = _decompressPoint(c2);
        (uint256 sumX, uint256 sumY) = _decompressPoint(cSum);

        // Compute c1 + c2 using ecAdd precompile
        (uint256 expectedX, uint256 expectedY) = _ecAdd(c1x, c1y, c2x, c2y);

        return (expectedX == sumX && expectedY == sumY);
    }

    /**
     * @notice Compute a Pedersen commitment
     * @param value The value to commit
     * @param blinding The blinding factor
     * @return x X-coordinate of commitment
     * @return y Y-coordinate of commitment
     */
    function computeCommitment(
        uint256 value,
        uint256 blinding
    ) external view returns (uint256 x, uint256 y) {
        return _computeCommitment(value, blinding);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Compute C = value*G + blinding*H
     */
    function _computeCommitment(
        uint256 value,
        uint256 blinding
    ) internal view returns (uint256 x, uint256 y) {
        // Validate scalars are < N
        if (value >= N) revert InvalidScalar();
        if (blinding >= N) revert InvalidScalar();

        // Compute value * G
        (uint256 vgX, uint256 vgY) = _ecMul(Gx, Gy, value);

        // Compute blinding * H
        (uint256 bhX, uint256 bhY) = _ecMul(Hx, Hy, blinding);

        // Compute sum
        (x, y) = _ecAdd(vgX, vgY, bhX, bhY);
    }

    /**
     * @notice Decompress a point from compressed or uncompressed format
     * @param point The point bytes
     * @return x X-coordinate
     * @return y Y-coordinate
     */
    function _decompressPoint(bytes calldata point) internal view returns (uint256 x, uint256 y) {
        if (point.length == 64) {
            // Uncompressed: just x, y
            assembly {
                x := calldataload(point.offset)
                y := calldataload(add(point.offset, 32))
            }
        } else if (point.length == 33) {
            // Compressed: prefix + x
            uint8 prefix = uint8(point[0]);
            if (prefix != 0x02 && prefix != 0x03) revert InvalidPointFormat();

            assembly {
                x := calldataload(add(point.offset, 1))
            }

            // Compute y from x: y^2 = x^3 + 7 (mod p)
            y = _computeY(x, prefix == 0x03);
        } else {
            revert InvalidCommitmentFormat();
        }
    }

    /**
     * @notice Compute y-coordinate from x for secp256k1
     * @param x X-coordinate
     * @param odd Whether y should be odd
     * @return y Y-coordinate
     */
    function _computeY(uint256 x, bool odd) internal view returns (uint256 y) {
        // y^2 = x^3 + 7 (mod p)
        uint256 y2 = addmod(mulmod(mulmod(x, x, P), x, P), 7, P);

        // Compute modular square root using Tonelli-Shanks
        // For secp256k1, p ≡ 3 (mod 4), so sqrt(a) = a^((p+1)/4) (mod p)
        y = _modExp(y2, (P + 1) / 4, P);

        // Choose correct y based on parity
        if ((y % 2 == 1) != odd) {
            y = P - y;
        }
    }

    /**
     * @notice EC point multiplication using precompile
     * @param px Point x
     * @param py Point y
     * @param scalar Scalar to multiply
     * @return rx Result x
     * @return ry Result y
     */
    function _ecMul(
        uint256 px,
        uint256 py,
        uint256 scalar
    ) internal view returns (uint256 rx, uint256 ry) {
        // ecMul precompile at address 0x07
        bytes memory input = abi.encodePacked(px, py, scalar);
        (bool success, bytes memory result) = address(0x07).staticcall(input);

        if (!success || result.length != 64) revert ECOperationFailed();

        assembly {
            rx := mload(add(result, 32))
            ry := mload(add(result, 64))
        }
    }

    /**
     * @notice EC point addition using precompile
     * @param p1x First point x
     * @param p1y First point y
     * @param p2x Second point x
     * @param p2y Second point y
     * @return rx Result x
     * @return ry Result y
     */
    function _ecAdd(
        uint256 p1x,
        uint256 p1y,
        uint256 p2x,
        uint256 p2y
    ) internal view returns (uint256 rx, uint256 ry) {
        // ecAdd precompile at address 0x06
        bytes memory input = abi.encodePacked(p1x, p1y, p2x, p2y);
        (bool success, bytes memory result) = address(0x06).staticcall(input);

        if (!success || result.length != 64) revert ECOperationFailed();

        assembly {
            rx := mload(add(result, 32))
            ry := mload(add(result, 64))
        }
    }

    /**
     * @notice Modular exponentiation using precompile
     * @param base Base
     * @param exp Exponent
     * @param mod Modulus
     * @return result base^exp mod mod
     */
    function _modExp(
        uint256 base,
        uint256 exp,
        uint256 mod
    ) internal view returns (uint256 result) {
        // modexp precompile at address 0x05
        bytes memory input = abi.encodePacked(
            uint256(32), // base length
            uint256(32), // exponent length
            uint256(32), // modulus length
            base,
            exp,
            mod
        );

        assembly {
            // Call modexp precompile
            let success := staticcall(gas(), 0x05, add(input, 32), 192, 0x00, 32)
            if iszero(success) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }
}
