/**
 * Full Flow Integration Tests
 *
 * End-to-end tests for the SIP protocol flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SIP, createSIP } from '../../src/sip'
import { MockProofProvider } from '../../src/proofs/mock'
import { IntentBuilder, hasRequiredProofs, isExpired, trackIntent } from '../../src/intent'
import { commit, verifyOpening, addCommitments, subtractCommitments, addBlindings } from '../../src/commitment'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import {
  generateViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../../src/privacy'
import { ProofGenerationError } from '../../src/proofs/interface'
import { ValidationError, CryptoError, ErrorCode } from '../../src/errors'
import { PrivacyLevel, IntentStatus } from '@sip-protocol/types'
import type { ChainId, HexString, WalletAdapter } from '@sip-protocol/types'

describe('SIP Protocol Full Flow', () => {
  // Suppress console warnings from MockProofProvider
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('SIP Client', () => {
    it('should create SIP instance with default config', () => {
      const sip = createSIP('testnet')

      expect(sip.getNetwork()).toBe('testnet')
      expect(sip.isConnected()).toBe(false)
      expect(sip.hasProofProvider()).toBe(false)
    })

    it('should create SIP instance with proof provider', async () => {
      const mockProvider = new MockProofProvider()
      await mockProvider.initialize()

      const sip = new SIP({
        network: 'testnet',
        proofProvider: mockProvider,
      })

      expect(sip.hasProofProvider()).toBe(true)
      expect(sip.getProofProvider()).toBe(mockProvider)
    })

    it('should connect and disconnect wallet', () => {
      const sip = createSIP('testnet')
      const mockWallet: WalletAdapter = {
        chain: 'near' as ChainId,
        address: '0x123',
        signMessage: async () => '0xsig',
        signTransaction: async () => ({}),
      }

      sip.connect(mockWallet)
      expect(sip.isConnected()).toBe(true)
      expect(sip.getWallet()).toBe(mockWallet)

      sip.disconnect()
      expect(sip.isConnected()).toBe(false)
      expect(sip.getWallet()).toBeUndefined()
    })

    it('should generate and retrieve stealth keys', () => {
      const sip = createSIP('testnet')

      const metaAddress = sip.generateStealthKeys('near' as ChainId, 'Test Wallet')

      expect(metaAddress.chain).toBe('near')
      expect(metaAddress.label).toBe('Test Wallet')
      expect(metaAddress.spendingKey).toBeDefined()
      expect(metaAddress.viewingKey).toBeDefined()

      // Should be able to get encoded address
      const encoded = sip.getStealthAddress()
      expect(encoded).toBeDefined()
      expect(encoded?.startsWith('sip:')).toBe(true)
    })
  })

  describe('Intent Builder', () => {
    it('should build shielded intent using builder pattern', async () => {
      const sip = createSIP('testnet')

      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 10n)
        .output('zcash' as ChainId, 'ZEC', 95n)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(3600)
        .build()

      expect(intent).toBeDefined()
      expect(intent.outputAsset.chain).toBe('zcash')
      expect(intent.outputAsset.symbol).toBe('ZEC')
      expect(intent.minOutputAmount).toBe(95n)
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)
    })

    it('should create tracked intent', async () => {
      const sip = createSIP('testnet')
      const builder = new IntentBuilder()

      const intent = await builder
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(intent.intentId).toBeDefined()
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)
    })
  })

  describe('Quote and Execute Flow', () => {
    it('should get quotes for intent', async () => {
      const sip = createSIP('testnet')

      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      const quotes = await sip.getQuotes(intent)

      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].outputAmount).toBeGreaterThan(intent.minOutputAmount)
      expect(quotes[0].solverId).toBeDefined()
    })

    it('should execute intent with quote', async () => {
      const sip = createSIP('testnet')

      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      // Track the intent for execution
      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }

      const quotes = await sip.getQuotes(tracked)
      const result = await sip.execute(tracked, quotes[0])

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.outputAmount).toBeGreaterThanOrEqual(tracked.minOutputAmount)
    })
  })

  describe('Stealth Payment Flow', () => {
    it('should complete full stealth payment with commitments', () => {
      // 1. Recipient generates stealth meta-address
      const recipient = generateStealthMetaAddress('zcash' as ChainId, 'Bob')

      // 2. Sender creates commitment to amount
      const amount = 100n
      const { commitment, blinding } = commit(amount)

      // 3. Sender generates stealth address for recipient
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // 4. Recipient scans and finds their payment
      const isOurs = checkStealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(isOurs).toBe(true)

      // 5. Recipient verifies commitment opens to expected amount
      expect(verifyOpening(commitment, amount, blinding)).toBe(true)

      // 6. Recipient derives private key to claim
      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )
      expect(recovery.privateKey).toBeDefined()
    })
  })

  describe('Privacy Levels', () => {
    it('should handle transparent privacy level', async () => {
      const sip = createSIP('testnet')

      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.TRANSPARENT)
        .build()

      // Transparent doesn't require proofs
      expect(intent.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)
      expect(hasRequiredProofs(intent)).toBe(true) // Transparent always has "required" proofs
    })

    it('should handle shielded privacy level', async () => {
      const sip = createSIP('testnet')

      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)
      expect(hasRequiredProofs(intent)).toBe(false) // Shielded needs proofs to be attached
    })

    it('should auto-generate proofs when provider is configured', async () => {
      const mockProvider = new MockProofProvider()
      await mockProvider.initialize()

      const sip = new SIP({
        network: 'testnet',
        proofProvider: mockProvider,
      })

      // Note: input amount must be >= output minAmount for funding proof
      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 10000n)
        .output('zcash' as ChainId, 'ZEC', 9500n)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)
      // Proofs should be auto-generated because provider was configured
      expect(intent.fundingProof).toBeDefined()
      expect(intent.validityProof).toBeDefined()
      expect(hasRequiredProofs(intent)).toBe(true)
    })

    it('should handle compliant privacy level with viewing key', () => {
      const sip = createSIP('testnet')

      const viewingKey = sip.generateViewingKey('/m/44/501/0')

      // ViewingKey has: key, path, hash
      expect(viewingKey.key).toBeDefined()
      expect(viewingKey.hash).toBeDefined()
      expect(viewingKey.path).toBe('/m/44/501/0')

      // Derive child key
      const childKey = sip.deriveViewingKey(viewingKey, 'audit/2024')
      expect(childKey.path).toContain('audit/2024')
    })
  })

  describe('Proof Generation with MockProvider', () => {
    let sip: SIP
    let mockProvider: MockProofProvider

    beforeEach(async () => {
      mockProvider = new MockProofProvider()
      await mockProvider.initialize()

      sip = new SIP({
        network: 'testnet',
        proofProvider: mockProvider,
      })
    })

    it('should generate funding proof', async () => {
      const result = await mockProvider.generateFundingProof({
        balance: 1000n,
        minimumRequired: 500n,
        assetId: 'NEAR',
        blinding: '0x123' as HexString,
      })

      expect(result.proof.type).toBe('funding')
      expect(MockProofProvider.isMockProof(result.proof)).toBe(true)
    })

    it('should generate validity proof', async () => {
      const result = await mockProvider.generateValidityProof({
        intentHash: '0xabcdef' as HexString,
        senderAddress: '0xsender' as HexString,
        senderBlinding: '0xblind' as HexString,
        signature: new Uint8Array(64),
        nonce: 1n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      })

      expect(result.proof.type).toBe('validity')
    })

    it('should generate fulfillment proof', async () => {
      const result = await mockProvider.generateFulfillmentProof({
        intentHash: '0xabcdef' as HexString,
        outputAmount: 1000n,
        minOutputAmount: 950n,
        recipientStealth: '0xstealth' as HexString,
        outputBlinding: '0xblind' as HexString,
        fulfillmentTime: BigInt(Math.floor(Date.now() / 1000)),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      })

      expect(result.proof.type).toBe('fulfillment')
    })

    it('should verify mock proofs', async () => {
      const result = await mockProvider.generateFundingProof({
        balance: 1000n,
        minimumRequired: 500n,
        assetId: 'NEAR',
        blinding: '0x123' as HexString,
      })

      const isValid = await mockProvider.verifyProof(result.proof)
      expect(isValid).toBe(true)
    })
  })

  // ─── Viewing Key Flow Integration ───────────────────────────────────────────

  describe('Viewing Key Flow', () => {
    it('should complete full viewing key encryption/decryption cycle', () => {
      // 1. Generate viewing key for audit purposes
      const viewingKey = generateViewingKey('m/44/501/0/audit')

      // 2. Create transaction data to encrypt
      const txData = {
        sender: '0x' + 'a'.repeat(40),
        recipient: '0x' + 'b'.repeat(40),
        amount: '1000000000000000000',
        timestamp: Date.now(),
      }

      // 3. Encrypt transaction data
      const encrypted = encryptForViewing(txData, viewingKey)

      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce).toBeDefined()
      expect(encrypted.viewingKeyHash).toBe(viewingKey.hash)

      // 4. Decrypt with same viewing key
      const decrypted = decryptWithViewing(encrypted, viewingKey)

      expect(decrypted.sender).toBe(txData.sender)
      expect(decrypted.recipient).toBe(txData.recipient)
      expect(decrypted.amount).toBe(txData.amount)
      expect(decrypted.timestamp).toBe(txData.timestamp)
    })

    it('should fail decryption with wrong viewing key', () => {
      const correctKey = generateViewingKey('m/44/501/0')
      const wrongKey = generateViewingKey('m/44/501/1')

      const txData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '100',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, correctKey)

      // Decryption should fail with wrong key
      expect(() => decryptWithViewing(encrypted, wrongKey)).toThrow(CryptoError)
    })

    it('should support hierarchical key derivation for selective disclosure', () => {
      const sip = createSIP('testnet')

      // Master viewing key for organization
      const masterKey = sip.generateViewingKey('m/44/501/0')

      // Derive child keys for different audit scopes
      const auditKey2023 = sip.deriveViewingKey(masterKey, 'audit/2023')
      const auditKey2024 = sip.deriveViewingKey(masterKey, 'audit/2024')
      const taxKey = sip.deriveViewingKey(masterKey, 'tax')

      // Each derived key should be unique
      expect(auditKey2023.key).not.toBe(masterKey.key)
      expect(auditKey2024.key).not.toBe(auditKey2023.key)
      expect(taxKey.key).not.toBe(auditKey2023.key)

      // Paths should be hierarchical
      expect(auditKey2023.path).toBe('m/44/501/0/audit/2023')
      expect(auditKey2024.path).toBe('m/44/501/0/audit/2024')
      expect(taxKey.path).toBe('m/44/501/0/tax')
    })
  })

  // ─── Multi-Intent Flow Integration ──────────────────────────────────────────

  describe('Multi-Intent Flow', () => {
    it('should handle multiple intents with independent commitments', () => {
      // Create commitments for multiple intents
      const intent1Amount = 100n
      const intent2Amount = 200n
      const intent3Amount = 300n

      const commitment1 = commit(intent1Amount)
      const commitment2 = commit(intent2Amount)
      const commitment3 = commit(intent3Amount)

      // All commitments should be unique
      expect(commitment1.commitment).not.toBe(commitment2.commitment)
      expect(commitment2.commitment).not.toBe(commitment3.commitment)

      // All should verify correctly with their own blindings
      expect(verifyOpening(commitment1.commitment, intent1Amount, commitment1.blinding)).toBe(true)
      expect(verifyOpening(commitment2.commitment, intent2Amount, commitment2.blinding)).toBe(true)
      expect(verifyOpening(commitment3.commitment, intent3Amount, commitment3.blinding)).toBe(true)

      // Cross-verification should fail
      expect(verifyOpening(commitment1.commitment, intent2Amount, commitment1.blinding)).toBe(false)
      expect(verifyOpening(commitment1.commitment, intent1Amount, commitment2.blinding)).toBe(false)
    })

    it('should support batch commitment arithmetic', () => {
      // Alice sends 100 to Bob, Bob sends 60 to Carol
      const aliceToBot = 100n
      const bobToCarol = 60n
      const bobKeeps = 40n // 100 - 60

      const aliceCommit = commit(aliceToBot)
      const carolCommit = commit(bobToCarol)
      const bobCommit = commit(bobKeeps)

      // Verify homomorphic property: C(60) + C(40) should equal C(100) with combined blinding
      const combinedBlinding = addBlindings(carolCommit.blinding, bobCommit.blinding)
      const sumCommitment = addCommitments(carolCommit.commitment, bobCommit.commitment)

      // The sum commitment should verify to 100 with the combined blinding
      expect(verifyOpening(sumCommitment.commitment, aliceToBot, combinedBlinding)).toBe(true)

      // Subtraction: C(100) - C(60) should be related to C(40)
      const diffCommitment = subtractCommitments(aliceCommit.commitment, carolCommit.commitment)
      // Note: The subtracted commitment verifies to the difference value
      expect(diffCommitment.commitment).toBeDefined()
    })

    it('should create multiple intents in parallel', async () => {
      const sip = createSIP('testnet')

      // Create multiple intents concurrently
      const intentPromises = [
        sip.intent()
          .input('near' as ChainId, 'NEAR', 100n)
          .output('ethereum' as ChainId, 'ETH', 50n)
          .privacy(PrivacyLevel.SHIELDED)
          .build(),
        sip.intent()
          .input('solana' as ChainId, 'SOL', 200n)
          .output('zcash' as ChainId, 'ZEC', 150n)
          .privacy(PrivacyLevel.SHIELDED)
          .build(),
        sip.intent()
          .input('ethereum' as ChainId, 'ETH', 50n)
          .output('near' as ChainId, 'NEAR', 100n)
          .privacy(PrivacyLevel.TRANSPARENT)
          .build(),
      ]

      const intents = await Promise.all(intentPromises)

      // All intents should be created successfully with unique IDs
      expect(intents.length).toBe(3)
      const intentIds = intents.map(i => i.intentId)
      const uniqueIds = new Set(intentIds)
      expect(uniqueIds.size).toBe(3) // All IDs are unique
    })

    it('should track multiple stealth addresses independently', () => {
      // Recipient has multiple stealth addresses for different purposes
      const personalMeta = generateStealthMetaAddress('ethereum' as ChainId, 'Personal')
      const businessMeta = generateStealthMetaAddress('ethereum' as ChainId, 'Business')

      // Sender generates stealth addresses for payments
      const personalPayment = generateStealthAddress(personalMeta.metaAddress)
      const businessPayment = generateStealthAddress(businessMeta.metaAddress)

      // Recipient can identify which account each payment is for
      const isPersonal = checkStealthAddress(
        personalPayment.stealthAddress,
        personalMeta.spendingPrivateKey,
        personalMeta.viewingPrivateKey
      )
      const isBusiness = checkStealthAddress(
        businessPayment.stealthAddress,
        businessMeta.spendingPrivateKey,
        businessMeta.viewingPrivateKey
      )

      // Personal key should identify personal payment
      expect(isPersonal).toBe(true)
      expect(isBusiness).toBe(true)

      // Cross-checking should fail
      const crossCheck = checkStealthAddress(
        personalPayment.stealthAddress,
        businessMeta.spendingPrivateKey,
        businessMeta.viewingPrivateKey
      )
      expect(crossCheck).toBe(false)
    })
  })

  // ─── Error Recovery Flow Integration ────────────────────────────────────────

  describe('Error Recovery Flow', () => {
    let mockProvider: MockProofProvider

    beforeEach(async () => {
      mockProvider = new MockProofProvider()
      await mockProvider.initialize()
    })

    it('should handle insufficient balance for funding proof', async () => {
      // Try to prove we have 500 when we only have 100
      await expect(
        mockProvider.generateFundingProof({
          balance: 100n,
          minimumRequired: 500n,
          assetId: 'NEAR',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should handle expired intent in validity proof', async () => {
      // Mock provider checks: timestamp >= expiry (intent already expired at creation time)
      const now = BigInt(Math.floor(Date.now() / 1000))
      const timestamp = now // Current time
      const expiry = now - 100n // Expired 100 seconds ago

      await expect(
        mockProvider.generateValidityProof({
          intentHash: '0xabcdef' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblind' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: timestamp,
          expiry: expiry, // Expiry is before timestamp = already expired
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should handle output less than minimum in fulfillment proof', async () => {
      await expect(
        mockProvider.generateFulfillmentProof({
          intentHash: '0xabcdef' as HexString,
          outputAmount: 500n, // Less than minimum
          minOutputAmount: 1000n,
          recipientStealth: '0xstealth' as HexString,
          outputBlinding: '0xblind' as HexString,
          fulfillmentTime: BigInt(Math.floor(Date.now() / 1000)),
          expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should handle fulfillment after expiry', async () => {
      await expect(
        mockProvider.generateFulfillmentProof({
          intentHash: '0xabcdef' as HexString,
          outputAmount: 1000n,
          minOutputAmount: 500n,
          recipientStealth: '0xstealth' as HexString,
          outputBlinding: '0xblind' as HexString,
          fulfillmentTime: BigInt(Math.floor(Date.now() / 1000) + 7200), // 2 hours from now
          expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now (before fulfillment)
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should detect commitment mismatch', () => {
      const amount = 100n
      const { commitment, blinding } = commit(amount)

      // Try to verify with wrong amount
      expect(verifyOpening(commitment, 200n, blinding)).toBe(false)
      expect(verifyOpening(commitment, 99n, blinding)).toBe(false)
      expect(verifyOpening(commitment, 101n, blinding)).toBe(false)

      // Only exact amount should verify
      expect(verifyOpening(commitment, amount, blinding)).toBe(true)
    })

    it('should handle intent expiry tracking', async () => {
      const sip = createSIP('testnet')

      // Create intent with very short TTL
      const intent = await sip
        .intent()
        .input('near' as ChainId, 'NEAR', 100n)
        .output('zcash' as ChainId, 'ZEC', 95n)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(1) // 1 second TTL
        .build()

      // Intent should not be expired immediately
      expect(isExpired(intent)).toBe(false)

      // Wait for expiry: isExpired checks Math.floor(Date.now()/1000) > expiry
      // With 1s TTL, need to wait > 1 full second past the floor boundary
      // Using 2.1 seconds to ensure we definitely cross the second boundary
      await new Promise(resolve => setTimeout(resolve, 2100))

      // Intent should now be expired
      expect(isExpired(intent)).toBe(true)
    }, 5000) // Increase test timeout

    it('should handle uninitialized proof provider', async () => {
      const uninitializedProvider = new MockProofProvider()
      // Note: Not calling initialize()

      await expect(
        uninitializedProvider.generateFundingProof({
          balance: 1000n,
          minimumRequired: 500n,
          assetId: 'NEAR',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow(/not initialized/)
    })

    it('should gracefully handle invalid viewing key hash mismatch', () => {
      const key1 = generateViewingKey('m/0')
      const key2 = generateViewingKey('m/1')

      const txData = {
        sender: '0xsender',
        recipient: '0xrecipient',
        amount: '100',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(txData, key1)

      // Attempting to decrypt with wrong key should throw clear error
      expect(() => decryptWithViewing(encrypted, key2)).toThrow(CryptoError)
      expect(() => decryptWithViewing(encrypted, key2)).toThrow(/mismatch|cannot decrypt/i)
    })
  })
})
