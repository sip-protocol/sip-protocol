import React, { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Transaction status types
 */
export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'finalized'
  | 'failed'
  | 'cancelled'

/**
 * Privacy-specific verification status
 */
export type PrivacyVerificationStatus = 'pending' | 'verified' | 'failed' | 'not_applicable'

/**
 * Transaction action types
 */
export type TransactionActionType =
  | 'transfer'
  | 'stealth_transfer'
  | 'function_call'
  | 'create_account'
  | 'stake'
  | 'unstake'

/**
 * Transaction action
 */
export interface TransactionAction {
  type: TransactionActionType
  receiver: string
  amount?: string
  methodName?: string
  args?: Record<string, unknown>
}

/**
 * Privacy verification details
 */
export interface PrivacyVerification {
  stealthAddressResolved: PrivacyVerificationStatus
  commitmentVerified: PrivacyVerificationStatus
  viewingKeyGenerated: PrivacyVerificationStatus
}

/**
 * Transaction details
 */
export interface PrivacyTransaction {
  /** Transaction hash */
  hash: string
  /** Transaction status */
  status: TransactionStatus
  /** Block number (null if pending) */
  blockHeight?: number
  /** Number of confirmations */
  confirmations: number
  /** Required confirmations for finality */
  requiredConfirmations: number
  /** Timestamp of transaction (ms) */
  timestamp: number
  /** Sender account */
  sender: string
  /** Receiver account or stealth address */
  receiver: string
  /** Whether receiver is a stealth address */
  isStealthReceiver: boolean
  /** Amount transferred (in native token units) */
  amount?: string
  /** Gas used */
  gasUsed?: string
  /** Transaction fee */
  fee?: string
  /** Transaction actions */
  actions: TransactionAction[]
  /** Privacy verification status */
  privacyVerification?: PrivacyVerification
  /** Error message if failed */
  errorMessage?: string
}

/**
 * TransactionTracker component props
 */
export interface TransactionTrackerProps {
  /** Transaction data */
  transaction: PrivacyTransaction
  /** Callback to refresh transaction status */
  onRefresh?: () => void
  /** Callback to retry failed transaction */
  onRetry?: () => void
  /** Callback to cancel pending transaction */
  onCancel?: () => void
  /** Whether to show expanded details by default */
  defaultExpanded?: boolean
  /** Polling interval in ms (0 to disable) */
  pollingInterval?: number
  /** Network name for display */
  networkName?: string
  /** Explorer URL template (use {hash} placeholder) */
  explorerUrlTemplate?: string
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show privacy verification status */
  showPrivacyStatus?: boolean
}

/**
 * CSS styles for the component
 */
const styles = `
.sip-tx-tracker {
  font-family: system-ui, -apple-system, sans-serif;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sip-tx-tracker[data-size="sm"] {
  border-radius: 8px;
}

.sip-tx-tracker[data-size="lg"] {
  border-radius: 16px;
}

/* Header */
.sip-tx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-header {
  padding: 12px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-header {
  padding: 20px;
}

.sip-tx-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sip-tx-status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-status-icon {
  width: 32px;
  height: 32px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-status-icon {
  width: 48px;
  height: 48px;
}

.sip-tx-status-icon svg {
  width: 20px;
  height: 20px;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-status-icon svg {
  width: 16px;
  height: 16px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-status-icon svg {
  width: 24px;
  height: 24px;
}

.sip-tx-status-icon[data-status="pending"] {
  background: #fef3c7;
  color: #d97706;
}

.sip-tx-status-icon[data-status="processing"] {
  background: #dbeafe;
  color: #2563eb;
}

.sip-tx-status-icon[data-status="confirmed"],
.sip-tx-status-icon[data-status="finalized"] {
  background: #d1fae5;
  color: #059669;
}

.sip-tx-status-icon[data-status="failed"],
.sip-tx-status-icon[data-status="cancelled"] {
  background: #fee2e2;
  color: #dc2626;
}

.sip-tx-status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sip-tx-status-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-status-title {
  font-size: 13px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-status-title {
  font-size: 16px;
}

.sip-tx-status-subtitle {
  font-size: 12px;
  color: #6b7280;
}

.sip-tx-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sip-tx-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sip-tx-action-btn-primary {
  background: #3b82f6;
  color: white;
}

.sip-tx-action-btn-primary:hover {
  background: #2563eb;
}

.sip-tx-action-btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.sip-tx-action-btn-secondary:hover {
  background: #e5e7eb;
}

.sip-tx-action-btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.sip-tx-action-btn-danger:hover {
  background: #fecaca;
}

/* Progress bar */
.sip-tx-progress {
  padding: 0 16px 16px;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-progress {
  padding: 0 12px 12px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-progress {
  padding: 0 20px 20px;
}

.sip-tx-progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.sip-tx-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.sip-tx-progress-fill[data-status="pending"] {
  background: #fbbf24;
  animation: sip-tx-pulse 1.5s infinite;
}

.sip-tx-progress-fill[data-status="processing"] {
  background: #3b82f6;
  animation: sip-tx-pulse 1.5s infinite;
}

.sip-tx-progress-fill[data-status="confirmed"] {
  background: #10b981;
}

.sip-tx-progress-fill[data-status="finalized"] {
  background: #059669;
}

.sip-tx-progress-fill[data-status="failed"],
.sip-tx-progress-fill[data-status="cancelled"] {
  background: #ef4444;
}

@keyframes sip-tx-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.sip-tx-progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b7280;
}

/* Privacy status */
.sip-tx-privacy {
  padding: 12px 16px;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-bottom: 1px solid #4338ca;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-privacy {
  padding: 10px 12px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-privacy {
  padding: 16px 20px;
}

.sip-tx-privacy-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #c7d2fe;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.sip-tx-privacy-title svg {
  width: 14px;
  height: 14px;
}

.sip-tx-privacy-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sip-tx-privacy-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 12px;
  color: #e0e7ff;
}

.sip-tx-privacy-item svg {
  width: 14px;
  height: 14px;
}

.sip-tx-privacy-item[data-status="verified"] svg {
  color: #34d399;
}

.sip-tx-privacy-item[data-status="pending"] svg {
  color: #fbbf24;
}

.sip-tx-privacy-item[data-status="failed"] svg {
  color: #f87171;
}

/* Details section */
.sip-tx-details-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-top: 1px solid #e5e7eb;
}

.sip-tx-details-toggle:hover {
  background: #f9fafb;
  color: #374151;
}

.sip-tx-details-toggle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.sip-tx-details-toggle[aria-expanded="true"] svg {
  transform: rotate(180deg);
}

.sip-tx-details {
  padding: 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.sip-tx-tracker[data-size="sm"] .sip-tx-details {
  padding: 12px;
}

.sip-tx-tracker[data-size="lg"] .sip-tx-details {
  padding: 20px;
}

.sip-tx-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.sip-tx-detail-row:last-child {
  border-bottom: none;
}

.sip-tx-detail-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.sip-tx-detail-value {
  font-size: 12px;
  color: #111827;
  font-family: 'SF Mono', Monaco, monospace;
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

.sip-tx-detail-value a {
  color: #3b82f6;
  text-decoration: none;
}

.sip-tx-detail-value a:hover {
  text-decoration: underline;
}

/* Error message */
.sip-tx-error {
  padding: 12px 16px;
  background: #fee2e2;
  border-top: 1px solid #fecaca;
  font-size: 13px;
  color: #dc2626;
}

/* ETA */
.sip-tx-eta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: #eff6ff;
  border-top: 1px solid #bfdbfe;
  font-size: 12px;
  color: #1d4ed8;
}

.sip-tx-eta svg {
  width: 14px;
  height: 14px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .sip-tx-tracker {
    background: #1f2937;
    border-color: #374151;
  }

  .sip-tx-header {
    background: #111827;
    border-color: #374151;
  }

  .sip-tx-status-title {
    color: #f9fafb;
  }

  .sip-tx-status-subtitle {
    color: #9ca3af;
  }

  .sip-tx-progress-bar {
    background: #374151;
  }

  .sip-tx-progress-info {
    color: #9ca3af;
  }

  .sip-tx-details-toggle {
    border-color: #374151;
    color: #9ca3af;
  }

  .sip-tx-details-toggle:hover {
    background: #111827;
    color: #e5e7eb;
  }

  .sip-tx-details {
    background: #111827;
    border-color: #374151;
  }

  .sip-tx-detail-row {
    border-color: #374151;
  }

  .sip-tx-detail-label {
    color: #9ca3af;
  }

  .sip-tx-detail-value {
    color: #f9fafb;
  }

  .sip-tx-action-btn-secondary {
    background: #374151;
    color: #e5e7eb;
  }

  .sip-tx-action-btn-secondary:hover {
    background: #4b5563;
  }
}
`

/**
 * Status icons
 */
const StatusIcons: Record<TransactionStatus, React.ReactNode> = {
  pending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  processing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  ),
  confirmed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  finalized: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  failed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  cancelled: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
}

/**
 * Privacy status icons
 */
const PrivacyStatusIcons: Record<PrivacyVerificationStatus, React.ReactNode> = {
  verified: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  failed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  not_applicable: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
}

/**
 * Chevron icon
 */
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

/**
 * Shield icon
 */
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

/**
 * Clock icon
 */
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

/**
 * Status titles
 */
const STATUS_TITLES: Record<TransactionStatus, string> = {
  pending: 'Transaction Pending',
  processing: 'Processing Transaction',
  confirmed: 'Transaction Confirmed',
  finalized: 'Transaction Finalized',
  failed: 'Transaction Failed',
  cancelled: 'Transaction Cancelled',
}

/**
 * TransactionTracker - Component for tracking NEAR privacy transactions
 *
 * @example Basic usage
 * ```tsx
 * import { TransactionTracker } from '@sip-protocol/react'
 *
 * function TransactionView({ txHash }) {
 *   const [tx, setTx] = useState(null)
 *
 *   return (
 *     <TransactionTracker
 *       transaction={tx}
 *       onRefresh={() => fetchTransaction(txHash)}
 *     />
 *   )
 * }
 * ```
 */
export function TransactionTracker({
  transaction,
  onRefresh,
  onRetry,
  onCancel,
  defaultExpanded = false,
  pollingInterval = 0,
  networkName = 'NEAR',
  explorerUrlTemplate = 'https://nearblocks.io/txns/{hash}',
  className = '',
  size = 'md',
  showPrivacyStatus = true,
}: TransactionTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    const { status, confirmations, requiredConfirmations } = transaction

    if (status === 'failed' || status === 'cancelled') return 100
    if (status === 'finalized') return 100
    if (status === 'pending') return 10

    const progress = Math.min(confirmations / requiredConfirmations, 1) * 100
    return Math.max(progress, 20)
  }, [transaction])

  // Calculate ETA
  const estimatedTimeLeft = useMemo(() => {
    const { status, confirmations, requiredConfirmations } = transaction

    if (status === 'finalized' || status === 'failed' || status === 'cancelled') {
      return null
    }

    const remaining = requiredConfirmations - confirmations
    // NEAR has ~1 second block time
    const seconds = Math.max(remaining, 1)

    if (seconds < 60) {
      return `~${seconds}s to finality`
    }
    return `~${Math.ceil(seconds / 60)}m to finality`
  }, [transaction])

  // Format timestamp
  const formattedTime = useMemo(() => {
    const date = new Date(transaction.timestamp)
    return date.toLocaleString()
  }, [transaction.timestamp])

  // Explorer URL
  const explorerUrl = useMemo(() => {
    return explorerUrlTemplate.replace('{hash}', transaction.hash)
  }, [explorerUrlTemplate, transaction.hash])

  // Truncate hash for display
  const truncatedHash = useMemo(() => {
    const hash = transaction.hash
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`
  }, [transaction.hash])

  // Polling effect
  useEffect(() => {
    if (
      pollingInterval <= 0 ||
      !onRefresh ||
      transaction.status === 'finalized' ||
      transaction.status === 'failed' ||
      transaction.status === 'cancelled'
    ) {
      return
    }

    const interval = setInterval(onRefresh, pollingInterval)
    return () => clearInterval(interval)
  }, [pollingInterval, onRefresh, transaction.status])

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // Can show retry button
  const canRetry = transaction.status === 'failed' && onRetry

  // Can show cancel button
  const canCancel = transaction.status === 'pending' && onCancel

  return (
    <>
      <style>{styles}</style>

      <div
        className={`sip-tx-tracker ${className}`}
        data-size={size}
        data-status={transaction.status}
      >
        {/* Header */}
        <div className="sip-tx-header">
          <div className="sip-tx-header-left">
            <div
              className="sip-tx-status-icon"
              data-status={transaction.status}
              data-testid="status-icon"
            >
              {StatusIcons[transaction.status]}
            </div>
            <div className="sip-tx-status-info">
              <span className="sip-tx-status-title">{STATUS_TITLES[transaction.status]}</span>
              <span className="sip-tx-status-subtitle">
                {networkName} • {truncatedHash}
              </span>
            </div>
          </div>

          <div className="sip-tx-header-actions">
            {onRefresh && transaction.status !== 'finalized' && (
              <button
                type="button"
                className="sip-tx-action-btn sip-tx-action-btn-secondary"
                onClick={onRefresh}
                aria-label="Refresh status"
              >
                Refresh
              </button>
            )}
            {canRetry && (
              <button
                type="button"
                className="sip-tx-action-btn sip-tx-action-btn-primary"
                onClick={onRetry}
                aria-label="Retry transaction"
              >
                Retry
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="sip-tx-action-btn sip-tx-action-btn-danger"
                onClick={onCancel}
                aria-label="Cancel transaction"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {transaction.status !== 'cancelled' && (
          <div className="sip-tx-progress">
            <div className="sip-tx-progress-bar">
              <div
                className="sip-tx-progress-fill"
                data-status={transaction.status}
                style={{ width: `${progressPercentage}%` }}
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                data-testid="progress-bar"
              />
            </div>
            <div className="sip-tx-progress-info">
              <span>
                {transaction.confirmations}/{transaction.requiredConfirmations} confirmations
              </span>
              <span>{progressPercentage.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Privacy verification status */}
        {showPrivacyStatus && transaction.privacyVerification && (
          <div className="sip-tx-privacy" data-testid="privacy-status">
            <div className="sip-tx-privacy-title">
              <ShieldIcon />
              Privacy Verification
            </div>
            <div className="sip-tx-privacy-items">
              <div
                className="sip-tx-privacy-item"
                data-status={transaction.privacyVerification.stealthAddressResolved}
              >
                {PrivacyStatusIcons[transaction.privacyVerification.stealthAddressResolved] ??
                  PrivacyStatusIcons.pending}
                <span>Stealth Address</span>
              </div>
              <div
                className="sip-tx-privacy-item"
                data-status={transaction.privacyVerification.commitmentVerified}
              >
                {PrivacyStatusIcons[transaction.privacyVerification.commitmentVerified] ??
                  PrivacyStatusIcons.pending}
                <span>Commitment</span>
              </div>
              <div
                className="sip-tx-privacy-item"
                data-status={transaction.privacyVerification.viewingKeyGenerated}
              >
                {PrivacyStatusIcons[transaction.privacyVerification.viewingKeyGenerated] ??
                  PrivacyStatusIcons.pending}
                <span>Viewing Key</span>
              </div>
            </div>
          </div>
        )}

        {/* ETA */}
        {estimatedTimeLeft && (
          <div className="sip-tx-eta" data-testid="eta">
            <ClockIcon />
            {estimatedTimeLeft}
          </div>
        )}

        {/* Error message */}
        {transaction.errorMessage && (
          <div className="sip-tx-error" data-testid="error-message">
            {transaction.errorMessage}
          </div>
        )}

        {/* Details toggle */}
        <button
          type="button"
          className="sip-tx-details-toggle"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-controls="tx-details"
        >
          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
          <ChevronIcon />
        </button>

        {/* Details section */}
        {isExpanded && (
          <div id="tx-details" className="sip-tx-details" data-testid="details-section">
            <div className="sip-tx-detail-row">
              <span className="sip-tx-detail-label">Transaction Hash</span>
              <span className="sip-tx-detail-value">
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                  {truncatedHash}
                </a>
              </span>
            </div>

            <div className="sip-tx-detail-row">
              <span className="sip-tx-detail-label">Timestamp</span>
              <span className="sip-tx-detail-value">{formattedTime}</span>
            </div>

            <div className="sip-tx-detail-row">
              <span className="sip-tx-detail-label">From</span>
              <span className="sip-tx-detail-value">{transaction.sender}</span>
            </div>

            <div className="sip-tx-detail-row">
              <span className="sip-tx-detail-label">
                To {transaction.isStealthReceiver && '(Stealth)'}
              </span>
              <span className="sip-tx-detail-value">{transaction.receiver}</span>
            </div>

            {transaction.amount && (
              <div className="sip-tx-detail-row">
                <span className="sip-tx-detail-label">Amount</span>
                <span className="sip-tx-detail-value">{transaction.amount}</span>
              </div>
            )}

            {transaction.gasUsed && (
              <div className="sip-tx-detail-row">
                <span className="sip-tx-detail-label">Gas Used</span>
                <span className="sip-tx-detail-value">{transaction.gasUsed}</span>
              </div>
            )}

            {transaction.fee && (
              <div className="sip-tx-detail-row">
                <span className="sip-tx-detail-label">Fee</span>
                <span className="sip-tx-detail-value">{transaction.fee}</span>
              </div>
            )}

            {transaction.blockHeight && (
              <div className="sip-tx-detail-row">
                <span className="sip-tx-detail-label">Block</span>
                <span className="sip-tx-detail-value">#{transaction.blockHeight}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Hook to manage transaction tracking state
 */
export function useTransactionTracker(
  initialTransaction?: PrivacyTransaction,
  options: {
    pollingInterval?: number
    onStatusChange?: (status: TransactionStatus) => void
  } = {}
) {
  const { pollingInterval = 0, onStatusChange } = options
  const [transaction, setTransaction] = useState<PrivacyTransaction | null>(
    initialTransaction ?? null
  )
  const [isPolling, setIsPolling] = useState(pollingInterval > 0)

  // Update transaction
  const updateTransaction = useCallback(
    (updates: Partial<PrivacyTransaction>) => {
      setTransaction((prev) => {
        if (!prev) return prev

        const newTx = { ...prev, ...updates }

        if (updates.status && updates.status !== prev.status) {
          onStatusChange?.(updates.status)
        }

        return newTx
      })
    },
    [onStatusChange]
  )

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true)
  }, [])

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false)
  }, [])

  // Check if transaction is final
  const isFinal = useMemo(() => {
    if (!transaction) return false
    return ['finalized', 'failed', 'cancelled'].includes(transaction.status)
  }, [transaction])

  return {
    transaction,
    setTransaction,
    updateTransaction,
    isPolling,
    startPolling,
    stopPolling,
    isFinal,
  }
}

export default TransactionTracker
