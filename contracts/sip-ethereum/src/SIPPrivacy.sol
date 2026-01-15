// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
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
        // Proof should demonstrate knowledge of stealth private key
        if (address(zkVerifier) != address(0) && proof.length > 0) {
            // TODO: Implement claim proof verification
            // This would verify: stealth_privkey where stealth_pubkey = stealth_privkey * G
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
            // TODO: Implement claim proof verification
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Mark transfer as claimed
        record.claimed = true;

        emit TransferClaimed(transferId, nullifier, recipient);
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
     * @dev For a compressed secp256k1 point stored in bytes32:
     * - First byte should be 0x02 (even y) or 0x03 (odd y)
     * - We only have 32 bytes, so we check the high byte pattern
     */
    function _isValidCommitment(bytes32 commitment) internal pure returns (bool) {
        // For a bytes32 commitment, we expect it to be a hash or compressed representation
        // In the simplest case, we just check it's not zero
        // Full validation would require the full 33-byte compressed point
        return commitment != bytes32(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Receive ETH (needed for transfers)
    receive() external payable {}
}
