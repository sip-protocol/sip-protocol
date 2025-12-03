/**
 * Zcash Native Settlement Backend Tests
 *
 * Tests the ZcashNativeBackend implementation for direct ZEC → ZEC transfers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import {
  ZcashNativeBackend,
  createZcashNativeBackend,
  type ZcashNativeBackendConfig,
} from '../../../src/settlement/backends/zcash-native'
import { SwapStatus } from '../../../src/settlement/interface'
import type { ZcashSwapService } from '../../../src/zcash'

// Mock ZcashSwapService
const createMockSwapService = (): ZcashSwapService => {
  return {
    getQuote: vi.fn(),
    executeSwapToShielded: vi.fn(),
    getSwapStatus: vi.fn(),
    waitForCompletion: vi.fn(),
    getSupportedChains: vi.fn(),
    getSupportedTokens: vi.fn(),
    isRouteSupported: vi.fn(),
  } as unknown as ZcashSwapService
}

describe('ZcashNativeBackend', () => {
  let mockSwapService: ZcashSwapService
  let backend: ZcashNativeBackend

  beforeEach(() => {
    mockSwapService = createMockSwapService()
  })

  describe('Constructor', () => {
    it('should create backend with required config', () => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })

      expect(backend.name).toBe('zcash-native')
      expect(backend.capabilities).toBeDefined()
    })

    it('should create backend with custom config', () => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
        quoteValiditySeconds: 600,
        networkFeeZatoshis: 20000,
      })

      expect(backend.name).toBe('zcash-native')
    })

    it('should use factory function', () => {
      backend = createZcashNativeBackend({
        swapService: mockSwapService,
      })

      expect(backend).toBeInstanceOf(ZcashNativeBackend)
      expect(backend.name).toBe('zcash-native')
    })
  })

  describe('Capabilities', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should support only zcash chain', () => {
      expect(backend.capabilities.supportedSourceChains).toEqual(['zcash'])
      expect(backend.capabilities.supportedDestinationChains).toEqual(['zcash'])
    })

    it('should support all privacy levels', () => {
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.TRANSPARENT)
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.SHIELDED)
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.COMPLIANT)
    })

    it('should not support cancellation or refunds', () => {
      expect(backend.capabilities.supportsCancellation).toBe(false)
      expect(backend.capabilities.supportsRefunds).toBe(false)
    })

    it('should have expected features', () => {
      expect(backend.capabilities.features).toContain('native-zcash')
      expect(backend.capabilities.features).toContain('shielded-addresses')
      expect(backend.capabilities.features).toContain('transparent-addresses')
      expect(backend.capabilities.features).toContain('instant-quotes')
    })

    it('should have reasonable execution time', () => {
      expect(backend.capabilities.averageExecutionTime).toBe(75) // ~75 seconds
    })
  })

  describe('getQuote', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should generate quote for transparent transfer', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000), // 1 ZEC
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1abc123',
        senderAddress: 't1sender456',
      })

      expect(quote).toBeDefined()
      expect(quote.quoteId).toMatch(/^zec_native_quote_/)
      expect(quote.amountIn).toBe('100000000')
      expect(quote.depositAddress).toBeDefined()
      expect(quote.recipientAddress).toBe('t1abc123')
      expect(quote.fees.networkFee).toBe('10000') // Default fee
      expect(quote.fees.protocolFee).toBe('0') // No protocol fee
      expect(quote.expiresAt).toBeGreaterThan(Date.now() / 1000)
    })

    it('should generate quote for shielded transfer', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(50000000), // 0.5 ZEC
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: 'zs1abc123...',
      })

      expect(quote).toBeDefined()
      expect(quote.quoteId).toMatch(/^zec_native_quote_/)
      expect(quote.amountIn).toBe('50000000')
      expect(quote.depositAddress).toMatch(/^zs1/) // Shielded address
      expect(quote.recipientAddress).toBe('zs1abc123...')
      expect(quote.metadata?.privacyLevel).toBe(PrivacyLevel.SHIELDED)
    })

    it('should calculate correct output amount after fees', async () => {
      const amount = BigInt(100000000) // 1 ZEC
      const expectedFee = BigInt(10000) // 0.0001 ZEC
      const expectedOut = amount - expectedFee

      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      expect(quote.amountOut).toBe(expectedOut.toString())
    })

    it('should calculate minimum output with slippage buffer', async () => {
      const amount = BigInt(100000000) // 1 ZEC
      const expectedFee = BigInt(10000)
      const expectedOut = amount - expectedFee
      const expectedMin = (expectedOut * BigInt(99)) / BigInt(100) // 99%

      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      expect(quote.minAmountOut).toBe(expectedMin.toString())
    })

    it('should reject non-zcash source chain', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'zcash',
          fromToken: 'ETH',
          toToken: 'ZEC',
          amount: BigInt(1000000000000000000),
          privacyLevel: PrivacyLevel.TRANSPARENT,
          recipientMetaAddress: 't1recipient',
        }),
      ).rejects.toThrow('Source chain must be zcash')
    })

    it('should reject non-zcash destination chain', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'zcash',
          toChain: 'ethereum',
          fromToken: 'ZEC',
          toToken: 'ETH',
          amount: BigInt(100000000),
          privacyLevel: PrivacyLevel.TRANSPARENT,
          recipientMetaAddress: '0xrecipient',
        }),
      ).rejects.toThrow('Destination chain must be zcash')
    })

    it('should reject non-ZEC tokens', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'zcash',
          toChain: 'zcash',
          fromToken: 'USDC',
          toToken: 'ZEC',
          amount: BigInt(1000000),
          privacyLevel: PrivacyLevel.TRANSPARENT,
          recipientMetaAddress: 't1recipient',
        }),
      ).rejects.toThrow('Source token must be ZEC')
    })

    it('should reject zero amount', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'zcash',
          toChain: 'zcash',
          fromToken: 'ZEC',
          toToken: 'ZEC',
          amount: BigInt(0),
          privacyLevel: PrivacyLevel.TRANSPARENT,
          recipientMetaAddress: 't1recipient',
        }),
      ).rejects.toThrow('Amount must be positive')
    })

    it('should reject amount too small to cover fees', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'zcash',
          toChain: 'zcash',
          fromToken: 'ZEC',
          toToken: 'ZEC',
          amount: BigInt(5000), // Less than network fee
          privacyLevel: PrivacyLevel.TRANSPARENT,
          recipientMetaAddress: 't1recipient',
        }),
      ).rejects.toThrow('Amount too small to cover network fees')
    })

    it('should require recipient address for shielded transfer', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'zcash',
          toChain: 'zcash',
          fromToken: 'ZEC',
          toToken: 'ZEC',
          amount: BigInt(100000000),
          privacyLevel: PrivacyLevel.SHIELDED,
          // Missing recipientMetaAddress
        }),
      ).rejects.toThrow('Recipient address required')
    })

    it('should include metadata in quote', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: 'zs1abc',
      })

      expect(quote.metadata).toBeDefined()
      expect(quote.metadata?.backend).toBe('zcash-native')
      expect(quote.metadata?.privacyLevel).toBe(PrivacyLevel.SHIELDED)
      expect(quote.metadata?.zcashNetwork).toBe('mainnet')
    })
  })

  describe('getDryQuote', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should return same as regular quote', async () => {
      const params = {
        fromChain: 'zcash' as const,
        toChain: 'zcash' as const,
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      }

      const quote = await backend.getQuote(params)
      const dryQuote = await backend.getDryQuote(params)

      // Should have different quote IDs but same structure
      expect(dryQuote.amountIn).toBe(quote.amountIn)
      expect(dryQuote.amountOut).toBe(quote.amountOut)
      expect(dryQuote.fees.networkFee).toBe(quote.fees.networkFee)
    })
  })

  describe('executeSwap', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should execute swap with valid quote', async () => {
      // First get a quote
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      // Execute swap
      const result = await backend.executeSwap({
        quoteId: quote.quoteId,
      })

      expect(result).toBeDefined()
      expect(result.swapId).toMatch(/^zec_native_swap_/)
      expect(result.quoteId).toBe(quote.quoteId)
      expect(result.status).toBe(SwapStatus.PENDING_DEPOSIT)
      expect(result.depositAddress).toBe(quote.depositAddress)
    })

    it('should execute swap with deposit transaction', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      const result = await backend.executeSwap({
        quoteId: quote.quoteId,
        depositTxHash: 'abc123def456',
      })

      expect(result.status).toBe(SwapStatus.DEPOSIT_CONFIRMED)
      expect(result.depositTxHash).toBe('abc123def456')
    })

    it('should reject invalid quote ID', async () => {
      await expect(
        backend.executeSwap({
          quoteId: 'invalid-quote-id',
        }),
      ).rejects.toThrow('Quote not found or expired')
    })

    it('should reject expired quote', async () => {
      // Create backend with very short quote validity
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
        quoteValiditySeconds: 1, // 1 second validity
      })

      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      // Verify quote expiry time is set correctly
      const now = Math.floor(Date.now() / 1000)
      expect(quote.expiresAt).toBeLessThanOrEqual(now + 2)

      // Wait long enough to ensure expiration (2 seconds to be safe)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      await expect(
        backend.executeSwap({
          quoteId: quote.quoteId,
        }),
      ).rejects.toThrow('Quote has expired')
    })
  })

  describe('getStatus', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should get swap status', async () => {
      // Create and execute a swap
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      const swap = await backend.executeSwap({
        quoteId: quote.quoteId,
      })

      // Get status
      const status = await backend.getStatus(swap.swapId)

      expect(status).toBeDefined()
      expect(status.swapId).toBe(swap.swapId)
      expect(status.quoteId).toBe(quote.quoteId)
      expect(status.status).toBe(SwapStatus.PENDING_DEPOSIT)
      expect(status.amountIn).toBe(quote.amountIn)
      expect(status.amountOut).toBe(quote.amountOut)
      expect(status.updatedAt).toBeDefined()
    })

    it('should reject invalid swap ID', async () => {
      await expect(backend.getStatus('invalid-swap-id')).rejects.toThrow('Swap not found')
    })
  })

  describe('waitForCompletion', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should wait for swap completion', async () => {
      // Create and execute swap with deposit
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      const swap = await backend.executeSwap({
        quoteId: quote.quoteId,
        depositTxHash: 'abc123',
      })

      // Wait for completion (with short timeout for testing)
      const finalStatus = await backend.waitForCompletion(swap.swapId, {
        interval: 100,
        timeout: 5000,
      })

      // Should eventually reach success state
      expect(finalStatus.status).toBe(SwapStatus.SUCCESS)
      expect(finalStatus.settlementTxHash).toBeDefined()
      expect(finalStatus.actualAmountOut).toBe(quote.amountOut)
    })

    it('should call onStatusChange callback', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      const swap = await backend.executeSwap({
        quoteId: quote.quoteId,
        depositTxHash: 'abc123',
      })

      const statusChanges: SwapStatus[] = []
      const onStatusChange = vi.fn((status) => {
        statusChanges.push(status.status)
      })

      await backend.waitForCompletion(swap.swapId, {
        interval: 100,
        timeout: 5000,
        onStatusChange,
      })

      expect(onStatusChange).toHaveBeenCalled()
      expect(statusChanges).toContain(SwapStatus.SUCCESS)
    })
  })

  describe('notifyDeposit', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should update swap with deposit info', async () => {
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        recipientMetaAddress: 't1recipient',
      })

      const swap = await backend.executeSwap({
        quoteId: quote.quoteId,
      })

      // Notify deposit
      await backend.notifyDeposit(swap.swapId, 'tx123abc', { source: 'test' })

      // Check status updated
      const status = await backend.getStatus(swap.swapId)
      expect(status.depositTxHash).toBe('tx123abc')
      expect(status.status).toBe(SwapStatus.DEPOSIT_CONFIRMED)
      expect(status.metadata?.source).toBe('test')
    })

    it('should reject invalid swap ID', async () => {
      await expect(backend.notifyDeposit('invalid-swap-id', 'tx123')).rejects.toThrow(
        'Swap not found',
      )
    })
  })

  describe('Integration scenarios', () => {
    beforeEach(() => {
      backend = new ZcashNativeBackend({
        swapService: mockSwapService,
      })
    })

    it('should handle full swap lifecycle', async () => {
      // 1. Get quote
      const quote = await backend.getQuote({
        fromChain: 'zcash',
        toChain: 'zcash',
        fromToken: 'ZEC',
        toToken: 'ZEC',
        amount: BigInt(100000000),
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: 'zs1recipient',
      })

      expect(quote).toBeDefined()

      // 2. Execute swap
      const swap = await backend.executeSwap({
        quoteId: quote.quoteId,
      })

      expect(swap.status).toBe(SwapStatus.PENDING_DEPOSIT)

      // 3. Notify deposit
      await backend.notifyDeposit(swap.swapId, 'deposit-tx-123')

      // 4. Wait for completion
      const finalStatus = await backend.waitForCompletion(swap.swapId, {
        interval: 100,
        timeout: 5000,
      })

      expect(finalStatus.status).toBe(SwapStatus.SUCCESS)
      expect(finalStatus.depositTxHash).toBe('deposit-tx-123')
      expect(finalStatus.settlementTxHash).toBeDefined()
    })
  })
})
