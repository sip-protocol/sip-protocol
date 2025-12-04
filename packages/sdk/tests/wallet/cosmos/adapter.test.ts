/**
 * Tests for CosmosWalletAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CosmosWalletAdapter,
  createCosmosAdapter,
  createMockCosmosProvider,
  WalletError,
  CosmosChainId,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  Keplr,
  StdSignDoc,
  DirectSignDoc,
  UnsignedTransaction,
  CosmosUnsignedTransaction,
} from '../../../src/wallet'

describe('CosmosWalletAdapter', () => {
  let adapter: CosmosWalletAdapter
  let mockProvider: Keplr

  beforeEach(() => {
    mockProvider = createMockCosmosProvider({
      address: 'cosmos1testaddress123',
      chainId: CosmosChainId.COSMOSHUB,
    })

    adapter = new CosmosWalletAdapter({
      chainId: CosmosChainId.COSMOSHUB,
      provider: mockProvider,
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createCosmosAdapter()
      expect(defaultAdapter.chain).toBe('cosmos')
      expect(defaultAdapter.name).toBe('cosmos-keplr')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getChainId()).toBe(CosmosChainId.COSMOSHUB)
    })

    it('should initialize with custom values', () => {
      const customAdapter = new CosmosWalletAdapter({
        wallet: 'leap',
        chainId: CosmosChainId.OSMOSIS,
      })

      expect(customAdapter.name).toBe('cosmos-leap')
      expect(customAdapter.getChainId()).toBe(CosmosChainId.OSMOSIS)
    })

    it('should have correct endpoints', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://rpc.cosmos.network')
      expect(adapter.getRestEndpoint()).toBe('https://api.cosmos.network')
    })

    it('should allow setting endpoints', () => {
      adapter.setRpcEndpoint('https://custom-rpc.example.com')
      adapter.setRestEndpoint('https://custom-rest.example.com')

      expect(adapter.getRpcEndpoint()).toBe('https://custom-rpc.example.com')
      expect(adapter.getRestEndpoint()).toBe('https://custom-rest.example.com')
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

    it('should throw if wallet not installed', async () => {
      const noProviderAdapter = new CosmosWalletAdapter({
        chainId: CosmosChainId.COSMOSHUB,
      })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should handle connection rejection', async () => {
      const rejectingProvider = createMockCosmosProvider({
        shouldFailConnect: true,
      })

      const rejectAdapter = new CosmosWalletAdapter({
        chainId: CosmosChainId.COSMOSHUB,
        provider: rejectingProvider,
      })

      await expect(rejectAdapter.connect()).rejects.toThrow(WalletError)
      expect(rejectAdapter.connectionState).toBe('error')
    })

    it('should disconnect successfully', async () => {
      await adapter.connect()
      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(adapter.connectionState).toBe('disconnected')
    })

    it('should get key info after connection', async () => {
      await adapter.connect()

      const keyInfo = adapter.getKeyInfo()
      expect(keyInfo).toBeDefined()
      expect(keyInfo?.address).toBe('cosmos1testaddress123')
      expect(keyInfo?.algo).toBe('secp256k1')
    })
  })

  describe('message signing', () => {
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

    it('should handle signing rejection', async () => {
      const rejectingProvider = createMockCosmosProvider({
        shouldFailSign: true,
      })

      const rejectAdapter = new CosmosWalletAdapter({
        chainId: CosmosChainId.COSMOSHUB,
        provider: rejectingProvider,
      })

      await rejectAdapter.connect()

      await expect(
        rejectAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })
  })

  describe('Amino transaction signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign Amino transaction', async () => {
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
      expect(signed.signatures[0].signature).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign using signAmino method', async () => {
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
      expect(response.signature).toBeDefined()
    })
  })

  describe('Direct transaction signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign Direct transaction', async () => {
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
      expect(signed.signatures[0].signature).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should sign using signDirect method', async () => {
      const signDoc: DirectSignDoc = {
        bodyBytes: new Uint8Array([1, 2, 3]),
        authInfoBytes: new Uint8Array([4, 5, 6]),
        chainId: 'cosmoshub-4',
        accountNumber: 123n,
      }

      const response = await adapter.signDirect('cosmos1testaddress123', signDoc)

      expect(response.signed).toStrictEqual(signDoc)
      expect(response.signature).toBeDefined()
    })
  })

  describe('transaction validation', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should throw if transaction has no sign doc', async () => {
      const tx: UnsignedTransaction = {
        chain: 'cosmos',
        data: {
          chainId: 'cosmoshub-4',
        } as CosmosUnsignedTransaction,
      }

      await expect(adapter.signTransaction(tx)).rejects.toThrow(WalletError)
    })
  })

  describe('transaction sending', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign and send transaction', async () => {
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
      expect(receipt.status).toBe('pending')
    })
  })

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const errorProvider = {
        ...mockProvider,
        enable: async () => {
          throw new Error('Network error')
        },
      }

      const errorAdapter = new CosmosWalletAdapter({
        chainId: CosmosChainId.COSMOSHUB,
        provider: errorProvider,
      })

      await expect(errorAdapter.connect()).rejects.toThrow()
    })
  })

  describe('bech32 prefix', () => {
    it('should use default cosmos prefix', () => {
      expect(adapter.getBech32Prefix()).toBe('cosmos')
    })

    it('should allow custom bech32 prefix', () => {
      const osmosisAdapter = new CosmosWalletAdapter({
        chainId: CosmosChainId.OSMOSIS,
        bech32Prefix: 'osmo',
      })

      expect(osmosisAdapter.getBech32Prefix()).toBe('osmo')
    })
  })
})
