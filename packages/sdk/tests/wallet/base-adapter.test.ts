/**
 * Tests for BaseWalletAdapter and MockWalletAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockWalletAdapter,
  WalletError,
  notConnectedError,
  featureNotSupportedError,
} from '../../src/wallet'
import { WalletErrorCode } from '@sip-protocol/types'
import type { Asset, UnsignedTransaction } from '@sip-protocol/types'

describe('MockWalletAdapter', () => {
  let adapter: MockWalletAdapter

  beforeEach(() => {
    adapter = new MockWalletAdapter({
      chain: 'solana',
      address: 'SoLaNaAddReSS123',
      balance: 1000000000n, // 1 SOL
    })
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const defaultAdapter = new MockWalletAdapter({ chain: 'ethereum' })
      expect(defaultAdapter.chain).toBe('ethereum')
      expect(defaultAdapter.name).toBe('mock-ethereum')
      expect(defaultAdapter.connectionState).toBe('disconnected')
      expect(defaultAdapter.address).toBe('')
      expect(defaultAdapter.publicKey).toBe('')
    })

    it('should initialize with custom values', () => {
      expect(adapter.chain).toBe('solana')
      expect(adapter.name).toBe('mock-solana')
    })

    it('should allow custom name', () => {
      const named = new MockWalletAdapter({
        chain: 'near',
        name: 'my-custom-wallet',
      })
      expect(named.name).toBe('my-custom-wallet')
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(false)
      expect(adapter.connectionState).toBe('disconnected')

      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('SoLaNaAddReSS123')
      expect(adapter.publicKey).not.toBe('')
    })

    it('should emit connect event', async () => {
      const handler = vi.fn()
      adapter.on('connect', handler)

      await adapter.connect()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connect',
          address: 'SoLaNaAddReSS123',
          chain: 'solana',
        })
      )
    })

    it('should disconnect successfully', async () => {
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)

      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(adapter.connectionState).toBe('disconnected')
      expect(adapter.address).toBe('')
    })

    it('should emit disconnect event', async () => {
      const handler = vi.fn()
      adapter.on('disconnect', handler)

      await adapter.connect()
      await adapter.disconnect()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnect',
          reason: 'User disconnected',
        })
      )
    })

    it('should fail connection when configured', async () => {
      const failingAdapter = new MockWalletAdapter({
        chain: 'ethereum',
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
      const message = new Uint8Array([1, 2, 3, 4, 5])
      const signature = await adapter.signMessage(message)

      expect(signature.signature).toMatch(/^0x[0-9a-f]+$/)
      expect(signature.publicKey).toBe(adapter.publicKey)
      expect(signature.recoveryId).toBe(0)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      await expect(adapter.signMessage(new Uint8Array([1, 2, 3]))).rejects.toThrow(
        WalletError
      )
    })

    it('should fail signing when configured', async () => {
      const failingAdapter = new MockWalletAdapter({
        chain: 'solana',
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
      expect(receipt.blockNumber).toBe(12345n)
    })
  })

  describe('balance', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should return native balance', async () => {
      const balance = await adapter.getBalance()
      expect(balance).toBe(1000000000n)
    })

    it('should return token balance', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'USDC',
        address: '0x123' as `0x${string}`,
        decimals: 6,
      }
      adapter.setMockTokenBalance(asset, 500000000n)

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(500000000n)
    })

    it('should return 0 for unknown token', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'UNKNOWN',
        address: null,
        decimals: 8,
      }

      const balance = await adapter.getTokenBalance(asset)
      expect(balance).toBe(0n)
    })

    it('should throw if not connected', async () => {
      await adapter.disconnect()

      await expect(adapter.getBalance()).rejects.toThrow(WalletError)
    })
  })

  describe('events', () => {
    it('should add and remove event handlers', async () => {
      const handler = vi.fn()

      adapter.on('connect', handler)
      await adapter.connect()
      expect(handler).toHaveBeenCalledTimes(1)

      adapter.off('connect', handler)
      await adapter.disconnect()
      await adapter.connect()
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, handler was removed
    })

    it('should emit account changed event', async () => {
      await adapter.connect()

      const handler = vi.fn()
      adapter.on('accountChanged', handler)

      adapter.simulateAccountChange('NewAddress123')

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accountChanged',
          previousAddress: 'SoLaNaAddReSS123',
          newAddress: 'NewAddress123',
        })
      )
      expect(adapter.address).toBe('NewAddress123')
    })
  })

  describe('mock control methods', () => {
    beforeEach(async () => {
      await adapter.connect()
    })

    it('should update mock balance', async () => {
      expect(await adapter.getBalance()).toBe(1000000000n)

      adapter.setMockBalance(5000000000n)

      expect(await adapter.getBalance()).toBe(5000000000n)
    })

    it('should update mock token balance', async () => {
      const asset: Asset = {
        chain: 'solana',
        symbol: 'TEST',
        address: null,
        decimals: 8,
      }

      expect(await adapter.getTokenBalance(asset)).toBe(0n)

      adapter.setMockTokenBalance(asset, 123456n)

      expect(await adapter.getTokenBalance(asset)).toBe(123456n)
    })
  })
})

describe('WalletError', () => {
  it('should create with default code', () => {
    const error = new WalletError('Test error')
    expect(error.message).toBe('Test error')
    expect(error.walletCode).toBe(WalletErrorCode.UNKNOWN)
  })

  it('should create with specific code', () => {
    const error = new WalletError('Not connected', WalletErrorCode.NOT_CONNECTED)
    expect(error.walletCode).toBe(WalletErrorCode.NOT_CONNECTED)
  })

  it('should identify connection errors', () => {
    const connectionError = new WalletError('test', WalletErrorCode.CONNECTION_FAILED)
    expect(connectionError.isConnectionError()).toBe(true)
    expect(connectionError.isSigningError()).toBe(false)
  })

  it('should identify signing errors', () => {
    const signingError = new WalletError('test', WalletErrorCode.SIGNING_FAILED)
    expect(signingError.isSigningError()).toBe(true)
    expect(signingError.isConnectionError()).toBe(false)
  })

  it('should identify transaction errors', () => {
    const txError = new WalletError('test', WalletErrorCode.INSUFFICIENT_FUNDS)
    expect(txError.isTransactionError()).toBe(true)
  })

  it('should identify privacy errors', () => {
    const privacyError = new WalletError('test', WalletErrorCode.STEALTH_NOT_SUPPORTED)
    expect(privacyError.isPrivacyError()).toBe(true)
  })

  it('should identify user rejection', () => {
    const rejectionError = new WalletError('test', WalletErrorCode.CONNECTION_REJECTED)
    expect(rejectionError.isUserRejection()).toBe(true)

    const nonRejection = new WalletError('test', WalletErrorCode.CONNECTION_FAILED)
    expect(nonRejection.isUserRejection()).toBe(false)
  })
})

describe('error helper functions', () => {
  it('notConnectedError should create proper error', () => {
    const error = notConnectedError()
    expect(error).toBeInstanceOf(WalletError)
    expect(error.walletCode).toBe(WalletErrorCode.NOT_CONNECTED)
    expect(error.message).toContain('not connected')
  })

  it('featureNotSupportedError should create proper error', () => {
    const error = featureNotSupportedError(
      'Stealth addresses',
      WalletErrorCode.STEALTH_NOT_SUPPORTED
    )
    expect(error).toBeInstanceOf(WalletError)
    expect(error.walletCode).toBe(WalletErrorCode.STEALTH_NOT_SUPPORTED)
    expect(error.message).toContain('Stealth addresses')
  })
})
