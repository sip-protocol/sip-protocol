import { useState, useCallback, useRef, useMemo } from 'react'
import {
  PrivacyAdvisorAgent,
  createPrivacyAdvisor,
  createSurveillanceAnalyzer,
} from '@sip-protocol/sdk'
import type {
  PrivacyAdvisorConfig,
  AdvisoryContext,
  AdvisorResponse,
  PrivacyAdvisoryReport,
  AdvisorMessage,
  AdvisorStatus,
  FullAnalysisResult,
} from '@sip-protocol/sdk'

/**
 * Parameters for usePrivacyAdvisor hook
 */
export interface UsePrivacyAdvisorParams {
  /** OpenAI API key for the advisor */
  openaiApiKey: string
  /** Helius API key for wallet analysis */
  heliusApiKey: string
  /** Model to use (default: gpt-4o-mini for cost efficiency) */
  model?: PrivacyAdvisorConfig['model']
  /** Temperature for responses (0-1, default: 0.3) */
  temperature?: number
  /** Enable streaming responses */
  enableStreaming?: boolean
  /** Solana cluster */
  cluster?: 'mainnet-beta' | 'devnet'
}

/**
 * Return type for usePrivacyAdvisor hook
 */
export interface UsePrivacyAdvisorReturn {
  /** Current advisor status */
  status: AdvisorStatus
  /** Whether the advisor is processing */
  isLoading: boolean
  /** Error message if operation failed */
  error: Error | null
  /** Conversation messages */
  messages: AdvisorMessage[]
  /** Current privacy report (if generated) */
  report: PrivacyAdvisoryReport | null
  /** Current analysis result (if analyzed) */
  analysisResult: FullAnalysisResult | null
  /** Suggested follow-up questions */
  suggestedQuestions: string[]
  /** Total cost of API calls in this session */
  totalCost: number
  /** Analyze a wallet and get recommendations */
  analyzeWallet: (walletAddress: string, query?: string) => Promise<AdvisorResponse | null>
  /** Send a chat message (follow-up question) */
  chat: (message: string) => Promise<AdvisorResponse | null>
  /** Clear conversation history and reset */
  reset: () => void
  /** Clear error */
  clearError: () => void
}

/**
 * usePrivacyAdvisor - AI-powered privacy recommendations for Solana wallets
 *
 * @remarks
 * This hook provides a React-friendly interface for the Privacy Advisor Agent.
 * It combines wallet surveillance analysis with LangChain-powered AI recommendations.
 *
 * Features:
 * - Analyze any Solana wallet's privacy exposure
 * - Get AI-generated recommendations in plain English
 * - Chat for follow-up questions
 * - Track API costs
 * - Streaming support for real-time responses
 *
 * @param params - Hook configuration parameters
 *
 * @example
 * ```tsx
 * import { usePrivacyAdvisor } from '@sip-protocol/react'
 *
 * function PrivacyDashboard() {
 *   const {
 *     status,
 *     messages,
 *     report,
 *     suggestedQuestions,
 *     analyzeWallet,
 *     chat,
 *   } = usePrivacyAdvisor({
 *     openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
 *     heliusApiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
 *   })
 *
 *   const handleAnalyze = async () => {
 *     await analyzeWallet('7xK9abc123...', 'What should I fix first?')
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleAnalyze} disabled={status !== 'idle'}>
 *         Analyze My Wallet
 *       </button>
 *
 *       {report && (
 *         <div>
 *           <h2>Privacy Score: {report.currentScore}/100</h2>
 *           <p>{report.summary}</p>
 *
 *           <h3>Recommendations</h3>
 *           {report.recommendations.map((rec) => (
 *             <div key={rec.id}>
 *               <h4>{rec.title}</h4>
 *               <p>{rec.explanation}</p>
 *               <ul>
 *                 {rec.actions.map((action, i) => (
 *                   <li key={i}>{action}</li>
 *                 ))}
 *               </ul>
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *
 *       <h3>Follow-up Questions</h3>
 *       {suggestedQuestions.map((q, i) => (
 *         <button key={i} onClick={() => chat(q)}>
 *           {q}
 *         </button>
 *       ))}
 *
 *       <h3>Conversation</h3>
 *       {messages.map((msg, i) => (
 *         <div key={i} className={msg.role}>
 *           {msg.content}
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function usePrivacyAdvisor(
  params: UsePrivacyAdvisorParams
): UsePrivacyAdvisorReturn {
  const {
    openaiApiKey,
    heliusApiKey,
    model = 'gpt-4o-mini',
    temperature = 0.3,
    enableStreaming = false,
    cluster = 'mainnet-beta',
  } = params

  const [status, setStatus] = useState<AdvisorStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [messages, setMessages] = useState<AdvisorMessage[]>([])
  const [report, setReport] = useState<PrivacyAdvisoryReport | null>(null)
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [totalCost, setTotalCost] = useState(0)

  // Memoize agent instances
  const advisor = useMemo(
    () =>
      createPrivacyAdvisor({
        openaiApiKey,
        model,
        temperature,
      }),
    [openaiApiKey, model, temperature]
  )

  const analyzer = useMemo(
    () =>
      createSurveillanceAnalyzer({
        heliusApiKey,
        cluster,
      }),
    [heliusApiKey, cluster]
  )

  // Keep reference to latest analysis for chat context
  const analysisRef = useRef<FullAnalysisResult | null>(null)

  const isLoading = status === 'analyzing' || status === 'thinking' || status === 'responding'

  /**
   * Analyze a wallet and get recommendations
   */
  const analyzeWallet = useCallback(
    async (
      walletAddress: string,
      query?: string
    ): Promise<AdvisorResponse | null> => {
      setStatus('analyzing')
      setError(null)

      try {
        // First, run surveillance analysis
        const analysis = await analyzer.analyze(walletAddress)
        setAnalysisResult(analysis)
        analysisRef.current = analysis

        setStatus('thinking')

        // Build context for advisor
        const context: AdvisoryContext = {
          analysisResult: analysis,
          userQuery: query,
        }

        let response: AdvisorResponse

        if (enableStreaming) {
          // Stream response
          setStatus('responding')
          let streamedContent = ''

          response = await advisor.stream(context, (chunk) => {
            streamedContent += chunk
            // Update messages with partial content
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.role !== 'assistant' || m.content !== streamedContent.slice(0, -chunk.length))
              return [
                ...filtered,
                {
                  role: 'assistant' as const,
                  content: streamedContent,
                  timestamp: Date.now(),
                },
              ]
            })
          })
        } else {
          // Regular response
          setStatus('responding')
          response = await advisor.analyze(context)
        }

        // Update state
        if (response.report) {
          setReport(response.report)
        }

        if (response.suggestedQuestions) {
          setSuggestedQuestions(response.suggestedQuestions)
        }

        if (response.usage) {
          setTotalCost((prev) => prev + response.usage!.estimatedCost)
        }

        // Add messages
        setMessages((prev) => [
          ...prev,
          {
            role: 'user' as const,
            content: query || `Analyze wallet ${walletAddress}`,
            timestamp: Date.now(),
          },
          {
            role: 'assistant' as const,
            content: response.message,
            timestamp: Date.now(),
          },
        ])

        setStatus('idle')
        return response
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Analysis failed')
        setError(error)
        setStatus('error')
        return null
      }
    },
    [advisor, analyzer, enableStreaming]
  )

  /**
   * Send a chat message (follow-up question)
   */
  const chat = useCallback(
    async (message: string): Promise<AdvisorResponse | null> => {
      setStatus('thinking')
      setError(null)

      try {
        // Build context with latest analysis if available
        const context: AdvisoryContext | undefined = analysisRef.current
          ? { analysisResult: analysisRef.current }
          : undefined

        setStatus('responding')
        const response = await advisor.chat(message, context)

        if (response.usage) {
          setTotalCost((prev) => prev + response.usage!.estimatedCost)
        }

        // Add messages
        setMessages((prev) => [
          ...prev,
          {
            role: 'user' as const,
            content: message,
            timestamp: Date.now(),
          },
          {
            role: 'assistant' as const,
            content: response.message,
            timestamp: Date.now(),
          },
        ])

        setStatus('idle')
        return response
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Chat failed')
        setError(error)
        setStatus('error')
        return null
      }
    },
    [advisor]
  )

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setMessages([])
    setReport(null)
    setAnalysisResult(null)
    setSuggestedQuestions([])
    setTotalCost(0)
    analysisRef.current = null
    advisor.clearHistory()
  }, [advisor])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
    if (status === 'error') {
      setStatus('idle')
    }
  }, [status])

  return {
    status,
    isLoading,
    error,
    messages,
    report,
    analysisResult,
    suggestedQuestions,
    totalCost,
    analyzeWallet,
    chat,
    reset,
    clearError,
  }
}
