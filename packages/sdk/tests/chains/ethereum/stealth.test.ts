/**
 * Ethereum Stealth Address Tests
 */

import { describe, it, expect } from 'vitest'
import {
  generateEthereumStealthMetaAddress,
  encodeEthereumStealthMetaAddress,
  parseEthereumStealthMetaAddress,
  isValidEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  stealthPublicKeyToEthAddress,
  extractPublicKeys,
  createMetaAddressFromPublicKeys,
  getSchemeId,
  EIP5564_PREFIX,
  SCHEME_ID,
} from '../../../src/chains/ethereum'

describe('Ethereum Stealth Addresses', () => {
  describe('generateEthereumStealthMetaAddress', () => {
    it('should generate a valid meta-address', () => {
      const result = generateEthereumStealthMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('ethereum')
      expect(result.metaAddress.schemeId).toBe(1)
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.encoded).toMatch(/^st:eth:0x[0-9a-f]{132}$/i)
    })

    it('should include label when provided', () => {
      const result = generateEthereumStealthMetaAddress('My Wallet')

      expect(result.metaAddress.label).toBe('My Wallet')
    })

    it('should generate unique meta-addresses', () => {
      const result1 = generateEthereumStealthMetaAddress()
      const result2 = generateEthereumStealthMetaAddress()

      expect(result1.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
      expect(result1.metaAddress.viewingKey).not.toBe(result2.metaAddress.viewingKey)
    })
  })

  describe('encodeEthereumStealthMetaAddress', () => {
    it('should encode meta-address to EIP-5564 format', () => {
      const result = generateEthereumStealthMetaAddress()
      const encoded = encodeEthereumStealthMetaAddress(result.metaAddress)

      expect(encoded).toBe(result.encoded)
      expect(encoded).toMatch(/^st:eth:0x[0-9a-f]{132}$/i)
    })
  })

  describe('parseEthereumStealthMetaAddress', () => {
    it('should parse a valid encoded meta-address', () => {
      const original = generateEthereumStealthMetaAddress()
      const parsed = parseEthereumStealthMetaAddress(original.encoded)

      expect(parsed.spendingKey).toBe(original.metaAddress.spendingKey)
      expect(parsed.viewingKey).toBe(original.metaAddress.viewingKey)
      expect(parsed.chain).toBe('ethereum')
      expect(parsed.schemeId).toBe(1)
    })

    it('should throw on invalid prefix', () => {
      expect(() => parseEthereumStealthMetaAddress('invalid:0x123')).toThrow()
    })

    it('should throw on invalid length', () => {
      expect(() => parseEthereumStealthMetaAddress('st:eth:0x123')).toThrow()
    })
  })

  describe('isValidEthereumStealthMetaAddress', () => {
    it('should return true for valid meta-address', () => {
      const result = generateEthereumStealthMetaAddress()
      expect(isValidEthereumStealthMetaAddress(result.encoded)).toBe(true)
    })

    it('should return false for invalid meta-address', () => {
      expect(isValidEthereumStealthMetaAddress('invalid')).toBe(false)
      expect(isValidEthereumStealthMetaAddress('st:eth:0x123')).toBe(false)
    })
  })

  describe('generateEthereumStealthAddress', () => {
    it('should generate a stealth address from meta-address object', () => {
      const meta = generateEthereumStealthMetaAddress()
      const result = generateEthereumStealthAddress(meta.metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.address).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.stealthAddress.viewTag).toBeLessThanOrEqual(255)
      expect(result.stealthAddress.ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(result.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should generate a stealth address from encoded string', () => {
      const meta = generateEthereumStealthMetaAddress()
      const result = generateEthereumStealthAddress(meta.encoded)

      expect(result.stealthAddress.ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should generate unique stealth addresses', () => {
      const meta = generateEthereumStealthMetaAddress()
      const result1 = generateEthereumStealthAddress(meta.metaAddress)
      const result2 = generateEthereumStealthAddress(meta.metaAddress)

      expect(result1.stealthAddress.address).not.toBe(result2.stealthAddress.address)
      expect(result1.stealthAddress.ethAddress).not.toBe(result2.stealthAddress.ethAddress)
    })
  })

  describe('deriveEthereumStealthPrivateKey', () => {
    it('should derive the correct private key', () => {
      const meta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta.metaAddress)

      const recovery = deriveEthereumStealthPrivateKey(
        stealth.stealthAddress,
        meta.spendingPrivateKey,
        meta.viewingPrivateKey
      )

      expect(recovery.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(recovery.stealthAddress).toBe(stealth.stealthAddress.address)
      expect(recovery.ethAddress).toBe(stealth.stealthAddress.ethAddress)
    })
  })

  describe('checkEthereumStealthAddress', () => {
    it('should return true for matching stealth address', () => {
      const meta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta.metaAddress)

      const isOwner = checkEthereumStealthAddress(
        stealth.stealthAddress,
        meta.spendingPrivateKey,
        meta.viewingPrivateKey
      )

      expect(isOwner).toBe(true)
    })

    it('should return false for non-matching stealth address', () => {
      const meta1 = generateEthereumStealthMetaAddress()
      const meta2 = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta1.metaAddress)

      const isOwner = checkEthereumStealthAddress(
        stealth.stealthAddress,
        meta2.spendingPrivateKey,
        meta2.viewingPrivateKey
      )

      expect(isOwner).toBe(false)
    })
  })

  describe('stealthPublicKeyToEthAddress', () => {
    it('should convert a public key to Ethereum address', () => {
      const meta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta.metaAddress)

      const ethAddress = stealthPublicKeyToEthAddress(stealth.stealthAddress.address)

      expect(ethAddress).toBe(stealth.stealthAddress.ethAddress)
      expect(ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })
  })

  describe('extractPublicKeys', () => {
    it('should extract spending and viewing public keys', () => {
      const meta = generateEthereumStealthMetaAddress()
      const { spendingPublicKey, viewingPublicKey } = extractPublicKeys(meta.metaAddress)

      expect(spendingPublicKey).toBe(meta.metaAddress.spendingKey)
      expect(viewingPublicKey).toBe(meta.metaAddress.viewingKey)
    })
  })

  describe('createMetaAddressFromPublicKeys', () => {
    it('should create meta-address from public keys', () => {
      const original = generateEthereumStealthMetaAddress()
      const created = createMetaAddressFromPublicKeys(
        original.metaAddress.spendingKey,
        original.metaAddress.viewingKey,
        'Test Label'
      )

      expect(created.spendingKey).toBe(original.metaAddress.spendingKey)
      expect(created.viewingKey).toBe(original.metaAddress.viewingKey)
      expect(created.chain).toBe('ethereum')
      expect(created.schemeId).toBe(1)
      expect(created.label).toBe('Test Label')
    })
  })

  describe('constants', () => {
    it('should have correct EIP5564_PREFIX', () => {
      expect(EIP5564_PREFIX).toBe('st:eth:0x')
    })

    it('should have correct SCHEME_ID', () => {
      expect(SCHEME_ID).toBe(1)
    })

    it('should return correct scheme ID from function', () => {
      expect(getSchemeId()).toBe(1)
    })
  })
})
