/**
 * Enterprise Compliance Manager for SIP Protocol
 *
 * Provides compliance management, auditor access control,
 * transaction disclosure, and reporting functionality.
 *
 * @example
 * ```typescript
 * // Initialize compliance manager
 * const compliance = await ComplianceManager.create({
 *   organizationName: 'Acme Corp',
 *   riskThreshold: 70,
 *   highValueThreshold: 100000_000000n,
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
 * })
 *
 * // Disclose a transaction to the auditor
 * const disclosed = compliance.discloseTransaction(txId, auditor.auditorId, viewingKey)
 *
 * // Generate a compliance report
 * const report = await compliance.generateReport({
 *   type: 'transaction_summary',
 *   title: 'Q4 2024 Report',
 *   format: 'json',
 *   startDate: quarterStart,
 *   endDate: quarterEnd,
 * })
 * ```
 */

import {
  ReportStatus,
  PrivacyLevel,
  type ComplianceConfig,
  type ComplianceRole,
  type AuditScope,
  type AuditorRegistration,
  type DisclosedTransaction,
  type ComplianceReport,
  type ReportData,
  type CreateComplianceConfigParams,
  type RegisterAuditorParams,
  type GenerateReportParams,
  type DisclosureRequest,
  type AuditLogEntry,
  type ViewingKey,
  type HexString,
  type ChainId,
  type Asset,
  type ShieldedPayment,
  type PaymentPurpose,
} from '@sip-protocol/types'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'

import { ValidationError, ErrorCode } from '../errors'
import { generateViewingKey, deriveViewingKey, decryptWithViewing } from '../privacy'
import { isValidChainId } from '../validation'

/**
 * Default configuration values
 */
const DEFAULTS = {
  riskThreshold: 70,
  highValueThreshold: 10000_000000n, // 10,000 USDC equivalent
  retentionPeriodDays: 2555, // ~7 years
}

/**
 * ComplianceManager - Enterprise compliance and auditing
 */
export class ComplianceManager {
  private config: ComplianceConfig
  private auditors: Map<string, AuditorRegistration> = new Map()
  private disclosedTransactions: Map<string, DisclosedTransaction> = new Map()
  private reports: Map<string, ComplianceReport> = new Map()
  private disclosureRequests: Map<string, DisclosureRequest> = new Map()
  private auditLog: AuditLogEntry[] = []

  private constructor(config: ComplianceConfig) {
    this.config = config
  }

  /**
   * Create a new compliance manager
   */
  static async create(params: CreateComplianceConfigParams): Promise<ComplianceManager> {
    if (!params.organizationName || params.organizationName.trim().length === 0) {
      throw new ValidationError(
        'organization name is required',
        'organizationName',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const organizationId = generateId('org')

    // Generate master viewing key
    const masterViewingKey = generateViewingKey(`compliance/${organizationId}`)

    const config: ComplianceConfig = {
      organizationId,
      organizationName: params.organizationName,
      masterViewingKey,
      defaultAuditScope: {
        transactionTypes: ['all'],
        chains: [],
        tokens: [],
      },
      riskThreshold: params.riskThreshold ?? DEFAULTS.riskThreshold,
      highValueThreshold: params.highValueThreshold ?? DEFAULTS.highValueThreshold,
      retentionPeriodDays: params.retentionPeriodDays ?? DEFAULTS.retentionPeriodDays,
      autoReporting: {
        enabled: false,
        frequency: 'monthly',
        reportTypes: ['transaction_summary'],
      },
      createdAt: now,
      updatedAt: now,
    }

    return new ComplianceManager(config)
  }

  /**
   * Load from existing config
   */
  static fromConfig(config: ComplianceConfig): ComplianceManager {
    return new ComplianceManager(config)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  get organizationId(): string {
    return this.config.organizationId
  }

  get organizationName(): string {
    return this.config.organizationName
  }

  get masterViewingKey(): ViewingKey {
    return this.config.masterViewingKey
  }

  getConfig(): ComplianceConfig {
    return { ...this.config }
  }

  // ─── Auditor Management ──────────────────────────────────────────────────────

  /**
   * Register a new auditor
   */
  async registerAuditor(
    params: RegisterAuditorParams,
    registeredBy: string,
  ): Promise<AuditorRegistration> {
    validateRegisterAuditorParams(params)

    const auditorId = generateId('auditor')
    const now = Math.floor(Date.now() / 1000)

    // Derive auditor-specific viewing key
    const viewingKey = deriveViewingKey(
      this.config.masterViewingKey,
      `auditor/${auditorId}`
    )

    const auditor: AuditorRegistration = {
      auditorId,
      organization: params.organization,
      contactName: params.contactName,
      contactEmail: params.contactEmail,
      publicKey: params.publicKey,
      viewingKey,
      scope: params.scope,
      role: params.role ?? 'auditor',
      registeredAt: now,
      registeredBy,
      isActive: true,
    }

    this.auditors.set(auditorId, auditor)

    // Log the action
    this.addAuditLog(registeredBy, 'auditor_registered', {
      auditorId,
      organization: params.organization,
      role: auditor.role,
    })

    return auditor
  }

  /**
   * Get an auditor by ID
   */
  getAuditor(auditorId: string): AuditorRegistration | undefined {
    return this.auditors.get(auditorId)
  }

  /**
   * Get all auditors
   */
  getAllAuditors(): AuditorRegistration[] {
    return Array.from(this.auditors.values())
  }

  /**
   * Get active auditors
   */
  getActiveAuditors(): AuditorRegistration[] {
    return this.getAllAuditors().filter(a => a.isActive)
  }

  /**
   * Deactivate an auditor
   */
  deactivateAuditor(
    auditorId: string,
    deactivatedBy: string,
    reason: string,
  ): AuditorRegistration {
    const auditor = this.auditors.get(auditorId)
    if (!auditor) {
      throw new ValidationError(
        `auditor not found: ${auditorId}`,
        'auditorId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    auditor.isActive = false
    auditor.deactivatedAt = Math.floor(Date.now() / 1000)
    auditor.deactivationReason = reason

    this.addAuditLog(deactivatedBy, 'auditor_deactivated', {
      auditorId,
      reason,
    })

    return auditor
  }

  /**
   * Update auditor scope
   */
  updateAuditorScope(
    auditorId: string,
    scope: AuditScope,
    updatedBy: string,
  ): AuditorRegistration {
    const auditor = this.auditors.get(auditorId)
    if (!auditor) {
      throw new ValidationError(
        `auditor not found: ${auditorId}`,
        'auditorId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    auditor.scope = scope

    this.addAuditLog(updatedBy, 'config_updated', {
      auditorId,
      field: 'scope',
      newScope: scope,
    })

    return auditor
  }

  // ─── Transaction Disclosure ──────────────────────────────────────────────────

  /**
   * Disclose a transaction to an auditor
   *
   * @param payment - The shielded payment to disclose
   * @param auditorId - The auditor to disclose to
   * @param viewingKey - The viewing key to decrypt the payment
   * @param disclosedBy - Who authorized the disclosure
   * @returns The disclosed transaction
   */
  discloseTransaction(
    payment: ShieldedPayment,
    auditorId: string,
    viewingKey: ViewingKey,
    disclosedBy: string,
    additionalInfo?: {
      txHash?: string
      blockNumber?: number
      riskScore?: number
      riskFlags?: string[]
      notes?: string
      tags?: string[]
    },
  ): DisclosedTransaction {
    const auditor = this.auditors.get(auditorId)
    if (!auditor) {
      throw new ValidationError(
        `auditor not found: ${auditorId}`,
        'auditorId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (!auditor.isActive) {
      throw new ValidationError(
        'auditor is not active',
        'auditorId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Check if transaction is within auditor's scope
    if (!this.isWithinScope(payment, auditor.scope)) {
      throw new ValidationError(
        'transaction is outside auditor scope',
        'scope',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    const disclosureId = generateId('disc')
    const now = Math.floor(Date.now() / 1000)

    // Decrypt memo if available
    let decryptedMemo: string | undefined
    let memoDecryptionError: string | undefined
    if (payment.encryptedMemo && viewingKey) {
      try {
        decryptedMemo = this.decryptMemoSafe(payment.encryptedMemo, viewingKey)
      } catch (error) {
        // Log warning for monitoring - memo decryption failure may indicate
        // key mismatch, data corruption, or unauthorized viewing key
        memoDecryptionError = error instanceof Error ? error.message : 'Unknown decryption error'
        console.warn(
          `[ComplianceManager] Failed to decrypt memo for payment ${payment.paymentId}: ${memoDecryptionError}`
        )
      }
    }

    const disclosed: DisclosedTransaction = {
      transactionId: payment.paymentId,
      disclosureId,
      auditorId,
      disclosedAt: now,
      disclosedBy,
      type: 'payment',
      direction: 'outbound', // Payments are outbound
      token: payment.token,
      amount: payment.amount,
      sender: payment.senderCommitment?.value ?? 'hidden',
      recipient: payment.recipientStealth?.address ?? payment.recipientAddress ?? 'unknown',
      txHash: additionalInfo?.txHash ?? '',
      blockNumber: additionalInfo?.blockNumber ?? 0,
      timestamp: payment.createdAt,
      chain: payment.sourceChain,
      privacyLevel: payment.privacyLevel,
      memo: decryptedMemo ?? payment.memo,
      purpose: payment.purpose,
      riskScore: additionalInfo?.riskScore,
      riskFlags: additionalInfo?.riskFlags,
      notes: additionalInfo?.notes,
      tags: additionalInfo?.tags,
    }

    this.disclosedTransactions.set(disclosureId, disclosed)

    this.addAuditLog(disclosedBy, 'transaction_disclosed', {
      disclosureId,
      transactionId: payment.paymentId,
      auditorId,
    })

    return disclosed
  }

  /**
   * Get disclosed transactions for an auditor
   */
  getDisclosedTransactions(auditorId?: string): DisclosedTransaction[] {
    const all = Array.from(this.disclosedTransactions.values())
    if (auditorId) {
      return all.filter(t => t.auditorId === auditorId)
    }
    return all
  }

  /**
   * Get a disclosed transaction by ID
   */
  getDisclosedTransaction(disclosureId: string): DisclosedTransaction | undefined {
    return this.disclosedTransactions.get(disclosureId)
  }

  // ─── Disclosure Requests ─────────────────────────────────────────────────────

  /**
   * Create a disclosure request
   */
  createDisclosureRequest(
    transactionId: string,
    auditorId: string,
    reason: string,
  ): DisclosureRequest {
    const auditor = this.auditors.get(auditorId)
    if (!auditor) {
      throw new ValidationError(
        `auditor not found: ${auditorId}`,
        'auditorId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    const requestId = generateId('req')
    const now = Math.floor(Date.now() / 1000)

    const request: DisclosureRequest = {
      requestId,
      transactionId,
      auditorId,
      reason,
      requestedAt: now,
      status: 'pending',
    }

    this.disclosureRequests.set(requestId, request)

    this.addAuditLog(auditorId, 'disclosure_requested', {
      requestId,
      transactionId,
      reason,
    })

    return request
  }

  /**
   * Approve a disclosure request
   */
  approveDisclosureRequest(requestId: string, approvedBy: string): DisclosureRequest {
    const request = this.disclosureRequests.get(requestId)
    if (!request) {
      throw new ValidationError(
        `request not found: ${requestId}`,
        'requestId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    request.status = 'approved'
    request.approvedBy = approvedBy
    request.resolvedAt = Math.floor(Date.now() / 1000)

    this.addAuditLog(approvedBy, 'disclosure_approved', {
      requestId,
      transactionId: request.transactionId,
      auditorId: request.auditorId,
    })

    return request
  }

  /**
   * Deny a disclosure request
   */
  denyDisclosureRequest(
    requestId: string,
    deniedBy: string,
    reason: string,
  ): DisclosureRequest {
    const request = this.disclosureRequests.get(requestId)
    if (!request) {
      throw new ValidationError(
        `request not found: ${requestId}`,
        'requestId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    request.status = 'denied'
    request.approvedBy = deniedBy
    request.resolvedAt = Math.floor(Date.now() / 1000)
    request.denialReason = reason

    this.addAuditLog(deniedBy, 'disclosure_denied', {
      requestId,
      transactionId: request.transactionId,
      auditorId: request.auditorId,
      reason,
    })

    return request
  }

  /**
   * Get pending disclosure requests
   */
  getPendingRequests(): DisclosureRequest[] {
    return Array.from(this.disclosureRequests.values())
      .filter(r => r.status === 'pending')
  }

  // ─── Reporting ───────────────────────────────────────────────────────────────

  /**
   * Generate a compliance report
   */
  async generateReport(
    params: GenerateReportParams,
    requestedBy: string,
  ): Promise<ComplianceReport> {
    validateReportParams(params)

    const reportId = generateId('report')
    const now = Math.floor(Date.now() / 1000)

    const report: ComplianceReport = {
      reportId,
      type: params.type,
      title: params.title,
      description: params.description,
      format: params.format,
      status: ReportStatus.GENERATING,
      requestedBy,
      requestedAt: now,
      startDate: params.startDate,
      endDate: params.endDate,
      chains: params.chains ?? [],
      tokens: params.tokens ?? [],
      includeInbound: params.includeInbound ?? true,
      includeOutbound: params.includeOutbound ?? true,
    }

    this.reports.set(reportId, report)

    // Generate report data
    try {
      const transactions = this.filterTransactions(
        params.startDate,
        params.endDate,
        params.chains,
        params.tokens,
        report.includeInbound,
        report.includeOutbound,
      )

      const reportData = this.computeReportData(
        transactions,
        params.includeTransactions ?? false,
      )

      if (params.format === 'json') {
        report.data = reportData
      } else if (params.format === 'csv') {
        report.content = this.generateCSV(transactions)
      }

      report.status = ReportStatus.COMPLETED
      report.generatedAt = Math.floor(Date.now() / 1000)
    } catch (error) {
      report.status = ReportStatus.FAILED
      report.error = error instanceof Error ? error.message : 'Unknown error'
    }

    this.addAuditLog(requestedBy, 'report_generated', {
      reportId,
      type: params.type,
      status: report.status,
    })

    return report
  }

  /**
   * Get a report by ID
   */
  getReport(reportId: string): ComplianceReport | undefined {
    return this.reports.get(reportId)
  }

  /**
   * Get all reports
   */
  getAllReports(): ComplianceReport[] {
    return Array.from(this.reports.values())
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────────

  /**
   * Get audit log entries
   */
  getAuditLog(options?: {
    startDate?: number
    endDate?: number
    actor?: string
    action?: AuditLogEntry['action']
    limit?: number
  }): AuditLogEntry[] {
    let entries = [...this.auditLog]

    if (options?.startDate) {
      entries = entries.filter(e => e.timestamp >= options.startDate!)
    }
    if (options?.endDate) {
      entries = entries.filter(e => e.timestamp <= options.endDate!)
    }
    if (options?.actor) {
      entries = entries.filter(e => e.actor === options.actor)
    }
    if (options?.action) {
      entries = entries.filter(e => e.action === options.action)
    }
    if (options?.limit) {
      entries = entries.slice(-options.limit)
    }

    return entries
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  /**
   * Export transactions to CSV
   */
  exportToCSV(auditorId?: string): string {
    const transactions = this.getDisclosedTransactions(auditorId)
    return this.generateCSV(transactions)
  }

  /**
   * Export transactions to JSON
   */
  exportToJSON(auditorId?: string): string {
    const transactions = this.getDisclosedTransactions(auditorId)
    return JSON.stringify(transactions, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2)
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  /**
   * Serialize to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      config: this.config,
      auditors: Array.from(this.auditors.entries()),
      disclosedTransactions: Array.from(this.disclosedTransactions.entries()),
      reports: Array.from(this.reports.entries()),
      disclosureRequests: Array.from(this.disclosureRequests.entries()),
      auditLog: this.auditLog,
    }, (_, value) => typeof value === 'bigint' ? value.toString() : value)
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: string): ComplianceManager {
    const data = JSON.parse(json, (key, value) => {
      if (typeof value === 'string' && /^\d+$/.test(value) &&
          ['amount', 'highValueThreshold', 'minAmount', 'maxAmount'].includes(key)) {
        return BigInt(value)
      }
      return value
    })

    const manager = new ComplianceManager(data.config)
    manager.auditors = new Map(data.auditors)
    manager.disclosedTransactions = new Map(data.disclosedTransactions)
    manager.reports = new Map(data.reports)
    manager.disclosureRequests = new Map(data.disclosureRequests)
    manager.auditLog = data.auditLog

    return manager
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private addAuditLog(
    actor: string,
    action: AuditLogEntry['action'],
    details: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      entryId: generateId('log'),
      timestamp: Math.floor(Date.now() / 1000),
      actor,
      action,
      details,
    })
  }

  private isWithinScope(payment: ShieldedPayment, scope: AuditScope): boolean {
    // Check chains
    if (scope.chains.length > 0 && !scope.chains.includes(payment.sourceChain)) {
      return false
    }

    // Check tokens
    if (scope.tokens.length > 0 && !scope.tokens.includes(payment.token.symbol)) {
      return false
    }

    // Check date range
    if (scope.startDate && payment.createdAt < scope.startDate) {
      return false
    }
    if (scope.endDate && payment.createdAt > scope.endDate) {
      return false
    }

    // Check amount range
    if (scope.minAmount && payment.amount < scope.minAmount) {
      return false
    }
    if (scope.maxAmount && payment.amount > scope.maxAmount) {
      return false
    }

    return true
  }

  private decryptMemoSafe(encryptedMemo: HexString, viewingKey: ViewingKey): string {
    // This is a simplified implementation
    // In practice, you'd need proper encrypted transaction data
    try {
      const decrypted = decryptWithViewing(
        {
          ciphertext: encryptedMemo,
          nonce: '0x' + '00'.repeat(24) as HexString,
          viewingKeyHash: viewingKey.hash,
        },
        viewingKey
      )
      return decrypted.sender // Simplified - actual implementation varies
    } catch {
      throw new Error('Failed to decrypt memo')
    }
  }

  private filterTransactions(
    startDate: number,
    endDate: number,
    chains?: ChainId[],
    tokens?: string[],
    includeInbound?: boolean,
    includeOutbound?: boolean,
  ): DisclosedTransaction[] {
    return Array.from(this.disclosedTransactions.values()).filter(tx => {
      if (tx.timestamp < startDate || tx.timestamp > endDate) return false
      if (chains?.length && !chains.includes(tx.chain)) return false
      if (tokens?.length && !tokens.includes(tx.token.symbol)) return false
      if (!includeInbound && tx.direction === 'inbound') return false
      if (!includeOutbound && tx.direction === 'outbound') return false
      return true
    })
  }

  private computeReportData(
    transactions: DisclosedTransaction[],
    includeTransactions: boolean,
  ): ReportData {
    const volumeByToken: Record<string, bigint> = {}
    const avgByToken: Record<string, bigint> = {}
    const countByToken: Record<string, number> = {}
    const byChain: Record<ChainId, number> = {} as Record<ChainId, number>
    const byPrivacy: Record<PrivacyLevel, number> = {} as Record<PrivacyLevel, number>
    const counterparties = new Set<string>()

    let totalInbound = 0
    let totalOutbound = 0
    let payments = 0
    let swaps = 0
    let deposits = 0
    let withdrawals = 0
    let lowRisk = 0
    let mediumRisk = 0
    let highRisk = 0
    let flagged = 0

    const highValueTxs: DisclosedTransaction[] = []

    for (const tx of transactions) {
      // Volume tracking
      const symbol = tx.token.symbol
      volumeByToken[symbol] = (volumeByToken[symbol] ?? 0n) + tx.amount
      countByToken[symbol] = (countByToken[symbol] ?? 0) + 1

      // Direction
      if (tx.direction === 'inbound') totalInbound++
      else totalOutbound++

      // Type
      if (tx.type === 'payment') payments++
      else if (tx.type === 'swap') swaps++
      else if (tx.type === 'deposit') deposits++
      else if (tx.type === 'withdrawal') withdrawals++

      // Chain
      byChain[tx.chain] = (byChain[tx.chain] ?? 0) + 1

      // Privacy
      byPrivacy[tx.privacyLevel] = (byPrivacy[tx.privacyLevel] ?? 0) + 1

      // Counterparty
      counterparties.add(tx.recipient)
      counterparties.add(tx.sender)

      // Risk
      if (tx.riskScore !== undefined) {
        if (tx.riskScore < 30) lowRisk++
        else if (tx.riskScore < 70) mediumRisk++
        else highRisk++
      }
      if (tx.riskFlags?.length) flagged++

      // High value
      if (tx.amount >= this.config.highValueThreshold) {
        highValueTxs.push(tx)
      }
    }

    // Calculate averages
    for (const symbol of Object.keys(volumeByToken)) {
      avgByToken[symbol] = volumeByToken[symbol] / BigInt(countByToken[symbol])
    }

    const data: ReportData = {
      summary: {
        totalTransactions: transactions.length,
        totalInbound,
        totalOutbound,
        totalVolume: volumeByToken,
        uniqueCounterparties: counterparties.size,
        averageTransactionSize: avgByToken,
        dateRange: {
          start: Math.min(...transactions.map(t => t.timestamp)),
          end: Math.max(...transactions.map(t => t.timestamp)),
        },
      },
      byType: { payments, swaps, deposits, withdrawals },
      byChain,
      byPrivacyLevel: byPrivacy,
      highValueTransactions: highValueTxs,
      riskSummary: {
        lowRisk,
        mediumRisk,
        highRisk,
        flaggedTransactions: flagged,
      },
    }

    if (includeTransactions) {
      data.transactions = transactions
    }

    return data
  }

  private generateCSV(transactions: DisclosedTransaction[]): string {
    const headers = [
      'Transaction ID',
      'Disclosure ID',
      'Type',
      'Direction',
      'Token',
      'Amount',
      'Sender',
      'Recipient',
      'Chain',
      'Privacy Level',
      'Timestamp',
      'TX Hash',
      'Block',
      'Risk Score',
      'Purpose',
      'Memo',
    ]

    const rows = transactions.map(tx => [
      tx.transactionId,
      tx.disclosureId,
      tx.type,
      tx.direction,
      tx.token.symbol,
      tx.amount.toString(),
      tx.sender,
      tx.recipient,
      tx.chain,
      tx.privacyLevel,
      new Date(tx.timestamp * 1000).toISOString(),
      tx.txHash,
      tx.blockNumber.toString(),
      tx.riskScore?.toString() ?? '',
      tx.purpose ?? '',
      tx.memo ?? '',
    ])

    // Escape CSV cells to prevent formula injection attacks
    // Formulas starting with =, +, -, @, |, or tab can be malicious
    const escapeForCSV = (val: string): string => {
      // First handle formula injection: prefix with single quote if starts with dangerous chars
      let escaped = val
      if (/^[=+\-@|\t]/.test(escaped)) {
        escaped = `'${escaped}`
      }
      // Then escape double quotes and wrap in quotes
      return `"${escaped.replace(/"/g, '""')}"`
    }

    const csvRows = [headers, ...rows].map(row => row.map(escapeForCSV).join(','))

    return csvRows.join('\n')
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${bytesToHex(randomBytes(12))}`
}

function validateRegisterAuditorParams(params: RegisterAuditorParams): void {
  if (!params.organization?.trim()) {
    throw new ValidationError(
      'organization is required',
      'organization',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.contactName?.trim()) {
    throw new ValidationError(
      'contact name is required',
      'contactName',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.contactEmail?.trim()) {
    throw new ValidationError(
      'contact email is required',
      'contactEmail',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.publicKey?.trim()) {
    throw new ValidationError(
      'public key is required',
      'publicKey',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.scope) {
    throw new ValidationError(
      'audit scope is required',
      'scope',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
}

function validateReportParams(params: GenerateReportParams): void {
  if (!params.title?.trim()) {
    throw new ValidationError(
      'report title is required',
      'title',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.type) {
    throw new ValidationError(
      'report type is required',
      'type',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (!params.format) {
    throw new ValidationError(
      'report format is required',
      'format',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (params.startDate === undefined || params.startDate === null ||
      params.endDate === undefined || params.endDate === null) {
    throw new ValidationError(
      'date range is required',
      'dateRange',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (params.startDate >= params.endDate) {
    throw new ValidationError(
      'start date must be before end date',
      'dateRange',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
}
