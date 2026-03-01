# 1inch Aggregator Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add generic DEX aggregator swap support to SIPSwapRouter (1inch V6 first), with TypeScript SDK adapter for off-chain route finding.

**Architecture:** Extend SIPSwapRouter with `privateAggregatorSwap()` that forwards pre-built calldata to whitelisted aggregator routers. SDK's OneInchAdapter calls 1inch API to generate calldata with `destReceiver=stealth`, then user submits to the contract.

**Tech Stack:** Solidity 0.8.24 (Foundry), TypeScript (Vitest), 1inch AggregationRouterV6

---

## Task 1: Add Router Whitelist + Aggregator Errors/Events to SIPSwapRouter

**Files:**
- Modify: `contracts/sip-ethereum/src/SIPSwapRouter.sol`

**Step 1: Add new state, errors, and events after existing ones**

Add after line 79 (after `mapping(uint256 => SwapRecord) public swaps;`):

```solidity
/// @notice Whitelisted aggregator routers
mapping(address => bool) public approvedRouters;
```

Add after line 181 (after `error TransferFailed();`):

```solidity
error RouterNotApproved();
error InvalidSelector();
error RecipientMismatch();
error InsufficientOutput();
```

Add after line 164 (after `event OwnershipTransferred`):

```solidity
/// @notice Emitted when a router's approval status changes
event RouterApprovalUpdated(address indexed router, bool approved);
```

**Step 2: Add `setRouterApproval` admin function**

Add after `rescueTokens` function (line 435):

```solidity
/// @notice Approve or revoke an aggregator router
function setRouterApproval(address router, bool approved) external onlyOwner {
    if (router == address(0)) revert ZeroAddress();
    approvedRouters[router] = approved;
    emit RouterApprovalUpdated(router, approved);
}
```

**Step 3: Run build to verify compilation**

Run: `cd contracts/sip-ethereum && forge build`
Expected: Compiler run successful

**Step 4: Commit**

```
feat(contracts): add router whitelist and aggregator errors to SIPSwapRouter
```

---

## Task 2: Add AggregatorSwapParams Struct and 1inch Calldata Decoding

**Files:**
- Modify: `contracts/sip-ethereum/src/SIPSwapRouter.sol`

**Step 1: Add the 1inch SwapDescription struct (internal, for decoding)**

Add in the Structs section (after `SwapRecord` struct, ~line 128):

```solidity
/// @notice Parameters for a generic aggregator private swap
struct AggregatorSwapParams {
    address router;            // Whitelisted aggregator (e.g., 1inch V6)
    bytes swapCalldata;        // Pre-built calldata from aggregator API
    address tokenIn;           // address(0) for ETH
    address tokenOut;          // Output token for record-keeping
    uint256 amountIn;          // Input amount (ignored for ETH — uses msg.value)
    uint256 amountOutMinimum;  // Slippage protection (verified post-swap)
    address stealthRecipient;  // Must match dstReceiver in calldata
    bytes32 commitment;
    bytes32 ephemeralPubKey;
    bytes32 viewingKeyHash;
    bytes encryptedAmount;
    uint256 deadline;
}
```

**Step 2: Add constants for 1inch calldata validation**

Add in the Constants section (after `NATIVE_TOKEN`, ~line 48):

```solidity
/// @notice 1inch swap() function selector: swap(address,(address,address,address,address,uint256,uint256,uint256,bytes),bytes)
bytes4 public constant AGGREGATOR_SWAP_SELECTOR = 0x12aa3caf;
```

**Step 3: Add internal calldata validation helper**

Add in the Internal section (after `_emitAnnouncement`, ~line 566):

```solidity
/// @notice Validate aggregator calldata and extract dstReceiver
/// @dev Decodes the SwapDescription from 1inch swap() calldata to verify recipient
function _validateAggregatorCalldata(
    bytes calldata swapCalldata,
    address expectedRecipient
) internal pure {
    // Verify function selector
    if (bytes4(swapCalldata[:4]) != AGGREGATOR_SWAP_SELECTOR) revert InvalidSelector();

    // Decode SwapDescription from calldata
    // swap(address executor, SwapDescription desc, bytes data)
    // SwapDescription layout: srcToken, dstToken, srcReceiver, dstReceiver, ...
    // Skip 4 (selector) + 32 (executor) = 36 bytes to reach SwapDescription offset
    // SwapDescription is a tuple, so we read from its data offset
    // dstReceiver is the 4th field (index 3) = offset 3*32 = 96 bytes from struct start

    // The calldata after selector has: executor (32) + offset to desc (32) + offset to data (32)
    // Then the desc struct starts at the offset
    // For ABI-encoded structs, we need to read the offset pointer first
    uint256 descOffset;
    assembly {
        // offset to SwapDescription is at position 4 + 32 = 36 from calldata start
        descOffset := calldataload(add(swapCalldata.offset, 36))
    }

    // dstReceiver is 4th field in SwapDescription (index 3, offset 96)
    address dstReceiver;
    assembly {
        // Absolute position: calldata.offset + 4 (selector) + descOffset + 96 (4th field)
        dstReceiver := calldataload(add(add(swapCalldata.offset, 4), add(descOffset, 96)))
    }

    if (dstReceiver != expectedRecipient) revert RecipientMismatch();
}
```

**Step 4: Run build**

Run: `cd contracts/sip-ethereum && forge build`
Expected: Compiler run successful

**Step 5: Commit**

```
feat(contracts): add AggregatorSwapParams struct and calldata validation
```

---

## Task 3: Implement privateAggregatorSwap Function

**Files:**
- Modify: `contracts/sip-ethereum/src/SIPSwapRouter.sol`

**Step 1: Add the main function**

Add after `privateMultiSwap` function (~line 394):

```solidity
/**
 * @notice Execute a private swap via a whitelisted DEX aggregator (e.g., 1inch)
 * @param params Aggregator swap parameters with pre-built calldata
 * @return swapId Unique swap identifier
 *
 * @dev The swapCalldata is generated off-chain by the aggregator's API with
 *      destReceiver set to the stealth address. This contract verifies the
 *      recipient matches, deducts the SIP fee, and forwards the calldata.
 *      Output tokens go directly from the aggregator to the stealth address.
 */
function privateAggregatorSwap(AggregatorSwapParams calldata params)
    external
    payable
    whenNotPaused
    nonReentrant
    returns (uint256 swapId)
{
    // 1. Validate privacy params
    _validateSwapParams(
        params.stealthRecipient,
        params.commitment,
        params.encryptedAmount,
        params.deadline
    );

    // 2. Validate router is whitelisted
    if (!approvedRouters[params.router]) revert RouterNotApproved();

    // 3. Validate calldata: selector + dstReceiver == stealthRecipient
    _validateAggregatorCalldata(params.swapCalldata, params.stealthRecipient);

    uint256 effectiveDeadline = _effectiveDeadline(params.deadline);

    // 4. Check deadline (aggregator calldata has its own, but we enforce ours too)
    if (effectiveDeadline < block.timestamp) revert DeadlineExpired();

    uint256 swapAmount;

    if (params.tokenIn == NATIVE_TOKEN) {
        if (msg.value == 0) revert InvalidAmount();
        swapAmount = _deductFeeETH(msg.value);
        // Aggregator handles ETH directly — forward as value
    } else {
        if (params.amountIn == 0) revert InvalidAmount();
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        swapAmount = _deductFeeERC20(params.tokenIn, params.amountIn);
        _safeApprove(params.tokenIn, params.router, swapAmount);
    }

    // 5. Record stealth recipient's output token balance before swap
    uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(params.stealthRecipient);

    // 6. Forward calldata to aggregator router
    uint256 ethValue = params.tokenIn == NATIVE_TOKEN ? swapAmount : 0;
    (bool success,) = params.router.call{value: ethValue}(params.swapCalldata);
    if (!success) revert SwapFailed();

    // 7. Verify output — check balance increase
    uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(params.stealthRecipient);
    uint256 amountOut = balanceAfter - balanceBefore;
    if (amountOut < params.amountOutMinimum) revert InsufficientOutput();

    // 8. Record and emit
    swapId = _recordSwap(
        params.stealthRecipient,
        params.tokenIn,
        params.tokenOut,
        params.commitment,
        params.ephemeralPubKey,
        params.viewingKeyHash,
        params.encryptedAmount,
        swapAmount,
        amountOut
    );

    _emitAnnouncement(
        params.stealthRecipient,
        params.ephemeralPubKey,
        params.viewingKeyHash,
        params.encryptedAmount
    );
}
```

**Step 2: Run build**

Run: `cd contracts/sip-ethereum && forge build`
Expected: Compiler run successful

**Step 3: Commit**

```
feat(contracts): implement privateAggregatorSwap for generic DEX aggregator support
```

---

## Task 4: Add MockAggregatorRouter to TestSetup

**Files:**
- Modify: `contracts/sip-ethereum/test/helpers/TestSetup.sol`

**Step 1: Add MockAggregatorRouter contract**

Add after `MockSwapRouter` contract (~line 146):

```solidity
/// @notice Mock 1inch-style aggregator router for testing
contract MockAggregatorRouter {
    uint256 public mockAmountOut;
    bool public shouldRevert;

    function setMockAmountOut(uint256 amount) external {
        mockAmountOut = amount;
    }

    function setShouldRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    /// @notice Mock swap() matching 1inch V6 selector 0x12aa3caf
    function swap(
        address, // executor
        SwapDescription calldata desc,
        bytes calldata // data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount) {
        if (shouldRevert) revert("Aggregator swap failed");

        if (desc.srcToken != address(0) && desc.srcToken != address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)) {
            // Pull ERC20 input from caller
            IERC20(desc.srcToken).transferFrom(msg.sender, address(this), desc.amount);
        }

        // Mint output tokens to dstReceiver (simulates aggregated swap)
        MockERC20(address(desc.dstToken)).mint(desc.dstReceiver, mockAmountOut);

        return (mockAmountOut, desc.amount);
    }

    struct SwapDescription {
        address srcToken;
        address dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
        bytes permit;
    }

    receive() external payable {}
}
```

**Step 2: Add MockAggregatorRouter instance to TestSetup**

Add to state variables (~line 159):

```solidity
MockAggregatorRouter public mockAggregator;
```

Add to `setUp()` function, after mockSwapRouter setup (~line 217):

```solidity
// Deploy mock aggregator
mockAggregator = new MockAggregatorRouter();
mockAggregator.setMockAmountOut(2000e6); // Default: 2000 USDC

// Approve aggregator in SIPSwapRouter
vm.prank(owner);
sipSwapRouter.setRouterApproval(address(mockAggregator), true);
```

**Step 3: Add import for IERC20 if not present**

Check TestSetup.sol imports — IERC20 is already imported.

**Step 4: Run build**

Run: `cd contracts/sip-ethereum && forge build`
Expected: Compiler run successful

**Step 5: Commit**

```
test(contracts): add MockAggregatorRouter to TestSetup
```

---

## Task 5: Write Aggregator Swap Unit Tests

**Files:**
- Modify: `contracts/sip-ethereum/test/SIPSwapRouter.t.sol`

**Step 1: Add test helper for building mock 1inch calldata**

Add a new test contract at the end of the file:

```solidity
// ═══════════════════════════════════════════════════════════════════════════════
// Aggregator Swap Tests
// ═══════════════════════════════════════════════════════════════════════════════

contract SIPSwapRouterAggregatorTest is TestSetup {
    address stealth = address(0xBEEF);

    /// @notice Build mock 1inch swap() calldata
    function _buildAggregatorCalldata(
        address srcToken,
        address dstToken,
        address dstReceiver,
        uint256 amount,
        uint256 minReturn
    ) internal pure returns (bytes memory) {
        // Encode SwapDescription struct
        bytes memory permit;
        // swap(address executor, SwapDescription desc, bytes data)
        return abi.encodeWithSelector(
            0x12aa3caf, // swap selector
            address(0), // executor (unused in mock)
            MockAggregatorRouter.SwapDescription({
                srcToken: srcToken,
                dstToken: dstToken,
                srcReceiver: address(0),
                dstReceiver: dstReceiver,
                amount: amount,
                minReturnAmount: minReturn,
                flags: 0,
                permit: permit
            }),
            "" // data
        );
    }

    function _defaultAggregatorParams() internal view returns (SIPSwapRouter.AggregatorSwapParams memory) {
        return SIPSwapRouter.AggregatorSwapParams({
            router: address(mockAggregator),
            swapCalldata: _buildAggregatorCalldata(
                address(weth), // srcToken (WETH after wrapping)
                address(outputToken),
                stealth,
                1 ether,
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

        // 1% fee on 1 ETH = 0.01 ETH
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

    // ── ERC20 Aggregator Swap Tests ──────────────────────────────────────────

    function test_aggregatorSwap_ERC20_success() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.tokenIn = address(token);
        params.amountIn = 1000e18;
        params.swapCalldata = _buildAggregatorCalldata(
            address(token), address(outputToken), stealth, 1000e18, 0
        );

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), 1000e18);
        uint256 swapId = sipSwapRouter.privateAggregatorSwap(params);
        vm.stopPrank();

        assertEq(swapId, 0);
        assertEq(outputToken.balanceOf(stealth), 2000e6);
    }

    function test_aggregatorSwap_ERC20_feeDeduction() public {
        SIPSwapRouter.AggregatorSwapParams memory params = _defaultAggregatorParams();
        params.tokenIn = address(token);
        params.amountIn = 1000e18;
        params.swapCalldata = _buildAggregatorCalldata(
            address(token), address(outputToken), stealth, 1000e18, 0
        );

        uint256 feeCollectorBefore = token.balanceOf(feeCollector);

        vm.startPrank(alice);
        token.approve(address(sipSwapRouter), 1000e18);
        sipSwapRouter.privateAggregatorSwap(params);
        vm.stopPrank();

        uint256 expectedFee = (1000e18 * DEFAULT_FEE_BPS) / 10000;
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
        // Replace first 4 bytes with wrong selector
        params.swapCalldata = abi.encodeWithSelector(0xdeadbeef, address(0), address(0), "");

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
        vm.expectRevert(SIPSwapRouter.SwapFailed.selector);
        sipSwapRouter.privateAggregatorSwap{value: 1 ether}(params);
    }

    function test_aggregatorSwap_revertsOnZeroAmount() public {
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
}
```

**Step 2: Add MockAggregatorRouter import to test file header**

Update the import at line 4:

```solidity
import {TestSetup, MockERC20, MockWETH, MockSwapRouter, MockAggregatorRouter} from "./helpers/TestSetup.sol";
```

**Step 3: Run tests**

Run: `cd contracts/sip-ethereum && forge test --match-contract SIPSwapRouterAggregatorTest -vv`
Expected: All tests pass

**Step 4: Run full test suite**

Run: `cd contracts/sip-ethereum && forge test -vv`
Expected: 219+ tests pass, 0 failed (199 existing + 20 new)

**Step 5: Commit**

```
test(contracts): add 20 aggregator swap tests for SIPSwapRouter
```

---

## Task 6: Create OneInchAdapter in SDK

**Files:**
- Create: `packages/sdk/src/adapters/oneinch.ts`

**Step 1: Create the adapter**

```typescript
/**
 * @module OneInchAdapter
 * @description 1inch aggregator adapter for privacy-preserving swaps.
 * Generates swap calldata with stealth address as recipient.
 */

export interface OneInchQuote {
  toAmount: string
  estimatedGas: string
  protocols: Array<{ name: string; part: number }>
}

export interface OneInchSwapData {
  tx: {
    to: string
    data: string
    value: string
    gas: number
  }
  toAmount: string
}

export interface OneInchSwapParams {
  src: string
  dst: string
  amount: string
  from: string
  destReceiver: string
  slippage: number
  disableEstimate?: boolean
}

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
}

const ONEINCH_ROUTER = '0x111111125421cA6dc452d289314280a0f8842A65'
const API_BASE = 'https://api.1inch.dev/swap/v6.0'

export class OneInchAdapter {
  private apiKey: string
  private chainId: number

  constructor(apiKey: string, chain: string | number) {
    this.apiKey = apiKey
    this.chainId = typeof chain === 'number' ? chain : CHAIN_IDS[chain]
    if (!this.chainId) throw new Error(`Unsupported chain: ${chain}`)
  }

  get routerAddress(): string {
    return ONEINCH_ROUTER
  }

  async getQuote(params: {
    src: string
    dst: string
    amount: string
  }): Promise<OneInchQuote> {
    const url = new URL(`${API_BASE}/${this.chainId}/quote`)
    url.searchParams.set('src', params.src)
    url.searchParams.set('dst', params.dst)
    url.searchParams.set('amount', params.amount)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getSwapCalldata(params: OneInchSwapParams): Promise<OneInchSwapData> {
    const url = new URL(`${API_BASE}/${this.chainId}/swap`)
    url.searchParams.set('src', params.src)
    url.searchParams.set('dst', params.dst)
    url.searchParams.set('amount', params.amount)
    url.searchParams.set('from', params.from)
    url.searchParams.set('destReceiver', params.destReceiver)
    url.searchParams.set('slippage', params.slippage.toString())
    url.searchParams.set('disableEstimate', (params.disableEstimate ?? true).toString())

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  static supportedChains(): string[] {
    return Object.keys(CHAIN_IDS)
  }
}
```

**Step 2: Export from adapters index**

Check `packages/sdk/src/adapters/index.ts` and add the export.

**Step 3: Commit**

```
feat(sdk): add OneInchAdapter for 1inch aggregator integration
```

---

## Task 7: Write OneInchAdapter Unit Tests

**Files:**
- Create: `packages/sdk/tests/adapters/oneinch.test.ts`

**Step 1: Write adapter tests with mocked fetch**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OneInchAdapter } from '../../src/adapters/oneinch'

describe('OneInchAdapter', () => {
  describe('constructor', () => {
    it('accepts chain name', () => {
      const adapter = new OneInchAdapter('test-key', 'ethereum')
      expect(adapter.routerAddress).toBe('0x111111125421cA6dc452d289314280a0f8842A65')
    })

    it('accepts chain ID', () => {
      const adapter = new OneInchAdapter('test-key', 1)
      expect(adapter.routerAddress).toBe('0x111111125421cA6dc452d289314280a0f8842A65')
    })

    it('throws for unsupported chain', () => {
      expect(() => new OneInchAdapter('test-key', 'solana')).toThrow('Unsupported chain')
    })

    it('lists supported chains', () => {
      const chains = OneInchAdapter.supportedChains()
      expect(chains).toContain('ethereum')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('base')
      expect(chains).toContain('optimism')
      expect(chains).toContain('polygon')
    })
  })

  describe('getQuote', () => {
    let adapter: OneInchAdapter

    beforeEach(() => {
      adapter = new OneInchAdapter('test-key', 'ethereum')
    })

    it('calls correct API endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ toAmount: '2500000000', estimatedGas: '180000', protocols: [] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await adapter.getQuote({
        src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        dst: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1000000000000000000',
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('/swap/v6.0/1/quote')
      expect(url).toContain('src=0xEeee')

      vi.unstubAllGlobals()
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 429, statusText: 'Too Many Requests',
      }))

      await expect(adapter.getQuote({
        src: '0xEeee', dst: '0xA0b8', amount: '1000',
      })).rejects.toThrow('1inch API error: 429')

      vi.unstubAllGlobals()
    })
  })

  describe('getSwapCalldata', () => {
    let adapter: OneInchAdapter

    beforeEach(() => {
      adapter = new OneInchAdapter('test-key', 'arbitrum')
    })

    it('passes destReceiver for stealth address', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tx: { to: '0x111111125421cA6dc452d289314280a0f8842A65', data: '0x12aa3caf', value: '0', gas: 300000 },
          toAmount: '2500000000',
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await adapter.getSwapCalldata({
        src: '0xEeee',
        dst: '0xA0b8',
        amount: '1000',
        from: '0xContractAddr',
        destReceiver: '0xStealthAddr',
        slippage: 1,
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('destReceiver=0xStealthAddr')
      expect(url).toContain('/swap/v6.0/42161/swap')
      expect(result.tx.data).toBe('0x12aa3caf')

      vi.unstubAllGlobals()
    })

    it('sets disableEstimate=true by default', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tx: { to: '', data: '', value: '', gas: 0 }, toAmount: '0' }),
      }))

      await adapter.getSwapCalldata({
        src: '0xEeee', dst: '0xA0b8', amount: '1000',
        from: '0x1', destReceiver: '0x2', slippage: 1,
      })

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('disableEstimate=true')

      vi.unstubAllGlobals()
    })
  })
})
```

**Step 2: Run tests**

Run: `cd packages/sdk && pnpm test -- tests/adapters/oneinch.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```
test(sdk): add OneInchAdapter unit tests
```

---

## Task 8: Deploy Updated SIPSwapRouter + Approve 1inch Router

**Files:**
- Modify: `contracts/sip-ethereum/script/DeploySIPSwapRouter.s.sol`

**Step 1: Update deploy script to approve 1inch router**

Add after `sipSwapRouter` deployment:

```solidity
// Approve 1inch V6 router
address oneInchRouter = vm.envOr("ONEINCH_ROUTER", address(0x111111125421cA6dc452d289314280a0f8842A65));
sipSwapRouter.setRouterApproval(oneInchRouter, true);
console.log("1inch Router approved:", oneInchRouter);
```

**Step 2: Deploy to Sepolia**

Run: Deploy using existing deploy flow (same as SIPSwapRouter deploy).

**Step 3: Update DEPLOYMENT.md, CLAUDE.md, ROADMAP.md**

- Add new SIPSwapRouter address to DEPLOYMENT.md
- Update M18 progress count
- Close #812 on GitHub

**Step 4: Commit**

```
feat(contracts): deploy SIPSwapRouter v2 with aggregator support to Sepolia
```

---

## Summary

| Task | What | LOC | Tests |
|------|------|-----|-------|
| 1 | Router whitelist + errors/events | ~15 | 0 |
| 2 | AggregatorSwapParams + calldata validation | ~50 | 0 |
| 3 | `privateAggregatorSwap` function | ~70 | 0 |
| 4 | MockAggregatorRouter in TestSetup | ~50 | 0 |
| 5 | 20 Foundry unit tests | ~250 | 20 |
| 6 | OneInchAdapter (SDK) | ~90 | 0 |
| 7 | OneInchAdapter tests | ~100 | 8 |
| 8 | Deploy + docs update | ~10 | 0 |
| **Total** | | **~635** | **28** |
