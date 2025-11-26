# Security Properties

## Overview

This document formally defines the security properties provided by the SIP protocol and provides arguments for why they hold.

## Property 1: Amount Privacy (Hiding)

### Definition

**Informally**: Given a commitment C, an adversary cannot determine the committed value v.

**Formally**: For any PPT adversary A and any two values v₀, v₁:

```
|Pr[A(commit(v₀)) = 1] - Pr[A(commit(v₁)) = 1]| ≤ negl(λ)
```

### Argument

1. Commitment is C = v·G + r·H where r is uniformly random
2. For any value v, the set {v·G + r·H : r ∈ Z_n} covers all curve points
3. Therefore, C reveals nothing about v (information-theoretic hiding)

### What Is Hidden

- Input amounts in intents
- Output amounts in fulfillments
- Account balances (when committed)
- Transfer amounts between parties

### What Is Revealed

- Number of inputs/outputs (metadata)
- Asset types (unless using mixing)
- Timing of transactions

## Property 2: Sender Unlinkability

### Definition

**Informally**: Given two transactions from the same sender, an adversary cannot link them.

**Formally**: For sender S creating transactions T₁, T₂:

```
Pr[A links T₁ to T₂ | T₁ from S, T₂ from S] ≤ 1/|anonymity_set| + negl(λ)
```

### Argument

1. Each transaction uses fresh stealth address
2. Stealth addresses are derived from random ephemeral keys
3. Without viewing key, addresses appear uniformly random
4. No common identifier across transactions

### Anonymity Set Analysis

| Scenario | Anonymity Set | Notes |
|----------|--------------|-------|
| Single asset, single chain | All users of that asset | Best case |
| Rare asset | Small | Consider mixing |
| Unique amount pattern | Reduced | Use standard amounts |
| Timing correlation | Reduced | Add random delays |

### Limitations

- If adversary controls recipient, they learn sender identity for that tx
- Timing patterns can reduce anonymity
- Unique amount patterns can be fingerprinted

## Property 3: Recipient Unlinkability

### Definition

**Informally**: Given stealth addresses A₁, A₂ for the same recipient, an adversary cannot link them.

**Formally**: For recipient R with meta-address M:

```
A₁ = deriveStealthAddress(M, r₁)
A₂ = deriveStealthAddress(M, r₂)

For any PPT adversary A:
Pr[A(A₁, A₂) = "same recipient"] ≤ negl(λ)
```

### Argument

1. Each stealth address uses independent random ephemeral key
2. A₁ = K_spend + H(r₁·K_view)·G
3. A₂ = K_spend + H(r₂·K_view)·G
4. Without K_view, H(r₁·K_view) and H(r₂·K_view) appear independent
5. Therefore A₁ and A₂ are computationally unrelated

### View Tag Leakage

The view tag reveals 8 bits of H(shared_secret):
- Probability two addresses share view tag: 1/256
- Not a linking vulnerability (many users share tags)
- Trade-off: 256x faster scanning for minimal leakage

## Property 4: Proof Soundness

### Definition

**Informally**: An adversary cannot create a valid proof for a false statement.

**Formally**: For any PPT adversary A:

```
Pr[Verify(π, x) = 1 ∧ x ∉ L] ≤ negl(λ)
```

Where L is the language of valid statements.

### Funding Proof Soundness

**Statement**: "I have committed balance ≥ minimum_required"

**What cannot be forged**:
- Cannot prove sufficient balance without it
- Cannot manipulate committed balance after fact
- Cannot use same balance twice (nullifier)

### Validity Proof Soundness

**Statement**: "This intent was signed by the owner of the committed address"

**What cannot be forged**:
- Cannot forge signature without private key
- Cannot bind different signature to intent
- Cannot replay with same nullifier

### Fulfillment Proof Soundness

**Statement**: "Output meets intent requirements"

**What cannot be forged**:
- Cannot claim delivery without meeting amount
- Cannot claim before actual delivery
- Cannot manipulate output commitment

## Property 5: Selective Disclosure

### Definition

**Informally**: Holder of viewing key can reveal transaction details to auditor without spending capability.

**Formally**: Given viewing key k_view:
- Can compute: all stealth addresses, shared secrets, view tags
- Cannot compute: spending private keys

### Compliance Flow

```
1. User generates: (k_spend, k_view)
2. User shares k_view with auditor
3. Auditor can:
   - Identify all incoming payments
   - Verify amounts (if commitment openings provided)
   - Cannot: spend funds, impersonate user
```

### Derivable Viewing Keys

```typescript
// Hierarchical viewing key derivation
masterViewingKey → childViewingKey("audit/2024")
                → childViewingKey("audit/2025")
```

Properties:
- Child key cannot derive sibling keys
- Child key cannot derive parent key
- Selective disclosure per auditor/purpose

## Property 6: Balance Conservation

### Definition

**Informally**: Total value in = total value out (no creation/destruction).

**Formally**: For any transaction with inputs I₁...Iₙ and outputs O₁...Oₘ:

```
Σᵢ commit(vᵢ) = Σⱼ commit(wⱼ)
⟹ Σᵢ vᵢ = Σⱼ wⱼ (under commitment binding)
```

### Enforcement

1. Homomorphic property: C₁ + C₂ = commit(v₁ + v₂, r₁ + r₂)
2. Balance check: sum(inputs) - sum(outputs) = commit(0, Δr)
3. Prover demonstrates knowledge of Δr
4. Binding property ensures no value created

### Range Proofs (Future)

Currently not implemented, but required for full protocol:
- Prove each output ≥ 0
- Prevents negative values (implicit value creation)
- Standard: Bulletproofs for efficiency

## Property 7: Intent Integrity

### Definition

**Informally**: Intent cannot be modified after signing.

**Formally**: For signed intent (I, σ):

```
Verify(pk, I, σ) = 1 ⟹ I was approved by holder of sk
```

### What Is Protected

- Input/output specifications
- Privacy level
- Expiry time
- All intent parameters

### Attack Prevention

| Attack | Prevention |
|--------|------------|
| Intent modification | ECDSA signature |
| Replay | Nullifier derivation |
| Expiry manipulation | Timestamp in signed data |

## Composition

### Combined Properties

When properties compose:

```
Amount Privacy + Sender Unlinkability = Transaction Privacy
Recipient Unlinkability + Selective Disclosure = Compliant Privacy
Proof Soundness + Balance Conservation = Economic Security
```

### Attack Surface Reduction

| Layer | Properties | Result |
|-------|------------|--------|
| Commitment | Hiding + Binding | Amount privacy |
| Stealth | Unlinkability | Identity privacy |
| ZK Proofs | Soundness + ZK | Verifiable privacy |
| Protocol | All combined | Full transaction privacy |

## Security Levels

### Per Property

| Property | Security Level | Basis |
|----------|---------------|-------|
| Amount hiding | Perfect (∞) | Information-theoretic |
| Amount binding | 128-bit | ECDLP |
| Sender unlinkability | 128-bit | CDH |
| Recipient unlinkability | 128-bit | CDH |
| Proof soundness | ~128-bit | UltraPlonk |
| Viewing key security | 128-bit | ECDLP |

### Weakest Link

Overall security: **128 bits** (limited by computational assumptions)

## Formal Security Analysis

### Game-Based Definitions

1. **IND-CCA** (Indistinguishability): Commitments are indistinguishable
2. **UNF-CMA** (Unforgeability): Signatures cannot be forged
3. **SIM-ZK** (Simulation): Proofs reveal nothing

### Reduction Proofs

Each property reduces to standard assumptions:
- Amount privacy → Perfect hiding (no reduction needed)
- Unlinkability → CDH → ECDLP
- Soundness → Knowledge assumption (Noir/Barretenberg)

## Verification

### Test Coverage

| Property | Test File | Tests |
|----------|-----------|-------|
| Commitment hiding | pedersen.test.ts | Hiding tests |
| Commitment binding | pedersen.test.ts | Binding tests |
| Stealth unlinkability | stealth.test.ts | Address independence |
| Proof verification | mock-provider.test.ts | Verification tests |
| Full flow | full-flow.test.ts | Integration tests |

### Run Verification

```bash
pnpm test
# 100 tests covering all security properties
```
