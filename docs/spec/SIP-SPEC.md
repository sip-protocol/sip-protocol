# SIP Specification v0.2

> Shielded Intents Protocol — Privacy layer for cross-chain transactions

**Status**: Specification Complete (M1)
**Authors**: RECTOR Labs
**Created**: 2025-11-26
**Updated**: 2025-11-26

---

## Abstract

SIP (Shielded Intents Protocol) extends intent-based cross-chain transaction systems with privacy-preserving capabilities. It enables users to execute cross-chain swaps and transfers without exposing sender identity, transaction amounts, or recipient addresses to public observation.

This specification defines the complete cryptographic protocol including zero-knowledge proofs, stealth addresses, commitment schemes, and viewing keys for selective disclosure.

---

## Motivation

Current cross-chain intent systems (e.g., NEAR Intents) provide excellent UX for cross-chain transactions but expose all transaction details publicly. This creates several problems:

1. **Front-running**: Visible pending intents can be front-run
2. **Surveillance**: Transaction history is permanently public
3. **Target identification**: Large holders become visible targets
4. **Privacy leakage**: Even privacy-focused assets (e.g., Zcash) lose privacy when bridging

### The ZachXBT Vulnerability

As documented by blockchain investigator ZachXBT, the current NEAR Intents + Zcash integration has a privacy vulnerability:

- Refund transactions use transparent addresses
- The same address is reused for all refunds
- This creates linkability between shielded and unshielded funds

**SIP addresses these issues by introducing shielded intents with proper privacy guarantees.**

---

## 1. Protocol Overview

### 1.1 Components

| Component | Purpose | Specification |
|-----------|---------|---------------|
| **Privacy Levels** | User-selectable privacy | [PRIVACY-LEVELS.md](specs/PRIVACY-LEVELS.md) |
| **Stealth Addresses** | Recipient unlinkability | [STEALTH-ADDRESS.md](specs/STEALTH-ADDRESS.md) |
| **Pedersen Commitments** | Amount hiding | Section 3 |
| **Funding Proof** | Balance verification | [FUNDING-PROOF.md](specs/FUNDING-PROOF.md) |
| **Validity Proof** | Intent authorization | [VALIDITY-PROOF.md](specs/VALIDITY-PROOF.md) |
| **Fulfillment Proof** | Execution verification | [FULFILLMENT-PROOF.md](specs/FULFILLMENT-PROOF.md) |
| **Viewing Keys** | Selective disclosure | [VIEWING-KEY.md](specs/VIEWING-KEY.md) |

### 1.2 ZK Framework

**Decision**: Noir (Aztec)

Selected for backend-agnostic architecture, developer experience, and universal setup. See [ZK-ARCHITECTURE.md](specs/ZK-ARCHITECTURE.md) for full evaluation.

---

## 2. Privacy Levels

SIP defines three privacy levels:

### 2.1 TRANSPARENT

Standard intent with no privacy enhancements.

```
Visibility: ALL fields public
Proofs required: None
Use case: Maximum compatibility
```

### 2.2 SHIELDED

Full privacy via cryptographic hiding.

```
Hidden: Sender, input amount, recipient
Visible: Output requirements (for solver quoting)
Proofs required: Funding, Validity, Fulfillment
Use case: Personal privacy
```

### 2.3 COMPLIANT

Shielded with selective disclosure capability.

```
Hidden from public: Same as SHIELDED
Visible to auditor: All details (with viewing key)
Proofs required: All SHIELDED proofs + ViewingProof (on demand)
Use case: Institutional/regulatory compliance
```

**Full specification**: [PRIVACY-LEVELS.md](specs/PRIVACY-LEVELS.md)

---

## 3. Cryptographic Primitives

### 3.1 Elliptic Curve

| Parameter | Value |
|-----------|-------|
| Curve | secp256k1 |
| Generator | G (standard) |
| Order | n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 |

### 3.2 Hash Functions

| Purpose | Function | Rationale |
|---------|----------|-----------|
| ZK circuits | Poseidon | ZK-friendly (~300 constraints) |
| Shared secrets | SHA-256 | Standard, widely supported |
| Encryption keys | HKDF-SHA256 | Key derivation standard |

### 3.3 Pedersen Commitment

```
C = value × G + blinding × H
```

Where:
- `G`, `H` are independent generators on secp256k1
- `value` is the committed amount
- `blinding` is a random scalar

**Properties**:
- **Hiding**: Cannot determine `value` from `C`
- **Binding**: Cannot find different `(value', blinding')` producing same `C`
- **Homomorphic**: `C₁ + C₂ = Commit(v₁ + v₂, b₁ + b₂)`

### 3.4 Encryption

| Purpose | Algorithm |
|---------|-----------|
| Transaction data | ChaCha20-Poly1305 |
| Key wrapping | ChaCha20-Poly1305 |
| Nonce | 12 bytes random |

---

## 4. Data Structures

### 4.1 Shielded Intent

```typescript
interface ShieldedIntent {
  // Protocol
  version: "sip-v0.2";
  privacyLevel: PrivacyLevel;

  // Commitments
  senderCommitment: Commitment;     // Pedersen(H(address), blinding)
  inputCommitment: Commitment;      // Pedersen(amount, blinding)

  // Public requirements (for solver)
  inputAsset: AssetId;
  outputAsset: AssetId;
  minOutputAmount: bigint;

  // Recipient
  recipientStealth: StealthAddress;

  // Proofs
  fundingProof: Proof;
  validityProof: Proof;

  // Anti-replay
  nullifier: Hash;

  // Timing
  timestamp: number;
  expiry: number;

  // Compliance (COMPLIANT mode only)
  encryptedViewingData?: EncryptedBlob;
  auditorKeyHash?: Hash;
}
```

### 4.2 Stealth Address

```typescript
interface StealthAddress {
  address: CompressedPoint;         // One-time address
  ephemeralPublicKey: CompressedPoint;  // For recipient scanning
  viewTag: number;                  // Optimization (1 byte)
}
```

### 4.3 Stealth Meta-Address

```typescript
interface StealthMetaAddress {
  spendingKey: CompressedPoint;     // P = p·G
  viewingKey: CompressedPoint;      // Q = q·G
  chain: ChainId;
}

// Encoding: sip:{chain}:{spendingKey}:{viewingKey}
// Example: sip:ethereum:0x02abc...:0x03def...
```

---

## 5. Proof Specifications

### 5.1 Funding Proof

**Purpose**: Prove `balance ≥ minimum_required` without revealing balance.

**Relation**:
```
R = {
  (commitment_hash, minimum_required, asset_id;
   balance, blinding, address, signature)
   :
   balance ≥ minimum_required
   ∧ C = Pedersen(balance, blinding)
   ∧ H(C || asset_id) = commitment_hash
   ∧ Verify(signature, address, H(C))
}
```

**Constraints**: ~22,000 (dominated by ECDSA)

**Full specification**: [FUNDING-PROOF.md](specs/FUNDING-PROOF.md)

### 5.2 Validity Proof

**Purpose**: Prove intent is authorized without revealing sender.

**Relation**:
```
R = {
  (intent_hash, sender_commitment, nullifier, timestamp, expiry;
   sender_address, sender_blinding, sender_secret, signature, nonce)
   :
   sender_commitment = Pedersen(H(sender_address), sender_blinding)
   ∧ Verify(signature, sender_address, intent_hash)
   ∧ nullifier = Poseidon(sender_secret, intent_hash, nonce)
   ∧ timestamp < expiry
   ∧ DeriveAddress(sender_secret) = sender_address
}
```

**Constraints**: ~72,000 (dominated by Keccak256 address derivation)

**Full specification**: [VALIDITY-PROOF.md](specs/VALIDITY-PROOF.md)

### 5.3 Fulfillment Proof

**Purpose**: Prove solver delivered output correctly.

**Relation**:
```
R = {
  (intent_hash, output_commitment, recipient_stealth,
   min_output_amount, solver_id, fulfillment_time, expiry;
   output_amount, output_blinding, oracle_attestation, solver_secret)
   :
   output_amount ≥ min_output_amount
   ∧ output_commitment = Pedersen(output_amount, output_blinding)
   ∧ VerifyAttestation(oracle_attestation, recipient_stealth, output_amount)
   ∧ DeriveId(solver_secret) = solver_id
   ∧ fulfillment_time ≤ expiry
}
```

**Constraints**: ~22,000

**Cross-chain verification**: Oracle attestation (v1), ZK light client (future)

**Full specification**: [FULFILLMENT-PROOF.md](specs/FULFILLMENT-PROOF.md)

---

## 6. Stealth Address Protocol

### 6.1 Key Generation (Recipient)

```
p ← random_scalar()           // Spending private
P ← p · G                     // Spending public
q ← random_scalar()           // Viewing private
Q ← q · G                     // Viewing public
meta_address ← (P, Q)
```

### 6.2 Address Generation (Sender)

```
r ← random_scalar()           // Ephemeral private
R ← r · G                     // Ephemeral public
S ← r · P                     // Shared secret (ECDH)
h ← SHA256(S)
view_tag ← h[0]               // First byte
A ← Q + h · G                 // Stealth address
```

### 6.3 Scanning (Recipient)

```
S' ← p · R
h' ← SHA256(S')
if h'[0] ≠ view_tag: return NOT_MINE
A' ← Q + h' · G
if A' ≠ A: return NOT_MINE
return MINE
```

### 6.4 Key Derivation (Recipient)

```
a ← q + h (mod n)             // Stealth private key
// Verify: a · G = Q + h · G = A ✓
```

**Full specification**: [STEALTH-ADDRESS.md](specs/STEALTH-ADDRESS.md)

---

## 7. Viewing Key System

### 7.1 Key Hierarchy

```
Master Viewing Key (MVK)
├── Full Viewing Key (FVK)    // ALL transactions
├── Auditor Key (AK)          // Time-bounded access
└── Transaction Key (TVK)     // Single transaction
```

### 7.2 Derivation

```
mvk = HKDF(seed, "sip-viewing-v1", "master-viewing-key")
fvk = HKDF(mvk, "sip-fvk", "full-viewing-key")
ak  = HKDF(mvk, "sip-auditor", auditor_id || start || end)
tvk = HKDF(mvk, "sip-tvk", intent_hash)
```

### 7.3 Encryption

```
Encrypt(viewing_key, tx_data):
  nonce ← random(12)
  ciphertext ← ChaCha20-Poly1305(viewing_key, nonce, tx_data, aad=intent_hash)
  return nonce || ciphertext
```

### 7.4 ViewingProof

ZK proof that decrypted data matches on-chain commitments:
- Proves authenticity without revealing viewing key
- Enables verifiable selective disclosure

**Full specification**: [VIEWING-KEY.md](specs/VIEWING-KEY.md)

---

## 8. Nullifier System

### 8.1 Purpose

Prevent replay attacks by tracking unique nullifiers.

### 8.2 Derivation

```
nullifier = Poseidon(sender_secret, intent_hash, nonce)
```

### 8.3 Verification

```
Before accepting intent:
1. Verify all proofs
2. Check nullifier ∉ NullifierSet
3. Add nullifier to NullifierSet
```

### 8.4 Properties

- **Deterministic**: Same inputs → same nullifier
- **Unlinkable**: Cannot determine sender from nullifier
- **Binding**: Cannot create different intent with same nullifier

---

## 9. Solver Interface

### 9.1 Intent Visibility

```
Solver sees:
├── Intent exists
├── Input asset type
├── Output asset type
├── Minimum output amount
├── Recipient stealth address
├── Expiry time
└── Proof that sender has sufficient funds ✓

Solver CANNOT see:
├── Sender identity
├── Exact input amount
└── Sender's other transactions
```

### 9.2 Interface

```typescript
interface SIPSolver {
  // Evaluate and quote
  evaluateIntent(intent: ShieldedIntent): Promise<Quote>;

  // Execute fulfillment
  fulfillIntent(
    intent: ShieldedIntent,
    quote: Quote
  ): Promise<{
    fulfillmentProof: Proof;
    attestation: OracleAttestation;
  }>;
}
```

---

## 10. Security Analysis

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| **Front-running** | Commitment hides actual amounts |
| **Sender identification** | Sender commitment + ZK proof |
| **Recipient linkability** | Stealth addresses (one-time) |
| **Transaction graph analysis** | Fresh blinding per transaction |
| **Replay attacks** | Nullifier set |
| **Malicious solver** | Fulfillment proof required |
| **Oracle collusion** | Threshold signatures (3-of-5) |

### 10.2 Cryptographic Assumptions

1. **Discrete Logarithm**: Hard on secp256k1
2. **DDH (Decisional Diffie-Hellman)**: For stealth address unlinkability
3. **Hash Security**: SHA-256, Poseidon collision resistance
4. **Proof Soundness**: Noir/UltraPlonk soundness

### 10.3 Trust Assumptions

| Component | Trust Model |
|-----------|-------------|
| ZK Proofs | Cryptographic (universal setup) |
| Cross-chain | Oracle network (threshold) |
| Viewing keys | User-controlled disclosure |

---

## 11. Reference Implementation

| Component | Location |
|-----------|----------|
| SDK | `packages/sdk/` |
| Types | `packages/types/` |
| Demo | `apps/demo/` |
| Stealth addresses | `packages/sdk/src/stealth.ts` |
| Privacy handling | `packages/sdk/src/privacy.ts` |

---

## 12. Specification Documents

| Document | Description |
|----------|-------------|
| [ZK-ARCHITECTURE.md](specs/ZK-ARCHITECTURE.md) | Framework selection (Noir) |
| [FUNDING-PROOF.md](specs/FUNDING-PROOF.md) | Balance verification proof |
| [VALIDITY-PROOF.md](specs/VALIDITY-PROOF.md) | Intent authorization proof |
| [FULFILLMENT-PROOF.md](specs/FULFILLMENT-PROOF.md) | Execution verification proof |
| [STEALTH-ADDRESS.md](specs/STEALTH-ADDRESS.md) | One-time address protocol |
| [VIEWING-KEY.md](specs/VIEWING-KEY.md) | Selective disclosure system |
| [PRIVACY-LEVELS.md](specs/PRIVACY-LEVELS.md) | Privacy level definitions |

---

## Changelog

- **v0.2** (2025-11-26): Complete specification with formal proofs
  - Added ZK framework decision (Noir)
  - Added Funding Proof specification
  - Added Validity Proof specification
  - Added Fulfillment Proof specification
  - Added Stealth Address protocol
  - Added Viewing Key system
  - Added Privacy Levels formal definition
  - Added Nullifier system
  - Added security analysis

- **v0.1** (2025-11-26): Initial draft

---

*SIP Specification v0.2 — Milestone 1 Complete*
