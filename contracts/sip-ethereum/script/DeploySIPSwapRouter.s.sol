// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SIPSwapRouter.sol";

/**
 * @title DeploySIPSwapRouter Script
 * @notice Deploys SIPSwapRouter to the target network
 * @dev Requires UNISWAP_SWAP_ROUTER and WETH_ADDRESS env vars (chain-specific)
 *
 * ```bash
 * # Load env
 * source .env
 *
 * # Deploy to Sepolia
 * forge script script/DeploySIPSwapRouter.s.sol:DeploySIPSwapRouterScript \
 *   --rpc-url $SEPOLIA_RPC_URL \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $ETHERSCAN_API_KEY
 * ```
 *
 * Chain-specific addresses:
 *   Sepolia:  SWAP_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564  WETH=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
 *   Mainnet:  SWAP_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564  WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   Arbitrum: SWAP_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564  WETH=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73
 *   Base:     SWAP_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481  WETH=0x4200000000000000000000000000000000000006
 *   OP:       SWAP_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564  WETH=0x4200000000000000000000000000000000000006
 */
contract DeploySIPSwapRouterScript is Script {
    SIPSwapRouter public sipSwapRouter;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(50));
        address swapRouter = vm.envAddress("UNISWAP_SWAP_ROUTER");
        address weth = vm.envAddress("WETH_ADDRESS");

        console.log("==============================================");
        console.log("SIPSwapRouter Deployment");
        console.log("==============================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("Fee Collector:", feeCollector);
        console.log("Fee BPS:", feeBps);
        console.log("Uniswap Router:", swapRouter);
        console.log("WETH:", weth);
        console.log("==============================================");

        vm.startBroadcast(deployerKey);

        sipSwapRouter = new SIPSwapRouter(
            owner,
            feeCollector,
            feeBps,
            swapRouter,
            weth
        );

        console.log("\nSIPSwapRouter deployed at:", address(sipSwapRouter));

        // Approve 1inch V6 aggregator router
        address oneInchRouter = vm.envOr("ONEINCH_ROUTER", address(0x111111125421cA6dc452d289314280a0f8842A65));
        sipSwapRouter.setRouterApproval(oneInchRouter, true);
        console.log("1inch Router approved:", oneInchRouter);

        vm.stopBroadcast();

        console.log("\n==============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("==============================================");
        console.log("  SIPSwapRouter:", address(sipSwapRouter));
        console.log("  Owner:", owner);
        console.log("  Fee Collector:", feeCollector);
        console.log("  Fee BPS:", feeBps);
        console.log("==============================================");
    }
}
