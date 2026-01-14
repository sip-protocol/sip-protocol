/**
 * LRU Cache Tests
 *
 * Tests for the LRU (Least Recently Used) cache implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LRUCache,
  DEFAULT_CACHE_SIZES,
  DEFAULT_CACHE_TTL,
} from '../../src/privacy-backends/lru-cache'

describe('LRUCache', () => {
  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.set('b', 2)

      expect(cache.get('a')).toBe(1)
      expect(cache.get('b')).toBe(2)
    })

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should overwrite existing values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.set('a', 2)

      expect(cache.get('a')).toBe(2)
      expect(cache.size).toBe(1)
    })

    it('should delete values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      expect(cache.delete('a')).toBe(true)
      expect(cache.get('a')).toBeUndefined()
    })

    it('should return false when deleting non-existent key', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      expect(cache.delete('nonexistent')).toBe(false)
    })

    it('should clear all values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    it('should check if key exists with has()', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4) // Should evict 'a'

      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
      expect(cache.size).toBe(3)
    })

    it('should move accessed entry to end (most recently used)', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      // Access 'a' to move it to the end
      cache.get('a')

      // Now 'b' is the oldest
      cache.set('d', 4) // Should evict 'b'

      expect(cache.get('a')).toBe(1)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })

    it('should move updated entry to end', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      // Update 'a' to move it to the end
      cache.set('a', 10)

      // Now 'b' is the oldest
      cache.set('d', 4) // Should evict 'b'

      expect(cache.get('a')).toBe(10)
      expect(cache.get('b')).toBeUndefined()
    })

    it('should evict multiple entries if needed', () => {
      const cache = new LRUCache<string, number>({ maxSize: 2 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3) // Evicts 'a'

      expect(cache.size).toBe(2)
      expect(cache.get('a')).toBeUndefined()
    })
  })

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should expire entries after TTL', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 1000, // 1 second
      })

      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)

      // Advance time past TTL
      vi.advanceTimersByTime(1001)

      expect(cache.get('a')).toBeUndefined()
    })

    it('should not expire entries before TTL', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 1000,
      })

      cache.set('a', 1)

      // Advance time but not past TTL
      vi.advanceTimersByTime(500)

      expect(cache.get('a')).toBe(1)
    })

    it('should report expired entries as not existing via has()', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 1000,
      })

      cache.set('a', 1)
      expect(cache.has('a')).toBe(true)

      vi.advanceTimersByTime(1001)

      expect(cache.has('a')).toBe(false)
    })

    it('should prune expired entries', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 1000,
      })

      cache.set('a', 1)
      cache.set('b', 2)

      vi.advanceTimersByTime(500)
      cache.set('c', 3) // Added later, not expired yet

      vi.advanceTimersByTime(600) // a and b are now expired, c is not

      const pruned = cache.prune()

      expect(pruned).toBe(2)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
    })
  })

  describe('onEvict callback', () => {
    it('should call onEvict when entry is evicted', () => {
      const onEvict = vi.fn()
      const cache = new LRUCache<string, number>({
        maxSize: 2,
        onEvict,
      })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3) // Evicts 'a'

      expect(onEvict).toHaveBeenCalledWith('a', 1)
    })

    it('should call onEvict when entry is deleted', () => {
      const onEvict = vi.fn()
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        onEvict,
      })

      cache.set('a', 1)
      cache.delete('a')

      expect(onEvict).toHaveBeenCalledWith('a', 1)
    })

    it('should call onEvict for all entries when cleared', () => {
      const onEvict = vi.fn()
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        onEvict,
      })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()

      expect(onEvict).toHaveBeenCalledTimes(2)
      expect(onEvict).toHaveBeenCalledWith('a', 1)
      expect(onEvict).toHaveBeenCalledWith('b', 2)
    })
  })

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.get('a') // Hit
      cache.get('a') // Hit
      cache.get('b') // Miss
      cache.get('c') // Miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
      expect(stats.hitRate).toBe(50)
    })

    it('should track evictions', () => {
      const cache = new LRUCache<string, number>({ maxSize: 2 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3) // Evicts 'a'
      cache.set('d', 4) // Evicts 'b'

      const stats = cache.getStats()
      expect(stats.evictions).toBe(2)
    })

    it('should reset statistics', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.get('a')
      cache.get('b')

      cache.resetStats()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
    })

    it('should report correct size and maxSize', () => {
      const cache = new LRUCache<string, number>({ maxSize: 100 })

      cache.set('a', 1)
      cache.set('b', 2)

      const stats = cache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(100)
    })

    it('should handle hit rate when no accesses', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('iteration', () => {
    it('should iterate keys in LRU order (oldest first)', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      const keys = Array.from(cache.keys())
      expect(keys).toEqual(['a', 'b', 'c'])
    })

    it('should return values in LRU order', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 })

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      expect(cache.values()).toEqual([1, 2, 3])
    })
  })

  describe('edge cases', () => {
    it('should throw when maxSize is less than 1', () => {
      expect(() => new LRUCache<string, number>({ maxSize: 0 })).toThrow('maxSize must be at least 1')
      expect(() => new LRUCache<string, number>({ maxSize: -1 })).toThrow('maxSize must be at least 1')
    })

    it('should work with maxSize of 1', () => {
      const cache = new LRUCache<string, number>({ maxSize: 1 })

      cache.set('a', 1)
      cache.set('b', 2) // Evicts 'a'

      expect(cache.size).toBe(1)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
    })

    it('should handle complex object values', () => {
      interface User {
        id: number
        name: string
      }

      const cache = new LRUCache<string, User>({ maxSize: 10 })

      const user = { id: 1, name: 'Alice' }
      cache.set('user:1', user)

      expect(cache.get('user:1')).toEqual({ id: 1, name: 'Alice' })
    })

    it('should use default maxSize when not specified', () => {
      const cache = new LRUCache<string, number>()

      const stats = cache.getStats()
      expect(stats.maxSize).toBe(1000)
    })
  })

  describe('default cache sizes', () => {
    it('should define reasonable defaults', () => {
      expect(DEFAULT_CACHE_SIZES.TOKEN_ACCOUNTS).toBe(1000)
      expect(DEFAULT_CACHE_SIZES.BALANCES).toBe(500)
      expect(DEFAULT_CACHE_SIZES.COMPUTATIONS).toBe(100)
      expect(DEFAULT_CACHE_SIZES.POOLS).toBe(50)
    })

    it('should define reasonable TTL values', () => {
      expect(DEFAULT_CACHE_TTL.TOKEN_ACCOUNTS).toBe(5 * 60 * 1000) // 5 minutes
      expect(DEFAULT_CACHE_TTL.BALANCES).toBe(30 * 1000) // 30 seconds
      expect(DEFAULT_CACHE_TTL.COMPUTATIONS).toBe(10 * 60 * 1000) // 10 minutes
      expect(DEFAULT_CACHE_TTL.POOLS).toBe(60 * 1000) // 1 minute
    })
  })
})
