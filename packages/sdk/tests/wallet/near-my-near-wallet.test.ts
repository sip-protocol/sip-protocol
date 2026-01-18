/**
 * MyNearWallet Privacy Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MyNearWalletPrivacy,
  createMyNearWalletPrivacy,
  createMainnetMyNearWallet,
  createTestnetMyNearWallet,
  parseMyNearWalletCallback,
  MY_NEAR_WALLET_MAINNET,
  MY_NEAR_WALLET_TESTNET,
} from '../../src/wallet/near/my-near-wallet'
import {
  generateNEARStealthMetaAddress,
  encodeNEARStealthMetaAddress,
} from '../../src/chains/near/stealth'

describe('MyNearWallet Privacy Integration', () => {
  // ─── Constants Tests ────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have correct mainnet URL', () => {
      expect(MY_NEAR_WALLET_MAINNET).toBe('https://app.mynearwallet.com')
    })

    it('should have correct testnet URL', () => {
      expect(MY_NEAR_WALLET_TESTNET).toBe('https://testnet.mynearwallet.com')
    })
  })

  // ─── Factory Functions ──────────────────────────────────────────────────────

  describe('Factory Functions', () => {
    it('should create mainnet wallet with createMainnetMyNearWallet', () => {
      const wallet = createMainnetMyNearWallet('https://myapp.com/callback')

      expect(wallet).toBeInstanceOf(MyNearWalletPrivacy)
      expect(wallet.getWalletUrl()).toBe(MY_NEAR_WALLET_MAINNET)
      expect(wallet.getConfig().network).toBe('mainnet')
      expect(wallet.getConfig().callbackUrl).toBe('https://myapp.com/callback')
    })

    it('should create testnet wallet with createTestnetMyNearWallet', () => {
      const wallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(wallet).toBeInstanceOf(MyNearWalletPrivacy)
      expect(wallet.getWalletUrl()).toBe(MY_NEAR_WALLET_TESTNET)
      expect(wallet.getConfig().network).toBe('testnet')
    })

    it('should create wallet with createMyNearWalletPrivacy', () => {
      const wallet = createMyNearWalletPrivacy({
        network: 'mainnet',
        callbackUrl: 'https://myapp.com/callback',
        contractId: 'sip.near',
      })

      expect(wallet).toBeInstanceOf(MyNearWalletPrivacy)
      expect(wallet.getConfig().contractId).toBe('sip.near')
    })

    it('should use custom wallet URL if provided', () => {
      const customUrl = 'https://custom-wallet.near.org'
      const wallet = createMyNearWalletPrivacy({
        network: 'mainnet',
        callbackUrl: 'https://myapp.com/callback',
        walletUrl: customUrl,
      })

      expect(wallet.getWalletUrl()).toBe(customUrl)
    })
  })

  // ─── Connection State ───────────────────────────────────────────────────────

  describe('Connection State', () => {
    let wallet: MyNearWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
    })

    it('should start disconnected', () => {
      expect(wallet.getConnectionState()).toBe('disconnected')
      expect(wallet.isConnected()).toBe(false)
      expect(wallet.getAccountId()).toBeNull()
      expect(wallet.getPublicKey()).toBeNull()
    })

    it('should handle login callback', () => {
      const params = new URLSearchParams({
        account_id: 'alice.testnet',
        public_key: 'ed25519:ABC123',
      })

      const result = wallet.handleLoginCallback(params)

      expect(result).toBe(true)
      expect(wallet.getConnectionState()).toBe('connected')
      expect(wallet.isConnected()).toBe(true)
      expect(wallet.getAccountId()).toBe('alice.testnet')
      expect(wallet.getPublicKey()).toBe('ed25519:ABC123')
    })

    it('should handle failed login callback', () => {
      const params = new URLSearchParams({})

      const result = wallet.handleLoginCallback(params)

      expect(result).toBe(false)
      expect(wallet.getConnectionState()).toBe('error')
      expect(wallet.isConnected()).toBe(false)
    })

    it('should set connection manually', () => {
      wallet.setConnection('bob.testnet', 'ed25519:XYZ789')

      expect(wallet.isConnected()).toBe(true)
      expect(wallet.getAccountId()).toBe('bob.testnet')
      expect(wallet.getPublicKey()).toBe('ed25519:XYZ789')
    })

    it('should disconnect', () => {
      wallet.setConnection('alice.testnet')
      wallet.disconnect()

      expect(wallet.getConnectionState()).toBe('disconnected')
      expect(wallet.isConnected()).toBe(false)
      expect(wallet.getAccountId()).toBeNull()
      expect(wallet.getPublicKey()).toBeNull()
    })

    it('should detect Ledger usage', () => {
      const params = new URLSearchParams({
        account_id: 'ledger.testnet',
        public_key: 'ed25519:ABC123',
        all_keys: JSON.stringify(['ed25519:ABC123:ledger']),
      })

      wallet.handleLoginCallback(params)
      const ledgerStatus = wallet.getLedgerStatus()

      expect(ledgerStatus.isLedger).toBe(true)
      expect(ledgerStatus.requiresLedgerConfirmation).toBe(true)
    })

    it('should report non-Ledger usage', () => {
      const params = new URLSearchParams({
        account_id: 'alice.testnet',
        public_key: 'ed25519:ABC123',
      })

      wallet.handleLoginCallback(params)
      const ledgerStatus = wallet.getLedgerStatus()

      expect(ledgerStatus.isLedger).toBe(false)
      expect(ledgerStatus.requiresLedgerConfirmation).toBe(false)
    })
  })

  // ─── Sign-In URL ────────────────────────────────────────────────────────────

  describe('Sign-In URL', () => {
    it('should generate sign-in URL with default callback', () => {
      const wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      const url = wallet.getSignInUrl()

      expect(url).toContain(MY_NEAR_WALLET_TESTNET)
      expect(url).toContain('/login')
      expect(url).toContain('success_url=https%3A%2F%2Fmyapp.com%2Fcallback')
      expect(url).toContain('failure_url=https%3A%2F%2Fmyapp.com%2Fcallback')
    })

    it('should generate sign-in URL with custom callbacks', () => {
      const wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      const url = wallet.getSignInUrl({
        successUrl: 'https://myapp.com/success',
        failureUrl: 'https://myapp.com/failure',
      })

      expect(url).toContain('success_url=https%3A%2F%2Fmyapp.com%2Fsuccess')
      expect(url).toContain('failure_url=https%3A%2F%2Fmyapp.com%2Ffailure')
    })

    it('should include contract ID in sign-in URL', () => {
      const wallet = createMyNearWalletPrivacy({
        network: 'testnet',
        callbackUrl: 'https://myapp.com/callback',
        contractId: 'sip.testnet',
      })
      const url = wallet.getSignInUrl()

      expect(url).toContain('contract_id=sip.testnet')
    })
  })

  // ─── Privacy Key Derivation ─────────────────────────────────────────────────

  describe('Privacy Key Derivation', () => {
    let wallet: MyNearWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
    })

    it('should derive privacy keys', () => {
      const keys = wallet.derivePrivacyKeys('my-secret-password')

      expect(keys.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(keys.derivationLabel).toBe('default')
    })

    it('should derive deterministic keys', () => {
      const keys1 = wallet.derivePrivacyKeys('same-password')

      // Create new wallet and derive again
      const wallet2 = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet2.setConnection('alice.testnet')
      const keys2 = wallet2.derivePrivacyKeys('same-password')

      expect(keys1.spendingPrivateKey).toBe(keys2.spendingPrivateKey)
      expect(keys1.viewingPrivateKey).toBe(keys2.viewingPrivateKey)
    })

    it('should derive different keys for different secrets', () => {
      const keys1 = wallet.derivePrivacyKeys('password1')

      const wallet2 = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet2.setConnection('alice.testnet')
      const keys2 = wallet2.derivePrivacyKeys('password2')

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey)
    })

    it('should derive different keys for different labels', () => {
      const keys1 = wallet.derivePrivacyKeys('password', 'label1')
      const keys2 = wallet.derivePrivacyKeys('password', 'label2')

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey)
      expect(keys1.derivationLabel).toBe('label1')
      expect(keys2.derivationLabel).toBe('label2')
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(() => disconnectedWallet.derivePrivacyKeys('secret')).toThrow('Not connected')
    })

    it('should check if privacy keys are derived', () => {
      expect(wallet.hasPrivacyKeys()).toBe(false)

      wallet.derivePrivacyKeys('secret')

      expect(wallet.hasPrivacyKeys()).toBe(true)
      expect(wallet.getPrivacyKeys()).not.toBeNull()
    })
  })

  // ─── Stealth Address Operations ─────────────────────────────────────────────

  describe('Stealth Address Operations', () => {
    let wallet: MyNearWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')
    })

    it('should generate stealth meta-address', () => {
      const result = wallet.generateStealthMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[a-f0-9]+$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[a-f0-9]+$/i)
      expect(result.encoded).toMatch(/^sip:near:/i)
      expect(result.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
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
      expect(result.createdAt).toBeGreaterThan(0)
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

    it('should track generated stealth addresses', () => {
      const { encoded: metaAddress } = wallet.generateStealthMetaAddress()
      wallet.generateStealthAddress(metaAddress, 'first')
      wallet.generateStealthAddress(metaAddress, 'second')

      const tracked = wallet.getStealthAddresses()
      expect(tracked.size).toBe(2)
    })

    it('should throw if privacy keys not derived', () => {
      const freshWallet = createTestnetMyNearWallet('https://myapp.com/callback')
      freshWallet.setConnection('bob.testnet')

      expect(() => freshWallet.generateStealthMetaAddress()).toThrow('Privacy keys not derived')
    })
  })

  // ─── Transaction Preview ────────────────────────────────────────────────────

  describe('Transaction Preview', () => {
    let wallet: MyNearWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')

      // Generate a recipient meta-address (use .metaAddress from the result)
      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should preview private transfer', () => {
      const preview = wallet.previewPrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000', // 1 NEAR
      })

      expect(preview.senderId).toBe('alice.testnet')
      expect(preview.receiverId).toMatch(/^[a-f0-9]{64}$/i) // Stealth account ID
      expect(preview.amountNEAR).toBe('1')
      expect(preview.amountYocto).toBe('1000000000000000000000000')
      expect(preview.isPrivate).toBe(true)
      expect(preview.stealthInfo.stealthAccountId).toBe(preview.receiverId)
      expect(preview.stealthInfo.announcementMemo).toMatch(/^SIP:/i)
      expect(preview.actions).toHaveLength(1)
      expect(preview.actions[0].type).toBe('Transfer')
    })

    it('should preview with bigint amount', () => {
      const preview = wallet.previewPrivateTransfer({
        recipientMetaAddress,
        amount: BigInt('5000000000000000000000000'),
      })

      expect(preview.amountNEAR).toBe('5')
      expect(preview.amountYocto).toBe('5000000000000000000000000')
    })

    it('should format fractional NEAR amounts', () => {
      const preview = wallet.previewPrivateTransfer({
        recipientMetaAddress,
        amount: '1500000000000000000000000', // 1.5 NEAR
      })

      expect(preview.amountNEAR).toBe('1.5')
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(() => disconnectedWallet.previewPrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).toThrow('Not connected')
    })
  })

  // ─── Private Transfer URLs ──────────────────────────────────────────────────

  describe('Private Transfer URLs', () => {
    let wallet: MyNearWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')

      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should generate private transfer URL', () => {
      const url = wallet.getPrivateTransferUrl({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })

      expect(url).toContain(MY_NEAR_WALLET_TESTNET)
      expect(url).toContain('/sign')
      expect(url).toContain('signerId=alice.testnet')
      expect(url).toContain('receiverId=')
      expect(url).toContain('callbackUrl=')
      expect(url).toContain('actions=')
      expect(url).toContain('meta=')
    })

    it('should include privacy metadata in URL', () => {
      const url = wallet.getPrivateTransferUrl({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
        label: 'test-transfer',
      })

      expect(url).toContain('isPrivate')
      expect(url).toContain('test-transfer')
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(() => disconnectedWallet.getPrivateTransferUrl({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).toThrow('Not connected')
    })
  })

  // ─── Batch Transfers ────────────────────────────────────────────────────────

  describe('Batch Transfers', () => {
    let wallet: MyNearWalletPrivacy
    let recipientMeta1: string
    let recipientMeta2: string

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')

      const result1 = generateNEARStealthMetaAddress()
      const result2 = generateNEARStealthMetaAddress()
      recipientMeta1 = encodeNEARStealthMetaAddress(result1.metaAddress)
      recipientMeta2 = encodeNEARStealthMetaAddress(result2.metaAddress)
    })

    it('should generate batch transfer URL', () => {
      const url = wallet.getBatchPrivateTransferUrl([
        { recipientMetaAddress: recipientMeta1, amount: '1000000000000000000000000' },
        { recipientMetaAddress: recipientMeta2, amount: '2000000000000000000000000' },
      ])

      expect(url).toContain(MY_NEAR_WALLET_TESTNET)
      expect(url).toContain('/sign')
      expect(url).toContain('transactions=')
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(() => disconnectedWallet.getBatchPrivateTransferUrl([
        { recipientMetaAddress: recipientMeta1, amount: '1000000000000000000000000' },
      ])).toThrow('Not connected')
    })
  })

  // ─── Transaction Callback ───────────────────────────────────────────────────

  describe('Transaction Callback', () => {
    let wallet: MyNearWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
    })

    it('should handle successful transaction callback', () => {
      const params = new URLSearchParams({
        transactionHashes: 'ABC123XYZ',
      })

      const result = wallet.handleTransactionCallback(params)

      expect(result.transactionHashes).toBe('ABC123XYZ')
      expect(result.errorCode).toBeUndefined()
      expect(result.errorMessage).toBeUndefined()
      expect(result.accountId).toBe('alice.testnet')
      expect(wallet.getConnectionState()).toBe('connected')
    })

    it('should handle failed transaction callback', () => {
      const params = new URLSearchParams({
        errorCode: 'UserRejected',
        errorMessage: 'User rejected the transaction',
      })

      const result = wallet.handleTransactionCallback(params)

      expect(result.transactionHashes).toBeUndefined()
      expect(result.errorCode).toBe('UserRejected')
      expect(result.errorMessage).toBe('User rejected the transaction')
    })
  })

  // ─── Viewing Key Export ─────────────────────────────────────────────────────

  describe('Viewing Key Export', () => {
    let wallet: MyNearWalletPrivacy

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')
    })

    it('should export viewing key', () => {
      const exported = wallet.exportViewingKey()

      expect(exported.network).toBe('testnet')
      expect(exported.viewingPublicKey).toMatch(/^0x[a-f0-9]+$/i)
      expect(exported.viewingPrivateKey).toMatch(/^0x[a-f0-9]+$/i)
      expect(exported.spendingPublicKey).toMatch(/^0x[a-f0-9]+$/i)
      expect(exported.accountId).toBe('alice.testnet')
      expect(exported.createdAt).toBeGreaterThan(0)
      expect(exported.walletType).toBe('mynearwallet')
    })

    it('should export viewing key with label', () => {
      const exported = wallet.exportViewingKey('my-export-label')

      expect(exported.label).toBe('my-export-label')
    })

    it('should throw if privacy keys not derived', () => {
      const freshWallet = createTestnetMyNearWallet('https://myapp.com/callback')
      freshWallet.setConnection('bob.testnet')

      expect(() => freshWallet.exportViewingKey()).toThrow('Privacy keys not derived')
    })

    it('should throw if not connected', () => {
      const disconnectedWallet = createTestnetMyNearWallet('https://myapp.com/callback')

      expect(() => disconnectedWallet.exportViewingKey()).toThrow('Privacy keys not derived')
    })
  })

  // ─── Callback Parser ────────────────────────────────────────────────────────

  describe('Callback Parser', () => {
    it('should parse login callback', () => {
      const url = 'https://myapp.com/callback?account_id=alice.testnet&public_key=ed25519:ABC'
      const result = parseMyNearWalletCallback(url)

      expect(result.type).toBe('login')
      expect(result.params.get('account_id')).toBe('alice.testnet')
    })

    it('should parse transaction callback', () => {
      const url = 'https://myapp.com/callback?transactionHashes=ABC123'
      const result = parseMyNearWalletCallback(url)

      expect(result.type).toBe('transaction')
      expect(result.params.get('transactionHashes')).toBe('ABC123')
    })

    it('should parse error callback as transaction', () => {
      const url = 'https://myapp.com/callback?errorCode=UserRejected'
      const result = parseMyNearWalletCallback(url)

      expect(result.type).toBe('transaction')
      expect(result.params.get('errorCode')).toBe('UserRejected')
    })
  })

  // ─── Browser Redirect Methods ───────────────────────────────────────────────

  describe('Browser Redirect Methods (mocked)', () => {
    let wallet: MyNearWalletPrivacy
    let recipientMetaAddress: string

    beforeEach(() => {
      wallet = createTestnetMyNearWallet('https://myapp.com/callback')
      wallet.setConnection('alice.testnet')
      wallet.derivePrivacyKeys('my-secret')

      const result = generateNEARStealthMetaAddress()
      recipientMetaAddress = encodeNEARStealthMetaAddress(result.metaAddress)
    })

    it('should throw in non-browser environment for connect', () => {
      expect(() => wallet.connect()).toThrow('requires browser environment')
    })

    it('should throw in non-browser environment for sendPrivateTransfer', () => {
      expect(() => wallet.sendPrivateTransfer({
        recipientMetaAddress,
        amount: '1000000000000000000000000',
      })).toThrow('requires browser environment')
    })

    it('should throw in non-browser environment for sendBatchPrivateTransfers', () => {
      expect(() => wallet.sendBatchPrivateTransfers([
        { recipientMetaAddress, amount: '1000000000000000000000000' },
      ])).toThrow('requires browser environment')
    })
  })
})
