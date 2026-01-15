// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPedersenVerifier
 * @notice Interface for Pedersen commitment verification
 */
interface IPedersenVerifier {
    /**
     * @notice Verify a Pedersen commitment
     * @param commitment The commitment point (compressed)
     * @param value The claimed value
     * @param blinding The blinding factor
     * @return True if commitment = value*G + blinding*H
     */
    function verifyCommitment(
        bytes calldata commitment,
        uint256 value,
        bytes32 blinding
    ) external view returns (bool);

    /**
     * @notice Verify commitment format is valid
     * @param commitment The commitment bytes
     * @return True if valid compressed point format
     */
    function isValidFormat(bytes calldata commitment) external pure returns (bool);
}
