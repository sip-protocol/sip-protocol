/**
 * NEAR Transaction History Tests
 *
 * Unit tests for the transaction history module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTransactionHistory,
  getTransactionByHash,
  getTransactionCount,
  exportTransactions,
  getTransactionSummary,
  type NEARHistoricalTransaction,
  type NEARTransactionHistoryParams,
} from '../../../src/chains/near/history'
import { ValidationError } from '../../../src/errors'

// Mock data
const mockViewingPrivateKey = ('0x' + '11'.repeat(32)) as `0x${string}`
const mockSpendingPrivateKey = ('0x' + '22'.repeat(32)) as `0x${string}`
const mockRpcUrl = 'https://rpc.testnet.near.org'

const mockTransaction: NEARHistoricalTransaction = {
  hash: 'ABC123XYZ789',
  timestamp: 1704067200000, // 2024-01-01 00:00:00
  blockHeight: 123456789,
  type: 'receive',
  stealthAddress: '0'.repeat(64),
  stealthPublicKey: ('0x' + '33'.repeat(32)) as `0x${string}`,
  ephemeralPublicKey: ('0x' + '44'.repeat(32)) as `0x${string}`,
  viewTag: 42,
  amount: '1000000000000000000000000',
  amountFormatted: '1',
  token: 'NEAR',
  tokenContract: null,
  decimals: 24,
  privacyLevel: 'shielded',
  amountRevealed: true,
  explorerUrl: 'https://explorer.testnet.near.org/transactions/ABC123XYZ789',
}

const mockTransactions: NEARHistoricalTransaction[] = [
  mockTransaction,
  {
    ...mockTransaction,
    hash: 'DEF456ABC123',
    timestamp: 1704153600000, // 2024-01-02 00:00:00
    type: 'receive',
    amount: '2000000000000000000000000',
    amountFormatted: '2',
    token: 'wNEAR',
    tokenContract: 'wrap.near',
  },
  {
    ...mockTransaction,
    hash: 'GHI789DEF456',
    timestamp: 1704240000000, // 2024-01-03 00:00:00
    type: 'send',
    amount: '500000000000000000000000',
    amountFormatted: '0.5',
  },
]

describe('NEAR Transaction History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTransactionHistory', () => {
    it('should validate required parameters', async () => {
      // Missing rpcUrl
      await expect(
        getTransactionHistory({
          rpcUrl: '',
          viewingPrivateKey: mockViewingPrivateKey,
          spendingPrivateKey: mockSpendingPrivateKey,
        })
      ).rejects.toThrow(ValidationError)

      // Invalid viewing key
      await expect(
        getTransactionHistory({
          rpcUrl: mockRpcUrl,
          viewingPrivateKey: '0xinvalid' as `0x${string}`,
          spendingPrivateKey: mockSpendingPrivateKey,
        })
      ).rejects.toThrow(ValidationError)

      // Invalid spending key
      await expect(
        getTransactionHistory({
          rpcUrl: mockRpcUrl,
          viewingPrivateKey: mockViewingPrivateKey,
          spendingPrivateKey: '0xinvalid' as `0x${string}`,
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should return empty results when no announcements found', async () => {
      const result = await getTransactionHistory({
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
        network: 'testnet',
      })

      expect(result.transactions).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.totalCount).toBe(0)
      expect(result.scanTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should accept valid parameters', async () => {
      const params: NEARTransactionHistoryParams = {
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
        network: 'mainnet',
        limit: 20,
        fromBlock: 100000,
        toBlock: 200000,
        typeFilter: ['receive'],
        tokenFilter: [null], // Native NEAR only
        searchQuery: 'ABC',
      }

      // Should not throw
      const result = await getTransactionHistory(params)
      expect(result).toBeDefined()
    })

    it('should normalize network parameter', async () => {
      // testnet
      const testnetResult = await getTransactionHistory({
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
        network: 'testnet',
      })
      expect(testnetResult).toBeDefined()

      // mainnet (default)
      const mainnetResult = await getTransactionHistory({
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
      })
      expect(mainnetResult).toBeDefined()
    })
  })

  describe('exportTransactions', () => {
    it('should export to CSV format', () => {
      const csv = exportTransactions(mockTransactions, { format: 'csv' })

      expect(csv).toContain('hash,timestamp,type')
      expect(csv).toContain('ABC123XYZ789')
      expect(csv).toContain('DEF456ABC123')
      expect(csv).toContain('receive')
      expect(csv).toContain('send')
    })

    it('should export to CSV without headers', () => {
      const csv = exportTransactions(mockTransactions, {
        format: 'csv',
        includeHeaders: false,
      })

      expect(csv).not.toContain('hash,timestamp,type')
      expect(csv).toContain('ABC123XYZ789')
    })

    it('should export to JSON format', () => {
      const json = exportTransactions(mockTransactions, { format: 'json' })
      const parsed = JSON.parse(json)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(3)
      expect(parsed[0].hash).toBe('ABC123XYZ789')
    })

    it('should export to pretty JSON', () => {
      const json = exportTransactions(mockTransactions, {
        format: 'json',
        prettyPrint: true,
      })

      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })

    it('should export only specified fields', () => {
      const csv = exportTransactions(mockTransactions, {
        format: 'csv',
        fields: ['hash', 'amountFormatted', 'token'],
      })

      expect(csv).toContain('hash,amountFormatted,token')
      expect(csv).not.toContain('timestamp')
      expect(csv).not.toContain('stealthAddress')
    })

    it('should handle empty transactions array', () => {
      const csv = exportTransactions([], { format: 'csv' })
      expect(csv).toBe('hash,timestamp,type,amountFormatted,token,stealthAddress,privacyLevel,explorerUrl')

      const json = exportTransactions([], { format: 'json' })
      expect(json).toBe('[]')
    })

    it('should escape commas in CSV values', () => {
      const txWithComma: NEARHistoricalTransaction = {
        ...mockTransaction,
        stealthAddress: 'address,with,commas',
      }
      const csv = exportTransactions([txWithComma], { format: 'csv' })

      expect(csv).toContain('"address,with,commas"')
    })
  })

  describe('getTransactionSummary', () => {
    it('should calculate correct totals', () => {
      const summary = getTransactionSummary(mockTransactions)

      expect(summary.transactionCount).toBe(3)
      expect(summary.totalReceived['NEAR']).toBe(1000000000000000000000000n)
      expect(summary.totalReceived['wNEAR']).toBe(2000000000000000000000000n)
      expect(summary.totalSent['NEAR']).toBe(500000000000000000000000n)
    })

    it('should calculate unique addresses', () => {
      const summary = getTransactionSummary(mockTransactions)

      expect(summary.uniqueAddresses).toBeGreaterThan(0)
    })

    it('should calculate date range', () => {
      const summary = getTransactionSummary(mockTransactions)

      expect(summary.dateRange).not.toBeNull()
      expect(summary.dateRange!.from).toBe(1704067200000)
      expect(summary.dateRange!.to).toBe(1704240000000)
    })

    it('should return null date range for empty array', () => {
      const summary = getTransactionSummary([])

      expect(summary.dateRange).toBeNull()
      expect(summary.transactionCount).toBe(0)
    })

    it('should handle single transaction', () => {
      const summary = getTransactionSummary([mockTransaction])

      expect(summary.transactionCount).toBe(1)
      expect(summary.dateRange!.from).toBe(summary.dateRange!.to)
    })
  })

  describe('getTransactionByHash', () => {
    it('should return null for non-existent transaction', async () => {
      const result = await getTransactionByHash('nonexistent', {
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
      })

      expect(result).toBeNull()
    })

    it('should validate parameters', async () => {
      await expect(
        getTransactionByHash('somehash', {
          rpcUrl: '',
          viewingPrivateKey: mockViewingPrivateKey as `0x${string}`,
          spendingPrivateKey: mockSpendingPrivateKey as `0x${string}`,
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('getTransactionCount', () => {
    it('should return count of transactions', async () => {
      const count = await getTransactionCount({
        rpcUrl: mockRpcUrl,
        viewingPrivateKey: mockViewingPrivateKey,
        spendingPrivateKey: mockSpendingPrivateKey,
      })

      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('NEARHistoricalTransaction type', () => {
    it('should have all required fields', () => {
      const tx: NEARHistoricalTransaction = mockTransaction

      expect(tx.hash).toBeDefined()
      expect(tx.timestamp).toBeDefined()
      expect(tx.blockHeight).toBeDefined()
      expect(tx.type).toBeDefined()
      expect(tx.stealthAddress).toBeDefined()
      expect(tx.stealthPublicKey).toBeDefined()
      expect(tx.ephemeralPublicKey).toBeDefined()
      expect(tx.viewTag).toBeDefined()
      expect(tx.amount).toBeDefined()
      expect(tx.amountFormatted).toBeDefined()
      expect(tx.token).toBeDefined()
      expect(tx.decimals).toBeDefined()
      expect(tx.privacyLevel).toBeDefined()
      expect(tx.amountRevealed).toBeDefined()
      expect(tx.explorerUrl).toBeDefined()
    })

    it('should have correct type values', () => {
      expect(['send', 'receive', 'contract_call']).toContain(mockTransaction.type)
      expect(['transparent', 'shielded', 'compliant']).toContain(mockTransaction.privacyLevel)
    })
  })
})

describe('Edge cases', () => {
  it('should handle large transaction amounts', () => {
    const largeTx: NEARHistoricalTransaction = {
      ...mockTransaction,
      amount: '999999999999999999999999999999',
      amountFormatted: '999999.999999',
    }

    const summary = getTransactionSummary([largeTx])
    expect(summary.totalReceived['NEAR']).toBe(999999999999999999999999999999n)
  })

  it('should handle zero amounts', () => {
    const zeroTx: NEARHistoricalTransaction = {
      ...mockTransaction,
      amount: '0',
      amountFormatted: '0',
    }

    const csv = exportTransactions([zeroTx], { format: 'csv' })
    expect(csv).toContain(',0,')
  })

  it('should handle special characters in token names', () => {
    const specialTx: NEARHistoricalTransaction = {
      ...mockTransaction,
      token: 'TOKEN-V2.1',
      tokenContract: 'token-v2.1.near',
    }

    const json = exportTransactions([specialTx], { format: 'json' })
    const parsed = JSON.parse(json)
    expect(parsed[0].token).toBe('TOKEN-V2.1')
  })
})
