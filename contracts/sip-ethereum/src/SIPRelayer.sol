// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GelatoRelayContext} from "@gelatonetwork/relay-context/contracts/GelatoRelayContext.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SIPPrivacy} from "./SIPPrivacy.sol";

/**
 * @title SIP Relayer - Gasless Withdrawals via Gelato
 * @author SIP Protocol Team
 * @notice Wraps SIPPrivacy deposit withdrawals for Gelato's callWithSyncFee mode,
 *         enabling recipients to withdraw without holding ETH for gas.
 *
 * ## How It Works
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  RECIPIENT (no ETH for gas)                                              │
 * │  1. Signs withdrawal intent (transferId, nullifier, proof, recipient)    │
 * │  2. Submits to Gelato Relay API (off-chain)                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GELATO RELAY                                                            │
 * │  1. Executes relayedWithdrawETH/relayedWithdrawToken on-chain           │
 * │  2. Appends fee data to calldata (feeCollector, feeToken, fee)          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  SIP RELAYER (this contract)                                             │
 * │  1. Calls SIPPrivacy.withdrawDeposit (receives funds)                   │
 * │  2. Pays Gelato fee from received funds                                  │
 * │  3. Forwards remaining to recipient                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 * ```
 */
contract SIPRelayer is GelatoRelayContext, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // State Variables
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SIPPrivacy contract for deposit withdrawals
    SIPPrivacy public immutable sipPrivacy;

    /// @notice Contract owner/admin
    address public owner;

    /// @notice Whether the relayer is paused
    bool public paused;

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when a relayed ETH withdrawal completes
     * @param transferId The deposit transfer ID
     * @param recipient Final recipient
     * @param amount Amount received by recipient (after Gelato fee)
     * @param gelatoFee Fee paid to Gelato relay
     */
    event RelayedWithdrawal(
        uint256 indexed transferId,
        address indexed recipient,
        uint256 amount,
        uint256 gelatoFee
    );

    /**
     * @notice Emitted when a relayed token withdrawal completes
     * @param transferId The deposit transfer ID
     * @param recipient Final recipient
     * @param token Token address
     * @param amount Amount received by recipient (after Gelato fee)
     * @param gelatoFee Fee paid to Gelato relay
     */
    event RelayedTokenWithdrawal(
        uint256 indexed transferId,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 gelatoFee
    );

    /// @notice Emitted when relayer is paused/unpaused
    event Paused(bool paused);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error RelayerPaused();
    error Unauthorized();
    error ZeroAddress();
    error InsufficientBalance();
    error TransferFailed();
    error FeeTokenMismatch();

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert RelayerPaused();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the SIP Relayer
     * @param _sipPrivacy Address of the SIPPrivacy contract
     * @param _owner Contract owner
     */
    constructor(address _sipPrivacy, address _owner) {
        if (_sipPrivacy == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();

        sipPrivacy = SIPPrivacy(payable(_sipPrivacy));
        owner = _owner;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Relayed Withdrawals
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Relay a gasless ETH deposit withdrawal
     * @dev Only callable by Gelato Relay. Withdraws ETH from SIPPrivacy,
     *      pays Gelato fee, forwards remaining to recipient.
     * @param transferId The deposit transfer to withdraw
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     * @param maxFee Maximum fee the user is willing to pay to Gelato
     */
    function relayedWithdrawETH(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        uint256 maxFee
    ) external onlyGelatoRelay whenNotPaused nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        // Validate Gelato fee token is native ETH
        if (_getFeeToken() != 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) revert FeeTokenMismatch();

        // Capture fee before paying
        uint256 gelatoFee = _getFee();

        // Record balance before withdrawal
        uint256 balanceBefore = address(this).balance;

        // Withdraw from SIPPrivacy (funds sent to this contract)
        sipPrivacy.withdrawDeposit(transferId, nullifier, proof, address(this));

        // Calculate received amount
        uint256 received = address(this).balance - balanceBefore;

        // Pay Gelato fee (reverts if fee > maxFee)
        _transferRelayFeeCapped(maxFee);

        // Calculate remaining after fee
        uint256 remaining = received - gelatoFee;
        if (remaining == 0) revert InsufficientBalance();

        // Forward remaining ETH to recipient
        (bool success,) = recipient.call{value: remaining}("");
        if (!success) revert TransferFailed();

        emit RelayedWithdrawal(transferId, recipient, remaining, gelatoFee);
    }

    /**
     * @notice Relay a gasless ERC20 token deposit withdrawal
     * @dev Only callable by Gelato Relay. Withdraws tokens from SIPPrivacy,
     *      pays Gelato fee, forwards remaining to recipient.
     * @param transferId The deposit transfer to withdraw
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     * @param token ERC20 token address
     * @param maxFee Maximum fee the user is willing to pay to Gelato
     */
    function relayedWithdrawToken(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        address token,
        uint256 maxFee
    ) external onlyGelatoRelay whenNotPaused nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (token == address(0)) revert ZeroAddress();

        // Validate Gelato fee token matches withdrawal token
        if (_getFeeToken() != token) revert FeeTokenMismatch();

        // Capture fee before paying
        uint256 gelatoFee = _getFee();

        // Record token balance before withdrawal
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        // Withdraw from SIPPrivacy (tokens sent to this contract)
        sipPrivacy.withdrawTokenDeposit(transferId, nullifier, proof, address(this));

        // Calculate received amount
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;

        // Pay Gelato fee (reverts if fee > maxFee)
        _transferRelayFeeCapped(maxFee);

        // Calculate remaining after fee
        uint256 remaining = received - gelatoFee;
        if (remaining == 0) revert InsufficientBalance();

        // Forward remaining tokens to recipient
        IERC20(token).safeTransfer(recipient, remaining);

        emit RelayedTokenWithdrawal(transferId, recipient, token, remaining, gelatoFee);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Admin
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Pause or unpause the relayer
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /**
     * @notice Rescue stuck ETH (e.g., from failed relays)
     * @param to Recipient address
     * @param amount Amount to rescue
     */
    function rescueETH(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Rescue stuck ERC20 tokens
     * @param token Token address
     * @param to Recipient address
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Accept ETH from SIPPrivacy withdrawals
    receive() external payable {}
}
