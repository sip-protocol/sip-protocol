/**
 * E2E Tests: Solana Same-Chain Privacy Send Flow
 *
 * Tests the complete sender journey:
 * 1. Generate stealth address for recipient
 * 2. Create commitment for amount
 * 3. Send to stealth address
 * 4. Verify announcement is created
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestEnvironment,
} from '../../fixtures/solana'

// Import SDK functions
import {
  deriveSolanaStealthKeys,
  generateEphemeralKeypair,
  commitSolana,
  verifyOpeningSolana,
  createAnnouncementMemo,
  parseAnnouncement,
  computeViewingKeyHash,
} from '../../../src/chains/solana'

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '../../../src/stealth'

describe('E2E: Solana Send Flow', () => {
  let env: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    env = createTestEnvironment()
  })

  describe('Step 1: Stealth Address Generation', () => {
    it('should generate stealth meta-address for Solana', () => {
      const result = generateStealthMetaAddress('solana')

      expect(result.metaAddress.chain).toBe('solana')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should encode and decode meta-address correctly', () => {
      const result = generateStealthMetaAddress('solana')
      const encoded = encodeStealthMetaAddress(result.metaAddress)

      expect(encoded).toMatch(/^sip:solana:0x[a-f0-9]+:0x[a-f0-9]+$/)

      const decoded = decodeStealthMetaAddress(encoded)
      expect(decoded.chain).toBe('solana')
      expect(decoded.spendingKey).toBe(result.metaAddress.spendingKey)
      expect(decoded.viewingKey).toBe(result.metaAddress.viewingKey)
    })

    it('should generate stealth address from meta-address', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealth = generateStealthAddress(recipient.metaAddress)

      expect(stealth.stealthAddress).toBeDefined()
      expect(stealth.stealthAddress.address).toMatch(/^0x[a-f0-9]+$/)
      expect(stealth.sharedSecret).toMatch(/^0x[a-f0-9]+$/)
    })

    it('should generate unique stealth addresses each time', () => {
      const recipient = generateStealthMetaAddress('solana')

      const stealth1 = generateStealthAddress(recipient.metaAddress)
      const stealth2 = generateStealthAddress(recipient.metaAddress)

      // Each call generates new ephemeral key, so addresses differ
      expect(stealth1.stealthAddress.address).not.toBe(stealth2.stealthAddress.address)
    })

    it('should derive stealth keys from mnemonic', () => {
      const result = deriveSolanaStealthKeys({
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      })

      // metaAddress is an object, encode it for string check
      const encoded = encodeStealthMetaAddress(result.metaAddress)
      expect(encoded).toMatch(/^sip:solana:/)
      // Public keys are in metaAddress object
      expect(result.metaAddress.spendingKey).toMatch(/^0x/)
      expect(result.metaAddress.viewingKey).toMatch(/^0x/)
    })
  })

  describe('Step 2: Amount Commitment', () => {
    it('should create valid commitment for SOL amount', () => {
      const amount = 1_000_000_000n // 1 SOL
      const commitment = commitSolana(amount)

      expect(commitment.commitment).toBeDefined()
      expect(commitment.blinding).toBeDefined()

      // Verify the commitment
      const valid = verifyOpeningSolana(
        commitment.commitment,
        amount,
        commitment.blinding
      )
      expect(valid).toBe(true)
    })

    it('should reject invalid commitment openings', () => {
      const amount = 1_000_000_000n
      const wrongAmount = 2_000_000_000n
      const commitment = commitSolana(amount)

      // Wrong amount should fail
      const valid = verifyOpeningSolana(
        commitment.commitment,
        wrongAmount,
        commitment.blinding
      )
      expect(valid).toBe(false)
    })

    it('should create different commitments for same amount (random blinding)', () => {
      const amount = 500_000_000n

      const commitment1 = commitSolana(amount)
      const commitment2 = commitSolana(amount)

      // Commitments should be different due to random blinding
      expect(commitment1.commitment).not.toBe(commitment2.commitment)
      expect(commitment1.blinding).not.toBe(commitment2.blinding)

      // But both should be valid
      expect(verifyOpeningSolana(commitment1.commitment, amount, commitment1.blinding)).toBe(true)
      expect(verifyOpeningSolana(commitment2.commitment, amount, commitment2.blinding)).toBe(true)
    })
  })

  describe('Step 3: Announcement Creation', () => {
    it('should create valid announcement memo', () => {
      const ephemeralPubKey = 'EphemKey123456789012345678901234567890123'
      const viewTag = 'ab'  // 1-byte view tag as hex

      const memo = createAnnouncementMemo(ephemeralPubKey, viewTag)

      expect(memo).toContain('SIP:1:')
      expect(memo).toContain(ephemeralPubKey)
      expect(memo).toContain(viewTag)
    })

    it('should create announcement with stealth address', () => {
      const ephemeralPubKey = 'EphemKey123456789012345678901234567890123'
      const viewTag = 'cd'
      const stealthAddr = 'StealthAddr1234567890123456789012345678901'

      const memo = createAnnouncementMemo(ephemeralPubKey, viewTag, stealthAddr)

      expect(memo).toContain('SIP:1:')
      expect(memo).toContain(stealthAddr)
    })

    it('should parse announcement memo correctly', () => {
      const ephemeralPubKey = 'EphemKey123456789012345678901234567890123'
      const viewTag = 'ef'

      const memo = createAnnouncementMemo(ephemeralPubKey, viewTag)
      const parsed = parseAnnouncement(memo)

      expect(parsed).not.toBeNull()
      expect(parsed!.ephemeralPublicKey).toBe(ephemeralPubKey)
      expect(parsed!.viewTag).toBe(viewTag)
    })

    it('should reject invalid announcement format', () => {
      const invalidMemo = 'not a valid sip announcement'
      const parsed = parseAnnouncement(invalidMemo)
      expect(parsed).toBeNull()
    })

    it('should reject announcement without SIP prefix', () => {
      const invalidMemo = 'OTHER:1:key:tag'
      const parsed = parseAnnouncement(invalidMemo)
      expect(parsed).toBeNull()
    })
  })

  describe('Step 4: Complete Send Flow', () => {
    it('should execute complete stealth send flow for SOL', () => {
      // 1. Recipient generates meta-address
      const recipient = generateStealthMetaAddress('solana')
      const encodedMeta = encodeStealthMetaAddress(recipient.metaAddress)
      expect(encodedMeta).toMatch(/^sip:solana:/)

      // 2. Sender decodes recipient meta-address
      const decodedMeta = decodeStealthMetaAddress(encodedMeta)
      expect(decodedMeta.chain).toBe('solana')

      // 3. Sender generates stealth address
      const stealth = generateStealthAddress(decodedMeta)
      expect(stealth.stealthAddress).toBeDefined()

      // 4. Sender creates amount commitment
      const amount = 500_000_000n // 0.5 SOL
      const commitment = commitSolana(amount)
      expect(commitment.commitment).toBeDefined()

      // 5. Sender computes view tag from viewing key hash
      const viewingKeyHash = computeViewingKeyHash(decodedMeta.viewingKey)
      const viewTag = viewingKeyHash.slice(2, 4) // First byte as view tag
      expect(viewTag).toHaveLength(2)

      // 6. Sender creates announcement
      const ephemeralPubKey = 'MockEphemeralKey12345678901234567890123'
      const announcement = createAnnouncementMemo(ephemeralPubKey, viewTag)
      expect(announcement).toContain('SIP:1:')

      // 7. Verify complete flow - recipient can parse announcement
      const parsedAnnouncement = parseAnnouncement(announcement)
      expect(parsedAnnouncement).not.toBeNull()
      expect(parsedAnnouncement!.ephemeralPublicKey).toBe(ephemeralPubKey)
    })

    it('should handle multiple sends to same recipient', () => {
      const recipient = generateStealthMetaAddress('solana')
      const stealthAddresses: string[] = []

      // Send 3 times to same recipient
      for (let i = 0; i < 3; i++) {
        const stealth = generateStealthAddress(recipient.metaAddress)
        stealthAddresses.push(stealth.stealthAddress.address)
      }

      // All stealth addresses should be unique (unlinkable)
      const unique = new Set(stealthAddresses)
      expect(unique.size).toBe(3)
    })

    it('should generate ephemeral keypair for each transaction', () => {
      const ephemeral1 = generateEphemeralKeypair()
      const ephemeral2 = generateEphemeralKeypair()

      expect(ephemeral1.publicKey).not.toBe(ephemeral2.publicKey)
      expect(ephemeral1.privateKey).not.toBe(ephemeral2.privateKey)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero amount commitment', () => {
      const commitment = commitSolana(0n)
      expect(commitment.commitment).toBeDefined()
      expect(verifyOpeningSolana(commitment.commitment, 0n, commitment.blinding)).toBe(true)
    })

    it('should handle large SOL amounts', () => {
      const amount = 1_000_000_000_000_000_000n // 1 billion SOL
      const commitment = commitSolana(amount)
      expect(verifyOpeningSolana(commitment.commitment, amount, commitment.blinding)).toBe(true)
    })

    it('should reject malformed meta-address', () => {
      expect(() => decodeStealthMetaAddress('not:valid')).toThrow()
    })

    it('should reject meta-address with invalid chain', () => {
      expect(() => decodeStealthMetaAddress('sip:invalid-chain:0xabc:0xdef')).toThrow()
    })

    it('should reject meta-address with invalid keys', () => {
      expect(() => decodeStealthMetaAddress('sip:solana:invalid:keys')).toThrow()
    })
  })
})
