/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * A generic, efficient LRU cache with configurable max size and optional TTL.
 * Automatically evicts the least recently used entries when the cache is full.
 *
 * @example
 * ```typescript
 * // Basic usage with max size
 * const cache = new LRUCache<string, User>({ maxSize: 100 })
 * cache.set('user:123', user)
 * const cached = cache.get('user:123')
 *
 * // With TTL expiration (5 minutes)
 * const cacheWithTTL = new LRUCache<string, Balance>({
 *   maxSize: 1000,
 *   ttl: 5 * 60 * 1000,
 * })
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)
 */

/**
 * Configuration options for LRU cache
 */
export interface LRUCacheConfig {
  /**
   * Maximum number of entries to store.
   * When exceeded, the least recently used entry is evicted.
   *
   * @default 1000
   */
  maxSize?: number

  /**
   * Time-to-live in milliseconds for cache entries.
   * Entries older than this are considered expired and will be evicted.
   * If not set, entries never expire based on time.
   *
   * @default undefined (no TTL)
   */
  ttl?: number

  /**
   * Called when an entry is evicted from the cache.
   * Useful for cleanup operations or logging.
   */
  onEvict?: (key: string, value: unknown) => void
}

/**
 * Internal cache entry with metadata
 */
interface CacheEntry<V> {
  /** The cached value */
  value: V
  /** Timestamp when entry was created/updated */
  createdAt: number
}

/**
 * LRU Cache Statistics
 */
export interface LRUCacheStats {
  /** Current number of entries */
  size: number
  /** Maximum allowed entries */
  maxSize: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Hit rate as a percentage (0-100) */
  hitRate: number
  /** Number of entries evicted */
  evictions: number
}

/**
 * LRU (Least Recently Used) Cache
 *
 * Efficient O(1) get/set operations using Map iteration order.
 * When the cache exceeds maxSize, the oldest (least recently used) entries
 * are automatically evicted.
 *
 * @typeParam K - Key type (must be a valid Map key)
 * @typeParam V - Value type
 */
export class LRUCache<K extends string, V> {
  private cache: Map<K, CacheEntry<V>> = new Map()
  private readonly config: Required<Pick<LRUCacheConfig, 'maxSize'>> & LRUCacheConfig
  private stats = { hits: 0, misses: 0, evictions: 0 }

  /**
   * Create a new LRU cache
   *
   * @param config - Cache configuration
   */
  constructor(config: LRUCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      ttl: config.ttl,
      onEvict: config.onEvict,
    }

    if (this.config.maxSize < 1) {
      throw new Error('maxSize must be at least 1')
    }
  }

  /**
   * Get a value from the cache
   *
   * If the entry exists and hasn't expired, it's moved to the end
   * of the cache (most recently used position).
   *
   * @param key - Cache key
   * @returns The cached value, or undefined if not found/expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check TTL expiration
    if (this.isExpired(entry)) {
      this.delete(key)
      this.stats.misses++
      return undefined
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.stats.hits++
    return entry.value
  }

  /**
   * Check if a key exists in the cache (without updating LRU order)
   *
   * @param key - Cache key
   * @returns True if key exists and hasn't expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (this.isExpired(entry)) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Set a value in the cache
   *
   * If the cache is at capacity, the least recently used entry
   * is evicted before adding the new entry.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: K, value: V): void {
    // Delete existing entry to update LRU order
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.config.maxSize) {
      this.evictOldest()
    }

    // Add new entry at end (most recently used)
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    })
  }

  /**
   * Delete an entry from the cache
   *
   * @param key - Cache key
   * @returns True if the entry was deleted
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    this.cache.delete(key)

    if (this.config.onEvict) {
      this.config.onEvict(key, entry.value)
    }

    return true
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    if (this.config.onEvict) {
      for (const [key, entry] of this.cache) {
        this.config.onEvict(key, entry.value)
      }
    }
    this.cache.clear()
  }

  /**
   * Get the current number of entries
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Get all keys in the cache (in LRU order, oldest first)
   */
  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  /**
   * Get all values in the cache (in LRU order, oldest first)
   */
  values(): V[] {
    return Array.from(this.cache.values()).map(entry => entry.value)
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats including hit rate and eviction count
   */
  getStats(): LRUCacheStats {
    const totalAccesses = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalAccesses > 0 ? (this.stats.hits / totalAccesses) * 100 : 0,
      evictions: this.stats.evictions,
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 }
  }

  /**
   * Prune expired entries from the cache
   *
   * This is automatically called during get(), but can be called
   * manually to clean up expired entries proactively.
   *
   * @returns Number of entries pruned
   */
  prune(): number {
    if (!this.config.ttl) return 0

    let pruned = 0
    const now = Date.now()

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.config.ttl) {
        this.delete(key)
        pruned++
      }
    }

    return pruned
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Check if an entry has expired based on TTL
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    if (!this.config.ttl) return false
    return Date.now() - entry.createdAt > this.config.ttl
  }

  /**
   * Evict the oldest (least recently used) entry
   */
  private evictOldest(): void {
    // Map iteration order is insertion order, so first entry is oldest
    const oldestKey = this.cache.keys().next().value
    if (oldestKey !== undefined) {
      const entry = this.cache.get(oldestKey)
      this.cache.delete(oldestKey)
      this.stats.evictions++

      if (this.config.onEvict && entry) {
        this.config.onEvict(oldestKey, entry.value)
      }
    }
  }
}

/**
 * Default cache sizes for different use cases
 */
export const DEFAULT_CACHE_SIZES = {
  /** Token accounts cache */
  TOKEN_ACCOUNTS: 1000,
  /** Balance cache */
  BALANCES: 500,
  /** Computation cache */
  COMPUTATIONS: 100,
  /** Pool info cache */
  POOLS: 50,
} as const

/**
 * Default TTL values in milliseconds
 */
export const DEFAULT_CACHE_TTL = {
  /** Token accounts: 5 minutes */
  TOKEN_ACCOUNTS: 5 * 60 * 1000,
  /** Balances: 30 seconds (balances change frequently) */
  BALANCES: 30 * 1000,
  /** Computations: 10 minutes */
  COMPUTATIONS: 10 * 60 * 1000,
  /** Pool info: 1 minute */
  POOLS: 60 * 1000,
} as const
