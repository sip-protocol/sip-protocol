# Stealth Addresses on Solana: A Technical Deep-Dive

*Adapting EIP-5564 for Solana's ed25519 ecosystem*

---

## Introduction

Every transaction on Solana is public. Send USDC to a friend, and anyone can see:
- Your wallet address (the sender)
- Their wallet address (the recipient)
- The exact amount
- The timestamp

This linkability is a privacy nightmare. Once someone knows your address, they can track your entire financial history.

**Stealth addresses** solve this by generating a fresh, one-time address for every payment. The recipient can still claim funds, but observers can't link payments together.

This article covers:
1. The EIP-5564 stealth address standard
2. How we adapted it for Solana (ed25519)
3. Implementation details in the SIP SDK
4. Security considerations and trade-offs

**Prerequisites:** Basic cryptography knowledge, familiarity with elliptic curves.

---

## The Problem: Transaction Linkability

Traditional cryptocurrency payments create a permanent, public link:

```
Alice (0xAa1...) --[100 USDC]--> Bob (0xBb2...)
Alice (0xAa1...) --[50 USDC]---> Bob (0xBb2...)
Charlie (0xCc3...) --[200 USDC]--> Bob (0xBb2...)
```

Anyone can see that:
- Bob has received 350 USDC total
- Alice has paid Bob twice
- All of Bob's activity is linked to `0xBb2...`

This enables:
- **Balance tracking** — Know exactly how much Bob holds
- **Behavioral analysis** — Infer relationships, habits, timing
- **Front-running** — Anticipate and exploit Bob's trades
- **Social engineering** — Target high-value wallets

---

## The Solution: Stealth Addresses

With stealth addresses, each payment goes to a unique, unlinkable address:

```
Alice (0xAa1...) --[100 USDC]--> 0xSt1... (only Bob can claim)
Alice (0xAa1...) --[50 USDC]---> 0xSt2... (only Bob can claim)
Charlie (0xCc3...) --[200 USDC]--> 0xSt3... (only Bob can claim)
```

An observer sees three separate addresses receiving funds. They cannot tell:
- That these addresses belong to the same person
- That 0xSt1 and 0xSt2 have the same sender
- Bob's total balance across all stealth addresses

Only Bob, with his private keys, can identify and claim these payments.

---

## EIP-5564: The Standard

[EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) defines a standard for stealth addresses on Ethereum. The core protocol uses Diffie-Hellman key exchange:

### Key Components

1. **Stealth Meta-Address** — A public address Bob shares (contains two public keys)
2. **Ephemeral Key** — A random key Alice generates for each payment
3. **Stealth Address** — The one-time address derived from both
4. **View Tag** — An optimization hint for faster scanning

### The Math (secp256k1 version)

Bob publishes a stealth meta-address containing:
- **Spending public key** `K_spend = k_spend * G`
- **Viewing public key** `K_view = k_view * G`

Alice wants to send to Bob:

1. Generate ephemeral keypair: `r` (private), `R = r * G` (public)
2. Compute shared secret: `S = r * K_view`
3. Derive stealth private key material: `s = hash(S)`
4. Compute stealth address: `P_stealth = K_spend + s * G`

Bob scans for payments:

1. For each transaction with ephemeral key `R`:
2. Compute shared secret: `S' = k_view * R` (equals `S` by ECDH)
3. Derive: `s' = hash(S')`
4. Check if `P_stealth == K_spend + s' * G`
5. If match, derive spending key: `p_stealth = k_spend + s'`

---

## Adapting for Solana: The ed25519 Challenge

Solana uses ed25519 (Curve25519) instead of secp256k1. This presents challenges:

### Challenge 1: Key Addition

EIP-5564 requires adding public keys: `K_spend + s * G`

On secp256k1, this is straightforward point addition.

On ed25519, the situation is more nuanced:
- Native ed25519 doesn't support arbitrary key derivation
- Solana wallets use ed25519 for signatures
- We need a compatible approach

### Our Solution: Dual-Curve Architecture

SIP uses a **dual-curve approach**:

1. **secp256k1** for stealth address derivation (EIP-5564 compatible)
2. **ed25519** for Solana wallet signatures (native compatibility)

```
┌─────────────────────────────────────────────────────────────┐
│  PRIVACY LAYER (secp256k1)                                  │
│  • Stealth meta-address generation                          │
│  • Ephemeral key exchange                                   │
│  • Stealth address derivation                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ Deterministic derivation
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  WALLET LAYER (ed25519)                                     │
│  • Solana-compatible addresses                              │
│  • Native transaction signing                               │
│  • Wallet adapter integration                               │
└─────────────────────────────────────────────────────────────┘
```

The stealth derivation happens on secp256k1, then we deterministically derive a Solana-compatible ed25519 keypair from the result.

---

## SIP SDK Implementation

### Generating a Stealth Meta-Address

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

// Generate meta-address (secp256k1)
const metaAddress = generateStealthMetaAddress()

// Encode for sharing
const encoded = encodeStealthMetaAddress(metaAddress)
// Output: sip:solana:0x02abc...123:0x03def...456

// Store securely
const secrets = {
  spendingPrivateKey: metaAddress.spendingKey.privateKey,
  viewingPrivateKey: metaAddress.viewingKey.privateKey,
}
```

The meta-address contains two secp256k1 public keys:
- `spendingKey.publicKey` — Required to spend funds (33 bytes, compressed)
- `viewingKey.publicKey` — Required to scan for payments (33 bytes, compressed)

### Sending to a Stealth Address

```typescript
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
} from '@sip-protocol/sdk'

// Decode recipient's meta-address
const recipientMeta = decodeStealthMetaAddress(
  'sip:solana:0x02abc...123:0x03def...456'
)

// Generate one-time stealth address
const stealth = generateStealthAddress(recipientMeta)

console.log('Stealth address:', stealth.stealthAddress)
console.log('Ephemeral key:', stealth.ephemeralPublicKey)
console.log('View tag:', stealth.viewTag)

// The ephemeralPublicKey must be published with the transaction
// (typically in a memo or dedicated field)
```

### Under the Hood: Key Derivation

```typescript
// Simplified implementation (actual code in packages/sdk/src/stealth.ts)

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'

function generateStealthAddress(metaAddress: StealthMetaAddress) {
  // 1. Generate ephemeral keypair
  const ephemeralPrivate = secp256k1.utils.randomPrivateKey()
  const ephemeralPublic = secp256k1.getPublicKey(ephemeralPrivate)

  // 2. ECDH: shared secret = ephemeral_private * viewing_public
  const sharedSecret = secp256k1.getSharedSecret(
    ephemeralPrivate,
    metaAddress.viewingKey.publicKey
  )

  // 3. Hash shared secret to get scalar
  const scalar = sha256(sharedSecret)

  // 4. Derive stealth public key: spending_public + scalar * G
  const scalarPoint = secp256k1.ProjectivePoint.BASE.multiply(
    BigInt('0x' + bytesToHex(scalar))
  )
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(
    metaAddress.spendingKey.publicKey
  )
  const stealthPoint = spendingPoint.add(scalarPoint)

  // 5. Compute view tag (first byte of hash for fast filtering)
  const viewTag = sha256(sharedSecret)[0]

  return {
    stealthAddress: stealthPoint.toHex(true),
    ephemeralPublicKey: bytesToHex(ephemeralPublic),
    viewTag,
  }
}
```

### Scanning for Payments

```typescript
import { scanForPayments } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  provider,
  viewingPrivateKey: metaAddress.viewingKey.privateKey,
  spendingPublicKey: metaAddress.spendingKey.publicKey,
  fromSlot: 250000000, // Optional: start slot
})

for (const payment of payments) {
  console.log(`Found: ${payment.amount} at ${payment.stealthAddress}`)
}
```

The scanning algorithm:

```typescript
// Simplified scanning logic

function checkPayment(
  ephemeralPublicKey: string,
  transactionStealthAddress: string,
  viewingPrivateKey: string,
  spendingPublicKey: string
): boolean {
  // 1. Compute shared secret: viewing_private * ephemeral_public
  const sharedSecret = secp256k1.getSharedSecret(
    viewingPrivateKey,
    ephemeralPublicKey
  )

  // 2. Derive expected stealth address
  const scalar = sha256(sharedSecret)
  const scalarPoint = secp256k1.ProjectivePoint.BASE.multiply(
    BigInt('0x' + bytesToHex(scalar))
  )
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(spendingPublicKey)
  const expectedStealth = spendingPoint.add(scalarPoint)

  // 3. Check if it matches
  return expectedStealth.toHex(true) === transactionStealthAddress
}
```

### Claiming Payments

```typescript
import {
  deriveStealthPrivateKey,
  claimStealthPayment,
} from '@sip-protocol/sdk'

// Derive the spending key for this specific payment
const stealthPrivateKey = deriveStealthPrivateKey(
  metaAddress.spendingKey.privateKey,
  payment.ephemeralPublicKey
)

// Claim to main wallet
const result = await claimStealthPayment({
  provider,
  stealthPrivateKey,
  stealthAddress: payment.stealthAddress,
  destinationAddress: mainWallet,
  tokenMint: payment.tokenMint,
  amount: payment.amount,
})
```

The key derivation:

```typescript
function deriveStealthPrivateKey(
  spendingPrivateKey: string,
  ephemeralPublicKey: string
): string {
  // 1. Compute shared secret (same as sender computed)
  const sharedSecret = secp256k1.getSharedSecret(
    spendingPrivateKey, // Using spending key for derivation
    ephemeralPublicKey
  )

  // 2. Derive scalar
  const scalar = sha256(sharedSecret)

  // 3. Stealth private key = spending_private + scalar
  const spendingBigInt = BigInt('0x' + spendingPrivateKey)
  const scalarBigInt = BigInt('0x' + bytesToHex(scalar))
  const stealthBigInt = (spendingBigInt + scalarBigInt) % secp256k1.CURVE.n

  return stealthBigInt.toString(16).padStart(64, '0')
}
```

---

## View Tags: Scanning Optimization

Without optimization, scanning is O(n) — you must check every transaction.

**View tags** provide a fast filter. The first byte of `hash(shared_secret)` is included in the transaction. Receivers can quickly discard 255/256 (~99.6%) of transactions without full ECDH computation.

```typescript
// Optimized scanning with view tags

function quickFilter(viewTag: number, ...): boolean {
  // First: cheap hash comparison
  const expectedViewTag = sha256(sharedSecret)[0]
  if (viewTag !== expectedViewTag) {
    return false // Skip 99.6% of transactions
  }

  // Only compute full derivation for matching view tags
  return fullDerivationCheck(...)
}
```

This reduces scanning time significantly for wallets with many transactions.

---

## Security Considerations

### 1. Ephemeral Key Storage

The ephemeral public key must be published with the transaction. SIP uses the Solana memo program:

```typescript
// Transaction includes memo with ephemeral key
{
  programId: MEMO_PROGRAM_ID,
  data: Buffer.from(JSON.stringify({
    protocol: 'SIP',
    ephemeralKey: ephemeralPublicKey,
    viewTag: viewTag,
  })),
}
```

### 2. Key Separation

**Spending keys** and **viewing keys** serve different purposes:

| Key Type | Can See Payments | Can Spend Funds | Share With |
|----------|-----------------|-----------------|------------|
| Spending private | Yes | Yes | No one |
| Viewing private | Yes | No | Auditors only |
| Meta-address (public) | No | No | Anyone (to receive) |

This separation enables compliance: share viewing keys with auditors without risking funds.

### 3. Timing Analysis

Stealth addresses hide the recipient but not timing:

```
12:00 - Alice sends to stealth address
12:05 - Stealth address claims to Bob's wallet
```

An observer might correlate based on timing. Mitigations:
- **Delayed claiming** — Wait random intervals
- **Batched claiming** — Claim multiple at once
- **Decoy transactions** — Add noise

### 4. Amount Privacy

Stealth addresses hide recipients but not amounts. For full privacy, combine with:
- **Pedersen commitments** — Hide amounts
- **Range proofs** — Prove amount validity without revealing
- **Shielded pools** — Fixed denominations

SIP supports all three through `PrivacyLevel.SHIELDED`.

---

## The Stealth Meta-Address Format

SIP uses a URI format for stealth meta-addresses:

```
sip:<chain>:<spending-key>:<viewing-key>

Example:
sip:solana:0x02abc123...def456:0x03789abc...123def
```

Components:
- `sip:` — Protocol identifier
- `<chain>` — Target chain (`solana`, `ethereum`, etc.)
- `<spending-key>` — Compressed secp256k1 public key (33 bytes, hex)
- `<viewing-key>` — Compressed secp256k1 public key (33 bytes, hex)

Parsing:

```typescript
import { decodeStealthMetaAddress } from '@sip-protocol/sdk'

const meta = decodeStealthMetaAddress(
  'sip:solana:0x02abc...123:0x03def...456'
)

console.log(meta.chain)                    // 'solana'
console.log(meta.spendingKey.publicKey)    // '02abc...123'
console.log(meta.viewingKey.publicKey)     // '03def...456'
```

---

## Comparison: EIP-5564 vs SIP Implementation

| Aspect | EIP-5564 | SIP |
|--------|----------|-----|
| Curve | secp256k1 | secp256k1 (derivation) + ed25519 (signing) |
| Chain | Ethereum | Solana, Ethereum, cross-chain |
| Ephemeral storage | Transaction logs | Memo program |
| View tags | Optional | Required |
| Viewing keys | Single key | Derived keys (role-based) |
| Integration | Direct wallet | Provider abstraction |

---

## Performance Characteristics

### Key Generation
- Meta-address generation: ~2ms
- Stealth address generation: ~1ms
- Private key derivation: ~1ms

### Scanning
- Per-transaction check (with view tag): ~0.1ms
- Per-transaction check (full): ~2ms
- 10,000 transactions (view tag filtered): ~200ms
- 10,000 transactions (no filter): ~20s

### Recommendations
1. **Use view tags** — Always include for faster scanning
2. **Checkpoint slots** — Store last scanned slot, don't rescan
3. **Batch operations** — Scan in chunks of 100-1000
4. **Use webhooks** — Real-time notifications vs polling

---

## Future Directions

### 1. Native ed25519 Stealth Addresses

Research ongoing for direct ed25519 implementation without the secp256k1 bridge. Challenges:
- Key addition semantics differ
- Cofactor considerations
- Wallet compatibility

### 2. Recursive Stealth Addresses

Stealth addresses that can themselves be stealth meta-addresses:
- Generate stealth address
- That address can receive stealth payments
- Unlimited depth of privacy

### 3. Stealth NFTs

Applying stealth addresses to NFT ownership:
- Mint NFT to stealth address
- Owner can prove ownership without revealing wallet
- Transfer via new stealth address

---

## Summary

Stealth addresses bring recipient privacy to Solana:

- **EIP-5564** provides a proven standard
- **Dual-curve architecture** bridges secp256k1 and ed25519
- **View tags** enable efficient scanning
- **Viewing keys** support compliance requirements

SIP makes this accessible through a simple API:

```typescript
// Generate your private receiving address
const meta = generateStealthMetaAddress()

// Share with senders
const address = encodeStealthMetaAddress(meta)

// Scan for payments
const payments = await scanForPayments({ viewingPrivateKey, ... })

// Claim to your wallet
await claimStealthPayment({ stealthPrivateKey, ... })
```

Privacy on Solana is possible. Stealth addresses are the foundation.

---

## Further Reading

- [EIP-5564 Specification](https://eips.ethereum.org/EIPS/eip-5564)
- [SIP Protocol Documentation](https://docs.sip-protocol.org)
- [SDK API Reference](https://docs.sip-protocol.org/api)
- [Noble Curves Library](https://github.com/paulmillr/noble-curves)

---

## Code References

Full implementation available in the SIP SDK:
- `packages/sdk/src/stealth.ts` — Core stealth address logic
- `packages/sdk/src/crypto.ts` — Cryptographic primitives
- `packages/sdk/tests/stealth.test.ts` — Comprehensive test suite

---

*Published by SIP Protocol | The Privacy Standard for Web3*
