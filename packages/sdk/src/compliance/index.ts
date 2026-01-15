/**
 * Enterprise Compliance Module for SIP Protocol
 *
 * Provides compliance management, auditor access control,
 * transaction disclosure, and reporting functionality.
 *
 * @example
 * ```typescript
 * import { ComplianceManager, ComplianceReporter } from '@sip-protocol/sdk'
 *
 * // Create compliance manager
 * const compliance = await ComplianceManager.create({
 *   organizationName: 'Acme Corp',
 * })
 *
 * // Register an auditor
 * const auditor = await compliance.registerAuditor({
 *   organization: 'Big Four Audit',
 *   contactName: 'John Auditor',
 *   contactEmail: 'john@bigfour.com',
 *   publicKey: '0x...',
 *   scope: {
 *     transactionTypes: ['all'],
 *     chains: ['ethereum'],
 *     tokens: [],
 *     startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
 *   },
 * }, adminAddress)
 *
 * // Generate audit report using ComplianceReporter
 * const reporter = new ComplianceReporter()
 * const report = await reporter.generateAuditReport({
 *   viewingKey: myViewingKey,
 *   transactions: encryptedTransactions,
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31'),
 *   format: 'json',
 * })
 * ```
 *
 * @module compliance
 */

export { ComplianceManager } from './compliance-manager'
export { ComplianceReporter } from './reports'
export { generatePdfReport } from './pdf'
export type {
  GenerateAuditReportParams,
  AuditReport,
  DecryptedTransaction,
  PdfExportOptions,
  ExportForRegulatorParams,
  RegulatoryExport,
  RegulatoryFormat,
  Jurisdiction,
  FATFExport,
  FATFTransaction,
  FINCENExport,
  FINCENTransaction,
  CSVExport,
} from './types'
export type { ComplianceMetrics } from '@sip-protocol/types'
export {
  ConditionalDisclosure,
  type TimeLockResult,
  type UnlockResult,
  type TimeLockParams,
} from './conditional'
export {
  createAmountThreshold,
  proveExceedsThreshold,
  verifyThresholdProof,
  shouldDisclose,
  type ThresholdDisclosure,
  type RangeProof,
  type CreateAmountThresholdParams,
} from './conditional-threshold'
export { ThresholdViewingKey, type ThresholdShares } from './threshold'
export {
  AuditorKeyDerivation,
  AuditorType,
  type DerivedViewingKey,
  type DeriveViewingKeyParams,
  type DeriveMultipleParams,
} from './derivation'

// Range SAS (Solana Attestation Service) Integration
export {
  AttestationGatedDisclosure,
  AttestationSchema,
  createMockAttestation,
  verifyAttestationSignature,
  fetchAttestation,
  fetchWalletAttestations,
  KNOWN_ISSUERS,
  DEFAULT_RANGE_API_ENDPOINT,
  type RangeSASAttestation,
  type AttestationGatedConfig,
  type ViewingKeyDerivationResult,
  type ViewingKeyScope,
  type AttestationVerificationResult,
  type RangeAPIConfig,
} from './range-sas'

// Fireblocks Institutional Custody Integration
export {
  FireblocksViewingKeyClient,
  FireblocksError,
  FireblocksErrorCode,
  createFireblocksClient,
  type FireblocksConfig,
  type RegisterViewingKeyParams,
  type ViewingKeyRegistration,
  type RegistrationStatus,
  type ExportTransactionHistoryParams,
  type TransactionHistoryExport,
  type GenerateComplianceReportParams,
  type ComplianceReport,
  type ComplianceReportType,
  type ExportFormat,
  type TransactionType as FireblocksTransactionType,
} from './fireblocks'
