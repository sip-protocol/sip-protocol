/**
 * Enterprise Compliance types for SIP Protocol
 *
 * Defines types for compliance management, auditor access,
 * transaction disclosure, and reporting.
 */

import type { ChainId } from './stealth'
import type { HexString, Hash, ViewingKey } from './crypto'
import type { Asset } from './asset'
import type { PrivacyLevel } from './privacy'
import type { ShieldedPayment, PaymentPurpose } from './payment'

/**
 * Compliance role for access control
 */
export type ComplianceRole =
  | 'admin'           // Full access to compliance features
  | 'compliance_officer' // Can view all transactions, manage auditors
  | 'auditor'         // Can view transactions within their scope
  | 'viewer'          // Read-only access to reports

/**
 * Audit scope - what an auditor can access
 */
export interface AuditScope {
  /** Transaction types: all, inbound, outbound */
  transactionTypes: ('all' | 'inbound' | 'outbound')[]
  /** Specific chains to audit (empty = all) */
  chains: ChainId[]
  /** Specific tokens to audit (empty = all) */
  tokens: string[]
  /** Start date for audit period */
  startDate: number
  /** End date for audit period (optional, ongoing if not set) */
  endDate?: number
  /** Minimum transaction amount to include */
  minAmount?: bigint
  /** Maximum transaction amount to include */
  maxAmount?: bigint
}

/**
 * Auditor registration
 */
export interface AuditorRegistration {
  /** Unique auditor ID */
  auditorId: string
  /** Auditor's organization name */
  organization: string
  /** Contact name */
  contactName: string
  /** Contact email */
  contactEmail: string
  /** Auditor's public key for secure communication */
  publicKey: HexString
  /** Assigned viewing key */
  viewingKey?: ViewingKey
  /** Audit scope */
  scope: AuditScope
  /** Role */
  role: ComplianceRole
  /** Registration timestamp */
  registeredAt: number
  /** Registered by (admin address) */
  registeredBy: string
  /** Active status */
  isActive: boolean
  /** Deactivation timestamp */
  deactivatedAt?: number
  /** Deactivation reason */
  deactivationReason?: string
}

/**
 * Disclosed transaction - a transaction revealed to an auditor
 */
export interface DisclosedTransaction {
  /** Original payment/transaction ID */
  transactionId: string
  /** Disclosure ID */
  disclosureId: string
  /** Auditor ID who received disclosure */
  auditorId: string
  /** Disclosure timestamp */
  disclosedAt: number
  /** Who authorized the disclosure */
  disclosedBy: string

  // ─── Transaction Details ───────────────────────────────────────────────────────

  /** Transaction type */
  type: 'payment' | 'swap' | 'deposit' | 'withdrawal'
  /** Direction */
  direction: 'inbound' | 'outbound'
  /** Token */
  token: Asset
  /** Amount */
  amount: bigint
  /** Sender address (may be stealth) */
  sender: string
  /** Recipient address (may be stealth) */
  recipient: string
  /** Transaction hash */
  txHash: string
  /** Block number */
  blockNumber: number
  /** Transaction timestamp */
  timestamp: number
  /** Chain */
  chain: ChainId
  /** Privacy level used */
  privacyLevel: PrivacyLevel
  /** Memo/reference */
  memo?: string
  /** Purpose */
  purpose?: PaymentPurpose

  // ─── Compliance Metadata ───────────────────────────────────────────────────────

  /** Risk score (0-100) */
  riskScore?: number
  /** Risk flags */
  riskFlags?: string[]
  /** Compliance notes */
  notes?: string
  /** Tags for categorization */
  tags?: string[]
}

/**
 * Compliance report type
 */
export type ReportType =
  | 'transaction_summary'   // Summary of transactions
  | 'audit_trail'          // Full audit trail
  | 'risk_assessment'      // Risk analysis
  | 'regulatory'           // Regulatory compliance report
  | 'tax'                  // Tax reporting

/**
 * Report format
 */
export type ReportFormat = 'json' | 'csv' | 'pdf'

/**
 * Report status
 */
export const ReportStatus = {
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type ReportStatusType = typeof ReportStatus[keyof typeof ReportStatus]

/**
 * Compliance report
 */
export interface ComplianceReport {
  /** Report ID */
  reportId: string
  /** Report type */
  type: ReportType
  /** Report title */
  title: string
  /** Description */
  description?: string
  /** Report format */
  format: ReportFormat
  /** Status */
  status: ReportStatusType
  /** Generation timestamp */
  generatedAt?: number
  /** Requested by */
  requestedBy: string
  /** Request timestamp */
  requestedAt: number

  // ─── Report Parameters ─────────────────────────────────────────────────────────

  /** Start date */
  startDate: number
  /** End date */
  endDate: number
  /** Chains included */
  chains: ChainId[]
  /** Tokens included */
  tokens: string[]
  /** Include inbound transactions */
  includeInbound: boolean
  /** Include outbound transactions */
  includeOutbound: boolean

  // ─── Report Data ───────────────────────────────────────────────────────────────

  /** Report data (for JSON format) */
  data?: ReportData
  /** Report content (for CSV/PDF - base64 encoded) */
  content?: string
  /** Error message (if failed) */
  error?: string
}

/**
 * Report data structure
 */
export interface ReportData {
  /** Summary statistics */
  summary: {
    totalTransactions: number
    totalInbound: number
    totalOutbound: number
    totalVolume: Record<string, bigint> // by token symbol
    uniqueCounterparties: number
    averageTransactionSize: Record<string, bigint>
    dateRange: { start: number; end: number }
  }
  /** Transaction breakdown by type */
  byType: {
    payments: number
    swaps: number
    deposits: number
    withdrawals: number
  }
  /** Transaction breakdown by chain */
  byChain: Record<ChainId, number>
  /** Transaction breakdown by privacy level */
  byPrivacyLevel: Record<PrivacyLevel, number>
  /** High-value transactions */
  highValueTransactions: DisclosedTransaction[]
  /** Risk summary */
  riskSummary?: {
    lowRisk: number
    mediumRisk: number
    highRisk: number
    flaggedTransactions: number
  }
  /** Full transaction list (optional) */
  transactions?: DisclosedTransaction[]
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  /** Organization ID */
  organizationId: string
  /** Organization name */
  organizationName: string
  /** Master viewing key for the organization */
  masterViewingKey: ViewingKey
  /** Default audit scope for new auditors */
  defaultAuditScope: Partial<AuditScope>
  /** Risk threshold for flagging transactions */
  riskThreshold: number
  /** High-value transaction threshold (in USD equivalent) */
  highValueThreshold: bigint
  /** Retention period for disclosed transactions (days) */
  retentionPeriodDays: number
  /** Auto-generate reports */
  autoReporting: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    reportTypes: ReportType[]
  }
  /** Created timestamp */
  createdAt: number
  /** Updated timestamp */
  updatedAt: number
}

/**
 * Parameters for creating a compliance configuration
 */
export interface CreateComplianceConfigParams {
  /** Organization name */
  organizationName: string
  /** Risk threshold (0-100) */
  riskThreshold?: number
  /** High-value threshold */
  highValueThreshold?: bigint
  /** Retention period */
  retentionPeriodDays?: number
}

/**
 * Parameters for registering an auditor
 */
export interface RegisterAuditorParams {
  /** Auditor's organization */
  organization: string
  /** Contact name */
  contactName: string
  /** Contact email */
  contactEmail: string
  /** Public key */
  publicKey: HexString
  /** Audit scope */
  scope: AuditScope
  /** Role */
  role?: ComplianceRole
}

/**
 * Parameters for generating a report
 */
export interface GenerateReportParams {
  /** Report type */
  type: ReportType
  /** Report title */
  title: string
  /** Description */
  description?: string
  /** Format */
  format: ReportFormat
  /** Start date */
  startDate: number
  /** End date */
  endDate: number
  /** Chains to include */
  chains?: ChainId[]
  /** Tokens to include */
  tokens?: string[]
  /** Include inbound */
  includeInbound?: boolean
  /** Include outbound */
  includeOutbound?: boolean
  /** Include full transaction list */
  includeTransactions?: boolean
}

/**
 * Disclosure request - request to disclose a transaction
 */
export interface DisclosureRequest {
  /** Request ID */
  requestId: string
  /** Transaction ID to disclose */
  transactionId: string
  /** Auditor requesting disclosure */
  auditorId: string
  /** Reason for request */
  reason: string
  /** Request timestamp */
  requestedAt: number
  /** Status */
  status: 'pending' | 'approved' | 'denied'
  /** Approver address */
  approvedBy?: string
  /** Approval/denial timestamp */
  resolvedAt?: number
  /** Denial reason */
  denialReason?: string
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Entry ID */
  entryId: string
  /** Timestamp */
  timestamp: number
  /** Actor (who performed the action) */
  actor: string
  /** Action type */
  action:
    | 'auditor_registered'
    | 'auditor_deactivated'
    | 'transaction_disclosed'
    | 'report_generated'
    | 'disclosure_requested'
    | 'disclosure_approved'
    | 'disclosure_denied'
    | 'config_updated'
  /** Action details */
  details: Record<string, unknown>
  /** IP address (if available) */
  ipAddress?: string
}

/**
 * Compliance metrics for dashboard UI
 */
export interface ComplianceMetrics {
  /** Total number of auditors (active + inactive) */
  totalAuditors: number
  /** Total number of disclosures made */
  totalDisclosures: number
  /** Number of pending disclosure requests */
  pendingDisclosures: number
  /** Approval rate (approved / total resolved requests, 0-1) */
  approvalRate: number
  /** Average processing time for disclosure requests (in seconds) */
  averageProcessingTime?: number
}
