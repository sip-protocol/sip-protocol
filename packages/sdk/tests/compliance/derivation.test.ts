/**
 * Auditor Key Derivation Tests
 *
 * Tests for BIP-44 style hierarchical key derivation for auditor viewing keys.
 */

import { describe, it, expect } from 'vitest'
import { randomBytes } from '@noble/hashes/utils'
import {
  AuditorKeyDerivation,
  AuditorType,
  type DerivedViewingKey,
} from '../../src/compliance/derivation'

describe('AuditorKeyDerivation', () => {
  // ─── Path Generation Tests ─────────────────────────────────────────────────

  describe('derivePath', () => {
    it('should generate correct path for PRIMARY auditor', () => {
      const path = AuditorKeyDerivation.derivePath(AuditorType.PRIMARY)
      expect(path).toBe("m/44'/1234'/0'/0")
    })

    it('should generate correct path for REGULATORY auditor', () => {
      const path = AuditorKeyDerivation.derivePath(AuditorType.REGULATORY)
      expect(path).toBe("m/44'/1234'/0'/1")
    })

    it('should generate correct path for INTERNAL auditor', () => {
      const path = AuditorKeyDerivation.derivePath(AuditorType.INTERNAL)
      expect(path).toBe("m/44'/1234'/0'/2")
    })

    it('should generate correct path for TAX auditor', () => {
      const path = AuditorKeyDerivation.derivePath(AuditorType.TAX)
      expect(path).toBe("m/44'/1234'/0'/3")
    })

    it('should generate correct path with custom account', () => {
      const path = AuditorKeyDerivation.derivePath(AuditorType.REGULATORY, 5)
      expect(path).toBe("m/44'/1234'/5'/1")
    })

    it('should throw on invalid auditor type', () => {
      expect(() => {
        AuditorKeyDerivation.derivePath(999 as AuditorType)
      }).toThrow('invalid auditor type')
    })

    it('should throw on negative account', () => {
      expect(() => {
        AuditorKeyDerivation.derivePath(AuditorType.PRIMARY, -1)
      }).toThrow('account must be a non-negative integer')
    })

    it('should throw on non-integer account', () => {
      expect(() => {
        AuditorKeyDerivation.derivePath(AuditorType.PRIMARY, 1.5)
      }).toThrow('account must be a non-negative integer')
    })
  })

  // ─── Single Key Derivation Tests ───────────────────────────────────────────

  describe('deriveViewingKey', () => {
    it('should derive a viewing key', () => {
      const masterSeed = randomBytes(32)

      const result = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      expect(result.path).toBe("m/44'/1234'/0'/0")
      expect(result.auditorType).toBe(AuditorType.PRIMARY)
      expect(result.account).toBe(0)
      expect(result.viewingKey.key).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.viewingKey.hash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.viewingKey.path).toBe("m/44'/1234'/0'/0")
    })

    it('should derive different keys for different auditor types', () => {
      const masterSeed = randomBytes(32)

      const primary = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      const regulatory = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.REGULATORY,
      })

      expect(primary.viewingKey.key).not.toBe(regulatory.viewingKey.key)
      expect(primary.viewingKey.hash).not.toBe(regulatory.viewingKey.hash)
      expect(primary.path).toBe("m/44'/1234'/0'/0")
      expect(regulatory.path).toBe("m/44'/1234'/0'/1")
    })

    it('should derive different keys for different accounts', () => {
      const masterSeed = randomBytes(32)

      const account0 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
        account: 0,
      })

      const account1 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
        account: 1,
      })

      expect(account0.viewingKey.key).not.toBe(account1.viewingKey.key)
      expect(account0.path).toBe("m/44'/1234'/0'/0")
      expect(account1.path).toBe("m/44'/1234'/1'/0")
    })

    it('should derive same key from same seed and parameters', () => {
      const masterSeed = randomBytes(32)

      const key1 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.REGULATORY,
      })

      const key2 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.REGULATORY,
      })

      expect(key1.viewingKey.key).toBe(key2.viewingKey.key)
      expect(key1.viewingKey.hash).toBe(key2.viewingKey.hash)
    })

    it('should derive different keys from different seeds', () => {
      const seed1 = randomBytes(32)
      const seed2 = randomBytes(32)

      const key1 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed: seed1,
        auditorType: AuditorType.PRIMARY,
      })

      const key2 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed: seed2,
        auditorType: AuditorType.PRIMARY,
      })

      expect(key1.viewingKey.key).not.toBe(key2.viewingKey.key)
    })

    it('should throw on short master seed', () => {
      const shortSeed = randomBytes(16) // Only 16 bytes

      expect(() => {
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed: shortSeed,
          auditorType: AuditorType.PRIMARY,
        })
      }).toThrow('master seed must be at least 32 bytes')
    })

    it('should throw on invalid auditor type', () => {
      const masterSeed = randomBytes(32)

      expect(() => {
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed,
          auditorType: 999 as AuditorType,
        })
      }).toThrow('invalid auditor type')
    })

    it('should throw on invalid account', () => {
      const masterSeed = randomBytes(32)

      expect(() => {
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed,
          auditorType: AuditorType.PRIMARY,
          account: -1,
        })
      }).toThrow('account must be a non-negative integer')
    })
  })

  // ─── Multiple Key Derivation Tests ─────────────────────────────────────────

  describe('deriveMultiple', () => {
    it('should derive multiple keys', () => {
      const masterSeed = randomBytes(32)

      const results = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [
          AuditorType.PRIMARY,
          AuditorType.REGULATORY,
          AuditorType.INTERNAL,
        ],
      })

      expect(results).toHaveLength(3)

      expect(results[0].auditorType).toBe(AuditorType.PRIMARY)
      expect(results[0].path).toBe("m/44'/1234'/0'/0")

      expect(results[1].auditorType).toBe(AuditorType.REGULATORY)
      expect(results[1].path).toBe("m/44'/1234'/0'/1")

      expect(results[2].auditorType).toBe(AuditorType.INTERNAL)
      expect(results[2].path).toBe("m/44'/1234'/0'/2")

      // All keys should be different
      expect(results[0].viewingKey.key).not.toBe(results[1].viewingKey.key)
      expect(results[1].viewingKey.key).not.toBe(results[2].viewingKey.key)
      expect(results[0].viewingKey.key).not.toBe(results[2].viewingKey.key)
    })

    it('should derive same keys as single derivation', () => {
      const masterSeed = randomBytes(32)

      const multiple = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
      })

      const single1 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      const single2 = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.REGULATORY,
      })

      expect(multiple[0].viewingKey.key).toBe(single1.viewingKey.key)
      expect(multiple[1].viewingKey.key).toBe(single2.viewingKey.key)
    })

    it('should handle all auditor types', () => {
      const masterSeed = randomBytes(32)

      const results = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [
          AuditorType.PRIMARY,
          AuditorType.REGULATORY,
          AuditorType.INTERNAL,
          AuditorType.TAX,
        ],
      })

      expect(results).toHaveLength(4)
      expect(results[0].path).toBe("m/44'/1234'/0'/0")
      expect(results[1].path).toBe("m/44'/1234'/0'/1")
      expect(results[2].path).toBe("m/44'/1234'/0'/2")
      expect(results[3].path).toBe("m/44'/1234'/0'/3")
    })

    it('should handle custom account', () => {
      const masterSeed = randomBytes(32)

      const results = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
        account: 5,
      })

      expect(results[0].path).toBe("m/44'/1234'/5'/0")
      expect(results[1].path).toBe("m/44'/1234'/5'/1")
      expect(results[0].account).toBe(5)
      expect(results[1].account).toBe(5)
    })

    it('should remove duplicate auditor types', () => {
      const masterSeed = randomBytes(32)

      const results = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [
          AuditorType.PRIMARY,
          AuditorType.REGULATORY,
          AuditorType.PRIMARY, // Duplicate
        ],
      })

      expect(results).toHaveLength(2)
      expect(results[0].auditorType).toBe(AuditorType.PRIMARY)
      expect(results[1].auditorType).toBe(AuditorType.REGULATORY)
    })

    it('should throw on empty auditor types array', () => {
      const masterSeed = randomBytes(32)

      expect(() => {
        AuditorKeyDerivation.deriveMultiple({
          masterSeed,
          auditorTypes: [],
        })
      }).toThrow('at least one auditor type is required')
    })

    it('should throw on invalid auditor type in array', () => {
      const masterSeed = randomBytes(32)

      expect(() => {
        AuditorKeyDerivation.deriveMultiple({
          masterSeed,
          auditorTypes: [AuditorType.PRIMARY, 999 as AuditorType],
        })
      }).toThrow('invalid auditor type')
    })

    it('should throw on short master seed', () => {
      const shortSeed = randomBytes(16)

      expect(() => {
        AuditorKeyDerivation.deriveMultiple({
          masterSeed: shortSeed,
          auditorTypes: [AuditorType.PRIMARY],
        })
      }).toThrow('master seed must be at least 32 bytes')
    })
  })

  // ─── Utility Function Tests ────────────────────────────────────────────────

  describe('getAuditorTypeName', () => {
    it('should return correct name for PRIMARY', () => {
      expect(AuditorKeyDerivation.getAuditorTypeName(AuditorType.PRIMARY))
        .toBe('Primary')
    })

    it('should return correct name for REGULATORY', () => {
      expect(AuditorKeyDerivation.getAuditorTypeName(AuditorType.REGULATORY))
        .toBe('Regulatory')
    })

    it('should return correct name for INTERNAL', () => {
      expect(AuditorKeyDerivation.getAuditorTypeName(AuditorType.INTERNAL))
        .toBe('Internal')
    })

    it('should return correct name for TAX', () => {
      expect(AuditorKeyDerivation.getAuditorTypeName(AuditorType.TAX))
        .toBe('Tax Authority')
    })

    it('should return unknown for invalid type', () => {
      expect(AuditorKeyDerivation.getAuditorTypeName(999 as AuditorType))
        .toBe('Unknown (999)')
    })
  })

  // ─── Cryptographic Properties Tests ────────────────────────────────────────

  describe('cryptographic properties', () => {
    it('should produce 32-byte keys', () => {
      const masterSeed = randomBytes(32)

      const result = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      // Remove 0x prefix and check length (64 hex chars = 32 bytes)
      const keyHex = result.viewingKey.key.slice(2)
      expect(keyHex).toHaveLength(64)
    })

    it('should produce 32-byte hashes', () => {
      const masterSeed = randomBytes(32)

      const result = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      // Remove 0x prefix and check length (64 hex chars = 32 bytes)
      const hashHex = result.viewingKey.hash.slice(2)
      expect(hashHex).toHaveLength(64)
    })

    it('should have no correlation between different auditor types', () => {
      const masterSeed = randomBytes(32)

      const keys: DerivedViewingKey[] = []
      for (let i = 0; i < 4; i++) {
        keys.push(
          AuditorKeyDerivation.deriveViewingKey({
            masterSeed,
            auditorType: i as AuditorType,
          })
        )
      }

      // Check that all keys are unique
      const uniqueKeys = new Set(keys.map(k => k.viewingKey.key))
      expect(uniqueKeys.size).toBe(4)

      // Check that all hashes are unique
      const uniqueHashes = new Set(keys.map(k => k.viewingKey.hash))
      expect(uniqueHashes.size).toBe(4)
    })

    it('should be deterministic', () => {
      const masterSeed = randomBytes(32)

      // Derive the same key multiple times
      const keys = Array.from({ length: 10 }, () =>
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed,
          auditorType: AuditorType.REGULATORY,
          account: 3,
        })
      )

      // All should be identical
      const firstKey = keys[0].viewingKey.key
      expect(keys.every(k => k.viewingKey.key === firstKey)).toBe(true)
    })

    it('should not leak information between accounts', () => {
      const masterSeed = randomBytes(32)

      const accounts = Array.from({ length: 5 }, (_, i) =>
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed,
          auditorType: AuditorType.PRIMARY,
          account: i,
        })
      )

      // All keys should be different
      const uniqueKeys = new Set(accounts.map(a => a.viewingKey.key))
      expect(uniqueKeys.size).toBe(5)
    })
  })

  // ─── Edge Cases and Error Handling ─────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle maximum account index', () => {
      const masterSeed = randomBytes(32)
      const maxAccount = 0x7FFFFFFF // 2^31 - 1 (max before hardened bit)

      const result = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
        account: maxAccount,
      })

      expect(result.account).toBe(maxAccount)
      expect(result.path).toBe(`m/44'/1234'/${maxAccount}'/0`)
    })

    it('should throw on account >= 2^31', () => {
      const masterSeed = randomBytes(32)
      const tooLarge = 0x80000000 // 2^31

      expect(() => {
        AuditorKeyDerivation.deriveViewingKey({
          masterSeed,
          auditorType: AuditorType.PRIMARY,
          account: tooLarge,
        })
      }).toThrow('account must be a non-negative integer')
    })

    it('should handle 64-byte master seed', () => {
      const largeSeed = randomBytes(64)

      const result = AuditorKeyDerivation.deriveViewingKey({
        masterSeed: largeSeed,
        auditorType: AuditorType.PRIMARY,
      })

      expect(result.viewingKey.key).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should handle single auditor type in deriveMultiple', () => {
      const masterSeed = randomBytes(32)

      const results = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.TAX],
      })

      expect(results).toHaveLength(1)
      expect(results[0].auditorType).toBe(AuditorType.TAX)
    })
  })

  // ─── Integration Tests ─────────────────────────────────────────────────────

  describe('integration scenarios', () => {
    it('should support typical organization setup', () => {
      const masterSeed = randomBytes(32)

      // Derive keys for primary organization and two auditors
      const orgKey = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.PRIMARY,
      })

      const regulatoryKey = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.REGULATORY,
      })

      const internalKey = AuditorKeyDerivation.deriveViewingKey({
        masterSeed,
        auditorType: AuditorType.INTERNAL,
      })

      expect(orgKey.viewingKey.key).toBeDefined()
      expect(regulatoryKey.viewingKey.key).toBeDefined()
      expect(internalKey.viewingKey.key).toBeDefined()

      // All different
      expect(orgKey.viewingKey.key).not.toBe(regulatoryKey.viewingKey.key)
      expect(orgKey.viewingKey.key).not.toBe(internalKey.viewingKey.key)
      expect(regulatoryKey.viewingKey.key).not.toBe(internalKey.viewingKey.key)
    })

    it('should support multi-tenant setup with accounts', () => {
      const masterSeed = randomBytes(32)

      // Three different tenants (accounts)
      const tenant0Keys = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
        account: 0,
      })

      const tenant1Keys = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
        account: 1,
      })

      const tenant2Keys = AuditorKeyDerivation.deriveMultiple({
        masterSeed,
        auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
        account: 2,
      })

      // Tenant 0 keys
      expect(tenant0Keys[0].path).toBe("m/44'/1234'/0'/0")
      expect(tenant0Keys[1].path).toBe("m/44'/1234'/0'/1")

      // Tenant 1 keys
      expect(tenant1Keys[0].path).toBe("m/44'/1234'/1'/0")
      expect(tenant1Keys[1].path).toBe("m/44'/1234'/1'/1")

      // Tenant 2 keys
      expect(tenant2Keys[0].path).toBe("m/44'/1234'/2'/0")
      expect(tenant2Keys[1].path).toBe("m/44'/1234'/2'/1")

      // All keys should be unique
      const allKeys = [
        ...tenant0Keys,
        ...tenant1Keys,
        ...tenant2Keys,
      ].map(k => k.viewingKey.key)

      expect(new Set(allKeys).size).toBe(6)
    })

    it('should maintain isolation between organizations', () => {
      // Different organizations with different seeds
      const org1Seed = randomBytes(32)
      const org2Seed = randomBytes(32)

      const org1Primary = AuditorKeyDerivation.deriveViewingKey({
        masterSeed: org1Seed,
        auditorType: AuditorType.PRIMARY,
      })

      const org2Primary = AuditorKeyDerivation.deriveViewingKey({
        masterSeed: org2Seed,
        auditorType: AuditorType.PRIMARY,
      })

      // Keys should be completely different
      expect(org1Primary.viewingKey.key).not.toBe(org2Primary.viewingKey.key)
      expect(org1Primary.viewingKey.hash).not.toBe(org2Primary.viewingKey.hash)

      // But paths should be the same
      expect(org1Primary.path).toBe(org2Primary.path)
    })
  })
})
