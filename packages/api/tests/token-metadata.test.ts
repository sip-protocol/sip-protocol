import { describe, it, expect } from 'vitest'
import { getTokenMetadata, getTokenDecimals, isKnownToken } from '../src/services/token-metadata'

describe('Token Metadata Service', () => {
  describe('getTokenDecimals', () => {
    it('should return correct decimals for SOL', () => {
      expect(getTokenDecimals('solana', 'SOL')).toBe(9)
    })

    it('should return correct decimals for USDC on Solana (6 decimals)', () => {
      expect(getTokenDecimals('solana', 'USDC')).toBe(6)
    })

    it('should return correct decimals for ETH (18 decimals)', () => {
      expect(getTokenDecimals('ethereum', 'ETH')).toBe(18)
    })

    it('should return correct decimals for WBTC (8 decimals)', () => {
      expect(getTokenDecimals('ethereum', 'WBTC')).toBe(8)
    })

    it('should return correct decimals for NEAR (24 decimals)', () => {
      expect(getTokenDecimals('near', 'NEAR')).toBe(24)
    })

    it('should return correct decimals for BTC (8 decimals)', () => {
      expect(getTokenDecimals('bitcoin', 'BTC')).toBe(8)
    })

    it('should be case-insensitive for token symbol', () => {
      expect(getTokenDecimals('solana', 'sol')).toBe(9)
      expect(getTokenDecimals('solana', 'Sol')).toBe(9)
      expect(getTokenDecimals('ethereum', 'eth')).toBe(18)
    })

    it('should throw for unknown token', () => {
      expect(() => getTokenDecimals('solana', 'UNKNOWN')).toThrow('Unknown token UNKNOWN on solana')
    })

    it('should throw for unknown chain', () => {
      expect(() => getTokenDecimals('unknown-chain' as any, 'SOL')).toThrow('Unknown chain: unknown-chain')
    })
  })

  describe('getTokenMetadata', () => {
    it('should return full metadata for known tokens', () => {
      const meta = getTokenMetadata('solana', 'USDC')
      expect(meta.symbol).toBe('USDC')
      expect(meta.decimals).toBe(6)
      expect(meta.name).toBe('USD Coin')
      expect(meta.address).toBeDefined()
    })

    it('should return address for contract tokens', () => {
      const meta = getTokenMetadata('ethereum', 'USDC')
      expect(meta.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    })

    it('should not have address for native tokens', () => {
      const meta = getTokenMetadata('solana', 'SOL')
      expect(meta.address).toBeUndefined()
    })
  })

  describe('isKnownToken', () => {
    it('should return true for known tokens', () => {
      expect(isKnownToken('solana', 'SOL')).toBe(true)
      expect(isKnownToken('ethereum', 'ETH')).toBe(true)
      expect(isKnownToken('near', 'NEAR')).toBe(true)
    })

    it('should return false for unknown tokens', () => {
      expect(isKnownToken('solana', 'UNKNOWN')).toBe(false)
    })

    it('should return false for unknown chains', () => {
      expect(isKnownToken('unknown-chain' as any, 'SOL')).toBe(false)
    })
  })

  describe('decimal values prevent financial errors', () => {
    // These tests verify that we don't silently use wrong decimals
    // which could cause orders of magnitude errors in financial calculations

    it('should NOT return 9 decimals for USDC (common mistake)', () => {
      // USDC has 6 decimals, not 9 like SOL
      expect(getTokenDecimals('solana', 'USDC')).not.toBe(9)
      expect(getTokenDecimals('ethereum', 'USDC')).not.toBe(9)
    })

    it('should NOT return 18 decimals for WBTC (common mistake)', () => {
      // WBTC has 8 decimals (like BTC), not 18 like ETH
      expect(getTokenDecimals('ethereum', 'WBTC')).not.toBe(18)
    })

    it('USDC should have same decimals across chains', () => {
      // USDC is always 6 decimals regardless of chain
      expect(getTokenDecimals('solana', 'USDC')).toBe(6)
      expect(getTokenDecimals('ethereum', 'USDC')).toBe(6)
      expect(getTokenDecimals('near', 'USDC')).toBe(6)
    })
  })
})
