# Pedersen Commitments Explained: A Developer's Guide

*How to hide amounts while proving they're valid*

---

## Introduction

Pedersen commitments are a cryptographic primitive that lets you:

- **Hide a value** — Nobody can see the actual number
- **Bind to that value** — You can't change your mind later
- **Prove properties** — Demonstrate facts without revealing the value

Think of it like a sealed envelope containing a number. You can prove things about the number (it's positive, it's less than X) without opening the envelope.

This guide covers:
1. The math behind Pedersen commitments
2. Why they're secure (hiding and binding properties)
3. Homomorphic addition (the magic trick)
4. How SIP uses them for private transactions
5. Code examples you can use today

**Prerequisites:** Basic familiarity with elliptic curve cryptography helps, but we'll explain as we go.

---

## The Problem: Hidden But Verifiable Amounts

In a private transaction, we want:

```
Sender: "I'm sending 100 tokens"
Verifier: "Prove it adds up correctly"
Sender: "Here's proof the math works"
Verifier: "OK, approved" (still doesn't know it's 100)
```

This seems contradictory — how can you verify math you can't see?

Pedersen commitments make this possible.

---

## The Math: Elliptic Curve Points

First, some background on elliptic curves.

### Points and Scalars

An elliptic curve has **points** (P, Q, R...) that can be:
- Added together: `P + Q = R`
- Multiplied by a number (scalar): `5 * P = P + P + P + P + P`

The curve has a **generator point** `G` — a special starting point.

### The Key Property

Given `P = x * G`, it's computationally infeasible to find `x`.

This is the **discrete logarithm problem** — the foundation of elliptic curve security.

```
Easy:    x * G → P  (multiplication)
Hard:    P → x      (discrete log)
```

---

## Pedersen Commitment Construction

A Pedersen commitment uses **two** generator points: `G` and `H`.

### Setup

```
G = First generator point (publicly known)
H = Second generator point (publicly known)
   (H must be chosen so nobody knows the discrete log of H relative to G)
```

### Creating a Commitment

To commit to a value `v`:

1. Choose a random **blinding factor** `r`
2. Compute: `C = v * G + r * H`

```
┌─────────────────────────────────────────────────────────────┐
│  PEDERSEN COMMITMENT                                        │
│                                                             │
│  C = v * G + r * H                                          │
│                                                             │
│  Where:                                                     │
│    C = commitment (a point on the curve)                    │
│    v = value being hidden (e.g., 100 tokens)                │
│    r = random blinding factor                               │
│    G = first generator point                                │
│    H = second generator point                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Example

```typescript
// Conceptual (not real code)
const v = 100n          // Value to hide
const r = randomScalar() // Random blinding factor

const C = add(
  multiply(G, v),  // v * G
  multiply(H, r)   // r * H
)

// C is the commitment — publish this
// Keep v and r secret to later "open" the commitment
```

---

## Security Properties

Pedersen commitments have two crucial properties:

### 1. Hiding Property

**Given only C, an attacker cannot determine v.**

Why? Because of the blinding factor `r`:
- `C = 100 * G + r1 * H` could also equal
- `C = 50 * G + r2 * H` (for different r2)
- `C = 200 * G + r3 * H` (for different r3)

Without knowing `r`, every value is equally plausible.

This is called **perfect hiding** — even with infinite computing power, the value is hidden.

### 2. Binding Property

**Once committed, you cannot produce a different (v', r') that gives the same C.**

If you could find `v' ≠ v` and `r' ≠ r` such that:
```
v * G + r * H = v' * G + r' * H
```

Then:
```
(v - v') * G = (r' - r) * H
G = ((r' - r) / (v - v')) * H
```

This would mean you found the discrete log of H with respect to G — computationally infeasible.

This is called **computational binding** — with bounded computing power, you're bound to your commitment.

---

## The Magic: Homomorphic Addition

Here's where Pedersen commitments become truly powerful.

### Adding Commitments

If you have two commitments:
```
C1 = v1 * G + r1 * H
C2 = v2 * G + r2 * H
```

Adding them:
```
C1 + C2 = (v1 * G + r1 * H) + (v2 * G + r2 * H)
        = (v1 + v2) * G + (r1 + r2) * H
```

**The sum of commitments equals the commitment of sums!**

```
┌─────────────────────────────────────────────────────────────┐
│  HOMOMORPHIC ADDITION                                       │
│                                                             │
│  C1 = commit(v1, r1)                                        │
│  C2 = commit(v2, r2)                                        │
│                                                             │
│  C1 + C2 = commit(v1 + v2, r1 + r2)                        │
│                                                             │
│  You can add commitments without knowing the values!        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Transaction Verification

This enables private transaction verification:

```
Transaction:
  Input:  C_in = commit(100, r_in)   // 100 tokens input
  Output: C_out = commit(100, r_out) // 100 tokens output

Verification:
  C_in - C_out should equal commit(0, r_diff)

  If true → values balance (input = output)
  If false → invalid transaction
```

We verify the transaction balances **without knowing the amounts**!

---

## SIP SDK Implementation

Let's see how SIP uses Pedersen commitments.

### Creating a Commitment

```typescript
import { createCommitment, verifyCommitment } from '@sip-protocol/sdk'

// Create a commitment to 100 tokens (in smallest unit)
const amount = 100_000_000_000n // 100 tokens with 9 decimals

const commitment = createCommitment(amount)

console.log('Commitment:', commitment.value)
// Output: 0x02a3b4c5... (compressed point, 33 bytes)

console.log('Blinding factor:', commitment.blindingFactor)
// Output: 0x1a2b3c4d... (keep this secret!)
```

### Opening a Commitment

```typescript
import { openCommitment } from '@sip-protocol/sdk'

// Later, prove your commitment contained 100 tokens
const isValid = openCommitment(
  commitment.value,      // The published commitment
  100_000_000_000n,      // The value you claim
  commitment.blindingFactor // Your secret blinding factor
)

console.log('Valid opening:', isValid) // true
```

### Verifying Transaction Balance

```typescript
import {
  createCommitment,
  sumCommitments,
  verifyBalance,
} from '@sip-protocol/sdk'

// Transaction: 100 tokens in, 60 to recipient, 40 change

// Input
const inputCommitment = createCommitment(100_000_000_000n)

// Outputs
const outputToRecipient = createCommitment(60_000_000_000n)
const outputChange = createCommitment(40_000_000_000n)

// Verify: inputs = outputs (in commitment space)
const outputSum = sumCommitments([
  outputToRecipient.value,
  outputChange.value,
])

const balances = verifyBalance(
  [inputCommitment.value],  // Input commitments
  [outputSum],              // Output commitment sum
  // Blinding factor difference (computed internally)
)

console.log('Transaction balances:', balances) // true
```

---

## Range Proofs: Preventing Negative Amounts

There's a catch with Pedersen commitments.

### The Problem

Commitments work modulo the curve order. This means:
- `commit(100)` is valid
- `commit(-1)` is also valid (wraps to huge positive number)

A malicious user could create:
```
Input: commit(100)
Outputs: commit(200) + commit(-100)
Total: 200 - 100 = 100 ✓ (balances!)

But actually: -100 mod n = huge_positive_number
Result: Created tokens from nothing!
```

### The Solution: Range Proofs

**Range proofs** prove a committed value is within a valid range (e.g., 0 to 2^64) without revealing the value.

```typescript
import { createCommitmentWithRangeProof } from '@sip-protocol/sdk'

const commitment = createCommitmentWithRangeProof(
  100_000_000_000n,
  { range: [0n, 2n ** 64n] } // Prove value is in this range
)

console.log('Commitment:', commitment.value)
console.log('Range proof:', commitment.rangeProof)
// Proof that value ≥ 0 and value < 2^64
```

SIP includes Bulletproofs for efficient range proofs.

---

## Under the Hood: The Crypto

For those curious about the implementation:

### Generator Point Selection

```typescript
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'

// G is the standard generator
const G = secp256k1.ProjectivePoint.BASE

// H is derived via hash-to-curve (nothing-up-my-sleeve)
const H = hashToCurve(sha256('SIP-Pedersen-H'))
// Nobody knows x such that H = x * G
```

### Commitment Creation

```typescript
function createCommitment(value: bigint): Commitment {
  // Generate random blinding factor
  const r = secp256k1.utils.randomPrivateKey()
  const rBigInt = bytesToBigInt(r)

  // C = v * G + r * H
  const vG = G.multiply(value)
  const rH = H.multiply(rBigInt)
  const C = vG.add(rH)

  return {
    value: C.toHex(true),          // Compressed point
    blindingFactor: bytesToHex(r), // Keep secret
  }
}
```

### Commitment Addition

```typescript
function sumCommitments(commitments: string[]): string {
  let sum = secp256k1.ProjectivePoint.ZERO

  for (const c of commitments) {
    const point = secp256k1.ProjectivePoint.fromHex(c)
    sum = sum.add(point)
  }

  return sum.toHex(true)
}
```

---

## Practical Considerations

### Blinding Factor Management

The blinding factor is critical:
- **Lost:** You can never prove the commitment value
- **Leaked:** Privacy compromised

```typescript
// Store blinding factors securely
import { secureStore, secureWipe } from '@sip-protocol/sdk'

const commitment = createCommitment(amount)

// Store encrypted
await secureStore(commitment.blindingFactor, encryptionKey)

// Clear from memory when done
secureWipe(commitment.blindingFactor)
```

### Batch Verification

For efficiency, verify multiple commitments at once:

```typescript
import { batchVerifyCommitments } from '@sip-protocol/sdk'

const commitments = transactions.map(tx => tx.commitment)
const proofs = transactions.map(tx => tx.rangeProof)

const allValid = await batchVerifyCommitments(commitments, proofs)
// Faster than verifying one by one
```

### Commitment Size

A Pedersen commitment is a compressed elliptic curve point:
- **Size:** 33 bytes (compressed secp256k1)
- **Constant:** Always 33 bytes regardless of value

Compare to plaintext:
- `100` → 1-3 bytes
- But commitment gives privacy

---

## Use Cases in SIP

### 1. Hidden Transaction Amounts

```typescript
const intent = await sip.createIntent({
  input: { amount: 100_000_000_000n },
  output: { amount: 100_000_000_000n },
  privacy: PrivacyLevel.SHIELDED,
})

// On-chain: only commitments visible
// Amount 100_000_000_000 is hidden
```

### 2. Balance Proofs

```typescript
// Prove you have at least 50 tokens without revealing exact balance
const proof = await sip.proveMinimumBalance({
  commitment: myBalanceCommitment,
  minimum: 50_000_000_000n,
})
```

### 3. Confidential Transfers

```typescript
// Multi-output transaction with hidden amounts
const transfer = await sip.confidentialTransfer({
  inputs: [commitment1, commitment2],
  outputs: [
    { recipient: alice, amount: 30_000_000_000n },
    { recipient: bob, amount: 40_000_000_000n },
    { recipient: 'change', amount: 30_000_000_000n },
  ],
})

// Verifier confirms: sum(inputs) = sum(outputs)
// But doesn't learn any individual amount
```

---

## Summary

Pedersen commitments provide:

| Property | Description |
|----------|-------------|
| **Hiding** | Value is completely hidden |
| **Binding** | Can't change value after committing |
| **Homomorphic** | Can add/verify without revealing |
| **Compact** | Fixed 33-byte size |
| **Fast** | Elliptic curve operations |

They're the foundation for:
- Private transaction amounts
- Balance verification
- Zero-knowledge proofs
- Confidential assets

---

## Further Reading

- [Confidential Transactions (Maxwell)](https://www.elementsproject.org/elements/confidential-transactions/)
- [Bulletproofs Paper](https://eprint.iacr.org/2017/1066.pdf)
- [SIP SDK Crypto Module](https://docs.sip-protocol.org/api/crypto)
- [Noble Curves Library](https://github.com/paulmillr/noble-curves)

---

## Code Reference

Full implementation available in SIP SDK:
- `packages/sdk/src/crypto.ts` — Commitment creation and verification
- `packages/sdk/src/proofs/` — Range proof implementation
- `packages/sdk/tests/crypto.test.ts` — Comprehensive test suite

---

*Published by SIP Protocol | The Privacy Standard for Web3*
