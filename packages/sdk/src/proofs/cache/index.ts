/**
 * Proof Caching Layer Module
 *
 * @module proofs/cache
 * @description Multi-tier caching for proofs and intermediate computation results
 *
 * M20-13: Implement proof caching layer (#313)
 *
 * ## Overview
 *
 * This module provides a comprehensive caching layer for ZK proofs:
 *
 * - **LRU Cache**: Fast in-memory caching with LRU eviction
 * - **Persistent Cache**: IndexedDB (browser) or file-based (Node.js) storage
 * - **Multi-Tier Cache**: Combines memory and persistent with read/write-through
 * - **Cache Warming**: Predictive warming based on access patterns
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   createMultiTierCache,
 *   cacheKeyGenerator,
 * } from '@sip-protocol/sdk/proofs/cache'
 *
 * // Create a multi-tier cache
 * const cache = createMultiTierCache({
 *   memory: { maxEntries: 500, maxSizeBytes: 50 * 1024 * 1024 },
 *   writeThrough: true,
 *   readThrough: true,
 * })
 *
 * // Generate a cache key from inputs
 * const key = cacheKeyGenerator.generateFromInputs(
 *   'noir',
 *   'funding_proof',
 *   { balance: 1000n },
 *   { minRequired: 100n }
 * )
 *
 * // Check cache before generating
 * const cached = await cache.get(key)
 * if (cached.hit) {
 *   return cached.entry!.value
 * }
 *
 * // Generate and cache
 * const proof = await generateProof(...)
 * await cache.set(key, proof)
 * ```
 */

// ─── Types and Interfaces ────────────────────────────────────────────────────

export type {
  // Cache Key
  CacheKeyComponents,
  CacheKey,
  // Cache Entry
  CacheEntryMetadata,
  CacheEntry,
  CacheLookupResult,
  // Configuration
  LRUCacheConfig,
  PersistentCacheConfig,
  MultiTierCacheConfig,
  // Statistics
  ProofCacheStats,
  // Events
  CacheEventType,
  CacheEvent,
  CacheEventListener,
  // Invalidation
  InvalidationStrategy,
  InvalidationRule,
  // Warming
  CacheWarmingConfig,
  WarmingResult,
  // Interfaces
  ICacheKeyGenerator,
  IProofCache,
  ILRUCache,
  IPersistentCache,
  IMultiTierCache,
  IVerificationKeyCache,
  ICompiledCircuitCache,
} from './interface'

export {
  DEFAULT_LRU_CONFIG,
  DEFAULT_PERSISTENT_CONFIG,
  DEFAULT_MULTI_TIER_CONFIG,
  DEFAULT_WARMING_CONFIG,
  INITIAL_PROOF_CACHE_STATS,
} from './interface'

// ─── Cache Key Generator ─────────────────────────────────────────────────────

export {
  CacheKeyGenerator,
  createCacheKeyGenerator,
  cacheKeyGenerator,
} from './key-generator'

// ─── LRU Cache ───────────────────────────────────────────────────────────────

export {
  LRUCache,
  createLRUCache,
} from './lru-cache'

// ─── Persistent Cache ────────────────────────────────────────────────────────

export {
  IndexedDBCache,
  FileCache,
  createPersistentCache,
  createIndexedDBCache,
  createFileCache,
} from './persistent-cache'

// ─── Multi-Tier Cache ────────────────────────────────────────────────────────

export {
  MultiTierCache,
  createMultiTierCache,
} from './multi-tier-cache'
