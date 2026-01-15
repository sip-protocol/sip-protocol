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

// ─── Backend Status Tracking ──────────────────────────────────────────────────

interface BackendStatus {
  consecutiveFailures: number
  lastFailureAt: number | null
  isCircuitOpen: boolean
}

/**
 * Track backend health for circuit breaker pattern
 */
class BackendTracker {
  private statuses = new Map<string, BackendStatus>()
  private readonly failureThreshold: number
  private readonly resetTimeMs: number

  constructor(options?: { failureThreshold?: number; resetTimeMs?: number }) {
    this.failureThreshold = options?.failureThreshold ?? 3
    this.resetTimeMs = options?.resetTimeMs ?? 30_000 // 30 seconds
  }

  /**
   * Record a successful request
   */
  recordSuccess(backend: string): void {
    this.statuses.set(backend, {
      consecutiveFailures: 0,
      lastFailureAt: null,
      isCircuitOpen: false,
    })
  }

  /**
   * Record a failed request
   */
  recordFailure(backend: string): void {
    const current = this.statuses.get(backend) ?? {
      consecutiveFailures: 0,
      lastFailureAt: null,
      isCircuitOpen: false,
    }

    const failures = current.consecutiveFailures + 1
    this.statuses.set(backend, {
      consecutiveFailures: failures,
      lastFailureAt: Date.now(),
      isCircuitOpen: failures >= this.failureThreshold,
    })
  }

  /**
   * Check if backend circuit is open (should be skipped)
   */
  isCircuitOpen(backend: string): boolean {
    const status = this.statuses.get(backend)
    if (!status?.isCircuitOpen) return false

    // Check if reset time has passed
    if (status.lastFailureAt && Date.now() - status.lastFailureAt > this.resetTimeMs) {
      // Half-open: allow one request to test recovery
      return false
    }

    return true
  }

  /**
   * Get all backend statuses for monitoring
   */
  getAllStatuses(): Map<string, BackendStatus> {
    return new Map(this.statuses)
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
  /** Log backend failures (default: console.warn, set to null to disable) */
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
          console.warn(`[SmartRouter] Backend ${backend} failed: ${error}`)
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
