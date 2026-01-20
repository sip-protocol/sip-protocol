/**
 * Tests for Proof Caching Layer
 *
 * @module tests/proofs/cache
 * M20-13: Implement proof caching layer (#313)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { SingleProof } from '@sip-protocol/types'
import {
  // Cache Key Generator
  CacheKeyGenerator,
  createCacheKeyGenerator,
  cacheKeyGenerator,
  // LRU Cache
  LRUCache,
  createLRUCache,
  // Multi-Tier Cache
  MultiTierCache,
  createMultiTierCache,
  // Configuration
  DEFAULT_LRU_CONFIG,
  DEFAULT_MULTI_TIER_CONFIG,
  DEFAULT_WARMING_CONFIG,
  INITIAL_PROOF_CACHE_STATS,
  // Types
  type CacheKeyComponents,
  type CacheEventType,
} from '../../src/proofs/cache'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockProof(id: string): SingleProof {
  return {
    id: `proof-${id}`,
    proof: `0x${id.padStart(64, '0')}`,
    publicInputs: [`0x${id}`],
    metadata: {
      system: 'noir',
      systemVersion: '1.0.0',
      circuitId: `circuit-${id}`,
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
      verificationCost: 1000n,
    },
  }
}

// ─── Cache Key Generator Tests ───────────────────────────────────────────────

describe('CacheKeyGenerator', () => {
  let generator: CacheKeyGenerator

  beforeEach(() => {
    generator = new CacheKeyGenerator()
  })

  describe('generate', () => {
    it('should generate a valid cache key', () => {
      const components: CacheKeyComponents = {
        system: 'noir',
        circuitId: 'funding_proof',
        privateInputsHash: 'abc123',
        publicInputsHash: 'def456',
      }

      const key = generator.generate(components)

      expect(key.key).toBe('sip-proof:v1:noir:funding_proof:abc123:def456')
      expect(key.components).toEqual(components)
      expect(key.generatedAt).toBeGreaterThan(0)
    })

    it('should include version in key if provided', () => {
      const components: CacheKeyComponents = {
        system: 'halo2',
        circuitId: 'validity_proof',
        privateInputsHash: 'hash1',
        publicInputsHash: 'hash2',
        version: '2.0.0',
      }

      const key = generator.generate(components)

      expect(key.key).toBe('sip-proof:v1:halo2:validity_proof:hash1:hash2:2.0.0')
    })
  })

  describe('parse', () => {
    it('should parse a valid cache key', () => {
      const keyStr = 'sip-proof:v1:noir:my_circuit:hash1:hash2'
      const components = generator.parse(keyStr)

      expect(components).not.toBeNull()
      expect(components!.system).toBe('noir')
      expect(components!.circuitId).toBe('my_circuit')
      expect(components!.privateInputsHash).toBe('hash1')
      expect(components!.publicInputsHash).toBe('hash2')
    })

    it('should parse key with version', () => {
      const keyStr = 'sip-proof:v1:kimchi:circuit:a:b:1.0'
      const components = generator.parse(keyStr)

      expect(components).not.toBeNull()
      expect(components!.version).toBe('1.0')
    })

    it('should return null for invalid key', () => {
      expect(generator.parse('invalid')).toBeNull()
      expect(generator.parse('wrong:prefix:a:b:c:d')).toBeNull()
      expect(generator.parse('sip-proof:v2:noir:a:b:c')).toBeNull() // Wrong version
    })

    it('should return null for invalid system', () => {
      expect(generator.parse('sip-proof:v1:invalid_system:a:b:c')).toBeNull()
    })
  })

  describe('hashInputs', () => {
    it('should generate deterministic hashes', () => {
      const inputs = { balance: 1000, address: '0x123' }

      const hash1 = generator.hashInputs(inputs)
      const hash2 = generator.hashInputs(inputs)

      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different inputs', () => {
      const hash1 = generator.hashInputs({ value: 100 })
      const hash2 = generator.hashInputs({ value: 200 })

      expect(hash1).not.toBe(hash2)
    })

    it('should handle bigint values', () => {
      const inputs = { balance: 1000n }
      const hash = generator.hashInputs(inputs)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(64) // SHA-256 hex
    })

    it('should handle nested objects', () => {
      const inputs = {
        outer: {
          inner: {
            value: 42,
          },
        },
      }

      const hash = generator.hashInputs(inputs)
      expect(hash).toBeDefined()
    })

    it('should handle arrays', () => {
      const inputs = { values: [1, 2, 3] }
      const hash = generator.hashInputs(inputs)

      expect(hash).toBeDefined()
    })
  })

  describe('generateFromInputs', () => {
    it('should generate key from raw inputs', () => {
      const key = generator.generateFromInputs(
        'noir',
        'test_circuit',
        { secret: 123 },
        { public: 456 }
      )

      expect(key.key).toContain('sip-proof:v1:noir:test_circuit:')
      expect(key.components.system).toBe('noir')
      expect(key.components.circuitId).toBe('test_circuit')
    })
  })

  describe('equals', () => {
    it('should compare cache keys correctly', () => {
      const key1 = generator.generate({
        system: 'noir',
        circuitId: 'test',
        privateInputsHash: 'a',
        publicInputsHash: 'b',
      })

      const key2 = generator.generate({
        system: 'noir',
        circuitId: 'test',
        privateInputsHash: 'a',
        publicInputsHash: 'b',
      })

      expect(generator.equals(key1, key2)).toBe(true)
      expect(generator.equals(key1.key, key2.key)).toBe(true)
    })
  })

  describe('matches', () => {
    it('should match glob patterns', () => {
      const key = 'sip-proof:v1:noir:funding:hash1:hash2'

      expect(generator.matches(key, '*')).toBe(true)
      expect(generator.matches(key, 'sip-proof:*')).toBe(true)
      expect(generator.matches(key, '*:noir:*')).toBe(true)
      expect(generator.matches(key, 'sip-proof:v1:noir:*')).toBe(true)
      expect(generator.matches(key, '*:funding:*')).toBe(true)
      expect(generator.matches(key, 'sip-proof:v1:halo2:*')).toBe(false)
    })
  })
})

describe('createCacheKeyGenerator', () => {
  it('should create a generator instance', () => {
    const generator = createCacheKeyGenerator()
    expect(generator).toBeInstanceOf(CacheKeyGenerator)
  })
})

describe('cacheKeyGenerator singleton', () => {
  it('should be a CacheKeyGenerator instance', () => {
    expect(cacheKeyGenerator).toBeInstanceOf(CacheKeyGenerator)
  })
})

// ─── LRU Cache Tests ─────────────────────────────────────────────────────────

describe('LRUCache', () => {
  let cache: LRUCache<SingleProof>

  beforeEach(() => {
    cache = new LRUCache<SingleProof>({ maxEntries: 10, maxSizeBytes: 1024 * 1024 })
  })

  afterEach(() => {
    cache.dispose()
  })

  describe('get and set', () => {
    it('should store and retrieve values', async () => {
      const proof = createMockProof('test1')
      const key = 'test-key-1'

      await cache.set(key, proof)
      const result = await cache.get(key)

      expect(result.hit).toBe(true)
      expect(result.entry?.value).toEqual(proof)
    })

    it('should return miss for non-existent keys', async () => {
      const result = await cache.get('non-existent')

      expect(result.hit).toBe(false)
      expect(result.missReason).toBe('not_found')
    })

    it('should update existing entries', async () => {
      const proof1 = createMockProof('v1')
      const proof2 = createMockProof('v2')
      const key = 'test-key'

      await cache.set(key, proof1)
      await cache.set(key, proof2)

      const result = await cache.get(key)
      expect(result.entry?.value.id).toBe('proof-v2')
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = new LRUCache<SingleProof>({
        maxEntries: 10,
        defaultTtlMs: 50,
        evictionIntervalMs: 0, // Disable auto eviction
      })

      const proof = createMockProof('ttl-test')
      await shortTtlCache.set('key', proof, 50) // 50ms TTL

      // Should hit immediately
      let result = await shortTtlCache.get('key')
      expect(result.hit).toBe(true)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should miss after expiration
      result = await shortTtlCache.get('key')
      expect(result.hit).toBe(false)
      expect(result.missReason).toBe('expired')

      shortTtlCache.dispose()
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used entries when full', async () => {
      const smallCache = new LRUCache<SingleProof>({ maxEntries: 3, maxSizeBytes: 1024 * 1024 })

      await smallCache.set('key1', createMockProof('1'))
      await smallCache.set('key2', createMockProof('2'))
      await smallCache.set('key3', createMockProof('3'))

      // Access key1 to make it recently used
      await smallCache.get('key1')

      // Add a new entry, should evict key2 (least recently used)
      await smallCache.set('key4', createMockProof('4'))

      expect((await smallCache.get('key1')).hit).toBe(true)
      expect((await smallCache.get('key2')).hit).toBe(false) // Evicted
      expect((await smallCache.get('key3')).hit).toBe(true)
      expect((await smallCache.get('key4')).hit).toBe(true)

      smallCache.dispose()
    })
  })

  describe('delete', () => {
    it('should delete entries', async () => {
      const proof = createMockProof('delete-test')
      await cache.set('key', proof)

      const deleted = await cache.delete('key')
      expect(deleted).toBe(true)

      const result = await cache.get('key')
      expect(result.hit).toBe(false)
    })

    it('should return false for non-existent keys', async () => {
      const deleted = await cache.delete('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('has', () => {
    it('should check existence correctly', async () => {
      const proof = createMockProof('has-test')
      await cache.set('exists', proof)

      expect(await cache.has('exists')).toBe(true)
      expect(await cache.has('not-exists')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', createMockProof('1'))
      await cache.set('key2', createMockProof('2'))

      await cache.clear()

      expect(await cache.has('key1')).toBe(false)
      expect(await cache.has('key2')).toBe(false)
      expect(cache.getEntryCount()).toBe(0)
    })
  })

  describe('keys', () => {
    it('should return all keys', async () => {
      await cache.set('alpha', createMockProof('a'))
      await cache.set('beta', createMockProof('b'))
      await cache.set('gamma', createMockProof('c'))

      const keys = await cache.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('alpha')
      expect(keys).toContain('beta')
      expect(keys).toContain('gamma')
    })

    it('should filter keys by pattern', async () => {
      await cache.set('sip:noir:a', createMockProof('a'))
      await cache.set('sip:noir:b', createMockProof('b'))
      await cache.set('sip:halo2:c', createMockProof('c'))

      const noirKeys = await cache.keys('sip:noir:*')
      expect(noirKeys).toHaveLength(2)
    })
  })

  describe('getStats', () => {
    it('should track statistics correctly', async () => {
      await cache.set('key1', createMockProof('1'))
      await cache.get('key1') // Hit
      await cache.get('key2') // Miss

      const stats = cache.getStats()
      expect(stats.totalLookups).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
      expect(stats.entryCount).toBe(1)
    })
  })

  describe('evict', () => {
    it('should manually evict entries', async () => {
      await cache.set('key1', createMockProof('1'))
      await cache.set('key2', createMockProof('2'))

      const evicted = cache.evict(1)
      expect(evicted).toBe(1)
      expect(cache.getEntryCount()).toBe(1)
    })
  })

  describe('getEntriesLRU', () => {
    it('should return entries in LRU order', async () => {
      await cache.set('key1', createMockProof('1'))
      await cache.set('key2', createMockProof('2'))
      await cache.get('key1') // Make key1 most recent

      const entries = cache.getEntriesLRU()
      expect(entries[0].key.key).toBe('key1') // Most recent
      expect(entries[1].key.key).toBe('key2') // Least recent
    })
  })

  describe('events', () => {
    it('should emit events', async () => {
      const events: CacheEventType[] = []
      cache.addEventListener((event) => events.push(event.type))

      await cache.set('key', createMockProof('1'))
      await cache.get('key')
      await cache.get('non-existent')
      await cache.delete('key')

      expect(events).toContain('set')
      expect(events).toContain('hit')
      expect(events).toContain('miss')
      expect(events).toContain('delete')
    })
  })
})

describe('createLRUCache', () => {
  it('should create an LRU cache with custom config', () => {
    const cache = createLRUCache({ maxEntries: 50 })
    expect(cache).toBeInstanceOf(LRUCache)
    cache.dispose()
  })
})

// ─── Multi-Tier Cache Tests ──────────────────────────────────────────────────

describe('MultiTierCache', () => {
  let cache: MultiTierCache<SingleProof>

  beforeEach(async () => {
    cache = new MultiTierCache<SingleProof>({
      memory: { maxEntries: 10, maxSizeBytes: 1024 * 1024, defaultTtlMs: 0, trackAccess: true, evictionIntervalMs: 0 },
      writeThrough: false, // Disable persistent for tests
      readThrough: false,
      promoteOnAccess: true,
    })
  })

  afterEach(async () => {
    await cache.dispose()
  })

  describe('get and set', () => {
    it('should store and retrieve values from memory', async () => {
      const proof = createMockProof('multi-test')
      const key = 'multi-key'

      await cache.set(key, proof)
      const result = await cache.get(key)

      expect(result.hit).toBe(true)
      expect(result.entry?.value).toEqual(proof)
    })
  })

  describe('getMemoryCache', () => {
    it('should return the memory cache tier', () => {
      const memoryCache = cache.getMemoryCache()
      expect(memoryCache).toBeDefined()
      expect(memoryCache).toBeInstanceOf(LRUCache)
    })
  })

  describe('getPersistentCache', () => {
    it('should return null when persistent is not configured', () => {
      const persistentCache = cache.getPersistentCache()
      expect(persistentCache).toBeNull()
    })
  })

  describe('invalidate', () => {
    it('should invalidate by pattern', async () => {
      await cache.set('sip:noir:a', createMockProof('a'))
      await cache.set('sip:noir:b', createMockProof('b'))
      await cache.set('sip:halo2:c', createMockProof('c'))

      const invalidated = await cache.invalidate([
        { id: 'pattern', strategy: 'manual', pattern: 'sip:noir:*', priority: 1 },
      ])

      expect(invalidated).toBe(2)
      expect((await cache.get('sip:noir:a')).hit).toBe(false)
      expect((await cache.get('sip:noir:b')).hit).toBe(false)
      expect((await cache.get('sip:halo2:c')).hit).toBe(true)
    })

    it('should invalidate by LRU', async () => {
      await cache.set('key1', createMockProof('1'))
      await cache.set('key2', createMockProof('2'))
      await cache.set('key3', createMockProof('3'))
      await cache.set('key4', createMockProof('4'))

      // Make key4 most recent
      await cache.get('key4')

      const invalidated = await cache.invalidate([
        { id: 'lru', strategy: 'lru', priority: 1 },
      ])

      expect(invalidated).toBe(2) // Half of 4
    })
  })

  describe('warm', () => {
    it('should warm cache with generated values', async () => {
      const generator = vi.fn(async (key: CacheKeyComponents) => {
        return createMockProof(key.circuitId)
      })

      cache.startWarming({ ...DEFAULT_WARMING_CONFIG, enabled: true }, generator)

      const result = await cache.warm([
        { system: 'noir', circuitId: 'a', privateInputsHash: 'h1', publicInputsHash: 'h2' },
        { system: 'noir', circuitId: 'b', privateInputsHash: 'h3', publicInputsHash: 'h4' },
      ])

      expect(result.warmed).toBe(2)
      expect(result.failed).toBe(0)
      expect(generator).toHaveBeenCalledTimes(2)

      cache.stopWarming()
    })
  })

  describe('getStats', () => {
    it('should return combined statistics', async () => {
      await cache.set('key', createMockProof('stats'))
      await cache.get('key')

      const stats = cache.getStats()
      expect(stats.totalLookups).toBeGreaterThan(0)
      expect(stats.hits).toBeGreaterThan(0)
    })
  })
})

describe('createMultiTierCache', () => {
  it('should create a multi-tier cache', async () => {
    const cache = createMultiTierCache()
    expect(cache).toBeInstanceOf(MultiTierCache)
    await cache.dispose()
  })
})

// ─── Default Configuration Tests ─────────────────────────────────────────────

describe('Default Configurations', () => {
  it('should have valid DEFAULT_LRU_CONFIG', () => {
    expect(DEFAULT_LRU_CONFIG.maxEntries).toBe(1000)
    expect(DEFAULT_LRU_CONFIG.maxSizeBytes).toBe(100 * 1024 * 1024)
    expect(DEFAULT_LRU_CONFIG.trackAccess).toBe(true)
  })

  it('should have valid DEFAULT_MULTI_TIER_CONFIG', () => {
    expect(DEFAULT_MULTI_TIER_CONFIG.memory).toBeDefined()
    expect(DEFAULT_MULTI_TIER_CONFIG.writeThrough).toBe(true)
    expect(DEFAULT_MULTI_TIER_CONFIG.readThrough).toBe(true)
  })

  it('should have valid DEFAULT_WARMING_CONFIG', () => {
    expect(DEFAULT_WARMING_CONFIG.enabled).toBe(false)
    expect(DEFAULT_WARMING_CONFIG.predictionModel).toBe('frequent')
  })

  it('should have valid INITIAL_PROOF_CACHE_STATS', () => {
    expect(INITIAL_PROOF_CACHE_STATS.totalLookups).toBe(0)
    expect(INITIAL_PROOF_CACHE_STATS.hits).toBe(0)
    expect(INITIAL_PROOF_CACHE_STATS.misses).toBe(0)
    expect(INITIAL_PROOF_CACHE_STATS.hitRate).toBe(0)
  })
})
