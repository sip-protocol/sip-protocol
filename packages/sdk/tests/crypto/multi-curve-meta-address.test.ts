/**
 * Multi-Curve Meta-Address Tests
 *
 * Tests for encoding/decoding stealth meta-addresses across different curve types.
 * Issue #95: Multi-curve meta-address format
 */

import { describe, it, expect } from 'vitest'
import {
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  isEd25519Chain,
  getCurveForChain,
} from '../../src/stealth'
import type { HexString, ChainId } from '@sip-protocol/types'

describe('Multi-Curve Meta-Address', () => {
  // ─── getCurveForChain ─────────────────────────────────────────────────────────

  describe('getCurveForChain', () => {
    it('should return ed25519 for Solana', () => {
      expect(getCurveForChain('solana')).toBe('ed25519')
    })

    it('should return ed25519 for NEAR', () => {
      expect(getCurveForChain('near')).toBe('ed25519')
    })

    it('should return secp256k1 for Ethereum', () => {
      expect(getCurveForChain('ethereum')).toBe('secp256k1')
    })

    it('should return secp256k1 for EVM chains', () => {
      expect(getCurveForChain('polygon')).toBe('secp256k1')
      expect(getCurveForChain('arbitrum')).toBe('secp256k1')
      expect(getCurveForChain('optimism')).toBe('secp256k1')
      expect(getCurveForChain('base')).toBe('secp256k1')
    })

    it('should return secp256k1 for Zcash', () => {
      expect(getCurveForChain('zcash')).toBe('secp256k1')
    })
  })

  // ─── isEd25519Chain ───────────────────────────────────────────────────────────

  describe('isEd25519Chain', () => {
    it('should return true for Solana and NEAR', () => {
      expect(isEd25519Chain('solana')).toBe(true)
      expect(isEd25519Chain('near')).toBe(true)
    })

    it('should return false for secp256k1 chains', () => {
      expect(isEd25519Chain('ethereum')).toBe(false)
      expect(isEd25519Chain('polygon')).toBe(false)
      expect(isEd25519Chain('zcash')).toBe(false)
    })
  })

  // ─── decodeStealthMetaAddress with secp256k1 ─────────────────────────────────

  describe('decodeStealthMetaAddress (secp256k1)', () => {
    it('should decode valid Ethereum meta-address', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const decoded = decodeStealthMetaAddress(encoded)

      expect(decoded.chain).toBe('ethereum')
      expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
      expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
    })

    it('should reject ed25519 keys for Ethereum', () => {
      // 32-byte ed25519 key (wrong for secp256k1 chain)
      const ed25519Key = '0x' + 'ab'.repeat(32) as HexString
      const encoded = `sip:ethereum:${ed25519Key}:${ed25519Key}`

      expect(() => decodeStealthMetaAddress(encoded)).toThrow('secp256k1')
    })

    it('should work with all secp256k1 chains', () => {
      const secp256k1Chains: ChainId[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'zcash']

      for (const chain of secp256k1Chains) {
        const { metaAddress } = generateStealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(getCurveForChain(chain)).toBe('secp256k1')
      }
    })
  })

  // ─── decodeStealthMetaAddress with ed25519 ───────────────────────────────────

  describe('decodeStealthMetaAddress (ed25519)', () => {
    it('should decode valid Solana meta-address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const decoded = decodeStealthMetaAddress(encoded)

      expect(decoded.chain).toBe('solana')
      expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
      expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
    })

    it('should decode valid NEAR meta-address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const decoded = decodeStealthMetaAddress(encoded)

      expect(decoded.chain).toBe('near')
      expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
      expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
    })

    it('should reject secp256k1 keys for Solana', () => {
      // Generate secp256k1 keys
      const { metaAddress: secp256k1Meta } = generateStealthMetaAddress('ethereum')
      // Try to encode as Solana
      const encoded = `sip:solana:${secp256k1Meta.spendingKey}:${secp256k1Meta.viewingKey}`

      expect(() => decodeStealthMetaAddress(encoded)).toThrow('ed25519')
    })

    it('should reject secp256k1 keys for NEAR', () => {
      const { metaAddress: secp256k1Meta } = generateStealthMetaAddress('ethereum')
      const encoded = `sip:near:${secp256k1Meta.spendingKey}:${secp256k1Meta.viewingKey}`

      expect(() => decodeStealthMetaAddress(encoded)).toThrow('ed25519')
    })

    it('should work with all ed25519 chains', () => {
      const ed25519Chains: ChainId[] = ['solana', 'near']

      for (const chain of ed25519Chains) {
        const { metaAddress } = generateEd25519StealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(getCurveForChain(chain)).toBe('ed25519')
      }
    })
  })

  // ─── Roundtrip Tests ──────────────────────────────────────────────────────────

  describe('Roundtrip encoding/decoding', () => {
    it('should roundtrip secp256k1 meta-addresses', () => {
      const chains: ChainId[] = ['ethereum', 'polygon', 'arbitrum']
      for (const chain of chains) {
        const { metaAddress } = generateStealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
        expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
      }
    })

    it('should roundtrip ed25519 meta-addresses', () => {
      const chains: ChainId[] = ['solana', 'near']

      for (const chain of chains) {
        const { metaAddress } = generateEd25519StealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
        expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
      }
    })
  })

  // ─── Error Cases ──────────────────────────────────────────────────────────────

  describe('Error cases', () => {
    it('should reject invalid format', () => {
      expect(() => decodeStealthMetaAddress('invalid')).toThrow()
      expect(() => decodeStealthMetaAddress('sip:ethereum:0x123')).toThrow()
      expect(() => decodeStealthMetaAddress('')).toThrow()
    })

    it('should reject invalid chain', () => {
      const key = '0x' + 'ab'.repeat(33) as HexString
      expect(() => decodeStealthMetaAddress(`sip:invalid:${key}:${key}`)).toThrow('chain')
    })

    it('should reject mismatched key sizes for chain', () => {
      // 32-byte key for secp256k1 chain
      const ed25519Key = '0x' + 'ab'.repeat(32) as HexString
      expect(() => decodeStealthMetaAddress(`sip:ethereum:${ed25519Key}:${ed25519Key}`)).toThrow()

      // 33-byte key for ed25519 chain
      const secp256k1Key = '0x02' + 'ab'.repeat(32) as HexString
      expect(() => decodeStealthMetaAddress(`sip:solana:${secp256k1Key}:${secp256k1Key}`)).toThrow()
    })
  })

  // ─── Format Specification ─────────────────────────────────────────────────────

  describe('Format specification', () => {
    it('should use sip: prefix', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      expect(encoded.startsWith('sip:')).toBe(true)
    })

    it('should include chain identifier', () => {
      const { metaAddress: ethMeta } = generateStealthMetaAddress('ethereum')
      const ethEncoded = encodeStealthMetaAddress(ethMeta)
      expect(ethEncoded.split(':')[1]).toBe('ethereum')

      const { metaAddress: solanaMeta } = generateEd25519StealthMetaAddress('solana')
      const solanaEncoded = encodeStealthMetaAddress(solanaMeta)
      expect(solanaEncoded.split(':')[1]).toBe('solana')
    })

    it('should use lowercase hex for keys', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)
      const parts = encoded.split(':')

      // Keys should be lowercase hex
      expect(parts[2]).toMatch(/^0x[0-9a-f]+$/)
      expect(parts[3]).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should produce different format lengths for different curves', () => {
      const { metaAddress: secp256k1Meta } = generateStealthMetaAddress('ethereum')
      const secp256k1Encoded = encodeStealthMetaAddress(secp256k1Meta)

      const { metaAddress: ed25519Meta } = generateEd25519StealthMetaAddress('solana')
      const ed25519Encoded = encodeStealthMetaAddress(ed25519Meta)

      // secp256k1: 33 bytes = 66 hex chars + "0x" = 68 chars per key
      // ed25519: 32 bytes = 64 hex chars + "0x" = 66 chars per key
      const secp256k1KeyLength = secp256k1Encoded.split(':')[2].length
      const ed25519KeyLength = ed25519Encoded.split(':')[2].length

      expect(secp256k1KeyLength).toBe(68) // 0x + 66 hex chars
      expect(ed25519KeyLength).toBe(66)   // 0x + 64 hex chars
    })
  })
})
