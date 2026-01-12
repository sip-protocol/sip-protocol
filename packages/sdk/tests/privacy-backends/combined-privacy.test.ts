/**
 * Combined Privacy Service Tests
 *
 * Tests the SIP Native + Arcium combined privacy flow.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CombinedPrivacyService,
  createCombinedPrivacyServiceDevnet,
  createCombinedPrivacyServiceTestnet,
  createCombinedPrivacyServiceMainnet,
} from '../../src/privacy-backends/combined-privacy'
import type {
  CombinedTransferParams,
} from '../../src/privacy-backends/combined-privacy'

describe('CombinedPrivacyService', () => {
  // Test addresses
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const SOL_MINT = 'So11111111111111111111111111111111111111112'
  const SENDER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  const RECIPIENT_META = 'sip:solana:0x02abc123def456:0x03def789abc012'
  const VIEWING_KEY = '0x04audit123viewer456'

  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new CombinedPrivacyService()
      expect(service).toBeDefined()
    })

    it('should accept custom network', () => {
      const service = new CombinedPrivacyService({ network: 'testnet' })
      const status = service.getStatus()
      expect(status.network).toBe('testnet')
    })

    it('should accept verbose flag', () => {
      const service = new CombinedPrivacyService({ verbose: true })
      expect(service).toBeDefined()
    })
  })

  describe('factory functions', () => {
    it('should create devnet service', () => {
      const service = createCombinedPrivacyServiceDevnet()
      expect(service.getStatus().network).toBe('devnet')
    })

    it('should create testnet service', () => {
      const service = createCombinedPrivacyServiceTestnet()
      expect(service.getStatus().network).toBe('testnet')
    })

    it('should create mainnet service', () => {
      const service = createCombinedPrivacyServiceMainnet()
      expect(service.getStatus().network).toBe('mainnet')
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
      expect(service.getStatus().initialized).toBe(true)
    })

    it('should be idempotent', async () => {
      const service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
      await service.initialize() // Second call should not throw
      expect(service.getStatus().initialized).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return status with backends', () => {
      const service = createCombinedPrivacyServiceDevnet()
      const status = service.getStatus()

      expect(status.initialized).toBe(false)
      expect(status.network).toBe('devnet')
      expect(status.backends.sipNative.name).toBe('sip-native')
      expect(status.backends.sipNative.type).toBe('transaction')
      expect(status.backends.arcium.name).toBe('arcium')
      expect(status.backends.arcium.type).toBe('compute')
    })
  })

  describe('getPrivacyComparison', () => {
    it('should return privacy comparison', () => {
      const service = createCombinedPrivacyServiceDevnet()
      const comparison = service.getPrivacyComparison()

      // SIP Native provides transaction privacy
      expect(comparison.sipNative.hiddenSender).toBe(true)
      expect(comparison.sipNative.hiddenRecipient).toBe(true)
      expect(comparison.sipNative.hiddenAmount).toBe(true)

      // Arcium provides compute privacy
      expect(comparison.arcium.hiddenCompute).toBe(true)
      expect(comparison.arcium.hiddenAmount).toBe(true)

      // Combined provides everything
      expect(comparison.combined.hiddenSender).toBe(true)
      expect(comparison.combined.hiddenRecipient).toBe(true)
      expect(comparison.combined.hiddenAmount).toBe(true)
      expect(comparison.combined.hiddenCompute).toBe(true)
    })
  })

  describe('deriveStealthAddress', () => {
    let service: CombinedPrivacyService

    beforeEach(async () => {
      service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
    })

    it('should derive stealth address from meta-address', async () => {
      const result = await service.deriveStealthAddress(RECIPIENT_META)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.length).toBeGreaterThan(0)
      expect(result.ephemeralPubKey).toBeDefined()
      expect(result.viewTag).toBeDefined()
    })

    it('should generate different addresses for different recipients', async () => {
      const result1 = await service.deriveStealthAddress(RECIPIENT_META)
      const result2 = await service.deriveStealthAddress(
        'sip:solana:0x02xyz789:0x03xyz456'
      )

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
    })

    it('should reject invalid meta-address format', async () => {
      await expect(
        service.deriveStealthAddress('invalid-address')
      ).rejects.toThrow('Invalid SIP meta-address format')
    })

    it('should reject non-Solana chains', async () => {
      await expect(
        service.deriveStealthAddress('sip:ethereum:0x02abc:0x03def')
      ).rejects.toThrow('Combined privacy only supports Solana')
    })
  })

  describe('executePrivateTransfer', () => {
    let service: CombinedPrivacyService

    beforeEach(async () => {
      service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
    })

    it('should execute complete private transfer', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.totalTime).toBeGreaterThan(0)
    })

    it('should wrap SPL to C-SPL', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.wrap).toBeDefined()
      expect(result.wrap?.success).toBe(true)
      expect(result.wrap?.csplMint).toBeDefined()
      expect(result.wrap?.csplAccount).toBeDefined()
      expect(result.wrap?.computationId).toBeDefined()
    })

    it('should generate stealth address', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.stealth).toBeDefined()
      expect(result.stealth?.stealthAddress).toBeDefined()
      expect(result.stealth?.ephemeralPubKey).toBeDefined()
      expect(result.stealth?.viewTag).toBeDefined()
    })

    it('should transfer C-SPL to stealth address', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.transfer).toBeDefined()
      expect(result.transfer?.success).toBe(true)
      expect(result.transfer?.signature).toBeDefined()
    })

    it('should achieve full privacy', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.privacyAchieved.hiddenRecipient).toBe(true)
      expect(result.privacyAchieved.hiddenAmount).toBe(true)
      expect(result.privacyAchieved.hiddenSender).toBe(true)
    })

    it('should support viewing key for compliance', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
        viewingKey: VIEWING_KEY,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.privacyAchieved.complianceSupport).toBe(true)
    })

    it('should not have compliance support without viewing key', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const result = await service.executePrivateTransfer(params)

      expect(result.privacyAchieved.complianceSupport).toBe(false)
    })

    it('should support memo', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
        memo: 'Test memo',
      }

      const result = await service.executePrivateTransfer(params)
      expect(result.success).toBe(true)
    })

    it('should work with SOL', async () => {
      const params: CombinedTransferParams = {
        splMint: SOL_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(100000000), // 0.1 SOL
        decimals: 9,
      }

      const result = await service.executePrivateTransfer(params)
      expect(result.success).toBe(true)
      expect(result.privacyAchieved.hiddenAmount).toBe(true)
    })

    it('should fail if not initialized', async () => {
      const uninitializedService = createCombinedPrivacyServiceDevnet()
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      await expect(
        uninitializedService.executePrivateTransfer(params)
      ).rejects.toThrow('not initialized')
    })
  })

  describe('claimFromStealth', () => {
    let service: CombinedPrivacyService

    beforeEach(async () => {
      service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
    })

    it('should derive stealth private key', async () => {
      const result = await service.claimFromStealth({
        stealthAddress: 'stealth123',
        ephemeralPubKey: 'eph123',
        recipientSpendingKey: '0x02abc',
        recipientViewingKey: '0x03def',
      })

      expect(result.success).toBe(true)
      expect(result.stealthPrivateKey).toBeDefined()
    })

    it('should check balance at stealth address', async () => {
      const result = await service.claimFromStealth({
        stealthAddress: 'stealth123',
        ephemeralPubKey: 'eph123',
        recipientSpendingKey: '0x02abc',
        recipientViewingKey: '0x03def',
      })

      expect(result.success).toBe(true)
      // Balance will be 0 or undefined since we haven't sent anything
    })
  })

  describe('estimateCost', () => {
    let service: CombinedPrivacyService

    beforeEach(async () => {
      service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
    })

    it('should estimate total cost', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const estimate = await service.estimateCost(params)

      expect(estimate.totalCost).toBeGreaterThan(0n)
      expect(estimate.breakdown).toBeDefined()
      expect(estimate.breakdown.wrap).toBeGreaterThan(0n)
      expect(estimate.breakdown.stealth).toBeGreaterThan(0n)
      expect(estimate.breakdown.transfer).toBeGreaterThan(0n)
    })

    it('should have total equal to sum of breakdown', async () => {
      const params: CombinedTransferParams = {
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      }

      const estimate = await service.estimateCost(params)
      const sum = estimate.breakdown.wrap +
        estimate.breakdown.stealth +
        estimate.breakdown.transfer

      expect(estimate.totalCost).toBe(sum)
    })
  })

  describe('integration', () => {
    let service: CombinedPrivacyService

    beforeEach(async () => {
      service = createCombinedPrivacyServiceDevnet()
      await service.initialize()
    })

    it('should complete full send-receive flow', async () => {
      // Step 1: Sender executes private transfer
      const sendResult = await service.executePrivateTransfer({
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(5000000), // 5 USDC
        decimals: 6,
        viewingKey: VIEWING_KEY,
      })

      expect(sendResult.success).toBe(true)
      expect(sendResult.stealth?.stealthAddress).toBeDefined()
      expect(sendResult.stealth?.ephemeralPubKey).toBeDefined()

      // Step 2: Recipient claims from stealth
      const claimResult = await service.claimFromStealth({
        stealthAddress: sendResult.stealth!.stealthAddress,
        ephemeralPubKey: sendResult.stealth!.ephemeralPubKey,
        recipientSpendingKey: '0x02abc123def456', // From meta-address
        recipientViewingKey: '0x03def789abc012', // From meta-address
        unwrapToSPL: false,
      })

      expect(claimResult.success).toBe(true)
      expect(claimResult.stealthPrivateKey).toBeDefined()
    })

    it('should demonstrate privacy synergy', async () => {
      const comparison = service.getPrivacyComparison()

      // Neither backend alone provides complete privacy:
      // - SIP Native: transaction privacy but no compute privacy
      // - Arcium: compute privacy but no recipient privacy

      // Combined provides BOTH:
      expect(comparison.combined.hiddenSender).toBe(true)
      expect(comparison.combined.hiddenRecipient).toBe(true)
      expect(comparison.combined.hiddenAmount).toBe(true)
      expect(comparison.combined.hiddenCompute).toBe(true)

      // This is the value proposition of SIP as Privacy Aggregator
    })

    it('should handle multiple transfers with different tokens', async () => {
      // Transfer 1: USDC
      const result1 = await service.executePrivateTransfer({
        splMint: USDC_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(1000000),
        decimals: 6,
      })

      // Transfer 2: SOL
      const result2 = await service.executePrivateTransfer({
        splMint: SOL_MINT,
        sender: SENDER,
        recipientMetaAddress: RECIPIENT_META,
        amount: BigInt(100000000),
        decimals: 9,
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.wrap?.csplMint).not.toBe(result2.wrap?.csplMint)
    })
  })
})
