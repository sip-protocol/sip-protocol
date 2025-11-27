# Validity Proof Specification

> **Issue**: #4 - Specify Validity Proof mathematical constraints
> **Status**: SPECIFIED
> **Date**: November 26, 2025
> **ZK Framework**: Noir (per #2 decision)

---

## 1. Overview

### Purpose

The Validity Proof proves:

> **"This intent is well-formed and authorized by the sender, without revealing the sender's identity or private keys."**

### Use Case

When a user creates a shielded intent:
- Solvers need assurance the intent is legitimately authorized
- The user doesn't want to reveal which wallet created the intent
- The system needs to prevent replay attacks (reusing old intents)

The Validity Proof provides these guarantees while maintaining sender privacy.

---

## 2. Mathematical Specification

### 2.1 Sender Commitment

We commit to the sender's identity using Pedersen:

```
sender_commitment = Pedersen(H(sender_address), sender_blinding)
```

Where:
- `H(sender_address)` = Poseidon hash of the address
- `sender_blinding` = random scalar for unlinkability
- Result is a point on the curve that hides the sender

### 2.2 Nullifier Design

To prevent replay attacks, we derive a unique nullifier:

```
nullifier = Poseidon(sender_secret, intent_hash, nonce)
```

Properties:
- **Deterministic**: Same inputs always produce same nullifier
- **Unlinkable**: Cannot determine sender from nullifier alone
- **Unique**: Each intent has a unique nullifier
- **Binding**: Cannot create different intent with same nullifier

The nullifier is published; if seen before, intent is rejected.

### 2.3 Formal Statement

The Validity Proof is a ZK proof for the relation:

```
R = {
  (intent_hash, sender_commitment, nullifier, timestamp, expiry;  // Public
   sender_address, sender_blinding, sender_secret, signature, nonce)  // Private
   :
   // (1) Sender commitment is valid
   sender_commitment = Pedersen(Poseidon(sender_address), sender_blinding)

   // (2) Signature is valid
   ∧ Verify(signature, sender_address, intent_hash)

   // (3) Nullifier is correctly derived
   ∧ nullifier = Poseidon(sender_secret, intent_hash, nonce)

   // (4) Time constraints
   ∧ timestamp < expiry

   // (5) Secret is linked to address (ownership)
   ∧ DeriveAddress(sender_secret) = sender_address
}
```

### 2.4 Constraint Breakdown

#### Constraint 1: Sender Commitment

```
address_hash = Poseidon(sender_address)
commitment = Pedersen(address_hash, sender_blinding)
assert(commitment == sender_commitment)
```

#### Constraint 2: Signature Verification

```
valid = ECDSA.verify(signature, sender_address, intent_hash)
assert(valid == true)
```

#### Constraint 3: Nullifier Derivation

```
computed_nullifier = Poseidon(sender_secret, intent_hash, nonce)
assert(computed_nullifier == nullifier)
```

#### Constraint 4: Time Bounds

```
assert(timestamp < expiry)
// Note: timestamp and expiry are public, this is a simple comparison
```

#### Constraint 5: Address Ownership

```
derived = ECDSA.derive_address(sender_secret)
assert(derived == sender_address)
```

This proves the prover knows the private key for sender_address.

---

## 3. Circuit Design (Noir)

### 3.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `intent_hash` | `Field` | Poseidon hash of intent structure |
| `sender_commitment` | `Point` | Pedersen commitment to sender |
| `nullifier` | `Field` | Unique nullifier for replay protection |
| `timestamp` | `u64` | Intent creation timestamp |
| `expiry` | `u64` | Intent expiration timestamp |

### 3.2 Private Inputs (Witness)

| Input | Type | Description |
|-------|------|-------------|
| `sender_address` | `[u8; 20]` | Sender's address |
| `sender_blinding` | `Field` | Blinding for sender commitment |
| `sender_secret` | `Field` | Sender's private key (scalar) |
| `signature` | `[u8; 64]` | ECDSA signature on intent_hash |
| `nonce` | `Field` | Unique nonce for nullifier |

### 3.3 Noir Implementation

```noir
use dep::std::hash::poseidon;
use dep::std::ecdsa_secp256k1;

fn main(
    // Public inputs
    intent_hash: pub Field,
    sender_commitment_x: pub Field,
    sender_commitment_y: pub Field,
    nullifier: pub Field,
    timestamp: pub u64,
    expiry: pub u64,

    // Private inputs
    sender_address: [u8; 20],
    sender_blinding: Field,
    sender_secret: Field,
    signature: [u8; 64],
    nonce: Field,
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
) {
    // Constraint 1: Verify sender commitment
    let address_hash = poseidon::bn254::hash_1([bytes_to_field(sender_address)]);
    let computed_commitment = pedersen_commit(address_hash, sender_blinding);
    assert(computed_commitment.x == sender_commitment_x, "Sender commitment X mismatch");
    assert(computed_commitment.y == sender_commitment_y, "Sender commitment Y mismatch");

    // Constraint 2: Verify signature on intent_hash
    let intent_hash_bytes = field_to_bytes(intent_hash);
    let valid_sig = ecdsa_secp256k1::verify_signature(
        pub_key_x,
        pub_key_y,
        signature,
        intent_hash_bytes
    );
    assert(valid_sig, "Invalid signature");

    // Constraint 3: Verify nullifier derivation
    let computed_nullifier = poseidon::bn254::hash_3([
        sender_secret,
        intent_hash,
        nonce
    ]);
    assert(computed_nullifier == nullifier, "Nullifier mismatch");

    // Constraint 4: Time bounds check
    assert(timestamp < expiry, "Intent expired or invalid timestamps");

    // Constraint 5: Verify address ownership (public key derives to address)
    let derived_address = derive_eth_address(pub_key_x, pub_key_y);
    assert(derived_address == sender_address, "Address derivation mismatch");

    // Constraint 6: Verify public key corresponds to secret
    let derived_pub = scalar_to_point(sender_secret);
    assert(derived_pub.x == bytes_to_field_32(pub_key_x), "Public key X mismatch");
    assert(derived_pub.y == bytes_to_field_32(pub_key_y), "Public key Y mismatch");
}

// Helper: Pedersen commitment
fn pedersen_commit(value: Field, blinding: Field) -> Point {
    let value_point = scalar_mul(G, value);
    let blinding_point = scalar_mul(H, blinding);
    point_add(value_point, blinding_point)
}

// Helper: Derive Ethereum address from public key
fn derive_eth_address(pub_x: [u8; 32], pub_y: [u8; 32]) -> [u8; 20] {
    let full_key = concat_arrays(pub_x, pub_y);
    let hash = keccak256(full_key);
    // Take last 20 bytes
    extract_last_20(hash)
}
```

### 3.4 Constraint Count Estimate

| Component | Constraints (approx) |
|-----------|---------------------|
| Poseidon hash (address) | ~300 |
| Pedersen commitment | ~500 |
| ECDSA signature verify | ~20,000 |
| Poseidon hash (nullifier) | ~300 |
| Timestamp comparison | ~1 |
| Address derivation (Keccak) | ~50,000 |
| Scalar to point | ~500 |
| **Total** | **~72,000** |

**Optimization Note**: Keccak256 is expensive in ZK. Consider:
- Using Poseidon-based address derivation for ZK contexts
- Accepting a ZK-friendly address format alongside ETH address

---

## 4. Nullifier System

### 4.1 Purpose

Nullifiers prevent replay attacks where an attacker resubmits a valid intent.

### 4.2 Design

```
nullifier = Poseidon(sender_secret, intent_hash, nonce)
```

- `sender_secret`: Only the sender knows this
- `intent_hash`: Binds to specific intent
- `nonce`: User-chosen, allows multiple intents

### 4.3 Storage

```
NullifierSet = {
  nullifier_1,
  nullifier_2,
  ...
}
```

Before accepting an intent:
1. Verify the proof
2. Check `nullifier ∉ NullifierSet`
3. Add `nullifier` to `NullifierSet`

### 4.4 Properties

| Property | Guarantee |
|----------|-----------|
| **Replay prevention** | Same intent cannot be reused |
| **Unlinkability** | Cannot link nullifier to sender |
| **Determinism** | Same inputs = same nullifier (no double-spend) |
| **Privacy** | Nullifier reveals nothing about sender |

---

## 5. Security Analysis

### 5.1 What is Hidden (Zero-Knowledge)

| Information | Hidden? | Notes |
|-------------|---------|-------|
| Sender address | ✅ Yes | Hidden behind commitment |
| Private key | ✅ Yes | Never revealed, only used in proof |
| Signature | ✅ Yes | Part of witness |
| Blinding factor | ✅ Yes | Never revealed |

### 5.2 What is Revealed (Public)

| Information | Revealed? | Notes |
|-------------|-----------|-------|
| Intent hash | ✅ Yes | Intent structure is known |
| Sender commitment | ✅ Yes | Unlinkable commitment |
| Nullifier | ✅ Yes | For replay protection |
| Timestamps | ✅ Yes | Validity window |

### 5.3 Threat Analysis

| Threat | Mitigation |
|--------|------------|
| **Sender identification** | Commitment hides address; fresh blinding per intent |
| **Replay attacks** | Nullifier prevents reuse |
| **Forgery** | Signature verification ensures authorization |
| **Front-running** | Intent hash committed before details revealed |
| **Timing attacks** | Timestamps are coarse-grained |
| **Nullifier grinding** | Nonce is user-controlled; can't predict others' nullifiers |

### 5.4 Linkability Analysis

**Cross-intent linkability**: If same sender_blinding is reused, commitments would match → AVOID by generating fresh blinding per intent.

**Nullifier linkability**: Different nullifiers for different intents even from same sender (due to different intent_hash and nonce).

---

## 6. Test Vectors

### 6.1 Valid Proof

```json
{
  "public_inputs": {
    "intent_hash": "0x1a2b3c...",
    "sender_commitment": ["0xabc...", "0xdef..."],
    "nullifier": "0x789...",
    "timestamp": 1732600000,
    "expiry": 1732686400
  },
  "private_inputs": {
    "sender_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
    "sender_blinding": "0x...",
    "sender_secret": "0x...",
    "signature": "0x...",
    "nonce": "0x..."
  },
  "expected": "VALID"
}
```

### 6.2 Invalid Proof (Expired Intent)

```json
{
  "public_inputs": {
    "intent_hash": "0x...",
    "sender_commitment": ["0x...", "0x..."],
    "nullifier": "0x...",
    "timestamp": 1732686400,
    "expiry": 1732600000
  },
  "expected": "INVALID - timestamp >= expiry"
}
```

### 6.3 Invalid Proof (Wrong Signature)

```json
{
  "public_inputs": {
    "intent_hash": "0xINTENT...",
    "sender_commitment": ["0x...", "0x..."],
    "nullifier": "0x...",
    "timestamp": 1732600000,
    "expiry": 1732686400
  },
  "private_inputs": {
    "signature": "0xWRONG_SIGNATURE..."
  },
  "expected": "INVALID - signature verification failed"
}
```

---

## 7. Integration with SIP

### 7.1 Flow

```
1. User constructs intent structure
2. User computes: intent_hash = Poseidon(intent_fields...)
3. User generates: sender_blinding (random)
4. User computes: sender_commitment = Pedersen(H(address), blinding)
5. User computes: nullifier = Poseidon(secret, intent_hash, nonce)
6. User signs: signature = ECDSA.sign(secret, intent_hash)
7. User generates Validity Proof
8. Intent published with: (intent_hash, sender_commitment, nullifier, proof)
9. Solver verifies proof
10. System checks nullifier not in set, adds it
```

### 7.2 SDK Interface

```typescript
interface ValidityProofInput {
  intent: ShieldedIntent;
  senderAddress: string;
  senderSecret: Uint8Array;  // Private key
  nonce: bigint;
}

interface ValidityProof {
  proof: Uint8Array;
  publicInputs: {
    intentHash: string;
    senderCommitment: [string, string];
    nullifier: string;
    timestamp: bigint;
    expiry: bigint;
  };
}

interface ProofProvider {
  generateValidityProof(input: ValidityProofInput): Promise<ValidityProof>;
  verifyValidityProof(proof: ValidityProof): Promise<boolean>;
}
```

---

## 8. Optimization Opportunities

### 8.1 Signature Scheme

| Scheme | Constraints | Recommendation |
|--------|-------------|----------------|
| ECDSA | ~20,000 | Current default |
| EdDSA | ~5,000 | 4x cheaper, consider for ZK-native |
| Schnorr | ~5,000 | Good alternative |

### 8.2 Address Derivation

Keccak256 is expensive (~50K constraints). Options:
- Accept Poseidon-derived addresses for ZK operations
- Pre-compute address hash off-chain, verify commitment

### 8.3 Combined Proofs

Consider combining Funding + Validity into single proof:
- Reduces total verification cost
- Single proof for "authorized intent with sufficient funds"

---

## 9. References

- [Nullifier Design in Zcash](https://zips.z.cash/protocol/protocol.pdf)
- [Tornado Cash Nullifier Scheme](https://tornado-cash.medium.com/)
- [ECDSA in ZK Circuits](https://0xparc.org/blog/zk-ecdsa)
- [Noir Standard Library - ECDSA](https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/ecdsa)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
