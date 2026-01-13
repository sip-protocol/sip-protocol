/**
 * Private Swap Integration Tests
 *
 * Tests for the full privacy swap flow combining SIP Native + C-SPL + Arcium.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PrivateSwap } from '../../src/privacy-backends/private-swap'
import { SIPNativeBackend } from '../../src/privacy-backends/sip-native'
import { ArciumBackend } from '../../src/privacy-backends/arcium'
import { CSPLClient } from '../../src/privacy-backends/cspl'
import type { CSPLToken } from '../../src/privacy-backends/cspl-types'
import type { PrivateSwapParams } from '../../src/privacy-backends/private-swap'

// ─── Test Helpers ────────────────────────────────────────────────────────────

// Valid Solana base58 addresses for testing
const TEST_ADDRESSES = {
  user: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  solMint: 'So11111111111111111111111111111111111111112',
  solConfMint: 'CSPLSoL1111111111111111111111111111111111',
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  usdcConfMint: 'CSPLUsdc111111111111111111111111111111111',
}

function createTestToken(symbol: string, decimals: number = 9): CSPLToken {
  if (symbol === 'SOL') {
    return {
      mint: TEST_ADDRESSES.solMint,
      confidentialMint: TEST_ADDRESSES.solConfMint,
      decimals,
      symbol: 'C-SOL',
      name: 'Confidential SOL',
    }
  }
  return {
    mint: TEST_ADDRESSES.usdcMint,
    confidentialMint: TEST_ADDRESSES.usdcConfMint,
    decimals,
    symbol: 'C-USDC',
    name: 'Confidential USDC',
  }
}

function createSwapParams(overrides: Partial<PrivateSwapParams> = {}): PrivateSwapParams {
  return {
    inputToken: createTestToken('SOL', 9),
    outputToken: createTestToken('USDC', 6),
    inputAmount: BigInt('1000000000'), // 1 SOL
    minOutputAmount: BigInt('50000000'), // 50 USDC
    user: TEST_ADDRESSES.user,
    ...overrides,
  }
}

function createPrivateSwap(): PrivateSwap {
  return new PrivateSwap({
    sipBackend: new SIPNativeBackend(),
    arciumBackend: new ArciumBackend(),
    csplClient: new CSPLClient(),
  })
}

// ─── Constructor Tests ────────────────────────────────────────────────────────

describe('PrivateSwap', () => {
  describe('constructor', () => {
    it('should create with required backends', () => {
      const swap = createPrivateSwap()

      expect(swap).toBeDefined()
    })

    it('should throw without SIP backend', () => {
      expect(() => new PrivateSwap({
        sipBackend: undefined as any,
        arciumBackend: new ArciumBackend(),
        csplClient: new CSPLClient(),
      })).toThrow('SIPNativeBackend is required')
    })

    it('should throw without Arcium backend', () => {
      expect(() => new PrivateSwap({
        sipBackend: new SIPNativeBackend(),
        arciumBackend: undefined as any,
        csplClient: new CSPLClient(),
      })).toThrow('ArciumBackend is required')
    })

    it('should throw without CSPL client', () => {
      expect(() => new PrivateSwap({
        sipBackend: new SIPNativeBackend(),
        arciumBackend: new ArciumBackend(),
        csplClient: undefined as any,
      })).toThrow('CSPLClient is required')
    })

    it('should accept custom slippage', () => {
      const swap = new PrivateSwap({
        sipBackend: new SIPNativeBackend(),
        arciumBackend: new ArciumBackend(),
        csplClient: new CSPLClient(),
        defaultSlippageBps: 100,
      })

      expect(swap.getDefaultSlippageBps()).toBe(100)
    })

    it('should accept custom deadline', () => {
      const swap = new PrivateSwap({
        sipBackend: new SIPNativeBackend(),
        arciumBackend: new ArciumBackend(),
        csplClient: new CSPLClient(),
        defaultDeadlineSeconds: 600,
      })

      expect(swap.getDefaultDeadlineSeconds()).toBe(600)
    })

    it('should default to 50 bps slippage', () => {
      const swap = createPrivateSwap()

      expect(swap.getDefaultSlippageBps()).toBe(50)
    })

    it('should default to 300 seconds deadline', () => {
      const swap = createPrivateSwap()

      expect(swap.getDefaultDeadlineSeconds()).toBe(300)
    })
  })

  // ─── Execute Tests ──────────────────────────────────────────────────────────────

  describe('execute', () => {
    let swap: PrivateSwap

    beforeEach(() => {
      swap = createPrivateSwap()
    })

    it('should execute swap successfully', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      expect(result.success).toBe(true)
      expect(result.signatures).toBeDefined()
      expect(result.computationId).toBeDefined()
    })

    it('should include step details', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      expect(result.steps).toBeDefined()
      expect(result.steps!.length).toBeGreaterThan(0)
    })

    it('should have wrap_input step', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      const wrapStep = result.steps?.find(s => s.name === 'wrap_input')
      expect(wrapStep).toBeDefined()
      expect(wrapStep?.status).toBe('completed')
    })

    it('should have encrypt_amount step', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      const encryptStep = result.steps?.find(s => s.name === 'encrypt_amount')
      expect(encryptStep).toBeDefined()
      expect(encryptStep?.status).toBe('completed')
    })

    it('should have arcium_swap step', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      const swapStep = result.steps?.find(s => s.name === 'arcium_swap')
      expect(swapStep).toBeDefined()
      expect(swapStep?.status).toBe('completed')
    })

    it('should generate stealth address when enabled', async () => {
      const params = createSwapParams({ useStealthOutput: true })

      const result = await swap.execute(params)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress).toContain('stealth_')
    })

    it('should include stealth step when enabled', async () => {
      const params = createSwapParams({ useStealthOutput: true })

      const result = await swap.execute(params)

      const stealthStep = result.steps?.find(s => s.name === 'generate_stealth')
      expect(stealthStep).toBeDefined()
      expect(stealthStep?.status).toBe('completed')
    })

    it('should estimate total fees', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      expect(result.totalFees).toBeDefined()
      expect(result.totalFees).toBeGreaterThan(BigInt(0))
    })

    it('should include route', async () => {
      const params = createSwapParams()

      const result = await swap.execute(params)

      expect(result.route).toBeDefined()
      expect(result.route?.length).toBe(2)
    })

    // Validation tests
    it('should fail without input token', async () => {
      const params = createSwapParams({ inputToken: {} as CSPLToken })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Input token')
    })

    it('should fail without output token', async () => {
      const params = createSwapParams({ outputToken: {} as CSPLToken })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Output token')
    })

    it('should fail with zero amount', async () => {
      const params = createSwapParams({ inputAmount: BigInt(0) })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Input amount')
    })

    it('should fail without user address', async () => {
      const params = createSwapParams({ user: '' })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('User')
    })

    it('should fail when swapping same token', async () => {
      const token = createTestToken('SOL')
      const params = createSwapParams({
        inputToken: token,
        outputToken: token,
      })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot swap')
    })

    it('should fail with negative min output', async () => {
      const params = createSwapParams({ minOutputAmount: BigInt(-1) })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Min output')
    })

    it('should fail with invalid slippage', async () => {
      const params = createSwapParams({ slippageBps: 15000 })

      const result = await swap.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Slippage')
    })
  })

  // ─── Get Quote Tests ────────────────────────────────────────────────────────────

  describe('getQuote', () => {
    let swap: PrivateSwap

    beforeEach(() => {
      swap = createPrivateSwap()
    })

    it('should return quote', async () => {
      const quote = await swap.getQuote({
        inputToken: createTestToken('SOL'),
        outputToken: createTestToken('USDC', 6),
        inputAmount: BigInt('1000000000'),
      })

      expect(quote).toBeDefined()
      expect(quote.estimatedOutput).toBeGreaterThan(BigInt(0))
    })

    it('should include estimated fees', async () => {
      const quote = await swap.getQuote({
        inputToken: createTestToken('SOL'),
        outputToken: createTestToken('USDC', 6),
        inputAmount: BigInt('1000000000'),
      })

      expect(quote.estimatedFees).toBeGreaterThan(BigInt(0))
    })

    it('should include price impact', async () => {
      const quote = await swap.getQuote({
        inputToken: createTestToken('SOL'),
        outputToken: createTestToken('USDC', 6),
        inputAmount: BigInt('1000000000'),
      })

      expect(quote.priceImpact).toBeDefined()
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0)
    })

    it('should include route', async () => {
      const quote = await swap.getQuote({
        inputToken: createTestToken('SOL'),
        outputToken: createTestToken('USDC', 6),
        inputAmount: BigInt('1000000000'),
      })

      expect(quote.route).toHaveLength(2)
    })
  })

  // ─── Can Swap Tests ─────────────────────────────────────────────────────────────

  describe('canSwap', () => {
    let swap: PrivateSwap

    beforeEach(() => {
      swap = createPrivateSwap()
    })

    it('should return true for valid params', async () => {
      const params = createSwapParams()

      const result = await swap.canSwap(params)

      expect(result.canSwap).toBe(true)
    })

    it('should return false without input token', async () => {
      const params = createSwapParams({ inputToken: {} as CSPLToken })

      const result = await swap.canSwap(params)

      expect(result.canSwap).toBe(false)
      expect(result.reason).toContain('Input token')
    })

    it('should return false without output token', async () => {
      const params = createSwapParams({ outputToken: {} as CSPLToken })

      const result = await swap.canSwap(params)

      expect(result.canSwap).toBe(false)
      expect(result.reason).toContain('Output token')
    })

    it('should return false with zero amount', async () => {
      const params = createSwapParams({ inputAmount: BigInt(0) })

      const result = await swap.canSwap(params)

      expect(result.canSwap).toBe(false)
    })
  })

  // ─── Getter Tests ───────────────────────────────────────────────────────────────

  describe('getters', () => {
    let swap: PrivateSwap

    beforeEach(() => {
      swap = createPrivateSwap()
    })

    it('should get SIP backend name', () => {
      expect(swap.getSIPBackendName()).toBe('sip-native')
    })

    it('should get Arcium backend name', () => {
      expect(swap.getArciumBackendName()).toBe('arcium')
    })

    it('should get default slippage', () => {
      expect(swap.getDefaultSlippageBps()).toBe(50)
    })

    it('should get default deadline', () => {
      expect(swap.getDefaultDeadlineSeconds()).toBe(300)
    })
  })
})

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('Private Swap Integration', () => {
  describe('exports', () => {
    it('should export PrivateSwap from privacy-backends', async () => {
      const { PrivateSwap: ExportedSwap } = await import(
        '../../src/privacy-backends'
      )

      expect(ExportedSwap).toBeDefined()
    })

    it('should export types', async () => {
      const exports = await import('../../src/privacy-backends')

      // Types are exported (we just verify the module loads)
      expect(exports).toBeDefined()
    })
  })

  describe('full privacy swap scenario', () => {
    it('should demonstrate full privacy stack', async () => {
      // Create all components
      const sipBackend = new SIPNativeBackend()
      const arciumBackend = new ArciumBackend()
      const csplClient = new CSPLClient()

      // Create private swap orchestrator
      const swap = new PrivateSwap({
        sipBackend,
        arciumBackend,
        csplClient,
        defaultSlippageBps: 100, // 1% slippage
      })

      // Execute swap with full privacy
      const result = await swap.execute({
        inputToken: createTestToken('SOL', 9),
        outputToken: createTestToken('USDC', 6),
        inputAmount: BigInt('5000000000'), // 5 SOL
        minOutputAmount: BigInt('200000000'), // Min 200 USDC
        user: TEST_ADDRESSES.user, // Institutional trader
        useStealthOutput: true, // Use stealth address for output
      })

      // Verify all privacy components worked
      expect(result.success).toBe(true)
      expect(result.stealthAddress).toBeDefined() // SIP Native stealth
      expect(result.computationId).toBeDefined() // Arcium MPC
      expect(result.steps?.find(s => s.name === 'wrap_input')).toBeDefined() // C-SPL wrap
    })
  })

  describe('comparison scenarios', () => {
    it('should show privacy difference from regular swap', async () => {
      const swap = createPrivateSwap()

      // Private swap
      const privateResult = await swap.execute(createSwapParams({
        useStealthOutput: true,
      }))

      // In a real scenario, private swap would have:
      // - Hidden input amount (C-SPL)
      // - Hidden swap execution (Arcium MPC)
      // - Hidden recipient (stealth address)

      expect(privateResult.success).toBe(true)
      expect(privateResult.stealthAddress).toBeDefined()
      expect(privateResult.computationId).toBeDefined()
    })
  })
})
