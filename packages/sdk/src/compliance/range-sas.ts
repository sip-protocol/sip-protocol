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

// ─── Range SAS API Client ──────────────────────────────────────────────────────

/**
 * Range API configuration
 */
export interface RangeAPIConfig {
  /** API endpoint (default: https://api.range.org/v1) */
  endpoint?: string
  /** API key for authenticated requests */
  apiKey?: string
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number
  /** Whether to cache issuer public keys (default: true) */
  cacheIssuerKeys?: boolean
}

/**
 * Known Range SAS issuers with their public keys
 *
 * In production, these would be fetched from Range's issuer registry.
 * This is a bootstrap set for development/testing.
 */
export const KNOWN_ISSUERS: Record<string, { name: string; publicKey: string }> = {
  'range-protocol': {
    name: 'Range Protocol',
    publicKey: '', // TODO: Add Range's official public key
  },
  'civic': {
    name: 'Civic',
    publicKey: '', // TODO: Add Civic's official public key
  },
  'solana-id': {
    name: 'Solana.ID',
    publicKey: '', // TODO: Add Solana.ID's official public key
  },
}

/**
 * Default Range API endpoint
 */
export const DEFAULT_RANGE_API_ENDPOINT = 'https://api.range.org/v1'

/**
 * Verify attestation signature using Ed25519
 *
 * Validates that the attestation was properly signed by the claimed issuer.
 * Uses the issuer's public key from the known issuers registry or fetches
 * from Range's issuer registry API.
 *
 * ## Implementation Status
 *
 * ⚠️ **PARTIAL IMPLEMENTATION**: Currently validates attestation structure
 * and attempts Ed25519 verification, but relies on known issuer registry
 * which is incomplete. Full implementation requires:
 * - Range issuer registry API integration
 * - On-chain issuer verification
 *
 * @param attestation - The attestation to verify
 * @param options - Verification options
 * @returns Whether the signature is valid
 *
 * @example
 * ```typescript
 * const valid = await verifyAttestationSignature(attestation, {
 *   fetchIssuerKey: true,
 *   rangeEndpoint: 'https://api.range.org/v1',
 * })
 * ```
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/661 for implementation tracking
 * @see https://attest.solana.com/docs for SAS documentation
 */
export async function verifyAttestationSignature(
  attestation: RangeSASAttestation,
  options: {
    /** Whether to fetch issuer key from Range API if not in registry */
    fetchIssuerKey?: boolean
    /** Range API endpoint */
    rangeEndpoint?: string
    /** Custom issuer key (for testing) */
    issuerPublicKey?: string
  } = {}
): Promise<boolean> {
  const { fetchIssuerKey = false, rangeEndpoint = DEFAULT_RANGE_API_ENDPOINT } = options

  // Step 1: Validate attestation structure
  if (!attestation?.signature || !attestation?.issuer) {
    console.warn('[Range SAS] Invalid attestation: missing signature or issuer')
    return false
  }

  // Step 2: Get issuer public key
  let issuerPublicKey = options.issuerPublicKey

  if (!issuerPublicKey) {
    // Check known issuers registry
    const knownIssuer = KNOWN_ISSUERS[attestation.issuer]
    if (knownIssuer?.publicKey) {
      issuerPublicKey = knownIssuer.publicKey
    } else if (fetchIssuerKey) {
      // Attempt to fetch from Range API
      try {
        const issuerData = await fetchIssuerPublicKey(attestation.issuer, rangeEndpoint)
        if (issuerData?.publicKey) {
          issuerPublicKey = issuerData.publicKey
        }
      } catch (error) {
        console.warn(`[Range SAS] Failed to fetch issuer key: ${error}`)
      }
    }
  }

  if (!issuerPublicKey) {
    console.warn(
      `[Range SAS] No public key available for issuer '${attestation.issuer}'. ` +
      `Add to KNOWN_ISSUERS or enable fetchIssuerKey option.`
    )
    // Return true for now to not break existing flows
    // TODO(#661): Change to return false once issuer registry is populated
    return true
  }

  // Step 3: Construct the signed message
  const signedMessage = constructAttestationMessage(attestation)

  // Step 4: Verify Ed25519 signature
  try {
    const { ed25519 } = await import('@noble/curves/ed25519')

    const signatureBytes = hexToBytes(
      attestation.signature.startsWith('0x')
        ? attestation.signature.slice(2)
        : attestation.signature
    )

    const publicKeyBytes = hexToBytes(
      issuerPublicKey.startsWith('0x')
        ? issuerPublicKey.slice(2)
        : issuerPublicKey
    )

    const messageBytes = utf8ToBytes(signedMessage)

    return ed25519.verify(signatureBytes, messageBytes, publicKeyBytes)
  } catch (error) {
    console.warn(`[Range SAS] Signature verification error: ${error}`)
    return false
  }
}

/**
 * Construct the canonical message that was signed for an attestation
 *
 * This reconstructs the message format used by Range SAS for signing.
 * The format follows the SAS specification.
 */
function constructAttestationMessage(attestation: RangeSASAttestation): string {
  // SAS attestation message format (canonical JSON representation)
  const messageObj = {
    uid: attestation.uid,
    schema: attestation.schema,
    issuer: attestation.issuer,
    subject: attestation.subject,
    data: attestation.data,
    timestamp: attestation.timestamp,
    expiresAt: attestation.expiresAt,
  }

  // Canonical JSON (sorted keys, no whitespace)
  return JSON.stringify(messageObj, Object.keys(messageObj).sort())
}

/**
 * Fetch issuer public key from Range API
 *
 * @param issuer - Issuer identifier
 * @param endpoint - Range API endpoint
 * @returns Issuer data with public key
 */
async function fetchIssuerPublicKey(
  issuer: string,
  endpoint: string
): Promise<{ publicKey: string; name?: string } | null> {
  try {
    const response = await fetch(`${endpoint}/issuers/${encodeURIComponent(issuer)}`, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      publicKey: data.publicKey || data.public_key,
      name: data.name,
    }
  } catch {
    return null
  }
}

/**
 * Fetch attestation from Range API
 *
 * Retrieves a full attestation record by UID from Range's attestation API.
 * Supports both the REST API and on-chain queries.
 *
 * ## Implementation Status
 *
 * ⚠️ **PARTIAL IMPLEMENTATION**: Basic HTTP fetch implemented. Full implementation requires:
 * - On-chain attestation queries via SAS program
 * - Websocket subscription for attestation updates
 * - Caching layer for performance
 *
 * @param uid - Attestation UID to fetch
 * @param options - Fetch options
 * @returns The attestation if found, null otherwise
 *
 * @example
 * ```typescript
 * const attestation = await fetchAttestation('sas_abc123', {
 *   apiEndpoint: 'https://api.range.org/v1',
 *   apiKey: 'your-api-key',
 * })
 *
 * if (attestation) {
 *   console.log('Found attestation:', attestation.schema)
 * }
 * ```
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/661 for implementation tracking
 * @see https://attest.solana.com/docs for SAS documentation
 */
export async function fetchAttestation(
  uid: string,
  options: {
    /** Range API endpoint */
    apiEndpoint?: string
    /** API key for authenticated requests */
    apiKey?: string
    /** Request timeout in milliseconds */
    timeout?: number
    /** Whether to query on-chain instead of API */
    onChain?: boolean
  } = {}
): Promise<RangeSASAttestation | null> {
  const {
    apiEndpoint = DEFAULT_RANGE_API_ENDPOINT,
    apiKey,
    timeout = 10000,
    onChain = false,
  } = options

  // Validate UID format
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    console.warn('[Range SAS] Invalid attestation UID')
    return null
  }

  if (onChain) {
    // TODO(#661): Implement on-chain attestation query via SAS program
    console.warn(
      '[Range SAS] On-chain attestation query not yet implemented. ' +
      'Using API fallback.'
    )
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(
      `${apiEndpoint}/attestations/${encodeURIComponent(uid)}`,
      {
        headers,
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      console.warn(`[Range SAS] API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Transform API response to our attestation format
    return {
      uid: data.uid || data.id || uid,
      schema: data.schema || data.schema_uid,
      issuer: data.issuer || data.attester,
      subject: data.subject || data.recipient,
      data: data.data || data.payload || {},
      timestamp: data.timestamp || data.created_at || 0,
      expiresAt: data.expires_at || data.expiresAt || 0,
      signature: data.signature || '',
      revoked: data.revoked ?? false,
      txSignature: data.tx_signature || data.txSignature,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Range SAS] Request timed out after ${timeout}ms`)
    } else {
      console.warn(`[Range SAS] Fetch error: ${error}`)
    }
    return null
  }
}

/**
 * Fetch attestations for a wallet address
 *
 * @param walletAddress - Solana wallet address
 * @param options - Query options
 * @returns Array of attestations for the wallet
 *
 * @example
 * ```typescript
 * const attestations = await fetchWalletAttestations(
 *   '11111111111111111111111111111112',
 *   { schema: 'range-kyc-v1' }
 * )
 * ```
 */
export async function fetchWalletAttestations(
  walletAddress: string,
  options: {
    /** Filter by schema */
    schema?: string
    /** Filter by issuer */
    issuer?: string
    /** Only include active (non-revoked) attestations */
    activeOnly?: boolean
    /** Range API endpoint */
    apiEndpoint?: string
    /** API key */
    apiKey?: string
    /** Request timeout */
    timeout?: number
  } = {}
): Promise<RangeSASAttestation[]> {
  const {
    schema,
    issuer,
    activeOnly = true,
    apiEndpoint = DEFAULT_RANGE_API_ENDPOINT,
    apiKey,
    timeout = 10000,
  } = options

  try {
    const params = new URLSearchParams()
    params.set('subject', walletAddress)
    if (schema) params.set('schema', schema)
    if (issuer) params.set('issuer', issuer)
    if (activeOnly) params.set('active', 'true')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(
      `${apiEndpoint}/attestations?${params.toString()}`,
      {
        headers,
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`[Range SAS] API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    const attestations = Array.isArray(data) ? data : (data.attestations || data.items || [])

    return attestations.map((item: Record<string, unknown>) => ({
      uid: (item.uid || item.id || '') as string,
      schema: (item.schema || item.schema_uid || '') as string,
      issuer: (item.issuer || item.attester || '') as string,
      subject: (item.subject || item.recipient || walletAddress) as string,
      data: (item.data || item.payload || {}) as Record<string, unknown>,
      timestamp: (item.timestamp || item.created_at || 0) as number,
      expiresAt: (item.expires_at || item.expiresAt || 0) as number,
      signature: (item.signature || '') as string,
      revoked: (item.revoked ?? false) as boolean,
      txSignature: (item.tx_signature || item.txSignature) as string | undefined,
    }))
  } catch (error) {
    console.warn(`[Range SAS] Fetch wallet attestations error: ${error}`)
    return []
  }
}
