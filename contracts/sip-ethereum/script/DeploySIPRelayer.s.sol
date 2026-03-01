// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SIPRelayer.sol";

/**
 * @title DeploySIPRelayer Script
 * @notice Deploys SIPRelayer to the target network
 * @dev Requires SIP_PRIVACY_ADDRESS env var (the deployed SIPPrivacy address on the target chain)
 *
 * ```bash
 * # Load env
 * source .env
 *
 * # Deploy to Sepolia
 * SIP_PRIVACY_ADDRESS=0x1FED19684dC108304960db2818CF5a961d28405E \
 * forge script script/DeploySIPRelayer.s.sol:DeploySIPRelayerScript \
 *   --rpc-url $SEPOLIA_RPC_URL \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $ETHERSCAN_API_KEY
 * ```
 *
 * Target chain SIPPrivacy addresses:
 *   Sepolia:          0x1FED19684dC108304960db2818CF5a961d28405E
 *   Base Sepolia:     0x0B0d06D6B5136d63Bd0817414E2D318999e50339
 *   OP Sepolia:       0x0B0d06D6B5136d63Bd0817414E2D318999e50339
 *   Arbitrum Sepolia: pending deployment
 */
contract DeploySIPRelayerScript is Script {
    SIPRelayer public sipRelayer;

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

        sipRelayer = new SIPRelayer(sipPrivacy, owner);

        vm.stopBroadcast();

        console.log("\n==============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("==============================================");
        console.log("  SIPRelayer:", address(sipRelayer));
        console.log("  Owner:", owner);
        console.log("  SIPPrivacy:", sipPrivacy);
        console.log("==============================================");
        console.log("\nGelato Relay address (resolved from chain ID):");
        console.log("  Check: the relay address is hardcoded per chain");
        console.log("  V1 chains: 0xaBcC9b596420A9E9172FD5938620E265a0f9Df92");
        console.log("  V2 chains: 0xcd565435e0d2109feFde337a66491541Df0D1420");
    }
}
