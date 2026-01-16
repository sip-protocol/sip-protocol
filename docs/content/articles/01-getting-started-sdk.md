# Getting Started with @sip-protocol/sdk

*A practical guide to adding privacy to your Solana application*

---

## Introduction

Every transaction on Solana is public. Your wallet address, the amounts you send, who you send to — all visible to anyone. For many applications, this is a deal-breaker.

The SIP Protocol SDK lets you add privacy to your Solana dApp with a few lines of code. In this guide, you'll learn the core concepts and build a working example.

**What you'll build:** A simple app that can receive private payments and claim them.

**Time:** ~30 minutes

**Prerequisites:**
- Basic TypeScript knowledge
- Familiarity with Solana development
- Node.js 18+

---

## Installation

```bash
npm install @sip-protocol/sdk
# or
pnpm add @sip-protocol/sdk
```

The SDK is tree-shakeable and works in Node.js and browser environments.

---

## Core Concept: Stealth Addresses

The foundation of SIP privacy is **stealth addresses**. Here's the key insight:

**Traditional:** You share one address. Every payment is publicly linked.

**With SIP:** You share a "meta-address." Each sender generates a unique one-time address. Payments can't be linked together.

Think of it like a P.O. Box that creates a new physical mailbox for each letter — only you know how to collect them all.

---

## Step 1: Generate Your Meta-Address

First, generate a stealth meta-address. This is what you share with people who want to pay you.

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

// Generate once, store securely
const metaAddress = generateStealthMetaAddress()

// This is your shareable address
const encoded = encodeStealthMetaAddress(metaAddress)
console.log('Share this address:', encoded)
// Output: sip:solana:0x02abc...123:0x03def...456
```

**Important:** Store these keys securely:
- `metaAddress.spendingKey.privateKey` — Required to spend funds (never expose)
- `metaAddress.viewingKey.privateKey` — Required to scan for payments (share with auditors only)

---

## Step 2: Create an RPC Provider

SIP needs to query the blockchain to scan for payments. Create a provider:

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Using Helius (recommended for Solana)
const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
  cluster: 'mainnet-beta', // or 'devnet' for testing
})

// Alternative: generic RPC
const genericProvider = createProvider('generic', {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
})
```

Get a free Helius API key at [dev.helius.xyz](https://dev.helius.xyz).

---

## Step 3: Scan for Incoming Payments

Periodically scan for payments addressed to your meta-address:

```typescript
import { scanForPayments } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  provider,
  viewingPrivateKey: metaAddress.viewingKey.privateKey,
  spendingPublicKey: metaAddress.spendingKey.publicKey,
  // Optional: start from specific slot
  fromSlot: 250000000,
})

console.log(`Found ${payments.length} payments`)

for (const payment of payments) {
  console.log(`- ${payment.amount} ${payment.token}`)
  console.log(`  TX: ${payment.signature}`)
  console.log(`  Stealth address: ${payment.stealthAddress}`)
}
```

The scanning process:
1. Fetches transactions with SIP memo format
2. Tries to derive stealth addresses using your viewing key
3. Returns only payments that match your meta-address

---

## Step 4: Claim Payments

Each payment sits in a unique stealth address. To use the funds, claim them to your main wallet:

```typescript
import {
  claimStealthPayment,
  deriveStealthPrivateKey,
} from '@sip-protocol/sdk'

// Derive the private key for this specific payment
const stealthPrivateKey = deriveStealthPrivateKey(
  metaAddress.spendingKey.privateKey,
  payment.ephemeralPublicKey
)

// Claim to your main wallet
const result = await claimStealthPayment({
  provider,
  stealthPrivateKey,
  stealthAddress: payment.stealthAddress,
  destinationAddress: 'YourMainWalletAddress',
  tokenMint: payment.tokenMint,
  amount: payment.amount,
})

console.log('Claimed! TX:', result.signature)
```

---

## Complete Example

Here's a full working example:

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  scanForPayments,
  claimStealthPayment,
  deriveStealthPrivateKey,
  createProvider,
} from '@sip-protocol/sdk'

async function main() {
  // Setup
  const metaAddress = generateStealthMetaAddress()
  const provider = createProvider('helius', {
    apiKey: process.env.HELIUS_API_KEY!,
    cluster: 'devnet',
  })

  // Display receiving address
  const receiveAddress = encodeStealthMetaAddress(metaAddress)
  console.log('📬 Your private receiving address:')
  console.log(receiveAddress)
  console.log('')

  // Scan for payments
  console.log('🔍 Scanning for payments...')
  const payments = await scanForPayments({
    provider,
    viewingPrivateKey: metaAddress.viewingKey.privateKey,
    spendingPublicKey: metaAddress.spendingKey.publicKey,
  })

  if (payments.length === 0) {
    console.log('No payments found yet.')
    return
  }

  console.log(`Found ${payments.length} payments:`)

  // Claim each payment
  const mainWallet = process.env.MAIN_WALLET!

  for (const payment of payments) {
    console.log(`\n💰 Claiming ${payment.amount} ${payment.token}...`)

    const stealthKey = deriveStealthPrivateKey(
      metaAddress.spendingKey.privateKey,
      payment.ephemeralPublicKey
    )

    const result = await claimStealthPayment({
      provider,
      stealthPrivateKey: stealthKey,
      stealthAddress: payment.stealthAddress,
      destinationAddress: mainWallet,
      tokenMint: payment.tokenMint,
      amount: payment.amount,
    })

    console.log(`✅ Claimed! TX: ${result.signature}`)
  }
}

main().catch(console.error)
```

---

## Sending Private Payments

To send to someone else's meta-address:

```typescript
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
  sendPrivateSPLTransfer,
} from '@sip-protocol/sdk'

async function sendPrivate(
  recipientMetaAddress: string,
  amount: bigint,
  tokenMint: string
) {
  // Parse recipient's meta-address
  const recipientMeta = decodeStealthMetaAddress(recipientMetaAddress)

  // Generate one-time stealth address
  const stealth = generateStealthAddress(recipientMeta)

  // Send the payment
  const result = await sendPrivateSPLTransfer({
    provider,
    senderPublicKey: 'YourWalletAddress',
    stealthAddress: stealth.stealthAddress,
    ephemeralPublicKey: stealth.ephemeralPublicKey,
    amount,
    tokenMint,
    signTransaction, // From your wallet adapter
  })

  return result
}

// Usage
await sendPrivate(
  'sip:solana:0x02abc...', // Recipient's meta-address
  1_000_000n, // 1 USDC (6 decimals)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mint
)
```

---

## Key Security Tips

1. **Never expose spending keys** — Store in secure enclave or encrypted storage
2. **Viewing keys are read-only** — Safe to share with auditors
3. **Use secureWipe()** — Clear sensitive data from memory after use
4. **Backup both keys** — Losing keys = losing access to funds
5. **Test on devnet first** — Always test before mainnet

```typescript
import { secureWipe } from '@sip-protocol/sdk'

// After you're done with a key
secureWipe(sensitiveBuffer)
```

---

## Next Steps

You now understand the basics of SIP:
- Generating stealth meta-addresses
- Scanning for payments
- Claiming to your wallet
- Sending private payments

**Continue learning:**
- [Adding Privacy to Your Solana dApp](./02-privacy-dapp.md) — UI integration patterns
- [Implementing Viewing Keys](./03-viewing-keys-compliance.md) — Compliance features
- [API Reference](https://docs.sip-protocol.org/api) — Full SDK documentation

**Get help:**
- [Discord](https://discord.gg/sip-protocol)
- [GitHub Issues](https://github.com/sip-protocol/sip-protocol/issues)

---

*Published by SIP Protocol | The Privacy Standard for Web3*
