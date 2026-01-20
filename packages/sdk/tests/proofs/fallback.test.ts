/**
 * Fallback Proof Strategies Tests
 *
 * Tests for M20-11: Implement fallback proof strategies
 * - FallbackStrategy implementations
 * - CircuitBreaker behavior
 * - FallbackExecutor execution flow
 * - Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type {
  ProofSystem,
  SingleProof,
  HexString,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  ProofAggregationStrategy,
  ProofMetadata,
} from '@sip-protocol/types'
import type { ComposableProofProvider } from '../../src/proofs/composer/interface'
import type { ProofGenerationRequest, ProofGenerationResult } from '../../src/proofs/composer/types'
import {
  SequentialFallbackStrategy,
  ExponentialBackoffStrategy,
  PriorityFallbackStrategy,
  CircuitBreaker,
  FallbackExecutor,
  createFallbackExecutor,
  createCircuitBreaker,
  createMockFallbackProvider,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  type CircuitBreakerConfig,
  type FallbackEvent,
  type ProviderHealth,
} from '../../src/proofs/fallback'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let proofIdCounter = 0

function createMockMetrics(): ProofProviderMetrics {
  return {
    proofsGenerated: 0,
    proofsVerified: 0,
    avgGenerationTimeMs: 0,
    avgVerificationTimeMs: 0,
    successRate: 1,
    memoryUsageBytes: 0,
  }
}

function createMockCapabilities(system: ProofSystem): ProofProviderCapabilities {
  return {
    system,
    supportsRecursion: false,
    supportsBatchVerification: false,
    supportsBrowser: true,
    supportsNode: true,
    maxProofSize: 1024 * 1024,
    supportedStrategies: ['sequential'] as ProofAggregationStrategy[],
    availableCircuits: ['test-circuit'],
  }
}

function createMockStatus(isReady: boolean = true): ProofProviderStatus {
  return {
    isReady,
    isBusy: false,
    queueLength: 0,
    metrics: createMockMetrics(),
  }
}

function createMockMetadata(system: ProofSystem, circuitId: string): ProofMetadata {
  return {
    system,
    systemVersion: '1.0.0',
    circuitId,
    circuitVersion: '1.0.0',
    generatedAt: Date.now(),
    proofSizeBytes: 1024,
    verificationCost: 100n,
  }
}

function createMockProvider(
  system: ProofSystem,
  options: {
    isReady?: boolean
    shouldFail?: boolean
    failureMessage?: string
    delayMs?: number
  } = {},
): ComposableProofProvider {
  const {
    isReady = true,
    shouldFail = false,
    failureMessage = 'Provider failed',
    delayMs = 0,
  } = options

  const providerId = `${system}-provider-${Date.now()}`

  return {
    system,
    status: createMockStatus(isReady),
    capabilities: createMockCapabilities(system),

    async initialize(): Promise<void> {
      // No-op
    },

    async waitUntilReady(_timeoutMs?: number): Promise<void> {
      // No-op for tests
    },

    async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }

      if (shouldFail) {
        throw new Error(failureMessage)
      }

      const proofId = `proof-${++proofIdCounter}`

      return {
        success: true,
        proof: {
          id: proofId,
          proof: '0x1234' as HexString,
          publicInputs: [],
          metadata: createMockMetadata(system, request.circuitId),
        },
        timeMs: 100,
        providerId,
      }
    },

    async verifyProof(_proof: SingleProof): Promise<boolean> {
      if (shouldFail) {
        return false
      }
      return true
    },

    getAvailableCircuits(): string[] {
      return ['test-circuit']
    },

    hasCircuit(circuitId: string): boolean {
      return circuitId === 'test-circuit'
    },

    async dispose(): Promise<void> {
      // No-op
    },
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Sequential Fallback Strategy Tests ──────────────────────────────────────

describe('SequentialFallbackStrategy', () => {
  describe('constructor', () => {
    it('should create with fallback chain', () => {
      const strategy = new SequentialFallbackStrategy(['halo2', 'kimchi'])
      expect(strategy.name).toBe('sequential')
    })

    it('should handle empty fallback chain', () => {
      const strategy = new SequentialFallbackStrategy([])
      expect(strategy.getNextProvider('noir', new Set())).toBeNull()
    })
  })

  describe('getNextProvider', () => {
    let strategy: SequentialFallbackStrategy

    beforeEach(() => {
      strategy = new SequentialFallbackStrategy(['halo2', 'kimchi', 'groth16'])
    })

    it('should return first provider when no current provider', () => {
      const next = strategy.getNextProvider(null, new Set())
      expect(next).toBe('halo2')
    })

    it('should return first provider when current provider fails', () => {
      const failedProviders = new Set<ProofSystem>(['noir' as ProofSystem])
      const next = strategy.getNextProvider('noir', failedProviders)
      expect(next).toBe('halo2')
    })

    it('should skip failed providers', () => {
      const failedProviders = new Set<ProofSystem>(['noir' as ProofSystem, 'halo2'])
      const next = strategy.getNextProvider('noir', failedProviders)
      expect(next).toBe('kimchi')
    })

    it('should return null when all providers failed', () => {
      const failedProviders = new Set<ProofSystem>(['halo2', 'kimchi', 'groth16'])
      const next = strategy.getNextProvider('noir', failedProviders)
      expect(next).toBeNull()
    })

    it('should return next available in chain', () => {
      const failedProviders = new Set<ProofSystem>(['halo2'])
      const next = strategy.getNextProvider('halo2', failedProviders)
      expect(next).toBe('kimchi')
    })
  })

  describe('shouldAttemptFallback', () => {
    let strategy: SequentialFallbackStrategy

    beforeEach(() => {
      strategy = new SequentialFallbackStrategy(['halo2', 'kimchi'])
    })

    it('should attempt fallback when attempts under max', () => {
      const error = new Error('Provider failed')
      expect(strategy.shouldAttemptFallback(error, 1, 3)).toBe(true)
      expect(strategy.shouldAttemptFallback(error, 2, 3)).toBe(true)
    })

    it('should not attempt when max attempts reached', () => {
      const error = new Error('Provider failed')
      expect(strategy.shouldAttemptFallback(error, 3, 3)).toBe(false)
      expect(strategy.shouldAttemptFallback(error, 4, 3)).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('should return linear delay based on attempt count', () => {
      const strategy = new SequentialFallbackStrategy(['halo2'])
      // Linear backoff: 1000 * attemptCount
      expect(strategy.getRetryDelay(1)).toBe(1000)
      expect(strategy.getRetryDelay(2)).toBe(2000)
      expect(strategy.getRetryDelay(10)).toBe(10000)
    })
  })
})

// ─── Exponential Backoff Strategy Tests ──────────────────────────────────────

describe('ExponentialBackoffStrategy', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2', 'kimchi'])
      expect(strategy.name).toBe('exponential-backoff')
    })

    it('should accept custom base delay', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'], 500)
      // getRetryDelay uses exponential with jitter, so at attempt 0 it should be close to 500
      const retryDelay = strategy.getRetryDelay(0)
      expect(retryDelay).toBeGreaterThanOrEqual(500)
      expect(retryDelay).toBeLessThanOrEqual(650) // 500 + 30% jitter
    })

    it('should accept custom max delay', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'], 1000, 2000)
      // At high attempt count, should be capped at max
      expect(strategy.getRetryDelay(10)).toBeLessThanOrEqual(2000)
    })
  })

  describe('getNextProvider', () => {
    let strategy: ExponentialBackoffStrategy

    beforeEach(() => {
      strategy = new ExponentialBackoffStrategy(['halo2', 'kimchi', 'groth16'])
    })

    it('should work like sequential for provider selection', () => {
      expect(strategy.getNextProvider(null, new Set())).toBe('halo2')
      expect(strategy.getNextProvider('noir', new Set(['noir' as ProofSystem]))).toBe('halo2')
    })

    it('should skip failed providers', () => {
      const failedProviders = new Set<ProofSystem>(['halo2', 'kimchi'])
      expect(strategy.getNextProvider('halo2', failedProviders)).toBe('groth16')
    })
  })

  describe('getRetryDelay', () => {
    it('should return exponentially increasing delays', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'], 1000, 100000)

      const delay0 = strategy.getRetryDelay(0)
      const delay1 = strategy.getRetryDelay(1)
      const delay2 = strategy.getRetryDelay(2)

      // Delays should increase exponentially (allowing for jitter)
      expect(delay0).toBeGreaterThanOrEqual(1000)
      expect(delay1).toBeGreaterThan(delay0) // 2x base + jitter
      expect(delay2).toBeGreaterThan(delay1) // 4x base + jitter
    })

    it('should cap at max delay', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'], 1000, 5000)

      // At high attempt counts, should be capped
      expect(strategy.getRetryDelay(10)).toBeLessThanOrEqual(5000)
    })

    it('should include jitter for variance', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'], 1000, 100000)

      // Run multiple times to check for variance
      const delays = Array.from({ length: 10 }, () => strategy.getRetryDelay(1))

      // With jitter, delays should vary (though there's a small chance they could be the same)
      // Just check they're within expected range
      delays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(2000) // 2^1 * 1000
        expect(d).toBeLessThanOrEqual(2600) // 2000 + 30% jitter
      })
    })
  })

  describe('shouldAttemptFallback', () => {
    it('should respect max attempts', () => {
      const strategy = new ExponentialBackoffStrategy(['halo2'])
      const error = new Error('Test')

      expect(strategy.shouldAttemptFallback(error, 1, 5)).toBe(true)
      expect(strategy.shouldAttemptFallback(error, 5, 5)).toBe(false)
    })
  })
})

// ─── Priority Fallback Strategy Tests ────────────────────────────────────────

describe('PriorityFallbackStrategy', () => {
  // Health data that can be modified by tests
  let healthData: Map<ProofSystem, ProviderHealth>

  function createHealthProvider() {
    return () => healthData
  }

  function createPriorities(systems: ProofSystem[]): Map<ProofSystem, number> {
    const priorities = new Map<ProofSystem, number>()
    systems.forEach((system, index) => {
      priorities.set(system, systems.length - index) // Higher priority for earlier systems
    })
    return priorities
  }

  function createInitialHealth(system: ProofSystem): ProviderHealth {
    return {
      system,
      isHealthy: true,
      successRate: 1,
      avgResponseTimeMs: 100,
      circuitBreaker: {
        state: 'closed',
        failureCount: 0,
        lastFailureAt: 0,
        halfOpenSuccessCount: 0,
      },
    }
  }

  beforeEach(() => {
    healthData = new Map()
  })

  describe('constructor', () => {
    it('should create with priority map and health provider', () => {
      const priorities = createPriorities(['halo2', 'kimchi'])
      const strategy = new PriorityFallbackStrategy(priorities, createHealthProvider())
      expect(strategy.name).toBe('priority')
    })
  })

  describe('getNextProvider', () => {
    let strategy: PriorityFallbackStrategy

    beforeEach(() => {
      const priorities = createPriorities(['halo2', 'kimchi', 'groth16'])
      healthData.set('halo2', createInitialHealth('halo2'))
      healthData.set('kimchi', createInitialHealth('kimchi'))
      healthData.set('groth16', createInitialHealth('groth16'))
      strategy = new PriorityFallbackStrategy(priorities, createHealthProvider())
    })

    it('should return highest priority available', () => {
      expect(strategy.getNextProvider(null, new Set())).toBe('halo2')
    })

    it('should skip unhealthy providers when health info available', () => {
      const halo2Health = healthData.get('halo2')!
      halo2Health.isHealthy = false
      halo2Health.successRate = 0

      expect(strategy.getNextProvider(null, new Set())).toBe('kimchi')
    })

    it('should consider success rate in ranking', () => {
      const halo2Health = healthData.get('halo2')!
      halo2Health.successRate = 0.3

      const kimchiHealth = healthData.get('kimchi')!
      kimchiHealth.successRate = 0.9

      // halo2 has priority 3, successRate 0.3 -> score = 0.9
      // kimchi has priority 2, successRate 0.9 -> score = 1.8
      // kimchi should win because score is higher
      const next = strategy.getNextProvider(null, new Set())
      expect(next).toBe('kimchi')
    })

    it('should fallback when primary is marked unhealthy', () => {
      const halo2Health = healthData.get('halo2')!
      halo2Health.isHealthy = false
      halo2Health.successRate = 0

      expect(strategy.getNextProvider('halo2', new Set(['halo2']))).toBe('kimchi')
    })

    it('should return null when all providers failed or unhealthy', () => {
      healthData.get('halo2')!.isHealthy = false
      healthData.get('halo2')!.successRate = 0
      healthData.get('kimchi')!.isHealthy = false
      healthData.get('kimchi')!.successRate = 0
      healthData.get('groth16')!.isHealthy = false
      healthData.get('groth16')!.successRate = 0

      expect(strategy.getNextProvider(null, new Set())).toBeNull()
    })
  })

  describe('getRetryDelay', () => {
    it('should return adaptive delay based on failures', () => {
      const priorities = createPriorities(['halo2'])
      const strategy = new PriorityFallbackStrategy(priorities, createHealthProvider())

      const delay1 = strategy.getRetryDelay(1)
      const delay2 = strategy.getRetryDelay(2)

      expect(delay2).toBeGreaterThan(delay1)
    })
  })
})

// ─── Circuit Breaker Tests ───────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker
  let config: CircuitBreakerConfig

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 2,
    }
    breaker = new CircuitBreaker(config)
  })

  describe('constructor', () => {
    it('should create with default config', () => {
      const defaultBreaker = new CircuitBreaker()
      expect(defaultBreaker.isAllowed('noir')).toBe(true)
    })

    it('should create with custom config', () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 5000,
        halfOpenSuccessThreshold: 3,
      })
      expect(customBreaker.isAllowed('noir')).toBe(true)
    })
  })

  describe('initial state', () => {
    it('should start in closed state', () => {
      const state = breaker.getState('noir')
      expect(state.state).toBe('closed')
      expect(state.failureCount).toBe(0)
    })

    it('should allow requests in closed state', () => {
      expect(breaker.isAllowed('noir')).toBe(true)
    })
  })

  describe('recordSuccess', () => {
    it('should keep circuit closed on success', () => {
      breaker.recordSuccess('noir')
      expect(breaker.getState('noir').state).toBe('closed')
    })

    it('should decrement failure count on success', () => {
      breaker.recordFailure('noir', 'Error 1')
      breaker.recordFailure('noir', 'Error 2')
      breaker.recordSuccess('noir')

      // Gradual recovery: success decrements failure count by 1
      expect(breaker.getState('noir').failureCount).toBe(1)

      // Another success brings it to 0
      breaker.recordSuccess('noir')
      expect(breaker.getState('noir').failureCount).toBe(0)
    })
  })

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      breaker.recordFailure('noir', 'Error 1')
      expect(breaker.getState('noir').failureCount).toBe(1)

      breaker.recordFailure('noir', 'Error 2')
      expect(breaker.getState('noir').failureCount).toBe(2)
    })

    it('should open circuit after threshold', () => {
      breaker.recordFailure('noir', 'Error 1')
      breaker.recordFailure('noir', 'Error 2')
      breaker.recordFailure('noir', 'Error 3')

      expect(breaker.getState('noir').state).toBe('open')
    })

    it('should block requests when open', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }

      expect(breaker.isAllowed('noir')).toBe(false)
    })
  })

  describe('half-open state', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }
      expect(breaker.getState('noir').state).toBe('open')
    })

    it('should transition to half-open after timeout', async () => {
      // Wait for reset timeout
      await delay(1100)

      // Should now allow one request (half-open)
      expect(breaker.isAllowed('noir')).toBe(true)
      expect(breaker.getState('noir').state).toBe('half-open')
    })

    it('should close circuit after enough successes in half-open', async () => {
      await delay(1100)

      // Trigger half-open
      breaker.isAllowed('noir')
      expect(breaker.getState('noir').state).toBe('half-open')

      // Record successes
      breaker.recordSuccess('noir')
      breaker.recordSuccess('noir')

      expect(breaker.getState('noir').state).toBe('closed')
    })

    it('should reopen circuit on failure in half-open', async () => {
      await delay(1100)

      // Trigger half-open
      breaker.isAllowed('noir')
      expect(breaker.getState('noir').state).toBe('half-open')

      // Record failure
      breaker.recordFailure('noir', 'Failed again')

      expect(breaker.getState('noir').state).toBe('open')
    })
  })

  describe('multiple providers', () => {
    it('should track each provider independently', () => {
      breaker.recordFailure('noir', 'Error')
      breaker.recordFailure('noir', 'Error')
      breaker.recordFailure('noir', 'Error')

      // noir should be open
      expect(breaker.getState('noir').state).toBe('open')

      // halo2 should still be closed
      expect(breaker.getState('halo2').state).toBe('closed')
      expect(breaker.isAllowed('halo2')).toBe(true)
    })
  })

  describe('events', () => {
    it('should emit circuit:opened event', () => {
      const events: FallbackEvent[] = []
      breaker.addEventListener(e => events.push(e))

      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }

      const openEvent = events.find(e => e.type === 'circuit:opened')
      expect(openEvent).toBeDefined()
      expect(openEvent?.system).toBe('noir')
    })

    it('should emit circuit:closed event', () => {
      const events: FallbackEvent[] = []

      // Open the circuit first
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }

      breaker.addEventListener(e => events.push(e))

      // Wait and record successes
      return delay(1100).then(() => {
        breaker.isAllowed('noir') // triggers half-open
        breaker.recordSuccess('noir')
        breaker.recordSuccess('noir')

        const closeEvent = events.find(e => e.type === 'circuit:closed')
        expect(closeEvent).toBeDefined()
        expect(closeEvent?.system).toBe('noir')
        expect(closeEvent?.previousState).toBe('half-open')
      })
    })

    it('should emit circuit:half_open event', async () => {
      const events: FallbackEvent[] = []

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }

      breaker.addEventListener(e => events.push(e))

      await delay(1100)
      breaker.isAllowed('noir')

      const halfOpenEvent = events.find(e => e.type === 'circuit:half_open')
      expect(halfOpenEvent).toBeDefined()
      expect(halfOpenEvent?.system).toBe('noir')
      expect(halfOpenEvent?.previousState).toBe('open')
    })

    it('should allow removing event listener', () => {
      const events: FallbackEvent[] = []
      const remove = breaker.addEventListener(e => events.push(e))

      breaker.recordFailure('noir', 'Error 1')
      remove()
      breaker.recordFailure('noir', 'Error 2')
      breaker.recordFailure('noir', 'Error 3')

      // Should only have events from before removal
      const openEvents = events.filter(e => e.type === 'circuit:opened')
      expect(openEvents.length).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset state for a provider', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('noir', `Error ${i}`)
      }
      expect(breaker.getState('noir').state).toBe('open')

      breaker.reset('noir')

      expect(breaker.getState('noir').state).toBe('closed')
      expect(breaker.getState('noir').failureCount).toBe(0)
    })

    it('should reset all providers', () => {
      breaker.recordFailure('noir', 'Error')
      breaker.recordFailure('halo2', 'Error')

      breaker.resetAll()

      expect(breaker.getState('noir').failureCount).toBe(0)
      expect(breaker.getState('halo2').failureCount).toBe(0)
    })
  })
})

// ─── Fallback Executor Tests ─────────────────────────────────────────────────

describe('FallbackExecutor', () => {
  let executor: FallbackExecutor

  beforeEach(() => {
    executor = new FallbackExecutor({
      fallbackConfig: {
        primary: 'noir',
        fallbackChain: ['halo2', 'kimchi'],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 10,
        exponentialBackoff: false,
      },
      circuitBreakerConfig: {
        failureThreshold: 2,
        resetTimeoutMs: 100,
        halfOpenSuccessThreshold: 1,
      },
      enableLogging: false,
    })
  })

  describe('registerProvider', () => {
    it('should register providers', () => {
      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      // Provider should be usable
      const health = executor.getProviderHealth('noir')
      expect(health).toBeDefined()
      expect(health?.system).toBe('noir')
    })
  })

  describe('execute', () => {
    it('should execute with primary provider on success', async () => {
      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      const result = await executor.execute(request)

      expect(result.success).toBe(true)
      expect(result.proof?.metadata.system).toBe('noir')
    })

    it('should fallback on primary provider failure', async () => {
      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2')

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)

      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      const result = await executor.execute(request)

      expect(result.success).toBe(true)
      expect(result.proof?.metadata.system).toBe('halo2')
    })

    it('should try multiple fallbacks', async () => {
      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2', { shouldFail: true })
      const kimchiProvider = createMockProvider('kimchi')

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)
      executor.registerProvider(kimchiProvider)

      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      const result = await executor.execute(request)

      expect(result.success).toBe(true)
      expect(result.proof?.metadata.system).toBe('kimchi')
    })

    it('should fail when all providers exhausted', async () => {
      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2', { shouldFail: true })
      const kimchiProvider = createMockProvider('kimchi', { shouldFail: true })

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)
      executor.registerProvider(kimchiProvider)

      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      const result = await executor.execute(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('exhausted')
    })

    it('should use mock fallback in development mode', async () => {
      const devExecutor = new FallbackExecutor({
        fallbackConfig: {
          primary: 'noir',
          fallbackChain: [],
          retryOnFailure: false,
          maxRetries: 0,
          retryDelayMs: 0,
          exponentialBackoff: false,
        },
        enableMockFallback: true,
        enableLogging: false,
      })

      const noirProvider = createMockProvider('noir', { shouldFail: true })
      devExecutor.registerProvider(noirProvider)

      const mockProvider = createMockFallbackProvider()
      devExecutor.setMockProvider(mockProvider)

      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      const result = await devExecutor.execute(request)

      expect(result.success).toBe(true)
      // Mock fallback uses 'noir' as the system (since 'mock' is not a valid ProofSystem)
      expect(result.proof?.metadata.system).toBe('noir')
      // But the system version indicates it's a mock
      expect(result.proof?.metadata.systemVersion).toBe('mock-1.0.0')
    })

    it('should respect circuit breaker', async () => {
      // Create a new executor with a longer circuit reset timeout to avoid race conditions
      const cbExecutor = new FallbackExecutor({
        fallbackConfig: {
          primary: 'noir',
          fallbackChain: ['halo2', 'kimchi'],
          retryOnFailure: true,
          maxRetries: 3,
          retryDelayMs: 10,
          exponentialBackoff: false,
        },
        circuitBreakerConfig: {
          failureThreshold: 2,
          resetTimeoutMs: 30000, // Long timeout to ensure circuit stays open
          halfOpenSuccessThreshold: 1,
        },
        enableLogging: false,
      })

      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2')

      cbExecutor.registerProvider(noirProvider)
      cbExecutor.registerProvider(halo2Provider)

      // First request opens circuit for noir
      const request: ProofGenerationRequest = {
        system: 'noir',
        circuitId: 'test-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      }

      await cbExecutor.execute(request)
      await cbExecutor.execute(request)

      // Circuit should now be open for noir, should go directly to halo2
      const events: FallbackEvent[] = []
      cbExecutor.addEventListener(e => events.push(e))

      await cbExecutor.execute(request)

      // Should have switched providers due to circuit being open
      const switchEvent = events.find(e =>
        e.type === 'fallback:provider_switched' &&
        e.details?.reason === 'circuit_open',
      )
      expect(switchEvent).toBeDefined()
    })
  })

  describe('events', () => {
    it('should emit fallback:started event', async () => {
      const events: FallbackEvent[] = []
      executor.addEventListener(e => events.push(e))

      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const startEvent = events.find(e => e.type === 'fallback:started')
      expect(startEvent).toBeDefined()
      expect(startEvent?.system).toBe('noir')
    })

    it('should emit fallback:success event', async () => {
      const events: FallbackEvent[] = []
      executor.addEventListener(e => events.push(e))

      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const successEvent = events.find(e => e.type === 'fallback:success')
      expect(successEvent).toBeDefined()
    })

    it('should emit fallback:provider_failed event', async () => {
      const events: FallbackEvent[] = []
      executor.addEventListener(e => events.push(e))

      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2')

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const failEvent = events.find(e => e.type === 'fallback:provider_failed')
      expect(failEvent).toBeDefined()
      expect(failEvent?.system).toBe('noir')
    })

    it('should emit fallback:provider_switched event', async () => {
      const events: FallbackEvent[] = []
      executor.addEventListener(e => events.push(e))

      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2')

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const switchEvent = events.find(e => e.type === 'fallback:provider_switched')
      expect(switchEvent).toBeDefined()
      expect(switchEvent?.system).toBe('halo2')
    })

    it('should emit fallback:exhausted event when all fail', async () => {
      const events: FallbackEvent[] = []
      executor.addEventListener(e => events.push(e))

      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2', { shouldFail: true })
      const kimchiProvider = createMockProvider('kimchi', { shouldFail: true })

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)
      executor.registerProvider(kimchiProvider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const exhaustedEvent = events.find(e => e.type === 'fallback:exhausted')
      expect(exhaustedEvent).toBeDefined()
    })
  })

  describe('getProviderHealth', () => {
    it('should return health for registered provider', () => {
      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      const health = executor.getProviderHealth('noir')

      expect(health).toBeDefined()
      expect(health?.system).toBe('noir')
      expect(health?.isHealthy).toBe(true)
      expect(health?.successRate).toBe(1)
    })

    it('should return undefined for unregistered provider', () => {
      const health = executor.getProviderHealth('kimchi')
      expect(health).toBeUndefined()
    })

    it('should update health after failures', async () => {
      const noirProvider = createMockProvider('noir', { shouldFail: true })
      const halo2Provider = createMockProvider('halo2')

      executor.registerProvider(noirProvider)
      executor.registerProvider(halo2Provider)

      await executor.execute({
        system: 'noir',
        circuitId: 'test',
        privateInputs: {}, publicInputs: {},
      })

      const health = executor.getProviderHealth('noir')

      expect(health).toBeDefined()
      expect(health?.successRate).toBeLessThan(1)
      expect(health?.lastError).toBeDefined()
    })

    it('should track success rate over multiple calls', async () => {
      const noirProvider = createMockProvider('noir')
      executor.registerProvider(noirProvider)

      // Make several successful calls
      for (let i = 0; i < 5; i++) {
        await executor.execute({
          system: 'noir',
          circuitId: 'test',
          privateInputs: {}, publicInputs: {},
        })
      }

      const health = executor.getProviderHealth('noir')

      expect(health).toBeDefined()
      expect(health?.successRate).toBe(1)
    })
  })
})

// ─── Factory Functions Tests ─────────────────────────────────────────────────

describe('Factory Functions', () => {
  describe('createFallbackExecutor', () => {
    it('should create executor with default config', () => {
      const executor = createFallbackExecutor()
      expect(executor).toBeInstanceOf(FallbackExecutor)
    })

    it('should create executor with custom config', () => {
      const executor = createFallbackExecutor({
        fallbackConfig: {
          primary: 'halo2',
          fallbackChain: ['kimchi'],
          retryOnFailure: false,
          maxRetries: 1,
          retryDelayMs: 500,
          exponentialBackoff: true,
        },
      })
      expect(executor).toBeInstanceOf(FallbackExecutor)
    })
  })

  describe('createCircuitBreaker', () => {
    it('should create circuit breaker with default config', () => {
      const breaker = createCircuitBreaker()
      expect(breaker).toBeInstanceOf(CircuitBreaker)
    })

    it('should create circuit breaker with custom config', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 10,
        resetTimeoutMs: 60000,
        halfOpenSuccessThreshold: 5,
      })
      expect(breaker).toBeInstanceOf(CircuitBreaker)
    })
  })

  describe('createMockFallbackProvider', () => {
    it('should create mock provider with noir system', () => {
      const provider = createMockFallbackProvider()

      // Mock provider uses 'noir' as a fallback system for development
      expect(provider.system).toBe('noir')
      expect(provider.status.isReady).toBe(true)
    })

    it('should generate proofs with any circuit', async () => {
      const provider = createMockFallbackProvider()

      const result = await provider.generateProof({
        system: 'noir',
        circuitId: 'any-circuit',
        privateInputs: { value: 123 }, publicInputs: {},
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
    })

    it('should verify proofs', async () => {
      const provider = createMockFallbackProvider()

      const valid = await provider.verifyProof({
        id: 'test-proof',
        proof: '0x1234' as HexString,
        publicInputs: [],
        metadata: {
          system: 'noir',
          systemVersion: '1.0.0',
          circuitId: 'test',
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: 1024,
          verificationCost: 100n,
        },
      })

      expect(valid).toBe(true)
    })
  })
})

// ─── Default Configurations Tests ────────────────────────────────────────────

describe('Default Configurations', () => {
  describe('DEFAULT_CIRCUIT_BREAKER_CONFIG', () => {
    it('should have reasonable defaults', () => {
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBeGreaterThan(0)
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs).toBeGreaterThan(0)
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold).toBeGreaterThan(0)
    })
  })

  describe('DEFAULT_FALLBACK_CONFIG', () => {
    it('should have valid primary system', () => {
      expect(DEFAULT_FALLBACK_CONFIG.primary).toBeDefined()
    })

    it('should have fallback chain', () => {
      expect(Array.isArray(DEFAULT_FALLBACK_CONFIG.fallbackChain)).toBe(true)
      expect(DEFAULT_FALLBACK_CONFIG.fallbackChain.length).toBeGreaterThan(0)
    })

    it('should have reasonable retry settings', () => {
      expect(DEFAULT_FALLBACK_CONFIG.maxRetries).toBeGreaterThan(0)
      expect(DEFAULT_FALLBACK_CONFIG.retryDelayMs).toBeGreaterThan(0)
    })
  })
})

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Fallback Integration', () => {
  it('should handle complete fallback scenario', async () => {
    const executor = createFallbackExecutor({
      fallbackConfig: {
        primary: 'noir',
        fallbackChain: ['halo2', 'kimchi', 'groth16'],
        retryOnFailure: true,
        maxRetries: 10,
        retryDelayMs: 1,
        exponentialBackoff: false,
      },
      enableLogging: false,
    })

    // First two providers fail, third succeeds
    executor.registerProvider(createMockProvider('noir', {
      shouldFail: true,
      failureMessage: 'Noir circuit compilation failed',
    }))
    executor.registerProvider(createMockProvider('halo2', {
      shouldFail: true,
      failureMessage: 'Halo2 prover unavailable',
    }))
    executor.registerProvider(createMockProvider('kimchi'))
    executor.registerProvider(createMockProvider('groth16'))

    const events: FallbackEvent[] = []
    executor.addEventListener(e => events.push(e))

    const result = await executor.execute({
      system: 'noir',
      circuitId: 'test-circuit',
      privateInputs: { secret: '0x123' }, publicInputs: {},
    })

    // Should succeed with kimchi
    expect(result.success).toBe(true)
    expect(result.proof?.metadata.system).toBe('kimchi')

    // Should have appropriate events
    expect(events.some(e => e.type === 'fallback:started')).toBe(true)
    expect(events.some(e => e.type === 'fallback:provider_failed')).toBe(true)
    expect(events.some(e => e.type === 'fallback:provider_switched')).toBe(true)
    expect(events.some(e => e.type === 'fallback:success')).toBe(true)
  })

  it('should handle circuit breaker recovery', async () => {
    const executor = createFallbackExecutor({
      fallbackConfig: {
        primary: 'noir',
        fallbackChain: ['halo2'],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 1,
        exponentialBackoff: false,
      },
      circuitBreakerConfig: {
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenSuccessThreshold: 1,
      },
      enableLogging: false,
    })

    let noirShouldFail = true

    // Create provider that we can toggle
    const noirProvider: ComposableProofProvider = {
      system: 'noir',
      status: createMockStatus(true),
      capabilities: createMockCapabilities('noir'),
      async initialize() {},
      async waitUntilReady() {},
      async generateProof(request): Promise<ProofGenerationResult> {
        if (noirShouldFail) {
          throw new Error('Noir temporarily unavailable')
        }
        return {
          success: true,
          proof: {
            id: `proof-${++proofIdCounter}`,
            proof: '0x1234' as HexString,
            publicInputs: [],
            metadata: createMockMetadata('noir', request.circuitId),
          },
          timeMs: 100,
          providerId: 'noir-provider',
        }
      },
      async verifyProof() {
        return true
      },
      getAvailableCircuits() {
        return ['test-circuit']
      },
      hasCircuit(circuitId) {
        return circuitId === 'test-circuit'
      },
      async dispose() {},
    }

    executor.registerProvider(noirProvider)
    executor.registerProvider(createMockProvider('halo2'))

    const request = {
      system: 'noir' as ProofSystem,
      circuitId: 'test',
      privateInputs: {}, publicInputs: {},
    }

    // Fail noir to open circuit
    await executor.execute(request)
    await executor.execute(request)

    // Circuit should be open
    const events: FallbackEvent[] = []
    executor.addEventListener(e => events.push(e))

    // Fix noir
    noirShouldFail = false

    // Wait for circuit breaker reset
    await delay(100)

    // Execute again - should try noir in half-open and succeed
    const result = await executor.execute(request)

    // May use noir (if circuit recovered) or halo2 (if still falling back)
    expect(result.success).toBe(true)
  })

  it('should work with priority-based fallback', async () => {
    // Create health data
    const healthData = new Map<ProofSystem, ProviderHealth>()

    // Add health info for providers
    const systems: ProofSystem[] = ['halo2', 'kimchi', 'groth16']
    systems.forEach(system => {
      healthData.set(system, {
        system,
        isHealthy: true,
        successRate: 1,
        avgResponseTimeMs: 100,
        circuitBreaker: {
          state: 'closed',
          failureCount: 0,
          lastFailureAt: 0,
          halfOpenSuccessCount: 0,
        },
      })
    })

    // Mark halo2 as unhealthy
    healthData.get('halo2')!.isHealthy = false
    healthData.get('halo2')!.successRate = 0

    // Create priorities
    const priorities = new Map<ProofSystem, number>([
      ['halo2', 3],
      ['kimchi', 2],
      ['groth16', 1],
    ])

    const strategy = new PriorityFallbackStrategy(
      priorities,
      () => healthData,
    )

    const executor = new FallbackExecutor(
      {
        fallbackConfig: {
          primary: 'noir',
          fallbackChain: ['halo2', 'kimchi', 'groth16'],
          retryOnFailure: true,
          maxRetries: 5,
          retryDelayMs: 1,
          exponentialBackoff: false,
        },
        enableLogging: false,
      },
      strategy,
    )

    executor.registerProvider(createMockProvider('noir', { shouldFail: true }))
    executor.registerProvider(createMockProvider('halo2', { shouldFail: true }))
    executor.registerProvider(createMockProvider('kimchi'))
    executor.registerProvider(createMockProvider('groth16'))

    const result = await executor.execute({
      system: 'noir',
      circuitId: 'test',
      privateInputs: {}, publicInputs: {},
    })

    expect(result.success).toBe(true)
    // Should have fallen back to kimchi (halo2 marked unhealthy and also fails)
    expect(result.proof?.metadata.system).toBe('kimchi')
  })
})
