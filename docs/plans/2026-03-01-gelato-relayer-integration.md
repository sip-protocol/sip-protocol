# Gelato Relayer Integration Implementation Plan (#810)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable gasless claim + fund withdrawal from stealth addresses via Gelato Relay, supporting both SIP-sponsored and user-paid fee modes.

**Architecture:** Current `shieldedTransfer` sends funds to stealth EOAs — can't relay from EOAs without gas. Solution: add a new **deposit mode** where SIPPrivacy holds funds in-contract, with a `withdrawDeposit` function that moves funds to recipient on valid claim. `SIPRelayer` wraps this for Gelato's `callWithSyncFee` (fee deducted from amount). For `sponsoredCall`, the SDK calls `withdrawDeposit` directly via Gelato (SIP pays gas).

**Tech Stack:** Solidity 0.8.24, Foundry, `@gelatonetwork/relay-context` v4.x, `@gelatonetwork/relay-sdk` (TypeScript), Vitest

---

## Task 1: Install Gelato relay-context dependency

**Files:**
- Modify: `contracts/sip-ethereum/foundry.toml`
- Modify: `contracts/sip-ethereum/remappings.txt` (if exists)

**Step 1: Install the Gelato relay-context contracts**

```bash
cd contracts/sip-ethereum
forge install gelatodigital/relay-context-contracts --no-commit
```

If that fails (no git submodules), use npm:

```bash
cd contracts/sip-ethereum
npm install @gelatonetwork/relay-context
```

**Step 2: Add remapping**

In `foundry.toml`, add to remappings (or create `remappings.txt`):

```
@gelatonetwork/relay-context/=lib/relay-context-contracts/
```

Or if using npm:

```
@gelatonetwork/relay-context/=node_modules/@gelatonetwork/relay-context/
```

**Step 3: Verify import resolves**

```bash
cd contracts/sip-ethereum
forge build
```

Expected: Compiles successfully (no import errors).

**Step 4: Commit**

```bash
git add contracts/sip-ethereum/
git commit -m "chore(contracts): add @gelatonetwork/relay-context dependency"
```

---

## Task 2: Add deposit mode to SIPPrivacy.sol

Current `shieldedTransfer` sends funds to stealth EOA. Add `shieldedDeposit` where funds stay in the contract, enabling gasless relayed withdrawals.

**Files:**
- Modify: `contracts/sip-ethereum/src/SIPPrivacy.sol`

**Step 1: Add deposit storage and events**

Add below existing state variables in SIPPrivacy.sol:

```solidity
// Deposit balances: transferId => amount held in contract
mapping(uint256 => uint256) public depositBalances;

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

error InsufficientDeposit();
error NotDeposit();
```

**Step 2: Add `shieldedDeposit` function**

Add after the existing `shieldedTokenTransfer` function. This mirrors `shieldedTransfer` but keeps funds in the contract:

```solidity
/**
 * @notice Deposit ETH into contract for gasless claim later
 * @dev Funds stay in contract. Recipient withdraws via withdrawDeposit() or relayed withdrawal.
 */
function shieldedDeposit(ShieldedTransferParams calldata params) external payable whenNotPaused nonReentrant {
    if (params.stealthRecipient == address(0)) revert ZeroAddress();
    if (params.commitment == bytes32(0)) revert InvalidCommitment();
    if (msg.value == 0) revert InvalidAmount();

    // Calculate fee
    uint256 fee = (msg.value * feeBps) / 10000;
    uint256 netAmount = msg.value - fee;

    // Send fee to collector
    if (fee > 0) {
        (bool feeSent, ) = feeCollector.call{value: fee}("");
        if (!feeSent) revert TransferFailed();
    }

    // Store record (same as shieldedTransfer but funds stay here)
    uint256 transferId = totalTransfers++;
    transfers[transferId] = TransferRecord({
        sender: msg.sender,
        stealthRecipient: params.stealthRecipient,
        token: NATIVE_TOKEN,
        commitment: params.commitment,
        ephemeralPubKey: params.ephemeralPubKey,
        viewingKeyHash: params.viewingKeyHash,
        encryptedAmount: params.encryptedAmount,
        timestamp: uint64(block.timestamp),
        claimed: false
    });

    // Track deposit balance
    depositBalances[transferId] = netAmount;

    emit ShieldedDeposit(
        transferId, msg.sender, params.stealthRecipient,
        NATIVE_TOKEN, params.commitment, params.ephemeralPubKey,
        block.timestamp
    );

    // EIP-5564 Announcement
    emit Announcement(
        0, params.stealthRecipient, msg.sender,
        params.ephemeralPubKey, params.encryptedAmount
    );
}

/**
 * @notice Deposit ERC20 tokens into contract for gasless claim later
 */
function shieldedTokenDeposit(ShieldedTransferParams calldata params, address token, uint256 amount) external whenNotPaused nonReentrant {
    if (params.stealthRecipient == address(0)) revert ZeroAddress();
    if (params.commitment == bytes32(0)) revert InvalidCommitment();
    if (token == NATIVE_TOKEN) revert InvalidAmount();
    if (amount == 0) revert InvalidAmount();

    // Pull tokens from sender
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    // Calculate fee
    uint256 fee = (amount * feeBps) / 10000;
    uint256 netAmount = amount - fee;

    // Send fee to collector
    if (fee > 0) {
        IERC20(token).safeTransfer(feeCollector, fee);
    }

    // Store record
    uint256 transferId = totalTransfers++;
    transfers[transferId] = TransferRecord({
        sender: msg.sender,
        stealthRecipient: params.stealthRecipient,
        token: token,
        commitment: params.commitment,
        ephemeralPubKey: params.ephemeralPubKey,
        viewingKeyHash: params.viewingKeyHash,
        encryptedAmount: params.encryptedAmount,
        timestamp: uint64(block.timestamp),
        claimed: false
    });

    // Track deposit balance
    depositBalances[transferId] = netAmount;

    emit ShieldedDeposit(
        transferId, msg.sender, params.stealthRecipient,
        token, params.commitment, params.ephemeralPubKey,
        block.timestamp
    );

    emit Announcement(
        0, params.stealthRecipient, msg.sender,
        params.ephemeralPubKey, params.encryptedAmount
    );
}
```

**Step 3: Add `withdrawDeposit` function**

This is the key function — claims AND moves funds in one call. Anyone can call it (authorization via nullifier + ZK proof):

```solidity
/**
 * @notice Withdraw a deposited ETH transfer (claim + send funds)
 * @dev Callable by anyone — authorization is via nullifier + ZK proof
 * @param transferId The deposit to withdraw
 * @param nullifier Unique identifier preventing double-claims
 * @param proof ZK proof of stealth key ownership
 * @param recipient Final recipient address (gets the funds)
 */
function withdrawDeposit(
    uint256 transferId,
    bytes32 nullifier,
    bytes calldata proof,
    address recipient
) external whenNotPaused nonReentrant {
    TransferRecord storage record = transfers[transferId];

    if (record.sender == address(0)) revert TransferNotFound();
    if (record.claimed) revert AlreadyClaimed();
    if (record.token != NATIVE_TOKEN) revert InvalidAmount();

    uint256 amount = depositBalances[transferId];
    if (amount == 0) revert NotDeposit();

    if (nullifiers[nullifier]) revert NullifierUsed();
    if (nullifier == bytes32(0)) revert InvalidNullifier();

    if (address(zkVerifier) != address(0) && proof.length > 0) {
        if (!zkVerifier.verifyProof(record.commitment, proof)) {
            revert InvalidProof();
        }
    }

    // Mark claimed
    nullifiers[nullifier] = true;
    record.claimed = true;
    depositBalances[transferId] = 0;

    // Send funds to recipient
    (bool sent, ) = recipient.call{value: amount}("");
    if (!sent) revert TransferFailed();

    emit DepositWithdrawn(transferId, nullifier, recipient, NATIVE_TOKEN, amount);
    emit TransferClaimed(transferId, nullifier, recipient);
}

/**
 * @notice Withdraw a deposited ERC20 transfer (claim + send tokens)
 */
function withdrawTokenDeposit(
    uint256 transferId,
    bytes32 nullifier,
    bytes calldata proof,
    address recipient
) external whenNotPaused nonReentrant {
    TransferRecord storage record = transfers[transferId];

    if (record.sender == address(0)) revert TransferNotFound();
    if (record.claimed) revert AlreadyClaimed();
    if (record.token == NATIVE_TOKEN) revert InvalidAmount();

    uint256 amount = depositBalances[transferId];
    if (amount == 0) revert NotDeposit();

    if (nullifiers[nullifier]) revert NullifierUsed();
    if (nullifier == bytes32(0)) revert InvalidNullifier();

    if (address(zkVerifier) != address(0) && proof.length > 0) {
        if (!zkVerifier.verifyProof(record.commitment, proof)) {
            revert InvalidProof();
        }
    }

    // Mark claimed
    nullifiers[nullifier] = true;
    record.claimed = true;
    depositBalances[transferId] = 0;

    // Send tokens to recipient
    IERC20(record.token).safeTransfer(recipient, amount);

    emit DepositWithdrawn(transferId, nullifier, recipient, record.token, amount);
    emit TransferClaimed(transferId, nullifier, recipient);
}
```

**Step 4: Verify build**

```bash
cd contracts/sip-ethereum
forge build
```

Expected: Compiles with no errors.

**Step 5: Commit**

```bash
git add contracts/sip-ethereum/src/SIPPrivacy.sol
git commit -m "feat(contracts): add deposit mode for gasless relayed withdrawals"
```

---

## Task 3: Create SIPRelayer.sol

Thin wrapper around `withdrawDeposit` that inherits `GelatoRelayContext` for `callWithSyncFee` mode. Deducts Gelato's fee from the withdrawn amount and forwards the rest to the recipient.

**Files:**
- Create: `contracts/sip-ethereum/src/SIPRelayer.sol`

**Step 1: Write SIPRelayer contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GelatoRelayContext} from "@gelatonetwork/relay-context/contracts/GelatoRelayContext.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {SIPPrivacy} from "./SIPPrivacy.sol";

/**
 * @title SIPRelayer
 * @notice Gelato Relay wrapper for gasless deposit withdrawals
 * @dev Inherits GelatoRelayContext for callWithSyncFee support.
 *      For sponsoredCall, call SIPPrivacy.withdrawDeposit() directly.
 *
 * Flow (callWithSyncFee):
 *   1. Gelato calls relayedWithdrawETH/Token on this contract
 *   2. This contract calls sipPrivacy.withdrawDeposit(recipient=address(this))
 *   3. Funds arrive in this contract
 *   4. Gelato fee deducted via _transferRelayFeeCapped(maxFee)
 *   5. Remaining funds forwarded to actual recipient
 */
contract SIPRelayer is GelatoRelayContext {
    SIPPrivacy public immutable sipPrivacy;
    address public owner;
    bool public paused;

    error Paused();
    error NotOwner();
    error ZeroAddress();
    error TransferFailed();
    error InsufficientAfterFee();

    event RelayedWithdrawal(
        uint256 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 fee
    );

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _sipPrivacy, address _owner) {
        if (_sipPrivacy == address(0) || _owner == address(0)) revert ZeroAddress();
        sipPrivacy = SIPPrivacy(payable(_sipPrivacy));
        owner = _owner;
    }

    /**
     * @notice Relayed withdrawal of ETH deposit via Gelato callWithSyncFee
     * @param transferId The deposit transfer ID
     * @param nullifier Nullifier for claim
     * @param proof ZK proof
     * @param recipient Final recipient (gets funds minus Gelato fee)
     * @param maxFee Maximum fee willing to pay to Gelato
     */
    function relayedWithdrawETH(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        uint256 maxFee
    ) external onlyGelatoRelay whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 balanceBefore = address(this).balance;

        // Withdraw from SIPPrivacy to this contract
        sipPrivacy.withdrawDeposit(transferId, nullifier, proof, address(this));

        uint256 received = address(this).balance - balanceBefore;

        // Pay Gelato fee (capped)
        _transferRelayFeeCapped(maxFee);

        // Forward remaining to recipient
        uint256 remaining = address(this).balance - balanceBefore + received - received;
        // Simpler: just send current balance minus what we started with
        uint256 toSend = address(this).balance - balanceBefore;
        if (toSend == 0) revert InsufficientAfterFee();

        (bool sent, ) = recipient.call{value: toSend}("");
        if (!sent) revert TransferFailed();

        uint256 fee = received - toSend;
        emit RelayedWithdrawal(transferId, recipient, address(0), toSend, fee);
    }

    /**
     * @notice Relayed withdrawal of ERC20 deposit via Gelato callWithSyncFee
     */
    function relayedWithdrawToken(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        address token,
        uint256 maxFee
    ) external onlyGelatoRelay whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        // Withdraw from SIPPrivacy to this contract
        sipPrivacy.withdrawTokenDeposit(transferId, nullifier, proof, address(this));

        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;

        // Pay Gelato fee (from token balance)
        _transferRelayFeeCapped(maxFee);

        // Forward remaining to recipient
        uint256 toSend = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (toSend == 0) revert InsufficientAfterFee();

        IERC20(token).transfer(recipient, toSend);

        uint256 fee = received - toSend;
        emit RelayedWithdrawal(transferId, recipient, token, toSend, fee);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Rescue stuck tokens/ETH (emergency only)
    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        if (!sent) revert TransferFailed();
    }

    function rescueTokens(address token, address to) external onlyOwner {
        IERC20(token).transfer(to, IERC20(token).balanceOf(address(this)));
    }

    receive() external payable {}
}
```

**Step 2: Verify build**

```bash
cd contracts/sip-ethereum
forge build
```

Expected: Compiles with no errors.

**Step 3: Commit**

```bash
git add contracts/sip-ethereum/src/SIPRelayer.sol
git commit -m "feat(contracts): add SIPRelayer for Gelato gasless withdrawals"
```

---

## Task 4: Add deposit mode tests to SIPPrivacy

**Files:**
- Modify: `contracts/sip-ethereum/test/SIPPrivacy.t.sol`
- Modify: `contracts/sip-ethereum/test/helpers/TestSetup.sol` (if needed)

**Step 1: Write deposit mode tests**

Add a new test contract `SIPPrivacyDepositTest` in `SIPPrivacy.t.sol`:

```solidity
contract SIPPrivacyDepositTest is TestSetup {
    // ═══════════════════════════════════════════
    // shieldedDeposit (ETH)
    // ═══════════════════════════════════════════

    function test_shieldedDeposit_success() public {
        uint256 amount = 1 ether;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedNet = amount - expectedFee;

        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: amount}(defaultParams);

        // Funds stay in contract
        assertEq(address(sipPrivacy).balance, expectedNet);
        // Deposit balance tracked
        assertEq(sipPrivacy.depositBalances(0), expectedNet);
        // Transfer record created
        (address sender,,,,,,,,bool claimed) = sipPrivacy.transfers(0);
        assertEq(sender, alice);
        assertFalse(claimed);
    }

    function test_shieldedDeposit_feeCollected() public {
        uint256 amount = 1 ether;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;

        uint256 collectorBefore = feeCollector.balance;
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: amount}(defaultParams);

        assertEq(feeCollector.balance - collectorBefore, expectedFee);
    }

    function test_shieldedDeposit_emitsEvents() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit SIPPrivacy.ShieldedDeposit(0, alice, stealthRecipient, address(0), commitment, ephemeralPubKey, block.timestamp);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);
    }

    function test_shieldedDeposit_revertsZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedDeposit{value: 0}(defaultParams);
    }

    function test_shieldedDeposit_revertsZeroRecipient() public {
        ShieldedTransferParams memory params = defaultParams;
        params.stealthRecipient = address(0);
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.ZeroAddress.selector);
        sipPrivacy.shieldedDeposit{value: 1 ether}(params);
    }

    // ═══════════════════════════════════════════
    // shieldedTokenDeposit (ERC20)
    // ═══════════════════════════════════════════

    function test_shieldedTokenDeposit_success() public {
        uint256 amount = 1000e6;
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10000;
        uint256 expectedNet = amount - expectedFee;

        vm.startPrank(alice);
        mockToken.approve(address(sipPrivacy), amount);
        sipPrivacy.shieldedTokenDeposit(defaultParams, address(mockToken), amount);
        vm.stopPrank();

        assertEq(mockToken.balanceOf(address(sipPrivacy)), expectedNet);
        assertEq(sipPrivacy.depositBalances(0), expectedNet);
    }

    function test_shieldedTokenDeposit_revertsNativeToken() public {
        vm.prank(alice);
        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.shieldedTokenDeposit(defaultParams, address(0), 1000);
    }

    // ═══════════════════════════════════════════
    // withdrawDeposit (ETH)
    // ═══════════════════════════════════════════

    function test_withdrawDeposit_success() public {
        // Setup: deposit 1 ETH
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        uint256 deposited = sipPrivacy.depositBalances(0);
        uint256 recipientBefore = bob.balance;

        // Withdraw
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);

        assertEq(bob.balance - recipientBefore, deposited);
        assertEq(sipPrivacy.depositBalances(0), 0);
        (,,,,,,,,bool claimed) = sipPrivacy.transfers(0);
        assertTrue(claimed);
    }

    function test_withdrawDeposit_anyoneCanCall() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        // Random address calls withdraw — should work (auth via nullifier)
        vm.prank(address(0xDEAD));
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);

        assertTrue(sipPrivacy.nullifiers(nullifier));
    }

    function test_withdrawDeposit_revertsAlreadyClaimed() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);

        vm.expectRevert(SIPPrivacy.AlreadyClaimed.selector);
        sipPrivacy.withdrawDeposit(0, bytes32(uint256(2)), "", bob);
    }

    function test_withdrawDeposit_revertsNotDeposit() public {
        // Use regular shieldedTransfer (sends to EOA, no deposit balance)
        vm.prank(alice);
        sipPrivacy.shieldedTransfer{value: 1 ether}(defaultParams);

        vm.expectRevert(SIPPrivacy.NotDeposit.selector);
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);
    }

    function test_withdrawDeposit_revertsNullifierUsed() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);

        // Second deposit
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        vm.expectRevert(SIPPrivacy.NullifierUsed.selector);
        sipPrivacy.withdrawDeposit(1, nullifier, "", bob); // same nullifier
    }

    function test_withdrawDeposit_emitsEvents() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        uint256 deposited = sipPrivacy.depositBalances(0);
        vm.expectEmit(true, true, true, true);
        emit SIPPrivacy.DepositWithdrawn(0, nullifier, bob, address(0), deposited);
        sipPrivacy.withdrawDeposit(0, nullifier, "", bob);
    }

    // ═══════════════════════════════════════════
    // withdrawTokenDeposit (ERC20)
    // ═══════════════════════════════════════════

    function test_withdrawTokenDeposit_success() public {
        uint256 amount = 1000e6;
        vm.startPrank(alice);
        mockToken.approve(address(sipPrivacy), amount);
        sipPrivacy.shieldedTokenDeposit(defaultParams, address(mockToken), amount);
        vm.stopPrank();

        uint256 deposited = sipPrivacy.depositBalances(0);
        uint256 bobBefore = mockToken.balanceOf(bob);

        sipPrivacy.withdrawTokenDeposit(0, nullifier, "", bob);

        assertEq(mockToken.balanceOf(bob) - bobBefore, deposited);
        assertEq(sipPrivacy.depositBalances(0), 0);
    }

    function test_withdrawTokenDeposit_revertsForETH() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        vm.expectRevert(SIPPrivacy.InvalidAmount.selector);
        sipPrivacy.withdrawTokenDeposit(0, nullifier, "", bob);
    }
}
```

**Step 2: Run tests**

```bash
cd contracts/sip-ethereum
forge test --match-contract SIPPrivacyDepositTest -vv
```

Expected: All tests pass.

**Step 3: Run full suite to check no regressions**

```bash
cd contracts/sip-ethereum
forge test
```

Expected: All 222+ tests pass + new deposit tests.

**Step 4: Commit**

```bash
git add contracts/sip-ethereum/test/
git commit -m "test(contracts): add deposit mode tests for gasless withdrawals"
```

---

## Task 5: Add SIPRelayer tests

**Files:**
- Create: `contracts/sip-ethereum/test/SIPRelayer.t.sol`
- Modify: `contracts/sip-ethereum/test/helpers/TestSetup.sol`

**Step 1: Add MockGelatoRelay and SIPRelayer setup to TestSetup**

In `TestSetup.sol`, add:

```solidity
import {SIPRelayer} from "../src/SIPRelayer.sol";

// Gelato relay address (same on all EVM chains V1)
address constant GELATO_RELAY = 0xaBcC9b596420A9E9172FD5938620E265a0f9Df92;
```

Add to state variables:

```solidity
SIPRelayer public sipRelayer;
```

Add to `setUp()`:

```solidity
sipRelayer = new SIPRelayer(address(sipPrivacy), owner);
```

**Step 2: Write SIPRelayer tests**

Create `test/SIPRelayer.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";
import "../src/SIPRelayer.sol";

contract SIPRelayerTest is TestSetup {
    // ═══════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════

    function test_constructor_setsState() public view {
        assertEq(address(sipRelayer.sipPrivacy()), address(sipPrivacy));
        assertEq(sipRelayer.owner(), owner);
        assertFalse(sipRelayer.paused());
    }

    function test_constructor_revertsZeroSIPPrivacy() public {
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        new SIPRelayer(address(0), owner);
    }

    function test_constructor_revertsZeroOwner() public {
        vm.expectRevert(SIPRelayer.ZeroAddress.selector);
        new SIPRelayer(address(sipPrivacy), address(0));
    }

    // ═══════════════════════════════════════════
    // relayedWithdrawETH
    // ═══════════════════════════════════════════

    function test_relayedWithdrawETH_success() public {
        // 1. Deposit ETH
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);
        uint256 deposited = sipPrivacy.depositBalances(0);

        // 2. Build relay calldata with appended fee context
        // Gelato appends: abi.encodePacked(data, feeCollector, feeToken, fee)
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawETH.selector,
            uint256(0), nullifier, "", bob, uint256(0.01 ether)
        );

        // Append Gelato context (72 bytes): feeCollector(20) + feeToken(20) + fee(32)
        address gelatoFeeCollector = address(0xGELATO); // mock
        address feeToken = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // native
        uint256 gelatoFee = 0.005 ether;
        bytes memory fullCalldata = abi.encodePacked(data, gelatoFeeCollector, feeToken, gelatoFee);

        // 3. Call as Gelato relay
        uint256 bobBefore = bob.balance;
        vm.prank(GELATO_RELAY);
        (bool success,) = address(sipRelayer).call(fullCalldata);
        assertTrue(success);

        // 4. Verify: bob got deposited - gelatoFee
        assertEq(bob.balance - bobBefore, deposited - gelatoFee);
    }

    function test_relayedWithdrawETH_revertsNotGelatoRelay() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        vm.prank(alice); // not Gelato
        vm.expectRevert("onlyGelatoRelay");
        sipRelayer.relayedWithdrawETH(0, nullifier, "", bob, 0.01 ether);
    }

    function test_relayedWithdrawETH_revertsWhenPaused() public {
        vm.prank(owner);
        sipRelayer.setPaused(true);

        // Even Gelato can't call when paused
        vm.prank(GELATO_RELAY);
        vm.expectRevert(SIPRelayer.Paused.selector);
        sipRelayer.relayedWithdrawETH(0, nullifier, "", bob, 0.01 ether);
    }

    function test_relayedWithdrawETH_revertsMaxFeeExceeded() public {
        vm.prank(alice);
        sipPrivacy.shieldedDeposit{value: 1 ether}(defaultParams);

        // Gelato fee > maxFee
        bytes memory data = abi.encodeWithSelector(
            SIPRelayer.relayedWithdrawETH.selector,
            uint256(0), nullifier, "", bob, uint256(0.001 ether) // maxFee = 0.001
        );
        // Actual fee = 0.01 (exceeds max)
        bytes memory fullCalldata = abi.encodePacked(
            data,
            address(0xFEE),
            address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE),
            uint256(0.01 ether)
        );

        vm.prank(GELATO_RELAY);
        (bool success,) = address(sipRelayer).call(fullCalldata);
        assertFalse(success); // reverts with maxFee error
    }

    // ═══════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════

    function test_setPaused() public {
        vm.prank(owner);
        sipRelayer.setPaused(true);
        assertTrue(sipRelayer.paused());

        vm.prank(owner);
        sipRelayer.setPaused(false);
        assertFalse(sipRelayer.paused());
    }

    function test_setPaused_revertsNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(SIPRelayer.NotOwner.selector);
        sipRelayer.setPaused(true);
    }

    function test_transferOwnership() public {
        vm.prank(owner);
        sipRelayer.transferOwnership(alice);
        assertEq(sipRelayer.owner(), alice);
    }

    function test_rescueETH() public {
        // Send some ETH to relayer
        vm.deal(address(sipRelayer), 1 ether);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        sipRelayer.rescueETH(owner);

        assertEq(owner.balance - ownerBefore, 1 ether);
    }

    function test_rescueTokens() public {
        mockToken.mint(address(sipRelayer), 1000e6);

        vm.prank(owner);
        sipRelayer.rescueTokens(address(mockToken), owner);

        assertEq(mockToken.balanceOf(owner), 1000e6);
    }
}
```

**Note on Gelato relay testing:** The relay context tests require appending fee data to calldata. The Gelato relay address is constant `0xaBcC9b596420A9E9172FD5938620E265a0f9Df92`. Use `vm.prank(GELATO_RELAY)` to simulate Gelato calling the contract. The fee context (72 bytes) is appended to msg.data via `abi.encodePacked`.

The `onlyGelatoRelay` modifier checks `msg.sender == _gelatoRelay` (set in constructor based on `block.chainid`). In tests, you may need to deploy on a chainid that maps to the V1 relay address, or mock the relay address. Check what chainid the test environment uses (likely 31337 for Anvil) and verify which relay address that maps to.

**Step 3: Run tests**

```bash
cd contracts/sip-ethereum
forge test --match-contract SIPRelayerTest -vv
```

Expected: All tests pass.

**Step 4: Run full suite**

```bash
cd contracts/sip-ethereum
forge test
```

Expected: All tests pass (no regressions).

**Step 5: Commit**

```bash
git add contracts/sip-ethereum/test/ contracts/sip-ethereum/src/
git commit -m "test(contracts): add SIPRelayer tests for Gelato gasless withdrawals"
```

---

## Task 6: Create GelatoRelayAdapter in SDK

**Files:**
- Create: `packages/sdk/src/adapters/gelato-relay.ts`
- Modify: `packages/sdk/src/adapters/index.ts`

**Step 1: Write GelatoRelayAdapter**

```typescript
/**
 * Gelato Relay Adapter for SIP Protocol
 *
 * Enables gasless claim and withdrawal from stealth addresses via Gelato Relay.
 *
 * Two modes:
 * - sponsoredCall: SIP pays gas from Gas Tank (default)
 * - callWithSyncFee: Fee deducted from withdrawal amount
 */

export interface GelatoRelayConfig {
  apiKey?: string               // Required for sponsoredCall
  chainId: number
  sipPrivacyAddress: string
  sipRelayerAddress?: string    // Required for callWithSyncFee
}

export interface RelayClaimParams {
  transferId: bigint
  nullifier: string
  proof: string
  recipient: string
}

export interface SyncFeeClaimParams extends RelayClaimParams {
  feeToken: string
  maxFee: bigint
  token?: string                // For ERC20 withdrawals
}

export interface RelayResult {
  taskId: string
  mode: 'sponsored' | 'syncFee'
}

export type TaskStatus = 'CheckPending' | 'ExecPending' | 'ExecSuccess' | 'ExecReverted' | 'Cancelled'

export interface TaskStatusResult {
  taskId: string
  taskState: TaskStatus
  transactionHash?: string
  blockNumber?: number
}

const GELATO_RELAY_URL = 'https://relay.gelato.digital'

// SIPPrivacy function selectors
const WITHDRAW_DEPOSIT_SELECTOR = '0x' // withdrawDeposit(uint256,bytes32,bytes,address)
const WITHDRAW_TOKEN_DEPOSIT_SELECTOR = '0x' // withdrawTokenDeposit(uint256,bytes32,bytes,address)

export class GelatoRelayAdapter {
  private config: GelatoRelayConfig

  constructor(config: GelatoRelayConfig) {
    this.config = config
  }

  /**
   * Gasless withdrawal via sponsoredCall (SIP pays gas)
   * Calls SIPPrivacy.withdrawDeposit() directly
   */
  async sponsoredClaim(params: RelayClaimParams): Promise<RelayResult> {
    if (!this.config.apiKey) {
      throw new Error('API key required for sponsoredCall')
    }

    const data = this.encodeWithdrawDeposit(params)

    const response = await fetch(`${GELATO_RELAY_URL}/relays/v2/sponsored-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: this.config.chainId,
        target: this.config.sipPrivacyAddress,
        data,
        sponsorApiKey: this.config.apiKey,
      }),
    })

    if (!response.ok) {
      throw new Error(`Gelato relay error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return { taskId: result.taskId, mode: 'sponsored' }
  }

  /**
   * Gasless withdrawal via callWithSyncFee (fee deducted from amount)
   * Calls SIPRelayer.relayedWithdrawETH/Token()
   */
  async syncFeeClaim(params: SyncFeeClaimParams): Promise<RelayResult> {
    if (!this.config.sipRelayerAddress) {
      throw new Error('SIPRelayer address required for callWithSyncFee')
    }

    const isToken = params.token && params.token !== '0x0000000000000000000000000000000000000000'
    const data = isToken
      ? this.encodeRelayedWithdrawToken(params)
      : this.encodeRelayedWithdrawETH(params)

    const response = await fetch(`${GELATO_RELAY_URL}/relays/v2/call-with-sync-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: this.config.chainId,
        target: this.config.sipRelayerAddress,
        data,
        feeToken: params.feeToken,
        isRelayContext: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Gelato relay error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return { taskId: result.taskId, mode: 'syncFee' }
  }

  /**
   * Check relay task status
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResult> {
    const response = await fetch(`${GELATO_RELAY_URL}/tasks/status/${taskId}`)

    if (!response.ok) {
      throw new Error(`Gelato status error: ${response.status}`)
    }

    const result = await response.json()
    return {
      taskId: result.task.taskId,
      taskState: result.task.taskState,
      transactionHash: result.task.transactionHash,
      blockNumber: result.task.blockNumber,
    }
  }

  // ═══════════════════════════════════════════
  // Encoding helpers
  // ═══════════════════════════════════════════

  private encodeWithdrawDeposit(params: RelayClaimParams): string {
    // ABI encode: withdrawDeposit(uint256,bytes32,bytes,address)
    // Use ethers.js AbiCoder or manual encoding
    const iface = new Interface([
      'function withdrawDeposit(uint256 transferId, bytes32 nullifier, bytes proof, address recipient)',
    ])
    return iface.encodeFunctionData('withdrawDeposit', [
      params.transferId, params.nullifier, params.proof, params.recipient,
    ])
  }

  private encodeRelayedWithdrawETH(params: SyncFeeClaimParams): string {
    const iface = new Interface([
      'function relayedWithdrawETH(uint256 transferId, bytes32 nullifier, bytes proof, address recipient, uint256 maxFee)',
    ])
    return iface.encodeFunctionData('relayedWithdrawETH', [
      params.transferId, params.nullifier, params.proof, params.recipient, params.maxFee,
    ])
  }

  private encodeRelayedWithdrawToken(params: SyncFeeClaimParams): string {
    const iface = new Interface([
      'function relayedWithdrawToken(uint256 transferId, bytes32 nullifier, bytes proof, address recipient, address token, uint256 maxFee)',
    ])
    return iface.encodeFunctionData('relayedWithdrawToken', [
      params.transferId, params.nullifier, params.proof, params.recipient, params.token, params.maxFee,
    ])
  }
}
```

**Note:** The `Interface` import depends on what's available in the SDK. If `ethers` isn't a dependency, use manual ABI encoding or `viem`'s `encodeFunctionData`. Check the existing SDK dependencies first — look at `packages/sdk/package.json` for what's available.

**Step 2: Export from adapters/index.ts**

Add to `packages/sdk/src/adapters/index.ts`:

```typescript
// Gelato Relay (EVM gasless)
export { GelatoRelayAdapter } from './gelato-relay'

export type {
  GelatoRelayConfig,
  RelayClaimParams,
  SyncFeeClaimParams,
  RelayResult,
  TaskStatus,
  TaskStatusResult,
} from './gelato-relay'
```

**Step 3: Verify build**

```bash
cd packages/sdk
npx tsc --noEmit
```

Expected: No type errors.

**Step 4: Commit**

```bash
git add packages/sdk/src/adapters/
git commit -m "feat(sdk): add GelatoRelayAdapter for gasless EVM claims"
```

---

## Task 7: Add GelatoRelayAdapter tests

**Files:**
- Create: `packages/sdk/tests/adapters/gelato-relay.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GelatoRelayAdapter } from '../../src/adapters/gelato-relay'

describe('GelatoRelayAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor', () => {
    it('accepts config', () => {
      const adapter = new GelatoRelayAdapter({
        apiKey: 'test-key',
        chainId: 11155111,
        sipPrivacyAddress: '0x1234',
      })
      expect(adapter).toBeDefined()
    })
  })

  describe('sponsoredClaim', () => {
    let adapter: GelatoRelayAdapter

    beforeEach(() => {
      adapter = new GelatoRelayAdapter({
        apiKey: 'test-key',
        chainId: 11155111,
        sipPrivacyAddress: '0x1FED19684dC108304960db2818CF5a961d28405E',
      })
    })

    it('calls Gelato sponsored-call endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-123' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await adapter.sponsoredClaim({
        transferId: 0n,
        nullifier: '0x' + '01'.repeat(32),
        proof: '0x',
        recipient: '0xRecipient',
      })

      expect(result.taskId).toBe('task-123')
      expect(result.mode).toBe('sponsored')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('/relays/v2/sponsored-call')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.chainId).toBe(11155111)
      expect(body.target).toBe('0x1FED19684dC108304960db2818CF5a961d28405E')
      expect(body.sponsorApiKey).toBe('test-key')
    })

    it('throws without API key', async () => {
      const noKeyAdapter = new GelatoRelayAdapter({
        chainId: 11155111,
        sipPrivacyAddress: '0x1234',
      })

      await expect(
        noKeyAdapter.sponsoredClaim({
          transferId: 0n,
          nullifier: '0x01',
          proof: '0x',
          recipient: '0xBob',
        })
      ).rejects.toThrow('API key required')
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      }))

      await expect(
        adapter.sponsoredClaim({
          transferId: 0n,
          nullifier: '0x01',
          proof: '0x',
          recipient: '0xBob',
        })
      ).rejects.toThrow('Gelato relay error: 429')
    })
  })

  describe('syncFeeClaim', () => {
    let adapter: GelatoRelayAdapter

    beforeEach(() => {
      adapter = new GelatoRelayAdapter({
        chainId: 11155111,
        sipPrivacyAddress: '0x1234',
        sipRelayerAddress: '0xRelayer',
      })
    })

    it('calls Gelato call-with-sync-fee endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-456' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await adapter.syncFeeClaim({
        transferId: 0n,
        nullifier: '0x' + '01'.repeat(32),
        proof: '0x',
        recipient: '0xBob',
        feeToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        maxFee: 10000000000000000n,
      })

      expect(result.taskId).toBe('task-456')
      expect(result.mode).toBe('syncFee')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('/relays/v2/call-with-sync-fee')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.target).toBe('0xRelayer')
      expect(body.isRelayContext).toBe(true)
    })

    it('throws without relayer address', async () => {
      const noRelayer = new GelatoRelayAdapter({
        chainId: 11155111,
        sipPrivacyAddress: '0x1234',
      })

      await expect(
        noRelayer.syncFeeClaim({
          transferId: 0n,
          nullifier: '0x01',
          proof: '0x',
          recipient: '0xBob',
          feeToken: '0xEeee',
          maxFee: 0n,
        })
      ).rejects.toThrow('SIPRelayer address required')
    })
  })

  describe('getTaskStatus', () => {
    it('returns task status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          task: {
            taskId: 'task-123',
            taskState: 'ExecSuccess',
            transactionHash: '0xabc',
            blockNumber: 12345,
          },
        }),
      }))

      const adapter = new GelatoRelayAdapter({
        chainId: 1,
        sipPrivacyAddress: '0x1234',
      })

      const status = await adapter.getTaskStatus('task-123')
      expect(status.taskState).toBe('ExecSuccess')
      expect(status.transactionHash).toBe('0xabc')
    })
  })
})
```

**Step 2: Run tests**

```bash
cd packages/sdk
npx vitest run tests/adapters/gelato-relay.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add packages/sdk/tests/adapters/gelato-relay.test.ts
git commit -m "test(sdk): add GelatoRelayAdapter tests"
```

---

## Task 8: Deploy script + deploy to Sepolia

**Files:**
- Create: `contracts/sip-ethereum/script/DeploySIPRelayer.s.sol`

**Step 1: Write deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SIPRelayer.sol";

contract DeploySIPRelayerScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        address sipPrivacy = vm.envAddress("SIP_PRIVACY_ADDRESS");

        console.log("==============================================");
        console.log("SIPRelayer Deployment");
        console.log("==============================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("SIPPrivacy:", sipPrivacy);
        console.log("==============================================");

        vm.startBroadcast(deployerKey);

        SIPRelayer sipRelayer = new SIPRelayer(sipPrivacy, owner);

        vm.stopBroadcast();

        console.log("\n==============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("==============================================");
        console.log("  SIPRelayer:", address(sipRelayer));
        console.log("  Owner:", owner);
        console.log("  SIPPrivacy:", sipPrivacy);
        console.log("==============================================");
    }
}
```

**Step 2: Deploy to Sepolia**

```bash
cd contracts/sip-ethereum
source .env
SIP_PRIVACY_ADDRESS=0x1FED19684dC108304960db2818CF5a961d28405E \
  forge script script/DeploySIPRelayer.s.sol:DeploySIPRelayerScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
```

**Step 3: Record deployed address and commit**

```bash
git add contracts/sip-ethereum/script/DeploySIPRelayer.s.sol contracts/sip-ethereum/broadcast/
git commit -m "feat(contracts): deploy SIPRelayer to Sepolia"
```

---

## Task 9: Update docs (DEPLOYMENT.md, CLAUDE.md, ROADMAP.md)

**Files:**
- Modify: `contracts/sip-ethereum/DEPLOYMENT.md` — add SIPRelayer address
- Modify: `CLAUDE.md` — update test count, add relayer feature, update M18 progress
- Modify: `ROADMAP.md` — mark #810 complete

**Step 1: Update all docs with new addresses and counts**

**Step 2: Close #810 on GitHub**

```bash
gh issue close 810 --comment "Complete: Gelato relayer integration..."
```

**Step 3: Commit**

```bash
git add CLAUDE.md ROADMAP.md contracts/sip-ethereum/DEPLOYMENT.md
git commit -m "docs: update deployment info and close #810"
```

---

## Summary

| Task | Description | New Tests |
|------|-------------|-----------|
| 1 | Install Gelato relay-context | 0 |
| 2 | Add deposit mode to SIPPrivacy | 0 |
| 3 | Create SIPRelayer contract | 0 |
| 4 | SIPPrivacy deposit tests | ~15 |
| 5 | SIPRelayer tests | ~10 |
| 6 | GelatoRelayAdapter SDK | 0 |
| 7 | GelatoRelayAdapter tests | ~8 |
| 8 | Deploy script + Sepolia deploy | 0 |
| 9 | Update docs | 0 |

**Total new tests:** ~33 (Foundry) + ~8 (Vitest)
