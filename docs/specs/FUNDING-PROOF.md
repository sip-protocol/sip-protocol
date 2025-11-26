# Funding Proof Specification

> **Issue**: #3 - Specify Funding Proof mathematical constraints
> **Status**: SPECIFIED
> **Date**: November 26, 2025
> **ZK Framework**: Noir (per #2 decision)

---

## 1. Overview

### Purpose

The Funding Proof proves:

> **"I have sufficient funds to fulfill this intent, without revealing my exact balance, wallet address, or source of funds."**

### Use Case

When a user creates a shielded intent to swap 10 SOL for ZEC:
- The solver needs assurance that the user actually has ≥10 SOL
- The user doesn't want to reveal they have 1000 SOL
- The user doesn't want to reveal which wallet holds the funds

The Funding Proof provides this guarantee using zero-knowledge cryptography.

---

## 2. Mathematical Specification

### 2.1 Pedersen Commitment Scheme

We use Pedersen commitments for hiding balances:

```
C = balance × G + blinding × H
```

Where:
- `G`, `H` are independent generator points on secp256k1
- `balance` is the value being committed to
- `blinding` is a random scalar (the "blinding factor")
- `C` is the resulting commitment point

**Properties**:
- **Hiding**: Given `C`, it's computationally infeasible to determine `balance`
- **Binding**: Cannot find different `(balance', blinding')` that produces same `C`
- **Homomorphic**: `C1 + C2 = Commit(v1 + v2, b1 + b2)`

### 2.2 Formal Statement

The Funding Proof is a zero-knowledge proof of knowledge for the relation:

```
R = {
  (commitment_hash, minimum_required, asset_id;    // Public inputs
   balance, blinding, address, signature)          // Private inputs
   :
   balance ≥ minimum_required                      // (1) Sufficient funds
   ∧ C = Pedersen(balance, blinding)               // (2) Valid commitment
   ∧ H(C || asset_id) = commitment_hash            // (3) Commitment hash matches
   ∧ Verify(signature, address, H(C))              // (4) Ownership proof
}
```

### 2.3 Constraint Breakdown

#### Constraint 1: Range Proof (balance ≥ minimum_required)

Prove that `balance - minimum_required ≥ 0` without revealing either value.

**Approach**: Decompose `(balance - minimum_required)` into bits and prove each bit ∈ {0, 1}.

```
diff = balance - minimum_required
diff = Σ(bit_i × 2^i) for i = 0..63
∀i: bit_i × (bit_i - 1) = 0  // Each bit is 0 or 1
```

For a 64-bit range, this requires 64 constraints.

#### Constraint 2: Pedersen Commitment Validity

```
C.x, C.y = EllipticCurveAdd(
  ScalarMul(G, balance),
  ScalarMul(H, blinding)
)
```

This uses standard elliptic curve operations over the BN254 or BLS12-381 field.

#### Constraint 3: Commitment Hash

```
commitment_hash = Poseidon(C.x, C.y, asset_id)
```

We use Poseidon hash for ZK-friendliness (fewer constraints than SHA256).

#### Constraint 4: Ownership Signature Verification

```
valid = ECDSA.verify(signature, address, message_hash)
       where message_hash = Poseidon(C.x, C.y)
```

---

## 3. Circuit Design (Noir)

### 3.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `commitment_hash` | `Field` | Poseidon hash of commitment + asset_id |
| `minimum_required` | `u64` | Minimum balance needed |
| `asset_id` | `Field` | Asset identifier hash |

### 3.2 Private Inputs (Witness)

| Input | Type | Description |
|-------|------|-------------|
| `balance` | `u64` | Actual user balance |
| `blinding` | `Field` | Commitment blinding factor |
| `address` | `[u8; 20]` | User's address (Ethereum-style) |
| `signature` | `Signature` | ECDSA signature over commitment |

### 3.3 Noir Implementation

```noir
use dep::std::hash::poseidon;
use dep::std::ec::tecurve::affine::Point;
use dep::std::ecdsa_secp256k1;

// Generator points (would be defined in a constants file)
global G: Point = Point { x: G_X, y: G_Y };
global H: Point = Point { x: H_X, y: H_Y };

struct FundingProofPublicInputs {
    commitment_hash: pub Field,
    minimum_required: pub u64,
    asset_id: pub Field,
}

struct FundingProofPrivateInputs {
    balance: u64,
    blinding: Field,
    address: [u8; 20],
    signature: [u8; 64],
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
}

fn main(
    // Public inputs
    commitment_hash: pub Field,
    minimum_required: pub u64,
    asset_id: pub Field,
    // Private inputs
    balance: u64,
    blinding: Field,
    address: [u8; 20],
    signature: [u8; 64],
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
) {
    // Constraint 1: Sufficient funds (range proof implicit)
    assert(balance >= minimum_required, "Insufficient balance");

    // Constraint 2: Compute Pedersen commitment
    let commitment = pedersen_commit(balance as Field, blinding);

    // Constraint 3: Verify commitment hash
    let computed_hash = poseidon::bn254::hash_3([
        commitment.x,
        commitment.y,
        asset_id
    ]);
    assert(computed_hash == commitment_hash, "Commitment hash mismatch");

    // Constraint 4: Verify ownership (ECDSA signature)
    let message_hash = poseidon::bn254::hash_2([commitment.x, commitment.y]);
    let message_bytes = field_to_bytes(message_hash);

    let valid_sig = ecdsa_secp256k1::verify_signature(
        pub_key_x,
        pub_key_y,
        signature,
        message_bytes
    );
    assert(valid_sig, "Invalid ownership signature");

    // Constraint 5: Address derivation from public key
    let derived_address = derive_address(pub_key_x, pub_key_y);
    assert(derived_address == address, "Address mismatch");
}

// Helper: Pedersen commitment
fn pedersen_commit(value: Field, blinding: Field) -> Point {
    let value_point = scalar_mul(G, value);
    let blinding_point = scalar_mul(H, blinding);
    point_add(value_point, blinding_point)
}
```

### 3.4 Constraint Count Estimate

| Component | Constraints (approx) |
|-----------|---------------------|
| Range proof (64-bit) | ~64 |
| Pedersen commitment | ~500 |
| Poseidon hash (3 inputs) | ~300 |
| ECDSA verification | ~20,000 |
| Address derivation | ~1,000 |
| **Total** | **~22,000** |

**Note**: ECDSA is expensive. Consider EdDSA/Schnorr for ~5x reduction.

---

## 4. Security Analysis

### 4.1 What is Hidden (Zero-Knowledge)

| Information | Hidden? | Notes |
|-------------|---------|-------|
| Exact balance | ✅ Yes | Only proves balance ≥ minimum |
| Blinding factor | ✅ Yes | Never revealed |
| Source address | ✅ Yes | Hidden in proof |
| Signature | ✅ Yes | Part of witness |

### 4.2 What is Revealed (Public)

| Information | Revealed? | Notes |
|-------------|-----------|-------|
| Minimum required | ✅ Yes | Solver needs this for quoting |
| Asset type | ✅ Yes | Solver needs this |
| Commitment hash | ✅ Yes | For verification |
| Proof existence | ✅ Yes | Someone has sufficient funds |

### 4.3 Threat Analysis

| Threat | Mitigation |
|--------|------------|
| **Balance guessing** | Commitment hiding property; attacker can't verify guesses |
| **Linkability** | Fresh blinding factor per intent; commitments unlinkable |
| **Front-running** | Commitment published before details; can't extract info |
| **Replay attacks** | Include intent_id or nonce in commitment hash |
| **Malicious prover** | Soundness property ensures proof is valid |

### 4.4 Trust Assumptions

1. **Discrete log hardness**: Standard cryptographic assumption
2. **Poseidon security**: Hash function security in ZK context
3. **ECDSA security**: Signature scheme security
4. **Noir compiler correctness**: Trusted compiler

---

## 5. Test Vectors

### 5.1 Valid Proof

```json
{
  "public_inputs": {
    "commitment_hash": "0x1a2b3c...",
    "minimum_required": 10000000000,
    "asset_id": "0xSOL..."
  },
  "private_inputs": {
    "balance": 50000000000,
    "blinding": "0x7f8e9d...",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
    "signature": "0x..."
  },
  "expected": "VALID"
}
```

### 5.2 Invalid Proof (Insufficient Balance)

```json
{
  "public_inputs": {
    "commitment_hash": "0x...",
    "minimum_required": 100000000000,
    "asset_id": "0xSOL..."
  },
  "private_inputs": {
    "balance": 50000000000,
    "blinding": "0x...",
    "address": "0x...",
    "signature": "0x..."
  },
  "expected": "INVALID - balance < minimum_required"
}
```

### 5.3 Invalid Proof (Wrong Commitment)

```json
{
  "public_inputs": {
    "commitment_hash": "0xWRONG...",
    "minimum_required": 10000000000,
    "asset_id": "0xSOL..."
  },
  "private_inputs": {
    "balance": 50000000000,
    "blinding": "0x...",
    "address": "0x...",
    "signature": "0x..."
  },
  "expected": "INVALID - commitment hash mismatch"
}
```

---

## 6. Integration with SIP

### 6.1 Flow

```
1. User creates intent with minimum_required = 10 SOL
2. User computes: C = Pedersen(balance, blinding)
3. User computes: commitment_hash = Poseidon(C, asset_id)
4. User signs: sig = ECDSA.sign(address_key, Poseidon(C))
5. User generates proof with (commitment_hash, minimum_required, asset_id) public
6. Intent includes: commitment_hash + proof
7. Solver verifies proof
8. Solver knows user has ≥10 SOL without knowing actual balance
```

### 6.2 SDK Interface

```typescript
interface FundingProofInput {
  balance: bigint;
  blindingFactor: Uint8Array;
  minimumRequired: bigint;
  assetId: string;
  address: string;
  privateKey: Uint8Array;  // For signing
}

interface FundingProof {
  proof: Uint8Array;
  publicInputs: {
    commitmentHash: string;
    minimumRequired: bigint;
    assetId: string;
  };
}

// In ProofProvider interface
interface ProofProvider {
  generateFundingProof(input: FundingProofInput): Promise<FundingProof>;
  verifyFundingProof(proof: FundingProof): Promise<boolean>;
}
```

---

## 7. Open Questions

1. **Signature scheme**: ECDSA is expensive (~20K constraints). Consider:
   - EdDSA: ~5K constraints
   - Schnorr: ~5K constraints
   - BLS: Different tradeoffs

2. **Hash function**: Poseidon is ZK-friendly but less standard. Consider:
   - Poseidon2: Newer, possibly more efficient
   - MiMC: Alternative ZK hash

3. **Range proof optimization**: For 64-bit ranges, consider:
   - Bulletproofs-style aggregation
   - Lookup tables in Noir

---

## 8. References

- [Pedersen Commitments](https://link.springer.com/content/pdf/10.1007/3-540-46766-1_9.pdf)
- [Noir Standard Library](https://noir-lang.org/docs/noir/standard_library)
- [Poseidon Hash](https://eprint.iacr.org/2019/458.pdf)
- [Zcash Protocol Specification](https://zips.z.cash/protocol/protocol.pdf)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
