/**
 * Auditor Key Derivation for SIP Protocol
 *
 * Provides standardized BIP-44 style hierarchical key derivation
 * for different auditor types, enabling secure and isolated viewing
 * keys for regulatory, internal, and tax auditors.
 *
 * ## Derivation Path Format
 *
 * m/44'/COIN_TYPE'/account'/auditor_type
 *
 * Where:
 * - 44' = BIP-44 standard (hardened)
 * - COIN_TYPE' = 1234 (SIP Protocol registered coin type, hardened)
 * - account' = Account index (default: 0, hardened)
 * - auditor_type = Auditor type index (non-hardened)
 *
 * ## Auditor Types
 *
 * - 0 = PRIMARY - Primary viewing key for organization
 * - 1 = REGULATORY - Regulatory auditor key (SEC, FINRA, etc.)
 * - 2 = INTERNAL - Internal audit key (company auditors)
 * - 3 = TAX - Tax authority key (IRS, local tax agencies)
 *
 * ## Security Properties
 *
 * - Uses HMAC-SHA512 for key derivation (BIP-32 standard)
 * - Hardened derivation for coin type and account (prevents parent key recovery)
 * - Non-hardened derivation for auditor type (allows extended public keys)
 * - Keys are cryptographically isolated (no correlation between types)
 *
 * @example
 * ```typescript
 * import { AuditorKeyDerivation, AuditorType } from '@sip-protocol/sdk'
 *
 * // Generate master seed (32 bytes)
 * const masterSeed = randomBytes(32)
 *
 * // Derive regulatory auditor key
 * const regulatoryKey = AuditorKeyDerivation.deriveViewingKey({
 *   masterSeed,
 *   auditorType: AuditorType.REGULATORY,
 * })
 * // Path: m/44'/1234'/0'/1
 *
 * // Derive tax authority key
 * const taxKey = AuditorKeyDerivation.deriveViewingKey({
 *   masterSeed,
 *   auditorType: AuditorType.TAX,
 *   account: 1, // Different account
 * })
 * // Path: m/44'/1234'/1'/3
 * ```
 */

import type { ViewingKey, HexString, Hash } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import { hmac } from '@noble/hashes/hmac'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { ValidationError, ErrorCode } from '../errors'
import { secureWipe } from '../secure-memory'

/**
 * Auditor type enumeration
 *
 * Defines the standard auditor types for key derivation.
 */
export enum AuditorType {
  /** Primary viewing key for organization */
  PRIMARY = 0,
  /** Regulatory auditor key (SEC, FINRA, etc.) */
  REGULATORY = 1,
  /** Internal audit key (company auditors) */
  INTERNAL = 2,
  /** Tax authority key (IRS, local tax agencies) */
  TAX = 3,
}

/**
 * Derived viewing key with metadata
 */
export interface DerivedViewingKey {
  /** BIP-44 style derivation path */
  path: string
  /** The derived viewing key (hex encoded) */
  viewingKey: ViewingKey
  /** Auditor type this key is for */
  auditorType: AuditorType
  /** Account index used in derivation */
  account: number
}

/**
 * Parameters for deriving a viewing key
 */
export interface DeriveViewingKeyParams {
  /** Master seed (32 bytes minimum) */
  masterSeed: Uint8Array
  /** Type of auditor key to derive */
  auditorType: AuditorType
  /** Account index (default: 0, hardened) */
  account?: number
}

/**
 * Parameters for deriving multiple viewing keys
 */
export interface DeriveMultipleParams {
  /** Master seed (32 bytes minimum) */
  masterSeed: Uint8Array
  /** Auditor types to derive keys for */
  auditorTypes: AuditorType[]
  /** Account index (default: 0, hardened) */
  account?: number
}

/**
 * Auditor Key Derivation
 *
 * Provides BIP-44 style hierarchical key derivation for auditor viewing keys.
 */
export class AuditorKeyDerivation {
  /**
   * SIP Protocol coin type for BIP-44 derivation
   *
   * This uses 1234 as SIP Protocol's internal coin type identifier.
   *
   * **Registration Status**: Not registered with SLIP-44
   *
   * **Why this is acceptable**:
   * - SIP viewing keys are protocol-specific, not wallet-portable
   * - Keys derived here are for auditor access, not user funds
   * - SLIP-44 registration is for coin types that need hardware wallet support
   *
   * **Future consideration**: If hardware wallet integration for SIP auditor keys
   * is desired, submit a PR to https://github.com/satoshilabs/slips to register
   * an official coin type. Current value (1234) is in the unregistered range.
   */
  static readonly COIN_TYPE = 1234

  /**
   * BIP-44 purpose field
   */
  static readonly PURPOSE = 44

  /**
   * Hardened derivation flag (2^31)
   */
  private static readonly HARDENED = 0x80000000

  /**
   * Generate BIP-44 derivation path
   *
   * @param auditorType - Type of auditor key
   * @param account - Account index (default: 0)
   * @returns BIP-44 style path string
   *
   * @example
   * ```typescript
   * AuditorKeyDerivation.derivePath(AuditorType.REGULATORY)
   * // Returns: "m/44'/1234'/0'/1"
   *
   * AuditorKeyDerivation.derivePath(AuditorType.TAX, 5)
   * // Returns: "m/44'/1234'/5'/3"
   * ```
   */
  static derivePath(auditorType: AuditorType, account: number = 0): string {
    this.validateAuditorType(auditorType)
    this.validateAccount(account)

    // m/44'/1234'/account'/auditorType
    return `m/${this.PURPOSE}'/${this.COIN_TYPE}'/${account}'/${auditorType}`
  }

  /**
   * Derive a viewing key for an auditor
   *
   * Uses BIP-32 style hierarchical deterministic key derivation:
   * 1. Derive master key from seed
   * 2. Harden purpose (44')
   * 3. Harden coin type (1234')
   * 4. Harden account index
   * 5. Derive auditor type (non-hardened)
   *
   * @param params - Derivation parameters
   * @returns Derived viewing key with metadata
   *
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * ```typescript
   * const regulatoryKey = AuditorKeyDerivation.deriveViewingKey({
   *   masterSeed: randomBytes(32),
   *   auditorType: AuditorType.REGULATORY,
   * })
   *
   * console.log(regulatoryKey.path) // "m/44'/1234'/0'/1"
   * console.log(regulatoryKey.viewingKey.key) // "0x..."
   * ```
   */
  static deriveViewingKey(params: DeriveViewingKeyParams): DerivedViewingKey {
    const { masterSeed, auditorType, account = 0 } = params

    // Validate inputs
    this.validateMasterSeed(masterSeed)
    this.validateAuditorType(auditorType)
    this.validateAccount(account)

    const path = this.derivePath(auditorType, account)

    // BIP-32 derivation path indices
    const indices = [
      this.PURPOSE | this.HARDENED,    // 44' (hardened)
      this.COIN_TYPE | this.HARDENED,  // 1234' (hardened)
      account | this.HARDENED,         // account' (hardened)
      auditorType,                     // auditorType (non-hardened)
    ]

    // Derive key through the path - Initialize master key and chain code from seed
    const masterData = hmac(sha512, utf8ToBytes('SIP-MASTER-SEED'), masterSeed)
    let currentKey: Uint8Array = new Uint8Array(masterData.slice(0, 32))
    let chainCode: Uint8Array = new Uint8Array(masterData.slice(32, 64))

    try {

      // Derive through each level
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i]
        const derived = this.deriveChildKey(currentKey, chainCode, index)

        // Wipe previous key data
        if (i > 0) {
          secureWipe(currentKey)
        }

        currentKey = new Uint8Array(derived.key)
        chainCode = new Uint8Array(derived.chainCode)
      }

      // Convert to hex
      const keyHex = `0x${bytesToHex(currentKey)}` as HexString

      // Compute hash
      const hashBytes = sha256(currentKey)
      const hash = `0x${bytesToHex(hashBytes)}` as Hash

      const viewingKey: ViewingKey = {
        key: keyHex,
        path,
        hash,
      }

      return {
        path,
        viewingKey,
        auditorType,
        account,
      }
    } finally {
      // Securely wipe sensitive data
      secureWipe(currentKey)
      secureWipe(chainCode)
    }
  }

  /**
   * Derive multiple viewing keys at once
   *
   * Efficiently derives keys for multiple auditor types from the same
   * master seed. This is more efficient than calling deriveViewingKey
   * multiple times as it reuses intermediate derivations.
   *
   * @param params - Derivation parameters
   * @returns Array of derived viewing keys
   *
   * @example
   * ```typescript
   * const keys = AuditorKeyDerivation.deriveMultiple({
   *   masterSeed: randomBytes(32),
   *   auditorTypes: [
   *     AuditorType.PRIMARY,
   *     AuditorType.REGULATORY,
   *     AuditorType.INTERNAL,
   *   ],
   * })
   *
   * // keys[0] -> PRIMARY key (m/44'/1234'/0'/0)
   * // keys[1] -> REGULATORY key (m/44'/1234'/0'/1)
   * // keys[2] -> INTERNAL key (m/44'/1234'/0'/2)
   * ```
   */
  static deriveMultiple(params: DeriveMultipleParams): DerivedViewingKey[] {
    const { masterSeed, auditorTypes, account = 0 } = params

    // Validate inputs
    this.validateMasterSeed(masterSeed)
    this.validateAccount(account)

    if (!auditorTypes || auditorTypes.length === 0) {
      throw new ValidationError(
        'at least one auditor type is required',
        'auditorTypes',
        { received: auditorTypes },
        ErrorCode.MISSING_REQUIRED
      )
    }

    // Validate all auditor types
    for (const type of auditorTypes) {
      this.validateAuditorType(type)
    }

    // Remove duplicates
    const uniqueTypes = Array.from(new Set(auditorTypes))

    // Derive common path up to account level
    const commonIndices = [
      this.PURPOSE | this.HARDENED,    // 44' (hardened)
      this.COIN_TYPE | this.HARDENED,  // 1234' (hardened)
      account | this.HARDENED,         // account' (hardened)
    ]

    // Initialize master key and chain code
    const masterData = hmac(sha512, utf8ToBytes('SIP-MASTER-SEED'), masterSeed)
    let commonKey = new Uint8Array(masterData.slice(0, 32))
    let commonChainCode = new Uint8Array(masterData.slice(32, 64))

    try {

      // Derive to account level
      for (let i = 0; i < commonIndices.length; i++) {
        const index = commonIndices[i]
        const derived = this.deriveChildKey(commonKey, commonChainCode, index)

        if (i > 0) {
          secureWipe(commonKey)
        }

        commonKey = new Uint8Array(derived.key)
        commonChainCode = new Uint8Array(derived.chainCode)
      }

      // Derive each auditor type from common account key
      const results: DerivedViewingKey[] = []

      for (const auditorType of uniqueTypes) {
        const derived = this.deriveChildKey(commonKey, commonChainCode, auditorType)

        try {
          const keyHex = `0x${bytesToHex(derived.key)}` as HexString
          const hashBytes = sha256(derived.key)
          const hash = `0x${bytesToHex(hashBytes)}` as Hash
          const path = this.derivePath(auditorType, account)

          const viewingKey: ViewingKey = {
            key: keyHex,
            path,
            hash,
          }

          results.push({
            path,
            viewingKey,
            auditorType,
            account,
          })
        } finally {
          secureWipe(derived.key)
          secureWipe(derived.chainCode)
        }
      }

      return results
    } finally {
      secureWipe(commonKey)
      secureWipe(commonChainCode)
    }
  }

  /**
   * Get human-readable name for auditor type
   *
   * @param auditorType - Auditor type enum value
   * @returns Friendly name string
   */
  static getAuditorTypeName(auditorType: AuditorType): string {
    switch (auditorType) {
      case AuditorType.PRIMARY:
        return 'Primary'
      case AuditorType.REGULATORY:
        return 'Regulatory'
      case AuditorType.INTERNAL:
        return 'Internal'
      case AuditorType.TAX:
        return 'Tax Authority'
      default:
        return `Unknown (${auditorType})`
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Derive a child key using BIP-32 HMAC-SHA512 derivation
   *
   * @param parentKey - Parent key bytes (32 bytes)
   * @param chainCode - Parent chain code (32 bytes)
   * @param index - Child index (use | HARDENED for hardened derivation)
   * @returns Derived key and chain code
   */
  private static deriveChildKey(
    parentKey: Uint8Array,
    chainCode: Uint8Array,
    index: number,
  ): { key: Uint8Array; chainCode: Uint8Array } {
    const isHardened = (index & this.HARDENED) !== 0

    // Build HMAC input data
    const data = new Uint8Array(37) // 1 byte prefix + 32 bytes key + 4 bytes index

    if (isHardened) {
      // Hardened: 0x00 || parentKey || index
      data[0] = 0x00
      data.set(parentKey, 1)
    } else {
      // Non-hardened: 0x01 || parentKey || index
      // Note: In full BIP-32, this would use the public key
      // For viewing keys, we use the private key directly
      data[0] = 0x01
      data.set(parentKey, 1)
    }

    // Write index as big-endian uint32
    const indexView = new DataView(data.buffer, 33, 4)
    indexView.setUint32(0, index, false) // false = big-endian

    // HMAC-SHA512(chainCode, data)
    const hmacResult = hmac(sha512, chainCode, data)

    // Split result: first 32 bytes = child key, last 32 bytes = child chain code
    const childKey = new Uint8Array(hmacResult.slice(0, 32))
    const childChainCode = new Uint8Array(hmacResult.slice(32, 64))

    return {
      key: childKey,
      chainCode: childChainCode,
    }
  }

  /**
   * Validate master seed
   */
  private static validateMasterSeed(seed: Uint8Array): void {
    if (!seed || seed.length < 32) {
      throw new ValidationError(
        'master seed must be at least 32 bytes',
        'masterSeed',
        { received: seed?.length ?? 0 },
        ErrorCode.INVALID_INPUT
      )
    }
  }

  /**
   * Validate auditor type
   */
  private static validateAuditorType(type: AuditorType): void {
    const validTypes = [
      AuditorType.PRIMARY,
      AuditorType.REGULATORY,
      AuditorType.INTERNAL,
      AuditorType.TAX,
    ]

    if (!validTypes.includes(type)) {
      throw new ValidationError(
        `invalid auditor type: ${type}`,
        'auditorType',
        { received: type, valid: validTypes },
        ErrorCode.INVALID_INPUT
      )
    }
  }

  /**
   * Validate account index
   */
  private static validateAccount(account: number): void {
    if (!Number.isInteger(account) || account < 0 || account >= this.HARDENED) {
      throw new ValidationError(
        `account must be a non-negative integer less than ${this.HARDENED}`,
        'account',
        { received: account },
        ErrorCode.INVALID_INPUT
      )
    }
  }
}
