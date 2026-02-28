// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";
import {ZKVerifier} from "../src/ZKVerifier.sol";

/// @title FundingVerifierE2E
/// @notice End-to-end tests verifying a REAL Noir-generated funding proof on-chain.
///
/// The proof was generated from the circuit at packages/circuits/funding_proof using
/// BB 3.0.2 UltraHonkBackend with verifierTarget: 'evm' (keccak oracle, ZK-enabled).
///
/// Circuit: funding_proof (Noir 1.0.0-beta.15)
///   - Proves: balance >= minimumRequired without revealing balance
///   - Public inputs: [commitment_hash, minimum_required, asset_id]
///   - Private inputs: [balance, blinding]
///
/// Fixture: test/fixtures/funding-proof.json
contract FundingVerifierE2E is Test {
    HonkVerifier public verifier;
    ZKVerifier public router;
    address public owner;

    // ═════════════════════════════════════════════════════════════════════════
    // Fixture values (from test/fixtures/funding-proof.json)
    // ═════════════════════════════════════════════════════════════════════════

    // Public inputs in circuit ABI order (matches BB serialization)
    bytes32 constant PI_COMMITMENT_HASH = 0x18ff45f87e2ff8d6e7bb2a21794de36db9b9b682b85bb2b177e1ff32be7f0dd6;
    bytes32 constant PI_MINIMUM_REQUIRED = 0x0000000000000000000000000000000000000000000000000000000000000032; // = 50
    bytes32 constant PI_ASSET_ID = 0x000000000000000000000000000000000000000000000000000000000000abcd;

    // Semantic aliases for the router test
    uint256 constant MINIMUM_REQUIRED = 50;

    function setUp() public {
        verifier = new HonkVerifier();
        owner = makeAddr("owner");
        router = new ZKVerifier(owner);

        vm.prank(owner);
        router.setFundingVerifier(address(verifier));
    }

    /// @notice Load proof bytes from the JSON fixture
    function _loadProof() internal view returns (bytes memory) {
        string memory json = vm.readFile("test/fixtures/funding-proof.json");
        return vm.parseJsonBytes(json, ".proof");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Test 1: Real proof verifies via standalone HonkVerifier
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Verifies a real Noir-generated UltraHonk funding proof directly
    ///         against the BB-generated HonkVerifier contract.
    function test_realProofVerifiesStandalone() public view {
        bytes memory proof = _loadProof();

        // Public inputs in circuit ABI order: [commitment_hash, minimum_required, asset_id]
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = PI_COMMITMENT_HASH;
        publicInputs[1] = PI_MINIMUM_REQUIRED;
        publicInputs[2] = PI_ASSET_ID;

        bool valid = verifier.verify(proof, publicInputs);
        assertTrue(valid, "Real Noir proof must verify against HonkVerifier");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Test 2: Real proof verifies via ZKVerifier router
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Verifies the same proof routed through ZKVerifier.verifyFundingProof()
    ///         which packs (commitmentHash, minimumRequired, assetId) into bytes32[]
    ///         in the same order as the circuit ABI.
    function test_realProofVerifiesViaRouter() public {
        bytes memory proof = _loadProof();

        bool valid = router.verifyFundingProof(
            PI_COMMITMENT_HASH,
            MINIMUM_REQUIRED,
            PI_ASSET_ID,
            proof
        );
        assertTrue(valid, "Real proof must verify via ZKVerifier router");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Test 3: Gas profiling
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Measures gas cost of on-chain UltraHonk proof verification
    function test_verificationGasCost() public view {
        bytes memory proof = _loadProof();

        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = PI_COMMITMENT_HASH;
        publicInputs[1] = PI_MINIMUM_REQUIRED;
        publicInputs[2] = PI_ASSET_ID;

        uint256 gasBefore = gasleft();
        bool valid = verifier.verify(proof, publicInputs);
        uint256 gasUsed = gasBefore - gasleft();

        assertTrue(valid, "Proof must verify for gas measurement");

        console.log("========================================");
        console.log("  Funding Proof Verification Gas Report");
        console.log("========================================");
        console.log("  Proof size (bytes):  ", proof.length);
        console.log("  Public inputs:       ", publicInputs.length);
        console.log("  Gas used:            ", gasUsed);
        console.log("========================================");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Test 4: Tampered proof rejected
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that modifying a single byte in the proof causes rejection
    function test_tamperedProofReverts() public {
        bytes memory proof = _loadProof();

        // Tamper with a byte in the middle of the proof
        proof[proof.length / 2] = bytes1(uint8(proof[proof.length / 2]) ^ 0xFF);

        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = PI_COMMITMENT_HASH;
        publicInputs[1] = PI_MINIMUM_REQUIRED;
        publicInputs[2] = PI_ASSET_ID;

        vm.expectRevert();
        verifier.verify(proof, publicInputs);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Test 5: Wrong public inputs rejected
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that wrong public inputs cause rejection
    function test_wrongPublicInputsReverts() public {
        bytes memory proof = _loadProof();

        // Use wrong commitment hash
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = bytes32(uint256(0xDEAD)); // wrong commitment hash
        publicInputs[1] = PI_MINIMUM_REQUIRED;
        publicInputs[2] = PI_ASSET_ID;

        vm.expectRevert();
        verifier.verify(proof, publicInputs);
    }
}
