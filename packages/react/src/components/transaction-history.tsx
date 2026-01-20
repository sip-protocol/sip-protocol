import React, { useState, useCallback, useMemo } from 'react'
import type { HexString } from '@sip-protocol/types'
import { useTransactionHistory } from '../hooks/use-transaction-history'
import type { TransactionSummary } from '../hooks/use-transaction-history'

/**
 * Transaction type for NEAR privacy operations
 */
type NEARTransactionType = 'send' | 'receive' | 'contract_call'

/**
 * Export format options
 */
type NEARExportFormat = 'csv' | 'json'

/**
 * Historical transaction structure
 */
interface NEARHistoricalTransaction {
  hash: string
  timestamp: number
  blockHeight: number
  type: NEARTransactionType
  stealthAddress: string
  stealthPublicKey: HexString
  ephemeralPublicKey: HexString
  viewTag: number
  amount: string
  amountFormatted: string
  token: string
  tokenContract: string | null
  decimals: number
  privacyLevel: 'transparent' | 'shielded' | 'compliant'
  amountRevealed: boolean
  sender?: string
  receiver?: string
  fee?: string
  explorerUrl: string
  recipientLabel?: string
}

/**
 * Transaction history view component props
 */
export interface TransactionHistoryViewProps {
  /** NEAR RPC URL */
  rpcUrl: string
  /** Viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Spending private key (hex) */
  spendingPrivateKey: HexString
  /** Network type */
  network?: 'mainnet' | 'testnet'
  /** Number of transactions per page */
  pageSize?: number
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number
  /** Whether to show filter controls */
  showFilters?: boolean
  /** Whether to show export button */
  showExport?: boolean
  /** Whether to show summary statistics */
  showSummary?: boolean
  /** Whether to show search */
  showSearch?: boolean
  /** Callback when transaction is clicked */
  onTransactionClick?: (tx: NEARHistoricalTransaction) => void
  /** Callback when export is triggered */
  onExport?: (format: NEARExportFormat, data: string) => void
  /** Custom class name */
  className?: string
  /** Theme */
  theme?: 'light' | 'dark'
}

/**
 * Default styles for the component
 */
const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  controls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  filterBar: {
    padding: '12px 16px',
    borderBottom: '1px solid',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '14px',
    minWidth: '200px',
  },
  filterSelect: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '14px',
    cursor: 'pointer',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    border: '1px solid',
  },
  list: {
    maxHeight: '500px',
    overflowY: 'auto' as const,
  },
  listItem: {
    padding: '16px',
    borderBottom: '1px solid',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  listItemHover: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  txRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  txRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    gap: '4px',
  },
  txType: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
  txTypeReceive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  txTypeSend: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  txTypeCall: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
  },
  txAmount: {
    fontSize: '16px',
    fontWeight: 600,
  },
  txToken: {
    fontSize: '14px',
    opacity: 0.7,
  },
  txHash: {
    fontSize: '12px',
    fontFamily: 'monospace',
    opacity: 0.6,
  },
  txTime: {
    fontSize: '12px',
    opacity: 0.6,
  },
  privacyBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
  },
  privacyShielded: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  privacyCompliant: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  summary: {
    padding: '16px',
    borderBottom: '1px solid',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    opacity: 0.6,
    textTransform: 'uppercase' as const,
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 600,
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    opacity: 0.6,
  },
  error: {
    padding: '16px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '6px',
    margin: '16px',
  },
  empty: {
    padding: '40px',
    textAlign: 'center' as const,
    opacity: 0.6,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagination: {
    fontSize: '14px',
    opacity: 0.7,
  },
  light: {
    backgroundColor: '#ffffff',
    color: '#1f2937',
    borderColor: '#e5e7eb',
  },
  dark: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    borderColor: '#374151',
  },
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Truncate hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

/**
 * Transaction list item component
 */
interface TransactionItemProps {
  transaction: NEARHistoricalTransaction
  onClick?: (tx: NEARHistoricalTransaction) => void
  theme: 'light' | 'dark'
}

function TransactionItem({ transaction, onClick, theme }: TransactionItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const themeStyles = theme === 'dark' ? styles.dark : styles.light

  const typeStyleMap: Record<NEARTransactionType, React.CSSProperties> = {
    receive: styles.txTypeReceive,
    send: styles.txTypeSend,
    contract_call: styles.txTypeCall,
  }
  const typeStyle = typeStyleMap[transaction.type]

  const privacyStyle = transaction.privacyLevel === 'compliant'
    ? styles.privacyCompliant
    : styles.privacyShielded

  return (
    <div
      style={{
        ...styles.listItem,
        borderColor: themeStyles.borderColor,
        ...(isHovered ? styles.listItemHover : {}),
      }}
      onClick={() => onClick?.(transaction)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.txRow}>
        <div style={styles.txLeft}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ ...styles.txType, ...typeStyle }}>
              {transaction.type}
            </span>
            <span style={{ ...styles.privacyBadge, ...privacyStyle }}>
              {transaction.privacyLevel}
            </span>
          </div>
          <span style={styles.txHash} title={transaction.hash}>
            {truncateHash(transaction.hash)}
          </span>
          <span style={styles.txTime}>
            {formatDate(transaction.timestamp)}
          </span>
        </div>
        <div style={styles.txRight}>
          <span style={styles.txAmount}>
            {transaction.type === 'send' ? '-' : '+'}{transaction.amountFormatted}
          </span>
          <span style={styles.txToken}>{transaction.token}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Summary statistics component
 */
interface SummaryViewProps {
  summary: TransactionSummary
  theme: 'light' | 'dark'
}

function SummaryView({ summary, theme }: SummaryViewProps) {
  const themeStyles = theme === 'dark' ? styles.dark : styles.light

  return (
    <div style={{ ...styles.summary, borderColor: themeStyles.borderColor }}>
      <div style={styles.summaryItem}>
        <span style={styles.summaryLabel}>Transactions</span>
        <span style={styles.summaryValue}>{summary.transactionCount}</span>
      </div>
      <div style={styles.summaryItem}>
        <span style={styles.summaryLabel}>Total Received</span>
        <span style={styles.summaryValue}>
          {Object.entries(summary.totalReceived).map(([token, amount]) => (
            <span key={token}>{amount.toString()} {token}</span>
          ))}
          {Object.keys(summary.totalReceived).length === 0 && '0'}
        </span>
      </div>
      <div style={styles.summaryItem}>
        <span style={styles.summaryLabel}>Addresses</span>
        <span style={styles.summaryValue}>{summary.uniqueAddresses}</span>
      </div>
      {summary.dateRange && (
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Date Range</span>
          <span style={{ fontSize: '14px' }}>
            {formatDate(summary.dateRange.from).split(',')[0]} - {formatDate(summary.dateRange.to).split(',')[0]}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * TransactionHistoryView - Display NEAR privacy transaction history
 *
 * A comprehensive component for viewing, filtering, and exporting
 * NEAR privacy transaction history.
 *
 * @example Basic usage
 * ```tsx
 * <TransactionHistoryView
 *   rpcUrl="https://rpc.mainnet.near.org"
 *   viewingPrivateKey="0x..."
 *   spendingPrivateKey="0x..."
 * />
 * ```
 *
 * @example With callbacks
 * ```tsx
 * <TransactionHistoryView
 *   rpcUrl="https://rpc.mainnet.near.org"
 *   viewingPrivateKey="0x..."
 *   spendingPrivateKey="0x..."
 *   onTransactionClick={(tx) => openInExplorer(tx.explorerUrl)}
 *   onExport={(format, data) => downloadFile(`transactions.${format}`, data)}
 *   showFilters
 *   showExport
 *   showSummary
 * />
 * ```
 */
export function TransactionHistoryView({
  rpcUrl,
  viewingPrivateKey,
  spendingPrivateKey,
  network = 'mainnet',
  pageSize = 20,
  refreshInterval = 0,
  showFilters = true,
  showExport = true,
  showSummary = true,
  showSearch = true,
  onTransactionClick,
  onExport,
  className,
  theme = 'light',
}: TransactionHistoryViewProps) {
  const {
    status,
    isLoading,
    isRefreshing,
    error,
    transactions,
    hasMore,
    totalCount,
    lastRefreshedAt,
    summary,
    filters,
    refresh,
    loadMore,
    setFilters,
    clearFilters,
    exportData,
    search,
    clearError,
  } = useTransactionHistory({
    rpcUrl,
    viewingPrivateKey,
    spendingPrivateKey,
    network,
    pageSize,
    refreshInterval,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [exportFormat, setExportFormat] = useState<NEARExportFormat>('csv')

  const themeStyles = theme === 'dark' ? styles.dark : styles.light

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    // Debounce search
    const timeoutId = setTimeout(() => {
      search(query)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [search])

  const handleTypeFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const typeFilter: NEARTransactionType[] | undefined = value ? [value as NEARTransactionType] : undefined
    setFilters({ ...filters, typeFilter })
  }, [filters, setFilters])

  const handleExport = useCallback(() => {
    const data = exportData(exportFormat, { prettyPrint: exportFormat === 'json' })
    onExport?.(exportFormat, data)
  }, [exportData, exportFormat, onExport])

  const containerStyle = useMemo(() => ({
    ...styles.container,
    ...themeStyles,
    border: `1px solid ${themeStyles.borderColor}`,
  }), [themeStyles])

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={{ ...styles.header, borderColor: themeStyles.borderColor }}>
        <h2 style={styles.title}>Transaction History</h2>
        <div style={styles.controls}>
          {lastRefreshedAt && (
            <span style={{ fontSize: '12px', opacity: 0.6 }}>
              Last updated: {formatDate(lastRefreshedAt.getTime())}
            </span>
          )}
          <button
            style={{ ...styles.button, ...styles.secondaryButton, borderColor: themeStyles.borderColor }}
            onClick={refresh}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div style={{ ...styles.filterBar, borderColor: themeStyles.borderColor }}>
          {showSearch && (
            <input
              type="text"
              placeholder="Search by hash or address..."
              value={searchQuery}
              onChange={handleSearch}
              style={{ ...styles.searchInput, borderColor: themeStyles.borderColor, backgroundColor: themeStyles.backgroundColor }}
            />
          )}
          <select
            value={filters.typeFilter?.[0] || ''}
            onChange={handleTypeFilter}
            style={{ ...styles.filterSelect, borderColor: themeStyles.borderColor, backgroundColor: themeStyles.backgroundColor }}
          >
            <option value="">All Types</option>
            <option value="receive">Receive</option>
            <option value="send">Send</option>
            <option value="contract_call">Contract Call</option>
          </select>
          {(filters.typeFilter || filters.searchQuery) && (
            <button
              style={{ ...styles.button, ...styles.secondaryButton, borderColor: themeStyles.borderColor }}
              onClick={() => { clearFilters(); setSearchQuery('') }}
            >
              Clear Filters
            </button>
          )}
          {showExport && transactions.length > 0 && (
            <>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as NEARExportFormat)}
                style={{ ...styles.filterSelect, borderColor: themeStyles.borderColor, backgroundColor: themeStyles.backgroundColor }}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleExport}
              >
                Export
              </button>
            </>
          )}
        </div>
      )}

      {/* Summary */}
      {showSummary && summary && summary.transactionCount > 0 && (
        <SummaryView summary={summary} theme={theme} />
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error.message}
          <button
            style={{ marginLeft: '8px', textDecoration: 'underline', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit' }}
            onClick={clearError}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && status !== 'refreshing' && (
        <div style={styles.loading}>Loading transactions...</div>
      )}

      {/* Empty State */}
      {!isLoading && transactions.length === 0 && !error && (
        <div style={styles.empty}>
          No transactions found.
          {filters.searchQuery || filters.typeFilter ? ' Try adjusting your filters.' : ''}
        </div>
      )}

      {/* Transaction List */}
      {transactions.length > 0 && (
        <div style={styles.list}>
          {transactions.map(tx => (
            <TransactionItem
              key={tx.hash}
              transaction={tx}
              onClick={onTransactionClick}
              theme={theme}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {transactions.length > 0 && (
        <div style={{ ...styles.footer, borderColor: themeStyles.borderColor }}>
          <span style={styles.pagination}>
            Showing {transactions.length} of {totalCount} transactions
          </span>
          {hasMore && (
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={loadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default TransactionHistoryView
