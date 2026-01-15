/**
 * Fireblocks Viewing Key Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FireblocksViewingKeyClient,
  FireblocksError,
  FireblocksErrorCode,
  createFireblocksClient,
} from '../../src/compliance/fireblocks'
import type { ViewingKey, EncryptedTransaction, HexString } from '@sip-protocol/types'

describe('FireblocksViewingKeyClient', () => {
  const testConfig = {
    apiKey: 'test-api-key-12345',
    secretKey: 'test-secret-key',
    vaultAccountId: 'vault-001',
    sandbox: true,
  }

  const testViewingKey: ViewingKey = {
    key: '0x' + 'ab'.repeat(32) as HexString,
    path: "m/44'/1234'/0'/0",
    hash: '0x' + 'cd'.repeat(32) as HexString,
  }

  let client: FireblocksViewingKeyClient

  beforeEach(() => {
    client = createFireblocksClient(testConfig)
  })

  describe('createFireblocksClient', () => {
    it('should create a client with config', () => {
      const client = createFireblocksClient(testConfig)
      expect(client).toBeInstanceOf(FireblocksViewingKeyClient)
    })

    it('should support sandbox mode', () => {
      const client = createFireblocksClient({ ...testConfig, sandbox: true })
      expect(client).toBeInstanceOf(FireblocksViewingKeyClient)
    })

    it('should support custom base URL', () => {
      const client = createFireblocksClient({
        ...testConfig,
        baseUrl: 'https://custom.fireblocks.io',
      })
      expect(client).toBeInstanceOf(FireblocksViewingKeyClient)
    })
  })

  describe('verifyConnection', () => {
    it('should verify connection with valid config', async () => {
      const connected = await client.verifyConnection()
      expect(connected).toBe(true)
    })

    it('should fail with invalid config', async () => {
      const invalidClient = createFireblocksClient({
        apiKey: '',
        secretKey: '',
        vaultAccountId: '',
      })
      const connected = await invalidClient.verifyConnection()
      expect(connected).toBe(false)
    })
  })

  describe('registerViewingKey', () => {
    it('should register a viewing key', async () => {
      const registration = await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Test Auditor',
        scope: {
          transactionTypes: ['transfer', 'swap'],
        },
      })

      expect(registration.id).toMatch(/^reg_/)
      expect(registration.auditorName).toBe('Test Auditor')
      expect(registration.status).toBe('active')
      expect(registration.vaultAccountId).toBe(testConfig.vaultAccountId)
    })

    it('should include scope in registration', async () => {
      const scope = {
        transactionTypes: ['transfer' as const],
        chains: ['solana', 'ethereum'],
        minAmount: 1000n,
        maxAmount: 1000000n,
      }

      const registration = await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Scoped Auditor',
        scope,
      })

      expect(registration.scope).toEqual(scope)
    })

    it('should support expiration date', async () => {
      const expiresAt = new Date('2026-12-31')

      const registration = await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Expiring Auditor',
        scope: {},
        expiresAt,
      })

      expect(registration.expiresAt).toEqual(expiresAt)
    })

    it('should reject invalid viewing key', async () => {
      const invalidKey = { key: 'invalid', path: '', hash: '' } as unknown as ViewingKey

      await expect(
        client.registerViewingKey({
          viewingKey: invalidKey,
          auditorName: 'Invalid',
          scope: {},
        })
      ).rejects.toThrow(FireblocksError)
    })

    it('should reject invalid scope', async () => {
      await expect(
        client.registerViewingKey({
          viewingKey: testViewingKey,
          auditorName: 'Invalid Scope',
          scope: {
            startDate: new Date('2026-12-31'),
            endDate: new Date('2025-01-01'), // End before start
          },
        })
      ).rejects.toThrow(FireblocksError)
    })

    it('should prevent duplicate registration', async () => {
      await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'First',
        scope: {},
      })

      await expect(
        client.registerViewingKey({
          viewingKey: testViewingKey,
          auditorName: 'Duplicate',
          scope: {},
        })
      ).rejects.toThrow('already registered')
    })
  })

  describe('getRegistration', () => {
    it('should retrieve a registration by ID', async () => {
      const registration = await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Test',
        scope: {},
      })

      const retrieved = client.getRegistration(registration.id)
      expect(retrieved).toEqual(registration)
    })

    it('should return null for unknown ID', () => {
      const result = client.getRegistration('unknown-id')
      expect(result).toBeNull()
    })
  })

  describe('listRegistrations', () => {
    it('should list all registrations for vault', async () => {
      await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Auditor 1',
        scope: {},
      })

      // Different viewing key for second registration
      const viewingKey2: ViewingKey = {
        key: '0x' + 'ef'.repeat(32) as HexString,
        path: "m/44'/1234'/0'/1",
        hash: '0x' + '12'.repeat(32) as HexString,
      }

      await client.registerViewingKey({
        viewingKey: viewingKey2,
        auditorName: 'Auditor 2',
        scope: {},
      })

      const registrations = client.listRegistrations()
      expect(registrations).toHaveLength(2)
    })
  })

  describe('revokeRegistration', () => {
    it('should revoke a registration', async () => {
      const registration = await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'To Revoke',
        scope: {},
      })

      await client.revokeRegistration(registration.id, 'No longer needed')

      const retrieved = client.getRegistration(registration.id)
      expect(retrieved?.status).toBe('revoked')
    })

    it('should fail for unknown registration', async () => {
      await expect(
        client.revokeRegistration('unknown-id', 'reason')
      ).rejects.toThrow('not found')
    })
  })

  describe('exportTransactionHistory', () => {
    const mockEncryptedTransactions: EncryptedTransaction[] = []

    beforeEach(async () => {
      // Register viewing key first
      await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Export Test',
        scope: {},
      })
    })

    it('should export as JSON', async () => {
      const exportResult = await client.exportTransactionHistory(
        {
          viewingKey: testViewingKey,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          format: 'json',
        },
        mockEncryptedTransactions
      )

      expect(exportResult.id).toMatch(/^exp_/)
      expect(exportResult.format).toBe('json')
      expect(exportResult.checksum).toMatch(/^0x/)
    })

    it('should export as CSV', async () => {
      const exportResult = await client.exportTransactionHistory(
        {
          viewingKey: testViewingKey,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          format: 'csv',
        },
        mockEncryptedTransactions
      )

      expect(exportResult.format).toBe('csv')
      expect(typeof exportResult.data).toBe('string')
    })

    it('should export as PDF', async () => {
      const exportResult = await client.exportTransactionHistory(
        {
          viewingKey: testViewingKey,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          format: 'pdf',
        },
        mockEncryptedTransactions
      )

      expect(exportResult.format).toBe('pdf')
      // PDF is base64 encoded
      expect(typeof exportResult.data).toBe('string')
    })

    it('should reject unregistered viewing key', async () => {
      const unregisteredKey: ViewingKey = {
        key: '0x' + '99'.repeat(32) as HexString,
        path: "m/44'/1234'/0'/9",
        hash: '0x' + '88'.repeat(32) as HexString,
      }

      await expect(
        client.exportTransactionHistory(
          {
            viewingKey: unregisteredKey,
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31'),
            format: 'json',
          },
          mockEncryptedTransactions
        )
      ).rejects.toThrow('not registered')
    })
  })

  describe('generateComplianceReport', () => {
    beforeEach(async () => {
      await client.registerViewingKey({
        viewingKey: testViewingKey,
        auditorName: 'Report Test',
        scope: {},
      })
    })

    it('should generate transaction summary report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'transaction_summary',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      expect(report.id).toMatch(/^rpt_/)
      expect(report.type).toBe('transaction_summary')
      expect(report.summary).toBeDefined()
    })

    it('should generate audit trail report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'audit_trail',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      expect(report.type).toBe('audit_trail')
    })

    it('should generate risk assessment report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'risk_assessment',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      expect(report.type).toBe('risk_assessment')
      const data = report.data as Record<string, unknown>
      expect(data.distribution).toBeDefined()
    })

    it('should generate regulatory filing report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'regulatory_filing',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      expect(report.type).toBe('regulatory_filing')
    })

    it('should generate tax report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'tax_report',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      expect(report.type).toBe('tax_report')
      const data = report.data as Record<string, unknown>
      expect(data.disclaimer).toBeDefined()
    })

    it('should retrieve generated report', async () => {
      const report = await client.generateComplianceReport(
        {
          viewingKey: testViewingKey,
          reportType: 'transaction_summary',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-12-31'),
          format: 'json',
        },
        []
      )

      const retrieved = client.getReport(report.id)
      expect(retrieved).toEqual(report)
    })
  })

  describe('FireblocksError', () => {
    it('should create error with code', () => {
      const error = new FireblocksError(
        'Test error',
        FireblocksErrorCode.API_ERROR,
        500,
        { extra: 'info' }
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe(FireblocksErrorCode.API_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual({ extra: 'info' })
    })

    it('should have all error codes', () => {
      expect(FireblocksErrorCode.AUTHENTICATION_FAILED).toBeDefined()
      expect(FireblocksErrorCode.INVALID_VIEWING_KEY).toBeDefined()
      expect(FireblocksErrorCode.REGISTRATION_FAILED).toBeDefined()
      expect(FireblocksErrorCode.EXPORT_FAILED).toBeDefined()
      expect(FireblocksErrorCode.DECRYPTION_FAILED).toBeDefined()
      expect(FireblocksErrorCode.API_ERROR).toBeDefined()
      expect(FireblocksErrorCode.RATE_LIMITED).toBeDefined()
      expect(FireblocksErrorCode.TIMEOUT).toBeDefined()
      expect(FireblocksErrorCode.INVALID_SCOPE).toBeDefined()
    })
  })
})
