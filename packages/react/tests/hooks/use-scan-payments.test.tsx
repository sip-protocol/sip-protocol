import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useScanPayments } from '../../src/hooks/use-scan-payments'

// Mock SDK functions
vi.mock('@sip-protocol/sdk', () => ({
  scanForPayments: vi.fn(),
  claimStealthPayment: vi.fn(),
  getStealthBalance: vi.fn(),
}))

import {
  scanForPayments,
  claimStealthPayment,
} from '@sip-protocol/sdk'

// Mock Solana connection
const mockConnection = {
  rpcEndpoint: 'https://api.devnet.solana.com',
  getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(2039280),
  getLatestBlockhash: vi.fn().mockResolvedValue({
    blockhash: 'mockBlockhash123',
    lastValidBlockHeight: 150000000,
  }),
  sendRawTransaction: vi.fn().mockResolvedValue('mockTxSignature123'),
  confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
}

const mockMint = {
  toBase58: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  toBytes: () => new Uint8Array(32),
  toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

const mockScanResults = [
  {
    stealthAddress: 'StealthAddress1',
    ephemeralPublicKey: 'EphemeralPubkey1',
    amount: 5_000_000n,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    txSignature: 'TxSignature1',
    slot: 150000001,
    timestamp: Date.now() / 1000,
  },
  {
    stealthAddress: 'StealthAddress2',
    ephemeralPublicKey: 'EphemeralPubkey2',
    amount: 10_000_000n,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    txSignature: 'TxSignature2',
    slot: 150000002,
    timestamp: Date.now() / 1000,
  },
]

const mockClaimResult = {
  txSignature: 'ClaimTxSignature123',
  destinationAddress: 'DestinationWallet123',
  amount: 5_000_000n,
  explorerUrl: 'https://solscan.io/tx/ClaimTxSignature123?cluster=devnet',
}

describe('useScanPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(scanForPayments).mockResolvedValue(mockScanResults)
    vi.mocked(claimStealthPayment).mockResolvedValue(mockClaimResult)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234567890abcdef',
          spendingPublicKey: '0xfedcba0987654321',
        })
      )

      expect(result.current.status).toBe('idle')
      expect(result.current.isScanning).toBe(false)
      expect(result.current.isClaiming).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.payments).toEqual([])
      expect(result.current.totalUnclaimed).toBe(0n)
      expect(result.current.lastScannedAt).toBeNull()
    })

    it('should return all expected properties', () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      expect(result.current).toHaveProperty('status')
      expect(result.current).toHaveProperty('isScanning')
      expect(result.current).toHaveProperty('isClaiming')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('payments')
      expect(result.current).toHaveProperty('totalUnclaimed')
      expect(result.current).toHaveProperty('lastScannedAt')
      expect(result.current).toHaveProperty('scan')
      expect(result.current).toHaveProperty('claim')
      expect(result.current).toHaveProperty('claimAll')
      expect(result.current).toHaveProperty('startAutoScan')
      expect(result.current).toHaveProperty('stopAutoScan')
      expect(result.current).toHaveProperty('reset')
      expect(result.current).toHaveProperty('clearError')
    })
  })

  describe('scan', () => {
    it('should scan for payments successfully', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.payments).toHaveLength(2)
      expect(result.current.payments[0].stealthAddress).toBe('StealthAddress1')
      expect(result.current.payments[0].claimed).toBe(false)
      expect(result.current.lastScannedAt).not.toBeNull()
      expect(scanForPayments).toHaveBeenCalledTimes(1)
    })

    it('should calculate total unclaimed correctly', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      // 5_000_000n + 10_000_000n = 15_000_000n
      expect(result.current.totalUnclaimed).toBe(15_000_000n)
    })

    it('should handle scan errors', async () => {
      vi.mocked(scanForPayments).mockRejectedValueOnce(new Error('RPC error'))

      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        try {
          await result.current.scan()
        } catch {
          // Expected
        }
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toBe('RPC error')
      expect(result.current.payments).toEqual([])
    })

    it('should merge new payments without duplicates', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // First scan
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments).toHaveLength(2)

      // Second scan returns same results
      await act(async () => {
        await result.current.scan()
      })

      // Should still have 2 payments (no duplicates)
      expect(result.current.payments).toHaveLength(2)
    })

    it('should add new payments on subsequent scans', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // First scan
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments).toHaveLength(2)

      // Mock new payment
      vi.mocked(scanForPayments).mockResolvedValueOnce([
        {
          stealthAddress: 'StealthAddress3',
          ephemeralPublicKey: 'EphemeralPubkey3',
          amount: 20_000_000n,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tokenSymbol: 'USDC',
          txSignature: 'TxSignature3',
          slot: 150000003,
          timestamp: Date.now() / 1000,
        },
      ])

      // Second scan
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments).toHaveLength(3)
    })

    it('should pass scan options', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
          fromSlot: 100000000,
          limit: 50,
        })
      )

      await act(async () => {
        await result.current.scan({ fromSlot: 200000000, limit: 25 })
      })

      expect(scanForPayments).toHaveBeenCalledWith(
        expect.objectContaining({
          fromSlot: 200000000,
          limit: 25,
        })
      )
    })
  })

  describe('claim', () => {
    it('should claim a payment successfully', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // First scan to get payments
      await act(async () => {
        await result.current.scan()
      })

      const payment = result.current.payments[0]

      // Claim the payment
      await act(async () => {
        await result.current.claim(payment, {
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mint: mockMint as any,
        })
      })

      expect(result.current.status).toBe('success')
      expect(result.current.payments[0].claimed).toBe(true)
      expect(result.current.payments[0].claimResult).toEqual(mockClaimResult)
      expect(claimStealthPayment).toHaveBeenCalledTimes(1)
    })

    it('should update total unclaimed after claim', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.totalUnclaimed).toBe(15_000_000n)

      // Claim first payment (5_000_000n)
      await act(async () => {
        await result.current.claim(result.current.payments[0], {
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'Dest123',
          mint: mockMint as any,
        })
      })

      // Should now be 10_000_000n
      expect(result.current.totalUnclaimed).toBe(10_000_000n)
    })

    it('should handle claim errors', async () => {
      vi.mocked(claimStealthPayment).mockRejectedValueOnce(new Error('Insufficient SOL for fees'))

      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      await act(async () => {
        await result.current.claim(result.current.payments[0], {
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'Dest123',
          mint: mockMint as any,
        })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toBe('Insufficient SOL for fees')
      expect(result.current.payments[0].claimed).toBe(false)
    })
  })

  describe('auto-scan', () => {
    it('should start auto-scanning with provided interval', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
          scanInterval: 30000, // 30 seconds
        })
      )

      // Should have done initial scan due to scanInterval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0) // Let initial scan complete
      })

      // Advance time for interval scan
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000)
      })

      expect(scanForPayments).toHaveBeenCalledTimes(2) // Initial + 1 interval
    })

    it('should start auto-scanning manually', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      act(() => {
        result.current.startAutoScan(10000)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0) // Initial scan
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000) // First interval
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000) // Second interval
      })

      expect(scanForPayments).toHaveBeenCalledTimes(3)
    })

    it('should stop auto-scanning', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      act(() => {
        result.current.startAutoScan(10000)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(scanForPayments).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.stopAutoScan()
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000)
      })

      // Should still be 1 (no more scans after stop)
      expect(scanForPayments).toHaveBeenCalledTimes(1)
    })

    it('should not start auto-scan with zero interval', () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
          scanInterval: 0,
        })
      )

      // Should not have auto-scanned
      expect(scanForPayments).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // Scan to populate state
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments).toHaveLength(2)
      expect(result.current.lastScannedAt).not.toBeNull()

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.payments).toEqual([])
      expect(result.current.totalUnclaimed).toBe(0n)
      expect(result.current.lastScannedAt).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should stop auto-scan on reset', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      act(() => {
        result.current.startAutoScan(10000)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      act(() => {
        result.current.reset()
      })

      vi.clearAllMocks()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000)
      })

      // Should not have scanned after reset
      expect(scanForPayments).not.toHaveBeenCalled()
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      vi.mocked(scanForPayments).mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        try {
          await result.current.scan()
        } catch {
          // Expected
        }
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('claimAll', () => {
    const mockMintResolver = (mint: string) => ({
      toBase58: () => mint,
      toBytes: () => new Uint8Array(32),
      toString: () => mint,
    })

    it('should claim all unclaimed payments successfully', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // First scan to get payments
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments).toHaveLength(2)
      expect(result.current.totalUnclaimed).toBe(15_000_000n)

      // Claim all payments
      let claimResult: any
      await act(async () => {
        claimResult = await result.current.claimAll({
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mintResolver: mockMintResolver as any,
        })
      })

      expect(claimResult.succeeded).toHaveLength(2)
      expect(claimResult.failed).toHaveLength(0)
      expect(claimResult.totalAttempted).toBe(2)
      expect(result.current.status).toBe('success')
      expect(result.current.totalUnclaimed).toBe(0n)
      expect(claimStealthPayment).toHaveBeenCalledTimes(2)
    })

    it('should return empty result when no unclaimed payments', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // Don't scan - no payments
      let claimResult: any
      await act(async () => {
        claimResult = await result.current.claimAll({
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mintResolver: mockMintResolver as any,
        })
      })

      expect(claimResult.succeeded).toHaveLength(0)
      expect(claimResult.failed).toHaveLength(0)
      expect(claimResult.totalAttempted).toBe(0)
    })

    it('should handle partial failures gracefully', async () => {
      // Fail on second claim
      vi.mocked(claimStealthPayment)
        .mockResolvedValueOnce(mockClaimResult)
        .mockRejectedValueOnce(new Error('Insufficient SOL'))

      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      let claimResult: any
      await act(async () => {
        claimResult = await result.current.claimAll({
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mintResolver: mockMintResolver as any,
        })
      })

      expect(claimResult.succeeded).toHaveLength(1)
      expect(claimResult.failed).toHaveLength(1)
      expect(claimResult.failed[0].error.message).toBe('Insufficient SOL')
      expect(claimResult.totalAttempted).toBe(2)
      expect(result.current.status).toBe('success')
      // Only first payment claimed
      expect(result.current.totalUnclaimed).toBe(10_000_000n)
    })

    it('should set error status when all claims fail', async () => {
      vi.mocked(claimStealthPayment).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      let claimResult: any
      await act(async () => {
        claimResult = await result.current.claimAll({
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mintResolver: mockMintResolver as any,
        })
      })

      expect(claimResult.succeeded).toHaveLength(0)
      expect(claimResult.failed).toHaveLength(2)
      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toBe('Network error')
    })

    it('should not claim already claimed payments', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      await act(async () => {
        await result.current.scan()
      })

      // Claim first payment individually
      await act(async () => {
        await result.current.claim(result.current.payments[0], {
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mint: mockMint as any,
        })
      })

      vi.clearAllMocks()

      // Now claimAll should only claim the second payment
      let claimResult: any
      await act(async () => {
        claimResult = await result.current.claimAll({
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'DestinationWallet123',
          mintResolver: mockMintResolver as any,
        })
      })

      expect(claimResult.totalAttempted).toBe(1)
      expect(claimResult.succeeded).toHaveLength(1)
      expect(claimStealthPayment).toHaveBeenCalledTimes(1)
    })
  })

  describe('status flags', () => {
    it('should have correct isScanning state after scan completes', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // Before scan
      expect(result.current.isScanning).toBe(false)

      // After scan completes
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.isScanning).toBe(false)
      expect(result.current.status).toBe('idle')
    })

    it('should have correct isClaiming state after claim completes', async () => {
      const { result } = renderHook(() =>
        useScanPayments({
          connection: mockConnection as any,
          viewingPrivateKey: '0x1234',
          spendingPublicKey: '0x5678',
        })
      )

      // First scan
      await act(async () => {
        await result.current.scan()
      })

      expect(result.current.payments.length).toBeGreaterThan(0)
      expect(result.current.isClaiming).toBe(false)

      // After claim completes
      await act(async () => {
        await result.current.claim(result.current.payments[0], {
          spendingPrivateKey: '0xabcd',
          destinationAddress: 'Dest123',
          mint: mockMint as any,
        })
      })

      expect(result.current.isClaiming).toBe(false)
      expect(result.current.status).toBe('success')
    })
  })
})
