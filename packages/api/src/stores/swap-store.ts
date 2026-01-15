import { LRUCache } from 'lru-cache'
import type { HexString } from '@sip-protocol/types'
import { logger } from '../logger'

/**
 * Swap data stored in the cache
 */
export interface SwapData {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionHash?: HexString
  inputAmount: string
  outputAmount?: string
  createdAt: string
  updatedAt: string
  error?: string
}

/**
 * Swap store configuration
 */
export interface SwapStoreConfig {
  /** Maximum number of swaps to store (default: 10000) */
  maxSize?: number
  /** TTL in milliseconds (default: 24 hours) */
  ttlMs?: number
}

const DEFAULT_MAX_SIZE = 10_000
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * LRU cache-backed swap store with TTL
 *
 * Features:
 * - Bounded memory (max 10,000 entries by default)
 * - Automatic TTL-based expiration (24 hours by default)
 * - LRU eviction when at capacity
 * - Metrics for monitoring
 */
export class SwapStore {
  private cache: LRUCache<string, SwapData>
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(config: SwapStoreConfig = {}) {
    this.maxSize = config.maxSize ?? DEFAULT_MAX_SIZE
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS

    this.cache = new LRUCache<string, SwapData>({
      max: this.maxSize,
      ttl: this.ttlMs,
      updateAgeOnGet: false, // Don't reset TTL on read
      updateAgeOnHas: false,
      // Log when items are evicted or expired
      disposeAfter: (_value, key, reason) => {
        if (reason === 'evict') {
          logger.debug({ swapId: key, reason }, 'Swap evicted from cache (LRU)')
        } else if (reason === 'expire') {
          logger.debug({ swapId: key, reason }, 'Swap expired from cache (TTL)')
        }
      },
    })

    logger.info(
      { maxSize: this.maxSize, ttlMs: this.ttlMs },
      'SwapStore initialized'
    )
  }

  /**
   * Get a swap by ID
   */
  get(id: string): SwapData | undefined {
    return this.cache.get(id)
  }

  /**
   * Check if a swap exists
   */
  has(id: string): boolean {
    return this.cache.has(id)
  }

  /**
   * Set/update a swap
   */
  set(id: string, data: SwapData): void {
    this.cache.set(id, data)
  }

  /**
   * Delete a swap
   */
  delete(id: string): boolean {
    return this.cache.delete(id)
  }

  /**
   * Update swap status
   */
  updateStatus(
    id: string,
    status: SwapData['status'],
    updates?: Partial<SwapData>
  ): SwapData | undefined {
    const existing = this.cache.get(id)
    if (!existing) {
      return undefined
    }

    const updated: SwapData = {
      ...existing,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    }

    this.cache.set(id, updated)
    return updated
  }

  /**
   * Get store metrics for monitoring
   */
  getMetrics(): {
    size: number
    maxSize: number
    ttlMs: number
    utilizationPercent: number
  } {
    const size = this.cache.size
    return {
      size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      utilizationPercent: Math.round((size / this.maxSize) * 100),
    }
  }

  /**
   * Clear all swaps (for testing)
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Purge stale entries (normally handled automatically by LRU cache)
   */
  purgeStale(): void {
    this.cache.purgeStale()
  }
}

// Export singleton instance with default config
// Can be overridden in tests or for custom configurations
export const swapStore = new SwapStore()
