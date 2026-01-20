import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getTransactionHistory,
  exportTransactions,
  getTransactionSummary,
} from '@sip-protocol/sdk'
import type {
  NEARHistoricalTransaction,
  NEARTransactionHistoryParams,
  NEARTransactionHistoryResult,
  NEARTransactionType,
  NEARExportFormat,
} from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'

/**
 * History fetch status states
 */
export type HistoryStatus = 'idle' | 'loading' | 'success' | 'error' | 'refreshing'

/**
 * Parameters for useTransactionHistory hook
 */
export interface UseTransactionHistoryParams {
  /** NEAR RPC URL */
  rpcUrl: string
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Network type */
  network?: 'mainnet' | 'testnet'
  /** Number of transactions per page */
  pageSize?: number
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number
  /** Initial type filter */
  typeFilter?: NEARTransactionType[]
  /** Initial token filter */
  tokenFilter?: (string | null)[]
}

/**
 * Filter state for transaction history
 */
export interface HistoryFilters {
  /** Filter by transaction types */
  typeFilter?: NEARTransactionType[]
  /** Filter by token contracts */
  tokenFilter?: (string | null)[]
  /** Filter by date range start (ms) */
  fromTimestamp?: number
  /** Filter by date range end (ms) */
  toTimestamp?: number
  /** Search query (hash or address) */
  searchQuery?: string
}

/**
 * Transaction summary statistics
 */
export interface TransactionSummary {
  /** Total received amounts by token */
  totalReceived: Record<string, bigint>
  /** Total sent amounts by token */
  totalSent: Record<string, bigint>
  /** Total transaction count */
  transactionCount: number
  /** Unique addresses involved */
  uniqueAddresses: number
  /** Date range of transactions */
  dateRange: { from: number; to: number } | null
}

/**
 * Return type for useTransactionHistory hook
 */
export interface UseTransactionHistoryReturn {
  /** Current fetch status */
  status: HistoryStatus
  /** Whether initial load is in progress */
  isLoading: boolean
  /** Whether refresh is in progress */
  isRefreshing: boolean
  /** Error if fetch failed */
  error: Error | null
  /** Transaction history */
  transactions: NEARHistoricalTransaction[]
  /** Whether more transactions are available */
  hasMore: boolean
  /** Current page number (0-indexed) */
  page: number
  /** Total transactions found */
  totalCount: number
  /** Last refresh timestamp */
  lastRefreshedAt: Date | null
  /** Time taken for last fetch (ms) */
  fetchTimeMs: number
  /** Transaction summary statistics */
  summary: TransactionSummary | null
  /** Current filters */
  filters: HistoryFilters
  /** Fetch initial page or refresh */
  refresh: () => Promise<void>
  /** Load next page */
  loadMore: () => Promise<void>
  /** Update filters */
  setFilters: (filters: HistoryFilters) => void
  /** Clear filters */
  clearFilters: () => void
  /** Export transactions */
  exportData: (format: NEARExportFormat, options?: { prettyPrint?: boolean }) => string
  /** Search transactions */
  search: (query: string) => void
  /** Clear error */
  clearError: () => void
  /** Reset to initial state */
  reset: () => void
}

/**
 * useTransactionHistory - View NEAR privacy transaction history
 *
 * @remarks
 * This hook provides a React-friendly interface for viewing transaction history
 * of NEAR privacy operations. It supports pagination, filtering, and export.
 *
 * Features:
 * - Paginated transaction history
 * - Filter by type, token, date range
 * - Search by hash or address
 * - Export to CSV/JSON
 * - Auto-refresh with configurable interval
 * - Transaction summary statistics
 *
 * @example Basic usage
 * ```tsx
 * function TransactionHistory() {
 *   const {
 *     transactions,
 *     isLoading,
 *     hasMore,
 *     loadMore,
 *     refresh,
 *   } = useTransactionHistory({
 *     rpcUrl: 'https://rpc.mainnet.near.org',
 *     viewingPrivateKey: '0x...',
 *     spendingPrivateKey: '0x...',
 *   })
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       {transactions.map(tx => (
 *         <div key={tx.hash}>
 *           {tx.type}: {tx.amountFormatted} {tx.token}
 *         </div>
 *       ))}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example With filtering
 * ```tsx
 * const { transactions, setFilters, filters } = useTransactionHistory(params)
 *
 * // Filter by type
 * setFilters({ ...filters, typeFilter: ['receive'] })
 *
 * // Filter by date range
 * setFilters({
 *   ...filters,
 *   fromTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // last 7 days
 * })
 * ```
 *
 * @param params - Hook configuration parameters
 * @returns Transaction history state and actions
 */
export function useTransactionHistory(
  params: UseTransactionHistoryParams
): UseTransactionHistoryReturn {
  const {
    rpcUrl,
    viewingPrivateKey,
    spendingPrivateKey,
    network = 'mainnet',
    pageSize = 20,
    refreshInterval = 0,
    typeFilter: initialTypeFilter,
    tokenFilter: initialTokenFilter,
  } = params

  // State
  const [status, setStatus] = useState<HistoryStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [transactions, setTransactions] = useState<NEARHistoricalTransaction[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [fetchTimeMs, setFetchTimeMs] = useState(0)
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [filters, setFiltersState] = useState<HistoryFilters>({
    typeFilter: initialTypeFilter,
    tokenFilter: initialTokenFilter,
  })

  // Refs
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Derived state
  const isLoading = status === 'loading'
  const isRefreshing = status === 'refreshing'

  /**
   * Fetch transaction history
   */
  const fetchHistory = useCallback(async (
    isRefresh: boolean = false,
    loadMoreCursor?: string
  ): Promise<NEARTransactionHistoryResult | null> => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setStatus(isRefresh ? 'refreshing' : 'loading')
    setError(null)

    try {
      const fetchParams: NEARTransactionHistoryParams = {
        rpcUrl,
        viewingPrivateKey,
        spendingPrivateKey,
        network,
        limit: pageSize,
        cursor: loadMoreCursor,
        typeFilter: filters.typeFilter,
        tokenFilter: filters.tokenFilter,
        fromTimestamp: filters.fromTimestamp,
        toTimestamp: filters.toTimestamp,
        searchQuery: filters.searchQuery,
      }

      const result = await getTransactionHistory(fetchParams)

      if (loadMoreCursor) {
        // Append to existing
        setTransactions(prev => [...prev, ...result.transactions])
        setPage(prev => prev + 1)
      } else {
        // Replace
        setTransactions(result.transactions)
        setPage(0)
        // Calculate summary
        const newSummary = getTransactionSummary(result.transactions)
        setSummary(newSummary)
      }

      setHasMore(result.hasMore)
      setCursor(result.nextCursor)
      setTotalCount(result.totalCount)
      setFetchTimeMs(result.scanTimeMs)
      setLastRefreshedAt(new Date())
      setStatus('success')

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setStatus('error')
      return null
    }
  }, [
    rpcUrl,
    viewingPrivateKey,
    spendingPrivateKey,
    network,
    pageSize,
    filters,
  ])

  /**
   * Refresh (fetch first page)
   */
  const refresh = useCallback(async () => {
    setCursor(undefined)
    await fetchHistory(true)
  }, [fetchHistory])

  /**
   * Load next page
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isRefreshing) return
    await fetchHistory(false, cursor)
  }, [hasMore, isLoading, isRefreshing, cursor, fetchHistory])

  /**
   * Update filters
   */
  const setFilters = useCallback((newFilters: HistoryFilters) => {
    setFiltersState(newFilters)
    // Reset pagination when filters change
    setCursor(undefined)
    setPage(0)
  }, [])

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFiltersState({})
    setCursor(undefined)
    setPage(0)
  }, [])

  /**
   * Search transactions
   */
  const search = useCallback((query: string) => {
    setFiltersState(prev => ({
      ...prev,
      searchQuery: query || undefined,
    }))
    setCursor(undefined)
    setPage(0)
  }, [])

  /**
   * Export transactions to CSV or JSON
   */
  const exportData = useCallback((
    format: NEARExportFormat,
    options?: { prettyPrint?: boolean }
  ): string => {
    return exportTransactions(transactions, {
      format,
      prettyPrint: options?.prettyPrint,
    })
  }, [transactions])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null)
    if (status === 'error') {
      setStatus('idle')
    }
  }, [status])

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setTransactions([])
    setHasMore(false)
    setPage(0)
    setTotalCount(0)
    setCursor(undefined)
    setLastRefreshedAt(null)
    setFetchTimeMs(0)
    setSummary(null)
    setFiltersState({
      typeFilter: initialTypeFilter,
      tokenFilter: initialTokenFilter,
    })
  }, [initialTypeFilter, initialTokenFilter])

  // Auto-refresh effect
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refresh()
      }, refreshInterval)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [refreshInterval, refresh])

  // Initial fetch when filters change
  useEffect(() => {
    fetchHistory(false)
  }, [filters])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    status,
    isLoading,
    isRefreshing,
    error,
    transactions,
    hasMore,
    page,
    totalCount,
    lastRefreshedAt,
    fetchTimeMs,
    summary,
    filters,
    refresh,
    loadMore,
    setFilters,
    clearFilters,
    exportData,
    search,
    clearError,
    reset,
  }
}
