/**
 * Proof Caching Layer - Interface Definitions
 *
 * @module proofs/cache
 * @description Types and interfaces for proof caching
 *
 * M20-13: Implement proof caching layer (#313)
 */

import type { ProofSystem, SingleProof } from '@sip-protocol/types'

// ─── Cache Key Types ─────────────────────────────────────────────────────────

/**
 * Components that make up a cache key
 */
export interface CacheKeyComponents {
  /** Proof system (noir, halo2, kimchi) */
  readonly system: ProofSystem
  /** Circuit identifier */
  readonly circuitId: string
  /** Hash of private inputs */
  readonly privateInputsHash: string
  /** Hash of public inputs */
  readonly publicInputsHash: string
  /** Optional version string */
  readonly version?: string
}

/**
 * A complete cache key
 */
export interface CacheKey {
  /** String representation of the key */
  readonly key: string
  /** Components used to generate the key */
  readonly components: CacheKeyComponents
  /** Timestamp when key was generated */
  readonly generatedAt: number
}

// ─── Cache Entry Types ───────────────────────────────────────────────────────

/**
 * Metadata about a cache entry
 */
export interface CacheEntryMetadata {
  /** When the entry was created */
  readonly createdAt: number
  /** When the entry was last accessed */
  lastAccessedAt: number
  /** Number of times the entry has been accessed */
  accessCount: number
  /** Size of the entry in bytes */
  readonly sizeBytes: number
  /** Time-to-live in milliseconds (0 = no expiry) */
  readonly ttlMs: number
  /** When the entry expires (0 = never) */
  readonly expiresAt: number
  /** Source of the entry */
  readonly source: 'generation' | 'warming' | 'import'
}

/**
 * A cached proof entry
 */
export interface CacheEntry<T = SingleProof> {
  /** The cache key */
  readonly key: CacheKey
  /** The cached value */
  readonly value: T
  /** Entry metadata */
  readonly metadata: CacheEntryMetadata
}

/**
 * Result of a cache lookup
 */
export interface CacheLookupResult<T = SingleProof> {
  /** Whether the lookup found a valid entry */
  readonly hit: boolean
  /** The cached entry (if found) */
  readonly entry?: CacheEntry<T>
  /** Reason for miss (if applicable) */
  readonly missReason?: 'not_found' | 'expired' | 'invalid' | 'evicted'
  /** Lookup time in milliseconds */
  readonly lookupTimeMs: number
}

// ─── Cache Configuration ─────────────────────────────────────────────────────

/**
 * LRU cache configuration
 */
export interface LRUCacheConfig {
  /** Maximum number of entries */
  readonly maxEntries: number
  /** Maximum total size in bytes */
  readonly maxSizeBytes: number
  /** Default TTL in milliseconds (0 = no expiry) */
  readonly defaultTtlMs: number
  /** Enable entry access tracking */
  readonly trackAccess: boolean
  /** Eviction check interval in milliseconds */
  readonly evictionIntervalMs: number
}

/**
 * Default LRU cache configuration
 */
export const DEFAULT_LRU_CONFIG: LRUCacheConfig = {
  maxEntries: 1000,
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  defaultTtlMs: 3600000, // 1 hour
  trackAccess: true,
  evictionIntervalMs: 60000, // 1 minute
}

/**
 * Persistent cache configuration (IndexedDB/File)
 */
export interface PersistentCacheConfig {
  /** Storage name/path */
  readonly storageName: string
  /** Maximum total size in bytes */
  readonly maxSizeBytes: number
  /** Default TTL in milliseconds */
  readonly defaultTtlMs: number
  /** Enable compression */
  readonly enableCompression: boolean
  /** Compression threshold (only compress if larger) */
  readonly compressionThresholdBytes: number
  /** Enable encryption */
  readonly enableEncryption: boolean
  /** Encryption key (required if encryption enabled) */
  readonly encryptionKey?: string
}

/**
 * Default persistent cache configuration
 */
export const DEFAULT_PERSISTENT_CONFIG: PersistentCacheConfig = {
  storageName: 'sip-proof-cache',
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
  defaultTtlMs: 86400000, // 24 hours
  enableCompression: true,
  compressionThresholdBytes: 1024, // 1KB
  enableEncryption: false,
}

/**
 * Multi-tier cache configuration
 */
export interface MultiTierCacheConfig {
  /** In-memory LRU cache config */
  readonly memory: LRUCacheConfig
  /** Persistent cache config */
  readonly persistent?: PersistentCacheConfig
  /** Enable write-through to persistent cache */
  readonly writeThrough: boolean
  /** Enable read-through from persistent cache */
  readonly readThrough: boolean
  /** Promote entries from persistent to memory on access */
  readonly promoteOnAccess: boolean
}

/**
 * Default multi-tier cache configuration
 */
export const DEFAULT_MULTI_TIER_CONFIG: MultiTierCacheConfig = {
  memory: DEFAULT_LRU_CONFIG,
  writeThrough: true,
  readThrough: true,
  promoteOnAccess: true,
}

// ─── Cache Statistics ────────────────────────────────────────────────────────

/**
 * Proof cache statistics
 * (Named ProofCacheStats to avoid conflict with composer CacheStats)
 */
export interface ProofCacheStats {
  /** Total number of lookups */
  readonly totalLookups: number
  /** Number of cache hits */
  readonly hits: number
  /** Number of cache misses */
  readonly misses: number
  /** Hit rate (0-1) */
  readonly hitRate: number
  /** Current number of entries */
  readonly entryCount: number
  /** Current size in bytes */
  readonly sizeBytes: number
  /** Maximum size in bytes */
  readonly maxSizeBytes: number
  /** Number of evictions */
  readonly evictions: number
  /** Number of expirations */
  readonly expirations: number
  /** Average lookup time in milliseconds */
  readonly avgLookupTimeMs: number
  /** Average entry age in milliseconds */
  readonly avgEntryAgeMs: number
}

/**
 * Initial proof cache statistics
 */
export const INITIAL_PROOF_CACHE_STATS: ProofCacheStats = {
  totalLookups: 0,
  hits: 0,
  misses: 0,
  hitRate: 0,
  entryCount: 0,
  sizeBytes: 0,
  maxSizeBytes: 0,
  evictions: 0,
  expirations: 0,
  avgLookupTimeMs: 0,
  avgEntryAgeMs: 0,
}

// ─── Cache Events ────────────────────────────────────────────────────────────

/**
 * Cache event types
 */
export type CacheEventType =
  | 'hit'
  | 'miss'
  | 'set'
  | 'delete'
  | 'evict'
  | 'expire'
  | 'clear'
  | 'warm'

/**
 * Cache event
 */
export interface CacheEvent {
  /** Event type */
  readonly type: CacheEventType
  /** Cache key involved (if applicable) */
  readonly key?: string
  /** Timestamp */
  readonly timestamp: number
  /** Additional event data */
  readonly data?: Record<string, unknown>
}

/**
 * Cache event listener
 */
export type CacheEventListener = (event: CacheEvent) => void

// ─── Invalidation Strategies ─────────────────────────────────────────────────

/**
 * Invalidation strategy type
 */
export type InvalidationStrategy =
  | 'ttl'           // Time-based expiration
  | 'lru'           // Least recently used
  | 'lfu'           // Least frequently used
  | 'fifo'          // First in, first out
  | 'size'          // Size-based eviction
  | 'manual'        // Manual invalidation only

/**
 * Invalidation rule
 */
export interface InvalidationRule {
  /** Rule identifier */
  readonly id: string
  /** Strategy to apply */
  readonly strategy: InvalidationStrategy
  /** Pattern to match keys (glob or regex) */
  readonly pattern?: string
  /** TTL for this rule (if ttl strategy) */
  readonly ttlMs?: number
  /** Priority (higher = applied first) */
  readonly priority: number
}

// ─── Cache Warming ───────────────────────────────────────────────────────────

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /** Enable automatic warming */
  readonly enabled: boolean
  /** Keys to warm on startup */
  readonly warmOnStartup: CacheKeyComponents[]
  /** Warm interval in milliseconds */
  readonly warmIntervalMs: number
  /** Maximum entries to warm per interval */
  readonly maxEntriesPerWarm: number
  /** Prediction model for warming */
  readonly predictionModel: 'recent' | 'frequent' | 'pattern' | 'none'
}

/**
 * Default cache warming configuration
 */
export const DEFAULT_WARMING_CONFIG: CacheWarmingConfig = {
  enabled: false,
  warmOnStartup: [],
  warmIntervalMs: 300000, // 5 minutes
  maxEntriesPerWarm: 10,
  predictionModel: 'frequent',
}

/**
 * Cache warming result
 */
export interface WarmingResult {
  /** Number of entries warmed */
  readonly warmed: number
  /** Number of entries failed */
  readonly failed: number
  /** Time taken in milliseconds */
  readonly timeMs: number
  /** Keys that were warmed */
  readonly keys: string[]
}

// ─── Interface Definitions ───────────────────────────────────────────────────

/**
 * Cache key generator interface
 */
export interface ICacheKeyGenerator {
  /**
   * Generate a cache key from components
   */
  generate(components: CacheKeyComponents): CacheKey

  /**
   * Parse a cache key string back to components
   */
  parse(key: string): CacheKeyComponents | null

  /**
   * Hash input data deterministically
   */
  hashInputs(inputs: Record<string, unknown>): string
}

/**
 * Base cache interface
 */
export interface IProofCache<T = SingleProof> {
  /**
   * Get an entry from the cache
   */
  get(key: CacheKey | string): Promise<CacheLookupResult<T>>

  /**
   * Set an entry in the cache
   */
  set(key: CacheKey | string, value: T, ttlMs?: number): Promise<boolean>

  /**
   * Delete an entry from the cache
   */
  delete(key: CacheKey | string): Promise<boolean>

  /**
   * Check if an entry exists
   */
  has(key: CacheKey | string): Promise<boolean>

  /**
   * Clear all entries
   */
  clear(): Promise<void>

  /**
   * Get cache statistics
   */
  getStats(): ProofCacheStats

  /**
   * Get all keys matching a pattern
   */
  keys(pattern?: string): Promise<string[]>

  /**
   * Add an event listener
   */
  addEventListener(listener: CacheEventListener): void

  /**
   * Remove an event listener
   */
  removeEventListener(listener: CacheEventListener): void
}

/**
 * LRU cache interface
 */
export interface ILRUCache<T = SingleProof> extends IProofCache<T> {
  /**
   * Get the current size in bytes
   */
  getSizeBytes(): number

  /**
   * Get the entry count
   */
  getEntryCount(): number

  /**
   * Manually trigger eviction
   */
  evict(count?: number): number

  /**
   * Get entries in LRU order
   */
  getEntriesLRU(): CacheEntry<T>[]

  /**
   * Dispose of the cache and cleanup resources
   */
  dispose(): void
}

/**
 * Persistent cache interface
 */
export interface IPersistentCache<T = SingleProof> extends IProofCache<T> {
  /**
   * Initialize the persistent storage
   */
  initialize(): Promise<void>

  /**
   * Close the persistent storage
   */
  close(): Promise<void>

  /**
   * Check if storage is available
   */
  isAvailable(): boolean

  /**
   * Get storage usage information
   */
  getStorageInfo(): Promise<{
    used: number
    available: number
    quota: number
  }>

  /**
   * Compact the storage (remove expired, defragment)
   */
  compact(): Promise<void>
}

/**
 * Multi-tier cache interface
 */
export interface IMultiTierCache<T = SingleProof> extends IProofCache<T> {
  /**
   * Get the memory cache tier
   */
  getMemoryCache(): ILRUCache<T>

  /**
   * Get the persistent cache tier (if available)
   */
  getPersistentCache(): IPersistentCache<T> | null

  /**
   * Warm the cache with specific keys
   */
  warm(keys: CacheKeyComponents[]): Promise<WarmingResult>

  /**
   * Start automatic cache warming
   */
  startWarming(config?: CacheWarmingConfig): void

  /**
   * Stop automatic cache warming
   */
  stopWarming(): void

  /**
   * Apply invalidation rules
   */
  invalidate(rules: InvalidationRule[]): Promise<number>

  /**
   * Dispose of the cache and cleanup resources
   */
  dispose(): Promise<void>
}

/**
 * Verification key cache (specialized for VKs)
 */
export interface IVerificationKeyCache {
  /**
   * Get a verification key
   */
  getVK(system: ProofSystem, circuitId: string): Promise<string | null>

  /**
   * Set a verification key
   */
  setVK(system: ProofSystem, circuitId: string, vk: string): Promise<void>

  /**
   * Preload verification keys for circuits
   */
  preloadVKs(circuits: Array<{ system: ProofSystem; circuitId: string }>): Promise<void>
}

/**
 * Compiled circuit cache (specialized for compiled circuits)
 */
export interface ICompiledCircuitCache {
  /**
   * Get a compiled circuit
   */
  getCircuit(system: ProofSystem, circuitId: string): Promise<Uint8Array | null>

  /**
   * Set a compiled circuit
   */
  setCircuit(system: ProofSystem, circuitId: string, circuit: Uint8Array): Promise<void>

  /**
   * Check if circuit is compiled and cached
   */
  hasCircuit(system: ProofSystem, circuitId: string): Promise<boolean>
}
