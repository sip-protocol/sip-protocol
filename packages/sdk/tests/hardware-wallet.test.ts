/**
 * Hardware Wallet Adapter Tests
 *
 * Tests for Ledger and Trezor hardware wallet adapters using mock implementations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MockLedgerAdapter,
  MockTrezorAdapter,
  createMockLedgerAdapter,
  createMockTrezorAdapter,
  HardwareErrorCode,
  HardwareWalletError,
  DerivationPath,
  getDerivationPath,
  supportsWebUSB,
  supportsWebHID,
  supportsWebBluetooth,
  getAvailableTransports,
  type HardwareAccount,
  type HexString,
} from '../src'

describe('Hardware Wallet Adapters', () => {
  // ─── Derivation Path Tests ──────────────────────────────────────────────────

  describe('DerivationPath', () => {
    it('should have standard Ethereum path', () => {
      expect(DerivationPath.ETHEREUM).toBe("m/44'/60'/0'/0")
    })

    it('should have standard Solana path', () => {
      expect(DerivationPath.SOLANA).toBe("m/44'/501'/0'/0'")
    })

    it('should have standard Bitcoin path', () => {
      expect(DerivationPath.BITCOIN).toBe("m/84'/0'/0'/0")
    })

    it('should have standard NEAR path', () => {
      expect(DerivationPath.NEAR).toBe("m/44'/397'/0'")
    })
  })

  describe('getDerivationPath', () => {
    it('should generate Ethereum path with account index', () => {
      expect(getDerivationPath('ethereum', 0)).toBe("m/44'/60'/0'/0/0")
      expect(getDerivationPath('ethereum', 5)).toBe("m/44'/60'/0'/0/5")
    })

    it('should generate Solana path with account index', () => {
      expect(getDerivationPath('solana', 0)).toBe("m/44'/501'/0'/0'")
      expect(getDerivationPath('solana', 3)).toBe("m/44'/501'/3'/0'")
    })

    it('should default to Ethereum path for unknown chains', () => {
      // Test with unknown chain that falls through to default case
      expect(getDerivationPath('unknown' as ChainId, 0)).toBe("m/44'/60'/0'/0/0")
    })
  })

  // ─── Transport Detection Tests ──────────────────────────────────────────────

  describe('Transport Detection', () => {
    it('should check WebUSB support', () => {
      // In Node.js test environment, these will be false
      const result = supportsWebUSB()
      expect(typeof result).toBe('boolean')
    })

    it('should check WebHID support', () => {
      const result = supportsWebHID()
      expect(typeof result).toBe('boolean')
    })

    it('should check Web Bluetooth support', () => {
      const result = supportsWebBluetooth()
      expect(typeof result).toBe('boolean')
    })

    it('should return array of available transports', () => {
      const transports = getAvailableTransports()
      expect(Array.isArray(transports)).toBe(true)
    })
  })

  // ─── Mock Ledger Adapter Tests ──────────────────────────────────────────────

  describe('MockLedgerAdapter', () => {
    let adapter: MockLedgerAdapter

    beforeEach(() => {
      adapter = createMockLedgerAdapter({
        chain: 'ethereum',
        accountIndex: 0,
      })
    })

    describe('connection', () => {
      it('should connect successfully', async () => {
        await adapter.connect()

        expect(adapter.isConnected()).toBe(true)
        expect(adapter.connectionState).toBe('connected')
        expect(adapter.address).toBeTruthy()
        expect(adapter.publicKey).toBeTruthy()
      })

      it('should have device info after connection', async () => {
        await adapter.connect()

        expect(adapter.deviceInfo).toBeDefined()
        expect(adapter.deviceInfo?.manufacturer).toBe('ledger')
        expect(adapter.deviceInfo?.isLocked).toBe(false)
      })

      it('should have account info after connection', async () => {
        await adapter.connect()

        expect(adapter.account).toBeDefined()
        expect(adapter.account?.chain).toBe('ethereum')
        expect(adapter.account?.index).toBe(0)
        expect(adapter.account?.derivationPath).toBe("m/44'/60'/0'/0/0")
      })

      it('should disconnect successfully', async () => {
        await adapter.connect()
        await adapter.disconnect()

        expect(adapter.isConnected()).toBe(false)
        expect(adapter.connectionState).toBe('disconnected')
        expect(adapter.deviceInfo).toBeNull()
        expect(adapter.account).toBeNull()
      })

      it('should fail connection when configured', async () => {
        const failAdapter = createMockLedgerAdapter({
          chain: 'ethereum',
          shouldFailConnect: true,
        })

        await expect(failAdapter.connect()).rejects.toThrow(HardwareWalletError)
        await expect(failAdapter.connect()).rejects.toThrow('Mock connection failure')
      })

      it('should fail when device is locked', async () => {
        const lockedAdapter = createMockLedgerAdapter({
          chain: 'ethereum',
          isLocked: true,
        })

        await expect(lockedAdapter.connect()).rejects.toThrow(HardwareWalletError)
        await expect(lockedAdapter.connect()).rejects.toThrow('Device is locked')
      })
    })

    describe('signing', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should sign a message', async () => {
        const message = new TextEncoder().encode('Hello, Ledger!')

        const signature = await adapter.signMessage(message)

        expect(signature).toBeDefined()
        expect(signature.signature).toMatch(/^0x[a-f0-9]+$/i)
        expect(signature.publicKey).toBe(adapter.publicKey)
      })

      it('should sign a transaction', async () => {
        const tx = {
          chain: 'ethereum' as const,
          data: {
            to: '0x1234567890123456789012345678901234567890',
            value: '0x0' as HexString,
            gasLimit: '0x5208' as HexString,
            nonce: '0x0' as HexString,
            chainId: 1,
          },
        }

        const signed = await adapter.signTransaction(tx)

        expect(signed).toBeDefined()
        expect(signed.signatures).toHaveLength(1)
        expect(signed.signatures[0].signature).toMatch(/^0x[a-f0-9]+$/i)
      })

      it('should reject signing when configured', async () => {
        adapter.setShouldReject(true)
        const message = new TextEncoder().encode('Reject me')

        await expect(adapter.signMessage(message)).rejects.toThrow(HardwareWalletError)
        await expect(adapter.signMessage(message)).rejects.toThrow('rejected')
      })

      it('should throw when not connected', async () => {
        await adapter.disconnect()
        const message = new TextEncoder().encode('test')

        await expect(adapter.signMessage(message)).rejects.toThrow()
      })
    })

    describe('account management', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should get multiple accounts', async () => {
        const accounts = await adapter.getAccounts(0, 3)

        expect(accounts).toHaveLength(3)
        expect(accounts[0].index).toBe(0)
        expect(accounts[1].index).toBe(1)
        expect(accounts[2].index).toBe(2)
      })

      it('should switch accounts', async () => {
        const originalAddress = adapter.address

        const newAccount = await adapter.switchAccount(2)

        expect(newAccount.index).toBe(2)
        expect(adapter.address).not.toBe(originalAddress)
        expect(adapter.account?.index).toBe(2)
      })

      it('should emit accountChanged event on switch', async () => {
        let eventFired = false
        let previousAddr = ''
        let newAddr = ''

        adapter.on('accountChanged', (event) => {
          eventFired = true
          previousAddr = event.previousAddress
          newAddr = event.newAddress
        })

        const originalAddress = adapter.address
        await adapter.switchAccount(1)

        expect(eventFired).toBe(true)
        expect(previousAddr).toBe(originalAddress)
        expect(newAddr).toBe(adapter.address)
      })

      it('should throw on invalid account index', async () => {
        await expect(adapter.switchAccount(100)).rejects.toThrow('Account index out of range')
      })
    })

    describe('balance methods', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should throw for getBalance (not supported)', async () => {
        await expect(adapter.getBalance()).rejects.toThrow('do not track balances')
      })

      it('should throw for getTokenBalance (not supported)', async () => {
        await expect(
          adapter.getTokenBalance({ chain: 'ethereum', symbol: 'USDC', decimals: 6 })
        ).rejects.toThrow('do not track balances')
      })
    })

    describe('test helpers', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should toggle rejection mode', async () => {
        adapter.setShouldReject(true)
        const message = new TextEncoder().encode('test')

        await expect(adapter.signMessage(message)).rejects.toThrow()

        adapter.setShouldReject(false)
        const sig = await adapter.signMessage(message)
        expect(sig).toBeDefined()
      })

      it('should simulate lock/unlock', () => {
        adapter.simulateLock()
        expect(adapter.deviceInfo?.isLocked).toBe(true)

        adapter.simulateUnlock()
        expect(adapter.deviceInfo?.isLocked).toBe(false)
      })
    })
  })

  // ─── Mock Trezor Adapter Tests ──────────────────────────────────────────────

  describe('MockTrezorAdapter', () => {
    let adapter: MockTrezorAdapter

    beforeEach(() => {
      adapter = createMockTrezorAdapter({
        chain: 'ethereum',
        accountIndex: 0,
      })
    })

    describe('connection', () => {
      it('should connect successfully', async () => {
        await adapter.connect()

        expect(adapter.isConnected()).toBe(true)
        expect(adapter.connectionState).toBe('connected')
        expect(adapter.address).toBeTruthy()
      })

      it('should have device info after connection', async () => {
        await adapter.connect()

        expect(adapter.deviceInfo).toBeDefined()
        expect(adapter.deviceInfo?.manufacturer).toBe('trezor')
        expect(adapter.deviceInfo?.model).toBe('T')
      })

      it('should disconnect successfully', async () => {
        await adapter.connect()
        await adapter.disconnect()

        expect(adapter.isConnected()).toBe(false)
      })

      it('should fail connection when configured', async () => {
        const failAdapter = createMockTrezorAdapter({
          chain: 'ethereum',
          shouldFailConnect: true,
        })

        await expect(failAdapter.connect()).rejects.toThrow(HardwareWalletError)
      })
    })

    describe('signing', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should sign a message', async () => {
        const message = new TextEncoder().encode('Hello, Trezor!')

        const signature = await adapter.signMessage(message)

        expect(signature).toBeDefined()
        expect(signature.signature).toMatch(/^0x[a-f0-9]+$/i)
      })

      it('should sign a transaction', async () => {
        const tx = {
          chain: 'ethereum' as const,
          data: {
            to: '0x1234567890123456789012345678901234567890',
            value: '0x0' as HexString,
            gasLimit: '0x5208' as HexString,
            nonce: '0x0' as HexString,
            chainId: 1,
          },
        }

        const signed = await adapter.signTransaction(tx)

        expect(signed).toBeDefined()
        expect(signed.signatures).toHaveLength(1)
      })

      it('should reject signing when configured', async () => {
        adapter.setShouldReject(true)

        await expect(
          adapter.signMessage(new TextEncoder().encode('reject'))
        ).rejects.toThrow(HardwareWalletError)
      })
    })

    describe('account management', () => {
      beforeEach(async () => {
        await adapter.connect()
      })

      it('should get multiple accounts', async () => {
        const accounts = await adapter.getAccounts(0, 5)

        expect(accounts).toHaveLength(5)
        accounts.forEach((acc, i) => {
          expect(acc.index).toBe(i)
          expect(acc.chain).toBe('ethereum')
        })
      })

      it('should switch accounts', async () => {
        const account = await adapter.switchAccount(3)

        expect(account.index).toBe(3)
        expect(adapter.account?.index).toBe(3)
      })
    })
  })

  // ─── HardwareWalletError Tests ──────────────────────────────────────────────

  describe('HardwareWalletError', () => {
    it('should create error with code', () => {
      const error = new HardwareWalletError(
        'Device not found',
        HardwareErrorCode.DEVICE_NOT_FOUND,
        'ledger'
      )

      expect(error.message).toBe('Device not found')
      expect(error.code).toBe(HardwareErrorCode.DEVICE_NOT_FOUND)
      expect(error.device).toBe('ledger')
      expect(error.name).toBe('HardwareWalletError')
    })

    it('should include details', () => {
      const details = { statusCode: 0x6985 }
      const error = new HardwareWalletError(
        'User rejected',
        HardwareErrorCode.USER_REJECTED,
        'trezor',
        details
      )

      expect(error.details).toEqual(details)
    })

    it('should have all error codes', () => {
      expect(HardwareErrorCode.DEVICE_NOT_FOUND).toBe('HARDWARE_DEVICE_NOT_FOUND')
      expect(HardwareErrorCode.DEVICE_LOCKED).toBe('HARDWARE_DEVICE_LOCKED')
      expect(HardwareErrorCode.APP_NOT_OPEN).toBe('HARDWARE_APP_NOT_OPEN')
      expect(HardwareErrorCode.USER_REJECTED).toBe('HARDWARE_USER_REJECTED')
      expect(HardwareErrorCode.TRANSPORT_ERROR).toBe('HARDWARE_TRANSPORT_ERROR')
      expect(HardwareErrorCode.TIMEOUT).toBe('HARDWARE_TIMEOUT')
      expect(HardwareErrorCode.UNSUPPORTED).toBe('HARDWARE_UNSUPPORTED')
      expect(HardwareErrorCode.INVALID_PATH).toBe('HARDWARE_INVALID_PATH')
      expect(HardwareErrorCode.INVALID_PARAMS).toBe('HARDWARE_INVALID_PARAMS')
    })
  })

  // ─── Event Emission Tests ───────────────────────────────────────────────────

  describe('Event Emission', () => {
    let adapter: MockLedgerAdapter

    beforeEach(() => {
      adapter = createMockLedgerAdapter({ chain: 'ethereum' })
    })

    it('should emit connect event', async () => {
      let eventFired = false

      adapter.on('connect', () => {
        eventFired = true
      })

      await adapter.connect()

      expect(eventFired).toBe(true)
    })

    it('should emit disconnect event', async () => {
      let eventFired = false

      adapter.on('disconnect', () => {
        eventFired = true
      })

      await adapter.connect()
      await adapter.disconnect()

      expect(eventFired).toBe(true)
    })

    it('should allow unsubscribing from events', async () => {
      let callCount = 0

      const handler = () => {
        callCount++
      }

      adapter.on('connect', handler)
      await adapter.connect()
      expect(callCount).toBe(1)

      adapter.off('connect', handler)
      await adapter.disconnect()
      await adapter.connect()
      expect(callCount).toBe(1) // Should not increment
    })
  })

  // ─── Factory Function Tests ─────────────────────────────────────────────────

  describe('Factory Functions', () => {
    it('should create MockLedgerAdapter via factory', () => {
      const adapter = createMockLedgerAdapter({ chain: 'ethereum' })

      expect(adapter).toBeInstanceOf(MockLedgerAdapter)
      expect(adapter.chain).toBe('ethereum')
      expect(adapter.name).toBe('mock-ledger')
    })

    it('should create MockTrezorAdapter via factory', () => {
      const adapter = createMockTrezorAdapter({ chain: 'ethereum' })

      expect(adapter).toBeInstanceOf(MockTrezorAdapter)
      expect(adapter.chain).toBe('ethereum')
      expect(adapter.name).toBe('mock-trezor')
    })

    it('should accept custom configuration', () => {
      const adapter = createMockLedgerAdapter({
        chain: 'solana',
        accountIndex: 3,
        signingDelay: 500,
        mockAddress: '0xcustom',
      })

      expect(adapter.chain).toBe('solana')
    })
  })

  // ─── Cross-Adapter Compatibility Tests ──────────────────────────────────────

  describe('Cross-Adapter Compatibility', () => {
    it('should have same interface for Ledger and Trezor', async () => {
      const ledger = createMockLedgerAdapter({ chain: 'ethereum' })
      const trezor = createMockTrezorAdapter({ chain: 'ethereum' })

      // Both should have same methods
      expect(typeof ledger.connect).toBe('function')
      expect(typeof trezor.connect).toBe('function')
      expect(typeof ledger.signMessage).toBe('function')
      expect(typeof trezor.signMessage).toBe('function')
      expect(typeof ledger.getAccounts).toBe('function')
      expect(typeof trezor.getAccounts).toBe('function')

      // Both should connect and sign
      await ledger.connect()
      await trezor.connect()

      const message = new TextEncoder().encode('test')
      const ledgerSig = await ledger.signMessage(message)
      const trezorSig = await trezor.signMessage(message)

      expect(ledgerSig.signature).toBeTruthy()
      expect(trezorSig.signature).toBeTruthy()
    })

    it('should return different addresses for different devices', async () => {
      const ledger = createMockLedgerAdapter({ chain: 'ethereum' })
      const trezor = createMockTrezorAdapter({ chain: 'ethereum' })

      await ledger.connect()
      await trezor.connect()

      // Addresses should be different (mock implementations use different seeds)
      expect(ledger.address).not.toBe(trezor.address)
    })
  })
})
