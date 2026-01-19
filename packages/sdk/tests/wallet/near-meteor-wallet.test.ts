/**
 * Meteor Wallet Privacy Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MeteorWalletPrivacy,
  createMeteorWalletPrivacy,
  createMainnetMeteorWallet,
  createTestnetMeteorWallet,
  isMeteorWalletAvailable,
  MeteorWalletError,
  MeteorErrorCode,
  METEOR_DEEP_LINK_SCHEME,
  METEOR_APP_LINK_MAINNET,
  METEOR_APP_LINK_TESTNET,
  METEOR_PROVIDER_KEY,
} from '../../src/wallet/near/meteor-wallet'
import {
  generateNEARStealthMetaAddress,
  encodeNEARStealthMetaAddress,
} from '../../src/chains/near/stealth'

describe('Meteor Wallet Privacy Integration', () => {
  // ─── Constants Tests ────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have correct deep link scheme', () => {
      expect(METEOR_DEEP_LINK_SCHEME).toBe('meteorwallet://')
    })

    it('should have correct mainnet app link', () => {
      expect(METEOR_APP_LINK_MAINNET).toBe('https://app.meteorwallet.app')
    })

    it('should have correct testnet app link', () => {
      expect(METEOR_APP_LINK_TESTNET).toBe('https://testnet.meteorwallet.app')
    })

    it('should have correct provider key', () => {
      expect(METEOR_PROVIDER_KEY).toBe('meteorWallet')
    })
  })

  // ─── Factory Functions ──────────────────────────────────────────────────────

  describe('Factory Functions', () => {
    it('should create mainnet wallet with createMainnetMeteorWallet', () => {
      const wallet = createMainnetMeteorWallet()

      expect(wallet).toBeInstanceOf(MeteorWalletPrivacy)
      expect(wallet.getConfig().network).toBe('mainnet')
    })

    it('should create mainnet wallet with callback URL', () => {
      const wallet = createMainnetMeteorWallet('myapp://callback')

      expect(wallet.getConfig().callbackUrl).toBe('myapp://callback')
    })

    it('should create testnet wallet with createTestnetMeteorWallet', () => {
      const wallet = createTestnetMeteorWallet('myapp://callback')

      expect(wallet).toBeInstanceOf(MeteorWalletPrivacy)
      expect(wallet.getConfig().network).toBe('testnet')
    })

    it('should create wallet with createMeteorWalletPrivacy', () => {
      const wallet = createMeteorWalletPrivacy({
        network: 'mainnet',
        callbackUrl: 'myapp://callback',
        contractId: 'sip.near',
        preferExtension: false,
      })

      expect(wallet).toBeInstanceOf(MeteorWalletPrivacy)
      expect(wallet.getConfig().contractId).toBe('sip.near')
      expect(wallet.getConfig().preferExtension).toBe(false)
    })
  })

  // ─── Extension Detection ────────────────────────────────────────────────────

  describe('Extension Detection', () => {
    it('should report extension not available in test environment', () => {
      const wallet = createTestnetMeteorWallet()

      expect(wallet.isExtensionAvailable()).toBe(false)
    })

    it('should report Meteor wallet not available globally', () => {
      expect(isMeteorWalletAvailable()).toBe(false)
    })
  })

  // ─── Connection State ───────────────────────────────────────────────────────

  describe('Connection State', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
    })

    it('should start disconnected', () => {
      expect(wallet.getConnectionState()).toBe('disconnected')
      expect(wallet.isConnected()).toBe(false)
      expect(wallet.getAccountId()).toBeNull()
      expect(wallet.getPublicKey()).toBeNull()
      expect(wallet.getSigningMode()).toBe('unknown')
    })

    it('should handle deep link callback', () => {
      const params = new URLSearchParams({
        accountId: 'alice.testnet',
        publicKey: 'ed25519:ABC123',
      })

      const result = wallet.handleDeepLinkCallback(params)

      expect(result).toBe(true)
      expect(wallet.getConnectionState()).toBe('connected')
      expect(wallet.isConnected()).toBe(true)
      expect(wallet.getAccountId()).toBe('alice.testnet')
      expect(wallet.getPublicKey()).toBe('ed25519:ABC123')
      expect(wallet.getSigningMode()).toBe('deeplink')
    })

    it('should handle failed deep link callback', () => {
      const params = new URLSearchParams({
        error: 'User rejected',
      })

      const result = wallet.handleDeepLinkCallback(params)

      expect(result).toBe(false)
      expect(wallet.getConnectionState()).toBe('error')
    })

    it('should handle empty callback', () => {
      const params = new URLSearchParams({})

      const result = wallet.handleDeepLinkCallback(params)

      expect(result).toBe(false)
      expect(wallet.getConnectionState()).toBe('error')
    })

    it('should set connection manually', () => {
      wallet.setConnection('bob.testnet', 'ed25519:XYZ789', 'extension')

      expect(wallet.isConnected()).toBe(true)
      expect(wallet.getAccountId()).toBe('bob.testnet')
      expect(wallet.getPublicKey()).toBe('ed25519:XYZ789')
      expect(wallet.getSigningMode()).toBe('extension')
    })

    it('should disconnect', async () => {
      wallet.setConnection('alice.testnet')
      await wallet.disconnect()

      expect(wallet.getConnectionState()).toBe('disconnected')
      expect(wallet.isConnected()).toBe(false)
      expect(wallet.getAccountId()).toBeNull()
      expect(wallet.getSigningMode()).toBe('unknown')
    })
  })

  // ─── Deep Links ─────────────────────────────────────────────────────────────

  describe('Deep Links', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
    })

    it('should generate connect deep link', () => {
      const link = wallet.getConnectDeepLink()

      expect(link).toContain(METEOR_DEEP_LINK_SCHEME)
      expect(link).toContain('connect')
      expect(link).toContain('network=testnet')
      expect(link).toContain('callback=myapp%3A%2F%2Fcallback')
    })

    it('should include contract ID in connect deep link', () => {
      const walletWithContract = createMeteorWalletPrivacy({
        network: 'testnet',
        callbackUrl: 'myapp://callback',
        contractId: 'sip.testnet',
      })

      const link = walletWithContract.getConnectDeepLink()

      expect(link).toContain('contractId=sip.testnet')
    })

    it('should throw if no callback URL for deep link', () => {
      const walletNoCallback = createTestnetMeteorWallet()

      expect(() => walletNoCallback.getConnectDeepLink()).toThrow('Callback URL required')
    })
  })

  // ─── Multi-Account Support ──────────────────────────────────────────────────

  describe('Multi-Account Support', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet', 'ed25519:ABC')
    })

    it('should track connected accounts', () => {
      const accounts = wallet.getAccounts()

      expect(accounts).toHaveLength(1)
      expect(accounts[0].accountId).toBe('alice.testnet')
    })

    it('should add additional accounts', () => {
      wallet.addAccount('bob.testnet', 'ed25519:XYZ')

      const accounts = wallet.getAccounts()
      expect(accounts).toHaveLength(2)
    })

    it('should switch accounts', () => {
      wallet.addAccount('bob.testnet', 'ed25519:XYZ')
      wallet.switchAccount('bob.testnet')

      expect(wallet.getAccountId()).toBe('bob.testnet')
      expect(wallet.getPublicKey()).toBe('ed25519:XYZ')
    })

    it('should throw when switching to unknown account', () => {
      expect(() => wallet.switchAccount('unknown.testnet')).toThrow('not found')
    })

    it('should reset privacy keys when switching accounts', () => {
      wallet.derivePrivacyKeysFromSecret('secret')
      expect(wallet.hasPrivacyKeys()).toBe(true)

      wallet.addAccount('bob.testnet', 'ed25519:XYZ')
      wallet.switchAccount('bob.testnet')

      expect(wallet.hasPrivacyKeys()).toBe(false)
    })
  })

  // ─── Privacy Key Derivation ─────────────────────────────────────────────────

  describe('Privacy Key Derivation', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
    })

    it('should derive privacy keys from secret', () => {
      const keys = wallet.derivePrivacyKeysFromSecret('my-secret-password')

      expect(keys.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.derivedFrom).toBe('secret')
    })

    it('should derive deterministic keys', () => {
      const keys1 = wallet.derivePrivacyKeysFromSecret('same-password')

      const wallet2 = createTestnetMeteorWallet()
      wallet2.setConnection('alice.testnet')
      const keys2 = wallet2.derivePrivacyKeysFromSecret('same-password')

      expect(keys1.spendingPrivateKey).toBe(keys2.spendingPrivateKey)
      expect(keys1.viewingPrivateKey).toBe(keys2.viewingPrivateKey)
    })

    it('should derive different keys for different secrets', () => {
      const keys1 = wallet.derivePrivacyKeysFromSecret('password1')

      const wallet2 = createTestnetMeteorWallet()
      wallet2.setConnection('alice.testnet')
      const keys2 = wallet2.derivePrivacyKeysFromSecret('password2')

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey)
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMeteorWallet()

      expect(() => disconnectedWallet.derivePrivacyKeysFromSecret('secret')).toThrow('Not connected')
    })

    it('should check if privacy keys are derived', () => {
      expect(wallet.hasPrivacyKeys()).toBe(false)

      wallet.derivePrivacyKeysFromSecret('secret')

      expect(wallet.hasPrivacyKeys()).toBe(true)
      expect(wallet.getPrivacyKeys()).not.toBeNull()
    })

    it('should update account privacy status', () => {
      wallet.derivePrivacyKeysFromSecret('secret')

      const accounts = wallet.getAccounts()
      expect(accounts[0].hasPrivacyKeys).toBe(true)
    })
  })

  // ─── Stealth Address Operations ─────────────────────────────────────────────

  describe('Stealth Address Operations', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeysFromSecret('my-secret')
    })

    it('should generate stealth meta-address', () => {
      const result = wallet.generateStealthMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
      expect(result.encoded).toMatch(/^sip:near:/i)
    })

    it('should generate stealth meta-address with label', () => {
      const result = wallet.generateStealthMetaAddress('my-label')

      expect(result.metaAddress.label).toBe('my-label')
    })

    it('should generate stealth address for receiving', () => {
      const { encoded: metaAddress } = wallet.generateStealthMetaAddress()
      const result = wallet.generateStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/i)
      expect(result.ephemeralPublicKey).toMatch(/^0x[a-f0-9]+$/i)
    })

    it('should check stealth address ownership', () => {
      const { encoded: metaAddress } = wallet.generateStealthMetaAddress()
      const { stealthAddress } = wallet.generateStealthAddress(metaAddress)

      const isOwner = wallet.checkStealthAddress(stealthAddress)
      expect(isOwner).toBe(true)
    })

    it('should derive stealth private key', () => {
      const { encoded: metaAddress } = wallet.generateStealthMetaAddress()
      const { stealthAddress } = wallet.generateStealthAddress(metaAddress)

      const privateKey = wallet.deriveStealthPrivateKey(stealthAddress)
      expect(privateKey).toMatch(/^0x[a-f0-9]{64}$/i)
    })

    it('should throw if privacy keys not derived', () => {
      const freshWallet = createTestnetMeteorWallet()
      freshWallet.setConnection('bob.testnet')

      expect(() => freshWallet.generateStealthMetaAddress()).toThrow('Privacy keys not derived')
    })
  })

  // ─── Transaction Simulation ─────────────────────────────────────────────────

  describe('Transaction Simulation', () => {
    let wallet: MeteorWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeysFromSecret('my-secret')

      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should return estimated simulation when extension not available', async () => {
      const simulation = await wallet.simulatePrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })

      expect(simulation.success).toBe(true)
      expect(simulation.gasUsed).toBeDefined()
      expect(simulation.gasCostNEAR).toBeDefined()
    })

    it('should throw if not connected', async () => {
      const disconnectedWallet = createTestnetMeteorWallet()

      await expect(disconnectedWallet.simulatePrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).rejects.toThrow('Not connected')
    })
  })

  // ─── Private Transfer Deep Links ────────────────────────────────────────────

  describe('Private Transfer Deep Links', () => {
    let wallet: MeteorWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeysFromSecret('my-secret')

      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should generate private transfer deep link', () => {
      const link = wallet.getPrivateTransferDeepLink({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })

      expect(link).toContain(METEOR_DEEP_LINK_SCHEME)
      expect(link).toContain('sign')
      expect(link).toContain('signerId=alice.testnet')
      expect(link).toContain('receiverId=')
      expect(link).toContain('callback=')
      expect(link).toContain('actions=')
      expect(link).toContain('meta=')
    })

    it('should generate private transfer app link', () => {
      const link = wallet.getPrivateTransferAppLink({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })

      expect(link).toContain(METEOR_APP_LINK_TESTNET)
      expect(link).toContain('/sign')
      expect(link).toContain('link=')
    })

    it('should use mainnet app link for mainnet', () => {
      const mainnetWallet = createMainnetMeteorWallet('myapp://callback')
      mainnetWallet.setConnection('alice.near')
      mainnetWallet.derivePrivacyKeysFromSecret('secret')

      const link = mainnetWallet.getPrivateTransferAppLink({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })

      expect(link).toContain(METEOR_APP_LINK_MAINNET)
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMeteorWallet('myapp://callback')

      expect(() => disconnectedWallet.getPrivateTransferDeepLink({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).toThrow('Not connected')
    })

    it('should throw if no callback URL', () => {
      const walletNoCallback = createTestnetMeteorWallet()
      walletNoCallback.setConnection('alice.testnet')

      expect(() => walletNoCallback.getPrivateTransferDeepLink({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).toThrow('Callback URL required')
    })
  })

  // ─── Transaction Callback ───────────────────────────────────────────────────

  describe('Transaction Callback', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
    })

    it('should handle successful transaction callback', () => {
      const params = new URLSearchParams({
        transactionHash: 'ABC123XYZ',
        stealthAccountId: 'abcdef123456',
        announcementMemo: 'SIP:...',
      })

      const result = wallet.handleTransactionCallback(params)

      expect(result.transactionHash).toBe('ABC123XYZ')
      expect(result.stealthAccountId).toBe('abcdef123456')
      expect(result.announcementMemo).toBe('SIP:...')
      expect(result.success).toBe(true)
      expect(wallet.getConnectionState()).toBe('connected')
    })

    it('should throw on error callback', () => {
      const params = new URLSearchParams({
        error: 'User rejected transaction',
      })

      expect(() => wallet.handleTransactionCallback(params)).toThrow('User rejected')
    })

    it('should handle missing data gracefully', () => {
      const params = new URLSearchParams({})

      const result = wallet.handleTransactionCallback(params)

      expect(result.transactionHash).toBe('')
      expect(result.success).toBe(false)
    })
  })

  // ─── Stealth Address Display ────────────────────────────────────────────────

  describe('Stealth Address Display', () => {
    let wallet: MeteorWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMeteorWallet()
    })

    it('should format stealth account ID', () => {
      const accountId = 'a'.repeat(64)
      const formatted = wallet.formatStealthAccountId(accountId)

      expect(formatted).toBe('aaaaaaaa...aaaaaaaa')
      expect(formatted.length).toBeLessThan(accountId.length)
    })

    it('should not format non-implicit account ID', () => {
      const accountId = 'alice.testnet'
      const formatted = wallet.formatStealthAccountId(accountId)

      expect(formatted).toBe(accountId)
    })

    it('should get explorer URL for testnet', () => {
      const url = wallet.getStealthAccountExplorerUrl('abc123')

      expect(url).toContain('testnet.nearblocks.io')
      expect(url).toContain('/address/abc123')
    })

    it('should get explorer URL for mainnet', () => {
      const mainnetWallet = createMainnetMeteorWallet()
      const url = mainnetWallet.getStealthAccountExplorerUrl('abc123')

      expect(url).toContain('nearblocks.io/address')
      expect(url).not.toContain('testnet')
    })
  })

  // ─── Error Handling ─────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should have correct error codes', () => {
      expect(MeteorErrorCode.USER_REJECTED).toBe('USER_REJECTED')
      expect(MeteorErrorCode.NOT_CONNECTED).toBe('NOT_CONNECTED')
      expect(MeteorErrorCode.EXTENSION_NOT_FOUND).toBe('EXTENSION_NOT_FOUND')
      expect(MeteorErrorCode.INVALID_PARAMS).toBe('INVALID_PARAMS')
      expect(MeteorErrorCode.SIMULATION_FAILED).toBe('SIMULATION_FAILED')
      expect(MeteorErrorCode.TRANSACTION_FAILED).toBe('TRANSACTION_FAILED')
      expect(MeteorErrorCode.SIGNING_FAILED).toBe('SIGNING_FAILED')
      expect(MeteorErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR')
      expect(MeteorErrorCode.UNKNOWN).toBe('UNKNOWN')
    })

    it('should create MeteorWalletError with code', () => {
      const error = new MeteorWalletError(
        'Test error',
        MeteorErrorCode.NOT_CONNECTED
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe(MeteorErrorCode.NOT_CONNECTED)
      expect(error.name).toBe('MeteorWalletError')
    })

    it('should include original error', () => {
      const originalError = new Error('Original')
      const error = new MeteorWalletError(
        'Wrapped error',
        MeteorErrorCode.UNKNOWN,
        originalError
      )

      expect(error.originalError).toBe(originalError)
    })
  })

  // ─── Extension Methods (without extension) ──────────────────────────────────

  describe('Extension Methods (without extension)', () => {
    let wallet: MeteorWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMeteorWallet('myapp://callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeysFromSecret('my-secret')

      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should throw on connect without extension', async () => {
      const freshWallet = createMeteorWalletPrivacy({
        network: 'testnet',
        preferExtension: true,
      })

      await expect(freshWallet.connectExtension()).rejects.toThrow('extension not found')
    })

    it('should throw on sendPrivateTransfer without extension', async () => {
      await expect(wallet.sendPrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).rejects.toThrow('Extension required')
    })

    it('should throw on sendBatchPrivateTransfers without extension', async () => {
      await expect(wallet.sendBatchPrivateTransfers([
        { recipientMetaAddress, amount: '1000000000000000000000000' },
      ])).rejects.toThrow('Extension required')
    })

    it('should throw on derivePrivacyKeysFromSignature without extension', async () => {
      await expect(wallet.derivePrivacyKeysFromSignature()).rejects.toThrow('Extension required')
    })
  })
})
