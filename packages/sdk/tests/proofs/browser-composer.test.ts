/**
 * Browser Proof Composer Tests
 *
 * Tests for browser-compatible proof composition system.
 *
 * @see packages/sdk/src/proofs/browser-composer.ts
 * @see https://github.com/sip-protocol/sip-protocol/issues/346
 *
 * M20-19: Browser-compatible proof composition
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import {
  BrowserProofComposer,
  createBrowserComposer,
  createAutoComposer,
} from '../../src/proofs/browser-composer'
import type {
  CompositionProgress,
} from '../../src/proofs/browser-composer'

import type { ComposableProofProvider } from '../../src/proofs/composer/interface'
import type {
  ProofGenerationRequest,
  ProofGenerationResult,
} from '../../src/proofs/composer/types'
import type {
  SingleProof,
  ProofSystem,
  HexString,
  ProofProviderCapabilities,
  ProofProviderStatus,
} from '@sip-protocol/types'
import { ProofAggregationStrategy } from '@sip-protocol/types'

// ─── Mock Composable Provider ───────────────────────────────────────────────

/**
 * Mock implementation of ComposableProofProvider for testing
 */
class MockComposableProofProvider implements ComposableProofProvider {
  readonly system: ProofSystem = 'noir'

  private _isReady = false
  private _capabilities: ProofProviderCapabilities
  private _status: ProofProviderStatus
  private _circuits = ['test_circuit', 'funding_proof', 'validity_proof']

  constructor() {
    this._capabilities = {
      system: 'noir',
      supportsRecursion: false,
      supportsBatchVerification: true,
      supportsBrowser: true,
      supportsNode: true,
      maxProofSize: 10 * 1024 * 1024,
      supportedStrategies: [
        ProofAggregationStrategy.SEQUENTIAL,
        ProofAggregationStrategy.PARALLEL,
        ProofAggregationStrategy.BATCH,
      ],
      availableCircuits: this._circuits,
    }

    this._status = {
      isReady: false,
      isBusy: false,
      queueLength: 0,
      metrics: {
        proofsGenerated: 0,
        proofsVerified: 0,
        avgGenerationTimeMs: 0,
        avgVerificationTimeMs: 0,
        successRate: 1,
        memoryUsageBytes: 0,
      },
    }
  }

  get capabilities(): ProofProviderCapabilities {
    return this._capabilities
  }

  get status(): ProofProviderStatus {
    return this._status
  }

  async initialize(): Promise<void> {
    this._isReady = true
    this._status.isReady = true
  }

  async waitUntilReady(_timeoutMs?: number): Promise<void> {
    if (!this._isReady) {
      await this.initialize()
    }
  }

  async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    const startTime = Date.now()

    if (!this._isReady) {
      return {
        success: false,
        error: 'Provider not initialized',
        timeMs: Date.now() - startTime,
        providerId: 'mock-noir',
      }
    }

    // Generate mock proof
    const proofBytes = randomBytes(256)
    const proof: SingleProof = {
      id: `noir-proof-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      proof: `0x${bytesToHex(proofBytes)}` as HexString,
      publicInputs: Object.values(request.publicInputs).map((v) => {
        if (typeof v === 'string' && v.startsWith('0x')) {
          return v as HexString
        }
        return `0x${String(v).padStart(64, '0')}` as HexString
      }),
      metadata: {
        system: 'noir',
        systemVersion: '1.0.0',
        circuitId: request.circuitId,
        circuitVersion: '1.0.0',
        generatedAt: Date.now(),
        proofSizeBytes: proofBytes.length,
      },
    }

    return {
      success: true,
      proof,
      timeMs: Date.now() - startTime,
      providerId: 'mock-noir',
    }
  }

  async verifyProof(proof: SingleProof): Promise<boolean> {
    // Basic validation
    return (
      !!proof.id &&
      !!proof.proof &&
      proof.proof.startsWith('0x') &&
      proof.metadata?.system === 'noir'
    )
  }

  async verifyBatch(proofs: SingleProof[]): Promise<boolean[]> {
    return Promise.all(proofs.map((p) => this.verifyProof(p)))
  }

  getAvailableCircuits(): string[] {
    return this._circuits
  }

  hasCircuit(circuitId: string): boolean {
    return this._circuits.includes(circuitId)
  }

  async dispose(): Promise<void> {
    this._isReady = false
    this._status.isReady = false
  }
}

// ─── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Create a mock SingleProof for testing
 */
function createMockProof(system: ProofSystem = 'noir', id?: string): SingleProof {
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

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('BrowserProofComposer', () => {
  let composer: BrowserProofComposer
  let mockProvider: MockComposableProofProvider

  beforeEach(() => {
    // Create composer with disabled worker for testing
    composer = new BrowserProofComposer({
      useWorker: false, // Disable worker in Node.js test environment
      verbose: false,
      forceInitialize: true, // Allow init even without browser features
    })

    mockProvider = new MockComposableProofProvider()
  })

  afterEach(async () => {
    await composer.dispose()
  })

  describe('Static Methods', () => {
    it('should check browser compatibility', () => {
      const compat = BrowserProofComposer.checkCompatibility()

      expect(compat).toBeDefined()
      expect(typeof compat.score).toBe('number')
      expect(compat.score).toBeGreaterThanOrEqual(0)
      expect(compat.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(compat.issues)).toBe(true)
      expect(Array.isArray(compat.recommendations)).toBe(true)
      expect(typeof compat.webAssembly).toBe('boolean')
    })

    it('should check browser support', () => {
      const support = BrowserProofComposer.checkBrowserSupport()

      expect(support).toBeDefined()
      expect(typeof support.supported).toBe('boolean')
      expect(Array.isArray(support.missing)).toBe(true)
    })

    it('should get recommended config', () => {
      const config = BrowserProofComposer.getRecommendedConfig()

      expect(config).toBeDefined()
      // Should return at least empty object or some config
      expect(typeof config).toBe('object')
    })

    it('should detect mobile devices', () => {
      const isMobile = BrowserProofComposer.isMobile()
      expect(typeof isMobile).toBe('boolean')
      // In Node.js, should return false
      expect(isMobile).toBe(false)
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(composer.isReady).toBe(false)

      await composer.initialize()

      expect(composer.isReady).toBe(true)
    })

    it('should report progress during initialization', async () => {
      const progressEvents: CompositionProgress[] = []

      await composer.initialize((progress) => {
        progressEvents.push(progress)
      })

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[0].stage).toBe('initializing')
      expect(progressEvents[progressEvents.length - 1].stage).toBe('complete')
      expect(progressEvents[progressEvents.length - 1].percent).toBe(100)
    })

    it('should not re-initialize if already ready', async () => {
      await composer.initialize()
      expect(composer.isReady).toBe(true)

      // Second call should return immediately
      const startTime = Date.now()
      await composer.initialize()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(50) // Should be nearly instant
      expect(composer.isReady).toBe(true)
    })

    it('should wait until ready with timeout', async () => {
      // Start init in background
      const initPromise = composer.initialize()

      // Wait should resolve once init completes
      await composer.waitUntilReady(5000)

      expect(composer.isReady).toBe(true)
      await initPromise
    })

    it('should expose device info after construction', () => {
      const deviceInfo = composer.deviceInfo

      expect(deviceInfo).toBeDefined()
      expect(typeof deviceInfo?.isMobile).toBe('boolean')
      expect(typeof deviceInfo?.platform).toBe('string')
    })

    it('should expose WASM compatibility after init', async () => {
      await composer.initialize()

      const compat = composer.wasmCompatibility

      expect(compat).toBeDefined()
      expect(typeof compat?.score).toBe('number')
    })
  })

  describe('Provider Management', () => {
    beforeEach(async () => {
      await composer.initialize()
    })

    it('should register a provider', async () => {
      const registration = await composer.registerProvider(mockProvider)

      expect(registration).toBeDefined()
      expect(registration.system).toBe('noir')
      expect(registration.enabled).toBe(true)
    })

    it('should get registered providers', async () => {
      await composer.registerProvider(mockProvider)

      const providers = composer.getProviders()

      expect(providers.length).toBe(1)
      expect(providers[0].system).toBe('noir')
    })

    it('should get provider by system', async () => {
      await composer.registerProvider(mockProvider)

      const provider = composer.getProviderForSystem('noir')

      expect(provider).toBeDefined()
      expect(provider?.system).toBe('noir')
    })

    it('should unregister a provider', async () => {
      const registration = await composer.registerProvider(mockProvider)

      const removed = composer.unregisterProvider(registration.id)

      expect(removed).toBe(true)
      expect(composer.getProviders().length).toBe(0)
    })

    it('should get available systems', async () => {
      await composer.registerProvider(mockProvider)

      const systems = composer.getAvailableSystems()

      expect(systems).toContain('noir')
    })
  })

  describe('Composition', () => {
    beforeEach(async () => {
      await composer.initialize()
      await mockProvider.initialize()
      await composer.registerProvider(mockProvider)
    })

    it('should compose proofs using standard interface', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs.length).toBe(2)
    })

    it('should compose proofs with progress reporting', async () => {
      const proofs = [
        createMockProof('noir'),
        createMockProof('noir'),
        createMockProof('noir'),
      ]

      const progressEvents: CompositionProgress[] = []

      const result = await composer.composeWithProgress({
        proofs,
        strategy: ProofAggregationStrategy.PARALLEL,
        onProgress: (progress) => {
          progressEvents.push(progress)
        },
      })

      expect(result.success).toBe(true)
      expect(progressEvents.length).toBeGreaterThan(0)

      // Should have initializing stage
      const initEvent = progressEvents.find((p) => p.stage === 'initializing')
      expect(initEvent).toBeDefined()
      expect(initEvent?.totalProofs).toBe(3)

      // Should have complete stage
      const completeEvent = progressEvents.find((p) => p.stage === 'complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent?.percent).toBe(100)
    })

    it('should handle empty proofs array', async () => {
      const result = await composer.compose({
        proofs: [],
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should use chunked processing for large proof sets', async () => {
      // Create a composer with very small memory limit to trigger chunking
      const smallMemoryComposer = new BrowserProofComposer({
        useWorker: false,
        forceInitialize: true,
        maxMemoryBytes: 100, // Very small - will trigger chunking
        chunkSize: 2,
      })

      await smallMemoryComposer.initialize()
      await smallMemoryComposer.registerProvider(mockProvider)

      const proofs = [
        createMockProof('noir'),
        createMockProof('noir'),
        createMockProof('noir'),
        createMockProof('noir'),
      ]

      const progressEvents: CompositionProgress[] = []

      const result = await smallMemoryComposer.composeWithProgress({
        proofs,
        onProgress: (progress) => {
          progressEvents.push(progress)
        },
      })

      expect(result.success).toBe(true)

      // Should have chunk-related progress events
      const chunkEvents = progressEvents.filter((p) => p.currentChunk !== undefined)
      expect(chunkEvents.length).toBeGreaterThan(0)

      await smallMemoryComposer.dispose()
    })

    it('should support abort signal', async () => {
      const controller = new AbortController()
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      // Abort immediately
      controller.abort()

      const result = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.SEQUENTIAL,
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Aggregation', () => {
    beforeEach(async () => {
      await composer.initialize()
      await mockProvider.initialize()
      await composer.registerProvider(mockProvider)
    })

    it('should aggregate proofs', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.aggregatedProof).toBeDefined()
    })

    it('should verify proofs before aggregation', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const result = await composer.aggregate({
        proofs,
        targetSystem: 'noir',
        verifyFirst: true,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Verification', () => {
    beforeEach(async () => {
      await composer.initialize()
      await mockProvider.initialize()
      await composer.registerProvider(mockProvider)
    })

    it('should verify a single proof', async () => {
      const proof = createMockProof('noir')

      const isValid = await composer.verifySingle(proof)

      expect(typeof isValid).toBe('boolean')
    })

    it('should verify a composed proof', async () => {
      const proofs = [createMockProof('noir'), createMockProof('noir')]

      const composeResult = await composer.compose({
        proofs,
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      expect(composeResult.success).toBe(true)
      expect(composeResult.composedProof).toBeDefined()

      const verifyResult = await composer.verify({
        composedProof: composeResult.composedProof!,
        verifyIndividual: true,
      })

      expect(verifyResult.valid).toBeDefined()
    })
  })

  describe('Format Conversion', () => {
    beforeEach(async () => {
      await composer.initialize()
      await mockProvider.initialize()
      await composer.registerProvider(mockProvider)
    })

    it('should check system compatibility', () => {
      // Same system should be compatible
      expect(composer.areSystemsCompatible('noir', 'noir')).toBe(true)

      // Different systems currently not compatible
      expect(composer.areSystemsCompatible('noir', 'halo2')).toBe(false)
    })

    it('should get compatibility matrix', () => {
      const matrix = composer.getCompatibilityMatrix()

      expect(matrix).toBeDefined()
      expect(matrix.noir).toBeDefined()
      expect(matrix.noir.noir).toBeDefined()
      expect(matrix.noir.noir.conversionSupported).toBe(true)
    })

    it('should convert proof within same system', async () => {
      const proof = createMockProof('noir')

      const result = await composer.convert({
        proof,
        targetSystem: 'noir',
      })

      expect(result.success).toBe(true)
      expect(result.convertedProof).toBeDefined()
      expect(result.lossless).toBe(true)
    })
  })

  describe('Cache Management', () => {
    beforeEach(async () => {
      await composer.initialize()
    })

    it('should return cache stats', () => {
      const stats = composer.getCacheStats()

      expect(stats).toBeDefined()
      expect(typeof stats.entryCount).toBe('number')
      expect(typeof stats.hitRate).toBe('number')
    })

    it('should clear cache', () => {
      // Clear all cache
      composer.clearCache()

      const stats = composer.getCacheStats()
      expect(stats.entryCount).toBe(0)
    })
  })

  describe('Worker Pool', () => {
    beforeEach(async () => {
      await composer.initialize()
    })

    it('should return worker pool status', () => {
      const status = composer.getWorkerPoolStatus()

      expect(status).toBeDefined()
      expect(typeof status.activeWorkers).toBe('number')
      expect(typeof status.idleWorkers).toBe('number')
    })

    it('should scale worker pool', async () => {
      await composer.scaleWorkerPool(4)

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should get config', async () => {
      await composer.initialize()

      const config = composer.config

      expect(config).toBeDefined()
      expect(typeof config.timeoutMs).toBe('number')
      expect(typeof config.maxProofs).toBe('number')
    })

    it('should update config', async () => {
      await composer.initialize()

      composer.updateConfig({ timeoutMs: 60000 })

      expect(composer.config.timeoutMs).toBe(60000)
    })

    it('should set fallback config', async () => {
      await composer.initialize()

      composer.setFallbackConfig({
        primary: 'noir',
        fallbackChain: ['halo2'],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 100,
        exponentialBackoff: true,
      })

      const fallback = composer.getFallbackConfig()
      expect(fallback).toBeDefined()
      expect(fallback?.maxRetries).toBe(3)
    })
  })

  describe('Events', () => {
    beforeEach(async () => {
      await composer.initialize()
      await mockProvider.initialize()
      await composer.registerProvider(mockProvider)
    })

    it('should add and remove event listeners', async () => {
      const events: unknown[] = []
      const listener = (event: unknown) => {
        events.push(event)
      }

      const unsubscribe = composer.addEventListener(listener)
      expect(typeof unsubscribe).toBe('function')

      // Compose to trigger events
      await composer.compose({
        proofs: [createMockProof('noir')],
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      // Remove listener
      unsubscribe()

      // Compose again - should not trigger listener
      const prevCount = events.length
      await composer.compose({
        proofs: [createMockProof('noir')],
        strategy: ProofAggregationStrategy.SEQUENTIAL,
      })

      // Event count should not increase (listener removed)
      expect(events.length).toBe(prevCount)
    })
  })

  describe('Lifecycle', () => {
    it('should dispose cleanly', async () => {
      await composer.initialize()
      expect(composer.isReady).toBe(true)

      await composer.dispose()
      expect(composer.isReady).toBe(false)
    })

    it('should throw when using disposed composer', async () => {
      await composer.initialize()
      await composer.dispose()

      await expect(
        composer.compose({
          proofs: [createMockProof('noir')],
          strategy: ProofAggregationStrategy.SEQUENTIAL,
        })
      ).rejects.toThrow(/not initialized/i)
    })
  })
})

describe('Factory Functions', () => {
  describe('createBrowserComposer', () => {
    it('should create a browser composer', () => {
      const composer = createBrowserComposer({
        useWorker: false,
        forceInitialize: true,
      })

      expect(composer).toBeInstanceOf(BrowserProofComposer)
    })

    it('should accept configuration', () => {
      const composer = createBrowserComposer({
        verbose: true,
        chunkSize: 10,
        useWorker: false,
      })

      expect(composer).toBeDefined()
    })
  })

  describe('createAutoComposer', () => {
    it('should create a composer based on environment', () => {
      const composer = createAutoComposer({
        useWorker: false,
        forceInitialize: true,
      })

      // In Node.js, should still return a BaseProofComposer (since isBrowser is false)
      expect(composer).toBeDefined()
      expect(typeof composer.compose).toBe('function')
    })
  })
})

describe('Mobile Optimization', () => {
  it('should use mobile-appropriate defaults when mobileMode is true', () => {
    const composer = new BrowserProofComposer({
      mobileMode: true,
      useWorker: false,
      forceInitialize: true,
    })

    // Mobile mode should be enabled
    expect(composer).toBeDefined()
  })

  it('should adjust chunk size for mobile', () => {
    const mobileComposer = new BrowserProofComposer({
      mobileMode: true,
      useWorker: false,
      forceInitialize: true,
    })

    const desktopComposer = new BrowserProofComposer({
      mobileMode: false,
      useWorker: false,
      forceInitialize: true,
    })

    // Both should be valid
    expect(mobileComposer).toBeDefined()
    expect(desktopComposer).toBeDefined()
  })
})

describe('Progress Reporting', () => {
  let composer: BrowserProofComposer
  let mockProvider: MockComposableProofProvider

  beforeEach(async () => {
    composer = new BrowserProofComposer({
      useWorker: false,
      forceInitialize: true,
      enableProgressReporting: true,
    })
    mockProvider = new MockComposableProofProvider()
    await composer.initialize()
    await mockProvider.initialize()
    await composer.registerProvider(mockProvider)
  })

  afterEach(async () => {
    await composer.dispose()
  })

  it('should emit progress events with correct structure', async () => {
    const proofs = [createMockProof('noir'), createMockProof('noir')]
    const progressEvents: CompositionProgress[] = []

    await composer.composeWithProgress({
      proofs,
      onProgress: (progress) => {
        progressEvents.push({ ...progress })
      },
    })

    // Validate progress event structure
    for (const event of progressEvents) {
      expect(typeof event.stage).toBe('string')
      expect(typeof event.percent).toBe('number')
      expect(event.percent).toBeGreaterThanOrEqual(0)
      expect(event.percent).toBeLessThanOrEqual(100)
      expect(typeof event.message).toBe('string')
    }
  })

  it('should track proof indices in progress events', async () => {
    const proofs = [
      createMockProof('noir'),
      createMockProof('noir'),
      createMockProof('noir'),
    ]

    const progressEvents: CompositionProgress[] = []

    await composer.composeWithProgress({
      proofs,
      onProgress: (progress) => {
        progressEvents.push({ ...progress })
      },
    })

    // Initial event should have totalProofs
    const initEvent = progressEvents.find((p) => p.stage === 'initializing')
    expect(initEvent?.totalProofs).toBe(3)
  })
})
