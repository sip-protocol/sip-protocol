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
  publicKeyToEthAddress,
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
    it('should map all supported native tokens (NEP-141 format)', () => {
      // These should all succeed with NEP-141 format
      expect(adapter.mapAsset('near', 'NEAR')).toBe('nep141:wrap.near')
      expect(adapter.mapAsset('near', 'wNEAR')).toBe('nep141:wrap.near')
      expect(adapter.mapAsset('ethereum', 'ETH')).toBe('nep141:eth.omft.near')
      expect(adapter.mapAsset('solana', 'SOL')).toBe('nep141:sol.omft.near')
      expect(adapter.mapAsset('zcash', 'ZEC')).toBe('nep141:zec.omft.near')
      expect(adapter.mapAsset('arbitrum', 'ETH')).toBe('nep141:arb.omft.near')
      expect(adapter.mapAsset('base', 'ETH')).toBe('nep141:base.omft.near')
      expect(adapter.mapAsset('polygon', 'MATIC')).toBe('nep245:v2_1.omni.hot.tg:137_11111111111111111111')
    })

    it('should map common stablecoins', () => {
      expect(adapter.mapAsset('ethereum', 'USDC'))
        .toBe('nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near')
      expect(adapter.mapAsset('ethereum', 'USDT'))
        .toBe('nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near')
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

      // NEAR input requires sender address for refunds
      const senderAddress = 'user.near'

      // Generate two swaps
      const prepared1 = await adapter.prepareSwap(request, metaAddress, senderAddress)
      const prepared2 = await adapter.prepareSwap(request, metaAddress, senderAddress)

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

      // NEAR input requires sender address for refunds
      const senderAddress = 'user.near'
      const prepared = await adapter.prepareSwap(request, metaAddress, senderAddress)

      // Verify quote request structure (NEP-141 format)
      expect(prepared.quoteRequest.originAsset).toBe('nep141:wrap.near')
      expect(prepared.quoteRequest.destinationAsset).toBe('nep141:eth.omft.near')
      expect(prepared.quoteRequest.amount).toBe('100000000000000000000000')
      // For EVM chains, recipient is the ETH address derived from stealth public key
      const expectedRecipient = publicKeyToEthAddress(prepared.stealthAddress!.address)
      expect(prepared.quoteRequest.recipient).toBe(expectedRecipient)
      // ETH addresses are 20 bytes (42 chars with 0x prefix)
      expect(prepared.quoteRequest.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/)
      // refundTo should be the sender address for NEAR input
      expect(prepared.quoteRequest.refundTo).toBe(senderAddress)
      expect(prepared.quoteRequest.depositType).toBe('ORIGIN_CHAIN')
      expect(prepared.quoteRequest.recipientType).toBe('DESTINATION_CHAIN')
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

      // NEAR input requires sender address for refunds
      const senderAddress = 'user.near'
      const prepared = await adapter.prepareSwap(request, metaAddress, senderAddress)

      // Compliant mode still uses stealth addresses
      expect(prepared.stealthAddress).toBeDefined()
      expect(prepared.sharedSecret).toBeDefined()
    })

    it('should reject mismatched curve for ed25519 output chains', async () => {
      // Using secp256k1 meta-address for Solana (ed25519) output
      const { metaAddress } = generateStealthMetaAddress('ethereum') // secp256k1

      // ETH → SOL: Solana output requires ed25519 keys
      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH
        outputAsset: NATIVE_TOKENS.solana,
      }

      // Should throw because Solana uses ed25519, not secp256k1
      await expect(adapter.prepareSwap(request, metaAddress, '0x1234567890123456789012345678901234567890'))
        .rejects.toThrow('ed25519')
    })

    it('should require sender address for cross-curve refunds', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum') // secp256k1

      // SOL → ETH: Solana input with secp256k1 meta requires sender for cross-curve refunds
      const request: SwapRequest = {
        requestId: `test_${Date.now()}`,
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.solana,
        inputAmount: 1000000000n, // 1 SOL
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      // No sender address - should throw for cross-curve scenario
      await expect(adapter.prepareSwap(request, metaAddress))
        .rejects.toThrow('Cross-curve refunds not supported')
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

      // Recipient must be EVM address since output chain is Ethereum
      const senderAddress = '0x1234567890123456789012345678901234567890'
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
      expect(() => adapter.mapAsset('dogecoin' as unknown as ChainId, 'DOGE'))
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
