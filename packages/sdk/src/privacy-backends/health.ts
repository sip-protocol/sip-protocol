/**
 * Backend Health Tracker
 *
 * Implements circuit breaker pattern and metrics tracking for privacy backends.
 *
 * ## Circuit Breaker States
 *
 * ```
 * CLOSED (healthy) ──[N failures]──► OPEN (disabled)
 *     ▲                                  │
 *     │                            [timeout]
 *     │                                  ▼
 *     └──[M successes]──── HALF_OPEN (testing)
 *                              │
 *                         [failure]
 *                              │
 *                              └──────► OPEN
 * ```
 *
 * @example
 * ```typescript
 * const tracker = new BackendHealthTracker({
 *   failureThreshold: 3,
 *   resetTimeoutMs: 30000,
 * })
 *
 * // Record results
 * tracker.recordSuccess('sip-native', 150)
 * tracker.recordFailure('privacycash', 'Connection timeout')
 *
 * // Check health
 * if (tracker.shouldAttempt('sip-native')) {
 *   // Safe to make request
 * }
 * ```
 */

import type {
  BackendHealthState,
  BackendMetrics,
  CircuitBreakerConfig,
  CircuitState,
} from './interface'
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, deepFreeze } from './interface'

/**
 * Create initial health state for a backend
 */
function createInitialHealthState(): BackendHealthState {
  return {
    circuitState: 'closed',
    isHealthy: true,
    lastChecked: Date.now(),
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
  }
}

/**
 * Create initial metrics for a backend
 */
function createInitialMetrics(): BackendMetrics {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
    lastRequestTime: 0,
  }
}

/**
 * Backend Health Tracker
 *
 * Centralized health and metrics tracking for all privacy backends.
 * Implements the circuit breaker pattern to automatically disable
 * failing backends and re-enable them after recovery.
 */
export class BackendHealthTracker {
  private health: Map<string, BackendHealthState> = new Map()
  private metrics: Map<string, BackendMetrics> = new Map()
  private config: CircuitBreakerConfig

  /**
   * Create a new health tracker
   *
   * @param config - Circuit breaker configuration
   */
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config }
  }

  /**
   * Initialize tracking for a backend
   *
   * Called automatically on first access, but can be called explicitly
   * to pre-register backends.
   *
   * @param name - Backend name
   */
  register(name: string): void {
    if (!this.health.has(name)) {
      this.health.set(name, createInitialHealthState())
    }
    if (this.config.enableMetrics && !this.metrics.has(name)) {
      this.metrics.set(name, createInitialMetrics())
    }
  }

  /**
   * Remove tracking for a backend
   *
   * @param name - Backend name
   * @returns true if backend was tracked, false if not found
   */
  unregister(name: string): boolean {
    const healthRemoved = this.health.delete(name)
    this.metrics.delete(name)
    return healthRemoved
  }

  /**
   * Record a successful request
   *
   * Updates health state and metrics based on success.
   *
   * @param name - Backend name
   * @param latencyMs - Request latency in milliseconds
   */
  recordSuccess(name: string, latencyMs: number): void {
    this.register(name)
    const now = Date.now()

    // Update health state
    const health = this.health.get(name)!
    health.lastChecked = now
    health.consecutiveFailures = 0
    health.consecutiveSuccesses++

    // Handle circuit state transitions
    if (health.circuitState === 'half-open') {
      if (health.consecutiveSuccesses >= this.config.successThreshold) {
        // Recovery confirmed, close circuit
        health.circuitState = 'closed'
        health.isHealthy = true
        health.circuitOpenedAt = undefined
      }
    } else if (health.circuitState === 'open') {
      // Shouldn't happen, but handle gracefully
      health.circuitState = 'half-open'
      health.consecutiveSuccesses = 1
    } else {
      // Already closed, stay healthy
      health.isHealthy = true
    }

    // Update metrics
    if (this.config.enableMetrics) {
      const metrics = this.metrics.get(name)!
      metrics.totalRequests++
      metrics.successfulRequests++
      metrics.totalLatencyMs += latencyMs
      metrics.averageLatencyMs = metrics.totalLatencyMs / metrics.successfulRequests
      metrics.lastRequestTime = now
      metrics.lastSuccessTime = now

      // Track min/max latency
      if (metrics.minLatencyMs === undefined || latencyMs < metrics.minLatencyMs) {
        metrics.minLatencyMs = latencyMs
      }
      if (metrics.maxLatencyMs === undefined || latencyMs > metrics.maxLatencyMs) {
        metrics.maxLatencyMs = latencyMs
      }
    }
  }

  /**
   * Record a failed request
   *
   * Updates health state and may open circuit if threshold reached.
   *
   * @param name - Backend name
   * @param reason - Failure reason
   */
  recordFailure(name: string, reason: string): void {
    this.register(name)
    const now = Date.now()

    // Update health state
    const health = this.health.get(name)!
    health.lastChecked = now
    health.consecutiveSuccesses = 0
    health.consecutiveFailures++
    health.lastFailureReason = reason
    health.lastFailureTime = now

    // Handle circuit state transitions
    if (health.circuitState === 'half-open') {
      // Failed during recovery test, reopen circuit
      health.circuitState = 'open'
      health.isHealthy = false
      health.circuitOpenedAt = now
    } else if (health.circuitState === 'closed') {
      // Check if we should open circuit
      if (health.consecutiveFailures >= this.config.failureThreshold) {
        health.circuitState = 'open'
        health.isHealthy = false
        health.circuitOpenedAt = now
      }
    }
    // If already open, stay open (circuitOpenedAt already set)

    // Update metrics
    if (this.config.enableMetrics) {
      const metrics = this.metrics.get(name)!
      metrics.totalRequests++
      metrics.failedRequests++
      metrics.lastRequestTime = now
    }
  }

  /**
   * Check if a request should be attempted
   *
   * Returns true if:
   * - Circuit is closed (healthy)
   * - Circuit is half-open (testing recovery)
   * - Circuit is open but timeout has elapsed (transition to half-open)
   *
   * @param name - Backend name
   * @returns true if request should be attempted
   */
  shouldAttempt(name: string): boolean {
    this.register(name)
    const health = this.health.get(name)!
    const now = Date.now()

    switch (health.circuitState) {
      case 'closed':
        return true

      case 'half-open':
        // Allow request for recovery testing
        return true

      case 'open':
        // Check if timeout has elapsed
        if (health.circuitOpenedAt) {
          const elapsed = now - health.circuitOpenedAt
          if (elapsed >= this.config.resetTimeoutMs) {
            // Transition to half-open
            health.circuitState = 'half-open'
            health.consecutiveSuccesses = 0
            health.consecutiveFailures = 0
            health.lastChecked = now
            return true
          }
        }
        return false

      default:
        return true
    }
  }

  /**
   * Check if backend is healthy
   *
   * @param name - Backend name
   * @returns true if backend is healthy (circuit closed or half-open)
   */
  isHealthy(name: string): boolean {
    if (!this.health.has(name)) {
      return true // Unknown backends assumed healthy
    }
    const health = this.health.get(name)!
    return health.circuitState !== 'open'
  }

  /**
   * Check if circuit is open (backend disabled)
   *
   * @param name - Backend name
   * @returns true if circuit is open
   */
  isCircuitOpen(name: string): boolean {
    if (!this.health.has(name)) {
      return false
    }
    return this.health.get(name)!.circuitState === 'open'
  }

  /**
   * Get current circuit state
   *
   * @param name - Backend name
   * @returns Circuit state
   */
  getCircuitState(name: string): CircuitState {
    if (!this.health.has(name)) {
      return 'closed'
    }
    return this.health.get(name)!.circuitState
  }

  /**
   * Get health state for a backend
   *
   * @param name - Backend name
   * @returns Health state or undefined if not tracked
   */
  getHealth(name: string): BackendHealthState | undefined {
    return this.health.get(name)
  }

  /**
   * Get metrics for a backend
   *
   * @param name - Backend name
   * @returns Metrics or undefined if not tracked
   */
  getMetrics(name: string): BackendMetrics | undefined {
    return this.metrics.get(name)
  }

  /**
   * Get all health states
   *
   * @returns Map of backend name to health state
   */
  getAllHealth(): Map<string, BackendHealthState> {
    return new Map(this.health)
  }

  /**
   * Get all metrics
   *
   * @returns Map of backend name to metrics
   */
  getAllMetrics(): Map<string, BackendMetrics> {
    return new Map(this.metrics)
  }

  /**
   * Get summary of all backend health
   *
   * @returns Object with backend names as keys
   */
  getHealthSummary(): Record<string, {
    healthy: boolean
    state: CircuitState
    failures: number
    lastError?: string
  }> {
    const summary: Record<string, {
      healthy: boolean
      state: CircuitState
      failures: number
      lastError?: string
    }> = {}

    for (const [name, health] of this.health) {
      summary[name] = {
        healthy: health.isHealthy,
        state: health.circuitState,
        failures: health.consecutiveFailures,
        lastError: health.lastFailureReason,
      }
    }

    return summary
  }

  /**
   * Manually reset a backend's health state
   *
   * Clears failure count and closes circuit.
   *
   * @param name - Backend name
   */
  reset(name: string): void {
    if (this.health.has(name)) {
      this.health.set(name, createInitialHealthState())
    }
    if (this.metrics.has(name)) {
      this.metrics.set(name, createInitialMetrics())
    }
  }

  /**
   * Manually force circuit open
   *
   * Useful for maintenance or known issues.
   *
   * @param name - Backend name
   */
  forceOpen(name: string): void {
    this.register(name)
    const health = this.health.get(name)!
    health.circuitState = 'open'
    health.isHealthy = false
    health.circuitOpenedAt = Date.now()
    health.lastFailureReason = 'Manually opened'
  }

  /**
   * Manually force circuit closed
   *
   * Use with caution - may route requests to failing backend.
   *
   * @param name - Backend name
   */
  forceClose(name: string): void {
    this.register(name)
    const health = this.health.get(name)!
    health.circuitState = 'closed'
    health.isHealthy = true
    health.consecutiveFailures = 0
    health.consecutiveSuccesses = 0
    health.circuitOpenedAt = undefined
  }

  /**
   * Clear all health and metrics data
   */
  clear(): void {
    this.health.clear()
    this.metrics.clear()
  }

  /**
   * Get current configuration (deeply frozen copy)
   */
  getConfig(): Readonly<CircuitBreakerConfig> {
    return deepFreeze({ ...this.config })
  }

  /**
   * Update configuration
   *
   * Note: Changes apply to future operations, not existing state.
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get time until circuit reset for a backend
   *
   * @param name - Backend name
   * @returns Milliseconds until reset, or 0 if not open
   */
  getTimeUntilReset(name: string): number {
    if (!this.health.has(name)) {
      return 0
    }

    const health = this.health.get(name)!
    if (health.circuitState !== 'open' || !health.circuitOpenedAt) {
      return 0
    }

    const elapsed = Date.now() - health.circuitOpenedAt
    return Math.max(0, this.config.resetTimeoutMs - elapsed)
  }

  /**
   * Get names of all tracked backends
   *
   * @returns Array of backend names
   */
  getTrackedBackends(): string[] {
    return Array.from(this.health.keys())
  }

  /**
   * Check if a backend is being tracked
   *
   * @param name - Backend name
   * @returns true if backend is tracked
   */
  isTracked(name: string): boolean {
    return this.health.has(name)
  }
}
