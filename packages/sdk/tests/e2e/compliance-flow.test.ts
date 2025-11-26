/**
 * E2E Compliance Flow Tests
 *
 * Tests for COMPLIANT privacy level:
 * 1. Create compliant-mode intent
 * 2. Generate viewing key
 * 3. Complete transaction
 * 4. Verify auditor can see details with key
 * 5. Verify public cannot see details
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import type { ChainId, HexString } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  verifyCompliance,
  suppressConsoleWarnings,
  type E2ETestFixture,
  type TestTransactionData,
} from './helpers'
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../../src/privacy'
import { CryptoError } from '../../src/errors'

describe('E2E: Compliance Flow', () => {
  let fixture: E2ETestFixture
  let restoreConsole: () => void

  beforeEach(async () => {
    restoreConsole = suppressConsoleWarnings()
    fixture = await createE2EFixture()
  })

  afterEach(() => {
    fixture.cleanup()
    restoreConsole()
  })

  // ─── Viewing Key Generation ─────────────────────────────────────────────────────

  describe('Viewing Key Generation', () => {
    it('should generate viewing key for compliance', () => {
      const viewingKey = fixture.sip.generateViewingKey('/m/44/501/0')

      expect(viewingKey.key).toBeDefined()
      expect(viewingKey.hash).toBeDefined()
      expect(viewingKey.path).toBe('/m/44/501/0')
    })

    it('should generate unique viewing keys for different paths', () => {
      const key1 = fixture.sip.generateViewingKey('/m/44/501/0')
      const key2 = fixture.sip.generateViewingKey('/m/44/501/1')
      const key3 = fixture.sip.generateViewingKey('/m/44/501/2')

      // All keys should be unique
      expect(key1.key).not.toBe(key2.key)
      expect(key2.key).not.toBe(key3.key)
      expect(key1.key).not.toBe(key3.key)

      // All hashes should be unique
      expect(key1.hash).not.toBe(key2.hash)
      expect(key2.hash).not.toBe(key3.hash)
    })

    it('should derive child viewing keys', () => {
      const masterKey = fixture.sip.generateViewingKey('/m/44/501/0')

      const auditKey = fixture.sip.deriveViewingKey(masterKey, 'audit/2024')
      const taxKey = fixture.sip.deriveViewingKey(masterKey, 'tax')

      // Derived keys should be different from master
      expect(auditKey.key).not.toBe(masterKey.key)
      expect(taxKey.key).not.toBe(masterKey.key)

      // Paths should be hierarchical
      expect(auditKey.path).toBe('/m/44/501/0/audit/2024')
      expect(taxKey.path).toBe('/m/44/501/0/tax')
    })

    it('should support multiple derivation levels', () => {
      const root = fixture.sip.generateViewingKey('/m/44/501')
      const level1 = fixture.sip.deriveViewingKey(root, 'account0')
      const level2 = fixture.sip.deriveViewingKey(level1, 'audit')
      const level3 = fixture.sip.deriveViewingKey(level2, '2024')

      expect(level3.path).toBe('/m/44/501/account0/audit/2024')
    })
  })

  // ─── Compliant Intent Creation ──────────────────────────────────────────────────

  describe('Compliant Intent Creation', () => {
    it('should create intent with COMPLIANT privacy level', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)
      expect(intent.viewingKeyHash).toBeDefined()
    })

    it('should include viewing key hash in compliant intent', async () => {
      const { createShieldedIntent } = await import('../../src/intent')
      const viewingKey = fixture.sip.generateViewingKey('/m/44/501/0/compliance')

      const intent = await createShieldedIntent({
        input: {
          asset: { chain: 'solana' as ChainId, symbol: 'SOL', address: null, decimals: 9 },
          amount: 1_000_000_000n,
        },
        output: {
          asset: { chain: 'zcash' as ChainId, symbol: 'ZEC', address: null, decimals: 8 },
          minAmount: 50_000_000n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.COMPLIANT,
        viewingKey: viewingKey.key,
        ttl: 3600,
      })

      expect(intent.viewingKeyHash).toBe(viewingKey.hash)
    })

    it('should still hide sender and amount in compliant mode', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      // Compliant mode should still use commitments
      expect(intent.senderCommitment).toBeDefined()
      expect(intent.inputCommitment).toBeDefined()
    })
  })

  // ─── Encryption/Decryption Flow ─────────────────────────────────────────────────

  describe('Encryption/Decryption Flow', () => {
    it('should encrypt transaction data with viewing key', () => {
      const viewingKey = generateViewingKey('/m/44/501/0')

      const txData: TestTransactionData = {
        sender: '0x1234567890abcdef',
        recipient: '0xfedcba0987654321',
        amount: '1000000000',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, viewingKey)

      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce).toBeDefined()
      expect(encrypted.viewingKeyHash).toBe(viewingKey.hash)
    })

    it('should decrypt with correct viewing key', () => {
      const viewingKey = generateViewingKey('/m/44/501/0')

      const txData: TestTransactionData = {
        sender: '0xsenderAddress',
        recipient: '0xrecipientAddress',
        amount: '500000000',
        timestamp: 1234567890,
      }

      const encrypted = encryptForViewing(txData, viewingKey)
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted.sender).toBe(txData.sender)
      expect(decrypted.recipient).toBe(txData.recipient)
      expect(decrypted.amount).toBe(txData.amount)
      expect(decrypted.timestamp).toBe(txData.timestamp)
    })

    it('should fail decryption with wrong viewing key', () => {
      const correctKey = generateViewingKey('/m/44/501/0')
      const wrongKey = generateViewingKey('/m/44/501/1')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '100',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, correctKey)

      expect(() => decryptWithViewing(encrypted, wrongKey)).toThrow(CryptoError)
    })

    it('should fail if viewing key hash does not match', () => {
      const key1 = generateViewingKey('/m/44/501/0')
      const key2 = generateViewingKey('/m/44/501/1')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '100',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, key1)

      // Decryption should verify hash and fail
      expect(() => decryptWithViewing(encrypted, key2)).toThrow()
    })
  })

  // ─── Auditor Access Flow ────────────────────────────────────────────────────────

  describe('Auditor Access Flow', () => {
    it('should allow auditor with viewing key to see transaction', () => {
      // Organization generates master viewing key
      const orgViewingKey = generateViewingKey('/m/44/501/0/org')

      // Derive auditor-specific key
      const auditorKey = deriveViewingKey(orgViewingKey, 'auditor/2024')

      // Create transaction data
      const txData: TestTransactionData = {
        sender: '0xAliceAddress',
        recipient: '0xBobAddress',
        amount: '1000000000000000000', // 1 ETH
        timestamp: Date.now(),
      }

      // Encrypt with auditor key
      const encrypted = encryptForViewing(txData, auditorKey)

      // Auditor can decrypt
      const decrypted = decryptWithViewing(encrypted, auditorKey)
      expect(decrypted.sender).toBe(txData.sender)
      expect(decrypted.amount).toBe(txData.amount)
    })

    it('should prevent unauthorized access without viewing key', () => {
      const orgKey = generateViewingKey('/m/44/501/0/org')
      const attackerKey = generateViewingKey('/m/44/501/0/attacker')

      const txData: TestTransactionData = {
        sender: '0xAlice',
        recipient: '0xBob',
        amount: '1000000',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, orgKey)

      // Attacker cannot decrypt
      expect(() => decryptWithViewing(encrypted, attackerKey)).toThrow()
    })

    it('should support selective disclosure with derived keys', () => {
      const masterKey = generateViewingKey('/m/44/501/0')

      // Create different derived keys for different scopes
      const yearlyKey = deriveViewingKey(masterKey, '2024')
      const monthlyKey = deriveViewingKey(yearlyKey, 'january')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '100',
        timestamp: Date.now(),
      }

      // Encrypt with monthly key
      const encrypted = encryptForViewing(txData, monthlyKey)

      // Can decrypt with same monthly key
      const decrypted = decryptWithViewing(encrypted, monthlyKey)
      expect(decrypted.amount).toBe('100')

      // Cannot decrypt with yearly key (different key)
      expect(() => decryptWithViewing(encrypted, yearlyKey)).toThrow()

      // Cannot decrypt with master key
      expect(() => decryptWithViewing(encrypted, masterKey)).toThrow()
    })

    it('should allow multiple auditors with same data', () => {
      // Two auditors can have their own encrypted copies
      const auditor1Key = generateViewingKey('/m/44/501/0/auditor1')
      const auditor2Key = generateViewingKey('/m/44/501/0/auditor2')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '1000',
        timestamp: Date.now(),
      }

      // Encrypt separately for each auditor
      const encrypted1 = encryptForViewing(txData, auditor1Key)
      const encrypted2 = encryptForViewing(txData, auditor2Key)

      // Each auditor can only decrypt their copy
      expect(decryptWithViewing(encrypted1, auditor1Key).amount).toBe('1000')
      expect(decryptWithViewing(encrypted2, auditor2Key).amount).toBe('1000')

      // Cannot cross-decrypt
      expect(() => decryptWithViewing(encrypted1, auditor2Key)).toThrow()
      expect(() => decryptWithViewing(encrypted2, auditor1Key)).toThrow()
    })
  })

  // ─── Compliance Verification ────────────────────────────────────────────────────

  describe('Compliance Verification', () => {
    it('should pass all compliance checks with correct keys', () => {
      const correctKey = generateViewingKey('/m/44/501/0')
      const wrongKey = generateViewingKey('/m/44/501/1')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '1000',
        timestamp: Date.now(),
      }

      const result = verifyCompliance(correctKey, wrongKey, txData)

      expect(result.viewingKeyWorks).toBe(true)
      expect(result.wrongKeyFails).toBe(true)
      expect(result.derivedKeysWork).toBe(true)
      expect(result.allPassed).toBe(true)
    })

    it('should detect if viewing key does not work', () => {
      // This scenario tests internal verification
      const key = generateViewingKey('/m/44/501/0')

      const txData: TestTransactionData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '1000',
        timestamp: Date.now(),
      }

      // Encrypt and verify
      const encrypted = encryptForViewing(txData, key)
      const decrypted = decryptWithViewing(encrypted, key)

      expect(decrypted.sender).toBe(txData.sender)
      expect(decrypted.recipient).toBe(txData.recipient)
    })
  })

  // ─── Regulatory Scenarios ───────────────────────────────────────────────────────

  describe('Regulatory Scenarios', () => {
    it('should support tax authority audit with viewing key', () => {
      // Business generates compliance viewing key
      const businessKey = generateViewingKey('/m/44/501/0/business/compliance')

      // Derive key specifically for tax authority
      const taxKey = deriveViewingKey(businessKey, 'tax/2024')

      // Transaction history
      const transactions: TestTransactionData[] = [
        { sender: '0xbusiness', recipient: '0xvendor1', amount: '10000', timestamp: 1704067200 },
        { sender: '0xbusiness', recipient: '0xvendor2', amount: '25000', timestamp: 1704153600 },
        { sender: '0xcustomer', recipient: '0xbusiness', amount: '50000', timestamp: 1704240000 },
      ]

      // Encrypt all transactions
      const encryptedTxs = transactions.map(tx => encryptForViewing(tx, taxKey))

      // Tax authority can decrypt all
      const decryptedTxs = encryptedTxs.map(enc => decryptWithViewing(enc, taxKey))

      expect(decryptedTxs).toHaveLength(3)
      expect(decryptedTxs[0].amount).toBe('10000')
      expect(decryptedTxs[2].sender).toBe('0xcustomer')
    })

    it('should support AML compliance check', () => {
      // Compliance officer's key
      const complianceKey = generateViewingKey('/m/44/501/0/compliance/aml')

      // Large transaction that needs AML review
      const largeTx: TestTransactionData = {
        sender: '0xunknownSender',
        recipient: '0xbusiness',
        amount: '1000000000000000000000', // Large amount
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(largeTx, complianceKey)

      // Compliance officer can review
      const decrypted = decryptWithViewing(encrypted, complianceKey)
      expect(BigInt(decrypted.amount)).toBeGreaterThan(0n)
    })

    it('should maintain privacy from non-authorized parties', () => {
      const authorizedKey = generateViewingKey('/m/44/501/0/authorized')
      const publicKey = generateViewingKey('/m/44/501/0/public')

      const sensitiveTx: TestTransactionData = {
        sender: '0xwealthyIndividual',
        recipient: '0xcharityOrg',
        amount: '1000000',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(sensitiveTx, authorizedKey)

      // Public cannot access
      expect(() => decryptWithViewing(encrypted, publicKey)).toThrow()

      // Only authorized can access
      const decrypted = decryptWithViewing(encrypted, authorizedKey)
      expect(decrypted.sender).toBe('0xwealthyIndividual')
    })
  })

  // ─── Complete Compliant Flow ────────────────────────────────────────────────────

  describe('Complete Compliant Flow', () => {
    it('should execute full compliant swap with audit trail', async () => {
      const { createShieldedIntent } = await import('../../src/intent')

      // 1. Generate viewing keys
      const masterKey = fixture.sip.generateViewingKey('/m/44/501/0/company')
      const auditKey = fixture.sip.deriveViewingKey(masterKey, 'audit/2024')

      // 2. Create compliant intent
      const intent = await createShieldedIntent({
        input: {
          asset: { chain: 'solana' as ChainId, symbol: 'SOL', address: null, decimals: 9 },
          amount: 1_000_000_000n,
        },
        output: {
          asset: { chain: 'zcash' as ChainId, symbol: 'ZEC', address: null, decimals: 8 },
          minAmount: 50_000_000n,
          maxSlippage: 0.01,
        },
        privacy: PrivacyLevel.COMPLIANT,
        viewingKey: auditKey.key,
        ttl: 3600,
      })

      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)
      expect(intent.viewingKeyHash).toBe(auditKey.hash)

      // 3. Get quotes and execute
      const quotes = await fixture.sip.getQuotes(intent)
      expect(quotes.length).toBeGreaterThan(0)

      // 4. Create audit record
      const stealthAddr = typeof intent.recipientStealth === 'object'
        ? (intent.recipientStealth as { address?: string })?.address ?? '0xstealthAddr'
        : String(intent.recipientStealth ?? '0xstealthAddr')

      const auditRecord: TestTransactionData = {
        sender: '0xcompanyWallet',
        recipient: stealthAddr,
        amount: intent.minOutputAmount.toString(),
        timestamp: Math.floor(Date.now() / 1000),
      }

      // 5. Encrypt for audit
      const encryptedAudit = encryptForViewing(auditRecord, auditKey)

      // 6. Verify auditor can access
      const decryptedAudit = decryptWithViewing(encryptedAudit, auditKey)
      expect(decryptedAudit.amount).toBe(intent.minOutputAmount.toString())

      // 7. Verify public cannot access
      const publicKey = generateViewingKey('/m/44/501/0/public')
      expect(() => decryptWithViewing(encryptedAudit, publicKey)).toThrow()
    })
  })
})
