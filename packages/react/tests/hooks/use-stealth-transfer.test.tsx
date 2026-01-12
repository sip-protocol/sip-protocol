import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStealthTransfer } from '../../src/hooks/use-stealth-transfer'

// Mock SDK functions
vi.mock('@sip-protocol/sdk', () => ({
  sendPrivateSPLTransfer: vi.fn(),
  estimatePrivateTransferFee: vi.fn(),
  hasTokenAccount: vi.fn(),
}))

import {
  sendPrivateSPLTransfer,
  estimatePrivateTransferFee,
  hasTokenAccount,
} from '@sip-protocol/sdk'

// Mock Solana types
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

const mockSender = {
  toBase58: () => 'SenderPubkey123',
  toBytes: () => new Uint8Array(32),
  toString: () => 'SenderPubkey123',
}

const mockMint = {
  toBase58: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  toBytes: () => new Uint8Array(32),
  toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

const mockSenderTokenAccount = {
  toBase58: () => 'SenderTokenAccount123',
  toBytes: () => new Uint8Array(32),
  toString: () => 'SenderTokenAccount123',
}

const mockSignTransaction = vi.fn().mockImplementation((tx) => Promise.resolve(tx))

const mockTransferResult = {
  txSignature: 'mockTxSignature123',
  stealthAddress: 'StealthAddress123',
  ephemeralPublicKey: 'EphemeralPubkey123',
  viewTag: 'ab',
  explorerUrl: 'https://solscan.io/tx/mockTxSignature123?cluster=devnet',
  cluster: 'devnet' as const,
}

describe('useStealthTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendPrivateSPLTransfer).mockResolvedValue(mockTransferResult)
    vi.mocked(estimatePrivateTransferFee).mockResolvedValue(5000n)
    vi.mocked(hasTokenAccount).mockResolvedValue(false)
  })

  describe('initial state', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      expect(result.current.status).toBe('idle')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.result).toBeNull()
      expect(result.current.estimatedFee).toBeNull()
    })

    it('should return all expected properties', () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      expect(result.current).toHaveProperty('status')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('result')
      expect(result.current).toHaveProperty('estimatedFee')
      expect(result.current).toHaveProperty('transfer')
      expect(result.current).toHaveProperty('estimateFee')
      expect(result.current).toHaveProperty('reset')
      expect(result.current).toHaveProperty('clearError')
    })
  })

  describe('transfer', () => {
    it('should execute transfer successfully with meta-address object', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      let transferResult: typeof mockTransferResult | null = null

      await act(async () => {
        transferResult = await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            viewingKey: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('success')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.result).toEqual(mockTransferResult)
      expect(transferResult).toEqual(mockTransferResult)
      expect(sendPrivateSPLTransfer).toHaveBeenCalledTimes(1)
    })

    it('should execute transfer successfully with meta-address string', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: 'sip:solana:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('success')
      expect(sendPrivateSPLTransfer).toHaveBeenCalledTimes(1)
    })

    it('should handle transfer errors', async () => {
      vi.mocked(sendPrivateSPLTransfer).mockRejectedValueOnce(new Error('Insufficient balance'))

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toBe('Insufficient balance')
      expect(result.current.result).toBeNull()
    })

    it('should fail when sender is null', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: null,
          signTransaction: mockSignTransaction,
        })
      )

      let transferResult

      await act(async () => {
        transferResult = await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(transferResult).toBeNull()
      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toContain('Wallet not connected')
    })

    it('should fail when signTransaction is undefined', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: undefined,
        })
      )

      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toContain('does not support signing')
    })

    it('should fail with invalid meta-address format', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: 'invalid:address:format',
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toContain('Invalid stealth meta-address')
    })
  })

  describe('estimateFee', () => {
    it('should estimate fee for new ATA', async () => {
      vi.mocked(hasTokenAccount).mockResolvedValue(false)

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      let fee: bigint | undefined

      await act(async () => {
        fee = await result.current.estimateFee(mockMint as any)
      })

      expect(fee).toBe(5000n)
      expect(result.current.estimatedFee).toBe(5000n)
      expect(estimatePrivateTransferFee).toHaveBeenCalledWith(mockConnection, true)
    })

    it('should estimate fee for existing ATA', async () => {
      vi.mocked(hasTokenAccount).mockResolvedValue(true)

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        await result.current.estimateFee(mockMint as any, 'StealthAddress123')
      })

      expect(estimatePrivateTransferFee).toHaveBeenCalledWith(mockConnection, false)
    })

    it('should handle fee estimation errors', async () => {
      vi.mocked(estimatePrivateTransferFee).mockRejectedValueOnce(new Error('RPC error'))

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        try {
          await result.current.estimateFee(mockMint as any)
        } catch {
          // Expected
        }
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.message).toBe('RPC error')
    })
  })

  describe('reset', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      // First do a transfer
      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      expect(result.current.status).toBe('success')
      expect(result.current.result).not.toBeNull()

      // Now reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.result).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.estimatedFee).toBeNull()
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      vi.mocked(sendPrivateSPLTransfer).mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      await act(async () => {
        await result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
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

  describe('isLoading', () => {
    it('should be true during transfer', async () => {
      // Create a promise we can control
      let resolveTransfer: (value: typeof mockTransferResult) => void
      const transferPromise = new Promise<typeof mockTransferResult>((resolve) => {
        resolveTransfer = resolve
      })
      vi.mocked(sendPrivateSPLTransfer).mockReturnValue(transferPromise)

      const { result } = renderHook(() =>
        useStealthTransfer({
          connection: mockConnection as any,
          sender: mockSender as any,
          signTransaction: mockSignTransaction,
        })
      )

      // Start transfer but don't await
      act(() => {
        result.current.transfer({
          recipientMetaAddress: {
            chain: 'solana',
            spendingKey: '0x1234',
            viewingKey: '0x5678',
          },
          mint: mockMint as any,
          senderTokenAccount: mockSenderTokenAccount as any,
          amount: 5_000_000n,
        })
      })

      // Should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.status).not.toBe('idle')

      // Complete the transfer
      await act(async () => {
        resolveTransfer!(mockTransferResult)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.status).toBe('success')
    })
  })
})
