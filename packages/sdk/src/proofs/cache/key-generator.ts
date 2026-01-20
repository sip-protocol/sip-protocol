/**
 * Cache Key Generator for Proof Caching
 *
 * @module proofs/cache/key-generator
 * @description Generates deterministic cache keys from proof inputs
 *
 * M20-13: Implement proof caching layer (#313)
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import type { CacheKey, CacheKeyComponents, ICacheKeyGenerator } from './interface'

// ─── Constants ───────────────────────────────────────────────────────────────

const KEY_SEPARATOR = ':'
const KEY_PREFIX = 'sip-proof'
const KEY_VERSION = 'v1'

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Canonicalize an object for deterministic hashing
 * Sorts keys recursively and handles special types
 */
function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  if (typeof value === 'bigint') {
    return `bigint:${value.toString()}`
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN'
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
    return value.toString()
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'boolean') {
    return value.toString()
  }

  if (value instanceof Uint8Array) {
    return `bytes:${bytesToHex(value)}`
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort()
    const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`)
    return `{${pairs.join(',')}}`
  }

  return String(value)
}

// ─── Cache Key Generator Implementation ──────────────────────────────────────

/**
 * Generates deterministic cache keys from proof input components
 */
export class CacheKeyGenerator implements ICacheKeyGenerator {
  /**
   * Generate a cache key from components
   */
  generate(components: CacheKeyComponents): CacheKey {
    const parts = [
      KEY_PREFIX,
      KEY_VERSION,
      components.system,
      components.circuitId,
      components.privateInputsHash,
      components.publicInputsHash,
    ]

    if (components.version) {
      parts.push(components.version)
    }

    const key = parts.join(KEY_SEPARATOR)

    return {
      key,
      components,
      generatedAt: Date.now(),
    }
  }

  /**
   * Parse a cache key string back to components
   */
  parse(key: string): CacheKeyComponents | null {
    const parts = key.split(KEY_SEPARATOR)

    // Validate prefix and version
    if (parts.length < 6 || parts[0] !== KEY_PREFIX || parts[1] !== KEY_VERSION) {
      return null
    }

    const [, , system, circuitId, privateInputsHash, publicInputsHash, version] = parts

    // Validate system is a known proof system
    const validSystems = ['noir', 'halo2', 'kimchi', 'groth16', 'plonk', 'stark', 'bulletproofs']
    if (!validSystems.includes(system)) {
      return null
    }

    return {
      system: system as CacheKeyComponents['system'],
      circuitId,
      privateInputsHash,
      publicInputsHash,
      version,
    }
  }

  /**
   * Hash input data deterministically
   */
  hashInputs(inputs: Record<string, unknown>): string {
    const canonical = canonicalize(inputs)
    const hash = sha256(new TextEncoder().encode(canonical))
    return bytesToHex(hash)
  }

  /**
   * Generate a cache key from raw inputs
   */
  generateFromInputs(
    system: CacheKeyComponents['system'],
    circuitId: string,
    privateInputs: Record<string, unknown>,
    publicInputs: Record<string, unknown>,
    version?: string
  ): CacheKey {
    return this.generate({
      system,
      circuitId,
      privateInputsHash: this.hashInputs(privateInputs),
      publicInputsHash: this.hashInputs(publicInputs),
      version,
    })
  }

  /**
   * Check if two cache keys are equal
   */
  equals(a: CacheKey | string, b: CacheKey | string): boolean {
    const keyA = typeof a === 'string' ? a : a.key
    const keyB = typeof b === 'string' ? b : b.key
    return keyA === keyB
  }

  /**
   * Check if a key matches a pattern (glob-style)
   */
  matches(key: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.') // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }
}

/**
 * Create a cache key generator instance
 */
export function createCacheKeyGenerator(): ICacheKeyGenerator {
  return new CacheKeyGenerator()
}

/**
 * Singleton instance for convenience
 */
export const cacheKeyGenerator = new CacheKeyGenerator()
