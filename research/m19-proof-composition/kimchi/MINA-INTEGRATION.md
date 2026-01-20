# Mina Kimchi Integration for Succinct Verification

**Issue:** #423 (M19-10)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

This document explores integrating SIP with Mina's Kimchi/Pickles for succinct verification. The goal is to leverage Mina's ~22KB constant-size proofs for light client verification of SIP composed proofs.

**Key Integration Value:**
- Constant-size proofs (~22KB) regardless of computation
- Light client verification (mobile-friendly)
- No full node required
- Chain-agnostic final proof

---

## 1. Integration Vision

### SIP + Mina Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIP COMPOSED PROOF                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   LAYER 1: PROOF GENERATION                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ Noir Proof  │  │ Halo2 Proof │  │ External    │            │
│   │ (Validity)  │  │ (Privacy)   │  │ (Any)       │            │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│          │                │                │                    │
│   LAYER 2: ACCUMULATION (Halo2)                                │
│          └────────┬───────┴────────┬───────┘                   │
│                   │                │                            │
│                   ▼                ▼                            │
│          ┌─────────────────────────────────┐                   │
│          │      HALO2 ACCUMULATOR          │                   │
│          │  • Aggregate multiple proofs    │                   │
│          │  • Flexible proof types         │                   │
│          └──────────────┬──────────────────┘                   │
│                         │                                       │
│   LAYER 3: COMPRESSION (Kimchi/Pickles)                        │
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
│          │       MINA VERIFICATION         │                   │
│          │  • Light client (~22KB)         │                   │
│          │  • Mobile verification          │                   │
│          │  • No full node needed          │                   │
│          └─────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Mina's Succinct Verification

### What Makes Mina Special

| Feature | Traditional Blockchain | Mina |
|---------|----------------------|------|
| State size | Grows unbounded | ~22KB constant |
| Verification | Full node required | Light client |
| Sync time | Hours/days | Seconds |
| Hardware | High requirements | Mobile-friendly |

### How Pickles Achieves This

```
TRADITIONAL BLOCKCHAIN          MINA (PICKLES)

Block 1 → Block 2 → Block N     Block 1 ─┐
    ↓         ↓         ↓                 │ Prove
  Full     Full      Full       Block 2 ──┤ recursively
  State    State     State                │
                                Block N ──┘
                                    │
                                    ▼
                              Single ~22KB Proof
                              (attests to all blocks)
```

---

## 3. Integration Approaches

### Approach A: SIP as Mina zkApp

Deploy SIP privacy logic as a native Mina zkApp.

**Architecture:**
```typescript
// SIP zkApp on Mina
class SIPPrivacy extends SmartContract {
  @state(Field) commitmentRoot = State<Field>();

  @method async privateTransfer(
    commitment: Field,
    nullifier: Field,
    proof: SIPProof
  ) {
    // Verify SIP proof
    proof.verify();

    // Update state
    this.commitmentRoot.set(newRoot);
  }
}
```

**Pros:**
- Native Mina integration
- Automatic ~22KB proofs
- On-chain state management

**Cons:**
- Tightly coupled to Mina
- Limited to Mina ecosystem
- Cross-chain complexity

### Approach B: Pickles as Compression Layer

Use Pickles solely for proof compression.

**Architecture:**
```
SIP Proofs (any chain)
         │
         ▼
   Halo2 Accumulator
         │
         ▼
   Pickles Compression ◄── Focus of this integration
         │
         ▼
   ~22KB Proof (chain-agnostic)
```

**Pros:**
- Chain-agnostic output
- Flexible input sources
- Best of both worlds

**Cons:**
- More complex pipeline
- Requires bridging Halo2→Pickles
- Development overhead

### Approach C: Mina as Settlement Layer

Use Mina blockchain for SIP settlement with succinct proofs.

**Architecture:**
```
SIP Intent (Solana/Ethereum)
         │
         ▼
   Privacy Processing
         │
         ▼
   Mina Settlement ◄── Settlement on Mina
         │
         ▼
   ~22KB Proof of Settlement
```

**Pros:**
- Leverages Mina's succinctness
- Built-in settlement finality
- Privacy + succinctness

**Cons:**
- Adds Mina as dependency
- Cross-chain bridging needed
- Liquidity fragmentation

---

## 4. Recommended Integration Path

### Hybrid: Approach B + Optional A

**Phase 1: Compression Layer (Approach B)**
- Use Pickles to compress SIP proofs
- Output: ~22KB chain-agnostic proof
- No Mina on-chain dependency

**Phase 2: Optional zkApp (Approach A)**
- Deploy SIP on Mina for native users
- Complementary to compression layer
- Explore Mina ecosystem growth

---

## 5. Technical Implementation

### 5.1 Verifying Halo2 in Kimchi

Kimchi's foreign field arithmetic enables Halo2 verification:

```typescript
import { ForeignField, ZkProgram } from 'o1js';

// Pasta field (shared by Halo2 and Kimchi)
const PastaField = ForeignField.create(
  28948022309329048855892746252171976963363056481941560715954676764349967630337n
);

const Halo2Verifier = ZkProgram({
  name: 'halo2-verifier',
  publicInput: Field, // Halo2 accumulator commitment

  methods: {
    verify: {
      privateInputs: [Halo2Proof],

      async method(commitment: Field, proof: Halo2Proof) {
        // Verify IPA opening
        // (Same Pasta curves = efficient verification)
        verifyIPAOpening(proof.commitment, proof.evaluation, proof.opening);

        // Verify accumulator matches
        commitment.assertEquals(proof.accumulatorCommitment);
      },
    },
  },
});
```

### 5.2 Pickles Wrapper Circuit

```typescript
const SIPPicklesWrapper = ZkProgram({
  name: 'sip-pickles-wrapper',
  publicInput: SIPComposedProofPublicInput,

  methods: {
    // Wrap and compress SIP composed proof
    wrap: {
      privateInputs: [Halo2AccumulatorProof],

      async method(
        publicInput: SIPComposedProofPublicInput,
        halo2Proof: Halo2AccumulatorProof
      ) {
        // Verify Halo2 accumulator
        Halo2Verifier.verify(publicInput.accumulatorCommitment, halo2Proof);

        // Additional SIP-specific checks
        publicInput.nullifier.assertNotEquals(Field(0));
        publicInput.commitment.assertNotEquals(Field(0));
      },
    },

    // Recursive: wrap multiple SIP proofs
    recursiveWrap: {
      privateInputs: [SelfProof, Halo2AccumulatorProof],

      async method(
        publicInput: SIPComposedProofPublicInput,
        previousProof: SelfProof<SIPComposedProofPublicInput, void>,
        newHalo2Proof: Halo2AccumulatorProof
      ) {
        // Verify previous wrapper proof
        previousProof.verify();

        // Verify new Halo2 proof
        Halo2Verifier.verify(publicInput.accumulatorCommitment, newHalo2Proof);
      },
    },
  },
});
```

### 5.3 Light Client Verification

```typescript
// Client-side verification (~22KB proof)
async function verifyOnLightClient(sipProof: PicklesProof): Promise<boolean> {
  // Load minimal verification key (constant size)
  const vk = await SIPPicklesWrapper.loadVerificationKey();

  // Verify proof (works on mobile)
  const isValid = await SIPPicklesWrapper.verify(sipProof);

  return isValid;
}
```

---

## 6. Constraints and Costs

### Circuit Complexity

| Component | Estimated Constraints | Notes |
|-----------|----------------------|-------|
| Halo2 IPA verify | ~100K | Same Pasta curves |
| Accumulator check | ~50K | Commitment verification |
| SIP public inputs | ~10K | Nullifier, commitment checks |
| **Total per wrap** | **~160K** | Reasonable for Pickles |

### Performance Estimates

| Operation | Time (Browser) | Time (Node) |
|-----------|----------------|-------------|
| Compilation | 30-60s | 15-30s |
| Single wrap | 20-40s | 10-20s |
| Recursive wrap | 30-60s | 15-30s |
| Verification | 1-2s | 500ms-1s |

---

## 7. Benefits for SIP

### Why Mina Integration Matters

1. **Light Client Verification**
   - Mobile apps can verify SIP proofs
   - No need to run full nodes
   - Better UX for end users

2. **Constant-Size Proofs**
   - ~22KB regardless of proof depth
   - Efficient for cross-chain messaging
   - Bandwidth-friendly

3. **Composability**
   - Can wrap any SIP composed proof
   - Chain-agnostic output
   - Future-proof architecture

4. **Mina Ecosystem Access**
   - Native zkApp deployment option
   - Access to Mina users/liquidity
   - Community and ecosystem support

---

## 8. Implementation Roadmap

### Phase 1: Research & Design (Complete)
- [x] Understand Kimchi/Pickles architecture
- [x] Document integration approaches
- [x] Identify technical requirements

### Phase 2: Proof of Concept (Next)
- [ ] Implement Halo2 verifier in o1js
- [ ] Build Pickles wrapper circuit
- [ ] Test with mock Halo2 proofs

### Phase 3: Integration
- [ ] Connect to SIP Halo2 accumulator
- [ ] Implement light client verification
- [ ] Benchmark performance

### Phase 4: Production (Future)
- [ ] Optimize circuit constraints
- [ ] Deploy on Mina testnet (optional)
- [ ] Production hardening

---

## 9. Challenges and Mitigations

### Challenge 1: Halo2-Pickles Bridge

**Problem:** Different recursion models (accumulation vs Step/Wrap)

**Mitigation:**
- Use commitment-based verification
- Verify Halo2 accumulator as "black box" in Pickles
- Same Pasta curves simplify EC operations

### Challenge 2: Performance

**Problem:** Browser proving can be slow

**Mitigation:**
- Use prover key caching
- Offload to server for complex proofs
- Progressive verification UX

### Challenge 3: Ecosystem Dependency

**Problem:** Tightly coupling to Mina

**Mitigation:**
- Use Pickles as compression layer only
- Keep core SIP chain-agnostic
- Mina zkApp as optional feature

---

## 10. Summary

### Integration Assessment

| Criterion | Assessment | Notes |
|-----------|------------|-------|
| **Feasibility** | ✅ High | Same Pasta curves |
| **Value** | ✅ High | Constant-size, light client |
| **Complexity** | ⚠️ Medium | Bridge Halo2→Pickles |
| **Dependency** | ⚠️ Medium | Optional Mina coupling |

### Recommendation

**Pursue Approach B (Compression Layer):**
1. Use Pickles to compress SIP proofs to ~22KB
2. Output is chain-agnostic (not Mina-specific)
3. Optional: Deploy as Mina zkApp later

### Key Benefits

- **Light client verification** — Mobile-friendly
- **Constant size** — ~22KB regardless of depth
- **Chain-agnostic** — Works with any chain
- **Future-proof** — Can add Mina zkApp later

---

## References

- [Mina Documentation](https://docs.minaprotocol.com/)
- [Pickles Overview](https://o1-labs.github.io/proof-systems/pickles/overview.html)
- [Kimchi Specification](https://o1-labs.github.io/proof-systems/specs/kimchi.html)
- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)

---

**Conclusion:** Mina/Pickles integration provides valuable succinct verification for SIP. The shared Pasta curves with Halo2 make the bridge feasible. Recommended approach: use Pickles as compression layer for ~22KB chain-agnostic proofs.
