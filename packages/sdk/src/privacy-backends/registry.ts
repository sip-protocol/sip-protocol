/**
 * Privacy Backend Registry
 *
 * Manages registration and discovery of privacy backends.
 * Optionally integrates with BackendHealthTracker for circuit breaker support.
 *
 * @example
 * ```typescript
 * const registry = new PrivacyBackendRegistry()
 *
 * // Register backends
 * registry.register(new SIPNativeBackend())
 * registry.register(new PrivacyCashBackend(), { priority: 10 })
 *
 * // Get backends
 * const all = registry.getAll()
 * const byName = registry.get('sip-native')
 * const forChain = registry.getByChain('solana')
 * const forType = registry.getByType('transaction')
 *
 * // Health-aware operations (when health tracker is attached)
 * const healthy = registry.getHealthy()
 * const health = registry.getHealthState('sip-native')
 * ```
 */

import type { ChainType } from '@sip-protocol/types'
import type {
  PrivacyBackend,
  BackendType,
  BackendRegistrationOptions,
  RegisteredBackend,
  TransferParams,
  AvailabilityResult,
  BackendHealthState,
  BackendMetrics,
  CircuitBreakerConfig,
} from './interface'
import { warnIfDeprecatedVersion } from './interface'
import { BackendHealthTracker } from './health'
import { RateLimiter, type RateLimiterConfig, type RateLimitStats, type AcquireOptions } from './rate-limiter'

/**
 * Default priority for registered backends
 */
const DEFAULT_PRIORITY = 50

/**
 * Registry configuration options
 */
export interface PrivacyBackendRegistryConfig {
  /**
   * Enable health tracking with circuit breaker
   * @default true
   */
  enableHealthTracking?: boolean
  /**
   * Circuit breaker configuration (when health tracking is enabled)
   */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  /**
   * Enable rate limiting for backends
   * @default false
   */
  enableRateLimiting?: boolean
  /**
   * Rate limiter configuration (when rate limiting is enabled)
   */
  rateLimiterConfig?: RateLimiterConfig
}

/**
 * Registry for managing privacy backends
 *
 * Provides a centralized way to register, discover, and manage
 * different privacy backend implementations. Optionally integrates
 * with BackendHealthTracker for circuit breaker support.
 */
export class PrivacyBackendRegistry {
  private backends: Map<string, RegisteredBackend> = new Map()
  private healthTracker: BackendHealthTracker | null = null
  private rateLimiter: RateLimiter | null = null

  /**
   * Create a new registry
   *
   * @param config - Registry configuration
   */
  constructor(config: PrivacyBackendRegistryConfig = {}) {
    const {
      enableHealthTracking = true,
      circuitBreakerConfig,
      enableRateLimiting = false,
      rateLimiterConfig,
    } = config

    if (enableHealthTracking) {
      this.healthTracker = new BackendHealthTracker(circuitBreakerConfig)
    }

    if (enableRateLimiting) {
      this.rateLimiter = new RateLimiter(rateLimiterConfig)
    }
  }

  /**
   * Get the health tracker instance
   *
   * @returns Health tracker or null if not enabled
   */
  getHealthTracker(): BackendHealthTracker | null {
    return this.healthTracker
  }

  /**
   * Attach an external health tracker
   *
   * Useful for sharing a health tracker between multiple registries
   * or for testing.
   *
   * @param tracker - Health tracker to attach
   */
  setHealthTracker(tracker: BackendHealthTracker | null): void {
    this.healthTracker = tracker
  }

  /**
   * Get the rate limiter instance
   *
   * @returns Rate limiter or null if not enabled
   */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter
  }

  /**
   * Attach an external rate limiter
   *
   * Useful for sharing a rate limiter between multiple registries
   * or for testing.
   *
   * @param limiter - Rate limiter to attach
   */
  setRateLimiter(limiter: RateLimiter | null): void {
    this.rateLimiter = limiter
  }

  /**
   * Register a privacy backend
   *
   * @param backend - Backend instance to register
   * @param options - Registration options
   * @throws Error if backend with same name exists and override is false
   *
   * @example
   * ```typescript
   * registry.register(new SIPNativeBackend())
   * registry.register(new PrivacyCashBackend(), { priority: 100 })
   * ```
   */
  register(
    backend: PrivacyBackend,
    options: BackendRegistrationOptions = {}
  ): void {
    const { override = false, priority = DEFAULT_PRIORITY, enabled = true } = options

    if (this.backends.has(backend.name) && !override) {
      throw new Error(
        `Backend '${backend.name}' is already registered. ` +
        `Use { override: true } to replace it.`
      )
    }

    // Warn about deprecated interface versions
    warnIfDeprecatedVersion(backend)

    this.backends.set(backend.name, {
      backend,
      priority,
      enabled,
      registeredAt: Date.now(),
    })

    // Register with health tracker if enabled
    if (this.healthTracker) {
      this.healthTracker.register(backend.name)
    }
  }

  /**
   * Unregister a backend by name
   *
   * @param name - Backend name to unregister
   * @returns true if backend was removed, false if not found
   */
  unregister(name: string): boolean {
    const removed = this.backends.delete(name)
    if (removed && this.healthTracker) {
      this.healthTracker.unregister(name)
    }
    return removed
  }

  /**
   * Get a backend by name
   *
   * @param name - Backend name
   * @returns Backend instance or undefined if not found
   */
  get(name: string): PrivacyBackend | undefined {
    const entry = this.backends.get(name)
    return entry?.enabled ? entry.backend : undefined
  }

  /**
   * Check if a backend is registered
   *
   * @param name - Backend name
   * @returns true if registered (regardless of enabled state)
   */
  has(name: string): boolean {
    return this.backends.has(name)
  }

  /**
   * Get all enabled backends sorted by priority
   *
   * @returns Array of backends (highest priority first)
   */
  getAll(): PrivacyBackend[] {
    return Array.from(this.backends.values())
      .filter(entry => entry.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(entry => entry.backend)
  }

  /**
   * Get all registered entries (including disabled)
   *
   * @returns Array of registered backend entries
   */
  getAllEntries(): RegisteredBackend[] {
    return Array.from(this.backends.values())
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get backends supporting a specific chain
   *
   * @param chain - Chain type to filter by
   * @returns Array of backends supporting the chain
   */
  getByChain(chain: ChainType): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.chains.includes(chain)
    )
  }

  /**
   * Get backends of a specific type
   *
   * @param type - Backend type to filter by
   * @returns Array of backends of the specified type
   */
  getByType(type: BackendType): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.type === type || backend.type === 'both'
    )
  }

  /**
   * Get backends that support compliance (viewing keys)
   *
   * @returns Array of compliance-supporting backends
   */
  getCompliant(): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.getCapabilities().complianceSupport
    )
  }

  /**
   * Find available backends for a transfer
   *
   * @param params - Transfer parameters
   * @returns Array of available backends with availability info
   */
  async findAvailable(
    params: TransferParams
  ): Promise<Array<{ backend: PrivacyBackend; availability: AvailabilityResult }>> {
    const chainBackends = this.getByChain(params.chain)
    const results: Array<{ backend: PrivacyBackend; availability: AvailabilityResult }> = []

    for (const backend of chainBackends) {
      const availability = await backend.checkAvailability(params)
      if (availability.available) {
        results.push({ backend, availability })
      }
    }

    return results
  }

  /**
   * Enable a backend
   *
   * @param name - Backend name
   * @returns true if backend was enabled, false if not found
   */
  enable(name: string): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.enabled = true
      return true
    }
    return false
  }

  /**
   * Disable a backend
   *
   * @param name - Backend name
   * @returns true if backend was disabled, false if not found
   */
  disable(name: string): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.enabled = false
      return true
    }
    return false
  }

  /**
   * Set backend priority
   *
   * @param name - Backend name
   * @param priority - New priority value
   * @returns true if priority was set, false if not found
   */
  setPriority(name: string, priority: number): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.priority = priority
      return true
    }
    return false
  }

  /**
   * Get count of registered backends
   *
   * @param enabledOnly - If true, only count enabled backends
   * @returns Number of backends
   */
  count(enabledOnly: boolean = false): number {
    if (enabledOnly) {
      return Array.from(this.backends.values()).filter(e => e.enabled).length
    }
    return this.backends.size
  }

  /**
   * Clear all registered backends
   */
  clear(): void {
    this.backends.clear()
    if (this.healthTracker) {
      this.healthTracker.clear()
    }
  }

  /**
   * Get backend names
   *
   * @param enabledOnly - If true, only return enabled backend names
   * @returns Array of backend names
   */
  getNames(enabledOnly: boolean = false): string[] {
    if (enabledOnly) {
      return Array.from(this.backends.entries())
        .filter(([, entry]) => entry.enabled)
        .map(([name]) => name)
    }
    return Array.from(this.backends.keys())
  }

  // ─── Health-Aware Methods ───────────────────────────────────────────────────

  /**
   * Get all healthy backends (circuit not open)
   *
   * Filters out backends where the circuit breaker is open.
   * Falls back to getAll() if health tracking is disabled.
   *
   * @returns Array of healthy backends
   */
  getHealthy(): PrivacyBackend[] {
    const all = this.getAll()
    if (!this.healthTracker) {
      return all
    }
    return all.filter(backend => this.healthTracker!.isHealthy(backend.name))
  }

  /**
   * Get healthy backends supporting a specific chain
   *
   * @param chain - Chain type to filter by
   * @returns Array of healthy backends supporting the chain
   */
  getHealthyByChain(chain: ChainType): PrivacyBackend[] {
    return this.getHealthy().filter(backend => backend.chains.includes(chain))
  }

  /**
   * Get health state for a backend
   *
   * @param name - Backend name
   * @returns Health state or undefined if not tracked
   */
  getHealthState(name: string): BackendHealthState | undefined {
    return this.healthTracker?.getHealth(name)
  }

  /**
   * Get metrics for a backend
   *
   * @param name - Backend name
   * @returns Metrics or undefined if not tracked
   */
  getMetrics(name: string): BackendMetrics | undefined {
    return this.healthTracker?.getMetrics(name)
  }

  /**
   * Get summary of all backend health
   *
   * @returns Object with backend names as keys and health info as values
   */
  getHealthSummary(): Record<string, {
    healthy: boolean
    state: string
    failures: number
    lastError?: string
  }> {
    if (!this.healthTracker) {
      // Return all backends as healthy when tracking is disabled
      const summary: Record<string, {
        healthy: boolean
        state: string
        failures: number
      }> = {}
      for (const name of this.getNames()) {
        summary[name] = { healthy: true, state: 'closed', failures: 0 }
      }
      return summary
    }
    return this.healthTracker.getHealthSummary()
  }

  /**
   * Check if a backend is healthy
   *
   * @param name - Backend name
   * @returns true if healthy or health tracking is disabled
   */
  isHealthy(name: string): boolean {
    if (!this.healthTracker) {
      return true
    }
    return this.healthTracker.isHealthy(name)
  }

  /**
   * Manually open circuit for a backend
   *
   * Useful for maintenance or known issues.
   *
   * @param name - Backend name
   * @returns true if circuit was opened, false if not found or tracking disabled
   */
  openCircuit(name: string): boolean {
    if (!this.healthTracker || !this.backends.has(name)) {
      return false
    }
    this.healthTracker.forceOpen(name)
    return true
  }

  /**
   * Manually close circuit for a backend
   *
   * Use with caution - may route requests to failing backend.
   *
   * @param name - Backend name
   * @returns true if circuit was closed, false if not found or tracking disabled
   */
  closeCircuit(name: string): boolean {
    if (!this.healthTracker || !this.backends.has(name)) {
      return false
    }
    this.healthTracker.forceClose(name)
    return true
  }

  /**
   * Reset health state for a backend
   *
   * Clears failure count and closes circuit.
   *
   * @param name - Backend name
   * @returns true if reset, false if not found or tracking disabled
   */
  resetHealth(name: string): boolean {
    if (!this.healthTracker || !this.backends.has(name)) {
      return false
    }
    this.healthTracker.reset(name)
    return true
  }

  /**
   * Record a successful execution for a backend
   *
   * @param name - Backend name
   * @param latencyMs - Request latency in milliseconds
   */
  recordSuccess(name: string, latencyMs: number): void {
    if (this.healthTracker) {
      this.healthTracker.recordSuccess(name, latencyMs)
    }
  }

  /**
   * Record a failed execution for a backend
   *
   * @param name - Backend name
   * @param reason - Failure reason
   */
  recordFailure(name: string, reason: string): void {
    if (this.healthTracker) {
      this.healthTracker.recordFailure(name, reason)
    }
  }

  // ─── Rate Limiting Methods ─────────────────────────────────────────────────

  /**
   * Try to acquire rate limit tokens for a backend (non-blocking)
   *
   * @param name - Backend name
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns true if tokens were acquired, false if rate limited or limiter disabled
   */
  tryAcquire(name: string, tokens: number = 1): boolean {
    if (!this.rateLimiter) {
      return true // No rate limiting enabled
    }
    return this.rateLimiter.tryAcquire(name, tokens)
  }

  /**
   * Acquire rate limit tokens for a backend (async with queueing)
   *
   * @param name - Backend name
   * @param options - Acquire options (tokens, timeout)
   * @returns Promise resolving when tokens are acquired
   * @throws RateLimitExceededError, QueueFullError, or AcquireTimeoutError
   */
  async acquire(name: string, options?: AcquireOptions): Promise<void> {
    if (!this.rateLimiter) {
      return // No rate limiting enabled
    }
    await this.rateLimiter.acquire(name, options)
  }

  /**
   * Check if tokens can be acquired without consuming them
   *
   * @param name - Backend name
   * @param tokens - Number of tokens to check (default: 1)
   * @returns true if tokens are available
   */
  canAcquire(name: string, tokens: number = 1): boolean {
    if (!this.rateLimiter) {
      return true // No rate limiting enabled
    }
    return this.rateLimiter.canAcquire(name, tokens)
  }

  /**
   * Get rate limit statistics for a backend
   *
   * @param name - Backend name
   * @returns Rate limit stats or undefined if limiter disabled
   */
  getRateLimitStats(name: string): RateLimitStats | undefined {
    return this.rateLimiter?.getStats(name)
  }

  /**
   * Check if a backend is rate limited (no tokens available)
   *
   * @param name - Backend name
   * @returns true if rate limited, false if available or limiter disabled
   */
  isRateLimited(name: string): boolean {
    if (!this.rateLimiter) {
      return false
    }
    return !this.rateLimiter.canAcquire(name)
  }

  /**
   * Get all backends that are NOT rate limited
   *
   * @returns Array of backends with available rate limit tokens
   */
  getAvailable(): PrivacyBackend[] {
    const all = this.getAll()
    if (!this.rateLimiter) {
      return all
    }
    return all.filter(backend => this.rateLimiter!.canAcquire(backend.name))
  }

  /**
   * Get available backends for a specific chain
   *
   * Filters by both chain support and rate limit availability.
   *
   * @param chain - Chain type to filter by
   * @returns Array of available backends supporting the chain
   */
  getAvailableByChain(chain: ChainType): PrivacyBackend[] {
    return this.getAvailable().filter(backend => backend.chains.includes(chain))
  }

  /**
   * Get backends that are both healthy AND not rate limited
   *
   * @returns Array of backends ready for use
   */
  getReady(): PrivacyBackend[] {
    const healthy = this.getHealthy()
    if (!this.rateLimiter) {
      return healthy
    }
    return healthy.filter(backend => this.rateLimiter!.canAcquire(backend.name))
  }

  /**
   * Get ready backends for a specific chain
   *
   * @param chain - Chain type to filter by
   * @returns Array of ready backends supporting the chain
   */
  getReadyByChain(chain: ChainType): PrivacyBackend[] {
    return this.getReady().filter(backend => backend.chains.includes(chain))
  }

  /**
   * Reset rate limit state for a backend
   *
   * Refills bucket to max tokens and clears stats.
   *
   * @param name - Backend name
   */
  resetRateLimit(name: string): void {
    this.rateLimiter?.reset(name)
  }

  /**
   * Dispose rate limiter resources
   *
   * Call when shutting down to clean up queue processing intervals.
   */
  disposeRateLimiter(): void {
    this.rateLimiter?.dispose()
  }
}

/**
 * Global default registry instance
 *
 * Use this for simple applications, or create your own instance
 * for more control.
 */
export const defaultRegistry = new PrivacyBackendRegistry()
