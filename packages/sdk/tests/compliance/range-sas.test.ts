/**
 * Range SAS Integration Tests
 *
 * Tests for attestation-gated viewing key disclosure.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  AttestationGatedDisclosure,
  AttestationSchema,
  createMockAttestation,
  type RangeSASAttestation,
} from '../../src/compliance/range-sas'
import { generateViewingKey } from '../../src/privacy'

describe('Range SAS Integration', () => {
  // Generate a master viewing key for tests
  const masterViewingKey = generateViewingKey('m/0/master')

  describe('AttestationGatedDisclosure', () => {
    it('should create disclosure manager with valid config', () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      expect(disclosure).toBeDefined()
    })

    it('should throw on missing masterViewingKey', () => {
      expect(() => new AttestationGatedDisclosure({
        masterViewingKey: undefined as any,
      })).toThrow('masterViewingKey is required')
    })

    it('should derive viewing key for valid attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(true)
      expect(result.viewingKey).toBeDefined()
      expect(result.viewingKey?.key).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.viewingKey?.path).toContain('sas/')
    })

    it('should deny access for expired attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const expiredAttestation = createMockAttestation({
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      })

      const result = await disclosure.deriveViewingKeyForAuditor(expiredAttestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('expired')
    })

    it('should deny access for revoked attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const revokedAttestation = createMockAttestation({
        revoked: true,
      })

      const result = await disclosure.deriveViewingKeyForAuditor(revokedAttestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('revoked')
    })

    it('should enforce schema allowlist', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        allowedSchemas: [AttestationSchema.RANGE_INSTITUTIONAL],
      })

      const kycAttestation = createMockAttestation({
        schema: AttestationSchema.RANGE_KYC_V1,
      })

      const result = await disclosure.deriveViewingKeyForAuditor(kycAttestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('not in allowed list')
    })

    it('should allow attestation from allowed schema', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        allowedSchemas: [AttestationSchema.RANGE_KYC_V1, AttestationSchema.RANGE_INSTITUTIONAL],
      })

      const kycAttestation = createMockAttestation({
        schema: AttestationSchema.RANGE_KYC_V1,
      })

      const result = await disclosure.deriveViewingKeyForAuditor(kycAttestation)

      expect(result.granted).toBe(true)
    })

    it('should enforce issuer allowlist', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        allowedIssuers: ['trusted-issuer-1', 'trusted-issuer-2'],
      })

      const attestation = createMockAttestation({
        issuer: 'untrusted-issuer',
      })

      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('Issuer')
      expect(result.reason).toContain('not in allowed list')
    })

    it('should cache derived keys for same attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()

      const result1 = await disclosure.deriveViewingKeyForAuditor(attestation)
      const result2 = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result1.viewingKey?.key).toBe(result2.viewingKey?.key)
    })

    it('should derive different keys for different attestations', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation1 = createMockAttestation({ uid: 'sas_attestation_1' })
      const attestation2 = createMockAttestation({ uid: 'sas_attestation_2' })

      const result1 = await disclosure.deriveViewingKeyForAuditor(attestation1)
      const result2 = await disclosure.deriveViewingKeyForAuditor(attestation2)

      expect(result1.viewingKey?.key).not.toBe(result2.viewingKey?.key)
    })

    it('should derive different keys for different subjects', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation1 = createMockAttestation({ subject: 'auditor-wallet-1' })
      const attestation2 = createMockAttestation({ subject: 'auditor-wallet-2' })

      const result1 = await disclosure.deriveViewingKeyForAuditor(attestation1)
      const result2 = await disclosure.deriveViewingKeyForAuditor(attestation2)

      expect(result1.viewingKey?.key).not.toBe(result2.viewingKey?.key)
    })

    it('should include expiration in result', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
      const attestation = createMockAttestation({ expiresAt })

      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.expiresAt).toBe(expiresAt)
    })

    it('should support custom verifier', async () => {
      const customVerifier = vi.fn().mockResolvedValue(false)

      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        customVerifier,
      })

      const attestation = createMockAttestation()
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(customVerifier).toHaveBeenCalledWith(attestation)
      expect(result.granted).toBe(false)
      expect(result.reason).toContain('Custom verification failed')
    })

    it('should handle custom verifier errors gracefully', async () => {
      const customVerifier = vi.fn().mockRejectedValue(new Error('Network error'))

      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        customVerifier,
      })

      const attestation = createMockAttestation()
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('Network error')
    })

    it('should enforce minimum attestation age', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        minAttestationAge: 3600, // Require attestation to be at least 1 hour old
      })

      const freshAttestation = createMockAttestation({
        timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
      })

      const result = await disclosure.deriveViewingKeyForAuditor(freshAttestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('too new')
    })

    it('should revoke viewing key', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()

      // First derive a key
      await disclosure.deriveViewingKeyForAuditor(attestation)
      expect(disclosure.hasViewingKey(attestation)).toBe(true)

      // Revoke it
      const revoked = disclosure.revokeViewingKey(attestation)
      expect(revoked).toBe(true)
      expect(disclosure.hasViewingKey(attestation)).toBe(false)
    })

    it('should return false when revoking non-existent key', () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()
      const revoked = disclosure.revokeViewingKey(attestation)

      expect(revoked).toBe(false)
    })
  })

  describe('verifyAttestation', () => {
    it('should verify valid attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()
      const result = await disclosure.verifyAttestation(attestation)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should include verification method in metadata', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        verifyOnChain: true,
      })

      const attestation = createMockAttestation()
      const result = await disclosure.verifyAttestation(attestation)

      expect(result.metadata?.verificationMethod).toBe('on-chain')
    })
  })

  describe('createMockAttestation', () => {
    it('should create attestation with default values', () => {
      const attestation = createMockAttestation()

      expect(attestation.uid).toMatch(/^sas_/)
      expect(attestation.schema).toBe(AttestationSchema.RANGE_KYC_V1)
      expect(attestation.issuer).toBe('range-protocol')
      expect(attestation.expiresAt).toBeGreaterThan(Date.now() / 1000)
      expect(attestation.revoked).toBe(false)
    })

    it('should allow overriding fields', () => {
      const attestation = createMockAttestation({
        uid: 'custom-uid',
        schema: AttestationSchema.RANGE_INSTITUTIONAL,
        issuer: 'custom-issuer',
      })

      expect(attestation.uid).toBe('custom-uid')
      expect(attestation.schema).toBe(AttestationSchema.RANGE_INSTITUTIONAL)
      expect(attestation.issuer).toBe('custom-issuer')
    })
  })

  describe('Viewing Key Scope', () => {
    it('should include scope in derivation result', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()
      const scope = {
        startTime: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
        endTime: Math.floor(Date.now() / 1000),
        maxTransactions: 100,
      }

      const result = await disclosure.deriveViewingKeyForAuditor(attestation, scope)

      expect(result.granted).toBe(true)
      expect(result.scope).toEqual(scope)
    })
  })

  describe('AttestationSchema enum', () => {
    it('should have correct values', () => {
      expect(AttestationSchema.RANGE_KYC_V1).toBe('range-kyc-v1')
      expect(AttestationSchema.RANGE_ACCREDITED_INVESTOR).toBe('range-accredited-investor')
      expect(AttestationSchema.RANGE_INSTITUTIONAL).toBe('range-institutional')
      expect(AttestationSchema.RANGE_REGULATOR).toBe('range-regulator')
      expect(AttestationSchema.CUSTOM).toBe('custom')
    })
  })
})
