/**
 * Solana Stealth Scanner Tests
 *
 * Tests for the advanced stealth address scanner.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  StealthScanner,
  createStealthScanner,
  batchScanForRecipients,
  fullHistoricalScan,
  type ScanRecipient,
} from '../../../src/chains/solana/stealth-scanner'
import type { HexString } from '@sip-protocol/types'

// Pre-generated test keys (deterministic for reproducibility)
const TEST_VIEWING_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as HexString
const TEST_SPENDING_PUBLIC_KEY = '0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' as HexString

// Mock connection
const createMockConnection = () => {
  const mockGetSignaturesForAddress = vi.fn().mockResolvedValue([])
  const mockGetTransaction = vi.fn().mockResolvedValue(null)
  const mockOnLogs = vi.fn().mockReturnValue(1)
  const mockRemoveOnLogsListener = vi.fn().mockResolvedValue(undefined)

  return {
    getSignaturesForAddress: mockGetSignaturesForAddress,
    getTransaction: mockGetTransaction,
    onLogs: mockOnLogs,
    removeOnLogsListener: mockRemoveOnLogsListener,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  } as unknown as Connection
}

describe('Solana Stealth Scanner', () => {
  let mockConnection: Connection
  let testRecipient: ScanRecipient

  beforeEach(() => {
    mockConnection = createMockConnection()

    testRecipient = {
      viewingPrivateKey: TEST_VIEWING_PRIVATE_KEY,
      spendingPublicKey: TEST_SPENDING_PUBLIC_KEY,
      label: 'Test Wallet',
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── StealthScanner Class ───────────────────────────────────────────────────

  describe('StealthScanner', () => {
    describe('constructor', () => {
      it('should create scanner with default options', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        expect(scanner).toBeInstanceOf(StealthScanner)
        expect(scanner.getRecipients()).toHaveLength(0)
        expect(scanner.isSubscribed()).toBe(false)
      })

      it('should accept custom options', () => {
        const scanner = new StealthScanner({
          connection: mockConnection,
          batchSize: 50,
          useViewTagFilter: false,
        })

        expect(scanner).toBeInstanceOf(StealthScanner)
      })
    })

    describe('addRecipient', () => {
      it('should add recipient', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        scanner.addRecipient(testRecipient)

        expect(scanner.getRecipients()).toHaveLength(1)
        expect(scanner.getRecipients()[0].label).toBe('Test Wallet')
      })

      it('should add multiple recipients', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        scanner.addRecipient({ ...testRecipient, label: 'Wallet 1' })
        scanner.addRecipient({ ...testRecipient, label: 'Wallet 2' })

        expect(scanner.getRecipients()).toHaveLength(2)
      })
    })

    describe('removeRecipient', () => {
      it('should remove recipient by label', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        scanner.addRecipient({ ...testRecipient, label: 'Keep' })
        scanner.addRecipient({ ...testRecipient, label: 'Remove' })

        scanner.removeRecipient('Remove')

        expect(scanner.getRecipients()).toHaveLength(1)
        expect(scanner.getRecipients()[0].label).toBe('Keep')
      })

      it('should do nothing if label not found', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        scanner.addRecipient(testRecipient)
        scanner.removeRecipient('NonExistent')

        expect(scanner.getRecipients()).toHaveLength(1)
      })
    })

    describe('clearRecipients', () => {
      it('should clear all recipients', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        scanner.addRecipient({ ...testRecipient, label: 'A' })
        scanner.addRecipient({ ...testRecipient, label: 'B' })

        scanner.clearRecipients()

        expect(scanner.getRecipients()).toHaveLength(0)
      })
    })

    describe('scanHistorical', () => {
      it('should return empty results when no recipients', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        const result = await scanner.scanHistorical()

        expect(result.payments).toHaveLength(0)
        expect(result.scannedCount).toBe(0)
        expect(result.hasMore).toBe(false)
      })

      it('should scan for payments with recipients', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        const result = await scanner.scanHistorical({ limit: 100 })

        // With mock returning empty, we expect no payments
        expect(result.payments).toHaveLength(0)
        expect(result.hasMore).toBe(false)
      })

      it('should respect scan options', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        await scanner.scanHistorical({
          fromSlot: 250000000,
          toSlot: 260000000,
          limit: 50,
        })

        expect(mockConnection.getSignaturesForAddress).toHaveBeenCalledWith(
          expect.any(PublicKey),
          expect.objectContaining({
            limit: 50,
            minContextSlot: 250000000,
          })
        )
      })

      it('should use pagination cursor', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        await scanner.scanHistorical({
          beforeSignature: 'prev_signature_here',
        })

        expect(mockConnection.getSignaturesForAddress).toHaveBeenCalledWith(
          expect.any(PublicKey),
          expect.objectContaining({
            before: 'prev_signature_here',
          })
        )
      })
    })

    describe('subscribe', () => {
      it('should start real-time subscription', () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        const onPayment = vi.fn()
        scanner.subscribe(onPayment)

        expect(scanner.isSubscribed()).toBe(true)
        expect(mockConnection.onLogs).toHaveBeenCalled()
      })

      it('should throw if already subscribed', () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        scanner.subscribe(vi.fn())

        expect(() => scanner.subscribe(vi.fn())).toThrow('Already subscribed')
      })

      it('should throw if no recipients', () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        expect(() => scanner.subscribe(vi.fn())).toThrow('No recipients')
      })
    })

    describe('unsubscribe', () => {
      it('should stop subscription', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })
        scanner.addRecipient(testRecipient)

        scanner.subscribe(vi.fn())
        expect(scanner.isSubscribed()).toBe(true)

        await scanner.unsubscribe()
        expect(scanner.isSubscribed()).toBe(false)
        expect(mockConnection.removeOnLogsListener).toHaveBeenCalled()
      })

      it('should do nothing if not subscribed', async () => {
        const scanner = new StealthScanner({ connection: mockConnection })

        await scanner.unsubscribe()
        expect(mockConnection.removeOnLogsListener).not.toHaveBeenCalled()
      })
    })
  })

  // ─── Factory Function ───────────────────────────────────────────────────────

  describe('createStealthScanner', () => {
    it('should create scanner instance', () => {
      const scanner = createStealthScanner({ connection: mockConnection })

      expect(scanner).toBeInstanceOf(StealthScanner)
    })
  })

  // ─── Batch Scanning ─────────────────────────────────────────────────────────

  describe('batchScanForRecipients', () => {
    it('should scan for multiple recipients', async () => {
      const recipients: ScanRecipient[] = [
        { ...testRecipient, label: 'Wallet 1' },
        { ...testRecipient, label: 'Wallet 2' },
      ]

      const results = await batchScanForRecipients(
        { connection: mockConnection },
        recipients,
        { limit: 100 }
      )

      expect(results).toHaveProperty('Wallet 1')
      expect(results).toHaveProperty('Wallet 2')
      expect(Array.isArray(results['Wallet 1'])).toBe(true)
    })

    it('should use "unknown" for unlabeled recipients', async () => {
      const recipients: ScanRecipient[] = [
        { viewingPrivateKey: testRecipient.viewingPrivateKey, spendingPublicKey: testRecipient.spendingPublicKey },
      ]

      const results = await batchScanForRecipients(
        { connection: mockConnection },
        recipients
      )

      expect(results).toHaveProperty('unknown')
    })
  })

  // ─── Full Historical Scan ───────────────────────────────────────────────────

  describe('fullHistoricalScan', () => {
    it('should scan with automatic pagination', async () => {
      const recipients = [testRecipient]

      const payments = await fullHistoricalScan(
        { connection: mockConnection },
        recipients
      )

      expect(Array.isArray(payments)).toBe(true)
    })

    it('should call progress callback', async () => {
      const recipients = [testRecipient]
      const onProgress = vi.fn()

      await fullHistoricalScan(
        { connection: mockConnection },
        recipients,
        {},
        onProgress
      )

      expect(onProgress).toHaveBeenCalled()
    })

    it('should respect scan options', async () => {
      const recipients = [testRecipient]

      await fullHistoricalScan(
        { connection: mockConnection },
        recipients,
        { fromSlot: 250000000, limit: 500 }
      )

      expect(mockConnection.getSignaturesForAddress).toHaveBeenCalled()
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support typical workflow: create, add, scan, subscribe', async () => {
      // Create scanner
      const scanner = createStealthScanner({ connection: mockConnection })

      // Add recipients
      scanner.addRecipient(testRecipient)
      expect(scanner.getRecipients()).toHaveLength(1)

      // Historical scan
      const historicalResult = await scanner.scanHistorical({ limit: 100 })
      expect(historicalResult).toHaveProperty('payments')

      // Subscribe to real-time
      const paymentHandler = vi.fn()
      scanner.subscribe(paymentHandler)
      expect(scanner.isSubscribed()).toBe(true)

      // Unsubscribe
      await scanner.unsubscribe()
      expect(scanner.isSubscribed()).toBe(false)

      // Clear recipients
      scanner.clearRecipients()
      expect(scanner.getRecipients()).toHaveLength(0)
    })

    it('should handle multiple recipients with different keys', async () => {
      // Generate different test keys for different "accounts"
      const recipient1: ScanRecipient = {
        viewingPrivateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as HexString,
        spendingPublicKey: '0x02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as HexString,
        label: 'Main Account',
      }
      const recipient2: ScanRecipient = {
        viewingPrivateKey: '0x2222222222222222222222222222222222222222222222222222222222222222' as HexString,
        spendingPublicKey: '0x02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as HexString,
        label: 'Savings Account',
      }

      const recipients: ScanRecipient[] = [recipient1, recipient2]

      const results = await batchScanForRecipients(
        { connection: mockConnection },
        recipients
      )

      expect(Object.keys(results)).toContain('Main Account')
      expect(Object.keys(results)).toContain('Savings Account')
    })
  })

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty signature list', async () => {
      const scanner = createStealthScanner({ connection: mockConnection })
      scanner.addRecipient(testRecipient)

      const result = await scanner.scanHistorical()

      expect(result.payments).toHaveLength(0)
      expect(result.scannedCount).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should handle RPC errors gracefully', async () => {
      const errorConnection = {
        ...mockConnection,
        getSignaturesForAddress: vi.fn().mockRejectedValue(new Error('RPC timeout')),
      } as unknown as Connection

      const scanner = createStealthScanner({ connection: errorConnection })
      scanner.addRecipient(testRecipient)

      await expect(scanner.scanHistorical()).rejects.toThrow('Historical scan failed')
    })
  })
})
