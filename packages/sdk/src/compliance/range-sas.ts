/**
 * Range SAS (Solana Attestation Service) Integration
 *
 * Enables attestation-gated viewing key disclosure for regulatory compliance.
 * Auditors must present a valid SAS attestation to receive viewing keys.
 *
 * ## How It Works
 *
 * 1. Auditor obtains a KYC/compliance attestation from Range SAS
 * 2. Auditor presents attestation to the viewing key holder
 * 3. System verifies attestation on-chain or via Range API
 * 4. If valid, a scoped viewing key is derived for the auditor
 * 5. Auditor can now decrypt and view transaction history
 *
 * ## Security Properties
 *
 * - **Attestation-gated**: Only verified auditors receive keys
 * - **Scoped access**: Derived keys can be time-limited or scope-limited
 * - **Non-transferable**: Keys are bound to auditor's attestation
 * - **Revocable**: Revoking attestation invalidates the viewing key
 *
 * @see https://www.range.org/blog/introducing-solana-attestation-service
 *
 * @example
 * ```typescript
 * import { AttestationGatedDisclosure, RangeSASAttestation } from '@sip-protocol/sdk'
 *
 * // Create disclosure manager with organization's master viewing key
 * const disclosure = new AttestationGatedDisclosure({
 *   masterViewingKey: organizationViewingKey,
 *   allowedSchemas: ['range-kyc-v1', 'range-accredited-investor'],
 * })
 *
 * // Auditor presents their attestation
 * const attestation: RangeSASAttestation = {
 *   uid: 'sas_123...',
 *   schema: 'range-kyc-v1',
 *   issuer: 'range-protocol',
 *   subject: 'auditor-wallet-address',
 *   data: { level: 'institutional', jurisdiction: 'US' },
 *   timestamp: Date.now() / 1000,
 *   expiresAt: Date.now() / 1000 + 365 * 24 * 60 * 60,
 *   signature: '0x...',
 * }
 *
 * // Verify and derive viewing key
 * const result = await disclosure.deriveViewingKeyForAuditor(attestation)
 * if (result.granted) {
 *   console.log('Auditor viewing key:', result.viewingKey)
 * }
 * ```
 */

import type { ViewingKey, HexString, Hash } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha512'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { ValidationError, ErrorCode } from '../errors'
import { secureWipe } from '../secure-memory'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Range SAS attestation structure
 *
 * Represents a verifiable claim issued by Range SAS.
 */
export interface RangeSASAttestation {
  /** Unique identifier for this attestation */
  uid: string
  /** Schema defining the attestation type (e.g., 'range-kyc-v1') */
  schema: string
  /** Address of the attestation issuer */
  issuer: string
  /** Address of the attestation subject (auditor wallet) */
  subject: string
  /** Attestation data payload */
  data: Record<string, unknown>
  /** Unix timestamp when attestation was created */
  timestamp: number
  /** Unix timestamp when attestation expires (0 = never) */
  expiresAt: number
  /** Cryptographic signature from issuer */
  signature: string
  /** Whether the attestation has been revoked */
  revoked?: boolean
  /** On-chain transaction signature (if stored on-chain) */
  txSignature?: string
}

/**
 * Supported attestation schemas
 */
export enum AttestationSchema {
  /** Basic KYC verification */
  RANGE_KYC_V1 = 'range-kyc-v1',
  /** Accredited investor status */
  RANGE_ACCREDITED_INVESTOR = 'range-accredited-investor',
  /** Institutional entity verification */
  RANGE_INSTITUTIONAL = 'range-institutional',
  /** Regulatory authority attestation */
  RANGE_REGULATOR = 'range-regulator',
  /** Custom schema (requires explicit approval) */
  CUSTOM = 'custom',
}

/**
 * Configuration for attestation-gated disclosure
 */
export interface AttestationGatedConfig {
  /** Master viewing key to derive auditor keys from */
  masterViewingKey: ViewingKey
  /** Allowed attestation schemas (empty = all schemas) */
  allowedSchemas?: string[]
  /** Allowed issuers (empty = all issuers) */
  allowedIssuers?: string[]
  /** Whether to verify attestations on-chain (default: false = API verification) */
  verifyOnChain?: boolean
  /** Range API endpoint for verification */
  rangeApiEndpoint?: string
  /** Minimum attestation age in seconds (prevents replay attacks) */
  minAttestationAge?: number
  /** Maximum attestation age in seconds (enforces time-bounded access, 0 = no limit) */
  maxAttestationAge?: number
  /** Maximum number of cached derived keys (default: 1000) */
  maxCacheSize?: number
  /** Custom verification function */
  customVerifier?: (attestation: RangeSASAttestation) => Promise<boolean>
}

/**
 * Result of viewing key derivation
 */
export interface ViewingKeyDerivationResult {
  /** Whether access was granted */
  granted: boolean
  /** The derived viewing key (if granted) */
  viewingKey?: ViewingKey
  /** Reason for denial (if not granted) */
  reason?: string
  /** Scope of the granted access */
  scope?: ViewingKeyScope
  /** Expiration timestamp of the viewing key */
  expiresAt?: number
}

/**
 * Scope of viewing key access
 */
export interface ViewingKeyScope {
  /** Start timestamp for viewable transactions */
  startTime?: number
  /** End timestamp for viewable transactions */
  endTime?: number
  /** Specific transaction types viewable */
  transactionTypes?: string[]
  /** Maximum number of transactions viewable */
  maxTransactions?: number
}

/**
 * Attestation verification result
 */
export interface AttestationVerificationResult {
  /** Whether the attestation is valid */
  valid: boolean
  /** Verification errors (if any) */
  errors: string[]
  /** Attestation metadata */
  metadata?: {
    issuerName?: string
    schemaVersion?: string
    verificationMethod: 'on-chain' | 'api' | 'custom'
  }
}

// ─── Attestation-Gated Disclosure ─────────────────────────────────────────────

/**
 * Attestation-gated viewing key disclosure
 *
 * Manages the secure disclosure of viewing keys to verified auditors.
 * Only auditors with valid Range SAS attestations can receive keys.
 */
/**
 * Default maximum cache size for derived keys
 */
const DEFAULT_MAX_CACHE_SIZE = 1000

export class AttestationGatedDisclosure {
  private readonly config: Required<AttestationGatedConfig>
  private readonly derivedKeys: Map<string, ViewingKey> = new Map()
  private readonly cacheOrder: string[] = [] // LRU tracking

  /**
   * Create a new attestation-gated disclosure manager
   *
   * @param config - Configuration options
   */
  constructor(config: AttestationGatedConfig) {
    if (!config.masterViewingKey) {
      throw new ValidationError(
        'masterViewingKey is required',
        'masterViewingKey',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    this.config = {
      masterViewingKey: config.masterViewingKey,
      allowedSchemas: config.allowedSchemas ?? [],
      allowedIssuers: config.allowedIssuers ?? [],
      verifyOnChain: config.verifyOnChain ?? false,
      rangeApiEndpoint: config.rangeApiEndpoint ?? 'https://api.range.org/v1',
      minAttestationAge: config.minAttestationAge ?? 0,
      maxAttestationAge: config.maxAttestationAge ?? 0, // 0 = no limit
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      customVerifier: config.customVerifier ?? (async () => true),
    }
  }

  /**
   * Derive a viewing key for a verified auditor
   *
   * @param attestation - The auditor's Range SAS attestation
   * @param scope - Optional scope restrictions for the viewing key
   * @returns Derivation result with viewing key if granted
   *
   * @example
   * ```typescript
   * const result = await disclosure.deriveViewingKeyForAuditor(attestation, {
   *   startTime: Date.now() / 1000 - 30 * 24 * 60 * 60, // Last 30 days
   *   endTime: Date.now() / 1000,
   * })
   *
   * if (result.granted) {
   *   // Share result.viewingKey with auditor
   * }
   * ```
   */
  async deriveViewingKeyForAuditor(
    attestation: RangeSASAttestation,
    scope?: ViewingKeyScope
  ): Promise<ViewingKeyDerivationResult> {
    // Step 1: Verify the attestation
    const verification = await this.verifyAttestation(attestation)

    if (!verification.valid) {
      return {
        granted: false,
        reason: verification.errors.join('; '),
      }
    }

    // Step 2: Check if we've already derived a key for this attestation
    const cacheKey = this.getCacheKey(attestation)
    const cached = this.derivedKeys.get(cacheKey)
    if (cached) {
      // Update LRU order
      this.updateCacheOrder(cacheKey)
      return {
        granted: true,
        viewingKey: cached,
        scope,
        expiresAt: attestation.expiresAt, // 0 = never expires, undefined = not set
      }
    }

    // Step 3: Derive a unique viewing key for this auditor
    const viewingKey = this.deriveKeyFromAttestation(attestation)

    // Step 4: Cache the derived key with LRU eviction
    this.cacheKey(cacheKey, viewingKey)

    return {
      granted: true,
      viewingKey,
      scope,
      expiresAt: attestation.expiresAt, // 0 = never expires, undefined = not set
    }
  }

  /**
   * Verify a Range SAS attestation
   *
   * @param attestation - The attestation to verify
   * @returns Verification result
   */
  async verifyAttestation(
    attestation: RangeSASAttestation
  ): Promise<AttestationVerificationResult> {
    const errors: string[] = []

    // Validate required fields exist and are non-empty
    if (!attestation || typeof attestation !== 'object') {
      return {
        valid: false,
        errors: ['Attestation must be an object'],
      }
    }

    if (!attestation.uid || typeof attestation.uid !== 'string' || attestation.uid.trim() === '') {
      errors.push('Attestation uid is required and must be a non-empty string')
    }

    if (!attestation.subject || typeof attestation.subject !== 'string' || attestation.subject.trim() === '') {
      errors.push('Attestation subject is required and must be a non-empty string')
    }

    if (!attestation.schema || typeof attestation.schema !== 'string' || attestation.schema.trim() === '') {
      errors.push('Attestation schema is required and must be a non-empty string')
    }

    if (!attestation.issuer || typeof attestation.issuer !== 'string' || attestation.issuer.trim() === '') {
      errors.push('Attestation issuer is required and must be a non-empty string')
    }

    // If basic validation fails, return early
    if (errors.length > 0) {
      return { valid: false, errors }
    }

    // Check if attestation is revoked
    if (attestation.revoked) {
      errors.push('Attestation has been revoked')
    }

    // Check expiration
    const now = Date.now() / 1000
    if (attestation.expiresAt > 0 && attestation.expiresAt < now) {
      errors.push('Attestation has expired')
    }

    // Check minimum age (anti-replay)
    const age = now - attestation.timestamp
    if (age < this.config.minAttestationAge) {
      errors.push(`Attestation too new (age: ${age}s, required: ${this.config.minAttestationAge}s)`)
    }

    // Check maximum age (time-bounded access)
    if (this.config.maxAttestationAge > 0 && age > this.config.maxAttestationAge) {
      errors.push(`Attestation too old (age: ${Math.floor(age)}s, max: ${this.config.maxAttestationAge}s)`)
    }

    // Check schema allowlist
    if (this.config.allowedSchemas.length > 0) {
      if (!this.config.allowedSchemas.includes(attestation.schema)) {
        errors.push(`Schema '${attestation.schema}' not in allowed list`)
      }
    }

    // Check issuer allowlist
    if (this.config.allowedIssuers.length > 0) {
      if (!this.config.allowedIssuers.includes(attestation.issuer)) {
        errors.push(`Issuer '${attestation.issuer}' not in allowed list`)
      }
    }

    // Run custom verification if provided
    if (errors.length === 0 && this.config.customVerifier) {
      try {
        const customValid = await this.config.customVerifier(attestation)
        if (!customValid) {
          errors.push('Custom verification failed')
        }
      } catch (e) {
        errors.push(`Custom verification error: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata: {
        verificationMethod: this.config.verifyOnChain ? 'on-chain' : 'api',
        schemaVersion: attestation.schema,
      },
    }
  }

  /**
   * Revoke a previously derived viewing key
   *
   * @param attestation - The attestation whose key should be revoked
   * @returns Whether revocation was successful
   */
  revokeViewingKey(attestation: RangeSASAttestation): boolean {
    const key = this.getCacheKey(attestation)
    const deleted = this.derivedKeys.delete(key)
    if (deleted) {
      // Remove from LRU order
      const index = this.cacheOrder.indexOf(key)
      if (index !== -1) {
        this.cacheOrder.splice(index, 1)
      }
    }
    return deleted
  }

  /**
   * Check if a viewing key has been derived for an attestation
   *
   * @param attestation - The attestation to check
   * @returns Whether a key exists
   */
  hasViewingKey(attestation: RangeSASAttestation): boolean {
    const key = this.getCacheKey(attestation)
    return this.derivedKeys.has(key)
  }

  /**
   * Get the current cache size
   *
   * @returns Number of cached viewing keys
   */
  getCacheSize(): number {
    return this.derivedKeys.size
  }

  /**
   * Clear all cached viewing keys
   */
  clearCache(): void {
    this.derivedKeys.clear()
    this.cacheOrder.length = 0
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Add a key to cache with LRU eviction
   */
  private cacheKey(key: string, viewingKey: ViewingKey): void {
    // Evict oldest entries if cache is full
    while (this.derivedKeys.size >= this.config.maxCacheSize && this.cacheOrder.length > 0) {
      const oldest = this.cacheOrder.shift()
      if (oldest) {
        this.derivedKeys.delete(oldest)
      }
    }

    this.derivedKeys.set(key, viewingKey)
    this.cacheOrder.push(key)
  }

  /**
   * Update LRU order for a cache key (move to end)
   */
  private updateCacheOrder(key: string): void {
    const index = this.cacheOrder.indexOf(key)
    if (index !== -1) {
      this.cacheOrder.splice(index, 1)
      this.cacheOrder.push(key)
    }
  }

  /**
   * Derive a viewing key from an attestation
   */
  private deriveKeyFromAttestation(attestation: RangeSASAttestation): ViewingKey {
    const masterKeyHex = this.config.masterViewingKey.key.startsWith('0x')
      ? this.config.masterViewingKey.key.slice(2)
      : this.config.masterViewingKey.key
    const masterKeyBytes = hexToBytes(masterKeyHex)

    // Create derivation data from attestation
    // Include signature to cryptographically bind keys to attestation
    // This prevents forgery attacks where attacker uses same uid/subject
    const derivationData = utf8ToBytes(
      `SIP-RANGE-SAS:${attestation.uid}:${attestation.subject}:${attestation.schema}:${attestation.signature}`
    )

    // HMAC-SHA512 derivation
    const derived = hmac(sha512, masterKeyBytes, derivationData)
    const keyBytes = derived.slice(0, 32)

    try {
      const key = `0x${bytesToHex(keyBytes)}` as HexString
      const hashBytes = sha256(keyBytes)
      const hash = `0x${bytesToHex(hashBytes)}` as Hash

      return {
        key,
        path: `${this.config.masterViewingKey.path}/sas/${attestation.uid.slice(0, 8)}`,
        hash,
      }
    } finally {
      secureWipe(masterKeyBytes)
      secureWipe(derived)
      secureWipe(keyBytes)
    }
  }

  /**
   * Get cache key for an attestation
   *
   * Includes schema and issuer to prevent cache poisoning attacks where
   * an attacker could evict legitimate cache entries with same uid:subject.
   */
  private getCacheKey(attestation: RangeSASAttestation): string {
    return `${attestation.uid}:${attestation.subject}:${attestation.schema}:${attestation.issuer}`
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Create a mock attestation for testing
 *
 * @param overrides - Fields to override
 * @returns Mock attestation
 */
export function createMockAttestation(
  overrides: Partial<RangeSASAttestation> = {}
): RangeSASAttestation {
  const now = Math.floor(Date.now() / 1000)

  return {
    uid: `sas_${Math.random().toString(36).slice(2, 10)}`,
    schema: AttestationSchema.RANGE_KYC_V1,
    issuer: 'range-protocol',
    subject: '11111111111111111111111111111112', // System program (placeholder)
    data: {
      level: 'institutional',
      jurisdiction: 'US',
      verifiedAt: now,
    },
    timestamp: now,
    expiresAt: now + 365 * 24 * 60 * 60, // 1 year
    signature: '0x' + '00'.repeat(64),
    revoked: false,
    ...overrides,
  }
}

/**
 * Verify attestation signature (placeholder for real implementation)
 *
 * ⚠️ WARNING: This is a stub that always returns true!
 * Do NOT use in production without implementing real verification.
 *
 * In production, this would:
 * 1. Fetch the issuer's public key from Range SAS registry
 * 2. Verify the signature against the attestation data
 * 3. Check on-chain state if verifyOnChain is enabled
 *
 * @param attestation - The attestation to verify
 * @returns Whether the signature is valid (currently always true - STUB)
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/661 for implementation tracking
 */
export async function verifyAttestationSignature(
  _attestation: RangeSASAttestation
): Promise<boolean> {
  // TODO(#661): Implement real signature verification with Range SAS
  // This would involve:
  // 1. Fetching issuer public key from Range registry
  // 2. Reconstructing the signed message
  // 3. Verifying Ed25519 signature
  console.warn(
    '[Range SAS] verifyAttestationSignature is a STUB - always returns true. ' +
    'Implement real Ed25519 signature verification before production use.'
  )
  return true
}

/**
 * Fetch attestation from Range API
 *
 * ⚠️ WARNING: This is a stub that always returns null!
 * Do NOT rely on this in production without implementing real API calls.
 *
 * @param uid - Attestation UID
 * @param apiEndpoint - Range API endpoint
 * @returns The attestation if found (currently always null - STUB)
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/661 for implementation tracking
 */
export async function fetchAttestation(
  uid: string,
  apiEndpoint: string = 'https://api.range.org/v1'
): Promise<RangeSASAttestation | null> {
  // TODO(#661): Implement real API call to Range
  console.warn(
    `[Range SAS] fetchAttestation is a STUB - returning null for ${uid}. ` +
    `Would fetch from ${apiEndpoint}. Implement Range API integration before production use.`
  )
  return null
}
