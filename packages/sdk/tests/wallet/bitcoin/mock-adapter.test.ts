/**
 * Tests for MockBitcoinAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockBitcoinAdapter,
  createMockBitcoinAdapter,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  Asset,
  UnsignedTransaction,
} from '@sip-protocol/types'

describe('MockBitcoinAdapter', () => {
  let adapter: MockBitcoinAdapter

  beforeEach(() => {
    adapter = new MockBitcoinAdapter({
      address: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
      balance: 100_000_000n, // 1 BTC
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createMockBitcoinAdapter()
      expect(defaultAdapter.chain).toBe('bitcoin')
      expect(defaultAdapter.name).toBe('mock-bitcoin')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getNetwork()).toBe('livenet')
    })

    it('should initialize with custom values', () => {
      expect(adapter.chain).toBe('bitcoin')
      expect(adapter.name).toBe('mock-bitcoin')
      expect(adapter.getNetwork()).toBe('livenet')
    })

    it('should accept custom network', () => {
      const testnetAdapter = new MockBitcoinAdapter({
        network: 'testnet',
      })
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
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          chain: 'bitcoin',
        })
      )
    })

    it('should disconnect successfully', async () => {
      await adapter.connect()
      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(adapter.connectionState).toBe('disconnected')
    })

    it('should fail connection when configured', async () => {
      const failingAdapter = new MockBitcoinAdapter({
        shouldFailConnect: true,
      })

      await expect(failingAdapter.connect()).rejects.toThrow(WalletError)
      expect(failingAdapter.connectionState).toBe('error')
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
      expect(adapter.getSignedMessages()).toContain('Hello Bitcoin')
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      await expect(
        adapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should fail signing when configured', async () => {
      const failingAdapter = new MockBitcoinAdapter({
        shouldFailSign: true,
      })
      await failingAdapter.connect()

      await expect(
        failingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a PSBT', async () => {
      const psbtHex = '70736274ff01000000000000000000' // Mock PSBT hex

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: psbtHex,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
      expect(adapter.getSignedPsbts()).toContain(psbtHex)
    })

    it('should sign and send a transaction', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const tx: UnsignedTransaction = {
        chain: 'bitcoin',
        data: psbtHex,
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
      expect(adapter.getBroadcastTransactions().length).toBeGreaterThan(0)
    })

    it('should fail transaction when configured', async () => {
      const failingAdapter = new MockBitcoinAdapter({
        shouldFailTransaction: true,
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

  describe('PSBT signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign PSBT directly', async () => {
      const psbtHex = '70736274ff01000000000000000000'

      const signed = await adapter.signPsbt(psbtHex)

      expect(signed).toBeDefined()
      expect(signed).toContain(psbtHex)
      expect(adapter.getSignedPsbts()).toContain(psbtHex)
    })

    it('should sign PSBT with options', async () => {
      const psbtHex = '70736274ff01000000000000000000'
      const options = {
        autoFinalized: true,
        toSignInputs: [{ index: 0 }],
      }

      const signed = await adapter.signPsbt(psbtHex, options)

      expect(signed).toBeDefined()
    })

    it('should track signed PSBTs', async () => {
      const psbt1 = '70736274ff01000000000000000001'
      const psbt2 = '70736274ff01000000000000000002'

      await adapter.signPsbt(psbt1)
      await adapter.signPsbt(psbt2)

      const signed = adapter.getSignedPsbts()
      expect(signed).toHaveLength(2)
      expect(signed).toContain(psbt1)
      expect(signed).toContain(psbt2)
    })
  })

  describe('transaction broadcasting', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should push raw transaction', async () => {
      const rawTx = '0200000000010100000000000000000000'

      const txid = await adapter.pushTx(rawTx)

      expect(txid).toMatch(/^[0-9a-f]{64}$/)
      expect(adapter.getBroadcastTransactions()).toContain(txid)
    })

    it('should track broadcast transactions', async () => {
      const rawTx1 = '0200000000010100000000000000000001'
      const rawTx2 = '0200000000010100000000000000000002'

      const txid1 = await adapter.pushTx(rawTx1)
      const txid2 = await adapter.pushTx(rawTx2)

      const broadcast = adapter.getBroadcastTransactions()
      expect(broadcast).toHaveLength(2)
      expect(broadcast).toContain(txid1)
      expect(broadcast).toContain(txid2)
    })
  })

  describe('balance queries', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should get native balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(100_000_000n)
    })

    it('should get detailed balance', async () => {
      const balance = await adapter.getBalanceDetails()

      expect(balance.total).toBe(100_000_000n)
      expect(balance.confirmed).toBeGreaterThan(0n)
      expect(balance.unconfirmed).toBeGreaterThanOrEqual(0n)
      expect(balance.confirmed + balance.unconfirmed).toBe(balance.total)
    })

    it('should get token balance', async () => {
      adapter.setMockTokenBalance('inscription123', 5_000_000n)

      const asset: Asset = {
        chain: 'bitcoin',
        symbol: 'BRC20',
        address: 'inscription123',
        decimals: 8,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(5_000_000n)
    })

    it('should return 0 for unknown token', async () => {
      const asset: Asset = {
        chain: 'bitcoin',
        symbol: 'UNKNOWN',
        address: 'unknown',
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

    it('should simulate network change', () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      adapter.simulateNetworkChange('testnet')

      expect(adapter.getNetwork()).toBe('testnet')
      expect(adapter.isConnected()).toBe(false)
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('mock control methods', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should update mock balance', async () => {
      adapter.setMockBalance(200_000_000n)
      const balance = await adapter.getBalance()
      expect(balance).toBe(200_000_000n)
    })

    it('should update mock token balance', async () => {
      adapter.setMockTokenBalance('inscription456', 10_000_000n)

      const asset: Asset = {
        chain: 'bitcoin',
        symbol: 'BRC20',
        address: 'inscription456',
        decimals: 8,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(10_000_000n)
    })

    it('should clear transaction history', async () => {
      await adapter.signPsbt('70736274ff01000000000000000001')
      await adapter.signMessage(new TextEncoder().encode('test'))
      await adapter.pushTx('0200000000010100000000000000000001')

      expect(adapter.getSignedPsbts()).toHaveLength(1)
      expect(adapter.getSignedMessages()).toHaveLength(1)
      expect(adapter.getBroadcastTransactions()).toHaveLength(1)

      adapter.clearTransactionHistory()

      expect(adapter.getSignedPsbts()).toHaveLength(0)
      expect(adapter.getSignedMessages()).toHaveLength(0)
      expect(adapter.getBroadcastTransactions()).toHaveLength(0)
    })

    it('should simulate account change', async () => {
      const handler = vi.fn()
      adapter.on('accountChanged', handler)

      const newAddress = 'bc1p9876543210abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrst12345'
      adapter.simulateAccountChange(newAddress)

      expect(adapter.address).toBe(newAddress)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accountChanged',
          previousAddress: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
          newAddress,
        })
      )
    })

    it('should simulate disconnect', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      adapter.simulateDisconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnect',
        })
      )
    })
  })

  describe('latency simulation', () => {
    it('should simulate network latency', async () => {
      const slowAdapter = new MockBitcoinAdapter({
        latency: 100,
      })

      const start = Date.now()
      await slowAdapter.connect()
      const elapsed = Date.now() - start

      // Allow 5ms tolerance for timer imprecision on CI
      expect(elapsed).toBeGreaterThanOrEqual(95)
    })

    it('should work with zero latency', async () => {
      const fastAdapter = new MockBitcoinAdapter({
        latency: 0,
      })

      const start = Date.now()
      await fastAdapter.connect()
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(50)
    })
  })
})
