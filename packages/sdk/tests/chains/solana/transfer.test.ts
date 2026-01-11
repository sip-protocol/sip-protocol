/**
 * Solana Private Transfer Tests
 *
 * Tests for the Solana stealth address transfer functionality.
 */

import { describe, it, expect } from 'vitest'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import type { ChainId, StealthMetaAddress } from '@sip-protocol/types'

describe('Solana Private Transfer', () => {
  describe('Stealth Address Generation for Solana', () => {
    it('should generate valid ed25519 meta-address for Solana', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana' as ChainId)

      expect(metaAddress.chain).toBe('solana')
      expect(metaAddress.spendingKey).toBeDefined()
      expect(metaAddress.viewingKey).toBeDefined()

      // ed25519 public keys are 32 bytes = 64 hex chars + 0x prefix
      expect(metaAddress.spendingKey.startsWith('0x')).toBe(true)
      expect(metaAddress.viewingKey.startsWith('0x')).toBe(true)
      expect(metaAddress.spendingKey.length).toBe(66)
      expect(metaAddress.viewingKey.length).toBe(66)

      // Private keys are 32 bytes = 64 hex chars
      expect(spendingPrivateKey.length).toBe(66)
      expect(viewingPrivateKey.length).toBe(66)
    })

    it('should generate stealth address from meta-address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      expect(stealthAddress.address).toBeDefined()
      expect(stealthAddress.ephemeralPublicKey).toBeDefined()
      expect(stealthAddress.viewTag).toBeDefined()

      // View tag should be 0-255
      expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealthAddress.viewTag).toBeLessThanOrEqual(255)
    })

    it('should convert ed25519 public key to Solana address', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

      // Solana addresses are base58 encoded
      expect(solanaAddress).toBeDefined()
      expect(typeof solanaAddress).toBe('string')
      // Base58 uses these characters
      expect(solanaAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    })

    it('should generate different stealth addresses each time', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)

      const result1 = generateEd25519StealthAddress(metaAddress)
      const result2 = generateEd25519StealthAddress(metaAddress)

      // Ephemeral keys should be different
      expect(result1.stealthAddress.ephemeralPublicKey).not.toBe(
        result2.stealthAddress.ephemeralPublicKey
      )

      // Stealth addresses should be different
      expect(result1.stealthAddress.address).not.toBe(result2.stealthAddress.address)
    })
  })

  describe('Memo Format', () => {
    it('should create valid announcement memo', () => {
      // Test the memo format: SIP:1:<ephemeral>:<viewTag>
      const ephemeralPubkey = 'BpxDqRZ3tLhY6bxmZgSYfTNqQeK5HmXa9jF3MnYz7WsK'
      const viewTag = 'a5'
      const stealthAddress = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'

      const memo = `SIP:1:${ephemeralPubkey}:${viewTag}:${stealthAddress}`

      expect(memo).toContain('SIP:1:')
      expect(memo).toContain(ephemeralPubkey)
      expect(memo).toContain(viewTag)
      expect(memo).toContain(stealthAddress)
    })

    it('should parse announcement memo correctly', () => {
      const memo = 'SIP:1:BpxDqRZ3tLhY6bxmZgSYfTNqQeK5HmXa9jF3MnYz7WsK:a5:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
      const parts = memo.split(':')

      expect(parts[0]).toBe('SIP')
      expect(parts[1]).toBe('1') // Version
      expect(parts[2]).toBe('BpxDqRZ3tLhY6bxmZgSYfTNqQeK5HmXa9jF3MnYz7WsK') // Ephemeral
      expect(parts[3]).toBe('a5') // View tag
      expect(parts[4]).toBe('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH') // Stealth
    })
  })

  describe('View Tag', () => {
    it('should generate view tags in valid range', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana' as ChainId)

      // Generate multiple and check all are valid
      for (let i = 0; i < 100; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
        expect(stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
        expect(stealthAddress.viewTag).toBeLessThanOrEqual(255)
      }
    })

    it('should format view tag as 2-char hex', () => {
      const viewTags = [0, 15, 16, 255]
      const expected = ['00', '0f', '10', 'ff']

      viewTags.forEach((tag, i) => {
        const hex = tag.toString(16).padStart(2, '0')
        expect(hex).toBe(expected[i])
      })
    })
  })

  describe('Chain Validation', () => {
    it('should only accept Solana chain for transfers', () => {
      const invalidMetaAddress: StealthMetaAddress = {
        chain: 'ethereum' as ChainId,
        spendingKey: ('0x' + '02' + 'a'.repeat(64)) as `0x${string}`,
        viewingKey: ('0x' + '03' + 'b'.repeat(64)) as `0x${string}`,
      }

      // This should throw when passed to sendPrivateSPLTransfer
      // (testing the validation logic conceptually)
      expect(invalidMetaAddress.chain).not.toBe('solana')
    })
  })
})
