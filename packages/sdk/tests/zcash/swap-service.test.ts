/**
 * ZcashSwapService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ZcashSwapService,
  createZcashSwapService,
  type ZcashSwapServiceConfig,
  type ZcashQuoteParams,
  type ZcashSwapParams,
  type BridgeProvider,
  type PriceFeed,
} from '../../src/zcash/swap-service'
import { ValidationError, IntentError } from '../../src/errors'

describe('ZcashSwapService', () => {
  let service: ZcashSwapService

  beforeEach(() => {
    service = new ZcashSwapService({ mode: 'demo' })
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create service in demo mode', () => {
      const svc = new ZcashSwapService({ mode: 'demo' })
      expect(svc).toBeInstanceOf(ZcashSwapService)
    })

    it('should create service in production mode', () => {
      const svc = new ZcashSwapService({ mode: 'production' })
      expect(svc).toBeInstanceOf(ZcashSwapService)
    })

    it('should accept custom slippage', () => {
      const svc = new ZcashSwapService({
        mode: 'demo',
        defaultSlippage: 200, // 2%
      })
      expect(svc).toBeInstanceOf(ZcashSwapService)
    })

    it('should accept custom quote validity', () => {
      const svc = new ZcashSwapService({
        mode: 'demo',
        quoteValiditySeconds: 120,
      })
      expect(svc).toBeInstanceOf(ZcashSwapService)
    })
  })

  // ─── createZcashSwapService ──────────────────────────────────────────────────

  describe('createZcashSwapService', () => {
    it('should create service instance', () => {
      const svc = createZcashSwapService({ mode: 'demo' })
      expect(svc).toBeInstanceOf(ZcashSwapService)
    })
  })

  // ─── getSupportedChains ──────────────────────────────────────────────────────

  describe('getSupportedChains', () => {
    it('should return supported source chains', async () => {
      const chains = await service.getSupportedChains()

      expect(chains).toContain('ethereum')
      expect(chains).toContain('solana')
      expect(chains).toContain('near')
      expect(chains).toContain('polygon')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('base')
    })
  })

  // ─── getSupportedTokens ──────────────────────────────────────────────────────

  describe('getSupportedTokens', () => {
    it('should return supported tokens for ethereum', () => {
      const tokens = service.getSupportedTokens('ethereum')

      expect(tokens).toContain('ETH')
      expect(tokens).toContain('USDC')
      expect(tokens).toContain('USDT')
    })

    it('should return supported tokens for solana', () => {
      const tokens = service.getSupportedTokens('solana')

      expect(tokens).toContain('SOL')
      expect(tokens).toContain('USDC')
    })

    it('should return supported tokens for near', () => {
      const tokens = service.getSupportedTokens('near')

      expect(tokens).toContain('NEAR')
      expect(tokens).toContain('USDC')
    })

    it('should return supported tokens for polygon', () => {
      const tokens = service.getSupportedTokens('polygon')

      expect(tokens).toContain('MATIC')
      expect(tokens).toContain('USDC')
    })
  })

  // ─── isRouteSupported ────────────────────────────────────────────────────────

  describe('isRouteSupported', () => {
    it('should return true for supported routes', () => {
      expect(service.isRouteSupported('ethereum', 'ETH')).toBe(true)
      expect(service.isRouteSupported('solana', 'SOL')).toBe(true)
      expect(service.isRouteSupported('near', 'NEAR')).toBe(true)
      expect(service.isRouteSupported('polygon', 'MATIC')).toBe(true)
    })

    it('should return false for unsupported routes', () => {
      expect(service.isRouteSupported('ethereum', 'SOL' as any)).toBe(false)
      expect(service.isRouteSupported('solana', 'ETH' as any)).toBe(false)
    })
  })

  // ─── getQuote ────────────────────────────────────────────────────────────────

  describe('getQuote', () => {
    const validQuoteParams: ZcashQuoteParams = {
      sourceChain: 'ethereum',
      sourceToken: 'ETH',
      amount: 1000000000000000000n, // 1 ETH
      recipientZAddress: 'zs1testaddress1234567890abcdef',
    }

    it('should return quote for valid ETH → ZEC swap', async () => {
      const quote = await service.getQuote(validQuoteParams)

      expect(quote.quoteId).toBeDefined()
      expect(quote.sourceChain).toBe('ethereum')
      expect(quote.sourceToken).toBe('ETH')
      expect(quote.amountIn).toBe(validQuoteParams.amount)
      expect(quote.amountOut).toBeGreaterThan(0n)
      expect(quote.exchangeRate).toBeGreaterThan(0)
      expect(quote.depositAddress).toMatch(/^0x[a-f0-9]{40}$/i)
      expect(quote.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should return quote for SOL → ZEC swap', async () => {
      const quote = await service.getQuote({
        sourceChain: 'solana',
        sourceToken: 'SOL',
        amount: 1000000000n, // 1 SOL (9 decimals)
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(quote.sourceChain).toBe('solana')
      expect(quote.sourceToken).toBe('SOL')
      expect(quote.amountOut).toBeGreaterThan(0n)
      // Solana deposit addresses are base58
      expect(quote.depositAddress.length).toBeGreaterThan(30)
    })

    it('should return quote for NEAR → ZEC swap', async () => {
      const quote = await service.getQuote({
        sourceChain: 'near',
        sourceToken: 'NEAR',
        amount: 1000000000000000000000000n, // 1 NEAR (24 decimals)
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(quote.sourceChain).toBe('near')
      expect(quote.sourceToken).toBe('NEAR')
      expect(quote.amountOut).toBeGreaterThan(0n)
      expect(quote.depositAddress).toContain('.near')
    })

    it('should return quote for USDC → ZEC swap', async () => {
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'USDC',
        amount: 100000000n, // 100 USDC (6 decimals)
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(quote.sourceToken).toBe('USDC')
      expect(quote.amountOut).toBeGreaterThan(0n)
    })

    it('should calculate slippage correctly', async () => {
      const quote = await service.getQuote({
        ...validQuoteParams,
        slippage: 200, // 2%
      })

      expect(quote.slippage).toBe(200)
      // minimumOutput should be 98% of amountOut
      const expectedMinimum = (quote.amountOut * 9800n) / 10000n
      expect(quote.minimumOutput).toBe(expectedMinimum)
    })

    it('should include fees in quote', async () => {
      const quote = await service.getQuote(validQuoteParams)

      expect(quote.networkFee).toBeGreaterThan(0n)
      expect(quote.swapFee).toBeGreaterThan(0n)
      expect(quote.totalFee).toBe(quote.networkFee + quote.swapFee)
    })

    it('should format amounts correctly', async () => {
      const quote = await service.getQuote(validQuoteParams)

      expect(quote.amountInFormatted).toBe('1')
      expect(parseFloat(quote.amountOutFormatted)).toBeGreaterThan(0)
    })

    it('should throw for missing source chain', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        sourceChain: '' as any,
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for missing source token', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        sourceToken: '' as any,
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for zero amount', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        amount: 0n,
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for negative amount', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        amount: -1n,
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for missing recipient address', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        recipientZAddress: '',
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for invalid z-address format', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        recipientZAddress: 't1invalid_transparent_address', // transparent, not shielded
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for unsupported route', async () => {
      await expect(service.getQuote({
        ...validQuoteParams,
        sourceChain: 'bitcoin' as any,
        sourceToken: 'BTC' as any,
      })).rejects.toThrow(ValidationError)
    })

    it('should accept valid unified address (u1)', async () => {
      const quote = await service.getQuote({
        ...validQuoteParams,
        recipientZAddress: 'u1testunifiedaddress1234567890',
      })

      expect(quote.quoteId).toBeDefined()
    })
  })

  // ─── executeSwapToShielded ───────────────────────────────────────────────────

  describe('executeSwapToShielded', () => {
    const validSwapParams: ZcashSwapParams = {
      sourceChain: 'ethereum',
      sourceToken: 'ETH',
      amount: 1000000000000000000n, // 1 ETH
      recipientZAddress: 'zs1testaddress1234567890abcdef',
    }

    it('should execute ETH → ZEC swap', async () => {
      const result = await service.executeSwapToShielded(validSwapParams)

      expect(result.requestId).toBeDefined()
      expect(result.quoteId).toBeDefined()
      expect(result.status).toBe('completed')
      expect(result.amountIn).toBe(validSwapParams.amount)
      expect(result.amountOut).toBeGreaterThan(0n)
      expect(result.recipientZAddress).toBe(validSwapParams.recipientZAddress)
      expect(result.zcashTxId).toBeDefined()
      expect(result.sourceTxHash).toMatch(/^0x[a-f0-9]{64}$/i)
    })

    it('should execute SOL → ZEC swap', async () => {
      const result = await service.executeSwapToShielded({
        sourceChain: 'solana',
        sourceToken: 'SOL',
        amount: 1000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(result.status).toBe('completed')
      expect(result.amountOut).toBeGreaterThan(0n)
    })

    it('should execute swap with existing quote', async () => {
      // First get a quote
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      // Then execute with quote ID
      const result = await service.executeSwapToShielded({
        ...validSwapParams,
        quoteId: quote.quoteId,
      })

      expect(result.quoteId).toBe(quote.quoteId)
      expect(result.status).toBe('completed')
    })

    it('should include memo in swap', async () => {
      const result = await service.executeSwapToShielded({
        ...validSwapParams,
        memo: 'Test payment',
      })

      expect(result.status).toBe('completed')
    })

    it('should throw for invalid quote ID', async () => {
      await expect(service.executeSwapToShielded({
        ...validSwapParams,
        quoteId: 'invalid_quote_id',
      })).rejects.toThrow(ValidationError)
    })

    it('should throw for expired quote', async () => {
      // Create service with very short quote validity
      const shortValidityService = new ZcashSwapService({
        mode: 'demo',
        quoteValiditySeconds: 1, // 1 second validity
      })

      const quote = await shortValidityService.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      // Wait for expiration (2.5 seconds to ensure it's definitely expired)
      // Using longer wait to avoid timing edge cases in CI environments
      await new Promise((r) => setTimeout(r, 2500))

      await expect(shortValidityService.executeSwapToShielded({
        ...validSwapParams,
        quoteId: quote.quoteId,
      })).rejects.toThrow(IntentError)
    })
  })

  // ─── getSwapStatus ───────────────────────────────────────────────────────────

  describe('getSwapStatus', () => {
    it('should return swap status', async () => {
      const result = await service.executeSwapToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      const status = await service.getSwapStatus(result.requestId)

      expect(status).toBeDefined()
      expect(status?.requestId).toBe(result.requestId)
      expect(status?.status).toBe('completed')
    })

    it('should return null for unknown request ID', async () => {
      const status = await service.getSwapStatus('unknown_request_id')
      expect(status).toBeNull()
    })
  })

  // ─── waitForCompletion ───────────────────────────────────────────────────────

  describe('waitForCompletion', () => {
    it('should return immediately for completed swap', async () => {
      const result = await service.executeSwapToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      const completed = await service.waitForCompletion(result.requestId, 5000, 100)

      expect(completed.status).toBe('completed')
    })

    it('should throw for unknown request ID', async () => {
      await expect(service.waitForCompletion('unknown_id', 100, 50))
        .rejects.toThrow(IntentError)
    })
  })

  // ─── Production Mode with Bridge ─────────────────────────────────────────────

  describe('Production Mode', () => {
    let mockBridge: BridgeProvider

    beforeEach(() => {
      mockBridge = {
        name: 'MockBridge',
        getQuote: vi.fn().mockResolvedValue({
          quoteId: 'bridge_quote_123',
          amountIn: 1000000000000000000n,
          amountOut: 7000000000n, // ~70 ZEC
          fee: 50000000000000000n, // 0.05 ETH
          exchangeRate: 70,
          validUntil: Math.floor(Date.now() / 1000) + 60,
        }),
        executeSwap: vi.fn().mockResolvedValue({
          txHash: '0xbridge_tx_hash_123',
          status: 'completed',
          amountReceived: 7000000000n,
        }),
        getSupportedChains: vi.fn().mockResolvedValue(['ethereum', 'solana']),
      }
    })

    it('should use bridge provider for quotes in production mode', async () => {
      const prodService = new ZcashSwapService({
        mode: 'production',
        bridgeProvider: mockBridge,
      })

      const quote = await prodService.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(mockBridge.getQuote).toHaveBeenCalled()
      expect(quote.quoteId).toBe('bridge_quote_123')
    })

    it('should use bridge provider for swaps in production mode', async () => {
      const prodService = new ZcashSwapService({
        mode: 'production',
        bridgeProvider: mockBridge,
      })

      // First get quote
      await prodService.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      const result = await prodService.executeSwapToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'zs1testaddress1234567890abcdef',
        quoteId: 'bridge_quote_123',
      })

      expect(mockBridge.executeSwap).toHaveBeenCalled()
      expect(result.sourceTxHash).toBe('0xbridge_tx_hash_123')
    })

    it('should get supported chains from bridge provider', async () => {
      const prodService = new ZcashSwapService({
        mode: 'production',
        bridgeProvider: mockBridge,
      })

      const chains = await prodService.getSupportedChains()

      expect(mockBridge.getSupportedChains).toHaveBeenCalled()
      expect(chains).toContain('ethereum')
      expect(chains).toContain('solana')
    })
  })

  // ─── Custom Price Feed ───────────────────────────────────────────────────────

  describe('Custom Price Feed', () => {
    let mockPriceFeed: PriceFeed

    beforeEach(() => {
      mockPriceFeed = {
        getPrice: vi.fn().mockImplementation((token: string) => {
          const prices: Record<string, number> = {
            ETH: 3000,
            SOL: 150,
            NEAR: 6,
          }
          return Promise.resolve(prices[token] ?? 1)
        }),
        getZecPrice: vi.fn().mockResolvedValue(40),
      }
    })

    it('should use custom price feed for quotes', async () => {
      const svc = new ZcashSwapService({
        mode: 'demo',
        priceFeed: mockPriceFeed,
      })

      const quote = await svc.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n, // 1 ETH
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(mockPriceFeed.getPrice).toHaveBeenCalledWith('ETH')
      expect(mockPriceFeed.getZecPrice).toHaveBeenCalled()

      // With ETH at $3000 and ZEC at $40, 1 ETH should get ~75 ZEC (minus fees)
      const zecAmount = Number(quote.amountOut) / 100_000_000
      expect(zecAmount).toBeGreaterThan(60) // Reasonable range
      expect(zecAmount).toBeLessThan(80)
    })
  })

  // ─── Edge Cases ──────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle very small amounts', async () => {
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000n, // 0.001 ETH
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(quote.amountOut).toBeGreaterThan(0n)
    })

    it('should handle very large amounts', async () => {
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000000n, // 1000 ETH
        recipientZAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(quote.amountOut).toBeGreaterThan(0n)
    })

    it('should handle testnet z-addresses', async () => {
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'ztestsapling1testaddress1234567890',
      })

      expect(quote.quoteId).toBeDefined()
    })

    it('should handle testnet unified addresses', async () => {
      const quote = await service.getQuote({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientZAddress: 'utest1testaddress1234567890',
      })

      expect(quote.quoteId).toBeDefined()
    })
  })
})
