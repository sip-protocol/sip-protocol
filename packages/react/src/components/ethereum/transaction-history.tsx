/**
 * Ethereum Privacy Transaction History
 *
 * Component for displaying history of Ethereum privacy transactions.
 *
 * @module components/ethereum/transaction-history
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { ETHEREUM_NETWORKS, type EthereumNetwork } from './transaction-tracker'

/**
 * Transaction direction
 */
export type TransactionDirection = 'sent' | 'received' | 'claimed'

/**
 * Transaction type
 */
export type TransactionType = 'stealth_transfer' | 'standard_transfer' | 'claim'

/**
 * Privacy transaction history item
 */
export interface PrivacyTransactionHistoryItem {
  /** Transaction hash */
  hash: string
  /** Transaction direction */
  direction: TransactionDirection
  /** Transaction type */
  type: TransactionType
  /** Timestamp in milliseconds */
  timestamp: number
  /** Block number */
  blockNumber?: number
  /** From address */
  from: string
  /** To address (may be stealth address) */
  to: string
  /** Whether to address is stealth */
  isStealthAddress: boolean
  /** Amount in token units (string for precision) */
  amount: string
  /** Token symbol */
  tokenSymbol: string
  /** Token decimals */
  tokenDecimals: number
  /** USD value at time of transaction */
  usdValue?: string
  /** Current USD value */
  currentUsdValue?: string
  /** Gas used */
  gasUsed?: string
  /** Gas price in gwei */
  gasPrice?: string
  /** Transaction fee in ETH */
  fee?: string
  /** Status */
  status: 'pending' | 'confirmed' | 'failed'
  /** Ephemeral public key for stealth transactions */
  ephemeralPublicKey?: string
  /** View tag for efficient scanning */
  viewTag?: number
  /** Claim key (only for received/claimed) */
  claimKey?: string
}

/**
 * Filter options for transaction history
 */
export interface TransactionHistoryFilter {
  direction?: TransactionDirection | 'all'
  type?: TransactionType | 'all'
  status?: 'pending' | 'confirmed' | 'failed' | 'all'
  tokenSymbol?: string
  fromDate?: Date
  toDate?: Date
  minAmount?: string
  maxAmount?: string
}

/**
 * Sort options for transaction history
 */
export interface TransactionHistorySort {
  field: 'timestamp' | 'amount' | 'usdValue'
  direction: 'asc' | 'desc'
}

/**
 * TransactionHistory component props
 */
export interface TransactionHistoryProps {
  /** List of transactions */
  transactions: PrivacyTransactionHistoryItem[]
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Filter options */
  filter?: TransactionHistoryFilter
  /** Sort options */
  sort?: TransactionHistorySort
  /** Callback when filter changes */
  onFilterChange?: (filter: TransactionHistoryFilter) => void
  /** Callback when sort changes */
  onSortChange?: (sort: TransactionHistorySort) => void
  /** Callback to load more transactions */
  onLoadMore?: () => void
  /** Whether more transactions are available */
  hasMore?: boolean
  /** Callback to export transactions */
  onExport?: (format: 'csv' | 'json') => void
  /** Callback when transaction is selected */
  onTransactionSelect?: (tx: PrivacyTransactionHistoryItem) => void
  /** Network configuration */
  network?: string | EthereumNetwork
  /** Items per page for pagination */
  pageSize?: number
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show USD values */
  showUsdValues?: boolean
  /** Show filters */
  showFilters?: boolean
  /** Show export button */
  showExport?: boolean
}

/**
 * CSS styles for the component
 */
const styles = `
.sip-tx-history {
  font-family: system-ui, -apple-system, sans-serif;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.sip-tx-history[data-size="sm"] {
  border-radius: 8px;
}

.sip-tx-history[data-size="lg"] {
  border-radius: 16px;
}

/* Header */
.sip-tx-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.sip-tx-history[data-size="sm"] .sip-tx-history-header {
  padding: 12px 16px;
}

.sip-tx-history-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sip-tx-history-title svg {
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.sip-tx-history-title h2 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.sip-tx-history-actions {
  display: flex;
  gap: 8px;
}

/* Filter bar */
.sip-tx-history-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.sip-tx-history-filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sip-tx-history-filter-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.sip-tx-history-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: white;
  cursor: pointer;
}

.sip-tx-history-select:focus {
  outline: none;
  border-color: #6366f1;
}

/* Buttons */
.sip-tx-history-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sip-tx-history-btn svg {
  width: 16px;
  height: 16px;
}

.sip-tx-history-btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.sip-tx-history-btn-secondary:hover {
  background: #e5e7eb;
}

.sip-tx-history-btn-primary {
  background: #6366f1;
  color: white;
}

.sip-tx-history-btn-primary:hover {
  background: #4f46e5;
}

.sip-tx-history-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* List */
.sip-tx-history-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.sip-tx-history-empty {
  padding: 48px 20px;
  text-align: center;
  color: #6b7280;
}

.sip-tx-history-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.sip-tx-history-empty p {
  margin: 0;
  font-size: 14px;
}

/* Item */
.sip-tx-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.2s;
}

.sip-tx-history-item:last-child {
  border-bottom: none;
}

.sip-tx-history-item:hover {
  background: #f9fafb;
}

.sip-tx-history[data-size="sm"] .sip-tx-history-item {
  padding: 12px 16px;
}

.sip-tx-history-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.sip-tx-history-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.sip-tx-history-item-icon svg {
  width: 20px;
  height: 20px;
}

.sip-tx-history-item-icon[data-direction="sent"] {
  background: #fee2e2;
  color: #dc2626;
}

.sip-tx-history-item-icon[data-direction="received"] {
  background: #d1fae5;
  color: #059669;
}

.sip-tx-history-item-icon[data-direction="claimed"] {
  background: #dbeafe;
  color: #2563eb;
}

.sip-tx-history-item-details {
  flex: 1;
  min-width: 0;
}

.sip-tx-history-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.sip-tx-history-item-stealth-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-radius: 4px;
}

.sip-tx-history-item-stealth-badge svg {
  width: 10px;
  height: 10px;
}

.sip-tx-history-item-address {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sip-tx-history-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}

.sip-tx-history-item-status {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.sip-tx-history-item-status[data-status="pending"] {
  background: #fef3c7;
  color: #d97706;
}

.sip-tx-history-item-status[data-status="confirmed"] {
  background: #d1fae5;
  color: #059669;
}

.sip-tx-history-item-status[data-status="failed"] {
  background: #fee2e2;
  color: #dc2626;
}

.sip-tx-history-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.sip-tx-history-item-amount {
  font-size: 14px;
  font-weight: 600;
}

.sip-tx-history-item-amount[data-direction="sent"] {
  color: #dc2626;
}

.sip-tx-history-item-amount[data-direction="received"],
.sip-tx-history-item-amount[data-direction="claimed"] {
  color: #059669;
}

.sip-tx-history-item-usd {
  font-size: 12px;
  color: #6b7280;
}

/* Load more */
.sip-tx-history-load-more {
  padding: 16px 20px;
  text-align: center;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

/* Loading */
.sip-tx-history-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  color: #6b7280;
  font-size: 14px;
}

.sip-tx-history-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: sip-tx-history-spin 1s linear infinite;
}

@keyframes sip-tx-history-spin {
  to { transform: rotate(360deg); }
}

/* Error */
.sip-tx-history-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 20px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 14px;
}

.sip-tx-history-error svg {
  width: 20px;
  height: 20px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .sip-tx-history {
    background: #1f2937;
    border-color: #374151;
  }

  .sip-tx-history-header {
    background: #111827;
    border-color: #374151;
  }

  .sip-tx-history-title h2 {
    color: #f9fafb;
  }

  .sip-tx-history-filters {
    background: #111827;
    border-color: #374151;
  }

  .sip-tx-history-select {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }

  .sip-tx-history-item:hover {
    background: #111827;
  }

  .sip-tx-history-item-title {
    color: #f9fafb;
  }

  .sip-tx-history-item-address {
    color: #9ca3af;
  }

  .sip-tx-history-btn-secondary {
    background: #374151;
    color: #e5e7eb;
  }

  .sip-tx-history-btn-secondary:hover {
    background: #4b5563;
  }

  .sip-tx-history-empty {
    color: #9ca3af;
  }

  .sip-tx-history-load-more {
    background: #111827;
    border-color: #374151;
  }
}
`

/**
 * Icons
 */
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Format amount
 */
function formatAmount(amount: string, decimals: number, symbol: string): string {
  const value = parseFloat(amount) / Math.pow(10, decimals)
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  })
  return `${formatted} ${symbol}`
}

/**
 * Get direction label
 */
function getDirectionLabel(direction: TransactionDirection): string {
  switch (direction) {
    case 'sent':
      return 'Sent'
    case 'received':
      return 'Received'
    case 'claimed':
      return 'Claimed'
  }
}

/**
 * TransactionHistory - Display privacy transaction history
 *
 * @example Basic usage
 * ```tsx
 * import { TransactionHistory } from '@sip-protocol/react'
 *
 * function HistoryView() {
 *   const [transactions, setTransactions] = useState([])
 *
 *   return (
 *     <TransactionHistory
 *       transactions={transactions}
 *       onTransactionSelect={(tx) => console.log('Selected:', tx)}
 *       network="mainnet"
 *       showFilters
 *       showExport
 *     />
 *   )
 * }
 * ```
 */
export function TransactionHistory({
  transactions,
  isLoading = false,
  error = null,
  filter = { direction: 'all' },
  sort = { field: 'timestamp', direction: 'desc' },
  onFilterChange,
  onSortChange,
  onLoadMore,
  hasMore = false,
  onExport,
  onTransactionSelect,
  network = 'mainnet',
  pageSize = 20,
  className = '',
  size = 'md',
  showUsdValues = true,
  showFilters = true,
  showExport = true,
}: TransactionHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Resolve network config
  const networkConfig = useMemo((): EthereumNetwork => {
    if (typeof network === 'object') return network
    return ETHEREUM_NETWORKS[network] ?? ETHEREUM_NETWORKS.mainnet
  }, [network])

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions]

    // Apply filters
    if (filter.direction && filter.direction !== 'all') {
      result = result.filter((tx) => tx.direction === filter.direction)
    }
    if (filter.type && filter.type !== 'all') {
      result = result.filter((tx) => tx.type === filter.type)
    }
    if (filter.status && filter.status !== 'all') {
      result = result.filter((tx) => tx.status === filter.status)
    }
    if (filter.tokenSymbol) {
      result = result.filter((tx) => tx.tokenSymbol === filter.tokenSymbol)
    }
    if (filter.fromDate) {
      result = result.filter((tx) => tx.timestamp >= filter.fromDate!.getTime())
    }
    if (filter.toDate) {
      result = result.filter((tx) => tx.timestamp <= filter.toDate!.getTime())
    }

    // Apply sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sort.field) {
        case 'timestamp':
          cmp = a.timestamp - b.timestamp
          break
        case 'amount':
          cmp = parseFloat(a.amount) - parseFloat(b.amount)
          break
        case 'usdValue':
          cmp = parseFloat(a.usdValue || '0') - parseFloat(b.usdValue || '0')
          break
      }
      return sort.direction === 'asc' ? cmp : -cmp
    })

    return result
  }, [transactions, filter, sort])

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, currentPage * pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: keyof TransactionHistoryFilter, value: string) => {
      const newFilter = { ...filter, [key]: value }
      onFilterChange?.(newFilter)
      setCurrentPage(1)
    },
    [filter, onFilterChange]
  )

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (paginatedTransactions.length < filteredTransactions.length) {
      setCurrentPage((p) => p + 1)
    } else {
      onLoadMore?.()
    }
  }, [paginatedTransactions, filteredTransactions, onLoadMore])

  // Can load more
  const canLoadMore = useMemo(() => {
    return paginatedTransactions.length < filteredTransactions.length || hasMore
  }, [paginatedTransactions, filteredTransactions, hasMore])

  // Get explorer URL for transaction
  const getExplorerUrl = useCallback(
    (hash: string) => `${networkConfig.explorerUrl}/tx/${hash}`,
    [networkConfig]
  )

  return (
    <>
      <style>{styles}</style>

      <div className={`sip-tx-history ${className}`} data-size={size}>
        {/* Header */}
        <div className="sip-tx-history-header">
          <div className="sip-tx-history-title">
            <HistoryIcon />
            <h2>Transaction History</h2>
          </div>
          <div className="sip-tx-history-actions">
            {showExport && onExport && (
              <button
                type="button"
                className="sip-tx-history-btn sip-tx-history-btn-secondary"
                onClick={() => onExport('csv')}
                disabled={transactions.length === 0}
                aria-label="Export as CSV"
              >
                <DownloadIcon />
                Export
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="sip-tx-history-filters">
            <div className="sip-tx-history-filter-group">
              <span className="sip-tx-history-filter-label">Direction:</span>
              <select
                className="sip-tx-history-select"
                value={filter.direction || 'all'}
                onChange={(e) => handleFilterChange('direction', e.target.value)}
              >
                <option value="all">All</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
                <option value="claimed">Claimed</option>
              </select>
            </div>

            <div className="sip-tx-history-filter-group">
              <span className="sip-tx-history-filter-label">Status:</span>
              <select
                className="sip-tx-history-select"
                value={filter.status || 'all'}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="sip-tx-history-filter-group">
              <span className="sip-tx-history-filter-label">Sort:</span>
              <select
                className="sip-tx-history-select"
                value={`${sort.field}-${sort.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-') as [
                    TransactionHistorySort['field'],
                    TransactionHistorySort['direction']
                  ]
                  onSortChange?.({ field, direction })
                }}
              >
                <option value="timestamp-desc">Newest First</option>
                <option value="timestamp-asc">Oldest First</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
              </select>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="sip-tx-history-error" data-testid="error">
            <AlertIcon />
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && transactions.length === 0 && (
          <div className="sip-tx-history-loading" data-testid="loading">
            <div className="sip-tx-history-loading-spinner" />
            Loading transactions...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && transactions.length === 0 && !error && (
          <div className="sip-tx-history-empty" data-testid="empty">
            <HistoryIcon />
            <p>No transactions yet</p>
          </div>
        )}

        {/* Transaction list */}
        {paginatedTransactions.length > 0 && (
          <ul className="sip-tx-history-list" data-testid="transaction-list">
            {paginatedTransactions.map((tx) => (
              <li
                key={tx.hash}
                className="sip-tx-history-item"
                onClick={() => onTransactionSelect?.(tx)}
                data-testid={`tx-item-${tx.hash.slice(0, 8)}`}
              >
                <div className="sip-tx-history-item-left">
                  <div
                    className="sip-tx-history-item-icon"
                    data-direction={tx.direction}
                  >
                    {tx.direction === 'sent' ? (
                      <ArrowUpIcon />
                    ) : tx.direction === 'claimed' ? (
                      <CheckCircleIcon />
                    ) : (
                      <ArrowDownIcon />
                    )}
                  </div>
                  <div className="sip-tx-history-item-details">
                    <div className="sip-tx-history-item-title">
                      {getDirectionLabel(tx.direction)}
                      {tx.isStealthAddress && (
                        <span className="sip-tx-history-item-stealth-badge">
                          <ShieldIcon />
                          Stealth
                        </span>
                      )}
                    </div>
                    <div className="sip-tx-history-item-address">
                      {tx.direction === 'sent' ? 'To: ' : 'From: '}
                      <a
                        href={`${networkConfig.explorerUrl}/address/${tx.direction === 'sent' ? tx.to : tx.from}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {formatAddress(tx.direction === 'sent' ? tx.to : tx.from)}
                      </a>
                    </div>
                    <div className="sip-tx-history-item-meta">
                      <span className="sip-tx-history-item-status" data-status={tx.status}>
                        {tx.status}
                      </span>
                      <span>{formatTimestamp(tx.timestamp)}</span>
                      <a
                        href={getExplorerUrl(tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: '#6366f1', textDecoration: 'none' }}
                      >
                        View on Explorer
                      </a>
                    </div>
                  </div>
                </div>
                <div className="sip-tx-history-item-right">
                  <span
                    className="sip-tx-history-item-amount"
                    data-direction={tx.direction}
                  >
                    {tx.direction === 'sent' ? '-' : '+'}
                    {formatAmount(tx.amount, tx.tokenDecimals, tx.tokenSymbol)}
                  </span>
                  {showUsdValues && tx.usdValue && (
                    <span className="sip-tx-history-item-usd">
                      ${parseFloat(tx.usdValue).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Load more */}
        {canLoadMore && !isLoading && (
          <div className="sip-tx-history-load-more">
            <button
              type="button"
              className="sip-tx-history-btn sip-tx-history-btn-secondary"
              onClick={handleLoadMore}
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Hook for managing transaction history
 *
 * @example
 * ```tsx
 * const {
 *   transactions,
 *   isLoading,
 *   filter,
 *   setFilter,
 *   loadMore,
 *   refresh,
 *   exportHistory,
 * } = useTransactionHistory({
 *   viewingPrivateKey,
 *   spendingPublicKey,
 *   network: 'mainnet',
 * })
 * ```
 */
export function useTransactionHistory(options: {
  initialTransactions?: PrivacyTransactionHistoryItem[]
  fetchTransactions?: () => Promise<PrivacyTransactionHistoryItem[]>
  pageSize?: number
} = {}) {
  const {
    initialTransactions = [],
    fetchTransactions,
    pageSize = 20,
  } = options

  const [transactions, setTransactions] = useState<PrivacyTransactionHistoryItem[]>(
    initialTransactions
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TransactionHistoryFilter>({ direction: 'all' })
  const [sort, setSort] = useState<TransactionHistorySort>({
    field: 'timestamp',
    direction: 'desc',
  })
  const [hasMore, setHasMore] = useState(true)

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!fetchTransactions) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchTransactions()
      setTransactions(result)
      setHasMore(result.length >= pageSize)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }, [fetchTransactions, pageSize])

  // Load on mount
  useEffect(() => {
    if (fetchTransactions && initialTransactions.length === 0) {
      loadTransactions()
    }
  }, [fetchTransactions, initialTransactions.length, loadTransactions])

  // Add transaction
  const addTransaction = useCallback((tx: PrivacyTransactionHistoryItem) => {
    setTransactions((prev) => [tx, ...prev])
  }, [])

  // Update transaction
  const updateTransaction = useCallback(
    (hash: string, updates: Partial<PrivacyTransactionHistoryItem>) => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.hash === hash ? { ...tx, ...updates } : tx))
      )
    },
    []
  )

  // Export history
  const exportHistory = useCallback(
    (format: 'csv' | 'json') => {
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(transactions, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sip-transactions-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // CSV export
        const headers = [
          'Hash',
          'Direction',
          'Type',
          'Timestamp',
          'From',
          'To',
          'Amount',
          'Token',
          'USD Value',
          'Status',
          'Stealth',
        ]
        const rows = transactions.map((tx) => [
          tx.hash,
          tx.direction,
          tx.type,
          new Date(tx.timestamp).toISOString(),
          tx.from,
          tx.to,
          (parseFloat(tx.amount) / Math.pow(10, tx.tokenDecimals)).toString(),
          tx.tokenSymbol,
          tx.usdValue || '',
          tx.status,
          tx.isStealthAddress ? 'Yes' : 'No',
        ])

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sip-transactions-${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    },
    [transactions]
  )

  // Get summary statistics
  const summary = useMemo(() => {
    const sent = transactions.filter((tx) => tx.direction === 'sent')
    const received = transactions.filter((tx) => tx.direction === 'received')
    const claimed = transactions.filter((tx) => tx.direction === 'claimed')
    const stealth = transactions.filter((tx) => tx.isStealthAddress)

    return {
      total: transactions.length,
      sent: sent.length,
      received: received.length,
      claimed: claimed.length,
      stealthCount: stealth.length,
      stealthPercentage: transactions.length > 0
        ? Math.round((stealth.length / transactions.length) * 100)
        : 0,
    }
  }, [transactions])

  return {
    transactions,
    setTransactions,
    isLoading,
    error,
    filter,
    setFilter,
    sort,
    setSort,
    hasMore,
    setHasMore,
    loadTransactions,
    addTransaction,
    updateTransaction,
    exportHistory,
    summary,
  }
}

export default TransactionHistory
