# Solana Privacy Integration Examples

Complete examples demonstrating SIP Protocol's Solana-specific privacy features.

## Overview

SIP Protocol provides native Solana privacy using **ed25519 stealth addresses** — the same curve Solana uses natively. This means:

- No cross-curve conversions
- Direct Solana PublicKey compatibility
- Native SPL token privacy

## Quick Start

```bash
# From repository root
pnpm install

# Run basic example
npx ts-node examples/solana-integration/01-basic-stealth-transfer.ts

# Run all examples
./examples/solana-integration/run-all.sh
```

## Examples

| File | Description |
|------|-------------|
| [01-basic-stealth-transfer.ts](./01-basic-stealth-transfer.ts) | Send SPL tokens to a stealth address |
| [02-scan-and-claim.ts](./02-scan-and-claim.ts) | Scan for payments and claim funds |
| [03-batch-transfer.ts](./03-batch-transfer.ts) | Send to multiple recipients efficiently |
| [04-viewing-key-disclosure.ts](./04-viewing-key-disclosure.ts) | Share viewing keys for compliance |
| [05-wallet-adapter-integration.ts](./05-wallet-adapter-integration.ts) | Integrate with Phantom, Solflare, etc. |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SENDER FLOW                                        │
│                                                                             │
│  1. Get recipient's stealth meta-address (published/shared)                 │
│  2. Generate one-time stealth address (ed25519)                             │
│  3. Send SPL tokens to stealth address                                      │
│  4. Emit announcement with ephemeral key via memo                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ON-CHAIN                                          │
│                                                                             │
│  - Stealth address appears as normal Solana address                         │
│  - SPL token transfer (no special program required)                         │
│  - Announcement stored in memo instruction                                   │
│  - Unlinkable to recipient's main address                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RECIPIENT FLOW                                      │
│                                                                             │
│  1. Scan announcements with viewing key                                     │
│  2. View tag optimization filters non-matching (fast)                       │
│  3. Full EC check confirms ownership                                        │
│  4. Derive private key to claim funds                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Stealth Meta-Address

The recipient publishes a reusable meta-address containing:
- **Spending Public Key**: Used to derive stealth addresses
- **Viewing Public Key**: Used for scanning and compliance

```typescript
import { generateStealthMetaAddress, encodeStealthMetaAddress } from '@sip-protocol/sdk'

// Generate once, share publicly
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('solana', 'My Wallet')

// Shareable format: sip:solana:0x<spending>:0x<viewing>
const encoded = encodeStealthMetaAddress(metaAddress)
console.log('Share this address:', encoded)
```

### One-Time Stealth Address

Each payment goes to a unique, unlinkable address:

```typescript
import { generateEd25519StealthAddress, ed25519PublicKeyToSolanaAddress } from '@sip-protocol/sdk'

const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)

// Convert to Solana base58 address
const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
// => "7xK9Ft3M..." (normal Solana address)
```

### Scanning & Claiming

Recipients scan for payments using their viewing key:

```typescript
import { scanForPayments, claimStealthPayment } from '@sip-protocol/sdk'

// Scan for incoming payments
const payments = await scanForPayments({
  connection,
  viewingPrivateKey,
  spendingPublicKey: metaAddress.spendingKey,
})

// Claim each payment
for (const payment of payments) {
  await claimStealthPayment({
    connection,
    stealthAddress: payment.stealthAddress,
    ephemeralPublicKey: payment.ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    destinationAddress: myWallet.toBase58(),
    mint: new PublicKey(payment.mint),
  })
}
```

## Privacy Features

| Feature | Description |
|---------|-------------|
| **Unlinkable Addresses** | Each payment uses a unique one-time address |
| **Sender Privacy** | No direct link between sender and recipient |
| **Amount Privacy** | Combined with Pedersen commitments (optional) |
| **Selective Disclosure** | Viewing keys allow auditor access |

## Devnet Testing

All examples use Solana devnet by default. To test:

1. Get devnet SOL: `solana airdrop 2`
2. Get devnet USDC: Visit [Circle's faucet](https://faucet.circle.com/)
3. Run examples with `CLUSTER=devnet`

## Token Support

SIP works with any SPL token:

```typescript
// USDC (devnet)
const USDC = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

// USDT (devnet)
const USDT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')

// Any SPL token
const CUSTOM_TOKEN = new PublicKey('YOUR_TOKEN_MINT')
```

## Provider Options

SIP supports multiple RPC providers for efficient scanning:

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Helius (recommended for production)
const helius = createProvider('helius', { apiKey: 'YOUR_KEY' })

// QuickNode
const quicknode = createProvider('quicknode', { endpoint: 'YOUR_ENDPOINT' })

// Generic RPC
const generic = createProvider('generic', { endpoint: 'https://api.devnet.solana.com' })

// Use with scan
const payments = await scanForPayments({
  connection,
  viewingPrivateKey,
  spendingPublicKey,
  provider: helius, // Optional: faster scanning
})
```

## Resources

- [SIP Protocol Documentation](https://docs.sip-protocol.org)
- [Solana Developer Docs](https://solana.com/docs)
- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)

## License

MIT - SIP Protocol
