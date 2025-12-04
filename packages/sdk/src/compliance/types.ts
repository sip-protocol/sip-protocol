/**
 * Compliance reporting types
 *
 * Types for audit report generation and transaction disclosure.
 */

import type { EncryptedTransaction, ViewingKey } from '@sip-protocol/types'

/**
 * Decrypted transaction data for audit reports
 */
export interface DecryptedTransaction {
  /** Transaction ID */
  id: string
  /** Sender address */
  sender: string
  /** Recipient address */
  recipient: string
  /** Amount (as string to avoid serialization issues) */
  amount: string
  /** Transaction timestamp */
  timestamp: number
  /** Transaction hash (if available) */
  txHash?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Audit report structure
 */
export interface AuditReport {
  /** Report ID */
  reportId: string
  /** Generation timestamp */
  generatedAt: Date
  /** Report period */
  period: {
    start: Date
    end: Date
  }
  /** Decrypted transactions */
  transactions: DecryptedTransaction[]
  /** Summary statistics */
  summary: {
    /** Total volume (sum of all amounts as bigint) */
    totalVolume: bigint
    /** Number of transactions */
    transactionCount: number
    /** Number of unique counterparties */
    uniqueCounterparties: number
  }
}

/**
 * Parameters for generating an audit report
 */
export interface GenerateAuditReportParams {
  /** Viewing key for decryption */
  viewingKey: ViewingKey | string
  /** Encrypted transactions to include */
  transactions: EncryptedTransaction[]
  /** Start date (optional) */
  startDate?: Date
  /** End date (optional) */
  endDate?: Date
  /** Report format */
  format: 'json' | 'pdf'
}

/**
 * PDF export options
 */
export interface PdfExportOptions {
  /** Report title (default: "SIP Protocol Audit Report") */
  title?: string
  /** Organization name */
  organization?: string
  /** Include transaction details (default: true) */
  includeTransactions?: boolean
  /** Maximum transactions to include in detail section (default: 100) */
  maxTransactions?: number
}

/**
 * Jurisdiction codes for regulatory compliance
 */
export type Jurisdiction = 'US' | 'EU' | 'UK' | 'SG'

/**
 * Regulatory export format types
 */
export type RegulatoryFormat = 'FATF' | 'FINCEN' | 'CSV'

/**
 * FATF Travel Rule export format
 * Simplified version of FATF Recommendation 16 (Travel Rule) for cross-border transfers
 */
export interface FATFExport {
  /** Report metadata */
  reportId: string
  /** Generation timestamp */
  generatedAt: string
  /** Jurisdiction code */
  jurisdiction: Jurisdiction
  /** Transaction records */
  transactions: FATFTransaction[]
}

/**
 * FATF transaction record
 */
export interface FATFTransaction {
  /** Originator name (optional for privacy) */
  originatorName?: string
  /** Originator account/address */
  originatorAccount: string
  /** Beneficiary name (optional for privacy) */
  beneficiaryName?: string
  /** Beneficiary account/address */
  beneficiaryAccount: string
  /** Transaction amount */
  amount: string
  /** Currency code (e.g., 'USD', 'ETH') */
  currency: string
  /** Transaction reference */
  transactionRef: string
  /** Transaction timestamp (ISO 8601) */
  timestamp: string
}

/**
 * FINCEN Suspicious Activity Report export format
 * Simplified version of FinCEN SAR (Form 111) for suspicious activity reporting
 */
export interface FINCENExport {
  /** Report metadata */
  reportId: string
  /** Filing type (always 'SAR' for Suspicious Activity Report) */
  filingType: 'SAR'
  /** Report generation date (ISO 8601) */
  reportDate: string
  /** Jurisdiction (must be 'US') */
  jurisdiction: 'US'
  /** Suspicious activity summary */
  summary: {
    /** Total transaction count */
    transactionCount: number
    /** Total volume */
    totalAmount: string
    /** Date range */
    period: {
      start: string
      end: string
    }
  }
  /** Transaction records */
  transactions: FINCENTransaction[]
}

/**
 * FINCEN transaction record
 */
export interface FINCENTransaction {
  /** Transaction date (ISO 8601) */
  transactionDate: string
  /** Transaction amount */
  amount: string
  /** Currency code */
  currency: string
  /** Suspicious activity indicators (optional) */
  suspiciousActivity?: string[]
  /** Narrative summary of transaction */
  narrativeSummary: string
  /** Transaction reference */
  transactionRef: string
  /** Involved parties */
  parties: {
    sender: string
    recipient: string
  }
}

/**
 * CSV export format (generic)
 */
export interface CSVExport {
  /** Report metadata */
  reportId: string
  /** Generation timestamp */
  generatedAt: string
  /** Jurisdiction code */
  jurisdiction: Jurisdiction
  /** CSV headers */
  headers: string[]
  /** CSV rows (array of arrays) */
  rows: string[][]
}

/**
 * Parameters for exporting to regulatory formats
 */
export interface ExportForRegulatorParams {
  /** Viewing key for decryption */
  viewingKey: ViewingKey | string
  /** Encrypted transactions to include */
  transactions: EncryptedTransaction[]
  /** Target jurisdiction */
  jurisdiction: Jurisdiction
  /** Export format */
  format: RegulatoryFormat
  /** Start date (optional) */
  startDate?: Date
  /** End date (optional) */
  endDate?: Date
  /** Currency code (default: 'USD') */
  currency?: string
}

/**
 * Union type for all regulatory export formats
 */
export type RegulatoryExport = FATFExport | FINCENExport | CSVExport
