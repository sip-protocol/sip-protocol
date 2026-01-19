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
2. **ZKVerifier.sol** - No dependencies
3. **StealthAddressRegistry.sol** - No dependencies
4. **SIPPrivacy.sol** - Depends on all above

```solidity
// script/Deploy.s.sol
function run() external {
    vm.startBroadcast();

    // 1. Deploy verifiers
    PedersenVerifier pedersen = new PedersenVerifier();
    ZKVerifier zkVerifier = new ZKVerifier(msg.sender);

    // 2. Deploy registry
    StealthAddressRegistry registry = new StealthAddressRegistry();

    // 3. Deploy main contract
    SIPPrivacy privacy = new SIPPrivacy(
        msg.sender,           // owner
        feeCollector,         // fee recipient
        100                   // 1% fee (100 bps)
    );

    // 4. Link verifiers
    privacy.setPedersenVerifier(address(pedersen));
    privacy.setZkVerifier(address(zkVerifier));

    vm.stopBroadcast();
}
```

## Gas Estimation by Network

| Operation | Ethereum | Base | Arbitrum | Optimism |
|-----------|----------|------|----------|----------|
| Deploy SIPPrivacy | ~2.5M | ~2.5M | ~2.5M | ~2.5M |
| shieldedTransfer (ETH) | ~150K | ~150K | ~150K | ~150K |
| shieldedTransfer (ERC20) | ~200K | ~200K | ~200K | ~200K |
| claimTransfer | ~80K | ~80K | ~80K | ~80K |

### Cost Comparison (Dec 2025 estimates)

| Network | Deploy Cost | Transfer Cost |
|---------|-------------|---------------|
| Ethereum | ~$500 | ~$15 |
| Base | ~$0.50 | ~$0.01 |
| Arbitrum | ~$2 | ~$0.05 |
| Optimism | ~$1 | ~$0.03 |

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

| Network | SIPPrivacy | Registry | Updated |
|---------|------------|----------|---------|
| Base Sepolia | `0x...` | `0x...` | TBD |
| Arbitrum Sepolia | `0x...` | `0x...` | TBD |
| Optimism Sepolia | `0x...` | `0x...` | TBD |

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
