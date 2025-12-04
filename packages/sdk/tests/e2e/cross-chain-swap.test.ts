/**
 * E2E Cross-Chain Swap Flow Tests
 *
 * Tests complete cross-chain swap scenarios:
 * 1. Connect wallet
 * 2. Create shielded intent
 * 3. Submit to solver
 * 4. Receive quote
 * 5. Execute swap
 * 6. Verify completion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel, IntentStatus } from '@sip-protocol/types'
import type { ChainId } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  executeTestSwap,
  verifyPrivacy,
  NATIVE_TOKENS,
  DEFAULT_SWAP_PARAMS,
  suppressConsoleWarnings,
  delay,
  type E2ETestFixture,
} from './helpers'

describe('E2E: Cross-Chain Swap Flow', () => {
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

  // ─── Basic Swap Flows ───────────────────────────────────────────────────────────

  describe('Basic Swap Scenarios', () => {
    it('should complete SOL → ZEC shielded swap', async () => {
      const { intent, quotes, result, duration } = await executeTestSwap(fixture, {
        inputChain: 'solana' as ChainId,
        outputChain: 'zcash' as ChainId,
        inputAmount: 1_000_000_000n, // 1 SOL
        minOutputAmount: 50_000_000n, // 0.5 ZEC
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Verify intent was created correctly
      expect(intent.intentId).toBeDefined()
      expect(intent.outputAsset.chain).toBe('zcash')
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)

      // Verify quotes received
      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].outputAmount).toBeGreaterThanOrEqual(intent.minOutputAmount)

      // Verify execution result
      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.outputAmount).toBeGreaterThanOrEqual(intent.minOutputAmount)

      // Verify privacy
      const privacy = verifyPrivacy(intent)
      expect(privacy.senderHidden).toBe(true)
      expect(privacy.amountHidden).toBe(true)

      // Performance check
      expect(duration).toBeLessThan(10000) // Should complete in < 10s
    })

    it('should complete ETH → NEAR shielded swap', async () => {
      // Use amounts where input >= output for funding proof
      const { intent, quotes, result } = await executeTestSwap(fixture, {
        inputChain: 'ethereum' as ChainId,
        outputChain: 'near' as ChainId,
        inputAmount: 1_000_000_000_000_000_000n, // 1 ETH
        minOutputAmount: 100_000_000n, // Small output for test
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(quotes[0].outputAmount).toBeGreaterThan(0n)
    })

    it('should complete transparent swap (no privacy)', async () => {
      const { intent, result } = await executeTestSwap(fixture, {
        inputChain: 'solana' as ChainId,
        outputChain: 'ethereum' as ChainId,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(intent.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)

      // Transparent mode should expose tx hash
      expect(result.txHash).toBeDefined()
    })

    it('should complete compliant swap with viewing key', async () => {
      const { intent, result } = await executeTestSwap(fixture, {
        inputChain: 'ethereum' as ChainId,
        outputChain: 'zcash' as ChainId,
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)

      // Compliant mode should have viewing key hash
      expect(intent.viewingKeyHash).toBeDefined()
    })
  })

  // ─── Multi-Chain Scenarios ──────────────────────────────────────────────────────

  describe('Multi-Chain Scenarios', () => {
    const chainPairs: Array<[ChainId, ChainId]> = [
      ['solana', 'ethereum'],
      ['solana', 'zcash'],
      ['solana', 'near'],
      ['ethereum', 'solana'],
      ['ethereum', 'zcash'],
      ['ethereum', 'near'],
      ['near', 'solana'],
      ['near', 'ethereum'],
      ['near', 'zcash'],
    ]

    it.each(chainPairs)('should swap %s → %s', async (inputChain, outputChain) => {
      const intent = await createTestIntent(fixture.sip, {
        inputChain: inputChain as ChainId,
        outputChain: outputChain as ChainId,
        inputAmount: 1_000_000_000n,
        minOutputAmount: 1_000_000n,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(intent.outputAsset.chain).toBe(outputChain)

      // Get quotes
      const quotes = await fixture.sip.getQuotes(intent)
      expect(quotes.length).toBeGreaterThan(0)
    })
  })

  // ─── Wallet Integration ─────────────────────────────────────────────────────────

  describe('Wallet Integration', () => {
    it('should connect Solana wallet and execute swap', async () => {
      // Connect wallet
      await fixture.solanaWallet.connect()
      expect(fixture.solanaWallet.isConnected()).toBe(true)
      expect(fixture.solanaWallet.address).toBeDefined()

      // Check balance
      const balance = await fixture.solanaWallet.getBalance()
      expect(balance).toBeGreaterThan(0n)

      // Create and execute swap
      const { result } = await executeTestSwap(fixture, {
        inputChain: 'solana' as ChainId,
        outputChain: 'zcash' as ChainId,
      })

      expect(result.status).toBe(IntentStatus.FULFILLED)

      // Disconnect
      await fixture.solanaWallet.disconnect()
      expect(fixture.solanaWallet.isConnected()).toBe(false)
    })

    it('should connect Ethereum wallet and execute swap', async () => {
      // Connect wallet
      await fixture.ethereumWallet.connect()
      expect(fixture.ethereumWallet.isConnected()).toBe(true)

      // Check balance
      const balance = await fixture.ethereumWallet.getBalance()
      expect(balance).toBeGreaterThan(0n)

      // Create and execute swap
      const { result } = await executeTestSwap(fixture, {
        inputChain: 'ethereum' as ChainId,
        outputChain: 'near' as ChainId,
      })

      expect(result.status).toBe(IntentStatus.FULFILLED)
    })

    it('should handle wallet disconnection during swap', async () => {
      await fixture.solanaWallet.connect()

      // Start creating intent
      const intent = await createTestIntent(fixture.sip)

      // Simulate disconnect
      fixture.solanaWallet.simulateDisconnect()
      expect(fixture.solanaWallet.isConnected()).toBe(false)

      // Intent should still exist (client-side)
      expect(intent.intentId).toBeDefined()
    })

    it('should handle account change event', async () => {
      await fixture.solanaWallet.connect()
      const originalAddress = fixture.solanaWallet.address

      // Listen for account change
      let accountChanged = false
      fixture.solanaWallet.on('accountChanged', () => {
        accountChanged = true
      })

      // Simulate account change
      fixture.solanaWallet.simulateAccountChange('NewTestAddress123')

      expect(accountChanged).toBe(true)
      expect(fixture.solanaWallet.address).not.toBe(originalAddress)
    })
  })

  // ─── Stealth Address Flow ───────────────────────────────────────────────────────

  describe('Stealth Address Flow', () => {
    it('should generate unique stealth addresses for each swap', async () => {
      const stealthAddresses: string[] = []

      // Execute multiple swaps
      for (let i = 0; i < 3; i++) {
        const intent = await createTestIntent(fixture.sip, {
          inputChain: 'solana' as ChainId,
          outputChain: 'zcash' as ChainId,
        })

        if (intent.recipientStealth) {
          stealthAddresses.push(intent.recipientStealth)
        }
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(stealthAddresses)
      expect(uniqueAddresses.size).toBe(stealthAddresses.length)
    })

    it('should allow recipient to claim with stealth keys', async () => {
      const recipientKeys = fixture.zcashStealthKeys

      // Import stealth functions
      const { checkStealthAddress, generateStealthAddress, encodeStealthMetaAddress } =
        await import('../../src/stealth')

      // Create intent with encoded recipient stealth meta-address
      const encodedMetaAddress = encodeStealthMetaAddress(recipientKeys.metaAddress)

      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .recipient(encodedMetaAddress)
        .withPlaceholders()
        .build()

      expect(intent.recipientStealth).toBeDefined()

      // Generate a stealth address from the meta-address
      const { stealthAddress } = generateStealthAddress(recipientKeys.metaAddress)

      // Recipient should be able to verify ownership
      const canClaim = checkStealthAddress(
        stealthAddress,
        recipientKeys.spendingPrivateKey,
        recipientKeys.viewingPrivateKey
      )

      expect(canClaim).toBe(true)
    })

    it('should prevent non-recipient from claiming', async () => {
      const recipientKeys = fixture.zcashStealthKeys
      const attackerKeys = fixture.solanaStealthKeys // Different keys

      const { generateStealthAddress, checkStealthAddress } = await import('../../src/stealth')

      // Generate stealth address for recipient
      const { stealthAddress } = generateStealthAddress(recipientKeys.metaAddress)

      // Attacker should NOT be able to claim
      const attackerCanClaim = checkStealthAddress(
        stealthAddress,
        attackerKeys.spendingPrivateKey,
        attackerKeys.viewingPrivateKey
      )

      expect(attackerCanClaim).toBe(false)
    })
  })

  // ─── Solver Interaction ─────────────────────────────────────────────────────────

  describe('Solver Interaction', () => {
    it('should receive multiple quotes from solver', async () => {
      const intent = await createTestIntent(fixture.sip)
      const quotes = await fixture.sip.getQuotes(intent)

      expect(quotes.length).toBeGreaterThan(0)

      // All quotes should be valid
      for (const quote of quotes) {
        expect(quote.quoteId).toBeDefined()
        expect(quote.intentId).toBe(intent.intentId)
        expect(quote.outputAmount).toBeGreaterThan(0n)
        expect(quote.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000))
      }
    })

    it('should select best quote by output amount', async () => {
      const intent = await createTestIntent(fixture.sip)
      const quotes = await fixture.sip.getQuotes(intent)

      // Sort by output amount (descending)
      const sortedQuotes = [...quotes].sort((a, b) =>
        Number(b.outputAmount - a.outputAmount)
      )

      const bestQuote = sortedQuotes[0]
      expect(bestQuote.outputAmount).toBeGreaterThanOrEqual(intent.minOutputAmount)
    })

    it('should execute with selected quote', async () => {
      const intent = await createTestIntent(fixture.sip)
      const quotes = await fixture.sip.getQuotes(intent)

      // Execute with first quote
      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const result = await fixture.sip.execute(tracked, quotes[0])

      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.outputAmount).toBe(quotes[0].outputAmount)
    })

    it('should verify solver handles privacy-preserving interaction', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Create visible intent (what solver sees)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        // Note: senderCommitment and inputCommitment hide real values
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      // Solver can only see commitments, not actual values
      expect(visibleIntent.senderCommitment).toBeDefined()
      expect(visibleIntent.inputCommitment).toBeDefined()

      // Solver should still be able to generate quote
      const canHandle = await fixture.solver.canHandle(visibleIntent)
      expect(canHandle).toBe(true)

      const quote = await fixture.solver.generateQuote(visibleIntent)
      expect(quote).not.toBeNull()
    })
  })

  // ─── Intent Lifecycle ───────────────────────────────────────────────────────────

  describe('Intent Lifecycle', () => {
    it('should track intent status through lifecycle', async () => {
      const intent = await createTestIntent(fixture.sip)

      // Initially pending
      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      expect(tracked.status).toBe(IntentStatus.PENDING)

      // After getting quotes
      const quotes = await fixture.sip.getQuotes(intent)
      expect(quotes.length).toBeGreaterThan(0)

      // After execution
      const result = await fixture.sip.execute(tracked, quotes[0])
      expect(result.status).toBe(IntentStatus.FULFILLED)
    })

    it('should handle concurrent intents', async () => {
      // Create multiple intents in parallel
      const intentPromises = [
        createTestIntent(fixture.sip, { outputChain: 'zcash' as ChainId }),
        createTestIntent(fixture.sip, { outputChain: 'ethereum' as ChainId }),
        createTestIntent(fixture.sip, { outputChain: 'near' as ChainId }),
      ]

      const intents = await Promise.all(intentPromises)

      // All should have unique IDs
      const intentIds = intents.map(i => i.intentId)
      const uniqueIds = new Set(intentIds)
      expect(uniqueIds.size).toBe(3)

      // Get quotes for all
      const quotePromises = intents.map(i => fixture.sip.getQuotes(i))
      const allQuotes = await Promise.all(quotePromises)

      expect(allQuotes.every(q => q.length > 0)).toBe(true)
    })

    it('should reject expired intent', async () => {
      const { isExpired } = await import('../../src/intent')

      // Create intent with very short TTL
      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(1) // 1 second
        .withPlaceholders()
        .build()

      // Should not be expired immediately
      expect(isExpired(intent)).toBe(false)

      // Wait for expiry
      await delay(2500)

      // Should now be expired
      expect(isExpired(intent)).toBe(true)
    }, 10000)
  })

  // ─── Amount Validation ──────────────────────────────────────────────────────────

  describe('Amount Validation', () => {
    it('should accept valid amounts', async () => {
      const intent = await createTestIntent(fixture.sip, {
        inputAmount: 1_000_000_000n,
        minOutputAmount: 500_000_000n,
      })

      expect(intent.minOutputAmount).toBe(500_000_000n)
    })

    it('should handle large amounts', async () => {
      const intent = await createTestIntent(fixture.sip, {
        inputAmount: 1_000_000_000_000_000_000_000n, // Very large
        minOutputAmount: 500_000_000_000_000_000_000n,
      })

      expect(intent.minOutputAmount).toBe(500_000_000_000_000_000_000n)
    })

    it('should handle small amounts', async () => {
      const intent = await createTestIntent(fixture.sip, {
        inputAmount: 1n,
        minOutputAmount: 1n,
      })

      expect(intent.minOutputAmount).toBe(1n)
    })
  })
})
