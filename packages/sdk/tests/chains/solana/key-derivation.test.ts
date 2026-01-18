/**
 * Solana Key Derivation Tests
 *
 * Tests for BIP39 mnemonic to SIP stealth key derivation.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveSolanaStealthKeys,
  deriveViewingKeyFromSpending,
  generateMnemonic,
  isValidMnemonic,
  validateMnemonic,
  validateDerivationPath,
  getDerivationPath,
  SOLANA_DEFAULT_PATH,
} from '../../../src/chains/solana/key-derivation'
import {
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  ed25519PublicKeyToSolanaAddress,
  isValidSolanaAddress,
} from '../../../src/stealth'
import { ed25519 } from '@noble/curves/ed25519'

// Standard BIP39 test vector (12 words)
const TEST_MNEMONIC_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// 24-word mnemonic
const TEST_MNEMONIC_24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

describe('Solana Key Derivation', () => {
  // ─── deriveSolanaStealthKeys ─────────────────────────────────────────────────

  describe('deriveSolanaStealthKeys', () => {
    it('should derive keys from 12-word mnemonic', () => {
      const result = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      // Verify structure
      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('solana')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(result.derivationPath).toBe(SOLANA_DEFAULT_PATH)
    })

    it('should derive keys from 24-word mnemonic', () => {
      const result = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_24,
      })

      expect(result.metaAddress.chain).toBe('solana')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should produce different keys for different mnemonics', () => {
      const result1 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const result2 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_24,
      })

      expect(result1.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
      expect(result1.metaAddress.viewingKey).not.toBe(result2.metaAddress.viewingKey)
    })

    it('should produce deterministic output (same mnemonic = same keys)', () => {
      const result1 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const result2 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      expect(result1.metaAddress.spendingKey).toBe(result2.metaAddress.spendingKey)
      expect(result1.metaAddress.viewingKey).toBe(result2.metaAddress.viewingKey)
      expect(result1.spendingPrivateKey).toBe(result2.spendingPrivateKey)
      expect(result1.viewingPrivateKey).toBe(result2.viewingPrivateKey)
    })

    it('should use custom derivation path', () => {
      const customPath = "m/44'/501'/1'/0'"
      const result = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        derivationPath: customPath,
      })

      expect(result.derivationPath).toBe(customPath)
    })

    it('should derive different keys for different accounts', () => {
      const result0 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        accountIndex: 0,
      })

      const result1 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        accountIndex: 1,
      })

      const result2 = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        accountIndex: 2,
      })

      // All should be different
      expect(result0.metaAddress.spendingKey).not.toBe(result1.metaAddress.spendingKey)
      expect(result1.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
      expect(result0.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
    })

    it('should handle passphrase', () => {
      const withoutPassphrase = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const withPassphrase = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        passphrase: 'secret',
      })

      // Different passphrase = different keys
      expect(withoutPassphrase.metaAddress.spendingKey).not.toBe(withPassphrase.metaAddress.spendingKey)
    })

    it('should include label in meta-address', () => {
      const result = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
        label: 'My Trading Account',
      })

      expect(result.metaAddress.label).toBe('My Trading Account')
    })

    it('should throw for invalid mnemonic', () => {
      expect(() =>
        deriveSolanaStealthKeys({
          mnemonic: 'invalid mnemonic phrase',
        })
      ).toThrow()
    })

    it('should throw for wrong word count', () => {
      expect(() =>
        deriveSolanaStealthKeys({
          mnemonic: 'abandon abandon abandon', // Only 3 words
        })
      ).toThrow()
    })

    it('should throw for non-hardened path', () => {
      expect(() =>
        deriveSolanaStealthKeys({
          mnemonic: TEST_MNEMONIC_12,
          derivationPath: "m/44/501/0/0", // Missing hardened indicators
        })
      ).toThrow('hardened')
    })
  })

  // ─── Stealth Address Integration ─────────────────────────────────────────────

  describe('Integration with Stealth Addresses', () => {
    it('should generate valid stealth addresses from derived keys', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Should produce valid Solana address
      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      expect(isValidSolanaAddress(solanaAddress)).toBe(true)
    })

    it('should verify stealth address ownership with derived keys', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Check if it's ours
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isOurs).toBe(true)
    })

    it('should derive private key for received payment', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      // Generate stealth address (simulating sender)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      // Derive private key (as recipient)
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Verify the derived key matches the stealth address
      expect(recovery.stealthAddress).toBe(stealthAddress.address)

      // Verify we can derive the correct public key
      const privateKeyBytes = Buffer.from(recovery.privateKey.slice(2), 'hex')
      const scalar = BigInt('0x' + privateKeyBytes.reverse().toString('hex'))
      const derivedPubPoint = ed25519.ExtendedPoint.BASE.multiply(
        scalar % (2n ** 252n + 27742317777372353535851937790883648493n)
      )
      const derivedPubKey = '0x' + Buffer.from(derivedPubPoint.toRawBytes()).toString('hex')

      expect(derivedPubKey.toLowerCase()).toBe(stealthAddress.address.toLowerCase())
    })

    it('should produce unique stealth addresses for each payment', () => {
      const { metaAddress } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const addresses: string[] = []
      for (let i = 0; i < 10; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        addresses.push(stealthAddress.address)
      }

      // All should be unique
      const unique = new Set(addresses)
      expect(unique.size).toBe(10)
    })
  })

  // ─── deriveViewingKeyFromSpending ────────────────────────────────────────────

  describe('deriveViewingKeyFromSpending', () => {
    it('should derive viewing key from spending key', () => {
      const { spendingPrivateKey, viewingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const derived = deriveViewingKeyFromSpending(spendingPrivateKey)

      expect(derived).toBe(viewingPrivateKey)
    })

    it('should be deterministic', () => {
      const { spendingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      const derived1 = deriveViewingKeyFromSpending(spendingPrivateKey)
      const derived2 = deriveViewingKeyFromSpending(spendingPrivateKey)

      expect(derived1).toBe(derived2)
    })

    it('should throw for invalid spending key', () => {
      expect(() => deriveViewingKeyFromSpending('invalid')).toThrow()
      expect(() => deriveViewingKeyFromSpending('0xabc' as any)).toThrow() // Wrong length
    })
  })

  // ─── Mnemonic Utilities ──────────────────────────────────────────────────────

  describe('generateMnemonic', () => {
    it('should generate 12-word mnemonic by default', () => {
      const mnemonic = generateMnemonic()
      const words = mnemonic.split(' ')

      expect(words.length).toBe(12)
      expect(isValidMnemonic(mnemonic)).toBe(true)
    })

    it('should generate 24-word mnemonic when requested', () => {
      const mnemonic = generateMnemonic(256)
      const words = mnemonic.split(' ')

      expect(words.length).toBe(24)
      expect(isValidMnemonic(mnemonic)).toBe(true)
    })

    it('should produce unique mnemonics', () => {
      const mnemonic1 = generateMnemonic()
      const mnemonic2 = generateMnemonic()

      expect(mnemonic1).not.toBe(mnemonic2)
    })
  })

  describe('isValidMnemonic', () => {
    it('should return true for valid mnemonics', () => {
      expect(isValidMnemonic(TEST_MNEMONIC_12)).toBe(true)
      expect(isValidMnemonic(TEST_MNEMONIC_24)).toBe(true)
    })

    it('should return false for invalid mnemonics', () => {
      expect(isValidMnemonic('invalid')).toBe(false)
      expect(isValidMnemonic('')).toBe(false)
      expect(isValidMnemonic('abandon abandon abandon')).toBe(false) // Wrong count
    })
  })

  describe('validateMnemonic', () => {
    it('should return true for valid mnemonic', () => {
      expect(validateMnemonic(TEST_MNEMONIC_12)).toBe(true)
    })

    it('should throw for invalid mnemonic', () => {
      expect(() => validateMnemonic('invalid')).toThrow()
    })
  })

  // ─── Derivation Path Utilities ───────────────────────────────────────────────

  describe('validateDerivationPath', () => {
    it('should accept valid paths', () => {
      expect(validateDerivationPath("m/44'/501'/0'/0'")).toBe(true)
      expect(validateDerivationPath("m/44'/501'/1'/0'")).toBe(true)
      expect(validateDerivationPath("m/44'/501'/0'/1'")).toBe(true)
    })

    it('should throw for invalid paths', () => {
      expect(() => validateDerivationPath('')).toThrow()
      expect(() => validateDerivationPath('invalid')).toThrow()
      expect(() => validateDerivationPath("44'/501'/0'/0'")).toThrow() // Missing m/
    })
  })

  describe('getDerivationPath', () => {
    it('should return default path for index 0', () => {
      expect(getDerivationPath(0)).toBe("m/44'/501'/0'/0'")
    })

    it('should return correct path for other indices', () => {
      expect(getDerivationPath(1)).toBe("m/44'/501'/1'/0'")
      expect(getDerivationPath(5)).toBe("m/44'/501'/5'/0'")
      expect(getDerivationPath(100)).toBe("m/44'/501'/100'/0'")
    })

    it('should throw for negative index', () => {
      expect(() => getDerivationPath(-1)).toThrow()
    })
  })

  describe('SOLANA_DEFAULT_PATH', () => {
    it('should be standard Solana path', () => {
      expect(SOLANA_DEFAULT_PATH).toBe("m/44'/501'/0'/0'")
    })
  })

  // ─── Edge Cases ──────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle mnemonic with extra whitespace', () => {
      const messyMnemonic = '  abandon  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  '
      const result = deriveSolanaStealthKeys({
        mnemonic: messyMnemonic,
      })

      // Compare with clean mnemonic
      const cleanResult = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      expect(result.metaAddress.spendingKey).toBe(cleanResult.metaAddress.spendingKey)
    })

    it('should handle uppercase mnemonic', () => {
      const uppercaseMnemonic = TEST_MNEMONIC_12.toUpperCase()
      const result = deriveSolanaStealthKeys({
        mnemonic: uppercaseMnemonic,
      })

      const lowercaseResult = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      expect(result.metaAddress.spendingKey).toBe(lowercaseResult.metaAddress.spendingKey)
    })

    it('should derive valid ed25519 public keys', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = deriveSolanaStealthKeys({
        mnemonic: TEST_MNEMONIC_12,
      })

      // Verify spending key is valid ed25519
      const spendingPubBytes = Buffer.from(metaAddress.spendingKey.slice(2), 'hex')
      expect(() => ed25519.ExtendedPoint.fromHex(spendingPubBytes)).not.toThrow()

      // Verify viewing key is valid ed25519
      const viewingPubBytes = Buffer.from(metaAddress.viewingKey.slice(2), 'hex')
      expect(() => ed25519.ExtendedPoint.fromHex(viewingPubBytes)).not.toThrow()
    })

    it('should work with many account indices', () => {
      for (let i = 0; i < 20; i++) {
        const result = deriveSolanaStealthKeys({
          mnemonic: TEST_MNEMONIC_12,
          accountIndex: i,
        })

        expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
        expect(result.derivationPath).toBe(`m/44'/501'/${i}'/0'`)
      }
    })
  })
})
