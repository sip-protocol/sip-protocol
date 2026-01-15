/**
 * Fireblocks Viewing Key API Integration
 *
 * Integrates viewing key API with Fireblocks, the leading institutional custody platform.
 * Enables compliance officers using Fireblocks to access SIP Protocol transaction history
 * with cryptographic privacy guarantees.
 *
 * @example
 * ```typescript
 * import { FireblocksViewingKeyClient, createFireblocksClient } from '@sip-protocol/sdk'
 *
 * const client = createFireblocksClient({
 *   apiKey: process.env.FIREBLOCKS_API_KEY!,
 *   secretKey: process.env.FIREBLOCKS_SECRET_KEY!,
 *   vaultAccountId: 'vault-123',
 * })
 *
 * // Register viewing key for compliance
 * const registration = await client.registerViewingKey({
 *   viewingKey: orgViewingKey,
 *   auditorName: 'Compliance Team',
 *   scope: { transactionTypes: ['transfer', 'swap'] },
 * })
 *
 * // Export transaction history for audit
 * const history = await client.exportTransactionHistory({
 *   viewingKey: orgViewingKey,
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31'),
 *   format: 'csv',
 * })
 * ```
 *
 * @see https://docs.fireblocks.com/api/
 * @see https://docs.fireblocks.com/api/#signing-a-request
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { ViewingKey, EncryptedTransaction, Hash } from '@sip-protocol/types'
import { decryptWithViewing, type TransactionData } from '../privacy'

/**
 * Fireblocks API configuration
 */
export interface FireblocksConfig {
  /** Fireblocks API key */
  apiKey: string
  /** Fireblocks secret key (RSA private key for signing) */
  secretKey: string
  /** Vault account ID for operations */
  vaultAccountId: string
  /** Base URL (defaults to production) */
  baseUrl?: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Enable sandbox mode for testing */
  sandbox?: boolean
}

/**
 * Viewing key registration parameters
 */
export interface RegisterViewingKeyParams {
  /** The viewing key to register */
  viewingKey: ViewingKey
  /** Name of the auditor/compliance team */
  auditorName: string
  /** Scope of access */
  scope: ViewingKeyScope
  /** Expiration date (optional) */
  expiresAt?: Date
  /** Metadata for compliance records */
  metadata?: Record<string, string>
}

/**
 * Scope of viewing key access
 */
export interface ViewingKeyScope {
  /** Transaction types to include */
  transactionTypes?: TransactionType[]
  /** Chain IDs to include */
  chains?: string[]
  /** Token/asset addresses to include */
  assets?: string[]
  /** Minimum amount threshold */
  minAmount?: bigint
  /** Maximum amount threshold */
  maxAmount?: bigint
  /** Start date for transaction range */
  startDate?: Date
  /** End date for transaction range */
  endDate?: Date
}

/**
 * Transaction types for scoping
 */
export type TransactionType =
  | 'transfer'
  | 'swap'
  | 'deposit'
  | 'withdrawal'
  | 'stake'
  | 'unstake'
  | 'bridge'
  | 'mint'
  | 'burn'

/**
 * Viewing key registration result
 */
export interface ViewingKeyRegistration {
  /** Registration ID */
  id: string
  /** Viewing key hash (for identification) */
  viewingKeyHash: Hash
  /** Auditor name */
  auditorName: string
  /** Access scope */
  scope: ViewingKeyScope
  /** When registered */
  registeredAt: Date
  /** When expires */
  expiresAt?: Date
  /** Registration status */
  status: RegistrationStatus
  /** Fireblocks vault account */
  vaultAccountId: string
}

/**
 * Registration status
 */
export type RegistrationStatus = 'active' | 'expired' | 'revoked' | 'pending'

/**
 * Transaction history export parameters
 */
export interface ExportTransactionHistoryParams {
  /** Viewing key for decryption */
  viewingKey: ViewingKey
  /** Start date */
  startDate: Date
  /** End date */
  endDate: Date
  /** Export format */
  format: ExportFormat
  /** Include raw encrypted data */
  includeRaw?: boolean
  /** Filter by transaction types */
  transactionTypes?: TransactionType[]
  /** Filter by chains */
  chains?: string[]
  /** Filter by assets */
  assets?: string[]
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv' | 'pdf'

/**
 * Transaction history export result
 */
export interface TransactionHistoryExport {
  /** Export ID */
  id: string
  /** When generated */
  generatedAt: Date
  /** Export format */
  format: ExportFormat
  /** Number of transactions */
  transactionCount: number
  /** Date range */
  dateRange: { start: Date; end: Date }
  /** Export data (base64 for PDF, string for CSV, object for JSON) */
  data: string | DecryptedTransaction[]
  /** Checksum for verification */
  checksum: Hash
}

/**
 * Decrypted transaction for export
 */
export interface DecryptedTransaction {
  /** Transaction ID */
  id: string
  /** Transaction type */
  type: TransactionType
  /** Chain ID */
  chain: string
  /** Sender address (decrypted) */
  sender: string
  /** Recipient address (decrypted) */
  recipient: string
  /** Amount (decrypted) */
  amount: string
  /** Asset/token */
  asset: string
  /** Timestamp */
  timestamp: Date
  /** Fireblocks transaction ID (if available) */
  fireblocksId?: string
  /** Risk score (0-100) */
  riskScore?: number
  /** Tags/labels */
  tags?: string[]
}

/**
 * Compliance report parameters
 */
export interface GenerateComplianceReportParams {
  /** Viewing key for decryption */
  viewingKey: ViewingKey
  /** Report type */
  reportType: ComplianceReportType
  /** Reporting period start */
  periodStart: Date
  /** Reporting period end */
  periodEnd: Date
  /** Include transaction details */
  includeDetails?: boolean
  /** Include risk analysis */
  includeRiskAnalysis?: boolean
  /** Output format */
  format: ExportFormat
}

/**
 * Compliance report types
 */
export type ComplianceReportType =
  | 'transaction_summary'
  | 'audit_trail'
  | 'risk_assessment'
  | 'regulatory_filing'
  | 'tax_report'

/**
 * Compliance report result
 */
export interface ComplianceReport {
  /** Report ID */
  id: string
  /** Report type */
  type: ComplianceReportType
  /** When generated */
  generatedAt: Date
  /** Reporting period */
  period: { start: Date; end: Date }
  /** Summary statistics */
  summary: {
    totalTransactions: number
    totalVolume: string
    uniqueCounterparties: number
    averageRiskScore: number
    flaggedTransactions: number
  }
  /** Report data */
  data: string | Record<string, unknown>
  /** Format */
  format: ExportFormat
  /** Checksum */
  checksum: Hash
}

/**
 * Fireblocks API error
 */
export class FireblocksError extends Error {
  code: FireblocksErrorCode
  statusCode?: number
  details?: unknown

  constructor(message: string, code: FireblocksErrorCode, statusCode?: number, details?: unknown) {
    super(message)
    this.name = 'FireblocksError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * Error codes for Fireblocks integration
 */
export enum FireblocksErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_VIEWING_KEY = 'INVALID_VIEWING_KEY',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  INVALID_SCOPE = 'INVALID_SCOPE',
}

/**
 * Fireblocks Viewing Key Client
 *
 * Integrates SIP Protocol viewing keys with Fireblocks institutional custody.
 */
export class FireblocksViewingKeyClient {
  private readonly apiKey: string
  private readonly secretKey: string
  private readonly vaultAccountId: string

  /** In-memory registration storage (production would use secure backend) */
  private registrations: Map<string, ViewingKeyRegistration> = new Map()
  private exports: Map<string, TransactionHistoryExport> = new Map()
  private reports: Map<string, ComplianceReport> = new Map()

  constructor(config: FireblocksConfig) {
    this.apiKey = config.apiKey
    this.secretKey = config.secretKey
    this.vaultAccountId = config.vaultAccountId
  }

  /**
   * Register a viewing key for compliance access
   *
   * @param params - Registration parameters
   * @returns Registration result
   */
  async registerViewingKey(params: RegisterViewingKeyParams): Promise<ViewingKeyRegistration> {
    // Validate viewing key
    if (!this.isValidViewingKey(params.viewingKey)) {
      throw new FireblocksError(
        'Invalid viewing key format',
        FireblocksErrorCode.INVALID_VIEWING_KEY
      )
    }

    // Validate scope
    if (!this.isValidScope(params.scope)) {
      throw new FireblocksError(
        'Invalid scope configuration',
        FireblocksErrorCode.INVALID_SCOPE
      )
    }

    // Compute viewing key hash for identification
    const viewingKeyHash = this.computeViewingKeyHash(params.viewingKey)

    // Check for existing registration
    const existing = Array.from(this.registrations.values())
      .find(r => r.viewingKeyHash === viewingKeyHash && r.status === 'active')

    if (existing) {
      throw new FireblocksError(
        'Viewing key already registered',
        FireblocksErrorCode.REGISTRATION_FAILED
      )
    }

    // Create registration
    const registration: ViewingKeyRegistration = {
      id: this.generateId('reg'),
      viewingKeyHash,
      auditorName: params.auditorName,
      scope: params.scope,
      registeredAt: new Date(),
      expiresAt: params.expiresAt,
      status: 'active',
      vaultAccountId: this.vaultAccountId,
    }

    // Store registration
    this.registrations.set(registration.id, registration)

    // In production, this would sync to Fireblocks via API
    // await this.syncRegistrationToFireblocks(registration)

    return registration
  }

  /**
   * Get a viewing key registration
   *
   * @param registrationId - Registration ID
   * @returns Registration or null
   */
  getRegistration(registrationId: string): ViewingKeyRegistration | null {
    return this.registrations.get(registrationId) ?? null
  }

  /**
   * List all registrations for the vault
   *
   * @returns All registrations
   */
  listRegistrations(): ViewingKeyRegistration[] {
    return Array.from(this.registrations.values())
      .filter(r => r.vaultAccountId === this.vaultAccountId)
  }

  /**
   * Revoke a viewing key registration
   *
   * @param registrationId - Registration to revoke
   * @param reason - Reason for revocation
   */
  async revokeRegistration(registrationId: string, reason: string): Promise<void> {
    const registration = this.registrations.get(registrationId)

    if (!registration) {
      throw new FireblocksError(
        'Registration not found',
        FireblocksErrorCode.REGISTRATION_FAILED
      )
    }

    registration.status = 'revoked'
    this.registrations.set(registrationId, registration)

    // In production, sync revocation to Fireblocks
    // await this.syncRevocationToFireblocks(registrationId, reason)
  }

  /**
   * Export transaction history using viewing key
   *
   * @param params - Export parameters
   * @param encryptedTransactions - Encrypted transactions to export
   * @returns Export result
   */
  async exportTransactionHistory(
    params: ExportTransactionHistoryParams,
    encryptedTransactions: EncryptedTransaction[]
  ): Promise<TransactionHistoryExport> {
    // Validate viewing key
    if (!this.isValidViewingKey(params.viewingKey)) {
      throw new FireblocksError(
        'Invalid viewing key',
        FireblocksErrorCode.INVALID_VIEWING_KEY
      )
    }

    // Verify viewing key is registered
    const viewingKeyHash = this.computeViewingKeyHash(params.viewingKey)
    const registration = Array.from(this.registrations.values())
      .find(r => r.viewingKeyHash === viewingKeyHash && r.status === 'active')

    if (!registration) {
      throw new FireblocksError(
        'Viewing key not registered or inactive',
        FireblocksErrorCode.INVALID_VIEWING_KEY
      )
    }

    // Decrypt transactions
    const decryptedTransactions: DecryptedTransaction[] = []

    for (const encrypted of encryptedTransactions) {
      try {
        // Verify viewing key hash matches
        if (encrypted.viewingKeyHash !== viewingKeyHash) {
          continue // Skip transactions encrypted with different key
        }

        const decrypted = decryptWithViewing(encrypted, params.viewingKey)

        // Apply filters
        if (params.startDate && new Date(decrypted.timestamp) < params.startDate) continue
        if (params.endDate && new Date(decrypted.timestamp) > params.endDate) continue

        decryptedTransactions.push(this.mapToDecryptedTransaction(decrypted, encrypted))
      } catch {
        // Skip transactions that can't be decrypted
        continue
      }
    }

    // Format export
    let data: string | DecryptedTransaction[]

    switch (params.format) {
      case 'json':
        data = decryptedTransactions
        break
      case 'csv':
        data = this.formatAsCsv(decryptedTransactions)
        break
      case 'pdf':
        data = this.formatAsPdfBase64(decryptedTransactions)
        break
    }

    // Create export record
    const exportResult: TransactionHistoryExport = {
      id: this.generateId('exp'),
      generatedAt: new Date(),
      format: params.format,
      transactionCount: decryptedTransactions.length,
      dateRange: { start: params.startDate, end: params.endDate },
      data,
      checksum: this.computeChecksum(data),
    }

    this.exports.set(exportResult.id, exportResult)

    return exportResult
  }

  /**
   * Generate a compliance report
   *
   * @param params - Report parameters
   * @param encryptedTransactions - Encrypted transactions
   * @returns Compliance report
   */
  async generateComplianceReport(
    params: GenerateComplianceReportParams,
    encryptedTransactions: EncryptedTransaction[]
  ): Promise<ComplianceReport> {
    // First, export transaction history
    const historyExport = await this.exportTransactionHistory(
      {
        viewingKey: params.viewingKey,
        startDate: params.periodStart,
        endDate: params.periodEnd,
        format: 'json',
      },
      encryptedTransactions
    )

    const transactions = historyExport.data as DecryptedTransaction[]

    // Compute summary statistics
    const summary = this.computeSummaryStats(transactions)

    // Generate report based on type
    let reportData: Record<string, unknown>

    switch (params.reportType) {
      case 'transaction_summary':
        reportData = this.generateTransactionSummary(transactions, params.includeDetails)
        break
      case 'audit_trail':
        reportData = this.generateAuditTrail(transactions)
        break
      case 'risk_assessment':
        reportData = this.generateRiskAssessment(transactions)
        break
      case 'regulatory_filing':
        reportData = this.generateRegulatoryFiling(transactions)
        break
      case 'tax_report':
        reportData = this.generateTaxReport(transactions)
        break
    }

    // Format output
    let data: string | Record<string, unknown>

    switch (params.format) {
      case 'json':
        data = reportData
        break
      case 'csv':
        data = this.formatReportAsCsv(reportData)
        break
      case 'pdf':
        data = this.formatReportAsPdfBase64(reportData)
        break
    }

    const report: ComplianceReport = {
      id: this.generateId('rpt'),
      type: params.reportType,
      generatedAt: new Date(),
      period: { start: params.periodStart, end: params.periodEnd },
      summary,
      data,
      format: params.format,
      checksum: this.computeChecksum(data),
    }

    this.reports.set(report.id, report)

    return report
  }

  /**
   * Get a previously generated report
   *
   * @param reportId - Report ID
   * @returns Report or null
   */
  getReport(reportId: string): ComplianceReport | null {
    return this.reports.get(reportId) ?? null
  }

  /**
   * Verify API connectivity to Fireblocks
   *
   * @returns Whether connection is successful
   */
  async verifyConnection(): Promise<boolean> {
    try {
      // In production, this would make an authenticated API call
      // For now, validate configuration
      return !!(this.apiKey && this.secretKey && this.vaultAccountId)
    } catch {
      return false
    }
  }

  /**
   * Validate viewing key format
   */
  private isValidViewingKey(viewingKey: ViewingKey): boolean {
    if (!viewingKey.key || !viewingKey.path || !viewingKey.hash) {
      return false
    }

    // Must be hex string starting with 0x
    if (!viewingKey.key.startsWith('0x') || viewingKey.key.length < 66) {
      return false
    }

    return true
  }

  /**
   * Validate scope configuration
   */
  private isValidScope(scope: ViewingKeyScope): boolean {
    if (scope.startDate && scope.endDate && scope.startDate > scope.endDate) {
      return false
    }

    if (scope.minAmount !== undefined && scope.maxAmount !== undefined) {
      if (scope.minAmount > scope.maxAmount) {
        return false
      }
    }

    return true
  }

  /**
   * Compute viewing key hash
   */
  private computeViewingKeyHash(viewingKey: ViewingKey): Hash {
    const keyBytes = hexToBytes(viewingKey.key.slice(2))
    const hash = sha256(keyBytes)
    return `0x${bytesToHex(hash)}` as Hash
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 10)
    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * Map decrypted data to transaction format
   */
  private mapToDecryptedTransaction(
    decrypted: TransactionData,
    _encrypted: EncryptedTransaction
  ): DecryptedTransaction {
    return {
      id: this.generateId('tx'),
      type: 'transfer', // Default type
      chain: 'solana', // Would be extracted from metadata
      sender: decrypted.sender,
      recipient: decrypted.recipient,
      amount: decrypted.amount.toString(),
      asset: 'USDC', // Would be extracted from metadata
      timestamp: new Date(decrypted.timestamp),
    }
  }

  /**
   * Format transactions as CSV
   */
  private formatAsCsv(transactions: DecryptedTransaction[]): string {
    const headers = [
      'id',
      'type',
      'chain',
      'sender',
      'recipient',
      'amount',
      'asset',
      'timestamp',
      'riskScore',
    ]

    const rows = transactions.map(tx =>
      [
        tx.id,
        tx.type,
        tx.chain,
        tx.sender,
        tx.recipient,
        tx.amount,
        tx.asset,
        tx.timestamp.toISOString(),
        tx.riskScore ?? '',
      ].join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }

  /**
   * Format transactions as PDF (base64)
   */
  private formatAsPdfBase64(transactions: DecryptedTransaction[]): string {
    // In production, would use a PDF library
    // For now, return a placeholder
    const content = JSON.stringify({
      title: 'SIP Protocol Transaction History',
      generatedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        timestamp: tx.timestamp,
      })),
    })

    return Buffer.from(content).toString('base64')
  }

  /**
   * Compute summary statistics
   */
  private computeSummaryStats(transactions: DecryptedTransaction[]): ComplianceReport['summary'] {
    const uniqueCounterparties = new Set([
      ...transactions.map(tx => tx.sender),
      ...transactions.map(tx => tx.recipient),
    ])

    const riskScores = transactions
      .filter(tx => tx.riskScore !== undefined)
      .map(tx => tx.riskScore!)

    const totalVolume = transactions.reduce(
      (sum, tx) => sum + BigInt(tx.amount),
      0n
    )

    return {
      totalTransactions: transactions.length,
      totalVolume: totalVolume.toString(),
      uniqueCounterparties: uniqueCounterparties.size,
      averageRiskScore: riskScores.length > 0
        ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
        : 0,
      flaggedTransactions: transactions.filter(tx => (tx.riskScore ?? 0) >= 70).length,
    }
  }

  /**
   * Generate transaction summary report
   */
  private generateTransactionSummary(
    transactions: DecryptedTransaction[],
    includeDetails?: boolean
  ): Record<string, unknown> {
    const byType = new Map<TransactionType, number>()
    const byChain = new Map<string, number>()
    const byAsset = new Map<string, bigint>()

    for (const tx of transactions) {
      byType.set(tx.type, (byType.get(tx.type) ?? 0) + 1)
      byChain.set(tx.chain, (byChain.get(tx.chain) ?? 0) + 1)
      byAsset.set(tx.asset, (byAsset.get(tx.asset) ?? 0n) + BigInt(tx.amount))
    }

    return {
      reportType: 'transaction_summary',
      period: {
        start: transactions[0]?.timestamp,
        end: transactions[transactions.length - 1]?.timestamp,
      },
      breakdown: {
        byType: Object.fromEntries(byType),
        byChain: Object.fromEntries(byChain),
        byAsset: Object.fromEntries(
          Array.from(byAsset.entries()).map(([k, v]) => [k, v.toString()])
        ),
      },
      transactions: includeDetails ? transactions : undefined,
    }
  }

  /**
   * Generate audit trail report
   */
  private generateAuditTrail(transactions: DecryptedTransaction[]): Record<string, unknown> {
    return {
      reportType: 'audit_trail',
      entries: transactions.map(tx => ({
        timestamp: tx.timestamp,
        action: tx.type,
        from: tx.sender,
        to: tx.recipient,
        amount: tx.amount,
        asset: tx.asset,
        chain: tx.chain,
        id: tx.id,
      })),
    }
  }

  /**
   * Generate risk assessment report
   */
  private generateRiskAssessment(transactions: DecryptedTransaction[]): Record<string, unknown> {
    const highRisk = transactions.filter(tx => (tx.riskScore ?? 0) >= 70)
    const mediumRisk = transactions.filter(tx =>
      (tx.riskScore ?? 0) >= 30 && (tx.riskScore ?? 0) < 70
    )
    const lowRisk = transactions.filter(tx => (tx.riskScore ?? 0) < 30)

    return {
      reportType: 'risk_assessment',
      distribution: {
        high: highRisk.length,
        medium: mediumRisk.length,
        low: lowRisk.length,
      },
      flaggedTransactions: highRisk.map(tx => ({
        id: tx.id,
        riskScore: tx.riskScore,
        reason: 'High value transaction', // Would be more detailed in production
      })),
      recommendations: [
        'Review high-risk transactions for suspicious activity',
        'Verify counterparty identities for flagged addresses',
      ],
    }
  }

  /**
   * Generate regulatory filing report
   */
  private generateRegulatoryFiling(transactions: DecryptedTransaction[]): Record<string, unknown> {
    return {
      reportType: 'regulatory_filing',
      filingType: 'SAR_PREP', // Suspicious Activity Report preparation
      totalTransactions: transactions.length,
      flaggedForReview: transactions.filter(tx => (tx.riskScore ?? 0) >= 70).length,
      volumeAnalysis: this.computeSummaryStats(transactions),
      attachments: ['transaction_detail', 'risk_assessment'],
    }
  }

  /**
   * Generate tax report
   */
  private generateTaxReport(transactions: DecryptedTransaction[]): Record<string, unknown> {
    // Group by asset for cost basis tracking
    const byAsset = new Map<string, DecryptedTransaction[]>()

    for (const tx of transactions) {
      const existing = byAsset.get(tx.asset) ?? []
      existing.push(tx)
      byAsset.set(tx.asset, existing)
    }

    return {
      reportType: 'tax_report',
      taxYear: transactions[0]?.timestamp.getFullYear(),
      assets: Array.from(byAsset.entries()).map(([asset, txs]) => ({
        asset,
        transactionCount: txs.length,
        totalVolume: txs.reduce((sum, tx) => sum + BigInt(tx.amount), 0n).toString(),
        // Would include cost basis calculations in production
      })),
      disclaimer: 'This report is for informational purposes only. Consult a tax professional.',
    }
  }

  /**
   * Format report as CSV
   */
  private formatReportAsCsv(report: Record<string, unknown>): string {
    return JSON.stringify(report) // Simplified for demo
  }

  /**
   * Format report as PDF (base64)
   */
  private formatReportAsPdfBase64(report: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(report)).toString('base64')
  }

  /**
   * Compute checksum for data integrity
   */
  private computeChecksum(data: string | unknown): Hash {
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    const hash = sha256(new TextEncoder().encode(str))
    return `0x${bytesToHex(hash)}` as Hash
  }
}

/**
 * Create a Fireblocks viewing key client
 *
 * @param config - Fireblocks configuration
 * @returns Configured client
 */
export function createFireblocksClient(config: FireblocksConfig): FireblocksViewingKeyClient {
  return new FireblocksViewingKeyClient(config)
}
