/**
 * Security Fuzzing Tests
 *
 * Property-based testing using fast-check to discover edge cases
 * and potential security vulnerabilities in cryptographic operations.
 *
 * @see docs/security/SELF-AUDIT.md
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  commit,
  verifyOpening,
  addCommitments,
  subtractCommitments,
  addBlindings,
  subtractBlindings,
  generateBlinding,
} from '../../src/commitment'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '../../src/stealth'
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../../src/privacy'
import {
  isValidHex,
  isValidCompressedPublicKey,
  isValidPrivateKey,
  isValidChainId,
  isValidAmount,
  isValidSlippage,
} from '../../src/validation'
import { hash, generateRandomBytes } from '../../src/crypto'
import type { ChainId } from '@sip-protocol/types'

// ─── Arbitrary Generators ─────────────────────────────────────────────────────

/**
 * Generate valid commitment values (0 to reasonable max)
 */
const arbCommitmentValue = fc.bigInt({
  min: 0n,
  max: 2n ** 64n - 1n, // Max u64
})

/**
 * Generate valid blinding factors (32 bytes)
 */
const arbBlinding = fc.uint8Array({ minLength: 32, maxLength: 32 })

/**
 * Generate valid chain IDs
 */
const arbChainId = fc.constantFrom<ChainId>(
  'ethereum',
  'solana',
  'near',
  'zcash',
  'polygon',
  'arbitrum',
  'optimism',
  'base'
)

/**
 * Generate valid secp256k1 chain IDs
 */
const arbSecp256k1ChainId = fc.constantFrom<ChainId>(
  'ethereum',
  'zcash',
  'polygon',
  'arbitrum',
  'optimism',
  'base'
)

/**
 * Generate valid hex strings
 */
const arbHexString = fc
  .uint8Array({ minLength: 1, maxLength: 64 })
  .map((bytes) => '0x' + Buffer.from(bytes).toString('hex'))

/**
 * Generate valid amounts (positive bigint)
 */
const arbPositiveAmount = fc.bigInt({ min: 1n, max: 2n ** 128n })

/**
 * Generate valid slippage (0 to 0.99)
 */
const arbSlippage = fc.float({ min: 0, max: Math.fround(0.99), noNaN: true })

/**
 * Generate invalid hex strings (for negative testing)
 */
const arbInvalidHex = fc.oneof(
  fc.constant(''),
  fc.constant('0x'),
  fc.constant('not-hex'),
  fc.constant('0xGGGG'),
  fc.string().filter((s) => !s.startsWith('0x')),
)

// ─── Pedersen Commitment Fuzzing ──────────────────────────────────────────────

describe('Pedersen Commitment Fuzzing', () => {
  it('commitment round-trip: commit → verify always succeeds', () => {
    fc.assert(
      fc.property(arbCommitmentValue, arbBlinding, (value, blinding) => {
        const { commitment, blinding: b } = commit(value, blinding)
        const valid = verifyOpening(commitment, value, b)
        expect(valid).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it('commitment binding: different values produce different commitments', () => {
    fc.assert(
      fc.property(
        arbCommitmentValue,
        arbCommitmentValue.filter((v) => v > 0n),
        arbBlinding,
        (value1, diff, blinding) => {
          // Ensure values are different
          const value2 = value1 + diff
          if (value2 >= 2n ** 64n) return // Skip overflow cases

          const c1 = commit(value1, blinding)
          const c2 = commit(value2, blinding)

          // Same blinding, different values = different commitments
          expect(c1.commitment).not.toBe(c2.commitment)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('commitment hiding: same value with different blindings produces different commitments', () => {
    fc.assert(
      fc.property(arbCommitmentValue, (value) => {
        const c1 = commit(value)
        const c2 = commit(value)

        // Different random blindings = different commitments
        expect(c1.commitment).not.toBe(c2.commitment)
        expect(c1.blinding).not.toBe(c2.blinding)
      }),
      { numRuns: 200 }
    )
  })

  it('homomorphic addition: C(a) + C(b) opens to a + b', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 2n ** 32n }),
        fc.bigInt({ min: 0n, max: 2n ** 32n }),
        (a, b) => {
          const c1 = commit(a)
          const c2 = commit(b)

          const sum = addCommitments(c1.commitment, c2.commitment)
          const blindingSum = addBlindings(c1.blinding, c2.blinding)

          const valid = verifyOpening(sum.commitment, a + b, blindingSum)
          expect(valid).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('homomorphic subtraction: C(a) - C(b) opens to a - b', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 100n, max: 2n ** 32n }),
        fc.bigInt({ min: 0n, max: 99n }),
        (a, b) => {
          // Ensure a > b for positive result
          const c1 = commit(a)
          const c2 = commit(b)

          const diff = subtractCommitments(c1.commitment, c2.commitment)
          const blindingDiff = subtractBlindings(c1.blinding, c2.blinding)

          const valid = verifyOpening(diff.commitment, a - b, blindingDiff)
          expect(valid).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('wrong value fails verification', () => {
    fc.assert(
      fc.property(
        arbCommitmentValue,
        fc.bigInt({ min: 1n, max: 1000n }),
        (value, offset) => {
          const { commitment, blinding } = commit(value)
          const wrongValue = value + offset

          const valid = verifyOpening(commitment, wrongValue, blinding)
          expect(valid).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('rejects negative values', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -1000n, max: -1n }), (negativeValue) => {
        expect(() => commit(negativeValue)).toThrow()
      }),
      { numRuns: 100 }
    )
  })
})

// ─── Stealth Address Fuzzing ──────────────────────────────────────────────────

describe('Stealth Address Fuzzing (secp256k1)', () => {
  it('round-trip: generate → check always succeeds', () => {
    fc.assert(
      fc.property(arbSecp256k1ChainId, (chain) => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
          generateStealthMetaAddress(chain)

        const { stealthAddress } = generateStealthAddress(metaAddress)

        const isOurs = checkStealthAddress(
          stealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )

        expect(isOurs).toBe(true)
      }),
      { numRuns: 50 } // Slower due to EC operations
    )
  })

  it('private key derivation produces correct address', () => {
    fc.assert(
      fc.property(arbSecp256k1ChainId, (chain) => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
          generateStealthMetaAddress(chain)

        const { stealthAddress } = generateStealthAddress(metaAddress)

        const recovery = deriveStealthPrivateKey(
          stealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )

        expect(recovery.stealthAddress).toBe(stealthAddress.address)
        expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)
        expect(recovery.privateKey).toBeDefined()
      }),
      { numRuns: 50 }
    )
  })

  it('wrong keys fail check', () => {
    fc.assert(
      fc.property(arbSecp256k1ChainId, arbSecp256k1ChainId, (chain1, chain2) => {
        const meta1 = generateStealthMetaAddress(chain1)
        const meta2 = generateStealthMetaAddress(chain2)

        const { stealthAddress } = generateStealthAddress(meta1.metaAddress)

        // Use wrong keys
        const isOurs = checkStealthAddress(
          stealthAddress,
          meta2.spendingPrivateKey,
          meta2.viewingPrivateKey
        )

        expect(isOurs).toBe(false)
      }),
      { numRuns: 30 }
    )
  })

  it('encode/decode round-trip preserves data', () => {
    fc.assert(
      fc.property(arbSecp256k1ChainId, fc.string(), (chain, label) => {
        const { metaAddress } = generateStealthMetaAddress(chain, label || undefined)

        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(metaAddress.chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
        expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
      }),
      { numRuns: 100 }
    )
  })

  it('each generation produces unique addresses', () => {
    fc.assert(
      fc.property(arbSecp256k1ChainId, (chain) => {
        const { metaAddress } = generateStealthMetaAddress(chain)

        const addr1 = generateStealthAddress(metaAddress)
        const addr2 = generateStealthAddress(metaAddress)

        // Same meta-address, different stealth addresses (different ephemeral keys)
        expect(addr1.stealthAddress.address).not.toBe(addr2.stealthAddress.address)
        expect(addr1.stealthAddress.ephemeralPublicKey).not.toBe(
          addr2.stealthAddress.ephemeralPublicKey
        )
      }),
      { numRuns: 50 }
    )
  })
})

// ─── Viewing Key & Encryption Fuzzing ─────────────────────────────────────────

describe('Viewing Key Fuzzing', () => {
  it('encryption round-trip preserves data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 2147483647 }),
        (sender, recipient, amount, timestamp) => {
          const viewingKey = generateViewingKey()
          const data = { sender, recipient, amount, timestamp }

          const encrypted = encryptForViewing(data, viewingKey)
          const decrypted = decryptWithViewing(encrypted, viewingKey)

          expect(decrypted.sender).toBe(sender)
          expect(decrypted.recipient).toBe(recipient)
          expect(decrypted.amount).toBe(amount)
          expect(decrypted.timestamp).toBe(timestamp)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('different keys fail decryption', () => {
    fc.assert(
      fc.property(fc.string(), (randomData) => {
        const key1 = generateViewingKey()
        const key2 = generateViewingKey()

        const data = {
          sender: '0x1234',
          recipient: '0x5678',
          amount: '100',
          timestamp: Date.now(),
        }

        const encrypted = encryptForViewing(data, key1)

        expect(() => decryptWithViewing(encrypted, key2)).toThrow()
      }),
      { numRuns: 50 }
    )
  })

  it('child key derivation is deterministic', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (childPath) => {
        const masterKey = generateViewingKey()

        const child1 = deriveViewingKey(masterKey, childPath)
        const child2 = deriveViewingKey(masterKey, childPath)

        expect(child1.key).toBe(child2.key)
        expect(child1.hash).toBe(child2.hash)
        expect(child1.path).toBe(child2.path)
      }),
      { numRuns: 100 }
    )
  })

  it('different paths produce different keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (path1, path2) => {
          fc.pre(path1 !== path2) // Skip if paths are equal

          const masterKey = generateViewingKey()

          const child1 = deriveViewingKey(masterKey, path1)
          const child2 = deriveViewingKey(masterKey, path2)

          expect(child1.key).not.toBe(child2.key)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('encryption produces unique ciphertexts (random nonce)', () => {
    fc.assert(
      fc.property(fc.nat(), (_) => {
        const viewingKey = generateViewingKey()
        const data = {
          sender: '0x1234',
          recipient: '0x5678',
          amount: '100',
          timestamp: Date.now(),
        }

        const enc1 = encryptForViewing(data, viewingKey)
        const enc2 = encryptForViewing(data, viewingKey)

        // Same plaintext, different ciphertexts (random nonce)
        expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
        expect(enc1.nonce).not.toBe(enc2.nonce)
      }),
      { numRuns: 50 }
    )
  })
})

// ─── Validation Fuzzing ───────────────────────────────────────────────────────

describe('Validation Fuzzing', () => {
  it('isValidHex accepts valid hex strings', () => {
    fc.assert(
      fc.property(arbHexString, (hex) => {
        expect(isValidHex(hex)).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it('isValidHex rejects invalid inputs', () => {
    fc.assert(
      fc.property(arbInvalidHex, (invalid) => {
        expect(isValidHex(invalid)).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('isValidChainId accepts valid chains', () => {
    fc.assert(
      fc.property(arbChainId, (chain) => {
        expect(isValidChainId(chain)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('isValidChainId rejects random strings', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base'].includes(s)),
        (randomChain) => {
          expect(isValidChainId(randomChain)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('isValidAmount accepts positive bigints', () => {
    fc.assert(
      fc.property(arbPositiveAmount, (amount) => {
        expect(isValidAmount(amount)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('isValidAmount rejects zero and negative', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -1000n, max: 0n }), (amount) => {
        expect(isValidAmount(amount)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('isValidSlippage accepts valid range', () => {
    fc.assert(
      fc.property(arbSlippage, (slippage) => {
        expect(isValidSlippage(slippage)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('isValidSlippage rejects out of range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: 1, max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(-100), max: Math.fround(-0.001), noNaN: true }),
          fc.constant(NaN)
        ),
        (invalid) => {
          expect(isValidSlippage(invalid)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Hash Function Fuzzing ────────────────────────────────────────────────────

describe('Hash Function Fuzzing', () => {
  it('hash is deterministic', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const hash1 = hash(input)
        const hash2 = hash(input)
        expect(hash1).toBe(hash2)
      }),
      { numRuns: 500 }
    )
  })

  it('hash produces different outputs for different inputs', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (input1, input2) => {
        fc.pre(input1 !== input2)
        const hash1 = hash(input1)
        const hash2 = hash(input2)
        expect(hash1).not.toBe(hash2)
      }),
      { numRuns: 500 }
    )
  })

  it('hash output is valid 32-byte hex', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = hash(input)
        expect(result.startsWith('0x')).toBe(true)
        expect(result.length).toBe(66) // 0x + 64 hex chars
        expect(isValidHex(result)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('generateRandomBytes produces correct length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 64 }), (length) => {
        const bytes = generateRandomBytes(length)
        expect(bytes.startsWith('0x')).toBe(true)
        expect(bytes.length).toBe(2 + length * 2)
      }),
      { numRuns: 100 }
    )
  })
})

// ─── Edge Case Tests ──────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('commitment with zero value works', () => {
    const { commitment, blinding } = commit(0n)
    const valid = verifyOpening(commitment, 0n, blinding)
    expect(valid).toBe(true)
  })

  it('commitment with max u64 value works', () => {
    const maxU64 = 2n ** 64n - 1n
    const { commitment, blinding } = commit(maxU64)
    const valid = verifyOpening(commitment, maxU64, blinding)
    expect(valid).toBe(true)
  })

  it('empty string hashes correctly', () => {
    const result = hash('')
    expect(result).toBeDefined()
    expect(result.length).toBe(66)
  })

  it('unicode strings hash correctly', () => {
    const unicodeInput = '你好世界 🌍 مرحبا'
    const result = hash(unicodeInput)
    expect(result).toBeDefined()
    expect(result.length).toBe(66)
  })

  it('very long strings hash correctly', () => {
    const longInput = 'a'.repeat(100000)
    const result = hash(longInput)
    expect(result).toBeDefined()
    expect(result.length).toBe(66)
  })
})

// ─── Adversarial Input Tests ──────────────────────────────────────────────────

describe('Adversarial Inputs', () => {
  it('handles malformed stealth meta-address gracefully', () => {
    const malformed = [
      'sip:ethereum:invalid:invalid',
      'sip:ethereum:0x1234:0x5678',
      'ethereum:0x1234:0x5678',
      'sip::0x1234:0x5678',
      '',
      null,
      undefined,
    ]

    for (const input of malformed) {
      expect(() => decodeStealthMetaAddress(input as string)).toThrow()
    }
  })

  it('handles null/undefined inputs to validators', () => {
    expect(isValidHex(null as unknown as string)).toBe(false)
    expect(isValidHex(undefined as unknown as string)).toBe(false)
    expect(isValidChainId(null as unknown as string)).toBe(false)
    expect(isValidChainId(undefined as unknown as string)).toBe(false)
    expect(isValidAmount(null as unknown as bigint)).toBe(false)
    expect(isValidAmount(undefined as unknown as bigint)).toBe(false)
  })

  it('rejects prototype pollution attempts', () => {
    const polluted = {
      __proto__: { admin: true },
      constructor: { prototype: { admin: true } },
    }

    // Should not crash or be affected by prototype pollution
    expect(() => isValidChainId((polluted as unknown as Record<string, unknown>).toString())).not.toThrow()
  })
})
