# NEAR Privacy Integration Examples

Complete examples demonstrating SIP Protocol's NEAR integration, including same-chain privacy and cross-chain swaps via NEAR Intents.

## Overview

SIP Protocol provides two types of NEAR integration:

1. **NEAR Same-Chain Privacy** - Ed25519 stealth addresses for NEP-141 tokens
2. **NEAR Intents (1Click)** - Cross-chain swaps with privacy via NEAR's intent layer

## Quick Start

```bash
# From repository root
pnpm install

# Run same-chain example
npx ts-node examples/near-integration/01-near-stealth-address.ts

# Run cross-chain example
NEAR_INTENTS_JWT=your_token npx ts-node examples/near-integration/02-cross-chain-swap.ts
```

## Examples

| File | Description |
|------|-------------|
| [01-near-stealth-address.ts](./01-near-stealth-address.ts) | NEAR same-chain privacy with ed25519 stealth |
| [02-cross-chain-swap.ts](./02-cross-chain-swap.ts) | Cross-chain swap with stealth recipient |
| [03-near-wallet-integration.ts](./03-near-wallet-integration.ts) | NEAR wallet adapter integration |

## Architecture

### Same-Chain Privacy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SENDER (NEAR)                                                              │
│  1. Get recipient's stealth meta-address                                    │
│  2. Generate one-time stealth address (ed25519)                             │
│  3. Transfer NEP-141 tokens to stealth address                              │
│  4. Emit announcement with ephemeral key                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEAR BLOCKCHAIN                                                            │
│  - Stealth address = implicit NEAR account (ed25519 public key)             │
│  - NEP-141 transfer (fungible token standard)                               │
│  - Announcement stored in transaction memo                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT (NEAR)                                                           │
│  1. Scan announcements with viewing key                                     │
│  2. Derive stealth private key                                              │
│  3. Claim tokens to main wallet                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cross-Chain Privacy (NEAR Intents)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SENDER (Any Chain)                                                         │
│  1. Prepare swap with stealth recipient                                     │
│  2. Get quote from 1Click API                                               │
│  3. Deposit tokens to 1Click address                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEAR INTENTS (1Click)                                                      │
│  - Defuse solver network                                                    │
│  - Cross-chain settlement                                                   │
│  - Multi-chain asset support                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT (Any Chain)                                                      │
│  - Receives tokens at stealth address                                       │
│  - Scans and claims as usual                                                │
│  - No link between sender and recipient chains                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Ed25519 Stealth Addresses

NEAR uses ed25519 for accounts, which SIP supports natively:

```typescript
import { generateStealthMetaAddress, generateEd25519StealthAddress } from '@sip-protocol/sdk'

// Generate NEAR-compatible stealth meta-address
const recipient = generateStealthMetaAddress('near', 'My Wallet')
// Keys are 32-byte ed25519 public keys

// Generate one-time stealth address
const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

// Convert to NEAR implicit account format
import { ed25519PublicKeyToNearAddress } from '@sip-protocol/sdk'
const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
// => "abc123..." (64-char hex implicit account)
```

### NEAR Implicit Accounts

NEAR supports implicit accounts (like Ethereum EOAs):
- Format: 64-character hex string (ed25519 public key)
- No need to create account on-chain
- Can receive tokens immediately
- Private key derived from stealth address mechanism

### NEAR Intents Integration

NEAR Intents (1Click API) provides cross-chain swaps:

```typescript
import { NEARIntentsAdapter, PrivacyLevel } from '@sip-protocol/sdk'

const adapter = new NEARIntentsAdapter({
  jwtToken: process.env.NEAR_INTENTS_JWT,
})

// Prepare swap with stealth recipient
const prepared = await adapter.prepareSwap(
  {
    requestId: 'swap-001',
    privacyLevel: PrivacyLevel.SHIELDED,
    inputAsset: { chain: 'ethereum', symbol: 'USDC' },
    inputAmount: 100_000_000n, // 100 USDC
    outputAsset: { chain: 'near', symbol: 'NEAR' },
  },
  recipientMetaAddress,
  senderAddress
)

// Get quote
const quote = await adapter.getQuote(prepared)

// User deposits to quote.depositAddress
// Tokens arrive at stealth address
```

## Supported Assets

### NEAR Native

| Asset | Symbol | Format |
|-------|--------|--------|
| NEAR | NEAR | nep141:wrap.near |
| wNEAR | wNEAR | nep141:wrap.near |
| USDC | USDC | nep141:17208... |

### Cross-Chain (via 1Click)

| Chain | Assets |
|-------|--------|
| Ethereum | ETH, USDC, USDT |
| Solana | SOL, USDC, USDT |
| Arbitrum | ETH, ARB, USDC |
| Base | ETH, USDC |
| Optimism | ETH, OP, USDC |
| Polygon | POL, USDC |
| Bitcoin | BTC |

## Environment Variables

```bash
# Required for cross-chain swaps
NEAR_INTENTS_JWT=your_1click_jwt_token

# Optional
NEAR_RPC_URL=https://rpc.mainnet.near.org
NEAR_NETWORK=mainnet  # or testnet (note: 1Click is mainnet only)
```

## Important Notes

### NEAR Intents is Mainnet Only

The 1Click API operates on **mainnet only**. For testing:
- Use `dry: true` for quote-only mode (real quotes, no execution)
- Use small amounts ($5-10) for integration testing
- Use MockSolver for unit tests

### Implicit Account Funding

Stealth addresses on NEAR are implicit accounts. To claim:
1. Fund the implicit account with NEAR for gas
2. Or use a relayer service
3. Transfer tokens to main wallet

### Privacy Considerations

- Same privacy guarantees as Solana (ed25519)
- Cross-chain swaps break on-chain links between chains
- Viewing keys work across NEAR and Solana (same curve)

## Resources

- [NEAR Intents Documentation](https://docs.near.org/intents)
- [1Click API Reference](https://1click.chaindefuser.com/docs)
- [NEAR NEP-141 Token Standard](https://nomicon.io/Standards/Tokens/FungibleToken/Core)
- [SIP Protocol Documentation](https://docs.sip-protocol.org)

## License

MIT - SIP Protocol
