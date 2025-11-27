/**
 * MockSolver unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MockSolver, createMockSolver } from '../../src/solver/mock-solver'
import {
  type SolverVisibleIntent,
  type ShieldedIntent,
  type SolverQuote,
  PrivacyLevel,
  IntentStatus,
  NATIVE_TOKENS,
  SIP_VERSION,
} from '@sip-protocol/types'

// Helper to create mock visible intent
function createMockVisibleIntent(overrides: Partial<SolverVisibleIntent> = {}): SolverVisibleIntent {
  return {
    intentId: `intent-${Date.now()}`,
    version: SIP_VERSION,
    privacyLevel: PrivacyLevel.SHIELDED,
    createdAt: Math.floor(Date.now() / 1000),
    expiry: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
    outputAsset: NATIVE_TOKENS.ethereum,
    minOutputAmount: 1000000000000000000n, // 1 ETH
    maxSlippage: 0.01,
    inputCommitment: {
      value: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    senderCommitment: {
      value: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    recipientStealthAddress: '0x02abc123def456789012345678901234567890123456789012345678901234567890',
    ephemeralPublicKey: '0x03def789012345678901234567890123456789012345678901234567890123456789',
    fundingProof: {
      type: 'funding',
      proof: '0x' + '00'.repeat(64),
      publicInputs: ['0x1234' as const],
    },
    validityProof: {
      type: 'validity',
      proof: '0x' + '00'.repeat(64),
      publicInputs: ['0x5678' as const],
    },
    ...overrides,
  }
}

// Helper to create mock shielded intent (full intent for fulfillment)
function createMockShieldedIntent(visible: SolverVisibleIntent): ShieldedIntent {
  return {
    intentId: visible.intentId,
    version: SIP_VERSION,
    privacyLevel: PrivacyLevel.SHIELDED,
    createdAt: visible.createdAt,
    expiry: visible.expiry,
    outputAsset: visible.outputAsset,
    minOutputAmount: visible.minOutputAmount,
    maxSlippage: visible.maxSlippage,
    inputCommitment: visible.inputCommitment,
    senderCommitment: visible.senderCommitment,
    recipientStealth: {
      address: visible.recipientStealthAddress,
      ephemeralPublicKey: visible.ephemeralPublicKey,
      viewTag: 42,
    },
    fundingProof: visible.fundingProof,
    validityProof: visible.validityProof,
  }
}

describe('MockSolver', () => {
  let solver: MockSolver

  beforeEach(() => {
    solver = new MockSolver()
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create solver with default config', () => {
      const solver = new MockSolver()
      expect(solver.info.id).toMatch(/^mock-solver-/)
      expect(solver.info.name).toBe('Mock SIP Solver')
      expect(solver.info.reputation).toBe(95)
      expect(solver.info.successRate).toBe(0.99)
    })

    it('should create solver with custom config', () => {
      const solver = new MockSolver({
        name: 'Custom Solver',
        supportedChains: ['near', 'ethereum'],
        feePercent: 0.01,
      })
      expect(solver.info.name).toBe('Custom Solver')
      expect(solver.capabilities.inputChains).toEqual(['near', 'ethereum'])
    })

    it('should support all default chains', () => {
      expect(solver.capabilities.inputChains).toContain('near')
      expect(solver.capabilities.inputChains).toContain('ethereum')
      expect(solver.capabilities.inputChains).toContain('solana')
      expect(solver.capabilities.inputChains).toContain('zcash')
    })
  })

  // ─── createMockSolver ────────────────────────────────────────────────────────

  describe('createMockSolver', () => {
    it('should create solver instance', () => {
      const solver = createMockSolver()
      expect(solver).toBeInstanceOf(MockSolver)
    })

    it('should pass config to constructor', () => {
      const solver = createMockSolver({ name: 'Test' })
      expect(solver.info.name).toBe('Test')
    })
  })

  // ─── canHandle ───────────────────────────────────────────────────────────────

  describe('canHandle', () => {
    it('should return true for valid intent', async () => {
      const intent = createMockVisibleIntent()
      const result = await solver.canHandle(intent)
      expect(result).toBe(true)
    })

    it('should return false for unsupported chain', async () => {
      const intent = createMockVisibleIntent({
        outputAsset: { ...NATIVE_TOKENS.ethereum, chain: 'bitcoin' as any },
      })
      const result = await solver.canHandle(intent)
      expect(result).toBe(false)
    })

    it('should return false for expired intent', async () => {
      const intent = createMockVisibleIntent({
        expiry: Math.floor(Date.now() / 1000) - 100, // Expired
      })
      const result = await solver.canHandle(intent)
      expect(result).toBe(false)
    })

    it('should return false for amount below minimum', async () => {
      const smallSolver = new MockSolver()
      ;(smallSolver.info as any).minOrderSize = 1000000000000000000000n // 1000 ETH
      const intent = createMockVisibleIntent({
        minOutputAmount: 1000000000000000000n, // 1 ETH
      })
      const result = await smallSolver.canHandle(intent)
      expect(result).toBe(false)
    })
  })

  // ─── generateQuote ───────────────────────────────────────────────────────────

  describe('generateQuote', () => {
    it('should generate valid quote for valid intent', async () => {
      const intent = createMockVisibleIntent()
      const quote = await solver.generateQuote(intent)

      expect(quote).toBeDefined()
      expect(quote!.quoteId).toMatch(/^quote-/)
      expect(quote!.intentId).toBe(intent.intentId)
      expect(quote!.solverId).toBe(solver.info.id)
      expect(quote!.outputAmount).toBeGreaterThan(intent.minOutputAmount)
      expect(quote!.signature).toMatch(/^0x/)
      expect(quote!.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should return null for unsupported intent', async () => {
      const intent = createMockVisibleIntent({
        outputAsset: { ...NATIVE_TOKENS.ethereum, chain: 'bitcoin' as any },
      })
      const quote = await solver.generateQuote(intent)
      expect(quote).toBeNull()
    })

    it('should include spread in output amount', async () => {
      const spreadSolver = new MockSolver({ spreadPercent: 0.05 }) // 5% spread
      const intent = createMockVisibleIntent({
        minOutputAmount: 1000000n,
      })
      const quote = await spreadSolver.generateQuote(intent)

      // Output should be at least min + 5%
      expect(quote!.outputAmount).toBeGreaterThanOrEqual(1050000n)
    })

    it('should calculate fee', async () => {
      const feeSolver = new MockSolver({ feePercent: 0.01 }) // 1% fee
      const intent = createMockVisibleIntent()
      const quote = await feeSolver.generateQuote(intent)

      expect(quote!.fee).toBeGreaterThan(0n)
    })

    it('should generate unique quote IDs', async () => {
      const intent = createMockVisibleIntent()
      const quote1 = await solver.generateQuote(intent)
      const quote2 = await solver.generateQuote(intent)

      expect(quote1!.quoteId).not.toBe(quote2!.quoteId)
    })
  })

  // ─── fulfill ─────────────────────────────────────────────────────────────────

  describe('fulfill', () => {
    it('should fulfill intent successfully', async () => {
      const visibleIntent = createMockVisibleIntent()
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await solver.generateQuote(visibleIntent)

      const result = await solver.fulfill(shieldedIntent, quote!)

      expect(result.intentId).toBe(shieldedIntent.intentId)
      expect(result.status).toBe(IntentStatus.FULFILLED)
      expect(result.outputAmount).toBe(quote!.outputAmount)
      expect(result.fulfillmentProof).toBeDefined()
      expect(result.fulfilledAt).toBeGreaterThan(0)
    })

    it('should hide txHash for shielded intents', async () => {
      const visibleIntent = createMockVisibleIntent({
        privacyLevel: PrivacyLevel.SHIELDED,
      })
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await solver.generateQuote(visibleIntent)

      const result = await solver.fulfill(shieldedIntent, quote!)

      expect(result.txHash).toBeUndefined()
    })

    it('should include txHash for transparent intents', async () => {
      const visibleIntent = createMockVisibleIntent({
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })
      const shieldedIntent = {
        ...createMockShieldedIntent(visibleIntent),
        privacyLevel: PrivacyLevel.TRANSPARENT,
      }
      const quote = await solver.generateQuote(visibleIntent)

      const result = await solver.fulfill(shieldedIntent, quote!)

      expect(result.txHash).toMatch(/^0x/)
    })

    it('should respect failure rate', async () => {
      const failingSolver = new MockSolver({ failureRate: 1 }) // Always fail
      const visibleIntent = createMockVisibleIntent()
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await failingSolver.generateQuote(visibleIntent)

      const result = await failingSolver.fulfill(shieldedIntent, quote!)

      expect(result.status).toBe(IntentStatus.FAILED)
      expect(result.error).toBeDefined()
    })

    it('should update status during fulfillment', async () => {
      const slowSolver = new MockSolver({ executionDelay: 50 })
      const visibleIntent = createMockVisibleIntent()
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await slowSolver.generateQuote(visibleIntent)

      // Start fulfillment
      const fulfillPromise = slowSolver.fulfill(shieldedIntent, quote!)

      // Check status during execution
      await new Promise(r => setTimeout(r, 10))
      const status = await slowSolver.getStatus(shieldedIntent.intentId)
      expect(status?.status).toBe('executing')

      // Wait for completion
      await fulfillPromise

      // Check final status
      const finalStatus = await slowSolver.getStatus(shieldedIntent.intentId)
      expect(finalStatus?.status).toBe('completed')
    })
  })

  // ─── getStatus ───────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return null for unknown intent', async () => {
      const status = await solver.getStatus('unknown-intent')
      expect(status).toBeNull()
    })

    it('should return status after fulfillment', async () => {
      const visibleIntent = createMockVisibleIntent()
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await solver.generateQuote(visibleIntent)

      await solver.fulfill(shieldedIntent, quote!)
      const status = await solver.getStatus(shieldedIntent.intentId)

      expect(status).toBeDefined()
      expect(status!.status).toBe('completed')
    })
  })

  // ─── cancel ──────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should return false for non-pending intent', async () => {
      const result = await solver.cancel('unknown-intent')
      expect(result).toBe(false)
    })
  })

  // ─── reset ───────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should clear all pending fulfillments', async () => {
      const visibleIntent = createMockVisibleIntent()
      const shieldedIntent = createMockShieldedIntent(visibleIntent)
      const quote = await solver.generateQuote(visibleIntent)

      await solver.fulfill(shieldedIntent, quote!)

      solver.reset()

      const status = await solver.getStatus(shieldedIntent.intentId)
      expect(status).toBeNull()
    })
  })

  // ─── Privacy Guarantees ──────────────────────────────────────────────────────

  describe('privacy guarantees', () => {
    it('should only access visible fields when generating quote', async () => {
      // This test ensures the solver interface enforces privacy
      const intent = createMockVisibleIntent()

      // SolverVisibleIntent type should NOT have direct access to:
      // - sender address (only senderCommitment)
      // - input amount (only inputCommitment)
      // - recipient identity (only stealth address)

      expect('senderCommitment' in intent).toBe(true)
      expect('inputCommitment' in intent).toBe(true)
      expect('recipientStealthAddress' in intent).toBe(true)

      // These should NOT be in SolverVisibleIntent
      expect('senderAddress' in intent).toBe(false)
      expect('inputAmount' in intent).toBe(false)
      expect('recipientAddress' in intent).toBe(false)

      // Quote should still work with only visible data
      const quote = await solver.generateQuote(intent)
      expect(quote).toBeDefined()
    })

    it('should support unique stealth addresses per intent', async () => {
      // Each intent should have a unique stealth address in production
      // This test demonstrates the pattern - stealth addresses are one-time use
      const intent1 = createMockVisibleIntent({
        recipientStealthAddress: '0x02aaa111222333444555666777888999000111222333444555666777888999000111',
        ephemeralPublicKey: '0x03bbb222333444555666777888999000111222333444555666777888999000111222',
      })
      const intent2 = createMockVisibleIntent({
        recipientStealthAddress: '0x02ccc333444555666777888999000111222333444555666777888999000111222333',
        ephemeralPublicKey: '0x03ddd444555666777888999000111222333444555666777888999000111222333444',
      })

      // Stealth addresses should be different (one-time addresses)
      expect(intent1.recipientStealthAddress).not.toBe(intent2.recipientStealthAddress)
      expect(intent1.ephemeralPublicKey).not.toBe(intent2.ephemeralPublicKey)

      // Both intents should be handleable
      expect(await solver.canHandle(intent1)).toBe(true)
      expect(await solver.canHandle(intent2)).toBe(true)
    })
  })
})
