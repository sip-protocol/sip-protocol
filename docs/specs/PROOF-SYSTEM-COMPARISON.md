# Proof System Comparison Matrix

**Issue:** [#343](https://github.com/sip-protocol/sip-protocol/issues/343)
**Date:** January 2026
**Status:** Complete
**Related:** [PROOF-COMPOSITION-RESEARCH.md](./PROOF-COMPOSITION-RESEARCH.md)

## Executive Summary

This document provides a comprehensive comparison of zero-knowledge proof systems analyzed for SIP Protocol's proof composition strategy. The matrix evaluates systems across performance, security, developer experience, and ecosystem maturity dimensions.

**Key Finding:** Noir (UltraHonk backend) is the optimal choice for SIP's core proofs, with Aligned Layer providing the bridge to Halo2/Kimchi when cross-system composition is needed.

---

## Proof Systems Overview

| System | Origin | Curve | Arithmetization | Primary Use Case |
|--------|--------|-------|-----------------|------------------|
| **Noir/UltraHonk** | Aztec | BN254 | PLONKish | General ZK development |
| **Halo2** | ECC/Zcash | Pasta (Pallas/Vesta) | PLONKish | Privacy (Zcash Orchard) |
| **Kimchi/Pickles** | O1Labs/Mina | Pasta → BN254 | PLONKish + Custom Gates | Succinct blockchain |
| **Groth16** | - | BN254 | R1CS | Trusted setup, fast verification |
| **PLONK** | Various | BN254/BLS | PLONKish | Universal setup |
| **STARKs** | StarkWare | Prime field | AIR | Post-quantum, large proofs |
| **Circom/SnarkJS** | iden3 | BN254 | R1CS | DSL for circuits |

---

## Comparison Matrix

### Performance Metrics

| System | Proof Size | Proving Time (simple) | Verification Time | Recursion Support |
|--------|------------|----------------------|-------------------|-------------------|
| **Noir/UltraHonk** | ~2 KB | ~10-30s | ~5ms | ✅ Native |
| **Halo2** | ~5-10 KB | ~20-60s | ~10ms | ✅ Native (IPA) |
| **Kimchi/Pickles** | ~22 KB constant | ~30-90s | ~10ms | ✅ Native |
| **Groth16** | ~200 bytes | ~20-40s | ~2ms | ⚠️ Limited |
| **PLONK** | ~800 bytes | ~15-45s | ~3ms | ✅ Possible |
| **STARKs** | ~100-400 KB | ~60-300s | ~50-200ms | ✅ Native |
| **Circom** | ~200 bytes (Groth16) | ~10-30s | ~2ms | ⚠️ Via wrapper |

**Notes:**
- Times are for circuits with ~100K constraints
- Noir/UltraHonk times are for WASM execution; native is 3-5x faster
- STARK proof sizes are significantly larger but post-quantum secure

### Security Properties

| System | Trusted Setup | Quantum Resistance | Audit Status | CVE History |
|--------|--------------|-------------------|--------------|-------------|
| **Noir/UltraHonk** | Universal (SRS) | ❌ | Aztec audited | Clean |
| **Halo2** | ❌ None (IPA) | ❌ | Multiple audits | Clean |
| **Kimchi/Pickles** | Universal (SRS) | ❌ | O1Labs audited | Clean |
| **Groth16** | Per-circuit | ❌ | Widely audited | Historical |
| **PLONK** | Universal (SRS) | ❌ | Varies | Varies |
| **STARKs** | ❌ None | ✅ | StarkWare audited | Clean |
| **Circom** | Per-circuit | ❌ | Varies | Historical issues |

**Trust Assumptions:**
- **No Setup (Best):** Halo2 IPA, STARKs
- **Universal Setup (Good):** Noir, Kimchi, PLONK
- **Per-Circuit Setup (Acceptable):** Groth16, Circom

### Developer Experience

| System | Language | Tooling | Documentation | Learning Curve |
|--------|----------|---------|---------------|----------------|
| **Noir** | Rust-like DSL | Excellent | Good | Medium |
| **Halo2** | Rust (low-level) | Good | Sparse | High |
| **Kimchi** | OCaml/Rust | Limited | Sparse | Very High |
| **Groth16** | Via tooling | Excellent | Excellent | Low |
| **PLONK** | Various | Good | Good | Medium |
| **STARKs** | Cairo/Custom | Good | Good | High |
| **Circom** | Circom DSL | Excellent | Excellent | Low |

**DX Rating (1-5):**
| System | IDE Support | Error Messages | Testing Tools | Overall DX |
|--------|-------------|----------------|---------------|-----------|
| Noir | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Halo2 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Kimchi | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| Circom | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cairo | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### Ecosystem Maturity

| System | Age | Production Usage | Community Size | Corporate Backing |
|--------|-----|-----------------|----------------|-------------------|
| **Noir** | 2022 | Aztec, Growing | Medium | Aztec Labs |
| **Halo2** | 2021 | Zcash Orchard | Large | ECC, Privacy-Scaling |
| **Kimchi** | 2021 | Mina Protocol | Medium | O1Labs |
| **Groth16** | 2016 | Zcash Sapling, Many | Very Large | Many |
| **PLONK** | 2019 | Various | Large | Multiple |
| **STARKs** | 2018 | StarkNet, StarkEx | Large | StarkWare |
| **Circom** | 2019 | Polygon zkEVM, Many | Very Large | iden3, Polygon |

**Production Deployments:**
- **Noir:** Aztec L2 (mainnet planned 2025), SIP Protocol
- **Halo2:** Zcash Orchard shielded pool ($2B+ TVL)
- **Kimchi:** Mina Protocol (mainnet, 22KB blockchain)
- **Groth16:** Zcash Sapling, Tornado Cash, ZK-SNARK rollups
- **STARKs:** StarkNet L2, dYdX, ImmutableX

---

## Comparison Charts

### Performance Trade-offs

```
                    PROOF SIZE vs PROVING TIME

    Small │   ⬤ Groth16
    Proof │        ⬤ PLONK    ⬤ Noir/UltraHonk
    Size  │             ⬤ Halo2
          │                  ⬤ Kimchi
          │
          │                              ⬤ STARKs
    Large │
          └─────────────────────────────────────────
               Fast                          Slow
                        PROVING TIME
```

### Security vs Developer Experience

```
                    SECURITY vs DX

    High  │   STARKs ⬤
    Security │      ⬤ Halo2
          │          ⬤ Kimchi
          │              ⬤ Noir
          │   Groth16 ⬤     ⬤ PLONK
          │                   ⬤ Circom
    Low   │
          └─────────────────────────────────────────
               Low                           High
                    DEVELOPER EXPERIENCE
```

### Recursion Capability

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECURSION CAPABILITIES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Native Recursion (Best):                                       │
│  ├── Noir/UltraHonk: #[recursive] attribute                     │
│  ├── Halo2: IPA-based, no trusted setup                         │
│  ├── Kimchi: Recursive by design (Mina's core)                  │
│  └── STARKs: FRI-based, inherently recursive                    │
│                                                                  │
│  Recursion via Wrapper:                                         │
│  ├── Groth16: Requires verifier circuit                         │
│  └── Circom: Via snarkjs + wrapper                              │
│                                                                  │
│  Recursion Overhead:                                             │
│  ├── Noir: ~2-3x per recursion level                            │
│  ├── Halo2: ~10,000 constraints per level                       │
│  ├── Kimchi: Constant (22KB output)                             │
│  └── Groth16: ~300K constraints per level                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SIP Protocol Evaluation

### Weighted Scoring (SIP-specific)

| Criterion | Weight | Noir | Halo2 | Kimchi | Groth16 | STARKs |
|-----------|--------|------|-------|--------|---------|--------|
| Recursion | 25% | 9 | 8 | 9 | 5 | 9 |
| DX | 20% | 9 | 6 | 4 | 7 | 6 |
| Proof Size | 15% | 8 | 7 | 6 | 10 | 3 |
| Verification | 15% | 8 | 7 | 7 | 10 | 5 |
| No Trusted Setup | 10% | 7 | 10 | 7 | 3 | 10 |
| Ecosystem | 10% | 7 | 9 | 7 | 10 | 8 |
| Quantum Safe | 5% | 0 | 0 | 0 | 0 | 10 |
| **TOTAL** | 100% | **8.1** | 7.5 | 6.5 | 7.0 | 6.9 |

**Winner: Noir/UltraHonk** — Best balance of DX, recursion, and performance for SIP's needs.

### Fit for SIP Use Cases

| Use Case | Best System | Rationale |
|----------|-------------|-----------|
| Funding Proof | Noir | DX, existing implementation |
| Validity Proof | Noir | DX, existing implementation |
| Fulfillment Proof | Noir | DX, existing implementation |
| Proof Aggregation | Noir | Native recursion |
| Cross-chain Privacy | Halo2 via Aligned | Zcash compatibility |
| Light Client Proof | Kimchi via Aligned | Mina succinctness |
| Long-term (Quantum) | STARKs | Post-quantum security |

---

## Integration Strategy

### Current State (M15)

```
┌─────────────────────────────────────────────────────────────┐
│  SIP PROOF STACK                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 3: Cross-System (Future)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Zcash    │ │ Mina     │ │ Future   │                    │
│  │ (Halo2)  │ │ (Kimchi) │ │ Systems  │                    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                    │
│       │            │            │                           │
│       └────────────┼────────────┘                           │
│                    │                                        │
│                    ▼                                        │
│           ┌─────────────────┐                               │
│           │  Aligned Layer  │  ◀── Attestation Bridge      │
│           └────────┬────────┘                               │
│                    │                                        │
│  Layer 2: Aggregation                                       │
│           ┌────────▼────────┐                               │
│           │  Noir Recursive │  ◀── Proof Composition        │
│           │  Aggregator     │                               │
│           └────────┬────────┘                               │
│                    │                                        │
│  Layer 1: Core Proofs                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Funding  │ │ Validity │ │Fulfillmnt│                    │
│  │ (Noir)   │ │ (Noir)   │ │ (Noir)   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Migration Path

| Phase | Timeline | Systems | Integration Method |
|-------|----------|---------|-------------------|
| M15 | Complete | Noir only | Native |
| M19 | Q1 2026 | + Halo2 | Aligned Layer attestation |
| M20 | Q2 2026 | + Kimchi | Aligned Layer attestation |
| M21 | Q3 2026 | Unified | Native verifiers (if feasible) |

---

## Recommendations

### Immediate (M19)

1. **Continue with Noir** for all SIP-native proofs
2. **Integrate Aligned Layer** for Halo2/Kimchi attestation
3. **Benchmark cross-system overhead** in real-world scenarios

### Medium-term (M20-M21)

1. **Evaluate native Halo2 verifier** in Noir (see #431)
2. **Research PCD model** for wallet-carried proofs (see #432)
3. **Monitor STARK progress** for potential quantum-safe migration

### Long-term (M22+)

1. **Native cross-system verifiers** if Aligned overhead unacceptable
2. **STARK migration path** if quantum threat materializes
3. **Contribute to Noir stdlib** for cross-system verification

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **PLONKish** | Arithmetization style using custom gates and lookups |
| **R1CS** | Rank-1 Constraint System - simple, but limited expressiveness |
| **AIR** | Algebraic Intermediate Representation - used by STARKs |
| **IPA** | Inner Product Argument - Halo2's commitment scheme |
| **SRS** | Structured Reference String - universal trusted setup |
| **PCD** | Proof-Carrying Data - proofs that travel with state |

---

## References

- [Noir Documentation](https://noir-lang.org/docs)
- [Halo2 Book](https://zcash.github.io/halo2/)
- [Mina Protocol Docs](https://docs.minaprotocol.com/)
- [STARKs vs SNARKs](https://consensys.net/blog/blockchain-explained/zero-knowledge-proofs-starks-vs-snarks/)
- [Aligned Layer Blog](https://blog.alignedlayer.com/)
- [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/)

---

**Last Updated:** January 2026
**Authors:** SIP Protocol Team
