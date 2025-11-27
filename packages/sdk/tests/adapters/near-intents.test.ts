/**
 * NEARIntentsAdapter unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NEARIntentsAdapter,
  createNEARIntentsAdapter,
  type SwapRequest,
} from '../../src/adapters/near-intents'
import { OneClickClient } from '../../src/adapters/oneclick-client'
import { generateStealthMetaAddress } from '../../src/stealth'
import { PrivacyLevel, OneClickSwapType, OneClickSwapStatus, NATIVE_TOKENS } from '@sip-protocol/types'
import { ValidationError } from '../../src/errors'

// Mock OneClickClient
vi.mock('../../src/adapters/oneclick-client', () => ({
  OneClickClient: vi.fn().mockImplementation(() => ({
    quote: vi.fn().mockResolvedValue({
      quoteId: 'quote_123',
      depositAddress: '0xdeposit',
      amountIn: '1000000000000000000000000',
      amountInFormatted: '1.0',
      amountOut: '300000000000000000',
      amountOutFormatted: '0.3',
      deadline: '2024-12-01T00:00:00.000Z',
      timeEstimate: 120,
      signature: '0xsig',
    }),
    dryQuote: vi.fn().mockResolvedValue({
      quoteId: 'dry_quote_123',
      amountIn: '1000000000000000000000000',
      amountOut: '300000000000000000',
    }),
    getStatus: vi.fn().mockResolvedValue({
      status: OneClickSwapStatus.SUCCESS,
    }),
    submitDeposit: vi.fn().mockResolvedValue({}),
    waitForStatus: vi.fn().mockResolvedValue({
      status: OneClickSwapStatus.SUCCESS,
      settlementTxHash: '0xsettlement',
    }),
  })),
}))

describe('NEARIntentsAdapter', () => {
  let adapter: NEARIntentsAdapter
  let mockClient: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new NEARIntentsAdapter()
    mockClient = (adapter.getClient() as unknown as ReturnType<typeof vi.fn>)
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new NEARIntentsAdapter()
      expect(defaultAdapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should accept custom config', () => {
      const customAdapter = new NEARIntentsAdapter({
        baseUrl: 'https://custom.api.com',
        jwtToken: 'test-jwt',
        defaultSlippage: 50,
        defaultDeadlineOffset: 7200,
      })
      expect(customAdapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should accept pre-configured client', () => {
      const mockClient = new OneClickClient()
      const adapterWithClient = new NEARIntentsAdapter({ client: mockClient })
      expect(adapterWithClient.getClient()).toBe(mockClient)
    })
  })

  // ─── createNEARIntentsAdapter ────────────────────────────────────────────────

  describe('createNEARIntentsAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = createNEARIntentsAdapter()
      expect(adapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should pass config to constructor', () => {
      const adapter = createNEARIntentsAdapter({
        defaultSlippage: 200,
      })
      expect(adapter).toBeInstanceOf(NEARIntentsAdapter)
    })
  })

  // ─── mapAsset ────────────────────────────────────────────────────────────────

  describe('mapAsset', () => {
    it('should map NEAR native token', () => {
      const result = adapter.mapAsset('near', 'NEAR')
      expect(result).toBe('near:mainnet:native')
    })

    it('should map wNEAR', () => {
      const result = adapter.mapAsset('near', 'wNEAR')
      expect(result).toBe('near:mainnet:wrap.near')
    })

    it('should map ETH', () => {
      const result = adapter.mapAsset('ethereum', 'ETH')
      expect(result).toBe('eth:1:native')
    })

    it('should map SOL', () => {
      const result = adapter.mapAsset('solana', 'SOL')
      expect(result).toBe('sol:mainnet:native')
    })

    it('should map ZEC', () => {
      const result = adapter.mapAsset('zcash', 'ZEC')
      expect(result).toBe('zcash:mainnet:native')
    })

    it('should throw for unknown asset', () => {
      expect(() => adapter.mapAsset('bitcoin' as any, 'BTC'))
        .toThrow(ValidationError)
    })
  })

  // ─── mapChainType ────────────────────────────────────────────────────────────

  describe('mapChainType', () => {
    it('should map chain IDs to chain types', () => {
      expect(adapter.mapChainType('near')).toBe('near')
      expect(adapter.mapChainType('ethereum')).toBe('eth')
      expect(adapter.mapChainType('solana')).toBe('sol')
      expect(adapter.mapChainType('zcash')).toBe('zcash')
      expect(adapter.mapChainType('polygon')).toBe('polygon')
      expect(adapter.mapChainType('arbitrum')).toBe('arb')
    })

    it('should throw for unknown chain', () => {
      expect(() => adapter.mapChainType('bitcoin' as any))
        .toThrow(ValidationError)
    })
  })

  // ─── prepareSwap ─────────────────────────────────────────────────────────────

  describe('prepareSwap', () => {
    const validRequest: SwapRequest = {
      requestId: 'req_123',
      privacyLevel: PrivacyLevel.SHIELDED,
      inputAsset: NATIVE_TOKENS.near,
      inputAmount: 1000000000000000000000000n,
      outputAsset: NATIVE_TOKENS.ethereum,
    }

    it('should prepare swap with stealth address for shielded mode', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const prepared = await adapter.prepareSwap(validRequest, metaAddress)

      expect(prepared.request).toBe(validRequest)
      expect(prepared.stealthAddress).toBeDefined()
      expect(prepared.stealthAddress?.address).toMatch(/^0x/)
      expect(prepared.stealthAddress?.ephemeralPublicKey).toMatch(/^0x/)
      expect(prepared.sharedSecret).toMatch(/^0x/)
      expect(prepared.quoteRequest.swapType).toBe(OneClickSwapType.EXACT_INPUT)
      expect(prepared.quoteRequest.originAsset).toBe('near:mainnet:native')
      expect(prepared.quoteRequest.destinationAsset).toBe('eth:1:native')
    })

    it('should accept encoded stealth meta-address string', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = `sip:${metaAddress.chain}:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

      const prepared = await adapter.prepareSwap(validRequest, encoded)

      expect(prepared.stealthAddress).toBeDefined()
    })

    it('should prepare swap for transparent mode without stealth', async () => {
      const transparentRequest = {
        ...validRequest,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      }

      const prepared = await adapter.prepareSwap(
        transparentRequest,
        undefined,
        'user.near'
      )

      expect(prepared.stealthAddress).toBeUndefined()
      expect(prepared.sharedSecret).toBeUndefined()
      expect(prepared.quoteRequest.recipient).toBe('user.near')
    })

    it('should throw if stealth meta-address missing for shielded mode', async () => {
      await expect(adapter.prepareSwap(validRequest))
        .rejects.toThrow('recipientMetaAddress is required')
    })

    it('should throw if sender address missing for transparent mode', async () => {
      const transparentRequest = {
        ...validRequest,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      }

      await expect(adapter.prepareSwap(transparentRequest))
        .rejects.toThrow('senderAddress is required')
    })

    it('should validate request fields', async () => {
      await expect(adapter.prepareSwap({} as any))
        .rejects.toThrow('requestId is required')

      await expect(adapter.prepareSwap({ requestId: 'req' } as any))
        .rejects.toThrow('inputAsset is required')
    })
  })

  // ─── getQuote ────────────────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('should call client.quote with prepared request', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)
      const quote = await adapter.getQuote(prepared)

      expect(mockClient.quote).toHaveBeenCalledWith(prepared.quoteRequest)
      expect(quote.quoteId).toBe('quote_123')
    })
  })

  // ─── getDryQuote ─────────────────────────────────────────────────────────────

  describe('getDryQuote', () => {
    it('should call client.dryQuote', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)
      const quote = await adapter.getDryQuote(prepared)

      expect(mockClient.dryQuote).toHaveBeenCalledWith(prepared.quoteRequest)
      expect(quote.quoteId).toBe('dry_quote_123')
    })
  })

  // ─── initiateSwap ────────────────────────────────────────────────────────────

  describe('initiateSwap', () => {
    it('should return full swap result with stealth data', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.near,
        inputAmount: 1000000000000000000000000n,
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      const result = await adapter.initiateSwap(request, metaAddress)

      expect(result.requestId).toBe('req_123')
      expect(result.quoteId).toBe('quote_123')
      expect(result.depositAddress).toBe('0xdeposit')
      expect(result.amountIn).toBe('1000000000000000000000000')
      expect(result.amountOut).toBe('300000000000000000')
      expect(result.status).toBe(OneClickSwapStatus.PENDING_DEPOSIT)
      expect(result.stealthRecipient).toMatch(/^0x/)
      expect(result.ephemeralPublicKey).toMatch(/^0x/)
    })
  })

  // ─── notifyDeposit ───────────────────────────────────────────────────────────

  describe('notifyDeposit', () => {
    it('should call client.submitDeposit', async () => {
      await adapter.notifyDeposit('0xdeposit', '0xtxhash', 'user.near')

      expect(mockClient.submitDeposit).toHaveBeenCalledWith({
        depositAddress: '0xdeposit',
        txHash: '0xtxhash',
        nearSenderAccount: 'user.near',
      })
    })
  })

  // ─── getStatus ───────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should call client.getStatus', async () => {
      const status = await adapter.getStatus('0xdeposit')

      expect(mockClient.getStatus).toHaveBeenCalledWith('0xdeposit')
      expect(status.status).toBe(OneClickSwapStatus.SUCCESS)
    })
  })

  // ─── waitForCompletion ───────────────────────────────────────────────────────

  describe('waitForCompletion', () => {
    it('should call client.waitForStatus', async () => {
      const options = { interval: 1000, timeout: 60000 }

      const result = await adapter.waitForCompletion('0xdeposit', options)

      expect(mockClient.waitForStatus).toHaveBeenCalledWith('0xdeposit', options)
      expect(result.status).toBe(OneClickSwapStatus.SUCCESS)
    })
  })
})
