/**
 * Unit Tests for BaseProofComposer
 *
 * Comprehensive tests for the ProofComposer class covering:
 * - Configuration and initialization
 * - Provider management
 * - Proof generation
 * - Composition strategies
 * - Verification
 * - Caching and events
 * - Error handling
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { BaseProofComposer } from '../../src/proofs/composer/base'
import {
  ProofCompositionError,
  ProviderNotFoundError,
} from '../../src/proofs/composer/interface'

import type { ComposableProofProvider } from '../../src/proofs/composer/interface'
import type {
  ProofSystem,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  SingleProof,
  CompositionEvent,
  HexString,
} from '@sip-protocol/types'

import {
  ProofAggregationStrategy as Strategy,
  DEFAULT_COMPOSITION_CONFIG,
} from '@sip-protocol/types'

// ─── Mock Provider Factory ──────────────────────────────────────────────────

function createMockProvider(
  system: ProofSystem,
  options: {
    isReady?: boolean
    circuits?: string[]
    generateError?: string
    verifyResult?: boolean
    initDelay?: number
    generateDelay?: number
  } = {},
): ComposableProofProvider {
  const {
    isReady = true,
    circuits = ['funding_proof', 'validity_proof'],
    generateError,
    verifyResult = true,
    initDelay = 0,
    generateDelay = 0,
  } = options

  let ready = isReady
  let proofCounter = 0

  const metrics: ProofProviderMetrics = {
    proofsGenerated: 0,
    proofsVerified: 0,
    avgGenerationTimeMs: 100,
    avgVerificationTimeMs: 50,
    successRate: 1.0,
    memoryUsageBytes: 1024 * 1024,
  }

  const capabilities: ProofProviderCapabilities = {
    system,
    supportsRecursion: true,
    supportsBatchVerification: true,
    supportsBrowser: true,
    supportsNode: true,
    maxProofSize: 65536,
    supportedStrategies: [Strategy.SEQUENTIAL, Strategy.PARALLEL, Strategy.BATCH],
    availableCircuits: circuits,
  }

  return {
    system,
    capabilities,
    get status(): ProofProviderStatus {
      return {
        isReady: ready,
        isBusy: false,
        queueLength: 0,
        metrics,
      }
    },

    async initialize() {
      if (initDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, initDelay))
      }
      ready = true
    },

    async waitUntilReady(timeoutMs?: number) {
      if (!ready) {
        if (initDelay > (timeoutMs || 30000)) {
          throw new Error('Initialization timeout')
        }
        await this.initialize()
      }
    },

    async generateProof(request) {
      if (generateDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, generateDelay))
      }

      if (generateError) {
        return {
          success: false,
          error: generateError,
          timeMs: 10,
          providerId: `${system}-provider`,
        }
      }

      proofCounter++
      const proof: SingleProof = {
        id: `proof-${system}-${proofCounter}`,
        proof: '0x1234567890abcdef' as HexString,
        publicInputs: ['0x0001', '0x0002'] as HexString[],
        metadata: {
          system,
          systemVersion: '1.0.0',
          circuitId: request.circuitId,
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: 256,
        },
      }

      return {
        success: true,
        proof,
        timeMs: 100,
        providerId: `${system}-provider`,
      }
    },

    async verifyProof() {
      return verifyResult
    },

    async verifyBatch(proofs) {
      return proofs.map(() => verifyResult)
    },

    getAvailableCircuits() {
      return circuits
    },

    hasCircuit(circuitId) {
      return circuits.includes(circuitId)
    },

    async dispose() {
      ready = false
    },
  }
}

/**
 * Create a mock proof for testing
 */
function createMockProof(
  system: ProofSystem,
  circuitId: string = 'test_circuit',
  id?: string,
): SingleProof {
  return {
    id: id || `proof-${system}-${Date.now()}`,
    proof: '0xabcdef1234567890' as HexString,
    publicInputs: ['0x0001', '0x0002'] as HexString[],
    metadata: {
      system,
      systemVersion: '1.0.0',
      circuitId,
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
    },
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('BaseProofComposer', () => {
  let composer: BaseProofComposer

  beforeEach(() => {
    composer = new BaseProofComposer()
  })

  afterEach(async () => {
    await composer.dispose()
  })

  // ─── Configuration ──────────────────────────────────────────────────────────

  describe('configuration', () => {
    it('should use default config when none provided', () => {
      expect(composer.config.strategy).toBe(DEFAULT_COMPOSITION_CONFIG.strategy)
      expect(composer.config.maxProofs).toBe(DEFAULT_COMPOSITION_CONFIG.maxProofs)
      expect(composer.config.timeoutMs).toBe(DEFAULT_COMPOSITION_CONFIG.timeoutMs)
    })

    it('should accept custom config', () => {
      const customComposer = new BaseProofComposer({
        maxProofs: 20,
        timeoutMs: 600000,
        strategy: Strategy.PARALLEL,
      })

      expect(customComposer.config.maxProofs).toBe(20)
      expect(customComposer.config.timeoutMs).toBe(600000)
      expect(customComposer.config.strategy).toBe(Strategy.PARALLEL)
    })

    it('should update config dynamically', () => {
      composer.updateConfig({ maxProofs: 50 })
      expect(composer.config.maxProofs).toBe(50)
    })

    it('should preserve other config values when updating', () => {
      const originalStrategy = composer.config.strategy
      composer.updateConfig({ maxProofs: 50 })
      expect(composer.config.strategy).toBe(originalStrategy)
    })
  })

  // ─── Provider Management ────────────────────────────────────────────────────

  describe('provider management', () => {
    it('should register a provider', async () => {
      const provider = createMockProvider('noir')
      const registration = await composer.registerProvider(provider)

      expect(registration.system).toBe('noir')
      expect(registration.id).toBeTruthy()
      expect(registration.enabled).toBe(true)
    })

    it('should retrieve registered provider by ID', async () => {
      const provider = createMockProvider('noir')
      const registration = await composer.registerProvider(provider)

      const retrieved = composer.getProvider(registration.id)
      expect(retrieved).toBe(provider)
    })

    it('should retrieve provider by system', async () => {
      const provider = createMockProvider('noir')
      await composer.registerProvider(provider)

      const retrieved = composer.getProviderForSystem('noir')
      expect(retrieved).toBe(provider)
    })

    it('should list all registered providers', async () => {
      await composer.registerProvider(createMockProvider('noir'))
      await composer.registerProvider(createMockProvider('halo2'))

      const providers = composer.getProviders()
      expect(providers).toHaveLength(2)
      expect(providers.map(p => p.system)).toContain('noir')
      expect(providers.map(p => p.system)).toContain('halo2')
    })

    it('should list available systems', async () => {
      await composer.registerProvider(createMockProvider('noir'))
      await composer.registerProvider(createMockProvider('halo2'))

      const systems = composer.getAvailableSystems()
      expect(systems).toContain('noir')
      expect(systems).toContain('halo2')
    })

    it('should throw when registering duplicate system without override', async () => {
      await composer.registerProvider(createMockProvider('noir'))

      await expect(
        composer.registerProvider(createMockProvider('noir')),
      ).rejects.toThrow(ProofCompositionError)
    })

    it('should allow override when registering duplicate system', async () => {
      const provider1 = createMockProvider('noir', { circuits: ['circuit1'] })
      const provider2 = createMockProvider('noir', { circuits: ['circuit2'] })

      await composer.registerProvider(provider1)
      await composer.registerProvider(provider2, { override: true })

      const retrieved = composer.getProviderForSystem('noir')
      expect(retrieved).toBe(provider2)
      expect(retrieved?.getAvailableCircuits()).toContain('circuit2')
    })

    it('should unregister provider', async () => {
      const provider = createMockProvider('noir')
      const registration = await composer.registerProvider(provider)

      const result = composer.unregisterProvider(registration.id)

      expect(result).toBe(true)
      expect(composer.getProvider(registration.id)).toBeUndefined()
      expect(composer.getProviderForSystem('noir')).toBeUndefined()
    })

    it('should return false when unregistering non-existent provider', () => {
      const result = composer.unregisterProvider('non-existent')
      expect(result).toBe(false)
    })

    it('should support custom priority', async () => {
      const registration = await composer.registerProvider(
        createMockProvider('noir'),
        { priority: 10 },
      )

      expect(registration.priority).toBe(10)
    })
  })

  // ─── Proof Generation ───────────────────────────────────────────────────────

  describe('proof generation', () => {
    beforeEach(async () => {
      await composer.registerProvider(createMockProvider('noir'))
    })

    it('should generate proof with specified system', async () => {
      const result = await composer.generateProof({
        circuitId: 'funding_proof',
        privateInputs: {},
        publicInputs: {},
        system: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
      expect(result.proof?.metadata.system).toBe('noir')
    })

    it('should generate proof using first available provider', async () => {
      const result = await composer.generateProof({
        circuitId: 'funding_proof',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(true)
    })

    it('should fail when circuit not found', async () => {
      const result = await composer.generateProof({
        circuitId: 'non_existent_circuit',
        privateInputs: {},
        publicInputs: {},
        system: 'noir',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail when no provider available', async () => {
      const result = await composer.generateProof({
        circuitId: 'funding_proof',
        privateInputs: {},
        publicInputs: {},
        system: 'halo2', // Not registered
      })

      expect(result.success).toBe(false)
    })

    it('should handle provider generation error', async () => {
      await composer.registerProvider(
        createMockProvider('halo2', { generateError: 'Generation failed' }),
        { override: true },
      )

      const result = await composer.generateProof({
        circuitId: 'funding_proof',
        privateInputs: {},
        publicInputs: {},
        system: 'halo2',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Generation failed')
    })

    it('should generate multiple proofs sequentially', async () => {
      composer.updateConfig({ enableParallelGeneration: false })

      const results = await composer.generateProofs([
        { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
      ])

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should generate multiple proofs in parallel', async () => {
      composer.updateConfig({
        enableParallelGeneration: true,
        maxParallelWorkers: 4,
      })

      const results = await composer.generateProofs([
        { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
      ])

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  // ─── Composition ────────────────────────────────────────────────────────────

  describe('composition', () => {
    beforeEach(async () => {
      await composer.registerProvider(createMockProvider('noir'))
      await composer.registerProvider(createMockProvider('halo2'))
    })

    it('should compose single proof', async () => {
      const proof = createMockProof('noir')

      const result = await composer.compose({
        proofs: [proof],
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs).toHaveLength(1)
    })

    it('should compose multiple proofs from same system', async () => {
      const proofs = [
        createMockProof('noir', 'circuit1'),
        createMockProof('noir', 'circuit2'),
      ]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(true)
      expect(result.composedProof?.proofs).toHaveLength(2)
    })

    it('should compose proofs from multiple systems', async () => {
      const proofs = [
        createMockProof('noir'),
        createMockProof('halo2'),
      ]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(true)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.systems).toContain('halo2')
    })

    it('should fail with empty proofs', async () => {
      const result = await composer.compose({ proofs: [] })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('No proofs')
    })

    it('should fail when exceeding max proofs', async () => {
      composer.updateConfig({ maxProofs: 2 })

      const proofs = [
        createMockProof('noir'),
        createMockProof('noir'),
        createMockProof('noir'),
      ]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Too many proofs')
    })

    it('should use SEQUENTIAL strategy by default', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(Strategy.SEQUENTIAL)
    })

    it('should use specified strategy', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.compose({
        proofs,
        strategy: Strategy.PARALLEL,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(Strategy.PARALLEL)
    })

    it('should support BATCH strategy', async () => {
      const proofs = [
        createMockProof('noir'),
        createMockProof('noir'),
        createMockProof('halo2'),
      ]

      const result = await composer.compose({
        proofs,
        strategy: Strategy.BATCH,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.verificationHints.supportsBatchVerification).toBe(true)
    })

    it('should support RECURSIVE strategy', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.compose({
        proofs,
        strategy: Strategy.RECURSIVE,
      })

      expect(result.success).toBe(true)
    })

    it('should handle abort signal', async () => {
      const controller = new AbortController()
      controller.abort()

      const result = await composer.compose({
        proofs: [createMockProof('noir')],
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('aborted')
    })

    it('should compute verification hints', async () => {
      const proofs = [
        createMockProof('noir', 'c1', 'proof-1'),
        createMockProof('noir', 'c2', 'proof-2'),
      ]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(true)
      expect(result.composedProof?.verificationHints.verificationOrder).toHaveLength(2)
      expect(result.composedProof?.verificationHints.estimatedTimeMs).toBeGreaterThan(0)
    })

    it('should include metrics in result', async () => {
      const result = await composer.compose({
        proofs: [createMockProof('noir')],
      })

      expect(result.metrics).toBeDefined()
      expect(result.metrics?.proofsProcessed).toBe(1)
    })
  })

  // ─── Aggregation ────────────────────────────────────────────────────────────

  describe('aggregation', () => {
    beforeEach(async () => {
      await composer.registerProvider(createMockProvider('noir'))
    })

    it('should aggregate proofs to target system', async () => {
      const proofs = [
        createMockProof('noir'),
        createMockProof('noir'),
      ]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.aggregatedProof).toBeDefined()
    })

    it('should fail aggregation when target provider not found', async () => {
      const proofs = [createMockProof('noir')]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'halo2', // Not registered
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No provider')
    })

    it('should verify proofs before aggregation by default', async () => {
      const verifyMock = vi.fn().mockResolvedValue(true)
      const provider = createMockProvider('noir')
      provider.verifyProof = verifyMock

      await composer.registerProvider(provider, { override: true })

      await composer.aggregate({
        proofs: [createMockProof('noir')],
        targetSystem: 'noir',
      })

      expect(verifyMock).toHaveBeenCalled()
    })

    it('should skip verification when verifyFirst is false', async () => {
      const verifyMock = vi.fn().mockResolvedValue(true)
      const provider = createMockProvider('noir')
      provider.verifyProof = verifyMock

      await composer.registerProvider(provider, { override: true })

      await composer.aggregate({
        proofs: [createMockProof('noir')],
        targetSystem: 'noir',
        verifyFirst: false,
      })

      expect(verifyMock).not.toHaveBeenCalled()
    })

    it('should fail if verification fails', async () => {
      await composer.registerProvider(
        createMockProvider('noir', { verifyResult: false }),
        { override: true },
      )

      const result = await composer.aggregate({
        proofs: [createMockProof('noir')],
        targetSystem: 'noir',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed verification')
    })
  })

  // ─── Verification ───────────────────────────────────────────────────────────

  describe('verification', () => {
    beforeEach(async () => {
      await composer.registerProvider(createMockProvider('noir'))
      await composer.registerProvider(createMockProvider('halo2'))
    })

    it('should verify composed proof individually', async () => {
      const composeResult = await composer.compose({
        proofs: [createMockProof('noir'), createMockProof('noir')],
      })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
        verifyIndividual: true,
      })

      expect(verifyResult.valid).toBe(true)
      expect(verifyResult.results).toHaveLength(2)
      expect(verifyResult.method).toBe('individual')
    })

    it('should verify composed proof using batch verification', async () => {
      const composeResult = await composer.compose({
        proofs: [createMockProof('noir'), createMockProof('noir')],
      })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
        useBatchVerification: true,
      })

      expect(verifyResult.valid).toBe(true)
      expect(verifyResult.method).toBe('batch')
    })

    it('should fail verification when proof is invalid', async () => {
      await composer.registerProvider(
        createMockProvider('noir', { verifyResult: false }),
        { override: true },
      )

      const composeResult = await composer.compose({
        proofs: [createMockProof('noir')],
      })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
      })

      expect(verifyResult.valid).toBe(false)
      expect(verifyResult.results.some(r => !r.valid)).toBe(true)
    })

    it('should verify single proof', async () => {
      const proof = createMockProof('noir')
      const result = await composer.verifySingle(proof)
      expect(result).toBe(true)
    })

    it('should throw when verifying single proof with unknown system', async () => {
      const proof = createMockProof('groth16') // Not registered

      await expect(composer.verifySingle(proof)).rejects.toThrow(ProviderNotFoundError)
    })
  })

  // ─── Format Conversion ──────────────────────────────────────────────────────

  describe('format conversion', () => {
    it('should convert proof to same system (lossless)', async () => {
      const proof = createMockProof('noir')

      const result = await composer.convert({
        proof,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.lossless).toBe(true)
      expect(result.convertedProof?.metadata.system).toBe('noir')
    })

    it('should fail conversion to incompatible system', async () => {
      const proof = createMockProof('noir')

      const result = await composer.convert({
        proof,
        targetSystem: 'halo2',
      })

      expect(result.success).toBe(false)
      expect(result.lossless).toBe(false)
    })

    it('should preserve metadata when requested', async () => {
      const proof = createMockProof('noir')

      const result = await composer.convert({
        proof,
        targetSystem: 'noir',
        preserveMetadata: true,
      })

      expect(result.convertedProof?.metadata.circuitId).toBe(proof.metadata.circuitId)
    })

    it('should return compatibility matrix', () => {
      const matrix = composer.getCompatibilityMatrix()

      expect(matrix.noir).toBeDefined()
      expect(matrix.noir.noir.conversionSupported).toBe(true)
      expect(matrix.noir.halo2.conversionSupported).toBe(false)
    })

    it('should check system compatibility', () => {
      expect(composer.areSystemsCompatible('noir', 'noir')).toBe(true)
      expect(composer.areSystemsCompatible('noir', 'halo2')).toBe(false)
    })
  })

  // ─── Caching ────────────────────────────────────────────────────────────────

  describe('caching', () => {
    it('should return cache stats', () => {
      const stats = composer.getCacheStats()

      expect(stats.entryCount).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should clear cache', () => {
      composer.clearCache()
      const stats = composer.getCacheStats()
      expect(stats.entryCount).toBe(0)
    })
  })

  // ─── Worker Pool ────────────────────────────────────────────────────────────

  describe('worker pool', () => {
    it('should return worker pool status', () => {
      const status = composer.getWorkerPoolStatus()

      expect(status.activeWorkers).toBe(0)
      expect(status.idleWorkers).toBeGreaterThanOrEqual(0)
    })

    it('should scale worker pool', async () => {
      await composer.scaleWorkerPool(8)
      expect(composer.config.maxParallelWorkers).toBe(8)
    })

    it('should enforce minimum worker count', async () => {
      await composer.scaleWorkerPool(0)
      expect(composer.config.maxParallelWorkers).toBe(1)
    })
  })

  // ─── Events ─────────────────────────────────────────────────────────────────

  describe('events', () => {
    beforeEach(async () => {
      await composer.registerProvider(createMockProvider('noir'))
    })

    it('should emit composition:started event', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener(event => events.push(event))

      await composer.compose({ proofs: [createMockProof('noir')] })

      expect(events.some(e => e.type === 'composition:started')).toBe(true)
    })

    it('should emit composition:completed event on success', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener(event => events.push(event))

      await composer.compose({ proofs: [createMockProof('noir')] })

      expect(events.some(e => e.type === 'composition:completed')).toBe(true)
    })

    it('should emit composition:failed event on failure', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener(event => events.push(event))

      await composer.compose({ proofs: [] })

      expect(events.some(e => e.type === 'composition:failed')).toBe(true)
    })

    it('should emit composition:progress events', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener(event => events.push(event))

      await composer.compose({
        proofs: [createMockProof('noir'), createMockProof('noir')],
      })

      expect(events.some(e => e.type === 'composition:progress')).toBe(true)
    })

    it('should remove event listener', async () => {
      const events: CompositionEvent[] = []
      const listener = (event: CompositionEvent) => events.push(event)

      const unsubscribe = composer.addEventListener(listener)
      unsubscribe()

      await composer.compose({ proofs: [createMockProof('noir')] })

      expect(events).toHaveLength(0)
    })

    it('should call progress callback', async () => {
      const progressEvents: CompositionEvent[] = []

      await composer.compose({
        proofs: [createMockProof('noir')],
        onProgress: event => progressEvents.push(event),
      })

      expect(progressEvents.length).toBeGreaterThan(0)
    })
  })

  // ─── Fallback Configuration ─────────────────────────────────────────────────

  describe('fallback configuration', () => {
    it('should set and get fallback config', () => {
      const fallbackConfig = {
        primary: 'noir' as ProofSystem,
        fallbackChain: ['halo2' as ProofSystem, 'kimchi' as ProofSystem],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        exponentialBackoff: true,
      }

      composer.setFallbackConfig(fallbackConfig)

      expect(composer.getFallbackConfig()).toEqual(fallbackConfig)
    })

    it('should return undefined when no fallback config set', () => {
      expect(composer.getFallbackConfig()).toBeUndefined()
    })
  })

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should initialize all providers', async () => {
      const initMock1 = vi.fn()
      const initMock2 = vi.fn()

      const provider1 = createMockProvider('noir', { isReady: false })
      const provider2 = createMockProvider('halo2', { isReady: false })

      provider1.initialize = initMock1.mockImplementation(async () => {
        Object.defineProperty(provider1, 'status', {
          get: () => ({ isReady: true, isBusy: false, queueLength: 0, metrics: {} as ProofProviderMetrics }),
        })
      })
      provider2.initialize = initMock2.mockImplementation(async () => {
        Object.defineProperty(provider2, 'status', {
          get: () => ({ isReady: true, isBusy: false, queueLength: 0, metrics: {} as ProofProviderMetrics }),
        })
      })

      await composer.registerProvider(provider1)
      await composer.registerProvider(provider2)

      await composer.initialize()

      expect(initMock1).toHaveBeenCalled()
      expect(initMock2).toHaveBeenCalled()
    })

    it('should skip already initialized providers', async () => {
      const provider = createMockProvider('noir', { isReady: true })
      const initMock = vi.fn()
      provider.initialize = initMock

      await composer.registerProvider(provider)
      await composer.initialize()

      expect(initMock).not.toHaveBeenCalled()
    })

    it('should dispose all providers', async () => {
      const disposeMock1 = vi.fn()
      const disposeMock2 = vi.fn()

      const provider1 = createMockProvider('noir')
      const provider2 = createMockProvider('halo2')

      provider1.dispose = disposeMock1
      provider2.dispose = disposeMock2

      await composer.registerProvider(provider1)
      await composer.registerProvider(provider2)

      await composer.dispose()

      expect(disposeMock1).toHaveBeenCalled()
      expect(disposeMock2).toHaveBeenCalled()
    })

    it('should clear all state on dispose', async () => {
      await composer.registerProvider(createMockProvider('noir'))
      composer.addEventListener(() => {})

      await composer.dispose()

      expect(composer.getProviders()).toHaveLength(0)
      expect(composer.getAvailableSystems()).toHaveLength(0)
    })
  })

  // ─── Telemetry ──────────────────────────────────────────────────────────────

  describe('telemetry', () => {
    it('should accept telemetry collector', () => {
      const collector = {
        record: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        getMetrics: vi.fn().mockReturnValue({
          operationCounts: {},
          avgDurationByOperation: {},
          errorRate: 0,
          throughput: 0,
        }),
      }

      // Should not throw
      composer.setTelemetryCollector(collector)
    })
  })
})
