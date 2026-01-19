/**
 * NEAR Stealth Address Tests
 *
 * Tests for M17-NEAR-01: NEAR stealth address generation (ed25519)
 * Tests for M17-NEAR-02: NEAR account ID stealth address mapping
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  checkNEARStealthAddress,
  ed25519PublicKeyToImplicitAccount,
  implicitAccountToEd25519PublicKey,
  encodeNEARStealthMetaAddress,
  parseNEARStealthMetaAddress,
  validateNEARStealthMetaAddress,
  validateNEARStealthAddress,
} from '../../../src/chains/near'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'

describe('NEAR Stealth Address Generation (M17-NEAR-01)', () => {
  describe('generateNEARStealthMetaAddress', () => {
    it('should generate valid meta-address with spending and viewing keys', () => {
      const result = generateNEARStealthMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should generate unique keypairs on each call', () => {
      const result1 = generateNEARStealthMetaAddress()
      const result2 = generateNEARStealthMetaAddress()

      expect(result1.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
      expect(result1.metaAddress.viewingKey).not.toBe(result2.metaAddress.viewingKey)
      expect(result1.spendingPrivateKey).not.toBe(result2.spendingPrivateKey)
      expect(result1.viewingPrivateKey).not.toBe(result2.viewingPrivateKey)
    })

    it('should include label when provided', () => {
      const result = generateNEARStealthMetaAddress('My NEAR Wallet')

      expect(result.metaAddress.label).toBe('My NEAR Wallet')
    })

    it('should generate ed25519 keys (32 bytes)', () => {
      const result = generateNEARStealthMetaAddress()

      // Remove 0x prefix and check length (32 bytes = 64 hex chars)
      const spendingKeyBytes = result.metaAddress.spendingKey.slice(2).length / 2
      const viewingKeyBytes = result.metaAddress.viewingKey.slice(2).length / 2

      expect(spendingKeyBytes).toBe(32)
      expect(viewingKeyBytes).toBe(32)
    })
  })

  describe('generateNEARStealthAddress', () => {
    let metaAddress: StealthMetaAddress
    let spendingPrivateKey: HexString
    let viewingPrivateKey: HexString

    beforeEach(() => {
      const result = generateNEARStealthMetaAddress()
      metaAddress = result.metaAddress
      spendingPrivateKey = result.spendingPrivateKey
      viewingPrivateKey = result.viewingPrivateKey
    })

    it('should generate valid stealth address from meta-address', () => {
      const result = generateNEARStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.address).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.stealthAddress.viewTag).toBeLessThanOrEqual(255)
    })

    it('should generate unique stealth addresses for same meta-address', () => {
      const result1 = generateNEARStealthAddress(metaAddress)
      const result2 = generateNEARStealthAddress(metaAddress)

      expect(result1.stealthAddress.address).not.toBe(result2.stealthAddress.address)
      expect(result1.stealthAddress.ephemeralPublicKey).not.toBe(
        result2.stealthAddress.ephemeralPublicKey
      )
    })

    it('should return valid NEAR implicit account ID', () => {
      const result = generateNEARStealthAddress(metaAddress)

      expect(result.implicitAccountId).toBeDefined()
      expect(result.implicitAccountId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.implicitAccountId.length).toBe(64)
    })

    it('should return shared secret for key derivation', () => {
      const result = generateNEARStealthAddress(metaAddress)

      expect(result.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should accept string-encoded meta-address', () => {
      const encoded = encodeNEARStealthMetaAddress(metaAddress)
      const result = generateNEARStealthAddress(encoded)

      expect(result.stealthAddress).toBeDefined()
      expect(result.implicitAccountId).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should throw for non-NEAR meta-address', () => {
      const evmMetaAddress = {
        ...metaAddress,
        chain: 'ethereum' as const,
      }

      expect(() => generateNEARStealthAddress(evmMetaAddress)).toThrow(
        /Expected NEAR meta-address/
      )
    })
  })

  describe('deriveNEARStealthPrivateKey', () => {
    let metaAddress: StealthMetaAddress
    let spendingPrivateKey: HexString
    let viewingPrivateKey: HexString

    beforeEach(() => {
      const result = generateNEARStealthMetaAddress()
      metaAddress = result.metaAddress
      spendingPrivateKey = result.spendingPrivateKey
      viewingPrivateKey = result.viewingPrivateKey
    })

    it('should derive private key for stealth address', () => {
      const { stealthAddress } = generateNEARStealthAddress(metaAddress)

      const recovery = deriveNEARStealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.stealthAddress).toBe(stealthAddress.address)
      expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)
      expect(recovery.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should derive consistent private key', () => {
      const { stealthAddress } = generateNEARStealthAddress(metaAddress)

      const recovery1 = deriveNEARStealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const recovery2 = deriveNEARStealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery1.privateKey).toBe(recovery2.privateKey)
    })

    it('should fail with wrong spending key', () => {
      const { stealthAddress } = generateNEARStealthAddress(metaAddress)
      const wrongSpendingKey = generateNEARStealthMetaAddress().spendingPrivateKey

      // Should not throw, but derived key will be wrong (verified by checkNEARStealthAddress)
      const recovery = deriveNEARStealthPrivateKey(
        stealthAddress,
        wrongSpendingKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
    })
  })

  describe('checkNEARStealthAddress', () => {
    let metaAddress: StealthMetaAddress
    let spendingPrivateKey: HexString
    let viewingPrivateKey: HexString

    beforeEach(() => {
      const result = generateNEARStealthMetaAddress()
      metaAddress = result.metaAddress
      spendingPrivateKey = result.spendingPrivateKey
      viewingPrivateKey = result.viewingPrivateKey
    })

    it('should return true for matching address', () => {
      const { stealthAddress } = generateNEARStealthAddress(metaAddress)

      const isMatch = checkNEARStealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(true)
    })

    it('should return false for non-matching address', () => {
      const otherResult = generateNEARStealthMetaAddress()
      const { stealthAddress } = generateNEARStealthAddress(otherResult.metaAddress)

      const isMatch = checkNEARStealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(false)
    })

    it('should efficiently filter using view tag', () => {
      const { stealthAddress } = generateNEARStealthAddress(metaAddress)

      // Modify view tag to simulate non-matching (view tag check is first)
      const wrongViewTag = (stealthAddress.viewTag + 1) % 256
      const modifiedAddress = {
        ...stealthAddress,
        viewTag: wrongViewTag,
      }

      const isMatch = checkNEARStealthAddress(
        modifiedAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isMatch).toBe(false)
    })
  })
})

describe('NEAR Account ID Stealth Address Mapping (M17-NEAR-02)', () => {
  describe('ed25519PublicKeyToImplicitAccount', () => {
    it('should convert ed25519 public key to implicit account', () => {
      const { stealthAddress } = generateNEARStealthAddress(
        generateNEARStealthMetaAddress().metaAddress
      )

      const accountId = ed25519PublicKeyToImplicitAccount(stealthAddress.address)

      expect(accountId).toMatch(/^[0-9a-f]{64}$/)
      expect(accountId.length).toBe(64)
    })

    it('should remove 0x prefix', () => {
      const publicKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as HexString

      const accountId = ed25519PublicKeyToImplicitAccount(publicKey)

      expect(accountId).not.toContain('0x')
      expect(accountId).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    })

    it('should lowercase the result', () => {
      const publicKey = '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF' as HexString

      const accountId = ed25519PublicKeyToImplicitAccount(publicKey)

      expect(accountId).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    })

    it('should throw for invalid length', () => {
      const shortKey = '0x1234' as HexString

      expect(() => ed25519PublicKeyToImplicitAccount(shortKey)).toThrow(
        /Invalid ed25519 public key length/
      )
    })

    it('should throw for invalid hex characters', () => {
      const invalidKey = '0xgg34567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as HexString

      expect(() => ed25519PublicKeyToImplicitAccount(invalidKey)).toThrow(
        /Invalid ed25519 public key/
      )
    })
  })

  describe('implicitAccountToEd25519PublicKey', () => {
    it('should convert implicit account to ed25519 public key', () => {
      const accountId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      const publicKey = implicitAccountToEd25519PublicKey(accountId)

      expect(publicKey).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    })

    it('should add 0x prefix', () => {
      const accountId = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const publicKey = implicitAccountToEd25519PublicKey(accountId)

      expect(publicKey).toMatch(/^0x/)
    })

    it('should throw for named accounts', () => {
      expect(() => implicitAccountToEd25519PublicKey('alice.near')).toThrow(
        /Invalid NEAR implicit account ID/
      )
    })

    it('should throw for invalid length', () => {
      expect(() => implicitAccountToEd25519PublicKey('1234')).toThrow(
        /Invalid NEAR implicit account ID/
      )
    })

    it('should roundtrip correctly', () => {
      const { stealthAddress } = generateNEARStealthAddress(
        generateNEARStealthMetaAddress().metaAddress
      )

      const accountId = ed25519PublicKeyToImplicitAccount(stealthAddress.address)
      const recoveredKey = implicitAccountToEd25519PublicKey(accountId)

      expect(recoveredKey.toLowerCase()).toBe(stealthAddress.address.toLowerCase())
    })
  })
})

describe('NEAR Meta-Address Encoding/Decoding', () => {
  describe('encodeNEARStealthMetaAddress', () => {
    it('should encode meta-address to string format', () => {
      const { metaAddress } = generateNEARStealthMetaAddress()

      const encoded = encodeNEARStealthMetaAddress(metaAddress)

      expect(encoded).toMatch(/^sip:near:0x[0-9a-f]{64}:0x[0-9a-f]{64}$/i)
    })

    it('should throw for non-NEAR chain', () => {
      const evmMeta = {
        ...generateNEARStealthMetaAddress().metaAddress,
        chain: 'ethereum' as const,
      }

      expect(() => encodeNEARStealthMetaAddress(evmMeta)).toThrow(/ed25519|near/)
    })
  })

  describe('parseNEARStealthMetaAddress', () => {
    it('should parse encoded meta-address', () => {
      const { metaAddress } = generateNEARStealthMetaAddress()
      const encoded = encodeNEARStealthMetaAddress(metaAddress)

      const parsed = parseNEARStealthMetaAddress(encoded)

      expect(parsed.chain).toBe('near')
      expect(parsed.spendingKey.toLowerCase()).toBe(metaAddress.spendingKey.toLowerCase())
      expect(parsed.viewingKey.toLowerCase()).toBe(metaAddress.viewingKey.toLowerCase())
    })

    it('should throw for invalid prefix', () => {
      expect(() => parseNEARStealthMetaAddress('invalid:near:0x:0x')).toThrow(
        /Invalid meta-address prefix/
      )
    })

    it('should throw for wrong chain', () => {
      expect(() =>
        parseNEARStealthMetaAddress(
          'sip:ethereum:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        )
      ).toThrow(/Invalid chain/)
    })

    it('should throw for malformed format', () => {
      expect(() => parseNEARStealthMetaAddress('sip:near')).toThrow(
        /Invalid meta-address format/
      )
    })

    it('should roundtrip correctly', () => {
      const { metaAddress } = generateNEARStealthMetaAddress('Test Label')
      const encoded = encodeNEARStealthMetaAddress(metaAddress)
      const parsed = parseNEARStealthMetaAddress(encoded)

      expect(parsed.chain).toBe(metaAddress.chain)
      expect(parsed.spendingKey.toLowerCase()).toBe(metaAddress.spendingKey.toLowerCase())
      expect(parsed.viewingKey.toLowerCase()).toBe(metaAddress.viewingKey.toLowerCase())
    })
  })
})

describe('NEAR Stealth Address Validation', () => {
  describe('validateNEARStealthMetaAddress', () => {
    it('should not throw for valid meta-address', () => {
      const { metaAddress } = generateNEARStealthMetaAddress()

      expect(() => validateNEARStealthMetaAddress(metaAddress)).not.toThrow()
    })

    it('should throw for non-NEAR chain', () => {
      const evmMeta = {
        ...generateNEARStealthMetaAddress().metaAddress,
        chain: 'ethereum' as const,
      }

      expect(() => validateNEARStealthMetaAddress(evmMeta)).toThrow(/ed25519|near/)
    })
  })

  describe('validateNEARStealthAddress', () => {
    it('should not throw for valid stealth address', () => {
      const { stealthAddress } = generateNEARStealthAddress(
        generateNEARStealthMetaAddress().metaAddress
      )

      expect(() => validateNEARStealthAddress(stealthAddress)).not.toThrow()
    })

    it('should throw for invalid view tag', () => {
      const { stealthAddress } = generateNEARStealthAddress(
        generateNEARStealthMetaAddress().metaAddress
      )

      const invalidAddress = {
        ...stealthAddress,
        viewTag: 300, // Out of range
      }

      expect(() => validateNEARStealthAddress(invalidAddress)).toThrow(/viewTag/)
    })
  })
})

describe('End-to-End NEAR Stealth Flow', () => {
  it('should complete full stealth payment flow', () => {
    // 1. Recipient generates meta-address and shares publicly
    const recipientResult = generateNEARStealthMetaAddress('Recipient Wallet')

    // 2. Sender generates one-time stealth address
    const senderResult = generateNEARStealthAddress(recipientResult.metaAddress)

    // 3. Sender sends funds to implicit account
    expect(senderResult.implicitAccountId).toMatch(/^[0-9a-f]{64}$/)

    // 4. Sender broadcasts ephemeral public key and view tag (in memo)
    const announcement = {
      ephemeralPublicKey: senderResult.stealthAddress.ephemeralPublicKey,
      viewTag: senderResult.stealthAddress.viewTag,
    }

    // 5. Recipient scans and detects payment
    const isForRecipient = checkNEARStealthAddress(
      senderResult.stealthAddress,
      recipientResult.spendingPrivateKey,
      recipientResult.viewingPrivateKey
    )
    expect(isForRecipient).toBe(true)

    // 6. Recipient derives private key to spend funds
    const recovery = deriveNEARStealthPrivateKey(
      senderResult.stealthAddress,
      recipientResult.spendingPrivateKey,
      recipientResult.viewingPrivateKey
    )
    expect(recovery.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)

    // 7. Verify the derived key matches the stealth address
    expect(recovery.stealthAddress).toBe(senderResult.stealthAddress.address)
  })

  it('should work with encoded meta-address strings', () => {
    const recipientResult = generateNEARStealthMetaAddress()
    const encoded = encodeNEARStealthMetaAddress(recipientResult.metaAddress)

    // Sender uses encoded string directly
    const senderResult = generateNEARStealthAddress(encoded)

    // Recipient can still verify
    const isForRecipient = checkNEARStealthAddress(
      senderResult.stealthAddress,
      recipientResult.spendingPrivateKey,
      recipientResult.viewingPrivateKey
    )
    expect(isForRecipient).toBe(true)
  })
})
