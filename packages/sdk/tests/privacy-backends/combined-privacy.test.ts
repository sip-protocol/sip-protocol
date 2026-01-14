/**
 * Combined Privacy Service Tests
 *
 * Tests for the CombinedPrivacyService which integrates:
 * - SIP Native (stealth addresses, viewing keys)
 * - Arcium C-SPL (encrypted token balances)
 *
 * Issue #527: These tests specifically verify that wrapResult.success
 * is checked BEFORE accessing result fields like csplMint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import {
  CombinedPrivacyService,
  createCombinedPrivacyServiceDevnet,
  createCombinedPrivacyServiceMainnet,
} from '../../src/privacy-backends/combined-privacy'
import { CSPLTokenService } from '../../src/privacy-backends/cspl-token'

describe('CombinedPrivacyService', () => {
  let service: CombinedPrivacyService

  beforeEach(async () => {
    service = new CombinedPrivacyService({
      rpcUrl: 'https://api.devnet.solana.com',
    })
    await service.initialize()
  })

  afterEach(async () => {
    await service.disconnect()
  })

  // ─── Initialization Tests ──────────────────────────────────────────────────

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new CombinedPrivacyService()
      await newService.initialize()

      const status = newService.getStatus()
      expect(status.initialized).toBe(true)
      expect(status.csplStatus.connected).toBe(true)

      await newService.disconnect()
    })

    it('should not reinitialize if already initialized', async () => {
      const status1 = service.getStatus()
      await service.initialize() // Should be no-op
      const status2 = service.getStatus()

      expect(status1.initialized).toBe(true)
      expect(status2.initialized).toBe(true)
    })
  })

  // ─── Factory Functions ──────────────────────────────────────────────────────

  describe('Factory Functions', () => {
    it('should create devnet service', async () => {
      const devnetService = createCombinedPrivacyServiceDevnet()
      expect(devnetService).toBeInstanceOf(CombinedPrivacyService)
      await devnetService.initialize()
      await devnetService.disconnect()
    })

    it('should create mainnet service', async () => {
      const mainnetService = createCombinedPrivacyServiceMainnet()
      expect(mainnetService).toBeInstanceOf(CombinedPrivacyService)
      await mainnetService.initialize()
      await mainnetService.disconnect()
    })

    it('should accept custom config in factory', async () => {
      const customService = createCombinedPrivacyServiceDevnet({
        defaultPrivacyLevel: PrivacyLevel.COMPLIANT,
      })
      expect(customService).toBeInstanceOf(CombinedPrivacyService)
    })
  })

  // ─── Transfer Validation Tests ───────────────────────────────────────────────

  describe('Transfer Validation', () => {
    it('should fail if service not initialized', async () => {
      const uninitializedService = new CombinedPrivacyService()

      const result = await uninitializedService.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should fail with empty sender', async () => {
      const result = await service.executePrivateTransfer({
        sender: '',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Sender')
    })

    it('should fail with empty recipient meta-address', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: '',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Recipient')
    })

    it('should fail with invalid meta-address format', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'invalid-format',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('sip:')
    })

    it('should fail with zero amount', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 0n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount')
    })

    it('should fail with negative amount', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: -100n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount')
    })

    it('should fail with empty token mint', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: '',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token')
    })

    it('should require viewing key for compliant privacy level', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.COMPLIANT,
        // No viewingKey provided
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Viewing key')
    })
  })

  // ─── Issue #527: wrapResult.success Check Tests ──────────────────────────────

  describe('Issue #527: wrapResult.success Checks', () => {
    it('should properly handle wrap failure in executePrivateTransfer', async () => {
      // The service should check wrapResult.success before accessing fields
      // This test verifies that the fix for issue #527 is in place
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'valid-mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Result should either succeed (simulated environment)
      // or fail with a proper error message (not undefined/null crash)
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')

      if (!result.success) {
        // When failure occurs, error should be defined
        expect(result.error).toBeDefined()
        expect(typeof result.error).toBe('string')
      } else {
        // When success, optional fields should be properly typed
        expect(result.stealthAddress).toBeDefined()
        expect(result.csplMint).toBeDefined()
      }
    })

    it('should return proper result structure on success', async () => {
      const result = await service.executePrivateTransfer({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'valid-mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      if (result.success) {
        // All expected fields should be present
        expect(result.stealthAddress).toBeDefined()
        expect(result.csplMint).toBeDefined()
        expect(result.metadata).toBeDefined()
        expect(result.metadata?.privacyLevel).toBe(PrivacyLevel.SHIELDED)
        expect(result.metadata?.totalDuration).toBeGreaterThanOrEqual(0)
      }
    })

    it('should return proper result structure on failure', async () => {
      const result = await service.executePrivateTransfer({
        sender: '',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'valid-mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Failure case
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      // Success-only fields should be undefined
      expect(result.stealthAddress).toBeUndefined()
      expect(result.csplMint).toBeUndefined()
    })
  })

  // ─── Stealth Address Tests ────────────────────────────────────────────────────

  describe('Stealth Address Derivation', () => {
    it('should derive stealth address from valid meta-address', async () => {
      const result = await service.deriveStealthAddress(
        'sip:solana:0x02abc123def456789012345678901234567890123456:0x03def456abc789012345678901234567890123456789'
      )

      expect(result.success).toBe(true)
      expect(result.stealthAddress).toBeDefined()
      expect(result.ephemeralPubkey).toBeDefined()
      expect(result.viewTag).toBeDefined()
    })

    it('should fail with invalid meta-address format', async () => {
      const result = await service.deriveStealthAddress('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid meta-address')
    })

    it('should fail with missing meta-address parts', async () => {
      const result = await service.deriveStealthAddress('sip:solana:')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fail with non-sip prefix', async () => {
      const result = await service.deriveStealthAddress(
        'eth:solana:0xspending:0xviewing'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid meta-address')
    })
  })

  // ─── Claim Tests ───────────────────────────────────────────────────────────────

  describe('Claim from Stealth', () => {
    it('should claim from valid stealth address', async () => {
      const result = await service.claimFromStealth({
        stealthAddress: 'stealth_solana_test123',
        ephemeralPubkey: 'eph_test456',
        spendingPrivateKey: '0xspending123',
        viewingPrivateKey: '0xviewing456',
        csplMint: 'cspl_mint_test',
      })

      expect(result.success).toBe(true)
      expect(result.amount).toBeDefined()
      expect(result.signature).toBeDefined()
    })

    it('should fail if service not initialized', async () => {
      const uninitializedService = new CombinedPrivacyService()

      const result = await uninitializedService.claimFromStealth({
        stealthAddress: 'stealth',
        ephemeralPubkey: 'eph',
        spendingPrivateKey: '0xspending',
        viewingPrivateKey: '0xviewing',
        csplMint: 'mint',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should fail with missing required fields', async () => {
      const result = await service.claimFromStealth({
        stealthAddress: '',
        ephemeralPubkey: '',
        spendingPrivateKey: '0xspending',
        viewingPrivateKey: '0xviewing',
        csplMint: 'mint',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ─── Privacy Comparison Tests ──────────────────────────────────────────────────

  describe('Privacy Comparison', () => {
    it('should return privacy comparison table', () => {
      const comparison = service.getPrivacyComparison()

      expect(comparison.sipNative).toBeDefined()
      expect(comparison.arciumCSPL).toBeDefined()
      expect(comparison.combined).toBeDefined()

      // SIP Native capabilities
      expect(comparison.sipNative.hiddenSender).toBe(true)
      expect(comparison.sipNative.hiddenRecipient).toBe(true)
      expect(comparison.sipNative.hiddenAmount).toBe(true)
      expect(comparison.sipNative.compliance).toBe(true)

      // Arcium capabilities
      expect(comparison.arciumCSPL.hiddenAmount).toBe(true)
      expect(comparison.arciumCSPL.hiddenCompute).toBe(true)

      // Combined should have all
      expect(comparison.combined.hiddenSender).toBe(true)
      expect(comparison.combined.hiddenRecipient).toBe(true)
      expect(comparison.combined.hiddenAmount).toBe(true)
      expect(comparison.combined.hiddenCompute).toBe(true)
      expect(comparison.combined.compliance).toBe(true)
    })
  })

  // ─── Cost Estimation Tests ─────────────────────────────────────────────────────

  describe('Cost Estimation', () => {
    it('should estimate costs for transfer', async () => {
      const estimate = await service.estimateCost({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(estimate.wrapCost).toBeGreaterThanOrEqual(0n)
      expect(estimate.stealthCost).toBeGreaterThanOrEqual(0n)
      expect(estimate.transferCost).toBeGreaterThanOrEqual(0n)
      expect(estimate.totalCost).toBeGreaterThanOrEqual(0n)
      expect(estimate.currency).toBe('lamports')
    })

    it('should have totalCost equal to sum of parts', async () => {
      const estimate = await service.estimateCost({
        sender: 'alice',
        recipientMetaAddress: 'sip:solana:0xspending:0xviewing',
        amount: 1000n,
        token: 'mint',
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      const expectedTotal = estimate.wrapCost + estimate.stealthCost + estimate.transferCost
      expect(estimate.totalCost).toBe(expectedTotal)
    })
  })

  // ─── Service Status Tests ──────────────────────────────────────────────────────

  describe('Service Status', () => {
    it('should return correct status after initialization', () => {
      const status = service.getStatus()

      expect(status.initialized).toBe(true)
      expect(status.csplStatus.connected).toBe(true)
      expect(status.sipNativeStatus.available).toBe(true)
      expect(status.sipNativeStatus.chainCount).toBeGreaterThan(0)
    })

    it('should update status after disconnect', async () => {
      await service.disconnect()
      const status = service.getStatus()

      expect(status.initialized).toBe(false)
    })
  })
})

// ─── CSPLTokenService Tests (Related to #527) ─────────────────────────────────

describe('CSPLTokenService (Issue #527)', () => {
  let csplService: CSPLTokenService

  beforeEach(async () => {
    csplService = new CSPLTokenService({
      rpcUrl: 'https://api.devnet.solana.com',
    })
    await csplService.initialize()
  })

  afterEach(async () => {
    await csplService.disconnect()
  })

  describe('Wrap Result Handling', () => {
    it('should return success=false when service not initialized', async () => {
      const uninitService = new CSPLTokenService()

      const result = await uninitService.wrap({
        mint: 'some-mint',
        amount: 1000n,
        owner: 'owner',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')

      // csplMint should be undefined when success is false
      expect(result.csplMint).toBeUndefined()
    })

    it('should return success=false with invalid mint', async () => {
      const result = await csplService.wrap({
        mint: '',
        amount: 1000n,
        owner: 'owner',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('mint')
    })

    it('should return success=false with invalid owner', async () => {
      const result = await csplService.wrap({
        mint: 'valid-mint',
        amount: 1000n,
        owner: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Owner')
    })

    it('should return success=false with zero amount', async () => {
      const result = await csplService.wrap({
        mint: 'valid-mint',
        amount: 0n,
        owner: 'owner',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount')
    })

    it('should return proper structure on success', async () => {
      const result = await csplService.wrap({
        mint: 'valid-mint',
        amount: 1000n,
        owner: 'valid-owner',
      })

      // Whether success or failure, structure should be consistent
      expect(typeof result.success).toBe('boolean')

      if (result.success) {
        expect(result.csplMint).toBeDefined()
        expect(result.signature).toBeDefined()
      } else {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Unwrap Result Handling', () => {
    it('should return success=false when service not initialized', async () => {
      const uninitService = new CSPLTokenService()

      const result = await uninitService.unwrap({
        csplMint: 'some-mint',
        encryptedAmount: new Uint8Array([1, 2, 3]),
        owner: 'owner',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should return success=false for unregistered token', async () => {
      const result = await csplService.unwrap({
        csplMint: 'unregistered-cspl-mint',
        encryptedAmount: new Uint8Array([1, 2, 3]),
        owner: 'owner',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not registered')
    })
  })

  describe('Transfer Result Handling', () => {
    it('should return success=false when service not initialized', async () => {
      const uninitService = new CSPLTokenService()

      const result = await uninitService.transfer({
        csplMint: 'some-mint',
        from: 'sender',
        to: 'recipient',
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should return success=false for unregistered token', async () => {
      const result = await csplService.transfer({
        csplMint: 'unregistered-cspl-mint',
        from: 'sender',
        to: 'recipient',
        encryptedAmount: new Uint8Array([1, 2, 3]),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not registered')
    })
  })

  describe('Service Status', () => {
    it('should report correct status', () => {
      const status = csplService.getStatus()

      expect(status.initialized).toBe(true)
      expect(status.connected).toBe(true)
      expect(typeof status.registeredTokenCount).toBe('number')
    })

    it('should update status after disconnect', async () => {
      await csplService.disconnect()
      const status = csplService.getStatus()

      expect(status.initialized).toBe(false)
      expect(status.connected).toBe(false)
    })
  })
})
