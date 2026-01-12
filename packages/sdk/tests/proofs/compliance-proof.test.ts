/**
 * Compliance Proof Tests
 *
 * Tests for generating ZK proofs for regulatory compliance.
 * This is the "Non-Financial ZK Use Case" for the Aztec/Noir bounty.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ComplianceProofProvider,
  DEFAULT_VALIDITY_PERIOD_SECONDS,
  SUPPORTED_JURISDICTIONS,
  COMPLIANCE_CIRCUIT_IDS,
  type ViewingKeyAccessParams,
  type SanctionsClearParams,
  type BalanceAttestationParams,
  type HistoryCompletenessParams,
} from '../../src/proofs/compliance-proof'
import type { ViewingKey } from '@sip-protocol/types'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockViewingKey(): ViewingKey {
  return {
    viewingKeyPublic: `0x${'ab'.repeat(32)}`,
    viewingKeyPrivate: `0x${'cd'.repeat(32)}`,
    createdAt: Date.now(),
    canDecrypt: true,
  } as unknown as ViewingKey
}

function createViewingKeyAccessParams(): ViewingKeyAccessParams {
  return {
    viewingKey: createMockViewingKey(),
    transactionHash: `0x${'12'.repeat(32)}`,
    encryptedData: new Uint8Array(64).fill(0xaa),
    auditorPublicKey: `0x${'34'.repeat(32)}`,
    timestamp: Math.floor(Date.now() / 1000),
  }
}

function createSanctionsClearParams(): SanctionsClearParams {
  return {
    senderAddress: `0x${'56'.repeat(20)}`,
    recipientAddress: `0x${'78'.repeat(20)}`,
    senderBlinding: new Uint8Array(32).fill(0x11),
    recipientBlinding: new Uint8Array(32).fill(0x22),
    sanctionsListRoot: `0x${'9a'.repeat(32)}`,
    checkTimestamp: Math.floor(Date.now() / 1000),
    jurisdiction: 'US',
  }
}

function createBalanceAttestationParams(): BalanceAttestationParams {
  return {
    balance: BigInt('1000000000000'),
    blindingFactor: new Uint8Array(32).fill(0x33),
    minimumRequired: BigInt('500000000000'),
    assetId: `0x${'bc'.repeat(32)}`,
    accountCommitment: `0x${'de'.repeat(32)}`,
    attestationTime: Math.floor(Date.now() / 1000),
  }
}

function createHistoryCompletenessParams(): HistoryCompletenessParams {
  return {
    transactionCount: 42,
    historyMerkleRoot: `0x${'f0'.repeat(32)}`,
    startTimestamp: Math.floor(Date.now() / 1000) - 86400 * 30,
    endTimestamp: Math.floor(Date.now() / 1000),
    volumeCommitment: `0x${'12'.repeat(32)}`,
    viewingKey: createMockViewingKey(),
  }
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('ComplianceProofProvider', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const provider = new ComplianceProofProvider()

      expect(provider).toBeDefined()
      expect(provider.isReady).toBe(false)
    })

    it('should accept custom validity period', () => {
      const provider = new ComplianceProofProvider({
        defaultValidityPeriod: 3600,
      })

      expect(provider).toBeDefined()
    })

    it('should accept verbose flag', () => {
      const provider = new ComplianceProofProvider({
        verbose: true,
      })

      expect(provider).toBeDefined()
    })

    it('should accept custom jurisdictions', () => {
      const provider = new ComplianceProofProvider({
        jurisdictions: ['US', 'EU'],
      })

      expect(provider).toBeDefined()
    })
  })

  // ─── Initialization Tests ──────────────────────────────────────────────────

  describe('initialize', () => {
    let provider: ComplianceProofProvider

    beforeEach(() => {
      provider = new ComplianceProofProvider()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should initialize successfully', async () => {
      await provider.initialize()

      expect(provider.isReady).toBe(true)
    })

    it('should be idempotent', async () => {
      await provider.initialize()
      await provider.initialize()

      expect(provider.isReady).toBe(true)
    })
  })

  // ─── Viewing Key Access Proof Tests ────────────────────────────────────────

  describe('generateViewingKeyAccessProof', () => {
    let provider: ComplianceProofProvider

    beforeEach(async () => {
      provider = new ComplianceProofProvider()
      await provider.initialize()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should generate viewing key access proof', async () => {
      const params = createViewingKeyAccessParams()

      const result = await provider.generateViewingKeyAccessProof(params)

      expect(result).toBeDefined()
      expect(result.complianceType).toBe('viewing_key_access')
      expect(result.proof).toBeDefined()
      expect(result.publicInputs).toBeDefined()
    })

    it('should include transaction hash in public inputs', async () => {
      const params = createViewingKeyAccessParams()

      const result = await provider.generateViewingKeyAccessProof(params)

      const txHashInput = result.publicInputs[0]
      expect(txHashInput).toContain(params.transactionHash.slice(2))
    })

    it('should include auditor hash', async () => {
      const params = createViewingKeyAccessParams()

      const result = await provider.generateViewingKeyAccessProof(params)

      expect(result.auditorHash).toBeDefined()
      expect(result.auditorHash).toHaveLength(64)
    })

    it('should set valid until time', async () => {
      const params = createViewingKeyAccessParams()

      const result = await provider.generateViewingKeyAccessProof(params)

      expect(result.validUntil).toBeGreaterThan(params.timestamp)
      expect(result.validUntil).toBe(params.timestamp + DEFAULT_VALIDITY_PERIOD_SECONDS)
    })

    it('should require viewing key', async () => {
      const params = createViewingKeyAccessParams()
      params.viewingKey = undefined as unknown as ViewingKey

      await expect(provider.generateViewingKeyAccessProof(params)).rejects.toThrow(
        'Viewing key is required'
      )
    })

    it('should require transaction hash', async () => {
      const params = createViewingKeyAccessParams()
      params.transactionHash = ''

      await expect(provider.generateViewingKeyAccessProof(params)).rejects.toThrow(
        'Transaction hash is required'
      )
    })

    it('should require encrypted data', async () => {
      const params = createViewingKeyAccessParams()
      params.encryptedData = new Uint8Array(0)

      await expect(provider.generateViewingKeyAccessProof(params)).rejects.toThrow(
        'Encrypted data is required'
      )
    })

    it('should require auditor public key', async () => {
      const params = createViewingKeyAccessParams()
      params.auditorPublicKey = ''

      await expect(provider.generateViewingKeyAccessProof(params)).rejects.toThrow(
        'Auditor public key is required'
      )
    })
  })

  // ─── Sanctions Clear Proof Tests ───────────────────────────────────────────

  describe('generateSanctionsClearProof', () => {
    let provider: ComplianceProofProvider

    beforeEach(async () => {
      provider = new ComplianceProofProvider()
      await provider.initialize()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should generate sanctions clearance proof', async () => {
      const params = createSanctionsClearParams()

      const result = await provider.generateSanctionsClearProof(params)

      expect(result).toBeDefined()
      expect(result.complianceType).toBe('sanctions_clear')
      expect(result.jurisdiction).toBe('US')
    })

    it('should set correct jurisdiction', async () => {
      const params = createSanctionsClearParams()
      params.jurisdiction = 'EU'

      const result = await provider.generateSanctionsClearProof(params)

      expect(result.jurisdiction).toBe('EU')
    })

    it('should require sender address', async () => {
      const params = createSanctionsClearParams()
      params.senderAddress = ''

      await expect(provider.generateSanctionsClearProof(params)).rejects.toThrow(
        'Sender address is required'
      )
    })

    it('should require recipient address', async () => {
      const params = createSanctionsClearParams()
      params.recipientAddress = ''

      await expect(provider.generateSanctionsClearProof(params)).rejects.toThrow(
        'Recipient address is required'
      )
    })

    it('should require sanctions list root', async () => {
      const params = createSanctionsClearParams()
      params.sanctionsListRoot = ''

      await expect(provider.generateSanctionsClearProof(params)).rejects.toThrow(
        'Sanctions list root is required'
      )
    })

    it('should reject unsupported jurisdiction', async () => {
      const params = createSanctionsClearParams()
      params.jurisdiction = 'INVALID'

      await expect(provider.generateSanctionsClearProof(params)).rejects.toThrow(
        'Unsupported jurisdiction'
      )
    })
  })

  // ─── Balance Attestation Proof Tests ───────────────────────────────────────

  describe('generateBalanceAttestationProof', () => {
    let provider: ComplianceProofProvider

    beforeEach(async () => {
      provider = new ComplianceProofProvider()
      await provider.initialize()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should generate balance attestation proof', async () => {
      const params = createBalanceAttestationParams()

      const result = await provider.generateBalanceAttestationProof(params)

      expect(result).toBeDefined()
      expect(result.complianceType).toBe('balance_attestation')
      expect(result.proof.type).toBe('funding')
    })

    it('should include minimum required in public inputs', async () => {
      const params = createBalanceAttestationParams()

      const result = await provider.generateBalanceAttestationProof(params)

      expect(result.publicInputs).toBeDefined()
      expect(result.publicInputs.length).toBeGreaterThan(0)
    })

    it('should reject negative balance', async () => {
      const params = createBalanceAttestationParams()
      params.balance = BigInt(-1)

      await expect(provider.generateBalanceAttestationProof(params)).rejects.toThrow(
        'Balance cannot be negative'
      )
    })

    it('should reject insufficient balance', async () => {
      const params = createBalanceAttestationParams()
      params.balance = BigInt(100)
      params.minimumRequired = BigInt(1000)

      await expect(provider.generateBalanceAttestationProof(params)).rejects.toThrow(
        'Balance must be at least minimum required'
      )
    })

    it('should require asset ID', async () => {
      const params = createBalanceAttestationParams()
      params.assetId = ''

      await expect(provider.generateBalanceAttestationProof(params)).rejects.toThrow(
        'Asset ID is required'
      )
    })
  })

  // ─── History Completeness Proof Tests ──────────────────────────────────────

  describe('generateHistoryCompletenessProof', () => {
    let provider: ComplianceProofProvider

    beforeEach(async () => {
      provider = new ComplianceProofProvider()
      await provider.initialize()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should generate history completeness proof', async () => {
      const params = createHistoryCompletenessParams()

      const result = await provider.generateHistoryCompletenessProof(params)

      expect(result).toBeDefined()
      expect(result.complianceType).toBe('history_complete')
      expect(result.proof.type).toBe('fulfillment')
    })

    it('should include time range in public inputs', async () => {
      const params = createHistoryCompletenessParams()

      const result = await provider.generateHistoryCompletenessProof(params)

      expect(result.publicInputs).toBeDefined()
      expect(result.publicInputs.length).toBeGreaterThanOrEqual(3)
    })

    it('should reject invalid time range', async () => {
      const params = createHistoryCompletenessParams()
      params.startTimestamp = 1000
      params.endTimestamp = 500 // Before start

      await expect(provider.generateHistoryCompletenessProof(params)).rejects.toThrow(
        'Start must be before end'
      )
    })

    it('should require history merkle root', async () => {
      const params = createHistoryCompletenessParams()
      params.historyMerkleRoot = ''

      await expect(provider.generateHistoryCompletenessProof(params)).rejects.toThrow(
        'History merkle root is required'
      )
    })

    it('should require viewing key', async () => {
      const params = createHistoryCompletenessParams()
      params.viewingKey = undefined as unknown as ViewingKey

      await expect(provider.generateHistoryCompletenessProof(params)).rejects.toThrow(
        'Viewing key is required'
      )
    })
  })

  // ─── Verification Tests ────────────────────────────────────────────────────

  describe('verifyComplianceProof', () => {
    let provider: ComplianceProofProvider

    beforeEach(async () => {
      provider = new ComplianceProofProvider()
      await provider.initialize()
    })

    afterEach(async () => {
      await provider.destroy()
    })

    it('should verify valid proof', async () => {
      const params = createViewingKeyAccessParams()
      const result = await provider.generateViewingKeyAccessProof(params)

      const isValid = await provider.verifyComplianceProof(result)

      expect(isValid).toBe(true)
    })

    it('should reject expired proof', async () => {
      const params = createViewingKeyAccessParams()
      const result = await provider.generateViewingKeyAccessProof(params)

      // Make proof expired
      result.validUntil = Math.floor(Date.now() / 1000) - 1

      const isValid = await provider.verifyComplianceProof(result)

      expect(isValid).toBe(false)
    })

    it('should verify different proof types', async () => {
      const viewingKeyResult = await provider.generateViewingKeyAccessProof(
        createViewingKeyAccessParams()
      )
      const sanctionsResult = await provider.generateSanctionsClearProof(
        createSanctionsClearParams()
      )
      const balanceResult = await provider.generateBalanceAttestationProof(
        createBalanceAttestationParams()
      )
      const historyResult = await provider.generateHistoryCompletenessProof(
        createHistoryCompletenessParams()
      )

      expect(await provider.verifyComplianceProof(viewingKeyResult)).toBe(true)
      expect(await provider.verifyComplianceProof(sanctionsResult)).toBe(true)
      expect(await provider.verifyComplianceProof(balanceResult)).toBe(true)
      expect(await provider.verifyComplianceProof(historyResult)).toBe(true)
    })
  })

  // ─── Destroy Tests ─────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('should reset ready state', async () => {
      const provider = new ComplianceProofProvider()
      await provider.initialize()

      expect(provider.isReady).toBe(true)

      await provider.destroy()

      expect(provider.isReady).toBe(false)
    })
  })
})

// ─── Constants Tests ─────────────────────────────────────────────────────────

describe('Compliance Constants', () => {
  describe('DEFAULT_VALIDITY_PERIOD_SECONDS', () => {
    it('should be 24 hours', () => {
      expect(DEFAULT_VALIDITY_PERIOD_SECONDS).toBe(86400)
    })
  })

  describe('SUPPORTED_JURISDICTIONS', () => {
    it('should include major jurisdictions', () => {
      expect(SUPPORTED_JURISDICTIONS).toContain('US')
      expect(SUPPORTED_JURISDICTIONS).toContain('EU')
      expect(SUPPORTED_JURISDICTIONS).toContain('UK')
      expect(SUPPORTED_JURISDICTIONS).toContain('SG')
      expect(SUPPORTED_JURISDICTIONS).toContain('CH')
      expect(SUPPORTED_JURISDICTIONS).toContain('GLOBAL')
    })
  })

  describe('COMPLIANCE_CIRCUIT_IDS', () => {
    it('should have IDs for all compliance types', () => {
      expect(COMPLIANCE_CIRCUIT_IDS.viewing_key_access).toBeDefined()
      expect(COMPLIANCE_CIRCUIT_IDS.sanctions_clear).toBeDefined()
      expect(COMPLIANCE_CIRCUIT_IDS.balance_attestation).toBeDefined()
      expect(COMPLIANCE_CIRCUIT_IDS.history_complete).toBeDefined()
    })

    it('should have versioned IDs', () => {
      expect(COMPLIANCE_CIRCUIT_IDS.viewing_key_access).toContain('v1')
      expect(COMPLIANCE_CIRCUIT_IDS.sanctions_clear).toContain('v1')
      expect(COMPLIANCE_CIRCUIT_IDS.balance_attestation).toContain('v1')
      expect(COMPLIANCE_CIRCUIT_IDS.history_complete).toContain('v1')
    })
  })
})
