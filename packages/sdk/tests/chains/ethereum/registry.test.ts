/**
 * Ethereum Registry Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  RegistryClient,
  createRegistryClient,
  createMainnetRegistryClient,
  createSepoliaRegistryClient,
  isRegistered,
  extractSchemeId,
  generateEthereumStealthMetaAddress,
  EIP5564_REGISTRY_ADDRESS,
  SECP256K1_SCHEME_ID,
} from '../../../src/chains/ethereum'

describe('Ethereum Registry Client', () => {
  let registry: RegistryClient

  beforeEach(() => {
    registry = new RegistryClient('mainnet')
    registry.clearCache()
  })

  describe('constructor', () => {
    it('should create with default settings', () => {
      const client = new RegistryClient()

      expect(client.getNetwork()).toBe('mainnet')
      expect(client.getRegistryAddress()).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(client.isCacheEnabled()).toBe(true)
    })

    it('should accept custom registry address', () => {
      const customAddress = '0x1234567890123456789012345678901234567890'
      const client = new RegistryClient('mainnet', {
        registryAddress: customAddress as `0x${string}`,
      })

      expect(client.getRegistryAddress()).toBe(customAddress)
    })

    it('should allow disabling cache', () => {
      const client = new RegistryClient('mainnet', { enableCache: false })

      expect(client.isCacheEnabled()).toBe(false)
    })
  })

  describe('buildLookupCallData', () => {
    it('should build lookup call data', () => {
      const address = '0x1234567890123456789012345678901234567890'
      const { to, data } = registry.buildLookupCallData(address as `0x${string}`)

      expect(to).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(data).toMatch(/^0x3c154045/) // stealthMetaAddressOf selector
      expect(data).toContain(address.slice(2).toLowerCase())
    })

    it('should include scheme ID in call data', () => {
      const address = '0x1234567890123456789012345678901234567890'
      const { data } = registry.buildLookupCallData(address as `0x${string}`, { schemeId: 1 })

      // Scheme ID 1 should be in the last 64 hex chars
      expect(data.slice(-64)).toBe('0000000000000000000000000000000000000000000000000000000000000001')
    })

    it('should throw for invalid address', () => {
      expect(() => registry.buildLookupCallData('invalid')).toThrow()
      expect(() => registry.buildLookupCallData('0x123')).toThrow()
    })
  })

  describe('parseLookupResponse', () => {
    it('should return null for empty response', () => {
      const result = registry.parseLookupResponse(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x1234567890123456789012345678901234567890'
      )

      expect(result).toBeNull()
    })

    it('should return null for zero-length data', () => {
      // ABI encoded empty bytes: offset=0x20, length=0
      const emptyResponse = '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' + // offset
        '0000000000000000000000000000000000000000000000000000000000000000'   // length = 0
      const result = registry.parseLookupResponse(
        emptyResponse as `0x${string}`,
        '0x1234567890123456789012345678901234567890'
      )

      expect(result).toBeNull()
    })

    it('should parse valid meta-address response', () => {
      // Create a mock meta-address response
      // ABI encoded: offset (32 bytes) + length (32 bytes) + data (66 bytes padded)
      const spendingKey = '02' + '1234567890123456789012345678901234567890123456789012345678901234'
      const viewingKey = '03' + 'abcdef0123456789012345678901234567890123456789012345678901234567'

      const offset = '0000000000000000000000000000000000000000000000000000000000000020' // 32
      const length = '0000000000000000000000000000000000000000000000000000000000000042' // 66
      const data = spendingKey + viewingKey
      const padding = '0'.repeat(60) // Pad to full word

      const response = `0x${offset}${length}${data}${padding}` as `0x${string}`
      const owner = '0x1234567890123456789012345678901234567890'

      const result = registry.parseLookupResponse(response, owner as `0x${string}`)

      expect(result).not.toBeNull()
      expect(result?.owner).toBe(owner)
      expect(result?.schemeId).toBe(SECP256K1_SCHEME_ID)
      expect(result?.metaAddress.spendingKey).toMatch(/^0x02/)
      expect(result?.metaAddress.viewingKey).toMatch(/^0x03/)
      expect(result?.encoded).toMatch(/^st:eth:0x/)
    })
  })

  describe('buildRegisterTransaction', () => {
    it('should build register transaction from meta-address object', () => {
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const tx = registry.buildRegisterTransaction(metaAddress)

      expect(tx.to).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(tx.data).toMatch(/^0x4a8c1fb4/) // registerKeys selector
      expect(tx.value).toBe(0n)
      expect(tx.gasLimit).toBeGreaterThan(0n)
    })

    it('should build register transaction from encoded string', () => {
      const { encoded } = generateEthereumStealthMetaAddress()
      const tx = registry.buildRegisterTransaction(encoded)

      expect(tx.to).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(tx.data).toMatch(/^0x4a8c1fb4/)
    })

    it('should accept custom gas limit', () => {
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const tx = registry.buildRegisterTransaction(metaAddress, {
        gasLimit: 200000n,
      })

      expect(tx.gasLimit).toBe(200000n)
    })
  })

  describe('buildUpdateTransaction', () => {
    it('should build update transaction', () => {
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const tx = registry.buildUpdateTransaction(metaAddress)

      expect(tx.to).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(tx.data).toMatch(/^0x4a8c1fb4/) // Same as register
      expect(tx.gasLimit).toBeLessThan(150000n) // Lower gas for updates
    })
  })

  describe('buildNonceCallData', () => {
    it('should build nonce call data', () => {
      const address = '0x1234567890123456789012345678901234567890'
      const { to, data } = registry.buildNonceCallData(address as `0x${string}`)

      expect(to).toBe(EIP5564_REGISTRY_ADDRESS)
      expect(data).toMatch(/^0x70ae92d2/) // nonceOf selector
      expect(data).toContain(address.slice(2).toLowerCase())
    })

    it('should throw for invalid address', () => {
      expect(() => registry.buildNonceCallData('invalid')).toThrow()
    })
  })

  describe('parseNonceResponse', () => {
    it('should parse nonce response', () => {
      const response = '0x0000000000000000000000000000000000000000000000000000000000000005'
      const nonce = registry.parseNonceResponse(response as `0x${string}`)

      expect(nonce).toBe(5n)
    })

    it('should handle zero nonce', () => {
      const response = '0x0000000000000000000000000000000000000000000000000000000000000000'
      const nonce = registry.parseNonceResponse(response as `0x${string}`)

      expect(nonce).toBe(0n)
    })
  })

  describe('caching', () => {
    it('should cache lookup results', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`
      const entry = {
        owner: address,
        schemeId: SECP256K1_SCHEME_ID,
        metaAddress: generateEthereumStealthMetaAddress().metaAddress,
        encoded: 'st:eth:0x...',
      }

      registry.setCached(address, entry)

      const cached = registry.getCached(address)
      expect(cached).toEqual(entry)
    })

    it('should return undefined for uncached addresses', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`

      const cached = registry.getCached(address)
      expect(cached).toBeUndefined()
    })

    it('should clear cache', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`
      const entry = {
        owner: address,
        schemeId: SECP256K1_SCHEME_ID,
        metaAddress: generateEthereumStealthMetaAddress().metaAddress,
        encoded: 'st:eth:0x...',
      }

      registry.setCached(address, entry)
      registry.clearCache()

      const cached = registry.getCached(address)
      expect(cached).toBeUndefined()
    })

    it('should not cache when disabled', () => {
      const client = new RegistryClient('mainnet', { enableCache: false })
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`
      const entry = {
        owner: address,
        schemeId: SECP256K1_SCHEME_ID,
        metaAddress: generateEthereumStealthMetaAddress().metaAddress,
        encoded: 'st:eth:0x...',
      }

      client.setCached(address, entry)

      const cached = client.getCached(address)
      expect(cached).toBeUndefined()
    })

    it('should allow enabling/disabling cache', () => {
      registry.setCacheEnabled(false)
      expect(registry.isCacheEnabled()).toBe(false)

      registry.setCacheEnabled(true)
      expect(registry.isCacheEnabled()).toBe(true)
    })
  })

  describe('factory functions', () => {
    it('should create registry client with factory', () => {
      const client = createRegistryClient('sepolia')
      expect(client.getNetwork()).toBe('sepolia')
    })

    it('should create mainnet registry client', () => {
      const client = createMainnetRegistryClient()
      expect(client.getNetwork()).toBe('mainnet')
    })

    it('should create Sepolia registry client', () => {
      const client = createSepoliaRegistryClient()
      expect(client.getNetwork()).toBe('sepolia')
    })
  })

  describe('helper functions', () => {
    describe('isRegistered', () => {
      it('should return false for empty response', () => {
        expect(isRegistered('0x0' as `0x${string}`)).toBe(false)
        expect(isRegistered('0x' as `0x${string}`)).toBe(false)
      })

      it('should return false for zero-length data', () => {
        const response = '0x' +
          '0000000000000000000000000000000000000000000000000000000000000020' +
          '0000000000000000000000000000000000000000000000000000000000000000'
        expect(isRegistered(response as `0x${string}`)).toBe(false)
      })

      it('should return true for non-zero-length data', () => {
        const response = '0x' +
          '0000000000000000000000000000000000000000000000000000000000000020' +
          '0000000000000000000000000000000000000000000000000000000000000042' + // length = 66
          '0'.repeat(132) // 66 bytes of data
        expect(isRegistered(response as `0x${string}`)).toBe(true)
      })
    })

    describe('extractSchemeId', () => {
      it('should return secp256k1 scheme ID', () => {
        expect(extractSchemeId('st:eth:0x...')).toBe(SECP256K1_SCHEME_ID)
        expect(extractSchemeId('0x1234')).toBe(SECP256K1_SCHEME_ID)
      })
    })
  })
})
