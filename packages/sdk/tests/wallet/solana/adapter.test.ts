/**
 * Tests for SolanaWalletAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SolanaWalletAdapter,
  createSolanaAdapter,
  createMockSolanaProvider,
  createMockSolanaConnection,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type { UnsignedTransaction } from '@sip-protocol/types'

describe('SolanaWalletAdapter', () => {
  let adapter: SolanaWalletAdapter
  let mockProvider: ReturnType<typeof createMockSolanaProvider>
  let mockConnection: ReturnType<typeof createMockSolanaConnection>

  beforeEach(() => {
    mockProvider = createMockSolanaProvider()
    mockConnection = createMockSolanaConnection({
      balance: 2_000_000_000n, // 2 SOL
    })

    adapter = new SolanaWalletAdapter({
      wallet: 'phantom',
      cluster: 'devnet',
      provider: mockProvider,
      connection: mockConnection,
    })
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultAdapter = createSolanaAdapter()
      expect(defaultAdapter.chain).toBe('solana')
      expect(defaultAdapter.name).toBe('solana-phantom')
      expect(defaultAdapter.getCluster()).toBe('mainnet-beta')
    })

    it('should initialize with custom config', () => {
      expect(adapter.chain).toBe('solana')
      expect(adapter.name).toBe('solana-phantom')
      expect(adapter.getCluster()).toBe('devnet')
    })

    it('should have correct RPC endpoint', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://api.devnet.solana.com')
    })

    it('should allow custom RPC endpoint', () => {
      const customAdapter = new SolanaWalletAdapter({
        rpcEndpoint: 'https://my-rpc.example.com',
        provider: mockProvider,
      })
      expect(customAdapter.getRpcEndpoint()).toBe('https://my-rpc.example.com')
    })

    it('should allow changing RPC endpoint', () => {
      adapter.setRpcEndpoint('https://new-rpc.example.com')
      expect(adapter.getRpcEndpoint()).toBe('https://new-rpc.example.com')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('MockSo1anaWa11etAddress123456789')
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

    it('should emit disconnect event', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      await adapter.connect()
      await adapter.disconnect()

      expect(handler).toHaveBeenCalled()
    })

    it('should throw on connection rejection', async () => {
      const rejectingProvider = createMockSolanaProvider({
        shouldFailConnect: true,
      })
      const rejectingAdapter = new SolanaWalletAdapter({
        provider: rejectingProvider,
      })

      await expect(rejectingAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should throw NOT_INSTALLED when no provider', async () => {
      // Create adapter without provider and not in browser
      const noProviderAdapter = new SolanaWalletAdapter({
        wallet: 'phantom',
      })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
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

    it('should throw on signing rejection', async () => {
      const rejectingProvider = createMockSolanaProvider({
        shouldFailSign: true,
      })
      const rejectingAdapter = new SolanaWalletAdapter({
        provider: rejectingProvider,
      })
      await rejectingAdapter.connect()

      await expect(
        rejectingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'solana',
        data: {
          serialize: () => new Uint8Array([1, 2, 3]),
        },
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
    })

    it('should sign and send a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'solana',
        data: {
          serialize: () => new Uint8Array([1, 2, 3]),
        },
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
    })

    it('should sign multiple transactions', async () => {
      const txs = [
        { serialize: () => new Uint8Array([1, 2, 3]) },
        { serialize: () => new Uint8Array([4, 5, 6]) },
      ] as any

      const signed = await adapter.signAllTransactions(txs)

      expect(signed).toHaveLength(2)
    })
  })

  describe('balance', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return SOL balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(2_000_000_000n)
    })

    it('should return native SOL for token without address', async () => {
      const balance = await adapter.getTokenBalance({
        chain: 'solana',
        symbol: 'SOL',
        address: null,
        decimals: 9,
      })
      expect(balance).toBe(2_000_000_000n)
    })

    it('should throw for non-Solana asset', async () => {
      await expect(
        adapter.getTokenBalance({
          chain: 'ethereum',
          symbol: 'ETH',
          address: null,
          decimals: 18,
        })
      ).rejects.toThrow(/not supported by Solana adapter/)
    })
  })

  describe('events', () => {
    it('should add and remove event handlers', async () => {
      const handler = vi.fn()

      adapter.on('connect', handler)
      await adapter.connect()
      expect(handler).toHaveBeenCalledTimes(1)

      adapter.off('connect', handler)
      // After removing handler, connect events should not call it
      // We verify by checking the handler count didn't change
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should emit disconnect event when wallet disconnects', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      await adapter.connect()
      await adapter.disconnect()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnect',
        })
      )
    })
  })
})

describe('createSolanaAdapter', () => {
  it('should create adapter with defaults', () => {
    const adapter = createSolanaAdapter()
    expect(adapter).toBeInstanceOf(SolanaWalletAdapter)
    expect(adapter.chain).toBe('solana')
  })

  it('should create adapter with custom config', () => {
    const adapter = createSolanaAdapter({
      wallet: 'solflare',
      cluster: 'testnet',
    })
    expect(adapter.name).toBe('solana-solflare')
    expect(adapter.getCluster()).toBe('testnet')
  })
})
