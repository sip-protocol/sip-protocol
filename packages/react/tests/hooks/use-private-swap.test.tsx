import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePrivateSwap } from '../../src/hooks/use-private-swap'
import { useSIP } from '../../src/hooks/use-sip'

// Mock the useSIP hook
vi.mock('../../src/hooks/use-sip')

// Define types locally to avoid importing from SDK (which causes dependency issues in tests)
type Quote = {
  quoteId: string
  intentId: string
  solverId: string
  outputAmount: bigint
  estimatedTime: number
  expiry: number
  fee: bigint
}

type TrackedIntent = {
  intentId: string
  version: string
  privacyLevel: string
  createdAt: number
  expiry: number
  outputAsset: any
  minOutputAmount: bigint
  maxSlippage: number
  inputCommitment: any
  senderCommitment: any
  recipientStealth: any
  fundingProof: any
  validityProof: any
  status: string
  quotes: any[]
}

type FulfillmentResult = {
  intentId: string
  status: string
  outputAmount?: bigint
  txHash?: string
  fulfilledAt: number
}

const PrivacyLevel = {
  TRANSPARENT: 'transparent',
  SHIELDED: 'shielded',
  COMPLIANT: 'compliant',
} as const

const IntentStatus = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  FAILED: 'failed',
} as const

describe('usePrivateSwap', () => {
  // Mock SIP client
  const mockSIPClient = {
    getQuotes: vi.fn(),
    createIntent: vi.fn(),
    execute: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSIP).mockReturnValue({
      client: mockSIPClient as any,
      isReady: true,
      error: null,
      initialize: vi.fn(),
    })
  })

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => usePrivateSwap())

      expect(result.current.quote).toBeNull()
      expect(result.current.status).toBe('idle')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('fetchQuote', () => {
    const mockQuote: Quote = {
      quoteId: 'quote-123',
      intentId: 'intent-123',
      solverId: 'solver-1',
      outputAmount: 1000000n,
      estimatedTime: 30,
      expiry: Math.floor(Date.now() / 1000) + 60,
      fee: 5000n,
    }

    it('should fetch and set quote successfully', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        await result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
        })
      })

      expect(result.current.quote).toEqual(mockQuote)
      expect(result.current.status).toBe('idle')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(mockSIPClient.getQuotes).toHaveBeenCalledTimes(1)
    })

    it('should update status to fetching_quote during fetch', async () => {
      mockSIPClient.getQuotes.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([mockQuote]), 100))
      )

      const { result } = renderHook(() => usePrivateSwap())

      act(() => {
        result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
        })
      })

      expect(result.current.status).toBe('fetching_quote')
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.status).toBe('idle')
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle error when no quotes available', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([])

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        try {
          await result.current.fetchQuote({
            inputChain: 'solana',
            outputChain: 'ethereum',
            inputToken: 'SOL',
            outputToken: 'ETH',
            inputAmount: '1000000000',
          })
        } catch (err) {
          // Expected error
        }
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toBe('No quotes available')
      expect(result.current.status).toBe('failed')
    })

    it('should handle API errors', async () => {
      const apiError = new Error('API request failed')
      mockSIPClient.getQuotes.mockRejectedValue(apiError)

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        try {
          await result.current.fetchQuote({
            inputChain: 'solana',
            outputChain: 'ethereum',
            inputToken: 'SOL',
            outputToken: 'ETH',
            inputAmount: '1000000000',
          })
        } catch (err) {
          // Expected error
        }
      })

      expect(result.current.error).toEqual(apiError)
      expect(result.current.status).toBe('failed')
    })

    it('should use custom privacy level if provided', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        await result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
          privacyLevel: PrivacyLevel.COMPLIANT,
        })
      })

      expect(mockSIPClient.getQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          privacy: PrivacyLevel.COMPLIANT,
        })
      )
    })

    it('should use custom slippage if provided', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        await result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
          maxSlippage: 0.05,
        })
      })

      expect(mockSIPClient.getQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            maxSlippage: 0.05,
          }),
        })
      )
    })
  })

  describe('swap', () => {
    const mockQuote: Quote = {
      quoteId: 'quote-123',
      intentId: 'intent-123',
      solverId: 'solver-1',
      outputAmount: 1000000n,
      estimatedTime: 30,
      expiry: Math.floor(Date.now() / 1000) + 60,
      fee: 5000n,
    }

    const mockIntent: TrackedIntent = {
      intentId: 'intent-123',
      version: 'sip-v1',
      privacyLevel: PrivacyLevel.SHIELDED,
      createdAt: Date.now(),
      expiry: Date.now() + 300000,
      outputAsset: {
        chain: 'ethereum',
        symbol: 'ETH',
        address: null,
        decimals: 18,
      },
      minOutputAmount: 0n,
      maxSlippage: 0.01,
      inputCommitment: { value: '0x123', blindingFactor: '0x456' },
      senderCommitment: { value: '0x789', blindingFactor: '0xabc' },
      recipientStealth: {
        stealthAddress: '0xstealth',
        ephemeralPublicKey: '0xephemeral',
        viewTag: '0x01',
      },
      fundingProof: { proof: '0xproof1', publicInputs: [] },
      validityProof: { proof: '0xproof2', publicInputs: [] },
      status: IntentStatus.PENDING,
      quotes: [],
    }

    const mockFulfillmentResult: FulfillmentResult = {
      intentId: 'intent-123',
      status: IntentStatus.FULFILLED,
      outputAmount: 1000000n,
      txHash: '0xtxhash',
      fulfilledAt: Math.floor(Date.now() / 1000),
    }

    it('should execute swap successfully with cached quote', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])
      mockSIPClient.createIntent.mockResolvedValue(mockIntent)
      mockSIPClient.execute.mockResolvedValue(mockFulfillmentResult)

      const { result } = renderHook(() => usePrivateSwap())

      // First fetch a quote
      await act(async () => {
        await result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
        })
      })

      // Then execute swap
      let swapResult
      await act(async () => {
        swapResult = await result.current.swap({
          input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
          output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      expect(swapResult).toEqual({
        txHash: mockFulfillmentResult.txHash,
        status: mockFulfillmentResult.status,
        outputAmount: mockFulfillmentResult.outputAmount,
        intentId: mockFulfillmentResult.intentId,
      })
      expect(result.current.status).toBe('completed')
      expect(mockSIPClient.execute).toHaveBeenCalledWith(mockIntent, mockQuote)
    })

    it('should execute swap without cached quote', async () => {
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])
      mockSIPClient.createIntent.mockResolvedValue(mockIntent)
      mockSIPClient.execute.mockResolvedValue(mockFulfillmentResult)

      const { result } = renderHook(() => usePrivateSwap())

      let swapResult
      await act(async () => {
        swapResult = await result.current.swap({
          input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
          output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      expect(mockSIPClient.getQuotes).toHaveBeenCalledTimes(1)
      expect(swapResult).toBeDefined()
    })

    it('should transition through status states correctly', async () => {
      mockSIPClient.createIntent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockIntent), 10))
      )
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])
      // Use longer delay for execute to ensure we can catch 'confirming' state
      mockSIPClient.execute.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockFulfillmentResult), 100))
      )

      const { result } = renderHook(() => usePrivateSwap())

      const statusChanges: string[] = []

      act(() => {
        result.current.swap({
          input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
          output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      // Should start with pending
      expect(result.current.status).toBe('pending')
      statusChanges.push(result.current.status)

      await waitFor(() => {
        expect(result.current.status).toBe('confirming')
      })
      statusChanges.push(result.current.status)

      await waitFor(() => {
        expect(result.current.status).toBe('completed')
      })
      statusChanges.push(result.current.status)

      expect(statusChanges).toContain('pending')
      expect(statusChanges).toContain('confirming')
      expect(statusChanges).toContain('completed')
    })

    it('should handle swap failure', async () => {
      const swapError = new Error('Swap execution failed')
      mockSIPClient.createIntent.mockResolvedValue(mockIntent)
      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])
      mockSIPClient.execute.mockRejectedValue(swapError)

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        try {
          await result.current.swap({
            input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
            output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
            privacyLevel: PrivacyLevel.SHIELDED,
          })
        } catch (err) {
          // Expected error
        }
      })

      expect(result.current.error).toEqual(swapError)
      expect(result.current.status).toBe('failed')
    })

    it('should handle no quotes available during swap', async () => {
      mockSIPClient.createIntent.mockResolvedValue(mockIntent)
      mockSIPClient.getQuotes.mockResolvedValue([])

      const { result } = renderHook(() => usePrivateSwap())

      await act(async () => {
        try {
          await result.current.swap({
            input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
            output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
            privacyLevel: PrivacyLevel.SHIELDED,
          })
        } catch (err) {
          // Expected error
        }
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toBe('No quotes available')
      expect(result.current.status).toBe('failed')
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const mockQuote: Quote = {
        quoteId: 'quote-123',
        intentId: 'intent-123',
        solverId: 'solver-1',
        outputAmount: 1000000n,
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: 5000n,
      }

      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])

      const { result } = renderHook(() => usePrivateSwap())

      // Fetch a quote first
      await act(async () => {
        await result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
        })
      })

      // Verify state is populated
      expect(result.current.quote).toEqual(mockQuote)

      // Reset
      act(() => {
        result.current.reset()
      })

      // Verify state is reset
      expect(result.current.quote).toBeNull()
      expect(result.current.status).toBe('idle')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should reset error state', async () => {
      mockSIPClient.getQuotes.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => usePrivateSwap())

      // Trigger an error
      await act(async () => {
        try {
          await result.current.fetchQuote({
            inputChain: 'solana',
            outputChain: 'ethereum',
            inputToken: 'SOL',
            outputToken: 'ETH',
            inputAmount: '1000000000',
          })
        } catch (err) {
          // Expected error
        }
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.status).toBe('failed')

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('isLoading state', () => {
    it('should set isLoading during fetchQuote', async () => {
      const mockQuote: Quote = {
        quoteId: 'quote-123',
        intentId: 'intent-123',
        solverId: 'solver-1',
        outputAmount: 1000000n,
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: 5000n,
      }

      mockSIPClient.getQuotes.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([mockQuote]), 100))
      )

      const { result } = renderHook(() => usePrivateSwap())

      act(() => {
        result.current.fetchQuote({
          inputChain: 'solana',
          outputChain: 'ethereum',
          inputToken: 'SOL',
          outputToken: 'ETH',
          inputAmount: '1000000000',
        })
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should set isLoading during swap', async () => {
      const mockQuote: Quote = {
        quoteId: 'quote-123',
        intentId: 'intent-123',
        solverId: 'solver-1',
        outputAmount: 1000000n,
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: 5000n,
      }

      const mockIntent: TrackedIntent = {
        intentId: 'intent-123',
        version: 'sip-v1',
        privacyLevel: PrivacyLevel.SHIELDED,
        createdAt: Date.now(),
        expiry: Date.now() + 300000,
        outputAsset: {
          chain: 'ethereum',
          symbol: 'ETH',
          address: null,
          decimals: 18,
        },
        minOutputAmount: 0n,
        maxSlippage: 0.01,
        inputCommitment: { value: '0x123', blindingFactor: '0x456' },
        senderCommitment: { value: '0x789', blindingFactor: '0xabc' },
        recipientStealth: {
          stealthAddress: '0xstealth',
          ephemeralPublicKey: '0xephemeral',
          viewTag: '0x01',
        },
        fundingProof: { proof: '0xproof1', publicInputs: [] },
        validityProof: { proof: '0xproof2', publicInputs: [] },
        status: IntentStatus.PENDING,
        quotes: [],
      }

      const mockFulfillmentResult: FulfillmentResult = {
        intentId: 'intent-123',
        status: IntentStatus.FULFILLED,
        outputAmount: 1000000n,
        txHash: '0xtxhash',
        fulfilledAt: Math.floor(Date.now() / 1000),
      }

      mockSIPClient.getQuotes.mockResolvedValue([mockQuote])
      mockSIPClient.createIntent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockIntent), 100))
      )
      mockSIPClient.execute.mockResolvedValue(mockFulfillmentResult)

      const { result } = renderHook(() => usePrivateSwap())

      act(() => {
        result.current.swap({
          input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
          output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
