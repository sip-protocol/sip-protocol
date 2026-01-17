/**
 * types.ts
 *
 * TypeScript types for SIP Protocol + Range SAS integration.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Range SAS Attestation schema
 */
export interface SASAttestation {
  /** Unique attestation ID (on-chain) */
  id: string
  /** Address of the attester (KYC provider, authority) */
  attester: string
  /** Address being attested (auditor, user) */
  subject: string
  /** Schema identifier for the attestation type */
  schema: string
  /** Attestation data (schema-specific) */
  data: Record<string, unknown>
  /** When the attestation expires */
  expiresAt: Date
  /** When the attestation was created */
  createdAt: Date
  /** Whether the attestation has been revoked */
  revoked: boolean
  /** On-chain signature */
  signature: string
}

/**
 * Common attestation schemas for compliance
 */
export type AttestationSchema =
  | 'kyc-verified-v1' // KYC verification
  | 'accredited-investor-v1' // Accredited investor status
  | 'certified-auditor-v1' // Certified public accountant
  | 'dao-member-v1' // DAO membership
  | 'compliance-officer-v1' // Compliance team member
  | 'regulatory-authority-v1' // Government regulator
  | string // Custom schemas

/**
 * Viewing key scope options
 */
export type ViewingKeyScope =
  | 'full' // All transactions
  | 'proposals' // Only DAO proposals
  | 'payroll' // Only payroll transactions
  | 'specific-transactions' // Only specified transaction IDs
  | string // Custom scopes

/**
 * Parameters for deriving an auditor viewing key
 */
export interface DeriveAuditorKeyParams {
  /** Master viewing private key */
  masterViewingKey: HexString
  /** Auditor's address (from attestation subject) */
  auditorAddress: string
  /** Attestation ID (for audit trail) */
  attestationId: string
  /** When the viewing key expires */
  validUntil?: Date
  /** Scope of access */
  scope: ViewingKeyScope
  /** Specific transaction IDs (when scope = 'specific-transactions') */
  transactionIds?: string[]
  /** Additional metadata for audit logging */
  metadata?: {
    purpose?: string
    requestId?: string
    notes?: string
  }
}

/**
 * Derived viewing key with metadata
 */
export interface DerivedViewingKey {
  /** The derived viewing key (hex) */
  key: HexString
  /** Scope of the key */
  scope: ViewingKeyScope
  /** When the key expires */
  expiresAt?: Date
  /** Auditor address this key was derived for */
  auditorAddress: string
  /** Attestation that authorized this derivation */
  attestationId: string
  /** When the key was derived */
  derivedAt: Date
  /** Hash of the key (for audit logging without exposing key) */
  keyHash: HexString
}

/**
 * Audit log entry for key derivation
 */
export interface KeyDerivationLog {
  /** Hash of the derived key */
  keyHash: HexString
  /** Auditor address */
  auditorAddress: string
  /** Attestation ID */
  attestationId: string
  /** Scope granted */
  scope: ViewingKeyScope
  /** Transaction IDs (if scope = 'specific-transactions') */
  transactionIds?: string[]
  /** When the key expires */
  expiresAt?: Date
  /** When the derivation occurred */
  timestamp: Date
  /** Who initiated the derivation */
  derivedBy: string
  /** Purpose/notes */
  purpose?: string
}

/**
 * Parameters for verifying an attestation
 */
export interface VerifyAttestationParams {
  /** Attestation to verify */
  attestation: SASAttestation
  /** Expected schema (optional) */
  expectedSchema?: AttestationSchema
  /** Minimum validity period remaining (optional) */
  minValidityDays?: number
  /** Trusted attesters (optional, verify against list) */
  trustedAttesters?: string[]
}

/**
 * Result of attestation verification
 */
export interface AttestationVerificationResult {
  /** Whether the attestation is valid */
  isValid: boolean
  /** If invalid, the reason */
  invalidReason?: string
  /** The verified attestation (if valid) */
  attestation?: SASAttestation
}

/**
 * Compliance report generated from viewing key access
 */
export interface ComplianceReport {
  /** Report ID */
  id: string
  /** Auditor who generated the report */
  auditorAddress: string
  /** Viewing key used (hash only) */
  viewingKeyHash: HexString
  /** Time range covered */
  startDate: Date
  endDate: Date
  /** Summary statistics */
  summary: {
    totalTransactions: number
    totalInflow: bigint
    totalOutflow: bigint
    uniqueCounterparties: number
  }
  /** Transaction details */
  transactions: Array<{
    id: string
    type: 'inflow' | 'outflow'
    amount: bigint
    tokenSymbol: string
    timestamp: Date
    memo?: string
  }>
  /** Report generation timestamp */
  generatedAt: Date
}
