// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StealthAddressRegistry
 * @author SIP Protocol Team
 * @notice EIP-5564 compliant stealth address registry and announcement system
 *
 * ## Overview
 *
 * Implements the EIP-5564 standard for stealth addresses on Ethereum.
 * Users register their stealth meta-addresses, and senders emit announcements
 * that recipients can scan to detect incoming payments.
 *
 * ## EIP-5564 Scheme IDs
 *
 * - Scheme 1: secp256k1 with view tags (most common)
 * - Scheme 2: secp256k1 without view tags
 * - Scheme 3: ed25519 (less common on EVM)
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  RECIPIENT (one-time setup)                                                 │
 * │  1. Generate spending key pair (K_s)                                        │
 * │  2. Generate viewing key pair (K_v)                                         │
 * │  3. Register stealth meta-address                                           │
 * │  4. Share: st:eth:0x<spending_pub><viewing_pub>                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SENDER (per transaction)                                                   │
 * │  1. Generate ephemeral key pair (r, R = r*G)                                │
 * │  2. Compute shared secret: S = r * K_v                                      │
 * │  3. Derive stealth address: stealth = K_s + hash(S)*G                       │
 * │  4. Send funds to stealth address                                           │
 * │  5. Emit Announcement(schemeId, stealth, R, viewTag)                        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                     │
 *                                     ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  RECIPIENT (scanning)                                                       │
 * │  1. Listen for Announcement events                                          │
 * │  2. Quick filter by view tag (if scheme supports)                           │
 * │  3. Compute shared secret: S = k_v * R                                      │
 * │  4. Check if stealth address matches                                        │
 * │  5. Derive stealth private key: k_stealth = k_s + hash(S)                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## References
 *
 * - EIP-5564: https://eips.ethereum.org/EIPS/eip-5564
 * - EIP-6538: Stealth Meta-Address Registry
 */
contract StealthAddressRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice EIP-5564 scheme ID for secp256k1 with view tags
    uint256 public constant SCHEME_SECP256K1_WITH_VIEW_TAGS = 1;

    /// @notice EIP-5564 scheme ID for secp256k1 without view tags
    uint256 public constant SCHEME_SECP256K1_NO_VIEW_TAGS = 2;

    /// @notice Expected length for compressed secp256k1 public key
    uint256 public constant COMPRESSED_PUBKEY_LENGTH = 33;

    /// @notice Expected length for stealth meta-address (spending + viewing)
    uint256 public constant STEALTH_META_ADDRESS_LENGTH = 66;

    // ═══════════════════════════════════════════════════════════════════════════
    // State Variables
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mapping from registrant address to their stealth meta-address
    /// @dev Format: spending_pubkey (33 bytes) + viewing_pubkey (33 bytes)
    mapping(address => bytes) public stealthMetaAddresses;

    /// @notice Mapping from registrant to their preferred scheme ID
    mapping(address => uint256) public preferredSchemes;

    /// @notice Total announcements (for indexing)
    uint256 public totalAnnouncements;

    // ═══════════════════════════════════════════════════════════════════════════
    // Events - EIP-5564 Compliant
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice EIP-5564 Announcement event
     * @dev Emitted when a stealth address payment is made
     * @param schemeId The stealth address scheme used
     * @param stealthAddress The generated stealth address
     * @param caller The address that called announce (usually the sender)
     * @param ephemeralPubKey The ephemeral public key for deriving shared secret
     * @param metadata Additional data (view tag in first byte for scheme 1)
     */
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    /**
     * @notice Emitted when a user registers their stealth meta-address
     * @param registrant The address registering
     * @param schemeId The scheme used
     * @param stealthMetaAddress The registered meta-address
     */
    event StealthMetaAddressRegistered(
        address indexed registrant,
        uint256 indexed schemeId,
        bytes stealthMetaAddress
    );

    /**
     * @notice Emitted when a user updates their stealth meta-address
     * @param registrant The address updating
     * @param oldMetaAddress Previous meta-address
     * @param newMetaAddress New meta-address
     */
    event StealthMetaAddressUpdated(
        address indexed registrant,
        bytes oldMetaAddress,
        bytes newMetaAddress
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidStealthMetaAddress();
    error InvalidSchemeId();
    error InvalidEphemeralPubKey();
    error NotRegistered();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Registration (EIP-6538 style)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a stealth meta-address
     * @param schemeId The stealth address scheme (1 = secp256k1 with view tags)
     * @param stealthMetaAddress The meta-address: spending_pubkey + viewing_pubkey
     * @dev Each compressed pubkey is 33 bytes, so meta-address is 66 bytes
     */
    function registerStealthMetaAddress(
        uint256 schemeId,
        bytes calldata stealthMetaAddress
    ) external {
        if (schemeId == 0 || schemeId > 2) revert InvalidSchemeId();
        if (stealthMetaAddress.length != STEALTH_META_ADDRESS_LENGTH) {
            revert InvalidStealthMetaAddress();
        }

        // Validate compressed pubkey prefixes (0x02 or 0x03)
        if (!_isValidCompressedPubKey(stealthMetaAddress[0:33])) {
            revert InvalidStealthMetaAddress();
        }
        if (!_isValidCompressedPubKey(stealthMetaAddress[33:66])) {
            revert InvalidStealthMetaAddress();
        }

        bytes memory oldMetaAddress = stealthMetaAddresses[msg.sender];
        stealthMetaAddresses[msg.sender] = stealthMetaAddress;
        preferredSchemes[msg.sender] = schemeId;

        if (oldMetaAddress.length > 0) {
            emit StealthMetaAddressUpdated(msg.sender, oldMetaAddress, stealthMetaAddress);
        } else {
            emit StealthMetaAddressRegistered(msg.sender, schemeId, stealthMetaAddress);
        }
    }

    /**
     * @notice Register keys separately (alternative API)
     * @param schemeId The stealth address scheme
     * @param spendingPubKey The spending public key (33 bytes compressed)
     * @param viewingPubKey The viewing public key (33 bytes compressed)
     */
    function registerKeys(
        uint256 schemeId,
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external {
        if (schemeId == 0 || schemeId > 2) revert InvalidSchemeId();
        if (!_isValidCompressedPubKey(spendingPubKey)) revert InvalidStealthMetaAddress();
        if (!_isValidCompressedPubKey(viewingPubKey)) revert InvalidStealthMetaAddress();

        bytes memory stealthMetaAddress = abi.encodePacked(spendingPubKey, viewingPubKey);
        bytes memory oldMetaAddress = stealthMetaAddresses[msg.sender];

        stealthMetaAddresses[msg.sender] = stealthMetaAddress;
        preferredSchemes[msg.sender] = schemeId;

        if (oldMetaAddress.length > 0) {
            emit StealthMetaAddressUpdated(msg.sender, oldMetaAddress, stealthMetaAddress);
        } else {
            emit StealthMetaAddressRegistered(msg.sender, schemeId, stealthMetaAddress);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // External Functions - Announcements (EIP-5564)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Announce a stealth address payment (EIP-5564)
     * @param schemeId The scheme used for stealth address generation
     * @param stealthAddress The generated stealth address
     * @param ephemeralPubKey The ephemeral public key (R = r*G)
     * @param metadata Additional data (first byte is view tag for scheme 1)
     */
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        if (schemeId == 0 || schemeId > 2) revert InvalidSchemeId();
        if (stealthAddress == address(0)) revert ZeroAddress();
        if (!_isValidCompressedPubKey(ephemeralPubKey)) revert InvalidEphemeralPubKey();

        totalAnnouncements++;

        emit Announcement(
            schemeId,
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            metadata
        );
    }

    /**
     * @notice Announce with ETH transfer
     * @dev Convenience function that transfers ETH and emits announcement
     * @param schemeId The scheme used
     * @param stealthAddress The stealth address to receive funds
     * @param ephemeralPubKey The ephemeral public key
     * @param metadata Additional data
     */
    function announceAndTransfer(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external payable {
        if (schemeId == 0 || schemeId > 2) revert InvalidSchemeId();
        if (stealthAddress == address(0)) revert ZeroAddress();
        if (!_isValidCompressedPubKey(ephemeralPubKey)) revert InvalidEphemeralPubKey();
        if (msg.value == 0) revert ZeroAddress(); // Reusing error for zero value

        // Transfer ETH
        (bool success,) = stealthAddress.call{value: msg.value}("");
        require(success, "Transfer failed");

        totalAnnouncements++;

        emit Announcement(
            schemeId,
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            metadata
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get a user's stealth meta-address
     * @param registrant The address to query
     * @return The stealth meta-address (empty if not registered)
     */
    function getStealthMetaAddress(address registrant) external view returns (bytes memory) {
        return stealthMetaAddresses[registrant];
    }

    /**
     * @notice Get a user's spending and viewing keys separately
     * @param registrant The address to query
     * @return spendingPubKey The spending public key
     * @return viewingPubKey The viewing public key
     */
    function getKeys(address registrant) external view returns (
        bytes memory spendingPubKey,
        bytes memory viewingPubKey
    ) {
        bytes memory meta = stealthMetaAddresses[registrant];
        if (meta.length != STEALTH_META_ADDRESS_LENGTH) {
            return (new bytes(0), new bytes(0));
        }

        spendingPubKey = new bytes(33);
        viewingPubKey = new bytes(33);

        for (uint256 i = 0; i < 33; i++) {
            spendingPubKey[i] = meta[i];
            viewingPubKey[i] = meta[i + 33];
        }
    }

    /**
     * @notice Check if a user is registered
     * @param registrant The address to check
     * @return True if registered
     */
    function isRegistered(address registrant) external view returns (bool) {
        return stealthMetaAddresses[registrant].length == STEALTH_META_ADDRESS_LENGTH;
    }

    /**
     * @notice Get a user's preferred scheme
     * @param registrant The address to query
     * @return The preferred scheme ID (0 if not registered)
     */
    function getPreferredScheme(address registrant) external view returns (uint256) {
        return preferredSchemes[registrant];
    }

    /**
     * @notice Generate a view tag from shared secret (helper for scheme 1)
     * @param sharedSecret The ECDH shared secret
     * @return viewTag First byte of keccak256(sharedSecret)
     * @dev This is a helper function - actual generation happens off-chain
     */
    function computeViewTag(bytes32 sharedSecret) external pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(sharedSecret))) >> 248);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Validate compressed secp256k1 public key format
     * @param pubKey The public key bytes (works with both calldata and memory)
     * @return True if valid format
     */
    function _isValidCompressedPubKey(bytes memory pubKey) internal pure returns (bool) {
        if (pubKey.length != COMPRESSED_PUBKEY_LENGTH) return false;

        // First byte must be 0x02 (even y) or 0x03 (odd y)
        uint8 prefix = uint8(pubKey[0]);
        return prefix == 0x02 || prefix == 0x03;
    }
}
