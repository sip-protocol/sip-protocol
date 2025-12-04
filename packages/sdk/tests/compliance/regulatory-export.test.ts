/**
 * Regulatory Export Tests
 *
 * Tests for exporting transactions to regulatory compliance formats (FATF, FINCEN, CSV).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ComplianceReporter,
  generateViewingKey,
  encryptForViewing,
  type EncryptedTransaction,
  type ViewingKey,
  type FATFExport,
  type FINCENExport,
  type CSVExport,
} from '../../src'

describe('ComplianceReporter - Regulatory Exports', () => {
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

  // ─── FATF Export Tests ────────────────────────────────────────────────────

  describe('FATF Travel Rule Export', () => {
    it('should export to FATF format with all required fields', async () => {
      const result = await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'FATF',
        currency: 'EUR',
      })

      expect(result).toBeDefined()
      expect((result as FATFExport).reportId).toMatch(/^reg_/)
      expect((result as FATFExport).generatedAt).toBeDefined()
      expect((result as FATFExport).jurisdiction).toBe('EU')
      expect((result as FATFExport).transactions).toHaveLength(3)
    })

    it('should include correct transaction details in FATF format', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'UK',
        format: 'FATF',
        currency: 'GBP',
      })) as FATFExport

      const tx = result.transactions[0]
      expect(tx.originatorAccount).toBe('0xalice')
      expect(tx.beneficiaryAccount).toBe('0xbob')
      expect(tx.amount).toBe('1000000')
      expect(tx.currency).toBe('GBP')
      expect(tx.transactionRef).toMatch(/^tx_/)
      expect(tx.timestamp).toBeDefined()
      expect(new Date(tx.timestamp)).toBeInstanceOf(Date)
    })

    it('should use default currency USD if not specified', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'SG',
        format: 'FATF',
      })) as FATFExport

      expect(result.transactions[0].currency).toBe('USD')
    })

    it('should support all jurisdictions for FATF', async () => {
      const jurisdictions = ['US', 'EU', 'UK', 'SG'] as const

      for (const jurisdiction of jurisdictions) {
        const result = await reporter.exportForRegulator({
          viewingKey,
          transactions: [encryptedTransactions[0]],
          jurisdiction,
          format: 'FATF',
        })

        expect((result as FATFExport).jurisdiction).toBe(jurisdiction)
      }
    })

    it('should filter transactions by date range in FATF export', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'FATF',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28'),
      })) as FATFExport

      // Should only include February transaction
      expect(result.transactions).toHaveLength(1)
      expect(result.transactions[0].originatorAccount).toBe('0xcharlie')
    })
  })

  // ─── FINCEN Export Tests ──────────────────────────────────────────────────

  describe('FINCEN SAR Export', () => {
    it('should export to FINCEN format with all required fields', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'US',
        format: 'FINCEN',
        currency: 'USD',
      })) as FINCENExport

      expect(result).toBeDefined()
      expect(result.reportId).toMatch(/^reg_/)
      expect(result.filingType).toBe('SAR')
      expect(result.reportDate).toBeDefined()
      expect(result.jurisdiction).toBe('US')
      expect(result.summary).toBeDefined()
      expect(result.transactions).toHaveLength(3)
    })

    it('should calculate correct summary statistics', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      expect(result.summary.transactionCount).toBe(3)
      expect(result.summary.totalAmount).toBe('4000000') // 1M + 2.5M + 500K
      expect(result.summary.period.start).toBeDefined()
      expect(result.summary.period.end).toBeDefined()
    })

    it('should include transaction details with parties', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      const tx = result.transactions[0]
      expect(tx.transactionDate).toBeDefined()
      expect(tx.amount).toBe('1000000')
      expect(tx.currency).toBe('USD')
      expect(tx.narrativeSummary).toContain('0xalice')
      expect(tx.narrativeSummary).toContain('0xbob')
      expect(tx.transactionRef).toMatch(/^tx_/)
      expect(tx.parties.sender).toBe('0xalice')
      expect(tx.parties.recipient).toBe('0xbob')
    })

    it('should only allow US jurisdiction for FINCEN', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: 'EU',
          format: 'FINCEN',
        })
      ).rejects.toThrow('FINCEN format is only available for US jurisdiction')
    })

    it('should include date range in summary', async () => {
      const startDate = new Date('2025-01-01')
      const endDate = new Date('2025-12-31')

      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'US',
        format: 'FINCEN',
        startDate,
        endDate,
      })) as FINCENExport

      expect(result.summary.period.start).toBe(startDate.toISOString())
      expect(result.summary.period.end).toBe(endDate.toISOString())
    })

    it('should handle single transaction', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      expect(result.summary.transactionCount).toBe(1)
      expect(result.summary.totalAmount).toBe('1000000')
      expect(result.transactions).toHaveLength(1)
    })
  })

  // ─── CSV Export Tests ─────────────────────────────────────────────────────

  describe('CSV Export', () => {
    it('should export to CSV format with headers and rows', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'SG',
        format: 'CSV',
        currency: 'SGD',
      })) as CSVExport

      expect(result).toBeDefined()
      expect(result.reportId).toMatch(/^reg_/)
      expect(result.generatedAt).toBeDefined()
      expect(result.jurisdiction).toBe('SG')
      expect(result.headers).toBeDefined()
      expect(result.rows).toHaveLength(3)
    })

    it('should include correct CSV headers', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'CSV',
      })) as CSVExport

      expect(result.headers).toEqual([
        'Transaction ID',
        'Timestamp',
        'Sender',
        'Recipient',
        'Amount',
        'Currency',
      ])
    })

    it('should format rows correctly', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'UK',
        format: 'CSV',
        currency: 'GBP',
      })) as CSVExport

      const row = result.rows[0]
      expect(row).toHaveLength(6)
      expect(row[0]).toMatch(/^tx_/) // Transaction ID
      expect(row[1]).toBeDefined() // Timestamp
      expect(row[2]).toBe('0xalice') // Sender
      expect(row[3]).toBe('0xbob') // Recipient
      expect(row[4]).toBe('1000000') // Amount
      expect(row[5]).toBe('GBP') // Currency
    })

    it('should support all jurisdictions for CSV', async () => {
      const jurisdictions = ['US', 'EU', 'UK', 'SG'] as const

      for (const jurisdiction of jurisdictions) {
        const result = (await reporter.exportForRegulator({
          viewingKey,
          transactions: [encryptedTransactions[0]],
          jurisdiction,
          format: 'CSV',
        })) as CSVExport

        expect(result.jurisdiction).toBe(jurisdiction)
      }
    })

    it('should handle empty transactions', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [],
        jurisdiction: 'SG',
        format: 'CSV',
      })) as CSVExport

      expect(result.headers).toBeDefined()
      expect(result.rows).toHaveLength(0)
    })
  })

  // ─── Validation Tests ─────────────────────────────────────────────────────

  describe('validation', () => {
    it('should throw on missing viewing key', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey: null as unknown as any,
          transactions: encryptedTransactions,
          jurisdiction: 'US',
          format: 'FATF',
        })
      ).rejects.toThrow('viewingKey is required')
    })

    it('should throw on missing transactions', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: null as unknown as any,
          jurisdiction: 'US',
          format: 'FATF',
        })
      ).rejects.toThrow('transactions array is required')
    })

    it('should throw on non-array transactions', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: 'not-an-array' as unknown as string,
          jurisdiction: 'US',
          format: 'FATF',
        })
      ).rejects.toThrow('transactions must be an array')
    })

    it('should throw on missing jurisdiction', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: null as unknown as any,
          format: 'FATF',
        })
      ).rejects.toThrow('jurisdiction is required')
    })

    it('should throw on invalid jurisdiction', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: 'INVALID' as unknown as string,
          format: 'FATF',
        })
      ).rejects.toThrow('invalid jurisdiction')
    })

    it('should throw on missing format', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: 'US',
          format: null as unknown as any,
        })
      ).rejects.toThrow('format is required')
    })

    it('should throw on invalid format', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: 'US',
          format: 'INVALID' as unknown as string,
        })
      ).rejects.toThrow('invalid format')
    })

    it('should throw on invalid date range', async () => {
      await expect(
        reporter.exportForRegulator({
          viewingKey,
          transactions: encryptedTransactions,
          jurisdiction: 'US',
          format: 'FATF',
          startDate: new Date('2025-12-31'),
          endDate: new Date('2025-01-01'),
        })
      ).rejects.toThrow('startDate must be before endDate')
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle large amounts in all formats', async () => {
      const largeTx = encryptForViewing(
        {
          sender: '0xwhale',
          recipient: '0xexchange',
          amount: '999999999999999999',
          timestamp: Math.floor(Date.now() / 1000),
        },
        viewingKey
      )

      const fatfResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [largeTx],
        jurisdiction: 'EU',
        format: 'FATF',
      })) as FATFExport
      expect(fatfResult.transactions[0].amount).toBe('999999999999999999')

      const fincenResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [largeTx],
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport
      expect(fincenResult.summary.totalAmount).toBe('999999999999999999')

      const csvResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [largeTx],
        jurisdiction: 'SG',
        format: 'CSV',
      })) as CSVExport
      expect(csvResult.rows[0][4]).toBe('999999999999999999')
    })

    it('should handle string viewing key', async () => {
      // Create a new transaction encrypted with string-based key
      const stringKey = '0x' + '01'.repeat(32)
      const { sha256 } = await import('@noble/hashes/sha256')
      const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils')

      const viewingKeyFromString: ViewingKey = {
        key: stringKey,
        path: 'm/0',
        hash: `0x${bytesToHex(sha256(hexToBytes(stringKey.slice(2))))}`,
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

      // Decrypt with string key
      const result = await reporter.exportForRegulator({
        viewingKey: stringKey,
        transactions: [tx],
        jurisdiction: 'EU',
        format: 'FATF',
      })

      expect((result as FATFExport).transactions).toHaveLength(1)
      expect((result as FATFExport).transactions[0].amount).toBe('1000')
    })

    it('should generate unique report IDs', async () => {
      const result1 = await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'FATF',
      })

      const result2 = await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'FATF',
      })

      expect((result1 as FATFExport).reportId).not.toBe(
        (result2 as FATFExport).reportId
      )
    })

    it('should handle different currencies across formats', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'SGD', 'JPY']

      for (const currency of currencies) {
        const fatfResult = (await reporter.exportForRegulator({
          viewingKey,
          transactions: [encryptedTransactions[0]],
          jurisdiction: 'EU',
          format: 'FATF',
          currency,
        })) as FATFExport
        expect(fatfResult.transactions[0].currency).toBe(currency)

        const csvResult = (await reporter.exportForRegulator({
          viewingKey,
          transactions: [encryptedTransactions[0]],
          jurisdiction: 'EU',
          format: 'CSV',
          currency,
        })) as CSVExport
        expect(csvResult.rows[0][5]).toBe(currency)
      }
    })
  })

  // ─── Integration Tests ────────────────────────────────────────────────────

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

      const result = await reporter.exportForRegulator({
        viewingKey: childKey,
        transactions: [tx],
        jurisdiction: 'US',
        format: 'FATF',
      })

      expect((result as FATFExport).transactions).toHaveLength(1)
    })

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

      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: mixedTxs,
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      // Should only include transactions with correct key
      expect(result.transactions).toHaveLength(2)
      expect(result.summary.totalAmount).toBe('4000')
    })

    it('should export same data in different formats', async () => {
      // Export to all three formats
      const fatfResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'EU',
        format: 'FATF',
        currency: 'EUR',
      })) as FATFExport

      const fincenResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'US',
        format: 'FINCEN',
        currency: 'USD',
      })) as FINCENExport

      const csvResult = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'SG',
        format: 'CSV',
        currency: 'SGD',
      })) as CSVExport

      // All should have same core transaction data
      expect(fatfResult.transactions[0].originatorAccount).toBe('0xalice')
      expect(fincenResult.transactions[0].parties.sender).toBe('0xalice')
      expect(csvResult.rows[0][2]).toBe('0xalice')

      expect(fatfResult.transactions[0].amount).toBe('1000000')
      expect(fincenResult.transactions[0].amount).toBe('1000000')
      expect(csvResult.rows[0][4]).toBe('1000000')
    })
  })

  // ─── Format-Specific Features ─────────────────────────────────────────────

  describe('format-specific features', () => {
    it('FATF should support optional originator/beneficiary names', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'EU',
        format: 'FATF',
      })) as FATFExport

      const tx = result.transactions[0]
      // Names are optional in simplified version
      expect(tx.originatorName).toBeUndefined()
      expect(tx.beneficiaryName).toBeUndefined()
      // But accounts are required
      expect(tx.originatorAccount).toBeDefined()
      expect(tx.beneficiaryAccount).toBeDefined()
    })

    it('FINCEN should include narrative summary', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      for (const tx of result.transactions) {
        expect(tx.narrativeSummary).toBeDefined()
        expect(tx.narrativeSummary).toContain('Transfer from')
        expect(tx.narrativeSummary).toContain('to')
      }
    })

    it('FINCEN should support optional suspicious activity indicators', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: [encryptedTransactions[0]],
        jurisdiction: 'US',
        format: 'FINCEN',
      })) as FINCENExport

      const tx = result.transactions[0]
      // Suspicious activity is optional
      expect(tx.suspiciousActivity).toBeUndefined()
    })

    it('CSV should be easy to serialize', async () => {
      const result = (await reporter.exportForRegulator({
        viewingKey,
        transactions: encryptedTransactions,
        jurisdiction: 'EU',
        format: 'CSV',
      })) as CSVExport

      // Should be easily convertible to CSV string
      const csvString = [
        result.headers.join(','),
        ...result.rows.map((row) => row.join(',')),
      ].join('\n')

      expect(csvString).toContain('Transaction ID,Timestamp,Sender')
      expect(csvString).toContain('0xalice')
    })
  })
})
