/**
 * CLI Utils Tests
 *
 * Tests for CLI utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatAmount, formatHash } from '../src/utils/output'

describe('CLI Utils', () => {
  describe('formatAmount', () => {
    it('should format amount with default 18 decimals', () => {
      const amount = 1000000000000000000n // 1 token
      expect(formatAmount(amount)).toBe('1.000000')
    })

    it('should format amount with custom decimals', () => {
      const amount = 1000000n // 1 USDC (6 decimals)
      expect(formatAmount(amount, 6)).toBe('1.000000')
    })

    it('should handle zero amount', () => {
      expect(formatAmount(0n)).toBe('0.000000')
    })

    it('should handle fractional amounts', () => {
      const amount = 1500000000000000000n // 1.5 tokens
      expect(formatAmount(amount)).toBe('1.500000')
    })

    it('should handle very small amounts', () => {
      const amount = 1n // smallest unit
      expect(formatAmount(amount)).toBe('0.000000')
    })

    it('should handle large amounts', () => {
      const amount = 1000000000000000000000n // 1000 tokens
      expect(formatAmount(amount)).toBe('1000.000000')
    })
  })

  describe('formatHash', () => {
    it('should truncate long hashes', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const formatted = formatHash(hash)
      expect(formatted).toBe('0x123456...90abcdef')
    })

    it('should return short hashes unchanged', () => {
      const hash = '0x1234'
      expect(formatHash(hash)).toBe('0x1234')
    })

    it('should handle custom length', () => {
      const hash = '0x1234567890abcdef1234567890abcdef'
      const formatted = formatHash(hash, 4)
      expect(formatted).toBe('0x12...cdef')
    })

    it('should handle empty string', () => {
      expect(formatHash('')).toBe('')
    })
  })
})
