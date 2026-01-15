/**
 * Token Registry Tests
 *
 * Ensures correct decimals are returned for all supported tokens.
 * This prevents the critical bug of hardcoding decimals (e.g., always using 9).
 */

import { describe, it, expect } from 'vitest'
import {
  getTokenDecimals,
  getAsset,
  getNativeToken,
  getTokenByAddress,
  isKnownToken,
  getTokensForChain,
} from '../../src/tokens'
import { NATIVE_TOKENS } from '@sip-protocol/types'

describe('Token Registry', () => {
  describe('getTokenDecimals', () => {
    it('should return correct decimals for SOL', () => {
      expect(getTokenDecimals('SOL', 'solana')).toBe(9)
    })

    it('should return correct decimals for ETH', () => {
      expect(getTokenDecimals('ETH', 'ethereum')).toBe(18)
    })

    it('should return correct decimals for USDC on Solana (6, not 9!)', () => {
      // This is the critical bug fix - USDC has 6 decimals, not 9
      expect(getTokenDecimals('USDC', 'solana')).toBe(6)
    })

    it('should return correct decimals for USDC on Ethereum', () => {
      expect(getTokenDecimals('USDC', 'ethereum')).toBe(6)
    })

    it('should return correct decimals for DAI (18 decimals)', () => {
      expect(getTokenDecimals('DAI', 'ethereum')).toBe(18)
    })

    it('should return correct decimals for WBTC (8 decimals)', () => {
      expect(getTokenDecimals('WBTC', 'ethereum')).toBe(8)
    })

    it('should throw for unknown tokens', () => {
      expect(() => getTokenDecimals('UNKNOWN_TOKEN', 'solana')).toThrow()
    })

    it('should be case-insensitive', () => {
      expect(getTokenDecimals('sol', 'solana')).toBe(9)
      expect(getTokenDecimals('usdc', 'solana')).toBe(6)
    })
  })

  describe('getAsset', () => {
    it('should return full asset info for SOL', () => {
      const asset = getAsset('SOL', 'solana')
      expect(asset.chain).toBe('solana')
      expect(asset.symbol).toBe('SOL')
      expect(asset.address).toBeNull()
      expect(asset.decimals).toBe(9)
    })

    it('should return full asset info for USDC on Solana', () => {
      const asset = getAsset('USDC', 'solana')
      expect(asset.chain).toBe('solana')
      expect(asset.symbol).toBe('USDC')
      expect(asset.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      expect(asset.decimals).toBe(6)
    })

    it('should throw for unknown tokens', () => {
      expect(() => getAsset('FAKE', 'ethereum')).toThrow()
    })
  })

  describe('getNativeToken', () => {
    it('should return SOL for Solana', () => {
      const native = getNativeToken('solana')
      expect(native.symbol).toBe('SOL')
      expect(native.decimals).toBe(9)
    })

    it('should return ETH for Ethereum', () => {
      const native = getNativeToken('ethereum')
      expect(native.symbol).toBe('ETH')
      expect(native.decimals).toBe(18)
    })

    it('should return NEAR for NEAR', () => {
      const native = getNativeToken('near')
      expect(native.symbol).toBe('NEAR')
      expect(native.decimals).toBe(24)
    })

    it('should return correct decimals for all chains', () => {
      // Verify all native tokens have correct decimals
      const expectedDecimals: Record<string, number> = {
        solana: 9,
        ethereum: 18,
        near: 24,
        zcash: 8,
        polygon: 18,
        arbitrum: 18,
        optimism: 18,
        base: 18,
        bitcoin: 8,
        aptos: 8,
        sui: 9,
        cosmos: 6,
        osmosis: 6,
        injective: 18,
        celestia: 6,
        sei: 6,
        dydx: 18,
      }

      for (const [chain, expectedDec] of Object.entries(expectedDecimals)) {
        const native = getNativeToken(chain as keyof typeof NATIVE_TOKENS)
        expect(native.decimals).toBe(expectedDec)
      }
    })
  })

  describe('isKnownToken', () => {
    it('should return true for known tokens', () => {
      expect(isKnownToken('SOL', 'solana')).toBe(true)
      expect(isKnownToken('ETH', 'ethereum')).toBe(true)
      expect(isKnownToken('USDC', 'solana')).toBe(true)
    })

    it('should return false for unknown tokens', () => {
      expect(isKnownToken('FAKE', 'solana')).toBe(false)
      expect(isKnownToken('NOTREAL', 'ethereum')).toBe(false)
    })
  })

  describe('getTokenByAddress', () => {
    it('should find USDC by address on Solana', () => {
      const token = getTokenByAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana')
      expect(token).not.toBeNull()
      expect(token!.symbol).toBe('USDC')
      expect(token!.decimals).toBe(6)
    })

    it('should find USDC by address on Ethereum', () => {
      const token = getTokenByAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'ethereum')
      expect(token).not.toBeNull()
      expect(token!.symbol).toBe('USDC')
      expect(token!.decimals).toBe(6)
    })

    it('should return null for unknown address', () => {
      const token = getTokenByAddress('0x0000000000000000000000000000000000000000', 'ethereum')
      expect(token).toBeNull()
    })
  })

  describe('getTokensForChain', () => {
    it('should return all Solana tokens', () => {
      const tokens = getTokensForChain('solana')
      expect(tokens.length).toBeGreaterThan(1)
      expect(tokens.some(t => t.symbol === 'SOL')).toBe(true)
      expect(tokens.some(t => t.symbol === 'USDC')).toBe(true)
    })

    it('should return all Ethereum tokens', () => {
      const tokens = getTokensForChain('ethereum')
      expect(tokens.length).toBeGreaterThan(1)
      expect(tokens.some(t => t.symbol === 'ETH')).toBe(true)
      expect(tokens.some(t => t.symbol === 'USDC')).toBe(true)
    })

    it('should return at least native token for chains without extended registry', () => {
      const tokens = getTokensForChain('near')
      expect(tokens.length).toBeGreaterThanOrEqual(1)
      expect(tokens.some(t => t.symbol === 'NEAR')).toBe(true)
    })
  })

  describe('Critical: Decimal correctness', () => {
    // These tests ensure the critical bug (hardcoding 9) is never reintroduced
    it('USDC should NEVER have 9 decimals', () => {
      expect(getTokenDecimals('USDC', 'solana')).not.toBe(9)
      expect(getTokenDecimals('USDC', 'ethereum')).not.toBe(9)
    })

    it('USDT should NEVER have 9 decimals', () => {
      expect(getTokenDecimals('USDT', 'solana')).not.toBe(9)
      expect(getTokenDecimals('USDT', 'ethereum')).not.toBe(9)
    })

    it('DAI should have 18 decimals (not 9)', () => {
      expect(getTokenDecimals('DAI', 'ethereum')).toBe(18)
    })

    it('ETH should have 18 decimals (not 9)', () => {
      expect(getTokenDecimals('ETH', 'ethereum')).toBe(18)
    })
  })
})
