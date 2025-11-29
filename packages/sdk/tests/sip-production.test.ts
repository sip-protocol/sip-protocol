/**
 * SIP Production Mode Tests
 *
 * Tests for the production mode integration with NEAR 1Click API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SIP, createSIP, createProductionSIP, type ProductionQuote } from '../src/sip'
import { NEARIntentsAdapter, type SwapRequest, type PreparedSwap } from '../src/adapters'
import { MockProofProvider } from '../src/proofs/mock'
import { ValidationError } from '../src/errors'
import {
  PrivacyLevel,
  IntentStatus,
  OneClickSwapStatus,
  type CreateIntentParams,
  type OneClickQuoteResponse,
  type OneClickStatusResponse,
  type Asset,
  type ChainId,
} from '@sip-protocol/types'

// Mock NEAR adapter methods
const mockPrepareSwap = vi.fn()
const mockGetQuote = vi.fn()
const mockNotifyDeposit = vi.fn()
const mockWaitForCompletion = vi.fn()

vi.mock('../src/adapters', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/adapters')>()
  return {
    ...original,
    NEARIntentsAdapter: vi.fn().mockImplementation(() => ({
      prepareSwap: mockPrepareSwap,
      getQuote: mockGetQuote,
      notifyDeposit: mockNotifyDeposit,
      waitForCompletion: mockWaitForCompletion,
    })),
  }
})

describe('SIP Production Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Mode Configuration', () => {
    it('should default to demo mode', () => {
      const sip = createSIP('testnet')
      expect(sip.getMode()).toBe('demo')
      expect(sip.isProductionMode()).toBe(false)
    })

    it('should accept production mode config', () => {
      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })
      expect(sip.getMode()).toBe('production')
      expect(sip.isProductionMode()).toBe(true)
    })

    it('should create production SIP with factory function', () => {
      const sip = createProductionSIP({
        network: 'mainnet',
        jwtToken: 'test-jwt',
      })
      expect(sip.getMode()).toBe('production')
      expect(sip.getNetwork()).toBe('mainnet')
    })

    it('should validate mode value', () => {
      expect(() => new SIP({
        network: 'testnet',
        // @ts-expect-error - testing invalid mode
        mode: 'invalid',
      })).toThrow(ValidationError)
    })
  })

  describe('Demo Mode getQuotes()', () => {
    it('should return mock quotes in demo mode', async () => {
      const sip = createSIP('testnet')

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      const quotes = await sip.getQuotes(params)

      expect(quotes.length).toBe(2)
      expect(quotes[0].solverId).toBe('demo-solver-1')
      expect(quotes[1].solverId).toBe('demo-solver-2')
      expect(quotes[0].outputAmount).toBeGreaterThan(params.output.minAmount)
    })

    it('should work with ShieldedIntent in demo mode', async () => {
      const sip = createSIP('testnet')

      const intent = await sip.intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('ethereum' as ChainId, 'ETH', 90n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      const quotes = await sip.getQuotes(intent)

      expect(quotes.length).toBe(2)
      expect(quotes[0].outputAmount).toBeGreaterThan(intent.minOutputAmount)
    })
  })

  describe('Production Mode getQuotes()', () => {
    it('should require CreateIntentParams in production mode', async () => {
      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      // Build a ShieldedIntent
      const intent = await sip.intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('ethereum' as ChainId, 'ETH', 90n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      // Production mode should reject ShieldedIntent
      await expect(sip.getQuotes(intent)).rejects.toThrow(ValidationError)
      await expect(sip.getQuotes(intent)).rejects.toThrow(/CreateIntentParams/)
    })

    it('should require stealth address for privacy modes', async () => {
      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      // No stealth address provided
      await expect(sip.getQuotes(params)).rejects.toThrow(ValidationError)
      await expect(sip.getQuotes(params)).rejects.toThrow(/stealth/i)
    })

    it('should allow transparent mode without stealth address', async () => {
      const mockQuote: OneClickQuoteResponse = {
        quoteId: 'quote-123',
        depositAddress: '0xdeposit',
        amountIn: '100',
        amountInFormatted: '100',
        amountOut: '95',
        amountOutFormatted: '95',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        timeEstimate: 30,
        signature: '0xsig',
      }

      mockPrepareSwap.mockResolvedValue({
        request: {},
        quoteRequest: {},
      } as PreparedSwap)
      mockGetQuote.mockResolvedValue(mockQuote)

      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      // Connect a wallet for transparent mode
      sip.connect({
        chain: 'near',
        address: '0xwallet',
        signMessage: async () => '0xsig',
        signTransaction: async () => ({}),
      })

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.TRANSPARENT,
      }

      const quotes = await sip.getQuotes(params)

      expect(quotes.length).toBe(1)
      expect(quotes[0].depositAddress).toBe('0xdeposit')
      expect(quotes[0].rawQuote).toBe(mockQuote)
    })

    it('should call NEAR adapter with correct parameters', async () => {
      const mockQuote: OneClickQuoteResponse = {
        quoteId: 'quote-456',
        depositAddress: '0xdeposit',
        amountIn: '100',
        amountInFormatted: '100',
        amountOut: '95',
        amountOutFormatted: '95',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        timeEstimate: 30,
        signature: '0xsig',
      }

      mockPrepareSwap.mockResolvedValue({
        request: {},
        quoteRequest: {},
      } as PreparedSwap)
      mockGetQuote.mockResolvedValue(mockQuote)

      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      // Generate stealth keys for shielded mode
      sip.generateStealthKeys('ethereum' as ChainId)

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      await sip.getQuotes(params)

      expect(mockPrepareSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: params.input.asset,
          outputAsset: params.output.asset,
          inputAmount: params.input.amount,
          minOutputAmount: params.output.minAmount,
        }),
        expect.anything(), // stealth meta address
        undefined, // no wallet connected
      )
    })
  })

  describe('Demo Mode execute()', () => {
    it('should return mock result in demo mode', async () => {
      const sip = createSIP('testnet')

      const intent = await sip.intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('ethereum' as ChainId, 'ETH', 90n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const quotes = await sip.getQuotes(intent)
      const result = await sip.execute(tracked, quotes[0])

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.outputAmount).toBeGreaterThanOrEqual(intent.minOutputAmount)
    })

    it('should not return txHash for shielded mode in demo', async () => {
      const sip = createSIP('testnet')

      const intent = await sip.intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('ethereum' as ChainId, 'ETH', 90n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const quotes = await sip.getQuotes(intent)
      const result = await sip.execute(tracked, quotes[0])

      // Shielded mode should not expose txHash
      expect(result.txHash).toBeUndefined()
    })

    it('should return txHash for transparent mode in demo', async () => {
      const sip = createSIP('testnet')

      const intent = await sip.intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('ethereum' as ChainId, 'ETH', 90n)
        .privacy(PrivacyLevel.TRANSPARENT)
        .build()

      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const quotes = await sip.getQuotes(intent)
      const result = await sip.execute(tracked, quotes[0])

      // Transparent mode should expose txHash
      expect(result.txHash).toBeDefined()
      expect(result.txHash?.startsWith('0x')).toBe(true)
    })
  })

  describe('Production Mode execute()', () => {
    it('should wait for completion and return result', async () => {
      const mockQuote: OneClickQuoteResponse = {
        quoteId: 'quote-789',
        depositAddress: '0xdeposit',
        amountIn: '100',
        amountInFormatted: '100',
        amountOut: '95',
        amountOutFormatted: '95',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        timeEstimate: 30,
        signature: '0xsig',
      }

      const mockStatus: OneClickStatusResponse = {
        status: OneClickSwapStatus.SUCCESS,
        depositTxHash: '0xdeposit-tx',
        settlementTxHash: '0xsettlement-tx',
        amountIn: '100',
        amountOut: '95',
      }

      mockPrepareSwap.mockResolvedValue({
        request: {},
        quoteRequest: {},
      } as PreparedSwap)
      mockGetQuote.mockResolvedValue(mockQuote)
      mockWaitForCompletion.mockResolvedValue(mockStatus)

      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      sip.generateStealthKeys('ethereum' as ChainId)

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      const quotes = await sip.getQuotes(params) as ProductionQuote[]

      // Create a tracked intent for execution
      const intent = await sip.createIntent(params)

      const result = await sip.execute(intent, quotes[0])

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.txHash).toBe('0xsettlement-tx')
      expect(mockWaitForCompletion).toHaveBeenCalled()
    })

    it('should handle failed swap', async () => {
      const mockQuote: OneClickQuoteResponse = {
        quoteId: 'quote-fail',
        depositAddress: '0xdeposit',
        amountIn: '100',
        amountInFormatted: '100',
        amountOut: '95',
        amountOutFormatted: '95',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        timeEstimate: 30,
        signature: '0xsig',
      }

      const mockStatus: OneClickStatusResponse = {
        status: OneClickSwapStatus.FAILED,
        error: 'Insufficient liquidity',
      }

      mockPrepareSwap.mockResolvedValue({
        request: {},
        quoteRequest: {},
      } as PreparedSwap)
      mockGetQuote.mockResolvedValue(mockQuote)
      mockWaitForCompletion.mockResolvedValue(mockStatus)

      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      sip.generateStealthKeys('ethereum' as ChainId)

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      const quotes = await sip.getQuotes(params) as ProductionQuote[]
      const intent = await sip.createIntent(params)
      const result = await sip.execute(intent, quotes[0])

      expect(result.status).toBe(IntentStatus.FAILED)
      expect(result.error).toBe('Insufficient liquidity')
    })

    it('should call deposit callback when provided', async () => {
      const mockQuote: OneClickQuoteResponse = {
        quoteId: 'quote-deposit',
        depositAddress: '0xdeposit',
        amountIn: '100',
        amountInFormatted: '100',
        amountOut: '95',
        amountOutFormatted: '95',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        timeEstimate: 30,
        signature: '0xsig',
      }

      const mockStatus: OneClickStatusResponse = {
        status: OneClickSwapStatus.SUCCESS,
        settlementTxHash: '0xsettlement',
      }

      mockPrepareSwap.mockResolvedValue({
        request: {},
        quoteRequest: {},
      } as PreparedSwap)
      mockGetQuote.mockResolvedValue(mockQuote)
      mockWaitForCompletion.mockResolvedValue(mockStatus)

      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: { jwtToken: 'test-token' },
      })

      sip.generateStealthKeys('ethereum' as ChainId)

      const params: CreateIntentParams = {
        input: {
          asset: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
          amount: 100n,
        },
        output: {
          asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
          minAmount: 90n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.SHIELDED,
      }

      const quotes = await sip.getQuotes(params) as ProductionQuote[]
      const intent = await sip.createIntent(params)

      const onDepositRequired = vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
      const onStatusUpdate = vi.fn()

      await sip.execute(intent, quotes[0], {
        onDepositRequired,
        onStatusUpdate,
      })

      expect(onDepositRequired).toHaveBeenCalledWith('0xdeposit', '100')
      expect(mockNotifyDeposit).toHaveBeenCalledWith('0xdeposit', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    })
  })

  describe('Intents Adapter Management', () => {
    it('should get and set intents adapter', () => {
      const sip = createSIP('testnet')

      expect(sip.getIntentsAdapter()).toBeUndefined()

      sip.setIntentsAdapter({ jwtToken: 'new-token' })
      expect(sip.getIntentsAdapter()).toBeDefined()
    })

    it('should accept NEARIntentsAdapter instance', () => {
      const adapter = new NEARIntentsAdapter({ jwtToken: 'test' })
      const sip = new SIP({
        network: 'testnet',
        mode: 'production',
        intentsAdapter: adapter,
      })

      expect(sip.isProductionMode()).toBe(true)
    })
  })
})
