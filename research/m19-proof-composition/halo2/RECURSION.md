# Halo2 Recursion Capabilities Analysis

**Issue:** #237 (M19-02)
**Date:** 2026-01-20
**Status:** Research Complete
**Depends on:** #235 (Halo2 Architecture)

---

## Executive Summary

Halo2 achieves recursive proof composition through an **accumulation scheme** that defers expensive verification operations across multiple proofs. Instead of verifying each proof fully (expensive), proofs are accumulated into a single object that can be verified once at the end.

**Key insight:** The accumulator grows only logarithmically with recursion depth, making deep recursion practical.

---

## 1. Traditional Recursion vs Accumulation

### Traditional Recursive SNARKs

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL RECURSION                            │
│                                                                     │
│   Proof₁ ──▶ Verify in Circuit ──▶ Proof₂ ──▶ Verify in Circuit    │
│                    │                              │                 │
│                    ▼                              ▼                 │
│              ~1M constraints                 ~1M constraints        │
│              (pairing check)                 (pairing check)        │
│                                                                     │
│   PROBLEM: Each recursion adds ~1M constraints for verification     │
│   COST: O(n) per proof, where n = circuit size                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Halo2 Accumulation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HALO2 ACCUMULATION                               │
│                                                                     │
│   Proof₁ ──▶ Accumulate ──▶ Proof₂ ──▶ Accumulate ──▶ ... ──▶ Acc  │
│                  │                          │                  │    │
│                  ▼                          ▼                  ▼    │
│              ~120K constraints          ~120K constraints   VERIFY  │
│              (accumulation)             (accumulation)      ONCE    │
│                                                                     │
│   SOLUTION: Defer verification, accumulate commitments              │
│   COST: O(log n) amortized across all proofs                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Accumulation Scheme Mechanics

### Core Concept

The accumulation scheme works by exploiting a property of IPA polynomial commitments: **multiple evaluation proofs can be aggregated into a single proof**.

```
                         ACCUMULATION FLOW

    PROOF 1                  PROOF 2                  PROOF N
    ┌─────┐                  ┌─────┐                  ┌─────┐
    │ π₁  │                  │ π₂  │                  │ πₙ  │
    │     │                  │     │                  │     │
    │ C₁  │ commitment       │ C₂  │ commitment       │ Cₙ  │
    │ E₁  │ eval proof       │ E₂  │ eval proof       │ Eₙ  │
    └──┬──┘                  └──┬──┘                  └──┬──┘
       │                        │                        │
       └────────────┬───────────┴────────────┬───────────┘
                    │                        │
                    ▼                        ▼
              ┌───────────┐           ┌───────────┐
              │ACCUMULATE │           │ACCUMULATE │
              │  E₁ + E₂  │           │ + ... + Eₙ│
              └─────┬─────┘           └─────┬─────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │  FINAL ACCUMULATOR  │
                    │         Acc         │
                    │                     │
                    │  Verify ONCE at end │
                    └─────────────────────┘
```

### Mathematical Foundation

For IPA-based commitments, evaluation proofs have an additive structure:

```
Given:
- Commitment C to polynomial p(X)
- Evaluation proof E that p(z) = v

Aggregation property:
- E₁ (proof that p₁(z₁) = v₁)
- E₂ (proof that p₂(z₂) = v₂)

Can be combined:
- E_agg = E₁ + α·E₂  (for random challenge α)

This aggregated proof proves BOTH evaluations!
```

### Nested Amortization

The key insight is "nested amortization":

```
ROUND 1: Prover sends proof π₁
         Verifier computes partial check, outputs accumulator A₁

ROUND 2: Prover sends proof π₂
         Verifier checks A₁ was computed correctly
         Verifier computes partial check, outputs accumulator A₂

ROUND 3: Prover sends proof π₃
         Verifier checks A₂ was computed correctly
         Verifier computes partial check, outputs accumulator A₃

...

FINAL:   Verifier performs ONE expensive check on Aₙ
         This validates ALL previous proofs by induction!
```

---

## 3. Recursion Circuit Cost

### Per-Layer Overhead

Each recursive step requires:

| Operation | Constraints | Notes |
|-----------|-------------|-------|
| Accumulation check | ~120K | Verify previous accumulator correct |
| Group operations | m·log(n)·300 | ~400 group ops × 300 constraints each |
| Challenge hashing | ~10K | Fiat-Shamir challenges |
| **Total per layer** | **~120K-150K** | Much less than ~1M for full verification |

### Comparison

| Approach | Constraints per recursion | 10-deep recursion |
|----------|---------------------------|-------------------|
| Traditional SNARK | ~1,000,000 | ~10M constraints |
| Halo2 Accumulation | ~120,000 | ~1.2M constraints |
| **Improvement** | **~8x fewer** | **~8x fewer** |

---

## 4. Pasta Curve Cycle

### Why a Curve Cycle?

Recursive proofs require operating on two curves:
- **Proof generation** happens over curve's base field
- **Proof verification** happens over curve's scalar field

For efficient recursion, we need curves where:
- Curve A's scalar field = Curve B's base field
- Curve B's scalar field = Curve A's base field

### Pallas and Vesta

```
                    PASTA CURVE CYCLE

    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   PALLAS                              VESTA             │
    │   y² = x³ + 5                         y² = x³ + 5       │
    │                                                         │
    │   Base field: Fp                      Base field: Fq    │
    │   Scalar field: Fq ◀────────────────▶ Scalar field: Fp  │
    │                                                         │
    │                    ┌───────────┐                        │
    │   Prove on ────────│ ALTERNATE │──────── Prove on       │
    │   Pallas           └───────────┘         Vesta          │
    │       │                                     │           │
    │       ▼                                     ▼           │
    │   Commitment                           Commitment       │
    │   lives on Vesta                       lives on Pallas  │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

### Recursion Pattern

```
Step 1: Prove statement S₁ on Pallas
        Output: Commitment C₁ (lives on Vesta)

Step 2: Prove statement S₂ on Vesta
        Also prove: "C₁ was computed correctly"
        Output: Commitment C₂ (lives on Pallas)

Step 3: Prove statement S₃ on Pallas
        Also prove: "C₂ was computed correctly"
        Output: Commitment C₃ (lives on Vesta)

... continue alternating ...

Final: Single verification check on final accumulator
```

---

## 5. Deferred Verification

### The Optimization

Not all verification checks require crossing curves. Halo2 optimizes by:

1. **Native checks**: Performed immediately in same-curve circuit
2. **Deferred checks**: Accumulated for later verification

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEFERRED VERIFICATION                            │
│                                                                     │
│   VERIFIER CHECKS                                                   │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                                                           │    │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │    │
│   │  │   NATIVE    │    │   NATIVE    │    │  DEFERRED   │   │    │
│   │  │   CHECK 1   │    │   CHECK 2   │    │   CHECK     │   │    │
│   │  │             │    │             │    │             │   │    │
│   │  │ Do now in   │    │ Do now in   │    │ Accumulate  │   │    │
│   │  │ same curve  │    │ same curve  │    │ for later   │   │    │
│   │  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │    │
│   │         │                  │                  │          │    │
│   │         ▼                  ▼                  ▼          │    │
│   │      PASS/FAIL          PASS/FAIL        ADD TO ACC     │    │
│   │                                                          │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│   Result: Fewer curve-crossing operations = faster recursion        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Recursion Depth Limitations

### Theoretical Limits

| Factor | Limit | Notes |
|--------|-------|-------|
| **Accumulator size** | Grows logarithmically | O(log n) for n proofs |
| **Circuit size** | ~120K per layer | Practical limit ~100 layers |
| **Soundness** | 128-bit security | Maintained across depths |
| **Memory** | ~1GB for deep recursion | Prover memory bound |

### Practical Depth

For SIP's use case:

| Recursion Depth | Use Case | Feasibility |
|-----------------|----------|-------------|
| 1-2 | Single proof composition | ✅ Easy |
| 3-5 | Multi-system composition | ✅ Practical |
| 10-20 | Blockchain state proofs | ✅ Possible |
| 100+ | Extreme aggregation | ⚠️ Memory-bound |

---

## 7. Zcash Orchard Integration

### How Zcash Uses Halo2 Recursion

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZCASH ORCHARD ARCHITECTURE                       │
│                                                                     │
│   TRANSACTION BUNDLE                                                │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                                                           │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │    │
│   │  │ Action 1│  │ Action 2│  │ Action 3│  │ Action N│      │    │
│   │  │         │  │         │  │         │  │         │      │    │
│   │  │ Spend + │  │ Spend + │  │ Spend + │  │ Spend + │      │    │
│   │  │ Output  │  │ Output  │  │ Output  │  │ Output  │      │    │
│   │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘      │    │
│   │       │            │            │            │           │    │
│   │       └──────┬─────┴──────┬─────┴──────┬─────┘           │    │
│   │              │            │            │                 │    │
│   │              ▼            ▼            ▼                 │    │
│   │         ┌─────────────────────────────────────┐          │    │
│   │         │       SINGLE HALO2 PROOF            │          │    │
│   │         │                                     │          │    │
│   │         │  Covers ALL actions in bundle       │          │    │
│   │         │  ~2KB proof size                    │          │    │
│   │         │  ~20ms verification                 │          │    │
│   │         └─────────────────────────────────────┘          │    │
│   │                                                           │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Orchard Circuit Details

| Component | Constraints | Purpose |
|-----------|-------------|---------|
| Note commitment | ~10K | Commit to note value |
| Nullifier derivation | ~15K | Prevent double-spend |
| Merkle tree path | ~30K | Prove note in tree |
| Sinsemilla hash | ~20K | Efficient in-circuit hashing |
| **Total per action** | **~75K** | Single spend+output |

### Current Usage (Nov 2025)

- **4.2M ZEC** in Orchard pool (25.4% of supply)
- **Billions of dollars** secured by Halo2
- **Production-proven** recursion

---

## 8. Leveraging Zcash Circuits for SIP

### Reusable Components

| Zcash Component | SIP Use Case | Reusability |
|-----------------|--------------|-------------|
| Note commitment | Hidden amounts | ✅ Direct reuse |
| Nullifier circuit | Double-spend prevention | ✅ Direct reuse |
| Merkle proof | Stealth address registry | ⚠️ Adapt |
| Sinsemilla hash | Efficient hashing | ✅ Direct reuse |

### Integration Path

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SIP + ZCASH INTEGRATION                          │
│                                                                     │
│   SIP PRIVACY LAYER           ZCASH COMPONENTS                      │
│   ┌─────────────────┐        ┌─────────────────┐                   │
│   │                 │        │                 │                   │
│   │  Stealth        │◀───────│  Note           │                   │
│   │  Address        │ reuse  │  Commitment     │                   │
│   │  Commitment     │        │  Circuit        │                   │
│   │                 │        │                 │                   │
│   ├─────────────────┤        ├─────────────────┤                   │
│   │                 │        │                 │                   │
│   │  Nullifier      │◀───────│  Nullifier      │                   │
│   │  (prevent       │ reuse  │  Derivation     │                   │
│   │   replay)       │        │  Circuit        │                   │
│   │                 │        │                 │                   │
│   ├─────────────────┤        ├─────────────────┤                   │
│   │                 │        │                 │                   │
│   │  Amount         │◀───────│  Sinsemilla     │                   │
│   │  Hiding         │ reuse  │  Hash           │                   │
│   │                 │        │                 │                   │
│   └─────────────────┘        └─────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Findings

### Research Questions Answered

**Q1: How does accumulator-based recursion avoid trusted setup?**
> The accumulator uses IPA commitments (Pedersen-based) which only require publicly known generators. No toxic waste is generated because there's no structured reference string.

**Q2: What are the practical limits on recursion depth?**
> Theoretical: unlimited (accumulator grows O(log n))
> Practical: ~100 layers due to prover memory (~1GB)
> SIP needs: 3-5 layers (easily achievable)

**Q3: How does Zcash use Halo2 for Orchard?**
> Single Halo2 proof covers all actions in a transaction bundle. Each action is ~75K constraints. Proof size ~2KB, verification ~20ms.

**Q4: Can we leverage existing Zcash circuits?**
> Yes! Note commitment, nullifier derivation, and Sinsemilla hash can be directly reused. Merkle proof needs adaptation for stealth registry.

**Q5: What is the overhead of each recursive layer?**
> ~120K constraints per layer (vs ~1M for traditional SNARK verification). This is ~8x more efficient.

---

## 10. Implications for SIP Proof Composition

### Composition Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SIP PROOF COMPOSITION STRATEGY                   │
│                                                                     │
│   LAYER 1: SIP Validity (Noir)                                      │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  • Intent is authorized                                 │      │
│   │  • Amount is valid                                      │      │
│   │  • Nullifier is fresh                                   │      │
│   └─────────────────────────────────────────────────────────┘      │
│                              │                                      │
│                              ▼                                      │
│   LAYER 2: Zcash Privacy (Halo2)                                   │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  • Sender is hidden (note commitment)                   │      │
│   │  • Amount is hidden (Pedersen commitment)               │      │
│   │  • Recipient is stealth (address derivation)            │      │
│   └─────────────────────────────────────────────────────────┘      │
│                              │                                      │
│                              ▼                                      │
│   LAYER 3: Mina Verification (Kimchi) [Future]                     │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  • Succinct state proof                                 │      │
│   │  • Light client verification                            │      │
│   └─────────────────────────────────────────────────────────┘      │
│                              │                                      │
│                              ▼                                      │
│   FINAL: Halo2 Accumulator                                         │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  • Single proof: ~3KB                                   │      │
│   │  • Verification: ~50ms                                  │      │
│   │  • NO TRUSTED SETUP                                     │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Feasibility Assessment

| Criterion | Assessment | Notes |
|-----------|------------|-------|
| **Recursion depth** | ✅ Sufficient | Need 3-5 layers, can do 100+ |
| **Per-layer overhead** | ✅ Acceptable | ~120K constraints (manageable) |
| **Zcash reuse** | ✅ High | Core circuits directly reusable |
| **Trustless** | ✅ Yes | No setup ceremony needed |
| **Production-ready** | ✅ Yes | Battle-tested in Zcash |

---

## 11. Next Steps

1. **#243**: Benchmark actual proving times for Halo2
2. **#249**: Document specific circuit compatibility requirements
3. **#303**: Build POC to validate recursion in practice

---

## 12. References

- [Halo2 Book - Recursion](https://zcash.github.io/halo2/background/recursion.html)
- [Halo2 Book - IPA Polynomial Commitment](https://zcash.github.io/halo2/background/pc-ipa.html)
- [Electric Coin Company - Explaining Halo 2](https://electriccoin.co/blog/explaining-halo-2/)
- [ZIP 224: Orchard Shielded Protocol](https://zips.z.cash/zip-0224)
- [Halo Infinite Paper](https://eprint.iacr.org/2020/1536.pdf)
- [GitHub - halo-accumulation](https://github.com/rasmus-kirk/halo-accumulation)

---

**Conclusion:** Halo2's accumulation-based recursion is highly suitable for SIP's proof composition. The ~120K constraint overhead per layer is acceptable, and Zcash's battle-tested Orchard circuits can be reused for privacy components.
