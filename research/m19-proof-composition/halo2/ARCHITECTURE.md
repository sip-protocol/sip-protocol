# Halo2 Proof System Architecture

**Issue:** #235 (M19-01)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

Halo2 is a zero-knowledge proof system developed by Electric Coin Company (Zcash) that achieves **recursive proof composition without a trusted setup**. It combines PLONKish arithmetization with Inner Product Argument (IPA) polynomial commitments and an accumulation scheme for efficient recursion.

**Key advantages for SIP:**
- No trusted setup required
- Native recursion support via accumulation
- Flexible custom gates for optimized circuits
- Battle-tested in Zcash Orchard

---

## 1. Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HALO2 PROOF SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   CIRCUIT       │    │   POLYNOMIAL    │                    │
│  │   (PLONKish)    │───▶│   COMMITMENT    │                    │
│  │                 │    │   (IPA-based)   │                    │
│  └─────────────────┘    └────────┬────────┘                    │
│          │                       │                              │
│          │                       ▼                              │
│          │              ┌─────────────────┐                    │
│          │              │  ACCUMULATION   │                    │
│          │              │    SCHEME       │                    │
│          │              └────────┬────────┘                    │
│          │                       │                              │
│          ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │           PROOF GENERATION              │                   │
│  │  • Witness generation                   │                   │
│  │  • Constraint satisfaction              │                   │
│  │  • Polynomial evaluation                │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │           VERIFICATION                  │                   │
│  │  • O(log n) via inner product argument  │                   │
│  │  • Schwartz-Zippel testing              │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Polynomial Commitment Scheme (IPA)

### What is IPA?

The **Inner Product Argument (IPA)** is a polynomial commitment scheme based on Pedersen commitments. Unlike KZG (used in standard PLONK), IPA does not require a trusted setup.

### How it works

```
Commitment:    C = ⟨a, G⟩ + [r]W

Where:
- a = coefficient vector of the polynomial
- G = vector of group generators (publicly known)
- r = random blinding factor
- W = blinding generator
```

### IPA vs KZG Comparison

| Property | IPA (Halo2) | KZG (Standard PLONK) |
|----------|-------------|----------------------|
| Trusted Setup | **None** | Required (toxic waste) |
| Proof Size | ~1.5KB | ~400 bytes |
| Verification | O(n) or O(log n) with recursion | O(1) |
| Security | Discrete log | Pairing-based |
| Recursion | Native accumulation | Requires special circuits |

### Implication for SIP

IPA's lack of trusted setup is crucial for a decentralized privacy protocol. Users don't need to trust that setup ceremony participants destroyed toxic waste.

---

## 3. PLONKish Arithmetization

### Circuit Structure

Halo2 circuits are rectangular matrices with:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ INSTANCE │  ADVICE  │  ADVICE  │  FIXED   │ SELECTOR │
│  (public)│ (witness)│ (witness)│ (const)  │  (gate)  │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│   x₀     │   a₀     │   b₀     │   c₀     │   s₀     │  Row 0
├──────────┼──────────┼──────────┼──────────┼──────────┤
│   x₁     │   a₁     │   b₁     │   c₁     │   s₁     │  Row 1
├──────────┼──────────┼──────────┼──────────┼──────────┤
│   ...    │   ...    │   ...    │   ...    │   ...    │  ...
├──────────┼──────────┼──────────┼──────────┼──────────┤
│   xₙ     │   aₙ     │   bₙ     │   cₙ     │   sₙ     │  Row n
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

### Column Types

| Type | Purpose | Set By |
|------|---------|--------|
| **Instance** | Public inputs (known to verifier) | Verifier |
| **Advice** | Private witness values | Prover |
| **Fixed** | Constants (same for all proofs) | Circuit designer |
| **Selector** | Enable/disable gates per row | Circuit designer |

### Constraints and Gates

**Standard Gate (multiplication):**
```
s_mul · (a · b - c) = 0
```

**Custom Gate Example (range check):**
```
s_range · (a · (a - 1) · (a - 2) · (a - 3)) = 0  // a ∈ {0,1,2,3}
```

Gates can reference cells in adjacent rows via `Rotation`:
- `Rotation::cur()` - current row
- `Rotation::prev()` - previous row
- `Rotation::next()` - next row

---

## 4. Accumulation Scheme (Recursion)

### The Problem

Traditional recursive proofs require verifying a proof inside a circuit, which is expensive (millions of constraints for pairing-based verification).

### Halo2's Solution: Accumulation

Instead of verifying proofs, Halo2 **accumulates** them:

```
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Proof 1 │   │ Proof 2 │   │ Proof 3 │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     └──────┬──────┴──────┬──────┘
            │             │
            ▼             ▼
     ┌─────────────────────────┐
     │     ACCUMULATOR         │
     │  (combines all proofs)  │
     └────────────┬────────────┘
                  │
                  ▼
     ┌─────────────────────────┐
     │  FINAL VERIFICATION     │
     │  (verify once at end)   │
     └─────────────────────────┘
```

### How Accumulation Works

1. **Polynomial decomposition**: Split degree-n polynomial into pieces
2. **Challenge-weighted combination**: `H' = Σ[x^i]·Hᵢ`
3. **State aggregation**: Build intermediate polynomials that accumulate prover messages
4. **Deferred verification**: Only verify the final accumulated value

### Pasta Curves (Pallas/Vesta)

Halo2 uses a **cycle of curves** for efficient recursion:

```
Pallas: y² = x³ + 5  (over Fp)
Vesta:  y² = x³ + 5  (over Fq, where Fq = scalar field of Pallas)
```

This cycle allows:
- Prove on Pallas, verify elements live on Vesta
- Prove on Vesta, verify elements live on Pallas
- Efficient alternating recursion

---

## 5. Proof Structure

### Components

A Halo2 proof contains:

1. **Commitments**: Polynomial commitments to witness columns
2. **Evaluations**: Polynomial values at challenge points
3. **Opening proofs**: IPA proofs for polynomial openings
4. **Accumulator**: For recursive verification

### Verification Algorithm

```
1. Reconstruct polynomial evaluations from openings
2. Combine commitments using challenge-weighted linear combinations
3. Check vanishing polynomial constraint (Schwartz-Zippel)
4. Verify final equation:
   Σ[u_(j-1)]·Lⱼ + P' + Σ[uⱼ]·Rⱼ = [c]·G'₀ + [c·b₀·z]·U + [f]·W
```

---

## 6. Comparison with Noir/Barretenberg

| Aspect | Halo2 | Noir (Barretenberg) |
|--------|-------|---------------------|
| **Arithmetization** | PLONKish | UltraPLONK |
| **Commitment** | IPA | KZG |
| **Trusted Setup** | None | Required (powers of tau) |
| **Proof Size** | ~1.5KB | ~400 bytes |
| **Verification** | O(log n) amortized | O(1) |
| **Recursion** | Native accumulation | Recursive SNARK circuit |
| **Language** | Rust DSL | Noir DSL |
| **Maturity** | Production (Zcash) | Production (Aztec) |

---

## 7. Advantages for Recursive Composition

### Why Halo2 is ideal for proof composition:

1. **No trusted setup**: Composed proofs don't inherit setup trust assumptions
2. **Native accumulation**: Efficient recursion without verifier circuits
3. **Pasta curve cycle**: Optimized for alternating proof/verify operations
4. **Flexible gates**: Custom constraints for domain-specific optimizations
5. **Battle-tested**: Used in Zcash Orchard with billions of dollars secured

### Composition Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPOSED PROOF                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ SIP Privacy │  │   Zcash     │  │    Mina     │        │
│  │   (Noir)    │  │  (Halo2)    │  │  (Kimchi)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────┬───────┴────────┬───────┘                │
│                  │                │                         │
│                  ▼                ▼                         │
│         ┌─────────────────────────────────┐                │
│         │    HALO2 ACCUMULATOR            │                │
│         │  (combines all proofs)          │                │
│         └─────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Key Findings

### Research Questions Answered

**Q1: How does Halo2's accumulation scheme differ from traditional recursion?**
> Traditional recursion verifies entire proofs in-circuit (expensive). Halo2 accumulates polynomial commitments, deferring verification to a single final check.

**Q2: What are the trusted setup requirements?**
> **None.** IPA-based commitments use only publicly known generators. No toxic waste.

**Q3: How do custom gates affect circuit flexibility?**
> Custom gates allow domain-specific optimizations (e.g., range checks, hash functions) with fewer constraints than generic gates.

**Q4: What is the relationship between Halo2 and PLONK/TurboPLONK?**
> Halo2 uses UltraPLONK arithmetization (PLONK + custom gates + lookups) but replaces KZG with IPA for trustless setup.

**Q5: How does IPA impact proof size and verification?**
> IPA proofs are larger (~1.5KB vs ~400B) but verification is O(log n) via recursion. The tradeoff is acceptable for trustless recursion.

---

## 9. Implications for SIP

### Feasibility Assessment

| Criterion | Assessment | Notes |
|-----------|------------|-------|
| **Trustless** | ✅ Excellent | No setup ceremony needed |
| **Recursion** | ✅ Excellent | Native accumulation |
| **Performance** | ⚠️ Moderate | Larger proofs, but amortizable |
| **Integration** | ⚠️ Moderate | Rust-based, needs WASM/FFI |
| **Maturity** | ✅ Excellent | Production in Zcash |

### Recommended Next Steps

1. **#237**: Deep dive into accumulation mechanics
2. **#243**: Benchmark actual proving times
3. **#303**: Build POC to validate integration path

---

## 10. References

- [The halo2 Book - Protocol Description](https://zcash.github.io/halo2/design/protocol.html)
- [PLONKish Arithmetization](https://zcash.github.io/halo2/concepts/arithmetization.html)
- [Electric Coin Company - Explaining Halo 2](https://electriccoin.co/blog/explaining-halo-2/)
- [Kudelski Security - On the Security of Halo2](https://research.kudelskisecurity.com/2024/09/24/on-the-security-of-halo2-proof-system/)
- [Trail of Bits - Axiom's Halo2 Circuits](https://blog.trailofbits.com/2025/05/30/a-deep-dive-into-axioms-halo2-circuits/)
- [GitHub - zcash/halo2](https://github.com/zcash/halo2)

---

## Appendix: Adoption

Halo2 is used by:
- **Zcash** (Orchard shielded pool)
- **Scroll** (zkEVM L2)
- **Taiko** (zkEVM L2)
- **Protocol Labs** (Filecoin)
- **Ethereum Foundation PSE** (Privacy & Scaling Explorations)
- **Axiom** (ZK coprocessor)

---

**Conclusion:** Halo2's trustless recursion via accumulation makes it ideal for SIP's proof composition goals. The next step is understanding the accumulation mechanics in detail (#237).
