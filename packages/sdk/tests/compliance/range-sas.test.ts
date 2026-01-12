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

    it('should enforce maximum attestation age', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxAttestationAge: 3600, // Attestation must be less than 1 hour old
      })

      const oldAttestation = createMockAttestation({
        timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      })

      const result = await disclosure.deriveViewingKeyForAuditor(oldAttestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('too old')
    })

    it('should allow attestation within max age limit', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxAttestationAge: 3600, // Attestation must be less than 1 hour old
      })

      const recentAttestation = createMockAttestation({
        timestamp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
      })

      const result = await disclosure.deriveViewingKeyForAuditor(recentAttestation)

      expect(result.granted).toBe(true)
    })

    it('should not enforce max age when set to 0', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxAttestationAge: 0, // No limit
      })

      const oldAttestation = createMockAttestation({
        timestamp: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60, // 1 year ago
      })

      const result = await disclosure.deriveViewingKeyForAuditor(oldAttestation)

      expect(result.granted).toBe(true)
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

  describe('Input Validation', () => {
    it('should reject attestation with empty uid', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation({ uid: '' })
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('uid is required')
    })

    it('should reject attestation with empty subject', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation({ subject: '' })
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('subject is required')
    })

    it('should reject attestation with empty schema', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation({ schema: '' })
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('schema is required')
    })

    it('should reject attestation with empty issuer', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation({ issuer: '' })
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(false)
      expect(result.reason).toContain('issuer is required')
    })

    it('should reject null attestation', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const result = await disclosure.verifyAttestation(null as any)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Attestation must be an object')
    })
  })

  describe('Cache Management', () => {
    it('should evict oldest keys when cache is full', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxCacheSize: 3,
      })

      // Add 4 attestations - first one should be evicted
      const attestations = [
        createMockAttestation({ uid: 'uid_1', subject: 'subject_1' }),
        createMockAttestation({ uid: 'uid_2', subject: 'subject_2' }),
        createMockAttestation({ uid: 'uid_3', subject: 'subject_3' }),
        createMockAttestation({ uid: 'uid_4', subject: 'subject_4' }),
      ]

      for (const attestation of attestations) {
        await disclosure.deriveViewingKeyForAuditor(attestation)
      }

      // First attestation should be evicted
      expect(disclosure.hasViewingKey(attestations[0])).toBe(false)
      // Others should still be cached
      expect(disclosure.hasViewingKey(attestations[1])).toBe(true)
      expect(disclosure.hasViewingKey(attestations[2])).toBe(true)
      expect(disclosure.hasViewingKey(attestations[3])).toBe(true)
      expect(disclosure.getCacheSize()).toBe(3)
    })

    it('should update LRU order on cache hit', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxCacheSize: 2,
      })

      const attestation1 = createMockAttestation({ uid: 'uid_1', subject: 'subject_1' })
      const attestation2 = createMockAttestation({ uid: 'uid_2', subject: 'subject_2' })
      const attestation3 = createMockAttestation({ uid: 'uid_3', subject: 'subject_3' })

      // Add first two
      await disclosure.deriveViewingKeyForAuditor(attestation1)
      await disclosure.deriveViewingKeyForAuditor(attestation2)

      // Access first one (updates LRU order)
      await disclosure.deriveViewingKeyForAuditor(attestation1)

      // Add third one - should evict second (oldest now)
      await disclosure.deriveViewingKeyForAuditor(attestation3)

      expect(disclosure.hasViewingKey(attestation1)).toBe(true)
      expect(disclosure.hasViewingKey(attestation2)).toBe(false)
      expect(disclosure.hasViewingKey(attestation3)).toBe(true)
    })

    it('should report correct cache size', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      expect(disclosure.getCacheSize()).toBe(0)

      await disclosure.deriveViewingKeyForAuditor(createMockAttestation({ uid: 'uid_1' }))
      expect(disclosure.getCacheSize()).toBe(1)

      await disclosure.deriveViewingKeyForAuditor(createMockAttestation({ uid: 'uid_2' }))
      expect(disclosure.getCacheSize()).toBe(2)
    })

    it('should clear all cached keys', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation()
      await disclosure.deriveViewingKeyForAuditor(attestation)
      expect(disclosure.getCacheSize()).toBe(1)

      disclosure.clearCache()
      expect(disclosure.getCacheSize()).toBe(0)
      expect(disclosure.hasViewingKey(attestation)).toBe(false)
    })

    it('should remove from cache order when revoking', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
        maxCacheSize: 2,
      })

      const attestation1 = createMockAttestation({ uid: 'uid_1', subject: 'subject_1' })
      const attestation2 = createMockAttestation({ uid: 'uid_2', subject: 'subject_2' })
      const attestation3 = createMockAttestation({ uid: 'uid_3', subject: 'subject_3' })

      // Add first two
      await disclosure.deriveViewingKeyForAuditor(attestation1)
      await disclosure.deriveViewingKeyForAuditor(attestation2)

      // Revoke first one
      disclosure.revokeViewingKey(attestation1)

      // Add third - should NOT evict second since first was revoked
      await disclosure.deriveViewingKeyForAuditor(attestation3)

      expect(disclosure.hasViewingKey(attestation2)).toBe(true)
      expect(disclosure.hasViewingKey(attestation3)).toBe(true)
      expect(disclosure.getCacheSize()).toBe(2)
    })

    it('should not cache-poison with same uid:subject but different schema', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      // Two attestations with same uid:subject but different schemas
      const attestation1 = createMockAttestation({
        uid: 'uid_same',
        subject: 'subject_same',
        schema: 'schema-a',
      })
      const attestation2 = createMockAttestation({
        uid: 'uid_same',
        subject: 'subject_same',
        schema: 'schema-b',
      })

      await disclosure.deriveViewingKeyForAuditor(attestation1)
      await disclosure.deriveViewingKeyForAuditor(attestation2)

      // Both should be cached (different cache keys due to schema)
      expect(disclosure.getCacheSize()).toBe(2)
      expect(disclosure.hasViewingKey(attestation1)).toBe(true)
      expect(disclosure.hasViewingKey(attestation2)).toBe(true)
    })

    it('should not cache-poison with same uid:subject but different issuer', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      // Two attestations with same uid:subject but different issuers
      const attestation1 = createMockAttestation({
        uid: 'uid_same',
        subject: 'subject_same',
        issuer: 'issuer-a',
      })
      const attestation2 = createMockAttestation({
        uid: 'uid_same',
        subject: 'subject_same',
        issuer: 'issuer-b',
      })

      await disclosure.deriveViewingKeyForAuditor(attestation1)
      await disclosure.deriveViewingKeyForAuditor(attestation2)

      // Both should be cached (different cache keys due to issuer)
      expect(disclosure.getCacheSize()).toBe(2)
      expect(disclosure.hasViewingKey(attestation1)).toBe(true)
      expect(disclosure.hasViewingKey(attestation2)).toBe(true)
    })
  })

  describe('expiresAt handling', () => {
    it('should preserve expiresAt: 0 (never expires)', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      const attestation = createMockAttestation({ expiresAt: 0 })
      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(true)
      expect(result.expiresAt).toBe(0) // Should be 0, not undefined
    })

    it('should have undefined expiresAt when not set', async () => {
      const disclosure = new AttestationGatedDisclosure({
        masterViewingKey,
      })

      // Create attestation and remove expiresAt
      const attestation = createMockAttestation()
      delete (attestation as any).expiresAt

      const result = await disclosure.deriveViewingKeyForAuditor(attestation)

      expect(result.granted).toBe(true)
      expect(result.expiresAt).toBeUndefined()
    })
  })
})
