# Circuit Constraint Analysis

| Field | Value |
|-------|-------|
| **Document** | SIP Circuit Security Analysis |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Created** | 2025-12-02 |
| **Authors** | SIP Protocol Security Team |

## Executive Summary

This document provides a comprehensive security analysis of the three ZK circuits in SIP Protocol:
- **Funding Proof** (972 ACIR opcodes) - Proves sufficient balance
- **Validity Proof** (1,113 ACIR opcodes) - Proves intent authorization
- **Fulfillment Proof** (1,691 ACIR opcodes) - Proves correct delivery

**Total: 3,776 ACIR opcodes across all circuits**

Each constraint is analyzed for:
1. **Purpose** - What security property it enforces
2. **Attack Prevention** - What attack it prevents if removed
3. **Dependencies** - What external assumptions it relies on

---

## Table of Contents

1. [Funding Proof Analysis](#1-funding-proof-analysis)
2. [Validity Proof Analysis](#2-validity-proof-analysis)
3. [Fulfillment Proof Analysis](#3-fulfillment-proof-analysis)
4. [Security Properties](#4-security-properties)
5. [Under-Constrained Risk Assessment](#5-under-constrained-risk-assessment)
6. [Recommendations](#6-recommendations)

---

## 1. Funding Proof Analysis

**Circuit Location:** `packages/circuits/funding_proof/src/main.nr`
**Opcode Count:** 972 ACIR opcodes
**Purpose:** Prove `balance >= minimumRequired` without revealing exact balance

### 1.1 Circuit Interface

```noir
pub fn main(
    commitment_hash: pub Field,    // Public: Hash binding commitment to asset
    minimum_required: pub u64,     // Public: Minimum amount needed
    asset_id: pub Field,           // Public: Asset identifier
    balance: u64,                  // Private: Actual balance
    blinding: Field,               // Private: Commitment randomness
)
```

### 1.2 Constraint-by-Constraint Analysis

#### Constraint 1: Sufficient Balance Check

```noir
assert(balance >= minimum_required, "Insufficient balance");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures prover has enough funds to execute intent |
| **Type** | Range comparison (implicit range proof via u64) |
| **Attack if removed** | Prover could claim sufficient funds without having them, leading to unfunded intents and solver losses |
| **Complexity** | ~200 constraints (u64 comparison with range check) |

**Security Analysis:**
- The `u64` type provides implicit range proof: balance ∈ [0, 2^64-1]
- Prevents negative balance attacks (would require different field element)
- Boundary condition: `balance == minimum_required` passes (correct behavior)

#### Constraint 2: Pedersen Commitment Computation

```noir
let commitment = pedersen_commitment([balance as Field, blinding]);
```

| Property | Description |
|----------|-------------|
| **Purpose** | Creates hiding commitment to balance |
| **Type** | Pedersen commitment (algebraic MAC) |
| **Attack if removed** | Balance would be revealed in proof, destroying privacy |
| **Complexity** | ~6,000 constraints (EC scalar multiplications) |

**Security Analysis:**
- Uses Noir's built-in `pedersen_commitment` (Grumpkin curve)
- Hiding property: Given `C`, cannot determine `balance` without `blinding`
- Binding property: Cannot find different `(balance', blinding')` that opens to same `C`

#### Constraint 3: Commitment Hash Verification

```noir
let computed_hash = pedersen_hash([commitment.x, commitment.y, asset_id]);
assert(computed_hash == commitment_hash, "Commitment hash mismatch");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Binds commitment to specific asset and prevents commitment reuse |
| **Type** | Pedersen hash verification |
| **Attack if removed** | Prover could reuse commitment across different assets or intents |
| **Complexity** | ~500 constraints (Pedersen hash) |

**Security Analysis:**
- Includes `asset_id` to prevent cross-asset commitment reuse
- Without this, a commitment for 100 USDC could be reused for 100 ETH
- Hash is collision-resistant under DL assumption

### 1.3 Funding Proof Attack Matrix

| Attack | Constraint | Result if Bypassed |
|--------|------------|-------------------|
| Claim insufficient funds | #1 | Intent underfunded, solver loss |
| Reveal balance | #2 | Privacy breach |
| Reuse commitment across assets | #3 | Double-spend across assets |
| Overflow attack (balance = MAX) | #1 (u64 type) | Limited to u64 range |
| Negative balance | #1 (u64 type) | Impossible with unsigned type |

---

## 2. Validity Proof Analysis

**Circuit Location:** `packages/circuits/validity_proof/src/main.nr`
**Opcode Count:** 1,113 ACIR opcodes
**Purpose:** Prove intent is authorized by sender without revealing sender identity

### 2.1 Circuit Interface

```noir
pub fn main(
    // Public inputs
    intent_hash: pub Field,
    sender_commitment_x: pub Field,
    sender_commitment_y: pub Field,
    nullifier: pub Field,
    timestamp: pub u64,
    expiry: pub u64,

    // Private inputs
    sender_address: Field,
    sender_blinding: Field,
    sender_secret: Field,
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],
    message_hash: [u8; 32],
    nonce: Field,
)
```

### 2.2 Constraint-by-Constraint Analysis

#### Constraint 1: Sender Commitment Verification

```noir
let commitment = pedersen_commitment([sender_address, sender_blinding]);
assert(commitment.x == sender_commitment_x, "Sender commitment X mismatch");
assert(commitment.y == sender_commitment_y, "Sender commitment Y mismatch");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Binds proof to a committed sender identity |
| **Type** | Pedersen commitment verification |
| **Attack if removed** | Anyone could claim to be any sender |
| **Complexity** | ~6,000 constraints |

**Security Analysis:**
- Sender identity is hidden behind commitment
- Blinding ensures two users with same address still have unique commitments per-intent
- Verifier sees commitment but cannot extract sender address

#### Constraint 2: ECDSA Signature Verification

```noir
let valid_sig = verify_signature(pub_key_x, pub_key_y, signature, message_hash);
assert(valid_sig, "Invalid ECDSA signature");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Proves sender authorized this specific intent |
| **Type** | secp256k1 ECDSA verification |
| **Attack if removed** | Unauthorized intents could be created, theft of funds |
| **Complexity** | ~15,000+ constraints |

**Security Analysis:**
- Uses secp256k1 (same as Ethereum, Bitcoin)
- Message hash should be `intent_hash` to bind signature to intent
- Private key never leaves prover's device
- **CRITICAL**: Signature malleability must be handled (low-S normalization)

#### Constraint 3: Nullifier Derivation

```noir
let computed_nullifier = pedersen_hash([sender_secret, intent_hash, nonce]);
assert(computed_nullifier == nullifier, "Nullifier mismatch");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Enables double-spend prevention without revealing sender |
| **Type** | Deterministic nullifier derivation |
| **Attack if removed** | Same intent could be used multiple times (replay attack) |
| **Complexity** | ~500 constraints |

**Security Analysis:**
- Nullifier is deterministic given inputs
- Same sender + intent + nonce always produces same nullifier
- Settlement layer tracks spent nullifiers
- Nonce provides entropy to avoid correlation attacks

#### Constraint 4: Time Bounds Check

```noir
assert(timestamp < expiry, "Intent expired");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures intent is within validity window |
| **Type** | Timestamp comparison |
| **Attack if removed** | Expired intents could be executed, rate manipulation |
| **Complexity** | ~50 constraints |

**Security Analysis:**
- Prevents execution of stale intents with outdated rates
- `timestamp < expiry` (strict less than) is correct
- Settlement network should verify against block time

### 2.3 Validity Proof Attack Matrix

| Attack | Constraint | Result if Bypassed |
|--------|------------|-------------------|
| Impersonate sender | #1, #2 | Theft of funds |
| Forge authorization | #2 | Unauthorized transactions |
| Replay intent | #3 | Double-spend |
| Use expired intent | #4 | Stale rate exploitation |
| Link sender across intents | #1 (blinding) | Privacy breach |

---

## 3. Fulfillment Proof Analysis

**Circuit Location:** `packages/circuits/fulfillment_proof/src/main.nr`
**Opcode Count:** 1,691 ACIR opcodes
**Purpose:** Prove solver correctly delivered output to recipient

### 3.1 Circuit Interface

```noir
pub fn main(
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
    solver_secret: Field,
    attestation_recipient: Field,
    attestation_amount: u64,
    attestation_tx_hash: Field,
    attestation_block: u64,
    oracle_signature: [u8; 64],
    oracle_message_hash: [u8; 32],
    oracle_pub_key_x: [u8; 32],
    oracle_pub_key_y: [u8; 32],
)
```

### 3.2 Constraint-by-Constraint Analysis

#### Constraint 1: Minimum Output Check

```noir
assert(output_amount >= min_output_amount, "Output below minimum");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures solver delivered at least the minimum amount |
| **Type** | Range comparison |
| **Attack if removed** | Solver could deliver less than promised |
| **Complexity** | ~200 constraints |

**Security Analysis:**
- Protects user from under-delivery
- `output_amount >= min_output_amount` allows positive slippage (user benefit)
- Boundary: exactly minimum is valid

#### Constraint 2: Output Commitment Verification

```noir
let commitment = pedersen_commitment([output_amount as Field, output_blinding]);
assert(commitment.x == output_commitment_x, "Commitment X mismatch");
assert(commitment.y == output_commitment_y, "Commitment Y mismatch");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Hides exact output amount while proving it meets minimum |
| **Type** | Pedersen commitment verification |
| **Attack if removed** | Competitive information leaked (solver's execution efficiency) |
| **Complexity** | ~6,000 constraints |

**Security Analysis:**
- Protects solver's trade execution details
- Amount hidden from verifiers and other solvers
- Commitment is included in public proof for auditability

#### Constraint 3a: Attestation Recipient Match

```noir
assert(attestation_recipient == recipient_stealth, "Recipient mismatch in attestation");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures funds went to correct recipient |
| **Type** | Field equality |
| **Attack if removed** | Solver could deliver to wrong address and claim fulfillment |
| **Complexity** | ~10 constraints |

**Security Analysis:**
- Critical for ensuring user receives funds
- Stealth address hides real recipient from observers
- Oracle must verify delivery to exact stealth address

#### Constraint 3b: Attestation Amount Match

```noir
assert(attestation_amount == output_amount, "Amount mismatch in attestation");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures claimed output matches oracle attestation |
| **Type** | Integer equality |
| **Attack if removed** | Solver could claim higher output than actually delivered |
| **Complexity** | ~10 constraints |

**Security Analysis:**
- Cross-validates solver's claim against oracle
- Prevents output inflation attacks
- Uses `==` not `>=` to prevent claiming more than delivered

#### Constraint 3c: Oracle Signature Verification

```noir
let valid_attestation = verify_signature(
    oracle_pub_key_x, oracle_pub_key_y,
    oracle_signature, oracle_message_hash
);
assert(valid_attestation, "Invalid oracle attestation signature");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Validates cross-chain delivery proof |
| **Type** | ECDSA signature verification |
| **Attack if removed** | Solver could forge attestations |
| **Complexity** | ~15,000 constraints |

**Security Analysis:**
- **CRITICAL**: Oracle trust assumption
- Single oracle currently (should be threshold in production)
- Oracle public key must be known and trusted
- Signature covers: recipient, amount, txHash, blockNumber

#### Constraint 4: Solver Authorization

```noir
let computed_solver_id = pedersen_hash([solver_secret]);
assert(computed_solver_id == solver_id, "Unauthorized solver");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Proves solver is who they claim to be |
| **Type** | Hash preimage proof |
| **Attack if removed** | Anyone could claim to be any solver |
| **Complexity** | ~500 constraints |

**Security Analysis:**
- Solver ID is public, solver secret is private
- Prevents solver impersonation for reputation manipulation
- Links fulfillment to registered solver for accountability

#### Constraint 5: Time Window Verification

```noir
assert(fulfillment_time <= expiry, "Fulfillment after expiry");
```

| Property | Description |
|----------|-------------|
| **Purpose** | Ensures timely delivery |
| **Type** | Timestamp comparison |
| **Attack if removed** | Solver could deliver late and still claim reward |
| **Complexity** | ~50 constraints |

**Security Analysis:**
- `<=` allows fulfillment exactly at expiry (boundary included)
- Should be validated against block timestamp by settlement
- Prevents rate arbitrage via delayed execution

### 3.3 Fulfillment Proof Attack Matrix

| Attack | Constraint | Result if Bypassed |
|--------|------------|-------------------|
| Under-deliver output | #1 | User receives less than expected |
| Deliver to wrong address | #3a | User never receives funds |
| Inflate claimed output | #3b | Solver steals difference |
| Forge oracle attestation | #3c | False fulfillment claims |
| Impersonate solver | #4 | Reputation manipulation |
| Late fulfillment | #5 | Rate manipulation |

---

## 4. Security Properties

### 4.1 Soundness

**Definition:** A malicious prover cannot generate a valid proof for a false statement.

| Circuit | Soundness Guarantee | Assumption |
|---------|---------------------|------------|
| **Funding** | Cannot prove `balance >= min` if `balance < min` | DL hardness on Grumpkin |
| **Validity** | Cannot forge authorization without private key | ECDSA security on secp256k1 |
| **Fulfillment** | Cannot prove delivery without oracle attestation | Oracle honesty + ECDSA security |

**Potential Soundness Breaks:**
1. Finding collisions in Pedersen hash (requires solving DLP)
2. Forging ECDSA signatures (requires solving ECDLP)
3. Oracle collusion (external trust assumption)

### 4.2 Zero-Knowledge

**Definition:** The verifier learns nothing beyond the truth of the statement.

| Circuit | What is Hidden | What is Revealed |
|---------|---------------|------------------|
| **Funding** | Exact balance, blinding factor | Minimum threshold, asset ID |
| **Validity** | Sender identity, signature, nonce | Intent hash, commitment, nullifier, time bounds |
| **Fulfillment** | Exact output amount, solver secret, oracle attestation details | Minimum output, recipient, solver ID, time bounds |

**Privacy Leakage Analysis:**
1. **Timing correlation**: Intent creation time is public
2. **Amount ranges**: Knowing minimum reveals lower bound
3. **Commitment linkability**: Same commitment across proofs → same entity
4. **Nullifier analysis**: Spent nullifiers reveal usage patterns (not identity)

### 4.3 Completeness

**Definition:** An honest prover can always generate a valid proof for a true statement.

| Circuit | Completeness Condition |
|---------|----------------------|
| **Funding** | If `balance >= min` and knows `blinding`, can prove |
| **Validity** | If authorized (has valid signature), can prove |
| **Fulfillment** | If delivered correctly and has oracle attestation, can prove |

**Potential Completeness Issues:**
1. Field overflow for very large values (mitigated by u64 bounds)
2. Invalid oracle attestation format (external dependency)
3. Signature format issues (must be properly formatted)

---

## 5. Under-Constrained Risk Assessment

### 5.1 Free Variables Analysis

| Variable | Circuit | Risk Assessment |
|----------|---------|----------------|
| `blinding` (Funding) | Funding | LOW - Correctly unconstrained except in commitment |
| `sender_blinding` (Validity) | Validity | LOW - Correctly unconstrained except in commitment |
| `nonce` (Validity) | Validity | LOW - Only constrained in nullifier derivation |
| `output_blinding` (Fulfillment) | Fulfillment | LOW - Correctly unconstrained except in commitment |
| `attestation_tx_hash` | Fulfillment | MEDIUM - Not directly constrained in circuit |
| `attestation_block` | Fulfillment | MEDIUM - Not directly constrained in circuit |

### 5.2 Identified Under-Constrained Areas

#### 5.2.1 Fulfillment: Unused Intent Hash

```noir
// Intent hash binding (ensures this proof is for this specific intent)
let _ = intent_hash;
```

**Risk:** MEDIUM
**Analysis:** The `intent_hash` is a public input but not constrained against private inputs.
**Impact:** The proof is bound to the intent by being a public input (verifier checks), but circuit doesn't enforce internal relationship.
**Recommendation:** Consider including `intent_hash` in oracle message hash derivation.

#### 5.2.2 Fulfillment: Attestation Metadata

```noir
// Attestation metadata (tx_hash and block) are included for auditability
// but not strictly constrained in circuit (oracle signature covers them)
let _ = attestation_tx_hash;
let _ = attestation_block;
```

**Risk:** LOW (if oracle signature is trusted)
**Analysis:** These values are inputs but not constrained. Oracle signature implicitly covers them.
**Impact:** Relies entirely on oracle signature integrity.
**Recommendation:** Explicit constraint or documented trust assumption.

#### 5.2.3 Validity: Key-Address Binding Missing

**Risk:** HIGH
**Analysis:** The circuit does not enforce that `pub_key` corresponds to `sender_address`.
**Impact:** A prover could use any valid signature, not necessarily from sender.
**Recommendation:** Add constraint: `keccak256(pub_key) == sender_address`

### 5.3 Assumed Invariants

| Invariant | Circuit | Enforced By |
|-----------|---------|-------------|
| Oracle public key is correct | Fulfillment | Configuration (external) |
| Nullifiers are tracked | Validity | Settlement network |
| Block timestamps are accurate | All | Blockchain consensus |
| Commitments are unique per intent | All | Blinding factor entropy |

### 5.4 External Dependencies

| Dependency | Circuits Using | Trust Assumption |
|------------|---------------|------------------|
| Noir stdlib Pedersen | All | Correct curve implementation |
| Noir stdlib ECDSA | Validity, Fulfillment | Correct secp256k1 implementation |
| Oracle network | Fulfillment | Honest majority (threshold) |
| Settlement network | All | Correct public input verification |

---

## 6. Recommendations

### 6.1 Critical (Must Fix)

1. **Add key-address binding in Validity Proof**
   - Current: Public key not bound to sender address
   - Risk: Authorization bypass
   - Fix: Add `assert(keccak256(pub_key) == sender_address)`

### 6.2 High Priority

2. **Implement threshold oracle signatures in Fulfillment Proof**
   - Current: Single oracle signature
   - Risk: Single point of failure/collusion
   - Fix: Require k-of-n oracle signatures

3. **Add signature malleability protection**
   - Current: No explicit low-S check
   - Risk: Signature replay with modified s-value
   - Fix: Constrain `s < curve_order / 2`

### 6.3 Medium Priority

4. **Constrain attestation metadata explicitly**
   - Current: `attestation_tx_hash`, `attestation_block` are free
   - Risk: Oracle signature could be for different transaction
   - Fix: Verify hash of attestation data matches signed message

5. **Add intent hash binding in fulfillment**
   - Current: `intent_hash` is public but not constrained internally
   - Risk: Cross-intent proof reuse (mitigated by public input check)
   - Fix: Include in oracle message hash derivation

### 6.4 Future Considerations

6. **Multi-curve support**
   - Current: Only secp256k1
   - Requirement: Support ed25519 for Solana, other curves

7. **Recursive proof composition**
   - Current: Three separate proofs
   - Opportunity: Aggregate into single proof for efficiency

8. **Formal verification**
   - Current: Manual analysis
   - Recommendation: Formal verification with circom-coq or similar

---

## Appendix A: Opcode Breakdown

### A.1 Funding Proof (972 opcodes)

| Component | Estimated Opcodes |
|-----------|-------------------|
| u64 range check | ~200 |
| Pedersen commitment | ~400 |
| Pedersen hash | ~300 |
| Comparison | ~50 |
| Misc | ~22 |

### A.2 Validity Proof (1,113 opcodes)

| Component | Estimated Opcodes |
|-----------|-------------------|
| Pedersen commitment | ~400 |
| ECDSA verify | ~500 |
| Pedersen hash (nullifier) | ~150 |
| Timestamp comparison | ~50 |
| Misc | ~13 |

### A.3 Fulfillment Proof (1,691 opcodes)

| Component | Estimated Opcodes |
|-----------|-------------------|
| Pedersen commitment | ~400 |
| ECDSA verify (oracle) | ~500 |
| Pedersen hash (solver_id) | ~150 |
| Range comparison | ~200 |
| Field equality checks | ~100 |
| Timestamp comparison | ~50 |
| Misc | ~291 |

---

## Appendix B: Test Coverage Mapping

| Constraint | Unit Test | Adversarial Test |
|------------|-----------|------------------|
| Funding: balance >= min | `test_valid_funding_proof` | `test_insufficient_balance` |
| Funding: commitment | `test_valid_funding_proof` | `test_wrong_commitment_hash` |
| Funding: blinding | `test_valid_funding_proof` | `test_wrong_blinding` |
| Validity: commitment | `test_commitment_and_nullifier` | - |
| Validity: nullifier | `test_commitment_and_nullifier` | - |
| Validity: time bounds | `test_time_bounds` | - |
| Fulfillment: output >= min | `test_range_proof_passes` | - |
| Fulfillment: commitment | `test_output_commitment` | - |
| Fulfillment: solver_id | `test_solver_authorization` | - |
| Fulfillment: time | `test_time_constraint_valid` | `test_time_constraint_edge_case` |

**Note:** Full ECDSA integration tests require TypeScript SDK test vectors.

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-02 | SIP Security Team | Initial analysis |

## References

1. [Noir Language Documentation](https://noir-lang.org/docs)
2. [Grumpkin Curve Specification](https://hackmd.io/@aztec-network/BkGNaHUJn)
3. [ECDSA Security Analysis](https://eprint.iacr.org/2019/114.pdf)
4. [SIP Proof Specifications](../specs/)
