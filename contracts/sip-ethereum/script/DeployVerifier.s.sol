// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ZKVerifier.sol";
import {HonkVerifier as FundingHonkVerifier} from "../src/verifiers/FundingVerifier.sol";

/**
 * @title DeployVerifier Script
 * @notice Deploys HonkVerifier (FundingVerifier) and registers it in ZKVerifier
 * @dev Run AFTER Deploy.s.sol — requires ZKVerifier to already be deployed
 *
 * ## EIP-170 Size Limit
 *
 * BB-generated UltraHonk verifiers are ~28KB with via_ir=true, exceeding the
 * 24,576 byte EIP-170 limit. The workaround is to compile separately without
 * via_ir (optimizer_runs=1), which reduces the verifier to ~23.7KB.
 *
 * This script can be used with `--code-size-limit 32768` for testing, but for
 * actual deployment, use the manual `forge create` approach below.
 *
 * ## Deployment (Manual — recommended)
 *
 * ```bash
 * source .env
 *
 * # 1. Create a temp Foundry project for the verifier
 * mkdir -p /tmp/honk-deploy && cd /tmp/honk-deploy
 * forge init --no-git
 * cp $SIP_CONTRACTS/src/verifiers/FundingVerifier.sol src/
 * rm src/Counter.sol test/Counter.t.sol script/Counter.s.sol
 *
 * # 2. Configure for minimal bytecode (via_ir=false, optimizer_runs=1)
 * cat > foundry.toml << 'EOF'
 * [profile.default]
 * src = "src"
 * out = "out"
 * libs = ["lib"]
 * solc = "0.8.28"
 * optimizer = true
 * optimizer_runs = 1
 * via_ir = false
 * evm_version = "cancun"
 * EOF
 *
 * # 3. Deploy library first, then verifier
 * forge create src/FundingVerifier.sol:ZKTranscriptLib \
 *   --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL --broadcast
 *
 * forge create src/FundingVerifier.sol:HonkVerifier \
 *   --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL --broadcast \
 *   --libraries src/FundingVerifier.sol:ZKTranscriptLib:$LIB_ADDRESS
 *
 * # 4. Register in ZKVerifier
 * cast send $ZK_VERIFIER_ADDRESS "setFundingVerifier(address)" $VERIFIER_ADDRESS \
 *   --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
 * ```
 */
contract DeployVerifierScript is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("PRIVATE_KEY");
    address deployer = vm.addr(deployerKey);
    address zkVerifierAddress = vm.envAddress("ZK_VERIFIER_ADDRESS");

    console.log("==============================================");
    console.log("SIP FundingVerifier Deployment");
    console.log("==============================================");
    console.log("Chain ID:", block.chainid);
    console.log("Deployer:", deployer);
    console.log("ZKVerifier:", zkVerifierAddress);
    console.log("==============================================");

    ZKVerifier zkVerifier = ZKVerifier(zkVerifierAddress);

    // Verify ownership before deploying
    require(zkVerifier.owner() == deployer, "Deployer is not ZKVerifier owner");

    vm.startBroadcast(deployerKey);

    // 1. Deploy HonkVerifier (FundingVerifier)
    console.log("\n[1/2] Deploying FundingVerifier (HonkVerifier)...");
    FundingHonkVerifier fundingVerifier = new FundingHonkVerifier();
    console.log("FundingVerifier deployed at:", address(fundingVerifier));

    // 2. Register in ZKVerifier
    console.log("\n[2/2] Registering FundingVerifier in ZKVerifier...");
    zkVerifier.setFundingVerifier(address(fundingVerifier));
    console.log("FundingVerifier registered successfully");

    vm.stopBroadcast();

    // Verify registration
    require(
      address(zkVerifier.fundingVerifier()) == address(fundingVerifier),
      "Registration failed"
    );

    console.log("\n==============================================");
    console.log("DEPLOYMENT COMPLETE");
    console.log("==============================================");
    console.log("  FundingVerifier:", address(fundingVerifier));
    console.log("  Registered in ZKVerifier:", zkVerifierAddress);
    console.log("==============================================");
    console.log("\nNext steps:");
    console.log("1. Verify contract on block explorer (if not auto-verified)");
    console.log("2. Update DEPLOYMENT.md with new addresses");
    console.log("3. Run integration tests against deployed contracts");
  }
}
