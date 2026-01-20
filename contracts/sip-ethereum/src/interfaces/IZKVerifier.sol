// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IZKVerifier
 * @notice Interface for ZK proof verification (Noir/UltraHonk)
 */
interface IZKVerifier {
    /**
     * @notice Verify a ZK proof
     * @param commitment The commitment being proven
     * @param proof The serialized proof
     * @return True if proof is valid
     */
    function verifyProof(bytes32 commitment, bytes calldata proof) external returns (bool);

    /**
     * @notice Verify a funding proof (balance >= minimum)
     * @param commitmentHash Hash of the balance commitment
     * @param minimumRequired Minimum balance to prove
     * @param assetId Asset identifier
     * @param proof The serialized proof
     * @return True if proof is valid
     */
    function verifyFundingProof(
        bytes32 commitmentHash,
        uint256 minimumRequired,
        bytes32 assetId,
        bytes calldata proof
    ) external returns (bool);

    /**
     * @notice Verify a validity proof (intent authorization)
     * @param intentHash Hash of the intent
     * @param senderCommitment Commitment to sender identity
     * @param nullifier Prevents replay
     * @param proof The serialized proof
     * @return True if proof is valid
     */
    function verifyValidityProof(
        bytes32 intentHash,
        bytes32 senderCommitment,
        bytes32 nullifier,
        bytes calldata proof
    ) external returns (bool);
}
