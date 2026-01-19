# 1inch Private Swap Example

This example demonstrates how to execute a private swap through 1inch aggregator using SIP Protocol's stealth addresses.

## Overview

1inch aggregates liquidity across multiple DEXs to find the best swap rates. Combined with SIP stealth addresses, you get:

1. **Best Execution**: 1inch routes through multiple DEXs
2. **Output Privacy**: Tokens received at a fresh stealth address
3. **Unlinkability**: No connection between swap and your main wallet

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Stealth Input  │────▶│ 1inch Router │────▶│ Stealth Output  │
│   (ETH/Token)   │     │  (Aggregator)│     │   (Token/ETH)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                      │                      │
        │               ┌──────┴──────┐               │
        │               │ Uniswap     │               │
        │               │ Curve       │               │
        │               │ Balancer    │               │
        │               │ SushiSwap   │               │
        │               └─────────────┘               │
        ▼                                             ▼
┌─────────────────┐                         ┌─────────────────┐
│  SIP Announcer  │                         │  SIP Announcer  │
└─────────────────┘                         └─────────────────┘
```

## Prerequisites

```bash
npm install @sip-protocol/sdk ethers
```

## Usage

```typescript
import { privateOneInchSwap, getOneInchQuote } from './private-swap'

// Get quote first
const quote = await getOneInchQuote({
  fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  amount: '1000000000000000000', // 1 ETH in wei
})

console.log('Expected output:', quote.toAmount)
console.log('Gas estimate:', quote.estimatedGas)

// Execute private swap
const result = await privateOneInchSwap({
  recipientMetaAddress: 'sip:ethereum:0x02abc...123:0x03def...456',
  fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  amount: '1000000000000000000',
  slippagePercent: 1,
  signer,
})

console.log('Swap tx:', result.swapTxHash)
console.log('Output to stealth:', result.stealthAddress)
```

## How It Works

### Step 1: Generate Stealth Output Address

```typescript
import { generateEthereumStealthAddress } from '@sip-protocol/sdk'

const stealth = generateEthereumStealthAddress(recipientMetaAddress)
```

### Step 2: Get 1inch Quote with Stealth Recipient

```typescript
const quote = await fetch(
  `https://api.1inch.dev/swap/v6.0/1/swap?` +
  `src=${fromToken}&dst=${toToken}&amount=${amount}` +
  `&from=${walletAddress}&receiver=${stealth.stealthAddress.ethAddress}` +
  `&slippage=${slippage}`
)
```

### Step 3: Execute Swap

```typescript
const tx = await signer.sendTransaction({
  to: quote.tx.to,
  data: quote.tx.data,
  value: quote.tx.value,
  gasLimit: quote.tx.gas,
})
```

### Step 4: Announce Stealth Address

```typescript
await announcer.announce(
  1, // secp256k1 scheme
  stealth.stealthAddress.ethAddress,
  stealth.stealthAddress.ephemeralPublicKey,
  metadata
)
```

## API Configuration

You'll need a 1inch API key from [1inch Dev Portal](https://portal.1inch.dev/).

```typescript
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY
```

## Privacy Considerations

1. **API Privacy**: 1inch API sees your request - consider using a proxy
2. **Input Source**: Funds should come from a previous stealth address
3. **Relayers**: Use Gelato to avoid linking gas payer
4. **Timing**: Add random delays between operations

## Network Support

| Network | 1inch Router | Chain ID |
|---------|--------------|----------|
| Mainnet | `0x111111...` | 1 |
| Arbitrum | `0x111111...` | 42161 |
| Optimism | `0x111111...` | 10 |
| Base | `0x111111...` | 8453 |
| Polygon | `0x111111...` | 137 |

## Gas Costs

| Operation | Mainnet | L2 (Base) |
|-----------|---------|-----------|
| 1inch swap | ~150-300k | ~150-300k |
| Announcement | ~80k | ~80k |
| **Total** | ~230-380k | ~230-380k |

## Comparison: 1inch vs Direct DEX

| Feature | 1inch | Uniswap Direct |
|---------|-------|----------------|
| Best price | ✅ Aggregated | ❌ Single DEX |
| Gas cost | ⚠️ Higher | ✅ Lower |
| Privacy | ✅ Same | ✅ Same |
| Complexity | ⚠️ API needed | ✅ On-chain only |

## Error Handling

```typescript
try {
  const result = await privateOneInchSwap(params)
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('Not enough balance for swap + gas')
  } else if (error.code === 'SLIPPAGE_EXCEEDED') {
    console.error('Price moved too much, increase slippage')
  } else if (error.code === 'INVALID_META_ADDRESS') {
    console.error('Invalid stealth meta-address format')
  }
}
```

## Security Notes

- Validate 1inch API responses before signing
- Check recipient address matches your stealth address
- Verify token addresses against known contracts
- Use hardware wallet for large transactions

## Related

- [SIP Ethereum Privacy Guide](https://docs.sip-protocol.org/ethereum)
- [1inch API Documentation](https://docs.1inch.io/docs/aggregation-protocol/api)
- [Uniswap Private Swap Example](../uniswap-private-swap/)
