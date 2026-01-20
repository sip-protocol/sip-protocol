# Halo2 Circuit Compatibility Requirements

**Issue:** #249 (M19-04)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

This document analyzes what's required to make SIP circuits compatible with Halo2, including translation paths from Noir, API differences, and migration strategies.

**Key Finding:** Direct translation from Noir to Halo2 is not straightforward due to fundamental arithmetization differences. Recommended approach is **dual-circuit strategy** or using a **transpiler layer**.

---

## 1. Arithmetization Comparison

### Noir (UltraPLONK) vs Halo2 (PLONKish)

| Aspect | Noir/Barretenberg | Halo2 |
|--------|-------------------|-------|
| **Arithmetization** | UltraPLONK | PLONKish |
| **Commitment** | KZG | IPA |
| **Constraint format** | Wires + gates | Columns + custom gates |
| **Lookups** | Plookup | Halo2 lookups |
| **Range checks** | Built-in | Custom gates |
| **Field** | bn254 scalar | Pasta (Pallas/Vesta) |

### Constraint System Differences

**Noir (UltraPLONK):**
```
Standard gate: qL·a + qR·b + qO·c + qM·(a·b) + qC = 0

Where:
- a, b, c = wire values
- qL, qR, qO, qM, qC = selector values
```

**Halo2 (PLONKish):**
```
Custom gate: selector · polynomial(advice_cells, fixed_cells) = 0

Example multiplication:
s_mul · (a · b - c) = 0

Example custom:
s_range · (a)(a-1)(a-2)(a-3) = 0
```

### Key Differences

1. **Wire model vs Column model**
   - Noir: Fixed wire structure (a, b, c per gate)
   - Halo2: Flexible columns with rotations

2. **Gate composition**
   - Noir: Predefined gate types
   - Halo2: Fully custom polynomial gates

3. **Lookup tables**
   - Noir: Plookup with selector
   - Halo2: Configurable lookup arguments

---

## 2. Field Compatibility

### Critical Issue: Different Base Fields

| System | Base Field | Scalar Field | Curve |
|--------|------------|--------------|-------|
| Noir | bn254.Fq | bn254.Fr | BN254 |
| Halo2 | Pallas.Fp | Pallas.Fq | Pallas |
| Halo2 (recursive) | Vesta.Fq | Vesta.Fp | Vesta |

### Implications

1. **Cannot directly share witnesses** - Field elements are incompatible
2. **Need field conversion** - Expensive in-circuit operations
3. **Different moduli** - Arithmetic results may differ

### Field Sizes

```
bn254.Fr:  21888242871839275222246405745257275088548364400416034343698204186575808495617
Pallas.Fp: 28948022309329048855892746252171976963363056481941560715954676764349967630337
Vesta.Fp:  28948022309329048855892746252171976963363056481941647379679742748393362948097
```

### Mitigation Strategies

1. **Field emulation** - Expensive but possible
2. **Commitment verification** - Verify Noir proofs in Halo2 via commitment checks
3. **Aligned Layer** - External verification service
4. **Native Halo2** - Rewrite critical circuits

---

## 3. Circuit Translation Requirements

### What Can Be Translated Directly

| Component | Translation Difficulty | Notes |
|-----------|----------------------|-------|
| Basic arithmetic | Easy | +, -, ×, ÷ |
| Boolean logic | Easy | AND, OR, NOT, XOR |
| Comparisons | Medium | Need custom gates in Halo2 |
| Range checks | Medium | Custom gates more efficient |
| SHA256 | Medium | Both have optimized versions |
| Poseidon | Easy | Well-supported in both |
| ECDSA | Hard | Curve-specific |
| Pedersen | Hard | Generator differences |

### What Requires Rewriting

1. **Curve operations** - Different curves, different generators
2. **Hash-to-curve** - Different domains
3. **Commitment schemes** - Pedersen parameters differ
4. **Signature verification** - Curve-specific

---

## 4. SIP Circuit Analysis

### Current SIP Circuits (Noir)

| Circuit | Constraints | Translation Effort |
|---------|-------------|-------------------|
| Funding Proof | ~2^14 | Medium |
| Validity Proof | ~2^14 | Medium |
| Fulfillment Proof | ~2^14 | Medium |
| Stealth Address | ~2^12 | Hard (ECDSA) |
| Commitment Verify | ~2^12 | Hard (Pedersen params) |

### SIP Funding Proof (Example)

**Noir version:**
```noir
fn main(
    balance: Field,
    minimum: pub Field,
    commitment: pub Commitment,
    blinding: Field,
) {
    // Range check
    assert(balance >= minimum);

    // Commitment verification
    let computed = pedersen_commit(balance, blinding);
    assert(computed == commitment);
}
```

**Halo2 equivalent (pseudocode):**
```rust
struct FundingCircuit {
    balance: Value<Fp>,
    minimum: Value<Fp>,
    commitment: Value<EpAffine>,
    blinding: Value<Fp>,
}

impl Circuit<Fp> for FundingCircuit {
    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let advice = meta.advice_column();
        let instance = meta.instance_column();

        // Range check gate
        meta.create_gate("range", |meta| {
            let balance = meta.query_advice(advice, Rotation::cur());
            let minimum = meta.query_instance(instance, Rotation::cur());
            vec![balance - minimum] // Must be non-negative
        });

        // Pedersen commitment gate (custom)
        // ...
    }
}
```

### Translation Effort Estimate

| SIP Circuit | Noir Lines | Halo2 Lines (Est.) | Effort |
|-------------|------------|-------------------|--------|
| Funding Proof | ~50 | ~200 | 3-5 days |
| Validity Proof | ~100 | ~400 | 5-7 days |
| Fulfillment Proof | ~80 | ~350 | 4-6 days |
| Full Privacy Suite | ~500 | ~2000 | 2-3 weeks |

---

## 5. API Differences

### Witness Generation

**Noir:**
```rust
// Simple field assignment
let witness = map! {
    "balance" => balance_value,
    "commitment" => commitment_value,
};
```

**Halo2:**
```rust
// Region-based assignment
layouter.assign_region(
    || "witness",
    |mut region| {
        region.assign_advice(
            || "balance",
            config.advice,
            0,
            || self.balance,
        )?;
        Ok(())
    },
)?;
```

### Constraint Definition

**Noir:**
```noir
// Declarative constraints
assert(a + b == c);
assert(x * y == z);
```

**Halo2:**
```rust
// Programmatic constraint system
meta.create_gate("add", |meta| {
    let a = meta.query_advice(col_a, Rotation::cur());
    let b = meta.query_advice(col_b, Rotation::cur());
    let c = meta.query_advice(col_c, Rotation::cur());

    Constraints::with_selector(s_add, vec![a + b - c])
});
```

### Proof Generation

**Noir:**
```typescript
const proof = await noir.generateProof(witness);
```

**Halo2:**
```rust
let proof = create_proof::<
    IPACommitmentScheme<EpAffine>,
    ProverIPA<'_, EpAffine>,
    Challenge255<EpAffine>,
    Blake2bWrite<_, _, Challenge255<_>>,
>(
    &params,
    &pk,
    &[circuit],
    &[&[&instance]],
    OsRng,
    &mut transcript,
)?;
```

---

## 6. Tooling Comparison

### Development Experience

| Tool | Noir | Halo2 |
|------|------|-------|
| Language | Noir DSL | Rust |
| IDE support | VSCode extension | Rust analyzer |
| Testing | `nargo test` | `cargo test` |
| Debugging | Limited | Standard Rust |
| Documentation | Good | Excellent |
| Learning curve | Moderate | Steep |

### Build & Deploy

| Aspect | Noir | Halo2 |
|--------|------|-------|
| Compilation | `nargo compile` | `cargo build` |
| WASM export | Built-in | Manual |
| Proof size | ~400B | ~1.5KB |
| Verifier generation | Automatic | Manual |

### Tooling Gaps

1. **No Noir-to-Halo2 transpiler** - Manual translation required
2. **Different testing frameworks** - Tests not portable
3. **WASM packaging differs** - Build process varies
4. **No unified circuit format** - Each system has own IR

---

## 7. Migration Strategies

### Strategy 1: Dual-Circuit (Recommended)

Maintain circuits in both systems for different purposes.

```
┌─────────────────────────────────────────────────────────────┐
│  SIP DUAL-CIRCUIT ARCHITECTURE                              │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  NOIR CIRCUITS  │    │  HALO2 CIRCUITS │                │
│  │                 │    │                 │                │
│  │  • Fast proving │    │  • Recursion    │                │
│  │  • Small proofs │    │  • Accumulation │                │
│  │  • On-chain     │    │  • Composition  │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      │                                      │
│                      ▼                                      │
│           ┌─────────────────────┐                          │
│           │  SIP PROOF LAYER    │                          │
│           │  • Route to system  │                          │
│           │  • Compose proofs   │                          │
│           └─────────────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Use best tool for each job
- No translation overhead
- Future flexibility

**Cons:**
- Double maintenance burden
- Potential consistency issues

### Strategy 2: Noir Primary + Halo2 Verifier

Keep Noir as primary, build Halo2 verifier circuit.

```
Noir Proof → Halo2 Verifier Circuit → Composed Proof
```

**Pros:**
- Minimal Halo2 work
- Keep existing Noir circuits

**Cons:**
- Field emulation expensive
- Verifier circuit complex (~2M constraints)

### Strategy 3: Halo2 Primary

Migrate all circuits to Halo2.

**Pros:**
- Full recursion capabilities
- Native composition
- Single system

**Cons:**
- Significant rewrite effort
- Lose Noir's smaller proofs
- Steep learning curve

### Strategy 4: Aligned Layer

Use external service for cross-system verification.

**Pros:**
- No translation needed
- Professional infrastructure

**Cons:**
- External dependency
- Potential centralization

---

## 8. Recommended Approach for SIP

### Phase 1: Halo2 POC (M19)

Build standalone Halo2 circuits for research:
- Simple commitment circuit
- Accumulation example
- Recursion demo

### Phase 2: Dual-Circuit Architecture (M20)

Implement dual-circuit strategy:
- Noir for on-chain verification (smaller proofs)
- Halo2 for composition (recursion)
- Abstraction layer to route proofs

### Phase 3: Optimization (M21)

Based on learnings:
- Migrate more circuits to Halo2 if beneficial
- Optimize composition pipeline
- Consider Aligned Layer for edge cases

---

## 9. Compatibility Checklist

### For Halo2 Circuit Development

- [ ] Use Pasta curves (Pallas/Vesta)
- [ ] Design for recursion from start
- [ ] Use custom gates for efficiency
- [ ] Plan column layout carefully
- [ ] Test with real-world data sizes
- [ ] Benchmark memory usage

### For Noir-Halo2 Interoperability

- [ ] Define clear interface boundaries
- [ ] Use commitment-based verification
- [ ] Document field conversion rules
- [ ] Test cross-system proof flows
- [ ] Plan for proof aggregation

---

## 10. Summary

### Compatibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Direct translation | ❌ Not feasible | Different arithmetization |
| Field compatibility | ❌ Different fields | Requires conversion |
| API compatibility | ⚠️ Partial | Similar concepts, different APIs |
| Tooling | ⚠️ Different | No transpiler exists |
| Dual-circuit | ✅ Recommended | Best of both worlds |

### Key Decisions

1. **Adopt dual-circuit strategy** - Maintain both Noir and Halo2
2. **Build Halo2 POC first** - Validate recursion capabilities
3. **Define abstraction layer** - Route proofs based on use case
4. **Consider Aligned Layer** - For complex cross-system needs

### Next Steps

1. **#303** - Build Halo2 POC to validate approach
2. Design proof routing abstraction
3. Prototype commitment-based interoperability
4. Benchmark dual-circuit performance

---

## References

- [Halo2 Book](https://zcash.github.io/halo2/)
- [Noir Documentation](https://noir-lang.org/docs/)
- [Aligned Layer](https://alignedlayer.com/)
- [PSE Halo2 Fork](https://github.com/privacy-scaling-explorations/halo2)
- [Axiom Circuits](https://github.com/axiom-crypto/axiom-eth)

---

**Conclusion:** Direct Noir-to-Halo2 translation is not practical. The dual-circuit strategy is recommended, using Noir for on-chain proofs and Halo2 for recursive composition. This approach leverages the strengths of both systems while maintaining flexibility for SIP's proof composition goals.
