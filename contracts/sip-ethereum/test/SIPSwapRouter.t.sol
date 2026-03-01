// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup, MockERC20, MockWETH, MockSwapRouter, MockAggregatorRouter} from "./helpers/TestSetup.sol";
import {SIPSwapRouter} from "../src/SIPSwapRouter.sol";

// ═══════════════════════════════════════════════════════════════════════════════
// Constructor Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterConstructorTest is TestSetup {
    function test_constructor_setsOwner() public view {
        assertEq(sipSwapRouter.owner(), owner);
    }

    function test_constructor_setsFeeCollector() public view {
        assertEq(sipSwapRouter.feeCollector(), feeCollector);
    }

    function test_constructor_setsFeeBps() public view {
        assertEq(sipSwapRouter.feeBps(), DEFAULT_FEE_BPS);
    }

    function test_constructor_setsSwapRouter() public view {
        assertEq(address(sipSwapRouter.swapRouter()), address(mockSwapRouter));
    }

    function test_constructor_setsWETH() public view {
        assertEq(address(sipSwapRouter.WETH()), address(weth));
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        new SIPSwapRouter(address(0), feeCollector, DEFAULT_FEE_BPS, address(mockSwapRouter), address(weth));
    }

    function test_constructor_revertsOnZeroFeeCollector() public {
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        new SIPSwapRouter(owner, address(0), DEFAULT_FEE_BPS, address(mockSwapRouter), address(weth));
    }

    function test_constructor_revertsOnZeroSwapRouter() public {
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        new SIPSwapRouter(owner, feeCollector, DEFAULT_FEE_BPS, address(0), address(weth));
    }

    function test_constructor_revertsOnZeroWETH() public {
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        new SIPSwapRouter(owner, feeCollector, DEFAULT_FEE_BPS, address(mockSwapRouter), address(0));
    }

    function test_constructor_revertsOnFeeTooHigh() public {
        vm.expectRevert(SIPSwapRouter.FeeTooHigh.selector);
        new SIPSwapRouter(owner, feeCollector, 1001, address(mockSwapRouter), address(weth));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETH Private Swap Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterETHSwapTest is TestSetup {
    address stealth;

    function setUp() public override {
        super.setUp();
        stealth = makeAddr("stealth");
    }

    function _defaultETHSwapParams() internal view returns (SIPSwapRouter.PrivateSwapParams memory) {
        return SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0, // ignored for ETH
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });
    }

    function test_privateSwap_ETH_success() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateSwap{value: 1 ether}(params);

        assertEq(swapId, 0);
        assertEq(sipSwapRouter.totalSwaps(), 1);

        // Output token should be at stealth address
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_privateSwap_ETH_feeDeduction() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        uint256 feeCollectorBefore = feeCollector.balance;

        vm.prank(alice);
        sipSwapRouter.privateSwap{value: 1 ether}(params);

        // 1% fee on 1 ETH = 0.01 ETH
        uint256 expectedFee = (1 ether * DEFAULT_FEE_BPS) / 10000;
        assertEq(feeCollector.balance - feeCollectorBefore, expectedFee);
    }

    function test_privateSwap_ETH_wrapsToWETH() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        vm.prank(alice);
        sipSwapRouter.privateSwap{value: 1 ether}(params);

        // WETH should have been deposited (swap amount after fee)
        // MockSwapRouter pulls WETH from SIPSwapRouter, so WETH balance
        // ends up in MockSwapRouter
        uint256 expectedSwapAmount = 1 ether - (1 ether * DEFAULT_FEE_BPS) / 10000;
        assertEq(weth.balanceOf(address(mockSwapRouter)), expectedSwapAmount);
    }

    function test_privateSwap_ETH_emitsShieldedSwapEvent() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();
        uint256 expectedSwapAmount = 1 ether - (1 ether * DEFAULT_FEE_BPS) / 10000;

        vm.expectEmit(true, true, true, true);
        emit SIPSwapRouter.ShieldedSwap(
            0,
            alice,
            stealth,
            address(0),
            address(outputToken),
            expectedSwapAmount,
            2000e6,
            params.commitment,
            params.ephemeralPubKey,
            params.viewingKeyHash
        );

        vm.prank(alice);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_privateSwap_ETH_emitsAnnouncementEvent() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        vm.expectEmit(true, true, true, false);
        emit SIPSwapRouter.Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealth,
            alice,
            "", // checked loosely
            ""
        );

        vm.prank(alice);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_privateSwap_ETH_storesSwapRecord() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateSwap{value: 1 ether}(params);

        SIPSwapRouter.SwapRecord memory record = sipSwapRouter.getSwap(swapId);
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
        assertEq(record.tokenIn, address(0));
        assertEq(record.tokenOut, address(outputToken));
        assertEq(record.commitment, params.commitment);
        assertEq(record.amountOut, 2000e6);
    }

    function test_privateSwap_ETH_revertsOnZeroValue() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidAmount.selector);
        sipSwapRouter.privateSwap{value: 0}(params);
    }

    function test_privateSwap_ETH_revertsOnInvalidCommitment() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();
        params.commitment = _makeInvalidCommitment(1);

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidCommitment.selector);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_privateSwap_ETH_revertsOnZeroRecipient() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();
        params.stealthRecipient = address(0);

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_privateSwap_ETH_revertsOnExpiredDeadline() public {
        vm.warp(1000);
        SIPSwapRouter.PrivateSwapParams memory params = _defaultETHSwapParams();
        params.deadline = block.timestamp - 1;

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.DeadlineExpired.selector);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERC20 Private Swap Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterERC20SwapTest is TestSetup {
    address stealth;

    function setUp() public override {
        super.setUp();
        stealth = makeAddr("stealth");
    }

    function _defaultERC20SwapParams() internal view returns (SIPSwapRouter.PrivateSwapParams memory) {
        return SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(token),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 1000e18,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(2),
            ephemeralPubKey: _makeEphemeralKey(2),
            viewingKeyHash: _makeViewingKeyHash(2),
            encryptedAmount: _makeEncryptedAmount(1000e18),
            deadline: 0
        });
    }

    function test_privateSwap_ERC20_success() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), params.amountIn);
        uint256 swapId = sipSwapRouter.privateSwap(params);
        vm.stopPrank();

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_privateSwap_ERC20_feeDeduction() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), params.amountIn);
        sipSwapRouter.privateSwap(params);
        vm.stopPrank();

        // 1% fee on 1000 tokens = 10 tokens
        uint256 expectedFee = (1000e18 * DEFAULT_FEE_BPS) / 10000;
        assertEq(token.balanceOf(feeCollector), expectedFee);
    }

    function test_privateSwap_ERC20_revertsOnZeroAmount() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();
        params.amountIn = 0;

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidAmount.selector);
        sipSwapRouter.privateSwap(params);
    }

    function test_privateSwap_ERC20_revertsOnInsufficientAllowance() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();

        // Don't approve
        vm.prank(alice);
        vm.expectRevert("Insufficient allowance");
        sipSwapRouter.privateSwap(params);
    }

    function test_privateSwap_ERC20_revertsOnEncryptedDataTooLarge() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();
        params.encryptedAmount = new bytes(65); // Exceeds MAX_ENCRYPTED_SIZE of 64

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), params.amountIn);
        vm.expectRevert(SIPSwapRouter.EncryptedDataTooLarge.selector);
        sipSwapRouter.privateSwap(params);
        vm.stopPrank();
    }

    function test_privateSwap_ERC20_storesSwapRecord() public {
        SIPSwapRouter.PrivateSwapParams memory params = _defaultERC20SwapParams();

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), params.amountIn);
        uint256 swapId = sipSwapRouter.privateSwap(params);
        vm.stopPrank();

        SIPSwapRouter.SwapRecord memory record = sipSwapRouter.getSwap(swapId);
        assertEq(record.sender, alice);
        assertEq(record.tokenIn, address(token));
        assertEq(record.tokenOut, address(outputToken));
        assertEq(record.amountOut, 2000e6);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-hop Swap Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterMultiSwapTest is TestSetup {
    address stealth;
    MockERC20 middleToken;

    function setUp() public override {
        super.setUp();
        stealth = makeAddr("stealth");
        middleToken = new MockERC20();
    }

    function _buildPath(address tokenA, uint24 fee1, address tokenB, uint24 fee2, address tokenC)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(tokenA, fee1, tokenB, fee2, tokenC);
    }

    function _defaultMultiSwapParams() internal view returns (SIPSwapRouter.PrivateMultiSwapParams memory) {
        bytes memory path = _buildPath(address(weth), 3000, address(middleToken), 500, address(outputToken));

        return SIPSwapRouter.PrivateMultiSwapParams({
            path: path,
            tokenIn: address(0), // ETH
            amountIn: 0,
            amountOutMinimum: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(3),
            ephemeralPubKey: _makeEphemeralKey(3),
            viewingKeyHash: _makeViewingKeyHash(3),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });
    }

    function test_privateMultiSwap_ETH_success() public {
        SIPSwapRouter.PrivateMultiSwapParams memory params = _defaultMultiSwapParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateMultiSwap{value: 1 ether}(params);

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_privateMultiSwap_ERC20_success() public {
        bytes memory path = _buildPath(address(token), 3000, address(middleToken), 500, address(outputToken));

        SIPSwapRouter.PrivateMultiSwapParams memory params = SIPSwapRouter.PrivateMultiSwapParams({
            path: path,
            tokenIn: address(token),
            amountIn: 1000e18,
            amountOutMinimum: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(4),
            ephemeralPubKey: _makeEphemeralKey(4),
            viewingKeyHash: _makeViewingKeyHash(4),
            encryptedAmount: _makeEncryptedAmount(1000e18),
            deadline: 0
        });

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), 1000e18);
        uint256 swapId = sipSwapRouter.privateMultiSwap(params);
        vm.stopPrank();

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_privateMultiSwap_revertsOnInvalidPath() public {
        SIPSwapRouter.PrivateMultiSwapParams memory params = _defaultMultiSwapParams();
        params.path = new bytes(42); // Too short (minimum 43 = 20 + 3 + 20)

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidPath.selector);
        sipSwapRouter.privateMultiSwap{value: 1 ether}(params);
    }

    function test_privateMultiSwap_storesCorrectTokenOut() public {
        SIPSwapRouter.PrivateMultiSwapParams memory params = _defaultMultiSwapParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateMultiSwap{value: 1 ether}(params);

        SIPSwapRouter.SwapRecord memory record = sipSwapRouter.getSwap(swapId);
        assertEq(record.tokenOut, address(outputToken));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterAdminTest is TestSetup {
    address stealth;

    function setUp() public override {
        super.setUp();
        stealth = makeAddr("stealth");
    }

    function test_setPaused_blocksSwaps() public {
        vm.prank(owner);
        sipSwapRouter.setPaused(true);

        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.ContractPaused.selector);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_setPaused_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit SIPSwapRouter.Paused(true);

        vm.prank(owner);
        sipSwapRouter.setPaused(true);
    }

    function test_setFee_updates() public {
        vm.prank(owner);
        sipSwapRouter.setFee(200);
        assertEq(sipSwapRouter.feeBps(), 200);
    }

    function test_setFee_revertsAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(SIPSwapRouter.FeeTooHigh.selector);
        sipSwapRouter.setFee(1001);
    }

    function test_setFeeCollector_updates() public {
        vm.prank(owner);
        sipSwapRouter.setFeeCollector(charlie);
        assertEq(sipSwapRouter.feeCollector(), charlie);
    }

    function test_setFeeCollector_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        sipSwapRouter.setFeeCollector(address(0));
    }

    function test_transferOwnership_works() public {
        vm.prank(owner);
        sipSwapRouter.transferOwnership(charlie);
        assertEq(sipSwapRouter.owner(), charlie);
    }

    function test_transferOwnership_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit SIPSwapRouter.OwnershipTransferred(owner, charlie);

        vm.prank(owner);
        sipSwapRouter.transferOwnership(charlie);
    }

    function test_transferOwnership_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        sipSwapRouter.transferOwnership(address(0));
    }

    function test_transferOwnership_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.Unauthorized.selector);
        sipSwapRouter.transferOwnership(alice);
    }

    function test_rescueTokens_recoversERC20() public {
        // Send tokens directly to router (stuck)
        token.mint(address(sipSwapRouter), 500e18);

        uint256 ownerBefore = token.balanceOf(owner);

        vm.prank(owner);
        sipSwapRouter.rescueTokens(address(token), 500e18);

        assertEq(token.balanceOf(owner) - ownerBefore, 500e18);
    }

    function test_rescueTokens_recoversETH() public {
        // Send ETH directly to router
        vm.deal(address(sipSwapRouter), 5 ether);

        uint256 ownerBefore = owner.balance;

        vm.prank(owner);
        sipSwapRouter.rescueTokens(address(0), 5 ether);

        assertEq(owner.balance - ownerBefore, 5 ether);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterSecurityTest is TestSetup {
    address stealth;

    function setUp() public override {
        super.setUp();
        stealth = makeAddr("stealth");
    }

    function test_swapFailure_reverts() public {
        mockSwapRouter.setShouldRevert(true);

        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        vm.prank(alice);
        vm.expectRevert("Swap failed");
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function test_zeroFee_noFeeTransfer() public {
        // Deploy router with 0 fee
        vm.prank(owner);
        SIPSwapRouter zeroFeeRouter = new SIPSwapRouter(
            owner, feeCollector, 0, address(mockSwapRouter), address(weth)
        );

        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        uint256 feeCollectorBefore = feeCollector.balance;

        vm.prank(alice);
        zeroFeeRouter.privateSwap{value: 1 ether}(params);

        // No fee should be collected
        assertEq(feeCollector.balance, feeCollectorBefore);

        // Full amount should have been swapped (as WETH in mock)
        assertEq(weth.balanceOf(address(mockSwapRouter)), 1 ether);
    }

    function test_commitmentWithOddPrefix_works() public {
        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeOddCommitment(1), // 0x03 prefix
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateSwap{value: 1 ether}(params);
        assertEq(swapId, 0);
    }

    function test_zeroCommitment_reverts() public {
        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: bytes32(0),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidCommitment.selector);
        sipSwapRouter.privateSwap{value: 1 ether}(params);
    }

    function testFuzz_feeCalculation(uint256 amount, uint256 bps) public {
        amount = bound(amount, 0.01 ether, 100 ether);
        bps = bound(bps, 0, 1000);

        uint256 fee = (amount * bps) / 10000;
        uint256 swap = amount - fee;

        // Fee + swap should always equal original amount
        assertEq(fee + swap, amount);

        // Fee should never exceed 10% of amount
        assertLe(fee, amount / 10);
    }

    function test_multipleSwaps_incrementsId() public {
        SIPSwapRouter.PrivateSwapParams memory params = SIPSwapRouter.PrivateSwapParams({
            tokenIn: address(0),
            tokenOut: address(outputToken),
            poolFee: 3000,
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });

        vm.startPrank(alice);
        uint256 id0 = sipSwapRouter.privateSwap{value: 1 ether}(params);
        uint256 id1 = sipSwapRouter.privateSwap{value: 1 ether}(params);
        uint256 id2 = sipSwapRouter.privateSwap{value: 1 ether}(params);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(sipSwapRouter.totalSwaps(), 3);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Aggregator Swap Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterAggregatorTest is TestSetup {
    address stealth = address(0xBEEF);

    /// @notice Build mock 1inch swap() calldata
    /// @dev Matches selector 0x12aa3caf: swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
    function _buildAggregatorCalldata(
        address srcToken,
        address dstToken,
        address dstReceiver,
        uint256 amount,
        uint256 minReturn
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            0x12aa3caf, // swap selector
            address(0), // executor
            MockAggregatorRouter.SwapDescription({
                srcToken: srcToken,
                dstToken: dstToken,
                srcReceiver: address(0),
                dstReceiver: dstReceiver,
                amount: amount,
                minReturnAmount: minReturn,
                flags: 0
            }),
            "", // permit
            ""  // data
        );
    }

    function _defaultAggregatorParams() internal view returns (SIPSwapRouter.AggregatorSwapParams memory) {
        uint256 postFeeAmount = 1 ether - (1 ether * DEFAULT_FEE_BPS) / 10000;

        return SIPSwapRouter.AggregatorSwapParams({
            router: address(mockAggregator),
            swapCalldata: _buildAggregatorCalldata(
                address(weth),
                address(outputToken),
                stealth,
                postFeeAmount,
                0
            ),
            tokenIn: address(0), // ETH
            tokenOut: address(outputToken),
            amountIn: 0,
            amountOutMinimum: 0,
            stealthRecipient: stealth,
            commitment: _makeCommitment(1),
            ephemeralPubKey: _makeEphemeralKey(1),
            viewingKeyHash: _makeViewingKeyHash(1),
            encryptedAmount: _makeEncryptedAmount(1 ether),
            deadline: 0
        });
    }

    // ── Router Approval Tests ────────────────────────────────────────────────

    function test_setRouterApproval_works() public {
        address newRouter = address(0x1234);
        vm.prank(owner);
        sipSwapRouter.setRouterApproval(newRouter, true);
        assertTrue(sipSwapRouter.approvedRouters(newRouter));
    }

    function test_setRouterApproval_emitsEvent() public {
        address newRouter = address(0x1234);
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit SIPSwapRouter.RouterApprovalUpdated(newRouter, true);
        sipSwapRouter.setRouterApproval(newRouter, true);
    }

    function test_setRouterApproval_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.Unauthorized.selector);
        sipSwapRouter.setRouterApproval(address(0x1234), true);
    }

    function test_setRouterApproval_revertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        sipSwapRouter.setRouterApproval(address(0), true);
    }

    function test_setRouterApproval_canRevoke() public {
        vm.startPrank(owner);
        sipSwapRouter.setRouterApproval(address(0x1234), true);
        assertTrue(sipSwapRouter.approvedRouters(address(0x1234)));
        sipSwapRouter.setRouterApproval(address(0x1234), false);
        assertFalse(sipSwapRouter.approvedRouters(address(0x1234)));
        vm.stopPrank();
    }

    // ── ETH Aggregator Swap Tests ────────────────────────────────────────────

    function test_aggregatorSwap_ETH_success() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_aggregatorSwap_ETH_feeDeduction() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        uint256 feeCollectorBefore = feeCollector.balance;

        vm.prank(alice);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);

        uint256 expectedFee = (1 ether * DEFAULT_FEE_BPS) / 10000;
        assertEq(feeCollector.balance - feeCollectorBefore, expectedFee);
    }

    function test_aggregatorSwap_ETH_emitsShieldedSwap() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit SIPSwapRouter.ShieldedSwap(0, alice, stealth, address(0), address(outputToken), 0, 0, bytes32(0), bytes32(0), bytes32(0));
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_ETH_emitsAnnouncement() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit SIPSwapRouter.Announcement(1, stealth, alice, "", "");
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_ETH_storesSwapRecord() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        uint256 swapId = sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);

        SIPSwapRouter.SwapRecord memory record = sipSwapRouter.getSwap(swapId);
        assertEq(record.sender, alice);
        assertEq(record.stealthRecipient, stealth);
        assertEq(record.tokenIn, address(0));
        assertEq(record.tokenOut, address(outputToken));
        assertEq(record.amountOut, 2000e6);
    }

    function test_aggregatorSwap_ETH_incrementsSwapId() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.startPrank(alice);
        uint256 id0 = sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
        params.commitment = _makeCommitment(2);
        uint256 id1 = sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(sipSwapRouter.totalSwaps(), 2);
    }

    // ── ERC20 Aggregator Swap Tests ──────────────────────────────────────────

    function test_aggregatorSwap_ERC20_success() public {
        uint256 amount = 1000e18;
        uint256 postFeeAmount = amount - (amount * DEFAULT_FEE_BPS) / 10000;

        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.tokenIn = address(token);
        params.amountIn = amount;
        params.swapCalldata = _buildAggregatorCalldata(
            address(token), address(outputToken), stealth, postFeeAmount, 0
        );

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), amount);
        uint256 swapId = sipSwapRouter.privateAggregatorSwap(params);
        vm.stopPrank();

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_aggregatorSwap_ERC20_feeDeduction() public {
        uint256 amount = 1000e18;
        uint256 postFeeAmount = amount - (amount * DEFAULT_FEE_BPS) / 10000;

        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.tokenIn = address(token);
        params.amountIn = amount;
        params.swapCalldata = _buildAggregatorCalldata(
            address(token), address(outputToken), stealth, postFeeAmount, 0
        );

        uint256 feeCollectorBefore = token.balanceOf(feeCollector);

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), amount);
        sipSwapRouter.privateAggregatorSwap(params);
        vm.stopPrank();

        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;
        assertEq(token.balanceOf(feeCollector) - feeCollectorBefore, expectedFee);
    }

    // ── Security Tests ───────────────────────────────────────────────────────

    function test_aggregatorSwap_revertsOnUnapprovedRouter() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.router = address(0xDEAD); // not whitelisted

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.RouterNotApproved.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnInvalidSelector() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        // Build calldata with wrong selector but sufficient length
        bytes memory badCalldata = new bytes(324);
        badCalldata[0] = 0xde;
        badCalldata[1] = 0xad;
        badCalldata[2] = 0xbe;
        badCalldata[3] = 0xef;
        params.swapCalldata = badCalldata;

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidSelector.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnShortCalldata() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        // Calldata too short (< 324 bytes)
        params.swapCalldata = abi.encodeWithSelector(0x12aa3caf, address(0));

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidSelector.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnRecipientMismatch() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        // Build calldata with WRONG dstReceiver
        params.swapCalldata = _buildAggregatorCalldata(
            address(weth), address(outputToken), address(0xBAD), 1 ether, 0
        );

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.RecipientMismatch.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnInsufficientOutput() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.amountOutMinimum = 5000e6; // Mock only returns 2000e6

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InsufficientOutput.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsWhenPaused() public {
        vm.prank(owner);
        sipSwapRouter.setPaused(true);

        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.ContractPaused.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnSwapFailure() public {
        mockAggregator.setShouldRevert(true);
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        vm.expectRevert("Aggregator swap failed");
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnZeroETH() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.InvalidAmount.selector);
        sipSwapRouter.privateAggregatorSwap(params); // No msg.value
    }

    function test_aggregatorSwap_revertsOnExpiredDeadline() public {
        vm.warp(1000);
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.deadline = block.timestamp - 1;

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.DeadlineExpired.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnNativeTokenOut() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.tokenOut = address(0); // Native ETH output not supported

        vm.prank(alice);
        vm.expectRevert(SIPSwapRouter.ZeroAddress.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }
}
