# Fulfillment Proof Specification

> **Issue**: #5 - Specify Fulfillment Proof mathematical constraints
> **Status**: SPECIFIED
> **Date**: November 26, 2025
> **ZK Framework**: Noir (per #2 decision)

---

## 1. Overview

### Purpose

The Fulfillment Proof proves:

> **"The solver correctly executed the intent and delivered the required output to the recipient, without revealing execution path, liquidity sources, or intermediate transactions."**

### Use Case

When a solver fulfills a shielded intent (e.g., swap 10 SOL → ZEC):
- The system needs proof that the recipient received ≥ minimum ZEC
- The recipient's stealth address should receive the funds
- The execution path (DEXs used, liquidity sources) should remain private
- The solver should be authorized to fulfill this intent

The Fulfillment Proof provides these guarantees for trustless settlement.

### Actors

| Actor | Role |
|-------|------|
| **User** | Created the intent, waiting for output |
| **Solver** | Executes the swap, generates this proof |
| **Verifier** | Validates proof before releasing user's input |

---

## 2. Mathematical Specification

### 2.1 Output Commitment

The solver commits to the output amount:

```
output_commitment = Pedersen(output_amount, output_blinding)
```

This hides the exact output while proving it meets minimum requirements.

### 2.2 Formal Statement

The Fulfillment Proof is a ZK proof for the relation:

```
R = {
  (intent_hash, output_commitment, recipient_stealth,               // Public
   min_output_amount, solver_id, fulfillment_time, expiry;          // Public
   output_amount, output_blinding, tx_proof, solver_secret)         // Private
   :
   // (1) Output meets minimum requirement
   output_amount >= min_output_amount

   // (2) Output commitment is valid
   ∧ output_commitment = Pedersen(output_amount, output_blinding)

   // (3) Transaction proof shows delivery to stealth address
   ∧ VerifyTxProof(tx_proof, recipient_stealth, output_amount)

   // (4) Solver is authorized
   ∧ DeriveId(solver_secret) = solver_id

   // (5) Fulfilled before expiry
   ∧ fulfillment_time <= expiry
}
```

### 2.3 Constraint Breakdown

#### Constraint 1: Minimum Output (Range Proof)

```
diff = output_amount - min_output_amount
diff >= 0  // Proved via bit decomposition
```

Same technique as Funding Proof - decompose into 64 bits.

#### Constraint 2: Output Commitment

```
C = Pedersen(output_amount, output_blinding)
assert(C == output_commitment)
```

#### Constraint 3: Transaction Proof (Cross-Chain Challenge)

This is the most complex part. We need to prove funds were sent on the destination chain.

**Option A: Oracle/Relayer Attestation**
```
attestation = Sign(oracle_key, (recipient, amount, tx_hash, block))
Verify(attestation, oracle_pubkey) == true
```

**Option B: Light Client Proof**
```
VerifyMerkleProof(tx, block_header, merkle_path) == true
VerifyBlockHeader(block_header, chain_state) == true
```

**Option C: Optimistic with Challenge Period**
```
// No ZK proof of delivery
// Instead: solver stakes collateral
// Challenge period allows disputes
```

For SIP v1, we recommend **Option A** (oracle attestation) for simplicity, with Option B as future optimization.

#### Constraint 4: Solver Authorization

```
solver_pubkey = ScalarMul(G, solver_secret)
solver_id = Poseidon(solver_pubkey.x, solver_pubkey.y)
assert(solver_id == expected_solver_id)
```

#### Constraint 5: Time Constraint

```
assert(fulfillment_time <= expiry)
```

---

## 3. Circuit Design (Noir)

### 3.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `intent_hash` | `Field` | Hash of the original intent |
| `output_commitment` | `Point` | Pedersen commitment to output |
| `recipient_stealth` | `Field` | Stealth address (hashed) |
| `min_output_amount` | `u64` | Minimum required output |
| `solver_id` | `Field` | Authorized solver identifier |
| `fulfillment_time` | `u64` | When fulfillment occurred |
| `expiry` | `u64` | Intent expiration time |

### 3.2 Private Inputs (Witness)

| Input | Type | Description |
|-------|------|-------------|
| `output_amount` | `u64` | Actual output delivered |
| `output_blinding` | `Field` | Blinding for output commitment |
| `oracle_attestation` | `Attestation` | Signed proof of delivery |
| `solver_secret` | `Field` | Solver's private key |

### 3.3 Attestation Structure

```noir
struct Attestation {
    recipient: Field,      // Stealth address
    amount: u64,           // Amount delivered
    tx_hash: Field,        // Transaction hash on dest chain
    block_number: u64,     // Block containing tx
    signature: [u8; 64],   // Oracle signature
}
```

### 3.4 Noir Implementation

```noir
use dep::std::hash::poseidon;
use dep::std::ecdsa_secp256k1;

// Oracle public key (hardcoded or from trusted registry)
global ORACLE_PUBKEY_X: [u8; 32] = [...];
global ORACLE_PUBKEY_Y: [u8; 32] = [...];

fn main(
    // Public inputs
    intent_hash: pub Field,
    output_commitment_x: pub Field,
    output_commitment_y: pub Field,
    recipient_stealth: pub Field,
    min_output_amount: pub u64,
    solver_id: pub Field,
    fulfillment_time: pub u64,
    expiry: pub u64,

    // Private inputs
    output_amount: u64,
    output_blinding: Field,
    attestation_recipient: Field,
    attestation_amount: u64,
    attestation_tx_hash: Field,
    attestation_block: u64,
    attestation_signature: [u8; 64],
    solver_secret: Field,
) {
    // Constraint 1: Output meets minimum
    assert(output_amount >= min_output_amount, "Output below minimum");

    // Constraint 2: Output commitment is valid
    let computed_commitment = pedersen_commit(
        output_amount as Field,
        output_blinding
    );
    assert(computed_commitment.x == output_commitment_x, "Commitment X mismatch");
    assert(computed_commitment.y == output_commitment_y, "Commitment Y mismatch");

    // Constraint 3: Oracle attestation matches and is valid
    // 3a: Attestation matches our claimed values
    assert(attestation_recipient == recipient_stealth, "Recipient mismatch");
    assert(attestation_amount == output_amount, "Amount mismatch");

    // 3b: Verify oracle signature
    let attestation_hash = poseidon::bn254::hash_4([
        attestation_recipient,
        attestation_amount as Field,
        attestation_tx_hash,
        attestation_block as Field
    ]);
    let attestation_bytes = field_to_bytes(attestation_hash);

    let valid_attestation = ecdsa_secp256k1::verify_signature(
        ORACLE_PUBKEY_X,
        ORACLE_PUBKEY_Y,
        attestation_signature,
        attestation_bytes
    );
    assert(valid_attestation, "Invalid oracle attestation");

    // Constraint 4: Solver authorization
    let solver_pubkey = scalar_to_point(solver_secret);
    let computed_solver_id = poseidon::bn254::hash_2([
        solver_pubkey.x,
        solver_pubkey.y
    ]);
    assert(computed_solver_id == solver_id, "Unauthorized solver");

    // Constraint 5: Time constraint
    assert(fulfillment_time <= expiry, "Fulfillment after expiry");
}

fn pedersen_commit(value: Field, blinding: Field) -> Point {
    let value_point = scalar_mul(G, value);
    let blinding_point = scalar_mul(H, blinding);
    point_add(value_point, blinding_point)
}
```

### 3.5 Constraint Count Estimate

| Component | Constraints (approx) |
|-----------|---------------------|
| Range proof (output >= min) | ~64 |
| Pedersen commitment | ~500 |
| Poseidon hash (attestation) | ~400 |
| ECDSA verify (oracle sig) | ~20,000 |
| Poseidon hash (solver_id) | ~300 |
| Scalar to point | ~500 |
| Time comparison | ~1 |
| **Total** | **~22,000** |

Much lighter than Validity Proof (no Keccak256 needed).

---

## 4. Cross-Chain Verification

### 4.1 The Challenge

Proving something happened on Chain B while verifying on Chain A is fundamentally hard.

### 4.2 Approaches Comparison

| Approach | Trust Assumption | Complexity | Latency |
|----------|-----------------|------------|---------|
| **Oracle Attestation** | Trust oracle(s) | Low | Fast |
| **Light Client** | Trust chain consensus | High | Medium |
| **Optimistic** | Economic security | Medium | Slow (challenge period) |
| **ZK Bridge** | Cryptographic | Very High | Medium |

### 4.3 SIP v1 Recommendation: Oracle Network

**Design**:
- Network of 3-5 independent oracles
- Threshold signature (e.g., 3-of-5) for attestation
- Oracles watch destination chain for fulfillment transactions
- Sign attestation when tx is confirmed

**Trust Model**:
- Assume majority of oracles are honest
- Slashing for provably false attestations
- Decentralize over time

**Future Upgrade Path**:
- Replace with ZK light client proofs when mature
- Chain-specific adapters (Zcash has viewing keys)

### 4.4 Zcash-Specific Consideration

For Zcash shielded outputs:
- Oracle needs viewing key to verify shielded tx
- Or: recipient provides decrypted note as proof
- Or: use nullifier revelation after receipt

---

## 5. Security Analysis

### 5.1 What is Hidden (Zero-Knowledge)

| Information | Hidden? | Notes |
|-------------|---------|-------|
| Exact output amount | ✅ Yes | Only proves >= minimum |
| Execution path | ✅ Yes | Not part of proof |
| Liquidity sources | ✅ Yes | Solver's private business |
| Solver's private key | ✅ Yes | Only proves ownership |

### 5.2 What is Revealed (Public)

| Information | Revealed? | Notes |
|-------------|-----------|-------|
| Minimum output | ✅ Yes | From original intent |
| Recipient stealth address | ✅ Yes | Needed for delivery |
| Solver identity | ✅ Yes | Accountability |
| Fulfillment time | ✅ Yes | For expiry check |
| Output commitment | ✅ Yes | For verification |

### 5.3 Threat Analysis

| Threat | Mitigation |
|--------|------------|
| **Under-delivery** | Range proof ensures output >= minimum |
| **Wrong recipient** | Attestation binds to stealth address |
| **Replay fulfillment** | Intent_hash binding + nullifier on original intent |
| **Late fulfillment** | Time constraint in circuit |
| **Oracle collusion** | Threshold signatures, economic penalties |
| **Fake attestation** | ECDSA verification in circuit |

### 5.4 Trust Assumptions

1. **Oracle honesty**: Majority of oracles are honest
2. **Cryptographic assumptions**: Standard (discrete log, hash security)
3. **Chain finality**: Destination chain tx is final when attested

---

## 6. Test Vectors

### 6.1 Valid Fulfillment

```json
{
  "public_inputs": {
    "intent_hash": "0x1a2b3c...",
    "output_commitment": ["0xabc...", "0xdef..."],
    "recipient_stealth": "0x789...",
    "min_output_amount": 1000000,
    "solver_id": "0xsolverid...",
    "fulfillment_time": 1732650000,
    "expiry": 1732686400
  },
  "private_inputs": {
    "output_amount": 1050000,
    "output_blinding": "0x...",
    "attestation": {
      "recipient": "0x789...",
      "amount": 1050000,
      "tx_hash": "0xtxhash...",
      "block": 12345678,
      "signature": "0x..."
    },
    "solver_secret": "0x..."
  },
  "expected": "VALID"
}
```

### 6.2 Invalid - Under Delivery

```json
{
  "public_inputs": {
    "min_output_amount": 1000000
  },
  "private_inputs": {
    "output_amount": 999999
  },
  "expected": "INVALID - output below minimum"
}
```

### 6.3 Invalid - Late Fulfillment

```json
{
  "public_inputs": {
    "fulfillment_time": 1732700000,
    "expiry": 1732686400
  },
  "expected": "INVALID - fulfillment after expiry"
}
```

### 6.4 Invalid - Wrong Recipient

```json
{
  "public_inputs": {
    "recipient_stealth": "0xCORRECT..."
  },
  "private_inputs": {
    "attestation": {
      "recipient": "0xWRONG..."
    }
  },
  "expected": "INVALID - recipient mismatch"
}
```

---

## 7. Integration with SIP

### 7.1 Full Flow

```
1. User creates shielded intent (Funding + Validity proofs)
2. Solver sees intent, quotes output
3. User accepts quote
4. Solver executes:
   a. Receives user's input (or commitment to receive)
   b. Performs swap via any route
   c. Sends output to recipient_stealth address
5. Oracle network observes destination chain
6. Oracle signs attestation of delivery
7. Solver generates Fulfillment Proof
8. Proof verified → user's input released to solver
```

### 7.2 SDK Interface

```typescript
interface FulfillmentProofInput {
  intentHash: string;
  outputAmount: bigint;
  outputBlinding: Uint8Array;
  recipientStealth: string;
  minOutputAmount: bigint;
  solverSecret: Uint8Array;
  attestation: OracleAttestation;
}

interface OracleAttestation {
  recipient: string;
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
  signature: Uint8Array;
}

interface FulfillmentProof {
  proof: Uint8Array;
  publicInputs: {
    intentHash: string;
    outputCommitment: [string, string];
    recipientStealth: string;
    minOutputAmount: bigint;
    solverId: string;
    fulfillmentTime: bigint;
    expiry: bigint;
  };
}

interface ProofProvider {
  generateFulfillmentProof(input: FulfillmentProofInput): Promise<FulfillmentProof>;
  verifyFulfillmentProof(proof: FulfillmentProof): Promise<boolean>;
}
```

---

## 8. Future Improvements

### 8.1 ZK Light Client

Replace oracle attestation with ZK proof of chain state:
- Verify destination chain block headers in ZK
- Prove transaction inclusion via Merkle proof
- Fully trustless, but complex

### 8.2 Atomic Execution

For chains with shared bridge:
- Use hash time-locked contracts (HTLCs)
- Prove preimage revelation in ZK
- True atomic swaps

### 8.3 Batched Fulfillment

Multiple intents fulfilled in single proof:
- Aggregate commitments
- Single oracle attestation for batch
- Reduced verification cost

---

## 9. References

- [Cross-Chain Messaging Comparison](https://blog.li.fi/cross-chain-messaging-comparison-2023)
- [ZK Light Clients](https://succinct.xyz/blog/zk-light-clients)
- [Oracle Network Design](https://chain.link/whitepaper)
- [Pedersen Commitments](https://link.springer.com/content/pdf/10.1007/3-540-46766-1_9.pdf)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
