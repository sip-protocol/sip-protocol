/**
 * Fallback Proof Strategies
 *
 * Implements fallback strategies for when primary proof providers fail or are unavailable.
 * Ensures proof composition remains reliable even when individual ZK systems have issues.
 *
 * Key features:
 * - Provider failover logic
 * - Graceful degradation (simpler proofs when complex fails)
 * - Circuit breaker pattern for failing providers
 * - Mock/stub fallback for development
 * - Custom fallback configuration
 * - Fallback logging and alerting
 *
 * @packageDocumentation
 */

import type {
  ProofSystem,
  SingleProof,
  HexString,
} from '@sip-protocol/types'

import type { ComposableProofProvider } from './composer/interface'
import type {
  ProofGenerationRequest,
  ProofGenerationResult,
  FallbackConfig,
} from './composer/types'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Fallback strategy interface
 */
export interface FallbackStrategy {
  /** Strategy name */
  readonly name: string

  /** Get next provider in fallback chain */
  getNextProvider(
    currentProvider: ProofSystem | null,
    failedProviders: Set<ProofSystem>,
  ): ProofSystem | null

  /** Check if fallback should be attempted */
  shouldAttemptFallback(
    error: Error,
    attemptCount: number,
    maxAttempts: number,
  ): boolean

  /** Get fallback delay (for retry backoff) */
  getRetryDelay(attemptCount: number): number
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  /** Current state */
  state: 'closed' | 'open' | 'half-open'
  /** Number of consecutive failures */
  failureCount: number
  /** Last failure timestamp */
  lastFailureAt: number
  /** Time when circuit opened */
  openedAt?: number
  /** Success count in half-open state */
  halfOpenSuccessCount: number
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failures before opening circuit */
  failureThreshold: number
  /** Time to wait before half-open (ms) */
  resetTimeoutMs: number
  /** Successes needed in half-open to close */
  halfOpenSuccessThreshold: number
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Provider system */
  system: ProofSystem
  /** Whether provider is healthy */
  isHealthy: boolean
  /** Circuit breaker state */
  circuitBreaker: CircuitBreakerState
  /** Success rate (0-1) */
  successRate: number
  /** Average response time (ms) */
  avgResponseTimeMs: number
  /** Last successful operation timestamp */
  lastSuccessAt?: number
  /** Last error message */
  lastError?: string
}

/**
 * Fallback event types
 */
export type FallbackEventType =
  | 'fallback:started'
  | 'fallback:provider_failed'
  | 'fallback:provider_switched'
  | 'fallback:success'
  | 'fallback:exhausted'
  | 'circuit:opened'
  | 'circuit:closed'
  | 'circuit:half_open'

/**
 * Fallback event
 */
export interface FallbackEvent {
  type: FallbackEventType
  timestamp: number
  system?: ProofSystem
  error?: string
  attemptCount?: number
  details?: Record<string, unknown>
  /** Previous state (for circuit breaker transitions) */
  previousState?: 'closed' | 'open' | 'half-open'
}

/**
 * Fallback event listener
 */
export type FallbackEventListener = (event: FallbackEvent) => void

/**
 * Fallback executor options
 */
export interface FallbackExecutorConfig {
  /** Fallback configuration */
  fallbackConfig: FallbackConfig
  /** Circuit breaker config */
  circuitBreakerConfig?: CircuitBreakerConfig
  /** Enable mock fallback in development */
  enableMockFallback?: boolean
  /** Log all fallback events */
  enableLogging?: boolean
}

// ─── Default Configurations ──────────────────────────────────────────────────

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  halfOpenSuccessThreshold: 3,
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  primary: 'noir',
  fallbackChain: ['halo2', 'kimchi'],
  retryOnFailure: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
}

// ─── Fallback Strategies ─────────────────────────────────────────────────────

/**
 * Simple sequential fallback strategy
 */
export class SequentialFallbackStrategy implements FallbackStrategy {
  readonly name = 'sequential'

  private _fallbackChain: ProofSystem[]

  constructor(fallbackChain: ProofSystem[]) {
    this._fallbackChain = fallbackChain
  }

  getNextProvider(
    currentProvider: ProofSystem | null,
    failedProviders: Set<ProofSystem>,
  ): ProofSystem | null {
    // Find first available provider in chain that hasn't failed
    for (const system of this._fallbackChain) {
      if (!failedProviders.has(system) && system !== currentProvider) {
        return system
      }
    }
    return null
  }

  shouldAttemptFallback(
    _error: Error,
    attemptCount: number,
    maxAttempts: number,
  ): boolean {
    return attemptCount < maxAttempts
  }

  getRetryDelay(attemptCount: number): number {
    // Linear backoff
    return 1000 * attemptCount
  }
}

/**
 * Exponential backoff fallback strategy
 */
export class ExponentialBackoffStrategy implements FallbackStrategy {
  readonly name = 'exponential-backoff'

  private _fallbackChain: ProofSystem[]
  private _baseDelayMs: number
  private _maxDelayMs: number

  constructor(
    fallbackChain: ProofSystem[],
    baseDelayMs: number = 1000,
    maxDelayMs: number = 30000,
  ) {
    this._fallbackChain = fallbackChain
    this._baseDelayMs = baseDelayMs
    this._maxDelayMs = maxDelayMs
  }

  getNextProvider(
    currentProvider: ProofSystem | null,
    failedProviders: Set<ProofSystem>,
  ): ProofSystem | null {
    for (const system of this._fallbackChain) {
      if (!failedProviders.has(system) && system !== currentProvider) {
        return system
      }
    }
    return null
  }

  shouldAttemptFallback(
    _error: Error,
    attemptCount: number,
    maxAttempts: number,
  ): boolean {
    return attemptCount < maxAttempts
  }

  getRetryDelay(attemptCount: number): number {
    const exponentialDelay = this._baseDelayMs * Math.pow(2, attemptCount)
    const jitter = Math.random() * 0.3 * exponentialDelay
    return Math.min(exponentialDelay + jitter, this._maxDelayMs)
  }
}

/**
 * Priority-based fallback strategy (health-aware)
 */
export class PriorityFallbackStrategy implements FallbackStrategy {
  readonly name = 'priority'

  private _priorities: Map<ProofSystem, number>
  private _healthProvider: () => Map<ProofSystem, ProviderHealth>

  constructor(
    priorities: Map<ProofSystem, number>,
    healthProvider: () => Map<ProofSystem, ProviderHealth>,
  ) {
    this._priorities = priorities
    this._healthProvider = healthProvider
  }

  getNextProvider(
    _currentProvider: ProofSystem | null,
    failedProviders: Set<ProofSystem>,
  ): ProofSystem | null {
    const health = this._healthProvider()

    // Sort by priority * health score
    const candidates = Array.from(this._priorities.entries())
      .filter(([system]) => !failedProviders.has(system))
      .map(([system, priority]) => {
        const providerHealth = health.get(system)
        const healthScore = providerHealth?.isHealthy ? providerHealth.successRate : 0
        return { system, score: priority * healthScore }
      })
      .sort((a, b) => b.score - a.score)

    // Return null if no candidates or all have score 0 (all unhealthy)
    if (candidates.length === 0 || candidates[0].score === 0) {
      return null
    }

    return candidates[0].system
  }

  shouldAttemptFallback(
    _error: Error,
    attemptCount: number,
    maxAttempts: number,
  ): boolean {
    return attemptCount < maxAttempts
  }

  getRetryDelay(attemptCount: number): number {
    return 1000 * Math.pow(1.5, attemptCount)
  }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Circuit breaker for provider health management
 */
export class CircuitBreaker {
  private _states: Map<ProofSystem, CircuitBreakerState> = new Map()
  private _config: CircuitBreakerConfig
  private _eventListeners: Set<FallbackEventListener> = new Set()

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this._config = config
  }

  /**
   * Get or create circuit breaker state for a provider
   */
  getState(system: ProofSystem): CircuitBreakerState {
    let state = this._states.get(system)
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        lastFailureAt: 0,
        halfOpenSuccessCount: 0,
      }
      this._states.set(system, state)
    }
    return state
  }

  /**
   * Check if requests to a provider are allowed
   */
  isAllowed(system: ProofSystem): boolean {
    const state = this.getState(system)

    switch (state.state) {
      case 'closed':
        return true

      case 'open':
        // Check if reset timeout has passed
        if (Date.now() - (state.openedAt || 0) > this._config.resetTimeoutMs) {
          this._transitionTo(system, 'half-open')
          return true
        }
        return false

      case 'half-open':
        // Allow limited requests in half-open state
        return true
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(system: ProofSystem): void {
    const state = this.getState(system)

    if (state.state === 'half-open') {
      state.halfOpenSuccessCount++
      if (state.halfOpenSuccessCount >= this._config.halfOpenSuccessThreshold) {
        this._transitionTo(system, 'closed')
      }
    } else if (state.state === 'closed') {
      // Reset failure count on success
      state.failureCount = Math.max(0, state.failureCount - 1)
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(system: ProofSystem, error?: string): void {
    const state = this.getState(system)

    state.failureCount++
    state.lastFailureAt = Date.now()

    if (state.state === 'half-open') {
      // Immediately open circuit on failure in half-open state
      this._transitionTo(system, 'open')
    } else if (state.state === 'closed') {
      if (state.failureCount >= this._config.failureThreshold) {
        this._transitionTo(system, 'open')
      }
    }

    this._emit({
      type: 'fallback:provider_failed',
      timestamp: Date.now(),
      system,
      error,
      details: { failureCount: state.failureCount },
    })
  }

  /**
   * Reset circuit breaker for a provider
   */
  reset(system: ProofSystem): void {
    this._states.set(system, {
      state: 'closed',
      failureCount: 0,
      lastFailureAt: 0,
      halfOpenSuccessCount: 0,
    })
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this._states.clear()
  }

  /**
   * Add event listener
   */
  addEventListener(listener: FallbackEventListener): () => void {
    this._eventListeners.add(listener)
    return () => this._eventListeners.delete(listener)
  }

  private _transitionTo(
    system: ProofSystem,
    newState: 'closed' | 'open' | 'half-open',
  ): void {
    const state = this.getState(system)
    const previousState = state.state

    // Only transition if state actually changes
    if (previousState === newState) return

    state.state = newState

    if (newState === 'open') {
      state.openedAt = Date.now()
      this._emit({ type: 'circuit:opened', timestamp: Date.now(), system, previousState })
    } else if (newState === 'closed') {
      state.failureCount = 0
      state.halfOpenSuccessCount = 0
      this._emit({ type: 'circuit:closed', timestamp: Date.now(), system, previousState })
    } else if (newState === 'half-open') {
      state.halfOpenSuccessCount = 0
      this._emit({ type: 'circuit:half_open', timestamp: Date.now(), system, previousState })
    }
  }

  private _emit(event: FallbackEvent): void {
    for (const listener of this._eventListeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ─── Fallback Executor ───────────────────────────────────────────────────────

/**
 * Executes proof generation with fallback support
 */
export class FallbackExecutor {
  private _config: FallbackExecutorConfig
  private _strategy: FallbackStrategy
  private _circuitBreaker: CircuitBreaker
  private _providers: Map<ProofSystem, ComposableProofProvider> = new Map()
  private _health: Map<ProofSystem, ProviderHealth> = new Map()
  private _eventListeners: Set<FallbackEventListener> = new Set()
  private _mockProvider?: ComposableProofProvider

  constructor(config: FallbackExecutorConfig, customStrategy?: FallbackStrategy) {
    this._config = config

    // Use custom strategy if provided, otherwise create based on config
    if (customStrategy) {
      this._strategy = customStrategy
    } else if (config.fallbackConfig.exponentialBackoff) {
      this._strategy = new ExponentialBackoffStrategy(
        [config.fallbackConfig.primary, ...config.fallbackConfig.fallbackChain],
        config.fallbackConfig.retryDelayMs,
      )
    } else {
      this._strategy = new SequentialFallbackStrategy(
        [config.fallbackConfig.primary, ...config.fallbackConfig.fallbackChain],
      )
    }

    this._circuitBreaker = new CircuitBreaker(
      config.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER_CONFIG,
    )

    // Forward circuit breaker events
    this._circuitBreaker.addEventListener(event => this._emit(event))
  }

  /**
   * Register a provider
   */
  registerProvider(provider: ComposableProofProvider): void {
    this._providers.set(provider.system, provider)
    this._health.set(provider.system, this._createInitialHealth(provider.system))
  }

  /**
   * Set mock provider for development fallback
   */
  setMockProvider(provider: ComposableProofProvider): void {
    this._mockProvider = provider
  }

  /**
   * Execute proof generation with fallback
   */
  async execute(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    const startTime = Date.now()
    const failedProviders = new Set<ProofSystem>()
    let currentProvider = request.system || this._config.fallbackConfig.primary
    let attemptCount = 0
    const maxAttempts = this._config.fallbackConfig.maxRetries + 1

    this._emit({
      type: 'fallback:started',
      timestamp: startTime,
      system: currentProvider,
      details: { request: { circuitId: request.circuitId } },
    })

    while (attemptCount < maxAttempts) {
      // Check circuit breaker
      if (!this._circuitBreaker.isAllowed(currentProvider)) {
        this._log(`Circuit open for ${currentProvider}, finding alternative`)
        failedProviders.add(currentProvider)
        const nextProvider = this._strategy.getNextProvider(currentProvider, failedProviders)

        if (!nextProvider) {
          break
        }

        this._emit({
          type: 'fallback:provider_switched',
          timestamp: Date.now(),
          system: nextProvider,
          details: { from: currentProvider, reason: 'circuit_open' },
        })

        currentProvider = nextProvider
        continue
      }

      // Get provider
      const provider = this._providers.get(currentProvider)
      if (!provider) {
        this._log(`Provider ${currentProvider} not found`)
        failedProviders.add(currentProvider)
        const nextProvider = this._strategy.getNextProvider(currentProvider, failedProviders)

        if (!nextProvider) {
          break
        }

        currentProvider = nextProvider
        continue
      }

      // Attempt proof generation
      try {
        const result = await provider.generateProof({
          ...request,
          system: currentProvider,
        })

        if (result.success) {
          this._circuitBreaker.recordSuccess(currentProvider)
          this._updateHealth(currentProvider, true, Date.now() - startTime)

          this._emit({
            type: 'fallback:success',
            timestamp: Date.now(),
            system: currentProvider,
            attemptCount,
          })

          return result
        }

        // Generation returned failure
        throw new Error(result.error || 'Proof generation failed')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this._log(`Provider ${currentProvider} failed: ${errorMessage}`)

        this._circuitBreaker.recordFailure(currentProvider, errorMessage)
        this._updateHealth(currentProvider, false, Date.now() - startTime, errorMessage)
        failedProviders.add(currentProvider)

        attemptCount++

        // Check if we should retry
        if (!this._strategy.shouldAttemptFallback(
          error instanceof Error ? error : new Error(errorMessage),
          attemptCount,
          maxAttempts,
        )) {
          break
        }

        // Find next provider
        const nextProvider = this._strategy.getNextProvider(currentProvider, failedProviders)

        if (nextProvider) {
          this._emit({
            type: 'fallback:provider_switched',
            timestamp: Date.now(),
            system: nextProvider,
            details: { from: currentProvider, reason: 'failure' },
          })

          currentProvider = nextProvider

          // Apply retry delay
          const delay = this._strategy.getRetryDelay(attemptCount)
          await this._delay(delay)
        } else {
          break
        }
      }
    }

    // All providers exhausted - try mock fallback if enabled
    if (this._config.enableMockFallback && this._mockProvider) {
      this._log('Using mock fallback provider')

      try {
        const result = await this._mockProvider.generateProof(request)
        if (result.success) {
          return result
        }
      } catch {
        // Mock also failed
      }
    }

    this._emit({
      type: 'fallback:exhausted',
      timestamp: Date.now(),
      attemptCount,
      details: { failedProviders: Array.from(failedProviders) },
    })

    return {
      success: false,
      error: `All providers exhausted after ${attemptCount} attempts`,
      timeMs: Date.now() - startTime,
      providerId: 'fallback',
    }
  }

  /**
   * Get health status for all providers
   */
  getHealth(): Map<ProofSystem, ProviderHealth> {
    return new Map(this._health)
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealth(system: ProofSystem): ProviderHealth | undefined {
    return this._health.get(system)
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(system: ProofSystem): void {
    this._circuitBreaker.reset(system)
    const health = this._health.get(system)
    if (health) {
      health.circuitBreaker = this._circuitBreaker.getState(system)
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: FallbackEventListener): () => void {
    this._eventListeners.add(listener)
    return () => this._eventListeners.delete(listener)
  }

  /**
   * Get current fallback strategy
   */
  get strategy(): FallbackStrategy {
    return this._strategy
  }

  /**
   * Set fallback strategy
   */
  setStrategy(strategy: FallbackStrategy): void {
    this._strategy = strategy
  }

  private _createInitialHealth(system: ProofSystem): ProviderHealth {
    return {
      system,
      isHealthy: true,
      circuitBreaker: this._circuitBreaker.getState(system),
      successRate: 1.0,
      avgResponseTimeMs: 0,
    }
  }

  private _updateHealth(
    system: ProofSystem,
    success: boolean,
    responseTimeMs: number,
    error?: string,
  ): void {
    const health = this._health.get(system)
    if (!health) return

    // Update circuit breaker state
    health.circuitBreaker = this._circuitBreaker.getState(system)
    health.isHealthy = health.circuitBreaker.state === 'closed'

    // Update metrics (exponential moving average)
    const alpha = 0.2
    health.avgResponseTimeMs = alpha * responseTimeMs + (1 - alpha) * health.avgResponseTimeMs

    if (success) {
      health.lastSuccessAt = Date.now()
      health.successRate = alpha * 1 + (1 - alpha) * health.successRate
    } else {
      health.lastError = error
      health.successRate = alpha * 0 + (1 - alpha) * health.successRate
    }
  }

  private _emit(event: FallbackEvent): void {
    if (this._config.enableLogging) {
      this._log(`[${event.type}] ${event.system || ''} ${JSON.stringify(event.details || {})}`)
    }

    for (const listener of this._eventListeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }

  private _log(message: string): void {
    if (this._config.enableLogging) {
      console.log(`[FallbackExecutor] ${message}`)
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Mock Fallback Provider ──────────────────────────────────────────────────

/**
 * Create a mock provider for development fallback
 */
export function createMockFallbackProvider(): ComposableProofProvider {
  let proofCounter = 0

  return {
    system: 'noir' as ProofSystem,
    capabilities: {
      system: 'noir',
      supportsRecursion: false,
      supportsBatchVerification: false,
      supportsBrowser: true,
      supportsNode: true,
      maxProofSize: 65536,
      supportedStrategies: [],
      availableCircuits: ['*'], // Accepts any circuit
    },
    status: {
      isReady: true,
      isBusy: false,
      queueLength: 0,
      metrics: {
        proofsGenerated: 0,
        proofsVerified: 0,
        avgGenerationTimeMs: 10,
        avgVerificationTimeMs: 5,
        successRate: 1.0,
        memoryUsageBytes: 0,
      },
    },

    async initialize() {},
    async waitUntilReady() {},

    async generateProof(request) {
      proofCounter++
      const proof: SingleProof = {
        id: `mock-proof-${proofCounter}`,
        proof: '0xmock_proof_data_for_development' as HexString,
        publicInputs: [] as HexString[],
        metadata: {
          system: 'noir',
          systemVersion: 'mock-1.0.0',
          circuitId: request.circuitId,
          circuitVersion: 'mock',
          generatedAt: Date.now(),
          proofSizeBytes: 32,
        },
      }

      return {
        success: true,
        proof,
        timeMs: 10,
        providerId: 'mock-fallback',
      }
    },

    async verifyProof() {
      return true
    },

    async verifyBatch(proofs) {
      return proofs.map(() => true)
    },

    getAvailableCircuits() {
      return ['*']
    },

    hasCircuit() {
      return true // Accepts any circuit
    },

    async dispose() {},
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Create a fallback executor with default configuration
 */
export function createFallbackExecutor(
  config?: Partial<FallbackExecutorConfig>,
): FallbackExecutor {
  return new FallbackExecutor({
    fallbackConfig: config?.fallbackConfig || DEFAULT_FALLBACK_CONFIG,
    circuitBreakerConfig: config?.circuitBreakerConfig,
    enableMockFallback: config?.enableMockFallback ?? false,
    enableLogging: config?.enableLogging ?? false,
  })
}

/**
 * Create a circuit breaker with custom configuration
 */
export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  return new CircuitBreaker({
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...config,
  })
}
