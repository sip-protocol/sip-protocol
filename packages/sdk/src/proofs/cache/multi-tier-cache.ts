/**
 * Multi-Tier Cache Implementation for Proof Caching
 *
 * @module proofs/cache/multi-tier-cache
 * @description Combines in-memory LRU and persistent caching with write/read-through
 *
 * M20-13: Implement proof caching layer (#313)
 */

import type { SingleProof } from '@sip-protocol/types'
import type {
  CacheKey,
  CacheKeyComponents,
  CacheLookupResult,
  ProofCacheStats,
  CacheEvent,
  CacheEventListener,
  MultiTierCacheConfig,
  CacheWarmingConfig,
  WarmingResult,
  InvalidationRule,
  ILRUCache,
  IPersistentCache,
  IMultiTierCache,
} from './interface'
import { DEFAULT_MULTI_TIER_CONFIG, DEFAULT_WARMING_CONFIG } from './interface'
import { LRUCache } from './lru-cache'
import { createPersistentCache } from './persistent-cache'

// ─── Multi-Tier Cache Implementation ─────────────────────────────────────────

/**
 * Multi-tier cache combining in-memory LRU with optional persistent storage
 */
export class MultiTierCache<T = SingleProof> implements IMultiTierCache<T> {
  private readonly config: MultiTierCacheConfig
  private readonly memoryCache: ILRUCache<T>
  private readonly persistentCache: IPersistentCache<T> | null = null
  private readonly listeners: Set<CacheEventListener> = new Set()

  private warmingConfig: CacheWarmingConfig = DEFAULT_WARMING_CONFIG
  private warmingInterval: ReturnType<typeof setInterval> | null = null
  private warmingGenerator: ((key: CacheKeyComponents) => Promise<T>) | null = null

  // Track access patterns for warming predictions
  private accessHistory: Array<{ key: string; timestamp: number }> = []
  private readonly maxHistorySize = 1000

  constructor(
    config: Partial<MultiTierCacheConfig> = {},
    persistentConfig?: Parameters<typeof createPersistentCache>[0]
  ) {
    this.config = { ...DEFAULT_MULTI_TIER_CONFIG, ...config }

    // Initialize memory cache
    this.memoryCache = new LRUCache<T>(this.config.memory)

    // Initialize persistent cache if configured
    if (this.config.persistent || persistentConfig) {
      try {
        this.persistentCache = createPersistentCache<T>(
          persistentConfig ?? this.config.persistent
        )
      } catch {
        // Persistent cache not available in this environment
        this.persistentCache = null
      }
    }

    // Forward events from memory cache
    this.memoryCache.addEventListener((event) => {
      this.emitEvent(event)
    })

    // Forward events from persistent cache
    if (this.persistentCache) {
      this.persistentCache.addEventListener((event) => {
        this.emitEvent({ ...event, data: { ...event.data, tier: 'persistent' } })
      })
    }
  }

  /**
   * Initialize the multi-tier cache
   */
  async initialize(): Promise<void> {
    if (this.persistentCache) {
      await this.persistentCache.initialize()
    }
  }

  /**
   * Get an entry from the cache
   */
  async get(key: CacheKey | string): Promise<CacheLookupResult<T>> {
    const keyStr = typeof key === 'string' ? key : key.key

    // Track access for warming predictions
    this.trackAccess(keyStr)

    // Try memory cache first
    const memoryResult = await this.memoryCache.get(key)
    if (memoryResult.hit) {
      return memoryResult
    }

    // Try persistent cache if read-through enabled
    if (this.config.readThrough && this.persistentCache) {
      const persistentResult = await this.persistentCache.get(key)

      if (persistentResult.hit && persistentResult.entry) {
        // Promote to memory cache if configured
        if (this.config.promoteOnAccess) {
          await this.memoryCache.set(
            key,
            persistentResult.entry.value,
            persistentResult.entry.metadata.ttlMs
          )
        }

        return persistentResult
      }
    }

    return {
      hit: false,
      missReason: 'not_found',
      lookupTimeMs: memoryResult.lookupTimeMs,
    }
  }

  /**
   * Set an entry in the cache
   */
  async set(key: CacheKey | string, value: T, ttlMs?: number): Promise<boolean> {
    // Always set in memory cache
    const memorySuccess = await this.memoryCache.set(key, value, ttlMs)

    // Write-through to persistent cache if enabled
    if (this.config.writeThrough && this.persistentCache) {
      await this.persistentCache.set(key, value, ttlMs)
    }

    return memorySuccess
  }

  /**
   * Delete an entry from the cache
   */
  async delete(key: CacheKey | string): Promise<boolean> {
    const memoryDeleted = await this.memoryCache.delete(key)

    // Also delete from persistent cache
    if (this.persistentCache) {
      await this.persistentCache.delete(key)
    }

    return memoryDeleted
  }

  /**
   * Check if an entry exists
   */
  async has(key: CacheKey | string): Promise<boolean> {
    // Check memory first
    if (await this.memoryCache.has(key)) {
      return true
    }

    // Check persistent
    if (this.persistentCache) {
      return this.persistentCache.has(key)
    }

    return false
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.memoryCache.clear()

    if (this.persistentCache) {
      await this.persistentCache.clear()
    }
  }

  /**
   * Get cache statistics (combined from both tiers)
   */
  getStats(): ProofCacheStats {
    const memoryStats = this.memoryCache.getStats()

    if (!this.persistentCache) {
      return memoryStats
    }

    const persistentStats = this.persistentCache.getStats()

    // Combine statistics
    return {
      totalLookups: memoryStats.totalLookups, // Memory handles all lookups
      hits: memoryStats.hits + persistentStats.hits,
      misses: memoryStats.misses - persistentStats.hits, // Adjust for persistent hits
      hitRate:
        memoryStats.totalLookups > 0
          ? (memoryStats.hits + persistentStats.hits) / memoryStats.totalLookups
          : 0,
      entryCount: memoryStats.entryCount, // Memory is the authoritative count
      sizeBytes: memoryStats.sizeBytes,
      maxSizeBytes: memoryStats.maxSizeBytes,
      evictions: memoryStats.evictions,
      expirations: memoryStats.expirations + persistentStats.expirations,
      avgLookupTimeMs: memoryStats.avgLookupTimeMs,
      avgEntryAgeMs: memoryStats.avgEntryAgeMs,
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const memoryKeys = await this.memoryCache.keys(pattern)
    const persistentKeys = this.persistentCache
      ? await this.persistentCache.keys(pattern)
      : []

    // Combine and deduplicate
    const allKeys = new Set([...memoryKeys, ...persistentKeys])
    return Array.from(allKeys)
  }

  addEventListener(listener: CacheEventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: CacheEventListener): void {
    this.listeners.delete(listener)
  }

  /**
   * Get the memory cache tier
   */
  getMemoryCache(): ILRUCache<T> {
    return this.memoryCache
  }

  /**
   * Get the persistent cache tier (if available)
   */
  getPersistentCache(): IPersistentCache<T> | null {
    return this.persistentCache
  }

  /**
   * Warm the cache with specific keys
   */
  async warm(keys: CacheKeyComponents[]): Promise<WarmingResult> {
    const startTime = Date.now()
    let warmed = 0
    let failed = 0
    const warmedKeys: string[] = []

    for (const keyComponents of keys) {
      try {
        if (this.warmingGenerator) {
          const value = await this.warmingGenerator(keyComponents)
          const key = this.componentsToKey(keyComponents)

          await this.set(key, value)
          warmed++
          warmedKeys.push(key)
          this.emitEvent({ type: 'warm', key, timestamp: Date.now() })
        }
      } catch {
        failed++
      }
    }

    return {
      warmed,
      failed,
      timeMs: Date.now() - startTime,
      keys: warmedKeys,
    }
  }

  /**
   * Start automatic cache warming
   */
  startWarming(
    config?: CacheWarmingConfig,
    generator?: (key: CacheKeyComponents) => Promise<T>
  ): void {
    this.stopWarming()

    this.warmingConfig = { ...DEFAULT_WARMING_CONFIG, ...config }
    this.warmingGenerator = generator ?? null

    if (!this.warmingConfig.enabled || !this.warmingGenerator) {
      return
    }

    // Warm on startup
    if (this.warmingConfig.warmOnStartup.length > 0) {
      this.warm(this.warmingConfig.warmOnStartup).catch(() => {})
    }

    // Start periodic warming
    this.warmingInterval = setInterval(() => {
      this.performPredictiveWarming().catch(() => {})
    }, this.warmingConfig.warmIntervalMs)
  }

  /**
   * Stop automatic cache warming
   */
  stopWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval)
      this.warmingInterval = null
    }
  }

  /**
   * Apply invalidation rules
   */
  async invalidate(rules: InvalidationRule[]): Promise<number> {
    // Sort rules by priority
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)
    let invalidated = 0

    for (const rule of sortedRules) {
      switch (rule.strategy) {
        case 'ttl':
          invalidated += await this.invalidateByTTL(rule)
          break
        case 'lru':
          invalidated += await this.invalidateByLRU(rule)
          break
        case 'size':
          invalidated += await this.invalidateBySize(rule)
          break
        case 'manual':
          if (rule.pattern) {
            invalidated += await this.invalidateByPattern(rule.pattern)
          }
          break
        default:
          // FIFO, LFU not implemented yet
          break
      }
    }

    return invalidated
  }

  /**
   * Dispose of the cache
   */
  async dispose(): Promise<void> {
    this.stopWarming()

    if (this.memoryCache instanceof LRUCache) {
      this.memoryCache.dispose()
    }

    if (this.persistentCache) {
      await this.persistentCache.close()
    }

    this.listeners.clear()
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private trackAccess(key: string): void {
    this.accessHistory.push({ key, timestamp: Date.now() })

    // Trim history
    if (this.accessHistory.length > this.maxHistorySize) {
      this.accessHistory = this.accessHistory.slice(-this.maxHistorySize)
    }
  }

  private async performPredictiveWarming(): Promise<void> {
    if (!this.warmingGenerator) return

    const keysToWarm: CacheKeyComponents[] = []
    const maxEntries = this.warmingConfig.maxEntriesPerWarm

    switch (this.warmingConfig.predictionModel) {
      case 'recent':
        // Warm recently accessed keys that might have been evicted
        keysToWarm.push(...this.getRecentKeys(maxEntries))
        break
      case 'frequent':
        // Warm frequently accessed keys
        keysToWarm.push(...this.getFrequentKeys(maxEntries))
        break
      case 'pattern':
        // Warm based on access patterns (time-of-day, etc.)
        keysToWarm.push(...this.getPatternBasedKeys(maxEntries))
        break
    }

    if (keysToWarm.length > 0) {
      await this.warm(keysToWarm)
    }
  }

  private getRecentKeys(limit: number): CacheKeyComponents[] {
    // Get recent unique keys that are not in memory cache
    const recentKeys = new Map<string, CacheKeyComponents>()

    for (let i = this.accessHistory.length - 1; i >= 0 && recentKeys.size < limit * 2; i--) {
      const access = this.accessHistory[i]
      if (!recentKeys.has(access.key)) {
        recentKeys.set(access.key, this.keyToComponents(access.key))
      }
    }

    return Array.from(recentKeys.values()).slice(0, limit)
  }

  private getFrequentKeys(limit: number): CacheKeyComponents[] {
    // Count frequency of each key
    const frequency = new Map<string, number>()

    for (const access of this.accessHistory) {
      frequency.set(access.key, (frequency.get(access.key) ?? 0) + 1)
    }

    // Sort by frequency and return top keys
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    return sorted.map(([key]) => this.keyToComponents(key))
  }

  private getPatternBasedKeys(_limit: number): CacheKeyComponents[] {
    // TODO: Implement time-based patterns (e.g., keys accessed at similar times)
    return []
  }

  private keyToComponents(key: string): CacheKeyComponents {
    // Parse key back to components (simplified)
    const parts = key.split(':')
    return {
      system: (parts[2] ?? 'noir') as CacheKeyComponents['system'],
      circuitId: parts[3] ?? 'unknown',
      privateInputsHash: parts[4] ?? '',
      publicInputsHash: parts[5] ?? '',
      version: parts[6],
    }
  }

  private componentsToKey(components: CacheKeyComponents): string {
    const parts = [
      'sip-proof',
      'v1',
      components.system,
      components.circuitId,
      components.privateInputsHash,
      components.publicInputsHash,
    ]

    if (components.version) {
      parts.push(components.version)
    }

    return parts.join(':')
  }

  private async invalidateByTTL(rule: InvalidationRule): Promise<number> {
    const now = Date.now()
    const keys = await this.keys(rule.pattern)
    let invalidated = 0

    for (const key of keys) {
      const result = await this.memoryCache.get(key)
      if (
        result.hit &&
        result.entry &&
        rule.ttlMs &&
        now - result.entry.metadata.createdAt > rule.ttlMs
      ) {
        await this.delete(key)
        invalidated++
      }
    }

    return invalidated
  }

  private async invalidateByLRU(rule: InvalidationRule): Promise<number> {
    if (!(this.memoryCache instanceof LRUCache)) {
      return 0
    }

    const entries = this.memoryCache.getEntriesLRU()
    const matching = rule.pattern
      ? entries.filter((e) => this.matchesPattern(e.key.key, rule.pattern!))
      : entries

    // Evict the least recently used half of matching entries
    const toEvict = Math.floor(matching.length / 2)
    let invalidated = 0

    for (let i = matching.length - 1; i >= matching.length - toEvict && i >= 0; i--) {
      await this.delete(matching[i].key.key)
      invalidated++
    }

    return invalidated
  }

  private async invalidateBySize(_rule: InvalidationRule): Promise<number> {
    // Evict until under target size
    const targetSize = Math.floor(this.config.memory.maxSizeBytes * 0.7)
    let invalidated = 0

    while (this.memoryCache.getSizeBytes() > targetSize) {
      const evicted = this.memoryCache.evict(1)
      if (evicted === 0) break
      invalidated += evicted
    }

    return invalidated
  }

  private async invalidateByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern)
    let invalidated = 0

    for (const key of keys) {
      await this.delete(key)
      invalidated++
    }

    return invalidated
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }

  private emitEvent(event: CacheEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create a multi-tier cache instance
 */
export function createMultiTierCache<T = SingleProof>(
  config?: Partial<MultiTierCacheConfig>,
  persistentConfig?: Parameters<typeof createPersistentCache>[0]
): IMultiTierCache<T> {
  return new MultiTierCache<T>(config, persistentConfig)
}
