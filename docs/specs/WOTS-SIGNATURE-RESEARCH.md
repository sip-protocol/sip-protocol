# WOTS+ Post-Quantum Signature Research

| Field | Value |
|-------|-------|
| **SIP** | 11 |
| **Title** | WOTS+ Post-Quantum Signatures for Stealth Address Claims |
| **Authors** | SIP Protocol Team |
| **Status** | Research |
| **Created** | 2026-01-12 |
| **Related** | [#491](https://github.com/sip-protocol/sip-protocol/issues/491), [SIP-10 QUANTUM-RESISTANT-STORAGE](./QUANTUM-RESISTANT-STORAGE.md) |

## Abstract

This document evaluates adding WOTS+ (Winternitz One-Time Signature Plus) support for post-quantum resistant signatures when claiming funds from SIP stealth addresses. The research concludes that **standalone WOTS+ implementation is NOT recommended** due to Solana's transaction size limits, but the existing [Winternitz Vault integration](./QUANTUM-RESISTANT-STORAGE.md) provides a superior alternative.

## Executive Summary

| Criterion | Finding | Verdict |
|-----------|---------|---------|
| Technical Feasibility | WOTS+ signature (2,144 bytes) exceeds Solana tx limit (1,232 bytes) | ❌ Blocked |
| Compute Cost | ~5,700 CU for verification (acceptable) | ✅ OK |
| Library Availability | Limited standalone libraries, mostly SPHINCS+ wrappers | ⚠️ Partial |
| User Demand | Marketing-driven, no urgent security need | ⚠️ Low |
| Alternative | Winternitz Vault (SIP-10) already provides quantum resistance | ✅ Better |

**Recommendation:** Do NOT implement standalone WOTS+ signatures. Instead, promote the existing Winternitz Vault integration (SIP-10) which solves the quantum resistance problem more elegantly.

---

## 1. Background

### 1.1 The Quantum Threat

Current blockchain signatures use elliptic curve cryptography:

| Algorithm | Classical Security | Quantum Attack | Post-Quantum Security |
|-----------|-------------------|----------------|----------------------|
| Ed25519 (Solana) | 128-bit | Shor's algorithm | ~0-bit (broken) |
| secp256k1 (Ethereum) | 128-bit | Shor's algorithm | ~0-bit (broken) |
| WOTS+ (hash-based) | 256-bit | Grover's algorithm | 128-bit (safe) |

Quantum computers capable of breaking Ed25519 are estimated 10-20 years away, but "harvest now, decrypt later" attacks make forward-looking security valuable.

### 1.2 Why WOTS+ for SIP?

SIP stealth addresses are **one-time use** — each payment creates a unique address that's claimed once. This aligns with WOTS+ constraints:

```
Traditional Wallet:
  Address A → Sign tx 1, Sign tx 2, Sign tx 3 (key reuse OK)

SIP Stealth Address:
  Stealth A → Sign claim tx (single use) ← WOTS+ compatible!
  Stealth B → Sign claim tx (single use) ← WOTS+ compatible!
```

### 1.3 Competitor Analysis

| Project | Post-Quantum Approach | Status |
|---------|----------------------|--------|
| Mochimo | WOTS+ native signatures | Production since 2018 |
| QRL | XMSS (uses WOTS+ internally) | Production |
| Obscura | Claims WOTS+ support | Unverified |
| SIP | Winternitz Vault integration | In development |

---

## 2. Technical Analysis

### 2.1 WOTS+ Parameters and Sizes

Per [RFC 8391](https://datatracker.ietf.org/doc/html/rfc8391), WOTS+ with standard parameters:

| Parameter | Value | Description |
|-----------|-------|-------------|
| n | 32 bytes | Hash output length (SHA-256) |
| w | 16 | Winternitz parameter (speed/size tradeoff) |
| len₁ | 64 | Message blocks |
| len₂ | 3 | Checksum blocks |
| len | 67 | Total chains |

**Resulting sizes:**

| Component | Size | Calculation |
|-----------|------|-------------|
| Private Key | 2,144 bytes | len × n = 67 × 32 |
| Public Key | 2,144 bytes | len × n = 67 × 32 |
| Signature | 2,144 bytes | len × n = 67 × 32 |

### 2.2 Solana Transaction Limits

| Limit | Value | Source |
|-------|-------|--------|
| Max transaction size | 1,232 bytes | IPv6 MTU - headers |
| Max signatures | 19 | 64 bytes each |
| Max accounts | ~35 | After signature space |
| Max compute units | 1,400,000 CU | Per transaction |

### 2.3 The Fundamental Problem

```
WOTS+ Signature Size:     2,144 bytes
Solana Transaction Limit: 1,232 bytes
                          ─────────────
Overflow:                   912 bytes ❌
```

**A WOTS+ signature alone exceeds Solana's transaction limit by 74%.**

### 2.4 Potential Workarounds

| Approach | Complexity | Drawbacks |
|----------|-----------|-----------|
| **Split across transactions** | High | Requires 2+ transactions, atomicity issues |
| **Store signature in account** | Medium | Extra rent cost, lookup overhead |
| **Use Address Lookup Tables** | Medium | Only helps with account addresses, not data |
| **Custom compression** | Very High | Non-standard, verification complexity |

None of these are practical for a simple claim operation.

### 2.5 Compute Unit Analysis

If we could fit the signature, verification cost would be acceptable:

```
SHA-256 cost per hash: 85 + (1 × bytes)
WOTS+ verification:    len × (w-1) × hash_cost (worst case)
                     = 67 × 15 × (85 + 32)
                     = 67 × 15 × 117
                     = 117,585 CU

Average case (~w/2 hashes per chain):
                     = 67 × 8 × 117
                     ≈ 62,712 CU
```

This is well under the 1.4M CU limit. **Compute is not the bottleneck — transaction size is.**

---

## 3. Library Ecosystem

### 3.1 TypeScript/JavaScript

| Library | WOTS+ Support | Notes |
|---------|---------------|-------|
| [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum) | Internal only | SPHINCS+ uses WOTS+ internally, not exposed |
| [node-pqclean](https://github.com/tniessen/node-pqclean) | Via SPHINCS+ | WASM bindings |
| Custom implementation | Possible | ~500 LOC based on RFC 8391 |

### 3.2 Rust (for Solana Programs)

| Crate | Notes |
|-------|-------|
| [hashsigs-rs](https://crates.io/crates/hashsigs-rs) | WOTS+ with Solana support mentioned |
| [pqc_sphincsplus](https://crates.io/crates/pqc_sphincsplus) | Full SPHINCS+ (WOTS+ internal) |
| [winternitz](https://github.com/psivesely/winternitz) | WOTS-T variant |

The `hashsigs-rs` crate is most promising for Solana integration.

### 3.3 NIST Standards

NIST finalized three post-quantum standards in August 2024:

| Standard | Algorithm | Type | Signature Size |
|----------|-----------|------|----------------|
| FIPS 203 (ML-KEM) | CRYSTALS-Kyber | Key encapsulation | N/A |
| FIPS 204 (ML-DSA) | CRYSTALS-Dilithium | Lattice signatures | ~2.4 KB |
| FIPS 205 (SLH-DSA) | SPHINCS+ | Hash-based signatures | 7.8+ KB |

**ML-DSA (Dilithium)** has smaller signatures (~2.4 KB) but still exceeds Solana's 1,232 byte limit.

---

## 4. Alternative: Winternitz Vault Integration (SIP-10)

The existing [QUANTUM-RESISTANT-STORAGE.md](./QUANTUM-RESISTANT-STORAGE.md) specification provides a superior solution:

### 4.1 How It Works

Instead of signing claim transactions with WOTS+, funds are stored in a Winternitz Vault:

```
┌─────────────────────────────────────────────────────────┐
│                    SIP + WINTERNITZ                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Sender ──▶ SIP Stealth Address ──▶ Winternitz Vault  │
│                                                         │
│   • Privacy: Stealth address hides recipient           │
│   • Amount: Pedersen commitment hides value            │
│   • Quantum: Vault protected by WOTS+ internally       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Advantages Over Direct WOTS+ Signatures

| Aspect | Direct WOTS+ Signatures | Winternitz Vault |
|--------|------------------------|------------------|
| Transaction size | ❌ Exceeds limit | ✅ Normal size |
| Implementation | Custom program needed | Existing vault program |
| Ecosystem | Non-standard | Leverages existing infra |
| Complexity | High | Medium |
| Timeline | 6+ months | Already specified |

### 4.3 Recommendation

**Prioritize Winternitz Vault integration (SIP-10) over standalone WOTS+ signatures.**

The vault approach:
1. Solves the transaction size problem (vault handles WOTS+ internally)
2. Leverages existing [solana-winternitz-vault](https://github.com/protocoldaemon-sec/solana-winternitz-vault)
3. Combines privacy (SIP) + quantum resistance (Winternitz)
4. Already has a detailed specification

---

## 5. Comparison: WOTS+ vs Alternatives

### 5.1 Post-Quantum Signature Comparison

| Scheme | Signature | Public Key | Speed | Solana Compatible |
|--------|-----------|------------|-------|-------------------|
| Ed25519 (current) | 64 B | 32 B | Fast | ✅ Native |
| WOTS+ (n=32, w=16) | 2,144 B | 2,144 B | Medium | ❌ Too large |
| ML-DSA (Dilithium) | 2,420 B | 1,312 B | Fast | ❌ Too large |
| SPHINCS+-128s | 7,856 B | 32 B | Slow | ❌ Way too large |
| SPHINCS+-128f | 17,088 B | 32 B | Medium | ❌ Way too large |

### 5.2 Verdict

**No post-quantum signature scheme fits within Solana's 1,232 byte transaction limit.**

This is a fundamental constraint of Solana's architecture, not a SIP-specific problem.

---

## 6. Decision Framework

### 6.1 Should SIP Implement Standalone WOTS+ Signatures?

| Criterion | Assessment | Weight |
|-----------|------------|--------|
| Technical feasibility | ❌ Blocked by tx size | Critical |
| Compute cost | ✅ Acceptable (~60K CU) | Low |
| Library maturity | ⚠️ Limited options | Medium |
| User demand | ⚠️ Marketing-driven | Low |
| Alternative exists | ✅ Winternitz Vault | High |

**Decision: NO — Do not implement standalone WOTS+ signatures.**

### 6.2 What Should SIP Do Instead?

1. **Complete Winternitz Vault integration (SIP-10)** — Already specified
2. **Promote quantum-resistant storage** — Marketing differentiator
3. **Monitor Solana upgrades** — Future tx size increases could enable this
4. **Track ML-DSA ecosystem** — May become viable with compression techniques

---

## 7. Marketing Implications

### 7.1 What We CAN Claim

> "SIP Protocol supports quantum-resistant storage through Winternitz Vault integration, protecting your privacy-shielded funds against future quantum attacks."

### 7.2 What We Should NOT Claim

> ~~"SIP uses WOTS+ post-quantum signatures for all transactions."~~ (Not accurate)

### 7.3 Comparison with Competitors

| Claim | Mochimo | SIP |
|-------|---------|-----|
| "Post-quantum signatures" | ✅ Native WOTS+ | ❌ Not feasible on Solana |
| "Quantum-resistant storage" | ❌ Not a feature | ✅ Via Winternitz Vault |
| "Privacy + Quantum" | ❌ No privacy | ✅ Both |

SIP's unique value is **privacy + quantum resistance**, not just quantum resistance.

---

## 8. Future Considerations

### 8.1 Solana Transaction Size Increases

If Solana increases transaction limits (e.g., to 4 KB), WOTS+ becomes viable:

```
Required for WOTS+:  2,144 bytes (signature)
                   +   200 bytes (tx overhead)
                   = 2,344 bytes minimum

Current limit:       1,232 bytes ❌
4 KB limit:          4,096 bytes ✅
```

**Action:** Monitor [Solana RFCs](https://github.com/solana-foundation/solana-improvement-documents) for transaction size proposals.

### 8.2 Compressed Signatures

Research into compressed WOTS+ variants (CS-WOTS+ in SPHINCS-alpha) may reduce signature sizes:

- SPHINCS-alpha proposes optimizations
- Could potentially reduce to ~1.5 KB
- Still exceeds current Solana limit

### 8.3 Account-Based Signatures

Future work could explore storing signatures in accounts:

```
1. Store WOTS+ signature in PDA (2,144 bytes)
2. Claim transaction references PDA (32 bytes)
3. On-chain program verifies signature from account
```

This adds complexity and rent costs but could work.

---

## 9. Conclusion

### 9.1 Summary

| Question | Answer |
|----------|--------|
| Can SIP use WOTS+ signatures? | ❌ Not directly (tx size limit) |
| Is there a workaround? | ⚠️ Complex, not practical |
| What should SIP do? | ✅ Use Winternitz Vault (SIP-10) |
| Is quantum resistance achievable? | ✅ Yes, via vault integration |

### 9.2 Recommendations

1. **Close issue #491** with "won't implement" — fundamental blocker
2. **Prioritize SIP-10** (Winternitz Vault integration) for M17/M20
3. **Update marketing** to emphasize vault-based quantum resistance
4. **Revisit** if Solana increases transaction size limits

### 9.3 Final Verdict

**WOTS+ standalone signatures: NOT RECOMMENDED**

The Winternitz Vault integration already provides quantum resistance in a Solana-compatible way. Direct WOTS+ signatures are blocked by fundamental protocol constraints.

---

## References

1. [RFC 8391 - XMSS: eXtended Merkle Signature Scheme](https://datatracker.ietf.org/doc/html/rfc8391)
2. [NIST FIPS 205 - SLH-DSA (SPHINCS+)](https://csrc.nist.gov/pubs/fips/205/final)
3. [NIST FIPS 204 - ML-DSA (Dilithium)](https://csrc.nist.gov/pubs/fips/204/final)
4. [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum)
5. [hashsigs-rs Rust crate](https://crates.io/crates/hashsigs-rs)
6. [Solana Transaction Size Limits](https://solana.com/docs/core/transactions)
7. [Mochimo WOTS+ Implementation](https://medium.com/mochimo-official/wots-in-mochimo-post-quantum-resistant-blockchain-0b6d6865bb3c)
8. [SIP-10: Quantum-Resistant Storage](./QUANTUM-RESISTANT-STORAGE.md)

---

## Appendix A: WOTS+ Size Calculation

```python
# WOTS+ parameter calculation per RFC 8391
n = 32       # bytes (SHA-256 output)
w = 16       # Winternitz parameter

# Message length
len1 = ceil((n * 8) / log2(w))  # = ceil(256/4) = 64

# Checksum length
len2 = floor(log2(len1 * (w - 1)) / log2(w)) + 1  # = floor(9.9/4) + 1 = 3

# Total length
len = len1 + len2  # = 67

# Sizes
signature_size = len * n  # = 67 * 32 = 2,144 bytes
public_key_size = len * n  # = 67 * 32 = 2,144 bytes
private_key_size = len * n  # = 67 * 32 = 2,144 bytes
```

## Appendix B: Compute Unit Estimation

```python
# Solana SHA-256 costs
sha256_base = 85      # CU
sha256_per_byte = 1   # CU per byte

# WOTS+ verification (average case)
chains = 67           # len
avg_hashes_per_chain = 8  # w/2
bytes_per_hash = 32   # n

hash_cost = sha256_base + (sha256_per_byte * bytes_per_hash)  # = 117 CU
total_hashes = chains * avg_hashes_per_chain  # = 536
total_cu = total_hashes * hash_cost  # = 62,712 CU

# Well under 1.4M limit
```
