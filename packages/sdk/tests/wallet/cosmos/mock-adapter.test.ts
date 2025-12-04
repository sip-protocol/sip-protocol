/**
 * Tests for MockCosmosAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockCosmosAdapter,
  createMockCosmosAdapter,
  WalletError,
  CosmosChainId,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  Asset,
  UnsignedTransaction,
  StdSignDoc,
  DirectSignDoc,
  CosmosUnsignedTransaction,
} from '../../../src/wallet'

describe('MockCosmosAdapter', () => {
  let adapter: MockCosmosAdapter

  beforeEach(() => {
    adapter = new MockCosmosAdapter({
      address: 'cosmos1testaddress123',
      balance: 1_000_000n, // 1 ATOM
      chainId: CosmosChainId.COSMOSHUB,
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createMockCosmosAdapter()
      expect(defaultAdapter.chain).toBe('cosmos')
      expect(defaultAdapter.name).toBe('mock-cosmos')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getChainId()).toBe(CosmosChainId.COSMOSHUB)
    })

    it('should initialize with custom values', () => {
      expect(adapter.chain).toBe('cosmos')
      expect(adapter.name).toBe('mock-cosmos')
      expect(adapter.getChainId()).toBe(CosmosChainId.COSMOSHUB)
    })

    it('should accept custom chain ID', () => {
      const osmosisAdapter = new MockCosmosAdapter({
        chainId: CosmosChainId.OSMOSIS,
      })
      expect(osmosisAdapter.getChainId()).toBe(CosmosChainId.OSMOSIS)
    })

    it('should have correct RPC endpoints', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://rpc.cosmos.network')
      expect(adapter.getRestEndpoint()).toBe('https://api.cosmos.network')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('cosmos1testaddress123')
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          chain: 'cosmos',
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
      const failingAdapter = new MockCosmosAdapter({
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
      const message = new TextEncoder().encode('Hello Cosmos')
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
      const failingAdapter = new MockCosmosAdapter({
        shouldFailSign: true,
      })
      await failingAdapter.connect()

      await expect(
        failingAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })

    it('should sign an Amino transaction', async () => {
      const aminoSignDoc: StdSignDoc = {
        chain_id: 'cosmoshub-4',
        account_number: '123',
        sequence: '456',
        fee: {
          amount: [{ denom: 'uatom', amount: '1000' }],
          gas: '200000',
        },
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'cosmos1sender',
              to_address: 'cosmos1recipient',
              amount: [{ denom: 'uatom', amount: '100000' }],
            },
          },
        ],
        memo: 'Test transaction',
      }

      const tx: UnsignedTransaction = {
        chain: 'cosmos',
        data: {
          aminoSignDoc,
          chainId: 'cosmoshub-4',
        } as CosmosUnsignedTransaction,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign a Direct transaction', async () => {
      const directSignDoc: DirectSignDoc = {
        bodyBytes: new Uint8Array([1, 2, 3]),
        authInfoBytes: new Uint8Array([4, 5, 6]),
        chainId: 'cosmoshub-4',
        accountNumber: 123n,
      }

      const tx: UnsignedTransaction = {
        chain: 'cosmos',
        data: {
          directSignDoc,
          chainId: 'cosmoshub-4',
        } as CosmosUnsignedTransaction,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.serialized).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign and send a transaction', async () => {
      const tx: UnsignedTransaction = {
        chain: 'cosmos',
        data: {
          aminoSignDoc: {
            chain_id: 'cosmoshub-4',
            account_number: '123',
            sequence: '456',
            fee: { amount: [], gas: '200000' },
            msgs: [],
            memo: '',
          },
          chainId: 'cosmoshub-4',
        } as CosmosUnsignedTransaction,
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('confirmed')
    })

    it('should fail transaction when configured', async () => {
      const failingAdapter = new MockCosmosAdapter({
        shouldFailTransaction: true,
      })
      await failingAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'cosmos',
        data: {
          aminoSignDoc: {
            chain_id: 'cosmoshub-4',
            account_number: '123',
            sequence: '456',
            fee: { amount: [], gas: '200000' },
            msgs: [],
            memo: '',
          },
          chainId: 'cosmoshub-4',
        } as CosmosUnsignedTransaction,
      }

      await expect(
        failingAdapter.signAndSendTransaction(tx)
      ).rejects.toThrow(WalletError)
    })
  })

  describe('Amino signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign using Amino', async () => {
      const signDoc: StdSignDoc = {
        chain_id: 'cosmoshub-4',
        account_number: '123',
        sequence: '456',
        fee: {
          amount: [{ denom: 'uatom', amount: '1000' }],
          gas: '200000',
        },
        msgs: [],
        memo: '',
      }

      const response = await adapter.signAmino('cosmos1testaddress123', signDoc)

      expect(response.signed).toBe(signDoc)
      expect(response.signature.pub_key).toBeDefined()
      expect(response.signature.signature).toBeDefined()
    })

    it('should track signed Amino transactions', async () => {
      const signDoc: StdSignDoc = {
        chain_id: 'cosmoshub-4',
        account_number: '123',
        sequence: '456',
        fee: { amount: [], gas: '200000' },
        msgs: [],
        memo: '',
      }

      await adapter.signAmino('cosmos1testaddress123', signDoc)

      const signed = adapter.getSignedAminoTransactions()
      expect(signed).toHaveLength(1)
      expect(signed[0]).toBe(signDoc)
    })
  })

  describe('Direct signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign using Direct', async () => {
      const signDoc: DirectSignDoc = {
        bodyBytes: new Uint8Array([1, 2, 3]),
        authInfoBytes: new Uint8Array([4, 5, 6]),
        chainId: 'cosmoshub-4',
        accountNumber: 123n,
      }

      const response = await adapter.signDirect('cosmos1testaddress123', signDoc)

      expect(response.signed).toBe(signDoc)
      expect(response.signature.pub_key).toBeDefined()
      expect(response.signature.signature).toBeDefined()
    })

    it('should track signed Direct transactions', async () => {
      const signDoc: DirectSignDoc = {
        bodyBytes: new Uint8Array([1, 2, 3]),
        authInfoBytes: new Uint8Array([4, 5, 6]),
        chainId: 'cosmoshub-4',
        accountNumber: 123n,
      }

      await adapter.signDirect('cosmos1testaddress123', signDoc)

      const signed = adapter.getSignedDirectTransactions()
      expect(signed).toHaveLength(1)
      expect(signed[0]).toBe(signDoc)
    })
  })

  describe('balance queries', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should get native balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(1_000_000n)
    })

    it('should get token balance', async () => {
      adapter.setMockTokenBalance('uosmo', 5_000_000n)

      const asset: Asset = {
        chain: 'cosmos',
        symbol: 'OSMO',
        address: 'uosmo',
        decimals: 6,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(5_000_000n)
    })

    it('should return 0 for unknown token', async () => {
      const asset: Asset = {
        chain: 'cosmos',
        symbol: 'UNKNOWN',
        address: 'uunknown',
        decimals: 6,
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

  describe('key info', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return key info', () => {
      const keyInfo = adapter.getKeyInfo()

      expect(keyInfo).toBeDefined()
      expect(keyInfo.name).toBe('Mock Cosmos Account')
      expect(keyInfo.algo).toBe('secp256k1')
      expect(keyInfo.address).toBe('cosmos1testaddress123')
      expect(keyInfo.pubKey).toBeInstanceOf(Uint8Array)
    })
  })

  describe('mock control methods', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should update mock balance', async () => {
      adapter.setMockBalance(5_000_000n)
      const balance = await adapter.getBalance()
      expect(balance).toBe(5_000_000n)
    })

    it('should update mock token balance', async () => {
      adapter.setMockTokenBalance('uatom', 10_000_000n)

      const asset: Asset = {
        chain: 'cosmos',
        symbol: 'ATOM',
        address: 'uatom',
        decimals: 6,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(10_000_000n)
    })

    it('should clear transaction history', async () => {
      const signDoc: StdSignDoc = {
        chain_id: 'cosmoshub-4',
        account_number: '123',
        sequence: '456',
        fee: { amount: [], gas: '200000' },
        msgs: [],
        memo: '',
      }

      await adapter.signAmino('cosmos1testaddress123', signDoc)
      expect(adapter.getSignedAminoTransactions()).toHaveLength(1)

      adapter.clearTransactionHistory()
      expect(adapter.getSignedAminoTransactions()).toHaveLength(0)
      expect(adapter.getSignedDirectTransactions()).toHaveLength(0)
    })

    it('should simulate account change', async () => {
      const handler = vi.fn()
      adapter.on('accountChanged', handler)

      adapter.simulateAccountChange('cosmos1newaddress456')

      expect(adapter.address).toBe('cosmos1newaddress456')
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accountChanged',
          previousAddress: 'cosmos1testaddress123',
          newAddress: 'cosmos1newaddress456',
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
      const slowAdapter = new MockCosmosAdapter({
        latency: 100,
      })

      const start = Date.now()
      await slowAdapter.connect()
      const elapsed = Date.now() - start

      // Allow 5ms tolerance for CI timing variance
      expect(elapsed).toBeGreaterThanOrEqual(95)
    })

    it('should work with zero latency', async () => {
      const fastAdapter = new MockCosmosAdapter({
        latency: 0,
      })

      const start = Date.now()
      await fastAdapter.connect()
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('different algorithms', () => {
    it('should support secp256k1', async () => {
      const secp256k1Adapter = new MockCosmosAdapter({
        algo: 'secp256k1',
      })
      await secp256k1Adapter.connect()

      const keyInfo = secp256k1Adapter.getKeyInfo()
      expect(keyInfo.algo).toBe('secp256k1')
    })

    it('should support eth-secp256k1', async () => {
      const ethAdapter = new MockCosmosAdapter({
        algo: 'eth-secp256k1',
      })
      await ethAdapter.connect()

      const keyInfo = ethAdapter.getKeyInfo()
      expect(keyInfo.algo).toBe('eth-secp256k1')
    })

    it('should support ed25519', async () => {
      const ed25519Adapter = new MockCosmosAdapter({
        algo: 'ed25519',
      })
      await ed25519Adapter.connect()

      const keyInfo = ed25519Adapter.getKeyInfo()
      expect(keyInfo.algo).toBe('ed25519')
    })
  })
})
