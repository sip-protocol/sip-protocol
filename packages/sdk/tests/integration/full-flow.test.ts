/**
 * Full Flow Integration Tests
 *
 * End-to-end tests for the SIP protocol flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SIP, createSIP } from '../../src/sip'
import { MockProofProvider } from '../../src/proofs/mock'
import { IntentBuilder, hasRequiredProofs } from '../../src/intent'
import { commit, verifyOpening } from '../../src/commitment'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
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
})
