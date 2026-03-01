// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SIPPrivacy} from "../../src/SIPPrivacy.sol";
import {PedersenVerifier} from "../../src/PedersenVerifier.sol";
import {ZKVerifier} from "../../src/ZKVerifier.sol";
import {HonkVerifier} from "../../src/verifiers/FundingVerifier.sol";
import {StealthAddressRegistry} from "../../src/StealthAddressRegistry.sol";
import {SIPSwapRouter} from "../../src/SIPSwapRouter.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {ISwapRouter} from "../../src/interfaces/ISwapRouter.sol";

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

/// @notice Mock WETH for testing
contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient WETH");
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
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

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

/// @notice Mock Uniswap V3 SwapRouter for testing
contract MockSwapRouter {
    uint256 public mockAmountOut;
    bool public shouldRevert;

    function setMockAmountOut(uint256 amount) external {
        mockAmountOut = amount;
    }

    function setShouldRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256)
    {
        if (shouldRevert) revert("Swap failed");

        // Pull input tokens from caller
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Mint output tokens to recipient (simulates Uniswap pool)
        MockERC20(params.tokenOut).mint(params.recipient, mockAmountOut);

        return mockAmountOut;
    }

    function exactInput(ISwapRouter.ExactInputParams calldata params)
        external
        payable
        returns (uint256)
    {
        if (shouldRevert) revert("Swap failed");

        // Extract tokenIn (first 20 bytes) and tokenOut (last 20 bytes) from path
        bytes calldata path = params.path;
        address tokenIn = address(bytes20(path[:20]));
        address tokenOut = address(bytes20(path[path.length - 20:]));

        // Pull input tokens from caller
        IERC20(tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Mint output tokens to recipient
        MockERC20(tokenOut).mint(params.recipient, mockAmountOut);

        return mockAmountOut;
    }
}

/// @notice Mock 1inch-style aggregator router for testing
/// @dev Function signature matches 1inch V5/V6 selector 0x12aa3caf:
///      swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
contract MockAggregatorRouter {
    uint256 public mockAmountOut;
    bool public shouldRevert;

    struct SwapDescription {
        address srcToken;
        address dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }

    function setMockAmountOut(uint256 amount) external {
        mockAmountOut = amount;
    }

    function setShouldRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    /// @notice Mock swap() with selector 0x12aa3caf
    function swap(
        address, // executor
        SwapDescription calldata desc,
        bytes calldata, // permit
        bytes calldata  // data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount) {
        if (shouldRevert) revert("Aggregator swap failed");

        // Mint output tokens to dstReceiver (simulates aggregated swap)
        MockERC20(desc.dstToken).mint(desc.dstReceiver, mockAmountOut);

        return (mockAmountOut, desc.amount);
    }

    receive() external payable {}
}

/// @notice Base test setup for all SIP Ethereum contract tests
abstract contract TestSetup is Test {
    SIPPrivacy public sipPrivacy;
    PedersenVerifier public pedersenVerifier;
    ZKVerifier public zkVerifier;
    HonkVerifier public fundingVerifier;
    StealthAddressRegistry public registry;
    SIPSwapRouter public sipSwapRouter;
    MockERC20 public token;
    MockERC20 public outputToken;
    MockWETH public weth;
    MockSwapRouter public mockSwapRouter;
    MockAggregatorRouter public mockAggregator;

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

        // Deploy mock tokens
        token = new MockERC20();
        token.mint(alice, TOKEN_AMOUNT);
        token.mint(bob, TOKEN_AMOUNT);

        outputToken = new MockERC20();

        // Deploy swap router mocks
        weth = new MockWETH();
        mockSwapRouter = new MockSwapRouter();
        mockSwapRouter.setMockAmountOut(2000e6); // Default: 2000 USDC

        // Deploy mock aggregator
        mockAggregator = new MockAggregatorRouter();
        mockAggregator.setMockAmountOut(2000e6); // Default: 2000 USDC

        // Deploy SIPSwapRouter + approve mock aggregator
        vm.startPrank(owner);
        sipSwapRouter = new SIPSwapRouter(
            owner,
            feeCollector,
            DEFAULT_FEE_BPS,
            address(mockSwapRouter),
            address(weth)
        );
        sipSwapRouter.setRouterApproval(address(mockAggregator), true);
        vm.stopPrank();
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
