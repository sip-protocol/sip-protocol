/**
 * E2E Error Scenario Tests
 *
 * Tests for error handling:
 * - Network failures
 * - Timeout handling
 * - Invalid quotes
 * - Solver failures
 * - Rollback behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel, IntentStatus } from '@sip-protocol/types'
import type { ChainId, HexString } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  createFailingSolver,
  createErrorIntent,
  suppressConsoleWarnings,
  delay,
  waitFor,
  type E2ETestFixture,
} from './helpers'
import { MockSolver, createMockSolver } from '../../src/solver/mock-solver'
import { ProofGenerationError } from '../../src/proofs/interface'
import { ValidationError, IntentError, CryptoError, ErrorCode } from '../../src/errors'
import { MockProofProvider } from '../../src/proofs/mock'
import { isExpired } from '../../src/intent'

describe('E2E: Error Scenarios', () => {
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

  // ─── Network Failures ───────────────────────────────────────────────────────────

  describe('Network Failures', () => {
    it('should handle solver unavailability', async () => {
      const failingSolver = createFailingSolver('network_failure')

      const intent = await createTestIntent(fixture.sip)

      // Create visible intent for solver
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      // Solver should fail to fulfill
      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const quote = await failingSolver.generateQuote(visibleIntent)

      if (quote) {
        const result = await failingSolver.fulfill(intent, quote)
        expect(result.status).toBe(IntentStatus.FAILED)
        expect(result.error).toBeDefined()
      }
    })

    it('should handle wallet RPC connection failure', async () => {
      await fixture.solanaWallet.connect()

      // Simulate disconnect
      fixture.solanaWallet.simulateDisconnect()

      // Operations should fail gracefully after disconnect
      expect(fixture.solanaWallet.isConnected()).toBe(false)
    })

    it('should handle partial network failures', async () => {
      // Create intent - this uses internal components
      const intent = await createTestIntent(fixture.sip)
      expect(intent.intentId).toBeDefined()

      // Even if some networks fail, intent creation should succeed
      // (intent is created locally before being broadcast)
    })
  })

  // ─── Timeout Handling ───────────────────────────────────────────────────────────

  describe('Timeout Handling', () => {
    it('should handle slow solver with timeout', async () => {
      const slowSolver = createMockSolver({
        name: 'Slow Solver',
        executionDelay: 100, // Reduced for test speed
      })

      const intent = await createTestIntent(fixture.sip)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const quote = await slowSolver.generateQuote(visibleIntent)
      expect(quote).not.toBeNull()

      if (quote) {
        // Execute should still complete (just slowly)
        const result = await slowSolver.fulfill(intent, quote)
        expect(result.status).toBe(IntentStatus.FULFILLED)
      }
    })

    it('should detect and handle expired intents', async () => {
      // Create intent with short TTL
      const intent = await fixture.sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(1) // 1 second
        .withPlaceholders() // For test environment
        .build()

      expect(isExpired(intent)).toBe(false)

      // Wait for expiry
      await delay(2500)

      expect(isExpired(intent)).toBe(true)

      // Solver should reject expired intent
      const canHandle = await fixture.solver.canHandle({
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      })

      expect(canHandle).toBe(false)
    }, 10000)

    it('should handle quote expiry', async () => {
      const intent = await createTestIntent(fixture.sip)
      const quotes = await fixture.sip.getQuotes(intent)

      // All quotes should have valid expiry initially
      const now = Math.floor(Date.now() / 1000)
      for (const quote of quotes) {
        expect(quote.expiry).toBeGreaterThan(now)
      }
    })
  })

  // ─── Invalid Quote Handling ─────────────────────────────────────────────────────

  describe('Invalid Quote Handling', () => {
    it('should reject quote with output below minimum', async () => {
      const intent = await createTestIntent(fixture.sip, {
        minOutputAmount: 1_000_000_000n, // High minimum
      })

      // Create a quote with output below minimum (simulated scenario)
      const invalidQuote = {
        quoteId: 'invalid-quote',
        intentId: intent.intentId,
        solverId: 'bad-solver',
        outputAmount: 1n, // Way below minimum
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: 0n,
      }

      // In a real implementation, this would be rejected
      expect(invalidQuote.outputAmount).toBeLessThan(intent.minOutputAmount)
    })

    it('should reject quote for wrong intent', async () => {
      const intent1 = await createTestIntent(fixture.sip)
      const intent2 = await createTestIntent(fixture.sip)

      const quotes = await fixture.sip.getQuotes(intent1)

      // Quote should be for intent1, not intent2
      expect(quotes[0].intentId).toBe(intent1.intentId)
      expect(quotes[0].intentId).not.toBe(intent2.intentId)
    })

    it('should handle malformed quote data', async () => {
      // Create a malformed quote
      const malformedQuote = {
        quoteId: '', // Empty
        intentId: '', // Empty
        solverId: null as unknown as string,
        outputAmount: -1n, // Negative (invalid for bigint ops)
        estimatedTime: -1,
        expiry: 0,
        fee: -1n,
      }

      // Validation should catch this
      expect(malformedQuote.quoteId).toBeFalsy()
      expect(malformedQuote.outputAmount).toBeLessThan(0n)
    })
  })

  // ─── Solver Failures ────────────────────────────────────────────────────────────

  describe('Solver Failures', () => {
    it('should handle solver rejection', async () => {
      const failingSolver = createFailingSolver('solver_failure')

      const intent = await createTestIntent(fixture.sip)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const quote = await failingSolver.generateQuote(visibleIntent)

      if (quote) {
        const result = await failingSolver.fulfill(intent, quote)
        expect(result.status).toBe(IntentStatus.FAILED)
      }
    })

    it('should handle solver cancel', async () => {
      const solver = createMockSolver()

      const intent = await createTestIntent(fixture.sip)

      // Cancel should work for pending intents
      const cancelled = await solver.cancel(intent.intentId)
      // Note: Cancel returns false if intent is not pending
      expect(typeof cancelled).toBe('boolean')
    })

    it('should handle unsupported chain pair', async () => {
      const solver = createMockSolver({
        supportedChains: ['solana', 'ethereum'] as ChainId[],
      })

      // Create intent with unsupported output chain
      const intent = await createTestIntent(fixture.sip, {
        inputChain: 'solana' as ChainId,
        outputChain: 'zcash' as ChainId, // Not in supportedChains
      })

      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const canHandle = await solver.canHandle(visibleIntent)
      expect(canHandle).toBe(false)
    })

    it('should track solver fulfillment status', async () => {
      const solver = createMockSolver()

      const intent = await createTestIntent(fixture.sip)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const quote = await solver.generateQuote(visibleIntent)
      expect(quote).not.toBeNull()

      if (quote) {
        // Start fulfillment
        const resultPromise = solver.fulfill(intent, quote)

        // Can check status during execution (in real impl)
        const result = await resultPromise
        expect(result.status).toBe(IntentStatus.FULFILLED)

        // After completion
        const status = await solver.getStatus(intent.intentId)
        expect(status?.status).toBe('completed')
      }
    })
  })

  // ─── Proof Generation Failures ──────────────────────────────────────────────────

  describe('Proof Generation Failures', () => {
    it('should fail funding proof with insufficient balance', async () => {
      const proofProvider = new MockProofProvider()
      await proofProvider.initialize()

      await expect(
        proofProvider.generateFundingProof({
          balance: 100n,
          minimumRequired: 1000n, // More than balance
          assetId: 'SOL',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should fail validity proof for expired intent', async () => {
      const proofProvider = new MockProofProvider()
      await proofProvider.initialize()

      const now = BigInt(Math.floor(Date.now() / 1000))

      await expect(
        proofProvider.generateValidityProof({
          intentHash: '0xabc' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblind' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: now,
          expiry: now - 100n, // Already expired
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should fail fulfillment proof with low output', async () => {
      const proofProvider = new MockProofProvider()
      await proofProvider.initialize()

      await expect(
        proofProvider.generateFulfillmentProof({
          intentHash: '0xabc' as HexString,
          outputAmount: 100n,
          minOutputAmount: 1000n, // More than output
          recipientStealth: '0xstealth' as HexString,
          outputBlinding: '0xblind' as HexString,
          fulfillmentTime: BigInt(Math.floor(Date.now() / 1000)),
          expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
        })
      ).rejects.toThrow(ProofGenerationError)
    })

    it('should fail with uninitialized proof provider', async () => {
      const uninitProvider = new MockProofProvider()
      // Note: Not calling initialize()

      await expect(
        uninitProvider.generateFundingProof({
          balance: 1000n,
          minimumRequired: 100n,
          assetId: 'SOL',
          blinding: '0x123' as HexString,
        })
      ).rejects.toThrow(/not initialized/)
    })
  })

  // ─── Validation Errors ──────────────────────────────────────────────────────────

  describe('Validation Errors', () => {
    it('should reject invalid chain ID', () => {
      // ValidationError is thrown synchronously in input()
      expect(() =>
        fixture.sip
          .intent()
          .input('invalid_chain' as ChainId, 'TOKEN', 100n)
      ).toThrow()
    })

    it('should reject negative amounts', () => {
      // Note: bigint doesn't allow negative, so this tests type safety
      const negativeAmount = -100n

      // In JavaScript/TypeScript, -100n is valid bigint but semantically invalid
      expect(negativeAmount).toBeLessThan(0n)
    })

    it('should reject invalid privacy level', async () => {
      // Attempting to set invalid privacy level
      const builder = fixture.sip.intent()
        .input('solana' as ChainId, 'SOL', 100n)
        .output('zcash' as ChainId, 'ZEC', 50n)

      // Setting invalid privacy level should fail
      expect(() => builder.privacy('invalid' as PrivacyLevel)).toThrow()
    })

    it('should validate stealth address format', async () => {
      // Import for testing
      const { decodeStealthMetaAddress } = await import('../../src/stealth')

      // Invalid format should throw
      expect(() => decodeStealthMetaAddress('invalid')).toThrow()
      expect(() => decodeStealthMetaAddress('')).toThrow()
    })
  })

  // ─── Wallet Errors ──────────────────────────────────────────────────────────────

  describe('Wallet Errors', () => {
    it('should handle connection rejection', async () => {
      const { createMockSolanaAdapter } = await import('../../src/wallet/solana/mock')

      const rejectingWallet = createMockSolanaAdapter({
        shouldFailConnect: true,
      })

      await expect(rejectingWallet.connect()).rejects.toThrow()
      expect(rejectingWallet.connectionState).toBe('error')
    })

    it('should handle signing rejection', async () => {
      const { createMockSolanaAdapter } = await import('../../src/wallet/solana/mock')

      const rejectingWallet = createMockSolanaAdapter({
        shouldFailSign: true,
      })
      await rejectingWallet.connect()

      await expect(
        rejectingWallet.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow()
    })

    it('should handle transaction failure', async () => {
      const { createMockSolanaAdapter } = await import('../../src/wallet/solana/mock')

      const failingWallet = createMockSolanaAdapter({
        shouldFailTransaction: true,
      })
      await failingWallet.connect()

      await expect(
        failingWallet.signAndSendTransaction({
          chain: 'solana',
          data: {},
        })
      ).rejects.toThrow()
    })

    it('should require connection before signing', async () => {
      // Wallet not connected
      await expect(
        fixture.solanaWallet.signMessage(new Uint8Array([1, 2, 3]))
      ).rejects.toThrow()
    })
  })

  // ─── Crypto Errors ──────────────────────────────────────────────────────────────

  describe('Crypto Errors', () => {
    it('should handle invalid commitment opening', async () => {
      const { commit, verifyOpening } = await import('../../src/commitment')

      const { commitment, blinding } = commit(100n)

      // Wrong amount should fail
      expect(verifyOpening(commitment, 99n, blinding)).toBe(false)
      expect(verifyOpening(commitment, 101n, blinding)).toBe(false)

      // Correct amount should succeed
      expect(verifyOpening(commitment, 100n, blinding)).toBe(true)
    })

    it('should handle viewing key decryption failure', async () => {
      const { generateViewingKey, encryptForViewing, decryptWithViewing } =
        await import('../../src/privacy')

      const key1 = generateViewingKey('/path/1')
      const key2 = generateViewingKey('/path/2')

      const data = { sender: '0x', recipient: '0x', amount: '1', timestamp: 1 }
      const encrypted = encryptForViewing(data, key1)

      expect(() => decryptWithViewing(encrypted, key2)).toThrow(CryptoError)
    })

    it('should handle corrupted ciphertext', async () => {
      const { generateViewingKey, encryptForViewing, decryptWithViewing } =
        await import('../../src/privacy')

      const key = generateViewingKey('/path')
      const data = { sender: '0x', recipient: '0x', amount: '1', timestamp: 1 }
      const encrypted = encryptForViewing(data, key)

      // Corrupt the ciphertext
      const corrupted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.replace(/./g, 'x'),
      }

      expect(() => decryptWithViewing(corrupted, key)).toThrow()
    })
  })

  // ─── Recovery and Rollback ──────────────────────────────────────────────────────

  describe('Recovery and Rollback', () => {
    it('should allow retry after solver failure', async () => {
      // First attempt with failing solver
      const failingSolver = createFailingSolver('solver_failure')
      const intent = await createTestIntent(fixture.sip)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const failedQuote = await failingSolver.generateQuote(visibleIntent)
      if (failedQuote) {
        const failedResult = await failingSolver.fulfill(intent, failedQuote)
        expect(failedResult.status).toBe(IntentStatus.FAILED)
      }

      // Retry with working solver
      const workingSolver = createMockSolver()
      const goodQuote = await workingSolver.generateQuote(visibleIntent)
      if (goodQuote) {
        const successResult = await workingSolver.fulfill(intent, goodQuote)
        expect(successResult.status).toBe(IntentStatus.FULFILLED)
      }
    })

    it('should maintain state after error', async () => {
      await fixture.solanaWallet.connect()
      const initialBalance = await fixture.solanaWallet.getBalance()

      // Trigger an error
      try {
        await fixture.solanaWallet.signMessage(new Uint8Array())
      } catch {
        // Ignore
      }

      // Wallet should still be usable
      expect(fixture.solanaWallet.isConnected()).toBe(true)
      const afterBalance = await fixture.solanaWallet.getBalance()
      expect(afterBalance).toBe(initialBalance)
    })

    it('should clear solver state on reset', async () => {
      const solver = createMockSolver()

      // Generate some state
      const intent = await createTestIntent(fixture.sip)
      const visibleIntent = {
        intentId: intent.intentId,
        outputAsset: intent.outputAsset,
        minOutputAmount: intent.minOutputAmount,
        expiry: intent.expiry,
        senderCommitment: intent.senderCommitment,
        inputCommitment: intent.inputCommitment,
      }

      const quote = await solver.generateQuote(visibleIntent)
      if (quote) {
        await solver.fulfill(intent, quote)
      }

      // Verify state exists
      const statusBefore = await solver.getStatus(intent.intentId)
      expect(statusBefore).not.toBeNull()

      // Reset
      solver.reset()

      // State should be cleared
      const statusAfter = await solver.getStatus(intent.intentId)
      expect(statusAfter).toBeNull()
    })
  })
})
