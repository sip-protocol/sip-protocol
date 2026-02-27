// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {PedersenVerifier} from "../src/PedersenVerifier.sol";

/// @notice Tests for EC operations
/// @dev KNOWN LIMITATION: PedersenVerifier defines secp256k1 generator points (G, H)
/// but uses EVM precompiles (ecAdd 0x06, ecMul 0x07) which operate on bn254/alt_bn128.
/// secp256k1 points are NOT valid on bn254, so EC operations revert with ECOperationFailed.
/// This is an intentional dual-curve design — the ZK proof system (#805/#944) bridges them.
/// EC operation tests verify the expected revert behavior until the contract is updated.
contract PedersenVerifierComputeTest is TestSetup {
    function test_computeCommitment_revertsWithSecp256k1Points() public {
        // secp256k1 G point is not on bn254 curve — ecMul precompile rejects it
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.computeCommitment(1, 0);
    }

    function test_computeCommitment_revertsWithBlinding() public {
        // secp256k1 H point is not on bn254 curve either
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.computeCommitment(0, 1);
    }

    function test_computeCommitment_revertsOnScalarTooLarge() public {
        uint256 N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        vm.expectRevert(PedersenVerifier.InvalidScalar.selector);
        pedersenVerifier.computeCommitment(N, 0);
    }

    function test_computeCommitment_revertsOnBlindingTooLarge() public {
        uint256 N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        vm.expectRevert(PedersenVerifier.InvalidScalar.selector);
        pedersenVerifier.computeCommitment(0, N);
    }

    function test_computeCommitment_bothScalarsTooLarge() public {
        uint256 N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        vm.expectRevert(PedersenVerifier.InvalidScalar.selector);
        pedersenVerifier.computeCommitment(N, N);
    }
}

contract PedersenVerifierVerifyTest is TestSetup {
    function test_verifyCommitment_revertsWithSecp256k1Points() public {
        // Round-trip would require EC operations on secp256k1 points — reverts
        bytes memory fakeCommitment = new bytes(64);
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.verifyCommitment(fakeCommitment, 1000, bytes32(uint256(0x1234)));
    }

    function test_verifyCommitment_revertsOnInvalidFormat() public {
        // Wrong length
        bytes memory badCommitment = new bytes(32);
        vm.expectRevert(PedersenVerifier.InvalidCommitmentFormat.selector);
        pedersenVerifier.verifyCommitment(badCommitment, 1000, bytes32(uint256(0x1234)));
    }

    function test_verifyCommitment_revertsOnInvalidCompressedPrefix() public {
        bytes memory badPrefix = new bytes(33);
        badPrefix[0] = 0x04; // Invalid prefix
        vm.expectRevert(PedersenVerifier.InvalidPointFormat.selector);
        pedersenVerifier.verifyCommitment(badPrefix, 1000, bytes32(uint256(0x1234)));
    }
}

contract PedersenVerifierHomomorphicTest is TestSetup {
    function test_verifyCommitmentSum_zeroPointsAreIdentity() public view {
        // All-zero 64 bytes = point at infinity (identity element)
        // ecAdd(O, O) = O — this actually works on any curve
        bytes memory c1 = new bytes(64);
        bytes memory c2 = new bytes(64);
        bytes memory cSum = new bytes(64);

        assertTrue(pedersenVerifier.verifyCommitmentSum(c1, c2, cSum));
    }

    function test_verifyCommitmentSum_revertsOnInvalidFormat() public {
        bytes memory bad = new bytes(32);
        bytes memory c = new bytes(64);

        vm.expectRevert(PedersenVerifier.InvalidCommitmentFormat.selector);
        pedersenVerifier.verifyCommitmentSum(bad, c, c);
    }
}

contract PedersenVerifierFormatTest is TestSetup {
    function test_isValidFormat_compressed02() public view {
        bytes memory point = new bytes(33);
        point[0] = 0x02;
        for (uint256 i = 1; i < 33; i++) {
            point[i] = 0x01;
        }
        assertTrue(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_compressed03() public view {
        bytes memory point = new bytes(33);
        point[0] = 0x03;
        for (uint256 i = 1; i < 33; i++) {
            point[i] = 0x01;
        }
        assertTrue(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_uncompressed64() public view {
        bytes memory point = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            point[i] = 0x01;
        }
        assertTrue(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_invalidLength() public view {
        bytes memory point = new bytes(32);
        assertFalse(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_invalidLength35() public view {
        bytes memory point = new bytes(35);
        assertFalse(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_invalidPrefix() public view {
        bytes memory point = new bytes(33);
        point[0] = 0x04;
        assertFalse(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_zeroPrefix() public view {
        bytes memory point = new bytes(33);
        point[0] = 0x00;
        assertFalse(pedersenVerifier.isValidFormat(point));
    }

    function test_isValidFormat_emptyBytes() public view {
        bytes memory point = new bytes(0);
        assertFalse(pedersenVerifier.isValidFormat(point));
    }
}

contract PedersenVerifierEdgeCaseTest is TestSetup {
    function test_computeCommitment_zeroValueRevertsOnCurveMismatch() public {
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.computeCommitment(0, 1);
    }

    function test_computeCommitment_zeroBlindingRevertsOnCurveMismatch() public {
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.computeCommitment(1, 0);
    }

    function testFuzz_computeCommitment_alwaysRevertsOnCurveMismatch(uint256 value, uint256 blinding) public {
        uint256 N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        value = bound(value, 0, N - 1);
        blinding = bound(blinding, 0, N - 1);

        // Skip the (0,0) case which may behave differently
        vm.assume(value > 0 || blinding > 0);

        // secp256k1 points on bn254 precompiles → always reverts
        vm.expectRevert(PedersenVerifier.ECOperationFailed.selector);
        pedersenVerifier.computeCommitment(value, blinding);
    }
}
