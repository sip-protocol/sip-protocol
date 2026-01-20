/**
 * VerificationPipeline Unit Tests
 *
 * Tests for the proof verification pipeline that handles
 * composed proof verification from multiple ZK systems.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  VerificationPipeline,
  createVerificationPipeline,
  DEFAULT_PIPELINE_CONFIG,
} from '../../src/proofs/verifier'

import type {
  VerificationProgressEvent,
} from '../../src/proofs/verifier'

import type { ComposableProofProvider } from '../../src/proofs/composer/interface'

import type {
  ProofSystem,
  SingleProof,
  ComposedProof,
  ProofMetadata,
  CompositionMetadata,
  VerificationHints,
} from '@sip-protocol/types'

import {
  ComposedProofStatus,
  ProofAggregationStrategy,
} from '@sip-protocol/types'

import type { HexString } from '@sip-protocol/types'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockProof(
  id: string,
  system: ProofSystem,
  linkHash?: HexString,
): SingleProof {
  const metadata: ProofMetadata = {
    system,
    systemVersion: '1.0.0',
    circuitId: `circuit-${system}`,
    circuitVersion: '1.0.0',
    generatedAt: Date.now(),
    proofSizeBytes: 256,
  }

  const proof: SingleProof & { linkHash?: HexString } = {
    id,
    proof: `0x${'ab'.repeat(64)}` as HexString,
    publicInputs: ['0x01', '0x02'] as HexString[],
    metadata,
  }

  if (linkHash) {
    proof.linkHash = linkHash
  }

  return proof
}

function createMockComposedProof(proofs: SingleProof[]): ComposedProof {
  const compositionMetadata: CompositionMetadata = {
    proofCount: proofs.length,
    systems: [...new Set(proofs.map(p => p.metadata.system))],
    compositionTimeMs: 100,
    success: true,
    inputHash: '0x1234567890abcdef' as HexString,
  }

  const verificationHints: VerificationHints = {
    verificationOrder: proofs.map(p => p.id),
    parallelGroups: [proofs.map(p => p.id)],
    estimatedTimeMs: proofs.length * 100,
    estimatedCost: BigInt(1000),
    supportsBatchVerification: true,
  }

  return {
    id: `composed-${Date.now()}`,
    proofs,
    strategy: ProofAggregationStrategy.SEQUENTIAL,
    status: ComposedProofStatus.VERIFIED,
    combinedPublicInputs: proofs.flatMap(p => p.publicInputs),
    compositionMetadata,
    verificationHints,
  }
}

function createMockProvider(
  system: ProofSystem,
  verifyResult: boolean = true,
  delay: number = 10,
): ComposableProofProvider {
  return {
    system,
    capabilities: {
      system,
      supportsRecursion: false,
      supportsBatchVerification: true,
      supportsBrowser: true,
      supportsNode: true,
      maxProofSize: 100000,
      supportedStrategies: [ProofAggregationStrategy.SEQUENTIAL],
      availableCircuits: ['test-circuit'],
    },
    status: {
      isReady: true,
      isBusy: false,
      queueLength: 0,
      metrics: {
        proofsGenerated: 0,
        proofsVerified: 0,
        avgGenerationTimeMs: 100,
        avgVerificationTimeMs: 50,
        successRate: 1.0,
        memoryUsageBytes: 0,
      },
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    waitUntilReady: vi.fn().mockResolvedValue(undefined),
    generateProof: vi.fn().mockResolvedValue({
      success: true,
      proof: {
        id: 'proof-1',
        proof: '0xabc' as HexString,
        publicInputs: [] as HexString[],
        metadata: {
          system,
          systemVersion: '1.0.0',
          circuitId: 'test',
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: 256,
        },
      },
    }),
    verifyProof: vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return verifyResult
    }),
    verifyBatch: vi.fn().mockImplementation(async (proofs: SingleProof[]) => {
      await new Promise(resolve => setTimeout(resolve, delay * proofs.length))
      return proofs.map(() => verifyResult)
    }),
    getAvailableCircuits: vi.fn().mockReturnValue(['test-circuit']),
    hasCircuit: vi.fn().mockReturnValue(true),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('VerificationPipeline', () => {
  let pipeline: VerificationPipeline

  beforeEach(() => {
    pipeline = new VerificationPipeline()
  })

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const p = new VerificationPipeline()
      expect(p.config).toEqual(DEFAULT_PIPELINE_CONFIG)
    })

    it('should accept partial configuration', () => {
      const p = new VerificationPipeline({
        enableParallel: false,
        maxConcurrent: 2,
      })

      expect(p.config.enableParallel).toBe(false)
      expect(p.config.maxConcurrent).toBe(2)
      expect(p.config.enableBatch).toBe(true) // default
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      pipeline.updateConfig({ verbose: true })
      expect(pipeline.config.verbose).toBe(true)
    })

    it('should preserve unmodified config values', () => {
      const originalParallel = pipeline.config.enableParallel
      pipeline.updateConfig({ verbose: true })
      expect(pipeline.config.enableParallel).toBe(originalParallel)
    })
  })

  describe('verify', () => {
    it('should verify a single proof', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const composed = createMockComposedProof([proof])
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
      })

      expect(result.valid).toBe(true)
      expect(result.results).toHaveLength(1)
      expect(result.results[0].proofId).toBe('proof-1')
      expect(result.results[0].valid).toBe(true)
    })

    it('should verify multiple proofs from same system', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
        createMockProof('proof-3', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
      })

      expect(result.valid).toBe(true)
      expect(result.results).toHaveLength(3)
      expect(result.results.every(r => r.valid)).toBe(true)
    })

    it('should verify proofs from multiple systems', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'halo2'),
        createMockProof('proof-3', 'kimchi'),
      ]
      const composed = createMockComposedProof(proofs)

      const providers = new Map<ProofSystem, ComposableProofProvider>([
        ['noir', createMockProvider('noir', true)],
        ['halo2', createMockProvider('halo2', true)],
        ['kimchi', createMockProvider('kimchi', true)],
      ])

      const result = await pipeline.verify(composed, {
        getProvider: (system) => providers.get(system),
      })

      expect(result.valid).toBe(true)
      expect(result.results).toHaveLength(3)
    })

    it('should return invalid when a proof fails verification', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)

      // First call returns true, second returns false
      const provider = createMockProvider('noir', true)
      let callCount = 0
      ;(provider.verifyProof as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++
        return callCount === 1
      })

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
        config: { enableBatch: false, enableParallel: false },
      })

      expect(result.valid).toBe(false)
    })

    it('should handle missing provider', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const composed = createMockComposedProof([proof])

      const result = await pipeline.verify(composed, {
        getProvider: () => undefined,
      })

      expect(result.valid).toBe(false)
      expect(result.results[0].error).toContain('No provider')
    })

    it('should report progress', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)
      const provider = createMockProvider('noir', true)

      const progressEvents: VerificationProgressEvent[] = []

      await pipeline.verify(composed, {
        getProvider: () => provider,
        onProgress: (event) => progressEvents.push(event),
        config: { enableParallel: false },
      })

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[0].step).toBe(1)
      expect(progressEvents[0].totalSteps).toBe(2)
    })

    it('should respect abort signal', async () => {
      const proofs = Array.from({ length: 10 }, (_, i) =>
        createMockProof(`proof-${i}`, 'noir')
      )
      const composed = createMockComposedProof(proofs)
      const provider = createMockProvider('noir', true, 50)

      const controller = new AbortController()

      // Abort after a short delay
      setTimeout(() => controller.abort(), 20)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
        abortSignal: controller.signal,
        config: { enableParallel: false },
      })

      expect(result.valid).toBe(false)
      expect(result.results.length).toBeLessThan(10)
    })

    it('should fail fast in strict mode', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
        createMockProof('proof-3', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)

      const provider = createMockProvider('noir', true)
      let callCount = 0
      ;(provider.verifyProof as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++
        return callCount !== 2 // Fail on second proof
      })

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
        config: { strictMode: true, enableParallel: false, enableBatch: false },
      })

      expect(result.valid).toBe(false)
      expect(result.results).toHaveLength(2) // Stopped after failure
    })

    it('should generate verification proof when requested', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const composed = createMockComposedProof([proof])
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
        config: { generateVerificationProof: true },
      })

      expect(result.valid).toBe(true)
      expect(result.verificationProof).toBeDefined()
      expect(result.verificationProof).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should include system stats', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'halo2'),
        createMockProof('proof-3', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)

      const providers = new Map<ProofSystem, ComposableProofProvider>([
        ['noir', createMockProvider('noir', true)],
        ['halo2', createMockProvider('halo2', true)],
      ])

      const result = await pipeline.verify(composed, {
        getProvider: (system) => providers.get(system),
      })

      expect(result.systemStats.size).toBe(2)
      expect(result.systemStats.get('noir')?.proofsVerified).toBe(2)
      expect(result.systemStats.get('halo2')?.proofsVerified).toBe(1)
    })
  })

  describe('verifySingle', () => {
    it('should verify a single proof', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verifySingle(proof, () => provider)

      expect(result.valid).toBe(true)
      expect(result.proofId).toBe('proof-1')
    })

    it('should return error when provider is missing', async () => {
      const proof = createMockProof('proof-1', 'noir')

      const result = await pipeline.verifySingle(proof, () => undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('No provider')
    })

    it('should handle verification errors', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const provider = createMockProvider('noir', true)
      ;(provider.verifyProof as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Verification failed')
      )

      const result = await pipeline.verifySingle(proof, () => provider)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Verification failed')
    })

    it('should use cache for repeated verifications', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const provider = createMockProvider('noir', true)

      pipeline.updateConfig({ enableCache: true })

      // First verification
      await pipeline.verifySingle(proof, () => provider)

      // Second verification (should use cache)
      await pipeline.verifySingle(proof, () => provider)

      const stats = pipeline.getCacheStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })
  })

  describe('verifyBatch', () => {
    it('should batch verify proofs', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
        createMockProof('proof-3', 'noir'),
      ]
      const provider = createMockProvider('noir', true)

      const results = await pipeline.verifyBatch(proofs, () => provider)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.valid)).toBe(true)
      expect(provider.verifyBatch).toHaveBeenCalled()
    })

    it('should return empty array for empty input', async () => {
      const provider = createMockProvider('noir', true)
      const results = await pipeline.verifyBatch([], () => provider)
      expect(results).toHaveLength(0)
    })

    it('should fall back to individual verification if batch fails', async () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
      ]
      const provider = createMockProvider('noir', true)
      ;(provider.verifyBatch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Batch failed')
      )

      const results = await pipeline.verifyBatch(proofs, () => provider)

      expect(results).toHaveLength(2)
      expect(provider.verifyProof).toHaveBeenCalledTimes(2)
    })
  })

  describe('computeVerificationOrder', () => {
    it('should compute order for single proof', () => {
      const proof = createMockProof('proof-1', 'noir')
      const composed = createMockComposedProof([proof])

      const order = pipeline.computeVerificationOrder(composed)

      expect(order.order).toEqual(['proof-1'])
      expect(order.dependencies.size).toBe(1)
    })

    it('should compute order for multiple proofs', () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
        createMockProof('proof-3', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)

      const order = pipeline.computeVerificationOrder(composed)

      expect(order.order).toHaveLength(3)
      expect(order.dependencies.size).toBe(3)
    })

    it('should use verification hints if available', () => {
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir'),
      ]
      const composed = createMockComposedProof(proofs)
      composed.verificationHints = {
        verificationOrder: ['proof-2', 'proof-1'],
        parallelGroups: [['proof-1', 'proof-2']],
        estimatedTimeMs: 500,
        estimatedCost: BigInt(2000),
        supportsBatchVerification: true,
      }

      const order = pipeline.computeVerificationOrder(composed)

      expect(order.order).toEqual(['proof-2', 'proof-1'])
      expect(order.estimatedTimeMs).toBe(500)
    })

    it('should identify parallel groups', () => {
      const proofs = Array.from({ length: 8 }, (_, i) =>
        createMockProof(`proof-${i}`, 'noir')
      )
      const composed = createMockComposedProof(proofs)
      // Remove hints to force computation
      composed.verificationHints = undefined as unknown as VerificationHints

      const order = pipeline.computeVerificationOrder(composed)

      expect(order.parallelGroups.length).toBeGreaterThan(0)
    })
  })

  describe('cache management', () => {
    it('should track cache hits and misses', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const provider = createMockProvider('noir', true)

      pipeline.updateConfig({ enableCache: true })

      await pipeline.verifySingle(proof, () => provider)
      await pipeline.verifySingle(proof, () => provider)
      await pipeline.verifySingle(proof, () => provider)

      const stats = pipeline.getCacheStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
    })

    it('should clear cache', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const provider = createMockProvider('noir', true)

      pipeline.updateConfig({ enableCache: true })

      await pipeline.verifySingle(proof, () => provider)

      let stats = pipeline.getCacheStats()
      expect(stats.size).toBe(1)

      pipeline.clearCache()

      stats = pipeline.getCacheStats()
      expect(stats.size).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should compute cache hit rate', async () => {
      const proof1 = createMockProof('proof-1', 'noir')
      const proof2 = createMockProof('proof-2', 'noir')
      const provider = createMockProvider('noir', true)

      pipeline.updateConfig({ enableCache: true })

      await pipeline.verifySingle(proof1, () => provider) // miss
      await pipeline.verifySingle(proof2, () => provider) // miss
      await pipeline.verifySingle(proof1, () => provider) // hit
      await pipeline.verifySingle(proof1, () => provider) // hit

      const stats = pipeline.getCacheStats()
      expect(stats.hitRate).toBe(0.5) // 2 hits / 4 total
    })
  })

  describe('link validation', () => {
    it('should validate cross-proof links', async () => {
      const linkHash = ('0x' + 'cd'.repeat(32)) as HexString
      const proofs = [
        createMockProof('proof-1', 'noir'),
        createMockProof('proof-2', 'noir', linkHash),
      ]
      const composed = createMockComposedProof(proofs)
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
      })

      expect(result.linkValidation).toHaveLength(1)
      expect(result.linkValidation[0].sourceProofId).toBe('proof-1')
      expect(result.linkValidation[0].targetProofId).toBe('proof-2')
    })

    it('should skip link validation for single proof', async () => {
      const proof = createMockProof('proof-1', 'noir')
      const composed = createMockComposedProof([proof])
      const provider = createMockProvider('noir', true)

      const result = await pipeline.verify(composed, {
        getProvider: () => provider,
      })

      expect(result.linkValidation).toHaveLength(0)
    })
  })
})

describe('createVerificationPipeline', () => {
  it('should create pipeline with default config', () => {
    const pipeline = createVerificationPipeline()
    expect(pipeline.config).toEqual(DEFAULT_PIPELINE_CONFIG)
  })

  it('should create pipeline with custom config', () => {
    const pipeline = createVerificationPipeline({
      enableParallel: false,
      verbose: true,
    })

    expect(pipeline.config.enableParallel).toBe(false)
    expect(pipeline.config.verbose).toBe(true)
  })
})

describe('DEFAULT_PIPELINE_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_PIPELINE_CONFIG.enableParallel).toBe(true)
    expect(DEFAULT_PIPELINE_CONFIG.maxConcurrent).toBe(4)
    expect(DEFAULT_PIPELINE_CONFIG.enableBatch).toBe(true)
    expect(DEFAULT_PIPELINE_CONFIG.verificationTimeoutMs).toBe(30000)
    expect(DEFAULT_PIPELINE_CONFIG.enableCache).toBe(true)
    expect(DEFAULT_PIPELINE_CONFIG.cacheTtlMs).toBe(300000)
    expect(DEFAULT_PIPELINE_CONFIG.verbose).toBe(false)
    expect(DEFAULT_PIPELINE_CONFIG.strictMode).toBe(false)
    expect(DEFAULT_PIPELINE_CONFIG.generateVerificationProof).toBe(false)
  })
})
