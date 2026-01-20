# Recommended Proof Composition Architecture

**Issue:** #336 (M19-19)
**Date:** 2026-01-20
**Status:** Architecture Complete

---

## Executive Summary

This document specifies the recommended architecture for SIP proof composition based on M19 research findings.

**Architecture:** Layered composition with Halo2 accumulation + Pickles compression

**Key Benefits:**
- Chain-agnostic ~22KB output
- Light client verification
- Trustless (no trusted setup)
- Flexible proof input sources

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SIP PROOF COMPOSITION ARCHITECTURE                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LAYER 1: PROOF GENERATION                        │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │ │
│  │  │ Noir/BB     │  │ Halo2       │  │ External    │  │ Aligned   │ │ │
│  │  │ Proofs      │  │ Proofs      │  │ Proofs      │  │ Attested  │ │ │
│  │  │ (SIP Core)  │  │ (Zcash)     │  │ (Any)       │  │ Proofs    │ │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │ │
│  │         │                │                │                │       │ │
│  └─────────┼────────────────┼────────────────┼────────────────┼───────┘ │
│            │                │                │                │         │
│            └────────────────┴────────────────┴────────────────┘         │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LAYER 2: ACCUMULATION                            │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   HALO2 ACCUMULATOR                           │ │ │
│  │  │                                                               │ │ │
│  │  │  • Accepts proofs from any Pasta-compatible source            │ │ │
│  │  │  • Cheap incremental updates (~15ms per proof)                │ │ │
│  │  │  • Deferred verification (single expensive check at end)      │ │ │
│  │  │  • Output: Accumulator commitment + witness                   │ │ │
│  │  │                                                               │ │ │
│  │  └────────────────────────────┬─────────────────────────────────┘ │ │
│  │                               │                                    │ │
│  └───────────────────────────────┼────────────────────────────────────┘ │
│                                  │                                       │
│                                  ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LAYER 3: COMPRESSION                             │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   PICKLES WRAPPER                             │ │ │
│  │  │                                                               │ │ │
│  │  │  • Verifies Halo2 accumulator commitment (same Pasta curves)  │ │ │
│  │  │  • Outputs constant-size proof (~22KB)                        │ │ │
│  │  │  • Uses Step/Wrap recursion model                             │ │ │
│  │  │                                                               │ │ │
│  │  └────────────────────────────┬─────────────────────────────────┘ │ │
│  │                               │                                    │ │
│  └───────────────────────────────┼────────────────────────────────────┘ │
│                                  │                                       │
│                                  ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LAYER 4: VERIFICATION                            │ │
│  │                                                                     │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐│ │
│  │  │ Light Client    │  │ On-chain        │  │ Full Node           ││ │
│  │  │ (Mobile/Browser)│  │ (Smart Contract)│  │ (Validator)         ││ │
│  │  │ ~22KB verify    │  │ ~22KB verify    │  │ ~22KB verify        ││ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘│ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Proof Generator Interface

```typescript
/**
 * Abstract interface for proof generators
 * Implementations: NoirGenerator, Halo2Generator, AlignedAttestor
 */
interface ProofGenerator {
  /** Generator identifier */
  readonly id: string

  /** Proof system type */
  readonly system: 'noir' | 'halo2' | 'kimchi' | 'aligned'

  /** Output curve (for accumulator compatibility) */
  readonly outputCurve: 'bn254' | 'pasta' | 'grumpkin'

  /** Generate a proof */
  generate(circuit: Circuit, witness: Witness): Promise<Proof>

  /** Verify a proof locally */
  verify(proof: Proof): Promise<boolean>
}

interface Proof {
  /** Raw proof bytes */
  data: Uint8Array

  /** Proof system that generated this */
  system: string

  /** Public inputs */
  publicInputs: Field[]

  /** Commitment (for accumulation) */
  commitment: CurvePoint
}
```

### 2.2 Accumulator Interface

```typescript
/**
 * Halo2 Accumulator for proof aggregation
 */
interface Accumulator {
  /** Current accumulator state */
  readonly state: AccumulatorState

  /** Number of proofs accumulated */
  readonly count: number

  /** Initialize empty accumulator */
  init(): Promise<AccumulatorState>

  /** Fold a proof into the accumulator */
  fold(proof: Proof): Promise<AccumulatorState>

  /** Fold multiple proofs (batch) */
  foldBatch(proofs: Proof[]): Promise<AccumulatorState>

  /** Get accumulator commitment (for compression) */
  getCommitment(): CurvePoint

  /** Export for Pickles compression */
  export(): AccumulatorExport
}

interface AccumulatorState {
  /** Running commitment */
  commitment: CurvePoint

  /** Accumulator witness (for final verification) */
  witness: Uint8Array

  /** Folded proof count */
  foldCount: number

  /** Public input bindings */
  publicInputBindings: Field[]
}

interface AccumulatorExport {
  /** Commitment for Pickles */
  commitment: CurvePoint

  /** Opening proof data */
  opening: Uint8Array

  /** Bound public inputs */
  publicInputs: Field[]
}
```

### 2.3 Compressor Interface

```typescript
/**
 * Pickles Compressor for constant-size output
 */
interface Compressor {
  /** Compress accumulated proofs to ~22KB */
  compress(accumulator: AccumulatorExport): Promise<CompressedProof>

  /** Verify compressed proof */
  verify(proof: CompressedProof): Promise<boolean>
}

interface CompressedProof {
  /** Proof bytes (~22KB) */
  data: Uint8Array

  /** Public inputs from original proofs */
  publicInputs: Field[]

  /** Proof type identifier */
  type: 'pickles'

  /** Original proof count */
  sourceCount: number
}
```

---

## 3. Data Flow

### 3.1 Standard Flow (Single Intent)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SINGLE INTENT FLOW                                                     │
│                                                                         │
│  1. User creates intent                                                 │
│     │                                                                   │
│     ▼                                                                   │
│  2. Generate SIP proofs (Noir)                                          │
│     ├── Funding Proof    (~22K constraints, ~30s)                       │
│     ├── Validity Proof   (~72K constraints, ~30s)                       │
│     └── Fulfillment Proof (~22K constraints, ~30s)                      │
│     │                                                                   │
│     ▼                                                                   │
│  3. Accumulate (Halo2)                                                  │
│     └── Fold 3 proofs (~1s total)                                       │
│     │                                                                   │
│     ▼                                                                   │
│  4. Compress (Pickles)                                                  │
│     └── Wrap accumulator (~20s)                                         │
│     │                                                                   │
│     ▼                                                                   │
│  5. Submit for settlement                                               │
│     └── ~22KB proof to settlement layer                                 │
│                                                                         │
│  Total: ~90s proving, ~22KB output                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Batch Flow (Multiple Intents)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BATCH INTENT FLOW (10 intents)                                         │
│                                                                         │
│  Intent₁  Intent₂  Intent₃  ...  Intent₁₀                              │
│     │        │        │             │                                   │
│     ▼        ▼        ▼             ▼                                   │
│  Proofs₁  Proofs₂  Proofs₃  ...  Proofs₁₀                              │
│  (3 each)                                                               │
│     │        │        │             │                                   │
│     └────────┴────────┴─────────────┘                                   │
│                    │                                                    │
│                    ▼                                                    │
│           Halo2 Accumulator                                             │
│           (fold 30 proofs)                                              │
│                    │                                                    │
│                    ▼                                                    │
│           Pickles Compression                                           │
│           (~20s, same as single!)                                       │
│                    │                                                    │
│                    ▼                                                    │
│           ~22KB proof (constant!)                                       │
│                                                                         │
│  Total: ~100s proving, ~22KB output (same as single intent!)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 PCD Flow (After Initial Sync)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PCD WALLET STATE FLOW                                                  │
│                                                                         │
│  Initial Sync (one-time)                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Scan blockchain → Process notes → Build initial PCD state (~90s)│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Subsequent Intents (fast!)                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Previous PCD State                                               │   │
│  │         │                                                        │   │
│  │         ▼                                                        │   │
│  │ Fold new transition (~15s)                                       │   │
│  │         │                                                        │   │
│  │         ▼                                                        │   │
│  │ New PCD State (with updated proof)                               │   │
│  │         │                                                        │   │
│  │         ▼                                                        │   │
│  │ Extract ~22KB proof for settlement                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  After initial sync: ~35s per intent (vs ~90s without PCD)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Interface Definitions

### 4.1 SDK Public Interface

```typescript
/**
 * SIP Composition SDK
 * For SDK consumers
 */
interface SIPComposition {
  // === Configuration ===

  /** Configure composition pipeline */
  configure(config: CompositionConfig): void

  // === Proof Generation ===

  /** Generate composed proof for intent */
  generateProof(intent: ShieldedIntent): Promise<ComposedProof>

  /** Generate batch proof for multiple intents */
  generateBatchProof(intents: ShieldedIntent[]): Promise<ComposedProof>

  // === PCD Operations (M21+) ===

  /** Initialize PCD wallet state */
  initPCDState(stealthMetaAddress: StealthMetaAddress): Promise<PCDState>

  /** Update PCD state with new transition */
  updatePCDState(state: PCDState, transition: Transition): Promise<PCDState>

  /** Extract proof from PCD state */
  extractProof(state: PCDState): Promise<ComposedProof>

  // === Verification ===

  /** Verify composed proof */
  verifyProof(proof: ComposedProof): Promise<boolean>
}

interface CompositionConfig {
  /** Proof generator to use */
  generator: 'noir' | 'halo2'

  /** Enable Pickles compression */
  compress: boolean

  /** Enable PCD mode (M21+) */
  pcdMode: boolean

  /** Prover key cache path */
  cacheDir?: string
}

interface ComposedProof {
  /** Proof data */
  data: Uint8Array

  /** Final proof size (should be ~22KB if compressed) */
  size: number

  /** Proof type */
  type: 'accumulated' | 'compressed' | 'pcd'

  /** Public inputs */
  publicInputs: Field[]

  /** Source proof count */
  sourceCount: number

  /** Verification key (for light clients) */
  verificationKey: Uint8Array
}
```

### 4.2 Internal Interfaces

```typescript
/**
 * Internal composition pipeline
 */
interface CompositionPipeline {
  /** Run full composition pipeline */
  execute(proofs: Proof[]): Promise<ComposedProof>

  /** Get pipeline status */
  getStatus(): PipelineStatus

  /** Cancel in-progress composition */
  cancel(): Promise<void>
}

interface PipelineStatus {
  stage: 'idle' | 'generating' | 'accumulating' | 'compressing' | 'complete'
  progress: number  // 0-100
  proofCount: number
  estimatedTimeRemaining: number  // ms
}
```

---

## 5. Integration Guidelines

### 5.1 For SDK Consumers

```typescript
// Example: Generate composed proof for privacy intent
import { SIP, SIPComposition } from '@sip-protocol/sdk'

// Configure SIP with composition
const sip = new SIP({
  network: 'mainnet',
  composition: {
    generator: 'noir',
    compress: true,  // Enable Pickles compression
    cacheDir: './cache',
  },
})

// Create and prove shielded intent
const intent = await sip.createShieldedIntent({
  from: { chain: 'solana', address: '...' },
  to: { chain: 'near', address: '...' },
  amount: 1000000000n,
  privacyLevel: 'shielded',
})

// Generate composed proof
const proof = await sip.composition.generateProof(intent)

console.log('Proof size:', proof.size)  // ~22KB
console.log('Verification key:', proof.verificationKey)

// Submit for settlement
await sip.submit(intent, proof)
```

### 5.2 For Light Clients

```typescript
// Example: Verify proof on light client (mobile)
import { verifyComposedProof } from '@sip-protocol/sdk/light'

const isValid = await verifyComposedProof(
  proof.data,
  proof.publicInputs,
  proof.verificationKey
)

console.log('Proof valid:', isValid)  // Should complete in ~1s
```

### 5.3 For Custom Proof Generators

```typescript
// Example: Integrate custom proof generator
import { ProofGenerator, Accumulator } from '@sip-protocol/sdk/composition'

class CustomGenerator implements ProofGenerator {
  readonly id = 'custom'
  readonly system = 'halo2'
  readonly outputCurve = 'pasta'

  async generate(circuit: Circuit, witness: Witness): Promise<Proof> {
    // Custom proof generation logic
  }

  async verify(proof: Proof): Promise<boolean> {
    // Custom verification logic
  }
}

// Register with composition pipeline
sip.composition.registerGenerator(new CustomGenerator())
```

---

## 6. Versioning Strategy

### 6.1 Proof Format Versions

```typescript
interface ProofVersion {
  /** Major version (breaking changes) */
  major: number  // Bump for new proof systems

  /** Minor version (new features) */
  minor: number  // Bump for new circuits

  /** Patch version (bug fixes) */
  patch: number  // Bump for fixes
}

// Current version
const PROOF_VERSION: ProofVersion = {
  major: 1,
  minor: 0,
  patch: 0,
}
```

### 6.2 Verification Key Management

```typescript
interface VerificationKeyRegistry {
  /** Register verification key for version */
  register(version: ProofVersion, key: VerificationKey): void

  /** Get verification key for version */
  get(version: ProofVersion): VerificationKey | undefined

  /** Check if version is supported */
  supports(version: ProofVersion): boolean

  /** List all supported versions */
  listVersions(): ProofVersion[]
}
```

### 6.3 Migration Path

```
Version 1.0.0 (M21)
├── Halo2 accumulation
├── Pickles compression
└── Basic PCD support

Version 1.1.0 (M22)
├── Optimized circuits
├── GPU acceleration
└── Enhanced PCD

Version 2.0.0 (M23+)
├── New proof systems (if added)
├── Breaking changes to format
└── Full backward compatibility layer
```

---

## 7. Monitoring and Observability

### 7.1 Metrics

```typescript
interface CompositionMetrics {
  // === Performance ===
  /** Proof generation time (ms) */
  proofGenerationTime: Histogram

  /** Accumulation time (ms) */
  accumulationTime: Histogram

  /** Compression time (ms) */
  compressionTime: Histogram

  /** Total composition time (ms) */
  totalTime: Histogram

  // === Resource Usage ===
  /** Memory usage (bytes) */
  memoryUsage: Gauge

  /** CPU usage (%) */
  cpuUsage: Gauge

  // === Throughput ===
  /** Proofs generated per minute */
  proofsPerMinute: Counter

  /** Proofs accumulated per minute */
  accumulationsPerMinute: Counter

  // === Errors ===
  /** Generation failures */
  generationErrors: Counter

  /** Verification failures */
  verificationErrors: Counter
}
```

### 7.2 Logging

```typescript
interface CompositionLogger {
  /** Log proof generation start */
  onGenerationStart(proofType: string, constraints: number): void

  /** Log proof generation complete */
  onGenerationComplete(proofType: string, timeMs: number): void

  /** Log accumulation */
  onAccumulation(proofCount: number, timeMs: number): void

  /** Log compression */
  onCompression(inputSize: number, outputSize: number, timeMs: number): void

  /** Log error */
  onError(stage: string, error: Error): void
}
```

### 7.3 Health Checks

```typescript
interface CompositionHealthCheck {
  /** Check if composition pipeline is healthy */
  isHealthy(): Promise<boolean>

  /** Get detailed health status */
  getStatus(): Promise<HealthStatus>
}

interface HealthStatus {
  healthy: boolean
  components: {
    generator: 'healthy' | 'degraded' | 'unhealthy'
    accumulator: 'healthy' | 'degraded' | 'unhealthy'
    compressor: 'healthy' | 'degraded' | 'unhealthy'
  }
  lastProofTime: number
  uptime: number
}
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (M20)

- [ ] Implement ProofGenerator interface
- [ ] Implement Accumulator interface
- [ ] Implement Compressor interface
- [ ] Basic integration tests

### Phase 2: Integration (M21)

- [ ] SDK public interface
- [ ] PCD mode support
- [ ] Prover key caching
- [ ] Documentation

### Phase 3: Production (M22)

- [ ] Performance optimization
- [ ] Monitoring integration
- [ ] Security audit
- [ ] Mainnet deployment

---

## 9. Conclusion

The recommended architecture provides:

1. **Flexibility:** Multiple proof sources (Noir, Halo2, external)
2. **Efficiency:** Halo2 accumulation + Pickles compression
3. **Portability:** ~22KB constant-size output
4. **Trustlessness:** No trusted setup required
5. **Future-proof:** PCD model for incremental updates

This architecture positions SIP as the privacy standard with a technical moat from proof composition capabilities.

---

## References

- [M19 Halo2 Research](./halo2/)
- [M19 Kimchi Research](./kimchi/)
- [M19 Compatibility Analysis](./HALO2-KIMCHI-COMPATIBILITY.md)
- [M19 Composition Analysis](./COMPOSITION-ANALYSIS.md)
- [M19 Benchmark Report](./BENCHMARK-REPORT.md)
