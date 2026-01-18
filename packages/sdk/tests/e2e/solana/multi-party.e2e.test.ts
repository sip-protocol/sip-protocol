/**
 * E2E Tests: Solana Multi-Party Privacy Scenarios
 *
 * Tests complex scenarios with multiple participants:
 * 1. Sender → Receiver flow
 * 2. Sender → Receiver + Auditor flow
 * 3. Multi-hop transfers
 * 4. Group payments
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnvironment } from '../../fixtures/solana'

// Import SDK functions
import {
  generateRandomViewingKey,
  computeViewingKeyHash,
  encryptForViewing,
  decryptWithViewing,
  commitSolana,
  verifyOpeningSolana,
  type SolanaTransactionData,
} from '../../../src/chains/solana'

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '../../../src/stealth'

describe('E2E: Solana Multi-Party Scenarios', () => {
  let env: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    env = createTestEnvironment()
  })

  describe('Two-Party Flow (Sender → Receiver)', () => {
    it('should complete full private payment flow', () => {
      // Setup: Alice (sender) and Bob (receiver)
      const alice = generateStealthMetaAddress('solana', 'alice')
      const bob = generateStealthMetaAddress('solana', 'bob')

      // 1. Bob publishes meta-address
      const bobMetaEncoded = encodeStealthMetaAddress(bob.metaAddress)

      // 2. Alice decodes Bob's meta-address
      const bobMetaDecoded = decodeStealthMetaAddress(bobMetaEncoded)
      expect(bobMetaDecoded.chain).toBe('solana')

      // 3. Alice generates stealth address for Bob
      const stealthForBob = generateStealthAddress(bobMetaDecoded)

      // 4. Alice creates commitment for amount
      const amount = 1_000_000_000n // 1 SOL
      const commitment = commitSolana(amount)

      // 5. Bob detects payment
      const isForBob = checkStealthAddress(
        stealthForBob.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(isForBob).toBe(true)

      // 6. Bob verifies commitment (in real flow, Bob would receive blinding)
      const isValidAmount = verifyOpeningSolana(
        commitment.commitment,
        amount,
        commitment.blinding
      )
      expect(isValidAmount).toBe(true)

      // 7. Bob derives private key to claim
      const recovery = deriveStealthPrivateKey(
        stealthForBob.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(recovery.privateKey).toBeDefined()
    })

    it('should ensure sender cannot claim their own payment', () => {
      const alice = generateStealthMetaAddress('solana')
      const bob = generateStealthMetaAddress('solana')

      // Alice sends to Bob
      const stealthForBob = generateStealthAddress(bob.metaAddress)

      // Alice tries to check if it's for her (should fail)
      const isForAlice = checkStealthAddress(
        stealthForBob.stealthAddress,
        alice.spendingPrivateKey,
        alice.viewingPrivateKey
      )
      expect(isForAlice).toBe(false)
    })
  })

  describe('Three-Party Flow (Sender → Receiver + Auditor)', () => {
    it('should allow auditor to verify payments', () => {
      const alice = generateStealthMetaAddress('solana', 'alice')
      const bob = generateStealthMetaAddress('solana', 'bob')
      const auditorKey = generateRandomViewingKey()

      // 1. Alice sends to Bob
      const stealthForBob = generateStealthAddress(bob.metaAddress)

      // 2. Create audit trail encrypted for auditor using SolanaTransactionData
      const auditData: SolanaTransactionData = {
        sender: encodeStealthMetaAddress(alice.metaAddress),
        recipient: stealthForBob.stealthAddress.address,
        amount: '1000000000', // 1 SOL in lamports
        mint: null, // Native SOL
        timestamp: Date.now(),
        memo: `Recipient meta: ${encodeStealthMetaAddress(bob.metaAddress)}`,
      }

      const encryptedAudit = encryptForViewing(auditData, auditorKey)

      // 3. Auditor can decrypt and verify
      const decryptedAudit = decryptWithViewing(encryptedAudit, auditorKey)

      expect(decryptedAudit.sender).toContain('sip:solana:')
      expect(decryptedAudit.amount).toBe('1000000000')
    })

    it('should allow multiple auditors with separate keys', () => {
      const alice = generateStealthMetaAddress('solana')
      const bob = generateStealthMetaAddress('solana')
      const taxAuditor = generateRandomViewingKey()
      const complianceAuditor = generateRandomViewingKey()

      // Send payment
      const stealthForBob = generateStealthAddress(bob.metaAddress)

      // Different audit data for different auditors using SolanaTransactionData
      const taxData: SolanaTransactionData = {
        sender: 'alice',
        recipient: stealthForBob.stealthAddress.address,
        amount: '1000000000',
        mint: null,
        timestamp: Date.now(),
        memo: 'taxCategory: income',
      }

      const complianceData: SolanaTransactionData = {
        sender: 'alice',
        recipient: stealthForBob.stealthAddress.address,
        amount: '1000000000',
        mint: null,
        timestamp: Date.now(),
        memo: 'aml_check: passed, kyc_verified: true',
      }

      const encryptedTax = encryptForViewing(taxData, taxAuditor)
      const encryptedCompliance = encryptForViewing(complianceData, complianceAuditor)

      // Each auditor sees only their data
      const taxDecrypted = decryptWithViewing(encryptedTax, taxAuditor)
      const complianceDecrypted = decryptWithViewing(encryptedCompliance, complianceAuditor)

      expect(taxDecrypted.memo).toContain('income')
      expect(complianceDecrypted.memo).toContain('kyc_verified')

      // Cross-access fails
      expect(() => decryptWithViewing(encryptedTax, complianceAuditor)).toThrow()
      expect(() => decryptWithViewing(encryptedCompliance, taxAuditor)).toThrow()
    })
  })

  describe('Multi-Hop Transfers', () => {
    it('should support payment chain: Alice → Bob → Charlie', () => {
      const alice = generateStealthMetaAddress('solana', 'alice')
      const bob = generateStealthMetaAddress('solana', 'bob')
      const charlie = generateStealthMetaAddress('solana', 'charlie')

      // Hop 1: Alice → Bob
      const hop1 = generateStealthAddress(bob.metaAddress)
      const isBobPayment = checkStealthAddress(
        hop1.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(isBobPayment).toBe(true)

      // Bob claims and gets private key
      const bobRecovery = deriveStealthPrivateKey(
        hop1.stealthAddress,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )
      expect(bobRecovery.privateKey).toBeDefined()

      // Hop 2: Bob → Charlie (using new stealth address)
      const hop2 = generateStealthAddress(charlie.metaAddress)
      const isCharliePayment = checkStealthAddress(
        hop2.stealthAddress,
        charlie.spendingPrivateKey,
        charlie.viewingPrivateKey
      )
      expect(isCharliePayment).toBe(true)

      // Payments are unlinkable
      expect(hop1.stealthAddress.address).not.toBe(hop2.stealthAddress.address)
    })

    it('should prevent linking payments in chain', () => {
      const participants = Array.from({ length: 5 }, (_, i) =>
        generateStealthMetaAddress('solana', `user${i}`)
      )

      const stealthAddresses: string[] = []

      // Create chain of payments
      for (let i = 0; i < participants.length - 1; i++) {
        const stealth = generateStealthAddress(participants[i + 1].metaAddress)
        stealthAddresses.push(stealth.stealthAddress.address)
      }

      // All addresses unique (no patterns to link them)
      const unique = new Set(stealthAddresses)
      expect(unique.size).toBe(4)

      // No visible relationship between addresses
      stealthAddresses.forEach((addr, i) => {
        stealthAddresses.forEach((otherAddr, j) => {
          if (i !== j) {
            // Addresses have no common prefix/suffix patterns
            expect(addr.slice(0, 10)).not.toBe(otherAddr.slice(0, 10))
          }
        })
      })
    })
  })

  describe('Group Payments (1:N)', () => {
    it('should support one sender to multiple recipients', () => {
      const sender = generateStealthMetaAddress('solana', 'sender')
      const recipients = Array.from({ length: 5 }, (_, i) =>
        generateStealthMetaAddress('solana', `recipient${i}`)
      )

      // Send to all recipients
      const payments = recipients.map((recipient) => ({
        recipient,
        stealth: generateStealthAddress(recipient.metaAddress),
        amount: 100_000_000n, // 0.1 SOL each
        commitment: commitSolana(100_000_000n),
      }))

      // Each recipient can claim their payment
      payments.forEach((payment, i) => {
        const isForRecipient = checkStealthAddress(
          payment.stealth.stealthAddress,
          recipients[i].spendingPrivateKey,
          recipients[i].viewingPrivateKey
        )
        expect(isForRecipient).toBe(true)

        // But not others' payments
        const otherIdx = (i + 1) % recipients.length
        const isForOther = checkStealthAddress(
          payment.stealth.stealthAddress,
          recipients[otherIdx].spendingPrivateKey,
          recipients[otherIdx].viewingPrivateKey
        )
        expect(isForOther).toBe(false)
      })
    })

    it('should support splitting payment (N:1:M pattern)', () => {
      // Multiple senders fund a pool, pool distributes to multiple recipients
      const senders = Array.from({ length: 3 }, (_, i) =>
        generateStealthMetaAddress('solana', `sender${i}`)
      )
      const pool = generateStealthMetaAddress('solana', 'pool')
      const recipients = Array.from({ length: 4 }, (_, i) =>
        generateStealthMetaAddress('solana', `recipient${i}`)
      )

      // Phase 1: Senders → Pool
      const inboundPayments = senders.map(() =>
        generateStealthAddress(pool.metaAddress)
      )

      // Pool detects all payments
      const allReceived = inboundPayments.every((payment) =>
        checkStealthAddress(
          payment.stealthAddress,
          pool.spendingPrivateKey,
          pool.viewingPrivateKey
        )
      )
      expect(allReceived).toBe(true)

      // Phase 2: Pool → Recipients
      const outboundPayments = recipients.map((recipient) =>
        generateStealthAddress(recipient.metaAddress)
      )

      // All recipients can claim
      const allClaimed = outboundPayments.every((payment, i) =>
        checkStealthAddress(
          payment.stealthAddress,
          recipients[i].spendingPrivateKey,
          recipients[i].viewingPrivateKey
        )
      )
      expect(allClaimed).toBe(true)
    })
  })

  describe('Privacy Guarantees', () => {
    it('should prevent address reuse', () => {
      const recipient = generateStealthMetaAddress('solana')

      // 100 payments to same recipient
      const addresses = Array.from({ length: 100 }, () =>
        generateStealthAddress(recipient.metaAddress).stealthAddress.address
      )

      // All unique
      expect(new Set(addresses).size).toBe(100)
    })

    it('should maintain privacy under batch operations', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Batch of payments
      const batch = Array.from({ length: 10 }, () => {
        const stealth = generateStealthAddress(recipient.metaAddress)
        const commitment = commitSolana(BigInt(Math.floor(Math.random() * 1000000000)))
        return { stealth, commitment }
      })

      // All payments detectable by recipient
      const allDetected = batch.every((p) =>
        checkStealthAddress(
          p.stealth.stealthAddress,
          recipient.spendingPrivateKey,
          recipient.viewingPrivateKey
        )
      )
      expect(allDetected).toBe(true)

      // Commitments are all unique (different amounts + random blinding)
      const commitments = new Set(batch.map((p) => p.commitment.commitment))
      expect(commitments.size).toBe(10)
    })

    it('should not leak metadata through timing', () => {
      const recipient = generateStealthMetaAddress('solana')

      // Generate many addresses and ensure consistent timing
      const times: number[] = []
      for (let i = 0; i < 50; i++) {
        const start = performance.now()
        generateStealthAddress(recipient.metaAddress)
        times.push(performance.now() - start)
      }

      // Timing should be consistent (low variance)
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const variance = times.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / times.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be low relative to mean
      expect(stdDev / avg).toBeLessThan(2) // Less than 200% variance
    })
  })

  describe('Error Scenarios', () => {
    it('should handle invalid recipient meta-address gracefully', () => {
      expect(() => {
        decodeStealthMetaAddress('invalid:meta:address')
      }).toThrow()
    })

    it('should reject wrong key usage', () => {
      const alice = generateStealthMetaAddress('solana')
      const bob = generateStealthMetaAddress('solana')

      const stealthForBob = generateStealthAddress(bob.metaAddress)

      // Using Alice's keys to check Bob's payment should fail
      const wrongCheck = checkStealthAddress(
        stealthForBob.stealthAddress,
        alice.spendingPrivateKey,
        alice.viewingPrivateKey
      )
      expect(wrongCheck).toBe(false)
    })

    it('should handle concurrent payment detection', async () => {
      const recipient = generateStealthMetaAddress('solana')

      // Simulate concurrent payments
      const payments = Array.from({ length: 20 }, () =>
        generateStealthAddress(recipient.metaAddress)
      )

      // All should be detectable in parallel
      const results = await Promise.all(
        payments.map(async (p) =>
          checkStealthAddress(
            p.stealthAddress,
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey
          )
        )
      )

      expect(results.every((r) => r === true)).toBe(true)
    })
  })
})
