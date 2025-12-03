/**
 * OneClickClient unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OneClickClient } from '../../src/adapters/oneclick-client'
import { OneClickSwapType, OneClickSwapStatus } from '@sip-protocol/types'
import { NetworkError, ValidationError } from '../../src/errors'

// Mock fetch
const mockFetch = vi.fn()

describe('OneClickClient', () => {
  let client: OneClickClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new OneClickClient({
      baseUrl: 'https://test.api.com',
      fetch: mockFetch as unknown as typeof fetch,
    })
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default base URL if not provided', () => {
      const defaultClient = new OneClickClient({ fetch: mockFetch as unknown as typeof fetch })
      // Access private property for testing
      expect((defaultClient as unknown as { baseUrl: string }).baseUrl).toBe('https://1click.chaindefuser.com')
    })

    it('should accept custom configuration', () => {
      const customClient = new OneClickClient({
        baseUrl: 'https://custom.api.com',
        jwtToken: 'test-jwt',
        timeout: 60000,
        fetch: mockFetch as unknown as typeof fetch,
      })
      expect((customClient as unknown as { baseUrl: string }).baseUrl).toBe('https://custom.api.com')
      expect((customClient as unknown as { jwtToken: string }).jwtToken).toBe('test-jwt')
    })
  })

  // ─── getTokens ───────────────────────────────────────────────────────────────

  describe('getTokens', () => {
    it('should fetch available tokens', async () => {
      const mockTokens = [
        {
          defuse_asset_id: 'near:mainnet:wrap.near',
          blockchain: 'near',
          address: 'wrap.near',
          symbol: 'wNEAR',
          decimals: 24,
          priceUsd: '3.45',
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      })

      const tokens = await client.getTokens()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.api.com/v0/tokens',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(tokens).toEqual(mockTokens)
    })
  })

  // ─── quote ───────────────────────────────────────────────────────────────────

  describe('quote', () => {
    const validQuoteRequest = {
      swapType: OneClickSwapType.EXACT_INPUT,
      originAsset: 'nep141:wrap.near',
      destinationAsset: 'nep141:eth.omft.near',
      amount: '1000000000000000000000000',
      refundTo: 'user.near',
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f',
      depositType: 'ORIGIN_CHAIN',
      refundType: 'ORIGIN_CHAIN',
      recipientType: 'DESTINATION_CHAIN',
      slippageTolerance: 100,
      deadline: '2024-12-01T00:00:00.000Z',
    }

    it('should request a quote with valid parameters', async () => {
      // Mock response matches actual 1Click API structure (nested)
      const mockApiResponse = {
        quote: {
          depositAddress: '0xdeposit...',
          amountIn: '1000000000000000000000000',
          amountInFormatted: '1.0',
          amountOut: '300000000000000000',
          amountOutFormatted: '0.3',
          deadline: '2024-12-01T00:00:00.000Z',
          timeEstimate: 120,
        },
        quoteRequest: validQuoteRequest,
        signature: '0x...',
        timestamp: '2024-12-01T00:00:00.000Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const quote = await client.quote(validQuoteRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.api.com/v0/quote',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(validQuoteRequest),
        })
      )
      // Client flattens the response
      expect(quote.depositAddress).toBe('0xdeposit...')
      expect(quote.amountIn).toBe('1000000000000000000000000')
      expect(quote.amountOut).toBe('300000000000000000')
      expect(quote.signature).toBe('0x...')
    })

    it('should throw ValidationError for missing required fields', async () => {
      await expect(client.quote({} as any)).rejects.toThrow(ValidationError)
      await expect(client.quote({ swapType: OneClickSwapType.EXACT_INPUT } as any))
        .rejects.toThrow('originAsset is required')
    })

    it('should include JWT token in authorization header', async () => {
      const authClient = new OneClickClient({
        baseUrl: 'https://test.api.com',
        jwtToken: 'my-jwt-token',
        fetch: mockFetch as unknown as typeof fetch,
      })

      // Mock response with nested structure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          quote: {
            depositAddress: '0x...',
            amountIn: '1000',
            amountInFormatted: '0.001',
            amountOut: '500',
            amountOutFormatted: '0.0005',
            deadline: '2024-12-01T00:00:00.000Z',
            timeEstimate: 120,
          },
          quoteRequest: validQuoteRequest,
          signature: '0x...',
          timestamp: '2024-12-01T00:00:00.000Z',
        }),
      })

      await authClient.quote(validQuoteRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer my-jwt-token',
          },
        })
      )
    })
  })

  // ─── dryQuote ────────────────────────────────────────────────────────────────

  describe('dryQuote', () => {
    it('should set dry flag automatically', async () => {
      // Mock response with nested structure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          quote: {
            depositAddress: '',
            amountIn: '1000',
            amountInFormatted: '0.001',
            amountOut: '500',
            amountOutFormatted: '0.0005',
            deadline: '2024-12-01T00:00:00.000Z',
            timeEstimate: 120,
          },
          quoteRequest: {},
          signature: '0x...',
          timestamp: '2024-12-01T00:00:00.000Z',
        }),
      })

      await client.dryQuote({
        swapType: OneClickSwapType.EXACT_INPUT,
        originAsset: 'nep141:wrap.near',
        destinationAsset: 'nep141:eth.omft.near',
        amount: '1000',
        refundTo: 'user.near',
        recipient: '0x...',
        depositType: 'ORIGIN_CHAIN',
        refundType: 'ORIGIN_CHAIN',
        recipientType: 'DESTINATION_CHAIN',
        slippageTolerance: 100,
        deadline: '2024-12-01T00:00:00.000Z',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"dry":true'),
        })
      )
    })
  })

  // ─── submitDeposit ───────────────────────────────────────────────────────────

  describe('submitDeposit', () => {
    it('should submit deposit notification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'PROCESSING' }),
      })

      await client.submitDeposit({
        txHash: '0xabc123',
        depositAddress: '0xdeposit',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.api.com/v0/deposit/submit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            txHash: '0xabc123',
            depositAddress: '0xdeposit',
          }),
        })
      )
    })

    it('should throw ValidationError for missing txHash', async () => {
      await expect(client.submitDeposit({ depositAddress: '0x...' } as any))
        .rejects.toThrow('txHash is required')
    })

    it('should throw ValidationError for missing depositAddress', async () => {
      await expect(client.submitDeposit({ txHash: '0x...' } as any))
        .rejects.toThrow('depositAddress is required')
    })
  })

  // ─── getStatus ───────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should fetch swap status', async () => {
      const mockStatus = {
        status: OneClickSwapStatus.SUCCESS,
        depositTxHash: '0xabc',
        settlementTxHash: '0xdef',
        amountIn: '1000',
        amountOut: '300',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      })

      const status = await client.getStatus('0xdeposit')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.api.com/v0/status?depositAddress=0xdeposit',
        expect.any(Object)
      )
      expect(status).toEqual(mockStatus)
    })

    it('should include memo in query params if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: OneClickSwapStatus.PROCESSING }),
      })

      await client.getStatus('0xdeposit', 'my-memo')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.api.com/v0/status?depositAddress=0xdeposit&depositMemo=my-memo',
        expect.any(Object)
      )
    })

    it('should throw ValidationError for missing depositAddress', async () => {
      await expect(client.getStatus('')).rejects.toThrow('depositAddress is required')
    })
  })

  // ─── Error Handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw NetworkError on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          code: 'INSUFFICIENT_LIQUIDITY',
          message: 'Not enough liquidity for this swap',
        }),
      })

      await expect(client.quote({
        swapType: OneClickSwapType.EXACT_INPUT,
        originAsset: 'nep141:wrap.near',
        destinationAsset: 'nep141:eth.omft.near',
        amount: '1000000000000000000000000000000', // huge amount
        refundTo: 'user.near',
        recipient: '0x...',
        depositType: 'ORIGIN_CHAIN',
        refundType: 'ORIGIN_CHAIN',
        recipientType: 'DESTINATION_CHAIN',
        slippageTolerance: 100,
        deadline: '2024-12-01T00:00:00.000Z',
      })).rejects.toThrow(NetworkError)
    })

    it('should throw NetworkError on rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
        }),
      })

      try {
        await client.getTokens()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError)
        expect((error as NetworkError).statusCode).toBe(429)
      }
    })

    it('should handle network failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.getTokens()).rejects.toThrow(NetworkError)
    })

    it('should handle timeout', async () => {
      // Create a fetch that never resolves but respects abort signal
      const slowFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
          // Never resolve naturally
        })
      })

      const slowClient = new OneClickClient({
        baseUrl: 'https://test.api.com',
        timeout: 10, // 10ms timeout
        fetch: slowFetch as unknown as typeof fetch,
      })

      await expect(slowClient.getTokens()).rejects.toThrow(/timed out/)
    })
  })

  // ─── waitForStatus ───────────────────────────────────────────────────────────

  describe('waitForStatus', () => {
    it('should poll until terminal state', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        const status = callCount < 3
          ? OneClickSwapStatus.PROCESSING
          : OneClickSwapStatus.SUCCESS

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status }),
        })
      })

      const result = await client.waitForStatus('0xdeposit', {
        interval: 10, // Fast polling for test
        timeout: 1000,
      })

      expect(result.status).toBe(OneClickSwapStatus.SUCCESS)
      expect(callCount).toBe(3)
    })

    it('should call onStatus callback', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: callCount < 2
              ? OneClickSwapStatus.PROCESSING
              : OneClickSwapStatus.SUCCESS,
          }),
        })
      })

      const statuses: string[] = []

      await client.waitForStatus('0xdeposit', {
        interval: 10,
        timeout: 1000,
        onStatus: (s) => statuses.push(s.status),
      })

      expect(statuses).toContain(OneClickSwapStatus.PROCESSING)
      expect(statuses).toContain(OneClickSwapStatus.SUCCESS)
    })

    it('should timeout if terminal state not reached', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: OneClickSwapStatus.PROCESSING }),
      })

      await expect(
        client.waitForStatus('0xdeposit', {
          interval: 10,
          timeout: 50,
        })
      ).rejects.toThrow(/timed out/)
    })
  })
})
