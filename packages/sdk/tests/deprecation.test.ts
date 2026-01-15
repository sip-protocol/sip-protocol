/**
 * Deprecation Utility Tests
 *
 * Note: Deprecation warnings now use pino logger (structured JSON),
 * so we test the internal state tracking instead of console.warn.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { warnOnce, deprecationMessage, _resetWarnings, _hasWarned } from '../src/utils/deprecation'

describe('Deprecation Utility', () => {
  beforeEach(() => {
    _resetWarnings()
  })

  describe('warnOnce', () => {
    it('should mark warning as shown on first call', () => {
      // With pino logger, warnings are structured JSON and may be silent in tests
      // We test the internal state tracking instead of console.warn
      expect(_hasWarned('testFunc')).toBe(false)

      warnOnce('testFunc', 'This is a test warning')

      expect(_hasWarned('testFunc')).toBe(true)
    })

    it('should NOT mark as warned again on subsequent calls with same ID', () => {
      warnOnce('testFunc', 'Warning 1')
      expect(_hasWarned('testFunc')).toBe(true)

      // Subsequent calls should not throw or change state
      warnOnce('testFunc', 'Warning 2')
      warnOnce('testFunc', 'Warning 3')

      expect(_hasWarned('testFunc')).toBe(true)
    })

    it('should track warnings for different IDs', () => {
      warnOnce('func1', 'Warning for func1')
      warnOnce('func2', 'Warning for func2')

      expect(_hasWarned('func1')).toBe(true)
      expect(_hasWarned('func2')).toBe(true)
    })

    it('should track warned state correctly', () => {
      expect(_hasWarned('myFunc')).toBe(false)

      warnOnce('myFunc', 'Test')

      expect(_hasWarned('myFunc')).toBe(true)
    })
  })

  describe('deprecationMessage', () => {
    it('should format message with default removal date', () => {
      const msg = deprecationMessage('oldFunction()', 'newFunction()')

      expect(msg).toBe(
        'oldFunction() is deprecated and will be removed after 2026-06-01. Use newFunction() instead.'
      )
    })

    it('should format message with custom removal date', () => {
      const msg = deprecationMessage('legacyAPI()', 'modernAPI()', '2026-12-31')

      expect(msg).toBe(
        'legacyAPI() is deprecated and will be removed after 2026-12-31. Use modernAPI() instead.'
      )
    })
  })

  describe('_resetWarnings', () => {
    it('should clear all warning state', () => {
      warnOnce('func1', 'Warning 1')
      warnOnce('func2', 'Warning 2')

      expect(_hasWarned('func1')).toBe(true)
      expect(_hasWarned('func2')).toBe(true)

      _resetWarnings()

      expect(_hasWarned('func1')).toBe(false)
      expect(_hasWarned('func2')).toBe(false)
    })

    it('should allow warnings to fire again after reset', () => {
      warnOnce('testFunc', 'First warning')
      expect(_hasWarned('testFunc')).toBe(true)

      _resetWarnings()
      expect(_hasWarned('testFunc')).toBe(false)

      warnOnce('testFunc', 'Second warning')
      expect(_hasWarned('testFunc')).toBe(true)
    })
  })

  describe('environment variable suppression', () => {
    it('should respect SIP_SUPPRESS_DEPRECATION env var', () => {
      // Save original
      const originalEnv = process.env.SIP_SUPPRESS_DEPRECATION

      // Enable suppression
      process.env.SIP_SUPPRESS_DEPRECATION = 'true'
      _resetWarnings()

      warnOnce('suppressedFunc', 'This should not appear')

      // When suppressed, the warning should NOT be tracked as shown
      // The warnOnce function returns early before tracking
      expect(_hasWarned('suppressedFunc')).toBe(false)

      // Restore
      if (originalEnv === undefined) {
        delete process.env.SIP_SUPPRESS_DEPRECATION
      } else {
        process.env.SIP_SUPPRESS_DEPRECATION = originalEnv
      }
    })
  })
})

describe('Deprecated Functions Integration', () => {
  beforeEach(() => {
    _resetWarnings()
  })

  it('createCommitment should mark deprecation warning as shown', async () => {
    const { createCommitment } = await import('../src/crypto')

    // Call multiple times
    createCommitment(100n)
    createCommitment(200n)
    createCommitment(300n)

    // Check that the warning was tracked (via the internal deprecation ID)
    expect(_hasWarned('createCommitment')).toBe(true)
  })

  it('verifyCommitment should mark deprecation warning as shown', async () => {
    const { createCommitment, verifyCommitment } = await import('../src/crypto')

    // Create a commitment first
    const commitment = createCommitment(100n)

    // Reset to only track verifyCommitment warnings
    _resetWarnings()

    // Call verifyCommitment multiple times
    verifyCommitment(commitment, 100n)
    verifyCommitment(commitment, 100n)
    verifyCommitment(commitment, 100n)

    // Check that the warning was tracked
    expect(_hasWarned('verifyCommitment')).toBe(true)
  })
})
