/**
 * C-SPL Token Service Tests
 *
 * Tests for the CSPLTokenService covering wrap, unwrap, transfer, and balance operations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CSPLTokenService,
  createCSPLServiceDevnet,
  createCSPLServiceTestnet,
  createCSPLServiceMainnet,
} from '../../src/privacy-backends/cspl-token'
import { CSPL_TOKEN_REGISTRY } from '../../src/privacy-backends/arcium-types'

// ─── Test Constants ──────────────────────────────────────────────────────────

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const UNKNOWN_MINT = 'Unknown1111111111111111111111111111111111'

const TEST_OWNER = 'owner-address-123456789012345678901234567890'
const TEST_RECIPIENT = 'recipient-address-1234567890123456789012345'
const TEST_DELEGATE = 'delegate-program-123456789012345678901234'

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('CSPLTokenService', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new CSPLTokenService()

      expect(service).toBeDefined()
      expect(service.isInitialized).toBe(false)
    })

    it('should use devnet by default', () => {
      const service = new CSPLTokenService()

      expect(service.getNetwork()).toBe('devnet')
    })

    it('should accept custom network', () => {
      const service = new CSPLTokenService({ network: 'testnet' })

      expect(service.getNetwork()).toBe('testnet')
    })

    it('should accept verbose flag', () => {
      const service = new CSPLTokenService({ verbose: true })

      // Verbose is internal, just verify construction works
      expect(service).toBeDefined()
    })
  })

  // ─── Factory Functions ─────────────────────────────────────────────────────

  describe('factory functions', () => {
    it('should create devnet service', () => {
      const service = createCSPLServiceDevnet()

      expect(service.getNetwork()).toBe('devnet')
    })

    it('should create testnet service', () => {
      const service = createCSPLServiceTestnet()

      expect(service.getNetwork()).toBe('testnet')
    })

    it('should create mainnet service', () => {
      const service = createCSPLServiceMainnet()

      expect(service.getNetwork()).toBe('mainnet')
    })
  })

  // ─── Initialization Tests ──────────────────────────────────────────────────

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const service = new CSPLTokenService()

      await service.initialize()

      expect(service.isInitialized).toBe(true)
    })

    it('should be idempotent', async () => {
      const service = new CSPLTokenService()

      await service.initialize()
      await service.initialize()

      expect(service.isInitialized).toBe(true)
    })
  })

  // ─── Token Information Tests ───────────────────────────────────────────────

  describe('token information', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should return supported tokens', () => {
      const tokens = service.getSupportedTokens()

      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens.some(t => t.symbol === 'cUSDC')).toBe(true)
      expect(tokens.some(t => t.symbol === 'cUSDT')).toBe(true)
      expect(tokens.some(t => t.symbol === 'cSOL')).toBe(true)
    })

    it('should check token support', () => {
      expect(service.isSupported(USDC_MINT)).toBe(true)
      expect(service.isSupported(USDT_MINT)).toBe(true)
      expect(service.isSupported(SOL_MINT)).toBe(true)
      expect(service.isSupported(UNKNOWN_MINT)).toBe(false)
    })

    it('should get token info', () => {
      const info = service.getTokenInfo(USDC_MINT)

      expect(info).not.toBeNull()
      expect(info?.symbol).toBe('cUSDC')
      expect(info?.decimals).toBe(6)
    })

    it('should return null for unknown token', () => {
      const info = service.getTokenInfo(UNKNOWN_MINT)

      expect(info).toBeNull()
    })

    it('should derive C-SPL mint', () => {
      const csplMint = service.deriveCSPLMint(USDC_MINT)

      expect(csplMint).toBe(CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint)
    })
  })

  // ─── Wrap Tests ────────────────────────────────────────────────────────────

  describe('wrap', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should wrap supported token', async () => {
      const result = await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.csplMint).toBe(CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint)
      expect(result.amount).toBe(1_000_000n)
    })

    it('should return C-SPL token account', async () => {
      const result = await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.csplTokenAccount).toBeDefined()
    })

    it('should return computation reference', async () => {
      const result = await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.computation).toBeDefined()
      expect(result.computation?.id).toBeDefined()
      expect(result.computation?.clusterId).toBeDefined()
    })

    it('should reject unsupported token', async () => {
      const result = await service.wrap({
        splMint: UNKNOWN_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('does not support')
    })

    it('should reject zero amount', async () => {
      const result = await service.wrap({
        splMint: USDC_MINT,
        amount: 0n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('positive')
    })

    it('should reject negative amount', async () => {
      const result = await service.wrap({
        splMint: USDC_MINT,
        amount: -1n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
    })

    it('should cache token account after wrap', async () => {
      await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      const accounts = await service.getTokenAccounts(TEST_OWNER)

      expect(accounts.length).toBeGreaterThan(0)
    })
  })

  // ─── Unwrap Tests ──────────────────────────────────────────────────────────

  describe('unwrap', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should unwrap known C-SPL token', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.unwrap({
        csplMint,
        amount: 500_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.splMint).toBe(USDC_MINT)
      expect(result.amount).toBe(500_000n)
    })

    it('should support custom recipient', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.unwrap({
        csplMint,
        amount: 500_000n,
        owner: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })

      expect(result.success).toBe(true)
    })

    it('should reject unknown C-SPL token', async () => {
      const result = await service.unwrap({
        csplMint: 'unknown-cspl-mint',
        amount: 500_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown C-SPL token')
    })

    it('should reject zero amount', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.unwrap({
        csplMint,
        amount: 0n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── Transfer Tests ────────────────────────────────────────────────────────

  describe('transfer', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should execute confidential transfer', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.transfer({
        csplMint,
        amount: 100_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.computation).toBeDefined()
    })

    it('should return new sender balance', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.transfer({
        csplMint,
        amount: 100_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })

      expect(result.newSenderBalance).toBeDefined()
      expect(result.newSenderBalance?.csplMint).toBe(csplMint)
    })

    it('should support auditor key', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.transfer({
        csplMint,
        amount: 100_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
        auditorKey: 'auditor-public-key-123',
      })

      expect(result.success).toBe(true)
    })

    it('should support memo', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.transfer({
        csplMint,
        amount: 100_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
        memo: 'Payment for services',
      })

      expect(result.success).toBe(true)
    })

    it('should reject unknown C-SPL token', async () => {
      const result = await service.transfer({
        csplMint: 'unknown-cspl-mint',
        amount: 100_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown C-SPL token')
    })

    it('should reject zero amount', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.transfer({
        csplMint,
        amount: 0n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── Balance Tests ─────────────────────────────────────────────────────────

  describe('getBalance', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should return balance for known token', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const balance = await service.getBalance(csplMint, TEST_OWNER)

      expect(balance).not.toBeNull()
      expect(balance?.csplMint).toBe(csplMint)
      expect(balance?.symbol).toBe('cUSDC')
    })

    it('should return null for unknown token', async () => {
      const balance = await service.getBalance('unknown-cspl-mint', TEST_OWNER)

      expect(balance).toBeNull()
    })

    it('should return cached balance after wrap', async () => {
      // First wrap some tokens
      await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint
      const balance = await service.getBalance(csplMint, TEST_OWNER)

      expect(balance).not.toBeNull()
      expect(balance?.decryptedBalance).toBe(1_000_000n)
    })
  })

  describe('getTokenAccounts', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should return empty array for new owner', async () => {
      const accounts = await service.getTokenAccounts('new-owner')

      expect(accounts).toEqual([])
    })

    it('should return accounts after wrap', async () => {
      await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      const accounts = await service.getTokenAccounts(TEST_OWNER)

      expect(accounts.length).toBe(1)
      expect(accounts[0].owner).toBe(TEST_OWNER)
    })

    it('should return multiple accounts for same owner', async () => {
      await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      await service.wrap({
        splMint: USDT_MINT,
        amount: 500_000n,
        owner: TEST_OWNER,
      })

      const accounts = await service.getTokenAccounts(TEST_OWNER)

      expect(accounts.length).toBe(2)
    })
  })

  // ─── Approval Tests ────────────────────────────────────────────────────────

  describe('approve', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should approve delegate', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.approve({
        csplMint,
        delegate: TEST_DELEGATE,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
    })

    it('should reject unknown C-SPL token', async () => {
      const result = await service.approve({
        csplMint: 'unknown-cspl-mint',
        delegate: TEST_DELEGATE,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('revoke', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should revoke approval', async () => {
      const csplMint = CSPL_TOKEN_REGISTRY[USDC_MINT].csplMint

      const result = await service.revoke(csplMint, TEST_DELEGATE, TEST_OWNER)

      expect(result.success).toBe(true)
    })
  })

  // ─── Cost Estimation Tests ─────────────────────────────────────────────────

  describe('estimateCost', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should estimate wrap cost', () => {
      const cost = service.estimateCost('wrap')

      expect(cost).toBeGreaterThan(0n)
    })

    it('should estimate unwrap cost', () => {
      const cost = service.estimateCost('unwrap')

      expect(cost).toBeGreaterThan(0n)
    })

    it('should estimate transfer cost', () => {
      const cost = service.estimateCost('transfer')

      expect(cost).toBeGreaterThan(0n)
    })

    it('should estimate approve cost', () => {
      const cost = service.estimateCost('approve')

      expect(cost).toBeGreaterThan(0n)
    })

    it('should return higher cost for transfer than approve', () => {
      const transferCost = service.estimateCost('transfer')
      const approveCost = service.estimateCost('approve')

      expect(transferCost).toBeGreaterThan(approveCost)
    })
  })

  // ─── Error Handling Tests ──────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw if not initialized', async () => {
      const service = new CSPLTokenService()

      // wrap should throw
      await expect(
        service.wrap({
          splMint: USDC_MINT,
          amount: 1_000_000n,
          owner: TEST_OWNER,
        })
      ).rejects.toThrow('not initialized')
    })
  })

  // ─── Integration Tests ─────────────────────────────────────────────────────

  describe('integration', () => {
    let service: CSPLTokenService

    beforeEach(async () => {
      service = new CSPLTokenService()
      await service.initialize()
    })

    it('should complete full wrap → transfer → unwrap flow', async () => {
      // 1. Wrap SPL to C-SPL
      const wrapResult = await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })
      expect(wrapResult.success).toBe(true)

      // 2. Transfer confidentially
      const transferResult = await service.transfer({
        csplMint: wrapResult.csplMint!,
        amount: 500_000n,
        sender: TEST_OWNER,
        recipient: TEST_RECIPIENT,
      })
      expect(transferResult.success).toBe(true)

      // 3. Unwrap back to SPL
      const unwrapResult = await service.unwrap({
        csplMint: wrapResult.csplMint!,
        amount: 250_000n,
        owner: TEST_OWNER,
      })
      expect(unwrapResult.success).toBe(true)
    })

    it('should handle multiple tokens', async () => {
      // Wrap USDC
      const usdcWrap = await service.wrap({
        splMint: USDC_MINT,
        amount: 1_000_000n,
        owner: TEST_OWNER,
      })
      expect(usdcWrap.success).toBe(true)

      // Wrap USDT
      const usdtWrap = await service.wrap({
        splMint: USDT_MINT,
        amount: 2_000_000n,
        owner: TEST_OWNER,
      })
      expect(usdtWrap.success).toBe(true)

      // Verify both accounts exist
      const accounts = await service.getTokenAccounts(TEST_OWNER)
      expect(accounts.length).toBe(2)
    })
  })
})
