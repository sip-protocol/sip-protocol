/**
 * BackendHealthTracker Tests
 *
 * Tests for circuit breaker pattern and metrics tracking.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { BackendHealthTracker } from '../../src/privacy-backends/health'

describe('BackendHealthTracker', () => {
  let tracker: BackendHealthTracker

  beforeEach(() => {
    tracker = new BackendHealthTracker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should use default config', () => {
      const config = tracker.getConfig()
      expect(config.failureThreshold).toBe(3)
      expect(config.resetTimeoutMs).toBe(30000)
      expect(config.successThreshold).toBe(2)
      expect(config.enableMetrics).toBe(true)
    })

    it('should accept custom config', () => {
      const customTracker = new BackendHealthTracker({
        failureThreshold: 5,
        resetTimeoutMs: 60000,
      })
      const config = customTracker.getConfig()
      expect(config.failureThreshold).toBe(5)
      expect(config.resetTimeoutMs).toBe(60000)
    })
  })

  describe('register/unregister', () => {
    it('should register backend on first access', () => {
      expect(tracker.isTracked('test')).toBe(false)
      tracker.register('test')
      expect(tracker.isTracked('test')).toBe(true)
    })

    it('should unregister backend', () => {
      tracker.register('test')
      expect(tracker.unregister('test')).toBe(true)
      expect(tracker.isTracked('test')).toBe(false)
    })

    it('should return false when unregistering unknown backend', () => {
      expect(tracker.unregister('unknown')).toBe(false)
    })
  })

  describe('recordSuccess', () => {
    it('should update health state on success', () => {
      tracker.recordSuccess('test', 100)

      const health = tracker.getHealth('test')
      expect(health).toBeDefined()
      expect(health!.circuitState).toBe('closed')
      expect(health!.isHealthy).toBe(true)
      expect(health!.consecutiveFailures).toBe(0)
      expect(health!.consecutiveSuccesses).toBe(1)
    })

    it('should update metrics on success', () => {
      tracker.recordSuccess('test', 100)
      tracker.recordSuccess('test', 200)

      const metrics = tracker.getMetrics('test')
      expect(metrics).toBeDefined()
      expect(metrics!.totalRequests).toBe(2)
      expect(metrics!.successfulRequests).toBe(2)
      expect(metrics!.failedRequests).toBe(0)
      expect(metrics!.averageLatencyMs).toBe(150)
      expect(metrics!.minLatencyMs).toBe(100)
      expect(metrics!.maxLatencyMs).toBe(200)
    })

    it('should reset consecutive failures on success', () => {
      tracker.recordFailure('test', 'error')
      tracker.recordFailure('test', 'error')
      tracker.recordSuccess('test', 100)

      const health = tracker.getHealth('test')
      expect(health!.consecutiveFailures).toBe(0)
      expect(health!.consecutiveSuccesses).toBe(1)
    })
  })

  describe('recordFailure', () => {
    it('should update health state on failure', () => {
      tracker.recordFailure('test', 'Connection timeout')

      const health = tracker.getHealth('test')
      expect(health).toBeDefined()
      expect(health!.consecutiveFailures).toBe(1)
      expect(health!.consecutiveSuccesses).toBe(0)
      expect(health!.lastFailureReason).toBe('Connection timeout')
    })

    it('should update metrics on failure', () => {
      tracker.recordFailure('test', 'error')

      const metrics = tracker.getMetrics('test')
      expect(metrics!.totalRequests).toBe(1)
      expect(metrics!.failedRequests).toBe(1)
      expect(metrics!.successfulRequests).toBe(0)
    })

    it('should reset consecutive successes on failure', () => {
      tracker.recordSuccess('test', 100)
      tracker.recordSuccess('test', 100)
      tracker.recordFailure('test', 'error')

      const health = tracker.getHealth('test')
      expect(health!.consecutiveSuccesses).toBe(0)
      expect(health!.consecutiveFailures).toBe(1)
    })
  })

  describe('circuit breaker states', () => {
    describe('closed → open transition', () => {
      it('should open circuit after threshold failures', () => {
        // Default threshold is 3
        tracker.recordFailure('test', 'error 1')
        expect(tracker.getCircuitState('test')).toBe('closed')

        tracker.recordFailure('test', 'error 2')
        expect(tracker.getCircuitState('test')).toBe('closed')

        tracker.recordFailure('test', 'error 3')
        expect(tracker.getCircuitState('test')).toBe('open')
        expect(tracker.isHealthy('test')).toBe(false)
        expect(tracker.isCircuitOpen('test')).toBe(true)
      })

      it('should respect custom failure threshold', () => {
        const customTracker = new BackendHealthTracker({ failureThreshold: 5 })

        for (let i = 0; i < 4; i++) {
          customTracker.recordFailure('test', `error ${i}`)
        }
        expect(customTracker.getCircuitState('test')).toBe('closed')

        customTracker.recordFailure('test', 'error 5')
        expect(customTracker.getCircuitState('test')).toBe('open')
      })
    })

    describe('open → half-open transition', () => {
      it('should transition to half-open after timeout', () => {
        // Open the circuit
        for (let i = 0; i < 3; i++) {
          tracker.recordFailure('test', 'error')
        }
        expect(tracker.getCircuitState('test')).toBe('open')
        expect(tracker.shouldAttempt('test')).toBe(false)

        // Advance time past reset timeout
        vi.advanceTimersByTime(30001)

        // shouldAttempt should trigger transition
        expect(tracker.shouldAttempt('test')).toBe(true)
        expect(tracker.getCircuitState('test')).toBe('half-open')
      })

      it('should not transition before timeout', () => {
        for (let i = 0; i < 3; i++) {
          tracker.recordFailure('test', 'error')
        }

        vi.advanceTimersByTime(29000)
        expect(tracker.shouldAttempt('test')).toBe(false)
        expect(tracker.getCircuitState('test')).toBe('open')
      })
    })

    describe('half-open → closed transition', () => {
      it('should close circuit after success threshold', () => {
        // Open circuit
        for (let i = 0; i < 3; i++) {
          tracker.recordFailure('test', 'error')
        }

        // Transition to half-open
        vi.advanceTimersByTime(30001)
        tracker.shouldAttempt('test')
        expect(tracker.getCircuitState('test')).toBe('half-open')

        // Record successes (default threshold is 2)
        tracker.recordSuccess('test', 100)
        expect(tracker.getCircuitState('test')).toBe('half-open')

        tracker.recordSuccess('test', 100)
        expect(tracker.getCircuitState('test')).toBe('closed')
        expect(tracker.isHealthy('test')).toBe(true)
      })
    })

    describe('half-open → open transition', () => {
      it('should reopen circuit on failure in half-open state', () => {
        // Open circuit
        for (let i = 0; i < 3; i++) {
          tracker.recordFailure('test', 'error')
        }

        // Transition to half-open
        vi.advanceTimersByTime(30001)
        tracker.shouldAttempt('test')
        expect(tracker.getCircuitState('test')).toBe('half-open')

        // Failure reopens circuit
        tracker.recordFailure('test', 'still broken')
        expect(tracker.getCircuitState('test')).toBe('open')
        expect(tracker.isHealthy('test')).toBe(false)
      })
    })
  })

  describe('shouldAttempt', () => {
    it('should return true for unknown backends', () => {
      expect(tracker.shouldAttempt('unknown')).toBe(true)
    })

    it('should return true when circuit is closed', () => {
      tracker.register('test')
      expect(tracker.shouldAttempt('test')).toBe(true)
    })

    it('should return false when circuit is open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('test', 'error')
      }
      expect(tracker.shouldAttempt('test')).toBe(false)
    })

    it('should return true when circuit is half-open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('test', 'error')
      }
      vi.advanceTimersByTime(30001)
      tracker.shouldAttempt('test') // Trigger transition
      expect(tracker.getCircuitState('test')).toBe('half-open')
      expect(tracker.shouldAttempt('test')).toBe(true)
    })
  })

  describe('isHealthy', () => {
    it('should return true for unknown backends', () => {
      expect(tracker.isHealthy('unknown')).toBe(true)
    })

    it('should return true when circuit is closed', () => {
      tracker.register('test')
      expect(tracker.isHealthy('test')).toBe(true)
    })

    it('should return false when circuit is open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('test', 'error')
      }
      expect(tracker.isHealthy('test')).toBe(false)
    })

    it('should return true when circuit is half-open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('test', 'error')
      }
      vi.advanceTimersByTime(30001)
      tracker.shouldAttempt('test')
      expect(tracker.isHealthy('test')).toBe(true)
    })
  })

  describe('manual controls', () => {
    describe('forceOpen', () => {
      it('should force circuit open', () => {
        tracker.register('test')
        tracker.forceOpen('test')

        expect(tracker.getCircuitState('test')).toBe('open')
        expect(tracker.isHealthy('test')).toBe(false)
        expect(tracker.getHealth('test')!.lastFailureReason).toBe('Manually opened')
      })
    })

    describe('forceClose', () => {
      it('should force circuit closed', () => {
        // Open circuit first
        for (let i = 0; i < 3; i++) {
          tracker.recordFailure('test', 'error')
        }
        expect(tracker.getCircuitState('test')).toBe('open')

        tracker.forceClose('test')

        expect(tracker.getCircuitState('test')).toBe('closed')
        expect(tracker.isHealthy('test')).toBe(true)
        expect(tracker.getHealth('test')!.consecutiveFailures).toBe(0)
      })
    })

    describe('reset', () => {
      it('should reset health and metrics', () => {
        tracker.recordSuccess('test', 100)
        tracker.recordFailure('test', 'error')

        tracker.reset('test')

        const health = tracker.getHealth('test')
        const metrics = tracker.getMetrics('test')

        expect(health!.consecutiveFailures).toBe(0)
        expect(health!.consecutiveSuccesses).toBe(0)
        expect(health!.circuitState).toBe('closed')
        expect(metrics!.totalRequests).toBe(0)
      })
    })
  })

  describe('getTimeUntilReset', () => {
    it('should return 0 for unknown backend', () => {
      expect(tracker.getTimeUntilReset('unknown')).toBe(0)
    })

    it('should return 0 when circuit is closed', () => {
      tracker.register('test')
      expect(tracker.getTimeUntilReset('test')).toBe(0)
    })

    it('should return remaining time when circuit is open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('test', 'error')
      }

      vi.advanceTimersByTime(10000)
      expect(tracker.getTimeUntilReset('test')).toBe(20000)

      vi.advanceTimersByTime(15000)
      expect(tracker.getTimeUntilReset('test')).toBe(5000)

      vi.advanceTimersByTime(5001)
      expect(tracker.getTimeUntilReset('test')).toBe(0)
    })
  })

  describe('getHealthSummary', () => {
    it('should return summary of all backends', () => {
      tracker.recordSuccess('healthy', 100)
      tracker.recordFailure('failing', 'error')
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('broken', 'error')
      }

      const summary = tracker.getHealthSummary()

      expect(summary.healthy.healthy).toBe(true)
      expect(summary.healthy.state).toBe('closed')
      expect(summary.healthy.failures).toBe(0)

      expect(summary.failing.healthy).toBe(true)
      expect(summary.failing.state).toBe('closed')
      expect(summary.failing.failures).toBe(1)
      expect(summary.failing.lastError).toBe('error')

      expect(summary.broken.healthy).toBe(false)
      expect(summary.broken.state).toBe('open')
      expect(summary.broken.failures).toBe(3)
    })
  })

  describe('getAllHealth / getAllMetrics', () => {
    it('should return copies of health/metrics maps', () => {
      tracker.recordSuccess('test1', 100)
      tracker.recordSuccess('test2', 200)

      const health = tracker.getAllHealth()
      const metrics = tracker.getAllMetrics()

      expect(health.size).toBe(2)
      expect(metrics.size).toBe(2)

      // Should be copies, not originals
      health.delete('test1')
      expect(tracker.getHealth('test1')).toBeDefined()
    })
  })

  describe('getTrackedBackends', () => {
    it('should return list of tracked backend names', () => {
      tracker.register('a')
      tracker.register('b')
      tracker.register('c')

      const backends = tracker.getTrackedBackends()
      expect(backends).toContain('a')
      expect(backends).toContain('b')
      expect(backends).toContain('c')
      expect(backends).toHaveLength(3)
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      tracker.updateConfig({ failureThreshold: 10 })
      expect(tracker.getConfig().failureThreshold).toBe(10)
      expect(tracker.getConfig().resetTimeoutMs).toBe(30000) // Unchanged
    })
  })

  describe('clear', () => {
    it('should clear all tracking data', () => {
      tracker.recordSuccess('test1', 100)
      tracker.recordSuccess('test2', 200)

      tracker.clear()

      expect(tracker.getTrackedBackends()).toHaveLength(0)
      expect(tracker.getHealth('test1')).toBeUndefined()
      expect(tracker.getMetrics('test1')).toBeUndefined()
    })
  })

  describe('metrics disabled', () => {
    it('should not track metrics when disabled', () => {
      const noMetrics = new BackendHealthTracker({ enableMetrics: false })

      noMetrics.recordSuccess('test', 100)

      expect(noMetrics.getMetrics('test')).toBeUndefined()
      expect(noMetrics.getHealth('test')).toBeDefined()
    })
  })
})
