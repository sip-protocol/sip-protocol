/**
 * Deprecation Utility Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { warnOnce, deprecationMessage, _resetWarnings, _hasWarned } from '../src/utils/deprecation'

describe('Deprecation Utility', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    _resetWarnings()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('warnOnce', () => {
    it('should log warning on first call', () => {
      warnOnce('testFunc', 'This is a test warning')

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith('[SIP-SDK] DEPRECATION: This is a test warning')
    })

    it('should NOT log warning on subsequent calls with same ID', () => {
      warnOnce('testFunc', 'Warning 1')
      warnOnce('testFunc', 'Warning 2')
      warnOnce('testFunc', 'Warning 3')

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    })

    it('should log warning for different IDs', () => {
      warnOnce('func1', 'Warning for func1')
      warnOnce('func2', 'Warning for func2')

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
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
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

      _resetWarnings()

      warnOnce('testFunc', 'Second warning')
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
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

      expect(consoleWarnSpy).not.toHaveBeenCalled()

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
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    _resetWarnings()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('createCommitment should warn only once', async () => {
    const { createCommitment } = await import('../src/crypto')

    // Call multiple times
    createCommitment(100n)
    createCommitment(200n)
    createCommitment(300n)

    // Should only have warned once
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('createCommitment()')
    )
  })

  it('verifyCommitment should warn only once', async () => {
    const { createCommitment, verifyCommitment } = await import('../src/crypto')

    // Create a commitment first
    const commitment = createCommitment(100n)

    // Reset to only track verifyCommitment warnings
    consoleWarnSpy.mockClear()
    _resetWarnings()

    // Call verifyCommitment multiple times
    verifyCommitment(commitment, 100n)
    verifyCommitment(commitment, 100n)
    verifyCommitment(commitment, 100n)

    // Should only have warned once for verifyCommitment
    const verifyWarnings = consoleWarnSpy.mock.calls.filter(
      call => call[0]?.includes('verifyCommitment()')
    )
    expect(verifyWarnings.length).toBe(1)
  })
})
