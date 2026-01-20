# M20 Execution Plan: Technical Moat - Proof Composition v1

**Total Issues:** 27 open issues (#239-#463)
**Estimated Effort:** 4-6 weeks
**Dependencies:** M19 Research (✅ Complete)

---

## Phase 1: Foundation (Issues 01-04)
> Build the core interfaces and base implementations

### 1.1 [M20-01] Design ProofComposer interface and types (#239)
**Priority:** FIRST - Everything depends on this
**Files to create:**
- `packages/sdk/src/proofs/composer/types.ts`
- `packages/sdk/src/proofs/composer/interface.ts`
- `packages/types/src/proof-composition.ts`

**Deliverables:**
- [ ] ProofComposer interface (compose, verify, aggregate)
- [ ] ProofProvider abstract interface for Halo2/Kimchi/Noir
- [ ] ComposedProof type with metadata
- [ ] ProofCompositionConfig type
- [ ] ProofAggregationStrategy enum
- [ ] Export from @sip-protocol/types

---

### 1.2 [M20-02] Implement base ProofComposer class (#244)
**Depends on:** M20-01
**Files to create:**
- `packages/sdk/src/proofs/composer/index.ts`
- `packages/sdk/src/proofs/composer/base.ts`

**Deliverables:**
- [ ] BaseProofComposer abstract class
- [ ] Common composition logic
- [ ] Error handling patterns
- [ ] Logging/telemetry hooks

---

### 1.3 [M20-03] Add Halo2 proof provider integration (#250)
**Depends on:** M20-02
**Files to create:**
- `packages/sdk/src/proofs/providers/halo2.ts`

**Deliverables:**
- [ ] Halo2ProofProvider implementing ProofProvider
- [ ] WASM bindings for Halo2 (Zcash's proving system)
- [ ] Proof generation/verification methods
- [ ] Browser + Node.js support

---

### 1.4 [M20-04] Add Kimchi proof provider integration (#256)
**Depends on:** M20-02
**Files to create:**
- `packages/sdk/src/proofs/providers/kimchi.ts`

**Deliverables:**
- [ ] KimchiProofProvider implementing ProofProvider
- [ ] WASM bindings for Kimchi (Mina's proving system)
- [ ] Proof generation/verification methods
- [ ] Browser + Node.js support

---

## Phase 2: Core Logic (Issues 05-11)
> Implement aggregation, verification, and orchestration

### 2.1 [M20-05] Implement proof aggregation logic (#263)
**Depends on:** M20-03, M20-04
**Files to modify:**
- `packages/sdk/src/proofs/composer/base.ts`

**Deliverables:**
- [ ] Sequential aggregation strategy
- [ ] Parallel aggregation strategy
- [ ] Recursive aggregation strategy
- [ ] Aggregation result validation

---

### 2.2 [M20-06] Add proof verification pipeline (#268)
**Depends on:** M20-05
**Files to create:**
- `packages/sdk/src/proofs/composer/verification.ts`

**Deliverables:**
- [ ] Multi-stage verification pipeline
- [ ] Verification caching
- [ ] Batch verification support
- [ ] Verification result types

---

### 2.3 [M20-07] Create unified proof format specification (#274)
**Depends on:** M20-06
**Files to create:**
- `docs/specs/UNIFIED-PROOF-FORMAT.md`
- `packages/types/src/unified-proof.ts`

**Deliverables:**
- [ ] Unified proof format spec document
- [ ] TypeScript types for unified format
- [ ] Serialization/deserialization helpers

---

### 2.4 [M20-08] Implement proof format converters (#285)
**Depends on:** M20-07
**Files to create:**
- `packages/sdk/src/proofs/composer/converters.ts`

**Deliverables:**
- [ ] Noir → Unified converter
- [ ] Halo2 → Unified converter
- [ ] Kimchi → Unified converter
- [ ] Bidirectional conversion support

---

### 2.5 [M20-09] Add cross-system proof validation (#291)
**Depends on:** M20-08
**Files to create:**
- `packages/sdk/src/proofs/composer/cross-system.ts`

**Deliverables:**
- [ ] Cross-system validation logic
- [ ] Compatibility checks between proof systems
- [ ] Validation error types

---

### 2.6 [M20-10] Create proof composition orchestrator (#295)
**Depends on:** M20-09
**Files to create:**
- `packages/sdk/src/proofs/composer/orchestrator.ts`

**Deliverables:**
- [ ] ProofOrchestrator class
- [ ] Composition workflow management
- [ ] Progress tracking/callbacks
- [ ] Error recovery strategies

---

### 2.7 [M20-11] Implement fallback proof strategies (#301)
**Depends on:** M20-10
**Files to modify:**
- `packages/sdk/src/proofs/composer/orchestrator.ts`

**Deliverables:**
- [ ] Fallback chain configuration
- [ ] Graceful degradation logic
- [ ] Fallback telemetry

---

## Phase 3: Performance (Issues 12-15)
> Optimize for production use

### 3.1 [M20-12] Optimize proof generation parallelization (#307)
**Depends on:** M20-11
**Deliverables:**
- [ ] Worker pool for proof generation
- [ ] Parallel proving with dependency resolution
- [ ] Resource management

---

### 3.2 [M20-13] Implement proof caching layer (#313)
**Depends on:** M20-12
**Files to create:**
- `packages/sdk/src/proofs/composer/cache.ts`

**Deliverables:**
- [ ] In-memory proof cache
- [ ] Cache invalidation strategies
- [ ] Persistent cache option (IndexedDB)

---

### 3.3 [M20-14] Add lazy proof generation support (#319)
**Depends on:** M20-13
**Deliverables:**
- [ ] Deferred proof generation
- [ ] Proof generation scheduling
- [ ] Priority queue for proofs

---

### 3.4 [M20-15] Benchmark and optimize critical paths (#324)
**Depends on:** M20-14
**Deliverables:**
- [ ] Performance benchmarks
- [ ] Profiling reports
- [ ] Optimization implementations

---

## Phase 4: Integration (Issues 16-20)
> Expose to SDK, React, CLI, and SIP client

### 4.1 [M20-16] Add ProofComposer to SDK exports (#329)
**Depends on:** M20-15
**Files to modify:**
- `packages/sdk/src/index.ts`
- `packages/sdk/src/proofs/index.ts`

**Deliverables:**
- [ ] Export ProofComposer and related types
- [ ] Maintain backward compatibility
- [ ] Update SDK documentation

---

### 4.2 [M20-17] Create proof composition React hooks (#335)
**Depends on:** M20-16
**Files to create:**
- `packages/react/src/hooks/use-proof-composition.ts`

**Deliverables:**
- [ ] useProofComposition hook
- [ ] useProofVerification hook
- [ ] Composition status components

---

### 4.3 [M20-18] Add CLI commands for proof operations (#340)
**Depends on:** M20-16
**Files to create:**
- `packages/cli/src/commands/proof.ts`

**Deliverables:**
- [ ] `sip proof compose` command
- [ ] `sip proof verify` command
- [ ] `sip proof benchmark` command

---

### 4.4 [M20-19] Implement browser-compatible proof composition (#346)
**Depends on:** M20-17
**Files to create:**
- `packages/sdk/src/proofs/composer/browser.ts`

**Deliverables:**
- [ ] Browser WASM builds
- [ ] Web Worker integration
- [ ] Memory-efficient browser proving

---

### 4.5 [M20-20] Add proof composition to SIP client (#352)
**Depends on:** M20-19
**Files to modify:**
- `packages/sdk/src/sip.ts`

**Deliverables:**
- [ ] `sip.composeProof()` method
- [ ] Automatic proof composition for cross-chain intents
- [ ] SIP client integration tests

---

## Phase 5: Testing (Issues 21-23)
> Comprehensive test coverage

### 5.1 [M20-21] Unit tests for ProofComposer (#356)
**Depends on:** M20-20
**Files to create:**
- `packages/sdk/tests/proofs/composer/*.test.ts`

**Deliverables:**
- [ ] Interface tests
- [ ] Provider tests (Halo2, Kimchi)
- [ ] Aggregation tests
- [ ] Edge case coverage

---

### 5.2 [M20-22] Integration tests for multi-system proofs (#360)
**Depends on:** M20-21
**Files to create:**
- `packages/sdk/tests/integration/proof-composition.test.ts`

**Deliverables:**
- [ ] Cross-provider composition tests
- [ ] Real proof system tests
- [ ] Performance regression tests

---

### 5.3 [M20-23] E2E tests for composed proof verification (#363)
**Depends on:** M20-22
**Files to create:**
- `packages/sdk/tests/e2e/proof-composition.test.ts`

**Deliverables:**
- [ ] Full workflow E2E tests
- [ ] Browser E2E tests
- [ ] CI integration

---

## Phase 6: Documentation & Expansion (Issues 24-31)
> Docs and additional features

### 6.1 [M20-24] Write proof composition developer guide (#367)
**Depends on:** M20-23
**Files to create:**
- `docs/guides/PROOF-COMPOSITION.md`

**Deliverables:**
- [ ] Getting started guide
- [ ] API reference
- [ ] Examples and tutorials

---

### 6.2 [M20-26] BNB Chain support (#425)
**Depends on:** M20-20
**Deliverables:**
- [ ] Reuse M18 Solidity contracts
- [ ] BNB Chain adapter
- [ ] Tests

---

### 6.3 [M20-27] Oblivious Sync Service Interface (#433)
**Depends on:** M20-20
**Deliverables:**
- [ ] OSS interface design
- [ ] Implementation
- [ ] Privacy-preserving sync

---

### 6.4 [M20-28] Multi-language SDK (#460)
**Depends on:** M20-24
**Deliverables:**
- [ ] Python SDK bindings
- [ ] Rust SDK
- [ ] Go SDK

---

### 6.5 [M20-29] Chain-specific optimizations (#461)
**Depends on:** M20-26
**Deliverables:**
- [ ] Per-chain optimizations
- [ ] Gas optimization

---

### 6.6 [M20-30] NEAR fee contract (#462)
**Depends on:** M20-20
**Deliverables:**
- [ ] Protocol fee contract
- [ ] Revenue distribution

---

### 6.7 [M20-31] Governance token design (#463)
**Depends on:** M20-30
**Deliverables:**
- [ ] Token design research
- [ ] Governance model

---

## Execution Order Summary

```
Week 1-2: Phase 1 (Foundation)
  M20-01 → M20-02 → M20-03 → M20-04

Week 2-3: Phase 2 (Core Logic)
  M20-05 → M20-06 → M20-07 → M20-08 → M20-09 → M20-10 → M20-11

Week 3-4: Phase 3 (Performance)
  M20-12 → M20-13 → M20-14 → M20-15

Week 4-5: Phase 4 (Integration)
  M20-16 → M20-17 → M20-18 → M20-19 → M20-20

Week 5: Phase 5 (Testing)
  M20-21 → M20-22 → M20-23

Week 6: Phase 6 (Docs & Expansion)
  M20-24 → M20-26 → M20-27 → M20-28 → M20-29 → M20-30 → M20-31
```

---

## Next Action

**Start with:** #239 [M20-01] Design ProofComposer interface and types

Command: `gh issue view 239` then create branch `dev1` and implement.
