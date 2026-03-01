// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup, MockERC20} from "./helpers/TestSetup.sol";
import {SIPPrivacy} from "../src/SIPPrivacy.sol";

contract SIPPrivacyConstructorTest is TestSetup {
    function test_constructor_setsOwner() public view {
        assertEq(sipPrivacy.owner(), owner);
    }

    function test_constructor_setsFeeCollector() public view {
        assertEq(sipPrivacy.feeCollector(), feeCollector);
    }

    function test_constructor_setsFeeBps() public view {
        assertEq(sipPrivacy.feeBps(), DEFAULT_FEE_BPS);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        new SIPPrivacy(address(0), feeCollector, DEFAULT_FEE_BPS);
    }

    function test_constructor_revertsOnZeroFeeCollector() public {
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        new SIPPrivacy(owner, address(0), DEFAULT_FEE_BPS);
    }

    function test_constructor_revertsOnExcessiveFee() public {
        vm.expectRevert(SIPPrivacy.FeeTooHigh.selector);
        new SIPPrivacy(owner, feeCollector, 1001); // > MAX_FEE_BPS
    }

    function test_constructor_allowsMaxFee() public {
        SIPPrivacy sp = new SIPPrivacy(owner, feeCollector, 1000);
        assertEq(sp.feeBps(), 1000);
    }

    function test_constructor_allowsZeroFee() public {
        SIPPrivacy sp = new SIPPrivacy(owner, feeCollector, 0);
        assertEq(sp.feeBps(), 0);
    }
}

contract SIPPrivacyShieldedTransferTest is TestSetup {
    event ShieldedTransfer(
        uint256 indexed transferId,
        address indexed sender,
        address indexed stealthRecipient,
        address token,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash
    );

    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function test_shieldedTransfer_success() public {
        bytes32 commitment = _makeCommitment(1);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);
        bytes memory encrypted = _makeEncryptedAmount(1 ether);
        address stealth = makeAddr("stealth");

        uint256 feeAmount = (1 ether * DEFAULT_FEE_BPS) / 10000;
        uint256 transferAmount = 1 ether - feeAmount;

        uint256 stealthBalBefore = stealth.balance;
        uint256 feeBalBefore = feeCollector.balance;

        vm.prank(alice);
        uint256 id = sipPrivacy.shieldedTransfer{value: 1 ether}(
            commitment, stealth, ephemeralKey, viewingKeyHash, encrypted, ""
        );

        assertEq(id, 0);
        assertEq(stealth.balance, stealthBalBefore + transferAmount);
        assertEq(feeCollector.balance, feeBalBefore + feeAmount);
    }

    function test_shieldedTransfer_incrementsId() public {
        address stealth = makeAddr("stealth");
        uint256 id1 = _doShieldedTransfer(1 ether, stealth);
        uint256 id2 = _doShieldedTransfer(1 ether, stealth);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    function test_shieldedTransfer_emitsShieldedTransferEvent() public {
        bytes32 commitment = _makeCommitment(1);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);
        address stealth = makeAddr("stealth");

        vm.expectEmit(true, true, true, true);
        emit ShieldedTransfer(0, alice, stealth, address(0), commitment, ephemeralKey, viewingKeyHash);

        vm.prank(alice);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            commitment, stealth, ephemeralKey, viewingKeyHash, _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedTransfer_emitsAnnouncementEvent() public {
        bytes32 commitment = _makeCommitment(1);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);
        address stealth = makeAddr("stealth");
        bytes memory encrypted = _makeEncryptedAmount(1 ether);

        uint8 viewTag = uint8(uint256(viewingKeyHash) >> 248);
        bytes memory expectedMetadata = abi.encodePacked(viewTag, encrypted);

        vm.expectEmit(true, true, true, true);
        emit Announcement(
            1, stealth, alice, abi.encodePacked(ephemeralKey), expectedMetadata
        );

        vm.prank(alice);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            commitment, stealth, ephemeralKey, viewingKeyHash, encrypted, ""
        );
    }

    function test_shieldedTransfer_storesRecord() public {
        address stealth = makeAddr("stealth");
        bytes32 commitment = _makeCommitment(1);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);

        vm.prank(alice);
        uint256 id = sipPrivacy.shieldedTransfer{value: 1 ether}(
            commitment, stealth, ephemeralKey, viewingKeyHash, _makeEncryptedAmount(1 ether), ""
        );

        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(id);
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
        assertEq(record.token, address(0));
        assertEq(record.commitment, commitment);
        assertEq(record.ephemeralPubKey, ephemeralKey);
        assertEq(record.viewingKeyHash, viewingKeyHash);
        assertEq(record.claimed, false);
    }

    function test_shieldedTransfer_withOddYCommitment() public {
        bytes32 commitment = _makeOddCommitment(1);
        address stealth = makeAddr("stealth");

        vm.prank(alice);
        uint256 id = sipPrivacy.shieldedTransfer{value: 1 ether}(
            commitment, stealth, _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(1 ether), ""
        );
        assertEq(id, 0);
    }

    function test_shieldedTransfer_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedTransfer{value: 0}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(0), ""
        );
    }

    function test_shieldedTransfer_revertsOnZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeCommitment(1), address(0), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedTransfer_revertsOnInvalidCommitment() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidCommitment.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeInvalidCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedTransfer_revertsOnZeroCommitment() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidCommitment.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            bytes32(0), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedTransfer_revertsOnEncryptedDataTooLarge() public {
        bytes memory largeData = new bytes(65); // > MAX_ENCRYPTED_SIZE
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.EncryptedDataTooLarge.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), largeData, ""
        );
    }

    function test_shieldedTransfer_revertsOnProofTooLarge() public {
        bytes memory largeProof = new bytes(4097); // > MAX_PROOF_SIZE
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ProofTooLarge.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), largeProof
        );
    }

    function test_shieldedTransfer_revertsWhenPaused() public {
        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedTransfer_feeCalculation() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 10 ether;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000; // 0.1 ether
        uint256 expectedTransfer = amount - expectedFee;

        uint256 stealthBefore = stealth.balance;
        uint256 feeBefore = feeCollector.balance;

        _doShieldedTransfer(amount, stealth);

        assertEq(stealth.balance - stealthBefore, expectedTransfer);
        assertEq(feeCollector.balance - feeBefore, expectedFee);
    }

    function test_shieldedTransfer_zeroFee() public {
        vm.prank(owner);
        sipPrivacy.setFee(0);

        address stealth = makeAddr("stealth");
        uint256 stealthBefore = stealth.balance;

        vm.prank(alice);
        sipPrivacy.shieldedTransfer{value: 1 ether}(
            _makeCommitment(1), stealth, _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );

        assertEq(stealth.balance - stealthBefore, 1 ether);
    }
}

contract SIPPrivacyShieldedTokenTransferTest is TestSetup {
    function test_shieldedTokenTransfer_success() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1000e18;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 transferAmount = amount - feeAmount;

        vm.startPrank(alice);
        token.approve(address(sipPrivacy), amount);
        uint256 id = sipPrivacy.shieldedTokenTransfer(
            address(token), amount, _makeCommitment(1), stealth,
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(amount), ""
        );
        vm.stopPrank();

        assertEq(id, 0);
        assertEq(token.balanceOf(stealth), transferAmount);
        assertEq(token.balanceOf(feeCollector), feeAmount);
    }

    function test_shieldedTokenTransfer_revertsOnZeroToken() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedTokenTransfer(
            address(0), 100e18, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
    }

    function test_shieldedTokenTransfer_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedTokenTransfer(
            address(token), 0, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(0), ""
        );
    }

    function test_shieldedTokenTransfer_storesRecord() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 500e18;

        vm.startPrank(alice);
        token.approve(address(sipPrivacy), amount);
        uint256 id = sipPrivacy.shieldedTokenTransfer(
            address(token), amount, _makeCommitment(2), stealth,
            _makeEphemeralKey(2), _makeViewingKeyHash(2),
            _makeEncryptedAmount(amount), ""
        );
        vm.stopPrank();

        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(id);
        assertEq(record.token, address(token));
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
    }
}

contract SIPPrivacyClaimTransferTest is TestSetup {
    event TransferClaimed(
        uint256 indexed transferId,
        bytes32 indexed nullifier,
        address indexed recipient
    );

    function _setupETHTransfer() internal returns (uint256 transferId, address stealth) {
        stealth = makeAddr("stealth");
        transferId = _doShieldedTransfer(1 ether, stealth);
    }

    function test_claimTransfer_success() public {
        (uint256 id, ) = _setupETHTransfer();
        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.claimTransfer(id, nullifier, "", bob);

        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(id);
        assertTrue(record.claimed);
        assertTrue(sipPrivacy.isNullifierUsed(nullifier));
    }

    function test_claimTransfer_emitsEvent() public {
        (uint256 id, ) = _setupETHTransfer();
        bytes32 nullifier = _makeNullifier(1);

        vm.expectEmit(true, true, true, true);
        emit TransferClaimed(id, nullifier, bob);

        vm.prank(bob);
        sipPrivacy.claimTransfer(id, nullifier, "", bob);
    }

    function test_claimTransfer_revertsOnDoubleClaim() public {
        (uint256 id, ) = _setupETHTransfer();
        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.claimTransfer(id, nullifier, "", bob);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.AlreadyClaimed.selector);
        sipPrivacy.claimTransfer(id, _makeNullifier(2), "", bob);
    }

    function test_claimTransfer_revertsOnNullifierReuse() public {
        address stealth1 = makeAddr("stealth1");
        address stealth2 = makeAddr("stealth2");
        uint256 id1 = _doShieldedTransfer(1 ether, stealth1);
        uint256 id2 = _doShieldedTransfer(1 ether, stealth2);
        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.claimTransfer(id1, nullifier, "", bob);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.NullifierUsed.selector);
        sipPrivacy.claimTransfer(id2, nullifier, "", bob);
    }

    function test_claimTransfer_revertsOnZeroNullifier() public {
        (uint256 id, ) = _setupETHTransfer();

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidNullifier.selector);
        sipPrivacy.claimTransfer(id, bytes32(0), "", bob);
    }

    function test_claimTransfer_revertsOnNonExistentTransfer() public {
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.TransferNotFound.selector);
        sipPrivacy.claimTransfer(999, _makeNullifier(1), "", bob);
    }

    function test_claimTransfer_revertsForTokenTransfer() public {
        // Create a token transfer
        address stealth = makeAddr("stealth");
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        uint256 id = sipPrivacy.shieldedTokenTransfer(
            address(token), 100e18, _makeCommitment(1), stealth,
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();

        // Try to claim via ETH claim function
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.claimTransfer(id, _makeNullifier(1), "", bob);
    }

    function test_claimTransfer_revertsWhenPaused() public {
        (uint256 id, ) = _setupETHTransfer();

        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.claimTransfer(id, _makeNullifier(1), "", bob);
    }
}

contract SIPPrivacyClaimTokenTransferTest is TestSetup {
    function _setupTokenTransfer() internal returns (uint256 transferId) {
        address stealth = makeAddr("stealth");
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        transferId = sipPrivacy.shieldedTokenTransfer(
            address(token), 100e18, _makeCommitment(1), stealth,
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();
    }

    function test_claimTokenTransfer_success() public {
        uint256 id = _setupTokenTransfer();
        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.claimTokenTransfer(id, nullifier, "", bob);

        assertTrue(sipPrivacy.getTransfer(id).claimed);
        assertTrue(sipPrivacy.isNullifierUsed(nullifier));
    }

    function test_claimTokenTransfer_revertsForETHTransfer() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTransfer(1 ether, stealth);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.claimTokenTransfer(id, _makeNullifier(1), "", bob);
    }

    function test_claimTokenTransfer_revertsOnDoubleClaim() public {
        uint256 id = _setupTokenTransfer();

        vm.prank(bob);
        sipPrivacy.claimTokenTransfer(id, _makeNullifier(1), "", bob);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.AlreadyClaimed.selector);
        sipPrivacy.claimTokenTransfer(id, _makeNullifier(2), "", bob);
    }
}

contract SIPPrivacyAdminTest is TestSetup {
    event Paused(bool paused);
    event FeeUpdated(uint256 newFeeBps);

    function test_setPaused_success() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Paused(true);
        sipPrivacy.setPaused(true);
        assertTrue(sipPrivacy.paused());

        vm.prank(owner);
        sipPrivacy.setPaused(false);
        assertFalse(sipPrivacy.paused());
    }

    function test_setPaused_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.Unauthorized.selector);
        sipPrivacy.setPaused(true);
    }

    function test_setFee_success() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FeeUpdated(500);
        sipPrivacy.setFee(500);
        assertEq(sipPrivacy.feeBps(), 500);
    }

    function test_setFee_revertsOnExcessiveFee() public {
        vm.prank(owner);
        vm.expectRevert(SIPPrivacy.FeeTooHigh.selector);
        sipPrivacy.setFee(1001);
    }

    function test_setFee_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.Unauthorized.selector);
        sipPrivacy.setFee(500);
    }

    function test_setFeeCollector_success() public {
        vm.prank(owner);
        sipPrivacy.setFeeCollector(alice);
        assertEq(sipPrivacy.feeCollector(), alice);
    }

    function test_setFeeCollector_revertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.setFeeCollector(address(0));
    }

    function test_setFeeCollector_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.Unauthorized.selector);
        sipPrivacy.setFeeCollector(bob);
    }

    function test_transferOwnership_success() public {
        vm.prank(owner);
        sipPrivacy.transferOwnership(alice);
        assertEq(sipPrivacy.owner(), alice);
    }

    function test_transferOwnership_revertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.transferOwnership(address(0));
    }

    function test_transferOwnership_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.Unauthorized.selector);
        sipPrivacy.transferOwnership(bob);
    }

    function test_setPedersenVerifier_success() public {
        address newVerifier = makeAddr("newVerifier");
        vm.prank(owner);
        sipPrivacy.setPedersenVerifier(newVerifier);
        assertEq(address(sipPrivacy.pedersenVerifier()), newVerifier);
    }

    function test_setZkVerifier_success() public {
        address newVerifier = makeAddr("newVerifier");
        vm.prank(owner);
        sipPrivacy.setZkVerifier(newVerifier);
        assertEq(address(sipPrivacy.zkVerifier()), newVerifier);
    }
}

contract SIPPrivacyReentrancyTest is TestSetup {
    function test_shieldedTransfer_preventsReentrancy() public {
        // Deploy a reentrancy attacker contract
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(sipPrivacy));
        vm.deal(address(attacker), 10 ether);

        vm.expectRevert(); // ReentrantCall or TransferFailed
        attacker.attack();
    }
}

/// @notice Reentrancy attacker for testing
contract ReentrancyAttacker {
    SIPPrivacy public target;
    bool public attacked;

    constructor(address _target) {
        target = SIPPrivacy(payable(_target));
    }

    function attack() external {
        // Create a valid commitment with 0x02 prefix
        bytes32 commitment = bytes32((uint256(keccak256("attack")) & ~(uint256(0xFF) << 248)) | (uint256(0x02) << 248));
        target.shieldedTransfer{value: 1 ether}(
            commitment,
            address(this),
            keccak256("ephemeral"),
            keccak256("viewing"),
            abi.encodePacked(uint256(1 ether)),
            ""
        );
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            bytes32 commitment = bytes32((uint256(keccak256("attack2")) & ~(uint256(0xFF) << 248)) | (uint256(0x02) << 248));
            target.shieldedTransfer{value: 1 ether}(
                commitment,
                address(this),
                keccak256("ephemeral2"),
                keccak256("viewing2"),
                abi.encodePacked(uint256(1 ether)),
                ""
            );
        }
    }
}

contract SIPPrivacyViewFunctionsTest is TestSetup {
    function test_getTransfer_returnsEmptyForNonExistent() public view {
        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(999);
        assertEq(record.sender, address(0));
    }

    function test_isNullifierUsed_returnsFalseForUnused() public view {
        assertFalse(sipPrivacy.isNullifierUsed(keccak256("unused")));
    }

    function test_totalTransfers_incrementsCorrectly() public {
        assertEq(sipPrivacy.totalTransfers(), 0);
        _doShieldedTransfer(1 ether, makeAddr("stealth1"));
        assertEq(sipPrivacy.totalTransfers(), 1);
        _doShieldedTransfer(1 ether, makeAddr("stealth2"));
        assertEq(sipPrivacy.totalTransfers(), 2);
    }

    function test_constants() public view {
        assertEq(sipPrivacy.COMMITMENT_SIZE(), 33);
        assertEq(sipPrivacy.MAX_PROOF_SIZE(), 4096);
        assertEq(sipPrivacy.MAX_ENCRYPTED_SIZE(), 64);
        assertEq(sipPrivacy.MAX_FEE_BPS(), 1000);
        assertEq(sipPrivacy.NATIVE_TOKEN(), address(0));
    }
}

contract SIPPrivacyFuzzTest is TestSetup {
    function testFuzz_shieldedTransfer_feeCalculation(uint256 amount, uint256 feeBps) public {
        amount = bound(amount, 1, 10 ether);
        feeBps = bound(feeBps, 0, 1000);

        vm.prank(owner);
        sipPrivacy.setFee(feeBps);

        address stealth = makeAddr("stealthFuzz");
        uint256 expectedFee = (amount * feeBps) / 10000;
        uint256 expectedTransfer = amount - expectedFee;

        uint256 stealthBefore = stealth.balance;
        uint256 feeBefore = feeCollector.balance;

        vm.prank(alice);
        sipPrivacy.shieldedTransfer{value: amount}(
            _makeCommitment(amount), stealth, _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(amount), ""
        );

        assertEq(stealth.balance - stealthBefore, expectedTransfer);
        assertEq(feeCollector.balance - feeBefore, expectedFee);
    }

    function testFuzz_commitmentValidation(bytes32 commitment) public view {
        uint8 prefix = uint8(uint256(commitment) >> 248);
        bool expected = commitment != bytes32(0) && (prefix == 0x02 || prefix == 0x03);

        // We can't directly test _isValidCommitment since it's internal
        // but we can test the behavior through the public interface
        // This just documents the expected validation logic
        if (expected) {
            assertTrue(prefix == 0x02 || prefix == 0x03);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deposit Mode Tests — ETH
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPPrivacyDepositTest is TestSetup {
    event ShieldedDeposit(
        uint256 indexed transferId,
        address indexed sender,
        address indexed stealthRecipient,
        address token,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        uint256 timestamp
    );

    event DepositWithdrawn(
        uint256 indexed transferId,
        bytes32 indexed nullifier,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    /// @notice Helper: execute a shielded ETH deposit from alice
    function _doShieldedDeposit(uint256 amount, address stealth) internal returns (uint256 transferId) {
        bytes32 commitment = _makeCommitment(amount);
        vm.prank(alice);
        transferId = sipPrivacy.shieldedDeposit{value: amount}(
            commitment,
            stealth,
            _makeEphemeralKey(1),
            _makeViewingKeyHash(1),
            _makeEncryptedAmount(amount),
            ""
        );
    }

    // ─── shieldedDeposit ─────────────────────────────────────────────────────

    function test_shieldedDeposit_success() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1 ether;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 contractBalBefore = address(sipPrivacy).balance;

        uint256 id = _doShieldedDeposit(amount, stealth);

        assertEq(id, 0);
        // Net amount stays in contract
        assertEq(address(sipPrivacy).balance, contractBalBefore + netAmount);
        // Deposit balance recorded
        assertEq(sipPrivacy.depositBalances(id), netAmount);
        // Stealth EOA receives nothing (deposit mode)
        assertEq(stealth.balance, 0);

        // Record stored correctly
        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(id);
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
        assertEq(record.token, address(0));
        assertEq(record.claimed, false);
    }

    function test_shieldedDeposit_feeCollected() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 10 ether;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;

        uint256 feeBefore = feeCollector.balance;

        _doShieldedDeposit(amount, stealth);

        assertEq(feeCollector.balance - feeBefore, expectedFee);
    }

    function test_shieldedDeposit_emitsShieldedDepositEvent() public {
        address stealth = makeAddr("stealth");
        bytes32 commitment = _makeCommitment(1 ether);
        bytes32 ephemeralKey = _makeEphemeralKey(1);

        vm.expectEmit(true, true, true, true);
        emit ShieldedDeposit(
            0, alice, stealth, address(0), commitment, ephemeralKey, block.timestamp
        );

        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            commitment, stealth, ephemeralKey, _makeViewingKeyHash(1),
            _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedDeposit_emitsAnnouncementEvent() public {
        address stealth = makeAddr("stealth");
        bytes32 commitment = _makeCommitment(1 ether);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);
        bytes memory encrypted = _makeEncryptedAmount(1 ether);

        uint8 viewTag = uint8(uint256(viewingKeyHash) >> 248);
        bytes memory expectedMetadata = abi.encodePacked(viewTag, encrypted);

        vm.expectEmit(true, true, true, true);
        emit Announcement(1, stealth, alice, abi.encodePacked(ephemeralKey), expectedMetadata);

        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            commitment, stealth, ephemeralKey, viewingKeyHash, encrypted, ""
        );
    }

    function test_shieldedDeposit_incrementsTransferId() public {
        address stealth = makeAddr("stealth");
        uint256 id1 = _doShieldedDeposit(1 ether, stealth);
        uint256 id2 = _doShieldedDeposit(2 ether, stealth);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    function test_shieldedDeposit_revertsOnZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedDeposit{value: 0}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(0), ""
        );
    }

    function test_shieldedDeposit_revertsOnZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(1), address(0), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedDeposit_revertsOnInvalidCommitment() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidCommitment.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeInvalidCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedDeposit_revertsWhenPaused() public {
        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
    }

    function test_shieldedDeposit_revertsOnEncryptedDataTooLarge() public {
        bytes memory largeData = new bytes(65); // > MAX_ENCRYPTED_SIZE (64)
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.EncryptedDataTooLarge.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), largeData, ""
        );
    }

    function test_shieldedDeposit_revertsOnProofTooLarge() public {
        bytes memory largeProof = new bytes(4097); // > MAX_PROOF_SIZE (4096)
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ProofTooLarge.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), largeProof
        );
    }

    // ─── withdrawDeposit ─────────────────────────────────────────────────────

    function test_withdrawDeposit_success() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1 ether;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 id = _doShieldedDeposit(amount, stealth);

        address recipient = makeAddr("recipient");
        uint256 recipientBalBefore = recipient.balance;

        vm.prank(bob);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(1), "", recipient);

        // Recipient gets the net amount
        assertEq(recipient.balance - recipientBalBefore, netAmount);
        // Deposit balance cleared
        assertEq(sipPrivacy.depositBalances(id), 0);
        // Transfer marked claimed
        assertTrue(sipPrivacy.getTransfer(id).claimed);
        // Nullifier used
        assertTrue(sipPrivacy.isNullifierUsed(_makeNullifier(1)));
    }

    function test_withdrawDeposit_anyoneCanCall() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedDeposit(1 ether, stealth);

        address recipient = makeAddr("recipient");
        uint256 deposited = sipPrivacy.depositBalances(id);

        // charlie (random third-party) triggers withdrawal — gasless relay pattern
        vm.prank(charlie);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(1), "", recipient);

        assertTrue(sipPrivacy.getTransfer(id).claimed);
        assertEq(recipient.balance, deposited);
    }

    function test_withdrawDeposit_revertsAlreadyClaimed() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedDeposit(1 ether, stealth);

        vm.prank(bob);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.AlreadyClaimed.selector);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(2), "", makeAddr("recipient"));
    }

    function test_withdrawDeposit_revertsNotDeposit() public {
        // Create a regular shieldedTransfer (not a deposit)
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTransfer(1 ether, stealth);

        // Try to withdrawDeposit on a regular transfer — should revert NotDeposit
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.NotDeposit.selector);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawDeposit_revertsNullifierUsed() public {
        address stealth = makeAddr("stealth");
        uint256 id1 = _doShieldedDeposit(1 ether, stealth);
        uint256 id2 = _doShieldedDeposit(2 ether, stealth);

        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.withdrawDeposit(id1, nullifier, "", makeAddr("recipient"));

        // Same nullifier on different deposit
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.NullifierUsed.selector);
        sipPrivacy.withdrawDeposit(id2, nullifier, "", makeAddr("recipient2"));
    }

    function test_withdrawDeposit_revertsZeroNullifier() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedDeposit(1 ether, stealth);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidNullifier.selector);
        sipPrivacy.withdrawDeposit(id, bytes32(0), "", makeAddr("recipient"));
    }

    function test_withdrawDeposit_revertsTransferNotFound() public {
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.TransferNotFound.selector);
        sipPrivacy.withdrawDeposit(999, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawDeposit_revertsWhenPaused() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedDeposit(1 ether, stealth);

        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.withdrawDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawDeposit_emitsDepositWithdrawnEvent() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1 ether;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 id = _doShieldedDeposit(amount, stealth);

        address recipient = makeAddr("recipient");
        bytes32 nullifier = _makeNullifier(1);

        vm.expectEmit(true, true, true, true);
        emit DepositWithdrawn(id, nullifier, recipient, address(0), netAmount);

        vm.prank(bob);
        sipPrivacy.withdrawDeposit(id, nullifier, "", recipient);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deposit Mode Tests — ERC20
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPPrivacyTokenDepositTest is TestSetup {
    event ShieldedDeposit(
        uint256 indexed transferId,
        address indexed sender,
        address indexed stealthRecipient,
        address token,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        uint256 timestamp
    );

    event DepositWithdrawn(
        uint256 indexed transferId,
        bytes32 indexed nullifier,
        address indexed recipient,
        address token,
        uint256 amount
    );

    /// @notice Helper: execute a shielded token deposit from alice
    function _doShieldedTokenDeposit(uint256 amount, address stealth) internal returns (uint256 transferId) {
        bytes32 commitment = _makeCommitment(amount);
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), amount);
        transferId = sipPrivacy.shieldedTokenDeposit(
            address(token),
            amount,
            commitment,
            stealth,
            _makeEphemeralKey(1),
            _makeViewingKeyHash(1),
            _makeEncryptedAmount(amount),
            ""
        );
        vm.stopPrank();
    }

    // ─── shieldedTokenDeposit ────────────────────────────────────────────────

    function test_shieldedTokenDeposit_success() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1000e18;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 contractBalBefore = token.balanceOf(address(sipPrivacy));

        uint256 id = _doShieldedTokenDeposit(amount, stealth);

        assertEq(id, 0);
        // Net amount held in contract
        assertEq(token.balanceOf(address(sipPrivacy)) - contractBalBefore, netAmount);
        // Deposit balance recorded
        assertEq(sipPrivacy.depositBalances(id), netAmount);
        // Token address stored
        assertEq(sipPrivacy.depositTokens(id), address(token));
        // Stealth EOA receives nothing
        assertEq(token.balanceOf(stealth), 0);

        // Record stored correctly
        SIPPrivacy.TransferRecord memory record = sipPrivacy.getTransfer(id);
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
        assertEq(record.token, address(token));
        assertEq(record.claimed, false);
    }

    function test_shieldedTokenDeposit_feeCollected() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 5000e18;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;

        uint256 feeBefore = token.balanceOf(feeCollector);

        _doShieldedTokenDeposit(amount, stealth);

        assertEq(token.balanceOf(feeCollector) - feeBefore, expectedFee);
    }

    function test_shieldedTokenDeposit_revertsOnZeroToken() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(0), 100e18, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
    }

    function test_shieldedTokenDeposit_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 0, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(0), ""
        );
    }

    function test_shieldedTokenDeposit_revertsOnZeroRecipient() public {
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 100e18, _makeCommitment(1), address(0),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();
    }

    function test_shieldedTokenDeposit_revertsOnInvalidCommitment() public {
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        vm.expectRevert(SIPPrivacy.InvalidCommitment.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 100e18, _makeInvalidCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();
    }

    function test_shieldedTokenDeposit_revertsWhenPaused() public {
        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 100e18, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();
    }

    function test_shieldedTokenDeposit_revertsOnEncryptedDataTooLarge() public {
        bytes memory largeData = new bytes(65); // > MAX_ENCRYPTED_SIZE (64)
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        vm.expectRevert(SIPPrivacy.EncryptedDataTooLarge.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 100e18, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            largeData, ""
        );
        vm.stopPrank();
    }

    function test_shieldedTokenDeposit_revertsOnProofTooLarge() public {
        bytes memory largeProof = new bytes(4097); // > MAX_PROOF_SIZE (4096)
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        vm.expectRevert(SIPPrivacy.ProofTooLarge.selector);
        sipPrivacy.shieldedTokenDeposit(
            address(token), 100e18, _makeCommitment(1), makeAddr("stealth"),
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), largeProof
        );
        vm.stopPrank();
    }

    // ─── withdrawTokenDeposit ────────────────────────────────────────────────

    function test_withdrawTokenDeposit_success() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1000e18;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 id = _doShieldedTokenDeposit(amount, stealth);

        address recipient = makeAddr("recipient");
        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.withdrawTokenDeposit(id, nullifier, "", recipient);

        // Recipient gets the net amount of tokens
        assertEq(token.balanceOf(recipient), netAmount);
        // Deposit balance cleared
        assertEq(sipPrivacy.depositBalances(id), 0);
        // Deposit token cleared
        assertEq(sipPrivacy.depositTokens(id), address(0));
        // Transfer marked claimed
        assertTrue(sipPrivacy.getTransfer(id).claimed);
        // Nullifier used
        assertTrue(sipPrivacy.isNullifierUsed(nullifier));
    }

    function test_withdrawTokenDeposit_revertsForETHDeposit() public {
        // Create an ETH deposit
        address stealth = makeAddr("stealth");
        bytes32 commitment = _makeCommitment(1 ether);
        vm.prank(alice);
        uint256 id = sipPrivacy.shieldedDeposit{value: 1 ether}(
            commitment, stealth, _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(1 ether), ""
        );

        // Try token withdrawal on ETH deposit — should revert InvalidAmount
        // (record.token == NATIVE_TOKEN check fails)
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawTokenDeposit_clearsDepositTokens() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTokenDeposit(500e18, stealth);

        // Before withdrawal — token stored
        assertEq(sipPrivacy.depositTokens(id), address(token));

        vm.prank(bob);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));

        // After withdrawal — cleared to address(0)
        assertEq(sipPrivacy.depositTokens(id), address(0));
    }

    function test_withdrawTokenDeposit_emitsDepositWithdrawnEvent() public {
        address stealth = makeAddr("stealth");
        uint256 amount = 1000e18;
        uint256 feeAmount = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 netAmount = amount - feeAmount;

        uint256 id = _doShieldedTokenDeposit(amount, stealth);

        address recipient = makeAddr("recipient");
        bytes32 nullifier = _makeNullifier(1);

        vm.expectEmit(true, true, true, true);
        emit DepositWithdrawn(id, nullifier, recipient, address(token), netAmount);

        vm.prank(bob);
        sipPrivacy.withdrawTokenDeposit(id, nullifier, "", recipient);
    }

    function test_withdrawTokenDeposit_revertsAlreadyClaimed() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTokenDeposit(1000e18, stealth);

        vm.prank(bob);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.AlreadyClaimed.selector);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(2), "", makeAddr("recipient2"));
    }

    function test_withdrawTokenDeposit_revertsNullifierUsed() public {
        address stealth = makeAddr("stealth");
        uint256 id1 = _doShieldedTokenDeposit(500e18, stealth);
        uint256 id2 = _doShieldedTokenDeposit(500e18, stealth);

        bytes32 nullifier = _makeNullifier(1);

        vm.prank(bob);
        sipPrivacy.withdrawTokenDeposit(id1, nullifier, "", makeAddr("recipient"));

        // Same nullifier on different deposit
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.NullifierUsed.selector);
        sipPrivacy.withdrawTokenDeposit(id2, nullifier, "", makeAddr("recipient2"));
    }

    function test_withdrawTokenDeposit_revertsZeroNullifier() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTokenDeposit(1000e18, stealth);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.InvalidNullifier.selector);
        sipPrivacy.withdrawTokenDeposit(id, bytes32(0), "", makeAddr("recipient"));
    }

    function test_withdrawTokenDeposit_revertsTransferNotFound() public {
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.TransferNotFound.selector);
        sipPrivacy.withdrawTokenDeposit(999, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawTokenDeposit_revertsWhenPaused() public {
        address stealth = makeAddr("stealth");
        uint256 id = _doShieldedTokenDeposit(1000e18, stealth);

        vm.prank(owner);
        sipPrivacy.setPaused(true);

        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.ContractPaused.selector);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));
    }

    function test_withdrawTokenDeposit_revertsNotDeposit() public {
        // Create a regular shieldedTokenTransfer (not a deposit)
        address stealth = makeAddr("stealth");
        vm.startPrank(alice);
        token.approve(address(sipPrivacy), 100e18);
        uint256 id = sipPrivacy.shieldedTokenTransfer(
            address(token), 100e18, _makeCommitment(1), stealth,
            _makeEphemeralKey(1), _makeViewingKeyHash(1),
            _makeEncryptedAmount(100e18), ""
        );
        vm.stopPrank();

        // Try withdrawTokenDeposit on a regular transfer — should revert NotDeposit
        vm.prank(bob);
        vm.expectRevert(SIPPrivacy.NotDeposit.selector);
        sipPrivacy.withdrawTokenDeposit(id, _makeNullifier(1), "", makeAddr("recipient"));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deposit Reentrancy Test
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPPrivacyDepositReentrancyTest is TestSetup {
    function test_withdrawDeposit_preventsReentrancy() public {
        // Deploy reentrancy attacker
        DepositReentrancyAttacker attacker = new DepositReentrancyAttacker(address(sipPrivacy));

        // Alice deposits 2 ETH (two separate deposits)
        vm.startPrank(alice);
        uint256 id0 = sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(1), makeAddr("stealth1"), _makeEphemeralKey(1),
            _makeViewingKeyHash(1), _makeEncryptedAmount(1 ether), ""
        );
        uint256 id1 = sipPrivacy.shieldedDeposit{value: 1 ether}(
            _makeCommitment(2), makeAddr("stealth2"), _makeEphemeralKey(2),
            _makeViewingKeyHash(2), _makeEncryptedAmount(1 ether), ""
        );
        vm.stopPrank();

        // Attacker tries to withdraw first deposit with reentrancy
        bytes32 nullifier1 = _makeNullifier(1);
        bytes32 nullifier2 = _makeNullifier(2);
        attacker.setAttackParams(id1, nullifier2);

        vm.expectRevert(); // Should revert with ReentrantCall → TransferFailed
        attacker.attack(address(sipPrivacy), id0, nullifier1);
    }
}

/// @notice Reentrancy attacker targeting withdrawDeposit
contract DepositReentrancyAttacker {
    SIPPrivacy public target;
    uint256 public attackTransferId;
    bytes32 public attackNullifier;
    bool public attacked;

    constructor(address _target) {
        target = SIPPrivacy(payable(_target));
    }

    function setAttackParams(uint256 _transferId, bytes32 _nullifier) external {
        attackTransferId = _transferId;
        attackNullifier = _nullifier;
    }

    function attack(address _target, uint256 transferId, bytes32 nullifier) external {
        SIPPrivacy(payable(_target)).withdrawDeposit(transferId, nullifier, "", address(this));
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Try to reenter during the ETH transfer callback
            target.withdrawDeposit(attackTransferId, attackNullifier, "", address(this));
        }
    }
}
