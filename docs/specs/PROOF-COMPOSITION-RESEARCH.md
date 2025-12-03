# Proof Composition Research: Halo2/Kimchi Integration Feasibility

**Issue:** [#143](https://github.com/sip-protocol/sip-protocol/issues/143)
**Date:** December 2024
**Status:** Research Complete

## Executive Summary

This document analyzes the feasibility of composing proofs from multiple ZK systems (Zcash/Halo2, Mina/Kimchi, Noir) for SIP Protocol's privacy layer. Our findings indicate that **proof composition is feasible but requires significant engineering effort**, with Noir's recursive proof capabilities providing the most practical path forward.

## Research Questions & Answers

### 1. Can we verify Zcash (Halo2) proofs inside Noir circuits?

**Answer: Partially feasible, but not directly.**

**Findings:**
- Noir's UltraHonk backend and Halo2 share PLONKish arithmetization, making them theoretically compatible
- Direct Halo2 proof verification inside Noir requires implementing the Halo2 inner product argument (IPA) as Noir constraints
- The [halo2-solidity-verifier](https://github.com/privacy-ethereum/halo2-solidity-verifier) project shows Halo2 proofs can be verified on EVM
- Aztec's Barretenberg team has explored synthesizing Halo2 matrix representations from ACIR opcodes

**Technical Approach:**
```
Option A: Native Halo2 Verifier in Noir
├── Implement IPA verification as Noir library
├── Handle curve operations (Pasta curves for Zcash)
├── ~10,000+ constraints overhead
└── High complexity, 6-12 months effort

Option B: Proof Relay via Aligned Layer
├── Verify Halo2 proofs off-chain
├── Generate Noir proof attesting to verification
├── Lower complexity, existing infrastructure
└── Trade-off: trust assumption on relay
```

**Recommendation:** Start with Option B for faster iteration, explore Option A for M14+.

### 2. Can we verify Mina/Kimchi proofs inside Noir circuits?

**Answer: Technically feasible, high complexity.**

**Findings:**
- Mina's Kimchi is based on PLONK with custom gates (foreign field arithmetic, lookups)
- O1Labs has implemented [bn254 KZG proof output](https://minaprotocol.com/roadmap) for cross-chain compatibility
- [Aligned Layer](https://blog.alignedlayer.com/) provides Kimchi proof verification on Ethereum
- Foreign field arithmetic gates enable verifying secp256k1 signatures and bn128/bn254 proofs

**Key Challenge:** Mina uses Poseidon hash (efficient in ZK) while Noir uses different hash primitives. A compatibility layer is needed.

**Technical Architecture:**
```
Mina Proof → Aligned Layer → Attestation → Noir Recursive Proof
     ↓                                              ↓
 Kimchi/Pickles                              UltraHonk Backend
```

**Recommendation:** Leverage Aligned Layer integration rather than native Kimchi verification.

### 3. What's the overhead of proof composition?

**Answer: 2-10x overhead depending on approach.**

| Composition Type | Overhead | Use Case |
|-----------------|----------|----------|
| Noir Recursive | 2-3x | Multiple SIP proofs into one |
| Cross-System via Relay | 5-10x | Zcash + Mina attestation |
| Native Cross-Verifier | 10-20x | Direct Halo2 in Noir |

**Performance Estimates:**
- Single SIP funding proof: ~30s (Noir/WASM)
- Recursive aggregation of 10 proofs: ~60-90s
- Cross-system composition: ~5-10 minutes

### 4. Is recursive proof verification feasible?

**Answer: Yes, Noir natively supports this.**

**Noir Recursive Proofs:**
```noir
// Mark circuit as recursively verifiable
#[recursive]
fn main(public_inputs: [Field; N], proof: [u8; P]) {
    // Verify inner proof
    std::verify_proof(proof, public_inputs);

    // Add additional constraints
    // ...
}
```

**Key Points:**
- Use `#[recursive]` attribute for recursive circuits
- `bb_proof_verification` library from Barretenberg team recommended
- Witness execution succeeds even with invalid proofs (backend catches this)
- Proof sizes remain constant regardless of recursion depth

**Practical Application for SIP:**
```
User Intent → Funding Proof + Validity Proof → Aggregated Proof
                                                      ↓
                                               Solver Submission
                                                      ↓
                                            Fulfillment Proof → Final Proof
```

## Proof Composition Architecture for SIP

### Phase 1: Noir-Native Recursion (M13)

Compose multiple SIP proofs into a single aggregated proof:

```
┌─────────────────────────────────────────────────────────────┐
│                    SIP Proof Aggregation                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Funding      │  │ Validity     │  │ Fulfillment  │      │
│  │ Proof        │  │ Proof        │  │ Proof        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ Recursive   │                          │
│                    │ Aggregator  │                          │
│                    └──────┬──────┘                          │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ Single      │                          │
│                    │ SIP Proof   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Cross-System Attestation (M14)

Integrate Zcash privacy proofs via attestation:

```
┌─────────────────────────────────────────────────────────────┐
│              Cross-System Proof Composition                 │
│                                                             │
│  ┌──────────────┐                    ┌──────────────┐       │
│  │ Zcash        │                    │ Mina         │       │
│  │ Orchard      │                    │ zkApp        │       │
│  │ Transaction  │                    │ Execution    │       │
│  └──────┬───────┘                    └──────┬───────┘       │
│         │                                   │               │
│  ┌──────▼───────┐                    ┌──────▼───────┐       │
│  │ Halo2 Proof  │                    │ Kimchi Proof │       │
│  └──────┬───────┘                    └──────┬───────┘       │
│         │                                   │               │
│         └─────────────┬─────────────────────┘               │
│                       │                                     │
│                ┌──────▼──────┐                              │
│                │ Aligned     │ ◄── Off-chain verification   │
│                │ Layer       │                              │
│                └──────┬──────┘                              │
│                       │                                     │
│                ┌──────▼──────┐                              │
│                │ Attestation │ ◄── Merkle proof of verify   │
│                └──────┬──────┘                              │
│                       │                                     │
│                ┌──────▼──────┐                              │
│                │ Noir        │                              │
│                │ Wrapper     │                              │
│                └──────┬──────┘                              │
│                       │                                     │
│                ┌──────▼──────┐                              │
│                │ SIP         │                              │
│                │ Composite   │                              │
│                │ Proof       │                              │
│                └─────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Feasibility Assessment

| Capability | Feasibility | Complexity | Timeline |
|------------|-------------|------------|----------|
| Noir recursive proofs | ✅ High | Low | M13 (3 months) |
| Aggregate SIP proofs | ✅ High | Medium | M13 (3 months) |
| Zcash via Aligned | 🟡 Medium | Medium | M14 (6 months) |
| Native Halo2 in Noir | 🟡 Medium | High | M15+ (12 months) |
| Mina/Kimchi via Aligned | 🟡 Medium | Medium | M14 (6 months) |
| Native Kimchi in Noir | 🔴 Low | Very High | M16+ (18 months) |

## Recommended Approach for M13-M14

### Immediate Actions (M13)

1. **Implement Noir Recursive Aggregation**
   - Create recursive proof aggregator for SIP's three proof types
   - Reduce on-chain verification cost by ~3x
   - Foundation for future cross-system composition

2. **Research Aligned Layer Integration**
   - Evaluate Aligned for Halo2/Kimchi attestation
   - Prototype integration with Zcash Orchard proofs
   - Document API requirements

### Future Work (M14+)

1. **Cross-System Attestation**
   - Integrate Aligned Layer for Zcash proof attestation
   - Enable "Zcash-attested SIP transactions"
   - Marketing: "Privacy from Zcash, settlement from NEAR"

2. **Native Verifier R&D**
   - Evaluate performance of native Halo2 verification
   - Collaborate with Aztec/ECC on shared tooling
   - Long-term: contribute to Noir stdlib

## Technical Dependencies

| Dependency | Current Status | Required Version |
|------------|---------------|------------------|
| Noir | 1.0.0-beta.15 | 1.0.0 stable |
| `bb_proof_verification` | Available | Latest |
| Aligned Layer SDK | Production | 1.x |
| Halo2 | Stable | 0.3.x |
| Mina Bridge | Testnet | Mainnet |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Noir 1.0 delays | Medium | Use beta with feature flags |
| Performance regression | High | Comprehensive benchmarks |
| Cross-system incompatibility | Medium | Abstraction layer |
| Security vulnerabilities | High | Third-party audit |

## Conclusion

Proof composition is feasible and should be pursued in phases:

1. **M13:** Focus on Noir-native recursion to aggregate SIP proofs
2. **M14:** Integrate Aligned Layer for cross-system attestation
3. **M15+:** Evaluate native cross-system verification based on ecosystem maturity

The "C+B Hybrid" strategy (Settlement Aggregation + Proof Composition) remains the right approach, with proof composition providing SIP's technical moat through unique privacy primitives from multiple ZK systems.

## References

- [Noir Recursive Proofs Documentation](https://noir-lang.org/docs/noir/standard_library/recursion)
- [Aztec's Core Cryptography in Noir](https://aztec.network/blog/aztecs-core-cryptography-now-in-noir)
- [Mina to Ethereum Bridge via Aligned](https://minaprotocol.com/blog/bringing-mina-proofs-to-ethereum-with-the-aligned-bridge)
- [Halo2 Solidity Verifier](https://github.com/privacy-ethereum/halo2-solidity-verifier)
- [Kimchi Proof System](https://github.com/o1-labs/proof-systems/tree/master/kimchi)
- [Noir 1.0 Pre-Release Announcement](https://aztec.network/blog/the-future-of-zk-development-is-here-announcing-the-noir-1-0-pre-release)
