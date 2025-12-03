/**
 * Smart Router for Optimal Route Selection
 *
 * Queries all compatible backends and finds the best route based on preferences.
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
import { ValidationError, NetworkError } from '../errors'

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
}

/**
 * Smart Router for finding optimal settlement routes
 *
 * Queries all compatible backends in parallel and ranks routes by:
 * - Total cost (network + protocol fees)
 * - Execution speed (estimated time)
 * - Privacy support (shielded vs transparent)
 *
 * @example
 * ```typescript
 * const registry = new SettlementRegistry()
 * registry.register(nearIntentsBackend)
 * registry.register(zcashBackend)
 *
 * const router = new SmartRouter(registry)
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
  constructor(private registry: SettlementRegistry) {}

  /**
   * Find best routes for a swap
   *
   * Queries all compatible backends in parallel and returns sorted routes.
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
    } = params

    // Validate amount
    if (amount <= 0n) {
      throw new ValidationError('Amount must be greater than zero')
    }

    // Get all registered backends
    const allBackends = this.registry
      .list()
      .map((name) => this.registry.get(name))

    // Filter backends that support this route and privacy level
    const compatibleBackends = allBackends.filter((backend) => {
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

    // Query all compatible backends in parallel
    const quotePromises = compatibleBackends.map(async (backend) => {
      try {
        const quote = await backend.getQuote(quoteParams)
        return {
          backend: backend.name,
          quote,
          backendInstance: backend,
          success: true,
        }
      } catch (error) {
        return {
          backend: backend.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        }
      }
    })

    const results = await Promise.all(quotePromises)

    // Filter successful quotes
    const successfulRoutes = results
      .filter((r): r is { backend: string; quote: Quote; backendInstance: SettlementBackend; success: true } => r.success)
      .map((r) => ({
        backend: r.backend,
        quote: r.quote,
        backendInstance: r.backendInstance,
        score: 0, // Will be calculated below
      }))

    if (successfulRoutes.length === 0) {
      const errors = results
        .filter((r): r is { backend: string; error: string; success: false } => !r.success)
        .map((r) => `${r.backend}: ${r.error}`)
        .join(', ')

      throw new NetworkError(
        `All backends failed to provide quotes: ${errors}`
      )
    }

    // Calculate scores and rank
    this.rankRoutes(successfulRoutes, { preferSpeed, preferLowFees })

    // Sort by score (highest first)
    successfulRoutes.sort((a, b) => b.score - a.score)

    return successfulRoutes
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
 * @returns SmartRouter instance
 *
 * @example
 * ```typescript
 * const registry = new SettlementRegistry()
 * registry.register(nearIntentsBackend)
 * registry.register(zcashBackend)
 *
 * const router = createSmartRouter(registry)
 * const routes = await router.findBestRoute({ ... })
 * ```
 */
export function createSmartRouter(registry: SettlementRegistry): SmartRouter {
  return new SmartRouter(registry)
}
