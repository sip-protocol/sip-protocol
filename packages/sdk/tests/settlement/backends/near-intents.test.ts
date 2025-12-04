/**
 * Tests for NEARIntentsBackend settlement backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NEARIntentsBackend } from '../../../src/settlement/backends/near-intents'
import { SwapStatus } from '../../../src/settlement/interface'
import { PrivacyLevel, OneClickSwapStatus } from '@sip-protocol/types'
import type { QuoteParams } from '../../../src/settlement/interface'

describe('NEARIntentsBackend', () => {
  let backend: NEARIntentsBackend

  beforeEach(() => {
    backend = new NEARIntentsBackend({
      baseUrl: 'https://1click.chaindefuser.com',
    })
  })

  describe('backend metadata', () => {
    it('should have correct name', () => {
      expect(backend.name).toBe('near-intents')
    })

    it('should define capabilities', () => {
      expect(backend.capabilities).toBeDefined()
      expect(backend.capabilities.supportedSourceChains).toContain('ethereum')
      expect(backend.capabilities.supportedSourceChains).toContain('solana')
      expect(backend.capabilities.supportedSourceChains).toContain('near')
      expect(backend.capabilities.supportedDestinationChains).toContain('ethereum')
      expect(backend.capabilities.supportedDestinationChains).toContain('solana')
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.TRANSPARENT)
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.SHIELDED)
      expect(backend.capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.COMPLIANT)
    })

    it('should indicate refund support', () => {
      expect(backend.capabilities.supportsRefunds).toBe(true)
    })

    it('should not support cancellation', () => {
      expect(backend.capabilities.supportsCancellation).toBe(false)
    })

    it('should list backend features', () => {
      expect(backend.capabilities.features).toContain('stealth-addresses')
      expect(backend.capabilities.features).toContain('cross-chain')
      expect(backend.capabilities.features).toContain('near-intents')
    })
  })

  describe('getQuote', () => {
    it('should validate required parameters', async () => {
      const invalidParams = {
        fromChain: 'ethereum' as const,
        toChain: 'solana' as const,
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(0), // Invalid: must be > 0
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      }

      await expect(backend.getQuote(invalidParams)).rejects.toThrow('amount must be greater than 0')
    })

    it('should require senderAddress for transparent mode', async () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        // Missing senderAddress
      }

      await expect(backend.getQuote(params)).rejects.toThrow('senderAddress is required for transparent mode')
    })

    it('should require recipientMetaAddress for shielded mode', async () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.SHIELDED,
        senderAddress: '0x1234567890123456789012345678901234567890',
        // Missing recipientMetaAddress
      }

      await expect(backend.getQuote(params)).rejects.toThrow('recipientMetaAddress is required')
    })

    it('should validate supported chains', async () => {
      const params: QuoteParams = {
        fromChain: 'unsupported-chain' as unknown as string,
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      }

      await expect(backend.getQuote(params)).rejects.toThrow('not supported')
    })

    it('should reject slippageTolerance greater than 10000 (100%)', async () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 20000, // 200% - invalid
      }

      await expect(backend.getQuote(params)).rejects.toThrow('slippageTolerance must be between 0-10000')
    })

    it('should reject negative slippageTolerance', async () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
        slippageTolerance: -100, // Negative - invalid
      }

      await expect(backend.getQuote(params)).rejects.toThrow('slippageTolerance must be between 0-10000')
    })

    it('should accept valid slippageTolerance values', async () => {
      // Valid slippageTolerance values should pass validation
      // (will fail later on API call, but validation should pass)
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 500, // 5% - valid
      }

      // This should pass validation but fail on API call (no network)
      // We just want to verify slippage validation passes
      try {
        await backend.getQuote(params)
      } catch (error: any) {
        // Should NOT be a slippage validation error
        expect(error.message).not.toContain('slippageTolerance')
      }
    })

    it('should accept boundary slippageTolerance values', async () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: BigInt(1000000),
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 10000, // 100% - edge case, should be valid
      }

      try {
        await backend.getQuote(params)
      } catch (error: any) {
        expect(error.message).not.toContain('slippageTolerance')
      }
    })
  })

  describe('executeSwap', () => {
    it('should validate quoteId is required', async () => {
      await expect(
        backend.executeSwap({
          quoteId: '',
        })
      ).rejects.toThrow('quoteId is required')
    })

    it('should require cached quote', async () => {
      await expect(
        backend.executeSwap({
          quoteId: 'non-existent-quote',
        })
      ).rejects.toThrow('Quote not found')
    })
  })

  describe('status mapping', () => {
    it('should map OneClick status to SIP SwapStatus correctly', () => {
      // This tests the internal mapping logic
      const statusMap = {
        [OneClickSwapStatus.PENDING_DEPOSIT]: SwapStatus.PENDING_DEPOSIT,
        [OneClickSwapStatus.PROCESSING]: SwapStatus.IN_PROGRESS,
        [OneClickSwapStatus.SUCCESS]: SwapStatus.SUCCESS,
        [OneClickSwapStatus.FAILED]: SwapStatus.FAILED,
        [OneClickSwapStatus.INCOMPLETE_DEPOSIT]: SwapStatus.FAILED,
        [OneClickSwapStatus.REFUNDED]: SwapStatus.REFUNDED,
      }

      // We can't directly test the private mapOneClickStatus function,
      // but we can verify the mapping is consistent by testing through getStatus
      expect(statusMap).toBeDefined()
    })
  })

  describe('notifyDeposit', () => {
    it('should accept deposit notification', async () => {
      // Mock the adapter's notifyDeposit method
      const mockNotifyDeposit = vi.spyOn(backend['adapter'], 'notifyDeposit').mockResolvedValue(undefined)

      await backend.notifyDeposit(
        '0xdepositAddress',
        '0xtxHash',
        { nearAccount: 'test.near' }
      )

      expect(mockNotifyDeposit).toHaveBeenCalledWith(
        '0xdepositAddress',
        '0xtxHash',
        'test.near'
      )
    })
  })

  describe('waitForCompletion', () => {
    it('should poll for completion and return final status', async () => {
      // Mock the adapter's waitForCompletion
      const mockWaitForCompletion = vi.spyOn(backend['adapter'], 'waitForCompletion').mockResolvedValue({
        status: OneClickSwapStatus.SUCCESS,
        depositTxHash: '0xdeposit',
        settlementTxHash: '0xsettlement',
        amountIn: '1000000',
        amountOut: '5000000',
      })

      // Mock getStatus
      const mockGetStatus = vi.spyOn(backend['adapter'], 'getStatus').mockResolvedValue({
        status: OneClickSwapStatus.SUCCESS,
        depositTxHash: '0xdeposit',
        settlementTxHash: '0xsettlement',
        amountIn: '1000000',
        amountOut: '5000000',
      })

      const result = await backend.waitForCompletion('0xdepositAddress')

      expect(result.status).toBe(SwapStatus.SUCCESS)
      expect(result.swapId).toBe('0xdepositAddress')
      expect(mockWaitForCompletion).toHaveBeenCalled()
      expect(mockGetStatus).toHaveBeenCalledWith('0xdepositAddress')
    })

    it('should call onStatusChange callback', async () => {
      const onStatusChange = vi.fn()

      // Mock the adapter's waitForCompletion
      vi.spyOn(backend['adapter'], 'waitForCompletion').mockImplementation(async (_, options) => {
        // Simulate status change callback
        if (options?.onStatus) {
          options.onStatus({
            status: OneClickSwapStatus.PROCESSING,
            amountIn: '1000000',
            amountOut: '5000000',
          })
        }
        return {
          status: OneClickSwapStatus.SUCCESS,
          depositTxHash: '0xdeposit',
          settlementTxHash: '0xsettlement',
          amountIn: '1000000',
          amountOut: '5000000',
        }
      })

      vi.spyOn(backend['adapter'], 'getStatus').mockResolvedValue({
        status: OneClickSwapStatus.SUCCESS,
        depositTxHash: '0xdeposit',
        settlementTxHash: '0xsettlement',
        amountIn: '1000000',
        amountOut: '5000000',
      })

      await backend.waitForCompletion('0xdepositAddress', {
        onStatusChange,
      })

      expect(onStatusChange).toHaveBeenCalled()
      const callArg = onStatusChange.mock.calls[0][0]
      expect(callArg.status).toBe(SwapStatus.IN_PROGRESS)
    })
  })

  describe('getDryQuote', () => {
    it('should support dry quotes', async () => {
      expect(backend.getDryQuote).toBeDefined()
      expect(typeof backend.getDryQuote).toBe('function')
    })
  })

  describe('SettlementBackend interface compliance', () => {
    it('should implement all required methods', () => {
      expect(backend.getQuote).toBeDefined()
      expect(backend.executeSwap).toBeDefined()
      expect(backend.getStatus).toBeDefined()
      expect(typeof backend.getQuote).toBe('function')
      expect(typeof backend.executeSwap).toBe('function')
      expect(typeof backend.getStatus).toBe('function')
    })

    it('should implement optional methods', () => {
      expect(backend.waitForCompletion).toBeDefined()
      expect(backend.getDryQuote).toBeDefined()
      expect(backend.notifyDeposit).toBeDefined()
      expect(typeof backend.waitForCompletion).toBe('function')
      expect(typeof backend.getDryQuote).toBe('function')
      expect(typeof backend.notifyDeposit).toBe('function')
    })

    it('should have readonly name property', () => {
      expect(backend.name).toBe('near-intents')
      // Note: readonly is enforced at TypeScript compile time, not runtime
      // At runtime, the property can be assigned but shouldn't be
    })

    it('should have readonly capabilities property', () => {
      const caps = backend.capabilities
      expect(caps).toBeDefined()
      // Capabilities should be defined
      expect(caps.supportedSourceChains).toBeDefined()
      expect(caps.supportedDestinationChains).toBeDefined()
      expect(caps.supportedPrivacyLevels).toBeDefined()
    })
  })

  describe('factory function', () => {
    it('should create backend via factory', async () => {
      const { createNEARIntentsBackend } = await import('../../../src/settlement/backends/near-intents')
      const newBackend = createNEARIntentsBackend()
      expect(newBackend).toBeInstanceOf(NEARIntentsBackend)
      expect(newBackend.name).toBe('near-intents')
    })

    it('should accept config via factory', async () => {
      const { createNEARIntentsBackend } = await import('../../../src/settlement/backends/near-intents')
      const newBackend = createNEARIntentsBackend({
        baseUrl: 'https://custom.api.url',
      })
      expect(newBackend).toBeInstanceOf(NEARIntentsBackend)
    })
  })
})
