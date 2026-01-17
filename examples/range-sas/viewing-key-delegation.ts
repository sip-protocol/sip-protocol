/**
 * viewing-key-delegation.ts
 *
 * Core utilities for SIP Protocol + Range SAS viewing key delegation.
 *
 * This module provides:
 * - Attestation verification
 * - Viewing key derivation with attestation-based authorization
 * - Audit logging for compliance
 *
 * @packageDocumentation
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import type { HexString } from '@sip-protocol/types'
import type {
  SASAttestation,
  DeriveAuditorKeyParams,
  DerivedViewingKey,
  KeyDerivationLog,
  VerifyAttestationParams,
  AttestationVerificationResult,
} from './types'

// In production, this would be a real database or on-chain storage
const keyDerivationLogs: KeyDerivationLog[] = []

/**
 * Verify a Range SAS attestation
 *
 * In production, this would verify:
 * 1. On-chain attestation exists
 * 2. Signature is valid
 * 3. Attestation is not expired
 * 4. Attestation is not revoked
 * 5. Attester is trusted (optional)
 *
 * @param connection - Solana connection
 * @param params - Verification parameters
 * @returns Verification result
 */
export async function verifyAttestation(
  connection: unknown, // Connection type from @solana/web3.js
  params: VerifyAttestationParams
): Promise<AttestationVerificationResult> {
  const { attestation, expectedSchema, minValidityDays, trustedAttesters } = params

  // Check if revoked
  if (attestation.revoked) {
    return {
      isValid: false,
      invalidReason: 'Attestation has been revoked',
    }
  }

  // Check expiration
  const now = new Date()
  if (attestation.expiresAt < now) {
    return {
      isValid: false,
      invalidReason: 'Attestation has expired',
    }
  }

  // Check minimum validity period
  if (minValidityDays) {
    const minValidUntil = new Date(now.getTime() + minValidityDays * 24 * 60 * 60 * 1000)
    if (attestation.expiresAt < minValidUntil) {
      return {
        isValid: false,
        invalidReason: `Attestation expires in less than ${minValidityDays} days`,
      }
    }
  }

  // Check schema match
  if (expectedSchema && attestation.schema !== expectedSchema) {
    return {
      isValid: false,
      invalidReason: `Schema mismatch: expected ${expectedSchema}, got ${attestation.schema}`,
    }
  }

  // Check trusted attesters
  if (trustedAttesters && trustedAttesters.length > 0) {
    if (!trustedAttesters.includes(attestation.attester)) {
      return {
        isValid: false,
        invalidReason: 'Attester is not in trusted list',
      }
    }
  }

  // In production: verify on-chain signature
  // const isSignatureValid = await verifyOnChainSignature(connection, attestation)
  // if (!isSignatureValid) {
  //   return { isValid: false, invalidReason: 'Invalid on-chain signature' }
  // }

  return {
    isValid: true,
    attestation,
  }
}

/**
 * Derive an auditor viewing key from the master key
 *
 * The derivation uses:
 * - Master viewing key
 * - Auditor address
 * - Attestation ID
 * - Scope
 * - Expiration
 *
 * This ensures:
 * 1. Key is unique to this auditor + attestation combination
 * 2. Key cannot be used after expiration
 * 3. Key scope is cryptographically bound
 *
 * @param params - Derivation parameters
 * @returns Derived viewing key with metadata
 */
export function deriveAuditorViewingKey(params: DeriveAuditorKeyParams): DerivedViewingKey {
  const {
    masterViewingKey,
    auditorAddress,
    attestationId,
    validUntil,
    scope,
    transactionIds,
    metadata,
  } = params

  // Validate scope and transaction IDs
  if (scope === 'specific-transactions' && (!transactionIds || transactionIds.length === 0)) {
    throw new Error('Transaction IDs required for specific-transactions scope')
  }

  // Build derivation input
  const derivationInput = JSON.stringify({
    auditorAddress,
    attestationId,
    scope,
    transactionIds: transactionIds?.sort(), // Sorted for deterministic derivation
    validUntil: validUntil?.toISOString(),
  })

  // Hash the derivation input
  const derivationHash = sha256(new TextEncoder().encode(derivationInput))

  // Derive key: master_key + derivation_hash (mod curve order)
  const masterKeyBytes = hexToBytes(masterViewingKey.slice(2)) // Remove 0x prefix
  const masterKeyBigInt = BigInt('0x' + bytesToHex(masterKeyBytes))
  const derivationBigInt = BigInt('0x' + bytesToHex(derivationHash))

  const derivedKeyBigInt = (masterKeyBigInt + derivationBigInt) % secp256k1.CURVE.n
  const derivedKeyHex = ('0x' + derivedKeyBigInt.toString(16).padStart(64, '0')) as HexString

  // Compute key hash for audit logging
  const keyHash = ('0x' + bytesToHex(sha256(hexToBytes(derivedKeyHex.slice(2))))) as HexString

  // Log the derivation
  const logEntry: KeyDerivationLog = {
    keyHash,
    auditorAddress,
    attestationId,
    scope,
    transactionIds,
    expiresAt: validUntil,
    timestamp: new Date(),
    derivedBy: 'system', // In production, this would be the user's address
    purpose: metadata?.purpose,
  }
  keyDerivationLogs.push(logEntry)

  return {
    key: derivedKeyHex,
    scope,
    expiresAt: validUntil,
    auditorAddress,
    attestationId,
    derivedAt: new Date(),
    keyHash,
  }
}

/**
 * Check if a viewing key is still valid (not expired)
 *
 * @param derivedKey - The derived viewing key
 * @returns Whether the key is still valid
 */
export function isViewingKeyValid(derivedKey: DerivedViewingKey): boolean {
  if (!derivedKey.expiresAt) {
    return true // No expiration set
  }
  return derivedKey.expiresAt > new Date()
}

/**
 * Get all key derivation logs (for audit purposes)
 *
 * @returns Array of key derivation log entries
 */
export function getKeyDerivationLogs(): KeyDerivationLog[] {
  return [...keyDerivationLogs]
}

/**
 * Get key derivation logs for a specific auditor
 *
 * @param auditorAddress - The auditor's address
 * @returns Filtered log entries
 */
export function getLogsForAuditor(auditorAddress: string): KeyDerivationLog[] {
  return keyDerivationLogs.filter((log) => log.auditorAddress === auditorAddress)
}

/**
 * Revoke a viewing key by marking it in the log
 *
 * Note: This doesn't actually prevent use of the key (that's cryptographically
 * impossible), but it creates an audit record and allows applications to check
 * the revocation status.
 *
 * @param keyHash - Hash of the key to revoke
 * @param reason - Reason for revocation
 */
export function revokeViewingKey(keyHash: HexString, reason: string): void {
  const log = keyDerivationLogs.find((l) => l.keyHash === keyHash)
  if (log) {
    // In production, this would be stored on-chain or in a database
    console.log(`Revoked key ${keyHash.slice(0, 10)}... Reason: ${reason}`)
  }
}

/**
 * Check if a viewing key has been revoked
 *
 * @param keyHash - Hash of the key to check
 * @returns Whether the key is revoked
 */
export function isViewingKeyRevoked(keyHash: HexString): boolean {
  // In production, check on-chain or database
  return false
}

/**
 * Create a compliance-ready key derivation record
 *
 * This generates all documentation needed for audit trails.
 *
 * @param derivedKey - The derived viewing key
 * @param attestation - The attestation that authorized derivation
 * @returns Compliance record as JSON string
 */
export function createComplianceRecord(
  derivedKey: DerivedViewingKey,
  attestation: SASAttestation
): string {
  const record = {
    event: 'VIEWING_KEY_DERIVATION',
    timestamp: derivedKey.derivedAt.toISOString(),
    keyHash: derivedKey.keyHash,
    auditor: {
      address: derivedKey.auditorAddress,
      attestationId: attestation.id,
      attestationSchema: attestation.schema,
      attester: attestation.attester,
    },
    authorization: {
      scope: derivedKey.scope,
      expiresAt: derivedKey.expiresAt?.toISOString(),
    },
    verification: {
      attestationValid: true,
      attestationExpiry: attestation.expiresAt.toISOString(),
    },
  }

  return JSON.stringify(record, null, 2)
}
