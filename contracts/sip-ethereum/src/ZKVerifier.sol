// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerifier} from "./interfaces/IZKVerifier.sol";
import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";

/**
 * @title ZKVerifier
 * @author SIP Protocol Team
 * @notice ZK proof verification router for Noir/UltraHonk proofs
 *
 * Routes verification calls to BB-generated HonkVerifier instances.
 * Each proof type (funding, validity) has its own dedicated verifier
 * contract deployed from `bb contract` output.
 *
 * ## Architecture
 *
 * ```
 * SIPPrivacy.verifyProof(commitment, proof)
 *       │
 *       ▼
 * ZKVerifier (this contract) ──► IHonkVerifier(fundingVerifier).verify()
 *                             └─► IHonkVerifier(validityVerifier).verify()
 * ```
 *
 * ## Backwards Compatibility
 *
 * - verifyProof(): returns true for empty proofs (SIPPrivacy already
 *   gates on proof.length > 0, but we defend in depth). If a verifier
 *   is not yet registered, also returns true — graceful degradation
 *   so existing SIPPrivacy deployments keep working during migration.
 *
 * - verifyFundingProof() / verifyValidityProof(): strict — revert if
 *   the corresponding verifier is not set. These are called explicitly
 *   by callers who expect real verification.
 */
contract ZKVerifier is IZKVerifier {
  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  /// @notice Contract owner (can update verifiers and settings)
  address public owner;

  /// @notice Master switch — when false, all verification calls revert
  bool public verificationEnabled;

  /// @notice UltraHonk verifier for funding proofs (balance >= minimum)
  IHonkVerifier public fundingVerifier;

  /// @notice UltraHonk verifier for validity proofs (intent authorization)
  IHonkVerifier public validityVerifier;

  // ═══════════════════════════════════════════════════════════════════════════
  // Events
  // ═══════════════════════════════════════════════════════════════════════════

  /// @notice Emitted when a HonkVerifier address is updated
  event VerifierUpdated(string proofType, address verifier);

  /// @notice Emitted after successful proof verification
  event ProofVerified(string indexed proofType, bool valid);

  /// @notice Emitted when ownership is transferred
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  // ═══════════════════════════════════════════════════════════════════════════
  // Errors
  // ═══════════════════════════════════════════════════════════════════════════

  error Unauthorized();
  error VerifierNotSet();
  error VerificationDisabled();

  // ═══════════════════════════════════════════════════════════════════════════
  // Modifiers
  // ═══════════════════════════════════════════════════════════════════════════

  modifier onlyOwner() {
    if (msg.sender != owner) revert Unauthorized();
    _;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  /// @param _owner Contract owner who can register verifiers
  constructor(address _owner) {
    owner = _owner;
    verificationEnabled = true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IZKVerifier — Verification
  // ═══════════════════════════════════════════════════════════════════════════

  /// @inheritdoc IZKVerifier
  function verifyProof(
    bytes32 commitment,
    bytes calldata proof
  ) external override returns (bool) {
    if (!verificationEnabled) revert VerificationDisabled();

    // Empty proof → true (backwards compat with SIPPrivacy)
    if (proof.length == 0) return true;

    // If no funding verifier registered yet, return true (graceful fallback)
    if (address(fundingVerifier) == address(0)) return true;

    // Route to funding verifier with commitment as sole public input
    bytes32[] memory publicInputs = new bytes32[](1);
    publicInputs[0] = commitment;

    bool valid = fundingVerifier.verify(proof, publicInputs);
    emit ProofVerified("commitment", valid);
    return valid;
  }

  /// @inheritdoc IZKVerifier
  function verifyFundingProof(
    bytes32 commitmentHash,
    uint256 minimumRequired,
    bytes32 assetId,
    bytes calldata proof
  ) external override returns (bool) {
    if (!verificationEnabled) revert VerificationDisabled();
    if (address(fundingVerifier) == address(0)) revert VerifierNotSet();

    // Pack public inputs in circuit ABI order:
    // [commitment_hash, minimum_required, asset_id]
    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = commitmentHash;
    publicInputs[1] = bytes32(minimumRequired);
    publicInputs[2] = assetId;

    bool valid = fundingVerifier.verify(proof, publicInputs);
    emit ProofVerified("funding", valid);
    return valid;
  }

  /// @inheritdoc IZKVerifier
  function verifyValidityProof(
    bytes32 intentHash,
    bytes32 senderCommitment,
    bytes32 nullifier,
    bytes calldata proof
  ) external override returns (bool) {
    if (!verificationEnabled) revert VerificationDisabled();
    if (address(validityVerifier) == address(0)) revert VerifierNotSet();

    // Pack public inputs in circuit ABI order:
    // [intent_hash, sender_commitment, nullifier]
    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = intentHash;
    publicInputs[1] = senderCommitment;
    publicInputs[2] = nullifier;

    bool valid = validityVerifier.verify(proof, publicInputs);
    emit ProofVerified("validity", valid);
    return valid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Admin
  // ═══════════════════════════════════════════════════════════════════════════

  /// @notice Register or update the funding proof verifier
  /// @param _verifier Address of the deployed HonkVerifier for funding proofs
  function setFundingVerifier(address _verifier) external onlyOwner {
    fundingVerifier = IHonkVerifier(_verifier);
    emit VerifierUpdated("funding", _verifier);
  }

  /// @notice Register or update the validity proof verifier
  /// @param _verifier Address of the deployed HonkVerifier for validity proofs
  function setValidityVerifier(address _verifier) external onlyOwner {
    validityVerifier = IHonkVerifier(_verifier);
    emit VerifierUpdated("validity", _verifier);
  }

  /// @notice Enable or disable all verification
  /// @param _enabled New state
  function setVerificationEnabled(bool _enabled) external onlyOwner {
    verificationEnabled = _enabled;
  }

  /// @notice Transfer contract ownership
  /// @param _newOwner New owner address (cannot be zero)
  function transferOwnership(address _newOwner) external onlyOwner {
    if (_newOwner == address(0)) revert Unauthorized();
    address previousOwner = owner;
    owner = _newOwner;
    emit OwnershipTransferred(previousOwner, _newOwner);
  }
}
