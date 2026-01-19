/**
 * MetaMask Privacy Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildKeyDerivationMessage,
  buildKeyDerivationTypedData,
  buildViewKeyShareTypedData,
  createSigningContext,
  parseSignature,
  toCompactSignature,
  isMetaMaskInstalled,
  isMetaMaskFlaskInstalled,
  DEFAULT_SIP_DOMAIN,
  PRIVACY_OPERATION_DESCRIPTIONS,
  KEY_DERIVATION_TYPES,
  STEALTH_TRANSFER_TYPES,
  VIEW_KEY_SHARE_TYPES,
} from '../../../src/wallet/ethereum/metamask-privacy'

// Use local HexString type
type HexString = `0x${string}`

describe('MetaMask Privacy Utilities', () => {
  // ─── Message Building ───────────────────────────────────────────────────────

  describe('buildKeyDerivationMessage', () => {
    it('should build key derivation message with all params', () => {
      const message = buildKeyDerivationMessage({
        domain: 'test-app.com',
        address: '0x1234567890123456789012345678901234567890',
        nonce: 42,
      })

      expect(message).toContain('SIP Protocol Key Derivation Request')
      expect(message).toContain('Domain: test-app.com')
      expect(message).toContain('Address: 0x1234567890123456789012345678901234567890')
      expect(message).toContain('Nonce: 42')
    })

    it('should default nonce to 0', () => {
      const message = buildKeyDerivationMessage({
        domain: 'test-app.com',
        address: '0x1234567890123456789012345678901234567890',
      })

      expect(message).toContain('Nonce: 0')
    })

    it('should include explanation text', () => {
      const message = buildKeyDerivationMessage({
        domain: 'test.com',
        address: '0x1234567890123456789012345678901234567890',
      })

      expect(message).toContain('By signing this message')
      expect(message).toContain('derived deterministically')
    })
  })

  describe('buildKeyDerivationTypedData', () => {
    it('should build valid EIP-712 typed data', () => {
      const typedData = buildKeyDerivationTypedData(
        {
          domain: 'test-app.com',
          address: '0x1234567890123456789012345678901234567890' as HexString,
          nonce: 1,
        },
        1 // mainnet
      )

      expect(typedData.domain.name).toBe('SIP Protocol')
      expect(typedData.domain.version).toBe('1')
      expect(typedData.domain.chainId).toBe(1)
      expect(typedData.primaryType).toBe('KeyDerivation')
      expect(typedData.message.domain).toBe('test-app.com')
      expect(typedData.message.address).toBe('0x1234567890123456789012345678901234567890')
      expect(typedData.message.nonce).toBe('1')
    })

    it('should use default nonce of 0', () => {
      const typedData = buildKeyDerivationTypedData(
        {
          domain: 'test.com',
          address: '0x1234567890123456789012345678901234567890' as HexString,
        },
        1
      )

      expect(typedData.message.nonce).toBe('0')
    })
  })

  describe('buildViewKeyShareTypedData', () => {
    it('should build valid EIP-712 typed data for view key sharing', () => {
      const validFrom = Math.floor(Date.now() / 1000)
      const validUntil = validFrom + 86400 // 1 day

      const typedData = buildViewKeyShareTypedData(
        {
          auditor: '0xABCDef1234567890ABCDef1234567890ABCDef12' as HexString,
          scope: 'full_transaction_history',
          validFrom,
          validUntil,
        },
        1
      )

      expect(typedData.primaryType).toBe('ViewKeyShare')
      expect(typedData.message.auditor).toBe('0xABCDef1234567890ABCDef1234567890ABCDef12')
      expect(typedData.message.scope).toBe('full_transaction_history')
      expect(typedData.message.validFrom).toBe(validFrom.toString())
      expect(typedData.message.validUntil).toBe(validUntil.toString())
    })
  })

  // ─── Signing Context ────────────────────────────────────────────────────────

  describe('createSigningContext', () => {
    it('should create context for key derivation', () => {
      const context = createSigningContext('key_derivation')

      expect(context.operation).toBe('key_derivation')
      expect(context.description).toBe(PRIVACY_OPERATION_DESCRIPTIONS.key_derivation)
      expect(context.warnings).toBeDefined()
      expect(context.warnings!.length).toBeGreaterThan(0)
    })

    it('should create context for view key share with warnings', () => {
      const context = createSigningContext('view_key_share')

      expect(context.operation).toBe('view_key_share')
      expect(context.warnings).toContain('The auditor will be able to see your transaction amounts')
    })

    it('should create context for stealth transfer', () => {
      const context = createSigningContext('stealth_transfer')

      expect(context.operation).toBe('stealth_transfer')
      expect(context.warnings).toContain('This transaction cannot be easily traced to your address')
    })

    it('should include custom data', () => {
      const context = createSigningContext('claim_funds', { amount: '1.5 ETH' })

      expect(context.data).toEqual({ amount: '1.5 ETH' })
    })
  })

  // ─── Signature Parsing ──────────────────────────────────────────────────────

  describe('parseSignature', () => {
    it('should parse standard 65-byte signature', () => {
      // Create a mock signature: r (32 bytes) + s (32 bytes) + v (1 byte)
      const r = 'ab'.repeat(32)
      const s = 'cd'.repeat(32)
      const v = '1b' // 27 in hex
      const signature = `0x${r}${s}${v}` as HexString

      const result = parseSignature(signature)

      expect(result.r).toBe(`0x${r}`)
      expect(result.s).toBe(`0x${s}`)
      expect(result.v).toBe(27)
    })

    it('should normalize v values 0/1 to 27/28', () => {
      const r = 'ab'.repeat(32)
      const s = 'cd'.repeat(32)
      const signature = `0x${r}${s}00` as HexString

      const result = parseSignature(signature)

      expect(result.v).toBe(27)
    })

    it('should handle v = 28', () => {
      const r = 'ab'.repeat(32)
      const s = 'cd'.repeat(32)
      const v = '1c' // 28 in hex
      const signature = `0x${r}${s}${v}` as HexString

      const result = parseSignature(signature)

      expect(result.v).toBe(28)
    })

    it('should throw on invalid signature length', () => {
      const shortSig = '0xabcd' as HexString

      expect(() => parseSignature(shortSig)).toThrow('Invalid signature length')
    })
  })

  describe('toCompactSignature', () => {
    it('should convert to compact format', () => {
      const r = 'ab'.repeat(32)
      const s = '00'.repeat(32) // s with no high bits set
      const v = '1b' // 27
      const signature = `0x${r}${s}${v}` as HexString

      const compact = toCompactSignature(signature)

      // Should be 64 bytes (128 hex chars) + 0x prefix
      expect(compact.length).toBe(130)
      expect(compact.startsWith(`0x${r}`)).toBe(true)
    })

    it('should set high bit of s for v=28', () => {
      const r = 'ab'.repeat(32)
      const s = '00'.repeat(32)
      const v = '1c' // 28
      const signature = `0x${r}${s}${v}` as HexString

      const compact = toCompactSignature(signature)

      // The high bit of s should be set
      // First hex char of s (after r) should have bit set
      const sStart = compact.slice(66, 68)
      const firstByte = parseInt(sStart, 16)
      expect(firstByte & 0x80).toBe(0x80)
    })
  })

  // ─── MetaMask Detection ─────────────────────────────────────────────────────

  describe('MetaMask Detection', () => {
    let originalWindow: typeof globalThis.window

    beforeEach(() => {
      // Save original window
      originalWindow = globalThis.window
    })

    afterEach(() => {
      // Restore original window
      if (originalWindow === undefined) {
        // @ts-expect-error - resetting window
        delete globalThis.window
      } else {
        globalThis.window = originalWindow
      }
    })

    it('should return false when window is undefined', () => {
      // @ts-expect-error - simulating server environment
      delete globalThis.window

      expect(isMetaMaskInstalled()).toBe(false)
      expect(isMetaMaskFlaskInstalled()).toBe(false)
    })

    it('should return false when ethereum is not present', () => {
      // @ts-expect-error - mock window
      globalThis.window = {}

      expect(isMetaMaskInstalled()).toBe(false)
    })

    it('should return true when MetaMask is present', () => {
      // @ts-expect-error - mock window with ethereum
      globalThis.window = {
        ethereum: {
          isMetaMask: true,
        },
      }

      expect(isMetaMaskInstalled()).toBe(true)
    })

    it('should detect MetaMask Flask', () => {
      // @ts-expect-error - mock window with flask
      globalThis.window = {
        ethereum: {
          isMetaMask: true,
          _metamask: {
            isUnlocked: async () => true,
          },
        },
      }

      expect(isMetaMaskFlaskInstalled()).toBe(true)
    })
  })

  // ─── Constants ──────────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have correct default domain', () => {
      expect(DEFAULT_SIP_DOMAIN.name).toBe('SIP Protocol')
      expect(DEFAULT_SIP_DOMAIN.version).toBe('1')
    })

    it('should have all privacy operation descriptions', () => {
      expect(PRIVACY_OPERATION_DESCRIPTIONS.key_derivation).toBeDefined()
      expect(PRIVACY_OPERATION_DESCRIPTIONS.stealth_transfer).toBeDefined()
      expect(PRIVACY_OPERATION_DESCRIPTIONS.token_approval).toBeDefined()
      expect(PRIVACY_OPERATION_DESCRIPTIONS.claim_funds).toBeDefined()
      expect(PRIVACY_OPERATION_DESCRIPTIONS.view_key_share).toBeDefined()
    })

    it('should have correct EIP-712 type definitions', () => {
      expect(KEY_DERIVATION_TYPES.KeyDerivation).toHaveLength(4)
      expect(STEALTH_TRANSFER_TYPES.StealthTransfer).toHaveLength(5)
      expect(VIEW_KEY_SHARE_TYPES.ViewKeyShare).toHaveLength(4)
    })
  })
})
