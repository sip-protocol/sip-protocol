# Halo2 IPA Verifier Research Spike

**Issue:** #431 (M19-11)
**Date:** 2026-01-20
**Status:** Research Complete
**Duration:** 2-week spike

---

## Executive Summary

This research spike evaluates the feasibility of implementing native Halo2 IPA (Inner Product Argument) verification in Noir circuits, inspired by [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/)'s demonstration that Halo2 PCD is production-ready.

**Finding: NO-GO for Native IPA Verifier in Noir (Current State)**

Native Halo2 IPA verification in Noir is **not feasible in the near term** due to:
1. Curve incompatibility (Pasta vs BN254/Grumpkin)
2. ~50,000+ constraint overhead for foreign field operations
3. `noir_bigcurve` library is unstable ("work in progress, likely full of bugs")
4. 12-18 months estimated development time

**Recommendation:** Use [Aligned Layer](https://docs.alignedlayer.com/) for Halo2/Kimchi verification with 2/3 validator consensus trust model.

---

## 1. Technical Background

### 1.1 Halo2 IPA Overview

Halo2 uses an Inner Product Argument for polynomial commitments:

```
IPA Verification Steps:
1. Receive proof elements: {L_j, R_j} for j=1..k (k = log₂(n))
2. Generate challenges: u_j for each round
3. Compute final commitment: G_final from challenges
4. Compute final scalar: b_final from challenges
5. Verify: P = ⟨a, G⟩ + [r]H and v = ⟨a, b⟩
```

**Key Operations:**
- O(log n) group scalar multiplications
- O(log n) field multiplications
- One multi-scalar multiplication (MSM) for final check

### 1.2 Pasta Curves (Halo2)

Halo2 uses the Pasta curve cycle:

| Curve | Base Field | Scalar Field | Order |
|-------|------------|--------------|-------|
| Pallas | Fp | Fq | ~2²⁵⁴ |
| Vesta | Fq | Fp | ~2²⁵⁴ |

**Critical Property:** Pallas and Vesta form a 2-cycle where each curve's base field equals the other's scalar field.

```
Pallas: y² = x³ + 5  over Fp
Vesta:  y² = x³ + 5  over Fq
where Fp = Fq(Pallas_order) and Fq = Fp(Vesta_order)
```

### 1.3 Noir/Barretenberg Curves

Noir's default backend (Barretenberg) uses:

| Curve | Role | Notes |
|-------|------|-------|
| BN254 | Main curve | Pairing-friendly |
| Grumpkin | Embedded curve | Forms cycle with BN254 |

**Incompatibility:** Pasta curves (Pallas/Vesta) are NOT natively supported in Noir.

---

## 2. Feasibility Analysis

### 2.1 Curve Compatibility Assessment

| Criterion | Pasta in Noir | Status |
|-----------|---------------|--------|
| Native support | ❌ No | BN254/Grumpkin only |
| `noir_bigcurve` | ⚠️ Planned | "Work in progress, likely full of bugs" |
| Foreign field ops | ⚠️ Expensive | ~2000+ constraints per operation |
| Cycle structure | ❌ Incompatible | Pasta cycle ≠ BN254/Grumpkin cycle |

**Key Finding:** The `noir_bigcurve` library [lists Pasta curves as planned](https://github.com/noir-lang/noir_bigcurve) but explicitly warns it's unstable.

### 2.2 Constraint Estimation

To verify a Halo2 IPA proof in Noir, we need:

```
IPA Verifier Constraints (Estimated):

1. Scalar Multiplications (log n rounds):
   - Variable-base scalar mul: ~3,000 constraints/op (Grumpkin native)
   - Foreign curve (Pasta): ~15,000 constraints/op (5x overhead)
   - For k=8 rounds: 8 × 15,000 = 120,000 constraints

2. Multi-Scalar Multiplication (final check):
   - Native MSM: ~5,000 constraints
   - Foreign MSM: ~50,000 constraints (10x overhead)

3. Field Operations:
   - Native: ~10 constraints/op
   - Foreign (254-bit): ~500 constraints/op

4. Challenge Computation (Fiat-Shamir):
   - Poseidon hashes: ~500 constraints each
   - k challenges: 4,000 constraints

TOTAL ESTIMATE: ~180,000-250,000 constraints
```

**Comparison:**
| Approach | Constraints | Status |
|----------|-------------|--------|
| Noir recursive (native) | ~40,000 | ✅ Production |
| Halo2 IPA verifier (foreign) | ~200,000 | ⚠️ Theoretical |
| Full Halo2 proof verify | ~500,000+ | ❌ Impractical |

### 2.3 Performance Impact

```
Proving Time Estimates (WASM Browser):

Native Noir recursive proof:
- 40,000 constraints → ~30s

Halo2 IPA verifier (if implemented):
- 200,000 constraints → ~150-200s
- 500,000 constraints → ~400-500s (6+ minutes)

Memory requirements:
- Native: ~2GB peak
- Foreign field: ~8GB peak (may exceed browser limits)
```

---

## 3. Alternative Approaches

### 3.1 Aligned Layer (Recommended)

[Aligned Layer](https://docs.alignedlayer.com/) provides off-chain Halo2/Kimchi verification:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Halo2 Proof │────▶│  Aligned    │────▶│ Attestation │
│  (Zcash)    │     │   Layer     │     │  (Ethereum) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    Verified by 2/3
                    EigenLayer operators
```

**Cost Comparison:**

| System | Ethereum Direct | Aligned Layer |
|--------|-----------------|---------------|
| Groth16 | 250K gas | 40K gas |
| STARKs | 1M+ gas | 40K gas |
| Kimchi-IPA | Not feasible | 40K gas |
| Halo2-IPA | Not feasible | 40K gas |

**Trust Model:** 2/3 majority of restaked EigenLayer validators must agree.

### 3.2 Halo2-to-Grumpkin Bridge (Future)

A theoretical bridge approach:

```
Halo2 Proof (Pasta)
        │
        ▼
┌───────────────────┐
│ Pasta → Grumpkin  │  ◄── Accumulation bridge
│ Accumulator       │      (Research needed)
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Noir Grumpkin     │  ◄── Native verification
│ Verifier          │
└───────────────────┘
```

**Challenge:** Different curve cycles don't naturally compose.

### 3.3 Nova-style Folding

[Nova](https://github.com/microsoft/Nova) achieves constant-sized verifier circuits (2 group scalar muls):

```
Nova Verifier Advantages:
- O(1) constraints vs O(log n) for Halo
- Supports Pasta curves natively
- But: Requires implementing Nova in Noir
```

**Status:** Nova crate exists but no Noir port.

---

## 4. Project Tachyon Insights

[Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/) demonstrates production PCD:

**Key Innovations:**
1. **Oblivious Synchronization** — Wallets maintain proof-carrying state
2. **Oblivious Syncing Services** — Third-party sync using only nullifiers
3. **Shielded Transaction Aggregation** — Multiple Orchard txs → single proof

**SIP Relevance:**
- Confirms Halo2 PCD is production-ready for Zcash
- Validates accumulation for scaling
- Does NOT solve cross-system composition (Halo2 → Noir)

---

## 5. Constraint Deep Dive

### 5.1 Halo2 Variable-Base Scalar Multiplication

From [Halo2 Book](https://zcash.github.io/halo2/design/gadgets/ecc/var-base-scalar-mul.html):

```
Structure:
- 6 advice columns: (xT, yT, λ1, λ2, xA,i, zi)
- 10 advice columns for complete addition
- 3 gate types: q1 (init), q2 (loop), q3 (final)

Gates:
- q1 gate: Degree 4 (1 constraint)
- q2 gate: Degree 2-4 (6 constraints per round)
- q3 gate: Degree 3-4 (4 constraints)
- Complete addition: 7 constraints per round
- Overflow checks: 25 × 10-bit + 1 × 3-bit range checks

Per 254-bit scalar multiplication:
- ~84 rounds of incomplete addition
- ~3 rounds of complete addition
- Total: ~700-1000 constraints (native)
```

### 5.2 Foreign Field Overhead

Implementing Pasta operations in BN254 field:

```
Foreign Field Multiplication:
- Each 254-bit mul → ~50 native constraints
- Range checks for limb decomposition: ~100 constraints
- Carry propagation: ~50 constraints
- Total: ~200 constraints per foreign mul

Native vs Foreign:
- Native field op: ~1-5 constraints
- Foreign field op: ~200 constraints (40-200x overhead)

Foreign EC Point Addition:
- 3 field muls + 2 field squares
- 3 × 200 + 2 × 150 = 900 constraints
- vs ~10-20 native constraints
```

### 5.3 Full IPA Verifier Estimate

```
Halo2 IPA Verifier in Noir (n=2^8 = 256):

1. Log rounds (k=8):
   - Per round: 2 EC adds, 2 scalar muls
   - Foreign: 2 × 900 + 2 × 15,000 = 31,800
   - × 8 rounds = 254,400 constraints

2. Final MSM (simplified):
   - ~50,000 constraints for small MSM

3. Fiat-Shamir challenges:
   - 8 × 500 = 4,000 constraints

4. Field operations:
   - ~5,000 constraints

TOTAL: ~310,000+ constraints (conservative)
```

---

## 6. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| `noir_bigcurve` instability | High | High | Wait for stable release |
| Browser memory limits | High | Medium | Server-side proving |
| Proving time >5 min | Medium | High | Use Aligned Layer |
| Security vulnerabilities | Critical | Medium | Audit required |
| Maintenance burden | High | High | Rely on maintained solution |

---

## 7. Decision Matrix

| Approach | Feasibility | Timeline | Trust Model | Recommendation |
|----------|-------------|----------|-------------|----------------|
| Native IPA in Noir | ❌ Low | 12-18 mo | Trustless | NO-GO |
| Aligned Layer | ✅ High | 2-4 weeks | 2/3 validators | **RECOMMENDED** |
| Nova port to Noir | ⚠️ Medium | 6-12 mo | Trustless | Future R&D |
| Halo2-Grumpkin bridge | ❌ Low | 12+ mo | Trustless | Not recommended |

---

## 8. Recommendation

### 8.1 Immediate Action (M19)

**Use Aligned Layer for Halo2/Kimchi verification:**

```typescript
// SIP Proof Composition with Aligned Layer
async function composeSIPProof(
  sipProof: NoirProof,
  zcashProof: Halo2Proof
): Promise<ComposedProof> {
  // 1. Verify SIP proof (Noir recursive)
  const sipVerified = await verifyNoirProof(sipProof)

  // 2. Submit Zcash proof to Aligned Layer
  const attestation = await alignedLayer.verifyHalo2(zcashProof)

  // 3. Compose attestation into final Noir proof
  return await composeWithAttestation(sipProof, attestation)
}
```

**Trust Assumption:** Aligned Layer's 2/3 EigenLayer validator consensus

**Cost:** ~40K gas per Halo2 proof verification

### 8.2 Future Research (M21+)

If trustless composition becomes critical:

1. **Monitor `noir_bigcurve`** — Wait for Pasta curve stability
2. **Evaluate Nova** — Constant-sized verifier may be more practical
3. **Collaborate with Aztec** — They have similar cross-system needs
4. **Consider Mina/Pickles** — Same Pasta curves, native recursion

### 8.3 Not Recommended

- **Native IPA in Noir (now)** — Too expensive, too unstable
- **Custom curve implementation** — Massive engineering, high risk
- **Waiting for perfect solution** — Pragmatic shipping > theoretical purity

---

## 9. Conclusion

### Go/No-Go Decision

**NO-GO for Native Halo2 IPA Verifier in Noir**

| Criterion | Assessment |
|-----------|------------|
| Technical feasibility | ⚠️ Theoretically possible |
| Practical feasibility | ❌ Not near-term |
| Resource requirements | ❌ 12-18 months, high risk |
| Alternative available | ✅ Aligned Layer (2-4 weeks) |

### Action Items

1. **Proceed with Aligned Layer integration** for M19
2. **Document Aligned Layer trust model** for compliance
3. **Monitor `noir_bigcurve` development** for future re-evaluation
4. **Track Nova/folding research** for potential pivot

### Phase 2 Gate Assessment

**Question:** Can we verify Halo2 proofs efficiently?

**Answer:** Yes, via Aligned Layer with 2/3 validator trust model. Native trustless verification requires waiting for ecosystem maturity (12-18 months).

---

## References

- [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/)
- [Halo2 Book](https://zcash.github.io/halo2/)
- [noir_bigcurve](https://github.com/noir-lang/noir_bigcurve)
- [Aligned Layer Docs](https://docs.alignedlayer.com/)
- [Noir Recursive Proofs](https://noir-lang.org/docs/noir/standard_library/recursion)
- [Nova Paper](https://eprint.iacr.org/2021/370.pdf)
- [Pasta Curves](https://electriccoin.co/blog/the-pasta-curves-for-halo-2-and-beyond/)
- [LambdaClass IPA Explainer](https://blog.lambdaclass.com/ipa-and-a-polynomial-commitment-scheme/)

---

**Conclusion:** Native Halo2 IPA verification in Noir is not practical for M19. Aligned Layer provides a pragmatic path with acceptable trust assumptions. Revisit native verification in M21+ when `noir_bigcurve` matures.
