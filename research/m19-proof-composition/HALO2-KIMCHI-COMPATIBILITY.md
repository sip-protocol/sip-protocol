# Halo2 + Kimchi Compatibility Analysis

**Issue:** #417 (M19-05)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

This document analyzes the compatibility and composition potential of Zcash's Halo2 and Mina's Kimchi proof systems.

**Key Finding: HIGH COMPATIBILITY**

Halo2 and Kimchi share the same cryptographic foundation (Pasta curves, IPA commitments), making them uniquely suited for composition. This is the most promising cross-system integration path for SIP.

**Recommendation:**
1. Use Halo2 for privacy execution (flexible accumulation)
2. Use Kimchi/Pickles for succinct output (~22KB constant)
3. Defer Noir integration to M21+ (curve incompatibility with BN254)

---

## 1. Cryptographic Foundation Comparison

### 1.1 Curve Compatibility

| Property | Halo2 (Zcash) | Kimchi (Mina) | Compatible? |
|----------|---------------|---------------|-------------|
| Curve cycle | Pasta (Pallas/Vesta) | Pasta (Pallas/Vesta) | ✅ **Identical** |
| Base field | Fp (~2²⁵⁴) | Fp (~2²⁵⁴) | ✅ |
| Scalar field | Fq (~2²⁵⁴) | Fq (~2²⁵⁴) | ✅ |
| Commitment scheme | IPA (Pedersen) | IPA (Pedersen) | ✅ **Identical** |
| Hash function | Poseidon | Poseidon | ✅ **Identical** |

**Analysis:** The shared Pasta curve cycle is the critical enabler. Both systems can natively verify each other's curve operations without foreign field overhead.

### 1.2 Pasta Curve Details

```
Pallas Curve:
  y² = x³ + 5 over Fp
  Fp = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001

Vesta Curve:
  y² = x³ + 5 over Fq
  Fq = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001

Cycle Property:
  |Pallas| = Fq (Vesta's base field)
  |Vesta| = Fp (Pallas's base field)
```

This cycle enables efficient recursion: a circuit over Pallas can verify operations over Vesta and vice versa.

### 1.3 Polynomial Commitment Comparison

| Property | Halo2 IPA | Kimchi IPA |
|----------|-----------|------------|
| Type | Inner Product Argument | Inner Product Argument |
| Trusted setup | ❌ None | ❌ None |
| Commitment size | 1 group element | 1 group element |
| Proof size | O(log n) group elements | O(log n) group elements |
| Verification | O(n) naive, O(log n) amortized | O(n) naive, O(log n) amortized |

**Analysis:** Identical commitment schemes mean proofs can be verified natively without translation layers.

---

## 2. Arithmetization Comparison

### 2.1 PLONKish Gate Structures

| Feature | Halo2 | Kimchi |
|---------|-------|--------|
| Arithmetization | PLONKish | PLONKish |
| Custom gates | ✅ Supported | ✅ Supported (~15 built-in) |
| Lookup tables | ✅ Supported | ✅ Supported |
| Advice columns | User-defined | 15 fixed |
| Selector columns | User-defined | Via gate types |
| Rotations | Arbitrary | Limited (current, next) |

### 2.2 Key Differences

**Halo2:**
```rust
// Flexible gate definition
meta.create_gate("custom", |meta| {
    let a = meta.query_advice(advice[0], Rotation::cur());
    let b = meta.query_advice(advice[1], Rotation::cur());
    let c = meta.query_advice(advice[0], Rotation::next());
    vec![a * b - c]  // a × b = c
});
```

**Kimchi:**
```
Fixed 15 columns:
- 12 general-purpose (w0-w11)
- 3 permutation (z, z_w, z_h)

~15 custom gates:
- Generic (arithmetic)
- Poseidon
- EllipticCurve (add, double, scale)
- ForeignFieldAdd/Mul
- Lookup
- RangeCheck
- Xor
```

**Compatibility Impact:** Different gate structures require translation, but shared curves mean no cryptographic incompatibility.

---

## 3. Recursion Model Comparison

### 3.1 Halo2 Accumulation

```
┌─────────────────────────────────────────────────────────────┐
│  HALO2 ACCUMULATION MODEL                                    │
│                                                              │
│  Proof₁  Proof₂  Proof₃  ...  Proof_n                       │
│     │       │       │           │                            │
│     └───────┼───────┼───────────┘                            │
│             │       │                                        │
│             ▼       ▼                                        │
│      ┌──────────────────┐                                    │
│      │   ACCUMULATOR    │ ← Cheap to update (~120K constr)  │
│      │  (running sum)   │                                    │
│      └────────┬─────────┘                                    │
│               │                                              │
│               ▼                                              │
│      ┌──────────────────┐                                    │
│      │ FINAL VERIFY     │ ← One expensive check at end      │
│      │ (IPA opening)    │                                    │
│      └──────────────────┘                                    │
│                                                              │
│  Proof Size: ~1.5KB per proof (pre-final)                   │
│  Final Proof: ~5-10KB                                        │
└─────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Proofs accumulate into running sum
- Deferred verification until end
- Flexible input sources
- Proof size grows with depth (pre-final)

### 3.2 Kimchi/Pickles Recursion

```
┌─────────────────────────────────────────────────────────────┐
│  KIMCHI/PICKLES STEP/WRAP MODEL                              │
│                                                              │
│  Computation₁                                                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                 │
│  │  STEP   │ ← Prove computation (Vesta circuit)            │
│  └────┬────┘                                                 │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                 │
│  │  WRAP   │ ← Verify STEP proof (Pallas circuit)           │
│  └────┬────┘                                                 │
│       │                                                      │
│  Computation₂                                                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                 │
│  │  STEP   │ ← Prove computation + verify previous WRAP     │
│  └────┬────┘                                                 │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                 │
│  │  WRAP   │                                                 │
│  └────┬────┘                                                 │
│       │                                                      │
│       ▼                                                      │
│  CONSTANT ~22KB OUTPUT (regardless of depth)                │
└─────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Verify-in-circuit at each step
- Constant output size (~22KB)
- Fixed recursion pattern
- Built for blockchain state proofs

---

## 4. Composition Strategy

### 4.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              SIP PROOF COMPOSITION PIPELINE                     │
│                                                                 │
│   LAYER 1: PROOF GENERATION                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ Noir Proof  │  │ Halo2 Proof │  │ External    │            │
│   │ (Validity)  │  │ (Privacy)   │  │ (Any)       │            │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│          │                │                │                    │
│   LAYER 2: HALO2 ACCUMULATION                                   │
│          └────────┬───────┴────────┬───────┘                   │
│                   │                │                            │
│                   ▼                ▼                            │
│          ┌─────────────────────────────────┐                   │
│          │      HALO2 ACCUMULATOR          │                   │
│          │  • Aggregate multiple proofs    │                   │
│          │  • Flexible proof types         │                   │
│          │  • ~1.5KB per accumulated proof │                   │
│          └──────────────┬──────────────────┘                   │
│                         │                                       │
│   LAYER 3: KIMCHI/PICKLES COMPRESSION                          │
│                         │                                       │
│                         ▼                                       │
│          ┌─────────────────────────────────┐                   │
│          │    KIMCHI/PICKLES WRAPPER       │                   │
│          │  • Verify Halo2 accumulator     │                   │
│          │  • Compress to ~22KB            │                   │
│          │  • Constant-size output         │                   │
│          └──────────────┬──────────────────┘                   │
│                         │                                       │
│   LAYER 4: VERIFICATION                                        │
│                         │                                       │
│                         ▼                                       │
│          ┌─────────────────────────────────┐                   │
│          │       LIGHT CLIENT              │                   │
│          │  • Mobile-friendly (~22KB)      │                   │
│          │  • No full node needed          │                   │
│          │  • Chain-agnostic settlement    │                   │
│          └─────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Why This Architecture?

| Layer | System | Reason |
|-------|--------|--------|
| L1: Generation | Noir/Halo2/External | Flexibility for different proof types |
| L2: Accumulation | Halo2 | Best for aggregating heterogeneous proofs |
| L3: Compression | Pickles | Constant-size output for any depth |
| L4: Verification | Any chain | Chain-agnostic final proof |

### 4.3 Cross-System Verification

**Halo2 → Kimchi:**
```
Halo2 Accumulator (Pallas commitment)
        │
        ▼
Kimchi Circuit (runs on Vesta)
        │
        ├── Verify IPA opening on Pallas points
        │   └── Native! Same curve cycle
        │
        └── Output Pickles proof (~22KB)
```

**Why it works:**
- Kimchi on Vesta can verify Pallas commitments natively
- No foreign field arithmetic needed
- Shared Poseidon hash for challenge generation

---

## 5. Constraint Estimates

### 5.1 Halo2 Accumulator Verification in Kimchi

| Operation | Constraints | Notes |
|-----------|-------------|-------|
| IPA commitment check | ~50,000 | Same curve (native) |
| Accumulator update | ~70,000 | Point addition, scalar mul |
| Public input binding | ~5,000 | Hash verification |
| **Total per accumulation** | **~125,000** | |

### 5.2 End-to-End Proof Composition

| Stage | Time | Size | Constraints |
|-------|------|------|-------------|
| SIP Validity (Noir) | ~30s | ~2KB | ~72,000 |
| SIP Funding (Noir) | ~30s | ~2KB | ~22,000 |
| Halo2 Accumulate | ~10s | ~3KB | ~120,000 |
| Pickles Wrap | ~20s | ~22KB | ~200,000 |
| **Total** | **~90s** | **~22KB** | **~414,000** |

**After initial sync (PCD model):**
| Stage | Time | Notes |
|-------|------|-------|
| Incremental update | ~15s | Fold into existing accumulator |
| Pickles wrap | ~20s | If fresh output needed |

---

## 6. Noir Integration Analysis

### 6.1 The Challenge

Noir uses BN254/Grumpkin cycle, NOT Pasta:

```
Noir/Barretenberg:
  BN254 (main) ←cycle→ Grumpkin (embedded)

Halo2/Kimchi:
  Pallas ←cycle→ Vesta (Pasta)

INCOMPATIBLE CYCLES!
```

### 6.2 Options for Noir Integration

**Option A: Foreign Field Arithmetic (NOT RECOMMENDED)**
- Verify Pasta operations using BN254 field
- ~200 constraints per field operation (vs ~1 native)
- Total: ~310,000+ constraints for IPA verifier
- Conclusion: Impractical (see #431 research spike)

**Option B: Aligned Layer Attestation (RECOMMENDED for M19)**
- Verify Halo2/Kimchi proofs off-chain
- Attest verification result on-chain
- Trust model: 2/3 EigenLayer validators
- Cost: ~40K gas per proof

**Option C: Wait for noir_bigcurve (FUTURE)**
- Pasta curve support in development
- Currently "work in progress, likely full of bugs"
- Re-evaluate in M21+

### 6.3 Recommended Integration Path

```
M19 (Now):
  Noir proofs → Aligned Layer → Attestation

M21 (Future, if noir_bigcurve matures):
  Noir proofs → Halo2 accumulator → Pickles compression

M23+ (Long-term):
  Native Noir → Halo2 → Kimchi pipeline
```

---

## 7. Comparison with Alternatives

### 7.1 Halo2 + Kimchi vs Other Combinations

| Combination | Curve Compat | Feasibility | Proof Size | Notes |
|-------------|--------------|-------------|------------|-------|
| **Halo2 + Kimchi** | ✅ Same (Pasta) | ✅ High | ~22KB | Best option |
| Noir + Kimchi | ❌ Different | ⚠️ Medium | ~25KB | Foreign field overhead |
| Noir + Groth16 | ❌ Different | ⚠️ Medium | ~256B | Trusted setup |
| Halo2 + STARKs | ❌ Different | ❌ Low | ~100KB | Hash-based, no curve |

### 7.2 Why Halo2 + Kimchi is Optimal

1. **Same Pasta curves** — Native verification, no foreign field
2. **Both support recursion** — Can chain proofs efficiently
3. **Complementary strengths:**
   - Halo2: Flexible accumulation, privacy-focused
   - Kimchi: Constant output, light client friendly
4. **Trustless** — No trusted setup in either system
5. **Production-proven** — Zcash (Halo2), Mina (Kimchi) in production

---

## 8. Implementation Roadmap

### 8.1 Phase 1: Research (M19) ✅

- [x] Curve compatibility analysis
- [x] Proof format comparison
- [x] Recursion model analysis
- [x] Constraint estimates
- [x] Noir integration assessment

### 8.2 Phase 2: Prototype (M20)

- [ ] Implement Halo2 accumulator wrapper in Kimchi (o1js)
- [ ] Benchmark proof composition
- [ ] Test with mock SIP proofs

### 8.3 Phase 3: Integration (M21)

- [ ] Connect to SIP SDK
- [ ] Implement light client verification
- [ ] Documentation and examples

### 8.4 Phase 4: Production (M22+)

- [ ] Security audit
- [ ] Performance optimization
- [ ] Mainnet deployment

---

## 9. Research Answers

### Q1: Curve Compatibility

**Answer: YES, directly compatible**

Both use Pasta curves (Pallas/Vesta). This is the critical enabler that makes composition efficient.

### Q2: Proof Format

**Answer: Compatible with translation**

- Halo2 proofs can be verified in Kimchi circuits
- Kimchi proofs can wrap Halo2 accumulator outputs
- Translation layer needed for different gate structures

### Q3: Noir + Halo2 IPA

**Answer: NOT PRACTICAL (M19)**

- Curve incompatibility (BN254 vs Pasta)
- ~310,000+ constraints for foreign field verification
- Recommended: Use Aligned Layer for now, re-evaluate M21+

### Q4: PCD Applicability

**Answer: YES, highly applicable**

- Tachyon validates PCD model in production
- Barretenberg Client IVC provides Noir foundation
- Adopt for SIP wallet state in M21+

### Q5: Performance

| Metric | Halo2 | Kimchi | Composed |
|--------|-------|--------|----------|
| Proving | ~10-30s | ~10-20s | ~60-90s |
| Verification | ~10ms | ~1s | ~1s |
| Proof size | ~5KB | ~22KB | ~22KB |

---

## 10. Recommendations

### 10.1 Primary Recommendation

**Pursue Halo2 + Kimchi composition as SIP's proof compression layer:**

```
SIP Proofs (Noir) → Aligned Layer → Attestation
                           ↓
                    Halo2 Accumulator
                           ↓
                    Pickles Compression
                           ↓
                    ~22KB Light Client Proof
```

### 10.2 Key Benefits

1. **Chain-agnostic** — Final proof works anywhere
2. **Light client** — Mobile-friendly verification
3. **Trustless** — No trusted setup
4. **Production-proven** — Built on Zcash + Mina tech

### 10.3 Deferred Work

- **Native Noir → Halo2** — Wait for noir_bigcurve maturity
- **Full pipeline** — Requires M21+ development
- **PCD wallet state** — Implement after core composition works

---

## 11. Conclusion

### Feasibility Assessment

| Aspect | Status | Confidence |
|--------|--------|------------|
| Halo2 ↔ Kimchi | ✅ Feasible | High |
| Noir → Halo2 | ⚠️ Deferred | Medium |
| PCD model | ✅ Applicable | High |
| Production timeline | M21+ | Medium |

### Final Verdict

**FEASIBLE and RECOMMENDED**

Halo2 + Kimchi composition is the most promising path for SIP's proof compression layer. The shared Pasta curves make this uniquely efficient compared to other cross-system combinations.

**Action:** Proceed with Aligned Layer integration for M19, develop native composition for M21+.

---

## References

- [Halo2 Book](https://zcash.github.io/halo2/)
- [Kimchi Specification](https://o1-labs.github.io/proof-systems/specs/kimchi.html)
- [Pickles Overview](https://o1-labs.github.io/proof-systems/pickles/overview.html)
- [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/)
- [Pasta Curves](https://electriccoin.co/blog/the-pasta-curves-for-halo-2-and-beyond/)
- [Aligned Layer](https://docs.alignedlayer.com/)
- [noir_bigcurve](https://github.com/noir-lang/noir_bigcurve)
- [Nova IVC](https://eprint.iacr.org/2021/370.pdf)

---

**Conclusion:** Halo2 + Kimchi represents the optimal cross-system composition for SIP. The shared Pasta curves eliminate the foreign field overhead that plagues other combinations. Proceed with architecture implementation in M20-M21.
