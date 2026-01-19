/**
 * Ethereum Viewing Key Management (EIP-5564)
 *
 * Viewing keys enable selective disclosure for compliance and auditing.
 * The viewing key holder can scan for incoming payments but cannot spend funds.
 *
 * ## Use Cases
 *
 * 1. **Self-Scanning**: Recipient uses viewing key to find incoming payments
 * 2. **Audit/Compliance**: Share viewing key with auditors for transaction visibility
 * 3. **Watch-Only Wallets**: Monitor stealth addresses without spending capability
 *
 * ## Security Model
 *
 * - Viewing key = can see incoming payments, cannot spend
 * - Spending key = required to claim/spend funds
 * - Both keys derive from the same meta-address
 *
 * @packageDocumentation
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidHexLength, isValidPrivateKey } from '../../validation'
import type {
  EthereumViewingKeyExport,
  EthereumViewingKeyPair,
  EthereumPrivacyLevel,
} from './types'
import type { EthereumNetwork } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Viewing key disclosure scope
 */
export type ViewingKeyScope =
  | 'all' // Can see all transactions
  | 'incoming' // Can see incoming only
  | 'range' // Can see transactions in block range

/**
 * Viewing key permissions
 */
export interface ViewingKeyPermissions {
  /** Can view incoming payments */
  canViewIncoming: boolean
  /** Can view outgoing payments (requires additional data) */
  canViewOutgoing: boolean
  /** Can view transaction amounts (vs just detecting payments) */
  canViewAmounts: boolean
  /** Block range restriction (if scope is 'range') */
  blockRange?: {
    from: number
    to: number
  }
}

/**
 * Shared viewing key for auditors
 */
export interface SharedViewingKey {
  /** The viewing public key */
  viewingPublicKey: HexString
  /** The spending public key (for address verification) */
  spendingPublicKey: HexString
  /** Permissions granted */
  permissions: ViewingKeyPermissions
  /** Optional label */
  label?: string
  /** Expiration timestamp (ISO 8601) */
  expiresAt?: string
  /** Signature proving ownership (optional) */
  signature?: HexString
}

// ─── Key Generation ─────────────────────────────────────────────────────────

/**
 * Generate a new viewing keypair
 *
 * @param spendingPublicKey - Associated spending public key
 * @param label - Optional label
 * @returns Viewing keypair
 *
 * @example
 * ```typescript
 * const viewingKey = generateViewingKeyPair(
 *   metaAddress.spendingKey,
 *   'Main Wallet'
 * )
 * ```
 */
export function generateViewingKeyPair(
  spendingPublicKey: HexString,
  label?: string
): EthereumViewingKeyPair {
  // Generate random viewing private key
  const viewingPrivateKey = randomBytes(32)
  const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true)

  return {
    publicKey: `0x${bytesToHex(viewingPublicKey)}` as HexString,
    privateKey: `0x${bytesToHex(viewingPrivateKey)}` as HexString,
    spendingPublicKey,
    label,
  }
}

/**
 * Derive viewing public key from private key
 *
 * @param viewingPrivateKey - The viewing private key
 * @returns Viewing public key
 */
export function deriveViewingPublicKey(viewingPrivateKey: HexString): HexString {
  if (!isValidPrivateKey(viewingPrivateKey)) {
    throw new ValidationError(
      'must be a valid 32-byte hex string',
      'viewingPrivateKey'
    )
  }

  const privateKeyBytes = hexToBytes(viewingPrivateKey.slice(2))
  const publicKey = secp256k1.getPublicKey(privateKeyBytes, true)

  return `0x${bytesToHex(publicKey)}` as HexString
}

// ─── Key Export/Import ──────────────────────────────────────────────────────

/**
 * Export a viewing key for sharing with auditors
 *
 * @param viewingKeyPair - The viewing keypair (only public parts exported)
 * @param network - The Ethereum network
 * @param expiresAt - Optional expiration timestamp
 * @returns Exportable viewing key object
 *
 * @example
 * ```typescript
 * const exported = exportViewingKey(viewingKey, 'mainnet')
 * // Share 'exported' with auditor (contains no private keys)
 * ```
 */
export function exportViewingKey(
  viewingKeyPair: EthereumViewingKeyPair,
  network: EthereumNetwork,
  expiresAt?: Date
): EthereumViewingKeyExport {
  return {
    version: 1,
    chain: 'ethereum',
    network,
    viewingPublicKey: viewingKeyPair.publicKey,
    spendingPublicKey: viewingKeyPair.spendingPublicKey,
    label: viewingKeyPair.label,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString(),
  }
}

/**
 * Import/parse an exported viewing key
 *
 * @param exported - The exported viewing key JSON
 * @returns Parsed viewing key export
 */
export function importViewingKey(
  exported: string | EthereumViewingKeyExport
): EthereumViewingKeyExport {
  const data =
    typeof exported === 'string'
      ? (JSON.parse(exported) as EthereumViewingKeyExport)
      : exported

  // Validate structure
  if (data.version !== 1) {
    throw new ValidationError(
      `unsupported viewing key version: ${data.version}`,
      'version'
    )
  }

  if (data.chain !== 'ethereum') {
    throw new ValidationError(
      `invalid chain: ${data.chain}, expected 'ethereum'`,
      'chain'
    )
  }

  if (!isValidHexLength(data.viewingPublicKey, 33)) {
    throw new ValidationError(
      'viewingPublicKey must be a valid 33-byte hex string',
      'viewingPublicKey'
    )
  }

  if (!isValidHexLength(data.spendingPublicKey, 33)) {
    throw new ValidationError(
      'spendingPublicKey must be a valid 33-byte hex string',
      'spendingPublicKey'
    )
  }

  return data
}

/**
 * Serialize a viewing key export to JSON string
 *
 * @param exportData - The viewing key export
 * @returns JSON string
 */
export function serializeViewingKey(exportData: EthereumViewingKeyExport): string {
  return JSON.stringify(exportData, null, 2)
}

// ─── Key Verification ───────────────────────────────────────────────────────

/**
 * Verify that a viewing key matches a meta-address
 *
 * @param viewingPublicKey - The viewing public key to verify
 * @param metaAddress - The meta-address to check against
 * @returns True if the viewing key matches
 */
export function verifyViewingKeyMatches(
  viewingPublicKey: HexString,
  metaAddress: StealthMetaAddress
): boolean {
  // Normalize both keys (remove 0x prefix, lowercase)
  const normalizedViewing = viewingPublicKey.slice(2).toLowerCase()
  const normalizedMeta = metaAddress.viewingKey.slice(2).toLowerCase()

  return normalizedViewing === normalizedMeta
}

/**
 * Check if a viewing key export has expired
 *
 * @param exportData - The viewing key export
 * @returns True if expired
 */
export function isViewingKeyExpired(exportData: EthereumViewingKeyExport): boolean {
  if (!exportData.expiresAt) {
    return false
  }

  const expiresAt = new Date(exportData.expiresAt)
  return expiresAt < new Date()
}

// ─── Shared Key Creation ────────────────────────────────────────────────────

/**
 * Create a shared viewing key with specific permissions
 *
 * @param viewingKeyPair - The full viewing keypair
 * @param permissions - Permissions to grant
 * @param expiresAt - Optional expiration
 * @returns Shared viewing key for auditor
 *
 * @example
 * ```typescript
 * // Create a read-only viewing key for auditor
 * const sharedKey = createSharedViewingKey(viewingKey, {
 *   canViewIncoming: true,
 *   canViewOutgoing: false,
 *   canViewAmounts: true,
 * })
 * ```
 */
export function createSharedViewingKey(
  viewingKeyPair: EthereumViewingKeyPair,
  permissions: ViewingKeyPermissions,
  expiresAt?: Date
): SharedViewingKey {
  return {
    viewingPublicKey: viewingKeyPair.publicKey,
    spendingPublicKey: viewingKeyPair.spendingPublicKey,
    permissions,
    label: viewingKeyPair.label,
    expiresAt: expiresAt?.toISOString(),
  }
}

/**
 * Create a full-access viewing key (for self-scanning)
 *
 * @param viewingKeyPair - The viewing keypair
 * @returns Shared key with full permissions
 */
export function createFullAccessViewingKey(
  viewingKeyPair: EthereumViewingKeyPair
): SharedViewingKey {
  return createSharedViewingKey(viewingKeyPair, {
    canViewIncoming: true,
    canViewOutgoing: true,
    canViewAmounts: true,
  })
}

/**
 * Create a compliance-restricted viewing key
 *
 * @param viewingKeyPair - The viewing keypair
 * @param fromBlock - Start block for visibility
 * @param toBlock - End block for visibility
 * @returns Shared key with block range restriction
 */
export function createRangeRestrictedViewingKey(
  viewingKeyPair: EthereumViewingKeyPair,
  fromBlock: number,
  toBlock: number
): SharedViewingKey {
  return createSharedViewingKey(viewingKeyPair, {
    canViewIncoming: true,
    canViewOutgoing: false,
    canViewAmounts: true,
    blockRange: { from: fromBlock, to: toBlock },
  })
}

// ─── Hash Functions ─────────────────────────────────────────────────────────

/**
 * Compute a hash of the viewing key for indexing/lookup
 *
 * @param viewingPublicKey - The viewing public key
 * @returns Hash of the viewing key
 */
export function hashViewingKey(viewingPublicKey: HexString): HexString {
  const keyBytes = hexToBytes(viewingPublicKey.slice(2))
  const hash = sha256(keyBytes)
  return `0x${bytesToHex(hash)}` as HexString
}

/**
 * Compute the viewing key hash used in on-chain registry
 *
 * @param viewingPublicKey - The viewing public key
 * @param spendingPublicKey - The spending public key
 * @returns Combined hash for registry lookup
 */
export function computeRegistryHash(
  viewingPublicKey: HexString,
  spendingPublicKey: HexString
): HexString {
  const viewingBytes = hexToBytes(viewingPublicKey.slice(2))
  const spendingBytes = hexToBytes(spendingPublicKey.slice(2))

  // Concatenate and hash
  const combined = new Uint8Array(viewingBytes.length + spendingBytes.length)
  combined.set(viewingBytes, 0)
  combined.set(spendingBytes, viewingBytes.length)

  const hash = sha256(combined)
  return `0x${bytesToHex(hash)}` as HexString
}

// ─── Privacy Level Helpers ──────────────────────────────────────────────────

/**
 * Get the appropriate viewing key usage based on privacy level
 *
 * @param privacyLevel - The privacy level
 * @returns Description of viewing key usage
 */
export function getViewingKeyUsage(
  privacyLevel: EthereumPrivacyLevel
): {
  required: boolean
  shareable: boolean
  description: string
} {
  switch (privacyLevel) {
    case 'transparent':
      return {
        required: false,
        shareable: false,
        description: 'No privacy - all transaction details are public',
      }
    case 'shielded':
      return {
        required: true,
        shareable: false,
        description: 'Full privacy - viewing key for self-scanning only',
      }
    case 'compliant':
      return {
        required: true,
        shareable: true,
        description: 'Privacy with compliance - viewing key can be shared with auditors',
      }
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Extract viewing key components from a meta-address
 *
 * @param metaAddress - The stealth meta-address
 * @returns Viewing and spending public keys
 */
export function extractViewingComponents(metaAddress: StealthMetaAddress): {
  viewingPublicKey: HexString
  spendingPublicKey: HexString
} {
  return {
    viewingPublicKey: metaAddress.viewingKey,
    spendingPublicKey: metaAddress.spendingKey,
  }
}

/**
 * Validate viewing key permissions
 *
 * @param permissions - The permissions to validate
 * @returns True if valid
 */
export function validatePermissions(permissions: ViewingKeyPermissions): boolean {
  if (permissions.blockRange) {
    if (permissions.blockRange.from < 0 || permissions.blockRange.to < 0) {
      return false
    }
    if (permissions.blockRange.from > permissions.blockRange.to) {
      return false
    }
  }

  // At least one permission should be granted
  return (
    permissions.canViewIncoming ||
    permissions.canViewOutgoing ||
    permissions.canViewAmounts
  )
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}
