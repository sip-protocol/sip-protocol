/**
 * Ethereum Stealth Meta-Address Registry Client
 *
 * ERC-6538 compliant registry for publishing and discovering
 * stealth meta-addresses on Ethereum.
 *
 * @module chains/ethereum/registry
 */

import type { HexString } from '@sip-protocol/types'
import {
  type EthereumNetwork,
  EIP5564_REGISTRY_ADDRESS,
  SECP256K1_SCHEME_ID,
  isValidEthAddress,
} from './constants'
import {
  parseEthereumStealthMetaAddress,
  encodeEthereumStealthMetaAddress,
  type EthereumStealthMetaAddress,
} from './stealth'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Registry entry for a stealth meta-address
 */
export interface StealthRegistryEntry {
  /**
   * Owner's Ethereum address
   */
  owner: HexString

  /**
   * Scheme ID (1 = secp256k1)
   */
  schemeId: number

  /**
   * Stealth meta-address
   */
  metaAddress: EthereumStealthMetaAddress

  /**
   * Encoded meta-address string
   */
  encoded: string

  /**
   * Block number when registered
   */
  blockNumber?: number

  /**
   * Timestamp when registered
   */
  timestamp?: number
}

/**
 * Options for registry lookup
 */
export interface RegistryLookupOptions {
  /**
   * Scheme ID to filter by (default: SECP256K1_SCHEME_ID)
   */
  schemeId?: number

  /**
   * Block number to query at (latest if not specified)
   */
  blockNumber?: number | 'latest'
}

/**
 * Options for registry registration
 */
export interface RegistryRegisterOptions {
  /**
   * Scheme ID (default: SECP256K1_SCHEME_ID)
   */
  schemeId?: number

  /**
   * Gas limit override
   */
  gasLimit?: bigint
}

/**
 * Result of registry query
 */
export interface RegistryQueryResult {
  /**
   * Whether an entry was found
   */
  found: boolean

  /**
   * The registry entry (if found)
   */
  entry?: StealthRegistryEntry

  /**
   * Raw bytes from registry (for debugging)
   */
  rawData?: HexString
}

/**
 * Built transaction for registry operations
 */
export interface RegistryTransaction {
  /**
   * Target contract address
   */
  to: HexString

  /**
   * Transaction data
   */
  data: HexString

  /**
   * Value (should be 0 for registry operations)
   */
  value: bigint

  /**
   * Suggested gas limit
   */
  gasLimit: bigint
}

/**
 * Registry cache entry
 */
interface CacheEntry {
  entry: StealthRegistryEntry | null
  timestamp: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Registry contract ABI selectors
 */
const REGISTRY_SELECTORS = {
  /**
   * registerKeys(uint256 schemeId, bytes stealthMetaAddress)
   */
  registerKeys: '0x4a8c1fb4',

  /**
   * registerKeysOnBehalf(address registrant, uint256 schemeId, bytes signature, bytes stealthMetaAddress)
   */
  registerKeysOnBehalf: '0x6ea7b7ef',

  /**
   * stealthMetaAddressOf(address registrant, uint256 schemeId) returns (bytes)
   */
  stealthMetaAddressOf: '0x3c154045',

  /**
   * incrementNonce() - for signature replay protection
   */
  incrementNonce: '0xd09de08a',

  /**
   * nonceOf(address registrant) returns (uint256)
   */
  nonceOf: '0x70ae92d2',
} as const

/**
 * Cache duration (5 minutes)
 */
const CACHE_DURATION = 5 * 60 * 1000

/**
 * Network-specific registry addresses
 * Falls back to default EIP5564_REGISTRY_ADDRESS
 */
const REGISTRY_ADDRESSES: Partial<Record<EthereumNetwork, HexString>> = {
  mainnet: EIP5564_REGISTRY_ADDRESS as HexString,
  sepolia: EIP5564_REGISTRY_ADDRESS as HexString,
  // Other networks may have different addresses
}

// ─── Registry Client Class ──────────────────────────────────────────────────

/**
 * ERC-6538 Stealth Meta-Address Registry Client
 *
 * Provides methods to lookup and register stealth meta-addresses on-chain.
 *
 * @example Basic usage
 * ```typescript
 * const registry = new RegistryClient('mainnet')
 *
 * // Lookup meta-address
 * const result = await registry.lookup('0x...')
 * if (result.found) {
 *   console.log(result.entry?.encoded)
 * }
 *
 * // Build registration transaction
 * const tx = registry.buildRegisterTransaction(metaAddress)
 * // Sign and submit tx externally
 * ```
 */
export class RegistryClient {
  private network: EthereumNetwork
  private registryAddress: HexString
  private cache: Map<string, CacheEntry> = new Map()
  private cacheEnabled: boolean

  constructor(
    network: EthereumNetwork = 'mainnet',
    options?: {
      registryAddress?: HexString
      enableCache?: boolean
    }
  ) {
    this.network = network
    this.registryAddress = options?.registryAddress ??
      (REGISTRY_ADDRESSES[network] ?? EIP5564_REGISTRY_ADDRESS) as HexString
    this.cacheEnabled = options?.enableCache ?? true
  }

  // ─── Query Methods ───────────────────────────────────────────────────────────

  /**
   * Build call data for looking up a meta-address
   *
   * Use this to make an eth_call to the registry.
   *
   * @param address - Ethereum address to lookup
   * @param options - Lookup options
   * @returns Call data for eth_call
   */
  buildLookupCallData(
    address: HexString,
    options: RegistryLookupOptions = {}
  ): { to: HexString; data: HexString } {
    if (!isValidEthAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`)
    }

    const schemeId = options.schemeId ?? SECP256K1_SCHEME_ID

    // Encode: stealthMetaAddressOf(address,uint256)
    const addressParam = address.slice(2).padStart(64, '0')
    const schemeIdParam = schemeId.toString(16).padStart(64, '0')
    const data = `${REGISTRY_SELECTORS.stealthMetaAddressOf}${addressParam}${schemeIdParam}` as HexString

    return {
      to: this.registryAddress,
      data,
    }
  }

  /**
   * Parse the response from a lookup call
   *
   * @param response - Raw response from eth_call
   * @param owner - The address that was looked up
   * @returns Parsed registry entry or null
   */
  parseLookupResponse(
    response: HexString,
    owner: HexString
  ): StealthRegistryEntry | null {
    // Remove 0x prefix
    const data = response.slice(2)

    // Empty response or zero response means not registered
    if (!data || data === '0' || data === '' || /^0+$/.test(data)) {
      return null
    }

    try {
      // Response is ABI-encoded bytes
      // Format: offset (32 bytes) + length (32 bytes) + data
      if (data.length < 128) {
        return null
      }

      // Skip offset (first 32 bytes)
      // Get length (next 32 bytes)
      const lengthHex = data.slice(64, 128)
      const length = parseInt(lengthHex, 16)

      if (length === 0) {
        return null
      }

      // Get actual data
      const metaAddressBytes = data.slice(128, 128 + length * 2)

      // Meta-address format: spendingKey (33 bytes) + viewingKey (33 bytes)
      if (metaAddressBytes.length !== 132) {
        // 66 * 2 = 132 hex chars
        return null
      }

      const spendingKey = `0x${metaAddressBytes.slice(0, 66)}` as HexString
      const viewingKey = `0x${metaAddressBytes.slice(66)}` as HexString

      const metaAddress: EthereumStealthMetaAddress = {
        chain: 'ethereum',
        schemeId: SECP256K1_SCHEME_ID,
        spendingKey,
        viewingKey,
      }

      const encoded = encodeEthereumStealthMetaAddress(metaAddress)

      return {
        owner,
        schemeId: SECP256K1_SCHEME_ID,
        metaAddress,
        encoded,
      }
    } catch {
      return null
    }
  }

  /**
   * Get a cached lookup result
   *
   * @param address - Address to check cache for
   * @returns Cached entry or undefined
   */
  getCached(address: HexString): StealthRegistryEntry | null | undefined {
    if (!this.cacheEnabled) return undefined

    const key = this.getCacheKey(address)
    const cached = this.cache.get(key)

    if (!cached) return undefined
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      this.cache.delete(key)
      return undefined
    }

    return cached.entry
  }

  /**
   * Cache a lookup result
   *
   * @param address - Address that was looked up
   * @param entry - Result to cache (null if not found)
   */
  setCached(address: HexString, entry: StealthRegistryEntry | null): void {
    if (!this.cacheEnabled) return

    const key = this.getCacheKey(address)
    this.cache.set(key, {
      entry,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  // ─── Registration Methods ────────────────────────────────────────────────────

  /**
   * Build a transaction to register a stealth meta-address
   *
   * @param metaAddress - Meta-address to register
   * @param options - Registration options
   * @returns Transaction to sign and submit
   */
  buildRegisterTransaction(
    metaAddress: EthereumStealthMetaAddress | string,
    options: RegistryRegisterOptions = {}
  ): RegistryTransaction {
    const parsed = typeof metaAddress === 'string'
      ? parseEthereumStealthMetaAddress(metaAddress)
      : metaAddress

    const schemeId = options.schemeId ?? SECP256K1_SCHEME_ID

    // Encode the meta-address bytes
    const metaAddressBytes = this.encodeMetaAddressBytes(parsed)

    // Encode: registerKeys(uint256 schemeId, bytes stealthMetaAddress)
    const schemeIdParam = schemeId.toString(16).padStart(64, '0')

    // ABI encode bytes: offset + length + data
    const offset = (64).toString(16).padStart(64, '0') // 0x40 = 64
    const length = (66).toString(16).padStart(64, '0') // 66 bytes
    const paddedBytes = metaAddressBytes.padEnd(128, '0') // Pad to 64 bytes (2 words)

    const data = `${REGISTRY_SELECTORS.registerKeys}${schemeIdParam}${offset}${length}${paddedBytes}` as HexString

    return {
      to: this.registryAddress,
      data,
      value: 0n,
      gasLimit: options.gasLimit ?? 150000n,
    }
  }

  /**
   * Build a transaction to update an existing registration
   *
   * (Same as register - the contract handles updates)
   *
   * @param metaAddress - New meta-address
   * @param options - Registration options
   * @returns Transaction to sign and submit
   */
  buildUpdateTransaction(
    metaAddress: EthereumStealthMetaAddress | string,
    options: RegistryRegisterOptions = {}
  ): RegistryTransaction {
    return this.buildRegisterTransaction(metaAddress, {
      ...options,
      gasLimit: options.gasLimit ?? 100000n, // Lower gas for updates
    })
  }

  // ─── Nonce Methods ───────────────────────────────────────────────────────────

  /**
   * Build call data for getting the nonce of an address
   *
   * Used for signature-based registration on behalf of others.
   *
   * @param address - Address to get nonce for
   * @returns Call data for eth_call
   */
  buildNonceCallData(address: HexString): { to: HexString; data: HexString } {
    if (!isValidEthAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`)
    }

    const addressParam = address.slice(2).padStart(64, '0')
    const data = `${REGISTRY_SELECTORS.nonceOf}${addressParam}` as HexString

    return {
      to: this.registryAddress,
      data,
    }
  }

  /**
   * Parse nonce response
   *
   * @param response - Raw response from eth_call
   * @returns Nonce value
   */
  parseNonceResponse(response: HexString): bigint {
    return BigInt(response)
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────────

  /**
   * Get the registry contract address
   */
  getRegistryAddress(): HexString {
    return this.registryAddress
  }

  /**
   * Get the network
   */
  getNetwork(): EthereumNetwork {
    return this.network
  }

  /**
   * Check if caching is enabled
   */
  isCacheEnabled(): boolean {
    return this.cacheEnabled
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
    if (!enabled) {
      this.clearCache()
    }
  }

  /**
   * Get cache key for an address
   */
  private getCacheKey(address: HexString): string {
    return `${this.network}:${address.toLowerCase()}`
  }

  /**
   * Encode meta-address to bytes (spending + viewing keys)
   */
  private encodeMetaAddressBytes(metaAddress: EthereumStealthMetaAddress): string {
    // Remove 0x prefixes and concatenate
    const spending = metaAddress.spendingKey.slice(2)
    const viewing = metaAddress.viewingKey.slice(2)
    return `${spending}${viewing}`
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a registry client for a specific network
 *
 * @param network - Target network
 * @param options - Client options
 * @returns Registry client
 */
export function createRegistryClient(
  network: EthereumNetwork = 'mainnet',
  options?: {
    registryAddress?: HexString
    enableCache?: boolean
  }
): RegistryClient {
  return new RegistryClient(network, options)
}

/**
 * Create a mainnet registry client
 */
export function createMainnetRegistryClient(): RegistryClient {
  return new RegistryClient('mainnet')
}

/**
 * Create a Sepolia testnet registry client
 */
export function createSepoliaRegistryClient(): RegistryClient {
  return new RegistryClient('sepolia')
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Check if an address has a registered meta-address
 *
 * Helper that takes raw eth_call response.
 *
 * @param response - eth_call response
 * @returns True if registered
 */
export function isRegistered(response: HexString): boolean {
  const data = response.slice(2)
  if (!data || data === '0' || /^0+$/.test(data)) {
    return false
  }
  // Check if length is non-zero
  if (data.length >= 128) {
    const lengthHex = data.slice(64, 128)
    const length = parseInt(lengthHex, 16)
    return length > 0
  }
  return false
}

/**
 * Extract scheme ID from meta-address prefix
 *
 * @param _metaAddress - Meta-address bytes or encoded string (unused, for future expansion)
 * @returns Scheme ID
 */
export function extractSchemeId(_metaAddress: HexString | string): number {
  // For now, we only support secp256k1
  return SECP256K1_SCHEME_ID
}
