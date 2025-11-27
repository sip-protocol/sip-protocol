# Zcash Proving System Evaluation

> **Issue**: #34 - Evaluate leveraging Zcash proving system
> **Status**: EVALUATED
> **Date**: November 27, 2025
> **Author**: SIP Protocol Team

---

## Executive Summary

**Recommendation**: **Do NOT directly reuse Zcash Sapling/Orchard circuits**, but **leverage Halo2 as an alternative backend** for Noir circuits in the future.

**Rationale**: SIP's proof requirements differ significantly from Zcash's note-based UTXO model. However, Halo2's trustless setup and battle-tested security make it a valuable backend option that Noir can target.

---

## 1. Zcash Proving System Overview

### 1.1 Evolution Timeline

| Generation | Proof System | Trusted Setup | Status |
|------------|--------------|---------------|--------|
| Sprout | BCTV14 | Yes (6 participants) | Deprecated |
| Sapling | Groth16 | Yes (90+ participants/round) | Active |
| Orchard | Halo2 | **No** (IPA-based) | Active (default) |

### 1.2 Orchard/Halo2 Architecture

**Key Components**:
- **PLONKish arithmetization**: Flexible constraint system with custom gates
- **Inner Product Argument (IPA)**: Eliminates trusted setup
- **Pallas/Vesta curve cycle**: Enables recursive proofs
- **Sinsemilla hash**: Pallas-efficient commitments

**Orchard Circuit Purpose**:
```
Proves: "I can spend this note, creating new outputs, without revealing
        sender, receiver, or amount"
```

### 1.3 Orchard Note Structure

```
Note = {
  d:           diversifier (11 bytes)
  pk_d:        diversified transmission key
  v:           value (64-bit)
  rho:         nullifier randomness (derived from previous note)
  rseed:       random seed for note encryption
  cm:          note commitment
}
```

The Orchard Action circuit proves:
1. Nullifier is correctly derived from spent note
2. Value commitment is correct (homomorphic)
3. New note commitment is well-formed
4. Merkle path to anchor is valid

---

## 2. SIP Proof Requirements

### 2.1 SIP Proof Types

| Proof | Purpose | Public Inputs | Private Inputs |
|-------|---------|---------------|----------------|
| **Funding** | Prove balance ≥ minimum | commitment_hash, minimum, asset_id | balance, blinding, address, signature |
| **Validity** | Prove authorized intent | intent_hash, sender_commitment | sender_address, signature, nonce |
| **Fulfillment** | Prove correct execution | intent_id, quote_id, output_hash | execution_details, solver_signature |

### 2.2 Key Differences from Zcash

| Aspect | Zcash Orchard | SIP Protocol |
|--------|---------------|--------------|
| **Model** | UTXO (notes) | Intent-based (stateless) |
| **Value hiding** | Note commitments | Pedersen commitments |
| **Identity hiding** | Viewing keys + diversified addresses | Stealth addresses + viewing keys |
| **Proofs per tx** | 1 Action proof (spend+output) | 3 separate proofs |
| **State** | Merkle tree of commitments | No global state tree |
| **Nullifiers** | Prevent double-spend | Not needed (intent consumed once) |
| **Recursion** | Future upgrade path | Not required initially |

---

## 3. Technical Feasibility Analysis

### 3.1 Can We Reuse Orchard Circuits?

**Short answer: No, not directly.**

**Detailed analysis**:

| Orchard Component | SIP Compatibility | Notes |
|-------------------|-------------------|-------|
| Note commitment scheme | ⚠️ Partial | Uses Sinsemilla, we use Pedersen |
| Nullifier derivation | ❌ Not needed | SIP intents are one-time |
| Merkle tree verification | ❌ Not needed | SIP has no commitment tree |
| Value commitment | ✅ Compatible | Homomorphic, similar to ours |
| Key agreement | ⚠️ Partial | We use stealth addresses differently |
| Action circuit | ❌ Not compatible | Too specialized for UTXO model |

**Key incompatibilities**:

1. **UTXO vs Intent Model**: Orchard circuits prove transitions between notes in a global tree. SIP proves properties of stateless intents.

2. **Nullifier System**: Orchard's nullifier derivation (preventing double-spend) is central to its design. SIP intents are consumed once by solver fulfillment—no nullifier needed.

3. **Commitment Scheme**: Orchard uses Sinsemilla for Pallas efficiency. SIP uses Pedersen over secp256k1 for Ethereum/NEAR compatibility.

4. **Merkle Trees**: Orchard proves membership in a global commitment tree. SIP has no such tree—each intent is independent.

### 3.2 Can We Use Halo2 Directly?

**Answer: Yes, as a backend, but with significant development cost.**

**Pros**:
- No trusted setup (trustless security)
- Battle-tested (deployed in Zcash mainnet)
- Excellent performance characteristics
- Custom gates and lookup tables

**Cons**:
- Very steep learning curve ("expert's tool")
- Must build circuits from scratch
- Long compilation times
- September 2024 soundness bug raises concerns
- 156 lines vs 77 for equivalent Noir code

**Effort estimate**: 3-6 months to implement SIP circuits in raw Halo2.

### 3.3 Can Noir Target Halo2?

**Answer: Yes, this is the recommended path.**

Noir's backend-agnostic architecture supports multiple proving systems:
- UltraPlonk (default)
- Groth16
- **Halo2** (via ACIR compilation)
- Plonky2

**Benefits of Noir → Halo2**:
1. Write circuits in Noir's readable syntax
2. Get Halo2's trustless security
3. Preserve option to switch backends
4. Faster development with Noir abstractions

---

## 4. Recommendation

### 4.1 Primary Strategy: Noir with UltraPlonk (Phase 1)

Per the decision in ZK-ARCHITECTURE.md (#2), continue with Noir:
- Fastest development path
- Good developer experience
- Universal setup (no per-circuit ceremony)
- Rich standard library

### 4.2 Future Enhancement: Noir → Halo2 Backend (Phase 2)

When security requirements increase:
1. Compile Noir circuits to ACIR
2. Target Halo2 backend for trustless proofs
3. Maintain same circuit code, different backend

### 4.3 What to Leverage from Zcash

| Component | Leverage? | How |
|-----------|-----------|-----|
| Halo2 proving system | ✅ Yes | As Noir backend |
| Orchard circuits | ❌ No | Too UTXO-specific |
| Pedersen/Sinsemilla | ⚠️ Partial | Use our own Pedersen |
| ZK security research | ✅ Yes | Learn from their audits |
| Zcash integration | ✅ Yes | Via ZcashShieldedService |

---

## 5. Comparison Matrix

| Aspect | Custom Noir Circuits | Direct Halo2 | Reuse Orchard |
|--------|---------------------|--------------|---------------|
| **Development time** | 4-6 weeks | 3-6 months | Not feasible |
| **Security confidence** | Universal setup | Trustless | N/A |
| **Flexibility** | Full | Full | None |
| **Performance** | Good | Excellent | N/A |
| **Maintainability** | High | Medium | N/A |
| **Learning curve** | Low | Very High | N/A |
| **Recommendation** | ✅ Phase 1 | ✅ Phase 2 | ❌ |

---

## 6. Integration Design

### 6.1 Current Architecture (Phase 1)

```
User Input
    ↓
Noir Circuit (Funding/Validity/Fulfillment)
    ↓
ACIR (Abstract Circuit IR)
    ↓
UltraPlonk Backend
    ↓
Proof
```

### 6.2 Future Architecture (Phase 2)

```
User Input
    ↓
Noir Circuit (unchanged)
    ↓
ACIR (Abstract Circuit IR)
    ↓
┌─────────────────────────────┐
│  Backend Selection          │
├─────────────────────────────┤
│  • UltraPlonk (fast)        │
│  • Halo2 (trustless) ←      │
│  • Groth16 (smallest proof) │
└─────────────────────────────┘
    ↓
Proof
```

### 6.3 Zcash Integration Layer

```
SIP Protocol
    ↓
ZcashShieldedService (our SDK)
    ↓
Zcash RPC Client
    ↓
zcashd/zebrad node
    ↓
Zcash Orchard Pool (uses Halo2 internally)
```

We integrate with Zcash at the **transaction layer**, not the **circuit layer**.

---

## 7. Security Considerations

### 7.1 Trust Assumptions Comparison

| System | Trust Assumptions |
|--------|-------------------|
| Noir + UltraPlonk | Universal setup ceremony (Aztec) |
| Noir + Halo2 | No trusted setup (trustless) |
| Zcash Sapling | Powers of Tau + Sapling MPC |
| Zcash Orchard | No trusted setup (trustless) |

### 7.2 Risk Analysis

| Risk | Current (Noir+UltraPlonk) | Future (Noir+Halo2) |
|------|---------------------------|---------------------|
| Trusted setup compromise | Medium (universal) | None |
| Compiler bugs | Low (Noir maturing) | Low |
| Proving system bugs | Low | Medium (Sept 2024 bug) |
| Integration complexity | Low | Medium |

### 7.3 September 2024 Halo2 Bug

**Issue**: Query collision bug in Halo2 could allow fake proofs.
**Status**: Fixed in latest releases.
**Mitigation**: Use latest Halo2 versions; monitor security advisories.

---

## 8. Decision Record

### 8.1 Decision

**Do NOT directly reuse Zcash Sapling/Orchard circuits** for SIP Protocol.

**DO plan for Halo2 backend** as a future enhancement via Noir's backend-agnostic compilation.

### 8.2 Rationale

1. **Model Mismatch**: Zcash's UTXO model fundamentally differs from SIP's intent model. Adapting circuits would require complete rewrites.

2. **Development Efficiency**: Noir provides 2-3x faster development vs raw Halo2 while preserving the option to target Halo2 later.

3. **Security Path**: Start with universal setup (acceptable for MVP), upgrade to trustless Halo2 backend when needed.

4. **Integration Strategy**: Leverage Zcash at the transaction layer (ZcashShieldedService) rather than the circuit layer.

### 8.3 Action Items

1. ✅ Continue Noir circuit development (per #2)
2. ✅ Maintain ZcashShieldedService for transaction-layer integration (#33)
3. 📋 Plan Halo2 backend migration for production release
4. 📋 Monitor Noir → Halo2 backend maturity

---

## 9. References

- [Halo2 Book](https://zcash.github.io/halo2/) - Official documentation
- [Orchard Protocol (ZIP 224)](https://zips.z.cash/zip-0224) - Specification
- [Zcash Protocol Specification](https://zips.z.cash/protocol/protocol.pdf) - Full spec
- [Halo2 Security Research](https://kudelskisecurity.com/research/on-the-security-of-halo2-proof-system/) - Security analysis
- [Noir Backend Architecture](https://noir-lang.org/docs/explanations/noir/acir) - ACIR documentation
- [SIP ZK Architecture Decision](./ZK-ARCHITECTURE.md) - Our framework decision

---

*Document Status: EVALUATED*
*Last Updated: November 27, 2025*
