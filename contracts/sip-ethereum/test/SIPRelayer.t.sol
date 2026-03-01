// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup, MockERC20} from "./helpers/TestSetup.sol";
import {SIPRelayer} from "../src/SIPRelayer.sol";
import {SIPPrivacy} from "../src/SIPPrivacy.sol";

// Gelato V1 relay address (used when chainId is in V1 list, e.g. mainnet/sepolia)
address constant GELATO_RELAY = 0xaBcC9b596420A9E9172FD5938620E265a0f9Df92;

// Gelato native ETH token identifier (used in calldata-appended fee context)
address constant GELATO_NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

// ═══════════════════════════════════════════════════════════════════════════════
// Constructor Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPRelayerConstructorTest is TestSetup {
    SIPRelayer public sipRelayer;

    function setUp() public override {
        super.setUp();

        // Deploy on mainnet chainId so GelatoRelayContractsUtils resolves V1 addresses
        vm.chainId(1);
        vm.prank(owner);
        sipRelayer = new SIPRelayer(address(sipPrivacy), owner);
    }

    function test_constructor_setsState() public view {
        assertEq(address(sipRelayer.sipPrivacy()), address(sipPrivacy));
        assertEq(sipRelayer.owner(), owner);
        assertEq(sipRelayer.paused(), false);
    }

    function test_constructor_revertsZeroSIPPrivacy() public {
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        new SIPRelayer(address(0), owner);
    }

    function test_constructor_revertsZeroOwner() public {
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        new SIPRelayer(address(sipPrivacy), address(0));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// relayedWithdrawETH Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPRelayerETHTest is TestSetup {
    SIPRelayer public sipRelayer;
    address public gelatoFeeCollector;

    // Re-declare events for vm.expectEmit
    event RelayedWithdrawal(
        uint256 indexed transferId,
        address indexed recipient,
        uint256 amount,
        uint256 gelatoFee
    );

    function setUp() public override {
        super.setUp();

        // Deploy SIPRelayer on mainnet chainId to get V1 relay address
        vm.chainId(1);
        vm.prank(owner);
        sipRelayer = new SIPRelayer(address(sipPrivacy), owner);

        gelatoFeeCollector = makeAddr("gelatoFeeCollector");

        // Fund GELATO_RELAY for gas costs
        vm.deal(GELATO_RELAY, 10 ether);
    }

    /// @notice Helper: deposit ETH into SIPPrivacy (funds stay in contract)
    function _depositETH(uint256 amount) internal returns (uint256 transferId) {
        vm.prank(alice);
        transferId = sipPrivacy.shieldedDeposit{value: amount}(
            _makeCommitment(amount),
            makeAddr("stealth"),
            _makeEphemeralKey(1),
            _makeViewingKeyHash(1),
            _makeEncryptedAmount(amount),
            ""
        );
    }

    /// @notice Helper: build Gelato relay calldata for relayedWithdrawETH
    function _buildETHRelayCalldata(
        uint256 transferId,
        bytes32 nullifier,
        address recipient,
        uint256 maxFee,
        uint256 gelatoFee
    ) internal view returns (bytes memory) {
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawETH.selector,
            transferId, nullifier, bytes(""), recipient, maxFee
        );
        return abi.encodePacked(data, gelatoFeeCollector, GELATO_NATIVE_TOKEN, gelatoFee);
    }

    /// @notice Helper: build Gelato relay calldata with custom feeToken
    function _buildETHRelayCalldataWithFeeToken(
        uint256 transferId,
        bytes32 nullifier,
        address recipient,
        uint256 maxFee,
        uint256 gelatoFee,
        address feeTokenAddr
    ) internal view returns (bytes memory) {
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawETH.selector,
            transferId, nullifier, bytes(""), recipient, maxFee
        );
        return abi.encodePacked(data, gelatoFeeCollector, feeTokenAddr, gelatoFee);
    }

    /// @notice Helper: execute relay call as Gelato
    function _executeRelay(bytes memory fullCalldata) internal returns (bool success, bytes memory returnData) {
        vm.prank(GELATO_RELAY);
        (success, returnData) = address(sipRelayer).call(fullCalldata);
    }

    function test_relayedWithdrawETH_success() public {
        uint256 depositAmount = 1 ether;
        uint256 transferId = _depositETH(depositAmount);

        // SIPPrivacy takes 1% fee, so net deposit = 0.99 ETH
        uint256 netDeposit = depositAmount - (depositAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 gelatoFee = 0.005 ether;
        uint256 maxFee = 0.01 ether;
        bytes32 nullifier = _makeNullifier(1);

        uint256 bobBalBefore = bob.balance;
        uint256 collectorBalBefore = gelatoFeeCollector.balance;

        bytes memory callData = _buildETHRelayCalldata(transferId, nullifier, bob, maxFee, gelatoFee);
        (bool success,) = _executeRelay(callData);
        assertTrue(success, "relay call failed");

        // Recipient gets (netDeposit - gelatoFee)
        assertEq(bob.balance, bobBalBefore + netDeposit - gelatoFee);
        // Gelato fee collector gets the fee
        assertEq(gelatoFeeCollector.balance, collectorBalBefore + gelatoFee);
    }

    function test_relayedWithdrawETH_emitsEvent() public {
        uint256 depositAmount = 1 ether;
        uint256 transferId = _depositETH(depositAmount);
        uint256 netDeposit = depositAmount - (depositAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 gelatoFee = 0.005 ether;
        uint256 maxFee = 0.01 ether;
        bytes32 nullifier = _makeNullifier(2);
        uint256 expectedRecipientAmount = netDeposit - gelatoFee;

        bytes memory callData = _buildETHRelayCalldata(transferId, nullifier, bob, maxFee, gelatoFee);

        vm.expectEmit(true, true, false, true, address(sipRelayer));
        emit RelayedWithdrawal(transferId, bob, expectedRecipientAmount, gelatoFee);

        vm.prank(GELATO_RELAY);
        (bool success,) = address(sipRelayer).call(callData);
        assertTrue(success, "relay call failed");
    }

    function test_relayedWithdrawETH_revertsNotGelatoRelay() public {
        uint256 transferId = _depositETH(1 ether);
        bytes32 nullifier = _makeNullifier(3);

        // Direct call from alice (not the Gelato relay)
        vm.prank(alice);
        vm.expectRevert("onlyGelatoRelay");
        sipRelayer.relayedWithdrawETH(transferId, nullifier, "", bob, 0.01 ether);
    }

    function test_relayedWithdrawETH_revertsWhenPaused() public {
        uint256 transferId = _depositETH(1 ether);
        uint256 gelatoFee = 0.005 ether;
        uint256 maxFee = 0.01 ether;
        bytes32 nullifier = _makeNullifier(4);

        // Pause the relayer
        vm.prank(owner);
        sipRelayer.setPaused(true);

        bytes memory callData = _buildETHRelayCalldata(transferId, nullifier, bob, maxFee, gelatoFee);
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert when paused");

        // Decode the custom error
        assertEq(bytes4(returnData), SIPRelayer.RelayerPaused.selector);
    }

    function test_relayedWithdrawETH_revertsZeroRecipient() public {
        uint256 transferId = _depositETH(1 ether);
        uint256 gelatoFee = 0.005 ether;
        uint256 maxFee = 0.01 ether;
        bytes32 nullifier = _makeNullifier(5);

        bytes memory callData = _buildETHRelayCalldata(
            transferId, nullifier, address(0), maxFee, gelatoFee
        );
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert for zero recipient");

        assertEq(bytes4(returnData), SIPRelayer.ZeroAddress.selector);
    }

    function test_relayedWithdrawETH_revertsFeeTokenMismatch() public {
        uint256 transferId = _depositETH(1 ether);
        uint256 gelatoFee = 0.005 ether;
        uint256 maxFee = 0.01 ether;
        bytes32 nullifier = _makeNullifier(6);

        // Pass an ERC20 address as feeToken in the Gelato context (should be native ETH)
        bytes memory callData = _buildETHRelayCalldataWithFeeToken(
            transferId, nullifier, bob, maxFee, gelatoFee, address(token)
        );
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert for fee token mismatch");

        assertEq(bytes4(returnData), SIPRelayer.FeeTokenMismatch.selector);
    }

    function test_relayedWithdrawETH_revertsMaxFeeExceeded() public {
        uint256 transferId = _depositETH(1 ether);
        uint256 gelatoFee = 0.05 ether; // Gelato charges 0.05 ETH
        uint256 maxFee = 0.01 ether; // But user only allows 0.01 ETH
        bytes32 nullifier = _makeNullifier(7);

        bytes memory callData = _buildETHRelayCalldata(transferId, nullifier, bob, maxFee, gelatoFee);
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert when fee exceeds maxFee");

        // GelatoRelayContext uses a require string, not a custom error
        // Decode as Error(string)
        assertEq(
            keccak256(returnData),
            keccak256(abi.encodeWithSignature(
                "Error(string)",
                "GelatoRelayContext._transferRelayFeeCapped: maxFee"
            ))
        );
    }

    function test_relayedWithdrawETH_revertsInsufficientBalance() public {
        // Deposit a very small amount so that after protocol fee + gelato fee, remaining = 0
        // Protocol fee at 1% = 100 bps
        // Deposit 0.005 ether → net = 0.00495 ether → gelato fee = 0.00495 → remaining = 0
        uint256 depositAmount = 0.005 ether;
        uint256 transferId = _depositETH(depositAmount);
        uint256 netDeposit = depositAmount - (depositAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 gelatoFee = netDeposit; // Fee exactly equals deposit = remaining is 0
        uint256 maxFee = netDeposit;
        bytes32 nullifier = _makeNullifier(8);

        bytes memory callData = _buildETHRelayCalldata(transferId, nullifier, bob, maxFee, gelatoFee);
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert when remaining is zero");

        assertEq(bytes4(returnData), SIPRelayer.InsufficientBalance.selector);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// relayedWithdrawToken Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPRelayerTokenTest is TestSetup {
    SIPRelayer public sipRelayer;
    address public gelatoFeeCollector;

    // Re-declare events for vm.expectEmit
    event RelayedTokenWithdrawal(
        uint256 indexed transferId,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 gelatoFee
    );

    function setUp() public override {
        super.setUp();

        // Deploy SIPRelayer on mainnet chainId to get V1 relay address
        vm.chainId(1);
        vm.prank(owner);
        sipRelayer = new SIPRelayer(address(sipPrivacy), owner);

        gelatoFeeCollector = makeAddr("gelatoFeeCollector");

        // Fund GELATO_RELAY for gas costs
        vm.deal(GELATO_RELAY, 10 ether);
    }

    /// @notice Helper: deposit ERC20 tokens into SIPPrivacy
    function _depositToken(uint256 amount) internal returns (uint256 transferId) {
        // Approve SIPPrivacy to pull tokens from alice
        vm.prank(alice);
        token.approve(address(sipPrivacy), amount);

        vm.prank(alice);
        transferId = sipPrivacy.shieldedTokenDeposit(
            address(token),
            amount,
            _makeCommitment(amount),
            makeAddr("stealth"),
            _makeEphemeralKey(1),
            _makeViewingKeyHash(1),
            _makeEncryptedAmount(amount),
            ""
        );
    }

    /// @notice Helper: build Gelato relay calldata for relayedWithdrawToken
    function _buildTokenRelayCalldata(
        uint256 transferId,
        bytes32 nullifier,
        address recipient,
        address tokenAddr,
        uint256 maxFee,
        uint256 gelatoFee
    ) internal view returns (bytes memory) {
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawToken.selector,
            transferId, nullifier, bytes(""), recipient, tokenAddr, maxFee
        );
        return abi.encodePacked(data, gelatoFeeCollector, tokenAddr, gelatoFee);
    }

    /// @notice Helper: build relay calldata with mismatched feeToken
    function _buildTokenRelayCalldataWithFeeToken(
        uint256 transferId,
        bytes32 nullifier,
        address recipient,
        address tokenAddr,
        uint256 maxFee,
        uint256 gelatoFee,
        address feeTokenAddr
    ) internal view returns (bytes memory) {
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawToken.selector,
            transferId, nullifier, bytes(""), recipient, tokenAddr, maxFee
        );
        return abi.encodePacked(data, gelatoFeeCollector, feeTokenAddr, gelatoFee);
    }

    /// @notice Helper: execute relay call as Gelato
    function _executeRelay(bytes memory fullCalldata) internal returns (bool success, bytes memory returnData) {
        vm.prank(GELATO_RELAY);
        (success, returnData) = address(sipRelayer).call(fullCalldata);
    }

    function test_relayedWithdrawToken_success() public {
        uint256 depositAmount = 1000e18;
        uint256 transferId = _depositToken(depositAmount);

        // Net deposit after 1% protocol fee
        uint256 netDeposit = depositAmount - (depositAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 gelatoFee = 5e18; // 5 tokens
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(10);

        uint256 bobTokenBefore = token.balanceOf(bob);
        uint256 collectorTokenBefore = token.balanceOf(gelatoFeeCollector);

        bytes memory callData = _buildTokenRelayCalldata(
            transferId, nullifier, bob, address(token), maxFee, gelatoFee
        );
        (bool success,) = _executeRelay(callData);
        assertTrue(success, "relay call failed");

        // Recipient gets (netDeposit - gelatoFee)
        assertEq(token.balanceOf(bob), bobTokenBefore + netDeposit - gelatoFee);
        // Gelato fee collector gets the fee
        assertEq(token.balanceOf(gelatoFeeCollector), collectorTokenBefore + gelatoFee);
    }

    function test_relayedWithdrawToken_emitsEvent() public {
        uint256 depositAmount = 1000e18;
        uint256 transferId = _depositToken(depositAmount);
        uint256 netDeposit = depositAmount - (depositAmount * DEFAULT_FEE_BPS) / 10000;
        uint256 gelatoFee = 5e18;
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(11);
        uint256 expectedRecipientAmount = netDeposit - gelatoFee;

        bytes memory callData = _buildTokenRelayCalldata(
            transferId, nullifier, bob, address(token), maxFee, gelatoFee
        );

        vm.expectEmit(true, true, true, true, address(sipRelayer));
        emit RelayedTokenWithdrawal(transferId, bob, address(token), expectedRecipientAmount, gelatoFee);

        vm.prank(GELATO_RELAY);
        (bool success,) = address(sipRelayer).call(callData);
        assertTrue(success, "relay call failed");
    }

    function test_relayedWithdrawToken_revertsNotGelatoRelay() public {
        uint256 transferId = _depositToken(1000e18);
        bytes32 nullifier = _makeNullifier(12);

        // Direct call from alice (not the Gelato relay)
        vm.prank(alice);
        vm.expectRevert("onlyGelatoRelay");
        sipRelayer.relayedWithdrawToken(transferId, nullifier, "", bob, address(token), 10e18);
    }

    function test_relayedWithdrawToken_revertsFeeTokenMismatch() public {
        uint256 transferId = _depositToken(1000e18);
        uint256 gelatoFee = 5e18;
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(13);

        // Pass a different token address as feeToken in Gelato context
        MockERC20 wrongToken = new MockERC20();
        bytes memory callData = _buildTokenRelayCalldataWithFeeToken(
            transferId, nullifier, bob, address(token), maxFee, gelatoFee, address(wrongToken)
        );
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert for fee token mismatch");

        assertEq(bytes4(returnData), SIPRelayer.FeeTokenMismatch.selector);
    }

    function test_relayedWithdrawToken_revertsZeroRecipient() public {
        uint256 transferId = _depositToken(1000e18);
        uint256 gelatoFee = 5e18;
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(14);

        bytes memory callData = _buildTokenRelayCalldata(
            transferId, nullifier, address(0), address(token), maxFee, gelatoFee
        );
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert for zero recipient");

        assertEq(bytes4(returnData), SIPRelayer.ZeroAddress.selector);
    }

    function test_relayedWithdrawToken_revertsZeroToken() public {
        // We can't actually deposit with address(0) as token (SIPPrivacy rejects it),
        // so we craft calldata that passes address(0) as the token param.
        // The ZeroAddress check on token happens before any external call.
        uint256 gelatoFee = 5e18;
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(15);

        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawToken.selector,
            uint256(0), nullifier, bytes(""), bob, address(0), maxFee
        );
        bytes memory callData = abi.encodePacked(data, gelatoFeeCollector, address(0), gelatoFee);

        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert for zero token");

        assertEq(bytes4(returnData), SIPRelayer.ZeroAddress.selector);
    }

    function test_relayedWithdrawToken_revertsWhenPaused() public {
        uint256 transferId = _depositToken(1000e18);
        uint256 gelatoFee = 5e18;
        uint256 maxFee = 10e18;
        bytes32 nullifier = _makeNullifier(16);

        // Pause the relayer
        vm.prank(owner);
        sipRelayer.setPaused(true);

        bytes memory callData = _buildTokenRelayCalldata(
            transferId, nullifier, bob, address(token), maxFee, gelatoFee
        );
        (bool success, bytes memory returnData) = _executeRelay(callData);
        assertFalse(success, "should revert when paused");

        assertEq(bytes4(returnData), SIPRelayer.RelayerPaused.selector);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPRelayerAdminTest is TestSetup {
    SIPRelayer public sipRelayer;

    // Re-declare events for vm.expectEmit
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public override {
        super.setUp();

        vm.chainId(1);
        vm.prank(owner);
        sipRelayer = new SIPRelayer(address(sipPrivacy), owner);
    }

    // ─── setPaused ───────────────────────────────────────────────────────────────

    function test_setPaused_success() public {
        // Pause
        vm.prank(owner);
        sipRelayer.setPaused(true);
        assertTrue(sipRelayer.paused());

        // Unpause
        vm.prank(owner);
        sipRelayer.setPaused(false);
        assertFalse(sipRelayer.paused());
    }

    function test_setPaused_emitsEvent() public {
        vm.expectEmit(false, false, false, true, address(sipRelayer));
        emit Paused(true);

        vm.prank(owner);
        sipRelayer.setPaused(true);
    }

    function test_setPaused_revertsNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPRelayer.Unauthorized.selector);
        sipRelayer.setPaused(true);
    }

    // ─── transferOwnership ───────────────────────────────────────────────────────

    function test_transferOwnership_success() public {
        vm.prank(owner);
        sipRelayer.transferOwnership(alice);
        assertEq(sipRelayer.owner(), alice);
    }

    function test_transferOwnership_emitsEvent() public {
        vm.expectEmit(true, true, false, false, address(sipRelayer));
        emit OwnershipTransferred(owner, alice);

        vm.prank(owner);
        sipRelayer.transferOwnership(alice);
    }

    function test_transferOwnership_revertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        sipRelayer.transferOwnership(address(0));
    }

    function test_transferOwnership_revertsNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPRelayer.Unauthorized.selector);
        sipRelayer.transferOwnership(bob);
    }

    // ─── rescueETH ──────────────────────────────────────────────────────────────

    function test_rescueETH_success() public {
        // Send stuck ETH to relayer
        uint256 stuckAmount = 1 ether;
        vm.deal(address(sipRelayer), stuckAmount);

        uint256 bobBalBefore = bob.balance;

        vm.prank(owner);
        sipRelayer.rescueETH(bob, stuckAmount);

        assertEq(bob.balance, bobBalBefore + stuckAmount);
        assertEq(address(sipRelayer).balance, 0);
    }

    function test_rescueETH_revertsNotOwner() public {
        vm.deal(address(sipRelayer), 1 ether);

        vm.prank(alice);
        vm.expectRevert(SIPRelayer.Unauthorized.selector);
        sipRelayer.rescueETH(alice, 1 ether);
    }

    function test_rescueETH_revertsZeroAddress() public {
        vm.deal(address(sipRelayer), 1 ether);

        vm.prank(owner);
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        sipRelayer.rescueETH(address(0), 1 ether);
    }

    // ─── rescueTokens ───────────────────────────────────────────────────────────

    function test_rescueTokens_success() public {
        // Send stuck tokens to relayer
        uint256 stuckAmount = 500e18;
        token.mint(address(sipRelayer), stuckAmount);

        uint256 bobTokenBefore = token.balanceOf(bob);

        vm.prank(owner);
        sipRelayer.rescueTokens(address(token), bob, stuckAmount);

        assertEq(token.balanceOf(bob), bobTokenBefore + stuckAmount);
        assertEq(token.balanceOf(address(sipRelayer)), 0);
    }

    function test_rescueTokens_revertsNotOwner() public {
        token.mint(address(sipRelayer), 500e18);

        vm.prank(alice);
        vm.expectRevert(SIPRelayer.Unauthorized.selector);
        sipRelayer.rescueTokens(address(token), alice, 500e18);
    }

    function test_rescueTokens_revertsZeroAddress() public {
        token.mint(address(sipRelayer), 500e18);

        vm.prank(owner);
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        sipRelayer.rescueTokens(address(token), address(0), 500e18);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Receive Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPRelayerReceiveTest is TestSetup {
    SIPRelayer public sipRelayer;

    function setUp() public override {
        super.setUp();

        vm.chainId(1);
        vm.prank(owner);
        sipRelayer = new SIPRelayer(address(sipPrivacy), owner);
    }

    function test_receive_acceptsETH() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        (bool success,) = address(sipRelayer).call{value: 1 ether}("");
        assertTrue(success, "should accept ETH via receive");
        assertEq(address(sipRelayer).balance, 1 ether);
    }
}
