# Proof Composition Architecture Design

**Issue:** [#418](https://github.com/sip-protocol/sip-protocol/issues/418)
**Date:** January 2026
**Status:** Architecture Complete
**Depends On:** [PROOF-COMPOSITION-RESEARCH.md](./PROOF-COMPOSITION-RESEARCH.md) (#143)

## Executive Summary

This document defines the architecture for SIP Protocol's proof composition system. Based on feasibility research, we select **Option A (Sequential Composition)** with **PCD evolution path** as the target architecture. This provides immediate value through Noir recursive proofs while preserving the path to Tachyon-style wallet-carried proofs.

## Architecture Decision

### Selected: Option A - Sequential Composition with PCD Evolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIP PROOF COMPOSITION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Sequential Composition (M19)                                      │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │ Funding  │───▶│ Validity │───▶│Fulfillmnt│                              │
│  │  Proof   │    │  Proof   │    │  Proof   │                              │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                              │
│       │               │               │                                     │
│       └───────────────┼───────────────┘                                     │
│                       ▼                                                     │
│              ┌─────────────────┐                                            │
│              │   Recursive     │                                            │
│              │   Aggregator    │                                            │
│              │   (Noir)        │                                            │
│              └────────┬────────┘                                            │
│                       │                                                     │
│                       ▼                                                     │
│              ┌─────────────────┐                                            │
│              │  Aggregated     │  ◀── Single proof for 3 operations        │
│              │  SIP Proof      │                                            │
│              └─────────────────┘                                            │
│                                                                             │
│  PHASE 2: Cross-System Attestation (M20)                                    │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │  Zcash   │    │   SIP    │    │   Mina   │                              │
│  │  Halo2   │    │  Proofs  │    │  Kimchi  │                              │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                              │
│       │               │               │                                     │
│       ▼               │               ▼                                     │
│  ┌──────────┐         │         ┌──────────┐                               │
│  │ Aligned  │         │         │ Aligned  │                               │
│  │ Layer    │         │         │ Layer    │                               │
│  └────┬─────┘         │         └────┬─────┘                               │
│       │               │               │                                     │
│       └───────────────┼───────────────┘                                     │
│                       ▼                                                     │
│              ┌─────────────────┐                                            │
│              │  Noir Wrapper   │  ◀── Attestation verification             │
│              │  Circuit        │                                            │
│              └────────┬────────┘                                            │
│                       │                                                     │
│                       ▼                                                     │
│              ┌─────────────────┐                                            │
│              │  Composite      │  ◀── Zcash privacy + Mina succinctness    │
│              │  SIP Proof      │                                            │
│              └─────────────────┘                                            │
│                                                                             │
│  PHASE 3: PCD Evolution (M21+)                                              │
│  ════════════════════════════════                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WALLET STATE (PCD Model)                         │   │
│  │                                                                     │   │
│  │  WalletState = {                                                    │   │
│  │    balances: Map<Asset, Commitment>,                                │   │
│  │    nullifiers: Set<Nullifier>,                                      │   │
│  │    proof_of_correctness: PCDProof,  ◀── Proof carried with state    │   │
│  │    merkle_root: Hash,                                               │   │
│  │  }                                                                  │   │
│  │                                                                     │   │
│  │  Intent Execution:                                                  │   │
│  │  ┌─────────┐    ┌─────────────┐    ┌─────────────┐                 │   │
│  │  │ State_n │───▶│ Intent + Δ  │───▶│ State_n+1   │                 │   │
│  │  │ + Proof │    │ (increment) │    │ + Proof'    │                 │   │
│  │  └─────────┘    └─────────────┘    └─────────────┘                 │   │
│  │                                                                     │   │
│  │  Benefits:                                                          │   │
│  │  • Near-instant proof after initial sync                            │   │
│  │  • No full re-proving per intent                                    │   │
│  │  • State pruning possible                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Option A Over Other Options

| Option | Description | Decision | Rationale |
|--------|-------------|----------|-----------|
| **A: Sequential** | Proofs verified in chain, output feeds next | ✅ Selected | Matches Noir recursive model, proven in production |
| B: Parallel | Proofs combined via AND combiner | ❌ Rejected | Higher complexity, unclear Noir support |
| C: Recursive Wrapping | Inner proof wrapped in outer verifier | 🟡 Partial | Used within Option A for cross-system |
| D: PCD Model | Wallet carries proof incrementally | 🟡 Evolution | Future target, requires more research |

### Architecture Rationale

1. **Sequential composition** aligns with Noir's `#[recursive]` attribute pattern
2. **Aligned Layer** provides immediate path to cross-system verification
3. **PCD model** is the long-term vision for Tachyon-level performance
4. **Phased approach** allows shipping value while building toward ideal architecture

---

## Data Flow Diagrams

### Phase 1: Noir Recursive Aggregation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROOF AGGREGATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

USER                         SIP SDK                      PROVER
 │                              │                            │
 │  createShieldedIntent()      │                            │
 │─────────────────────────────▶│                            │
 │                              │                            │
 │                              │  generateFundingProof()    │
 │                              │───────────────────────────▶│
 │                              │                            │
 │                              │◀──────── FundingProof ─────│
 │                              │                            │
 │                              │  generateValidityProof()   │
 │                              │───────────────────────────▶│
 │                              │                            │
 │                              │◀──────── ValidityProof ────│
 │                              │                            │
 │                              │  aggregateProofs()         │
 │                              │───────────────────────────▶│
 │                              │                            │
 │                              │    ┌─────────────────────┐ │
 │                              │    │ Recursive Circuit   │ │
 │                              │    │ verifies:           │ │
 │                              │    │ - FundingProof      │ │
 │                              │    │ - ValidityProof     │ │
 │                              │    │ outputs:            │ │
 │                              │    │ - AggregatedProof   │ │
 │                              │    └─────────────────────┘ │
 │                              │                            │
 │                              │◀───── AggregatedProof ─────│
 │                              │                            │
 │◀─── ShieldedIntent + Proof ──│                            │
 │                              │                            │


SOLVER                       SETTLEMENT                   VERIFIER
 │                              │                            │
 │  submitIntent(proof)         │                            │
 │─────────────────────────────▶│                            │
 │                              │                            │
 │                              │  verifyAggregatedProof()   │
 │                              │───────────────────────────▶│
 │                              │                            │
 │                              │◀────── { valid: true } ────│
 │                              │                            │
 │                              │  settle()                  │
 │                              │                            │
 │◀──────── FulfillmentTx ──────│                            │
 │                              │                            │
```

### Phase 2: Cross-System Attestation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CROSS-SYSTEM ATTESTATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

ZCASH WALLET                 ALIGNED LAYER                SIP PROVER
 │                              │                            │
 │  createShieldedTx()          │                            │
 │─────────────────────────────▶│                            │
 │                              │                            │
 │◀──────── Halo2Proof ─────────│                            │
 │                              │                            │
 │  submitForAttestation()      │                            │
 │─────────────────────────────▶│                            │
 │                              │                            │
 │                              │  ┌─────────────────────┐   │
 │                              │  │ Aligned Layer       │   │
 │                              │  │ 1. Verify Halo2     │   │
 │                              │  │ 2. Commit to DA     │   │
 │                              │  │ 3. Generate Merkle  │   │
 │                              │  └─────────────────────┘   │
 │                              │                            │
 │◀──── AttestationReceipt ─────│                            │
 │                              │                            │
 │                              │  wrapInNoirProof()         │
 │                              │───────────────────────────▶│
 │                              │                            │
 │                              │    ┌─────────────────────┐ │
 │                              │    │ Noir Wrapper        │ │
 │                              │    │ - Verify Merkle     │ │
 │                              │    │ - Extract public    │ │
 │                              │    │ - Compose with SIP  │ │
 │                              │    └─────────────────────┘ │
 │                              │                            │
 │                              │◀─── CompositeProof ────────│
 │                              │                            │
```

---

## Interface Specifications

### ProofComposer Interface

```typescript
/**
 * Proof Composer Interface
 *
 * Composes multiple proofs into aggregated or composite proofs.
 */
interface ProofComposer {
  /**
   * Aggregate multiple SIP proofs into a single proof
   *
   * @param proofs - Array of proofs to aggregate
   * @returns Aggregated proof verifying all inputs
   */
  aggregate(proofs: SIPProof[]): Promise<AggregatedProof>

  /**
   * Compose proofs from multiple systems via attestation
   *
   * @param proofs - Map of system to proof
   * @returns Composite proof with cross-system attestation
   */
  compose(proofs: CrossSystemProofs): Promise<CompositeProof>

  /**
   * Verify an aggregated or composite proof
   *
   * @param proof - The proof to verify
   * @returns Verification result
   */
  verify(proof: AggregatedProof | CompositeProof): Promise<VerificationResult>
}

/**
 * Cross-system proof collection
 */
interface CrossSystemProofs {
  sip?: SIPProof
  zcash?: ZcashAttestation
  mina?: MinaAttestation
}

/**
 * Aggregated proof structure
 */
interface AggregatedProof {
  type: 'aggregated'
  proofData: Uint8Array
  publicInputs: {
    fundingCommitment: HexString
    intentHash: HexString
    timestamp: bigint
  }
  aggregatedCount: number
  circuit: 'noir-recursive'
}

/**
 * Composite proof with cross-system attestation
 */
interface CompositeProof {
  type: 'composite'
  proofData: Uint8Array
  publicInputs: {
    sipHash: HexString
    attestations: {
      system: 'zcash' | 'mina'
      merkleRoot: HexString
      verified: boolean
    }[]
  }
  sources: ('sip' | 'zcash' | 'mina')[]
}
```

### RecursiveAggregator Circuit

```noir
// packages/circuits/src/aggregator.nr

/// Recursive proof aggregator for SIP proofs
///
/// Verifies multiple proofs and outputs a single aggregated proof.
/// Uses Noir's #[recursive] attribute for efficient verification.

#[recursive]
fn aggregate_proofs(
    // Funding proof verification
    funding_proof: [u8; PROOF_SIZE],
    funding_public: FundingPublicInputs,

    // Validity proof verification
    validity_proof: [u8; PROOF_SIZE],
    validity_public: ValidityPublicInputs,

    // Output commitment (links proofs together)
    intent_hash: Field,
) -> pub AggregatedOutput {
    // 1. Verify funding proof
    let funding_valid = std::verify_proof(
        funding_proof,
        funding_public.to_fields()
    );
    assert(funding_valid, "Funding proof invalid");

    // 2. Verify validity proof
    let validity_valid = std::verify_proof(
        validity_proof,
        validity_public.to_fields()
    );
    assert(validity_valid, "Validity proof invalid");

    // 3. Verify linkage (funding commitment matches validity input)
    assert(
        funding_public.commitment == validity_public.input_commitment,
        "Proof linkage mismatch"
    );

    // 4. Compute aggregated output
    AggregatedOutput {
        funding_commitment: funding_public.commitment,
        intent_hash: intent_hash,
        aggregated_at: std::timestamp(),
        proof_count: 2,
    }
}

/// Public inputs for aggregated proof verification
struct AggregatedOutput {
    funding_commitment: Field,
    intent_hash: Field,
    aggregated_at: u64,
    proof_count: u8,
}
```

### AlignedLayer Adapter

```typescript
/**
 * Aligned Layer Adapter for Cross-System Attestation
 *
 * Bridges Zcash/Mina proofs to SIP via Aligned Layer verification.
 */
interface AlignedLayerAdapter {
  /**
   * Submit a Halo2 proof for verification and attestation
   *
   * @param proof - Zcash Orchard proof (Halo2)
   * @param publicInputs - Zcash transaction public inputs
   * @returns Attestation receipt with Merkle proof
   */
  submitHalo2(
    proof: Uint8Array,
    publicInputs: ZcashPublicInputs
  ): Promise<AttestationReceipt>

  /**
   * Submit a Kimchi proof for verification and attestation
   *
   * @param proof - Mina zkApp proof (Kimchi)
   * @param publicInputs - Mina state transition inputs
   * @returns Attestation receipt with Merkle proof
   */
  submitKimchi(
    proof: Uint8Array,
    publicInputs: MinaPublicInputs
  ): Promise<AttestationReceipt>

  /**
   * Verify an attestation receipt
   *
   * @param receipt - Attestation to verify
   * @returns Whether the attestation is valid
   */
  verifyAttestation(receipt: AttestationReceipt): Promise<boolean>
}

/**
 * Attestation receipt from Aligned Layer
 */
interface AttestationReceipt {
  /** Merkle root of verified proofs batch */
  batchRoot: HexString
  /** Merkle proof for this specific proof */
  merkleProof: HexString[]
  /** Index in the batch */
  proofIndex: number
  /** Original proof hash */
  proofHash: HexString
  /** Verification timestamp */
  verifiedAt: bigint
  /** Aligned Layer batch ID */
  batchId: string
}
```

---

## PCD Model Feasibility Assessment

### What is PCD (Proof-Carrying Data)?

Proof-Carrying Data is a paradigm where data carries its own proof of correctness. Each state transition extends the proof incrementally rather than re-proving from scratch.

### Assessment: PCD for SIP

| Criterion | Assessment | Notes |
|-----------|------------|-------|
| **Feasibility** | 🟡 Medium | Requires significant R&D |
| **Complexity** | High | Wallet-side proof maintenance |
| **Timeline** | 12-18 months | After Phase 2 completion |
| **Value** | Very High | Near-instant proofs after sync |

### PCD Benefits for SIP

1. **Near-Instant Proving**: After initial sync, each new intent only requires incremental proof update
2. **Reduced Computation**: No full re-proving of balance/history
3. **State Pruning**: Only recent proofs needed on-chain
4. **Better UX**: Transaction confirmation in seconds, not minutes

### PCD Challenges

1. **Wallet State Management**: Client must maintain PCD correctly
2. **Sync Complexity**: Initial sync requires downloading proof history
3. **Noir Support**: PCD libraries for Noir are immature
4. **Interoperability**: Cross-wallet PCD sharing is undefined

### PCD Decision: ACCEPT with Deferred Implementation

**Rationale:**
- PCD provides the ultimate user experience for privacy transactions
- Current Noir ecosystem lacks mature PCD support
- Sequential composition (Phase 1-2) provides immediate value
- PCD architecture should be designed now but implemented in M21+

**Action Items:**
- [ ] Design PCD state format compatible with sequential composition
- [ ] Monitor Noir PCD library development (Aztec team)
- [ ] Prototype PCD in testnet environment
- [ ] Integrate Tachyon research findings when available

---

## Implementation Plan

### Phase 1: Noir Recursive Aggregation (M19)

**Duration:** 3 months
**Dependencies:** Noir 1.0 stable, bb_proof_verification

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Recursive circuit design | `aggregator.nr` circuit spec |
| 3-4 | Implement FundingProof verification | Funding verifier in Noir |
| 5-6 | Implement ValidityProof verification | Validity verifier in Noir |
| 7-8 | Proof linkage and aggregation | Full aggregator circuit |
| 9-10 | TypeScript SDK integration | `ProofComposer` class |
| 11-12 | Testing and optimization | 80%+ test coverage, benchmarks |

**Acceptance Criteria:**
- [ ] Aggregator circuit compiles without warnings
- [ ] Aggregated proof verifies in <500ms (WASM)
- [ ] Gas cost reduced 2.5-3x vs individual proofs
- [ ] E2E tests pass with real proofs

### Phase 2: Cross-System Attestation (M20)

**Duration:** 4 months
**Dependencies:** Aligned Layer SDK, Halo2 proof format docs

| Week | Task | Deliverable |
|------|------|-------------|
| 1-4 | Aligned Layer integration | `AlignedLayerAdapter` |
| 5-8 | Noir wrapper circuit | `cross_system_verifier.nr` |
| 9-12 | Zcash attestation flow | Full Halo2 → SIP pipeline |
| 13-16 | Mina attestation flow | Full Kimchi → SIP pipeline |

**Acceptance Criteria:**
- [ ] Zcash proof attestation works on mainnet
- [ ] Mina proof attestation works on mainnet
- [ ] Composite proof verifies correctly
- [ ] Documentation complete

### Phase 3: PCD Evolution (M21+)

**Duration:** 6+ months
**Dependencies:** Noir PCD libraries, Tachyon research

| Milestone | Task | Deliverable |
|-----------|------|-------------|
| M21-Q1 | PCD state format design | `WalletState` spec |
| M21-Q2 | Incremental proof prototype | PoC implementation |
| M21-Q3 | Wallet integration | SDK with PCD support |
| M21-Q4 | Production hardening | Mainnet-ready PCD |

**Acceptance Criteria:**
- [ ] PCD proof generation <1s after sync
- [ ] State pruning reduces storage 10x
- [ ] Backwards compatible with Phase 1-2 proofs

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Noir 1.0 delayed | Medium | High | Use beta with feature gates |
| Aligned Layer API changes | Medium | Medium | Abstraction layer, version pinning |
| Halo2 verification overhead | Low | Medium | Benchmark early, fallback to relay |
| PCD libraries immature | High | Low | Defer to M21+, sequential first |
| Security vulnerabilities | Low | Critical | Third-party audit before mainnet |
| Performance regression | Medium | High | Comprehensive benchmarks per PR |

### Risk Mitigation Strategies

1. **Abstraction Layers**: All external integrations (Aligned, Zcash, Mina) behind interfaces
2. **Feature Flags**: PCD and cross-system features behind config flags
3. **Graceful Degradation**: Fall back to individual proofs if aggregation fails
4. **Audit Pipeline**: Security audit scheduled for M20 completion

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Required By |
|------------|--------|-------------|
| FundingProof circuit | ✅ Complete | Phase 1 |
| ValidityProof circuit | ✅ Complete | Phase 1 |
| FulfillmentProof circuit | ✅ Complete | Phase 1 |
| ProofProvider interface | ✅ Complete | Phase 1 |

### External Dependencies

| Dependency | Status | Required By | Risk |
|------------|--------|-------------|------|
| Noir 1.0 stable | 🟡 Beta | Phase 1 | Medium |
| bb_proof_verification | ✅ Available | Phase 1 | Low |
| Aligned Layer SDK | ✅ Production | Phase 2 | Low |
| Halo2 proof format docs | ✅ Available | Phase 2 | Low |
| Mina-Ethereum Bridge | 🟡 Testnet | Phase 2 | Medium |
| Noir PCD library | 🔴 R&D | Phase 3 | High |

---

## Conclusion

The proof composition architecture follows a phased approach:

1. **Phase 1 (M19)**: Noir recursive aggregation - Ship 3x gas reduction
2. **Phase 2 (M20)**: Cross-system attestation - Ship Zcash + Mina integration
3. **Phase 3 (M21+)**: PCD evolution - Ship near-instant proving

This architecture provides:
- **Immediate value** through proof aggregation
- **Strategic positioning** through cross-system composition
- **Long-term moat** through PCD-based wallet proofs

The PCD model is accepted as the target architecture but deferred until the Noir ecosystem matures. Sequential composition provides the foundation for PCD evolution.

---

## References

- [PROOF-COMPOSITION-RESEARCH.md](./PROOF-COMPOSITION-RESEARCH.md) - Feasibility research
- [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/) - PCD inspiration
- [Noir Recursive Proofs](https://noir-lang.org/docs/noir/standard_library/recursion) - Noir documentation
- [Aligned Layer](https://blog.alignedlayer.com/) - Cross-system attestation
- [Mina-Ethereum Bridge](https://minaprotocol.com/blog/bringing-mina-proofs-to-ethereum-with-the-aligned-bridge)
- [Halo2 Book](https://zcash.github.io/halo2/) - Zcash proof system
