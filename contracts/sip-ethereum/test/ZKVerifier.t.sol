// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZKVerifier} from "../src/ZKVerifier.sol";
import {IHonkVerifier} from "../src/interfaces/IHonkVerifier.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";

/// @notice Mock verifier that always returns true (for routing tests)
contract MockHonkVerifier is IHonkVerifier {
  bool public lastCallResult = true;

  function verify(
    bytes calldata,
    bytes32[] calldata
  ) external view override returns (bool) {
    return lastCallResult;
  }

  function setResult(bool _result) external {
    lastCallResult = _result;
  }
}

/// @notice Mock verifier that always reverts
contract RevertingHonkVerifier is IHonkVerifier {
  function verify(
    bytes calldata,
    bytes32[] calldata
  ) external pure override returns (bool) {
    revert("verification failed");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Constructor Tests
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierConstructorTest is Test {
  function test_constructor_setsOwner() public {
    address owner = makeAddr("owner");
    ZKVerifier zk = new ZKVerifier(owner);
    assertEq(zk.owner(), owner);
  }

  function test_constructor_enablesVerification() public {
    ZKVerifier zk = new ZKVerifier(makeAddr("owner"));
    assertTrue(zk.verificationEnabled());
  }

  function test_constructor_noVerifiersSet() public {
    ZKVerifier zk = new ZKVerifier(makeAddr("owner"));
    assertEq(address(zk.fundingVerifier()), address(0));
    assertEq(address(zk.validityVerifier()), address(0));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Admin Tests
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierAdminTest is Test {
  ZKVerifier public zk;
  address public owner;
  address public attacker;

  function setUp() public {
    owner = makeAddr("owner");
    attacker = makeAddr("attacker");
    zk = new ZKVerifier(owner);
  }

  function test_setFundingVerifier_success() public {
    address verifier = makeAddr("fundingVerifier");
    vm.prank(owner);
    zk.setFundingVerifier(verifier);
    assertEq(address(zk.fundingVerifier()), verifier);
  }

  function test_setFundingVerifier_emitsEvent() public {
    address verifier = makeAddr("fundingVerifier");
    vm.prank(owner);
    vm.expectEmit(false, false, false, true);
    emit ZKVerifier.VerifierUpdated("funding", verifier);
    zk.setFundingVerifier(verifier);
  }

  function test_setFundingVerifier_revertsForNonOwner() public {
    vm.prank(attacker);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.setFundingVerifier(makeAddr("verifier"));
  }

  function test_setValidityVerifier_success() public {
    address verifier = makeAddr("validityVerifier");
    vm.prank(owner);
    zk.setValidityVerifier(verifier);
    assertEq(address(zk.validityVerifier()), verifier);
  }

  function test_setValidityVerifier_emitsEvent() public {
    address verifier = makeAddr("validityVerifier");
    vm.prank(owner);
    vm.expectEmit(false, false, false, true);
    emit ZKVerifier.VerifierUpdated("validity", verifier);
    zk.setValidityVerifier(verifier);
  }

  function test_setValidityVerifier_revertsForNonOwner() public {
    vm.prank(attacker);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.setValidityVerifier(makeAddr("verifier"));
  }

  function test_setVerificationEnabled_success() public {
    vm.prank(owner);
    zk.setVerificationEnabled(false);
    assertFalse(zk.verificationEnabled());

    vm.prank(owner);
    zk.setVerificationEnabled(true);
    assertTrue(zk.verificationEnabled());
  }

  function test_setVerificationEnabled_revertsForNonOwner() public {
    vm.prank(attacker);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.setVerificationEnabled(false);
  }

  function test_transferOwnership_success() public {
    address newOwner = makeAddr("newOwner");
    vm.prank(owner);
    zk.transferOwnership(newOwner);
    assertEq(zk.owner(), newOwner);
  }

  function test_transferOwnership_revertsForNonOwner() public {
    vm.prank(attacker);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.transferOwnership(attacker);
  }

  function test_transferOwnership_revertsOnZeroAddress() public {
    vm.prank(owner);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.transferOwnership(address(0));
  }

  function test_transferOwnership_emitsEvent() public {
    address newOwner = makeAddr("newOwner");
    vm.prank(owner);
    vm.expectEmit(true, true, false, false);
    emit ZKVerifier.OwnershipTransferred(owner, newOwner);
    zk.transferOwnership(newOwner);
  }

  function test_transferOwnership_newOwnerCanAct() public {
    address newOwner = makeAddr("newOwner");
    vm.prank(owner);
    zk.transferOwnership(newOwner);

    // Old owner can no longer act
    vm.prank(owner);
    vm.expectRevert(ZKVerifier.Unauthorized.selector);
    zk.setVerificationEnabled(false);

    // New owner can act
    vm.prank(newOwner);
    zk.setVerificationEnabled(false);
    assertFalse(zk.verificationEnabled());
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// verifyProof() Tests — backwards compatibility
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierVerifyProofTest is Test {
  ZKVerifier public zk;
  address public owner;

  function setUp() public {
    owner = makeAddr("owner");
    zk = new ZKVerifier(owner);
  }

  function test_verifyProof_emptyProofReturnsTrue() public {
    // SIPPrivacy sends empty proofs — must return true
    bool result = zk.verifyProof(bytes32(uint256(1)), "");
    assertTrue(result);
  }

  function test_verifyProof_noVerifierRegisteredReturnsTrueForNonEmptyProof() public {
    // Graceful fallback — no verifier set, still returns true
    bool result = zk.verifyProof(bytes32(uint256(1)), hex"deadbeef");
    assertTrue(result);
  }

  function test_verifyProof_revertsWhenDisabled() public {
    vm.prank(owner);
    zk.setVerificationEnabled(false);

    vm.expectRevert(ZKVerifier.VerificationDisabled.selector);
    zk.verifyProof(bytes32(uint256(1)), "");
  }

  function test_verifyProof_routesToFundingVerifier() public {
    MockHonkVerifier mock = new MockHonkVerifier();
    vm.prank(owner);
    zk.setFundingVerifier(address(mock));

    // With a non-empty proof, it should route to the mock
    bool result = zk.verifyProof(bytes32(uint256(42)), hex"aabb");
    assertTrue(result);
  }

  function test_verifyProof_revertBubblesUpFromVerifier() public {
    RevertingHonkVerifier bad = new RevertingHonkVerifier();
    vm.prank(owner);
    zk.setFundingVerifier(address(bad));

    vm.expectRevert("verification failed");
    zk.verifyProof(bytes32(uint256(1)), hex"aabb");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// verifyFundingProof() Tests
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierFundingProofTest is Test {
  ZKVerifier public zk;
  address public owner;
  MockHonkVerifier public mock;

  function setUp() public {
    owner = makeAddr("owner");
    zk = new ZKVerifier(owner);
    mock = new MockHonkVerifier();

    vm.prank(owner);
    zk.setFundingVerifier(address(mock));
  }

  function test_verifyFundingProof_success() public {
    bool result = zk.verifyFundingProof(
      bytes32(uint256(0xabc)),
      1000,
      bytes32(uint256(0)),
      hex"cafebabe"
    );
    assertTrue(result);
  }

  function test_verifyFundingProof_revertsWithoutVerifier() public {
    // Deploy a fresh ZKVerifier with no funding verifier
    ZKVerifier fresh = new ZKVerifier(owner);

    vm.expectRevert(ZKVerifier.VerifierNotSet.selector);
    fresh.verifyFundingProof(
      bytes32(uint256(1)),
      100,
      bytes32(uint256(0)),
      hex"aa"
    );
  }

  function test_verifyFundingProof_revertsWhenDisabled() public {
    vm.prank(owner);
    zk.setVerificationEnabled(false);

    vm.expectRevert(ZKVerifier.VerificationDisabled.selector);
    zk.verifyFundingProof(
      bytes32(uint256(1)),
      100,
      bytes32(uint256(0)),
      hex"aa"
    );
  }

  function test_verifyFundingProof_propagatesFalse() public {
    mock.setResult(false);
    bool result = zk.verifyFundingProof(
      bytes32(uint256(1)),
      100,
      bytes32(uint256(0)),
      hex"aa"
    );
    assertFalse(result, "Should propagate false from verifier");
  }

  function test_verifyFundingProof_emitsEvent() public {
    vm.expectEmit(true, false, false, true);
    emit ZKVerifier.ProofVerified("funding", true);

    zk.verifyFundingProof(
      bytes32(uint256(0xabc)),
      1000,
      bytes32(uint256(0)),
      hex"cafebabe"
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// verifyValidityProof() Tests
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierValidityProofTest is Test {
  ZKVerifier public zk;
  address public owner;
  MockHonkVerifier public mock;

  function setUp() public {
    owner = makeAddr("owner");
    zk = new ZKVerifier(owner);
    mock = new MockHonkVerifier();

    vm.prank(owner);
    zk.setValidityVerifier(address(mock));
  }

  function test_verifyValidityProof_success() public {
    bool result = zk.verifyValidityProof(
      bytes32(uint256(0xdead)),
      bytes32(uint256(0xbeef)),
      bytes32(uint256(0xcafe)),
      hex"aabbccdd"
    );
    assertTrue(result);
  }

  function test_verifyValidityProof_revertsWithoutVerifier() public {
    ZKVerifier fresh = new ZKVerifier(owner);

    vm.expectRevert(ZKVerifier.VerifierNotSet.selector);
    fresh.verifyValidityProof(
      bytes32(uint256(1)),
      bytes32(uint256(2)),
      bytes32(uint256(3)),
      hex"aa"
    );
  }

  function test_verifyValidityProof_revertsWhenDisabled() public {
    vm.prank(owner);
    zk.setVerificationEnabled(false);

    vm.expectRevert(ZKVerifier.VerificationDisabled.selector);
    zk.verifyValidityProof(
      bytes32(uint256(1)),
      bytes32(uint256(2)),
      bytes32(uint256(3)),
      hex"aa"
    );
  }

  function test_verifyValidityProof_emitsEvent() public {
    vm.expectEmit(true, false, false, true);
    emit ZKVerifier.ProofVerified("validity", true);

    zk.verifyValidityProof(
      bytes32(uint256(0xdead)),
      bytes32(uint256(0xbeef)),
      bytes32(uint256(0xcafe)),
      hex"aabbccdd"
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Integration — Real HonkVerifier routing
// ═════════════════════════════════════════════════════════════════════════════

contract ZKVerifierIntegrationTest is Test {
  ZKVerifier public zk;
  HonkVerifier public honk;
  address public owner;

  function setUp() public {
    owner = makeAddr("owner");
    zk = new ZKVerifier(owner);
    honk = new HonkVerifier();

    vm.prank(owner);
    zk.setFundingVerifier(address(honk));
  }

  function test_integration_realVerifierRegistered() public view {
    assertEq(address(zk.fundingVerifier()), address(honk));
  }

  function test_integration_emptyProofStillReturnsTrue() public {
    // Even with real verifier registered, empty proof = true
    bool result = zk.verifyProof(bytes32(uint256(1)), "");
    assertTrue(result);
  }

  function test_integration_garbageProofRevertsViaRealVerifier() public {
    // Non-empty proof routes to real HonkVerifier which will reject garbage
    vm.expectRevert();
    zk.verifyProof(bytes32(uint256(1)), hex"deadbeef");
  }

  function test_integration_fundingProofGarbageReverts() public {
    vm.expectRevert();
    zk.verifyFundingProof(
      bytes32(uint256(1)),
      100,
      bytes32(uint256(0)),
      hex"deadbeefdeadbeef"
    );
  }
}
