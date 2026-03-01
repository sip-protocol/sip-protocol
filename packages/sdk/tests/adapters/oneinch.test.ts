import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OneInchAdapter } from '../../src/adapters/oneinch'

describe('OneInchAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor', () => {
    it('accepts chain name', () => {
      const adapter = new OneInchAdapter('test-key', 'ethereum')
      expect(adapter.routerAddress).toBe('0x111111125421cA6dc452d289314280a0f8842A65')
    })

    it('accepts chain ID', () => {
      const adapter = new OneInchAdapter('test-key', 1)
      expect(adapter.routerAddress).toBe('0x111111125421cA6dc452d289314280a0f8842A65')
    })

    it('throws for unsupported chain name', () => {
      expect(() => new OneInchAdapter('test-key', 'solana')).toThrow('Unsupported chain')
    })

    it('lists supported chains', () => {
      const chains = OneInchAdapter.supportedChains()
      expect(chains).toContain('ethereum')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('base')
      expect(chains).toContain('optimism')
      expect(chains).toContain('polygon')
      expect(chains).toHaveLength(5)
    })

    it('router address is the same for all chains', () => {
      const eth = new OneInchAdapter('key', 'ethereum')
      const arb = new OneInchAdapter('key', 'arbitrum')
      const base = new OneInchAdapter('key', 'base')
      expect(eth.routerAddress).toBe(arb.routerAddress)
      expect(arb.routerAddress).toBe(base.routerAddress)
    })
  })

  describe('getQuote', () => {
    let adapter: OneInchAdapter

    beforeEach(() => {
      adapter = new OneInchAdapter('test-key', 'ethereum')
    })

    it('calls correct API endpoint with params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          toAmount: '2500000000',
          estimatedGas: '180000',
          protocols: [],
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await adapter.getQuote({
        src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        dst: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1000000000000000000',
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('/swap/v6.0/1/quote')
      expect(url).toContain('src=0xEeee')
      expect(url).toContain('amount=1000000000000000000')
      expect(result.toAmount).toBe('2500000000')

      // Check auth header
      const opts = mockFetch.mock.calls[0][1]
      expect(opts.headers.Authorization).toBe('Bearer test-key')
    })

    it('uses correct chain ID in URL', async () => {
      const arbAdapter = new OneInchAdapter('key', 'arbitrum')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ toAmount: '0', estimatedGas: '0', protocols: [] }),
      }))

      await arbAdapter.getQuote({ src: '0x1', dst: '0x2', amount: '100' })

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('/swap/v6.0/42161/quote')
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      }))

      await expect(
        adapter.getQuote({ src: '0x1', dst: '0x2', amount: '100' })
      ).rejects.toThrow('1inch API error: 429 Too Many Requests')
    })
  })

  describe('getSwapCalldata', () => {
    let adapter: OneInchAdapter

    beforeEach(() => {
      adapter = new OneInchAdapter('test-key', 'arbitrum')
    })

    it('passes destReceiver for stealth address', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tx: {
            to: '0x111111125421cA6dc452d289314280a0f8842A65',
            data: '0x12aa3caf',
            value: '0',
            gas: 300000,
          },
          toAmount: '2500000000',
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await adapter.getSwapCalldata({
        src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        dst: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1000000000000000000',
        from: '0xContractAddr',
        destReceiver: '0xStealthAddr',
        slippage: 1,
      })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('destReceiver=0xStealthAddr')
      expect(url).toContain('from=0xContractAddr')
      expect(url).toContain('/swap/v6.0/42161/swap')
      expect(result.tx.data).toBe('0x12aa3caf')
    })

    it('sets disableEstimate=true by default', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tx: { to: '', data: '', value: '', gas: 0 },
          toAmount: '0',
        }),
      }))

      await adapter.getSwapCalldata({
        src: '0x1', dst: '0x2', amount: '100',
        from: '0x3', destReceiver: '0x4', slippage: 1,
      })

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('disableEstimate=true')
    })

    it('allows overriding disableEstimate', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tx: { to: '', data: '', value: '', gas: 0 },
          toAmount: '0',
        }),
      }))

      await adapter.getSwapCalldata({
        src: '0x1', dst: '0x2', amount: '100',
        from: '0x3', destReceiver: '0x4', slippage: 1,
        disableEstimate: false,
      })

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('disableEstimate=false')
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }))

      await expect(
        adapter.getSwapCalldata({
          src: '0x1', dst: '0x2', amount: '100',
          from: '0x3', destReceiver: '0x4', slippage: 1,
        })
      ).rejects.toThrow('1inch API error: 401 Unauthorized')
    })
  })
})
