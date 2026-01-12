# Arcium Integration

SIP Protocol integrates with Arcium to provide complete privacy through the combination of **transaction privacy** (stealth addresses) and **compute privacy** (C-SPL tokens with MPC).

## Overview

```
┌──────────────────┐     ┌──────────────────┐
│   SIP Native     │     │    Arcium        │
│                  │     │                  │
│ • Stealth Addr   │  +  │ • C-SPL Tokens   │
│ • Viewing Keys   │     │ • MPC Compute    │
│ • Compliance     │     │ • Encrypted Bal  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └───────────┬────────────┘
                     ▼
         ┌──────────────────────┐
         │   Complete Privacy   │
         │                      │
         │ • Hidden Sender      │
         │ • Hidden Recipient   │
         │ • Hidden Amount      │
         │ • Hidden Compute     │
         │ • Audit Support      │
         └──────────────────────┘
```

## Quick Start

### Installation

```bash
npm install @sip-protocol/sdk
```

### Basic Usage

```typescript
import {
  createCombinedPrivacyServiceDevnet,
  createCSPLServiceDevnet,
} from '@sip-protocol/sdk'

// Option 1: C-SPL only (amount privacy)
const cspl = createCSPLServiceDevnet()
await cspl.initialize()

const wrap = await cspl.wrap({
  splMint: 'USDC-mint',
  owner: 'your-wallet',
  amount: 100_000000n,
})

// Option 2: Combined privacy (full protection)
const combined = createCombinedPrivacyServiceDevnet()
await combined.initialize()

const result = await combined.executePrivateTransfer({
  splMint: 'USDC-mint',
  sender: 'your-wallet',
  recipientMetaAddress: 'sip:solana:0x02...:0x03...',
  amount: 100_000000n,
  decimals: 6,
  viewingKey: '0x04...', // For compliance
})
```

## Features

### 1. C-SPL Token Service

High-level service for confidential SPL token operations:

```typescript
const cspl = createCSPLServiceDevnet()
await cspl.initialize()

// Wrap SPL → C-SPL (hide balance)
const wrap = await cspl.wrap({
  splMint: 'token-mint',
  owner: 'wallet-address',
  amount: 1000000n,
})

// Confidential transfer (encrypted amounts)
const transfer = await cspl.transfer({
  csplMint: wrap.csplMint,
  sender: 'sender',
  recipient: 'recipient',
  amount: 500000n,
  auditorKey: 'viewing-key', // Optional
})

// Unwrap C-SPL → SPL
const unwrap = await cspl.unwrap({
  csplMint: wrap.csplMint,
  owner: 'wallet-address',
  amount: 500000n,
})

// Get encrypted balance
const balance = await cspl.getBalance(csplMint, owner)
```

### 2. Arcium Backend

Low-level backend implementing the `PrivacyBackend` interface:

```typescript
const arcium = createArciumDevnetBackend()
await arcium.initialize()

// Check capabilities
const caps = arcium.getCapabilities()
// { hiddenAmount: true, hiddenCompute: true, ... }

// Execute MPC computation
const result = await arcium.executeMPC({
  computation: 'confidential-transfer',
  inputs: [...],
  cluster: 'arcium-cluster-1',
})
```

### 3. Combined Privacy Service

Orchestrates SIP Native + Arcium for maximum privacy:

```typescript
const combined = createCombinedPrivacyServiceDevnet()
await combined.initialize()

const result = await combined.executePrivateTransfer({
  splMint: 'token-mint',
  sender: 'sender-address',
  recipientMetaAddress: 'sip:solana:0x02...:0x03...',
  amount: 100_000000n,
  decimals: 6,
  viewingKey: '0x04...', // Optional
})

// Result includes:
// - wrap: SPL → C-SPL conversion
// - stealth: One-time recipient address
// - transfer: C-SPL transfer to stealth
// - privacyAchieved: { hiddenRecipient, hiddenAmount, hiddenSender, complianceSupport }
```

## Supported Tokens

| Token | SPL Mint | C-SPL Symbol | Decimals |
|-------|----------|--------------|----------|
| SOL | So11111111111111111111111111111111111111112 | cSOL | 9 |
| USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v | cUSDC | 6 |
| USDT | Es9vMFrzaCERmJfrF4H2FYwT9fDFmrUtnAjLoS8S6sD | cUSDT | 6 |

## Privacy Comparison

| Feature | SIP Native | Arcium | Combined |
|---------|-----------|--------|----------|
| Hidden Sender | ✓ | ✗ | ✓ |
| Hidden Recipient | ✓ | ✗ | ✓ |
| Hidden Amount | ✓ | ✓ | ✓ |
| Hidden Compute | ✗ | ✓ | ✓ |
| Compliance Support | ✓ | ✗ | ✓ |

## API Reference

### CSPLTokenService

```typescript
interface CSPLTokenService {
  initialize(): Promise<void>
  wrap(params: WrapParams): Promise<WrapResult>
  unwrap(params: UnwrapParams): Promise<UnwrapResult>
  transfer(params: ConfidentialTransferParams): Promise<ConfidentialTransferResult>
  getBalance(csplMint: string, owner: string): Promise<ConfidentialBalance | null>
  approve(params: ApproveParams): Promise<ApproveResult>
  revoke(csplMint: string, delegate: string, owner: string): Promise<ApproveResult>
  estimateCost(operation: string): Promise<bigint>
  getSupportedTokens(): CSPLToken[]
}
```

### CombinedPrivacyService

```typescript
interface CombinedPrivacyService {
  initialize(): Promise<void>
  executePrivateTransfer(params: CombinedTransferParams): Promise<CombinedTransferResult>
  deriveStealthAddress(metaAddress: string): Promise<StealthAddressResult>
  claimFromStealth(params: ClaimParams): Promise<ClaimResult>
  estimateCost(params: CombinedTransferParams): Promise<CostBreakdown>
  getPrivacyComparison(): PrivacyComparison
  getStatus(): ServiceStatus
}
```

## Examples

See the `examples/` directory:

- `arcium-privacy-demo.ts` - Full demo with all features
- `arcium-quickstart.ts` - Minimal quick start example

Run examples:

```bash
npx tsx examples/arcium-privacy-demo.ts
npx tsx examples/arcium-quickstart.ts
```

## Testing

```bash
# Run all Arcium tests
pnpm test -- tests/privacy-backends/arcium.test.ts --run

# Run C-SPL tests
pnpm test -- tests/privacy-backends/cspl-token.test.ts --run

# Run combined privacy tests
pnpm test -- tests/privacy-backends/combined-privacy.test.ts --run

# Run all privacy backend tests
pnpm test -- tests/privacy-backends/ --run
```

## Architecture

```
src/privacy-backends/
├── arcium.ts              # ArciumBackend class
├── arcium-types.ts        # Types and constants
├── cspl-token.ts          # CSPLTokenService
├── combined-privacy.ts    # CombinedPrivacyService
├── interface.ts           # PrivacyBackend interface
├── router.ts              # SmartRouter
└── index.ts               # Exports
```

## Related Issues

- [#484 C-SPL Arcium](https://github.com/sip-protocol/sip-protocol/issues/484) - Main bounty issue
- [#481 Arcium Adapter](https://github.com/sip-protocol/sip-protocol/issues/481) - Backend implementation

## License

MIT
