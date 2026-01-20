/**
 * ProofAggregator Unit Tests
 *
 * Comprehensive tests for proof aggregation logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  ProofAggregator,
  createProofAggregator,
  DEFAULT_AGGREGATOR_CONFIG,
} from '../../src/proofs/aggregator'

import type {
  AggregatorConfig,
  AggregationProgressEvent,
} from '../../src/proofs/aggregator'

import type { ComposableProofProvider } from '../../src/proofs/composer/interface'

import {
  ProofAggregationStrategy,
} from '@sip-protocol/types'

import type {
  SingleProof,
  ProofSystem,
  HexString,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
} from '@sip-protocol/types'

import type {
  ProofGenerationResult,
} from '../../src/proofs/composer/types'

// ─── Test Data ────────────────────────────────────────────────────────────────

function createMockProof(options: Partial<SingleProof> & { system?: ProofSystem } = {}): SingleProof {
  const system = options.system || 'noir'
  return {
    id: options.id || `proof-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    proof: options.proof || ('0x' + 'ab'.repeat(128)) as HexString,
    publicInputs: options.publicInputs || ['0x01' as HexString, '0x02' as HexString],
    metadata: {
      system,
      systemVersion: '1.0.0',
      circuitId: 'test_circuit',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
      ...options.metadata,
    },
  }
}

function createMockProvider(options: {
  system: ProofSystem
  verifyResult?: boolean
  batchVerifyResults?: boolean[]
  supportsRecursion?: boolean
  throwOnVerify?: boolean
} = { system: 'noir' }): ComposableProofProvider {
  const {
    system,
    verifyResult = true,
    batchVerifyResults,
    supportsRecursion = false,
    throwOnVerify = false,
  } = options

  const metrics: ProofProviderMetrics = {
    proofsGenerated: 0,
    proofsVerified: 0,
    avgGenerationTimeMs: 0,
    avgVerificationTimeMs: 0,
    successRate: 1,
    memoryUsageBytes: 0,
  }

  const capabilities: ProofProviderCapabilities = {
    system,
    supportsRecursion,
    supportsBatchVerification: true,
    supportsBrowser: true,
    supportsNode: true,
    maxProofSize: 10 * 1024 * 1024,
    supportedStrategies: [
      ProofAggregationStrategy.SEQUENTIAL,
      ProofAggregationStrategy.PARALLEL,
      ProofAggregationStrategy.BATCH,
      ...(supportsRecursion ? [ProofAggregationStrategy.RECURSIVE] : []),
    ],
    availableCircuits: ['test_circuit'],
  }

  const status: ProofProviderStatus = {
    isReady: true,
    isBusy: false,
    queueLength: 0,
    metrics,
  }

  return {
    system,
    capabilities,
    status,
    initialize: vi.fn().mockResolvedValue(undefined),
    waitUntilReady: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    generateProof: vi.fn().mockResolvedValue({
      success: true,
      proof: createMockProof({ system }),
      timeMs: 100,
      providerId: `mock-${system}`,
    } as ProofGenerationResult),
    verifyProof: vi.fn().mockImplementation(async () => {
      if (throwOnVerify) throw new Error('Verification error')
      return verifyResult
    }),
    verifyBatch: vi.fn().mockImplementation(async (proofs: SingleProof[]) => {
      if (batchVerifyResults) {
        return batchVerifyResults.slice(0, proofs.length)
      }
      return proofs.map(() => verifyResult)
    }),
    getAvailableCircuits: vi.fn().mockReturnValue(['test_circuit']),
    hasCircuit: vi.fn().mockReturnValue(true),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProofAggregator', () => {
  let aggregator: ProofAggregator
  let mockProvider: ComposableProofProvider

  beforeEach(() => {
    aggregator = new ProofAggregator()
    mockProvider = createMockProvider({ system: 'noir' })
  })

  // ─── Configuration ─────────────────────────────────────────────────────────

  describe('configuration', () => {
    it('should use default config', () => {
      const config = aggregator.config
      expect(config.maxProofs).toBe(DEFAULT_AGGREGATOR_CONFIG.maxProofs)
      expect(config.maxRecursionDepth).toBe(DEFAULT_AGGREGATOR_CONFIG.maxRecursionDepth)
    })

    it('should accept custom config', () => {
      const customConfig: Partial<AggregatorConfig> = {
        maxProofs: 50,
        maxRecursionDepth: 5,
        verbose: true,
      }
      const customAggregator = new ProofAggregator(customConfig)

      expect(customAggregator.config.maxProofs).toBe(50)
      expect(customAggregator.config.maxRecursionDepth).toBe(5)
      expect(customAggregator.config.verbose).toBe(true)
    })

    it('should update config', () => {
      aggregator.updateConfig({ maxProofs: 200 })
      expect(aggregator.config.maxProofs).toBe(200)
    })
  })

  // ─── Factory Function ──────────────────────────────────────────────────────

  describe('createProofAggregator', () => {
    it('should create aggregator without config', () => {
      const agg = createProofAggregator()
      expect(agg).toBeInstanceOf(ProofAggregator)
    })

    it('should create aggregator with config', () => {
      const agg = createProofAggregator({ maxProofs: 25 })
      expect(agg.config.maxProofs).toBe(25)
    })
  })

  // ─── Sequential Aggregation ────────────────────────────────────────────────

  describe('aggregateSequential', () => {
    it('should aggregate proofs sequentially', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1' }),
        createMockProof({ id: 'proof-2' }),
        createMockProof({ id: 'proof-3' }),
      ]

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: true,
      })

      expect(result.success).toBe(true)
      expect(result.metrics.inputProofCount).toBe(3)
      expect(result.stepResults.length).toBe(3)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.SEQUENTIAL)
    })

    it('should fail with empty proofs', async () => {
      const result = await aggregator.aggregateSequential({
        proofs: [],
        getProvider: () => mockProvider,
        verifyBefore: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No proofs')
    })

    it('should fail when exceeding max proofs', async () => {
      const tooManyProofs = Array.from({ length: 150 }, (_, i) =>
        createMockProof({ id: `proof-${i}` }),
      )

      const result = await aggregator.aggregateSequential({
        proofs: tooManyProofs,
        getProvider: () => mockProvider,
        verifyBefore: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Too many proofs')
    })

    it('should track progress', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const progressEvents: AggregationProgressEvent[] = []

      await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: true,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(progressEvents.length).toBe(2)
      expect(progressEvents[0].step).toBe(1)
      expect(progressEvents[1].step).toBe(2)
    })

    it('should abort when signal triggered', async () => {
      const controller = new AbortController()
      const proofs = [createMockProof(), createMockProof()]

      // Abort immediately
      controller.abort()

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: false,
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('aborted')
    })

    it('should fail when verification fails', async () => {
      const failingProvider = createMockProvider({ system: 'noir', verifyResult: false })
      const proofs = [createMockProof()]

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => failingProvider,
        verifyBefore: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed verification')
    })

    it('should link proofs when linkProofs provided', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1' }),
        createMockProof({ id: 'proof-2' }),
      ]

      const linkFn = vi.fn().mockReturnValue('0x1234' as HexString)

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: false,
        linkProofs: linkFn,
      })

      expect(result.success).toBe(true)
      expect(linkFn).toHaveBeenCalledTimes(1)
    })

    it('should handle provider errors', async () => {
      const errorProvider = createMockProvider({ system: 'noir', throwOnVerify: true })
      const proofs = [createMockProof()]

      // Disable retry for this test
      const noRetryAggregator = new ProofAggregator({
        retry: { enabled: false, maxAttempts: 1, delayMs: 0, exponentialBackoff: false },
      })

      const result = await noRetryAggregator.aggregateSequential({
        proofs,
        getProvider: () => errorProvider,
        verifyBefore: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed verification')
    })
  })

  // ─── Parallel Aggregation ──────────────────────────────────────────────────

  describe('aggregateParallel', () => {
    it('should aggregate proofs in parallel', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1' }),
        createMockProof({ id: 'proof-2' }),
        createMockProof({ id: 'proof-3' }),
      ]

      const result = await aggregator.aggregateParallel({
        proofs,
        getProvider: () => mockProvider,
        maxConcurrent: 2,
        verifyBefore: true,
      })

      expect(result.success).toBe(true)
      expect(result.metrics.inputProofCount).toBe(3)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.PARALLEL)
    })

    it('should fail with empty proofs', async () => {
      const result = await aggregator.aggregateParallel({
        proofs: [],
        getProvider: () => mockProvider,
        maxConcurrent: 2,
        verifyBefore: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No proofs')
    })

    it('should track progress', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const progressEvents: AggregationProgressEvent[] = []

      await aggregator.aggregateParallel({
        proofs,
        getProvider: () => mockProvider,
        maxConcurrent: 2,
        verifyBefore: true,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(progressEvents.length).toBe(2)
    })

    it('should respect maxConcurrent limit', async () => {
      const verifyCallTimes: number[] = []
      const slowProvider: ComposableProofProvider = {
        ...mockProvider,
        verifyProof: vi.fn().mockImplementation(async () => {
          verifyCallTimes.push(Date.now())
          await new Promise(r => setTimeout(r, 50))
          return true
        }),
      }

      const proofs = Array.from({ length: 4 }, (_, i) =>
        createMockProof({ id: `proof-${i}` }),
      )

      await aggregator.aggregateParallel({
        proofs,
        getProvider: () => slowProvider,
        maxConcurrent: 2,
        verifyBefore: true,
      })

      // Should have been called 4 times
      expect(slowProvider.verifyProof).toHaveBeenCalledTimes(4)
    })

    it('should fail when verification fails', async () => {
      const failingProvider = createMockProvider({ system: 'noir', verifyResult: false })
      const proofs = [createMockProof()]

      const result = await aggregator.aggregateParallel({
        proofs,
        getProvider: () => failingProvider,
        maxConcurrent: 2,
        verifyBefore: true,
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── Recursive Aggregation ─────────────────────────────────────────────────

  describe('aggregateRecursive', () => {
    let recursiveProvider: ComposableProofProvider

    beforeEach(() => {
      recursiveProvider = createMockProvider({
        system: 'kimchi',
        supportsRecursion: true,
      })
    })

    it('should aggregate proofs recursively', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1', system: 'kimchi' }),
        createMockProof({ id: 'proof-2', system: 'kimchi' }),
        createMockProof({ id: 'proof-3', system: 'kimchi' }),
        createMockProof({ id: 'proof-4', system: 'kimchi' }),
      ]

      const result = await aggregator.aggregateRecursive({
        proofs,
        getProvider: () => recursiveProvider,
        targetSystem: 'kimchi',
        maxDepth: 5,
      })

      expect(result.success).toBe(true)
      expect(result.metrics.recursionDepth).toBeGreaterThan(0)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.RECURSIVE)
    })

    it('should fail with empty proofs', async () => {
      const result = await aggregator.aggregateRecursive({
        proofs: [],
        getProvider: () => recursiveProvider,
        targetSystem: 'kimchi',
        maxDepth: 5,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No proofs')
    })

    it('should fail when maxDepth exceeds limit', async () => {
      const proofs = [createMockProof({ system: 'kimchi' })]

      const result = await aggregator.aggregateRecursive({
        proofs,
        getProvider: () => recursiveProvider,
        targetSystem: 'kimchi',
        maxDepth: 100, // Exceeds default limit of 10
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds limit')
    })

    it('should fail when provider not found', async () => {
      const proofs = [createMockProof({ system: 'kimchi' })]

      const result = await aggregator.aggregateRecursive({
        proofs,
        getProvider: () => undefined,
        targetSystem: 'kimchi',
        maxDepth: 5,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No provider')
    })

    it('should fail when provider does not support recursion', async () => {
      const nonRecursiveProvider = createMockProvider({
        system: 'noir',
        supportsRecursion: false,
      })
      const proofs = [createMockProof({ system: 'noir' })]

      const result = await aggregator.aggregateRecursive({
        proofs,
        getProvider: () => nonRecursiveProvider,
        targetSystem: 'noir',
        maxDepth: 5,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('does not support recursion')
    })

    it('should track progress through recursion depths', async () => {
      const proofs = Array.from({ length: 8 }, (_, i) =>
        createMockProof({ id: `proof-${i}`, system: 'kimchi' }),
      )
      const progressEvents: AggregationProgressEvent[] = []

      await aggregator.aggregateRecursive({
        proofs,
        getProvider: () => recursiveProvider,
        targetSystem: 'kimchi',
        maxDepth: 5,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[0].operation).toContain('Recursive merge')
    })
  })

  // ─── Batch Aggregation ─────────────────────────────────────────────────────

  describe('aggregateBatch', () => {
    it('should aggregate proofs in batches by system', async () => {
      const proofs = [
        createMockProof({ id: 'noir-1', system: 'noir' }),
        createMockProof({ id: 'noir-2', system: 'noir' }),
        createMockProof({ id: 'halo2-1', system: 'halo2' }),
      ]

      const noirProvider = createMockProvider({ system: 'noir' })
      const halo2Provider = createMockProvider({ system: 'halo2' })

      const result = await aggregator.aggregateBatch(
        proofs,
        (system) => system === 'noir' ? noirProvider : halo2Provider,
      )

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.BATCH)
    })

    it('should use batch verification when available', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1', system: 'noir' }),
        createMockProof({ id: 'proof-2', system: 'noir' }),
      ]

      const result = await aggregator.aggregateBatch(
        proofs,
        () => mockProvider,
      )

      expect(result.success).toBe(true)
      expect(mockProvider.verifyBatch).toHaveBeenCalled()
    })

    it('should track progress per system', async () => {
      const proofs = [
        createMockProof({ system: 'noir' }),
        createMockProof({ system: 'halo2' }),
      ]

      const progressEvents: AggregationProgressEvent[] = []

      await aggregator.aggregateBatch(
        proofs,
        (system) => createMockProvider({ system }),
        (event) => progressEvents.push(event),
      )

      expect(progressEvents.length).toBe(2)
    })

    it('should handle partial batch verification failures', async () => {
      const proofs = [
        createMockProof({ id: 'proof-1', system: 'noir' }),
        createMockProof({ id: 'proof-2', system: 'noir' }),
        createMockProof({ id: 'proof-3', system: 'noir' }),
      ]

      // Second proof fails
      const partialFailProvider = createMockProvider({
        system: 'noir',
        batchVerifyResults: [true, false, true],
      })

      const result = await aggregator.aggregateBatch(
        proofs,
        () => partialFailProvider,
      )

      // Only 2 of 3 should be valid
      expect(result.success).toBe(false) // Not all proofs verified
      expect(result.metrics.outputProofSize).toBe(2)
    })
  })

  // ─── Cross-System Linking ──────────────────────────────────────────────────

  describe('cross-system linking', () => {
    it('should create cross-system link', () => {
      const sourceProof = createMockProof({ id: 'source', system: 'noir' })
      const targetProof = createMockProof({ id: 'target', system: 'halo2' })

      const linkHash = aggregator.createCrossSystemLink(sourceProof, targetProof)

      expect(linkHash).toMatch(/^0x[a-f0-9]+$/i)
    })

    it('should verify valid cross-system link', () => {
      const sourceProof = createMockProof({ id: 'source', system: 'noir' })
      const targetProof = createMockProof({ id: 'target', system: 'halo2' })

      const linkHash = aggregator.createCrossSystemLink(sourceProof, targetProof)
      const isValid = aggregator.verifyCrossSystemLink(sourceProof, targetProof, linkHash)

      expect(isValid).toBe(true)
    })

    it('should reject invalid cross-system link', () => {
      const sourceProof = createMockProof({ id: 'source', system: 'noir' })
      const targetProof = createMockProof({ id: 'target', system: 'halo2' })

      const isValid = aggregator.verifyCrossSystemLink(
        sourceProof,
        targetProof,
        '0x0000000000000000000000000000000000000000000000000000000000000000' as HexString,
      )

      expect(isValid).toBe(false)
    })
  })

  // ─── Events ────────────────────────────────────────────────────────────────

  describe('events', () => {
    it('should emit events during aggregation', async () => {
      const events: any[] = []
      aggregator.addEventListener((event) => events.push(event))

      const proofs = [createMockProof()]
      await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: false,
      })

      expect(events.some(e => e.type === 'composition:started')).toBe(true)
      expect(events.some(e => e.type === 'composition:completed')).toBe(true)
    })

    it('should allow removing event listeners', async () => {
      const events: any[] = []
      const unsubscribe = aggregator.addEventListener((event) => events.push(event))

      unsubscribe()

      const proofs = [createMockProof()]
      await aggregator.aggregateSequential({
        proofs,
        getProvider: () => mockProvider,
        verifyBefore: false,
      })

      expect(events.length).toBe(0)
    })
  })
})
