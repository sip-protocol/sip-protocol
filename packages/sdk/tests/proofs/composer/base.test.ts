/**
 * BaseProofComposer Unit Tests
 *
 * Comprehensive tests for the base proof composer implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  BaseProofComposer,
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
  DEFAULT_COMPOSITION_CONFIG,
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
} from '../../../src/proofs/composer'

import type {
  ComposableProofProvider,
  ProofProviderRegistration,
  ProofGenerationRequest,
  ProofGenerationResult,
  ComposeProofsOptions,
  SingleProof,
  ComposedProof,
  ProofSystem,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  CompositionEvent,
  FallbackConfig,
  TelemetryCollector,
  ProofTelemetry,
  ProofTelemetryMetrics,
} from '../../../src/proofs/composer'

import type { HexString } from '@sip-protocol/types'

// ─── Mock Provider ────────────────────────────────────────────────────────────

class MockComposableProvider implements ComposableProofProvider {
  system: ProofSystem
  capabilities: ProofProviderCapabilities
  status: ProofProviderStatus
  private _circuits: Set<string> = new Set()
  private _verifyResult: boolean = true
  private _generateDelay: number = 0
  private _metrics: ProofProviderMetrics

  constructor(
    system: ProofSystem = 'noir',
    options: {
      circuits?: string[]
      verifyResult?: boolean
      generateDelay?: number
    } = {},
  ) {
    this.system = system
    this._circuits = new Set(options.circuits || ['test-circuit'])
    this._verifyResult = options.verifyResult ?? true
    this._generateDelay = options.generateDelay || 0

    this._metrics = {
      proofsGenerated: 0,
      proofsVerified: 0,
      avgGenerationTimeMs: 0,
      avgVerificationTimeMs: 0,
      successRate: 1,
      memoryUsageBytes: 0,
    }

    this.capabilities = {
      system,
      supportsBatchVerification: true,
      supportsRecursion: false,
      supportsBrowser: true,
      supportsNode: true,
      maxProofSize: 1024 * 1024,
      supportedStrategies: [
        ProofAggregationStrategy.SEQUENTIAL,
        ProofAggregationStrategy.PARALLEL,
        ProofAggregationStrategy.BATCH,
      ],
      availableCircuits: Array.from(this._circuits),
    }

    this.status = {
      isReady: true,
      isBusy: false,
      queueLength: 0,
      metrics: this._metrics,
    }
  }

  setVerifyResult(result: boolean): void {
    this._verifyResult = result
  }

  setReady(ready: boolean): void {
    this.status.isReady = ready
  }

  async initialize(): Promise<void> {
    this.status.isReady = true
  }

  async dispose(): Promise<void> {
    this.status.isReady = false
  }

  async waitUntilReady(timeoutMs?: number): Promise<void> {
    if (!this.status.isReady) {
      throw new Error('Provider not ready')
    }
  }

  getAvailableCircuits(): string[] {
    return Array.from(this._circuits)
  }

  hasCircuit(circuitId: string): boolean {
    return this._circuits.has(circuitId)
  }

  async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    if (this._generateDelay > 0) {
      await new Promise(r => setTimeout(r, this._generateDelay))
    }

    const proof = createMockProof({
      system: this.system,
      circuitId: request.circuitId,
    })

    return {
      success: true,
      proof,
      timeMs: this._generateDelay || 10,
      providerId: `mock-${this.system}`,
    }
  }

  async verifyProof(proof: SingleProof): Promise<boolean> {
    return this._verifyResult
  }

  async verifyBatch(proofs: SingleProof[]): Promise<boolean[]> {
    return proofs.map(() => this._verifyResult)
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

let proofCounter = 0

function createMockProof(options: {
  system?: ProofSystem
  circuitId?: string
  publicInputs?: HexString[]
} = {}): SingleProof {
  proofCounter++
  const proofHex = `0x${proofCounter.toString(16).padStart(64, '0')}` as HexString
  return {
    id: `proof-${proofCounter}`,
    proof: proofHex,
    publicInputs: options.publicInputs || ['0x01' as HexString, '0x02' as HexString],
    metadata: {
      system: options.system || 'noir',
      systemVersion: '1.0.0',
      circuitId: options.circuitId || 'test-circuit',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 64,
    },
  }
}

function createMockTelemetryCollector(): TelemetryCollector {
  const events: ProofTelemetry[] = []
  return {
    record(telemetry: ProofTelemetry): void {
      events.push(telemetry)
    },
    async flush(): Promise<void> {
      // No-op
    },
    getMetrics(): ProofTelemetryMetrics {
      return {
        operationCounts: {},
        avgDurationMs: {},
        successRates: {},
        totalOperations: events.length,
        timeWindowMs: 0,
      }
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BaseProofComposer', () => {
  let composer: BaseProofComposer

  beforeEach(() => {
    proofCounter = 0
    composer = new BaseProofComposer()
  })

  afterEach(async () => {
    await composer.dispose()
  })

  // ─── Constructor and Config ─────────────────────────────────────────────

  describe('constructor and config', () => {
    it('should create instance with default config', () => {
      expect(composer.config).toEqual(DEFAULT_COMPOSITION_CONFIG)
    })

    it('should create instance with custom config', () => {
      const customComposer = new BaseProofComposer({
        maxProofs: 50,
        timeoutMs: 60000,
      })

      expect(customComposer.config.maxProofs).toBe(50)
      expect(customComposer.config.timeoutMs).toBe(60000)
      // Other values should be defaults
      expect(customComposer.config.strategy).toBe(DEFAULT_COMPOSITION_CONFIG.strategy)
    })

    it('should update config', () => {
      composer.updateConfig({ maxProofs: 100 })
      expect(composer.config.maxProofs).toBe(100)
    })

    it('should return config copy (not reference)', () => {
      const config1 = composer.config
      const config2 = composer.config
      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })
  })

  // ─── Provider Management ────────────────────────────────────────────────

  describe('provider management', () => {
    it('should register a provider', async () => {
      const provider = new MockComposableProvider('noir')
      const registration = await composer.registerProvider(provider)

      expect(registration).toBeDefined()
      expect(registration.system).toBe('noir')
      expect(registration.enabled).toBe(true)
      expect(registration.id).toMatch(/^provider-noir-/)
    })

    it('should register provider with custom options', async () => {
      const provider = new MockComposableProvider('noir')
      const registration = await composer.registerProvider(provider, {
        priority: 10,
        enabled: false,
      })

      expect(registration.priority).toBe(10)
      expect(registration.enabled).toBe(false)
    })

    it('should throw when registering duplicate system without override', async () => {
      const provider1 = new MockComposableProvider('noir')
      const provider2 = new MockComposableProvider('noir')

      await composer.registerProvider(provider1)

      await expect(composer.registerProvider(provider2)).rejects.toThrow(
        ProofCompositionError,
      )
    })

    it('should allow override when registering duplicate system', async () => {
      const provider1 = new MockComposableProvider('noir')
      const provider2 = new MockComposableProvider('noir')

      const reg1 = await composer.registerProvider(provider1)
      const reg2 = await composer.registerProvider(provider2, { override: true })

      expect(reg2.id).not.toBe(reg1.id)
      expect(composer.getProviders().length).toBe(1)
    })

    it('should unregister provider', async () => {
      const provider = new MockComposableProvider('noir')
      const registration = await composer.registerProvider(provider)

      const result = composer.unregisterProvider(registration.id)

      expect(result).toBe(true)
      expect(composer.getProviders().length).toBe(0)
    })

    it('should return false when unregistering non-existent provider', () => {
      const result = composer.unregisterProvider('non-existent')
      expect(result).toBe(false)
    })

    it('should get provider by ID', async () => {
      const provider = new MockComposableProvider('noir')
      const registration = await composer.registerProvider(provider)

      const retrieved = composer.getProvider(registration.id)

      expect(retrieved).toBe(provider)
    })

    it('should get provider for system', async () => {
      const provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)

      const retrieved = composer.getProviderForSystem('noir')

      expect(retrieved).toBe(provider)
    })

    it('should return undefined for non-existent system', () => {
      const retrieved = composer.getProviderForSystem('halo2')
      expect(retrieved).toBeUndefined()
    })

    it('should get all providers', async () => {
      const noirProvider = new MockComposableProvider('noir')
      const halo2Provider = new MockComposableProvider('halo2')

      await composer.registerProvider(noirProvider)
      await composer.registerProvider(halo2Provider)

      const providers = composer.getProviders()

      expect(providers.length).toBe(2)
      expect(providers.map(p => p.system)).toContain('noir')
      expect(providers.map(p => p.system)).toContain('halo2')
    })

    it('should get available systems', async () => {
      const noirProvider = new MockComposableProvider('noir')
      const halo2Provider = new MockComposableProvider('halo2')

      await composer.registerProvider(noirProvider)
      await composer.registerProvider(halo2Provider)

      const systems = composer.getAvailableSystems()

      expect(systems).toContain('noir')
      expect(systems).toContain('halo2')
    })
  })

  // ─── Proof Generation ───────────────────────────────────────────────────

  describe('proof generation', () => {
    let provider: MockComposableProvider

    beforeEach(async () => {
      provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
    })

    it('should generate proof using default provider', async () => {
      const result = await composer.generateProof({
        circuitId: 'test-circuit',
        privateInputs: { secret: 42 },
        publicInputs: { result: 84 },
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
      expect(result.providerId).toMatch(/^provider-noir-/)
    })

    it('should generate proof using specified system', async () => {
      const result = await composer.generateProof({
        circuitId: 'test-circuit',
        privateInputs: {},
        publicInputs: {},
        system: 'noir',
      })

      expect(result.success).toBe(true)
    })

    it('should fail when no provider available', async () => {
      const emptyComposer = new BaseProofComposer()
      const result = await emptyComposer.generateProof({
        circuitId: 'test-circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No provider')
    })

    it('should fail when circuit not found', async () => {
      const result = await composer.generateProof({
        circuitId: 'non-existent-circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail when provider not ready', async () => {
      provider.setReady(false)

      const result = await composer.generateProof({
        circuitId: 'test-circuit',
        privateInputs: {},
        publicInputs: {},
        timeoutMs: 100,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })

    it('should generate multiple proofs sequentially', async () => {
      composer.updateConfig({ enableParallelGeneration: false })

      const requests: ProofGenerationRequest[] = [
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
      ]

      const results = await composer.generateProofs(requests)

      expect(results.length).toBe(3)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should generate multiple proofs in parallel', async () => {
      composer.updateConfig({
        enableParallelGeneration: true,
        maxParallelWorkers: 3,
      })

      const requests: ProofGenerationRequest[] = [
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
        { circuitId: 'test-circuit', privateInputs: {}, publicInputs: {} },
      ]

      const results = await composer.generateProofs(requests)

      expect(results.length).toBe(3)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  // ─── Composition ────────────────────────────────────────────────────────

  describe('composition', () => {
    let provider: MockComposableProvider

    beforeEach(async () => {
      provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
    })

    it('should compose proofs with sequential strategy', async () => {
      const proofs = [createMockProof(), createMockProof()]

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs.length).toBe(2)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.SEQUENTIAL)
    })

    it('should compose proofs with parallel strategy', async () => {
      const proofs = [createMockProof(), createMockProof(), createMockProof()]

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.PARALLEL,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.PARALLEL)
    })

    it('should compose proofs with batch strategy', async () => {
      const proofs = [createMockProof(), createMockProof()]

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.BATCH,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.BATCH)
    })

    it('should compose proofs with recursive strategy', async () => {
      const proofs = [createMockProof(), createMockProof()]

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.RECURSIVE,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(ProofAggregationStrategy.RECURSIVE)
    })

    it('should fail when no proofs provided', async () => {
      const result = await composer.compose({ proofs: [] })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(CompositionErrorCode.INVALID_PROOF)
    })

    it('should fail when too many proofs', async () => {
      composer.updateConfig({ maxProofs: 2 })
      const proofs = [createMockProof(), createMockProof(), createMockProof()]

      const result = await composer.compose({ proofs })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(CompositionErrorCode.TOO_MANY_PROOFS)
    })

    it('should abort composition when signal is aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      const proofs = [createMockProof()]
      const result = await composer.compose({
        proofs,
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(CompositionErrorCode.TIMEOUT)
    })

    it('should call progress callback', async () => {
      const events: CompositionEvent[] = []
      const proofs = [createMockProof(), createMockProof()]

      await composer.compose({
        proofs,
        onProgress: (event) => events.push(event),
      })

      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => e.type === 'composition:progress')).toBe(true)
    })

    it('should set composition metadata', async () => {
      const proofs = [
        createMockProof({ system: 'noir' }),
        createMockProof({ system: 'noir' }),
      ]

      const result = await composer.compose({ proofs })

      expect(result.composedProof?.compositionMetadata.proofCount).toBe(2)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.success).toBe(true)
    })

    it('should compute verification hints', async () => {
      const proofs = [createMockProof(), createMockProof()]

      const result = await composer.compose({ proofs })

      expect(result.composedProof?.verificationHints).toBeDefined()
      expect(result.composedProof?.verificationHints.verificationOrder.length).toBe(2)
    })
  })

  // ─── Aggregation ────────────────────────────────────────────────────────

  describe('aggregation', () => {
    let provider: MockComposableProvider

    beforeEach(async () => {
      provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
    })

    it('should aggregate proofs', async () => {
      const proofs = [createMockProof(), createMockProof()]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.aggregatedProof).toBeDefined()
      expect(result.metrics.inputProofCount).toBe(2)
    })

    it('should verify before aggregating by default', async () => {
      const proofs = [createMockProof(), createMockProof()]
      provider.setVerifyResult(false)

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
        verifyFirst: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed verification')
    })

    it('should skip verification when disabled', async () => {
      const proofs = [createMockProof(), createMockProof()]
      provider.setVerifyResult(false)

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
        verifyFirst: false,
      })

      expect(result.success).toBe(true)
    })

    it('should fail when target provider not available', async () => {
      const proofs = [createMockProof()]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'halo2', // Not registered
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No provider')
    })
  })

  // ─── Verification ───────────────────────────────────────────────────────

  describe('verification', () => {
    let provider: MockComposableProvider

    beforeEach(async () => {
      provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
    })

    it('should verify composed proof', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const composeResult = await composer.compose({ proofs })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
      })

      expect(verifyResult.valid).toBe(true)
      expect(verifyResult.results.length).toBe(2)
      expect(verifyResult.results.every(r => r.valid)).toBe(true)
    })

    it('should detect invalid proofs', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const composeResult = await composer.compose({ proofs })
      provider.setVerifyResult(false)

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
      })

      expect(verifyResult.valid).toBe(false)
    })

    it('should use batch verification when enabled', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const composeResult = await composer.compose({ proofs })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
        useBatchVerification: true,
      })

      expect(verifyResult.method).toBe('batch')
    })

    it('should skip individual verification when disabled', async () => {
      const proofs = [createMockProof(), createMockProof()]
      const composeResult = await composer.compose({ proofs })

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
        verifyIndividual: false,
      })

      expect(verifyResult.results.length).toBe(0)
      expect(verifyResult.valid).toBe(true)
    })

    it('should verify single proof', async () => {
      const proof = createMockProof()

      const valid = await composer.verifySingle(proof)

      expect(valid).toBe(true)
    })

    it('should throw when verifying single proof without provider', async () => {
      const proof = createMockProof({ system: 'halo2' })

      await expect(composer.verifySingle(proof)).rejects.toThrow(ProviderNotFoundError)
    })
  })

  // ─── Format Conversion ──────────────────────────────────────────────────

  describe('format conversion', () => {
    beforeEach(async () => {
      const noirProvider = new MockComposableProvider('noir')
      const halo2Provider = new MockComposableProvider('halo2')
      await composer.registerProvider(noirProvider)
      await composer.registerProvider(halo2Provider)
    })

    it('should convert proof to same system', async () => {
      const proof = createMockProof({ system: 'noir' })

      const result = await composer.convert({
        proof,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.lossless).toBe(true)
      expect(result.convertedProof?.metadata.system).toBe('noir')
    })

    it('should fail for incompatible systems', async () => {
      const proof = createMockProof({ system: 'noir' })

      const result = await composer.convert({
        proof,
        targetSystem: 'halo2',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('should preserve metadata when requested', async () => {
      const proof = createMockProof({ system: 'noir' })

      const result = await composer.convert({
        proof,
        targetSystem: 'noir',
        preserveMetadata: true,
      })

      expect(result.convertedProof?.metadata.circuitId).toBe(proof.metadata.circuitId)
    })

    it('should check system compatibility', () => {
      expect(composer.areSystemsCompatible('noir', 'noir')).toBe(true)
      expect(composer.areSystemsCompatible('noir', 'halo2')).toBe(false)
    })

    it('should get compatibility matrix', () => {
      const matrix = composer.getCompatibilityMatrix()

      expect(matrix.noir).toBeDefined()
      expect(matrix.noir.noir.conversionSupported).toBe(true)
      expect(matrix.noir.halo2.conversionSupported).toBe(false)
    })
  })

  // ─── Caching ────────────────────────────────────────────────────────────

  describe('caching', () => {
    it('should get cache stats', () => {
      const stats = composer.getCacheStats()

      expect(stats.entryCount).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should clear cache', () => {
      composer.clearCache()
      expect(composer.getCacheStats().entryCount).toBe(0)
    })

    it('should clear cache with time filter', () => {
      composer.clearCache(Date.now())
      expect(composer.getCacheStats().entryCount).toBe(0)
    })
  })

  // ─── Worker Pool ────────────────────────────────────────────────────────

  describe('worker pool', () => {
    it('should get worker pool status', () => {
      const status = composer.getWorkerPoolStatus()

      expect(status.activeWorkers).toBe(0)
      expect(status.idleWorkers).toBe(DEFAULT_COMPOSITION_CONFIG.maxParallelWorkers)
    })

    it('should scale worker pool', async () => {
      await composer.scaleWorkerPool(8)
      expect(composer.config.maxParallelWorkers).toBe(8)
    })

    it('should enforce minimum of 1 worker', async () => {
      await composer.scaleWorkerPool(0)
      expect(composer.config.maxParallelWorkers).toBe(1)
    })
  })

  // ─── Fallback Configuration ─────────────────────────────────────────────

  describe('fallback configuration', () => {
    it('should set fallback config', () => {
      const config: FallbackConfig = {
        primary: 'noir',
        fallbackChain: ['halo2', 'groth16'],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        exponentialBackoff: true,
      }

      composer.setFallbackConfig(config)
      expect(composer.getFallbackConfig()).toEqual(config)
    })

    it('should return undefined when no fallback config', () => {
      expect(composer.getFallbackConfig()).toBeUndefined()
    })
  })

  // ─── Events ─────────────────────────────────────────────────────────────

  describe('events', () => {
    let provider: MockComposableProvider

    beforeEach(async () => {
      provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
    })

    it('should add event listener', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener((event) => events.push(event))

      await composer.compose({ proofs: [createMockProof()] })

      expect(events.length).toBeGreaterThan(0)
    })

    it('should remove event listener', async () => {
      const events: CompositionEvent[] = []
      const listener = (event: CompositionEvent) => events.push(event)

      const unsubscribe = composer.addEventListener(listener)
      unsubscribe()

      await composer.compose({ proofs: [createMockProof()] })

      expect(events.length).toBe(0)
    })

    it('should remove event listener via removeEventListener', async () => {
      const events: CompositionEvent[] = []
      const listener = (event: CompositionEvent) => events.push(event)

      composer.addEventListener(listener)
      composer.removeEventListener(listener)

      await composer.compose({ proofs: [createMockProof()] })

      expect(events.length).toBe(0)
    })

    it('should emit start and complete events', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener((event) => events.push(event))

      await composer.compose({ proofs: [createMockProof()] })

      expect(events.some(e => e.type === 'composition:started')).toBe(true)
      expect(events.some(e => e.type === 'composition:completed')).toBe(true)
    })

    it('should emit failed event on error', async () => {
      const events: CompositionEvent[] = []
      composer.addEventListener((event) => events.push(event))

      await composer.compose({ proofs: [] }) // Will fail

      expect(events.some(e => e.type === 'composition:failed')).toBe(true)
    })

    it('should handle listener errors gracefully', async () => {
      composer.addEventListener(() => {
        throw new Error('Listener error')
      })

      // Should not throw
      const result = await composer.compose({ proofs: [createMockProof()] })
      expect(result.success).toBe(true)
    })
  })

  // ─── Telemetry ──────────────────────────────────────────────────────────

  describe('telemetry', () => {
    it('should set telemetry collector', () => {
      const collector = createMockTelemetryCollector()
      composer.setTelemetryCollector(collector)
      // No error means success
    })
  })

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should initialize all providers', async () => {
      const provider1 = new MockComposableProvider('noir')
      const provider2 = new MockComposableProvider('halo2')
      provider1.setReady(false)
      provider2.setReady(false)

      await composer.registerProvider(provider1)
      await composer.registerProvider(provider2)
      await composer.initialize()

      expect(provider1.status.isReady).toBe(true)
      expect(provider2.status.isReady).toBe(true)
    })

    it('should skip already ready providers', async () => {
      const provider = new MockComposableProvider('noir')
      provider.setReady(true)

      await composer.registerProvider(provider)
      await composer.initialize()

      // Should not throw
      expect(provider.status.isReady).toBe(true)
    })

    it('should be idempotent on multiple initialize calls', async () => {
      await composer.initialize()
      await composer.initialize()
      // Should not throw
    })

    it('should dispose all providers', async () => {
      const provider1 = new MockComposableProvider('noir')
      const provider2 = new MockComposableProvider('halo2')

      await composer.registerProvider(provider1)
      await composer.registerProvider(provider2)
      await composer.dispose()

      expect(provider1.status.isReady).toBe(false)
      expect(provider2.status.isReady).toBe(false)
    })

    it('should clear state on dispose', async () => {
      const provider = new MockComposableProvider('noir')
      await composer.registerProvider(provider)
      composer.addEventListener(() => {})

      await composer.dispose()

      expect(composer.getProviders().length).toBe(0)
      expect(composer.getAvailableSystems().length).toBe(0)
    })
  })
})
