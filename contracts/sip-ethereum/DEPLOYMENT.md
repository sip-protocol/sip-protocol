# SIP Ethereum Deployment Guide

Comprehensive deployment instructions for SIP Privacy contracts across Ethereum and L2 networks.

## Network Overview

### Supported Networks (Tier 1)

| Network | Chain ID | Type | Priority | Market Share |
|---------|----------|------|----------|--------------|
| Ethereum Mainnet | 1 | L1 | Critical | Reference |
| Base | 8453 | L2 (OP Stack) | Critical | 60%+ tx share |
| Arbitrum One | 42161 | L2 (Nitro) | Critical | 44% TVL |
| Optimism | 10 | L2 (OP Stack) | High | 6% TVL |

### Testnets

| Network | Chain ID | Faucet |
|---------|----------|--------|
| Sepolia | 11155111 | [faucet.sepolia.dev](https://faucet.sepolia.dev) |
| Base Sepolia | 84532 | [faucet.quicknode.com/base/sepolia](https://faucet.quicknode.com/base/sepolia) |
| Arbitrum Sepolia | 421614 | [faucet.quicknode.com/arbitrum/sepolia](https://faucet.quicknode.com/arbitrum/sepolia) |
| Optimism Sepolia | 11155420 | [faucet.quicknode.com/optimism/sepolia](https://faucet.quicknode.com/optimism/sepolia) |

## Prerequisites

### Required Tools

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version  # >= 0.2.0
cast --version
anvil --version
```

### Environment Setup

Create `.env` file in `contracts/sip-ethereum/`:

```bash
# Private key (NEVER commit this!)
PRIVATE_KEY=0x...

# Ethereum Mainnet/Sepolia
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=YOUR_BASESCAN_KEY

# Arbitrum
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=YOUR_ARBISCAN_KEY

# Optimism
OPTIMISM_RPC_URL=https://mainnet.optimism.io
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
OPTIMISM_ETHERSCAN_API_KEY=YOUR_OPTIMISM_KEY
```

### API Keys

Get explorer API keys from:
- [Etherscan](https://etherscan.io/apis)
- [BaseScan](https://basescan.org/apis)
- [Arbiscan](https://arbiscan.io/apis)
- [Optimism Etherscan](https://optimistic.etherscan.io/apis)

## Deployment Scripts

### Deploy to Testnet

```bash
# Load environment
source .env

# Base Sepolia (recommended first)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv

# Arbitrum Sepolia
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY \
  -vvvv

# Optimism Sepolia
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $OPTIMISM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $OPTIMISM_ETHERSCAN_API_KEY \
  -vvvv
```

### Deploy to Mainnet

```bash
# ⚠️ PRODUCTION - Double check everything!

# Base Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --slow \
  -vvvv

# Arbitrum Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --slow \
  -vvvv

# Optimism Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $OPTIMISM_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $OPTIMISM_ETHERSCAN_API_KEY \
  --slow \
  -vvvv
```

## Deployment Order

Deploy contracts in this order:

1. **PedersenVerifier.sol** - No dependencies
2. **ZKVerifier.sol** - No dependencies (owner required)
3. **StealthAddressRegistry.sol** - No dependencies
4. **SIPPrivacy.sol** - Depends on all above
5. **FundingVerifier (HonkVerifier)** - Registered in ZKVerifier

Steps 1-4 use `script/Deploy.s.sol`. Step 5 requires a separate compilation
(see `script/DeployVerifier.s.sol` for details).

### Base Contracts (steps 1-4)

```bash
source .env
forge script script/Deploy.s.sol:DeployTestnetScript \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

### FundingVerifier (step 5 -- EIP-170 workaround)

BB-generated UltraHonk verifiers are ~28KB with `via_ir=true`, exceeding the
24,576 byte EIP-170 limit. The workaround is to compile in a separate workspace
without `via_ir` (optimizer_runs=1), which produces ~23.7KB bytecode.

```bash
# 1. Create temp workspace with via_ir=false, optimizer_runs=1
# 2. Deploy ZKTranscriptLib library
forge create src/FundingVerifier.sol:ZKTranscriptLib \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL --broadcast

# 3. Deploy HonkVerifier with library linked
forge create src/FundingVerifier.sol:HonkVerifier \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL --broadcast \
  --libraries src/FundingVerifier.sol:ZKTranscriptLib:$LIB_ADDRESS

# 4. Register in ZKVerifier
cast send $ZK_VERIFIER_ADDRESS "setFundingVerifier(address)" $VERIFIER_ADDRESS \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

See `script/DeployVerifier.s.sol` for full step-by-step instructions.

## Gas Report (Measured — Feb 2026)

| Operation | Gas (median) | Gas (max) |
|-----------|-------------|-----------|
| Deploy SIPPrivacy | 1,511,178 | — |
| Deploy StealthAddressRegistry | 1,175,000 | — |
| Deploy PedersenVerifier | 374,000 | — |
| Deploy ZKVerifier | 368,000 | — |
| shieldedTransfer (ETH) | 315,240 | 315,264 |
| shieldedTokenTransfer (ERC20) | 322,918 | 322,920 |
| claimTransfer (ETH) | 38,702 | 63,459 |
| claimTokenTransfer (ERC20) | 49,992 | 49,992 |
| registerStealthMetaAddress | 135,615 | 144,502 |
| announce | 46,462 | 57,256 |
| announceAndTransfer | 82,306 | 82,306 |

**Notes:**
- `shieldedTransfer` ~315K gas — higher than initial 200K target due to commitment validation, event emission, and fee logic. Acceptable for L2s where gas is cheap.
- `claimTransfer` ~39K gas — well under 100K target.
- Gas costs on L2s are 100-1000x cheaper than L1.

### Cost Comparison (Feb 2026, ETH ~$2,034)

| Network | Deploy Cost | Transfer Cost | Claim Cost |
|---------|-------------|---------------|------------|
| Ethereum L1 | ~$150 | ~$30 | ~$4 |
| Base | ~$0.15 | ~$0.03 | ~$0.004 |
| Arbitrum | ~$0.50 | ~$0.10 | ~$0.01 |
| Optimism | ~$0.30 | ~$0.06 | ~$0.008 |

## Contract Verification

### Automatic (with --verify)

```bash
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Manual Verification

```bash
# If automatic fails
forge verify-contract \
  --chain-id 8453 \
  --num-of-optimizations 200 \
  --watch \
  --etherscan-api-key $BASESCAN_API_KEY \
  --compiler-version v0.8.24 \
  0xCONTRACT_ADDRESS \
  src/SIPPrivacy.sol:SIPPrivacy
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Check contract code exists
cast code 0xCONTRACT_ADDRESS --rpc-url $BASE_RPC_URL

# Read owner
cast call 0xCONTRACT_ADDRESS "owner()" --rpc-url $BASE_RPC_URL
```

### 2. Configure SDK

Update `packages/sdk/src/config/networks.ts`:

```typescript
export const ETHEREUM_NETWORKS = {
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    contracts: {
      sipPrivacy: '0x...DEPLOYED_ADDRESS',
      pedersenVerifier: '0x...',
      zkVerifier: '0x...',
      stealthRegistry: '0x...',
    },
    explorer: 'https://basescan.org',
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    contracts: {
      sipPrivacy: '0x...',
      // ...
    },
    explorer: 'https://arbiscan.io',
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    contracts: {
      sipPrivacy: '0x...',
      // ...
    },
    explorer: 'https://optimistic.etherscan.io',
  },
}
```

### 3. Update Documentation

After successful deployment:
1. Update README.md with deployed addresses
2. Update docs.sip-protocol.org with network info
3. Add to CLAUDE.md infrastructure section

## Troubleshooting

### Common Issues

**"Insufficient funds"**
```bash
# Check balance
cast balance $DEPLOYER_ADDRESS --rpc-url $BASE_RPC_URL
```

**"Transaction underpriced"**
```bash
# Add --priority-gas-price flag
forge script ... --priority-gas-price 1gwei
```

**"Verification failed"**
```bash
# Try with explicit constructor args
forge verify-contract ... --constructor-args $(cast abi-encode "constructor(address,address,uint256)" $OWNER $FEE_COLLECTOR 100)
```

**"RPC rate limited"**
- Use paid RPC providers (Alchemy, QuickNode, Infura)
- Add `--slow` flag to reduce request rate

### L2-Specific Notes

**Base**
- Uses OP Stack, same as Optimism
- Fastest and cheapest of Tier 1
- Good for initial testing

**Arbitrum**
- Uses Nitro (custom rollup)
- Slightly different gas model
- May need `--legacy` flag for some operations

**Optimism**
- OP Stack reference implementation
- Bedrock upgrade complete
- Standard EVM compatibility

## Security Checklist

Before mainnet deployment:

- [ ] All tests passing (`forge test`)
- [ ] Coverage > 80% (`forge coverage`)
- [ ] Static analysis clean (`slither src/`)
- [ ] Constructor args verified
- [ ] Owner/admin addresses correct
- [ ] Fee settings reasonable (max 10%)
- [ ] Pause functionality tested
- [ ] Upgrade path documented (if applicable)

## Deployed Addresses

### Testnets

#### Sepolia (Chain ID: 11155111) -- v2 (ZKVerifier router rewrite)

| Contract | Address | Deployer |
|----------|---------|----------|
| SIPPrivacy | `0x1FED19684dC108304960db2818CF5a961d28405E` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| PedersenVerifier | `0x9AbdaBdaFdc4c0E2eFa389E6C375cdB890b919e2` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| ZKVerifier | `0x4994c799dF5B47C564cAafe7FdF415c2c2c66436` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| StealthAddressRegistry | `0xD62daC6f30541DE477c40B0Fcd7CD43e2248418E` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| ZKTranscriptLib | `0x588849033F79F3b13f8BF696c1f61C27dE056df4` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| FundingVerifier (HonkVerifier) | `0x8Ee5F3FC477C308224f58766540A5E7E049B0ECf` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |
| SIPSwapRouter | `0x881e55fd6FB774B06cB093bC0c881e57a3aEcd98` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` |

**Config:** Owner `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` | Fee 50 bps | Deployed 2026-02-28
**SIPSwapRouter:** Uniswap V3 private swaps → stealth addresses | SwapRouter `0xE592427A0AEce92De3Edee1F18E0157C05861564` | WETH `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` | Deployed 2026-03-01
**FundingVerifier:** Registered in ZKVerifier via `setFundingVerifier()` | 23,724 bytes (EIP-170 compliant)

<details>
<summary>v1 addresses (deprecated -- old mock ZKVerifier)</summary>

| Contract | Address |
|----------|---------|
| SIPPrivacy | `0x0B0d06D6B5136d63Bd0817414E2D318999e50339` |
| PedersenVerifier | `0xEB14E9022A4c3DEED072DeC6b3858c19a00C87Db` |
| ZKVerifier | `0x26988D988684627084e6ae113e0354f6bc56b126` |
| StealthAddressRegistry | `0x1f7f3edD264Cf255dD99Fd433eD9FADE427dEF99` |

</details>

#### L2 Testnets

| Network | SIPPrivacy | PedersenVerifier | ZKVerifier | Registry | Updated |
|---------|------------|------------------|------------|----------|---------|
| Base Sepolia | `0x0B0d06D6B5136d63Bd0817414E2D318999e50339` | `0xEB14E9022A4c3DEED072DeC6b3858c19a00C87Db` | `0x26988D988684627084e6ae113e0354f6bc56b126` | `0x1f7f3edD264Cf255dD99Fd433eD9FADE427dEF99` | 2026-02-27 |
| Arbitrum Sepolia | Pending (0 ETH in deployer) | — | — | — | TBD |
| Optimism Sepolia | `0x0B0d06D6B5136d63Bd0817414E2D318999e50339` | `0xEB14E9022A4c3DEED072DeC6b3858c19a00C87Db` | `0x26988D988684627084e6ae113e0354f6bc56b126` | `0x1f7f3edD264Cf255dD99Fd433eD9FADE427dEF99` | 2026-02-27 |

### Mainnets

| Network | SIPPrivacy | Registry | Updated |
|---------|------------|----------|---------|
| Base | `0x...` | `0x...` | TBD |
| Arbitrum | `0x...` | `0x...` | TBD |
| Optimism | `0x...` | `0x...` | TBD |

## Related

- [README.md](./README.md) - Contract documentation
- [AUDIT.md](./AUDIT.md) - Security audit info
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - Security review
- [Issue #458](https://github.com/sip-protocol/sip-protocol/issues/458) - L2 Deployment tracking
