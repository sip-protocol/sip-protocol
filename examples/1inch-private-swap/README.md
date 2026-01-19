# 1inch Aggregator Private Swap Example

Privacy-preserving token swaps via 1inch aggregator using SIP Protocol. Combines best price discovery across 50+ DEXs with stealth addresses and Pedersen commitments.

## Overview

1inch finds the optimal swap route across multiple DEXs. SIP adds privacy:

- **Best Prices**: Routes split across Uniswap, Curve, Balancer, etc.
- **Hidden Sender**: Swap originates from stealth address
- **Hidden Amount**: Commitment hides swap size
- **Hidden Recipient**: Output goes to one-time stealth address

## Why 1inch + SIP?

| Feature | Direct DEX | 1inch + SIP |
|---------|-----------|-------------|
| Price | Single pool | Best across 50+ DEXs |
| Privacy | None | Full stealth |
| Gas | Lower | Slightly higher |
| MEV Protection | Limited | Available |

## Quick Start

```bash
# Run simulation
npx tsx index.ts

# Run with live 1inch quotes
ONEINCH_API_KEY=your_key LIVE_MODE=true npx tsx index.ts

# Use different network
NETWORK=arbitrum npx tsx index.ts
```

## Get 1inch API Key

1. Visit [1inch Developer Portal](https://portal.1inch.dev)
2. Create account and generate API key
3. Set as environment variable: `ONEINCH_API_KEY=your_key`

## Example Output

```
1inch Aggregator Private Swap Example
═══════════════════════════════════════════════════════════════

Mode: SIMULATION
Network: mainnet
Swap: 0.5 ETH → USDC

STEP 1: Generate stealth addresses
─────────────────────────────────────────────────────────────────
  Receiver stealth meta-address generated
    Spending Key: 0x02abc123...def456
    Viewing Key:  0x03fed987...cba654

STEP 3: Get 1inch aggregator quote
─────────────────────────────────────────────────────────────────
  Quote received:
    Input: 0.5 ETH
    Output: 1,248.75 USDC
    Min Output (1% slippage): 1,236.26 USDC
    Gas Estimate: 180000 units

  Route breakdown (best rates from):
    • Uniswap V3: 45%
    • Curve: 30%
    • Balancer V2: 25%

...

PRIVACY + AGGREGATION SUMMARY
═══════════════════════════════════════════════════════════════

1inch benefits:
  ✓ Best price across 50+ DEXs
  ✓ Optimized gas via route splitting
  ✓ MEV protection (when enabled)

SIP privacy benefits:
  ✓ Sender hidden via stealth input
  ✓ Amount hidden via commitment
  ✓ Recipient hidden via stealth output
```

## Integration Code

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  commit,
} from '@sip-protocol/sdk'

// 1. Generate stealth output address
const receiverMeta = generateStealthMetaAddress('ethereum')
const outputStealth = generateStealthAddress(receiverMeta.metaAddress)

// 2. Create amount commitment
const commitment = commit(amountIn)

// 3. Get 1inch quote with stealth recipient
const quote = await fetch(
  `https://api.1inch.dev/swap/v5.2/1/swap?` +
  `src=${ETH}&dst=${USDC}&amount=${amountIn}&` +
  `from=${stealthSender}&receiver=${outputStealth.stealthAddress.address}`,
  { headers: { Authorization: `Bearer ${API_KEY}` } }
)

// 4. Sign and broadcast swap transaction
// 5. Announce stealth transfer for recipient to find
```

## Supported Networks

| Network | 1inch Support | SIP Support |
|---------|--------------|-------------|
| Ethereum | ✓ | ✓ |
| Arbitrum | ✓ | ✓ |
| Optimism | ✓ | ✓ |
| Base | ✓ | ✓ |
| Polygon | ✓ | ✓ |

## Gas Costs

| Operation | Gas Units | Est. Cost (30 gwei) |
|-----------|-----------|---------------------|
| Stealth Transfer | 80,000 | ~$5.00 |
| 1inch Swap | 180,000 | ~$11.00 |
| Announcement | 65,000 | ~$4.00 |
| **Total** | **325,000** | **~$20.00** |

On L2s, costs are 90%+ lower.

## 1inch API Endpoints

```
GET /swap/v5.2/{chainId}/quote     - Get quote without transaction
GET /swap/v5.2/{chainId}/swap      - Get quote with transaction data
GET /swap/v5.2/{chainId}/approve   - Get approval transaction
```

## Related Examples

- `examples/uniswap-private-swap/` - Direct Uniswap V3 (lower gas)
- `examples/ethereum-integration/` - Basic stealth transfers
- `examples/compliance/` - Adding audit trails

## License

MIT - See [LICENSE](../../LICENSE)
