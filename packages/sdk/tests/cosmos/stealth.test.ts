/**
 * Cosmos Stealth Address Tests
 *
 * Comprehensive tests for Cosmos stealth address generation, address encoding,
 * and key derivation across multiple Cosmos chains.
 */

import { describe, it, expect } from 'vitest'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  CosmosStealthService,
  generateCosmosStealthMetaAddress,
  generateCosmosStealthAddress,
  stealthKeyToCosmosAddress,
  isValidCosmosAddress,
  CHAIN_PREFIXES,
  type CosmosChainId,
} from '../../src/cosmos/stealth'
import type { HexString } from '@sip-protocol/types'

describe('Cosmos Stealth Addresses', () => {
  const service = new CosmosStealthService()
  const chains: CosmosChainId[] = ['cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']

  describe('CosmosStealthService - generateStealthMetaAddress()', () => {
    it('should generate valid meta-address for each Cosmos chain', () => {
      for (const chain of chains) {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
          service.generateStealthMetaAddress(chain)

        expect(metaAddress.spendingKey).toBeDefined()
        expect(metaAddress.viewingKey).toBeDefined()
        expect(metaAddress.chain).toBe(chain)

        // Keys should be valid hex
        expect(metaAddress.spendingKey.startsWith('0x')).toBe(true)
        expect(metaAddress.viewingKey.startsWith('0x')).toBe(true)

        // Compressed secp256k1 public keys are 33 bytes = 66 hex chars
        expect(metaAddress.spendingKey.length).toBe(68) // 0x + 66
        expect(metaAddress.viewingKey.length).toBe(68)

        // Private keys are 32 bytes = 64 hex chars
        expect(spendingPrivateKey.length).toBe(66) // 0x + 64
        expect(viewingPrivateKey.length).toBe(66)

        // Verify public keys match private keys
        const derivedSpending = secp256k1.getPublicKey(
          hexToBytes(spendingPrivateKey.slice(2)),
          true
        )
        const derivedViewing = secp256k1.getPublicKey(
          hexToBytes(viewingPrivateKey.slice(2)),
          true
        )

        expect(`0x${bytesToHex(derivedSpending)}`).toBe(metaAddress.spendingKey)
        expect(`0x${bytesToHex(derivedViewing)}`).toBe(metaAddress.viewingKey)
      }
    })

    it('should generate different keys each time', () => {
      const gen1 = service.generateStealthMetaAddress('cosmos')
      const gen2 = service.generateStealthMetaAddress('cosmos')

      expect(gen1.metaAddress.spendingKey).not.toBe(gen2.metaAddress.spendingKey)
      expect(gen1.metaAddress.viewingKey).not.toBe(gen2.metaAddress.viewingKey)
      expect(gen1.spendingPrivateKey).not.toBe(gen2.spendingPrivateKey)
      expect(gen1.viewingPrivateKey).not.toBe(gen2.viewingPrivateKey)
    })

    it('should include optional label', () => {
      const { metaAddress } = service.generateStealthMetaAddress('osmosis', 'My Osmosis Wallet')

      expect(metaAddress.label).toBe('My Osmosis Wallet')
      expect(metaAddress.chain).toBe('osmosis')
    })

    it('should throw error for invalid chain', () => {
      expect(() => {
        service.generateStealthMetaAddress('invalid-chain' as unknown as string)
      }).toThrow(/invalid Cosmos chain/)
    })
  })

  describe('CosmosStealthService - generateStealthAddress()', () => {
    it('should generate valid stealth address for each Cosmos chain', () => {
      for (const chain of chains) {
        const { metaAddress } = service.generateStealthMetaAddress(chain)
        const spendingPubKey = hexToBytes(metaAddress.spendingKey.slice(2))
        const viewingPubKey = hexToBytes(metaAddress.viewingKey.slice(2))

        const result = service.generateStealthAddress(spendingPubKey, viewingPubKey, chain)

        // Check bech32 address format
        expect(result.stealthAddress).toBeDefined()
        expect(typeof result.stealthAddress).toBe('string')
        expect(result.stealthAddress.startsWith(CHAIN_PREFIXES[chain])).toBe(true)
        expect(result.stealthAddress.includes('1')).toBe(true)

        // Check stealth public key (33 bytes compressed)
        expect(result.stealthPublicKey.length).toBe(68) // 0x + 66 hex chars

        // Check ephemeral public key
        expect(result.ephemeralPublicKey.length).toBe(68)

        // Check view tag (0-255)
        expect(result.viewTag).toBeGreaterThanOrEqual(0)
        expect(result.viewTag).toBeLessThanOrEqual(255)

        // Check view key hash (32 bytes)
        expect(result.viewKeyHash.length).toBe(66) // 0x + 64 hex chars
      }
    })

    it('should generate different stealth addresses for same meta-address', () => {
      const { metaAddress } = service.generateStealthMetaAddress('cosmos')
      const spendingPubKey = hexToBytes(metaAddress.spendingKey.slice(2))
      const viewingPubKey = hexToBytes(metaAddress.viewingKey.slice(2))

      const result1 = service.generateStealthAddress(spendingPubKey, viewingPubKey, 'cosmos')
      const result2 = service.generateStealthAddress(spendingPubKey, viewingPubKey, 'cosmos')

      // Different ephemeral keys = different stealth addresses
      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
      expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey)
      expect(result1.stealthPublicKey).not.toBe(result2.stealthPublicKey)
    })

    it('should throw error for invalid public key length', () => {
      const invalidKey = new Uint8Array(32) // Wrong length (should be 33)

      expect(() => {
        service.generateStealthAddress(invalidKey, invalidKey, 'cosmos')
      }).toThrow(/must be 33 bytes/)
    })

    it('should throw error for invalid chain', () => {
      const validKey = new Uint8Array(33)

      expect(() => {
        service.generateStealthAddress(validKey, validKey, 'invalid-chain' as unknown as string)
      }).toThrow(/invalid Cosmos chain/)
    })
  })

  describe('CosmosStealthService - generateStealthAddressFromMeta()', () => {
    it('should generate stealth address from meta-address', () => {
      for (const chain of chains) {
        const { metaAddress } = service.generateStealthMetaAddress('cosmos')

        const result = service.generateStealthAddressFromMeta(metaAddress, chain)

        expect(result.stealthAddress).toBeDefined()
        expect(result.stealthAddress.startsWith(CHAIN_PREFIXES[chain])).toBe(true)
        expect(result.stealthPublicKey).toBeDefined()
        expect(result.ephemeralPublicKey).toBeDefined()
      }
    })
  })

  describe('CosmosStealthService - stealthKeyToCosmosAddress()', () => {
    it('should convert stealth public key to correct bech32 address for each chain', () => {
      // Generate a test key
      const privateKey = new Uint8Array(32).fill(1) // Deterministic for testing
      const publicKey = secp256k1.getPublicKey(privateKey, true)

      for (const chain of chains) {
        const address = service.stealthKeyToCosmosAddress(publicKey, CHAIN_PREFIXES[chain])

        expect(address).toBeDefined()
        expect(address.startsWith(CHAIN_PREFIXES[chain])).toBe(true)
        expect(address.includes('1')).toBe(true)
        expect(address.length).toBeGreaterThan(39)
        expect(address.length).toBeLessThan(90)
      }
    })

    it('should generate same address for same public key', () => {
      const privateKey = new Uint8Array(32).fill(42)
      const publicKey = secp256k1.getPublicKey(privateKey, true)

      const address1 = service.stealthKeyToCosmosAddress(publicKey, 'cosmos')
      const address2 = service.stealthKeyToCosmosAddress(publicKey, 'cosmos')

      expect(address1).toBe(address2)
    })

    it('should generate different addresses for different chains', () => {
      const privateKey = new Uint8Array(32).fill(99)
      const publicKey = secp256k1.getPublicKey(privateKey, true)

      const cosmosAddr = service.stealthKeyToCosmosAddress(publicKey, 'cosmos')
      const osmoAddr = service.stealthKeyToCosmosAddress(publicKey, 'osmo')
      const injAddr = service.stealthKeyToCosmosAddress(publicKey, 'inj')

      expect(cosmosAddr).not.toBe(osmoAddr)
      expect(cosmosAddr).not.toBe(injAddr)
      expect(osmoAddr).not.toBe(injAddr)

      // But hash should be same, only prefix differs
      const cosmosHash = service.decodeBech32Address(cosmosAddr).hash
      const osmoHash = service.decodeBech32Address(osmoAddr).hash
      const injHash = service.decodeBech32Address(injAddr).hash

      expect(bytesToHex(cosmosHash)).toBe(bytesToHex(osmoHash))
      expect(bytesToHex(cosmosHash)).toBe(bytesToHex(injHash))
    })

    it('should throw error for invalid public key length', () => {
      const invalidKey = new Uint8Array(32) // Wrong length

      expect(() => {
        service.stealthKeyToCosmosAddress(invalidKey, 'cosmos')
      }).toThrow(/must be 33 bytes/)
    })
  })

  describe('CosmosStealthService - deriveStealthPrivateKey()', () => {
    it('should derive correct private key for stealth address', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        service.generateStealthMetaAddress('cosmos')

      const spendingPubKey = hexToBytes(metaAddress.spendingKey.slice(2))
      const viewingPubKey = hexToBytes(metaAddress.viewingKey.slice(2))

      const { stealthAddress, stealthPublicKey, ephemeralPublicKey } =
        service.generateStealthAddress(spendingPubKey, viewingPubKey, 'cosmos')

      // Derive private key
      const recovery = service.deriveStealthPrivateKey(
        {
          address: stealthPublicKey,
          ephemeralPublicKey,
          viewTag: 0, // View tag not used in derivation
        },
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toBeDefined()
      expect(recovery.privateKey.length).toBe(66) // 0x + 64 hex

      // Verify derived private key produces correct public key
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(recovery.privateKey.slice(2)),
        true
      )

      expect(`0x${bytesToHex(derivedPubKey)}`).toBe(stealthPublicKey)
    })

    it('should work across multiple chains', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        service.generateStealthMetaAddress('cosmos')

      for (const chain of chains) {
        const result = service.generateStealthAddressFromMeta(metaAddress, chain)

        const recovery = service.deriveStealthPrivateKey(
          {
            address: result.stealthPublicKey,
            ephemeralPublicKey: result.ephemeralPublicKey,
            viewTag: result.viewTag,
          },
          spendingPrivateKey,
          viewingPrivateKey
        )

        // Verify derived key works
        const derivedPubKey = secp256k1.getPublicKey(
          hexToBytes(recovery.privateKey.slice(2)),
          true
        )

        expect(`0x${bytesToHex(derivedPubKey)}`).toBe(result.stealthPublicKey)
      }
    })
  })

  describe('CosmosStealthService - address validation', () => {
    it('should validate correct Cosmos addresses', () => {
      const { metaAddress } = service.generateStealthMetaAddress('cosmos')
      const result = service.generateStealthAddressFromMeta(metaAddress, 'cosmos')

      expect(service.isValidCosmosAddress(result.stealthAddress)).toBe(true)
      expect(service.isValidCosmosAddress(result.stealthAddress, 'cosmos')).toBe(true)
    })

    it('should reject addresses with wrong prefix', () => {
      const { metaAddress } = service.generateStealthMetaAddress('cosmos')
      const osmosisResult = service.generateStealthAddressFromMeta(metaAddress, 'osmosis')

      // Should pass without expected chain
      expect(service.isValidCosmosAddress(osmosisResult.stealthAddress)).toBe(true)

      // Should fail with wrong expected chain
      expect(service.isValidCosmosAddress(osmosisResult.stealthAddress, 'cosmos')).toBe(false)
      expect(service.isValidCosmosAddress(osmosisResult.stealthAddress, 'osmosis')).toBe(true)
    })

    it('should reject invalid bech32 addresses', () => {
      expect(service.isValidCosmosAddress('invalid')).toBe(false)
      expect(service.isValidCosmosAddress('0x1234567890abcdef')).toBe(false)
      expect(service.isValidCosmosAddress('')).toBe(false)
      expect(service.isValidCosmosAddress('cosmos1')).toBe(false) // Too short
    })

    it('should decode valid bech32 addresses', () => {
      const { metaAddress } = service.generateStealthMetaAddress('cosmos')
      const result = service.generateStealthAddressFromMeta(metaAddress, 'cosmos')

      const decoded = service.decodeBech32Address(result.stealthAddress)

      expect(decoded.prefix).toBe('cosmos')
      expect(decoded.hash).toBeDefined()
      expect(decoded.hash.length).toBe(20) // Cosmos addresses are 20 bytes
    })

    it('should get chain from address', () => {
      for (const chain of chains) {
        const { metaAddress } = service.generateStealthMetaAddress('cosmos')
        const result = service.generateStealthAddressFromMeta(metaAddress, chain)

        const detectedChain = service.getChainFromAddress(result.stealthAddress)
        expect(detectedChain).toBe(chain)
      }
    })

    it('should return null for unknown prefix', () => {
      const unknownAddr = 'unknown1qqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9'
      const detectedChain = service.getChainFromAddress(unknownAddr)
      expect(detectedChain).toBe(null)
    })
  })

  describe('Standalone Functions', () => {
    it('generateCosmosStealthMetaAddress() should work', () => {
      const result = generateCosmosStealthMetaAddress('cosmos', 'Test Wallet')

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('cosmos')
      expect(result.metaAddress.label).toBe('Test Wallet')
      expect(result.spendingPrivateKey).toBeDefined()
      expect(result.viewingPrivateKey).toBeDefined()
    })

    it('generateCosmosStealthAddress() should work', () => {
      const { metaAddress } = generateCosmosStealthMetaAddress('osmosis')
      const spendingPubKey = hexToBytes(metaAddress.spendingKey.slice(2))
      const viewingPubKey = hexToBytes(metaAddress.viewingKey.slice(2))

      const result = generateCosmosStealthAddress(spendingPubKey, viewingPubKey, 'osmosis')

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.startsWith('osmo')).toBe(true)
    })

    it('stealthKeyToCosmosAddress() should work', () => {
      const privateKey = new Uint8Array(32).fill(123)
      const publicKey = secp256k1.getPublicKey(privateKey, true)

      const address = stealthKeyToCosmosAddress(publicKey, 'cosmos')

      expect(address).toBeDefined()
      expect(address.startsWith('cosmos')).toBe(true)
    })

    it('isValidCosmosAddress() should work', () => {
      const { metaAddress } = generateCosmosStealthMetaAddress('injective')
      const result = generateCosmosStealthAddress(
        hexToBytes(metaAddress.spendingKey.slice(2)),
        hexToBytes(metaAddress.viewingKey.slice(2)),
        'injective'
      )

      expect(isValidCosmosAddress(result.stealthAddress)).toBe(true)
      expect(isValidCosmosAddress(result.stealthAddress, 'injective')).toBe(true)
      expect(isValidCosmosAddress('invalid')).toBe(false)
    })
  })

  describe('Cross-chain prefix tests', () => {
    it('should have correct prefixes for all chains', () => {
      expect(CHAIN_PREFIXES.cosmos).toBe('cosmos')
      expect(CHAIN_PREFIXES.osmosis).toBe('osmo')
      expect(CHAIN_PREFIXES.injective).toBe('inj')
      expect(CHAIN_PREFIXES.celestia).toBe('celestia')
      expect(CHAIN_PREFIXES.sei).toBe('sei')
      expect(CHAIN_PREFIXES.dydx).toBe('dydx')
    })

    it('should generate addresses with correct prefixes', () => {
      const testData: Array<[CosmosChainId, string]> = [
        ['cosmos', 'cosmos1'],
        ['osmosis', 'osmo1'],
        ['injective', 'inj1'],
        ['celestia', 'celestia1'],
        ['sei', 'sei1'],
        ['dydx', 'dydx1'],
      ]

      for (const [chain, expectedPrefix] of testData) {
        const { metaAddress } = service.generateStealthMetaAddress(chain)
        const result = service.generateStealthAddressFromMeta(metaAddress, chain)

        expect(result.stealthAddress.startsWith(expectedPrefix)).toBe(true)
      }
    })
  })

  describe('End-to-end flow', () => {
    it('should complete full stealth address workflow', () => {
      // 1. Recipient generates meta-address
      const recipient = service.generateStealthMetaAddress('cosmos', 'Recipient Wallet')

      // 2. Sender generates stealth address
      const sender = service.generateStealthAddressFromMeta(recipient.metaAddress, 'cosmos')

      expect(sender.stealthAddress).toBeDefined()
      expect(sender.stealthAddress.startsWith('cosmos')).toBe(true)

      // 3. Recipient derives private key to claim funds
      const recovery = service.deriveStealthPrivateKey(
        {
          address: sender.stealthPublicKey,
          ephemeralPublicKey: sender.ephemeralPublicKey,
          viewTag: sender.viewTag,
        },
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 4. Verify derived key produces correct address
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(recovery.privateKey.slice(2)),
        true
      )

      expect(`0x${bytesToHex(derivedPubKey)}`).toBe(sender.stealthPublicKey)

      // 5. Convert to Cosmos address format
      const cosmosAddress = service.stealthKeyToCosmosAddress(derivedPubKey, 'cosmos')

      expect(cosmosAddress).toBe(sender.stealthAddress)
      expect(service.isValidCosmosAddress(cosmosAddress, 'cosmos')).toBe(true)
    })
  })
})
