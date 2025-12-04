/**
 * Tests for AptosWalletAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AptosWalletAdapter,
  createAptosAdapter,
  createMockAptosProvider,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  UnsignedTransaction,
  AptosTransaction,
  AptosSignMessagePayload,
} from '../../../src/wallet'

describe('AptosWalletAdapter', () => {
  let adapter: AptosWalletAdapter
  let mockProvider: ReturnType<typeof createMockAptosProvider>

  beforeEach(() => {
    mockProvider = createMockAptosProvider({
      address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    })

    adapter = new AptosWalletAdapter({
      provider: mockProvider,
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createAptosAdapter()
      expect(defaultAdapter.chain).toBe('aptos')
      expect(defaultAdapter.name).toBe('aptos-petra')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getNetwork()).toBe('mainnet')
    })

    it('should initialize with custom values', () => {
      const customAdapter = new AptosWalletAdapter({
        wallet: 'martian',
        network: 'testnet',
      })

      expect(customAdapter.name).toBe('aptos-martian')
      expect(customAdapter.getNetwork()).toBe('testnet')
    })

    it('should have correct RPC endpoint', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://fullnode.mainnet.aptoslabs.com/v1')
    })

    it('should allow setting RPC endpoint', () => {
      adapter.setRpcEndpoint('https://custom-rpc.example.com')
      expect(adapter.getRpcEndpoint()).toBe('https://custom-rpc.example.com')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
      expect(adapter.publicKey).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should throw if wallet not installed', async () => {
      const noProviderAdapter = new AptosWalletAdapter({
        wallet: 'petra',
      })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should handle connection rejection', async () => {
      const rejectingProvider = createMockAptosProvider({
        shouldFailConnect: true,
      })

      const rejectAdapter = new AptosWalletAdapter({
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
  })

  describe('message signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign a message', async () => {
      const message = new TextEncoder().encode('Hello Aptos')
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
      const rejectingProvider = createMockAptosProvider({
        shouldFailSign: true,
      })

      const rejectAdapter = new AptosWalletAdapter({
        provider: rejectingProvider,
      })

      await rejectAdapter.connect()

      await expect(
        rejectAdapter.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow(WalletError)
    })
  })

  describe('transaction signing', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign a transaction', async () => {
      const aptosTx: AptosTransaction = {
        payload: {
          type: 'entry_function_payload',
          function: '0x1::coin::transfer',
          type_arguments: ['0x1::aptos_coin::AptosCoin'],
          arguments: ['0xrecipient', '1000000'],
        },
      }

      const tx: UnsignedTransaction = {
        chain: 'aptos',
        data: aptosTx,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.signatures[0].signature).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      const tx: UnsignedTransaction = {
        chain: 'aptos',
        data: {},
      }

      await expect(adapter.signTransaction(tx)).rejects.toThrow(WalletError)
    })
  })

  describe('transaction sending', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should sign and send transaction', async () => {
      const aptosTx: AptosTransaction = {
        payload: {
          type: 'entry_function_payload',
          function: '0x1::coin::transfer',
          type_arguments: ['0x1::aptos_coin::AptosCoin'],
          arguments: ['0xrecipient', '1000000'],
        },
      }

      const tx: UnsignedTransaction = {
        chain: 'aptos',
        data: aptosTx,
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
    })

    it('should handle transaction failure', async () => {
      const failingProvider = createMockAptosProvider({
        shouldFailTransaction: true,
      })

      const failAdapter = new AptosWalletAdapter({
        provider: failingProvider,
      })

      await failAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'aptos',
        data: {},
      }

      await expect(failAdapter.signAndSendTransaction(tx)).rejects.toThrow(WalletError)
    })
  })

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const errorProvider = {
        ...mockProvider,
        connect: async () => {
          throw new Error('Network error')
        },
      }

      const errorAdapter = new AptosWalletAdapter({
        provider: errorProvider,
      })

      await expect(errorAdapter.connect()).rejects.toThrow()
    })
  })
})
