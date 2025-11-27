/**
 * Tests for MockEthereumAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockEthereumAdapter,
  createMockEthereumAdapter,
  WalletError,
  EthereumChainId,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type { Asset, UnsignedTransaction } from '@sip-protocol/types'

describe('MockEthereumAdapter', () => {
  let adapter: MockEthereumAdapter

  beforeEach(() => {
    adapter = new MockEthereumAdapter({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b',
      balance: 5_000_000_000_000_000_000n, // 5 ETH
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createMockEthereumAdapter()
      expect(defaultAdapter.chain).toBe('ethereum')
      expect(defaultAdapter.name).toBe('mock-ethereum')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getChainId()).toBe(EthereumChainId.MAINNET)
    })

    it('should initialize with custom values', () => {
      expect(adapter.chain).toBe('ethereum')
      expect(adapter.name).toBe('mock-ethereum')
    })

    it('should accept custom chain ID', () => {
      const polygonAdapter = new MockEthereumAdapter({
        chainId: EthereumChainId.POLYGON,
      })
      expect(polygonAdapter.getChainId()).toBe(EthereumChainId.POLYGON)
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b')
      expect(adapter.publicKey).toMatch(/^0x[0-9a-fA-F]+$/)
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          chain: 'ethereum',
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
      const failingAdapter = new MockEthereumAdapter({
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
      const message = new TextEncoder().encode('Hello Ethereum')
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
      const failingAdapter = new MockEthereumAdapter({
        shouldFailSign: true,
      })
      await failingAdapter.connect()

      await expect(
        failingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'ethereum',
        data: { to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b', value: '0x100' },
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign and send a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'ethereum',
        data: { to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b', value: '0x100' },
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('confirmed')
      expect(receipt.feeUsed).toBe(21000n * 20_000_000_000n)
    })

    it('should fail transaction when configured', async () => {
      const failingAdapter = new MockEthereumAdapter({
        shouldFailTransaction: true,
      })
      await failingAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'ethereum',
        data: {},
      }

      await expect(failingAdapter.signAndSendTransaction(tx)).rejects.toThrow(
        WalletError
      )
    })
  })

  describe('balance', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return ETH balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(5_000_000_000_000_000_000n)
    })

    it('should return native token as ETH balance', async () => {
      const asset: Asset = {
        chain: 'ethereum',
        symbol: 'ETH',
        address: null,
        decimals: 18,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(5_000_000_000_000_000_000n)
    })

    it('should return ERC-20 token balance', async () => {
      const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
      adapter.setMockTokenBalance(tokenAddress, 1_000_000_000n)

      const asset: Asset = {
        chain: 'ethereum',
        symbol: 'USDC',
        address: tokenAddress as `0x${string}`,
        decimals: 6,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(1_000_000_000n)
    })

    it('should return 0 for unknown token', async () => {
      const asset: Asset = {
        chain: 'ethereum',
        symbol: 'UNKNOWN',
        address: '0xUnknownToken123' as `0x${string}`,
        decimals: 18,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(0n)
    })

    it('should throw for non-Ethereum asset', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'SOL',
        address: null,
        decimals: 9,
      }

      await expect(adapter.getTokenBalance(asset)).rejects.toThrow(
        /not supported by Ethereum adapter/
      )
    })
  })

  describe('mock control methods', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should update balance', async () => {
      adapter.setMockBalance(10_000_000_000_000_000_000n)
      const balance = await adapter.getBalance()
      expect(balance).toBe(10_000_000_000_000_000_000n)
    })

    it('should track signed transactions', async () => {
      expect(adapter.getSignedTransactions()).toHaveLength(0)

      await adapter.signTransaction({
        chain: 'ethereum',
        data: { test: 1 },
      })

      expect(adapter.getSignedTransactions()).toHaveLength(1)
    })

    it('should track sent transactions', async () => {
      expect(adapter.getSentTransactions()).toHaveLength(0)

      await adapter.signAndSendTransaction({
        chain: 'ethereum',
        data: { test: 1 },
      })

      expect(adapter.getSentTransactions()).toHaveLength(1)
    })

    it('should clear transaction history', async () => {
      await adapter.signAndSendTransaction({
        chain: 'ethereum',
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

      adapter.simulateAccountChange('0xNewAddress123456789')

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accountChanged',
          previousAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b',
          newAddress: '0xNewAddress123456789',
        })
      )
      expect(adapter.address).toBe('0xNewAddress123456789')
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

describe('createMockEthereumAdapter', () => {
  it('should create adapter with defaults', () => {
    const adapter = createMockEthereumAdapter()
    expect(adapter).toBeInstanceOf(MockEthereumAdapter)
  })

  it('should create adapter with custom config', () => {
    const adapter = createMockEthereumAdapter({
      address: '0xCustomAddress',
      balance: 100n,
    })

    expect(adapter.address).toBe('') // Not connected yet
  })
})
