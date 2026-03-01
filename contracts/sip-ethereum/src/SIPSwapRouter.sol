// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/**
 * @title SIPSwapRouter
 * @author SIP Protocol Team
 * @notice Privacy-preserving DEX swaps via Uniswap V3 with stealth address output
 *
 * @dev Wraps Uniswap V3 SwapRouter to execute swaps where the output tokens
 * go directly to a stealth address, breaking the on-chain identity link.
 *
 * ## Architecture
 *
 * ```
 * User → SIPSwapRouter.privateSwap()
 *   1. Deduct SIP fee from input
 *   2. Wrap ETH → WETH if native input
 *   3. Approve Uniswap SwapRouter
 *   4. SwapRouter.exactInputSingle(recipient = stealthAddress)
 *   5. Output goes DIRECTLY: Uniswap → stealth address
 *   6. Emit ShieldedSwap + EIP-5564 Announcement
 * ```
 *
 * The output tokens never touch this contract — Uniswap sends them
 * directly to the stealth address. Minimal trust surface.
 */
contract SIPSwapRouter is ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Maximum fee in basis points (10%)
    uint256 public constant MAX_FEE_BPS = 1000;

    /// @notice Maximum encrypted amount size (XChaCha20-Poly1305)
    uint256 public constant MAX_ENCRYPTED_SIZE = 64;

    /// @notice Default swap deadline offset (20 minutes)
    uint256 public constant DEFAULT_DEADLINE_OFFSET = 1200;

    /// @notice Native ETH sentinel address
    address public constant NATIVE_TOKEN = address(0);

    // ═══════════════════════════════════════════════════════════════════════════
    // Immutables
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Uniswap V3 SwapRouter (chain-specific, set at deploy)
    ISwapRouter public immutable swapRouter;

    /// @notice Wrapped ETH contract (chain-specific, set at deploy)
    IWETH public immutable WETH;

    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Contract owner
    address public owner;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Protocol fee in basis points (100 = 1%)
    uint256 public feeBps;

    /// @notice Whether the contract is paused
    bool public paused;

    /// @notice Total number of swaps (used for unique IDs)
    uint256 public totalSwaps;

    /// @notice Swap records by ID
    mapping(uint256 => SwapRecord) public swaps;

    // ═══════════════════════════════════════════════════════════════════════════
    // Structs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Parameters for a single-hop private swap
    struct PrivateSwapParams {
        address tokenIn;           // Input token (address(0) for ETH)
        address tokenOut;          // Output token
        uint24 poolFee;            // Uniswap pool fee tier (500, 3000, 10000)
        uint256 amountIn;          // Input amount (ignored for ETH — uses msg.value)
        uint256 amountOutMinimum;  // Slippage protection
        uint160 sqrtPriceLimitX96; // Price limit (0 = no limit)
        address stealthRecipient;  // Stealth address for output
        bytes32 commitment;        // Pedersen commitment to output amount
        bytes32 ephemeralPubKey;   // For stealth key derivation
        bytes32 viewingKeyHash;    // For compliance scanning
        bytes encryptedAmount;     // Amount encrypted with viewing key
        uint256 deadline;          // Swap deadline (0 = default 20 min)
    }

    /// @notice Parameters for a multi-hop private swap
    struct PrivateMultiSwapParams {
        bytes path;                // Uniswap V3 encoded path
        address tokenIn;           // First token in path (address(0) for ETH)
        uint256 amountIn;          // Input amount
        uint256 amountOutMinimum;  // Slippage protection
        address stealthRecipient;  // Stealth address for output
        bytes32 commitment;        // Pedersen commitment
        bytes32 ephemeralPubKey;   // Ephemeral public key
        bytes32 viewingKeyHash;    // Viewing key hash
        bytes encryptedAmount;     // Encrypted amount
        uint256 deadline;          // Swap deadline (0 = default 20 min)
    }

    /// @notice Record of a shielded swap
    struct SwapRecord {
        address sender;
        address stealthRecipient;
        address tokenIn;
        address tokenOut;
        bytes32 commitment;
        bytes32 ephemeralPubKey;
        bytes32 viewingKeyHash;
        bytes encryptedAmount;
        uint256 amountIn;
        uint256 amountOut;
        uint64 timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted for every shielded swap
    event ShieldedSwap(
        uint256 indexed swapId,
        address indexed sender,
        address indexed stealthRecipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash
    );

    /// @notice EIP-5564 Announcement for stealth address scanning
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    /// @notice Emitted when contract is paused/unpaused
    event Paused(bool paused);

    /// @notice Emitted when fee is updated
    event FeeUpdated(uint256 newFeeBps);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ContractPaused();
    error Unauthorized();
    error InvalidCommitment();
    error InvalidAmount();
    error FeeTooHigh();
    error ZeroAddress();
    error SwapFailed();
    error EncryptedDataTooLarge();
    error InvalidPath();
    error DeadlineExpired();
    error RefundFailed();
    error TransferFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the SIPSwapRouter
     * @param _owner Contract owner
     * @param _feeCollector Fee recipient
     * @param _feeBps Initial fee (basis points)
     * @param _swapRouter Uniswap V3 SwapRouter address
     * @param _weth WETH address for this chain
     */
    constructor(
        address _owner,
        address _feeCollector,
        uint256 _feeBps,
        address _swapRouter,
        address _weth
    ) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_feeCollector == address(0)) revert ZeroAddress();
        if (_swapRouter == address(0)) revert ZeroAddress();
        if (_weth == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        owner = _owner;
        feeCollector = _feeCollector;
        feeBps = _feeBps;
        swapRouter = ISwapRouter(_swapRouter);
        WETH = IWETH(_weth);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External — Swaps
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a single-hop private swap via Uniswap V3
     * @param params Swap parameters including stealth recipient and privacy metadata
     * @return swapId Unique swap identifier
     *
     * @dev For ETH input: send ETH as msg.value, set tokenIn = address(0).
     *      For ERC20 input: approve this contract first, set amountIn.
     *      Output tokens go directly from Uniswap to the stealth address.
     */
    function privateSwap(PrivateSwapParams calldata params)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 swapId)
    {
        // Validate common params
        _validateSwapParams(
            params.stealthRecipient,
            params.commitment,
            params.encryptedAmount,
            params.deadline
        );

        uint256 effectiveDeadline = _effectiveDeadline(params.deadline);
        address effectiveTokenIn;
        uint256 swapAmount;

        if (params.tokenIn == NATIVE_TOKEN) {
            // ETH input
            if (msg.value == 0) revert InvalidAmount();

            swapAmount = _deductFeeETH(msg.value);

            // Wrap ETH → WETH
            WETH.deposit{value: swapAmount}();
            _safeApprove(address(WETH), address(swapRouter), swapAmount);
            effectiveTokenIn = address(WETH);
        } else {
            // ERC20 input
            if (params.amountIn == 0) revert InvalidAmount();

            // Pull tokens from sender
            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

            swapAmount = _deductFeeERC20(params.tokenIn, params.amountIn);

            _safeApprove(params.tokenIn, address(swapRouter), swapAmount);
            effectiveTokenIn = params.tokenIn;
        }

        // Execute Uniswap V3 swap — output goes directly to stealth address
        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: effectiveTokenIn,
                tokenOut: params.tokenOut,
                fee: params.poolFee,
                recipient: params.stealthRecipient,
                deadline: effectiveDeadline,
                amountIn: swapAmount,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );

        // Record and emit
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

    /**
     * @notice Execute a multi-hop private swap via Uniswap V3
     * @param params Multi-hop swap parameters with encoded path
     * @return swapId Unique swap identifier
     *
     * @dev Path encoding: abi.encodePacked(tokenA, uint24(fee), tokenB, uint24(fee), tokenC)
     *      Minimum path length is 43 bytes (20 + 3 + 20 for a single hop).
     */
    function privateMultiSwap(PrivateMultiSwapParams calldata params)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 swapId)
    {
        // Validate common params
        _validateSwapParams(
            params.stealthRecipient,
            params.commitment,
            params.encryptedAmount,
            params.deadline
        );

        // Validate path: minimum 43 bytes (20 addr + 3 fee + 20 addr)
        if (params.path.length < 43) revert InvalidPath();

        uint256 effectiveDeadline = _effectiveDeadline(params.deadline);
        uint256 swapAmount;

        if (params.tokenIn == NATIVE_TOKEN) {
            if (msg.value == 0) revert InvalidAmount();

            swapAmount = _deductFeeETH(msg.value);

            WETH.deposit{value: swapAmount}();
            _safeApprove(address(WETH), address(swapRouter), swapAmount);
        } else {
            if (params.amountIn == 0) revert InvalidAmount();

            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
            swapAmount = _deductFeeERC20(params.tokenIn, params.amountIn);
            _safeApprove(params.tokenIn, address(swapRouter), swapAmount);
        }

        uint256 amountOut = swapRouter.exactInput(
            ISwapRouter.ExactInputParams({
                path: params.path,
                recipient: params.stealthRecipient,
                deadline: effectiveDeadline,
                amountIn: swapAmount,
                amountOutMinimum: params.amountOutMinimum
            })
        );

        // Extract tokenOut from path (last 20 bytes)
        address tokenOut = _extractTokenOut(params.path);

        swapId = _recordSwap(
            params.stealthRecipient,
            params.tokenIn,
            tokenOut,
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

    // ═══════════════════════════════════════════════════════════════════════════
    // External — Admin
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Pause or unpause the contract
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Update the protocol fee
    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /// @notice Update the fee collector address
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
    }

    /// @notice Transfer contract ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    /// @notice Emergency recovery for stuck tokens
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == NATIVE_TOKEN) {
            (bool success,) = owner.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get a swap record
    function getSwap(uint256 swapId) external view returns (SwapRecord memory) {
        return swaps[swapId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Validate common swap parameters
    function _validateSwapParams(
        address stealthRecipient,
        bytes32 commitment,
        bytes calldata encryptedAmount,
        uint256 deadline
    ) internal view {
        if (stealthRecipient == address(0)) revert ZeroAddress();
        if (!_isValidCommitment(commitment)) revert InvalidCommitment();
        if (encryptedAmount.length > MAX_ENCRYPTED_SIZE) revert EncryptedDataTooLarge();
        if (deadline != 0 && deadline < block.timestamp) revert DeadlineExpired();
    }

    /// @notice Validate Pedersen commitment format (0x02 or 0x03 prefix)
    function _isValidCommitment(bytes32 commitment) internal pure returns (bool) {
        if (commitment == bytes32(0)) return false;
        uint8 prefix = uint8(uint256(commitment) >> 248);
        return prefix == 0x02 || prefix == 0x03;
    }

    /// @notice Calculate effective deadline
    function _effectiveDeadline(uint256 userDeadline) internal view returns (uint256) {
        return userDeadline > 0 ? userDeadline : block.timestamp + DEFAULT_DEADLINE_OFFSET;
    }

    /// @notice Deduct fee from ETH input, send fee to collector
    function _deductFeeETH(uint256 amount) internal returns (uint256 swapAmount) {
        uint256 feeAmount = (amount * feeBps) / 10000;
        swapAmount = amount - feeAmount;

        if (feeAmount > 0) {
            (bool success,) = feeCollector.call{value: feeAmount}("");
            if (!success) revert TransferFailed();
        }
    }

    /// @notice Deduct fee from ERC20 input, send fee to collector
    function _deductFeeERC20(address token, uint256 amount) internal returns (uint256 swapAmount) {
        uint256 feeAmount = (amount * feeBps) / 10000;
        swapAmount = amount - feeAmount;

        if (feeAmount > 0) {
            IERC20(token).transfer(feeCollector, feeAmount);
        }
    }

    /// @notice Safe approve pattern (reset to 0 first for USDT-like tokens)
    function _safeApprove(address token, address spender, uint256 amount) internal {
        IERC20(token).approve(spender, 0);
        IERC20(token).approve(spender, amount);
    }

    /// @notice Extract the output token from a Uniswap V3 encoded path
    function _extractTokenOut(bytes calldata path) internal pure returns (address tokenOut) {
        // Path format: addr(20) | fee(3) | addr(20) | fee(3) | addr(20)
        // Output token is the last 20 bytes
        assembly {
            tokenOut := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
    }

    /// @notice Store swap record and emit ShieldedSwap event
    function _recordSwap(
        address stealthRecipient,
        address tokenIn,
        address tokenOut,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount,
        uint256 amountIn,
        uint256 amountOut
    ) internal returns (uint256 swapId) {
        swapId = totalSwaps++;
        swaps[swapId] = SwapRecord({
            sender: msg.sender,
            stealthRecipient: stealthRecipient,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            commitment: commitment,
            ephemeralPubKey: ephemeralPubKey,
            viewingKeyHash: viewingKeyHash,
            encryptedAmount: encryptedAmount,
            amountIn: amountIn,
            amountOut: amountOut,
            timestamp: uint64(block.timestamp)
        });

        emit ShieldedSwap(
            swapId,
            msg.sender,
            stealthRecipient,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            commitment,
            ephemeralPubKey,
            viewingKeyHash
        );
    }

    /// @notice Emit EIP-5564 Announcement for stealth address scanning
    function _emitAnnouncement(
        address stealthRecipient,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount
    ) internal {
        emit Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealthRecipient,
            msg.sender,
            abi.encodePacked(ephemeralPubKey),
            abi.encodePacked(uint8(uint256(viewingKeyHash) >> 248), encryptedAmount)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Receive ETH (needed for WETH unwrapping and direct sends)
    receive() external payable {}
}
