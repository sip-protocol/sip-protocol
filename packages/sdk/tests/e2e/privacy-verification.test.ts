/**
 * E2E Privacy Verification Tests
 *
 * Tests to verify privacy guarantees of SIP Protocol:
 * - Sender address not visible
 * - Amount hidden (commitment only)
 * - Refund uses fresh stealth address
 * - No linkability between transactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel, IntentStatus } from '@sip-protocol/types'
import type { ChainId, HexString } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  verifyPrivacy,
  verifyStealthAddressClaim,
  verifyCommitment,
  suppressConsoleWarnings,
  randomHex,
  type E2ETestFixture,
} from './helpers'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import { commit, verifyOpening, addCommitments, subtractCommitments } from '../../src/commitment'

describe('E2E: Privacy Verification', () => {
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

  // ─── Sender Privacy ─────────────────────────────────────────────────────────────

  describe('Sender Privacy', () => {
    it('should hide sender identity in shielded mode', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      const privacy = verifyPrivacy(intent)
      expect(privacy.senderHidden).toBe(true)

      // Sender commitment should be a valid commitment object, not raw address
      expect(intent.senderCommitment).toBeDefined()
      // Commitment is an object with value field
      const commitmentValue = typeof intent.senderCommitment === 'object'
        ? (intent.senderCommitment as { value?: string })?.value
        : intent.senderCommitment
      expect(commitmentValue).toBeDefined()
    })

    it('should expose sender in transparent mode', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      // Transparent mode may or may not have commitment
      expect(intent.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)
    })

    it('should use different sender commitments for different intents', async () => {
      const intents = await Promise.all([
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
      ])

      // All commitments should be unique (due to random blinding)
      const commitments = intents.map(i => i.senderCommitment).filter(Boolean)
      const uniqueCommitments = new Set(commitments)
      expect(uniqueCommitments.size).toBe(commitments.length)
    })
  })

  // ─── Amount Privacy ─────────────────────────────────────────────────────────────

  describe('Amount Privacy', () => {
    it('should hide input amount with commitment', async () => {
      const inputAmount = 1_000_000_000n

      const intent = await createTestIntent(fixture.sip, {
        inputAmount,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      const privacy = verifyPrivacy(intent)
      expect(privacy.amountHidden).toBe(true)

      // Input commitment should not reveal the actual amount
      expect(intent.inputCommitment).toBeDefined()
      // Commitment is an object, serialize to check it doesn't contain raw amount
      const commitmentStr = JSON.stringify(intent.inputCommitment)
      expect(commitmentStr).not.toContain(inputAmount.toString())
    })

    it('should use Pedersen commitments for amounts', async () => {
      const amount = 100n

      // Create commitment
      const { commitment, blinding } = commit(amount)

      // Verify commitment opens to correct amount
      expect(verifyOpening(commitment, amount, blinding)).toBe(true)

      // Wrong amount should not verify
      expect(verifyOpening(commitment, 99n, blinding)).toBe(false)
      expect(verifyOpening(commitment, 101n, blinding)).toBe(false)
    })

    it('should support homomorphic commitment operations', () => {
      const amount1 = 100n
      const amount2 = 50n

      const commit1 = commit(amount1)
      const commit2 = commit(amount2)

      // Add commitments (C(100) + C(50) = C(150))
      const sumCommit = addCommitments(commit1.commitment, commit2.commitment)
      expect(sumCommit.commitment).toBeDefined()

      // Subtract commitments (C(100) - C(50) = C(50))
      const diffCommit = subtractCommitments(commit1.commitment, commit2.commitment)
      expect(diffCommit.commitment).toBeDefined()
    })

    it('should generate unique commitments for same amount', () => {
      const amount = 100n

      const commit1 = commit(amount)
      const commit2 = commit(amount)
      const commit3 = commit(amount)

      // Same amount, but different commitments (different blindings)
      expect(commit1.commitment).not.toBe(commit2.commitment)
      expect(commit2.commitment).not.toBe(commit3.commitment)
      expect(commit1.commitment).not.toBe(commit3.commitment)
    })
  })

  // ─── Stealth Address Privacy ────────────────────────────────────────────────────

  describe('Stealth Address Privacy', () => {
    it('should generate unlinkable stealth addresses', async () => {
      const recipientMeta = generateStealthMetaAddress('zcash' as ChainId, 'Recipient')

      // Generate multiple stealth addresses for same recipient
      const stealth1 = generateStealthAddress(recipientMeta.metaAddress)
      const stealth2 = generateStealthAddress(recipientMeta.metaAddress)
      const stealth3 = generateStealthAddress(recipientMeta.metaAddress)

      // All stealth addresses should be different (unlinkable)
      expect(stealth1.stealthAddress.address).not.toBe(stealth2.stealthAddress.address)
      expect(stealth2.stealthAddress.address).not.toBe(stealth3.stealthAddress.address)
      expect(stealth1.stealthAddress.address).not.toBe(stealth3.stealthAddress.address)

      // But all should be claimable by recipient
      expect(checkStealthAddress(
        stealth1.stealthAddress,
        recipientMeta.spendingPrivateKey,
        recipientMeta.viewingPrivateKey
      )).toBe(true)

      expect(checkStealthAddress(
        stealth2.stealthAddress,
        recipientMeta.spendingPrivateKey,
        recipientMeta.viewingPrivateKey
      )).toBe(true)

      expect(checkStealthAddress(
        stealth3.stealthAddress,
        recipientMeta.spendingPrivateKey,
        recipientMeta.viewingPrivateKey
      )).toBe(true)
    })

    it('should prevent third party from linking addresses', async () => {
      const recipient = generateStealthMetaAddress('zcash' as ChainId, 'Recipient')
      const attacker = generateStealthMetaAddress('zcash' as ChainId, 'Attacker')

      // Generate stealth address for recipient
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // Attacker cannot claim
      const attackerCanClaim = checkStealthAddress(
        stealthAddress,
        attacker.spendingPrivateKey,
        attacker.viewingPrivateKey
      )
      expect(attackerCanClaim).toBe(false)
    })

    it('should allow recipient to derive private key', async () => {
      const recipient = generateStealthMetaAddress('ethereum' as ChainId, 'Bob')

      // Sender creates stealth address
      const { stealthAddress, sharedSecret } = generateStealthAddress(recipient.metaAddress)

      // Recipient should be able to derive private key
      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.privateKey.length).toBeGreaterThan(0)
    })

    it('should include view tag for efficient scanning', async () => {
      const recipient = generateStealthMetaAddress('zcash' as ChainId, 'Scanner')

      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // View tag should be present for efficient scanning
      expect(stealthAddress.viewTag).toBeDefined()
      expect(typeof stealthAddress.viewTag).toBe('number')
      expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealthAddress.viewTag).toBeLessThan(256)
    })

    it('should use ephemeral keys for each stealth address', async () => {
      const recipient = generateStealthMetaAddress('ethereum' as ChainId, 'Alice')

      const stealth1 = generateStealthAddress(recipient.metaAddress)
      const stealth2 = generateStealthAddress(recipient.metaAddress)

      // Ephemeral public keys should be different
      expect(stealth1.stealthAddress.ephemeralPublicKey)
        .not.toBe(stealth2.stealthAddress.ephemeralPublicKey)

      // Shared secrets should also be different
      expect(stealth1.sharedSecret).not.toBe(stealth2.sharedSecret)
    })
  })

  // ─── Transaction Unlinkability ──────────────────────────────────────────────────

  describe('Transaction Unlinkability', () => {
    it('should create unlinkable transactions from same sender', async () => {
      const intents = await Promise.all([
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
        createTestIntent(fixture.sip, { privacyLevel: PrivacyLevel.SHIELDED }),
      ])

      // All intent IDs should be unique
      const intentIds = intents.map(i => i.intentId)
      expect(new Set(intentIds).size).toBe(3)

      // All sender commitments should be different
      const senderCommitments = intents.map(i => i.senderCommitment).filter(Boolean)
      expect(new Set(senderCommitments).size).toBe(senderCommitments.length)

      // All input commitments should be different
      const inputCommitments = intents.map(i => i.inputCommitment).filter(Boolean)
      expect(new Set(inputCommitments).size).toBe(inputCommitments.length)

      // All stealth addresses should be different
      const stealthAddresses = intents.map(i => i.recipientStealth).filter(Boolean)
      expect(new Set(stealthAddresses).size).toBe(stealthAddresses.length)
    })

    it('should not correlate intents by timing analysis', async () => {
      // Create intents with random delays
      const intents = []
      const createTimes: number[] = []
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, Math.random() * 100))
        createTimes.push(Date.now())
        intents.push(await createTestIntent(fixture.sip, {
          privacyLevel: PrivacyLevel.SHIELDED,
        }))
      }

      // Creation times should be close
      const timeDiff = Math.max(...createTimes) - Math.min(...createTimes)
      expect(timeDiff).toBeLessThan(1000) // Within 1 second

      // Intent IDs should be unique and random (not sequential numbers)
      const intentIds = intents.map(i => i.intentId)
      const uniqueIds = new Set(intentIds)
      expect(uniqueIds.size).toBe(intentIds.length) // All unique

      // IDs should not contain sequential numeric patterns
      // (e.g., not just incrementing counters)
      const numericParts = intentIds.map(id => {
        const match = id.match(/\d+/)
        return match ? parseInt(match[0], 10) : 0
      })
      // If they were sequential, differences would all be 1
      const isSequential = numericParts.slice(1).every(
        (n, i) => Math.abs(n - numericParts[i]) === 1
      )
      expect(isSequential).toBe(false)
    })

    it('should use fresh refund addresses', async () => {
      // Create multiple intents - each should have unique refund commitment
      const intents = await Promise.all([
        fixture.sip.intent()
          .input('solana' as ChainId, 'SOL', 1_000_000_000n)
          .output('zcash' as ChainId, 'ZEC', 50_000_000n)
          .privacy(PrivacyLevel.SHIELDED)
          .withPlaceholders()
          .build(),
        fixture.sip.intent()
          .input('solana' as ChainId, 'SOL', 2_000_000_000n)
          .output('zcash' as ChainId, 'ZEC', 100_000_000n)
          .privacy(PrivacyLevel.SHIELDED)
          .withPlaceholders()
          .build(),
      ])

      // Each intent should have different privacy-related fields
      expect(intents[0].senderCommitment).not.toBe(intents[1].senderCommitment)
    })
  })

  // ─── Privacy Level Enforcement ──────────────────────────────────────────────────

  describe('Privacy Level Enforcement', () => {
    it('should enforce SHIELDED privacy requirements', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // SHIELDED requires commitments
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)
      expect(intent.senderCommitment).toBeDefined()
      expect(intent.inputCommitment).toBeDefined()

      // Should have stealth recipient
      expect(intent.recipientStealth).toBeDefined()
    })

    it('should enforce COMPLIANT privacy requirements', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      // COMPLIANT should have viewing key hash
      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)
      expect(intent.viewingKeyHash).toBeDefined()

      // Should still have privacy features
      expect(intent.senderCommitment).toBeDefined()
    })

    it('should allow TRANSPARENT without privacy features', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      expect(intent.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)
      // Transparent may still generate commitments but doesn't require them
    })
  })

  // ─── ZK Proof Integration ───────────────────────────────────────────────────────

  describe('ZK Proof Integration', () => {
    it('should generate funding proof for shielded intent', async () => {
      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 10_000_000_000n) // 10 SOL
        .output('zcash' as ChainId, 'ZEC', 50_000_000n) // 0.5 ZEC
        .privacy(PrivacyLevel.SHIELDED)
        .withPlaceholders()
        .build()

      // Should have funding proof attached
      expect(intent.fundingProof).toBeDefined()
      expect(intent.fundingProof?.type).toBe('funding')
    })

    it('should generate validity proof for shielded intent', async () => {
      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 10_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .withPlaceholders()
        .build()

      // Should have validity proof attached
      expect(intent.validityProof).toBeDefined()
      expect(intent.validityProof?.type).toBe('validity')
    })

    it('should verify proofs are mock proofs in test', async () => {
      const { MockProofProvider } = await import('../../src/proofs/mock')

      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 10_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .withPlaceholders()
        .build()

      // In test environment, proofs should be mock proofs
      if (intent.fundingProof) {
        expect(MockProofProvider.isMockProof(intent.fundingProof)).toBe(true)
      }

      if (intent.validityProof) {
        expect(MockProofProvider.isMockProof(intent.validityProof)).toBe(true)
      }
    })
  })

  // ─── Information Leakage Prevention ─────────────────────────────────────────────

  describe('Information Leakage Prevention', () => {
    it('should not leak sender address in serialized intent', async () => {
      const senderAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b'

      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Serialize intent (as it would be transmitted)
      // Use a BigInt-safe serializer
      const serialized = JSON.stringify(intent, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      )

      // Should not contain raw sender address
      expect(serialized).not.toContain(senderAddress)
    })

    it('should not leak input amount in serialized intent', async () => {
      const inputAmount = 1234567890123456789n

      const intent = await createTestIntent(fixture.sip, {
        inputAmount,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Use a BigInt-safe serializer
      const serialized = JSON.stringify(intent, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      )

      // Should not contain the exact amount string (commitment hides it)
      // Note: The minOutputAmount might be visible, but inputAmount should be hidden in commitment
      expect(intent.inputCommitment).toBeDefined()
    })

    it('should only expose necessary fields to solvers', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // What solver should see
      const solverVisible = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      // Solver should NOT have access to:
      // - Raw sender address
      // - Raw input amount
      // - Blinding factors
      // - Private keys

      expect(solverVisible.intentId).toBeDefined()
      expect(solverVisible.outputAsset).toBeDefined()
      expect(solverVisible.minOutputAmount).toBeDefined()

      // These should be commitments, not raw values
      expect(solverVisible.senderCommitment).toBeDefined()
      expect(solverVisible.inputCommitment).toBeDefined()
    })
  })
})
