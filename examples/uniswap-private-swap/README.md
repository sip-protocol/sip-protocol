# Uniswap V3 Private Swap Example

Privacy-preserving token swaps on Uniswap V3 using SIP Protocol's stealth addresses and Pedersen commitments.

## Overview

This example demonstrates how to execute a swap on Uniswap V3 while preserving privacy:

- **Hidden Sender**: Swap originates from a one-time stealth address
- **Hidden Amount**: Swap amount protected by Pedersen commitment
- **Hidden Recipient**: Output goes to a stealth address
- **No Linkability**: No on-chain connection between your wallet and the swap

## How It Works

```
Your Wallet → [Fund Stealth] → Stealth Input
                                    ↓
                              Uniswap V3 Router
                                    ↓
                              Stealth Output → [Claim] → Your Wallet
```

### Privacy Flow

1. **Generate Stealth Addresses**: Create one-time addresses for input and output
2. **Create Commitment**: Hide the swap amount with a Pedersen commitment
3. **Execute Swap**: Uniswap sees stealth addresses, not your wallet
4. **Claim Output**: Only you can derive the key to claim the output tokens

## Quick Start

```bash
# Run simulation
npx tsx index.ts

# Run with live quotes (requires RPC)
LIVE_MODE=true npx tsx index.ts

# Use different network
NETWORK=arbitrum npx tsx index.ts
```

## Example Output

```
Uniswap V3 Private Swap Example
═══════════════════════════════════════════════════════════════

Mode: SIMULATION
Network: mainnet
Swap: 0.1 ETH → USDC

STEP 1: Generate stealth addresses
─────────────────────────────────────────────────────────────────
  Sender stealth meta-address generated
    Spending Key: 0x02abc123...def456
    Viewing Key:  0x03fed987...cba654

  Output stealth address generated
    Stealth Address: 0x7f3a...9b2c
    View Tag: 42
    Ephemeral Key: 0x02bbb...aaa

STEP 2: Create amount commitment
─────────────────────────────────────────────────────────────────
  Amount hidden with Pedersen commitment
    Amount: 0.1 ETH (hidden on-chain)
    Commitment: 0x04xyz...789

...

PRIVACY SUMMARY
═══════════════════════════════════════════════════════════════

What observers see:
  ✗ Cannot link swap to your main wallet
  ✗ Cannot see exact swap amount (commitment)
  ✗ Cannot identify output owner (stealth address)

What you preserve:
  ✓ Full ownership of output tokens
  ✓ Ability to prove swap to auditors (viewing key)
  ✓ Uniswap best-in-class execution
```

## Integration Guide

### Basic Integration

```typescript
import {
  generateEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  commitETH,
  toWei,
} from '@sip-protocol/sdk'

// 1. Generate stealth address for output
const receiverMeta = generateEthereumStealthMetaAddress()
const outputStealth = generateEthereumStealthAddress(receiverMeta.metaAddress)

// 2. Create amount commitment
const commitment = commitETH(toWei('1.0'))

// 3. Build Uniswap swap with stealth output
const swapParams = {
  tokenIn: WETH,
  tokenOut: USDC,
  fee: 3000,
  recipient: outputStealth.stealthAddress, // Stealth, not your wallet!
  deadline: Math.floor(Date.now() / 1000) + 1800,
  amountIn: toWei('1.0'),
  amountOutMinimum: minAmountOut,
  sqrtPriceLimitX96: 0,
}

// 4. Execute swap (via your stealth-funded address)
// 5. Announce the stealth transfer
```

### With Wallet Integration

See `examples/wallet-integration/` for connecting wallets like MetaMask.

### With Compliance

See `examples/compliance/` for adding viewing key disclosure for auditors.

## Supported Networks

| Network | Uniswap V3 | Status |
|---------|-----------|--------|
| Ethereum Mainnet | ✓ | Supported |
| Arbitrum One | ✓ | Supported |
| Optimism | ✓ | Supported |
| Base | ✓ | Supported |
| Polygon | ✓ | Supported |

## Gas Costs

Approximate gas costs for private swaps:

| Operation | Gas Units | Est. Cost (30 gwei) |
|-----------|-----------|---------------------|
| Stealth Transfer | 80,000 | ~$5.00 |
| Uniswap Swap | 150,000 | ~$9.00 |
| Announcement | 65,000 | ~$4.00 |
| **Total** | **295,000** | **~$18.00** |

On L2s (Arbitrum, Base, Optimism), costs are 90%+ lower.

## Security Considerations

1. **Key Management**: Store stealth private keys securely
2. **Timing**: Claim outputs at random intervals to prevent timing correlation
3. **Amount Patterns**: Avoid round numbers that could be identified
4. **Multiple Swaps**: Use different stealth addresses for each swap

## Related Examples

- `examples/ethereum-integration/` - Basic Ethereum stealth transfers
- `examples/1inch-private-swap/` - Privacy swaps via 1inch aggregator
- `examples/compliance/` - Adding audit trails with viewing keys
- `examples/wallet-integration/` - Connecting hardware wallets

## License

MIT - See [LICENSE](../../LICENSE)
