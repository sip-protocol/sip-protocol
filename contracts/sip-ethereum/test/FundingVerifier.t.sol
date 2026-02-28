// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";

/// @notice Tests for the BB-generated FundingVerifier (HonkVerifier)
contract FundingVerifierTest is Test {
  HonkVerifier public verifier;

  function setUp() public {
    verifier = new HonkVerifier();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Deployment
  // ═══════════════════════════════════════════════════════════════════════════

  function test_deploy_succeeds() public view {
    // Verifier deploys and has code
    assertTrue(address(verifier).code.length > 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty proof rejection
  // ═══════════════════════════════════════════════════════════════════════════

  function test_verify_revertsOnEmptyProof() public {
    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = bytes32(uint256(1)); // commitment_hash
    publicInputs[1] = bytes32(uint256(100)); // minimum_required
    publicInputs[2] = bytes32(uint256(0)); // asset_id

    vm.expectRevert();
    verifier.verify("", publicInputs);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Wrong public inputs count
  // ═══════════════════════════════════════════════════════════════════════════

  function test_verify_revertsOnWrongPublicInputsCount() public {
    // HonkVerifier expects exactly 3 public inputs (19 - 16 pairing points)
    bytes32[] memory publicInputs = new bytes32[](1);
    publicInputs[0] = bytes32(uint256(1));

    // Random proof data (won't matter — public inputs check comes first)
    bytes memory fakeProof = new bytes(32 * 100);

    vm.expectRevert();
    verifier.verify(fakeProof, publicInputs);
  }

  function test_verify_revertsOnZeroPublicInputs() public {
    bytes32[] memory publicInputs = new bytes32[](0);
    bytes memory fakeProof = new bytes(32 * 100);

    vm.expectRevert();
    verifier.verify(fakeProof, publicInputs);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Garbage proof rejection
  // ═══════════════════════════════════════════════════════════════════════════

  function test_verify_revertsOnGarbageProof() public {
    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = bytes32(uint256(0xdead));
    publicInputs[1] = bytes32(uint256(1000));
    publicInputs[2] = bytes32(uint256(0xbeef));

    // Construct garbage proof of a plausible length
    // The verifier will reject it during pairing/curve checks
    bytes memory garbageProof = new bytes(32 * 500);
    for (uint256 i = 0; i < garbageProof.length; i++) {
      garbageProof[i] = bytes1(uint8(i % 256));
    }

    vm.expectRevert();
    verifier.verify(garbageProof, publicInputs);
  }

  function test_verify_revertsOnShortGarbageProof() public {
    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = bytes32(uint256(1));
    publicInputs[1] = bytes32(uint256(100));
    publicInputs[2] = bytes32(uint256(0));

    // Too short to be a valid UltraHonk proof
    bytes memory shortProof = hex"deadbeef";

    vm.expectRevert();
    verifier.verify(shortProof, publicInputs);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Interface compatibility
  // ═══════════════════════════════════════════════════════════════════════════

  function test_verify_signatureMatchesIHonkVerifier() public view {
    // The HonkVerifier exposes verify(bytes,bytes32[]) -> bool
    // This test just confirms it compiles and is callable via the expected selector
    bytes4 selector = verifier.verify.selector;
    // verify(bytes,bytes32[]) = 0xd77a2509
    assertEq(selector, bytes4(keccak256("verify(bytes,bytes32[])")));
  }
}
