/**
 * Helius Enhanced Transactions Tests
 *
 * Tests for the Enhanced Transactions API integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HeliusEnhanced,
  createHeliusEnhanced,
} from '../../../../src/chains/solana/providers/helius-enhanced'
import type {
  EnhancedTransaction,
} from '../../../../src/chains/solana/providers/helius-enhanced-types'
import { ValidationError, NetworkError } from '../../../../src/errors'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('HeliusEnhanced', () => {
  const validApiKey = 'test-api-key-12345678'
  const testAddress = '7xK8kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9p'
  const testSignature = '5rfFLBUp5YPr6rC2g1KBBW8LGZBcZ8Lvs7gKAdgrBjmQvFf6EKkgc5cpAQUTwGxDJbNqtLYkjV5vS5zVK4tb6JtP'

  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      expect(helius).toBeInstanceOf(HeliusEnhanced)
    })

    it('should create instance with devnet cluster', () => {
      const helius = new HeliusEnhanced({
        apiKey: validApiKey,
        cluster: 'devnet',
      })
      expect(helius).toBeInstanceOf(HeliusEnhanced)
    })

    it('should throw on missing API key', () => {
      expect(() => new HeliusEnhanced({ apiKey: '' })).toThrow(ValidationError)
    })

    it('should throw on invalid API key format', () => {
      expect(() => new HeliusEnhanced({ apiKey: 'short' })).toThrow(ValidationError)
    })
  })

  describe('createHeliusEnhanced factory', () => {
    it('should create instance', () => {
      const helius = createHeliusEnhanced({ apiKey: validApiKey })
      expect(helius).toBeInstanceOf(HeliusEnhanced)
    })
  })

  describe('parseTransactions', () => {
    const mockEnhancedTx: EnhancedTransaction = {
      signature: testSignature,
      description: 'Alice sent 1.5 SOL to Bob',
      type: 'TRANSFER',
      source: 'SYSTEM_PROGRAM',
      fee: 5000,
      feePayer: testAddress,
      slot: 123456789,
      timestamp: 1678886400,
      nativeTransfers: [
        {
          fromUserAccount: testAddress,
          toUserAccount: '8xK9kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9q',
          amount: 1500000000,
        },
      ],
      tokenTransfers: [],
      accountData: [],
      events: {},
      transactionError: null,
    }

    it('should parse a single transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockEnhancedTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const results = await helius.parseTransactions(testSignature)

      expect(results).toHaveLength(1)
      expect(results[0].signature).toBe(testSignature)
      expect(results[0].type).toBe('TRANSFER')
      expect(results[0].description).toBe('Alice sent 1.5 SOL to Bob')
    })

    it('should parse multiple transactions', async () => {
      const testSignature2 = '4sfGLUp5YPr6rC2g1KBBW8LGZBcZ8Lvs7gKAdgrBjmQvFf6EKkgc5cpAQUTwGxDJbNqtLYkjV5vS5zVK4tb6JtQ'
      const mockTx2 = { ...mockEnhancedTx, signature: testSignature2 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockEnhancedTx, mockTx2],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const results = await helius.parseTransactions([testSignature, testSignature2])

      expect(results).toHaveLength(2)
    })

    it('should throw on empty signatures', async () => {
      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await expect(helius.parseTransactions([])).rejects.toThrow(ValidationError)
    })

    it('should throw on invalid signature format', async () => {
      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await expect(helius.parseTransactions('short')).rejects.toThrow(ValidationError)
    })

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await expect(helius.parseTransactions(testSignature)).rejects.toThrow(NetworkError)
    })
  })

  describe('parseTransaction', () => {
    it('should return single transaction or null', async () => {
      const mockTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'Test transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const result = await helius.parseTransaction(testSignature)

      expect(result).not.toBeNull()
      expect(result?.signature).toBe(testSignature)
    })

    it('should return null if not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const result = await helius.parseTransaction(testSignature)

      expect(result).toBeNull()
    })
  })

  describe('getTransactionHistory', () => {
    const mockHistoryResponse: EnhancedTransaction[] = [
      {
        signature: testSignature,
        description: 'Transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      },
    ]

    it('should get transaction history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistoryResponse,
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const results = await helius.getTransactionHistory(testAddress)

      expect(results).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/addresses/${testAddress}/transactions`),
        expect.any(Object)
      )
    })

    it('should filter by type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistoryResponse,
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await helius.getTransactionHistory(testAddress, { type: 'SWAP' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=SWAP'),
        expect.any(Object)
      )
    })

    it('should apply limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistoryResponse,
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await helius.getTransactionHistory(testAddress, { limit: 50 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      )
    })

    it('should throw on invalid address', async () => {
      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      await expect(helius.getTransactionHistory('invalid')).rejects.toThrow(ValidationError)
    })
  })

  describe('getSIPTransactionHistory', () => {
    it('should extract SIP metadata from transactions', async () => {
      const sipMemoTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'SIP:1:7xK8kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9p:ab Transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [
          {
            fromUserAccount: testAddress,
            toUserAccount: '8xK9kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9q',
            amount: 1000000000,
          },
        ],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [sipMemoTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const results = await helius.getSIPTransactionHistory(testAddress)

      expect(results).toHaveLength(1)
      expect(results[0].sipMetadata.isSIPTransaction).toBe(true)
      expect(results[0].sipMetadata.ephemeralPubKey).toBe('7xK8kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9p')
      expect(results[0].sipMetadata.viewTag).toBe(0xab)
    })

    it('should mark non-SIP transactions', async () => {
      const normalTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'Normal transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [normalTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const results = await helius.getSIPTransactionHistory(testAddress)

      expect(results[0].sipMetadata.isSIPTransaction).toBe(false)
    })
  })

  describe('getTransactionSummaries', () => {
    it('should create human-readable summaries', async () => {
      const mockTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'Transfer 1 SOL',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [
          {
            fromUserAccount: '8xK9kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9q',
            toUserAccount: testAddress,
            amount: 1000000000,
          },
        ],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const summaries = await helius.getTransactionSummaries(testAddress)

      expect(summaries).toHaveLength(1)
      expect(summaries[0].signature).toBe(testSignature)
      expect(summaries[0].title).toContain('Received')
      expect(summaries[0].status).toBe('success')
      expect(summaries[0].feeInSol).toBeCloseTo(0.000005)
      expect(summaries[0].timestamp).toBeInstanceOf(Date)
      expect(summaries[0].explorerUrl).toContain(testSignature)
    })

    it('should hide amounts for unauthorized viewers on SIP transactions', async () => {
      const sipTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'SIP:1:7xK8kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9p:ab Transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [
          {
            fromUserAccount: testAddress,
            toUserAccount: '8xK9kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9q',
            amount: 1000000000,
          },
        ],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [sipTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const summaries = await helius.getTransactionSummaries(testAddress)

      // Without viewing key, amounts should be hidden
      expect(summaries[0].isAuthorizedViewer).toBe(false)
      expect(summaries[0].tokens[0].amount).toBe('***')
      expect(summaries[0].description).toContain('viewing key required')
    })

    it('should show amounts for authorized viewers', async () => {
      const sipTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'SIP:1:7xK8kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9p:ab Transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [
          {
            fromUserAccount: testAddress,
            toUserAccount: '8xK9kJcT3FnKQYFzw2VNcxn5TRrxS2qvFkp3kT1eFB9q',
            amount: 1000000000,
          },
        ],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [sipTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const summaries = await helius.getTransactionSummaries(testAddress, {
        viewingPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      // With viewing key, amounts should be visible
      expect(summaries[0].isAuthorizedViewer).toBe(true)
      expect(summaries[0].tokens[0].amount).not.toBe('***')
    })

    it('should handle failed transactions', async () => {
      const failedTx: EnhancedTransaction = {
        signature: testSignature,
        description: 'Failed transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: { error: 'Insufficient funds' },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [failedTx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const summaries = await helius.getTransactionSummaries(testAddress)

      expect(summaries[0].status).toBe('failed')
    })
  })

  describe('transaction type titles', () => {
    it.each([
      ['TRANSFER', 'Transfer'],
      ['SWAP', 'Swap'],
      ['NFT_SALE', 'NFT Sale'],
      ['NFT_MINT', 'NFT Mint'],
      ['ADD_LIQUIDITY', 'Added Liquidity'],
      ['REMOVE_LIQUIDITY', 'Removed Liquidity'],
      ['STAKE', 'Staked'],
      ['UNSTAKE', 'Unstaked'],
      ['CLAIM_REWARDS', 'Claimed Rewards'],
    ] as const)('should create title for %s', async (type, expectedTitle) => {
      const tx: EnhancedTransaction = {
        signature: testSignature,
        description: 'Test',
        type,
        source: 'TEST',
        fee: 5000,
        feePayer: testAddress,
        slot: 123456789,
        timestamp: 1678886400,
        nativeTransfers: [],
        tokenTransfers: [],
        accountData: [],
        events: {},
        transactionError: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [tx],
      })

      const helius = new HeliusEnhanced({ apiKey: validApiKey })
      const summaries = await helius.getTransactionSummaries(testAddress)

      expect(summaries[0].title).toContain(expectedTitle)
    })
  })
})
