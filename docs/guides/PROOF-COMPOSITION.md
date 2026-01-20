# Proof Composition Developer Guide

**Time to read: 15 minutes**

Combine proofs from multiple ZK systems into unified attestations for privacy-preserving cross-chain transactions.

## What is Proof Composition?

Proof composition is SIP's technical moat — the ability to combine zero-knowledge proofs from different proving systems (Noir, Halo2, Kimchi) into a single verifiable attestation.

**Benefits:**
- **Unified verification** — One proof attests to multiple operations
- **Cross-system privacy** — Combine Zcash privacy with Mina succinctness
- **Gas optimization** — Verify once instead of multiple times
- **Compliance ready** — Viewing keys work across composed proofs

## Core Concepts

### Proof Systems

SIP supports multiple ZK proving systems:

| System | Origin | Strength | Use Case |
|--------|--------|----------|----------|
| **Noir** | Aztec | Developer-friendly DSL | SIP native proofs |
| **Halo2** | Zcash | Recursive, no trusted setup | Privacy proofs |
| **Kimchi** | Mina | Succinct verification | State proofs |
| **Groth16** | Various | Tiny proofs | On-chain verification |
| **PLONK** | Various | Universal setup | General circuits |

### Aggregation Strategies

```
┌─────────────────────────────────────────────────────────────┐
│                  AGGREGATION STRATEGIES                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SEQUENTIAL: A → B → C (output feeds input)                 │
│  ┌───┐   ┌───┐   ┌───┐                                     │
│  │ A │──▶│ B │──▶│ C │──▶ Composed                         │
│  └───┘   └───┘   └───┘                                     │
│                                                             │
│  PARALLEL: A + B + C (independent proofs)                   │
│  ┌───┐                                                      │
│  │ A │──┐                                                   │
│  └───┘  │                                                   │
│  ┌───┐  ├──▶ Composed                                       │
│  │ B │──┤                                                   │
│  └───┘  │                                                   │
│  ┌───┐  │                                                   │
│  │ C │──┘                                                   │
│  └───┘                                                      │
│                                                             │
│  RECURSIVE: Proof-of-proofs (constant size output)          │
│  ┌─────┐    ┌─────┐                                        │
│  │A + B│───▶│AB+CD│───▶ Single proof                       │
│  └─────┘    └─────┘                                        │
│  ┌─────┐         ▲                                         │
│  │C + D│─────────┘                                         │
│  └─────┘                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
pnpm add @sip-protocol/sdk
```

## Quick Start

### 1. Initialize Providers

```typescript
import {
  ProofAggregator,
  createProofAggregator,
  Halo2Provider,
  KimchiProvider,
  MockProofProvider,
} from '@sip-protocol/sdk'

// Initialize proof providers
const noirProvider = new MockProofProvider() // Use NoirProofProvider in production
const halo2Provider = new Halo2Provider()
const kimchiProvider = new KimchiProvider()

await Promise.all([
  noirProvider.initialize(),
  halo2Provider.initialize(),
  kimchiProvider.initialize(),
])

// Create aggregator
const aggregator = createProofAggregator({
  maxProofs: 10,
  enableParallel: true,
  verbose: false,
})

// Provider lookup function
function getProvider(system) {
  switch (system) {
    case 'noir': return noirProvider
    case 'halo2': return halo2Provider
    case 'kimchi': return kimchiProvider
  }
}
```

### 2. Generate Individual Proofs

```typescript
import { randomBytes, bytesToHex } from '@noble/hashes/utils'

// Generate a funding proof
const fundingResult = await noirProvider.generateFundingProof({
  balance: 1000000000000000000n, // 1 ETH
  minimumRequired: 500000000000000000n, // 0.5 ETH
  blindingFactor: randomBytes(32),
  assetId: 'ETH',
  userAddress: wallet.address,
  ownershipSignature: await wallet.signMessage('SIP Funding Proof'),
})

// Generate a validity proof
const validityResult = await noirProvider.generateValidityProof({
  intentHash: intentHash,
  senderAddress: wallet.address,
  senderBlinding: randomBytes(32),
  senderSecret: wallet.privateKey,
  authorizationSignature: await wallet.signMessage(intentHash),
  nonce: randomBytes(16),
  timestamp: Date.now(),
  expiry: Date.now() + 3600000, // 1 hour
})

console.log('Funding proof generated:', fundingResult.proof)
console.log('Validity proof generated:', validityResult.proof)
```

### 3. Compose Proofs

```typescript
// Convert to SingleProof format
const proofs = [
  {
    id: 'funding-proof',
    proof: fundingResult.proof.proof,
    publicInputs: fundingResult.proof.publicInputs,
    metadata: {
      system: 'noir',
      systemVersion: '0.32.0',
      circuitId: 'funding_proof',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
    },
  },
  {
    id: 'validity-proof',
    proof: validityResult.proof.proof,
    publicInputs: validityResult.proof.publicInputs,
    metadata: {
      system: 'noir',
      systemVersion: '0.32.0',
      circuitId: 'validity_proof',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
    },
  },
]

// Aggregate sequentially
const result = await aggregator.aggregateSequential({
  proofs,
  getProvider,
  verifyBefore: true, // Verify each proof before aggregating
})

if (result.success) {
  console.log('Composed proof:', result.composedProof)
  console.log('Aggregation time:', result.metrics.timeMs, 'ms')
}
```

## Aggregation Strategies

### Sequential Aggregation

Best for **linked proofs** where output of one feeds into the next.

```typescript
const result = await aggregator.aggregateSequential({
  proofs: [fundingProof, validityProof, fulfillmentProof],
  getProvider,
  verifyBefore: true,
  // Optional: custom linking function
  linkProofs: (previous, current) => {
    // Return link hash connecting proofs
    return sha256(previous.proof + current.publicInputs[0])
  },
  // Optional: progress callback
  onProgress: (event) => {
    console.log(`Step ${event.step}/${event.totalSteps}: ${event.operation}`)
  },
})
```

### Parallel Aggregation

Best for **independent proofs** that can be verified concurrently.

```typescript
const result = await aggregator.aggregateParallel({
  proofs: independentProofs,
  getProvider,
  maxConcurrent: 4, // Verify up to 4 proofs at once
  verifyBefore: true,
  onProgress: (event) => {
    console.log(`Verified ${event.step}/${event.totalSteps}`)
  },
})
```

### Recursive Aggregation

Best for **large proof sets** where you need constant-size output.

```typescript
const result = await aggregator.aggregateRecursive({
  proofs: manyProofs, // Can be 100+ proofs
  getProvider,
  targetSystem: 'kimchi', // System supporting recursion
  maxDepth: 5, // Maximum recursion depth
  onProgress: (event) => {
    console.log(`Depth ${event.step}: merging proofs`)
  },
})

// Result is a single proof regardless of input count
console.log('Final proof count:', result.composedProof.proofs.length) // 1
```

### Batch Aggregation

Best for **multi-system proofs** grouped by proving system.

```typescript
const result = await aggregator.aggregateBatch(
  mixedSystemProofs, // Proofs from noir, halo2, kimchi
  getProvider,
  (event) => console.log(event.operation)
)

// Uses batch verification for each system when available
```

## Cross-System Composition

### Linking Proofs from Different Systems

```typescript
// Create a Halo2 proof (Zcash-style privacy)
const halo2Proof = {
  id: 'zcash-privacy',
  proof: zcashProofBytes,
  publicInputs: [commitmentHash],
  metadata: { system: 'halo2', ... },
}

// Create a Kimchi proof (Mina-style succinctness)
const kimchiProof = {
  id: 'mina-state',
  proof: minaProofBytes,
  publicInputs: [stateRoot],
  metadata: { system: 'kimchi', ... },
}

// Create cross-system link
const linkHash = aggregator.createCrossSystemLink(halo2Proof, kimchiProof)

// Compose both
const composed = await aggregator.aggregateSequential({
  proofs: [halo2Proof, kimchiProof],
  getProvider,
  verifyBefore: true,
})

// Verify the link
const linkValid = aggregator.verifyCrossSystemLink(
  halo2Proof,
  kimchiProof,
  linkHash
)
```

## React Integration

### useProofComposition Hook

```tsx
import { useProofComposition } from '@sip-protocol/react'

function ProofComposer() {
  const {
    compose,
    isComposing,
    progress,
    composedProof,
    error,
  } = useProofComposition({
    strategy: 'sequential',
    verifyBefore: true,
  })

  const handleCompose = async () => {
    const result = await compose(proofs)
    if (result.success) {
      console.log('Composed:', result.composedProof)
    }
  }

  return (
    <div>
      <button onClick={handleCompose} disabled={isComposing}>
        {isComposing ? `Composing... ${progress}%` : 'Compose Proofs'}
      </button>
      {error && <p className="error">{error.message}</p>}
      {composedProof && (
        <p>Composed {composedProof.proofs.length} proofs</p>
      )}
    </div>
  )
}
```

### ProofCompositionProvider

```tsx
import { ProofCompositionProvider } from '@sip-protocol/react'

function App() {
  return (
    <ProofCompositionProvider
      config={{
        maxProofs: 10,
        enableParallel: true,
        cacheResults: true,
      }}
    >
      <YourApp />
    </ProofCompositionProvider>
  )
}
```

## CLI Usage

### Generate Proofs

```bash
# Generate a funding proof
sip proof generate \
  --system noir \
  --circuit funding_proof \
  --input '{"balance": "1000000000000000000", "minimum": "500000000000000000"}' \
  --output funding.json

# Generate a validity proof
sip proof generate \
  --system noir \
  --circuit validity_proof \
  --input '{"intentHash": "0x...", "timestamp": 1705747200000}' \
  --output validity.json
```

### Compose Proofs

```bash
# Compose multiple proofs
sip proof compose \
  --proofs funding.json,validity.json \
  --strategy sequential \
  --output composed.json

# With template for specific composition
sip proof compose \
  --proofs funding.json,validity.json,fulfillment.json \
  --template shielded_intent \
  --output composed.json
```

### Verify Composed Proofs

```bash
# Verify a composed proof
sip proof verify composed.json --json

# Output:
# {
#   "valid": true,
#   "proofCount": 3,
#   "systems": ["noir", "noir", "noir"],
#   "verificationTime": 150
# }
```

### Inspect Proofs

```bash
# Inspect proof metadata
sip proof inspect composed.json

# Output:
# Proof ID: composed-abc123
# Type: composed
# Strategy: sequential
# Proofs: 3
# Systems: noir (3)
# Created: 2026-01-20T12:00:00Z
# Size: 2.1 KB
```

### List Supported Systems

```bash
# List available proof systems
sip proof systems --json

# Check compatibility
sip proof compat --from noir --to halo2
```

## Error Handling

### Common Errors

```typescript
import {
  ProofCompositionError,
  CompositionErrorCode,
} from '@sip-protocol/sdk'

try {
  const result = await aggregator.aggregateSequential({
    proofs,
    getProvider,
    verifyBefore: true,
  })
} catch (error) {
  if (error instanceof ProofCompositionError) {
    switch (error.code) {
      case CompositionErrorCode.INVALID_PROOF:
        console.error('Invalid proof format:', error.proofId)
        break
      case CompositionErrorCode.INCOMPATIBLE_SYSTEMS:
        console.error('Systems cannot be composed:', error.system)
        break
      case CompositionErrorCode.TIMEOUT:
        console.error('Composition timed out')
        break
      case CompositionErrorCode.PROVIDER_NOT_READY:
        console.error('Provider not initialized:', error.system)
        break
      case CompositionErrorCode.VERIFICATION_FAILED:
        console.error('Proof verification failed:', error.proofId)
        break
      default:
        console.error('Composition failed:', error.message)
    }
  }
}
```

### Retry Configuration

```typescript
const aggregator = createProofAggregator({
  retry: {
    enabled: true,
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true, // 1s, 2s, 4s
  },
})
```

## Performance Optimization

### 1. Use Parallel Aggregation

When proofs are independent, parallel is 2-4x faster:

```typescript
// Slow: sequential for independent proofs
await aggregator.aggregateSequential({ proofs, ... })

// Fast: parallel verification
await aggregator.aggregateParallel({
  proofs,
  maxConcurrent: 4, // Match CPU cores
  ...
})
```

### 2. Batch by System

Group proofs by proving system for batch verification:

```typescript
// Proofs from same system can use batch verification
const result = await aggregator.aggregateBatch(proofs, getProvider)
```

### 3. Cache Providers

Initialize providers once and reuse:

```typescript
// Bad: initialize per operation
async function compose(proofs) {
  const provider = new Halo2Provider()
  await provider.initialize() // Slow!
  // ...
}

// Good: reuse initialized providers
const halo2Provider = new Halo2Provider()
await halo2Provider.initialize()

function getProvider(system) {
  if (system === 'halo2') return halo2Provider
  // ...
}
```

### 4. Use Recursive for Large Sets

For 10+ proofs, recursive aggregation produces constant-size output:

```typescript
// 100 proofs → 1 proof (constant verification cost)
const result = await aggregator.aggregateRecursive({
  proofs: hundredProofs,
  targetSystem: 'kimchi',
  maxDepth: 7, // log2(100) ≈ 7
})
```

### Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Single proof (mock) | <2s | ~1ms |
| Composed (3 proofs) | <10s | ~5ms |
| Verification | <500ms | ~0.1ms |
| Sequential (10) | <30s | ~10ms |
| Parallel (10) | <15s | ~5ms |

## Troubleshooting

### Provider Not Ready

```
Error: Provider for system 'halo2' is not ready
```

**Solution:** Ensure provider is initialized before use:

```typescript
const provider = new Halo2Provider()
await provider.initialize()
await provider.waitUntilReady(30000) // Wait up to 30s
```

### Incompatible Systems

```
Error: Cannot compose halo2 with groth16 directly
```

**Solution:** Use an intermediate format or sequential composition:

```typescript
// Convert to unified format first
const unified = await converter.toUnified(halo2Proof, 'halo2')
```

### Timeout During Composition

```
Error: Composition timed out after 300000ms
```

**Solution:** Increase timeout or reduce proof count:

```typescript
const aggregator = createProofAggregator({
  timeoutMs: 600000, // 10 minutes
  maxProofs: 5, // Reduce batch size
})
```

### Verification Failed

```
Error: Proof funding-proof failed verification
```

**Solution:** Check proof format and public inputs:

```typescript
// Verify proof independently first
const isValid = await provider.verifyProof(proof)
if (!isValid) {
  console.log('Invalid proof:', proof.id)
  console.log('Public inputs:', proof.publicInputs)
}
```

## API Reference

### ProofAggregator

```typescript
class ProofAggregator {
  // Configuration
  config: AggregatorConfig
  updateConfig(config: Partial<AggregatorConfig>): void

  // Aggregation methods
  aggregateSequential(options: SequentialAggregationOptions): Promise<DetailedAggregationResult>
  aggregateParallel(options: ParallelAggregationOptions): Promise<DetailedAggregationResult>
  aggregateRecursive(options: RecursiveAggregationOptions): Promise<DetailedAggregationResult>
  aggregateBatch(proofs, getProvider, onProgress?): Promise<DetailedAggregationResult>

  // Cross-system operations
  createCrossSystemLink(source: SingleProof, target: SingleProof): HexString
  verifyCrossSystemLink(source, target, linkHash): boolean

  // Events
  addEventListener(listener: CompositionEventListener): () => void
  removeEventListener(listener: CompositionEventListener): void
}
```

### Types

```typescript
interface SingleProof {
  id: string
  proof: HexString
  publicInputs: HexString[]
  verificationKey?: HexString
  metadata: ProofMetadata
}

interface ComposedProof {
  id: string
  proofs: SingleProof[]
  strategy: ProofAggregationStrategy
  status: ComposedProofStatus
  aggregatedProof?: HexString
  combinedPublicInputs: HexString[]
  compositionMetadata: CompositionMetadata
  verificationHints: VerificationHints
}

type ProofSystem = 'noir' | 'halo2' | 'kimchi' | 'groth16' | 'plonk'

enum ProofAggregationStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  RECURSIVE = 'recursive',
  BATCH = 'batch',
}
```

## Further Reading

- [Proof Format Specification](../specs/PROOF-FORMAT.md)
- [Proof Composition Architecture](../specs/PROOF-COMPOSITION-ARCHITECTURE.md)
- [Performance Benchmarks](../../packages/sdk/benchmarks/PERFORMANCE.md)
- [CLI Reference](../reference/cli.md)
