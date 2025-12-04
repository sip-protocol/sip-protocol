/**
 * Bitcoin Wallet Adapter Tests
 *
 * Tests for Bitcoin wallet support including Unisat, Xverse, Leather, and OKX.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BitcoinWalletAdapter, createBitcoinAdapter } from '../../src/wallet/bitcoin/adapter'
import {
  detectBitcoinWallets,
  getBitcoinProvider,
  createXverseWrapper,
  createLeatherWrapper,
  type UnisatAPI,
  type XverseAPI,
  type LeatherAPI,
  type BitcoinWalletName,
} from '../../src/wallet/bitcoin/types'
import { WalletErrorCode } from '@sip-protocol/types'

// Mock Unisat API
function createMockUnisatAPI(): UnisatAPI {
  return {
    requestAccounts: vi.fn().mockResolvedValue(['bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy']),
    getAccounts: vi.fn().mockResolvedValue(['bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy']),
    getPublicKey: vi.fn().mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    getBalance: vi.fn().mockResolvedValue({ confirmed: 100000, unconfirmed: 5000, total: 105000 }),
    signPsbt: vi.fn().mockResolvedValue('70736274ff01000000'),
    signMessage: vi.fn().mockResolvedValue('SGVsbG8gQml0Y29pbg=='),
    pushTx: vi.fn().mockResolvedValue('abc123def456'),
    getNetwork: vi.fn().mockResolvedValue('livenet'),
    switchNetwork: vi.fn().mockResolvedValue(undefined),
    getChain: vi.fn().mockResolvedValue({ enum: 'BITCOIN_MAINNET', name: 'Bitcoin Mainnet' }),
  }
}

// Mock Xverse API
function createMockXverseAPI(): XverseAPI {
  return {
    request: vi.fn().mockImplementation((method: string, params?: unknown) => {
      switch (method) {
        case 'getAddresses':
          return Promise.resolve({
            result: {
              addresses: [
                {
                  address: 'bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy',
                  publicKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                  purpose: 'ordinals',
                  addressType: 'p2tr',
                },
                {
                  address: 'bc1q...',
                  publicKey: '02...',
                  purpose: 'payment',
                  addressType: 'p2wpkh',
                },
              ],
            },
          })
        case 'signPsbt':
          return Promise.resolve({
            result: {
              psbt: Buffer.from('70736274ff01000000', 'hex').toString('base64'),
            },
          })
        case 'signMessage':
          return Promise.resolve({
            result: {
              signature: 'SGVsbG8gQml0Y29pbg==',
              messageHash: 'abc123',
              address: 'bc1p...',
            },
          })
        case 'sendTransfer':
          return Promise.resolve({
            result: { txid: 'abc123def456' },
          })
        default:
          return Promise.reject(new Error('Unknown method'))
      }
    }),
  } as unknown as XverseAPI
}

// Mock Leather API
function createMockLeatherAPI(): LeatherAPI {
  return {
    request: vi.fn().mockImplementation((method: string, params?: unknown) => {
      switch (method) {
        case 'getAddresses':
          return Promise.resolve({
            result: {
              addresses: [
                {
                  symbol: 'BTC',
                  type: 'p2tr',
                  address: 'bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy',
                  publicKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                },
                {
                  symbol: 'STX',
                  address: 'SP...',
                  publicKey: '03...',
                },
              ],
            },
          })
        case 'signPsbt':
          return Promise.resolve({
            result: {
              hex: '70736274ff01000000',
            },
          })
        case 'signMessage':
          return Promise.resolve({
            result: {
              signature: 'SGVsbG8gQml0Y29pbg==',
              address: 'bc1p...',
              message: 'Hello Bitcoin',
            },
          })
        case 'sendTransfer':
          return Promise.resolve({
            result: { txid: 'abc123def456' },
          })
        default:
          return Promise.reject(new Error('Unknown method'))
      }
    }),
  } as unknown as LeatherAPI
}

describe('Bitcoin Wallet Adapter', () => {
  describe('BitcoinWalletAdapter', () => {
    let adapter: BitcoinWalletAdapter
    let mockProvider: UnisatAPI

    beforeEach(() => {
      mockProvider = createMockUnisatAPI()
      adapter = new BitcoinWalletAdapter({
        wallet: 'unisat',
        provider: mockProvider,
      })
    })

    it('should create adapter with default config', () => {
      const defaultAdapter = createBitcoinAdapter()
      expect(defaultAdapter.chain).toBe('bitcoin')
      expect(defaultAdapter.name).toBe('bitcoin-unisat')
    })

    it('should connect to wallet', async () => {
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
      expect(adapter.address).toBe('bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy')
      expect(mockProvider.requestAccounts).toHaveBeenCalled()
      expect(mockProvider.getPublicKey).toHaveBeenCalled()
    })

    it('should get balance after connect', async () => {
      await adapter.connect()
      const balance = await adapter.getBalance()
      expect(balance).toBe(105000n)
      expect(mockProvider.getBalance).toHaveBeenCalled()
    })

    it('should get detailed balance', async () => {
      await adapter.connect()
      const details = await adapter.getBalanceDetails()
      expect(details.confirmed).toBe(100000n)
      expect(details.unconfirmed).toBe(5000n)
      expect(details.total).toBe(105000n)
    })

    it('should sign message', async () => {
      await adapter.connect()
      const message = new TextEncoder().encode('Hello Bitcoin')
      const sig = await adapter.signMessage(message)
      expect(sig.signature).toMatch(/^0x/)
      expect(mockProvider.signMessage).toHaveBeenCalledWith('Hello Bitcoin', 'bip322-simple')
    })

    it('should sign PSBT', async () => {
      await adapter.connect()
      const signedPsbt = await adapter.signPsbt('70736274ff01000000')
      expect(signedPsbt).toBe('70736274ff01000000')
      expect(mockProvider.signPsbt).toHaveBeenCalled()
    })

    it('should sign transaction', async () => {
      await adapter.connect()
      const signed = await adapter.signTransaction({
        data: '70736274ff01000000',
        chain: 'bitcoin',
      })
      expect(signed.serialized).toMatch(/^0x/)
    })

    it('should get network', () => {
      expect(adapter.getNetwork()).toBe('livenet')
    })

    it('should throw when not connected', async () => {
      await expect(adapter.getBalance()).rejects.toThrow()
    })

    it('should disconnect', async () => {
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })
  })

  describe('Xverse Wallet Wrapper', () => {
    let xverseApi: XverseAPI
    let wrapper: UnisatAPI

    beforeEach(() => {
      xverseApi = createMockXverseAPI()
      wrapper = createXverseWrapper(xverseApi)
    })

    it('should request accounts', async () => {
      const accounts = await wrapper.requestAccounts()
      expect(accounts).toContain('bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy')
      expect(xverseApi.request).toHaveBeenCalledWith('getAddresses')
    })

    it('should get public key', async () => {
      await wrapper.requestAccounts()
      const publicKey = await wrapper.getPublicKey()
      expect(publicKey).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
    })

    it('should sign PSBT', async () => {
      await wrapper.requestAccounts()
      const signed = await wrapper.signPsbt('70736274ff01000000')
      expect(signed).toBeTruthy()
    })

    it('should sign message', async () => {
      await wrapper.requestAccounts()
      const signature = await wrapper.signMessage('Hello Bitcoin', 'bip322-simple')
      expect(signature).toBe('SGVsbG8gQml0Y29pbg==')
    })

    it('should return balance as zeros (not supported)', async () => {
      const balance = await wrapper.getBalance()
      expect(balance.total).toBe(0)
    })
  })

  describe('Leather Wallet Wrapper', () => {
    let leatherApi: LeatherAPI
    let wrapper: UnisatAPI

    beforeEach(() => {
      leatherApi = createMockLeatherAPI()
      wrapper = createLeatherWrapper(leatherApi)
    })

    it('should request accounts', async () => {
      const accounts = await wrapper.requestAccounts()
      expect(accounts).toContain('bc1p7wqj8q5kq2q3q4q5q6q7q8q9qaqbqcqdqeqfqgqhqjqkqlqmqnqpqrqsqtquqvqwqxqy')
      expect(leatherApi.request).toHaveBeenCalledWith('getAddresses')
    })

    it('should get public key', async () => {
      await wrapper.requestAccounts()
      const publicKey = await wrapper.getPublicKey()
      expect(publicKey).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
    })

    it('should sign PSBT', async () => {
      const signed = await wrapper.signPsbt('70736274ff01000000')
      expect(signed).toBe('70736274ff01000000')
    })

    it('should sign message', async () => {
      const signature = await wrapper.signMessage('Hello Bitcoin')
      expect(signature).toBe('SGVsbG8gQml0Y29pbg==')
    })

    it('should filter only BTC addresses', async () => {
      const accounts = await wrapper.requestAccounts()
      // Should not include STX address
      expect(accounts.every((a) => a.startsWith('bc1'))).toBe(true)
    })
  })

  describe('Wallet Detection', () => {
    it('should detect no wallets in non-browser environment', () => {
      const wallets = detectBitcoinWallets()
      expect(wallets).toEqual([])
    })

    it('should return undefined provider for unknown wallet', () => {
      const provider = getBitcoinProvider('unknown' as BitcoinWalletName)
      expect(provider).toBeUndefined()
    })
  })

  describe('BRC-20 Token Balance', () => {
    let adapter: BitcoinWalletAdapter
    let mockProvider: UnisatAPI

    beforeEach(async () => {
      mockProvider = createMockUnisatAPI()
      adapter = new BitcoinWalletAdapter({
        wallet: 'unisat',
        provider: mockProvider,
      })
      await adapter.connect()
    })

    it('should throw for non-bitcoin assets', async () => {
      await expect(
        adapter.getTokenBalance({ chain: 'ethereum', symbol: 'ETH', decimals: 18 })
      ).rejects.toThrow('not supported')
    })

    it('should return 0 for unknown tokens', async () => {
      // Mock fetch to return 404
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const balance = await adapter.getTokenBalance({
        chain: 'bitcoin',
        symbol: 'UNKNOWN',
        decimals: 18,
      })
      expect(balance).toBe(0n)
    })
  })

  describe('PSBT Finalization', () => {
    let adapter: BitcoinWalletAdapter
    let mockProvider: UnisatAPI

    beforeEach(async () => {
      mockProvider = createMockUnisatAPI()
      adapter = new BitcoinWalletAdapter({
        wallet: 'unisat',
        provider: mockProvider,
      })
      await adapter.connect()
    })

    it('should sign and send with autoFinalized', async () => {
      const receipt = await adapter.signAndSendTransaction({
        data: '70736274ff01000000',
        chain: 'bitcoin',
      })

      expect(receipt.txHash).toMatch(/^0x/)
      expect(receipt.status).toBe('pending')
      expect(mockProvider.signPsbt).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ autoFinalized: true })
      )
    })

    it('should handle transaction rejection', async () => {
      mockProvider.signPsbt = vi.fn().mockRejectedValue(new Error('User rejected'))

      await expect(
        adapter.signAndSendTransaction({
          data: '70736274ff01000000',
          chain: 'bitcoin',
        })
      ).rejects.toThrow('User rejected')
    })
  })

  describe('Multi-wallet Support', () => {
    it('should create adapters for all wallet types', () => {
      const walletTypes: BitcoinWalletName[] = ['unisat', 'xverse', 'leather', 'okx']

      for (const wallet of walletTypes) {
        const adapter = createBitcoinAdapter({ wallet })
        expect(adapter.name).toBe(`bitcoin-${wallet}`)
        expect(adapter.chain).toBe('bitcoin')
      }
    })
  })
})
