/**
 * Compliance Reporter Tests
 *
 * Tests for audit report generation from encrypted transactions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ComplianceReporter,
  generateViewingKey,
  encryptForViewing,
  type EncryptedTransaction,
  type ViewingKey,
  type GenerateAuditReportParams,
  type DecryptedTransaction,
  type AuditReport,
} from '../../src'

describe('ComplianceReporter', () => {
  let reporter: ComplianceReporter
  let viewingKey: ViewingKey
  let encryptedTransactions: EncryptedTransaction[]

  beforeEach(() => {
    reporter = new ComplianceReporter()
    viewingKey = generateViewingKey('m/0/compliance')

    // Create sample encrypted transactions
    encryptedTransactions = [
      encryptForViewing(
        {
          sender: '0xalice',
          recipient: '0xbob',
          amount: '1000000',
          timestamp: Math.floor(new Date('2025-01-15').getTime() / 1000),
        },
        viewingKey
      ),
      encryptForViewing(
        {
          sender: '0xcharlie',
          recipient: '0xdave',
          amount: '2500000',
          timestamp: Math.floor(new Date('2025-02-20').getTime() / 1000),
        },
        viewingKey
      ),
      encryptForViewing(
        {
          sender: '0xeve',
          recipient: '0xfrank',
          amount: '500000',
          timestamp: Math.floor(new Date('2025-03-10').getTime() / 1000),
        },
        viewingKey
      ),
    ]
  })

  // ─── Basic Report Generation ─────────────────────────────────────────────────

  describe('generateAuditReport', () => {
    it('should generate a report with all transactions', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      expect(report).toBeDefined()
      expect(report.reportId).toMatch(/^audit_/)
      expect(report.generatedAt).toBeInstanceOf(Date)
      expect(report.transactions).toHaveLength(3)
      expect(report.summary.transactionCount).toBe(3)
    })

    it('should decrypt transactions correctly', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      const tx = report.transactions[0]
      expect(tx.sender).toBe('0xalice')
      expect(tx.recipient).toBe('0xbob')
      expect(tx.amount).toBe('1000000')
      expect(tx.timestamp).toBeDefined()
    })

    it('should calculate total volume correctly', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      // 1000000 + 2500000 + 500000 = 4000000
      expect(report.summary.totalVolume).toBe(4000000n)
    })

    it('should count unique counterparties correctly', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      // alice, bob, charlie, dave, eve, frank = 6 unique
      expect(report.summary.uniqueCounterparties).toBe(6)
    })

    it('should include report period', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      expect(report.period).toBeDefined()
      expect(report.period.start).toBeInstanceOf(Date)
      expect(report.period.end).toBeInstanceOf(Date)
      expect(report.period.start.getTime()).toBeLessThanOrEqual(
        report.period.end.getTime()
      )
    })
  })

  // ─── Date Filtering ──────────────────────────────────────────────────────────

  describe('date filtering', () => {
    it('should filter by start date', async () => {
      const startDate = new Date('2025-02-01')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        startDate,
        format: 'json',
      })

      // Should only include transactions from Feb and Mar
      expect(report.transactions).toHaveLength(2)
      expect(report.summary.transactionCount).toBe(2)
    })

    it('should filter by end date', async () => {
      const endDate = new Date('2025-02-28')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        endDate,
        format: 'json',
      })

      // Should only include transactions from Jan and Feb
      expect(report.transactions).toHaveLength(2)
      expect(report.summary.transactionCount).toBe(2)
    })

    it('should filter by date range', async () => {
      const startDate = new Date('2025-02-01')
      const endDate = new Date('2025-02-28')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        startDate,
        endDate,
        format: 'json',
      })

      // Should only include Feb transaction
      expect(report.transactions).toHaveLength(1)
      expect(report.summary.transactionCount).toBe(1)
      expect(report.transactions[0].sender).toBe('0xcharlie')
    })

    it('should use provided dates for report period', async () => {
      const startDate = new Date('2025-01-01')
      const endDate = new Date('2025-12-31')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        startDate,
        endDate,
        format: 'json',
      })

      expect(report.period.start).toEqual(startDate)
      expect(report.period.end).toEqual(endDate)
    })
  })

  // ─── String Viewing Key ──────────────────────────────────────────────────────

  describe('string viewing key', () => {
    it('should accept viewing key as string for transactions encrypted with same hash', async () => {
      // When using string key, we need to ensure the hash matches
      // In practice, users should use the full ViewingKey object
      // This test demonstrates that string keys work if properly constructed

      // Create a viewing key from string
      const stringKey = '0x' + '01'.repeat(32)
      const viewingKeyFromString: ViewingKey = {
        key: stringKey,
        path: 'm/0',
        hash: `0x${require('@noble/hashes/utils').bytesToHex(
          require('@noble/hashes/sha256').sha256(
            require('@noble/hashes/utils').hexToBytes(stringKey.slice(2))
          )
        )}`,
      }

      // Encrypt with this viewing key
      const tx = encryptForViewing(
        {
          sender: '0xtest',
          recipient: '0xdest',
          amount: '1000',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKeyFromString
      )

      // Should be able to decrypt with the string key
      const report = await reporter.generateAuditReport({
        viewingKey: stringKey,
        transactions: [tx],
        format: 'json',
      })

      expect(report.transactions).toHaveLength(1)
      expect(report.transactions[0].amount).toBe('1000')
    })
  })

  // ─── Empty and Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty transaction array', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [],
        format: 'json',
      })

      expect(report.transactions).toHaveLength(0)
      expect(report.summary.transactionCount).toBe(0)
      expect(report.summary.totalVolume).toBe(0n)
      expect(report.summary.uniqueCounterparties).toBe(0)
    })

    it('should handle single transaction', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        format: 'json',
      })

      expect(report.transactions).toHaveLength(1)
      expect(report.summary.transactionCount).toBe(1)
      expect(report.summary.totalVolume).toBe(1000000n)
    })

    it('should handle transactions with same sender/recipient', async () => {
      const samePartyTxs = [
        encryptForViewing(
          {
            sender: '0xalice',
            recipient: '0xbob',
            amount: '100',
            timestamp: Math.floor(Date.now() / 1000),
          },
          viewingKey
        ),
        encryptForViewing(
          {
            sender: '0xalice',
            recipient: '0xbob',
            amount: '200',
            timestamp: Math.floor(Date.now() / 1000),
          },
          viewingKey
        ),
      ]

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: samePartyTxs,
        format: 'json',
      })

      expect(report.summary.uniqueCounterparties).toBe(2) // alice and bob
      expect(report.summary.totalVolume).toBe(300n)
    })

    it('should handle large amounts', async () => {
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

      expect(report.summary.totalVolume).toBe(999999999999999999n)
    })
  })

  // ─── Validation Tests ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('should throw on missing viewing key', async () => {
      await expect(
        reporter.generateAuditReport({
          viewingKey: null as unknown as any,
          transactions: encryptedTransactions,
          format: 'json',
        })
      ).rejects.toThrow('viewingKey is required')
    })

    it('should throw on missing transactions', async () => {
      await expect(
        reporter.generateAuditReport({
          viewingKey,
          transactions: null as unknown as any,
          format: 'json',
        })
      ).rejects.toThrow('transactions array is required')
    })

    it('should throw on non-array transactions', async () => {
      await expect(
        reporter.generateAuditReport({
          viewingKey,
          transactions: 'not-an-array' as unknown as string,
          format: 'json',
        })
      ).rejects.toThrow('transactions must be an array')
    })

    it('should throw on unsupported format', async () => {
      await expect(
        reporter.generateAuditReport({
          viewingKey,
          transactions: encryptedTransactions,
          format: 'xml' as unknown as string,
        })
      ).rejects.toThrow('only JSON and PDF formats are supported')
    })

    it('should throw on invalid date range', async () => {
      await expect(
        reporter.generateAuditReport({
          viewingKey,
          transactions: encryptedTransactions,
          startDate: new Date('2025-12-31'),
          endDate: new Date('2025-01-01'),
          format: 'json',
        })
      ).rejects.toThrow('startDate must be before endDate')
    })

    it('should throw on wrong viewing key', async () => {
      const wrongKey = generateViewingKey('m/0/wrong')

      await expect(
        reporter.generateAuditReport({
          viewingKey: wrongKey,
          transactions: encryptedTransactions,
          format: 'json',
        })
      ).rejects.toThrow(/Failed to decrypt any transactions/)
    })
  })

  // ─── Report Structure Tests ──────────────────────────────────────────────────

  describe('report structure', () => {
    it('should include all required fields', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      expect(report).toHaveProperty('reportId')
      expect(report).toHaveProperty('generatedAt')
      expect(report).toHaveProperty('period')
      expect(report).toHaveProperty('transactions')
      expect(report).toHaveProperty('summary')

      expect(report.period).toHaveProperty('start')
      expect(report.period).toHaveProperty('end')

      expect(report.summary).toHaveProperty('totalVolume')
      expect(report.summary).toHaveProperty('transactionCount')
      expect(report.summary).toHaveProperty('uniqueCounterparties')
    })

    it('should have valid transaction structure', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      const tx = report.transactions[0]
      expect(tx).toHaveProperty('id')
      expect(tx).toHaveProperty('sender')
      expect(tx).toHaveProperty('recipient')
      expect(tx).toHaveProperty('amount')
      expect(tx).toHaveProperty('timestamp')

      expect(typeof tx.id).toBe('string')
      expect(typeof tx.sender).toBe('string')
      expect(typeof tx.recipient).toBe('string')
      expect(typeof tx.amount).toBe('string')
      expect(typeof tx.timestamp).toBe('number')
    })

    it('should generate unique report IDs', async () => {
      const report1 = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      const report2 = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      expect(report1.reportId).not.toBe(report2.reportId)
    })

    it('should be JSON serializable', async () => {
      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        format: 'json',
      })

      // Should not throw
      const json = JSON.stringify(report, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
      expect(json).toBeDefined()

      // Should be parseable
      const parsed = JSON.parse(json)
      expect(parsed.reportId).toBe(report.reportId)
    })
  })

  // ─── Summary Statistics Tests ────────────────────────────────────────────────

  describe('summary statistics', () => {
    it('should calculate volume from multiple transactions', async () => {
      const txs = [
        encryptForViewing(
          { sender: '0xa', recipient: '0xb', amount: '100', timestamp: 1000 },
          viewingKey
        ),
        encryptForViewing(
          { sender: '0xc', recipient: '0xd', amount: '200', timestamp: 2000 },
          viewingKey
        ),
        encryptForViewing(
          { sender: '0xe', recipient: '0xf', amount: '300', timestamp: 3000 },
          viewingKey
        ),
      ]

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: txs,
        format: 'json',
      })

      expect(report.summary.totalVolume).toBe(600n)
    })

    it('should handle zero amounts', async () => {
      const zeroTx = encryptForViewing(
        {
          sender: '0xalice',
          recipient: '0xbob',
          amount: '0',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: [zeroTx],
        format: 'json',
      })

      expect(report.summary.totalVolume).toBe(0n)
      expect(report.summary.transactionCount).toBe(1)
    })

    it('should count all unique addresses', async () => {
      // Create transactions with overlapping addresses
      const txs = [
        encryptForViewing(
          { sender: '0xa', recipient: '0xb', amount: '100', timestamp: 1000 },
          viewingKey
        ),
        encryptForViewing(
          { sender: '0xb', recipient: '0xc', amount: '200', timestamp: 2000 },
          viewingKey
        ),
        encryptForViewing(
          { sender: '0xc', recipient: '0xa', amount: '300', timestamp: 3000 },
          viewingKey
        ),
      ]

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: txs,
        format: 'json',
      })

      // Should count a, b, c = 3 unique addresses
      expect(report.summary.uniqueCounterparties).toBe(3)
    })
  })

  // ─── Partial Decryption Tests ────────────────────────────────────────────────

  describe('partial decryption', () => {
    it('should handle mix of valid and invalid transactions', async () => {
      const wrongKey = generateViewingKey('m/0/wrong')
      const mixedTxs = [
        encryptForViewing(
          {
            sender: '0xalice',
            recipient: '0xbob',
            amount: '1000',
            timestamp: Math.floor(Date.now() / 1000),
          },
          viewingKey
        ),
        encryptForViewing(
          {
            sender: '0xcharlie',
            recipient: '0xdave',
            amount: '2000',
            timestamp: Math.floor(Date.now() / 1000),
          },
          wrongKey
        ),
        encryptForViewing(
          {
            sender: '0xeve',
            recipient: '0xfrank',
            amount: '3000',
            timestamp: Math.floor(Date.now() / 1000),
          },
          viewingKey
        ),
      ]

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: mixedTxs,
        format: 'json',
      })

      // Should decrypt only the 2 transactions with correct key
      expect(report.transactions).toHaveLength(2)
      expect(report.summary.totalVolume).toBe(4000n)
    })
  })

  // ─── Integration Tests ───────────────────────────────────────────────────────

  describe('integration', () => {
    it('should work with derived viewing keys', async () => {
      const masterKey = generateViewingKey('m/0')
      const { deriveViewingKey } = await import('../../src/privacy')
      const childKey = deriveViewingKey(masterKey, 'auditor/1')

      const tx = encryptForViewing(
        {
          sender: '0xalice',
          recipient: '0xbob',
          amount: '1000',
          timestamp: Math.floor(Date.now() / 1000),
        },
        childKey
      )

      const report = await reporter.generateAuditReport({
        viewingKey: childKey,
        transactions: [tx],
        format: 'json',
      })

      expect(report.transactions).toHaveLength(1)
      expect(report.transactions[0].amount).toBe('1000')
    })

    it('should handle real-world date ranges', async () => {
      const q1Start = new Date('2025-01-01')
      const q1End = new Date('2025-03-31')

      const report = await reporter.generateAuditReport({
        viewingKey,
        transactions: encryptedTransactions,
        startDate: q1Start,
        endDate: q1End,
        format: 'json',
      })

      expect(report.period.start).toEqual(q1Start)
      expect(report.period.end).toEqual(q1End)
      expect(report.transactions.length).toBeGreaterThan(0)
    })
  })
})
