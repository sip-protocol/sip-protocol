# Security Audit Scope Document

**Project:** SIP Protocol (Shielded Intents Protocol)
**Version:** 0.1.0
**Date:** November 28, 2025
**Status:** Ready for External Audit

---

## Executive Summary

SIP Protocol is a privacy layer for cross-chain transactions built on NEAR Intents. The SDK provides cryptographic primitives for stealth addresses, Pedersen commitments, and viewing keys to enable privacy-preserving cross-chain swaps.

**Audit Objectives:**
1. Verify cryptographic implementation correctness
2. Identify vulnerabilities in privacy guarantees
3. Assess code quality and security practices
4. Validate threat model assumptions

---

## Audit Scope

### In-Scope Components

#### Priority 1: Core Cryptography (Critical)

| File | Lines | Description | Risk |
|------|-------|-------------|------|
| `packages/sdk/src/commitment.ts` | ~470 | Pedersen commitments, NUMS generator | Critical |
| `packages/sdk/src/stealth.ts` | ~415 | EIP-5564 stealth addresses | Critical |
| `packages/sdk/src/privacy.ts` | ~340 | Viewing keys, XChaCha20-Poly1305 encryption | Critical |
| `packages/sdk/src/crypto.ts` | ~84 | Hash utilities, commitment wrappers | High |
| `packages/sdk/src/secure-memory.ts` | ~120 | Memory zeroization utilities | Critical |

**Focus Areas:**
- NUMS generator construction (nothing-up-my-sleeve)
- Pedersen commitment hiding/binding properties
- Stealth address unlinkability
- ECDH key exchange correctness
- XChaCha20-Poly1305 encryption implementation
- Random number generation (CSPRNG usage)

#### Priority 2: Validation & Error Handling (High)

| File | Lines | Description | Risk |
|------|-------|-------------|------|
| `packages/sdk/src/validation.ts` | ~400 | Input validation for all public APIs | High |
| `packages/sdk/src/errors.ts` | ~470 | Error hierarchy, no info leakage | Medium |

**Focus Areas:**
- Input validation completeness
- Error message content (no sensitive data)
- Type safety enforcement

#### Priority 3: Intent System (High)

| File | Lines | Description | Risk |
|------|-------|-------------|------|
| `packages/sdk/src/intent.ts` | ~490 | Intent builder, shielded intent creation | High |
| `packages/sdk/src/sip.ts` | ~230 | Main SIP client class | Medium |

**Focus Areas:**
- Intent ID uniqueness
- Privacy level enforcement
- Proof requirement validation

#### Priority 4: Proof System (Medium)

| File | Lines | Description | Risk |
|------|-------|-------------|------|
| `packages/sdk/src/proofs/interface.ts` | ~200 | Proof provider interface | Medium |
| `packages/sdk/src/proofs/mock.ts` | ~280 | Mock provider (dev only) | Low |
| `packages/sdk/src/proofs/noir.ts` | ~450 | Noir proof provider (real ZK) | High |

**Focus Areas:**
- Interface correctness for future Noir integration
- Mock provider cannot be used in production accidentally

#### Priority 5: Integrations (Medium)

| File | Lines | Description | Risk |
|------|-------|-------------|------|
| `packages/sdk/src/adapters/near-intents.ts` | ~350 | NEAR 1Click API integration | Medium |
| `packages/sdk/src/wallet/ethereum/adapter.ts` | ~650 | Ethereum wallet adapter | Medium |
| `packages/sdk/src/wallet/solana/adapter.ts` | ~530 | Solana wallet adapter | Medium |

**Focus Areas:**
- No sensitive data exposure in API calls
- Proper error handling for external services

### Out of Scope

| Component | Reason |
|-----------|--------|
| `apps/demo/` | Demo application, not production code |
| `packages/types/` | Type definitions only, no runtime code |
| `packages/sdk/src/zcash/` | Zcash integration (optional feature) |
| `packages/sdk/src/solver/` | Mock solver for testing only |
| Test files (`tests/`) | Test code, not production |
| Build configuration | Not security-critical |

**Note:** `packages/sdk/src/proofs/noir.ts` was previously out of scope but is now **in scope** after full implementation.

---

## Codebase Statistics

### Lines of Code (Production)

```
Core Cryptography:     ~1,420 lines (+secure-memory.ts)
Validation/Errors:       ~870 lines
Intent System:           ~720 lines
Proof System:            ~930 lines (+noir.ts)
Integrations:          ~1,530 lines
─────────────────────────────────
Total In-Scope:        ~5,470 lines
```

### Test Coverage

```
Overall:     89.88% statements
             84.91% branches
             89.05% functions
             89.88% lines

Core Files:
- validation.ts:  100%
- errors.ts:      100%
- commitment.ts:   93%
- stealth.ts:      82%
- privacy.ts:      88%
```

### Dependencies

| Dependency | Version | Purpose | Prior Audits |
|------------|---------|---------|--------------|
| @noble/curves | ^1.3.0 | secp256k1 ECC | Trail of Bits |
| @noble/hashes | ^1.3.3 | SHA256, HKDF | Trail of Bits |
| @noble/ciphers | ^2.0.1 | XChaCha20-Poly1305 | Trail of Bits |

---

## Security Properties to Verify

### 1. Commitment Scheme

| Property | Description | Verification Method |
|----------|-------------|---------------------|
| Hiding | Commitment reveals nothing about value | Mathematical proof review |
| Binding | Cannot open to different value | ECDLP assumption check |
| Homomorphic | C(a) + C(b) = C(a+b) | Unit test verification |

### 2. Stealth Addresses

| Property | Description | Verification Method |
|----------|-------------|---------------------|
| Unlinkability | Different addresses cannot be linked | Protocol analysis |
| Correctness | Recipient can derive private key | Round-trip testing |
| Scanning | View tag optimization doesn't leak | Information analysis |

### 3. Encryption

| Property | Description | Verification Method |
|----------|-------------|---------------------|
| Confidentiality | Only key holder can decrypt | Standard AEAD properties |
| Integrity | Tampering detected | Authentication tag |
| Nonce-safety | 24-byte random nonces | Implementation review |

### 4. Key Management

| Property | Description | Verification Method |
|----------|-------------|---------------------|
| Separation | Viewing key cannot derive spending | Key derivation review |
| Randomness | Keys from CSPRNG | RNG source verification |
| No leakage | Keys not in logs/errors | Code search |

---

## Known Limitations (Pre-Disclosed)

1. ~~**Memory Zeroization**~~: ✅ **Implemented in v0.1.1** - `secure-memory.ts` provides defense-in-depth wiping (random overwrite + zero)

2. ~~**Noir Circuits**~~: ✅ **Implemented in v0.2.0** - Full Noir circuits for Funding, Validity, and Fulfillment proofs

3. **Timing Attacks**: Relies on @noble/* constant-time operations; SDK code not independently verified for constant-time

4. **View Tag**: 8-bit view tag reveals 8 bits of shared secret (documented trade-off for scanning efficiency)

5. **TODOs in Code**:
   - ~~`noir.ts`: Circuit implementations~~ ✅ **Implemented**
   - `shielded-service.ts:376`: Zcash fee estimation (minor)

See `docs/security/KNOWN_LIMITATIONS.md` for full details.

---

## Deliverables Expected

### From Auditors

1. **Findings Report**
   - Severity classification (Critical/High/Medium/Low/Info)
   - Detailed descriptions with PoC where applicable
   - Remediation recommendations

2. **Code Quality Assessment**
   - Architecture feedback
   - Best practices recommendations

3. **Cryptographic Analysis**
   - Verification of security properties
   - Parameter/assumption validation

### From SIP Team

1. **Response to Findings**
   - Fix implementation for Critical/High
   - Documentation for accepted risks
   - Timeline for Medium/Low fixes

2. **Re-audit** (if needed)
   - For Critical/High finding fixes

---

## Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Kickoff | 1 day | Codebase walkthrough, Q&A |
| Review | 2-3 weeks | Code review, analysis |
| Draft Report | 3 days | Initial findings delivery |
| Response | 1 week | Team fixes Critical/High |
| Final Report | 3 days | Updated report with fixes |

**Total Estimated:** 4-5 weeks

---

## Budget Considerations

### Audit Cost Estimates

| Tier | Auditor Type | Estimated Cost | Timeline |
|------|--------------|----------------|----------|
| Premium | Trail of Bits, OpenZeppelin | $80,000-150,000 | 4-6 weeks |
| Mid-tier | Zellic, Consensys Diligence | $40,000-80,000 | 3-5 weeks |
| Independent | Solo cryptographers | $15,000-40,000 | 2-4 weeks |
| Community | Code4rena, Sherlock | $20,000-50,000 | 2-3 weeks |

### Recommended Approach

Given SIP's focus on cryptographic primitives:

1. **Phase 1**: Independent cryptographer review (~$20-30k)
   - Focus on commitment.ts, stealth.ts, privacy.ts
   - Mathematical correctness verification

2. **Phase 2**: Full audit when circuits ready (~$50-80k)
   - Include Noir circuits
   - Full integration review

---

## Contact Information

**Technical Contact:** RECTOR (Project Lead)
**Repository:** https://github.com/sip-protocol/sip-protocol
**Communication:** GitHub Issues (label: security)

---

## Appendix: File Checksums

Generated at commit: `5061db8`

```
SHA256 Checksums (In-Scope Files):

packages/sdk/src/commitment.ts
packages/sdk/src/stealth.ts
packages/sdk/src/privacy.ts
packages/sdk/src/crypto.ts
packages/sdk/src/validation.ts
packages/sdk/src/errors.ts
packages/sdk/src/intent.ts
packages/sdk/src/sip.ts
packages/sdk/src/proofs/interface.ts
packages/sdk/src/proofs/mock.ts

(Run: find packages/sdk/src -name "*.ts" -exec sha256sum {} \;)
```
