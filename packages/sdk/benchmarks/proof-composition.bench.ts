/**
 * Proof Composition Benchmarks
 *
 * Measures performance of proof composition operations:
 * - Single proof generation: Target <2s
 * - Composed proof (3 proofs): Target <10s
 * - Verification: Target <500ms
 * - Aggregation strategies: sequential, parallel, recursive, batch
 */

import { describe, bench, beforeEach, afterEach } from 'vitest'
import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import {
  ProofAggregator,
  createProofAggregator,
} from '../src/proofs/aggregator'
import { MockProofProvider } from '../src/proofs/mock'
import { Halo2Provider } from '../src/proofs/providers/halo2'
import { KimchiProvider } from '../src/proofs/providers/kimchi'

import type { SingleProof, ProofSystem, HexString } from '@sip-protocol/types'
import type { ComposableProofProvider } from '../src/proofs/composer/interface'

// ─── Test Data Generators ────────────────────────────────────────────────────

function createMockProof(system: ProofSystem, id?: string): SingleProof {
  const proofBytes = randomBytes(256)
  return {
    id: id || `${system}-proof-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    proof: `0x${bytesToHex(proofBytes)}` as HexString,
    publicInputs: [
      `0x${'00'.repeat(31)}01` as HexString,
      `0x${'00'.repeat(31)}64` as HexString,
    ],
    metadata: {
      system,
      systemVersion: '1.0.0',
      circuitId: 'test_circuit',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
    },
  }
}

function createMockProofs(systems: ProofSystem[], count: number): SingleProof[] {
  return Array.from({ length: count }, (_, i) =>
    createMockProof(systems[i % systems.length], `proof-${i}`)
  )
}

// ─── Provider Setup ──────────────────────────────────────────────────────────

let mockProvider: MockProofProvider
let halo2Provider: Halo2Provider
let kimchiProvider: KimchiProvider
let aggregator: ProofAggregator

function getProvider(system: ProofSystem): ComposableProofProvider | undefined {
  switch (system) {
    case 'noir':
      return mockProvider as unknown as ComposableProofProvider
    case 'halo2':
      return halo2Provider
    case 'kimchi':
      return kimchiProvider
    default:
      return undefined
  }
}

// ─── Single Proof Operations ─────────────────────────────────────────────────

describe('Single Proof Operations', () => {
  beforeEach(async () => {
    mockProvider = new MockProofProvider()
    await mockProvider.initialize()
  })

  afterEach(() => {
    // MockProofProvider has no dispose method
  })

  bench(
    'generateFundingProof (mock)',
    async () => {
      await mockProvider.generateFundingProof({
        balance: 1000000000000000000n,
        minimumRequired: 500000000000000000n,
        blindingFactor: randomBytes(32),
        assetId: 'ETH',
        userAddress: '0x1234567890abcdef1234567890abcdef12345678',
        ownershipSignature: randomBytes(64),
      })
    },
    { time: 5000 }
  )

  bench(
    'generateValidityProof (mock)',
    async () => {
      await mockProvider.generateValidityProof({
        intentHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
        senderAddress: '0x1234567890abcdef1234567890abcdef12345678',
        senderBlinding: randomBytes(32),
        senderSecret: randomBytes(32),
        authorizationSignature: randomBytes(64),
        nonce: randomBytes(16),
        timestamp: Date.now(),
        expiry: Date.now() + 3600000,
      })
    },
    { time: 5000 }
  )

  bench(
    'generateFulfillmentProof (mock)',
    async () => {
      await mockProvider.generateFulfillmentProof({
        intentHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
        outputAmount: 9500000000n,
        outputBlinding: randomBytes(32),
        minOutputAmount: 9000000000n,
        recipientStealth: `0x${bytesToHex(randomBytes(33))}` as HexString,
        solverId: 'solver-001',
        solverSecret: randomBytes(32),
        oracleAttestation: {
          recipient: `0x${bytesToHex(randomBytes(20))}` as HexString,
          amount: 9500000000n,
          txHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
          blockNumber: 12345678n,
          signature: randomBytes(65),
        },
        fulfillmentTime: Date.now(),
        expiry: Date.now() + 3600000,
      })
    },
    { time: 5000 }
  )

  bench(
    'verifyProof (mock)',
    async () => {
      const proof = createMockProof('noir')
      await mockProvider.verifyProof({
        type: 'funding',
        proof: proof.proof,
        publicInputs: proof.publicInputs,
      })
    },
    { time: 5000 }
  )
})

// ─── Proof Aggregation Benchmarks ────────────────────────────────────────────

describe('Proof Aggregation', () => {
  beforeEach(async () => {
    mockProvider = new MockProofProvider()
    halo2Provider = new Halo2Provider()
    kimchiProvider = new KimchiProvider()
    aggregator = createProofAggregator({ verbose: false })

    await mockProvider.initialize()
    await halo2Provider.initialize()
    await kimchiProvider.initialize()
  })

  afterEach(() => {
    // MockProofProvider has no dispose method
    halo2Provider.dispose()
    kimchiProvider.dispose()
  })

  // ─── Sequential Aggregation ────────────────────────────────────────────────

  bench(
    'aggregateSequential (3 proofs, same system)',
    async () => {
      const proofs = createMockProofs(['halo2'], 3)
      await aggregator.aggregateSequential({
        proofs,
        getProvider,
        verifyBefore: true,
      })
    },
    { time: 10000 }
  )

  bench(
    'aggregateSequential (3 proofs, mixed systems)',
    async () => {
      const proofs = createMockProofs(['noir', 'halo2', 'kimchi'], 3)
      await aggregator.aggregateSequential({
        proofs,
        getProvider,
        verifyBefore: true,
      })
    },
    { time: 10000 }
  )

  bench(
    'aggregateSequential (10 proofs)',
    async () => {
      const proofs = createMockProofs(['halo2', 'kimchi'], 10)
      await aggregator.aggregateSequential({
        proofs,
        getProvider,
        verifyBefore: true,
      })
    },
    { time: 15000 }
  )

  // ─── Parallel Aggregation ──────────────────────────────────────────────────

  bench(
    'aggregateParallel (3 proofs, concurrency 2)',
    async () => {
      const proofs = createMockProofs(['halo2', 'kimchi'], 3)
      await aggregator.aggregateParallel({
        proofs,
        getProvider,
        maxConcurrent: 2,
        verifyBefore: true,
      })
    },
    { time: 10000 }
  )

  bench(
    'aggregateParallel (10 proofs, concurrency 4)',
    async () => {
      const proofs = createMockProofs(['halo2', 'kimchi'], 10)
      await aggregator.aggregateParallel({
        proofs,
        getProvider,
        maxConcurrent: 4,
        verifyBefore: true,
      })
    },
    { time: 15000 }
  )

  bench(
    'aggregateParallel (20 proofs, concurrency 8)',
    async () => {
      const proofs = createMockProofs(['halo2', 'kimchi', 'noir'], 20)
      await aggregator.aggregateParallel({
        proofs,
        getProvider,
        maxConcurrent: 8,
        verifyBefore: false, // Skip verification for throughput test
      })
    },
    { time: 15000 }
  )

  // ─── Recursive Aggregation ─────────────────────────────────────────────────

  bench(
    'aggregateRecursive (4 proofs, depth 2)',
    async () => {
      const proofs = createMockProofs(['kimchi'], 4)
      await aggregator.aggregateRecursive({
        proofs,
        getProvider,
        targetSystem: 'kimchi',
        maxDepth: 2,
      })
    },
    { time: 10000 }
  )

  bench(
    'aggregateRecursive (8 proofs, depth 3)',
    async () => {
      const proofs = createMockProofs(['kimchi'], 8)
      await aggregator.aggregateRecursive({
        proofs,
        getProvider,
        targetSystem: 'kimchi',
        maxDepth: 3,
      })
    },
    { time: 15000 }
  )

  // ─── Batch Aggregation ─────────────────────────────────────────────────────

  bench(
    'aggregateBatch (10 proofs, 2 systems)',
    async () => {
      const proofs = createMockProofs(['halo2', 'kimchi'], 10)
      await aggregator.aggregateBatch(proofs, getProvider)
    },
    { time: 10000 }
  )

  bench(
    'aggregateBatch (20 proofs, 3 systems)',
    async () => {
      const proofs = createMockProofs(['noir', 'halo2', 'kimchi'], 20)
      await aggregator.aggregateBatch(proofs, getProvider)
    },
    { time: 15000 }
  )
})

// ─── Verification Benchmarks ─────────────────────────────────────────────────

describe('Proof Verification', () => {
  beforeEach(async () => {
    halo2Provider = new Halo2Provider()
    kimchiProvider = new KimchiProvider()

    await halo2Provider.initialize()
    await kimchiProvider.initialize()
  })

  afterEach(() => {
    halo2Provider.dispose()
    kimchiProvider.dispose()
  })

  bench(
    'verifyProof (halo2)',
    async () => {
      const proof = createMockProof('halo2')
      await halo2Provider.verifyProof(proof)
    },
    { time: 5000 }
  )

  bench(
    'verifyProof (kimchi)',
    async () => {
      const proof = createMockProof('kimchi')
      await kimchiProvider.verifyProof(proof)
    },
    { time: 5000 }
  )

  bench(
    'verifyBatch (5 halo2 proofs)',
    async () => {
      const proofs = createMockProofs(['halo2'], 5)
      await halo2Provider.verifyBatch(proofs)
    },
    { time: 10000 }
  )

  bench(
    'verifyBatch (5 kimchi proofs)',
    async () => {
      const proofs = createMockProofs(['kimchi'], 5)
      await kimchiProvider.verifyBatch(proofs)
    },
    { time: 10000 }
  )
})

// ─── Provider Initialization ─────────────────────────────────────────────────

describe('Provider Initialization', () => {
  bench(
    'Halo2Provider.initialize()',
    async () => {
      const provider = new Halo2Provider()
      await provider.initialize()
      provider.dispose()
    },
    { time: 5000 }
  )

  bench(
    'KimchiProvider.initialize()',
    async () => {
      const provider = new KimchiProvider()
      await provider.initialize()
      provider.dispose()
    },
    { time: 5000 }
  )

  bench(
    'MockProofProvider.initialize()',
    async () => {
      const provider = new MockProofProvider()
      await provider.initialize()
      provider.dispose?.()
    },
    { time: 5000 }
  )
})

// ─── Memory Profiling ────────────────────────────────────────────────────────

describe('Memory Usage (Estimates)', () => {
  bench(
    'createMockProof memory',
    () => {
      // Each proof is ~500 bytes
      const proof = createMockProof('noir')
      // Force use to prevent optimization
      if (proof.proof.length === 0) throw new Error('Empty proof')
    },
    { time: 3000 }
  )

  bench(
    'create 100 proofs memory',
    () => {
      const proofs = createMockProofs(['noir', 'halo2', 'kimchi'], 100)
      // ~50KB for 100 proofs
      if (proofs.length !== 100) throw new Error('Wrong count')
    },
    { time: 5000 }
  )

  bench(
    'create 1000 proofs memory',
    () => {
      const proofs = createMockProofs(['noir', 'halo2', 'kimchi'], 1000)
      // ~500KB for 1000 proofs
      if (proofs.length !== 1000) throw new Error('Wrong count')
    },
    { time: 10000 }
  )
})

// ─── Cross-System Operations ─────────────────────────────────────────────────

describe('Cross-System Operations', () => {
  beforeEach(async () => {
    aggregator = createProofAggregator({ verbose: false })
  })

  bench(
    'createCrossSystemLink',
    () => {
      const sourceProof = createMockProof('halo2')
      const targetProof = createMockProof('kimchi')
      aggregator.createCrossSystemLink(sourceProof, targetProof)
    },
    { time: 3000 }
  )

  bench(
    'verifyCrossSystemLink',
    () => {
      const sourceProof = createMockProof('halo2')
      const targetProof = createMockProof('kimchi')
      const link = aggregator.createCrossSystemLink(sourceProof, targetProof)
      aggregator.verifyCrossSystemLink(sourceProof, targetProof, link)
    },
    { time: 3000 }
  )
})

// ─── End-to-End Composition ──────────────────────────────────────────────────

describe('End-to-End Composition', () => {
  beforeEach(async () => {
    mockProvider = new MockProofProvider()
    halo2Provider = new Halo2Provider()
    kimchiProvider = new KimchiProvider()
    aggregator = createProofAggregator({ verbose: false })

    await mockProvider.initialize()
    await halo2Provider.initialize()
    await kimchiProvider.initialize()
  })

  afterEach(() => {
    // MockProofProvider has no dispose method
    halo2Provider.dispose()
    kimchiProvider.dispose()
  })

  bench(
    'Full composition: generate + aggregate + verify (3 proofs)',
    async () => {
      // 1. Generate proofs
      const fundingResult = await mockProvider.generateFundingProof({
        balance: 1000000000000000000n,
        minimumRequired: 500000000000000000n,
        blindingFactor: randomBytes(32),
        assetId: 'ETH',
        userAddress: '0x1234567890abcdef1234567890abcdef12345678',
        ownershipSignature: randomBytes(64),
      })

      const validityResult = await mockProvider.generateValidityProof({
        intentHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
        senderAddress: '0x1234567890abcdef1234567890abcdef12345678',
        senderBlinding: randomBytes(32),
        senderSecret: randomBytes(32),
        authorizationSignature: randomBytes(64),
        nonce: randomBytes(16),
        timestamp: Date.now(),
        expiry: Date.now() + 3600000,
      })

      const fulfillmentResult = await mockProvider.generateFulfillmentProof({
        intentHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
        outputAmount: 9500000000n,
        outputBlinding: randomBytes(32),
        minOutputAmount: 9000000000n,
        recipientStealth: `0x${bytesToHex(randomBytes(33))}` as HexString,
        solverId: 'solver-001',
        solverSecret: randomBytes(32),
        oracleAttestation: {
          recipient: `0x${bytesToHex(randomBytes(20))}` as HexString,
          amount: 9500000000n,
          txHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
          blockNumber: 12345678n,
          signature: randomBytes(65),
        },
        fulfillmentTime: Date.now(),
        expiry: Date.now() + 3600000,
      })

      // Convert to SingleProof format
      const proofs: SingleProof[] = [
        {
          id: 'funding-proof',
          proof: fundingResult.proof.proof,
          publicInputs: fundingResult.proof.publicInputs,
          metadata: {
            system: 'noir',
            systemVersion: '1.0.0',
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
            systemVersion: '1.0.0',
            circuitId: 'validity_proof',
            circuitVersion: '1.0.0',
            generatedAt: Date.now(),
            proofSizeBytes: 256,
          },
        },
        {
          id: 'fulfillment-proof',
          proof: fulfillmentResult.proof.proof,
          publicInputs: fulfillmentResult.proof.publicInputs,
          metadata: {
            system: 'noir',
            systemVersion: '1.0.0',
            circuitId: 'fulfillment_proof',
            circuitVersion: '1.0.0',
            generatedAt: Date.now(),
            proofSizeBytes: 256,
          },
        },
      ]

      // 2. Aggregate proofs
      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider,
        verifyBefore: false, // Mock provider, skip verification
      })

      // 3. Verify composed proof exists
      if (!result.success || !result.composedProof) {
        throw new Error('Composition failed')
      }
    },
    { time: 15000 }
  )
})
