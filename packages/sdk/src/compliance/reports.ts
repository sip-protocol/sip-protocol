/**
 * Compliance Report Generation
 *
 * Generates audit reports from viewing keys and encrypted transactions.
 * Provides JSON-formatted reports with decrypted transaction data and
 * summary statistics.
 */

import type { EncryptedTransaction, ViewingKey, HexString } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { decryptWithViewing } from '../privacy'
import { generateRandomBytes } from '../crypto'
import { ValidationError, CryptoError, ErrorCode } from '../errors'
import type {
  GenerateAuditReportParams,
  AuditReport,
  DecryptedTransaction,
  PdfExportOptions,
  ExportForRegulatorParams,
  RegulatoryExport,
  FATFExport,
  FATFTransaction,
  FINCENExport,
  FINCENTransaction,
  CSVExport,
  Jurisdiction,
} from './types'
import { generatePdfReport } from './pdf'

/**
 * ComplianceReporter - Generates audit reports from encrypted transactions
 *
 * @example
 * ```typescript
 * const reporter = new ComplianceReporter()
 *
 * const report = await reporter.generateAuditReport({
 *   viewingKey: myViewingKey,
 *   transactions: encryptedTransactions,
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31'),
 *   format: 'json',
 * })
 *
 * console.log(`Report contains ${report.summary.transactionCount} transactions`)
 * console.log(`Total volume: ${report.summary.totalVolume}`)
 * ```
 */
export class ComplianceReporter {
  /**
   * Generate an audit report from encrypted transactions
   *
   * Decrypts transactions using the provided viewing key, filters by date range,
   * and generates a comprehensive report with summary statistics.
   *
   * @param params - Report generation parameters
   * @returns Audit report with decrypted transactions and statistics
   * @throws {ValidationError} If parameters are invalid
   * @throws {CryptoError} If decryption fails
   */
  async generateAuditReport(
    params: GenerateAuditReportParams
  ): Promise<AuditReport> {
    // Validate parameters
    this.validateParams(params)

    // Normalize viewing key
    const viewingKey = this.normalizeViewingKey(params.viewingKey)

    // Decrypt and filter transactions
    const decryptedTransactions = this.decryptTransactions(
      params.transactions,
      viewingKey,
      params.startDate,
      params.endDate
    )

    // Calculate summary statistics
    const summary = this.calculateSummary(decryptedTransactions)

    // Determine report period
    const period = this.determinePeriod(
      decryptedTransactions,
      params.startDate,
      params.endDate
    )

    // Generate report ID
    const reportId = `audit_${generateRandomBytes(16).slice(2)}`

    return {
      reportId,
      generatedAt: new Date(),
      period,
      transactions: decryptedTransactions,
      summary,
    }
  }

  /**
   * Validate report generation parameters
   */
  private validateParams(params: GenerateAuditReportParams): void {
    if (!params.viewingKey) {
      throw new ValidationError(
        'viewingKey is required',
        'viewingKey',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    if (!params.transactions) {
      throw new ValidationError(
        'transactions array is required',
        'transactions',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    if (!Array.isArray(params.transactions)) {
      throw new ValidationError(
        'transactions must be an array',
        'transactions',
        { received: typeof params.transactions },
        ErrorCode.INVALID_INPUT
      )
    }

    if (params.format !== 'json' && params.format !== 'pdf') {
      throw new ValidationError(
        'only JSON and PDF formats are supported',
        'format',
        { received: params.format },
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate date range
    if (params.startDate && params.endDate) {
      if (params.startDate > params.endDate) {
        throw new ValidationError(
          'startDate must be before endDate',
          'startDate',
          {
            startDate: params.startDate.toISOString(),
            endDate: params.endDate.toISOString(),
          },
          ErrorCode.INVALID_INPUT
        )
      }
    }
  }

  /**
   * Normalize viewing key to ViewingKey object
   */
  private normalizeViewingKey(
    viewingKey: ViewingKey | string
  ): ViewingKey {
    if (typeof viewingKey === 'string') {
      // Convert string to ViewingKey object
      // For string keys, we need to compute the hash
      const keyHex = viewingKey.startsWith('0x') ? viewingKey.slice(2) : viewingKey
      const keyBytes = hexToBytes(keyHex)
      const hashBytes = sha256(keyBytes)

      return {
        key: `0x${keyHex}` as HexString,
        path: 'm/0',
        hash: `0x${bytesToHex(hashBytes)}` as HexString,
      }
    }

    return viewingKey
  }

  /**
   * Decrypt transactions and filter by date range
   */
  private decryptTransactions(
    encrypted: EncryptedTransaction[],
    viewingKey: ViewingKey,
    startDate?: Date,
    endDate?: Date
  ): DecryptedTransaction[] {
    const decrypted: DecryptedTransaction[] = []
    const errors: Array<{ index: number; error: Error }> = []

    for (let i = 0; i < encrypted.length; i++) {
      try {
        const txData = decryptWithViewing(encrypted[i], viewingKey)

        // Filter by date range if specified
        if (startDate || endDate) {
          const txDate = new Date(txData.timestamp * 1000)

          if (startDate && txDate < startDate) {
            continue
          }

          if (endDate && txDate > endDate) {
            continue
          }
        }

        decrypted.push({
          id: `tx_${i}`,
          sender: txData.sender,
          recipient: txData.recipient,
          amount: txData.amount,
          timestamp: txData.timestamp,
        })
      } catch (error) {
        // Collect errors but continue processing other transactions
        errors.push({ index: i, error: error as Error })
      }
    }

    // If all transactions failed to decrypt, throw an error
    if (decrypted.length === 0 && encrypted.length > 0) {
      throw new CryptoError(
        `Failed to decrypt any transactions. First error: ${errors[0]?.error.message}`,
        ErrorCode.DECRYPTION_FAILED,
        {
          context: {
            totalTransactions: encrypted.length,
            failedCount: errors.length,
          }
        }
      )
    }

    return decrypted
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(transactions: DecryptedTransaction[]): {
    totalVolume: bigint
    transactionCount: number
    uniqueCounterparties: number
  } {
    let totalVolume = 0n
    const counterparties = new Set<string>()

    for (const tx of transactions) {
      // Parse amount as bigint
      try {
        const amount = BigInt(tx.amount)
        totalVolume += amount
      } catch (error) {
        // Skip invalid amounts
        console.warn(`Skipping invalid amount in transaction ${tx.id}: ${tx.amount}`)
      }

      // Collect unique counterparties
      counterparties.add(tx.sender)
      counterparties.add(tx.recipient)
    }

    return {
      totalVolume,
      transactionCount: transactions.length,
      uniqueCounterparties: counterparties.size,
    }
  }

  /**
   * Determine report period from transactions and params
   */
  private determinePeriod(
    transactions: DecryptedTransaction[],
    startDate?: Date,
    endDate?: Date
  ): { start: Date; end: Date } {
    // If dates provided, use them
    if (startDate && endDate) {
      return { start: startDate, end: endDate }
    }

    // Otherwise, derive from transactions
    if (transactions.length === 0) {
      // No transactions - use current date
      const now = new Date()
      return { start: now, end: now }
    }

    // Find min and max timestamps
    let minTimestamp = transactions[0].timestamp
    let maxTimestamp = transactions[0].timestamp

    for (const tx of transactions) {
      if (tx.timestamp < minTimestamp) {
        minTimestamp = tx.timestamp
      }
      if (tx.timestamp > maxTimestamp) {
        maxTimestamp = tx.timestamp
      }
    }

    return {
      start: startDate || new Date(minTimestamp * 1000),
      end: endDate || new Date(maxTimestamp * 1000),
    }
  }

  /**
   * Export audit report to PDF format
   *
   * Generates a professionally formatted PDF document from an audit report.
   * Works in both Node.js and browser environments.
   *
   * @param report - The audit report to export
   * @param options - PDF export options
   * @returns PDF document as Uint8Array
   *
   * @example
   * ```typescript
   * const reporter = new ComplianceReporter()
   * const report = await reporter.generateAuditReport({...})
   *
   * const pdfBytes = reporter.exportToPdf(report, {
   *   title: 'Q1 2025 Audit Report',
   *   organization: 'ACME Corp',
   * })
   *
   * // Save to file (Node.js)
   * fs.writeFileSync('report.pdf', pdfBytes)
   * ```
   */
  exportToPdf(report: AuditReport, options?: PdfExportOptions): Uint8Array {
    return generatePdfReport(report, options)
  }

  /**
   * Export transactions to regulatory compliance formats
   *
   * Decrypts and exports transactions in formats required by regulators:
   * - FATF: Financial Action Task Force Travel Rule format
   * - FINCEN: FinCEN Suspicious Activity Report (SAR) format
   * - CSV: Generic comma-separated values format
   *
   * @param params - Export parameters
   * @returns Regulatory export in the specified format
   * @throws {ValidationError} If parameters are invalid
   * @throws {CryptoError} If decryption fails
   *
   * @example
   * ```typescript
   * const reporter = new ComplianceReporter()
   *
   * // FATF Travel Rule export
   * const fatfExport = await reporter.exportForRegulator({
   *   viewingKey: myViewingKey,
   *   transactions: encryptedTxs,
   *   jurisdiction: 'EU',
   *   format: 'FATF',
   *   currency: 'EUR',
   * })
   *
   * // FINCEN SAR export (US only)
   * const fincenExport = await reporter.exportForRegulator({
   *   viewingKey: myViewingKey,
   *   transactions: suspiciousTxs,
   *   jurisdiction: 'US',
   *   format: 'FINCEN',
   * })
   *
   * // CSV export
   * const csvExport = await reporter.exportForRegulator({
   *   viewingKey: myViewingKey,
   *   transactions: encryptedTxs,
   *   jurisdiction: 'SG',
   *   format: 'CSV',
   * })
   * ```
   */
  async exportForRegulator(
    params: ExportForRegulatorParams
  ): Promise<RegulatoryExport> {
    // Validate parameters
    this.validateRegulatoryParams(params)

    // Normalize viewing key
    const viewingKey = this.normalizeViewingKey(params.viewingKey)

    // Decrypt transactions
    const decryptedTransactions = this.decryptTransactions(
      params.transactions,
      viewingKey,
      params.startDate,
      params.endDate
    )

    // Generate report ID
    const reportId = `reg_${generateRandomBytes(16).slice(2)}`

    // Export based on format
    switch (params.format) {
      case 'FATF':
        return this.exportToFATF(
          reportId,
          decryptedTransactions,
          params.jurisdiction,
          params.currency || 'USD'
        )
      case 'FINCEN':
        return this.exportToFINCEN(
          reportId,
          decryptedTransactions,
          params.startDate,
          params.endDate,
          params.currency || 'USD'
        )
      case 'CSV':
        return this.exportToCSV(
          reportId,
          decryptedTransactions,
          params.jurisdiction,
          params.currency || 'USD'
        )
      default:
        throw new ValidationError(
          `unsupported format: ${params.format}`,
          'format',
          { received: params.format },
          ErrorCode.INVALID_INPUT
        )
    }
  }

  /**
   * Validate regulatory export parameters
   */
  private validateRegulatoryParams(params: ExportForRegulatorParams): void {
    if (!params.viewingKey) {
      throw new ValidationError(
        'viewingKey is required',
        'viewingKey',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    if (!params.transactions) {
      throw new ValidationError(
        'transactions array is required',
        'transactions',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    if (!Array.isArray(params.transactions)) {
      throw new ValidationError(
        'transactions must be an array',
        'transactions',
        { received: typeof params.transactions },
        ErrorCode.INVALID_INPUT
      )
    }

    if (!params.jurisdiction) {
      throw new ValidationError(
        'jurisdiction is required',
        'jurisdiction',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    const validJurisdictions = ['US', 'EU', 'UK', 'SG']
    if (!validJurisdictions.includes(params.jurisdiction)) {
      throw new ValidationError(
        `invalid jurisdiction. Must be one of: ${validJurisdictions.join(', ')}`,
        'jurisdiction',
        { received: params.jurisdiction },
        ErrorCode.INVALID_INPUT
      )
    }

    if (!params.format) {
      throw new ValidationError(
        'format is required',
        'format',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    const validFormats = ['FATF', 'FINCEN', 'CSV']
    if (!validFormats.includes(params.format)) {
      throw new ValidationError(
        `invalid format. Must be one of: ${validFormats.join(', ')}`,
        'format',
        { received: params.format },
        ErrorCode.INVALID_INPUT
      )
    }

    // FINCEN is US-only
    if (params.format === 'FINCEN' && params.jurisdiction !== 'US') {
      throw new ValidationError(
        'FINCEN format is only available for US jurisdiction',
        'format',
        { jurisdiction: params.jurisdiction, format: params.format },
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate date range
    if (params.startDate && params.endDate) {
      if (params.startDate > params.endDate) {
        throw new ValidationError(
          'startDate must be before endDate',
          'startDate',
          {
            startDate: params.startDate.toISOString(),
            endDate: params.endDate.toISOString(),
          },
          ErrorCode.INVALID_INPUT
        )
      }
    }
  }

  /**
   * Export to FATF Travel Rule format
   */
  private exportToFATF(
    reportId: string,
    transactions: DecryptedTransaction[],
    jurisdiction: Jurisdiction,
    currency: string
  ): FATFExport {
    const fatfTransactions: FATFTransaction[] = transactions.map((tx) => ({
      originatorAccount: tx.sender,
      beneficiaryAccount: tx.recipient,
      amount: tx.amount,
      currency,
      transactionRef: tx.id,
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
    }))

    return {
      reportId,
      generatedAt: new Date().toISOString(),
      jurisdiction,
      transactions: fatfTransactions,
    }
  }

  /**
   * Export to FINCEN SAR format
   */
  private exportToFINCEN(
    reportId: string,
    transactions: DecryptedTransaction[],
    startDate?: Date,
    endDate?: Date,
    currency: string = 'USD'
  ): FINCENExport {
    // Calculate summary
    let totalAmount = 0n
    for (const tx of transactions) {
      try {
        totalAmount += BigInt(tx.amount)
      } catch (error) {
        // Skip invalid amounts
      }
    }

    // Determine period
    const period = this.determinePeriod(transactions, startDate, endDate)

    // Convert transactions
    const fincenTransactions: FINCENTransaction[] = transactions.map((tx) => ({
      transactionDate: new Date(tx.timestamp * 1000).toISOString(),
      amount: tx.amount,
      currency,
      narrativeSummary: `Transfer from ${tx.sender} to ${tx.recipient}`,
      transactionRef: tx.id,
      parties: {
        sender: tx.sender,
        recipient: tx.recipient,
      },
    }))

    return {
      reportId,
      filingType: 'SAR',
      reportDate: new Date().toISOString(),
      jurisdiction: 'US',
      summary: {
        transactionCount: transactions.length,
        totalAmount: totalAmount.toString(),
        period: {
          start: period.start.toISOString(),
          end: period.end.toISOString(),
        },
      },
      transactions: fincenTransactions,
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(
    reportId: string,
    transactions: DecryptedTransaction[],
    jurisdiction: Jurisdiction,
    currency: string
  ): CSVExport {
    const headers = [
      'Transaction ID',
      'Timestamp',
      'Sender',
      'Recipient',
      'Amount',
      'Currency',
    ]

    const rows = transactions.map((tx) => [
      tx.id,
      new Date(tx.timestamp * 1000).toISOString(),
      tx.sender,
      tx.recipient,
      tx.amount,
      currency,
    ])

    return {
      reportId,
      generatedAt: new Date().toISOString(),
      jurisdiction,
      headers,
      rows,
    }
  }
}
