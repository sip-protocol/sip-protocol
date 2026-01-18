# Solana Same-Chain Privacy Developer Guide

**Time to read: 15 minutes**

A comprehensive guide to implementing private transactions on Solana using SIP Protocol's stealth addresses. This guide covers native SOL and SPL token transfers with cryptographic privacy.

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Stealth Address Generation](#stealth-address-generation)
4. [Transaction Building](#transaction-building)
5. [Payment Detection (Scanning)](#payment-detection-scanning)
6. [Claiming Funds](#claiming-funds)
7. [Provider Configuration](#provider-configuration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Solana Same-Chain Privacy?

Solana same-chain privacy enables private transactions where:
- **Recipient identity** is hidden using stealth addresses
- **Payment linkability** is broken - observers can't link payments to the same recipient
- **Compliance** is maintained through viewing keys

### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SENDER                              BLOCKCHAIN              RECEIVER    │
│                                                                          │
│  1. Get recipient's meta-address ←───────────────────────── Share       │
│  2. Generate stealth address                                             │
│  3. Send SOL/tokens to stealth ──────────► Transaction                   │
│  4. Publish announcement ────────────────► Memo                          │
│                                                                          │
│                                      5. Scan announcements ──► Check    │
│                                      6. Identify owned payments          │
│                                      7. Derive claim key                 │
│                                      8. Transfer to main wallet          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Privacy Properties

| Property | Status | Notes |
|----------|--------|-------|
| Recipient privacy | ✅ Yes | One-time stealth addresses |
| Sender privacy | ⚠️ Partial | Sender address still visible |
| Amount privacy | ⚠️ Partial | Amount visible on-chain |
| Linkability | ✅ Broken | Payments can't be linked |

---

## Quick Start

### Installation

```bash
pnpm add @sip-protocol/sdk @solana/web3.js
```

### 5-Minute Example

```typescript
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  sendPrivateSOLTransfer,
  scanForSolanaPayments,
  createProvider,
} from '@sip-protocol/sdk'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'

// 1. Receiver: Generate stealth meta-address
const receiver = generateEd25519StealthMetaAddress('solana')
console.log('Share this with senders:', receiver.metaAddress)

// 2. Sender: Generate stealth address for payment
const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(
  receiver.metaAddress
)

// 3. Sender: Send SOL privately
const connection = new Connection('https://api.mainnet-beta.solana.com')
const sender = Keypair.generate() // Your funded wallet

const result = await sendPrivateSOLTransfer({
  connection,
  sender: sender.publicKey,
  recipientMetaAddress: receiver.metaAddress,
  amount: BigInt(0.1 * LAMPORTS_PER_SOL), // 0.1 SOL
  signTransaction: async (tx) => {
    tx.sign(sender)
    return tx
  },
})

console.log('Transaction:', result.signature)

// 4. Receiver: Scan for payments
const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
})

const payments = await scanForSolanaPayments({
  provider,
  viewingPrivateKey: receiver.viewingPrivateKey,
  spendingPublicKey: receiver.metaAddress.spendingKey,
})

console.log(`Found ${payments.length} payments`)
```

---

## Stealth Address Generation

### Understanding the Keys

```typescript
import { generateEd25519StealthMetaAddress } from '@sip-protocol/sdk'

const {
  metaAddress,        // Public: share with senders
  spendingPrivateKey, // Secret: needed to spend funds
  viewingPrivateKey,  // Secret: needed to scan for payments
} = generateEd25519StealthMetaAddress('solana')
```

| Key | Purpose | Share? | Backup? |
|-----|---------|--------|---------|
| `metaAddress` | Receiving address to share | Yes - give to payers | Optional |
| `spendingPrivateKey` | Claim received funds | Never | **Critical** |
| `viewingPrivateKey` | Scan for payments | Auditors only | **Critical** |

### Encoding for Sharing

```typescript
import {
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '@sip-protocol/sdk'

// Encode to shareable string
const encoded = encodeStealthMetaAddress(metaAddress)
// Output: sip:solana:0x02abc...123:0x03def...456

// Decode from string
const decoded = decodeStealthMetaAddress(encoded)
console.log(decoded.chain) // 'solana'
```

### Generating for a Specific Recipient

```typescript
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'

// Sender generates stealth address from recipient's meta-address
const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(
  recipientMetaAddress
)

// Convert to Solana base58 address
const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
console.log('Send to:', solanaAddress) // 7xyz...ABC (base58)
```

---

## Transaction Building

### Option 1: High-Level Transfer Functions

The simplest approach using integrated functions:

#### SOL Transfer

```typescript
import { sendPrivateSOLTransfer } from '@sip-protocol/sdk'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const connection = new Connection(process.env.SOLANA_RPC_URL)

const result = await sendPrivateSOLTransfer({
  connection,
  sender: senderPublicKey,
  recipientMetaAddress,
  amount: BigInt(1 * LAMPORTS_PER_SOL), // 1 SOL
  signTransaction: async (tx) => {
    // Sign with your wallet adapter
    return await wallet.signTransaction(tx)
  },
  // Optional parameters
  priorityLevel: 'medium',       // 'low' | 'medium' | 'high'
  commitment: 'confirmed',
  customMemo: 'Payment #123',    // Additional memo (encrypted)
})

console.log('Signature:', result.signature)
console.log('Stealth Address:', result.stealthAddress)
console.log('Explorer:', result.explorerUrl)
```

#### SPL Token Transfer

```typescript
import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'
import { PublicKey } from '@solana/web3.js'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

const result = await sendPrivateSPLTransfer({
  connection,
  sender: senderPublicKey,
  recipientMetaAddress,
  mint: USDC_MINT,
  amount: 100_000_000n,           // 100 USDC (6 decimals)
  signTransaction,
  // Optional
  senderTokenAccount: undefined,  // Auto-detected if not provided
  skipBalanceCheck: false,
})
```

### Option 2: Transaction Builder (Lower-Level)

For more control over transaction construction:

```typescript
import { createTransactionBuilder } from '@sip-protocol/sdk'

const builder = createTransactionBuilder({
  connection,
  feePayer: senderPublicKey,
  priorityLevel: 'high',
})

// Build SOL transfer
const { transaction, stealthAddress } = await builder.buildSOLTransfer({
  sender: senderPublicKey,
  recipientMetaAddress,
  amount: BigInt(LAMPORTS_PER_SOL),
})

// Or build SPL transfer
const { transaction: splTx } = await builder.buildSPLTransfer({
  mint: USDC_MINT,
  sourceAccount: senderTokenAccount,
  owner: senderPublicKey,
  recipientMetaAddress,
  amount: 50_000_000n, // 50 USDC
})

// Sign and send manually
const signed = await wallet.signTransaction(transaction)
const signature = await connection.sendRawTransaction(signed.serialize())
```

### Announcement Memos

Every private transfer includes an announcement memo for recipient scanning:

```typescript
import { createAnnouncementMemo, parseAnnouncement } from '@sip-protocol/sdk'

// Create memo (done automatically by transfer functions)
const memo = createAnnouncementMemo(
  ephemeralPublicKey,  // From stealth address generation
  viewTagHex,          // First byte for fast filtering
  stealthAddress       // Optional: include stealth address
)
// Output: "SIP:1:7xyz...ABC:0a:9abc...DEF"

// Parse announcement from transaction
const parsed = parseAnnouncement(memo)
console.log(parsed.ephemeralPublicKey)
console.log(parsed.viewTag)
```

---

## Payment Detection (Scanning)

### Using RPC Providers

SIP supports multiple Solana RPC providers:

```typescript
import {
  createProvider,
  scanForSolanaPayments,
} from '@sip-protocol/sdk'

// Helius (recommended)
const heliusProvider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
  cluster: 'mainnet-beta',
})

// QuickNode
const quicknodeProvider = createProvider('quicknode', {
  endpoint: process.env.QUICKNODE_ENDPOINT,
})

// Triton
const tritonProvider = createProvider('triton', {
  apiKey: process.env.TRITON_API_KEY,
  projectId: process.env.TRITON_PROJECT_ID,
})

// Generic RPC
const genericProvider = createProvider('generic', {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
})
```

### Scanning for Payments

```typescript
const payments = await scanForSolanaPayments({
  provider,
  viewingPrivateKey: myMeta.viewingPrivateKey,
  spendingPublicKey: myMeta.metaAddress.spendingKey,

  // Optional filters
  fromSlot: 250000000,           // Start from specific slot
  toSlot: 251000000,             // End at specific slot
  tokenMint: USDC_MINT,          // Only scan for specific token
  includeSOL: true,              // Include native SOL
  includeSPL: true,              // Include SPL tokens
})

for (const payment of payments) {
  console.log(`
    Amount: ${payment.amount}
    Token: ${payment.tokenMint || 'SOL'}
    Stealth Address: ${payment.stealthAddress}
    Slot: ${payment.slot}
    Signature: ${payment.signature}
    Claimed: ${payment.claimed}
  `)
}
```

### View Tag Optimization

View tags enable fast filtering (256x speedup):

```typescript
import { checkEd25519StealthAddress } from '@sip-protocol/sdk'

// Quick check using view tag (99.6% rejection rate)
const matches = checkEd25519StealthAddress(
  stealthAddressData,
  spendingPublicKey,
  viewingPrivateKey
)

if (matches) {
  // Full cryptographic verification only for potential matches
  const claimKey = deriveEd25519StealthPrivateKey(...)
}
```

### Real-Time Monitoring (Webhooks)

For production, use webhooks instead of polling:

```typescript
// Helius webhooks
const webhook = await heliusProvider.createWebhook({
  accountAddresses: [ANNOUNCEMENT_PROGRAM_ID],
  webhookURL: 'https://your-server.com/payments',
  transactionTypes: ['TRANSFER'],
})

// In your webhook handler
app.post('/payments', async (req, res) => {
  const { transactions } = req.body

  for (const tx of transactions) {
    const announcement = parseAnnouncementFromTransaction(tx)
    if (isMyPayment(announcement)) {
      await notifyUser(announcement)
    }
  }

  res.sendStatus(200)
})
```

---

## Claiming Funds

### Derive Claim Key

```typescript
import {
  deriveEd25519StealthPrivateKey,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import { Keypair } from '@solana/web3.js'

// From a detected payment
const { privateKey: stealthPrivateKey } = deriveEd25519StealthPrivateKey(
  payment.stealthAddressData,
  spendingPrivateKey,
  viewingPrivateKey
)

// Convert to Solana Keypair
const claimKeypair = Keypair.fromSecretKey(
  Buffer.from(stealthPrivateKey.slice(2), 'hex')
)

console.log('Claim from:', claimKeypair.publicKey.toBase58())
```

### Transfer to Main Wallet

```typescript
import {
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'

// SOL claim
const claimTx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: claimKeypair.publicKey,
    toPubkey: mainWalletPublicKey,
    lamports: payment.amount - 5000n, // Leave some for fees
  })
)

const signature = await sendAndConfirmTransaction(
  connection,
  claimTx,
  [claimKeypair]
)

// SPL token claim
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

const stealthATA = await getAssociatedTokenAddress(
  tokenMint,
  claimKeypair.publicKey
)
const destinationATA = await getAssociatedTokenAddress(
  tokenMint,
  mainWalletPublicKey
)

const tokenClaimTx = new Transaction().add(
  createTransferInstruction(
    stealthATA,
    destinationATA,
    claimKeypair.publicKey,
    payment.amount
  )
)
```

---

## Provider Configuration

### Helius (Recommended for Production)

```typescript
const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
  cluster: 'mainnet-beta',        // or 'devnet'
  rateLimitRPS: 50,               // Requests per second
  enableCompression: true,        // DAS API compression
})

// Features:
// - Enhanced transaction parsing
// - Real-time webhooks
// - DAS (Digital Asset Standard) API
// - Priority fee estimation
```

### QuickNode (High Performance)

```typescript
const provider = createProvider('quicknode', {
  endpoint: process.env.QUICKNODE_ENDPOINT,
  cluster: 'mainnet-beta',
  useGRPC: true,                  // gRPC for streaming
})

// Features:
// - gRPC streaming subscriptions
// - Global edge network
// - Advanced caching
```

### Triton (Enterprise)

```typescript
const provider = createProvider('triton', {
  apiKey: process.env.TRITON_API_KEY,
  projectId: process.env.TRITON_PROJECT_ID,
  region: 'us-east',              // Data locality
})

// Features:
// - Dedicated infrastructure
// - Custom SLAs
// - gRPC support
```

### Generic RPC (Self-Hosted)

```typescript
const provider = createProvider('generic', {
  rpcUrl: 'https://your-rpc.com',
  wsUrl: 'wss://your-rpc.com',    // Optional: WebSocket
})

// Features:
// - No vendor lock-in
// - Works with any Solana RPC
// - Minimal dependencies
```

---

## Best Practices

### 1. Key Management

```typescript
// DO: Encrypt keys at rest
import { encryptKeys, decryptKeys } from './your-crypto-utils'

const encryptedKeys = await encryptKeys({
  spendingPrivateKey,
  viewingPrivateKey,
}, userPassword)

// Store encryptedKeys in secure storage
localStorage.setItem('sip_keys', JSON.stringify(encryptedKeys))

// DO: Derive from wallet signature for convenience
import { deriveKeysFromSignature } from '@sip-protocol/sdk'

const keys = await deriveKeysFromSignature({
  wallet,
  domain: 'your-app.com',
  message: 'Generate SIP keys',
})

// DON'T: Store raw keys in localStorage
// DON'T: Log keys to console in production
// DON'T: Transmit keys over unencrypted channels
```

### 2. Scanning Strategy

```typescript
// DO: Checkpoint scanning progress
let lastScannedSlot = await db.get('lastScannedSlot') || 0

const payments = await scanForSolanaPayments({
  provider,
  viewingPrivateKey,
  spendingPublicKey,
  fromSlot: lastScannedSlot + 1,
})

await db.set('lastScannedSlot', currentSlot)

// DO: Use webhooks for real-time
// DON'T: Scan from slot 0 every time
// DON'T: Poll rapidly (use 10-30 second intervals)
```

### 3. Transaction Building

```typescript
// DO: Validate before sending
import { validateSOLTransfer, validateTransfer } from '@sip-protocol/sdk'

const validation = await validateSOLTransfer({
  connection,
  sender,
  recipientMetaAddress,
  amount,
})

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
  return
}

// DO: Use appropriate priority fees
const { transaction } = await builder.buildSOLTransfer({
  ...params,
  priorityLevel: 'high', // For time-sensitive transfers
})

// DON'T: Hardcode fees
// DON'T: Skip validation
```

### 4. Claiming Strategy

```typescript
// DO: Batch claims to save fees
const claimBatch = async (payments: Payment[]) => {
  const tx = new Transaction()

  for (const payment of payments) {
    const claimKey = deriveEd25519StealthPrivateKey(...)
    tx.add(/* transfer instruction */)
  }

  return sendAndConfirmTransaction(connection, tx, signers)
}

// DO: Add random delays to prevent timing analysis
const randomDelay = Math.random() * 60000 // 0-60 seconds
await sleep(randomDelay)
await claimPayment(payment)

// DON'T: Claim immediately after receiving
// DON'T: Claim to same address pattern
```

---

## Troubleshooting

### Common Issues

#### "Transaction simulation failed"

```typescript
// Check: Sufficient SOL for rent and fees
const balance = await connection.getBalance(sender)
const requiredRent = await connection.getMinimumBalanceForRentExemption(0)
const estimatedFee = 5000 // ~0.000005 SOL

if (balance < amount + requiredRent + estimatedFee) {
  console.error('Insufficient balance')
}

// Check: Valid recipient meta-address
if (recipientMetaAddress.chain !== 'solana') {
  console.error('Invalid chain in meta-address')
}
```

#### "Payment not found during scan"

```typescript
// Check: Correct scanning window
const currentSlot = await connection.getSlot()
const payments = await scanForSolanaPayments({
  fromSlot: currentSlot - 1000, // Scan last 1000 slots
})

// Check: Keys match
const meta = generateEd25519StealthMetaAddress('solana')
console.log('Scanning with:', meta.metaAddress.spendingKey)
// Must match the meta-address shared with sender

// Check: Transaction confirmed
const status = await connection.getSignatureStatus(txSignature)
console.log('Confirmation:', status?.confirmationStatus)
```

#### "Invalid claim key"

```typescript
// Check: Using correct private keys
const { privateKey } = deriveEd25519StealthPrivateKey(
  stealthAddressData,
  spendingPrivateKey,  // Must be YOUR spending key
  viewingPrivateKey    // Must be YOUR viewing key
)

// Check: Stealth address data matches
console.log('Expected:', stealthAddressData.address)
console.log('Derived:', ed25519PublicKeyToSolanaAddress(derivedPublicKey))
```

### Debug Mode

```typescript
import { setLogLevel } from '@sip-protocol/sdk'

// Enable verbose logging
setLogLevel('debug')

// Now all operations will log details
const result = await sendPrivateSOLTransfer({...})
// Logs: Key derivation, transaction building, signing, sending
```

### Getting Help

- **API Reference**: [docs.sip-protocol.org/api/solana](https://docs.sip-protocol.org/api/solana)
- **GitHub Issues**: [github.com/sip-protocol/sip-protocol/issues](https://github.com/sip-protocol/sip-protocol/issues)
- **Discord**: [discord.gg/sip-protocol](https://discord.gg/sip-protocol)

---

## Next Steps

- [Solana Privacy API Reference](./SOLANA-API-REFERENCE.md) — Complete API documentation
- [Performance Benchmarks](../benchmarks/PERFORMANCE.md) — Operation timing characteristics
- [Stealth Addresses Deep-Dive](../content/articles/04-stealth-addresses-solana.md) — Cryptographic details

---

*Built with SIP Protocol — The Privacy Standard for Web3*
