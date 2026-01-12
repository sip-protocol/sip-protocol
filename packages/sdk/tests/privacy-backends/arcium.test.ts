/**
 * Arcium Privacy Backend Tests
 *
 * Tests for the Arcium MPC privacy backend and C-SPL token support.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ArciumBackend,
  createArciumDevnetBackend,
  createArciumTestnetBackend,
  createArciumMainnetBackend,
  // Types
  ARCIUM_RPC_ENDPOINTS,
  ARCIUM_PROGRAM_IDS,
  CSPL_TOKEN_REGISTRY,
  hasCSPLSupport,
  getCSPLToken,
  deriveCSPLMint,
  estimateArciumCost,
  ArciumError,
  ArciumErrorCode,
} from '../../src/privacy-backends/arcium'
import type { TransferParams } from '../../src/privacy-backends/interface'

// ─── Test Helpers ────────────────────────────────────────────────────────────

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const UNKNOWN_MINT = 'Unknown1111111111111111111111111111111111'

function createTransferParams(overrides: Partial<TransferParams> = {}): TransferParams {
  return {
    chain: 'solana',
    sender: 'sender-address-123',
    recipient: 'recipient-address-456',
    mint: USDC_MINT,
    amount: BigInt(1_000_000), // 1 USDC
    decimals: 6,
    ...overrides,
  }
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('ArciumBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new ArciumBackend()

      expect(backend).toBeDefined()
      expect(backend.name).toBe('arcium')
      expect(backend.type).toBe('compute')
    })

    it('should use devnet by default', () => {
      const backend = new ArciumBackend()

      expect(backend.getNetwork()).toBe('devnet')
    })

    it('should accept custom network', () => {
      const backend = new ArciumBackend({ network: 'testnet' })

      expect(backend.getNetwork()).toBe('testnet')
    })

    it('should accept custom RPC URL', () => {
      const customUrl = 'https://my-arcium-rpc.example.com'
      const backend = new ArciumBackend({ rpcUrl: customUrl })
      const config = backend.getConfig()

      expect(config.rpcUrl).toBe(customUrl)
    })

    it('should only support Solana chain', () => {
      const backend = new ArciumBackend()

      expect(backend.chains).toEqual(['solana'])
    })

    it('should accept verbose flag', () => {
      const backend = new ArciumBackend({ verbose: true })
      const config = backend.getConfig()

      expect(config.verbose).toBe(true)
    })

    it('should accept computation timeout', () => {
      const backend = new ArciumBackend({ computationTimeout: 120000 })
      const config = backend.getConfig()

      expect(config.computationTimeout).toBe(120000)
    })
  })

  // ─── Factory Functions ─────────────────────────────────────────────────────

  describe('factory functions', () => {
    it('should create devnet backend', () => {
      const backend = createArciumDevnetBackend()

      expect(backend.getNetwork()).toBe('devnet')
    })

    it('should create testnet backend', () => {
      const backend = createArciumTestnetBackend()

      expect(backend.getNetwork()).toBe('testnet')
    })

    it('should create mainnet backend', () => {
      const backend = createArciumMainnetBackend()

      expect(backend.getNetwork()).toBe('mainnet')
    })

    it('should merge config with factory', () => {
      const backend = createArciumDevnetBackend({ verbose: true })
      const config = backend.getConfig()

      expect(config.network).toBe('devnet')
      expect(config.verbose).toBe(true)
    })
  })

  // ─── Initialization Tests ──────────────────────────────────────────────────

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const backend = new ArciumBackend()

      await backend.initialize()

      expect(backend.isInitialized).toBe(true)
    })

    it('should be idempotent', async () => {
      const backend = new ArciumBackend()

      await backend.initialize()
      await backend.initialize()

      expect(backend.isInitialized).toBe(true)
    })
  })

  // ─── Capabilities Tests ────────────────────────────────────────────────────

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenAmount).toBe(true)
      expect(caps.hiddenSender).toBe(false)
      expect(caps.hiddenRecipient).toBe(false)
      expect(caps.hiddenCompute).toBe(true)
      expect(caps.complianceSupport).toBe(true)
    })

    it('should indicate compute backend type', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      expect(caps.hiddenCompute).toBe(true)
      expect(caps.latencyEstimate).toBe('medium')
    })

    it('should support SPL tokens', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      expect(caps.supportedTokens).toBe('spl')
    })
  })

  // ─── Availability Tests ────────────────────────────────────────────────────

  describe('checkAvailability', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should be available for Solana with supported token', async () => {
      const params = createTransferParams()
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
      expect(result.estimatedCost).toBeDefined()
      expect(result.estimatedTime).toBeDefined()
    })

    it('should reject non-Solana chains', async () => {
      const params = createTransferParams({ chain: 'ethereum' })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('not supported')
    })

    it('should reject unsupported tokens', async () => {
      const params = createTransferParams({ mint: UNKNOWN_MINT })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('does not have C-SPL support')
    })

    it('should support USDC', async () => {
      const params = createTransferParams({ mint: USDC_MINT })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should support USDT', async () => {
      const params = createTransferParams({ mint: USDT_MINT })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should support wrapped SOL', async () => {
      const params = createTransferParams({ mint: SOL_MINT })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(true)
    })

    it('should reject zero amount', async () => {
      const params = createTransferParams({ amount: 0n })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('positive')
    })

    it('should reject negative amount', async () => {
      const params = createTransferParams({ amount: -1n })
      const result = await backend.checkAvailability(params)

      expect(result.available).toBe(false)
    })
  })

  // ─── Execute Tests ─────────────────────────────────────────────────────────

  describe('execute', () => {
    let backend: ArciumBackend

    beforeEach(async () => {
      backend = new ArciumBackend()
      await backend.initialize()
    })

    it('should execute transfer successfully', async () => {
      const params = createTransferParams()
      const result = await backend.execute(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.backend).toBe('arcium')
    })

    it('should include metadata in result', async () => {
      const params = createTransferParams()
      const result = await backend.execute(params)

      expect(result.metadata).toBeDefined()
      expect(result.metadata?.chain).toBe('solana')
      expect(result.metadata?.csplToken).toBe('cUSDC')
      expect(result.metadata?.timestamp).toBeDefined()
    })

    it('should fail for unsupported chain', async () => {
      const params = createTransferParams({ chain: 'ethereum' })
      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('should fail for unsupported token', async () => {
      const params = createTransferParams({ mint: UNKNOWN_MINT })
      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('C-SPL support')
    })
  })

  // ─── Cost Estimation Tests ─────────────────────────────────────────────────

  describe('estimateCost', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should estimate transfer cost', async () => {
      const params = createTransferParams()
      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(0n)
    })

    it('should estimate higher cost for swaps', async () => {
      const transferParams = createTransferParams()
      const swapParams = createTransferParams({ options: { isSwap: true } })

      const transferCost = await backend.estimateCost(transferParams)
      const swapCost = await backend.estimateCost(swapParams)

      expect(swapCost).toBeGreaterThan(transferCost)
    })
  })

  // ─── Wrap/Unwrap Tests ─────────────────────────────────────────────────────

  describe('wrapToCSPL', () => {
    let backend: ArciumBackend

    beforeEach(async () => {
      backend = new ArciumBackend()
      await backend.initialize()
    })

    it('should wrap supported token', async () => {
      const result = await backend.wrapToCSPL(USDC_MINT, 1_000_000n, 'owner-address')

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
    })

    it('should reject unsupported token', async () => {
      const result = await backend.wrapToCSPL(UNKNOWN_MINT, 1_000_000n, 'owner-address')

      expect(result.success).toBe(false)
      expect(result.error).toContain('does not support')
    })
  })

  describe('unwrapFromCSPL', () => {
    let backend: ArciumBackend

    beforeEach(async () => {
      backend = new ArciumBackend()
      await backend.initialize()
    })

    it('should unwrap known C-SPL token', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint
      const result = await backend.unwrapFromCSPL(csplMint, 1_000_000n, 'owner-address')

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
    })

    it('should reject unknown C-SPL token', async () => {
      const result = await backend.unwrapFromCSPL('unknown-cspl-mint', 1_000_000n, 'owner-address')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown C-SPL token')
    })
  })

  // ─── Token Support Tests ───────────────────────────────────────────────────

  describe('token support', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should return supported C-SPL tokens', () => {
      const tokens = backend.getSupportedCSPLTokens()

      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens.some(t => t.symbol === 'cUSDC')).toBe(true)
      expect(tokens.some(t => t.symbol === 'cUSDT')).toBe(true)
      expect(tokens.some(t => t.symbol === 'cSOL')).toBe(true)
    })

    it('should check token support correctly', () => {
      expect(backend.isTokenSupported(USDC_MINT)).toBe(true)
      expect(backend.isTokenSupported(USDT_MINT)).toBe(true)
      expect(backend.isTokenSupported(SOL_MINT)).toBe(true)
      expect(backend.isTokenSupported(UNKNOWN_MINT)).toBe(false)
    })
  })
})

// ─── Type Utility Tests ──────────────────────────────────────────────────────

describe('Arcium Types', () => {
  describe('ARCIUM_RPC_ENDPOINTS', () => {
    it('should have endpoints for all networks', () => {
      expect(ARCIUM_RPC_ENDPOINTS.devnet).toBeDefined()
      expect(ARCIUM_RPC_ENDPOINTS.testnet).toBeDefined()
      expect(ARCIUM_RPC_ENDPOINTS.mainnet).toBeDefined()
    })

    it('should use HTTPS for all endpoints', () => {
      expect(ARCIUM_RPC_ENDPOINTS.devnet).toMatch(/^https:\/\//)
      expect(ARCIUM_RPC_ENDPOINTS.testnet).toMatch(/^https:\/\//)
      expect(ARCIUM_RPC_ENDPOINTS.mainnet).toMatch(/^https:\/\//)
    })
  })

  describe('ARCIUM_PROGRAM_IDS', () => {
    it('should have all program IDs', () => {
      expect(ARCIUM_PROGRAM_IDS.ARCIUM_PROGRAM).toBeDefined()
      expect(ARCIUM_PROGRAM_IDS.CSPL_TOKEN_PROGRAM).toBeDefined()
      expect(ARCIUM_PROGRAM_IDS.AUDITOR_PROGRAM).toBeDefined()
    })
  })

  describe('CSPL_TOKEN_REGISTRY', () => {
    it('should have entries for supported tokens', () => {
      expect(CSPL_TOKEN_REGISTRY[USDC_MINT]).toBeDefined()
      expect(CSPL_TOKEN_REGISTRY[USDT_MINT]).toBeDefined()
      expect(CSPL_TOKEN_REGISTRY[SOL_MINT]).toBeDefined()
    })

    it('should have correct structure for each token', () => {
      const usdc = CSPL_TOKEN_REGISTRY[USDC_MINT]

      expect(usdc.splMint).toBe(USDC_MINT)
      expect(usdc.csplMint).toBeDefined()
      expect(usdc.symbol).toBe('cUSDC')
      expect(usdc.decimals).toBe(6)
      expect(usdc.wrapEnabled).toBe(true)
    })
  })

  describe('hasCSPLSupport', () => {
    it('should return true for supported tokens', () => {
      expect(hasCSPLSupport(USDC_MINT)).toBe(true)
      expect(hasCSPLSupport(USDT_MINT)).toBe(true)
      expect(hasCSPLSupport(SOL_MINT)).toBe(true)
    })

    it('should return false for unsupported tokens', () => {
      expect(hasCSPLSupport(UNKNOWN_MINT)).toBe(false)
      expect(hasCSPLSupport('')).toBe(false)
    })
  })

  describe('getCSPLToken', () => {
    it('should return token info for supported tokens', () => {
      const token = getCSPLToken(USDC_MINT)

      expect(token).not.toBeNull()
      expect(token?.symbol).toBe('cUSDC')
    })

    it('should return null for unsupported tokens', () => {
      const token = getCSPLToken(UNKNOWN_MINT)

      expect(token).toBeNull()
    })
  })

  describe('deriveCSPLMint', () => {
    it('should return registered mint for known tokens', () => {
      const csplMint = deriveCSPLMint(USDC_MINT)

      expect(csplMint).toBe(CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint)
    })

    it('should derive mint for unknown tokens', () => {
      const csplMint = deriveCSPLMint(UNKNOWN_MINT)

      expect(csplMint).toContain('cSPL_')
    })
  })

  describe('estimateArciumCost', () => {
    it('should estimate transfer cost', () => {
      const cost = estimateArciumCost('transfer')

      expect(cost).toBeGreaterThan(0n)
    })

    it('should estimate swap cost higher than transfer', () => {
      const transferCost = estimateArciumCost('transfer')
      const swapCost = estimateArciumCost('swap')

      expect(swapCost).toBeGreaterThan(transferCost)
    })

    it('should estimate wrap/unwrap costs', () => {
      const wrapCost = estimateArciumCost('wrap')
      const unwrapCost = estimateArciumCost('unwrap')

      expect(wrapCost).toBeGreaterThan(0n)
      expect(unwrapCost).toBeGreaterThan(0n)
    })
  })
})

// ─── Error Tests ─────────────────────────────────────────────────────────────

describe('ArciumError', () => {
  it('should create error with code', () => {
    const error = new ArciumError('Test error', ArciumErrorCode.NETWORK_ERROR)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe(ArciumErrorCode.NETWORK_ERROR)
    expect(error.name).toBe('ArciumError')
  })

  it('should include details', () => {
    const error = new ArciumError(
      'Test error',
      ArciumErrorCode.UNSUPPORTED_TOKEN,
      { mint: UNKNOWN_MINT }
    )

    expect(error.details).toEqual({ mint: UNKNOWN_MINT })
  })

  it('should have all error codes', () => {
    expect(ArciumErrorCode.NETWORK_ERROR).toBeDefined()
    expect(ArciumErrorCode.UNSUPPORTED_TOKEN).toBeDefined()
    expect(ArciumErrorCode.INSUFFICIENT_BALANCE).toBeDefined()
    expect(ArciumErrorCode.COMPUTATION_FAILED).toBeDefined()
    expect(ArciumErrorCode.COMPUTATION_TIMEOUT).toBeDefined()
    expect(ArciumErrorCode.INVALID_PARAMS).toBeDefined()
    expect(ArciumErrorCode.WRAP_FAILED).toBeDefined()
    expect(ArciumErrorCode.SWAP_FAILED).toBeDefined()
    expect(ArciumErrorCode.AUDITOR_ERROR).toBeDefined()
  })
})
