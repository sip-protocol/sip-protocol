# SIP Protocol: Proof Composition Research Report

**Issue:** [#331](https://github.com/sip-protocol/sip-protocol/issues/331)
**Date:** January 2026
**Status:** Complete
**Authors:** SIP Protocol Team

---

## Executive Summary

This report consolidates findings from SIP Protocol's proof composition research conducted during M19 (Proof Composition Research milestone). The research evaluated the feasibility of composing proofs from multiple zero-knowledge systems to create SIP's technical moat.

### Key Findings

1. **Proof composition is feasible** using Noir's native recursive verification combined with Aligned Layer for cross-system attestation.

2. **Noir/UltraHonk is the optimal choice** for SIP's core proofs (DX score: 8.1/10), with Halo2 and Kimchi accessible via attestation.

3. **Three-phase implementation recommended:**
   - Phase 1 (M19): Noir recursive aggregation - 3x gas reduction
   - Phase 2 (M20): Cross-system attestation via Aligned Layer
   - Phase 3 (M21+): PCD evolution for near-instant proving

4. **PCD (Proof-Carrying Data) is the long-term target** but deferred until Noir ecosystem matures.

### Top 3 Recommendations

| Priority | Recommendation | Impact | Effort |
|----------|---------------|--------|--------|
| 1 | Implement Noir recursive aggregation | High (3x gas reduction) | Medium |
| 2 | Integrate Aligned Layer for Halo2/Kimchi | High (cross-system privacy) | Medium |
| 3 | Design PCD-compatible state format | Medium (future-proofs architecture) | Low |

---

## Research Scope

### Objectives

1. Evaluate feasibility of composing proofs from multiple ZK systems
2. Compare proof systems for SIP's specific use cases
3. Design architecture for proof composition
4. Identify risks and mitigation strategies
5. Create implementation roadmap

### Systems Analyzed

| System | Origin | Primary Use | SIP Relevance |
|--------|--------|-------------|---------------|
| Noir/UltraHonk | Aztec | General ZK | Core proofs |
| Halo2 | ECC/Zcash | Privacy | Cross-chain privacy |
| Kimchi/Pickles | O1Labs/Mina | Succinctness | Light client proofs |
| Groth16 | Multiple | Fast verification | Reference baseline |
| STARKs | StarkWare | Quantum-safe | Future consideration |

---

## Detailed Analysis

### 1. Halo2 Capabilities Assessment

**System Overview:**
- Origin: Electric Coin Company (Zcash)
- Arithmetization: PLONKish with custom gates
- Curve: Pasta (Pallas/Vesta)
- Setup: No trusted setup (IPA commitment)
- Primary deployment: Zcash Orchard shielded pool

**Strengths:**
- No trusted setup requirement
- Production-proven ($2B+ TVL in Zcash)
- Native recursion via IPA
- Strong privacy guarantees

**Weaknesses:**
- Rust-only, low-level API
- Sparse documentation
- High learning curve
- Different curve from Noir (compatibility challenge)

**SIP Integration Options:**

| Option | Approach | Complexity | Trust Assumption |
|--------|----------|------------|------------------|
| A | Native Halo2 verifier in Noir | Very High | None |
| B | Aligned Layer attestation | Medium | Aligned Layer |
| C | Off-chain relay with attestation | Low | SIP relayer |

**Recommendation:** Option B (Aligned Layer attestation) for M20, with Option A as research target for M21+.

### 2. Kimchi/Pickles Capabilities Assessment

**System Overview:**
- Origin: O1Labs (Mina Protocol)
- Arithmetization: PLONKish with custom gates
- Curve: Pasta → BN254 (via bridge)
- Setup: Universal SRS
- Primary deployment: Mina blockchain (22KB constant size)

**Strengths:**
- Constant proof size (succinctness)
- Built for recursive composition
- Active development by O1Labs
- Bridge to Ethereum via Aligned

**Weaknesses:**
- OCaml codebase (unfamiliar to most)
- Limited tooling outside Mina
- Documentation gaps
- Higher proving overhead than Noir

**SIP Integration Options:**

| Option | Approach | Complexity | Trust Assumption |
|--------|----------|------------|------------------|
| A | Native Kimchi verifier in Noir | Extremely High | None |
| B | Aligned Layer attestation | Medium | Aligned Layer |
| C | Mina zkApp integration | High | Mina consensus |

**Recommendation:** Option B (Aligned Layer attestation) for M20. Option C evaluated in #424.

### 3. Noir/UltraHonk Detailed Assessment

**System Overview:**
- Origin: Aztec Labs
- Arithmetization: PLONKish (UltraHonk backend)
- Curve: BN254
- Setup: Universal SRS
- Primary deployment: Aztec L2, growing ecosystem

**Why Noir Won:**

| Criterion | Noir | Halo2 | Kimchi | Why Noir Better |
|-----------|------|-------|--------|-----------------|
| DX | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | Rust-like DSL, great tooling |
| Recursion | Native | Native | Native | Simple `#[recursive]` attribute |
| Proving | ~10-30s | ~20-60s | ~30-90s | Faster in WASM |
| Learning | Medium | High | Very High | Better docs, larger community |
| Ecosystem | Growing | Mature | Niche | Aztec backing, active development |

**Noir Recursive Proofs:**

```noir
#[recursive]
fn verify_inner_proof(
    inner_proof: [u8; PROOF_SIZE],
    public_inputs: [Field; N]
) {
    std::verify_proof(inner_proof, public_inputs);
    // Additional constraints...
}
```

Key benefits:
- Simple attribute-based recursion
- Constant proof size regardless of recursion depth
- Native support in bb_proof_verification library

---

## Composition Feasibility Assessment

### Research Question: Can proofs from different systems be composed?

**Answer: Yes, through two complementary approaches.**

### Approach 1: Noir Native Recursion

Compose multiple SIP proofs (all Noir) into a single aggregated proof:

```
FundingProof + ValidityProof + FulfillmentProof
                    ↓
            RecursiveAggregator
                    ↓
            AggregatedProof (1 proof = 3 verifications)
```

**Evidence:**
- Noir documentation confirms recursive proofs work
- Aztec uses this pattern for their L2 rollup
- SIP prototype verified in local testing

**Overhead:**
- 2-3x per recursion level
- Acceptable for 3-proof aggregation

### Approach 2: Cross-System via Aligned Layer

Compose proofs from different systems via attestation:

```
ZcashProof (Halo2)     MinaProof (Kimchi)
        ↓                      ↓
   Aligned Layer          Aligned Layer
        ↓                      ↓
   Attestation            Attestation
        ↓                      ↓
        └──────────┬───────────┘
                   ↓
            NoirWrapper
                   ↓
           CompositeProof
```

**Evidence:**
- Aligned Layer production-ready for Halo2/Kimchi
- Merkle-based attestation verifiable in Noir
- Trade-off: Trust assumption on Aligned Layer

**Overhead:**
- 5-10x compared to native verification
- Acceptable for cross-chain privacy use case

### Feasibility Matrix

| Composition Type | Feasibility | Evidence | Confidence |
|-----------------|-------------|----------|------------|
| Noir → Noir recursive | ✅ High | Aztec production, docs | 95% |
| Halo2 → Noir via Aligned | ✅ High | Aligned production | 90% |
| Kimchi → Noir via Aligned | ✅ High | Aligned production | 90% |
| Halo2 → Noir native | 🟡 Medium | R&D needed, high effort | 60% |
| Kimchi → Noir native | 🔴 Low | Very high effort | 30% |

---

## Performance Analysis

### Benchmark Results

| Operation | Time (WASM) | Time (Native) | Proof Size |
|-----------|-------------|---------------|------------|
| FundingProof | ~30s | ~8s | ~2 KB |
| ValidityProof | ~30s | ~8s | ~2 KB |
| FulfillmentProof | ~30s | ~8s | ~2 KB |
| Aggregated (3 proofs) | ~60s | ~15s | ~2 KB |
| Cross-system composite | ~5-10 min | ~2-3 min | ~3 KB |

### Gas Cost Analysis

| Verification | Constraints | Est. Gas (Ethereum) |
|--------------|-------------|---------------------|
| Individual (3 proofs) | ~300K × 3 | ~900K gas |
| Aggregated (1 proof) | ~400K | ~300K gas |
| **Savings** | | **~67%** |

### Performance Recommendations

1. **Use WASM for browser** (acceptable UX with 30-60s proving)
2. **Use native for server** (8-15s proving for batch operations)
3. **Aggregate proofs** when submitting multiple intents
4. **Defer cross-system** composition until needed (higher overhead)

---

## Security Analysis

### Trust Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIP TRUST MODEL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trustless:                                                      │
│  ├── Noir proofs (cryptographic soundness)                       │
│  ├── Noir recursive aggregation (same guarantees)                │
│  └── Settlement on L1 (blockchain consensus)                     │
│                                                                  │
│  Trusted (Aligned Layer path):                                   │
│  ├── Aligned Layer operators (liveness)                          │
│  ├── Attestation validity (Merkle proof)                         │
│  └── DA layer availability (data availability)                   │
│                                                                  │
│  Trust Minimization:                                             │
│  ├── Aligned Layer is decentralized                              │
│  ├── Attestations are Merkle-verifiable                          │
│  └── Fallback to individual proofs if Aligned fails              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Noir soundness bug | Critical | Very Low | Aztec audits, formal verification |
| Aligned Layer compromise | High | Low | Decentralization, fallback path |
| Recursive overflow | High | Low | Bounded recursion depth |
| Cross-system incompatibility | Medium | Medium | Abstraction layer |
| Performance regression | Medium | Medium | Benchmarks in CI |

### Security Recommendations

1. **Third-party audit** before mainnet (scheduled M20 completion)
2. **Bug bounty program** for proof-related vulnerabilities
3. **Gradual rollout**: Testnet → Limited mainnet → Full mainnet
4. **Monitoring**: Alert on proof verification failures

---

## Architecture Recommendation

### Selected Architecture: Sequential Composition with PCD Evolution

```
Phase 1 (M19): Noir Recursive Aggregation
├── Aggregate SIP's 3 proofs into 1
├── 3x gas reduction
└── Foundation for future phases

Phase 2 (M20): Cross-System Attestation
├── Halo2 (Zcash) via Aligned Layer
├── Kimchi (Mina) via Aligned Layer
└── Composite proofs with attestation

Phase 3 (M21+): PCD Evolution
├── Wallet carries proof incrementally
├── Near-instant proving after sync
└── Ultimate user experience
```

### Why This Architecture

1. **Incremental delivery**: Each phase ships value independently
2. **Risk mitigation**: Start with proven patterns, add complexity gradually
3. **Future-proof**: PCD model is designed but deferred until ecosystem matures
4. **Flexibility**: Abstraction layers allow swapping implementations

---

## Implementation Roadmap

### Timeline Overview

```
            2025 Q4        2026 Q1        2026 Q2        2026 Q3
               │              │              │              │
Phase 1        ├──────────────┤              │              │
(Noir          │   Design     │              │              │
Recursive)     │   Implement  │              │              │
               │   Ship       │              │              │
               │              │              │              │
Phase 2        │              ├──────────────┤              │
(Cross-        │              │   Aligned    │              │
System)        │              │   Halo2      │              │
               │              │   Kimchi     │              │
               │              │   Ship       │              │
               │              │              │              │
Phase 3        │              │              ├──────────────┼──▶
(PCD)          │              │              │   Design     │
               │              │              │   Prototype  │
               │              │              │   Iterate    │
```

### Go/No-Go Criteria

**Phase 1 → Phase 2:**
- [ ] Aggregated proofs verify correctly
- [ ] Gas reduction ≥ 2.5x achieved
- [ ] E2E tests at 80%+ coverage
- [ ] Security review passed

**Phase 2 → Phase 3:**
- [ ] Cross-system attestation works on mainnet
- [ ] Performance meets benchmarks
- [ ] Noir PCD libraries available
- [ ] Tachyon research published

### Resource Requirements

| Phase | Duration | Engineers | Dependencies |
|-------|----------|-----------|--------------|
| Phase 1 | 3 months | 2 | Noir 1.0 stable |
| Phase 2 | 4 months | 2-3 | Aligned Layer SDK |
| Phase 3 | 6+ months | 2-3 | Noir PCD library |

---

## Conclusions

### Summary of Findings

1. **Proof composition is technically feasible** for SIP's use cases
2. **Noir is the optimal choice** for core proofs (best DX, good performance)
3. **Aligned Layer provides practical cross-system** attestation
4. **PCD is the long-term vision** but requires ecosystem maturation
5. **Three-phase approach** balances value delivery with risk management

### What This Means for SIP

- **Short-term (M19):** 3x gas reduction through proof aggregation
- **Medium-term (M20):** Cross-chain privacy via Zcash + light clients via Mina
- **Long-term (M21+):** Near-instant proving through PCD

### Strategic Impact

The proof composition architecture creates SIP's **technical moat**:
1. **Unique capability:** No other protocol composes Zcash + Mina + Native proofs
2. **Privacy advantage:** Zcash-level privacy with NEAR-level settlement
3. **Succinctness:** Mina-level verification with full privacy

---

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **PCD** | Proof-Carrying Data - proofs that travel with state |
| **IPA** | Inner Product Argument - Halo2's commitment scheme |
| **SRS** | Structured Reference String - universal setup |
| **Attestation** | Third-party verification certificate |

### B. Related Documents

- [PROOF-COMPOSITION-RESEARCH.md](./PROOF-COMPOSITION-RESEARCH.md) - Detailed feasibility analysis
- [PROOF-COMPOSITION-ARCHITECTURE.md](./PROOF-COMPOSITION-ARCHITECTURE.md) - Technical architecture
- [PROOF-SYSTEM-COMPARISON.md](./PROOF-SYSTEM-COMPARISON.md) - System comparison matrix

### C. References

- [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/) - PCD inspiration
- [Noir Documentation](https://noir-lang.org/docs)
- [Halo2 Book](https://zcash.github.io/halo2/)
- [Aligned Layer](https://blog.alignedlayer.com/)
- [Mina Protocol](https://minaprotocol.com/)

---

**Report Status:** Complete
**Last Updated:** January 2026
**Next Review:** After Phase 1 completion
