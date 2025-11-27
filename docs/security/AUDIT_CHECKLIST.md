# Security Audit Checklist

## Overview

This checklist guides security auditors through the SIP protocol codebase, highlighting critical areas for review.

## Pre-Audit Information

### Repository Structure

```
packages/
├── sdk/                    # Core SDK (PRIMARY AUDIT TARGET)
│   ├── src/
│   │   ├── commitment.ts   # Pedersen commitments
│   │   ├── stealth.ts      # Stealth addresses (EIP-5564)
│   │   ├── privacy.ts      # Viewing keys
│   │   ├── intent.ts       # Intent builder
│   │   ├── sip.ts          # Main client
│   │   └── proofs/         # Proof providers
│   │       ├── interface.ts
│   │       └── mock.ts
│   └── tests/              # Test coverage
├── types/                  # Type definitions
└── circuits/               # Noir ZK circuits
    ├── funding_proof/
    ├── validity_proof/
    └── fulfillment_proof/
```

### Dependencies

| Dependency | Version | Purpose | Audit Status |
|------------|---------|---------|--------------|
| @noble/curves | ^1.2.0 | ECC operations | Audited (Trail of Bits) |
| @noble/hashes | ^1.3.2 | Hash functions | Audited (Trail of Bits) |
| Noir | 1.0.0-beta.15 | ZK circuits | Aztec-maintained |

### Entry Points

1. `createSIP()` - SDK initialization
2. `intent()` - Intent builder
3. `generateStealthKeys()` - Key generation
4. `commit()` - Commitment creation
5. `generateProof()` - Proof generation

---

## Checklist

### 1. Key Generation and Handling

#### 1.1 Random Number Generation

- [ ] **File**: `commitment.ts:generateBlinding()`
- [ ] Verify uses `crypto.getRandomValues()`
- [ ] Check for rejection sampling (values >= curve order)
- [ ] Verify no fallback to weak RNG

```typescript
// Expected pattern
const bytes = crypto.getRandomValues(new Uint8Array(32))
// Should reject if >= curve order
```

- [ ] **File**: `stealth.ts:generateStealthMetaAddress()`
- [ ] Private key generation uses secure random
- [ ] No key reuse between spending/viewing keys

#### 1.2 Key Storage

- [ ] Keys never logged or console.logged
- [ ] Keys not stored in global state
- [ ] Session storage cleared appropriately

#### 1.3 Key Derivation

- [ ] **File**: `stealth.ts:deriveStealthPrivateKey()`
- [ ] ECDH uses validated points
- [ ] Hash output properly reduced mod n
- [ ] No timing leaks in derivation

### 2. Commitment Scheme

#### 2.1 NUMS Generator

- [ ] **File**: `commitment.ts:getH()` (or similar)
- [ ] H is derived from hash-to-curve
- [ ] Derivation is deterministic and documented
- [ ] No discrete log relation to G is known

```typescript
// Expected: H = hashToCurve("SIP_PEDERSEN_H_GENERATOR_V1")
```

#### 2.2 Commitment Creation

- [ ] **File**: `commitment.ts:commit()`
- [ ] Value range validation (0 ≤ v < n)
- [ ] Blinding factor is fresh random or provided
- [ ] Point multiplication is constant-time (via noble/curves)

#### 2.3 Commitment Verification

- [ ] **File**: `commitment.ts:verifyOpening()`
- [ ] Recomputes commitment from opening
- [ ] Uses constant-time comparison
- [ ] Handles edge cases (zero value, etc.)

#### 2.4 Homomorphic Operations

- [ ] **File**: `commitment.ts:addCommitments()`
- [ ] Point addition is correct
- [ ] **File**: `commitment.ts:subtractCommitments()`
- [ ] Handles identity point (result of C - C)
- [ ] Blinding operations match commitment operations

### 3. Stealth Address Protocol

#### 3.1 Meta-Address Generation

- [ ] **File**: `stealth.ts:generateStealthMetaAddress()`
- [ ] Spending and viewing keys are independent
- [ ] Public keys are correctly derived
- [ ] Format matches EIP-5564 specification

#### 3.2 Stealth Address Derivation

- [ ] **File**: `stealth.ts:generateStealthAddress()`
- [ ] Ephemeral key is fresh random
- [ ] ECDH performed correctly: S = r·K_view
- [ ] Scalar derivation: s = H(S)
- [ ] Address computation: P = K_spend + s·G

#### 3.3 Address Checking

- [ ] **File**: `stealth.ts:checkStealthAddress()`
- [ ] View tag optimization is correct
- [ ] Full verification when view tag matches
- [ ] No information leakage in negative case

#### 3.4 Private Key Recovery

- [ ] **File**: `stealth.ts:deriveStealthPrivateKey()`
- [ ] Correctly computes: p = k_spend + H(k_view·R)
- [ ] Result matches stealth address public key
- [ ] No timing variance based on input

### 4. Proof System

#### 4.1 Proof Interface

- [ ] **File**: `proofs/interface.ts`
- [ ] All proof types defined (funding, validity, fulfillment)
- [ ] Input validation on all parameters
- [ ] Error handling doesn't leak sensitive info

#### 4.2 Mock Provider (Development)

- [ ] **File**: `proofs/mock.ts`
- [ ] Clearly marked as NOT FOR PRODUCTION
- [ ] Cannot be accidentally used in production
- [ ] Validates inputs even in mock mode

#### 4.3 Noir Circuits

- [ ] **Directory**: `circuits/funding_proof/`
  - [ ] Correct constraint on balance ≥ minimum
  - [ ] Commitment verification is sound
  - [ ] Public inputs properly defined

- [ ] **Directory**: `circuits/validity_proof/`
  - [ ] Signature verification is correct
  - [ ] Nullifier derivation prevents replay
  - [ ] Time bounds enforced

- [ ] **Directory**: `circuits/fulfillment_proof/`
  - [ ] Output amount ≥ minimum verified
  - [ ] Time bounds checked
  - [ ] Commitment correctly verified

### 5. Intent Handling

#### 5.1 Intent Builder

- [ ] **File**: `intent.ts:IntentBuilder`
- [ ] All fields validated before building
- [ ] Intent ID generation is unique
- [ ] Privacy level correctly set

#### 5.2 Intent Signing

- [ ] Intent hash covers all fields
- [ ] Signature scheme is ECDSA (secp256k1)
- [ ] Replay protection via nonce/nullifier

#### 5.3 Intent Verification

- [ ] Signature verification before processing
- [ ] Expiry time checked
- [ ] Privacy requirements enforced

### 6. Privacy Features

#### 6.1 Viewing Keys

- [ ] **File**: `privacy.ts`
- [ ] Cannot derive spending key from viewing key
- [ ] Hierarchical derivation is correct
- [ ] Child keys cannot derive siblings/parents

#### 6.2 Privacy Levels

- [ ] TRANSPARENT: No privacy (baseline)
- [ ] SHIELDED: Full privacy (commitments + stealth)
- [ ] COMPLIANT: Privacy with viewing key disclosure

### 7. Error Handling

#### 7.1 Error Messages

- [ ] Errors don't reveal sensitive data
- [ ] Timing is uniform across error paths
- [ ] No stack traces in production

#### 7.2 Input Validation

- [ ] All external inputs validated
- [ ] Type checking enforced
- [ ] Range checks for numeric values

### 8. Test Coverage

#### 8.1 Unit Tests

- [ ] `tests/crypto/pedersen.test.ts` - 29 tests
- [ ] `tests/crypto/stealth.test.ts` - 21 tests
- [ ] `tests/proofs/mock-provider.test.ts` - 21 tests

#### 8.2 Integration Tests

- [ ] `tests/integration/full-flow.test.ts` - 16 tests

#### 8.3 Edge Cases

- [ ] Zero values handled
- [ ] Maximum values handled
- [ ] Invalid inputs rejected

### 9. Side-Channel Resistance

#### 9.1 Timing

- [ ] Constant-time ECC operations (noble/curves)
- [ ] Constant-time comparisons for secrets
- [ ] No early returns based on secret data

#### 9.2 Memory

- [ ] Keys zeroized after use (TODO - not implemented)
- [ ] No heap spraying vulnerabilities
- [ ] Garbage collection considerations

---

## Severity Classifications

| Severity | Description |
|----------|-------------|
| **Critical** | Direct loss of funds or privacy |
| **High** | Indirect path to fund/privacy loss |
| **Medium** | Security degradation |
| **Low** | Best practice violations |
| **Informational** | Suggestions and notes |

## Reporting Template

```markdown
## Finding: [Title]

**Severity**: Critical/High/Medium/Low/Informational

**Location**: `packages/sdk/src/file.ts:line`

**Description**:
[Detailed description of the issue]

**Impact**:
[What could happen if exploited]

**Proof of Concept**:
[Steps or code to reproduce]

**Recommendation**:
[How to fix]
```

## Contact

For questions during audit:
- Repository: https://github.com/RECTOR-LABS/sip-protocol
- Issues: Use GitHub issues with "security" label

## Post-Audit

After audit completion:
1. All Critical/High findings must be fixed
2. Medium findings should be fixed or documented
3. Re-audit of fixes recommended
4. Public disclosure timeline agreed
