/**
 * NEAR Intents Integration Tests
 *
 * NOTE: These tests use dry quotes only and don't require API keys.
 * For full integration tests with real quotes, set NEAR_INTENTS_JWT env var.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  NEARIntentsAdapter,
  generateStealthMetaAddress,
  PrivacyLevel,
  NATIVE_TOKENS,
  type SwapRequest,
} from '../../src'

describe('NEAR Intents Integration', () => {
  let adapter: NEARIntentsAdapter
  const hasApiKey = !!process.env.NEAR_INTENTS_JWT

  beforeAll(() => {
    adapter = new NEARIntentsAdapter({
      jwtToken: process.env.NEAR_INTENTS_JWT,
    })
  })

  // ─── Asset Mapping Tests ─────────────────────────────────────────────────────

  describe('Asset Mapping', () => {
    it('should map all supported native tokens', () => {
      // These should all succeed
      expect(adapter.mapAsset('near', 'NEAR')).toBe('near:mainnet:native')
      expect(adapter.mapAsset('near', 'wNEAR')).toBe('near:mainnet:wrap.near')
      expect(adapter.mapAsset('ethereum', 'ETH')).toBe('eth:1:native')
      expect(adapter.mapAsset('solana', 'SOL')).toBe('sol:mainnet:native')
      expect(adapter.mapAsset('zcash', 'ZEC')).toBe('zcash:mainnet:native')
      expect(adapter.mapAsset('arbitrum', 'ETH')).toBe('arb:42161:native')
      expect(adapter.mapAsset('base', 'ETH')).toBe('base:8453:native')
      expect(adapter.mapAsset('polygon', 'MATIC')).toBe('polygon:137:native')
    })

    it('should map common stablecoins', () => {
      expect(adapter.mapAsset('ethereum', 'USDC'))
        .toBe('eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
      expect(adapter.mapAsset('ethereum', 'USDT'))
        .toBe('eth:1:0xdac17f958d2ee523a2206206994597c13d831ec7')
    })
  })

  // ─── Stealth Address Integration ─────────────────────────────────────────────

  describe('Stealth Address Integration', () => {
    it('should generate unique stealth addresses for each swap', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n, // 1 NEAR
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      // Generate two swaps
      const prepared1 = await adapter.prepareSwap(request, metaAddress)
      const prepared2 = await adapter.prepareSwap(request, metaAddress)

      // Stealth addresses should be different (fresh ephemeral keys each time)
      expect(prepared1.stealthAddress?.address).not.toBe(prepared2.stealthAddress?.address)
      expect(prepared1.stealthAddress?.ephemeralPublicKey)
        .not.toBe(prepared2.stealthAddress?.ephemeralPublicKey)
    })

    it('should build valid quote request with stealth recipient', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 100000000000000000000000n, // 0.1 NEAR
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)

      // Verify quote request structure
      expect(prepared.quoteRequest.originAsset).toBe('near:mainnet:native')
      expect(prepared.quoteRequest.destinationAsset).toBe('eth:1:native')
      expect(prepared.quoteRequest.amount).toBe('100000000000000000000000')
      expect(prepared.quoteRequest.recipient).toBe(prepared.stealthAddress?.address)
      expect(prepared.quoteRequest.depositType).toBe('near')
      expect(prepared.quoteRequest.recipientType).toBe('eth')
      expect(prepared.quoteRequest.slippageTolerance).toBeDefined()
      expect(prepared.quoteRequest.deadline).toBeDefined()
    })

    it('should support compliant mode with stealth addresses', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.COMPLIANT,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)

      // Compliant mode still uses stealth addresses
      expect(prepared.stealthAddress).toBeDefined()
      expect(prepared.sharedSecret).toBeDefined()
    })
  })

  // ─── Transparent Mode ────────────────────────────────────────────────────────

  describe('Transparent Mode', () => {
    it('should work without stealth addresses', async () => {
      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const senderAddress = 'user.near'
      const prepared = await adapter.prepareSwap(request, undefined, senderAddress)

      expect(prepared.stealthAddress).toBeUndefined()
      expect(prepared.quoteRequest.recipient).toBe(senderAddress)
    })
  })

  // ─── Live API Tests (require NEAR_INTENTS_JWT) ───────────────────────────────

  describe.skipIf(!hasApiKey)('Live API Tests', () => {
    it('should fetch supported tokens', async () => {
      const tokens = await adapter.getClient().getTokens()

      expect(Array.isArray(tokens)).toBe(true)
      expect(tokens.length).toBeGreaterThan(0)

      // Check token structure
      const token = tokens[0]
      expect(token).toHaveProperty('defuse_asset_id')
      expect(token).toHaveProperty('symbol')
      expect(token).toHaveProperty('decimals')
    })

    it('should get dry quote for NEAR → ETH swap', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const request: SwapRequest = {
        requestId: `live_test_${Date.now()}`,
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n, // 1 NEAR
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)
      const quote = await adapter.getDryQuote(prepared)

      // Dry quotes don't have deposit addresses
      expect(quote.amountIn).toBeDefined()
      expect(quote.amountOut).toBeDefined()
      expect(BigInt(quote.amountOut)).toBeGreaterThan(0n)
    })
  })

  // ─── Error Handling ──────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should reject unsupported asset pairs', () => {
      expect(() => adapter.mapAsset('bitcoin' as any, 'BTC'))
        .toThrow('Unknown asset mapping')
    })

    it('should require stealth meta-address for shielded mode', async () => {
      const request: SwapRequest = {
        requestId: 'test',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      await expect(adapter.prepareSwap(request))
        .rejects.toThrow('recipientMetaAddress is required')
    })

    it('should require sender address for transparent mode', async () => {
      const request: SwapRequest = {
        requestId: 'test',
        privacyLevel: PrivacyLevel.TRANSPARENT,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      await expect(adapter.prepareSwap(request))
        .rejects.toThrow('senderAddress is required')
    })
  })
})
