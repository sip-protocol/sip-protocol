# Kimchi Proof System Architecture

**Issue:** #255 (M19-06)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

Kimchi is the zero-knowledge proof system powering the Mina Protocol. It's a PLONKish proof system with IPA-style polynomial commitments (no trusted setup) and native recursion via the Pickles framework. Like Halo2, it uses the Pasta curve cycle (Pallas/Vesta).

**Key advantages for SIP:**
- No trusted setup (same as Halo2)
- Native recursion via Pickles
- Same Pasta curves as Halo2 (potential compatibility)
- 22KB constant-size blockchain proofs
- Foreign field arithmetic (can verify Ethereum signatures)

---

## 1. Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      KIMCHI PROOF SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   CIRCUIT       │    │   POLYNOMIAL    │                    │
│  │   (PLONKish)    │───▶│   COMMITMENT    │                    │
│  │   15 columns    │    │   (IPA-based)   │                    │
│  └─────────────────┘    └────────┬────────┘                    │
│          │                       │                              │
│          │                       ▼                              │
│          │              ┌─────────────────┐                    │
│          │              │    PICKLES      │                    │
│          │              │   (Recursion)   │                    │
│          │              └────────┬────────┘                    │
│          │                       │                              │
│          ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │           PROOF GENERATION              │                   │
│  │  • Step circuit (application logic)     │                   │
│  │  • Wrap circuit (compression)           │                   │
│  │  • Accumulator aggregation              │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │           VERIFICATION                  │                   │
│  │  • ~22KB proof (constant size)          │                   │
│  │  • Succinct verification                │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Comparison with Halo2

| Aspect | Kimchi | Halo2 |
|--------|--------|-------|
| **Arithmetization** | PLONKish | PLONKish |
| **Columns** | 15 registers | Configurable |
| **Commitment** | IPA (Pasta) | IPA (Pasta) |
| **Curves** | Pallas/Vesta | Pallas/Vesta |
| **Trusted Setup** | None | None |
| **Recursion** | Pickles | Accumulation |
| **Custom Gates** | ~15 gate types | User-defined |
| **Lookups** | XOR, Range, Runtime | Configurable |
| **Proof Size** | ~22KB (Mina) | ~1.5KB |
| **Language** | Rust + o1js | Rust |
| **Production Use** | Mina Protocol | Zcash Orchard |

### Key Insight: Same Foundation

Both systems use:
- **Pasta curve cycle** (Pallas/Vesta)
- **IPA polynomial commitments**
- **No trusted setup**
- **PLONKish arithmetization**

This shared foundation suggests potential for **proof composition**.

---

## 3. Column Structure

### Witness Table (15 Registers)

```
┌─────────────────────────────────────────────────────────────────┐
│                    KIMCHI WITNESS TABLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Columns 0-6: IO Registers (Input/Output)                       │
│  ┌────┬────┬────┬────┬────┬────┬────┐                          │
│  │ r0 │ r1 │ r2 │ r3 │ r4 │ r5 │ r6 │ ← Gate inputs/outputs   │
│  └────┴────┴────┴────┴────┴────┴────┘                          │
│                                                                 │
│  Columns 7-14: Advice Registers (Intermediate)                  │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                     │
│  │ r7 │ r8 │ r9 │r10 │r11 │r12 │r13 │r14 │ ← Temporary values  │
│  └────┴────┴────┴────┴────┴────┴────┴────┘                     │
│                                                                 │
│  Total: 15 registers per row (up from 3 in Mina v1)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Coefficient Table

15 columns of fixed values that tweak gate behavior (similar to Halo2's fixed columns).

### Wiring Table

7 registers for permutation arguments (copy constraints).

---

## 4. Custom Gates

Kimchi provides specialized gates for common operations:

| Gate | Purpose | Columns Used |
|------|---------|--------------|
| **Generic** | Addition, multiplication | Variable |
| **Poseidon** | Hash permutation (5 rounds/gate) | All 15 |
| **CompleteAdd** | Elliptic curve point addition | Multiple |
| **VBSM** | Variable-base scalar multiplication | Multiple |
| **EndoScalarMul** | Endomorphism-based multiplication | Multiple |
| **RangeCheck** | 88-bit range across 3 values | 3 |
| **ForeignFieldAdd** | Cross-field addition (256-bit) | Multiple |
| **ForeignFieldMul** | Cross-field multiplication | Multiple |
| **Rot64** | 64-bit word rotation | 2 |
| **Xor16** | 16-bit XOR (chainable) | 2 |

### Foreign Field Arithmetic

Critical for SIP: Kimchi can perform arithmetic in foreign fields (e.g., 256-bit fields) while its native field is 255-bit. This enables:
- Verifying Ethereum secp256k1 signatures
- Verifying bn254 proofs (used by Noir/Barretenberg)
- Cross-chain cryptographic operations

---

## 5. Lookup Tables

| Table | ID | Size | Purpose |
|-------|----|----|---------|
| XOR | 0 | 16 entries | 4-bit XOR lookups |
| Range Check | 1 | 4,096 entries | 12-bit range validation |
| Runtime | Custom | Variable | User-defined tables |

Lookups are **opt-in** — circuits not using lookups have no overhead.

---

## 6. Pickles Recursion Layer

Pickles is the recursion framework built on Kimchi.

### Step and Wrap Circuits

```
┌─────────────────────────────────────────────────────────────────┐
│                    PICKLES RECURSION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STEP CIRCUIT (Application)          WRAP CIRCUIT (Compression) │
│  ┌─────────────────────────┐        ┌─────────────────────────┐│
│  │                         │        │                         ││
│  │ 1. Execute app logic    │        │ 1. Verify step circuit  ││
│  │ 2. Verify wrap proofs   │───────▶│ 2. Produce small proof  ││
│  │ 3. Aggregate accumulators│       │                         ││
│  │                         │        │ (No app logic, just     ││
│  │ Can verify up to 2      │        │  compression)           ││
│  │ previous wrap proofs    │        │                         ││
│  └─────────────────────────┘        └─────────────────────────┘│
│                                                                 │
│  Result: Constant-size ~22KB proof regardless of computation    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Accumulator Scheme

Similar to Halo2, Pickles uses accumulators:
- Accumulator = commitment to h(X) polynomial from IPA
- Deferred verification (accumulated, not verified immediately)
- Final verification at end of recursion chain

### Curve Cycle Usage

```
PALLAS CIRCUIT                    VESTA CIRCUIT
(Step proof)                      (Wrap proof)
     │                                 │
     │      Verify on Vesta           │
     └────────────────────────────────▶│
                                       │
     ◀────────────────────────────────┘
           Verify on Pallas

Alternating between curves enables efficient recursion
(Same pattern as Halo2)
```

---

## 7. Proof Structure

### Components

A Kimchi/Pickles proof contains:

1. **Witness commitments** (15 polynomial commitments)
2. **Permutation polynomial commitment**
3. **Quotient polynomial commitment**
4. **Lookup commitments** (if using lookups):
   - Sorted polynomial
   - Aggregation polynomial
   - Runtime table polynomial
5. **Evaluations at ζ and ζ·ω** for all polynomials
6. **Opening proof** (IPA-based)
7. **Previous challenges** (for recursion)

### Proof Size

- **Single Kimchi proof**: Variable (depends on circuit)
- **Pickles recursive proof**: ~22KB (constant for Mina blockchain)

---

## 8. o1js Integration

o1js is the TypeScript SDK for building zkApps on Mina.

### Development Experience

```typescript
// o1js example (similar to Noir DSL)
import { Field, SmartContract, method } from 'o1js';

class Example extends SmartContract {
  @method async proveKnowledge(preimage: Field, hash: Field) {
    // Poseidon hash verification
    const computed = Poseidon.hash([preimage]);
    computed.assertEquals(hash);
  }
}
```

### Performance (with Caching)

| Metric | Before Caching | After Caching |
|--------|----------------|---------------|
| Compilation | ~20s | ~3s |
| Improvement | baseline | 85% faster |

---

## 9. Performance Characteristics

### Benchmarking (from o1-labs)

```
bench_proof_creation:
  Instructions: 22,045,968,746
  L1 Accesses:  27,210,681,906
  L2 Accesses:  32,019,515
  RAM Accesses: 3,034,134
  Est. Cycles:  27,476,974,171
```

### Efficiency Gains

| Optimization | Improvement |
|--------------|-------------|
| Lookup tables for hashes | 3-4x fewer constraints |
| Pedersen hash (UltraPlonk vs TurboPlonk) | 345 → 103 gates |
| EC operations in Pickles | 10x faster |
| Prover key caching | 85% faster compilation |

### Block Production Targets

- Target: ~30 seconds for full block proving
- Achieved via parallel SNARK workers
- Future: 90-second block slots (down from 180s)

---

## 10. Folding (Arrabbiata)

O1Labs is developing Arrabbiata, a new folding scheme:

```
TRADITIONAL PICKLES              ARRABBIATA (Folding)

┌───────┐  ┌───────┐            ┌───────┐  ┌───────┐
│ Step  │  │ Wrap  │            │Input 1│  │Input 2│
└───┬───┘  └───┬───┘            └───┬───┘  └───┬───┘
    │          │                    │          │
    ▼          ▼                    └────┬─────┘
┌───────┐  ┌───────┐                    │
│ Step  │  │ Wrap  │                    ▼
└───┬───┘  └───┬───┘            ┌─────────────┐
    │          │                │   FOLD      │
    ...                         │ (cheaper)   │
                                └──────┬──────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │Single Proof │
                                └─────────────┘

Benefit: Faster proving for repeated circuit executions
```

---

## 11. Implications for SIP Proof Composition

### Compatibility Assessment

| Aspect | Kimchi-Halo2 | Notes |
|--------|--------------|-------|
| **Curve cycle** | ✅ Same (Pasta) | Both use Pallas/Vesta |
| **Commitment** | ✅ Same (IPA) | Same polynomial commitment |
| **Arithmetization** | ✅ Similar (PLONKish) | Both PLONKish variants |
| **Field** | ✅ Same | Same base/scalar fields |
| **Recursion** | ⚠️ Different | Pickles vs Accumulation |

### Composition Approaches

**Option 1: Accumulator-level composition**
- Aggregate Kimchi and Halo2 accumulators
- Both use IPA → compatible accumulator structure
- Final verification checks both

**Option 2: Cross-verify in circuit**
- Verify Halo2 proof inside Kimchi circuit (or vice versa)
- Same curves → efficient EC operations
- Foreign field gates help with any field differences

**Option 3: Shared accumulator scheme**
- Design unified accumulator that both can contribute to
- Research needed on protocol specifics

### SIP Composition Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIP COMPOSED PROOF                           │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │  Noir Circuit   │  │  Halo2 Circuit  │                     │
│   │ (SIP Validity)  │  │ (Zcash Privacy) │                     │
│   └────────┬────────┘  └────────┬────────┘                     │
│            │                    │                               │
│            ▼                    ▼                               │
│   ┌──────────────────────────────────────┐                     │
│   │          KIMCHI/PICKLES              │                     │
│   │  (Succinct recursive composition)    │                     │
│   │  • Same curves as Halo2              │                     │
│   │  • Foreign field for Noir proofs     │                     │
│   │  • ~22KB final proof                 │                     │
│   └──────────────────────────────────────┘                     │
│                        │                                        │
│                        ▼                                        │
│   ┌──────────────────────────────────────┐                     │
│   │       MINA VERIFICATION              │                     │
│   │  • Light client can verify           │                     │
│   │  • Constant-size proof               │                     │
│   │  • No full node needed               │                     │
│   └──────────────────────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Key Findings

### Research Questions Answered

**Q1: How does Kimchi relate to Halo2?**
> Both are PLONKish systems using IPA on Pasta curves with no trusted setup. They share fundamental cryptographic foundations, making composition feasible.

**Q2: What is Pickles and how does it differ from Halo2 accumulation?**
> Pickles is a recursion layer with explicit Step/Wrap circuit separation. Halo2 accumulation is more flexible. Both achieve deferred verification via accumulators.

**Q3: Can Kimchi verify external proofs (like Noir)?**
> Yes, via foreign field arithmetic gates. Kimchi can perform operations in 256-bit fields while native is 255-bit.

**Q4: What's the proof size?**
> ~22KB for full Mina blockchain proof (constant). Individual Kimchi proofs vary by circuit complexity.

**Q5: Is o1js suitable for SIP integration?**
> Yes, o1js provides TypeScript SDK for zkApps. However, direct Rust integration with Kimchi may be needed for proof composition.

---

## 13. References

- [Kimchi - Mina Book](https://o1-labs.github.io/proof-systems/specs/kimchi.html)
- [Pickles Overview - Mina Book](https://o1-labs.github.io/proof-systems/pickles/overview.html)
- [o1-labs/proof-systems GitHub](https://github.com/o1-labs/proof-systems)
- [Kimchi: Latest Update to Mina's Proof System](https://minaprotocol.com/blog/kimchi-the-latest-update-to-minas-proof-system)
- [(Re)Introducing Kimchi](https://www.o1labs.org/blog/reintroducing-kimchi)
- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [Mina Performance Roadmap](https://www.o1labs.org/blog/mina-performance-roadmap)

---

## 14. Summary

### Kimchi Profile

```
KIMCHI PROOF SYSTEM SUMMARY

Strengths:
+ No trusted setup (IPA commitments)
+ Native recursion (Pickles)
+ Same curves as Halo2 (Pasta)
+ Foreign field arithmetic
+ Constant-size final proofs (~22KB)
+ o1js TypeScript SDK

Considerations:
- Larger proof size than Halo2 (~22KB vs ~1.5KB)
- Different recursion model than Halo2
- Less flexible than Halo2 custom gates
- Tightly coupled to Mina ecosystem

Composition Potential:
→ High compatibility with Halo2 (same curves, IPA)
→ Foreign field gates for cross-system verification
→ Pickles can wrap external proofs
```

### Recommendation for SIP

**Kimchi is highly compatible with Halo2** due to shared Pasta curves and IPA commitments. Two composition paths:

1. **Use Kimchi/Pickles as final aggregator** — wrap Halo2 proofs for ~22KB constant-size output
2. **Use Halo2 accumulation with Kimchi proofs** — feed Kimchi outputs into Halo2 accumulator

Both approaches leverage the shared cryptographic foundation.

---

**Conclusion:** Kimchi's compatibility with Halo2 (same curves, same commitment scheme) makes it an excellent candidate for SIP's proof composition. The foreign field arithmetic enables verification of external systems, and Pickles provides constant-size recursive proofs. Proceed to benchmarking (#267) and integration requirements (#273).
