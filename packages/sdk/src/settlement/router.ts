/**
 * Smart Router for Optimal Route Selection
 *
 * Queries all compatible backends and finds the best route based on preferences.
 * Features:
 * - Quote caching with configurable TTL
 * - Per-backend timeouts to prevent slow backends from blocking
 * - Error isolation using Promise.allSettled
 * - Backend failure tracking and logging
 *
 * @module settlement/router
 */

import type { ChainId, PrivacyLevel } from '@sip-protocol/types'
import type {
  SettlementBackend,
  QuoteParams,
  Quote,
} from './interface'
import type { SettlementRegistry } from './registry'
import { ValidationError, NetworkError, ErrorCode } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('settlement/router')

// ─── Quote Cache ──────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Simple TTL cache for quote results
 *
 * Uses Map with expiration timestamps. Expired entries are cleaned on get/set.
 */
class QuoteCache {
  private cache = new Map<string, CacheEntry<Quote[]>>()
  private readonly defaultTtlMs: number
  private readonly maxSize: number

  constructor(options?: { ttlMs?: number; maxSize?: number }) {
    this.defaultTtlMs = options?.ttlMs ?? 30_000 // 30 seconds default
    this.maxSize = options?.maxSize ?? 1000
  }

  /**
   * Generate cache key from quote params
   */
  private getKey(params: QuoteParams): string {
    return [
      params.fromChain,
      params.fromToken,
      params.toChain,
      params.toToken,
      params.amount.toString(),
      params.privacyLevel,
    ].join(':')
  }

  /**
   * Get cached quotes if not expired
   */
  get(params: QuoteParams): Quote[] | undefined {
    const key = this.getKey(params)
    const entry = this.cache.get(key)

    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * Cache quotes with TTL
   */
  set(params: QuoteParams, quotes: Quote[], ttlMs?: number): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    const key = this.getKey(params)
    this.cache.set(key, {
      value: quotes,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize }
  }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Circuit breaker states following the standard pattern
 *
 * @see https://martinfowler.com/bliki/CircuitBreaker.html
 *
 * ```
 * CLOSED  --[failures exceed threshold]--> OPEN
 *   ^                                        |
 *   |                                        v
 *   +------[success]------- HALF_OPEN <--[timeout]--+
 * ```
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Circuit breaker status for a single backend
 */
export interface CircuitBreakerStatus {
  /** Current circuit state */
  state: CircuitState
  /** Number of consecutive failures */
  consecutiveFailures: number
  /** Total failure count (lifetime) */
  totalFailures: number
  /** Total success count (lifetime) */
  totalSuccesses: number
  /** Timestamp of last failure */
  lastFailureAt: number | null
  /** Timestamp of last success */
  lastSuccessAt: number | null
  /** Timestamp when circuit opened */
  openedAt: number | null
  /** Last error message */
  lastError: string | null
}

/**
 * Event callbacks for circuit breaker state changes
 */
export interface CircuitBreakerEvents {
  /** Called when circuit transitions to OPEN */
  onOpen?: (backend: string, status: CircuitBreakerStatus) => void
  /** Called when circuit transitions to HALF_OPEN */
  onHalfOpen?: (backend: string, status: CircuitBreakerStatus) => void
  /** Called when circuit transitions to CLOSED */
  onClose?: (backend: string, status: CircuitBreakerStatus) => void
  /** Called on any state change */
  onStateChange?: (backend: string, from: CircuitState, to: CircuitState, status: CircuitBreakerStatus) => void
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening (default: 3) */
  failureThreshold?: number
  /** Time in ms before trying to recover from OPEN (default: 30000) */
  resetTimeMs?: number
  /** Number of successes needed to close from HALF_OPEN (default: 1) */
  successThreshold?: number
  /** Event callbacks */
  events?: CircuitBreakerEvents
}

/**
 * Internal status tracking
 */
interface InternalCircuitStatus extends CircuitBreakerStatus {
  /** Number of successes in HALF_OPEN state */
  halfOpenSuccesses: number
}

/**
 * Circuit Breaker for Settlement Backends
 *
 * Implements the circuit breaker pattern to prevent cascading failures:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Backend is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if backend recovered, limited requests allowed
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeMs: 30_000,
 *   events: {
 *     onOpen: (backend) => console.log(`Circuit OPEN for ${backend}`),
 *     onClose: (backend) => console.log(`Circuit CLOSED for ${backend}`),
 *   }
 * })
 *
 * // Check before making request
 * if (breaker.canRequest('near-intents')) {
 *   try {
 *     const result = await backend.getQuote(params)
 *     breaker.recordSuccess('near-intents')
 *   } catch (e) {
 *     breaker.recordFailure('near-intents', e.message)
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private statuses = new Map<string, InternalCircuitStatus>()
  private readonly failureThreshold: number
  private readonly resetTimeMs: number
  private readonly successThreshold: number
  private readonly events: CircuitBreakerEvents

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3
    this.resetTimeMs = options?.resetTimeMs ?? 30_000
    this.successThreshold = options?.successThreshold ?? 1
    this.events = options?.events ?? {}
  }

  /**
   * Get or create status for a backend
   */
  private getStatus(backend: string): InternalCircuitStatus {
    let status = this.statuses.get(backend)
    if (!status) {
      status = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null,
        lastError: null,
        halfOpenSuccesses: 0,
      }
      this.statuses.set(backend, status)
    }
    return status
  }

  /**
   * Transition circuit state with event emission
   */
  private transition(backend: string, status: InternalCircuitStatus, newState: CircuitState): void {
    const oldState = status.state
    if (oldState === newState) return

    status.state = newState

    // Log state transition
    log.info(
      { backend, from: oldState, to: newState, failures: status.consecutiveFailures },
      `Circuit breaker state change: ${oldState} -> ${newState}`
    )

    // Emit events
    this.events.onStateChange?.(backend, oldState, newState, status)

    switch (newState) {
      case 'OPEN':
        status.openedAt = Date.now()
        this.events.onOpen?.(backend, status)
        break
      case 'HALF_OPEN':
        status.halfOpenSuccesses = 0
        this.events.onHalfOpen?.(backend, status)
        break
      case 'CLOSED':
        status.openedAt = null
        status.consecutiveFailures = 0
        this.events.onClose?.(backend, status)
        break
    }
  }

  /**
   * Check if a request can be made to this backend
   *
   * Returns true if circuit is CLOSED or HALF_OPEN (testing recovery)
   */
  canRequest(backend: string): boolean {
    const status = this.getStatus(backend)

    switch (status.state) {
      case 'CLOSED':
        return true

      case 'OPEN': {
        // Check if reset time has passed
        const timeSinceOpen = status.openedAt ? Date.now() - status.openedAt : 0
        if (timeSinceOpen >= this.resetTimeMs) {
          // Transition to HALF_OPEN to test recovery
          this.transition(backend, status, 'HALF_OPEN')
          return true
        }
        return false
      }

      case 'HALF_OPEN':
        return true

      default:
        return false
    }
  }

  /**
   * Check if circuit is open (shorthand for !canRequest)
   */
  isOpen(backend: string): boolean {
    return !this.canRequest(backend)
  }

  /**
   * Record a successful request
   */
  recordSuccess(backend: string): void {
    const status = this.getStatus(backend)
    status.totalSuccesses++
    status.lastSuccessAt = Date.now()
    status.consecutiveFailures = 0
    status.lastError = null

    if (status.state === 'HALF_OPEN') {
      status.halfOpenSuccesses++
      if (status.halfOpenSuccesses >= this.successThreshold) {
        // Recovery confirmed, close the circuit
        this.transition(backend, status, 'CLOSED')
      }
    } else if (status.state !== 'CLOSED') {
      // Any success in non-HALF_OPEN state closes the circuit
      this.transition(backend, status, 'CLOSED')
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(backend: string, error?: string): void {
    const status = this.getStatus(backend)
    status.totalFailures++
    status.consecutiveFailures++
    status.lastFailureAt = Date.now()
    status.lastError = error ?? 'Unknown error'

    if (status.state === 'HALF_OPEN') {
      // Failure in HALF_OPEN immediately opens the circuit
      this.transition(backend, status, 'OPEN')
    } else if (status.state === 'CLOSED') {
      // Check if threshold exceeded
      if (status.consecutiveFailures >= this.failureThreshold) {
        this.transition(backend, status, 'OPEN')
      }
    }
  }

  /**
   * Get the current state of a backend's circuit
   */
  getState(backend: string): CircuitState {
    return this.getStatusPublic(backend).state
  }

  /**
   * Get detailed status for a backend (public API)
   */
  getStatusPublic(backend: string): CircuitBreakerStatus {
    const status = this.statuses.get(backend)
    if (!status) {
      return {
        state: 'CLOSED',
        consecutiveFailures: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null,
        lastError: null,
      }
    }
    // Return without internal fields
    const { halfOpenSuccesses: _, ...publicStatus } = status
    return publicStatus
  }

  /**
   * Get all backend statuses for monitoring/health checks
   */
  getAllStatuses(): Map<string, CircuitBreakerStatus> {
    const result = new Map<string, CircuitBreakerStatus>()
    for (const [backend, status] of this.statuses) {
      const { halfOpenSuccesses: _, ...publicStatus } = status
      result.set(backend, publicStatus)
    }
    return result
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number
    closed: number
    open: number
    halfOpen: number
    backends: Array<{ name: string; state: CircuitState; failures: number }>
  } {
    const backends: Array<{ name: string; state: CircuitState; failures: number }> = []
    let closed = 0
    let open = 0
    let halfOpen = 0

    for (const [name, status] of this.statuses) {
      backends.push({
        name,
        state: status.state,
        failures: status.consecutiveFailures,
      })

      switch (status.state) {
        case 'CLOSED':
          closed++
          break
        case 'OPEN':
          open++
          break
        case 'HALF_OPEN':
          halfOpen++
          break
      }
    }

    return {
      total: this.statuses.size,
      closed,
      open,
      halfOpen,
      backends,
    }
  }

  /**
   * Reset a specific backend's circuit to CLOSED
   */
  reset(backend: string): void {
    const status = this.getStatus(backend) as InternalCircuitStatus
    status.consecutiveFailures = 0
    status.lastError = null
    this.transition(backend, status, 'CLOSED')
  }

  /**
   * Reset all circuits to CLOSED
   */
  resetAll(): void {
    for (const backend of this.statuses.keys()) {
      this.reset(backend)
    }
  }
}

// Backwards-compatible type alias
type BackendStatus = CircuitBreakerStatus

/**
 * @deprecated Use CircuitBreaker instead. This class is kept for backwards compatibility.
 */
class BackendTracker {
  private breaker: CircuitBreaker

  constructor(options?: { failureThreshold?: number; resetTimeMs?: number }) {
    this.breaker = new CircuitBreaker(options)
  }

  recordSuccess(backend: string): void {
    this.breaker.recordSuccess(backend)
  }

  recordFailure(backend: string): void {
    this.breaker.recordFailure(backend)
  }

  isCircuitOpen(backend: string): boolean {
    return this.breaker.isOpen(backend)
  }

  getAllStatuses(): Map<string, BackendStatus> {
    return this.breaker.getAllStatuses()
  }
}

/**
 * Route with quote information
 */
export interface RouteWithQuote {
  /** Backend name */
  backend: string
  /** Quote from backend */
  quote: Quote
  /** Backend instance */
  backendInstance: SettlementBackend
  /** Score for ranking (higher is better) */
  score: number
}

/**
 * Quote comparison result
 */
export interface QuoteComparison {
  /** All routes with quotes */
  routes: RouteWithQuote[]
  /** Best route by total cost */
  bestByCost: RouteWithQuote | null
  /** Best route by speed */
  bestBySpeed: RouteWithQuote | null
  /** Best route by privacy */
  bestByPrivacy: RouteWithQuote | null
  /** Comparison metadata */
  metadata: {
    /** Total backends queried */
    totalQueried: number
    /** Failed backend queries */
    failures: Array<{ backend: string; error: string }>
    /** Query timestamp */
    queriedAt: number
  }
}

/**
 * Route finding parameters
 */
export interface FindBestRouteParams {
  /** Source chain and token */
  from: { chain: ChainId; token: string }
  /** Destination chain and token */
  to: { chain: ChainId; token: string }
  /** Amount to swap (in smallest units) */
  amount: bigint
  /** Privacy level */
  privacyLevel: PrivacyLevel
  /** Prefer speed over cost (default: false) */
  preferSpeed?: boolean
  /** Prefer low fees over speed (default: true) */
  preferLowFees?: boolean
  /** Additional quote parameters */
  recipientMetaAddress?: string
  senderAddress?: string
  slippageTolerance?: number
  deadline?: number
  /** Skip cache and fetch fresh quotes (default: false) */
  skipCache?: boolean
}

/**
 * Router configuration options
 */
export interface SmartRouterOptions {
  /** Quote cache TTL in milliseconds (default: 30000) */
  cacheTtlMs?: number
  /** Maximum cache size (default: 1000) */
  cacheMaxSize?: number
  /** Per-backend timeout in milliseconds (default: 5000) */
  backendTimeoutMs?: number
  /** Circuit breaker failure threshold (default: 3) */
  circuitBreakerThreshold?: number
  /** Circuit breaker reset time in milliseconds (default: 30000) */
  circuitBreakerResetMs?: number
  /** Log backend failures (default: uses structured logger, set to null to disable) */
  onBackendFailure?: ((backend: string, error: string) => void) | null
}

/**
 * Smart Router for finding optimal settlement routes
 *
 * Queries all compatible backends in parallel and ranks routes by:
 * - Total cost (network + protocol fees)
 * - Execution speed (estimated time)
 * - Privacy support (shielded vs transparent)
 *
 * Features:
 * - Quote caching with configurable TTL (default: 30s)
 * - Per-backend timeouts (default: 5s)
 * - Circuit breaker for failing backends
 * - Error isolation with Promise.allSettled
 *
 * @example
 * ```typescript
 * const registry = new SettlementRegistry()
 * registry.register(nearIntentsBackend)
 * registry.register(zcashBackend)
 *
 * const router = new SmartRouter(registry, {
 *   cacheTtlMs: 30_000,
 *   backendTimeoutMs: 5_000,
 * })
 *
 * const routes = await router.findBestRoute({
 *   from: { chain: 'ethereum', token: 'USDC' },
 *   to: { chain: 'solana', token: 'SOL' },
 *   amount: 100_000000n,
 *   privacyLevel: PrivacyLevel.SHIELDED,
 *   preferLowFees: true
 * })
 *
 * // Get best route
 * const best = routes[0]
 * console.log(`Best backend: ${best.backend}`)
 * console.log(`Cost: ${best.quote.fees.totalFeeUSD} USD`)
 * console.log(`Time: ${best.quote.estimatedTime}s`)
 * ```
 */
export class SmartRouter {
  private readonly cache: QuoteCache
  private readonly tracker: BackendTracker
  private readonly backendTimeoutMs: number
  private readonly onBackendFailure: ((backend: string, error: string) => void) | null

  constructor(
    private registry: SettlementRegistry,
    options?: SmartRouterOptions
  ) {
    this.cache = new QuoteCache({
      ttlMs: options?.cacheTtlMs,
      maxSize: options?.cacheMaxSize,
    })
    this.tracker = new BackendTracker({
      failureThreshold: options?.circuitBreakerThreshold,
      resetTimeMs: options?.circuitBreakerResetMs,
    })
    this.backendTimeoutMs = options?.backendTimeoutMs ?? 5_000
    this.onBackendFailure = options?.onBackendFailure === null
      ? null
      : options?.onBackendFailure ?? ((backend, error) => {
          log.warn({ backend, error }, 'Backend failed')
        })
  }

  /**
   * Clear the quote cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return this.cache.stats()
  }

  /**
   * Get backend health statuses
   */
  getBackendStatuses(): Map<string, BackendStatus> {
    return this.tracker.getAllStatuses()
  }

  /**
   * Find best routes for a swap
   *
   * Queries all compatible backends in parallel and returns sorted routes.
   * Uses caching, per-backend timeouts, and circuit breaker for reliability.
   *
   * @param params - Route finding parameters
   * @returns Sorted routes (best first)
   * @throws {ValidationError} If no backends support the route
   */
  async findBestRoute(params: FindBestRouteParams): Promise<RouteWithQuote[]> {
    const {
      from,
      to,
      amount,
      privacyLevel,
      preferSpeed = false,
      preferLowFees = true,
      recipientMetaAddress,
      senderAddress,
      slippageTolerance,
      deadline,
      skipCache = false,
    } = params

    // Validate amount
    if (amount <= 0n) {
      throw new ValidationError('Amount must be greater than zero')
    }

    // Build quote params
    const quoteParams: QuoteParams = {
      fromChain: from.chain,
      toChain: to.chain,
      fromToken: from.token,
      toToken: to.token,
      amount,
      privacyLevel,
      recipientMetaAddress,
      senderAddress,
      slippageTolerance,
      deadline,
    }

    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cachedQuotes = this.cache.get(quoteParams)
      if (cachedQuotes && cachedQuotes.length > 0) {
        // Reconstruct routes from cached quotes
        const routes = this.reconstructRoutesFromCache(cachedQuotes, quoteParams)
        if (routes.length > 0) {
          this.rankRoutes(routes, { preferSpeed, preferLowFees })
          routes.sort((a, b) => b.score - a.score)
          return routes
        }
      }
    }

    // Get all registered backends
    const allBackends = this.registry
      .list()
      .map((name) => this.registry.get(name))

    // Filter backends that support this route and privacy level
    const compatibleBackends = allBackends.filter((backend) => {
      // Skip backends with open circuits
      if (this.tracker.isCircuitOpen(backend.name)) {
        return false
      }

      const { supportedSourceChains, supportedDestinationChains, supportedPrivacyLevels } =
        backend.capabilities

      const supportsRoute =
        supportedSourceChains.includes(from.chain) &&
        supportedDestinationChains.includes(to.chain)

      const supportsPrivacy = supportedPrivacyLevels.includes(privacyLevel)

      return supportsRoute && supportsPrivacy
    })

    if (compatibleBackends.length === 0) {
      throw new ValidationError(
        `No backend supports route from ${from.chain} to ${to.chain} with privacy level ${privacyLevel}`
      )
    }

    // Query all compatible backends in parallel with timeouts
    const quotePromises = compatibleBackends.map(async (backend) => {
      return this.fetchQuoteWithTimeout(backend, quoteParams)
    })

    // Use Promise.allSettled for error isolation
    const settledResults = await Promise.allSettled(quotePromises)

    // Process results
    const successfulRoutes: RouteWithQuote[] = []
    const failures: Array<{ backend: string; error: string }> = []

    settledResults.forEach((result, index) => {
      const backend = compatibleBackends[index]

      if (result.status === 'fulfilled' && result.value.success) {
        const { quote } = result.value
        this.tracker.recordSuccess(backend.name)
        successfulRoutes.push({
          backend: backend.name,
          quote,
          backendInstance: backend,
          score: 0,
        })
      } else {
        let error: string
        if (result.status === 'rejected') {
          error = result.reason instanceof Error ? result.reason.message : 'Unknown error'
        } else {
          // result.value.success is false here
          error = (result.value as { success: false; error: string }).error
        }

        this.tracker.recordFailure(backend.name)
        failures.push({ backend: backend.name, error })

        // Log failure
        if (this.onBackendFailure) {
          this.onBackendFailure(backend.name, error)
        }
      }
    })

    if (successfulRoutes.length === 0) {
      const errorMessage = failures
        .map((f) => `${f.backend}: ${f.error}`)
        .join(', ')

      throw new NetworkError(
        `All backends failed to provide quotes: ${errorMessage}`,
        ErrorCode.NETWORK_FAILED,
        { context: { failures } }
      )
    }

    // Cache the successful quotes
    const quotesToCache = successfulRoutes.map(r => r.quote)
    this.cache.set(quoteParams, quotesToCache)

    // Calculate scores and rank
    this.rankRoutes(successfulRoutes, { preferSpeed, preferLowFees })

    // Sort by score (highest first)
    successfulRoutes.sort((a, b) => b.score - a.score)

    return successfulRoutes
  }

  /**
   * Fetch quote from a backend with timeout
   * @private
   */
  private async fetchQuoteWithTimeout(
    backend: SettlementBackend,
    params: QuoteParams
  ): Promise<{ success: true; quote: Quote } | { success: false; error: string }> {
    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let resolved = false

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve({
            success: false,
            error: `Timeout after ${this.backendTimeoutMs}ms`,
          })
        }
      }, this.backendTimeoutMs)

      // Fetch quote
      backend.getQuote(params)
        .then((quote) => {
          if (!resolved) {
            resolved = true
            if (timeoutId) clearTimeout(timeoutId)
            resolve({ success: true, quote })
          }
        })
        .catch((error) => {
          if (!resolved) {
            resolved = true
            if (timeoutId) clearTimeout(timeoutId)
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        })
    })
  }

  /**
   * Reconstruct RouteWithQuote from cached quotes
   * @private
   */
  private reconstructRoutesFromCache(
    quotes: Quote[],
    params: QuoteParams
  ): RouteWithQuote[] {
    const routes: RouteWithQuote[] = []

    for (const quote of quotes) {
      // Try to find the backend instance
      const backends = this.registry.list()
      for (const name of backends) {
        const backend = this.registry.get(name)
        const { supportedSourceChains, supportedDestinationChains, supportedPrivacyLevels } =
          backend.capabilities

        const supportsRoute =
          supportedSourceChains.includes(params.fromChain) &&
          supportedDestinationChains.includes(params.toChain)
        const supportsPrivacy = supportedPrivacyLevels.includes(params.privacyLevel)

        if (supportsRoute && supportsPrivacy) {
          routes.push({
            backend: name,
            quote,
            backendInstance: backend,
            score: 0,
          })
          break // Use first matching backend
        }
      }
    }

    return routes
  }

  /**
   * Compare quotes from multiple routes side-by-side
   *
   * @param routes - Routes to compare (from findBestRoute)
   * @returns Comparison with best routes by different criteria
   */
  compareQuotes(routes: RouteWithQuote[]): QuoteComparison {
    if (routes.length === 0) {
      return {
        routes: [],
        bestByCost: null,
        bestBySpeed: null,
        bestByPrivacy: null,
        metadata: {
          totalQueried: 0,
          failures: [],
          queriedAt: Date.now(),
        },
      }
    }

    // Find best by cost (lowest total fee)
    const bestByCost = [...routes].sort((a, b) => {
      const costA = this.calculateTotalCost(a.quote)
      const costB = this.calculateTotalCost(b.quote)
      return costA - costB
    })[0]

    // Find best by speed (lowest estimated time)
    const bestBySpeed = [...routes].sort((a, b) => {
      const timeA = a.quote.estimatedTime ?? Infinity
      const timeB = b.quote.estimatedTime ?? Infinity
      return timeA - timeB
    })[0]

    // Find best by privacy (full shielded support)
    const bestByPrivacy = [...routes].find((route) => {
      const { supportedPrivacyLevels } = route.backendInstance.capabilities
      return (
        supportedPrivacyLevels.includes('shielded' as PrivacyLevel) ||
        supportedPrivacyLevels.includes('compliant' as PrivacyLevel)
      )
    }) || routes[0]

    return {
      routes,
      bestByCost,
      bestBySpeed,
      bestByPrivacy,
      metadata: {
        totalQueried: routes.length,
        failures: [], // Could track from findBestRoute
        queriedAt: Date.now(),
      },
    }
  }

  /**
   * Rank routes by score
   *
   * Scoring algorithm:
   * - Base score: 100
   * - Cost: Lower fees = higher score (up to +50)
   * - Speed: Faster execution = higher score (up to +30)
   * - Privacy: Better privacy support = higher score (up to +20)
   *
   * @private
   */
  private rankRoutes(
    routes: RouteWithQuote[],
    preferences: { preferSpeed: boolean; preferLowFees: boolean }
  ): void {
    const { preferSpeed, preferLowFees } = preferences

    // Calculate min/max for normalization
    const costs = routes.map((r) => this.calculateTotalCost(r.quote))
    const times = routes.map((r) => r.quote.estimatedTime ?? Infinity)

    const minCost = Math.min(...costs)
    const maxCost = Math.max(...costs)
    const minTime = Math.min(...times.filter(t => t !== Infinity))
    const maxTime = Math.max(...times.filter(t => t !== Infinity))

    // Assign scores
    routes.forEach((route, index) => {
      let score = 100 // Base score

      // Cost scoring (0-50 points)
      if (maxCost > minCost) {
        const costNormalized = 1 - (costs[index] - minCost) / (maxCost - minCost)
        const costWeight = preferLowFees ? 50 : 30
        score += costNormalized * costWeight
      }

      // Speed scoring (0-30 points)
      const time = times[index]
      if (time !== Infinity && maxTime > minTime) {
        const speedNormalized = 1 - (time - minTime) / (maxTime - minTime)
        const speedWeight = preferSpeed ? 50 : 30
        score += speedNormalized * speedWeight
      }

      // Privacy scoring (0-20 points)
      const { supportedPrivacyLevels } = route.backendInstance.capabilities
      if (supportedPrivacyLevels.includes('shielded' as PrivacyLevel)) {
        score += 20
      } else if (supportedPrivacyLevels.includes('compliant' as PrivacyLevel)) {
        score += 10
      }

      route.score = score
    })
  }

  /**
   * Calculate total cost from quote
   *
   * Returns total fee in USD if available, otherwise estimates from fees
   *
   * @private
   */
  private calculateTotalCost(quote: Quote): number {
    // Use totalFeeUSD if available
    if (quote.fees.totalFeeUSD) {
      return parseFloat(quote.fees.totalFeeUSD)
    }

    // Otherwise estimate from network + protocol fees
    // This is a rough estimate - real implementation would need price feeds
    const networkFee = parseFloat(quote.fees.networkFee) || 0
    const protocolFee = parseFloat(quote.fees.protocolFee) || 0

    return networkFee + protocolFee
  }
}

/**
 * Create a new SmartRouter instance
 *
 * @param registry - Settlement registry with registered backends
 * @param options - Router configuration options
 * @returns SmartRouter instance
 *
 * @example
 * ```typescript
 * const registry = new SettlementRegistry()
 * registry.register(nearIntentsBackend)
 * registry.register(zcashBackend)
 *
 * const router = createSmartRouter(registry, {
 *   cacheTtlMs: 30_000,
 *   backendTimeoutMs: 5_000,
 * })
 * const routes = await router.findBestRoute({ ... })
 * ```
 */
export function createSmartRouter(
  registry: SettlementRegistry,
  options?: SmartRouterOptions
): SmartRouter {
  return new SmartRouter(registry, options)
}
