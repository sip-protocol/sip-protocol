/**
 * Circuit Breaker Tests
 *
 * Tests for the circuit breaker pattern implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker, type CircuitState, type CircuitBreakerStatus } from '../../src/settlement/router'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeMs: 100, // Short for tests
      successThreshold: 1,
    })
  })

  describe('initial state', () => {
    it('should start with all circuits CLOSED', () => {
      expect(breaker.getState('test-backend')).toBe('CLOSED')
    })

    it('should allow requests when CLOSED', () => {
      expect(breaker.canRequest('test-backend')).toBe(true)
    })

    it('should report circuit as not open when CLOSED', () => {
      expect(breaker.isOpen('test-backend')).toBe(false)
    })
  })

  describe('failure tracking', () => {
    it('should remain CLOSED under threshold', () => {
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')

      expect(breaker.getState('test-backend')).toBe('CLOSED')
      expect(breaker.canRequest('test-backend')).toBe(true)
    })

    it('should open after reaching failure threshold', () => {
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')

      expect(breaker.getState('test-backend')).toBe('OPEN')
      expect(breaker.canRequest('test-backend')).toBe(false)
      expect(breaker.isOpen('test-backend')).toBe(true)
    })

    it('should track error messages', () => {
      breaker.recordFailure('test-backend', 'Connection timeout')

      const status = breaker.getStatusPublic('test-backend')
      expect(status.lastError).toBe('Connection timeout')
    })
  })

  describe('success tracking', () => {
    it('should reset consecutive failures on success', () => {
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      breaker.recordSuccess('test-backend')

      const status = breaker.getStatusPublic('test-backend')
      expect(status.consecutiveFailures).toBe(0)
      expect(breaker.getState('test-backend')).toBe('CLOSED')
    })

    it('should track total successes', () => {
      breaker.recordSuccess('test-backend')
      breaker.recordSuccess('test-backend')
      breaker.recordSuccess('test-backend')

      const status = breaker.getStatusPublic('test-backend')
      expect(status.totalSuccesses).toBe(3)
    })
  })

  describe('OPEN to HALF_OPEN transition', () => {
    it('should transition to HALF_OPEN after reset time', async () => {
      // Open the circuit
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      expect(breaker.getState('test-backend')).toBe('OPEN')

      // Wait for reset time
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should now be HALF_OPEN when checking
      expect(breaker.canRequest('test-backend')).toBe(true)
      expect(breaker.getState('test-backend')).toBe('HALF_OPEN')
    })
  })

  describe('HALF_OPEN behavior', () => {
    beforeEach(async () => {
      // Open the circuit
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')

      // Wait for reset time
      await new Promise(resolve => setTimeout(resolve, 150))

      // Trigger transition to HALF_OPEN
      breaker.canRequest('test-backend')
    })

    it('should close on success in HALF_OPEN', () => {
      expect(breaker.getState('test-backend')).toBe('HALF_OPEN')

      breaker.recordSuccess('test-backend')

      expect(breaker.getState('test-backend')).toBe('CLOSED')
    })

    it('should re-open on failure in HALF_OPEN', () => {
      expect(breaker.getState('test-backend')).toBe('HALF_OPEN')

      breaker.recordFailure('test-backend')

      expect(breaker.getState('test-backend')).toBe('OPEN')
    })
  })

  describe('events', () => {
    it('should emit onOpen event', () => {
      const onOpen = vi.fn()
      const breakerWithEvents = new CircuitBreaker({
        failureThreshold: 2,
        events: { onOpen },
      })

      breakerWithEvents.recordFailure('test')
      expect(onOpen).not.toHaveBeenCalled()

      breakerWithEvents.recordFailure('test')
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onOpen).toHaveBeenCalledWith('test', expect.objectContaining({
        state: 'OPEN',
      }))
    })

    it('should emit onClose event', () => {
      const onClose = vi.fn()
      const breakerWithEvents = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeMs: 10,
        events: { onClose },
      })

      // Open then close
      breakerWithEvents.recordFailure('test')
      breakerWithEvents.recordFailure('test')
      breakerWithEvents.recordSuccess('test') // Should close

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should emit onStateChange for all transitions', () => {
      const onStateChange = vi.fn()
      const breakerWithEvents = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeMs: 10,
        events: { onStateChange },
      })

      breakerWithEvents.recordFailure('test')
      breakerWithEvents.recordFailure('test') // CLOSED -> OPEN

      expect(onStateChange).toHaveBeenCalledWith(
        'test',
        'CLOSED',
        'OPEN',
        expect.any(Object)
      )
    })
  })

  describe('multiple backends', () => {
    it('should track backends independently', () => {
      breaker.recordFailure('backend-a')
      breaker.recordFailure('backend-a')
      breaker.recordFailure('backend-a')

      breaker.recordSuccess('backend-b')

      expect(breaker.getState('backend-a')).toBe('OPEN')
      expect(breaker.getState('backend-b')).toBe('CLOSED')
    })
  })

  describe('getAllStatuses', () => {
    it('should return all backend statuses', () => {
      breaker.recordSuccess('backend-a')
      breaker.recordFailure('backend-b')
      breaker.recordFailure('backend-b')
      breaker.recordFailure('backend-b')

      const statuses = breaker.getAllStatuses()

      expect(statuses.size).toBe(2)
      expect(statuses.get('backend-a')?.state).toBe('CLOSED')
      expect(statuses.get('backend-b')?.state).toBe('OPEN')
    })
  })

  describe('getHealthSummary', () => {
    it('should summarize all circuit states', () => {
      breaker.recordSuccess('healthy-1')
      breaker.recordSuccess('healthy-2')
      breaker.recordFailure('failing')
      breaker.recordFailure('failing')
      breaker.recordFailure('failing')

      const summary = breaker.getHealthSummary()

      expect(summary.total).toBe(3)
      expect(summary.closed).toBe(2)
      expect(summary.open).toBe(1)
      expect(summary.halfOpen).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset single backend', () => {
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      breaker.recordFailure('test-backend')
      expect(breaker.getState('test-backend')).toBe('OPEN')

      breaker.reset('test-backend')

      expect(breaker.getState('test-backend')).toBe('CLOSED')
    })

    it('should reset all backends', () => {
      breaker.recordFailure('a')
      breaker.recordFailure('a')
      breaker.recordFailure('a')
      breaker.recordFailure('b')
      breaker.recordFailure('b')
      breaker.recordFailure('b')

      breaker.resetAll()

      expect(breaker.getState('a')).toBe('CLOSED')
      expect(breaker.getState('b')).toBe('CLOSED')
    })
  })
})
