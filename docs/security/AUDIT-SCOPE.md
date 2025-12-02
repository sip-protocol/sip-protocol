# Audit Scope: SIP Protocol SDK

| Field | Value |
|-------|-------|
| **Document** | AUDIT-SCOPE-001 |
| **Version** | 1.0.0 |
| **Date** | 2025-12-02 |
| **Target** | @sip-protocol/sdk v0.1.x |

## Purpose

This document defines the scope for a formal security audit of the SIP Protocol SDK. It identifies critical components, priorities, and specific areas requiring external review.

## 1. Audit Priorities

### Priority 1: Critical (Must Audit Before Mainnet)

| Component | Files | Lines | Complexity | Notes |
|-----------|-------|-------|------------|-------|
| ed25519 Stealth Addresses | `stealth.ts` | 782-1046 | High | Novel implementation |
| Stealth Key Derivation | `stealth.ts` | 237-298, 879-958 | High | Fund recovery |
| Pedersen H Generator | `commitment.ts` | 95-130 | Medium | Binding property |
| Noir Circuits | `circuits/` | TBD | High | Proof soundness |

**Estimated Audit Effort**: 2-3 weeks

### Priority 2: High (Audit Before Production)

| Component | Files | Lines | Complexity | Notes |
|-----------|-------|-------|------------|-------|
| secp256k1 Stealth Addresses | `stealth.ts` | 46-371 | Medium | EIP-5564 style |
| Pedersen Commitments | `commitment.ts` | 158-267 | Medium | Homomorphic ops |
| Encryption/Decryption | `privacy.ts` | 252-394 | Medium | XChaCha20 |
| Key Derivation | `privacy.ts` | 131-171, 195-213 | Medium | HKDF, HMAC |

**Estimated Audit Effort**: 1-2 weeks

### Priority 3: Medium (Audit Before Scale)

| Component | Files | Lines | Complexity | Notes |
|-----------|-------|-------|------------|-------|
| Input Validation | `validation.ts` | All | Low | Boundary checks |
| Secure Memory | `secure-memory.ts` | All | Low | Memory wiping |
| Error Handling | `errors.ts` | All | Low | Error codes |

**Estimated Audit Effort**: 3-5 days

## 2. Specific Audit Questions

### 2.1 ed25519 Stealth Addresses

1. Is the DKSAP adaptation to ed25519 cryptographically sound?
2. Are scalar reductions (mod L) handled correctly?
3. Can zero-scalar edge cases lead to key compromise?
4. Is the shared secret computation equivalent to secp256k1 version?
5. Are there timing side-channels in scalar operations?

**Relevant Code**:
```typescript
// stealth.ts:803-807 - Scalar reduction
const rawEphemeralScalar = getEd25519Scalar(ephemeralPrivateKey)
const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER
if (ephemeralScalar === 0n) {
  throw new Error('CRITICAL: Zero ephemeral scalar')
}
```

### 2.2 Pedersen Generator H

1. Is the NUMS construction sound?
2. Can an attacker influence H generation?
3. Is the domain separator unique and collision-free?
4. Are there any weak points that could reveal log_G(H)?

**Relevant Code**:
```typescript
// commitment.ts:95-130 - H generation
const H_DOMAIN = 'SIP-PEDERSEN-GENERATOR-H-v1'
function generateH(): typeof G {
  // hash-to-curve with try-and-increment
}
```

### 2.3 Key Derivation

1. Is HKDF used correctly with proper domain separation?
2. Is HMAC-SHA512 for child keys secure?
3. Are derived keys properly independent?
4. Is key material properly zeroized after use?

### 2.4 Encryption

1. Is XChaCha20-Poly1305 configured correctly?
2. Is the 24-byte nonce sufficient for random generation?
3. Is AEAD authentication properly verified?
4. Are there any ciphertext malleability issues?

## 3. Out of Scope

The following are explicitly **out of scope** for this audit:

| Component | Reason |
|-----------|--------|
| @noble/curves | Already audited by Cure53 |
| @noble/hashes | Already audited by Cure53 |
| @noble/ciphers | Already audited by Cure53 |
| @aztec/bb.js | Audited by Aztec |
| Network transport | Handled by integrators |
| Smart contracts | Not in SDK |
| Web UI | Separate codebase |

## 4. Test Vectors

Auditors should verify these test vectors:

### 4.1 Pedersen Commitment

```
Input:
  value: 1000n
  blinding: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

Expected:
  - Commitment is deterministic
  - verifyOpening returns true
  - Different blinding produces different commitment
```

### 4.2 Stealth Address (secp256k1)

```
Input:
  spendingKey: 0x02... (valid compressed)
  viewingKey: 0x03... (valid compressed)

Expected:
  - Generated address is valid compressed point
  - checkStealthAddress returns true for correct keys
  - checkStealthAddress returns false for wrong keys
```

### 4.3 Stealth Address (ed25519)

```
Input:
  chain: 'solana'

Expected:
  - Generated address is 32 bytes
  - Derived private key produces correct public key via scalar multiplication
  - Round-trip works: generate → derive → verify
```

### 4.4 Encryption

```
Input:
  data: { sender: '0x...', recipient: '0x...', amount: '100', timestamp: 123 }
  viewingKey: { key: '0x...', path: 'm/0', hash: '0x...' }

Expected:
  - Ciphertext is non-deterministic (random nonce)
  - Decryption recovers original data
  - Wrong key throws DECRYPTION_FAILED
  - Tampered ciphertext throws DECRYPTION_FAILED
```

## 5. Deliverables Expected

### 5.1 Audit Report

1. Executive summary with risk rating
2. Detailed findings with severity (Critical/High/Medium/Low/Info)
3. Proof-of-concept for any vulnerabilities
4. Recommended fixes
5. Re-audit of fixes

### 5.2 Severity Definitions

| Severity | Definition |
|----------|------------|
| **Critical** | Direct fund loss, key compromise, proof forgery |
| **High** | Privacy breach, denial of service, significant risk |
| **Medium** | Edge case issues, minor privacy leaks |
| **Low** | Best practice violations, code quality |
| **Informational** | Suggestions, optimizations |

## 6. Audit Firm Requirements

### 6.1 Qualifications

- Experience with elliptic curve cryptography
- Prior audits of ZK systems (Zcash, Aztec, etc.)
- Familiarity with TypeScript/JavaScript
- Understanding of stealth address protocols

### 6.2 Recommended Firms

| Firm | Specialty | Prior Work |
|------|-----------|------------|
| Trail of Bits | General crypto | Zcash, MakerDAO |
| NCC Group | ZK systems | Aztec, Ethereum |
| Least Authority | Privacy protocols | Zcash |
| Cure53 | Crypto libraries | @noble/* |
| OpenZeppelin | Smart contracts | Extensive |

## 7. Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Kickoff | 1 day | Scope review, codebase walkthrough |
| Review | 2-3 weeks | Code audit, test vector verification |
| Report | 3-5 days | Findings documentation |
| Fixes | 1 week | Implement remediations |
| Re-audit | 3-5 days | Verify fixes |
| **Total** | **5-6 weeks** | |

## 8. Budget Estimate

| Component | Estimate |
|-----------|----------|
| Priority 1 (Critical) | $30,000 - $50,000 |
| Priority 2 (High) | $15,000 - $25,000 |
| Priority 3 (Medium) | $5,000 - $10,000 |
| **Total** | **$50,000 - $85,000** |

*Note: Estimates based on 2024 market rates. Actual costs vary by firm.*

## 9. Contact

For audit inquiries:
- Email: security@sip-protocol.xyz
- GitHub: https://github.com/sip-protocol/sip-protocol

## Appendix: Code Metrics

```
packages/sdk/src/
├── stealth.ts        1,369 lines  (High priority)
├── commitment.ts       471 lines  (High priority)
├── privacy.ts          416 lines  (High priority)
├── validation.ts       409 lines  (Medium priority)
├── crypto.ts            94 lines  (Low - deprecated)
├── secure-memory.ts     ~50 lines (Medium priority)
├── errors.ts           ~100 lines (Low priority)
└── Total:            ~2,900 lines in scope
```

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-02 | 1.0.0 | Initial audit scope |
