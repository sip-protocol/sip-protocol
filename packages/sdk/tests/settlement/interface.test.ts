/**
 * Settlement Backend Interface Tests
 *
 * Tests type correctness and validates interface contracts for settlement backends
 */

import { describe, it, expect } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import {
  SwapStatus,
  type SettlementBackend,
  type QuoteParams,
  type Quote,
  type SwapParams,
  type SwapResult,
  type SwapStatusResponse,
  type BackendCapabilities,
  type SettlementBackendRegistry,
} from '../../src/settlement'

describe('SettlementBackend Interface', () => {
  describe('SwapStatus enum', () => {
    it('should have all expected status values', () => {
      expect(SwapStatus.PENDING_DEPOSIT).toBe('pending_deposit')
      expect(SwapStatus.DEPOSIT_CONFIRMED).toBe('deposit_confirmed')
      expect(SwapStatus.IN_PROGRESS).toBe('in_progress')
      expect(SwapStatus.SUCCESS).toBe('success')
      expect(SwapStatus.FAILED).toBe('failed')
      expect(SwapStatus.CANCELLED).toBe('cancelled')
      expect(SwapStatus.REFUNDING).toBe('refunding')
      expect(SwapStatus.REFUNDED).toBe('refunded')
    })
  })

  describe('Type compatibility', () => {
    it('should accept valid QuoteParams', () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: 1000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
        slippageTolerance: 100,
        deadline: Date.now() + 3600,
      }

      expect(params.fromChain).toBe('ethereum')
      expect(params.amount).toBe(1000000n)
    })

    it('should accept QuoteParams with minimal fields', () => {
      const params: QuoteParams = {
        fromChain: 'solana',
        toChain: 'near',
        fromToken: 'SOL',
        toToken: 'NEAR',
        amount: 10n ** 9n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      }

      expect(params.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)
    })

    it('should accept valid Quote', () => {
      const quote: Quote = {
        quoteId: 'quote-123',
        amountIn: '1000000',
        amountOut: '950000',
        minAmountOut: '940000',
        fees: {
          networkFee: '5000',
          protocolFee: '2500',
        },
        depositAddress: '0xdeposit123',
        recipientAddress: '0xrecipient456',
        expiresAt: Date.now() + 300,
      }

      expect(quote.quoteId).toBe('quote-123')
      expect(quote.fees.networkFee).toBe('5000')
    })

    it('should accept Quote with optional fields', () => {
      const quote: Quote = {
        quoteId: 'quote-456',
        amountIn: '1000000',
        amountOut: '950000',
        minAmountOut: '940000',
        priceImpact: 50,
        fees: {
          networkFee: '5000',
          protocolFee: '2500',
          totalFeeUSD: '7.50',
        },
        depositAddress: '0xdeposit789',
        recipientAddress: '0xrecipient012',
        refundAddress: '0xrefund345',
        expiresAt: Date.now() + 600,
        estimatedTime: 120,
        route: {
          steps: [
            {
              protocol: 'Uniswap V3',
              tokenIn: { chain: 'ethereum', symbol: 'USDC' },
              tokenOut: { chain: 'ethereum', symbol: 'ETH' },
              poolId: '0xpool123',
            },
          ],
          hops: 1,
        },
        metadata: {
          customField: 'value',
        },
      }

      expect(quote.priceImpact).toBe(50)
      expect(quote.route?.hops).toBe(1)
    })

    it('should accept valid SwapParams', () => {
      const params: SwapParams = {
        quoteId: 'quote-789',
        depositTxHash: '0xtx123',
      }

      expect(params.quoteId).toBe('quote-789')
    })

    it('should accept valid SwapResult', () => {
      const result: SwapResult = {
        swapId: 'swap-123',
        status: SwapStatus.PENDING_DEPOSIT,
        quoteId: 'quote-123',
        depositAddress: '0xdeposit456',
      }

      expect(result.status).toBe(SwapStatus.PENDING_DEPOSIT)
    })

    it('should accept SwapResult with all optional fields', () => {
      const result: SwapResult = {
        swapId: 'swap-456',
        status: SwapStatus.SUCCESS,
        quoteId: 'quote-456',
        depositAddress: '0xdeposit789',
        depositTxHash: '0xtx789',
        settlementTxHash: '0xsettlement123',
        actualAmountOut: '955000',
        metadata: {
          solver: 'NEAR Intents',
        },
      }

      expect(result.actualAmountOut).toBe('955000')
      expect(result.metadata?.solver).toBe('NEAR Intents')
    })

    it('should accept valid SwapStatusResponse', () => {
      const status: SwapStatusResponse = {
        swapId: 'swap-789',
        status: SwapStatus.IN_PROGRESS,
        quoteId: 'quote-789',
        depositAddress: '0xdeposit012',
        amountIn: '1000000',
        amountOut: '950000',
        updatedAt: Date.now(),
      }

      expect(status.status).toBe(SwapStatus.IN_PROGRESS)
    })

    it('should accept BackendCapabilities', () => {
      const capabilities: BackendCapabilities = {
        supportedSourceChains: ['ethereum', 'solana'],
        supportedDestinationChains: ['near', 'zcash'],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT, PrivacyLevel.SHIELDED],
        supportsCancellation: false,
        supportsRefunds: true,
        maxSwapAmountUSD: 100000,
        minSwapAmountUSD: 10,
        averageExecutionTime: 120,
        features: ['cross-chain', 'stealth-addresses'],
      }

      expect(capabilities.supportedSourceChains).toHaveLength(2)
      expect(capabilities.features).toContain('stealth-addresses')
    })
  })

  describe('Mock Implementation', () => {
    class MockSettlementBackend implements SettlementBackend {
      readonly name = 'mock-backend'
      readonly capabilities: BackendCapabilities = {
        supportedSourceChains: ['ethereum', 'solana'],
        supportedDestinationChains: ['near'],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT, PrivacyLevel.SHIELDED],
        supportsCancellation: true,
        supportsRefunds: true,
      }

      async getQuote(params: QuoteParams): Promise<Quote> {
        return {
          quoteId: `quote-${Date.now()}`,
          amountIn: params.amount.toString(),
          amountOut: (params.amount * 95n / 100n).toString(),
          minAmountOut: (params.amount * 94n / 100n).toString(),
          fees: {
            networkFee: '5000',
            protocolFee: '2500',
          },
          depositAddress: '0xmockdeposit',
          recipientAddress: '0xmockrecipient',
          expiresAt: Date.now() + 300000,
        }
      }

      async executeSwap(params: SwapParams): Promise<SwapResult> {
        return {
          swapId: `swap-${params.quoteId}`,
          status: SwapStatus.PENDING_DEPOSIT,
          quoteId: params.quoteId,
          depositAddress: '0xmockdeposit',
        }
      }

      async getStatus(swapId: string): Promise<SwapStatusResponse> {
        return {
          swapId,
          status: SwapStatus.SUCCESS,
          quoteId: 'quote-123',
          depositAddress: '0xmockdeposit',
          amountIn: '1000000',
          amountOut: '950000',
          updatedAt: Date.now(),
        }
      }

      async cancel(swapId: string): Promise<void> {
        // Mock cancel implementation
      }

      async waitForCompletion(swapId: string): Promise<SwapStatusResponse> {
        return this.getStatus(swapId)
      }

      async getDryQuote(params: QuoteParams): Promise<Quote> {
        return this.getQuote(params)
      }

      async notifyDeposit(swapId: string, txHash: string): Promise<void> {
        // Mock notify implementation
      }
    }

    it('should implement all required methods', async () => {
      const backend = new MockSettlementBackend()

      expect(backend.name).toBe('mock-backend')
      expect(backend.capabilities).toBeDefined()
      expect(typeof backend.getQuote).toBe('function')
      expect(typeof backend.executeSwap).toBe('function')
      expect(typeof backend.getStatus).toBe('function')
    })

    it('should implement optional methods', () => {
      const backend = new MockSettlementBackend()

      expect(typeof backend.cancel).toBe('function')
      expect(typeof backend.waitForCompletion).toBe('function')
      expect(typeof backend.getDryQuote).toBe('function')
      expect(typeof backend.notifyDeposit).toBe('function')
    })

    it('should return valid quote', async () => {
      const backend = new MockSettlementBackend()

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'near',
        fromToken: 'USDC',
        toToken: 'NEAR',
        amount: 1000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(quote).toBeDefined()
      expect(quote.quoteId).toMatch(/^quote-/)
      expect(quote.amountIn).toBe('1000000')
      expect(quote.amountOut).toBe('950000')
      expect(quote.depositAddress).toBe('0xmockdeposit')
    })

    it('should execute swap', async () => {
      const backend = new MockSettlementBackend()

      const result = await backend.executeSwap({
        quoteId: 'quote-test',
      })

      expect(result).toBeDefined()
      expect(result.swapId).toBe('swap-quote-test')
      expect(result.status).toBe(SwapStatus.PENDING_DEPOSIT)
      expect(result.quoteId).toBe('quote-test')
    })

    it('should get swap status', async () => {
      const backend = new MockSettlementBackend()

      const status = await backend.getStatus('swap-123')

      expect(status).toBeDefined()
      expect(status.swapId).toBe('swap-123')
      expect(status.status).toBe(SwapStatus.SUCCESS)
    })

    it('should support cancellation', async () => {
      const backend = new MockSettlementBackend()

      expect(backend.capabilities.supportsCancellation).toBe(true)
      await expect(backend.cancel!('swap-123')).resolves.toBeUndefined()
    })
  })

  describe('Registry Types', () => {
    it('should accept SettlementBackendRegistry', () => {
      const registry: SettlementBackendRegistry = {
        name: 'near-intents',
        factory: (config) => {
          return {
            name: 'near-intents',
            capabilities: {
              supportedSourceChains: ['ethereum'],
              supportedDestinationChains: ['near'],
              supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
              supportsCancellation: false,
              supportsRefunds: true,
            },
            getQuote: async () => ({} as Quote),
            executeSwap: async () => ({} as SwapResult),
            getStatus: async () => ({} as SwapStatusResponse),
          }
        },
        displayName: 'NEAR Intents',
        description: 'Cross-chain swaps via NEAR Protocol',
        homepage: 'https://near.org',
        docs: 'https://docs.near.org/intents',
      }

      expect(registry.name).toBe('near-intents')
      expect(registry.displayName).toBe('NEAR Intents')
      expect(typeof registry.factory).toBe('function')
    })

    it('should create backend from factory', () => {
      const factory = (config: { apiKey: string }) => {
        return {
          name: 'test-backend',
          capabilities: {
            supportedSourceChains: ['ethereum'],
            supportedDestinationChains: ['solana'],
            supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
            supportsCancellation: false,
            supportsRefunds: false,
          },
          getQuote: async () => ({} as Quote),
          executeSwap: async () => ({} as SwapResult),
          getStatus: async () => ({} as SwapStatusResponse),
        }
      }

      const backend = factory({ apiKey: 'test-key' })

      expect(backend.name).toBe('test-backend')
      expect(backend.capabilities).toBeDefined()
    })
  })

  describe('Privacy Level Support', () => {
    it('should support all privacy levels in capabilities', () => {
      const capabilities: BackendCapabilities = {
        supportedSourceChains: ['ethereum'],
        supportedDestinationChains: ['near'],
        supportedPrivacyLevels: [
          PrivacyLevel.TRANSPARENT,
          PrivacyLevel.SHIELDED,
          PrivacyLevel.COMPLIANT,
        ],
        supportsCancellation: false,
        supportsRefunds: true,
      }

      expect(capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.TRANSPARENT)
      expect(capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.SHIELDED)
      expect(capabilities.supportedPrivacyLevels).toContain(PrivacyLevel.COMPLIANT)
    })

    it('should accept stealth meta-address in quote params', () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        toToken: 'SOL',
        amount: 1000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: {
          spendingKey: '0x02abc...',
          viewingKey: '0x03def...',
          chain: 'solana',
        },
      }

      expect(params.recipientMetaAddress).toBeDefined()
    })

    it('should accept encoded stealth meta-address string', () => {
      const params: QuoteParams = {
        fromChain: 'ethereum',
        toChain: 'near',
        fromToken: 'ETH',
        toToken: 'NEAR',
        amount: 10n ** 18n,
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: 'sip:near:0x02abc...123:0x03def...456',
      }

      expect(typeof params.recipientMetaAddress).toBe('string')
    })
  })

  describe('Chain Support', () => {
    it('should support all major chains', () => {
      const capabilities: BackendCapabilities = {
        supportedSourceChains: [
          'ethereum',
          'solana',
          'near',
          'polygon',
          'arbitrum',
          'optimism',
          'base',
          'bitcoin',
          'zcash',
        ],
        supportedDestinationChains: [
          'ethereum',
          'solana',
          'near',
          'polygon',
          'arbitrum',
          'optimism',
          'base',
          'bitcoin',
          'zcash',
        ],
        supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT],
        supportsCancellation: false,
        supportsRefunds: true,
      }

      expect(capabilities.supportedSourceChains).toHaveLength(9)
      expect(capabilities.supportedSourceChains).toContain('zcash')
      expect(capabilities.supportedDestinationChains).toContain('bitcoin')
    })
  })

  describe('Error Handling', () => {
    it('should allow error messages in SwapResult', () => {
      const result: SwapResult = {
        swapId: 'swap-error',
        status: SwapStatus.FAILED,
        quoteId: 'quote-123',
        depositAddress: '0xdeposit',
        errorMessage: 'Insufficient liquidity',
      }

      expect(result.status).toBe(SwapStatus.FAILED)
      expect(result.errorMessage).toBe('Insufficient liquidity')
    })

    it('should allow error messages in SwapStatusResponse', () => {
      const status: SwapStatusResponse = {
        swapId: 'swap-error',
        status: SwapStatus.FAILED,
        quoteId: 'quote-456',
        depositAddress: '0xdeposit',
        amountIn: '1000000',
        amountOut: '0',
        errorMessage: 'Transaction reverted',
        updatedAt: Date.now(),
      }

      expect(status.errorMessage).toBe('Transaction reverted')
    })
  })

  describe('Metadata Support', () => {
    it('should allow custom metadata in Quote', () => {
      const quote: Quote = {
        quoteId: 'quote-meta',
        amountIn: '1000000',
        amountOut: '950000',
        minAmountOut: '940000',
        fees: { networkFee: '5000', protocolFee: '2500' },
        depositAddress: '0xdeposit',
        recipientAddress: '0xrecipient',
        expiresAt: Date.now() + 300,
        metadata: {
          solver: 'mock-solver',
          priority: 'high',
          customFlag: true,
        },
      }

      expect(quote.metadata?.solver).toBe('mock-solver')
      expect(quote.metadata?.priority).toBe('high')
      expect(quote.metadata?.customFlag).toBe(true)
    })

    it('should allow custom metadata in SwapParams', () => {
      const params: SwapParams = {
        quoteId: 'quote-123',
        metadata: {
          userAgent: 'sip-sdk/0.2.3',
          referrer: 'app.example.com',
        },
      }

      expect(params.metadata?.userAgent).toBe('sip-sdk/0.2.3')
    })
  })
})
