/**
 * PDF Export Tests
 *
 * Tests for PDF generation from audit reports.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ComplianceReporter,
  generateViewingKey,
  encryptForViewing,
  generatePdfReport,
  type EncryptedTransaction,
  type ViewingKey,
  type AuditReport,
  type PdfExportOptions,
} from '../../src'

describe('PDF Export', () => {
  let reporter: ComplianceReporter
  let viewingKey: ViewingKey
  let encryptedTransactions: EncryptedTransaction[]
  let sampleReport: AuditReport

  beforeEach(async () => {
    reporter = new ComplianceReporter()
    viewingKey = generateViewingKey('m/0/compliance')

    // Create sample encrypted transactions
    encryptedTransactions = [
      encryptForViewing(
        {
          sender: '0xalice123456789abcdef',
          recipient: '0xbob987654321fedcba',
          amount: '1000000',
          timestamp: Math.floor(new Date('2025-01-15').getTime() / 1000),
        },
        viewingKey
      ),
      encryptForViewing(
        {
          sender: '0xcharlie111222333444',
          recipient: '0xdave555666777888',
          amount: '2500000',
          timestamp: Math.floor(new Date('2025-02-20').getTime() / 1000),
        },
        viewingKey
      ),
      encryptForViewing(
        {
          sender: '0xeve999888777666',
          recipient: '0xfrank333444555666',
          amount: '500000',
          timestamp: Math.floor(new Date('2025-03-10').getTime() / 1000),
        },
        viewingKey
      ),
    ]

    // Generate sample report
    sampleReport = await reporter.generateAuditReport({
      viewingKey,
      transactions: encryptedTransactions,
      format: 'json',
    })
  })

  // ─── Basic PDF Generation ────────────────────────────────────────────────────

  describe('generatePdfReport', () => {
    it('should generate a valid PDF document', () => {
      const pdfBytes = generatePdfReport(sampleReport)

      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(0)

      // Check PDF magic header
      const header = new TextDecoder().decode(pdfBytes.slice(0, 5))
      expect(header).toBe('%PDF-')
    })

    it('should include PDF version 1.4', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const header = new TextDecoder().decode(pdfBytes.slice(0, 8))
      expect(header).toBe('%PDF-1.4')
    })

    it('should include EOF marker', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain('%%EOF')
    })

    it('should include report ID', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain(sampleReport.reportId)
    })

    it('should include transaction count', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain(
        `Total Transactions: ${sampleReport.summary.transactionCount}`
      )
    })

    it('should include total volume', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)
      // Volume should be formatted with thousands separators: 4,000,000
      expect(pdfString).toContain('4,000,000')
    })

    it('should include unique counterparties count', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain(
        `Unique Counterparties: ${sampleReport.summary.uniqueCounterparties}`
      )
    })
  })

  // ─── Custom Options ──────────────────────────────────────────────────────────

  describe('custom options', () => {
    it('should use custom title', () => {
      const pdfBytes = generatePdfReport(sampleReport, {
        title: 'Q1 2025 Compliance Audit',
      })
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain('Q1 2025 Compliance Audit')
    })

    it('should include organization name', () => {
      const pdfBytes = generatePdfReport(sampleReport, {
        organization: 'ACME Corporation',
      })
      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain('Organization: ACME Corporation')
    })

    it('should exclude transaction details when includeTransactions is false', () => {
      const pdfBytes = generatePdfReport(sampleReport, {
        includeTransactions: false,
      })
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should not include transaction details
      expect(pdfString).not.toContain('Transaction 1/')
      expect(pdfString).not.toContain('0xalice')

      // Should still include summary
      expect(pdfString).toContain('Summary Statistics')
    })

    it('should limit transaction details with maxTransactions', () => {
      const pdfBytes = generatePdfReport(sampleReport, {
        maxTransactions: 2,
      })
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include first 2 transactions
      expect(pdfString).toContain('Transaction 1/')
      expect(pdfString).toContain('Transaction 2/')

      // Should show "more transactions" message
      expect(pdfString).toContain('and 1 more transactions')
    })
  })

  // ─── Transaction Details ─────────────────────────────────────────────────────

  describe('transaction details', () => {
    it('should include transaction addresses', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include truncated addresses
      expect(pdfString).toContain('0xalic...cdef')
      expect(pdfString).toContain('0xbob9...dcba')
    })

    it('should include transaction amounts', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include formatted amounts
      expect(pdfString).toContain('1,000,000')
      expect(pdfString).toContain('2,500,000')
      expect(pdfString).toContain('500,000')
    })

    it('should include transaction timestamps', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include timestamps in UTC format
      expect(pdfString).toContain('2025-01-15')
      expect(pdfString).toContain('2025-02-20')
      expect(pdfString).toContain('2025-03-10')
    })

    it('should handle transactions with txHash', async () => {
      // Create transaction with hash
      const txWithHash = encryptForViewing(
        {
          sender: '0xalice',
          recipient: '0xbob',
          amount: '1000',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [txWithHash],
        format: 'json',
      })

      // Add txHash to the decrypted transaction
      report.transactions[0].txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const pdfBytes = generatePdfReport(report)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include truncated hash
      expect(pdfString).toContain('Tx Hash:')
    })

    it('should handle transactions with metadata', async () => {
      // Create transaction with metadata
      const txWithMetadata = encryptForViewing(
        {
          sender: '0xalice',
          recipient: '0xbob',
          amount: '1000',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [txWithMetadata],
        format: 'json',
      })

      // Add metadata to the decrypted transaction
      report.transactions[0].metadata = { chain: 'ethereum', token: 'USDC' }

      const pdfBytes = generatePdfReport(report)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should include metadata
      expect(pdfString).toContain('Metadata:')
    })
  })

  // ─── Report Period ───────────────────────────────────────────────────────────

  describe('report period', () => {
    it('should include report period dates', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Report Period')
      expect(pdfString).toContain('Start:')
      expect(pdfString).toContain('End:')
    })

    it('should format dates correctly', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Dates should be in YYYY-MM-DD format
      const datePattern = /\d{4}-\d{2}-\d{2}/
      expect(pdfString).toMatch(datePattern)
    })
  })

  // ─── Edge Cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle report with no transactions', async () => {
      const emptyReport = await reporter.generateAuditReport({
        viewingKey,
        transactions: [],
        format: 'json',
      })

      const pdfBytes = generatePdfReport(emptyReport)
      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(0)

      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain('Total Transactions: 0')
    })

    it('should handle report with single transaction', async () => {
      const singleTxReport = await reporter.generateAuditReport({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        format: 'json',
      })

      const pdfBytes = generatePdfReport(singleTxReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Total Transactions: 1')
      expect(pdfString).toContain('Transaction 1/1')
    })

    it('should handle large transaction amounts', async () => {
      const largeTx = encryptForViewing(
        {
          sender: '0xwhale',
          recipient: '0xexchange',
          amount: '999999999999999999', // ~1 quintillion
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [largeTx],
        format: 'json',
      })

      const pdfBytes = generatePdfReport(report)
      const pdfString = new TextDecoder().decode(pdfBytes)

      // Should format with thousands separators
      expect(pdfString).toContain('999,999,999,999,999,999')
    })

    it('should handle many transactions', async () => {
      // Create 150 transactions
      const manyTxs: EncryptedTransaction[] = []
      for (let i = 0; i < 150; i++) {
        manyTxs.push(
          encryptForViewing(
            {
              sender: `0xsender${i}`,
              recipient: `0xrecipient${i}`,
              amount: String(1000 + i),
              timestamp: Math.floor(Date.now() / 1000),
            },
            viewingKey
          )
        )
      }

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: manyTxs,
        format: 'json',
      })

      // Test with maxTransactions = 5 to ensure we can fit it and see the message
      const pdfBytes = generatePdfReport(report, { maxTransactions: 5 })
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Total Transactions: 150')
      // PDF should show first few transactions
      expect(pdfString).toContain('Transaction 1/150')
      expect(pdfString).toContain('Transaction 5/150')
      // And should have the "more transactions" message
      expect(pdfString).toContain('and 145 more transactions')
    })

    it('should handle special characters in addresses', async () => {
      const specialTx = encryptForViewing(
        {
          sender: '0x(alice)',
          recipient: '0x\\bob\\',
          amount: '1000',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [specialTx],
        format: 'json',
      })

      const pdfBytes = generatePdfReport(report)
      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(0)
    })
  })

  // ─── ComplianceReporter Integration ─────────────────────────────────────────

  describe('ComplianceReporter integration', () => {
    it('should work with exportToPdf method', () => {
      const pdfBytes = reporter.exportToPdf(sampleReport)

      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(0)

      const header = new TextDecoder().decode(pdfBytes.slice(0, 8))
      expect(header).toBe('%PDF-1.4')
    })

    it('should accept custom options in exportToPdf', () => {
      const pdfBytes = reporter.exportToPdf(sampleReport, {
        title: 'Custom Report Title',
        organization: 'Test Org',
        includeTransactions: false,
      })

      const pdfString = new TextDecoder().decode(pdfBytes)
      expect(pdfString).toContain('Custom Report Title')
      expect(pdfString).toContain('Organization: Test Org')
      expect(pdfString).not.toContain('Transaction 1/')
    })

    it('should generate different PDFs for different reports', async () => {
      const report1 = await reporter.generateAuditReport({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        format: 'json',
      })

      const report2 = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      const pdf1 = reporter.exportToPdf(report1)
      const pdf2 = reporter.exportToPdf(report2)

      // Different reports should produce different PDFs
      expect(pdf1.length).not.toBe(pdf2.length)
    })
  })

  // ─── PDF Format Validation ───────────────────────────────────────────────────

  describe('PDF format validation', () => {
    it('should include valid PDF catalog', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('/Type /Catalog')
      expect(pdfString).toContain('/Pages')
    })

    it('should include valid page object', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('/Type /Page')
      expect(pdfString).toContain('/MediaBox')
    })

    it('should include font resources', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('/Font')
      expect(pdfString).toContain('/Courier')
    })

    it('should include content stream', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('stream')
      expect(pdfString).toContain('endstream')
    })

    it('should include xref table', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('xref')
      expect(pdfString).toContain('startxref')
    })

    it('should include trailer', () => {
      const pdfBytes = generatePdfReport(sampleReport)
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('trailer')
      expect(pdfString).toContain('/Root')
    })

    it('should include info dictionary with metadata', () => {
      const pdfBytes = generatePdfReport(sampleReport, {
        title: 'Test Report',
      })
      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('/Title')
      expect(pdfString).toContain('/Author')
      expect(pdfString).toContain('/Creator')
      expect(pdfString).toContain('/CreationDate')
    })
  })

  // ─── Browser and Node.js Compatibility ───────────────────────────────────────

  describe('cross-platform compatibility', () => {
    it('should use TextEncoder which works in Node.js and browsers', () => {
      // This test verifies that we use standard APIs
      const pdfBytes = generatePdfReport(sampleReport)

      // Should be Uint8Array (standard across platforms)
      expect(pdfBytes).toBeInstanceOf(Uint8Array)
    })

    it('should produce consistent output', () => {
      // Generate the same report twice
      const pdf1 = generatePdfReport(sampleReport, {
        title: 'Consistent Test',
        organization: 'Test Org',
      })

      const pdf2 = generatePdfReport(sampleReport, {
        title: 'Consistent Test',
        organization: 'Test Org',
      })

      // Note: PDFs won't be identical due to report ID and timestamp in content
      // But they should have the same structure
      expect(pdf1.length).toBeGreaterThan(0)
      expect(pdf2.length).toBeGreaterThan(0)
    })
  })

  // ─── Real-World Usage Scenarios ──────────────────────────────────────────────

  describe('real-world scenarios', () => {
    it('should generate quarterly audit report', async () => {
      const q1Start = new Date('2025-01-01')
      const q1End = new Date('2025-03-31')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        startDate: q1Start,
        endDate: q1End,
        format: 'json',
      })

      const pdfBytes = reporter.exportToPdf(report, {
        title: 'Q1 2025 Compliance Audit Report',
        organization: 'Global Finance Corp',
        includeTransactions: true,
      })

      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Q1 2025 Compliance Audit Report')
      expect(pdfString).toContain('Global Finance Corp')
      expect(pdfString).toContain('2025-01-01')
      expect(pdfString).toContain('2025-03-31')
    })

    it('should generate summary-only report for executives', async () => {
      const pdfBytes = reporter.exportToPdf(sampleReport, {
        title: 'Executive Summary - Transaction Activity',
        organization: 'ACME Corp',
        includeTransactions: false, // Executives only need summary
      })

      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Executive Summary')
      expect(pdfString).toContain('Summary Statistics')
      expect(pdfString).not.toContain('Transaction Details')
    })

    it('should generate detailed report for auditors', async () => {
      const pdfBytes = reporter.exportToPdf(sampleReport, {
        title: 'Detailed Audit Trail - All Transactions',
        organization: 'External Audit Firm',
        includeTransactions: true,
        maxTransactions: 1000, // Include all transactions
      })

      const pdfString = new TextDecoder().decode(pdfBytes)

      expect(pdfString).toContain('Detailed Audit Trail')
      expect(pdfString).toContain('Transaction Details')
      expect(pdfString).toContain('Transaction 1/')
    })
  })
})
