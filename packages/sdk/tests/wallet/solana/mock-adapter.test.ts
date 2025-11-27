/**
 * Tests for MockSolanaAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockSolanaAdapter,
  createMockSolanaAdapter,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type { Asset, UnsignedTransaction } from '@sip-protocol/types'

describe('MockSolanaAdapter', () => {
  let adapter: MockSolanaAdapter

  beforeEach(() => {
    adapter = new MockSolanaAdapter({
      address: 'TestAddress123',
      balance: 5_000_000_000n, // 5 SOL
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createMockSolanaAdapter()
      expect(defaultAdapter.chain).toBe('solana')
      expect(defaultAdapter.name).toBe('mock-solana')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getCluster()).toBe('devnet')
    })

    it('should initialize with custom values', () => {
      expect(adapter.chain).toBe('solana')
      expect(adapter.name).toBe('mock-solana')
    })

    it('should accept custom cluster', () => {
      const mainnetAdapter = new MockSolanaAdapter({
        cluster: 'mainnet-beta',
      })
      expect(mainnetAdapter.getCluster()).toBe('mainnet-beta')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('TestAddress123')
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          chain: 'solana',
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
      const failingAdapter = new MockSolanaAdapter({
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
      const message = new TextEncoder().encode('Hello Solana')
      const signature = await adapter.signMessage(message)

      expect(signature.signature).toMatch(/^0x[0-9a-f]+$/)
      expect(signature.publicKey).toBe(adapter.publicKey)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      await expect(
        adapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should fail signing when configured', async () => {
      const failingAdapter = new MockSolanaAdapter({
        shouldFailSign: true,
      })
      await failingAdapter.connect()

      await expect(
        failingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'solana',
        data: { to: 'recipient', amount: 100 },
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign and send a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'solana',
        data: { to: 'recipient', amount: 100 },
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('confirmed')
      expect(receipt.feeUsed).toBe(5000n)
    })

    it('should fail transaction when configured', async () => {
      const failingAdapter = new MockSolanaAdapter({
        shouldFailTransaction: true,
      })
      await failingAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'solana',
        data: {},
      }

      await expect(failingAdapter.signAndSendTransaction(tx)).rejects.toThrow(
        WalletError
      )
    })

    it('should sign multiple transactions', async () => {
      const txs = [
        { serialize: () => new Uint8Array([1, 2, 3]) },
        { serialize: () => new Uint8Array([4, 5, 6]) },
      ] as any

      const signed = await adapter.signAllTransactions(txs)

      expect(signed).toHaveLength(2)
      expect(adapter.getSignedTransactions()).toHaveLength(2)
    })
  })

  describe('balance', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return SOL balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(5_000_000_000n)
    })

    it('should return native token as SOL balance', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'SOL',
        address: null,
        decimals: 9,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(5_000_000_000n)
    })

    it('should return SPL token balance', async () => {
      const mintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
      adapter.setMockTokenBalance(mintAddress, 1_000_000_000n)

      const asset: Asset = {
        chain: 'solana',
        symbol: 'USDC',
        address: mintAddress as `0x${string}`,
        decimals: 6,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(1_000_000_000n)
    })

    it('should return 0 for unknown token', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'UNKNOWN',
        address: 'UnknownMint123' as `0x${string}`,
        decimals: 9,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(0n)
    })

    it('should throw for non-Solana asset', async () => {
      const asset: Asset = {
        chain: 'ethereum',
        symbol: 'ETH',
        address: null,
        decimals: 18,
      }

      await expect(adapter.getTokenBalance(asset)).rejects.toThrow(
        /not supported by Solana adapter/
      )
    })
  })

  describe('mock control methods', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should update balance', async () => {
      adapter.setMockBalance(10_000_000_000n)
      const balance = await adapter.getBalance()
      expect(balance).toBe(10_000_000_000n)
    })

    it('should track signed transactions', async () => {
      expect(adapter.getSignedTransactions()).toHaveLength(0)

      await adapter.signTransaction({
        chain: 'solana',
        data: { test: 1 },
      })

      expect(adapter.getSignedTransactions()).toHaveLength(1)
    })

    it('should track sent transactions', async () => {
      expect(adapter.getSentTransactions()).toHaveLength(0)

      await adapter.signAndSendTransaction({
        chain: 'solana',
        data: { test: 1 },
      })

      expect(adapter.getSentTransactions()).toHaveLength(1)
    })

    it('should clear transaction history', async () => {
      await adapter.signAndSendTransaction({
        chain: 'solana',
        data: { test: 1 },
      })

      expect(adapter.getSentTransactions()).toHaveLength(1)

      adapter.clearTransactionHistory()

      expect(adapter.getSentTransactions()).toHaveLength(0)
      expect(adapter.getSignedTransactions()).toHaveLength(0)
    })

    it('should simulate account change', async () => {
      const handler = vi.fn()
      adapter.on('accountChanged', handler)

      adapter.simulateAccountChange('NewAddress456')

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accountChanged',
          previousAddress: 'TestAddress123',
          newAddress: 'NewAddress456',
        })
      )
      expect(adapter.address).toBe('NewAddress456')
    })

    it('should simulate disconnect', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      adapter.simulateDisconnect()

      expect(handler).toHaveBeenCalled()
      expect(adapter.isConnected()).toBe(false)
    })
  })
})

describe('createMockSolanaAdapter', () => {
  it('should create adapter with defaults', () => {
    const adapter = createMockSolanaAdapter()
    expect(adapter).toBeInstanceOf(MockSolanaAdapter)
  })

  it('should create adapter with custom config', () => {
    const adapter = createMockSolanaAdapter({
      address: 'CustomAddress',
      balance: 100n,
    })

    expect(adapter.address).toBe('')  // Not connected yet
  })
})
