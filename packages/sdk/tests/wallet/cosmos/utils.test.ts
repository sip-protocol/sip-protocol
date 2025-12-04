/**
 * Tests for Cosmos wallet utilities
 */

import { describe, it, expect } from 'vitest'
import {
  cosmosPublicKeyToHex,
  bech32ToHex,
  getCosmosDefaultRpcEndpoint,
  getDefaultRestEndpoint,
  CosmosChainId,
  detectCosmosWallets,
} from '../../../src/wallet'

describe('Cosmos Wallet Utilities', () => {
  describe('cosmosPublicKeyToHex', () => {
    it('should convert public key bytes to hex string', () => {
      const pubkey = new Uint8Array([1, 2, 3, 4, 5])
      const hex = cosmosPublicKeyToHex(pubkey)

      expect(hex).toBe('0x0102030405')
    })

    it('should handle 33-byte secp256k1 public key', () => {
      const pubkey = new Uint8Array(33).fill(0xaa)
      const hex = cosmosPublicKeyToHex(pubkey)

      expect(hex).toMatch(/^0x[a]+$/)
      expect(hex.length).toBe(68) // 0x + 66 hex chars
    })
  })

  describe('bech32ToHex', () => {
    it('should decode bech32 address to hex', () => {
      // This is a simplified test - real bech32 decoding is complex
      const address = 'cosmos1test1234567890'

      expect(() => bech32ToHex(address)).not.toThrow()

      const hex = bech32ToHex(address)
      expect(hex).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should throw on invalid bech32 address', () => {
      const invalidAddress = 'invalid-no-separator'

      expect(() => bech32ToHex(invalidAddress)).toThrow()
    })

    it('should throw on invalid bech32 character', () => {
      const invalidAddress = 'cosmos1test#invalid'

      expect(() => bech32ToHex(invalidAddress)).toThrow()
    })
  })

  describe('getCosmosDefaultRpcEndpoint', () => {
    it('should return Cosmos Hub RPC endpoint', () => {
      const endpoint = getCosmosDefaultRpcEndpoint(CosmosChainId.COSMOSHUB)
      expect(endpoint).toBe('https://rpc.cosmos.network')
    })

    it('should return Osmosis RPC endpoint', () => {
      const endpoint = getCosmosDefaultRpcEndpoint(CosmosChainId.OSMOSIS)
      expect(endpoint).toBe('https://rpc.osmosis.zone')
    })

    it('should return Juno RPC endpoint', () => {
      const endpoint = getCosmosDefaultRpcEndpoint(CosmosChainId.JUNO)
      expect(endpoint).toBe('https://rpc.juno.strange.love')
    })

    it('should return default endpoint for unknown chain', () => {
      const endpoint = getCosmosDefaultRpcEndpoint('unknown-chain-1')
      expect(endpoint).toBe('https://rpc.cosmos.network')
    })

    it('should return testnet endpoints', () => {
      const endpoint = getCosmosDefaultRpcEndpoint(CosmosChainId.COSMOSHUB_TESTNET)
      expect(endpoint).toBe('https://rpc.sentry-01.theta-testnet.polypore.xyz')
    })
  })

  describe('getDefaultRestEndpoint', () => {
    it('should return Cosmos Hub REST endpoint', () => {
      const endpoint = getDefaultRestEndpoint(CosmosChainId.COSMOSHUB)
      expect(endpoint).toBe('https://api.cosmos.network')
    })

    it('should return Osmosis REST endpoint', () => {
      const endpoint = getDefaultRestEndpoint(CosmosChainId.OSMOSIS)
      expect(endpoint).toBe('https://lcd.osmosis.zone')
    })

    it('should return Juno REST endpoint', () => {
      const endpoint = getDefaultRestEndpoint(CosmosChainId.JUNO)
      expect(endpoint).toBe('https://api.juno.strange.love')
    })

    it('should return default endpoint for unknown chain', () => {
      const endpoint = getDefaultRestEndpoint('unknown-chain-1')
      expect(endpoint).toBe('https://api.cosmos.network')
    })
  })

  describe('detectCosmosWallets', () => {
    it('should return empty array in non-browser environment', () => {
      const wallets = detectCosmosWallets()
      expect(wallets).toEqual([])
    })
  })

  describe('CosmosChainId constants', () => {
    it('should have mainnet chain IDs', () => {
      expect(CosmosChainId.COSMOSHUB).toBe('cosmoshub-4')
      expect(CosmosChainId.OSMOSIS).toBe('osmosis-1')
      expect(CosmosChainId.JUNO).toBe('juno-1')
      expect(CosmosChainId.STARGAZE).toBe('stargaze-1')
      expect(CosmosChainId.AKASH).toBe('akashnet-2')
    })

    it('should have testnet chain IDs', () => {
      expect(CosmosChainId.COSMOSHUB_TESTNET).toBe('theta-testnet-001')
      expect(CosmosChainId.OSMOSIS_TESTNET).toBe('osmo-test-5')
    })
  })
})
