/**
 * Rate Limiter Tests
 *
 * Tests for the token bucket rate limiter implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  RateLimitExceededError,
  QueueFullError,
  AcquireTimeoutError,
} from '../../src/privacy-backends/rate-limiter'

describe('RateLimiter', () => {
  describe('default configuration', () => {
    it('should have reasonable defaults', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.maxTokens).toBe(10)
      expect(DEFAULT_RATE_LIMIT_CONFIG.refillRate).toBe(1)
      expect(DEFAULT_RATE_LIMIT_CONFIG.refillIntervalMs).toBe(1000)
    })
  })

  describe('basic token acquisition', () => {
    it('should acquire tokens when available', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
    })

    it('should reject when no tokens available', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 },
      })

      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(false)
    })

    it('should acquire multiple tokens at once', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      expect(limiter.tryAcquire('backend-a', 3)).toBe(true)
      expect(limiter.tryAcquire('backend-a', 3)).toBe(false)
      expect(limiter.tryAcquire('backend-a', 2)).toBe(true)
    })

    it('should track separate buckets per backend', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Exhaust backend-a
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(false)

      // backend-b should still have tokens
      expect(limiter.tryAcquire('backend-b')).toBe(true)
      expect(limiter.tryAcquire('backend-b')).toBe(true)
    })
  })

  describe('canAcquire', () => {
    it('should check without consuming tokens', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 },
      })

      expect(limiter.canAcquire('backend-a')).toBe(true)
      expect(limiter.canAcquire('backend-a')).toBe(true) // Still true, not consumed

      limiter.tryAcquire('backend-a')
      limiter.tryAcquire('backend-a')

      expect(limiter.canAcquire('backend-a')).toBe(false)
    })

    it('should check for multiple tokens', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      expect(limiter.canAcquire('backend-a', 5)).toBe(true)
      expect(limiter.canAcquire('backend-a', 6)).toBe(false)
    })
  })

  describe('token refill', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should refill tokens over time', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire('backend-a')
      }
      expect(limiter.tryAcquire('backend-a')).toBe(false)

      // Advance time by 3 seconds (should refill 3 tokens)
      vi.advanceTimersByTime(3000)

      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(false)
    })

    it('should not exceed maxTokens on refill', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 3, refillRate: 5, refillIntervalMs: 1000 },
      })

      // Use 1 token
      limiter.tryAcquire('backend-a')

      // Advance time (would add 5 tokens but max is 3)
      vi.advanceTimersByTime(1000)

      // Should only have 3 tokens (capped)
      expect(limiter.tryAcquire('backend-a', 3)).toBe(true)
      expect(limiter.tryAcquire('backend-a')).toBe(false)
    })

    it('should handle multiple refill intervals', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 10, refillRate: 2, refillIntervalMs: 500 },
      })

      // Use all tokens
      limiter.tryAcquire('backend-a', 10)
      expect(limiter.canAcquire('backend-a')).toBe(false)

      // Advance 1250ms (2.5 intervals = 4 tokens added)
      vi.advanceTimersByTime(1250)

      expect(limiter.canAcquire('backend-a', 4)).toBe(true)
      expect(limiter.canAcquire('backend-a', 5)).toBe(false)
    })
  })

  describe('backend overrides', () => {
    it('should apply per-backend configuration', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 10, refillRate: 1, refillIntervalMs: 1000 },
        backendOverrides: {
          'slow-backend': { maxTokens: 2 },
        },
      })

      // Regular backend has 10 tokens
      expect(limiter.tryAcquire('regular', 10)).toBe(true)

      // Slow backend only has 2 tokens
      expect(limiter.tryAcquire('slow-backend', 2)).toBe(true)
      expect(limiter.tryAcquire('slow-backend')).toBe(false)
    })

    it('should allow runtime override changes', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Use some tokens
      limiter.tryAcquire('backend-a', 3)

      // Apply override
      limiter.setBackendConfig('backend-a', { maxTokens: 2 })

      // New config is applied (maxTokens reduced)
      const config = limiter.getBackendConfig('backend-a')
      expect(config.maxTokens).toBe(2)
    })

    it('should merge config overrides', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
        backendOverrides: {
          'backend-a': { maxTokens: 2 },
        },
      })

      // Apply additional override (should merge, not replace)
      limiter.setBackendConfig('backend-a', { refillRate: 5 })

      const config = limiter.getBackendConfig('backend-a')
      expect(config.maxTokens).toBe(2) // Original override preserved
      expect(config.refillRate).toBe(5) // New override applied
    })
  })

  describe('async acquire with queueing', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should acquire immediately when tokens available', async () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
        onLimitExceeded: 'queue',
      })

      await expect(limiter.acquire('backend-a')).resolves.toBeUndefined()
    })

    it('should throw RateLimitExceededError in reject mode', async () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
        onLimitExceeded: 'reject',
      })

      await limiter.acquire('backend-a')

      await expect(limiter.acquire('backend-a')).rejects.toThrow(RateLimitExceededError)
    })

    it('should wait for tokens in queue mode', async () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
        onLimitExceeded: 'queue',
      })

      // Exhaust tokens
      await limiter.acquire('backend-a')

      // Start async acquire (should queue)
      const acquirePromise = limiter.acquire('backend-a', { timeout: 5000 })

      // Advance time to refill
      vi.advanceTimersByTime(1100)

      await expect(acquirePromise).resolves.toBeUndefined()
    })

    it('should timeout in queue mode', async () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 10000 }, // Very slow refill
        onLimitExceeded: 'queue',
      })

      // Exhaust tokens
      await limiter.acquire('backend-a')

      // Try to acquire with short timeout
      const acquirePromise = limiter.acquire('backend-a', { timeout: 100 })

      vi.advanceTimersByTime(150)

      await expect(acquirePromise).rejects.toThrow(AcquireTimeoutError)
    })

    it('should enforce max queue size', async () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 10000 },
        onLimitExceeded: 'queue',
        maxQueueSize: 2,
      })

      // Exhaust tokens
      await limiter.acquire('backend-a')

      // Queue 2 requests
      const p1 = limiter.acquire('backend-a', { timeout: 10000 })
      const p2 = limiter.acquire('backend-a', { timeout: 10000 })

      // Third request should fail immediately
      await expect(limiter.acquire('backend-a', { timeout: 10000 })).rejects.toThrow(QueueFullError)

      // Clean up
      vi.advanceTimersByTime(20000)
      await Promise.allSettled([p1, p2])
    })
  })

  describe('statistics', () => {
    it('should track allowed requests', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      limiter.tryAcquire('backend-a')
      limiter.tryAcquire('backend-a')
      limiter.tryAcquire('backend-a')

      const stats = limiter.getStats('backend-a')
      expect(stats?.allowed).toBe(3)
      expect(stats?.tokensConsumed).toBe(3)
    })

    it('should track rejected requests', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
      })

      limiter.tryAcquire('backend-a') // Allowed
      limiter.tryAcquire('backend-a') // Rejected
      limiter.tryAcquire('backend-a') // Rejected

      const stats = limiter.getStats('backend-a')
      expect(stats?.allowed).toBe(1)
      expect(stats?.rejected).toBe(2)
    })

    it('should report all stats', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      limiter.tryAcquire('backend-a')
      limiter.tryAcquire('backend-b', 2)

      const allStats = limiter.getAllStats()
      expect(allStats.get('backend-a')).toBeDefined()
      expect(allStats.get('backend-b')).toBeDefined()
      expect(allStats.get('backend-b')?.tokensConsumed).toBe(2)
    })

    it('should create stats on demand for unknown backend', () => {
      const limiter = new RateLimiter()
      const stats = limiter.getStats('unknown')

      // Stats are created on demand with default config
      expect(stats).toBeDefined()
      expect(stats.name).toBe('unknown')
      expect(stats.allowed).toBe(0)
      expect(stats.rejected).toBe(0)
      expect(stats.tokensConsumed).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset bucket to full', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 3, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Exhaust tokens
      limiter.tryAcquire('backend-a', 3)
      expect(limiter.canAcquire('backend-a')).toBe(false)

      // Reset
      limiter.reset('backend-a')

      // Should have full tokens again
      expect(limiter.canAcquire('backend-a', 3)).toBe(true)
    })

    it('should reset stats', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      limiter.tryAcquire('backend-a')
      limiter.tryAcquire('backend-a')

      limiter.reset('backend-a')

      const stats = limiter.getStats('backend-a')
      expect(stats?.allowed).toBe(0)
      expect(stats?.rejected).toBe(0)
      expect(stats?.tokensConsumed).toBe(0)
    })

    it('should reset all backends', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 },
      })

      limiter.tryAcquire('backend-a', 2)
      limiter.tryAcquire('backend-b', 2)

      limiter.resetAll()

      expect(limiter.canAcquire('backend-a', 2)).toBe(true)
      expect(limiter.canAcquire('backend-b', 2)).toBe(true)
    })
  })

  describe('dispose', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should stop queue processing on dispose', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
        onLimitExceeded: 'queue',
      })

      // Just verify dispose doesn't throw
      expect(() => limiter.dispose()).not.toThrow()
    })

    it('should be safe to call dispose multiple times', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
        onLimitExceeded: 'queue',
      })

      limiter.dispose()
      expect(() => limiter.dispose()).not.toThrow()
    })
  })

  describe('error classes', () => {
    it('RateLimitExceededError should have correct properties', () => {
      const error = new RateLimitExceededError('backend-a', 0, 1, 1000)

      expect(error.name).toBe('RateLimitExceededError')
      expect(error.backend).toBe('backend-a')
      expect(error.availableTokens).toBe(0)
      expect(error.requestedTokens).toBe(1)
      expect(error.retryAfterMs).toBe(1000)
      expect(error.message).toContain('backend-a')
      expect(error.message).toContain('Retry after')
    })

    it('QueueFullError should have correct properties', () => {
      const error = new QueueFullError('backend-a', 10, 10)

      expect(error.name).toBe('QueueFullError')
      expect(error.backend).toBe('backend-a')
      expect(error.queueSize).toBe(10)
      expect(error.maxQueueSize).toBe(10)
    })

    it('AcquireTimeoutError should have correct properties', () => {
      const error = new AcquireTimeoutError('backend-a', 5000)

      expect(error.name).toBe('AcquireTimeoutError')
      expect(error.backend).toBe('backend-a')
      expect(error.timeoutMs).toBe(5000)
    })
  })

  describe('edge cases', () => {
    it('should handle zero tokens request', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Zero tokens should always succeed
      expect(limiter.tryAcquire('backend-a', 0)).toBe(true)
      expect(limiter.canAcquire('backend-a', 0)).toBe(true)
    })

    it('should handle request exceeding maxTokens', () => {
      const limiter = new RateLimiter({
        defaultConfig: { maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 },
      })

      // Request more than max should fail
      expect(limiter.tryAcquire('backend-a', 10)).toBe(false)
    })

    it('should use default config values', () => {
      const limiter = new RateLimiter()

      // Access bucket first
      limiter.tryAcquire('backend-a')

      const config = limiter.getBackendConfig('backend-a')
      expect(config.maxTokens).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxTokens)
      expect(config.refillRate).toBe(DEFAULT_RATE_LIMIT_CONFIG.refillRate)
      expect(config.refillIntervalMs).toBe(DEFAULT_RATE_LIMIT_CONFIG.refillIntervalMs)
    })
  })
})
