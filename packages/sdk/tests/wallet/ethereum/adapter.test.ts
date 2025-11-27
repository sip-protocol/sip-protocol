/**
 * Tests for EthereumWalletAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EthereumWalletAdapter,
  createEthereumAdapter,
  createMockEthereumProvider,
  WalletError,
  EthereumChainId,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type { UnsignedTransaction } from '@sip-protocol/types'

describe('EthereumWalletAdapter', () => {
  let adapter: EthereumWalletAdapter
  let mockProvider: ReturnType<typeof createMockEthereumProvider>

  beforeEach(() => {
    mockProvider = createMockEthereumProvider({
      balance: 2_000_000_000_000_000_000n, // 2 ETH
    })

    adapter = new EthereumWalletAdapter({
      wallet: 'metamask',
      chainId: EthereumChainId.MAINNET,
      provider: mockProvider,
    })
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultAdapter = createEthereumAdapter()
      expect(defaultAdapter.chain).toBe('ethereum')
      expect(defaultAdapter.name).toBe('ethereum-metamask')
      expect(defaultAdapter.getChainId()).toBe(EthereumChainId.MAINNET)
    })

    it('should initialize with custom config', () => {
      expect(adapter.chain).toBe('ethereum')
      expect(adapter.name).toBe('ethereum-metamask')
      expect(adapter.getChainId()).toBe(EthereumChainId.MAINNET)
    })

    it('should have correct RPC endpoint', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://eth.llamarpc.com')
    })

    it('should allow custom RPC endpoint', () => {
      const customAdapter = new EthereumWalletAdapter({
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
      expect(adapter.address).toMatch(/^0x[0-9a-f]+$/)
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]+$/)
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

    it('should emit disconnect event', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      await adapter.connect()
      await adapter.disconnect()

      expect(handler).toHaveBeenCalled()
    })

    it('should throw on connection rejection', async () => {
      const rejectingProvider = createMockEthereumProvider({
        shouldFailConnect: true,
      })
      const rejectingAdapter = new EthereumWalletAdapter({
        provider: rejectingProvider,
      })

      await expect(rejectingAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should throw NOT_INSTALLED when no provider', async () => {
      const noProviderAdapter = new EthereumWalletAdapter({
        wallet: 'metamask',
      })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
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

    it('should throw on signing rejection', async () => {
      const rejectingProvider = createMockEthereumProvider({
        shouldFailSign: true,
      })
      const rejectingAdapter = new EthereumWalletAdapter({
        provider: rejectingProvider,
      })
      await rejectingAdapter.connect()

      await expect(
        rejectingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'ethereum',
        data: {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b',
          value: '0x100',
        },
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
    })

    it('should sign and send a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'ethereum',
        data: {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b',
          value: '0x100',
        },
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
    })
  })

  describe('balance', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return ETH balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(2_000_000_000_000_000_000n)
    })

    it('should return native ETH for token without address', async () => {
      const balance = await adapter.getTokenBalance({
        chain: 'ethereum',
        symbol: 'ETH',
        address: null,
        decimals: 18,
      })
      expect(balance).toBe(2_000_000_000_000_000_000n)
    })

    it('should throw for non-Ethereum asset', async () => {
      await expect(
        adapter.getTokenBalance({
          chain: 'solana',
          symbol: 'SOL',
          address: null,
          decimals: 9,
        })
      ).rejects.toThrow(/not supported by Ethereum adapter/)
    })
  })

  describe('events', () => {
    it('should add and remove event handlers', async () => {
      const handler = vi.fn()

      adapter.on('connect', handler)
      await adapter.connect()
      expect(handler).toHaveBeenCalledTimes(1)

      adapter.off('connect', handler)
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

describe('createEthereumAdapter', () => {
  it('should create adapter with defaults', () => {
    const adapter = createEthereumAdapter()
    expect(adapter).toBeInstanceOf(EthereumWalletAdapter)
    expect(adapter.chain).toBe('ethereum')
  })

  it('should create adapter with custom config', () => {
    const adapter = createEthereumAdapter({
      wallet: 'coinbase',
      chainId: EthereumChainId.POLYGON,
    })
    expect(adapter.name).toBe('ethereum-coinbase')
    expect(adapter.getChainId()).toBe(EthereumChainId.POLYGON)
  })
})
