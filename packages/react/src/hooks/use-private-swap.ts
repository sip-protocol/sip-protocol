import { useState, useCallback } from 'react'
import { useSIP } from './use-sip'
import type { Quote, PrivacyLevel, CreateIntentParams, TrackedIntent, FulfillmentResult, ChainId } from '@sip-protocol/types'

/**
 * Status of the swap lifecycle
 */
export type SwapStatus =
  | 'idle'
  | 'fetching_quote'
  | 'pending'
  | 'confirming'
  | 'completed'
  | 'failed'

/**
 * Parameters for fetching a quote
 */
export interface QuoteParams {
  /** Input chain */
  inputChain: string
  /** Output chain */
  outputChain: string
  /** Input token symbol */
  inputToken: string
  /** Output token symbol */
  outputToken: string
  /** Input amount (as string, in smallest unit) */
  inputAmount: string
  /** Privacy level (optional) */
  privacyLevel?: PrivacyLevel
  /** Maximum acceptable slippage (0-1, e.g. 0.01 = 1%) */
  maxSlippage?: number
}

/**
 * Parameters for executing a swap
 */
export interface SwapParams {
  /** Input asset details */
  input: {
    chain: string
    token: string
    amount: bigint
  }
  /** Output asset details */
  output: {
    chain: string
    token: string
    minAmount: bigint
  }
  /** Privacy level */
  privacyLevel: PrivacyLevel
  /** Maximum acceptable slippage (0-1, e.g. 0.01 = 1%) */
  maxSlippage?: number
}

/**
 * Result of a swap execution
 */
export interface SwapResult {
  /** Transaction hash (if available) */
  txHash?: string
  /** Status of the swap */
  status: string
  /** Output amount received */
  outputAmount?: bigint
  /** Intent ID */
  intentId: string
}

/**
 * usePrivateSwap - Execute private swaps with shielded intents
 *
 * @remarks
 * Hook for managing the complete lifecycle of a private swap:
 * - Fetch quotes from solvers
 * - Execute swaps with privacy
 * - Track swap status through completion
 * - Handle errors gracefully
 *
 * @example
 * ```tsx
 * import { usePrivateSwap } from '@sip-protocol/react'
 * import { PrivacyLevel } from '@sip-protocol/types'
 *
 * function MyComponent() {
 *   const { quote, fetchQuote, swap, status, isLoading, error, reset } = usePrivateSwap()
 *
 *   // Fetch a quote
 *   const handleGetQuote = async () => {
 *     await fetchQuote({
 *       inputChain: 'solana',
 *       outputChain: 'ethereum',
 *       inputToken: 'SOL',
 *       outputToken: 'ETH',
 *       inputAmount: '1000000000', // 1 SOL
 *     })
 *   }
 *
 *   // Execute the swap
 *   const handleSwap = async () => {
 *     const result = await swap({
 *       input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
 *       output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
 *       privacyLevel: PrivacyLevel.SHIELDED,
 *       maxSlippage: 0.01,
 *     })
 *   }
 * }
 * ```
 */
export function usePrivateSwap() {
  const { client: sip } = useSIP()

  // State
  const [quote, setQuote] = useState<Quote | null>(null)
  const [status, setStatus] = useState<SwapStatus>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Fetch a quote for the given parameters
   */
  const fetchQuote = useCallback(async (params: QuoteParams): Promise<void> => {
    if (!sip) {
      throw new Error('SIP client not initialized. Wrap your app with SIPProvider or call initialize().')
    }

    try {
      setStatus('fetching_quote')
      setIsLoading(true)
      setError(null)

      // Build CreateIntentParams from QuoteParams
      const intentParams: CreateIntentParams = {
        input: {
          asset: {
            chain: params.inputChain as ChainId,
            symbol: params.inputToken,
            address: null,
            decimals: 9, // Default, should be configurable
          },
          amount: BigInt(params.inputAmount),
        },
        output: {
          asset: {
            chain: params.outputChain as ChainId,
            symbol: params.outputToken,
            address: null,
            decimals: 18, // Default, should be configurable
          },
          minAmount: 0n,
          maxSlippage: params.maxSlippage ?? 0.01,
        },
        privacy: params.privacyLevel ?? 'shielded' as PrivacyLevel,
      }

      // Get quotes from SIP client
      const quotes = await sip.getQuotes(intentParams)

      if (quotes.length === 0) {
        throw new Error('No quotes available')
      }

      // Use the best quote (first one, assuming they're sorted)
      setQuote(quotes[0])
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch quote'))
      setStatus('failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sip])

  /**
   * Execute a swap with the given parameters
   */
  const swap = useCallback(async (params: SwapParams): Promise<SwapResult> => {
    if (!sip) {
      throw new Error('SIP client not initialized. Wrap your app with SIPProvider or call initialize().')
    }

    try {
      setStatus('pending')
      setIsLoading(true)
      setError(null)

      // Create the shielded intent
      const intentParams: CreateIntentParams = {
        input: {
          asset: {
            chain: params.input.chain as ChainId,
            symbol: params.input.token,
            address: null,
            decimals: 9, // Default, should be configurable
          },
          amount: params.input.amount,
        },
        output: {
          asset: {
            chain: params.output.chain as ChainId,
            symbol: params.output.token,
            address: null,
            decimals: 18, // Default, should be configurable
          },
          minAmount: params.output.minAmount,
          maxSlippage: params.maxSlippage ?? 0.01,
        },
        privacy: params.privacyLevel,
      }

      const intent: TrackedIntent = await sip.createIntent(intentParams)

      // Get quotes if we don't have one cached
      let swapQuote = quote
      if (!swapQuote) {
        const quotes = await sip.getQuotes(intentParams)
        if (quotes.length === 0) {
          throw new Error('No quotes available')
        }
        swapQuote = quotes[0]
      }

      setStatus('confirming')

      // Execute the swap
      const result: FulfillmentResult = await sip.execute(intent, swapQuote)

      setStatus('completed')

      return {
        txHash: result.txHash,
        status: result.status,
        outputAmount: result.outputAmount,
        intentId: result.intentId,
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Swap failed'))
      setStatus('failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sip, quote])

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setQuote(null)
    setStatus('idle')
    setIsLoading(false)
    setError(null)
  }, [])

  return {
    quote,
    fetchQuote,
    swap,
    status,
    isLoading,
    error,
    reset,
  }
}
