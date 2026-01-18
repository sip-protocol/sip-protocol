/**
 * NEAR Constants Tests
 *
 * Tests for NEAR chain constants, account ID validation, and utilities.
 */

import { describe, it, expect } from 'vitest'
import {
  NEAR_RPC_ENDPOINTS,
  NEAR_EXPLORER_URLS,
  NEAR_TOKEN_CONTRACTS,
  NEAR_TOKEN_DECIMALS,
  NEAR_IMPLICIT_ACCOUNT_LENGTH,
  DEFAULT_GAS,
  ONE_NEAR,
  ONE_YOCTO,
  getExplorerUrl,
  getAccountExplorerUrl,
  getTokenContract,
  getNEARTokenDecimals,
  isImplicitAccount,
  isNamedAccount,
  isValidAccountId,
  sanitizeUrl,
} from '../../../src/chains/near'

describe('NEAR Constants', () => {
  describe('RPC Endpoints', () => {
    it('should have valid mainnet endpoint', () => {
      expect(NEAR_RPC_ENDPOINTS.mainnet).toBe('https://rpc.mainnet.near.org')
    })

    it('should have valid testnet endpoint', () => {
      expect(NEAR_RPC_ENDPOINTS.testnet).toBe('https://rpc.testnet.near.org')
    })

    it('should have all networks defined', () => {
      expect(NEAR_RPC_ENDPOINTS.mainnet).toBeDefined()
      expect(NEAR_RPC_ENDPOINTS.testnet).toBeDefined()
      expect(NEAR_RPC_ENDPOINTS.betanet).toBeDefined()
      expect(NEAR_RPC_ENDPOINTS.localnet).toBeDefined()
    })
  })

  describe('Explorer URLs', () => {
    it('should have valid mainnet explorer', () => {
      expect(NEAR_EXPLORER_URLS.mainnet).toBe('https://nearblocks.io')
    })

    it('should have valid testnet explorer', () => {
      expect(NEAR_EXPLORER_URLS.testnet).toBe('https://testnet.nearblocks.io')
    })
  })

  describe('Token Contracts', () => {
    it('should have wNEAR contract', () => {
      expect(NEAR_TOKEN_CONTRACTS.wNEAR).toBe('wrap.near')
    })

    it('should have common tokens defined', () => {
      expect(NEAR_TOKEN_CONTRACTS.USDC).toBeDefined()
      expect(NEAR_TOKEN_CONTRACTS.USDT).toBeDefined()
      expect(NEAR_TOKEN_CONTRACTS.REF).toBeDefined()
    })
  })

  describe('Token Decimals', () => {
    it('should have NEAR decimals as 24', () => {
      expect(NEAR_TOKEN_DECIMALS.NEAR).toBe(24)
    })

    it('should have wNEAR decimals as 24', () => {
      expect(NEAR_TOKEN_DECIMALS.wNEAR).toBe(24)
    })

    it('should have USDC decimals as 6', () => {
      expect(NEAR_TOKEN_DECIMALS.USDC).toBe(6)
    })

    it('should have USDT decimals as 6', () => {
      expect(NEAR_TOKEN_DECIMALS.USDT).toBe(6)
    })
  })

  describe('Constants Values', () => {
    it('should have correct implicit account length', () => {
      expect(NEAR_IMPLICIT_ACCOUNT_LENGTH).toBe(64)
    })

    it('should have correct gas value', () => {
      expect(DEFAULT_GAS).toBe(300_000_000_000_000n)
    })

    it('should have correct ONE_NEAR value', () => {
      expect(ONE_NEAR).toBe(1_000_000_000_000_000_000_000_000n)
    })

    it('should have correct ONE_YOCTO value', () => {
      expect(ONE_YOCTO).toBe(1n)
    })
  })
})

describe('Explorer URL Helpers', () => {
  describe('getExplorerUrl', () => {
    it('should generate mainnet transaction URL', () => {
      const url = getExplorerUrl('abc123', 'mainnet')
      expect(url).toBe('https://nearblocks.io/txns/abc123')
    })

    it('should generate testnet transaction URL', () => {
      const url = getExplorerUrl('xyz789', 'testnet')
      expect(url).toBe('https://testnet.nearblocks.io/txns/xyz789')
    })

    it('should default to mainnet', () => {
      const url = getExplorerUrl('def456')
      expect(url).toBe('https://nearblocks.io/txns/def456')
    })
  })

  describe('getAccountExplorerUrl', () => {
    it('should generate mainnet account URL', () => {
      const url = getAccountExplorerUrl('alice.near', 'mainnet')
      expect(url).toBe('https://nearblocks.io/address/alice.near')
    })

    it('should generate testnet account URL', () => {
      const url = getAccountExplorerUrl('bob.testnet', 'testnet')
      expect(url).toBe('https://testnet.nearblocks.io/address/bob.testnet')
    })
  })
})

describe('Token Helpers', () => {
  describe('getTokenContract', () => {
    it('should return wNEAR contract', () => {
      expect(getTokenContract('wNEAR')).toBe('wrap.near')
    })

    it('should return USDC contract', () => {
      expect(getTokenContract('USDC')).toBeDefined()
    })

    it('should return undefined for unknown token', () => {
      expect(getTokenContract('UNKNOWN')).toBeUndefined()
    })
  })

  describe('getNEARTokenDecimals', () => {
    it('should return NEAR decimals', () => {
      expect(getNEARTokenDecimals('NEAR')).toBe(24)
    })

    it('should return USDC decimals', () => {
      expect(getNEARTokenDecimals('USDC')).toBe(6)
    })

    it('should default to 24 for unknown token', () => {
      expect(getNEARTokenDecimals('UNKNOWN')).toBe(24)
    })
  })
})

describe('Account ID Validation', () => {
  describe('isImplicitAccount', () => {
    it('should recognize valid implicit account', () => {
      const implicitAccount = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      expect(isImplicitAccount(implicitAccount)).toBe(true)
    })

    it('should reject named accounts', () => {
      expect(isImplicitAccount('alice.near')).toBe(false)
    })

    it('should reject short hex strings', () => {
      expect(isImplicitAccount('1234567890abcdef')).toBe(false)
    })

    it('should reject non-hex characters', () => {
      expect(isImplicitAccount('ghijklmnopqrstuv1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(false)
    })

    it('should be case-insensitive for hex', () => {
      const upperCase = '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF'
      expect(isImplicitAccount(upperCase)).toBe(true)
    })
  })

  describe('isNamedAccount', () => {
    it('should recognize valid named account', () => {
      expect(isNamedAccount('alice.near')).toBe(true)
    })

    it('should recognize nested named account', () => {
      expect(isNamedAccount('alice.bob.near')).toBe(true)
    })

    it('should recognize account with underscores', () => {
      expect(isNamedAccount('alice_bob.near')).toBe(true)
    })

    it('should recognize account with dashes', () => {
      expect(isNamedAccount('alice-bob.near')).toBe(true)
    })

    it('should reject implicit accounts', () => {
      const implicitAccount = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      expect(isNamedAccount(implicitAccount)).toBe(false)
    })

    it('should reject accounts without dots', () => {
      expect(isNamedAccount('alice')).toBe(false)
    })
  })

  describe('isValidAccountId', () => {
    it('should accept valid implicit account', () => {
      const implicitAccount = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      expect(isValidAccountId(implicitAccount)).toBe(true)
    })

    it('should accept valid named account', () => {
      expect(isValidAccountId('alice.near')).toBe(true)
    })

    it('should accept nested named account', () => {
      expect(isValidAccountId('alice.bob.near')).toBe(true)
    })

    it('should reject empty string', () => {
      expect(isValidAccountId('')).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(isValidAccountId(null as unknown as string)).toBe(false)
      expect(isValidAccountId(undefined as unknown as string)).toBe(false)
    })

    it('should reject accounts starting with dot', () => {
      expect(isValidAccountId('.alice.near')).toBe(false)
    })

    it('should reject accounts ending with dot', () => {
      expect(isValidAccountId('alice.near.')).toBe(false)
    })

    it('should reject accounts starting with dash', () => {
      expect(isValidAccountId('-alice.near')).toBe(false)
    })

    it('should reject accounts starting with underscore', () => {
      expect(isValidAccountId('_alice.near')).toBe(false)
    })

    it('should reject uppercase named accounts', () => {
      expect(isValidAccountId('ALICE.near')).toBe(false)
    })

    it('should reject accounts with special characters', () => {
      expect(isValidAccountId('alice@near')).toBe(false)
      expect(isValidAccountId('alice#near')).toBe(false)
      expect(isValidAccountId('alice$near')).toBe(false)
    })
  })
})

describe('URL Sanitization', () => {
  describe('sanitizeUrl', () => {
    it('should mask API key in query params', () => {
      const url = 'https://api.near.org?api-key=secret123'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).not.toContain('secret123')
      expect(sanitized).toContain('api-key=***')
    })

    it('should mask token in query params', () => {
      const url = 'https://api.near.org?token=mytoken'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).not.toContain('mytoken')
      expect(sanitized).toContain('token=***')
    })

    it('should mask basic auth credentials', () => {
      const url = 'https://user:pass@api.near.org'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).not.toContain('pass')
      expect(sanitized).toContain('***')
    })

    it('should not modify URL without credentials', () => {
      const url = 'https://api.near.org/path'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toBe('https://api.near.org/path')
    })

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not a url'
      const sanitized = sanitizeUrl(invalidUrl)
      expect(sanitized).toBe(invalidUrl)
    })
  })
})
