/**
 * Tests for BitcoinWalletAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BitcoinWalletAdapter,
  createBitcoinAdapter,
  createMockBitcoinProvider,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  Asset,
  UnsignedTransaction,
  UnisatAPI,
} from '../../../src/wallet'

describe('BitcoinWalletAdapter', () => {
  let adapter: BitcoinWalletAdapter
  let mockProvider: UnisatAPI

  beforeEach(() => {
    mockProvider = createMockBitcoinProvider({
      address: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
      publicKey: 'a3c89044f0057b4e6f0abf99a35b4df9c2e8dbfe0c9db9e5d1f8d08e8e09a9c1',
      balance: 100_000_000n,
    })

    adapter = new BitcoinWalletAdapter({
      wallet: 'unisat',
      provider: mockProvider,
    })
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAdapter = createBitcoinAdapter()
      expect(defaultAdapter.chain).toBe('bitcoin')
      expect(defaultAdapter.name).toBe('bitcoin-unisat')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getNetwork()).toBe('livenet')
    })

    it('should initialize with custom wallet', () => {
      const okxAdapter = createBitcoinAdapter({ wallet: 'okx' })
      expect(okxAdapter.name).toBe('bitcoin-okx')
    })

    it('should initialize with custom network', () => {
      const testnetAdapter = createBitcoinAdapter({ network: 'testnet' })
      expect(testnetAdapter.getNetwork()).toBe('testnet')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          chain: 'bitcoin',
          address: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
        })
      )
    })

    it('should disconnect successfully', async () => {
      await adapter.connect()

      const handler = vi.fn()
      adapter.on('disconnect', handler)

      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(adapter.connectionState).toBe('disconnected')
      expect(handler).toHaveBeenCalled()
    })

    it('should handle connection rejection', async () => {
      const rejectingProvider = createMockBitcoinProvider({
        shouldFailConnect: true,
      })

      const rejectingAdapter = new BitcoinWalletAdapter({
        provider: rejectingProvider,
      })

      await expect(rejectingAdapter.connect()).rejects.toThrow(WalletError)
      await expect(rejectingAdapter.connect()).rejects.toThrow(/rejected|cancelled/)
    })

    it('should throw if wallet not installed', async () => {
      const noProviderAdapter = new BitcoinWalletAdapter({ wallet: 'unisat' })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
      await expect(noProviderAdapter.connect()).rejects.toThrow(/not installed/)
    })
  })

  describe('signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign a message', async () => {
      const message = new TextEncoder().encode('Hello Bitcoin')
      const signature = await adapter.signMessage(message)

      expect(signature.signature).toMatch(/^0x[0-9a-f]+$/)
      expect(signature.publicKey).toBe(adapter.publicKey)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      await expect(
        adapter.signMessage(new TextEncoder().encode('test'))
      ).rejects.toThrow(WalletError)
      await expect(
        adapter.signMessage(new TextEncoder().encode('test'))
      ).rejects.toThrow(/not connected/i)
    })

    it('should handle signing rejection', async () => {
      const rejectingProvider = createMockBitcoinProvider({
        shouldFailSign: true,
      })

      const rejectingAdapter = new BitcoinWalletAdapter({
        provider: rejectingProvider,
      })

      await rejectingAdapter.connect()

      await expect(
        rejectingAdapter.signMessage(new TextEncoder().encode('test'))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a PSBT', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: psbtHex,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign PSBT with options', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: psbtHex,
        metadata: {
          signPsbtOptions: {
            autoFinalized: true,
            toSignInputs: [{ index: 0 }],
          },
        },
      }

      const signed = await adapter.signTransaction(tx)
      expect(signed).toBeDefined()
    })

    it('should sign and send transaction', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: psbtHex,
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
      expect(receipt.timestamp).toBeGreaterThan(0)
    })

    it('should handle transaction rejection', async () => {
      const rejectingProvider = createMockBitcoinProvider({
        shouldFailSign: true,
      })

      const rejectingAdapter = new BitcoinWalletAdapter({
        provider: rejectingProvider,
      })

      await rejectingAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: '70736274ff01000000000000000000',
      }

      await expect(
        rejectingAdapter.signAndSendTransaction(tx)
      ).rejects.toThrow(WalletError)
    })

    it('should handle transaction failure', async () => {
      const failingProvider = createMockBitcoinProvider({
        shouldFailTransaction: true,
      })

      const failingAdapter = new BitcoinWalletAdapter({
        provider: failingProvider,
      })

      await failingAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: '70736274ff01000000000000000000',
      }

      await expect(
        failingAdapter.signAndSendTransaction(tx)
      ).rejects.toThrow(WalletError)
    })
  })

  describe('PSBT operations', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign PSBT directly', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const signed = await adapter.signPsbt(psbtHex)

      expect(signed).toBeDefined()
      expect(signed).toContain(psbtHex)
    })

    it('should sign PSBT with options', async () => {
      const psbtHex = '70736274ff01000000000000000000'
      const options = {
        autoFinalized: true,
        toSignInputs: [{ index: 0, address: adapter.address }],
      }

      const signed = await adapter.signPsbt(psbtHex, options)

      expect(signed).toBeDefined()
    })

    it('should push raw transaction', async () => {
      const rawTx = '0200000000010100000000000000000000'

      const txid = await adapter.pushTx(rawTx)

      expect(txid).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle transaction broadcast failure', async () => {
      const failingProvider = createMockBitcoinProvider({
        shouldFailTransaction: true,
      })

      const failingAdapter = new BitcoinWalletAdapter({
        provider: failingProvider,
      })

      await failingAdapter.connect()

      await expect(
        failingAdapter.pushTx('0200000000010100000000000000000000')
      ).rejects.toThrow(WalletError)
    })
  })

  describe('balance queries', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should get native BTC balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(100_000_000n)
    })

    it('should get detailed balance', async () => {
      const balance = await adapter.getBalanceDetails()

      expect(balance.total).toBe(100_000_000n)
      expect(balance.confirmed).toBe(90_000_000n)
      expect(balance.unconfirmed).toBe(10_000_000n)
    })

    it('should get token balance (returns 0 for now)', async () => {
      const asset: Asset = {
        chain: 'bitcoin',
        symbol: 'BRC20',
        address: 'inscription123',
        decimals: 8,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(0n)
    })

    it('should throw for wrong chain', async () => {
      const asset: Asset = {
        chain: 'ethereum',
        symbol: 'ETH',
        decimals: 18,
      }

      await expect(adapter.getTokenBalance(asset)).rejects.toThrow(WalletError)
      await expect(adapter.getTokenBalance(asset)).rejects.toThrow(/not supported/)
    })

    it('should handle balance query errors', async () => {
      const errorProvider = {
        ...mockProvider,
        getBalance: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      const errorAdapter = new BitcoinWalletAdapter({
        provider: errorProvider as unknown as UnisatAPI,
      })

      await errorAdapter.connect()

      await expect(errorAdapter.getBalance()).rejects.toThrow(WalletError)
    })
  })

  describe('address queries', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should get addresses', async () => {
      const addresses = await adapter.getAddresses()

      expect(addresses).toHaveLength(1)
      expect(addresses[0].address).toBe('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')
      expect(addresses[0].type).toBe('p2tr')
      expect(addresses[0].publicKey).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle address query errors', async () => {
      const errorProvider = {
        ...mockProvider,
        getAccounts: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      const errorAdapter = new BitcoinWalletAdapter({
        provider: errorProvider as unknown as UnisatAPI,
      })

      await errorAdapter.connect()

      await expect(errorAdapter.getAddresses()).rejects.toThrow(WalletError)
    })
  })

  describe('network management', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should get current network', () => {
      expect(adapter.getNetwork()).toBe('livenet')
    })

    it('should switch network', async () => {
      await adapter.setNetwork('testnet')
      expect(adapter.getNetwork()).toBe('testnet')
    })

    it('should handle network switch errors', async () => {
      const errorProvider = {
        ...mockProvider,
        switchNetwork: vi.fn().mockRejectedValue(new Error('Network switch failed')),
      }

      const errorAdapter = new BitcoinWalletAdapter({
        provider: errorProvider as unknown as UnisatAPI,
      })

      await errorAdapter.connect()

      await expect(errorAdapter.setNetwork('testnet')).rejects.toThrow(WalletError)
    })
  })

  describe('error handling', () => {
    it('should handle connection timeout', async () => {
      const timeoutProvider = {
        ...mockProvider,
        requestAccounts: vi.fn().mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        ),
      }

      const timeoutAdapter = new BitcoinWalletAdapter({
        provider: timeoutProvider as unknown as UnisatAPI,
      })

      await expect(timeoutAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should handle invalid address format', async () => {
      const invalidProvider = {
        ...mockProvider,
        requestAccounts: vi.fn().mockResolvedValue(['invalid-address']),
      }

      const invalidAdapter = new BitcoinWalletAdapter({
        provider: invalidProvider as unknown as UnisatAPI,
      })

      await expect(invalidAdapter.connect()).rejects.toThrow(WalletError)
      await expect(invalidAdapter.connect()).rejects.toThrow(/invalid.*address/i)
    })

    it('should handle empty accounts', async () => {
      const emptyProvider = {
        ...mockProvider,
        requestAccounts: vi.fn().mockResolvedValue([]),
      }

      const emptyAdapter = new BitcoinWalletAdapter({
        provider: emptyProvider as unknown as UnisatAPI,
      })

      await expect(emptyAdapter.connect()).rejects.toThrow(WalletError)
      await expect(emptyAdapter.connect()).rejects.toThrow(/no accounts/i)
    })
  })
})
