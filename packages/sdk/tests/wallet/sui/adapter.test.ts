/**
 * Tests for SuiWalletAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SuiWalletAdapter,
  createSuiAdapter,
  createMockSuiProvider,
  WalletError,
} from '../../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type {
  UnsignedTransaction,
  SuiTransactionBlock,
} from '../../../src/wallet'

describe('SuiWalletAdapter', () => {
  let adapter: SuiWalletAdapter
  let mockProvider: ReturnType<typeof createMockSuiProvider>

  beforeEach(() => {
    mockProvider = createMockSuiProvider({
      address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    })

    adapter = new SuiWalletAdapter({
      provider: mockProvider,
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = createSuiAdapter()
      expect(defaultAdapter.chain).toBe('sui')
      expect(defaultAdapter.name).toBe('sui-sui-wallet')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.getNetwork()).toBe('mainnet')
    })

    it('should initialize with custom values', () => {
      const customAdapter = new SuiWalletAdapter({
        wallet: 'ethos',
        network: 'testnet',
      })

      expect(customAdapter.name).toBe('sui-ethos')
      expect(customAdapter.getNetwork()).toBe('testnet')
    })

    it('should have correct RPC endpoint', () => {
      expect(adapter.getRpcEndpoint()).toBe('https://fullnode.mainnet.sui.io:443')
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

    it('should get accounts after connection', async () => {
      await adapter.connect()

      const accounts = adapter.getAccounts()
      expect(accounts).toHaveLength(1)
      expect(accounts[0].address).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    })

    it('should throw if wallet not installed', async () => {
      const noProviderAdapter = new SuiWalletAdapter({
        wallet: 'sui-wallet',
      })

      await expect(noProviderAdapter.connect()).rejects.toThrow(WalletError)
    })

    it('should handle connection rejection', async () => {
      const rejectingProvider = createMockSuiProvider({
        shouldFailConnect: true,
      })

      const rejectAdapter = new SuiWalletAdapter({
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
      const message = new TextEncoder().encode('Hello Sui')
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
      const rejectingProvider = createMockSuiProvider({
        shouldFailSign: true,
      })

      const rejectAdapter = new SuiWalletAdapter({
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
      const suiTx: SuiTransactionBlock = {
        kind: 'moveCall',
        data: {
          target: '0x2::coin::transfer',
          arguments: ['0xrecipient', '1000000000'],
        },
      }

      const tx: UnsignedTransaction = {
        chain: 'sui',
        data: suiTx,
      }

      const signed = await adapter.signTransaction(tx)

      expect(signed.unsigned).toBe(tx)
      expect(signed.signatures).toHaveLength(1)
      expect(signed.signatures[0].signature).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      const tx: UnsignedTransaction = {
        chain: 'sui',
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
      const suiTx: SuiTransactionBlock = {
        kind: 'transferObjects',
        data: {
          objects: ['0xobject1'],
          recipient: '0xrecipient',
        },
      }

      const tx: UnsignedTransaction = {
        chain: 'sui',
        data: suiTx,
      }

      const receipt = await adapter.signAndSendTransaction(tx)

      expect(receipt.txHash).toMatch(/^0x[0-9a-f]+$/)
      expect(receipt.status).toBe('pending')
    })

    it('should handle transaction failure', async () => {
      const failingProvider = createMockSuiProvider({
        shouldFailTransaction: true,
      })

      const failAdapter = new SuiWalletAdapter({
        provider: failingProvider,
      })

      await failAdapter.connect()

      const tx: UnsignedTransaction = {
        chain: 'sui',
        data: {},
      }

      await expect(failAdapter.signAndSendTransaction(tx)).rejects.toThrow(WalletError)
    })
  })

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const errorProvider = {
        ...mockProvider,
        hasPermissions: async () => {
          throw new Error('Network error')
        },
      }

      const errorAdapter = new SuiWalletAdapter({
        provider: errorProvider,
      })

      await expect(errorAdapter.connect()).rejects.toThrow()
    })
  })
})
