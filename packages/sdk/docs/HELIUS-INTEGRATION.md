# Helius Integration

SIP Protocol integrates with Helius to provide production-grade stealth payment scanning on Solana using the **Digital Asset Standard (DAS) API** and **real-time webhooks**.

## Overview

```
┌───────────────────────────────────────────────────────────────────┐
│  SIP Protocol + Helius: Production Stealth Scanning               │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────┐        ┌─────────────────────┐
│   Pull-Based        │        │   Push-Based        │
│   (Polling)         │        │   (Real-time)       │
│                     │        │                     │
│   HeliusProvider    │        │   Webhook Handler   │
│   ├─ DAS API        │        │   ├─ Raw webhooks   │
│   ├─ Balances API   │        │   ├─ SIP:1: filter  │
│   └─ Pagination     │        │   └─ Callback       │
└──────────┬──────────┘        └──────────┬──────────┘
           │                              │
           └──────────────┬───────────────┘
                          ▼
           ┌─────────────────────────────┐
           │   Stealth Payment Scanning  │
           │                             │
           │   • Token detection         │
           │   • View tag filtering      │
           │   • Key verification        │
           │   • Payment claiming        │
           └─────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install @sip-protocol/sdk
```

### Basic Usage

```typescript
import { createProvider, HeliusProvider } from '@sip-protocol/sdk'

// Option 1: Factory function
const helius = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY!,
  cluster: 'mainnet-beta', // or 'devnet'
})

// Option 2: Direct instantiation
const helius = new HeliusProvider({
  apiKey: process.env.HELIUS_API_KEY!,
  cluster: 'devnet',
})

// Query token assets
const assets = await helius.getAssetsByOwner('7xK9...')
console.log('Found', assets.length, 'tokens')
```

### Webhook Setup

```typescript
import { createWebhookHandler } from '@sip-protocol/sdk'
import express from 'express'

const app = express()
app.use(express.json())

const handler = createWebhookHandler({
  viewingPrivateKey: '0x...',
  spendingPublicKey: '0x...',
  onPaymentFound: (payment) => {
    console.log('Payment found!', payment.amount, payment.mint)
  },
})

app.post('/webhook/helius', async (req, res) => {
  await handler(req.body)
  res.status(200).send('OK')
})

app.listen(3000)
```

## Features

### 1. HeliusProvider (DAS API)

High-performance token queries using Helius Digital Asset Standard API:

```typescript
const helius = createProvider('helius', { apiKey: 'your-api-key' })

// Get all fungible tokens owned by an address
const assets = await helius.getAssetsByOwner('owner-address')

// Each asset includes:
// - mint: SPL token mint address
// - amount: Balance as bigint (preserves precision)
// - decimals: Token decimals
// - symbol: Token symbol (e.g., 'USDC')
// - name: Full token name
// - logoUri: Token logo URL

// Get balance for a specific token
const balance = await helius.getTokenBalance('owner-address', 'mint-address')
```

**Features:**
- Automatic pagination (handles wallets with 1000+ tokens)
- NFT filtering (only returns fungible tokens)
- Large balance support (strings preserved for precision)
- Fallback from Balances API to DAS on error

### 2. Webhook Handler

Real-time stealth payment detection for production deployments:

```typescript
const handler = createWebhookHandler({
  viewingPrivateKey: recipientKeys.viewingPrivateKey,
  spendingPublicKey: recipientKeys.metaAddress.spendingKey,

  onPaymentFound: async (payment) => {
    // Called when a payment for us is detected
    console.log('Payment:', {
      stealthAddress: payment.stealthAddress,
      amount: payment.amount,
      mint: payment.mint,
      txSignature: payment.txSignature,
    })

    // Notify user, update database, trigger claim, etc.
    await notifyUser(payment)
  },

  onError: (error, transaction) => {
    // Optional error handler
    console.error('Webhook processing error:', error)
  },
})
```

**Supported Webhook Types:**
- **Raw webhooks**: Full transaction data with log messages (recommended)
- **Enhanced webhooks**: Parsed/decoded data (SIP announcements not directly available)

### 3. Integration with scanForPayments

Combine HeliusProvider with the scanning API:

```typescript
import { scanForPayments, createProvider } from '@sip-protocol/sdk'

const helius = createProvider('helius', { apiKey: process.env.HELIUS_API_KEY! })

const payments = await scanForPayments({
  connection, // Solana Connection
  viewingPrivateKey: '0x...',
  spendingPublicKey: '0x...',
  provider: helius, // Uses DAS API for efficient balance queries
  fromSlot: 250000000,
  limit: 100,
})

for (const payment of payments) {
  console.log(`Found ${payment.amount} ${payment.tokenSymbol} at ${payment.stealthAddress}`)
}
```

## Supported APIs

| API | Method | Description |
|-----|--------|-------------|
| DAS API | `getAssetsByOwner` | Get all token assets owned by an address |
| Balances API | `getTokenBalance` | Get balance for a specific token |
| Webhooks | Raw/Enhanced | Real-time transaction notifications |

## API Reference

### HeliusProvider

```typescript
interface HeliusProviderConfig {
  /** Helius API key (required) */
  apiKey: string
  /** Solana cluster (default: mainnet-beta) */
  cluster?: 'mainnet-beta' | 'devnet'
}

class HeliusProvider implements SolanaRPCProvider {
  readonly name = 'helius'

  constructor(config: HeliusProviderConfig)

  /** Get all fungible token assets owned by an address */
  getAssetsByOwner(owner: string): Promise<TokenAsset[]>

  /** Get balance for a specific token */
  getTokenBalance(owner: string, mint: string): Promise<bigint>

  /** Check if provider supports subscriptions (returns false) */
  supportsSubscriptions(): boolean
}
```

### WebhookHandlerConfig

```typescript
interface WebhookHandlerConfig {
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending public key (hex) */
  spendingPublicKey: HexString
  /** Callback when a payment is found */
  onPaymentFound: (payment: SolanaScanResult) => void | Promise<void>
  /** Optional callback for errors */
  onError?: (error: Error, transaction?: HeliusWebhookTransaction) => void
}
```

### HeliusWebhookTransaction

```typescript
interface HeliusWebhookTransaction {
  blockTime: number
  slot: number
  meta: {
    err: unknown | null
    fee: number
    logMessages: string[]
    postTokenBalances: TokenBalance[]
    preTokenBalances: TokenBalance[]
    // ... other fields
  }
  transaction: {
    message: { accountKeys: string[]; instructions: Instruction[] }
    signatures: string[]
  }
}
```

## Examples

See the `examples/` directory:

- `helius-scanning.ts` - DAS API scanning example
- `helius-webhook-server.ts` - Express.js webhook server

Run examples:

```bash
npx tsx examples/helius-scanning.ts
npx tsx examples/helius-webhook-server.ts
```

## Testing

```bash
# Run all Helius/Solana provider tests (69 tests)
pnpm vitest run tests/chains/solana

# Run provider tests only
pnpm vitest run tests/chains/solana/providers.test.ts

# Run webhook tests only
pnpm vitest run tests/chains/solana/webhook.test.ts
```

## Configuration

### Environment Variables

```bash
# Required for HeliusProvider
HELIUS_API_KEY=your-api-key-here

# Optional: Solana RPC (used with GenericProvider)
SOL_RPC_URL=https://api.mainnet-beta.solana.com
```

### Helius Dashboard Setup (Webhooks)

1. Go to [Helius Dashboard](https://dev.helius.xyz/webhooks)
2. Create a new webhook:
   - **Webhook URL**: `https://your-server.com/webhook/helius`
   - **Transaction Type**: `Any` (or `TRANSFER` for token transfers)
   - **Webhook Type**: `raw` (required for SIP announcements)
3. Configure authentication (recommended for production):
   - Add a secret header
   - Verify in your handler

### Cluster Selection

```typescript
// Mainnet (default)
const mainnet = createProvider('helius', {
  apiKey: 'key',
  cluster: 'mainnet-beta',
})

// Devnet (for testing)
const devnet = createProvider('helius', {
  apiKey: 'key',
  cluster: 'devnet',
})
```

## Architecture

```
packages/sdk/src/chains/solana/
├── providers/
│   ├── index.ts          # Barrel exports
│   ├── interface.ts      # SolanaRPCProvider interface, createProvider factory
│   ├── helius.ts         # HeliusProvider (DAS API)
│   ├── generic.ts        # GenericProvider (standard RPC)
│   └── webhook.ts        # Helius webhook handler
├── scan.ts               # scanForPayments, claimStealthPayment
├── transfer.ts           # sendPrivateSPLTransfer
├── types.ts              # Types, parseAnnouncement
├── constants.ts          # Token mints, RPC endpoints
└── index.ts              # Public API exports
```

## Performance Comparison

| Approach | Use Case | Latency | Scalability |
|----------|----------|---------|-------------|
| Standard RPC | Development | ~500ms | Low (rate limits) |
| HeliusProvider | Production polling | ~100ms | High (DAS API) |
| Helius Webhooks | Production real-time | ~1s | Very High (push-based) |

## Related Issues

- [#446 Helius DAS adapter](https://github.com/sip-protocol/sip-protocol/issues/446) - DAS API integration
- [#447 Helius webhook](https://github.com/sip-protocol/sip-protocol/issues/447) - Webhook support

## License

MIT
