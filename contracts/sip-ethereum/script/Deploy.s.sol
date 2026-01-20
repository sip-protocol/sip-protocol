// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SIPPrivacy.sol";
import "../src/PedersenVerifier.sol";
import "../src/ZKVerifier.sol";
import "../src/StealthAddressRegistry.sol";

/**
 * @title Deploy Script
 * @notice Deploys all SIP Privacy contracts to the target network
 * @dev Usage:
 *
 * ```bash
 * # Load env
 * source .env
 *
 * # Deploy to testnet (e.g., Base Sepolia)
 * forge script script/Deploy.s.sol:DeployScript \
 *   --rpc-url $BASE_SEPOLIA_RPC_URL \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $BASESCAN_API_KEY
 *
 * # Deploy to mainnet (with --slow for safety)
 * forge script script/Deploy.s.sol:DeployScript \
 *   --rpc-url $BASE_RPC_URL \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $BASESCAN_API_KEY \
 *   --slow
 * ```
 */
contract DeployScript is Script {
    // Deployment results
    SIPPrivacy public sipPrivacy;
    PedersenVerifier public pedersenVerifier;
    ZKVerifier public zkVerifier;
    StealthAddressRegistry public registry;

    // Configuration - can be overridden via env vars
    address public owner;
    address public feeCollector;
    uint256 public feeBps;

    function setUp() public virtual {
        // Load from environment or use deployer as default
        owner = vm.envOr("OWNER_ADDRESS", msg.sender);
        feeCollector = vm.envOr("FEE_COLLECTOR", msg.sender);
        feeBps = vm.envOr("FEE_BPS", uint256(100)); // Default 1%
    }

    function run() external {
        // Get deployer private key
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("==============================================");
        console.log("SIP Privacy Contract Deployment");
        console.log("==============================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("Fee Collector:", feeCollector);
        console.log("Fee BPS:", feeBps);
        console.log("==============================================");

        vm.startBroadcast(deployerKey);

        // 1. Deploy PedersenVerifier (no dependencies)
        console.log("\n[1/4] Deploying PedersenVerifier...");
        pedersenVerifier = new PedersenVerifier();
        console.log("PedersenVerifier deployed at:", address(pedersenVerifier));

        // 2. Deploy ZKVerifier (no dependencies)
        console.log("\n[2/4] Deploying ZKVerifier...");
        zkVerifier = new ZKVerifier(owner);
        console.log("ZKVerifier deployed at:", address(zkVerifier));

        // 3. Deploy StealthAddressRegistry (no dependencies)
        console.log("\n[3/4] Deploying StealthAddressRegistry...");
        registry = new StealthAddressRegistry();
        console.log("StealthAddressRegistry deployed at:", address(registry));

        // 4. Deploy SIPPrivacy (main contract)
        console.log("\n[4/4] Deploying SIPPrivacy...");
        sipPrivacy = new SIPPrivacy(owner, feeCollector, feeBps);
        console.log("SIPPrivacy deployed at:", address(sipPrivacy));

        // 5. Link verifiers to main contract
        console.log("\nLinking verifiers...");
        sipPrivacy.setPedersenVerifier(address(pedersenVerifier));
        sipPrivacy.setZkVerifier(address(zkVerifier));
        console.log("Verifiers linked successfully");

        vm.stopBroadcast();

        // Output summary
        console.log("\n==============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("==============================================");
        console.log("\nContract Addresses:");
        console.log("  SIPPrivacy:           ", address(sipPrivacy));
        console.log("  PedersenVerifier:     ", address(pedersenVerifier));
        console.log("  ZKVerifier:           ", address(zkVerifier));
        console.log("  StealthAddressRegistry:", address(registry));
        console.log("\nConfiguration:");
        console.log("  Owner:        ", owner);
        console.log("  Fee Collector:", feeCollector);
        console.log("  Fee (BPS):    ", feeBps);
        console.log("==============================================");
        console.log("\nNext steps:");
        console.log("1. Verify contracts on block explorer (if not auto-verified)");
        console.log("2. Update SDK configuration with deployed addresses");
        console.log("3. Run integration tests against deployed contracts");
    }
}

/**
 * @title Deploy Script for Testnet
 * @notice Same as DeployScript but with testnet-specific defaults
 */
contract DeployTestnetScript is DeployScript {
    function setUp() public override {
        super.setUp();
        // Testnet uses lower fees
        feeBps = vm.envOr("FEE_BPS", uint256(50)); // 0.5% on testnet
    }
}

/**
 * @title Upgrade Script
 * @notice For upgrading individual contracts or verifiers
 */
contract UpgradeVerifiersScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address payable sipPrivacyAddress = payable(vm.envAddress("SIP_PRIVACY_ADDRESS"));

        vm.startBroadcast(deployerKey);

        SIPPrivacy sipPrivacy = SIPPrivacy(sipPrivacyAddress);

        // Deploy new verifiers
        PedersenVerifier newPedersen = new PedersenVerifier();
        ZKVerifier newZkVerifier = new ZKVerifier(sipPrivacy.owner());

        // Update
        sipPrivacy.setPedersenVerifier(address(newPedersen));
        sipPrivacy.setZkVerifier(address(newZkVerifier));

        vm.stopBroadcast();

        console.log("Verifiers upgraded:");
        console.log("  New PedersenVerifier:", address(newPedersen));
        console.log("  New ZKVerifier:", address(newZkVerifier));
    }
}
