/**
 * LRU Cache Implementation for Proof Caching
 *
 * @module proofs/cache/lru-cache
 * @description In-memory LRU cache for hot proofs
 *
 * M20-13: Implement proof caching layer (#313)
 */

import type { SingleProof } from '@sip-protocol/types'
import type {
  CacheKey,
  CacheEntry,
  CacheEntryMetadata,
  CacheLookupResult,
  ProofCacheStats,
  CacheEvent,
  CacheEventListener,
  LRUCacheConfig,
  ILRUCache,
} from './interface'
import { DEFAULT_LRU_CONFIG } from './interface'

// ─── Internal Types ──────────────────────────────────────────────────────────

interface InternalEntry<T> {
  key: string
  value: T
  metadata: CacheEntryMetadata
  prev: InternalEntry<T> | null
  next: InternalEntry<T> | null
}

// ─── LRU Cache Implementation ────────────────────────────────────────────────

/**
 * In-memory LRU cache for proofs
 * Uses a doubly-linked list for O(1) LRU operations
 */
export class LRUCache<T = SingleProof> implements ILRUCache<T> {
  private readonly config: LRUCacheConfig
  private readonly cache = new Map<string, InternalEntry<T>>()
  private head: InternalEntry<T> | null = null
  private tail: InternalEntry<T> | null = null
  private currentSizeBytes = 0
  private readonly listeners: Set<CacheEventListener> = new Set()
  private evictionTimer: ReturnType<typeof setInterval> | null = null

  // Statistics
  private totalLookups = 0
  private hits = 0
  private misses = 0
  private evictions = 0
  private expirations = 0
  private totalLookupTimeMs = 0

  constructor(config: Partial<LRUCacheConfig> = {}) {
    this.config = { ...DEFAULT_LRU_CONFIG, ...config }

    // Start eviction timer if configured
    if (this.config.evictionIntervalMs > 0) {
      this.startEvictionTimer()
    }
  }

  /**
   * Get an entry from the cache
   */
  async get(key: CacheKey | string): Promise<CacheLookupResult<T>> {
    const startTime = Date.now()
    const keyStr = typeof key === 'string' ? key : key.key

    this.totalLookups++

    const entry = this.cache.get(keyStr)

    if (!entry) {
      this.misses++
      this.updateLookupTime(startTime)
      this.emitEvent({ type: 'miss', key: keyStr, timestamp: Date.now() })

      return {
        hit: false,
        missReason: 'not_found',
        lookupTimeMs: Date.now() - startTime,
      }
    }

    // Check expiration
    if (entry.metadata.expiresAt > 0 && Date.now() > entry.metadata.expiresAt) {
      this.deleteEntry(keyStr)
      this.expirations++
      this.misses++
      this.updateLookupTime(startTime)
      this.emitEvent({ type: 'expire', key: keyStr, timestamp: Date.now() })

      return {
        hit: false,
        missReason: 'expired',
        lookupTimeMs: Date.now() - startTime,
      }
    }

    // Update access tracking
    if (this.config.trackAccess) {
      entry.metadata.lastAccessedAt = Date.now()
      entry.metadata.accessCount++
    }

    // Move to head (most recently used)
    this.moveToHead(entry)

    this.hits++
    this.updateLookupTime(startTime)
    this.emitEvent({ type: 'hit', key: keyStr, timestamp: Date.now() })

    return {
      hit: true,
      entry: {
        key: typeof key === 'string' ? { key, components: {} as CacheKey['components'], generatedAt: 0 } : key,
        value: entry.value,
        metadata: entry.metadata,
      },
      lookupTimeMs: Date.now() - startTime,
    }
  }

  /**
   * Set an entry in the cache
   */
  async set(key: CacheKey | string, value: T, ttlMs?: number): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key
    const effectiveTtl = ttlMs ?? this.config.defaultTtlMs
    const sizeBytes = this.estimateSize(value)

    // Check if entry already exists
    const existing = this.cache.get(keyStr)
    if (existing) {
      // Update existing entry
      this.currentSizeBytes -= existing.metadata.sizeBytes
      existing.value = value
      existing.metadata = {
        ...existing.metadata,
        sizeBytes,
        ttlMs: effectiveTtl,
        expiresAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : 0,
      }
      this.currentSizeBytes += sizeBytes
      this.moveToHead(existing)
      this.emitEvent({ type: 'set', key: keyStr, timestamp: Date.now() })
      return true
    }

    // Evict if necessary to make room
    while (
      (this.cache.size >= this.config.maxEntries ||
        this.currentSizeBytes + sizeBytes > this.config.maxSizeBytes) &&
      this.cache.size > 0
    ) {
      this.evictLRU()
    }

    // Create new entry
    const metadata: CacheEntryMetadata = {
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      sizeBytes,
      ttlMs: effectiveTtl,
      expiresAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : 0,
      source: 'generation',
    }

    const entry: InternalEntry<T> = {
      key: keyStr,
      value,
      metadata,
      prev: null,
      next: null,
    }

    this.cache.set(keyStr, entry)
    this.currentSizeBytes += sizeBytes
    this.addToHead(entry)

    this.emitEvent({ type: 'set', key: keyStr, timestamp: Date.now() })
    return true
  }

  /**
   * Delete an entry from the cache
   */
  async delete(key: CacheKey | string): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key
    const deleted = this.deleteEntry(keyStr)

    if (deleted) {
      this.emitEvent({ type: 'delete', key: keyStr, timestamp: Date.now() })
    }

    return deleted
  }

  /**
   * Check if an entry exists
   */
  async has(key: CacheKey | string): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key
    const entry = this.cache.get(keyStr)

    if (!entry) return false

    // Check expiration
    if (entry.metadata.expiresAt > 0 && Date.now() > entry.metadata.expiresAt) {
      this.deleteEntry(keyStr)
      this.expirations++
      return false
    }

    return true
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.head = null
    this.tail = null
    this.currentSizeBytes = 0
    this.emitEvent({ type: 'clear', timestamp: Date.now() })
  }

  /**
   * Get cache statistics
   */
  getStats(): ProofCacheStats {
    const avgLookupTimeMs =
      this.totalLookups > 0 ? this.totalLookupTimeMs / this.totalLookups : 0

    // Calculate average entry age
    let totalAge = 0
    const now = Date.now()
    for (const entry of this.cache.values()) {
      totalAge += now - entry.metadata.createdAt
    }
    const avgEntryAgeMs = this.cache.size > 0 ? totalAge / this.cache.size : 0

    return {
      totalLookups: this.totalLookups,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalLookups > 0 ? this.hits / this.totalLookups : 0,
      entryCount: this.cache.size,
      sizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.config.maxSizeBytes,
      evictions: this.evictions,
      expirations: this.expirations,
      avgLookupTimeMs,
      avgEntryAgeMs,
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys())

    if (!pattern) {
      return allKeys
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return allKeys.filter((key) => regex.test(key))
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: CacheEventListener): void {
    this.listeners.add(listener)
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: CacheEventListener): void {
    this.listeners.delete(listener)
  }

  /**
   * Get the current size in bytes
   */
  getSizeBytes(): number {
    return this.currentSizeBytes
  }

  /**
   * Get the entry count
   */
  getEntryCount(): number {
    return this.cache.size
  }

  /**
   * Manually trigger eviction
   */
  evict(count?: number): number {
    const toEvict = count ?? 1
    let evicted = 0

    for (let i = 0; i < toEvict && this.cache.size > 0; i++) {
      if (this.evictLRU()) {
        evicted++
      }
    }

    return evicted
  }

  /**
   * Get entries in LRU order (most recent first)
   */
  getEntriesLRU(): CacheEntry<T>[] {
    const entries: CacheEntry<T>[] = []
    let current = this.head

    while (current) {
      entries.push({
        key: { key: current.key, components: {} as CacheKey['components'], generatedAt: 0 },
        value: current.value,
        metadata: current.metadata,
      })
      current = current.next
    }

    return entries
  }

  /**
   * Dispose of the cache
   */
  dispose(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer)
      this.evictionTimer = null
    }
    this.clear()
    this.listeners.clear()
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private deleteEntry(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    this.removeFromList(entry)
    this.cache.delete(key)
    this.currentSizeBytes -= entry.metadata.sizeBytes

    return true
  }

  private evictLRU(): boolean {
    if (!this.tail) return false

    const evictedKey = this.tail.key
    this.deleteEntry(evictedKey)
    this.evictions++
    this.emitEvent({ type: 'evict', key: evictedKey, timestamp: Date.now() })

    return true
  }

  private addToHead(entry: InternalEntry<T>): void {
    entry.prev = null
    entry.next = this.head

    if (this.head) {
      this.head.prev = entry
    }

    this.head = entry

    if (!this.tail) {
      this.tail = entry
    }
  }

  private removeFromList(entry: InternalEntry<T>): void {
    if (entry.prev) {
      entry.prev.next = entry.next
    } else {
      this.head = entry.next
    }

    if (entry.next) {
      entry.next.prev = entry.prev
    } else {
      this.tail = entry.prev
    }

    entry.prev = null
    entry.next = null
  }

  private moveToHead(entry: InternalEntry<T>): void {
    if (entry === this.head) return

    this.removeFromList(entry)
    this.addToHead(entry)
  }

  private estimateSize(value: T): number {
    // Estimate size based on JSON serialization
    try {
      const json = JSON.stringify(value, (_, v) => {
        if (typeof v === 'bigint') return v.toString()
        return v
      })
      return new TextEncoder().encode(json).length
    } catch {
      // Fallback for non-serializable values
      return 1024 // Default 1KB
    }
  }

  private updateLookupTime(startTime: number): void {
    this.totalLookupTimeMs += Date.now() - startTime
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

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.cleanupExpired()
    }, this.config.evictionIntervalMs)
  }

  private cleanupExpired(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (entry.metadata.expiresAt > 0 && now > entry.metadata.expiresAt) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.deleteEntry(key)
      this.expirations++
      this.emitEvent({ type: 'expire', key, timestamp: now })
    }
  }
}

/**
 * Create an LRU cache instance
 */
export function createLRUCache<T = SingleProof>(
  config?: Partial<LRUCacheConfig>
): ILRUCache<T> {
  return new LRUCache<T>(config)
}
