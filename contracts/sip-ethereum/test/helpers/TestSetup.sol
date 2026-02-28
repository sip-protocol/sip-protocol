// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SIPPrivacy} from "../../src/SIPPrivacy.sol";
import {PedersenVerifier} from "../../src/PedersenVerifier.sol";
import {ZKVerifier} from "../../src/ZKVerifier.sol";
import {HonkVerifier} from "../../src/verifiers/FundingVerifier.sol";
import {StealthAddressRegistry} from "../../src/StealthAddressRegistry.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";

/// @notice Mock ERC20 token for testing
contract MockERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Base test setup for all SIP Ethereum contract tests
abstract contract TestSetup is Test {
    SIPPrivacy public sipPrivacy;
    PedersenVerifier public pedersenVerifier;
    ZKVerifier public zkVerifier;
    HonkVerifier public fundingVerifier;
    StealthAddressRegistry public registry;
    MockERC20 public token;

    address public owner;
    address public feeCollector;
    address public alice;
    address public bob;
    address public charlie;

    uint256 public constant DEFAULT_FEE_BPS = 100; // 1%
    uint256 public constant INITIAL_BALANCE = 100 ether;
    uint256 public constant TOKEN_AMOUNT = 1_000_000e18;

    function setUp() public virtual {
        owner = makeAddr("owner");
        feeCollector = makeAddr("feeCollector");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");

        // Fund accounts
        vm.deal(alice, INITIAL_BALANCE);
        vm.deal(bob, INITIAL_BALANCE);
        vm.deal(charlie, INITIAL_BALANCE);

        // Deploy contracts
        vm.startPrank(owner);
        pedersenVerifier = new PedersenVerifier();
        zkVerifier = new ZKVerifier(owner);
        fundingVerifier = new HonkVerifier();
        zkVerifier.setFundingVerifier(address(fundingVerifier));
        registry = new StealthAddressRegistry();
        sipPrivacy = new SIPPrivacy(owner, feeCollector, DEFAULT_FEE_BPS);

        // Link verifiers
        sipPrivacy.setPedersenVerifier(address(pedersenVerifier));
        sipPrivacy.setZkVerifier(address(zkVerifier));
        vm.stopPrank();

        // Deploy mock token and fund alice
        token = new MockERC20();
        token.mint(alice, TOKEN_AMOUNT);
        token.mint(bob, TOKEN_AMOUNT);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a valid test commitment (high byte 0x02)
    function _makeCommitment(uint256 seed) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(seed));
        // Set high byte to 0x02 (even y prefix)
        return bytes32((uint256(base) & ~(uint256(0xFF) << 248)) | (uint256(0x02) << 248));
    }

    /// @notice Create a commitment with odd-y prefix (0x03)
    function _makeOddCommitment(uint256 seed) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(seed));
        return bytes32((uint256(base) & ~(uint256(0xFF) << 248)) | (uint256(0x03) << 248));
    }

    /// @notice Create an invalid commitment (high byte not 0x02 or 0x03)
    function _makeInvalidCommitment(uint256 seed) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(seed));
        // Set high byte to 0x04 (invalid prefix)
        return bytes32((uint256(base) & ~(uint256(0xFF) << 248)) | (uint256(0x04) << 248));
    }

    /// @notice Create a test ephemeral public key
    function _makeEphemeralKey(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("ephemeral", seed));
    }

    /// @notice Create a test viewing key hash
    function _makeViewingKeyHash(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("viewing", seed));
    }

    /// @notice Create test encrypted amount
    function _makeEncryptedAmount(uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(amount);
    }

    /// @notice Create a test nullifier
    function _makeNullifier(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("nullifier", seed));
    }

    /// @notice Create a valid compressed pubkey (33 bytes, 0x02 prefix)
    function _makeCompressedPubKey(uint256 seed) internal pure returns (bytes memory) {
        bytes32 x = keccak256(abi.encodePacked(seed));
        return abi.encodePacked(uint8(0x02), x);
    }

    /// @notice Create a valid stealth meta-address (66 bytes = spending + viewing)
    function _makeStealthMetaAddress(uint256 seed) internal pure returns (bytes memory) {
        bytes memory spending = _makeCompressedPubKey(seed);
        bytes memory viewing = _makeCompressedPubKey(seed + 1);
        return abi.encodePacked(spending, viewing);
    }

    /// @notice Execute a shielded transfer from alice and return the transferId
    function _doShieldedTransfer(uint256 amount, address recipient)
        internal
        returns (uint256 transferId)
    {
        bytes32 commitment = _makeCommitment(1);
        bytes32 ephemeralKey = _makeEphemeralKey(1);
        bytes32 viewingKeyHash = _makeViewingKeyHash(1);
        bytes memory encryptedAmount = _makeEncryptedAmount(amount);

        vm.prank(alice);
        transferId = sipPrivacy.shieldedTransfer{value: amount}(
            commitment,
            recipient,
            ephemeralKey,
            viewingKeyHash,
            encryptedAmount,
            "" // no proof
        );
    }
}
