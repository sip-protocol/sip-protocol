// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHonkVerifier
/// @notice Interface for BB-generated UltraHonk verifiers
/// @dev Matches the verify() signature emitted by `bb contract` (Barretenberg)
interface IHonkVerifier {
  function verify(
    bytes calldata _proof,
    bytes32[] calldata _publicInputs
  ) external view returns (bool);
}
