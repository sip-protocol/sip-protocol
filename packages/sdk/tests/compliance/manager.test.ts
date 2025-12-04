/**
 * ComplianceManager Dashboard API Tests
 *
 * Tests for dashboard data API methods:
 * - getAuditorList()
 * - getPendingDisclosures()
 * - getDisclosureHistory()
 * - getComplianceMetrics()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceManager } from '../../src/compliance/compliance-manager'
import type {
  AuditorRegistration,
  DisclosureRequest,
  DisclosedTransaction,
  ComplianceMetrics,
  ShieldedPayment,
} from '@sip-protocol/types'
import { PrivacyLevel } from '@sip-protocol/types'

describe('ComplianceManager - Dashboard API', () => {
  let manager: ComplianceManager

  beforeEach(async () => {
    manager = await ComplianceManager.create({
      organizationName: 'Test Compliance Corp',
      riskThreshold: 70,
      highValueThreshold: 100000_000000n,
    })
  })

  // ─── getAuditorList() ────────────────────────────────────────────────────────

  describe('getAuditorList()', () => {
    it('should return empty array when no auditors registered', () => {
      const auditors = manager.getAuditorList()
      expect(auditors).toEqual([])
      expect(auditors).toHaveLength(0)
    })

    it('should return all registered auditors', async () => {
      // Register auditors
      const auditor1 = await manager.registerAuditor(
        {
          organization: 'Big Four Audit',
          contactName: 'John Auditor',
          contactEmail: 'john@bigfour.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin1'
      )

      const auditor2 = await manager.registerAuditor(
        {
          organization: 'Tax Authority',
          contactName: 'Jane Tax',
          contactEmail: 'jane@tax.gov',
          publicKey: '0x' + '22'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['solana'],
            tokens: [],
            startDate: Date.now() / 1000 - 180 * 24 * 60 * 60,
          },
          role: 'auditor',
        },
        'admin2'
      )

      const auditors = manager.getAuditorList()
      expect(auditors).toHaveLength(2)
      expect(auditors).toContainEqual(auditor1)
      expect(auditors).toContainEqual(auditor2)
    })

    it('should return both active and inactive auditors', async () => {
      // Register 2 auditors
      const auditor1 = await manager.registerAuditor(
        {
          organization: 'Active Auditor',
          contactName: 'Active',
          contactEmail: 'active@test.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      const auditor2 = await manager.registerAuditor(
        {
          organization: 'Will Be Inactive',
          contactName: 'Inactive',
          contactEmail: 'inactive@test.com',
          publicKey: '0x' + '22'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Deactivate one
      manager.deactivateAuditor(auditor2.auditorId, 'admin', 'Testing')

      const auditors = manager.getAuditorList()
      expect(auditors).toHaveLength(2)
      expect(auditors.find(a => a.auditorId === auditor1.auditorId)?.isActive).toBe(true)
      expect(auditors.find(a => a.auditorId === auditor2.auditorId)?.isActive).toBe(false)
    })

    it('should return auditors with all expected fields', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit Firm',
          contactName: 'Test Auditor',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '33'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: ['USDC', 'USDT'],
            startDate: Date.now() / 1000 - 30 * 24 * 60 * 60,
            minAmount: 1000_000000n,
          },
          role: 'auditor',
        },
        'admin'
      )

      const auditors = manager.getAuditorList()
      expect(auditors).toHaveLength(1)

      const returned = auditors[0]
      expect(returned.auditorId).toBe(auditor.auditorId)
      expect(returned.organization).toBe('Test Audit Firm')
      expect(returned.contactName).toBe('Test Auditor')
      expect(returned.contactEmail).toBe('test@audit.com')
      expect(returned.publicKey).toBe('0x' + '33'.repeat(32))
      expect(returned.viewingKey).toBeDefined()
      expect(returned.scope).toBeDefined()
      expect(returned.scope.tokens).toEqual(['USDC', 'USDT'])
      expect(returned.role).toBe('auditor')
      expect(returned.isActive).toBe(true)
      expect(returned.registeredBy).toBe('admin')
      expect(returned.registeredAt).toBeDefined()
    })
  })

  // ─── getPendingDisclosures() ─────────────────────────────────────────────────

  describe('getPendingDisclosures()', () => {
    it('should return empty array when no disclosure requests', () => {
      const pending = manager.getPendingDisclosures()
      expect(pending).toEqual([])
      expect(pending).toHaveLength(0)
    })

    it('should return only pending disclosure requests', async () => {
      // Register auditor
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create disclosure requests
      const request1 = manager.createDisclosureRequest('tx1', auditor.auditorId, 'Audit review')
      const request2 = manager.createDisclosureRequest('tx2', auditor.auditorId, 'Tax check')
      const request3 = manager.createDisclosureRequest('tx3', auditor.auditorId, 'Compliance')

      // Approve one, deny one, leave one pending
      manager.approveDisclosureRequest(request1.requestId, 'admin')
      manager.denyDisclosureRequest(request2.requestId, 'admin', 'Not needed')

      // Check pending
      const pending = manager.getPendingDisclosures()
      expect(pending).toHaveLength(1)
      expect(pending[0].requestId).toBe(request3.requestId)
      expect(pending[0].status).toBe('pending')
    })

    it('should return pending requests with all fields', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      const request = manager.createDisclosureRequest(
        'payment_abc123',
        auditor.auditorId,
        'Regulatory audit requirement'
      )

      const pending = manager.getPendingDisclosures()
      expect(pending).toHaveLength(1)

      const returned = pending[0]
      expect(returned.requestId).toBe(request.requestId)
      expect(returned.transactionId).toBe('payment_abc123')
      expect(returned.auditorId).toBe(auditor.auditorId)
      expect(returned.reason).toBe('Regulatory audit requirement')
      expect(returned.status).toBe('pending')
      expect(returned.requestedAt).toBeDefined()
      expect(returned.approvedBy).toBeUndefined()
      expect(returned.resolvedAt).toBeUndefined()
    })

    it('should handle multiple pending requests', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create 5 requests
      for (let i = 1; i <= 5; i++) {
        manager.createDisclosureRequest(`tx${i}`, auditor.auditorId, `Reason ${i}`)
      }

      const pending = manager.getPendingDisclosures()
      expect(pending).toHaveLength(5)
      expect(pending.every(r => r.status === 'pending')).toBe(true)
    })
  })

  // ─── getDisclosureHistory() ──────────────────────────────────────────────────

  describe('getDisclosureHistory()', () => {
    it('should return empty array when no disclosures for auditor', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      const history = manager.getDisclosureHistory(auditor.auditorId)
      expect(history).toEqual([])
      expect(history).toHaveLength(0)
    })

    it('should return disclosures for specific auditor', async () => {
      // Register 2 auditors
      const auditor1 = await manager.registerAuditor(
        {
          organization: 'Audit 1',
          contactName: 'Auditor 1',
          contactEmail: 'auditor1@test.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      const auditor2 = await manager.registerAuditor(
        {
          organization: 'Audit 2',
          contactName: 'Auditor 2',
          contactEmail: 'auditor2@test.com',
          publicKey: '0x' + '22'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      // Create test payments
      const payment1 = createMockPayment('payment1', 1000_000000n)
      const payment2 = createMockPayment('payment2', 2000_000000n)
      const payment3 = createMockPayment('payment3', 3000_000000n)

      // Disclose to auditors
      manager.discloseTransaction(
        payment1,
        auditor1.auditorId,
        auditor1.viewingKey!,
        'admin'
      )
      manager.discloseTransaction(
        payment2,
        auditor1.auditorId,
        auditor1.viewingKey!,
        'admin'
      )
      manager.discloseTransaction(
        payment3,
        auditor2.auditorId,
        auditor2.viewingKey!,
        'admin'
      )

      // Check history for auditor1
      const history1 = manager.getDisclosureHistory(auditor1.auditorId)
      expect(history1).toHaveLength(2)
      expect(history1.every(d => d.auditorId === auditor1.auditorId)).toBe(true)

      // Check history for auditor2
      const history2 = manager.getDisclosureHistory(auditor2.auditorId)
      expect(history2).toHaveLength(1)
      expect(history2[0].auditorId).toBe(auditor2.auditorId)
    })

    it('should return disclosures sorted by most recent first', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      // Create payments
      const now = Math.floor(Date.now() / 1000)
      const payment1 = createMockPayment('payment1', 1000_000000n, now - 300)
      const payment2 = createMockPayment('payment2', 2000_000000n, now - 200)
      const payment3 = createMockPayment('payment3', 3000_000000n, now - 100)

      // Disclose in order
      manager.discloseTransaction(payment1, auditor.auditorId, auditor.viewingKey!, 'admin')
      manager.discloseTransaction(payment2, auditor.auditorId, auditor.viewingKey!, 'admin')
      manager.discloseTransaction(payment3, auditor.auditorId, auditor.viewingKey!, 'admin')

      const history = manager.getDisclosureHistory(auditor.auditorId)
      expect(history).toHaveLength(3)

      // Should be sorted by disclosedAt (descending - most recent first)
      // Verify sorting is in descending order
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].disclosedAt).toBeGreaterThanOrEqual(history[i + 1].disclosedAt)
      }
    })

    it('should return disclosure with all expected fields', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      const payment = createMockPayment('payment_test', 5000_000000n)
      manager.discloseTransaction(
        payment,
        auditor.auditorId,
        auditor.viewingKey!,
        'admin',
        {
          txHash: '0xabcdef123456',
          blockNumber: 12345678,
          riskScore: 25,
          riskFlags: ['high-value'],
          notes: 'Test disclosure',
          tags: ['audit', 'q4-2024'],
        }
      )

      const history = manager.getDisclosureHistory(auditor.auditorId)
      expect(history).toHaveLength(1)

      const disclosure = history[0]
      expect(disclosure.transactionId).toBe('payment_test')
      expect(disclosure.disclosureId).toBeDefined()
      expect(disclosure.auditorId).toBe(auditor.auditorId)
      expect(disclosure.disclosedBy).toBe('admin')
      expect(disclosure.type).toBe('payment')
      expect(disclosure.direction).toBe('outbound')
      expect(disclosure.amount).toBe(5000_000000n)
      expect(disclosure.chain).toBe('ethereum')
      expect(disclosure.privacyLevel).toBe(PrivacyLevel.SHIELDED)
      expect(disclosure.txHash).toBe('0xabcdef123456')
      expect(disclosure.blockNumber).toBe(12345678)
      expect(disclosure.riskScore).toBe(25)
      expect(disclosure.riskFlags).toEqual(['high-value'])
      expect(disclosure.notes).toBe('Test disclosure')
      expect(disclosure.tags).toEqual(['audit', 'q4-2024'])
    })
  })

  // ─── getComplianceMetrics() ──────────────────────────────────────────────────

  describe('getComplianceMetrics()', () => {
    it('should return zero metrics when no data', () => {
      const metrics = manager.getComplianceMetrics()

      expect(metrics).toEqual({
        totalAuditors: 0,
        totalDisclosures: 0,
        pendingDisclosures: 0,
        approvalRate: 0,
        averageProcessingTime: undefined,
      })
    })

    it('should count total auditors (active + inactive)', async () => {
      // Register 3 auditors
      const auditor1 = await manager.registerAuditor(
        {
          organization: 'Audit 1',
          contactName: 'Auditor 1',
          contactEmail: 'auditor1@test.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      await manager.registerAuditor(
        {
          organization: 'Audit 2',
          contactName: 'Auditor 2',
          contactEmail: 'auditor2@test.com',
          publicKey: '0x' + '22'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      await manager.registerAuditor(
        {
          organization: 'Audit 3',
          contactName: 'Auditor 3',
          contactEmail: 'auditor3@test.com',
          publicKey: '0x' + '33'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Deactivate one
      manager.deactivateAuditor(auditor1.auditorId, 'admin', 'Testing')

      const metrics = manager.getComplianceMetrics()
      expect(metrics.totalAuditors).toBe(3) // Includes inactive
    })

    it('should count total disclosures', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      // Create and disclose 5 payments
      for (let i = 1; i <= 5; i++) {
        const payment = createMockPayment(`payment${i}`, BigInt(i * 1000_000000))
        manager.discloseTransaction(payment, auditor.auditorId, auditor.viewingKey!, 'admin')
      }

      const metrics = manager.getComplianceMetrics()
      expect(metrics.totalDisclosures).toBe(5)
    })

    it('should count pending disclosure requests', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create 5 requests, approve 2, deny 1, leave 2 pending
      const req1 = manager.createDisclosureRequest('tx1', auditor.auditorId, 'Reason 1')
      const req2 = manager.createDisclosureRequest('tx2', auditor.auditorId, 'Reason 2')
      manager.createDisclosureRequest('tx3', auditor.auditorId, 'Reason 3')
      manager.createDisclosureRequest('tx4', auditor.auditorId, 'Reason 4')
      const req5 = manager.createDisclosureRequest('tx5', auditor.auditorId, 'Reason 5')

      manager.approveDisclosureRequest(req1.requestId, 'admin')
      manager.approveDisclosureRequest(req2.requestId, 'admin')
      manager.denyDisclosureRequest(req5.requestId, 'admin', 'Not needed')

      const metrics = manager.getComplianceMetrics()
      expect(metrics.pendingDisclosures).toBe(2)
    })

    it('should calculate approval rate correctly', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create 10 requests: approve 7, deny 3
      const requests = []
      for (let i = 1; i <= 10; i++) {
        requests.push(manager.createDisclosureRequest(`tx${i}`, auditor.auditorId, `Reason ${i}`))
      }

      // Approve 7
      for (let i = 0; i < 7; i++) {
        manager.approveDisclosureRequest(requests[i].requestId, 'admin')
      }

      // Deny 3
      for (let i = 7; i < 10; i++) {
        manager.denyDisclosureRequest(requests[i].requestId, 'admin', 'Denied')
      }

      const metrics = manager.getComplianceMetrics()
      expect(metrics.approvalRate).toBe(0.7) // 7/10 = 0.7
    })

    it('should handle approval rate with no resolved requests', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create requests but don't resolve them
      manager.createDisclosureRequest('tx1', auditor.auditorId, 'Reason 1')
      manager.createDisclosureRequest('tx2', auditor.auditorId, 'Reason 2')

      const metrics = manager.getComplianceMetrics()
      expect(metrics.approvalRate).toBe(0)
      expect(metrics.averageProcessingTime).toBeUndefined()
    })

    it('should calculate average processing time', async () => {
      const auditor = await manager.registerAuditor(
        {
          organization: 'Test Audit',
          contactName: 'Test',
          contactEmail: 'test@audit.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000,
          },
        },
        'admin'
      )

      // Create and resolve requests with known timing
      const now = Math.floor(Date.now() / 1000)

      // Request 1: processed in 100 seconds
      const req1 = manager.createDisclosureRequest('tx1', auditor.auditorId, 'Reason 1')
      req1.requestedAt = now - 100
      manager.approveDisclosureRequest(req1.requestId, 'admin')
      req1.resolvedAt = now

      // Request 2: processed in 200 seconds
      const req2 = manager.createDisclosureRequest('tx2', auditor.auditorId, 'Reason 2')
      req2.requestedAt = now - 200
      manager.approveDisclosureRequest(req2.requestId, 'admin')
      req2.resolvedAt = now

      // Request 3: processed in 300 seconds
      const req3 = manager.createDisclosureRequest('tx3', auditor.auditorId, 'Reason 3')
      req3.requestedAt = now - 300
      manager.denyDisclosureRequest(req3.requestId, 'admin', 'Denied')
      req3.resolvedAt = now

      const metrics = manager.getComplianceMetrics()

      // Average: (100 + 200 + 300) / 3 = 200 seconds
      expect(metrics.averageProcessingTime).toBe(200)
    })

    it('should return comprehensive metrics', async () => {
      // Register 3 auditors
      const auditor1 = await manager.registerAuditor(
        {
          organization: 'Audit 1',
          contactName: 'Auditor 1',
          contactEmail: 'auditor1@test.com',
          publicKey: '0x' + '11'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      await manager.registerAuditor(
        {
          organization: 'Audit 2',
          contactName: 'Auditor 2',
          contactEmail: 'auditor2@test.com',
          publicKey: '0x' + '22'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      await manager.registerAuditor(
        {
          organization: 'Audit 3',
          contactName: 'Auditor 3',
          contactEmail: 'auditor3@test.com',
          publicKey: '0x' + '33'.repeat(32),
          scope: {
            transactionTypes: ['all'],
            chains: ['ethereum'],
            tokens: [],
            startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
          },
        },
        'admin'
      )

      // Create 10 disclosures
      for (let i = 1; i <= 10; i++) {
        const payment = createMockPayment(`payment${i}`, BigInt(i * 1000_000000))
        manager.discloseTransaction(payment, auditor1.auditorId, auditor1.viewingKey!, 'admin')
      }

      // Create 8 disclosure requests: 5 approved, 1 denied, 2 pending
      const requests = []
      for (let i = 1; i <= 8; i++) {
        requests.push(manager.createDisclosureRequest(`req${i}`, auditor1.auditorId, `Reason ${i}`))
      }

      for (let i = 0; i < 5; i++) {
        manager.approveDisclosureRequest(requests[i].requestId, 'admin')
      }
      manager.denyDisclosureRequest(requests[5].requestId, 'admin', 'Denied')
      // Leave requests[6] and requests[7] pending

      const metrics = manager.getComplianceMetrics()

      expect(metrics.totalAuditors).toBe(3)
      expect(metrics.totalDisclosures).toBe(10)
      expect(metrics.pendingDisclosures).toBe(2)
      expect(metrics.approvalRate).toBeCloseTo(5 / 6, 2) // 5 approved / 6 resolved
      expect(metrics.averageProcessingTime).toBeDefined()
    })
  })
})

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Create a mock ShieldedPayment for testing
 */
function createMockPayment(
  paymentId: string,
  amount: bigint,
  createdAt?: number
): ShieldedPayment {
  return {
    paymentId,
    sourceChain: 'ethereum',
    token: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      chainId: 'ethereum',
    },
    amount,
    recipientAddress: '0x' + '22'.repeat(20),
    privacyLevel: PrivacyLevel.SHIELDED,
    senderCommitment: {
      value: '0x' + '33'.repeat(32),
      blindingFactor: '0x' + '44'.repeat(32),
    },
    amountCommitment: {
      value: '0x' + '55'.repeat(32),
      blindingFactor: '0x' + '66'.repeat(32),
    },
    recipientStealth: {
      address: '0x' + '77'.repeat(20),
      ephemeralPublicKey: '0x' + '88'.repeat(33),
      viewTag: '0x' + '99',
    },
    createdAt: createdAt ?? Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    status: 'pending',
  }
}
