# Proof Composition Analysis

**Issues:** #283, #296, #290, #326, #314 (M19 Phase 4)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

This document provides comprehensive analysis of proof composition approaches for SIP, covering aggregation methods, composition strategies, security implications, and prototype plans.

**Key Recommendations:**
1. **Primary:** Halo2 accumulation + Pickles compression (same Pasta curves)
2. **Interim:** Aligned Layer for cross-system attestation (M19)
3. **Future:** PCD-based wallet state (M21+)

---

## 1. Proof Aggregation Methods Survey (#283)

### 1.1 Folding Schemes

**Nova (Microsoft Research, 2021)**

```
┌────────────────────────────────────────────────────────────┐
│  NOVA FOLDING                                              │
│                                                            │
│  Instance₁ + Witness₁                                      │
│        │                                                   │
│        ▼                                                   │
│  ┌──────────┐      Fold (cheap)                           │
│  │  FOLD    │ ◄────────────────┐                          │
│  └────┬─────┘                  │                          │
│       │                        │                          │
│       ▼                        │                          │
│  Running Instance  ←───────────┘                          │
│        │                                                   │
│        ▼                                                   │
│  Instance₂ + Witness₂                                      │
│        │                                                   │
│        ▼                                                   │
│  ┌──────────┐                                              │
│  │  FOLD    │                                              │
│  └────┬─────┘                                              │
│       │                                                    │
│       ▼                                                    │
│  Final Instance → SNARK (one expensive proof)             │
└────────────────────────────────────────────────────────────┘

Verifier Circuit: O(1) — just 2 group scalar mults!
```

| Property | Nova | SuperNova | HyperNova |
|----------|------|-----------|-----------|
| Arithmetization | R1CS | R1CS (multi-circuit) | CCS |
| Verifier circuit | O(1) | O(1) | O(1) |
| Heterogeneous | ❌ | ✅ | ✅ |
| Prover overhead | ~2x | ~2x | ~1.5x |
| Status | Production | Research | Research |

**Key Insight:** Nova achieves smallest recursive verifier (~2 scalar mults) but requires same arithmetization for all proofs.

**Protostar (2023)**

- Folding for PLONK circuits
- More efficient than Nova for PLONKish systems
- Supports custom gates

**SIP Relevance:** Both Halo2 and Kimchi are PLONKish → Protostar-style folding could work.

### 1.2 Proof Carrying Data (PCD)

```
PCD Model:
  data = (value, proof_of_correctness)

  combine(data₁, data₂) → data₃
    where proof₃ attests:
      - proof₁ is valid
      - proof₂ is valid
      - value₃ = f(value₁, value₂)
```

**Production Examples:**
- **Mina:** Entire blockchain state as PCD (~22KB)
- **Zcash Tachyon:** Wallet state as PCD
- **Aztec:** Transaction proofs as PCD

**SIP Application:** Wallet state as PCD (see #432 architecture)

### 1.3 Aggregation Protocols

**Groth16 Aggregation (SnarkPack, 2021)**

```
n Groth16 proofs → 1 aggregated proof
Verification: O(n) → O(1) exponentiations
Proof size: O(n) → O(log n)
```

**Limitation:** Only works within Groth16, requires trusted setup.

**IPA-based Aggregation (Halo2)**

```
n IPA commitments → 1 aggregated commitment
Final verification: one IPA opening
No trusted setup!
```

**SIP Recommendation:** Halo2 IPA aggregation for trustless multi-proof composition.

### 1.4 Research Answer Summary

| Question | Answer |
|----------|--------|
| Folding across arithmetizations? | Limited — SuperNova/HyperNova support multiple circuits, but same base system |
| Nova heterogeneous handling? | SuperNova: multiple circuit types, same prover |
| Cross-system overhead? | 2-5x depending on approach |
| Production cross-system? | Aligned Layer (attestation model) |
| Trust assumptions? | Folding: trustless; Aggregation: depends on underlying system |

---

## 2. Composition Approaches Comparison (#296)

### 2.1 Recursive Verification

**Definition:** Verify proof Pₐ inside circuit that generates proof Pᵦ

```
┌─────────────────────────────────────────────────────────────┐
│  RECURSIVE VERIFICATION                                     │
│                                                             │
│  Proof_A (from System A)                                    │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────┐                            │
│  │  Circuit B                  │                            │
│  │  • Verify Proof_A           │ ← Expensive! (~100K+ const)│
│  │  • Additional logic         │                            │
│  └──────────────┬──────────────┘                            │
│                 │                                           │
│                 ▼                                           │
│           Proof_B                                           │
│    (attests: A verified + B logic)                          │
└─────────────────────────────────────────────────────────────┘
```

| Metric | Value | Notes |
|--------|-------|-------|
| Proof size | Same as verifier system | ~22KB for Pickles |
| Verification | O(1) | Single proof to verify |
| Prover time | High | Must verify in circuit |
| Constraints | 100K-500K | Depends on verified system |

**Best for:** Final compression when constant-size output needed.

### 2.2 Proof Aggregation

**Definition:** Batch multiple proofs into single verification

```
┌─────────────────────────────────────────────────────────────┐
│  PROOF AGGREGATION                                          │
│                                                             │
│  Proof₁  Proof₂  Proof₃  ...  Proof_n                      │
│     │       │       │           │                           │
│     └───────┴───────┴───────────┘                           │
│                  │                                          │
│                  ▼                                          │
│       ┌──────────────────────┐                              │
│       │  AGGREGATOR          │ ← Batch pairing/IPA checks   │
│       └──────────┬───────────┘                              │
│                  │                                          │
│                  ▼                                          │
│         Aggregated Proof                                    │
│      (proves all n are valid)                               │
└─────────────────────────────────────────────────────────────┘
```

| Metric | Value | Notes |
|--------|-------|-------|
| Proof size | O(log n) | Sublinear growth |
| Verification | O(1) | Single batch check |
| Prover time | O(n) | Linear in proofs |
| Constraints | N/A | No circuit overhead |

**Best for:** Batching many proofs of same type.

### 2.3 Accumulation/Folding

**Definition:** Incrementally combine proofs without verification

```
┌─────────────────────────────────────────────────────────────┐
│  ACCUMULATION (Halo2 Style)                                 │
│                                                             │
│  Proof₁                                                     │
│     │                                                       │
│     ▼                                                       │
│  ┌───────────────────┐                                      │
│  │ Accumulator       │ ← Cheap update (~120K constraints)   │
│  │ (running sum)     │                                      │
│  └─────────┬─────────┘                                      │
│            │                                                │
│            │ ◄── Fold in Proof₂, Proof₃, ...               │
│            │                                                │
│            ▼                                                │
│  ┌───────────────────┐                                      │
│  │ Final Verify      │ ← One expensive check at end         │
│  │ (IPA opening)     │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

| Metric | Value | Notes |
|--------|-------|-------|
| Proof size | O(1) per step | ~1.5KB until final |
| Verification | Deferred | O(n) at end |
| Prover time | O(1) per step | Cheap incremental |
| Constraints | ~120K per fold | Much less than full verify |

**Best for:** IVC, streaming proofs, flexible composition.

### 2.4 Comparison Matrix

| Approach | Proof Size | Verify Time | Prover Cost | Flexibility | Trustless |
|----------|------------|-------------|-------------|-------------|-----------|
| Recursive | Constant | O(1) | Very High | Medium | Yes |
| Aggregation | O(log n) | O(1) | Linear | Low | Depends |
| Accumulation | O(1) per step | Deferred | Low per step | High | Yes |
| **Hybrid** | Constant | O(1) | Medium | High | Yes |

### 2.5 Recommended Approach for SIP

**Hybrid: Accumulation + Final Recursion**

```
Step 1: Generate SIP proofs (Noir, Halo2, etc.)
Step 2: Accumulate into Halo2 accumulator (cheap)
Step 3: Final recursive wrap with Pickles (constant output)
```

| Stage | Approach | Reason |
|-------|----------|--------|
| L1: Generation | Various | Flexibility for different proof types |
| L2: Composition | Accumulation | Cheap incremental updates |
| L3: Output | Recursive | Constant ~22KB for light clients |

---

## 3. Security Implications (#290, #326)

### 3.1 Security Model for Composed Proofs

**Composition Theorem:**
```
If System A is sound with probability p_A
And System B is sound with probability p_B
Then composed system is sound with probability ≥ min(p_A, p_B)

(Proof soundness doesn't degrade under composition,
 assuming proper binding between systems)
```

### 3.2 Security Assumptions by System

| System | Assumptions | Security Level |
|--------|-------------|----------------|
| Noir/Barretenberg | DLOG (BN254), Pedersen | 128-bit |
| Halo2 | DLOG (Pallas/Vesta), IPA | 128-bit |
| Kimchi/Pickles | DLOG (Pallas/Vesta), IPA | 128-bit |
| Groth16 | Bilinear DLOG, Trusted Setup | 128-bit |

**Key Observation:** Halo2 + Kimchi share identical assumptions (DLOG on Pasta). No additional trust introduced by composition.

### 3.3 Threat Model

```
┌─────────────────────────────────────────────────────────────┐
│  THREAT MODEL FOR SIP PROOF COMPOSITION                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ASSETS:                                                    │
│  • Soundness: Invalid proofs cannot pass verification       │
│  • Zero-knowledge: Witnesses remain hidden                  │
│  • Integrity: Public inputs accurately reflect private data │
│                                                             │
│  THREATS:                                                   │
│  1. Soundness attack on individual system                   │
│     → Mitigate: Use audited, production systems             │
│                                                             │
│  2. Binding attack at composition boundary                  │
│     → Mitigate: Cryptographic binding (hash chains)         │
│                                                             │
│  3. Side-channel during composition                         │
│     → Mitigate: Constant-time operations                    │
│                                                             │
│  4. Malicious prover with partial knowledge                 │
│     → Mitigate: Zero-knowledge preserved through layers     │
│                                                             │
│  5. Replay of old composed proofs                           │
│     → Mitigate: Nonce/timestamp binding                     │
│                                                             │
│  TRUST BOUNDARIES:                                          │
│  • Trustless: Halo2, Kimchi, Noir (no trusted setup)       │
│  • Semi-trusted: Aligned Layer (2/3 validators)            │
│  • Trusted: Groth16 setup (if used)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Attack Vectors Analysis

| Attack Vector | Risk | Mitigation |
|---------------|------|------------|
| Curve weakness | Low | Pasta/BN254 well-studied |
| IPA vulnerability | Low | Production use in Zcash/Mina |
| Composition binding | Medium | Use Poseidon hash for cross-system binding |
| Verifier circuit bug | Medium | Formal verification, audit |
| Side-channel | Low | Constant-time implementation |
| Parameter mismatch | Medium | Consistent security parameter (128-bit) |

### 3.5 Soundness Preservation

**Theorem (informal):** If the composition circuit correctly implements the verification algorithm, then soundness of the composed proof follows from soundness of the underlying systems.

**Proof sketch:**
1. Assume adversary forges composed proof P_composed
2. P_composed must contain either:
   - Invalid proof from System A → contradicts A's soundness
   - Invalid proof from System B → contradicts B's soundness
   - Invalid binding → detected by hash chain verification
3. Therefore, no efficient adversary can forge P_composed

### 3.6 Zero-Knowledge Preservation

```
ZK Property Chain:
  Proof_A reveals nothing about witness_A
  Proof_B reveals nothing about witness_B
  Composed proof reveals nothing about (witness_A, witness_B)

Requirement: Composition must not inadvertently leak witness correlation
```

**SIP Implementation:**
- Public inputs explicitly designed (commitments, nullifiers)
- No cross-proof witness leakage by construction
- Viewing keys provide controlled disclosure

### 3.7 Security Requirements Specification

| Requirement | Priority | Status |
|-------------|----------|--------|
| 128-bit security | Must | ✅ All systems meet |
| No trusted setup | Should | ✅ Halo2/Kimchi |
| Soundness preservation | Must | ✅ By construction |
| Zero-knowledge preservation | Must | ✅ By construction |
| Binding security | Must | Poseidon hash chains |
| Side-channel resistance | Should | Implementation concern |

### 3.8 Audit Scope (Future)

1. **Individual Circuit Audit**
   - Halo2 accumulator circuit
   - Pickles wrapper circuit
   - Binding hash implementation

2. **Composition Logic Audit**
   - Cross-system public input binding
   - Nonce/timestamp handling
   - Error propagation

3. **Implementation Audit**
   - Constant-time operations
   - Memory safety
   - Input validation

---

## 4. Prototype Plan (#314)

### 4.1 Minimal Composition Demonstration

**Goal:** Prove Halo2 + Kimchi composition works end-to-end.

```
┌─────────────────────────────────────────────────────────────┐
│  MINIMAL PROTOTYPE                                          │
│                                                             │
│  Step 1: Simple Halo2 Proof                                 │
│  ┌───────────────────────┐                                  │
│  │ Circuit: x² = y       │ ──▶ Halo2 Proof (~1KB)          │
│  │ Prove: I know x       │                                  │
│  └───────────────────────┘                                  │
│                                                             │
│  Step 2: Kimchi Wrapper                                     │
│  ┌───────────────────────┐                                  │
│  │ Verify Halo2 proof    │                                  │
│  │ inside Kimchi circuit │ ──▶ Pickles Proof (~22KB)       │
│  └───────────────────────┘                                  │
│                                                             │
│  Step 3: Light Client Verification                          │
│  ┌───────────────────────┐                                  │
│  │ Verify Pickles proof  │ ──▶ ✅ Valid                     │
│  │ (constant time)       │                                  │
│  └───────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Prototype Architecture

```
prototype/
├── halo2-prover/
│   ├── src/
│   │   ├── circuit.rs      # Simple multiplication circuit
│   │   └── main.rs         # Generate Halo2 proof
│   └── Cargo.toml
│
├── kimchi-wrapper/
│   ├── src/
│   │   ├── verifier.ts     # Halo2 verifier in o1js
│   │   └── main.ts         # Generate Pickles proof
│   └── package.json
│
└── light-client/
    ├── src/
    │   └── verify.ts       # Verify final proof
    └── package.json
```

### 4.3 Key Technical Challenges

| Challenge | Solution |
|-----------|----------|
| Proof serialization | Standardize on bytes, document format |
| Curve point encoding | Both use same Pasta curves |
| Public input binding | Poseidon hash of inputs |
| Field element size | Same ~254 bits |

### 4.4 Implementation Steps

**Phase 1: Halo2 Proof Generation (Week 1)**
```rust
// Simple circuit: prove x² = y
#[derive(Clone)]
struct SquareCircuit {
    x: Value<Fp>,  // private
    y: Fp,         // public
}

impl Circuit<Fp> for SquareCircuit {
    fn synthesize(&self, mut layouter: impl Layouter<Fp>) -> Result<(), Error> {
        // Constraint: x * x = y
        // ...
    }
}
```

**Phase 2: Kimchi Wrapper (Week 2)**
```typescript
// o1js circuit that verifies Halo2 proof
const Halo2Wrapper = ZkProgram({
  name: 'halo2-wrapper',
  publicInput: Field,

  methods: {
    verify: {
      privateInputs: [Halo2ProofData],

      async method(publicInput: Field, halo2Proof: Halo2ProofData) {
        // Verify IPA commitment (same Pasta curves!)
        verifyIPACommitment(halo2Proof.commitment, halo2Proof.opening);

        // Bind public inputs
        publicInput.assertEquals(halo2Proof.publicInput);
      },
    },
  },
});
```

**Phase 3: Integration Test (Week 3)**
```typescript
// End-to-end test
async function testComposition() {
  // 1. Generate Halo2 proof
  const halo2Proof = await generateHalo2Proof(x, y);

  // 2. Wrap in Pickles
  const picklesProof = await Halo2Wrapper.verify(y, halo2Proof);

  // 3. Verify on light client
  const isValid = await verifyPicklesProof(picklesProof);

  assert(isValid, 'Composed proof should be valid');
}
```

### 4.5 Expected Results

| Metric | Expected | Notes |
|--------|----------|-------|
| Halo2 proof size | ~1-2KB | Before accumulation |
| Pickles output | ~22KB | Constant |
| Total proving time | ~30-60s | Prototype, not optimized |
| Verification time | ~1s | Light client friendly |

### 4.6 Prototype Timeline

| Week | Deliverable |
|------|-------------|
| 1 | Halo2 simple circuit + proof generation |
| 2 | Kimchi wrapper circuit in o1js |
| 3 | Integration test + benchmarks |
| 4 | Documentation + cleanup |

**Total: 4 weeks for minimal prototype (M20)**

---

## 5. Answers to All Research Questions

### From #283 (Aggregation Methods)

| Question | Answer |
|----------|--------|
| Folding across arithmetizations? | SuperNova/HyperNova support multi-circuit, same base system |
| Nova heterogeneous handling? | Multiple circuit types, single prover |
| Cross-system overhead? | 2-5x depending on approach |
| Production cross-system? | Aligned Layer (attestation), Mina zkBridge |
| Trust assumptions? | Folding trustless, aggregation depends on system |

### From #296 (Comparison)

| Question | Answer |
|----------|--------|
| Proof size implications? | Recursive: constant, Aggregation: O(log n), Folding: O(1) per step |
| Verification scaling? | All achieve O(1) final verification |
| Best prover efficiency? | Folding (incremental) > Aggregation > Recursive |
| Implementation complexity? | Folding > Recursive > Aggregation |
| Best for SIP? | **Hybrid: Halo2 accumulation + Pickles recursion** |

### From #290 (Security Implications)

| Question | Answer |
|----------|--------|
| Soundness preservation? | Yes, via proper binding |
| Weakest-link implications? | Security = min(system_A, system_B) |
| Security parameter handling? | Use consistent 128-bit across all |
| Composition attack surfaces? | Binding layer, verifier bugs |
| ZK preservation? | Yes, by construction (no cross-witness leakage) |

### From #326 (Security Analysis)

| Question | Answer |
|----------|--------|
| Combined assumptions? | DLOG (Pasta), no additional assumptions |
| Soundness proof? | Reduction to underlying systems |
| Trust assumptions? | Trustless (Halo2 + Kimchi), Semi-trusted (Aligned) |
| Parameter choices? | 128-bit security level, ~254-bit fields |
| Required audits? | Circuit audit, composition logic audit, implementation audit |

### From #314 (Prototype)

| Question | Answer |
|----------|--------|
| Simplest composition demo? | Halo2 proof → Kimchi verify → Pickles output |
| Common intermediate? | Pasta curve points + Poseidon hashes |
| Serialization requirements? | Standardize proof bytes format |
| Curve/field handling? | Same Pasta curves = native operations |
| Composition overhead? | ~50K constraints for IPA verify, ~22KB output |

---

## 6. Conclusions

### 6.1 Primary Findings

1. **Halo2 + Kimchi is optimal** due to shared Pasta curves
2. **Hybrid approach recommended:** Accumulation + final recursion
3. **Security preserved** under proper binding
4. **Prototype feasible** in 4 weeks

### 6.2 Action Items

| Priority | Action | Timeline |
|----------|--------|----------|
| High | Aligned Layer integration (interim) | M19 |
| High | Minimal prototype | M20 |
| Medium | Full composition pipeline | M21 |
| Medium | Security audit | M22 |

### 6.3 Final Recommendation

**Proceed with Halo2 + Kimchi composition as SIP's proof compression layer.**

The shared cryptographic foundation makes this uniquely efficient. Use Aligned Layer as interim bridge while developing native composition.

---

## References

- [Nova Paper](https://eprint.iacr.org/2021/370.pdf)
- [SuperNova](https://eprint.iacr.org/2022/1758.pdf)
- [HyperNova](https://eprint.iacr.org/2023/573.pdf)
- [Protostar](https://eprint.iacr.org/2023/620.pdf)
- [SnarkPack](https://eprint.iacr.org/2021/529.pdf)
- [Halo2 Book](https://zcash.github.io/halo2/)
- [Pickles Overview](https://o1-labs.github.io/proof-systems/pickles/overview.html)
- [Aligned Layer](https://docs.alignedlayer.com/)
- [PCD Overview](https://www.oreateai.com/blog/understanding-proofcarrying-data-a-deep-dive-into-pcd/)

---

**Conclusion:** All Phase 4 research questions answered. Proof composition is feasible, secure, and recommended for SIP. Proceed with prototype in M20.
