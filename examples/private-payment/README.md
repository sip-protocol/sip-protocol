# Private Payment Example

Send and receive private payments using SIP Protocol's stealth addresses.

## What This Example Demonstrates

1. **Generate Stealth Meta-Address** - Create a reusable address for receiving private payments
2. **Send Private Payment** - Create a one-time stealth address for a payment
3. **Scan for Payments** - Recipient scans for incoming private payments
4. **Claim Funds** - Derive the private key to claim received funds

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the example
npx ts-node index.ts
```

## How It Works

### Stealth Address Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ RECIPIENT                                                        │
│                                                                  │
│  1. Generate Stealth Meta-Address                               │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ spending_key (P)     viewing_key (Q)                    │ │
│     │ Publish: sip:ethereum:0x02abc...:0x03def...             │ │
│     └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SENDER                                                           │
│                                                                  │
│  2. Generate One-Time Stealth Address                           │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ ephemeral keypair (r, R)                                │ │
│     │ shared_secret = r * P                                   │ │
│     │ stealth_address = Q + hash(shared_secret) * G           │ │
│     │                                                          │ │
│     │ Publish: R (ephemeral public key)                       │ │
│     │ Send funds to: stealth_address                          │ │
│     └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ RECIPIENT                                                        │
│                                                                  │
│  3. Scan for Payments                                           │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ For each published R:                                   │ │
│     │   shared_secret = p * R (using spending private key)    │ │
│     │   expected_address = Q + hash(shared_secret) * G        │ │
│     │   if expected_address == published_address:             │ │
│     │     → Payment found!                                    │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
│  4. Claim Funds                                                 │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ stealth_private_key = q + hash(shared_secret) mod n     │ │
│     │ → Use this key to sign transactions from stealth_addr   │ │
│     └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Privacy Properties

| Property | Guarantee |
|----------|-----------|
| **Unlinkability** | Each payment uses a unique address |
| **Sender Privacy** | Sender identity not revealed to observers |
| **Recipient Privacy** | Recipient's main address never appears on-chain |
| **Amount Privacy** | Combine with Pedersen commitments for hidden amounts |

## Code Walkthrough

### 1. Generate Stealth Meta-Address

```typescript
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('ethereum', 'My Wallet')

// Share this publicly - anyone can use it to send you private payments
const encoded = encodeStealthMetaAddress(metaAddress)
// sip:ethereum:0x02abc...:0x03def...
```

### 2. Send Private Payment

```typescript
const { stealthAddress, sharedSecret } = generateStealthAddress(metaAddress)

// Send funds to: stealthAddress.address
// Publish: stealthAddress.ephemeralPublicKey (so recipient can find it)
```

### 3. Scan for Payments

```typescript
// View-only scan: viewing PRIVATE key + spending PUBLIC key (EIP-5564)
const isOurs = checkStealthAddress(
  stealthAddress,
  viewingPrivateKey,
  metaAddress.spendingKey
)

if (isOurs) {
  console.log('Payment found!')
}
```

### 4. Claim Funds

```typescript
const recovery = deriveStealthPrivateKey(
  stealthAddress,
  spendingPrivateKey,
  viewingPrivateKey
)

// Use recovery.privateKey to sign transactions
```

## Cross-Chain Support

This example uses Ethereum (secp256k1). For Solana or NEAR:

```typescript
// Solana/NEAR use ed25519
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'

const { metaAddress } = generateEd25519StealthMetaAddress('solana')
const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
const solanaAddr = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
```

## Security Notes

1. **Keep private keys secure** - Never expose `spendingPrivateKey` or `viewingPrivateKey`
2. **Backup meta-address** - You need both private keys to recover funds
3. **View tag optimization** - The `viewTag` allows fast scanning (check 1 byte before full computation)

## Next Steps

- See `examples/compliance/` for adding viewing keys for auditors
- See `examples/private-swap/` for cross-chain swaps with privacy
- See `examples/wallet-integration/` for connecting to real wallets
