// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IPedersenVerifier} from "./interfaces/IPedersenVerifier.sol";
import {IZKVerifier} from "./interfaces/IZKVerifier.sol";

/**
 * @title SIP Privacy - Shielded Transfers on Ethereum
 * @author SIP Protocol Team
 * @notice Privacy-preserving transfers using Pedersen commitments and stealth addresses
 * @dev Implements EIP-5564 compatible stealth addresses with Pedersen commitment-based privacy
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SENDER (off-chain)                                                         │
 * │  1. Generate stealth address from recipient's public keys                   │
 * │  2. Create Pedersen commitment: C = v*G + r*H                               │
 * │  3. Encrypt amount for recipient                                            │
 * │  4. Generate ZK proof of valid commitment                                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SIP PRIVACY CONTRACT (this contract)                                       │
 * │  1. Verify Pedersen commitment format                                       │
 * │  2. Verify ZK proof (optional, can be off-chain)                            │
 * │  3. Store TransferRecord                                                    │
 * │  4. Transfer funds to stealth address                                       │
 * │  5. Emit ShieldedTransfer event                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  RECIPIENT                                                                  │
 * │  1. Scan events with viewing key                                            │
 * │  2. Derive stealth private key                                              │
 * │  3. Call claimTransfer with nullifier                                       │
 * │  4. Receive funds                                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * ```
 */
contract SIPPrivacy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Pedersen commitment size (compressed secp256k1 point = 33 bytes)
    uint256 public constant COMMITMENT_SIZE = 33;

    /// @notice Maximum proof size (UltraHonk proofs ~2KB)
    uint256 public constant MAX_PROOF_SIZE = 4096;

    /// @notice Maximum encrypted amount size (XChaCha20-Poly1305)
    uint256 public constant MAX_ENCRYPTED_SIZE = 64;

    /// @notice Maximum fee in basis points (10%)
    uint256 public constant MAX_FEE_BPS = 1000;

    /// @notice Native ETH token identifier
    address public constant NATIVE_TOKEN = address(0);

    // ═══════════════════════════════════════════════════════════════════════════
    // State Variables
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Contract owner/admin
    address public owner;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Protocol fee in basis points (100 = 1%)
    uint256 public feeBps;

    /// @notice Whether the contract is paused
    bool public paused;

    /// @notice Total number of transfers (used for unique IDs)
    uint256 public totalTransfers;

    /// @notice Pedersen commitment verifier contract
    IPedersenVerifier public pedersenVerifier;

    /// @notice ZK proof verifier contract
    IZKVerifier public zkVerifier;

    /// @notice Transfer records by ID
    mapping(uint256 => TransferRecord) public transfers;

    /// @notice Nullifier tracking to prevent double-claims
    mapping(bytes32 => bool) public nullifiers;

    /// @notice Deposit balances by transfer ID (for gasless relay withdrawals)
    mapping(uint256 => uint256) public depositBalances;

    /// @notice Token address stored per deposit (needed for token withdrawals)
    mapping(uint256 => address) public depositTokens;

    // ═══════════════════════════════════════════════════════════════════════════
    // Structs
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Record of a shielded transfer
     * @param sender Original sender address
     * @param stealthRecipient One-time stealth address
     * @param token Token address (address(0) for ETH)
     * @param commitment Pedersen commitment to the amount
     * @param ephemeralPubKey Ephemeral public key for stealth derivation
     * @param viewingKeyHash Hash of recipient's viewing key
     * @param encryptedAmount Amount encrypted for recipient
     * @param timestamp Block timestamp
     * @param claimed Whether the transfer has been claimed
     */
    struct TransferRecord {
        address sender;
        address stealthRecipient;
        address token;
        bytes32 commitment;
        bytes32 ephemeralPubKey;
        bytes32 viewingKeyHash;
        bytes encryptedAmount;
        uint64 timestamp;
        bool claimed;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when a shielded transfer is created
     * @param transferId Unique transfer identifier
     * @param sender Original sender
     * @param stealthRecipient Stealth address
     * @param token Token address
     * @param commitment Pedersen commitment
     * @param ephemeralPubKey For stealth key derivation
     * @param viewingKeyHash For compliance scanning
     */
    event ShieldedTransfer(
        uint256 indexed transferId,
        address indexed sender,
        address indexed stealthRecipient,
        address token,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash
    );

    /**
     * @notice Emitted when a transfer is claimed
     * @param transferId Transfer being claimed
     * @param nullifier Nullifier preventing replay
     * @param recipient Final recipient
     */
    event TransferClaimed(
        uint256 indexed transferId,
        bytes32 indexed nullifier,
        address indexed recipient
    );

    /**
     * @notice Emitted when contract is paused/unpaused
     * @param paused New pause state
     */
    event Paused(bool paused);

    /**
     * @notice Emitted when fee is updated
     * @param newFeeBps New fee in basis points
     */
    event FeeUpdated(uint256 newFeeBps);

    /**
     * @notice Emitted when a shielded deposit is created (funds held in contract)
     * @param transferId Unique transfer identifier
     * @param sender Original sender
     * @param stealthRecipient Stealth address (for scanning/identification)
     * @param token Token address (address(0) for ETH)
     * @param commitment Pedersen commitment
     * @param ephemeralPubKey For stealth key derivation
     * @param timestamp Block timestamp
     */
    event ShieldedDeposit(
        uint256 indexed transferId,
        address indexed sender,
        address indexed stealthRecipient,
        address token,
        bytes32 commitment,
        bytes32 ephemeralPubKey,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a deposit is withdrawn
     * @param transferId Transfer being withdrawn
     * @param nullifier Nullifier preventing replay
     * @param recipient Final recipient
     * @param token Token address (address(0) for ETH)
     * @param amount Amount withdrawn
     */
    event DepositWithdrawn(
        uint256 indexed transferId,
        bytes32 indexed nullifier,
        address indexed recipient,
        address token,
        uint256 amount
    );

    /**
     * @notice EIP-5564 compatible Announcement event
     * @dev Emitted alongside ShieldedTransfer for EIP-5564 scanner compatibility
     * @param schemeId The stealth address scheme (1 = secp256k1 with view tags)
     * @param stealthAddress The generated stealth address
     * @param caller The address that initiated the transfer
     * @param ephemeralPubKey The ephemeral public key for shared secret derivation
     * @param metadata View tag (first byte) + encrypted amount
     */
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ContractPaused();
    error Unauthorized();
    error InvalidCommitment();
    error InvalidProof();
    error ProofTooLarge();
    error EncryptedDataTooLarge();
    error InvalidAmount();
    error TransferNotFound();
    error AlreadyClaimed();
    error NullifierUsed();
    error InvalidNullifier();
    error FeeTooHigh();
    error TransferFailed();
    error ZeroAddress();
    error NotDeposit();

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
     * @notice Initialize the SIP Privacy contract
     * @param _owner Contract owner
     * @param _feeCollector Fee recipient
     * @param _feeBps Initial fee (basis points)
     */
    constructor(address _owner, address _feeCollector, uint256 _feeBps) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_feeCollector == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        owner = _owner;
        feeCollector = _feeCollector;
        feeBps = _feeBps;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Transfers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a shielded ETH transfer
     * @param commitment Pedersen commitment to the amount
     * @param stealthRecipient One-time recipient address
     * @param ephemeralPubKey For stealth key derivation
     * @param viewingKeyHash For compliance scanning
     * @param encryptedAmount Amount encrypted with viewing key
     * @param proof ZK proof of valid commitment (optional if off-chain verified)
     * @return transferId The unique transfer ID
     *
     * @dev The actual transfer amount is msg.value. The commitment hides this
     * value from on-chain observers while still allowing verification.
     */
    function shieldedTransfer(
        bytes32 commitment,
        address stealthRecipient,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount,
        bytes calldata proof
    ) external payable whenNotPaused nonReentrant returns (uint256 transferId) {
        // Validate inputs
        if (msg.value == 0) revert InvalidAmount();
        if (stealthRecipient == address(0)) revert ZeroAddress();
        if (encryptedAmount.length > MAX_ENCRYPTED_SIZE) revert EncryptedDataTooLarge();
        if (proof.length > MAX_PROOF_SIZE) revert ProofTooLarge();

        // Validate commitment format (should start with 0x02 or 0x03 for compressed point)
        if (!_isValidCommitment(commitment)) revert InvalidCommitment();

        // Verify ZK proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Calculate fee
        uint256 feeAmount = (msg.value * feeBps) / 10000;
        uint256 transferAmount = msg.value - feeAmount;

        // Create transfer record
        transferId = totalTransfers++;
        transfers[transferId] = TransferRecord({
            sender: msg.sender,
            stealthRecipient: stealthRecipient,
            token: NATIVE_TOKEN,
            commitment: commitment,
            ephemeralPubKey: ephemeralPubKey,
            viewingKeyHash: viewingKeyHash,
            encryptedAmount: encryptedAmount,
            timestamp: uint64(block.timestamp),
            claimed: false
        });

        // Transfer ETH to stealth address
        (bool success,) = stealthRecipient.call{value: transferAmount}("");
        if (!success) revert TransferFailed();

        // Transfer fee to collector
        if (feeAmount > 0) {
            (bool feeSuccess,) = feeCollector.call{value: feeAmount}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit ShieldedTransfer(
            transferId,
            msg.sender,
            stealthRecipient,
            NATIVE_TOKEN,
            commitment,
            ephemeralPubKey,
            viewingKeyHash
        );

        // Emit EIP-5564 compatible Announcement for scanner compatibility
        // Scheme 1 = secp256k1 with view tags
        // Metadata = viewTag (1 byte from viewingKeyHash) + encryptedAmount
        emit Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealthRecipient,
            msg.sender,
            abi.encodePacked(ephemeralPubKey), // Convert bytes32 to bytes
            abi.encodePacked(uint8(uint256(viewingKeyHash) >> 248), encryptedAmount)
        );
    }

    /**
     * @notice Execute a shielded ERC20 token transfer
     * @param token ERC20 token address
     * @param amount Token amount to transfer
     * @param commitment Pedersen commitment to the amount
     * @param stealthRecipient One-time recipient address
     * @param ephemeralPubKey For stealth key derivation
     * @param viewingKeyHash For compliance scanning
     * @param encryptedAmount Amount encrypted with viewing key
     * @param proof ZK proof of valid commitment
     * @return transferId The unique transfer ID
     */
    function shieldedTokenTransfer(
        address token,
        uint256 amount,
        bytes32 commitment,
        address stealthRecipient,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount,
        bytes calldata proof
    ) external whenNotPaused nonReentrant returns (uint256 transferId) {
        // Validate inputs
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (stealthRecipient == address(0)) revert ZeroAddress();
        if (encryptedAmount.length > MAX_ENCRYPTED_SIZE) revert EncryptedDataTooLarge();
        if (proof.length > MAX_PROOF_SIZE) revert ProofTooLarge();

        // Validate commitment
        if (!_isValidCommitment(commitment)) revert InvalidCommitment();

        // Verify ZK proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Calculate fee
        uint256 feeAmount = (amount * feeBps) / 10000;
        uint256 transferAmount = amount - feeAmount;

        // Create transfer record
        transferId = totalTransfers++;
        transfers[transferId] = TransferRecord({
            sender: msg.sender,
            stealthRecipient: stealthRecipient,
            token: token,
            commitment: commitment,
            ephemeralPubKey: ephemeralPubKey,
            viewingKeyHash: viewingKeyHash,
            encryptedAmount: encryptedAmount,
            timestamp: uint64(block.timestamp),
            claimed: false
        });

        // Transfer tokens from sender to stealth address
        IERC20(token).transferFrom(msg.sender, stealthRecipient, transferAmount);

        // Transfer fee to collector
        if (feeAmount > 0) {
            IERC20(token).transferFrom(msg.sender, feeCollector, feeAmount);
        }

        emit ShieldedTransfer(
            transferId,
            msg.sender,
            stealthRecipient,
            token,
            commitment,
            ephemeralPubKey,
            viewingKeyHash
        );

        // Emit EIP-5564 compatible Announcement for scanner compatibility
        emit Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealthRecipient,
            msg.sender,
            abi.encodePacked(ephemeralPubKey),
            abi.encodePacked(uint8(uint256(viewingKeyHash) >> 248), encryptedAmount)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Claims
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Claim a shielded ETH transfer
     * @param transferId The transfer to claim
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     *
     * @dev The nullifier must be derived from the transfer and stealth private key
     * to prevent replay attacks while maintaining privacy.
     */
    function claimTransfer(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient
    ) external whenNotPaused nonReentrant {
        TransferRecord storage record = transfers[transferId];

        // Validate transfer exists and not claimed
        if (record.sender == address(0)) revert TransferNotFound();
        if (record.claimed) revert AlreadyClaimed();
        if (record.token != NATIVE_TOKEN) revert InvalidAmount();

        // Validate nullifier not used
        if (nullifiers[nullifier]) revert NullifierUsed();
        if (nullifier == bytes32(0)) revert InvalidNullifier();

        // Verify proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(record.commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Mark transfer as claimed
        record.claimed = true;

        emit TransferClaimed(transferId, nullifier, recipient);
    }

    /**
     * @notice Claim a shielded ERC20 transfer
     * @param transferId The transfer to claim
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     */
    function claimTokenTransfer(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient
    ) external whenNotPaused nonReentrant {
        TransferRecord storage record = transfers[transferId];

        // Validate transfer exists and not claimed
        if (record.sender == address(0)) revert TransferNotFound();
        if (record.claimed) revert AlreadyClaimed();
        if (record.token == NATIVE_TOKEN) revert InvalidAmount();

        // Validate nullifier not used
        if (nullifiers[nullifier]) revert NullifierUsed();
        if (nullifier == bytes32(0)) revert InvalidNullifier();

        // Verify proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(record.commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Mark transfer as claimed
        record.claimed = true;

        emit TransferClaimed(transferId, nullifier, recipient);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Deposits (for gasless relay withdrawals)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a shielded ETH deposit (funds stay in contract)
     * @dev Like shieldedTransfer but funds remain in contract for gasless relay withdrawal.
     * The recipient can later call withdrawDeposit (or have a relayer call it) to claim.
     * @param commitment Pedersen commitment to the amount
     * @param stealthRecipient One-time recipient address (for scanning/identification)
     * @param ephemeralPubKey For stealth key derivation
     * @param viewingKeyHash For compliance scanning
     * @param encryptedAmount Amount encrypted with viewing key
     * @param proof ZK proof of valid commitment (optional if off-chain verified)
     * @return transferId The unique transfer ID
     */
    function shieldedDeposit(
        bytes32 commitment,
        address stealthRecipient,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount,
        bytes calldata proof
    ) external payable whenNotPaused nonReentrant returns (uint256 transferId) {
        // Validate inputs
        if (msg.value == 0) revert InvalidAmount();
        if (stealthRecipient == address(0)) revert ZeroAddress();
        if (encryptedAmount.length > MAX_ENCRYPTED_SIZE) revert EncryptedDataTooLarge();
        if (proof.length > MAX_PROOF_SIZE) revert ProofTooLarge();

        // Validate commitment format
        if (!_isValidCommitment(commitment)) revert InvalidCommitment();

        // Verify ZK proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Calculate fee
        uint256 feeAmount = (msg.value * feeBps) / 10000;
        uint256 netAmount = msg.value - feeAmount;

        // Create transfer record
        transferId = totalTransfers++;
        transfers[transferId] = TransferRecord({
            sender: msg.sender,
            stealthRecipient: stealthRecipient,
            token: NATIVE_TOKEN,
            commitment: commitment,
            ephemeralPubKey: ephemeralPubKey,
            viewingKeyHash: viewingKeyHash,
            encryptedAmount: encryptedAmount,
            timestamp: uint64(block.timestamp),
            claimed: false
        });

        // Store deposit balance (funds stay in contract)
        depositBalances[transferId] = netAmount;

        // Transfer fee to collector
        if (feeAmount > 0) {
            (bool feeSuccess,) = feeCollector.call{value: feeAmount}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit ShieldedDeposit(
            transferId,
            msg.sender,
            stealthRecipient,
            NATIVE_TOKEN,
            commitment,
            ephemeralPubKey,
            block.timestamp
        );

        // Emit EIP-5564 compatible Announcement for scanner compatibility
        emit Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealthRecipient,
            msg.sender,
            abi.encodePacked(ephemeralPubKey),
            abi.encodePacked(uint8(uint256(viewingKeyHash) >> 248), encryptedAmount)
        );
    }

    /**
     * @notice Execute a shielded ERC20 token deposit (funds stay in contract)
     * @dev Like shieldedTokenTransfer but tokens remain in contract for gasless relay withdrawal.
     * @param token ERC20 token address
     * @param amount Token amount to deposit
     * @param commitment Pedersen commitment to the amount
     * @param stealthRecipient One-time recipient address (for scanning/identification)
     * @param ephemeralPubKey For stealth key derivation
     * @param viewingKeyHash For compliance scanning
     * @param encryptedAmount Amount encrypted with viewing key
     * @param proof ZK proof of valid commitment
     * @return transferId The unique transfer ID
     */
    function shieldedTokenDeposit(
        address token,
        uint256 amount,
        bytes32 commitment,
        address stealthRecipient,
        bytes32 ephemeralPubKey,
        bytes32 viewingKeyHash,
        bytes calldata encryptedAmount,
        bytes calldata proof
    ) external whenNotPaused nonReentrant returns (uint256 transferId) {
        // Validate inputs
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (stealthRecipient == address(0)) revert ZeroAddress();
        if (encryptedAmount.length > MAX_ENCRYPTED_SIZE) revert EncryptedDataTooLarge();
        if (proof.length > MAX_PROOF_SIZE) revert ProofTooLarge();

        // Validate commitment
        if (!_isValidCommitment(commitment)) revert InvalidCommitment();

        // Verify ZK proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Calculate fee
        uint256 feeAmount = (amount * feeBps) / 10000;
        uint256 netAmount = amount - feeAmount;

        // Create transfer record
        transferId = totalTransfers++;
        transfers[transferId] = TransferRecord({
            sender: msg.sender,
            stealthRecipient: stealthRecipient,
            token: token,
            commitment: commitment,
            ephemeralPubKey: ephemeralPubKey,
            viewingKeyHash: viewingKeyHash,
            encryptedAmount: encryptedAmount,
            timestamp: uint64(block.timestamp),
            claimed: false
        });

        // Store deposit balance and token (funds stay in contract)
        depositBalances[transferId] = netAmount;
        depositTokens[transferId] = token;

        // Transfer tokens from sender to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), netAmount);

        // Transfer fee to collector
        if (feeAmount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, feeCollector, feeAmount);
        }

        emit ShieldedDeposit(
            transferId,
            msg.sender,
            stealthRecipient,
            token,
            commitment,
            ephemeralPubKey,
            block.timestamp
        );

        // Emit EIP-5564 compatible Announcement for scanner compatibility
        emit Announcement(
            1, // SCHEME_SECP256K1_WITH_VIEW_TAGS
            stealthRecipient,
            msg.sender,
            abi.encodePacked(ephemeralPubKey),
            abi.encodePacked(uint8(uint256(viewingKeyHash) >> 248), encryptedAmount)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Deposit Withdrawals
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Withdraw an ETH deposit to a recipient
     * @dev Claims the deposit AND sends ETH to recipient in one transaction.
     * Can be called by anyone (enables gasless relayed withdrawals).
     * @param transferId The deposit transfer to withdraw
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     */
    function withdrawDeposit(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient
    ) external whenNotPaused nonReentrant {
        TransferRecord storage record = transfers[transferId];

        // Validate transfer exists and not claimed
        if (record.sender == address(0)) revert TransferNotFound();
        if (record.claimed) revert AlreadyClaimed();
        if (record.token != NATIVE_TOKEN) revert InvalidAmount();

        // Validate this is a deposit (has funds in contract)
        uint256 amount = depositBalances[transferId];
        if (amount == 0) revert NotDeposit();

        // Validate nullifier not used
        if (nullifiers[nullifier]) revert NullifierUsed();
        if (nullifier == bytes32(0)) revert InvalidNullifier();

        // Verify proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(record.commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Mark transfer as claimed and clear deposit balance
        record.claimed = true;
        depositBalances[transferId] = 0;

        // Send ETH to recipient
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit DepositWithdrawn(transferId, nullifier, recipient, NATIVE_TOKEN, amount);
    }

    /**
     * @notice Withdraw an ERC20 token deposit to a recipient
     * @dev Claims the deposit AND sends tokens to recipient in one transaction.
     * Can be called by anyone (enables gasless relayed withdrawals).
     * @param transferId The deposit transfer to withdraw
     * @param nullifier Unique identifier preventing double-claims
     * @param proof ZK proof of stealth key ownership
     * @param recipient Final recipient address
     */
    function withdrawTokenDeposit(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient
    ) external whenNotPaused nonReentrant {
        TransferRecord storage record = transfers[transferId];

        // Validate transfer exists and not claimed
        if (record.sender == address(0)) revert TransferNotFound();
        if (record.claimed) revert AlreadyClaimed();
        if (record.token == NATIVE_TOKEN) revert InvalidAmount();

        // Validate this is a deposit (has funds in contract)
        uint256 amount = depositBalances[transferId];
        if (amount == 0) revert NotDeposit();

        // Validate nullifier not used
        if (nullifiers[nullifier]) revert NullifierUsed();
        if (nullifier == bytes32(0)) revert InvalidNullifier();

        // Verify proof if verifier is set
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            if (!zkVerifier.verifyProof(record.commitment, proof)) {
                revert InvalidProof();
            }
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Mark transfer as claimed and clear deposit balance + token
        record.claimed = true;
        depositBalances[transferId] = 0;
        address token = depositTokens[transferId];
        depositTokens[transferId] = address(0);

        // Send tokens to recipient
        IERC20(token).safeTransfer(recipient, amount);

        emit DepositWithdrawn(transferId, nullifier, recipient, token, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Admin
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set the Pedersen verifier contract
     * @param _verifier New verifier address
     */
    function setPedersenVerifier(address _verifier) external onlyOwner {
        pedersenVerifier = IPedersenVerifier(_verifier);
    }

    /**
     * @notice Set the ZK proof verifier contract
     * @param _verifier New verifier address
     */
    function setZkVerifier(address _verifier) external onlyOwner {
        zkVerifier = IZKVerifier(_verifier);
    }

    /**
     * @notice Pause or unpause the contract
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /**
     * @notice Update the protocol fee
     * @param _feeBps New fee in basis points
     */
    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /**
     * @notice Update the fee collector address
     * @param _feeCollector New fee collector
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get a transfer record
     * @param transferId Transfer ID
     * @return The transfer record
     */
    function getTransfer(uint256 transferId) external view returns (TransferRecord memory) {
        return transfers[transferId];
    }

    /**
     * @notice Check if a nullifier has been used
     * @param nullifier The nullifier to check
     * @return True if used
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiers[nullifier];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Validate a Pedersen commitment format
     * @param commitment The commitment bytes32
     * @return True if valid format
     *
     * @dev The commitment is a 32-byte identifier derived from the Pedersen
     * commitment point (v*G + r*H). Full cryptographic verification of the
     * commitment is delegated to PedersenVerifier and the ZK proof system.
     * This function performs basic format validation only.
     *
     * The high byte encodes the compressed point prefix (0x02 even y, 0x03 odd y)
     * so we validate that along with non-zero.
     */
    function _isValidCommitment(bytes32 commitment) internal pure returns (bool) {
        if (commitment == bytes32(0)) return false;

        // Validate high byte is a valid compressed point prefix (0x02 or 0x03)
        uint8 prefix = uint8(uint256(commitment) >> 248);
        return prefix == 0x02 || prefix == 0x03;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Receive ETH (needed for transfers)
    receive() external payable {}
}
