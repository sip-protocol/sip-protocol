/**
 * ReceivePayments.tsx
 *
 * Complete example of scanning and claiming incoming stealth payments using useScanPayments.
 *
 * Features:
 * - Auto-scanning with configurable interval
 * - Manual scan trigger
 * - Individual payment claiming
 * - Batch claiming all unclaimed payments
 * - Visual transaction list with claim status
 * - Unclaimed balance tracker
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useScanPayments } from '@sip-protocol/react'
import type { SolanaScanResult } from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'

interface ReceivePaymentsProps {
  /** Viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Spending public key (hex) */
  spendingPublicKey: HexString
  /** Spending private key for claiming (hex) */
  spendingPrivateKey: HexString
  /** Destination wallet address for claims (base58) */
  destinationAddress: string
  /** Auto-scan interval in ms (default: 30000 = 30s, 0 = disabled) */
  scanInterval?: number
}

/**
 * ReceivePayments - Dashboard for receiving and claiming private payments
 *
 * @example
 * ```tsx
 * import { ReceivePayments } from './ReceivePayments'
 *
 * function App() {
 *   const keys = useMyKeyStore() // Your key management
 *
 *   return (
 *     <ReceivePayments
 *       viewingPrivateKey={keys.viewingPrivateKey}
 *       spendingPublicKey={keys.spendingPublicKey}
 *       spendingPrivateKey={keys.spendingPrivateKey}
 *       destinationAddress={keys.mainWallet}
 *       scanInterval={30000}
 *     />
 *   )
 * }
 * ```
 */
export function ReceivePayments({
  viewingPrivateKey,
  spendingPublicKey,
  spendingPrivateKey,
  destinationAddress,
  scanInterval = 30000,
}: ReceivePaymentsProps) {
  const { connection } = useConnection()
  const [claimingPaymentId, setClaimingPaymentId] = useState<string | null>(null)

  // Hook for scanning and claiming
  const {
    payments,
    isScanning,
    isClaiming,
    error,
    totalUnclaimed,
    lastScannedAt,
    scan,
    claim,
    claimAll,
    startAutoScan,
    stopAutoScan,
    clearError,
  } = useScanPayments({
    connection,
    viewingPrivateKey,
    spendingPublicKey,
    scanInterval,
  })

  // Separate claimed and unclaimed payments
  const { unclaimedPayments, claimedPayments } = useMemo(() => {
    const unclaimed = payments.filter((p) => !p.claimed)
    const claimed = payments.filter((p) => p.claimed)
    return { unclaimedPayments: unclaimed, claimedPayments: claimed }
  }, [payments])

  /**
   * Handle manual scan
   */
  const handleScan = useCallback(async () => {
    try {
      await scan()
    } catch (err) {
      console.error('Scan failed:', err)
    }
  }, [scan])

  /**
   * Handle claiming a single payment
   */
  const handleClaim = useCallback(
    async (payment: SolanaScanResult) => {
      setClaimingPaymentId(payment.txSignature)
      try {
        await claim(payment, {
          spendingPrivateKey,
          destinationAddress,
          mint: new PublicKey(payment.mint),
        })
      } catch (err) {
        console.error('Claim failed:', err)
      } finally {
        setClaimingPaymentId(null)
      }
    },
    [claim, spendingPrivateKey, destinationAddress]
  )

  /**
   * Handle claiming all unclaimed payments
   */
  const handleClaimAll = useCallback(async () => {
    try {
      const result = await claimAll({
        spendingPrivateKey,
        destinationAddress,
        mintResolver: (mint) => new PublicKey(mint),
      })

      if (result.failed.length > 0) {
        console.error(`${result.failed.length} claims failed:`, result.failed)
      }
    } catch (err) {
      console.error('Claim all failed:', err)
    }
  }, [claimAll, spendingPrivateKey, destinationAddress])

  /**
   * Format amount for display
   */
  const formatAmount = (amount: bigint, decimals = 6) => {
    const value = Number(amount) / 10 ** decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  }

  /**
   * Format date for display
   */
  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleString()
  }

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Receive Private Payments</h2>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
            <button onClick={clearError} className="text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Stats and controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total unclaimed */}
        <div className="p-3 bg-purple-50 rounded-lg">
          <div className="text-sm text-purple-600">Unclaimed</div>
          <div className="text-2xl font-bold text-purple-800">
            {formatAmount(totalUnclaimed)}
          </div>
        </div>

        {/* Payment count */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Payments</div>
          <div className="text-2xl font-bold text-gray-800">
            {unclaimedPayments.length} / {payments.length}
          </div>
        </div>

        {/* Last scanned */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Last Scan</div>
          <div className="text-sm font-medium text-gray-800">{formatDate(lastScannedAt)}</div>
        </div>

        {/* Auto-scan toggle */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Auto-Scan</div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => startAutoScan()}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Start
            </button>
            <button
              onClick={stopAutoScan}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isScanning && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {isScanning ? 'Scanning...' : 'Scan Now'}
        </button>

        {unclaimedPayments.length > 0 && (
          <button
            onClick={handleClaimAll}
            disabled={isClaiming}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isClaiming ? 'Claiming...' : `Claim All (${unclaimedPayments.length})`}
          </button>
        )}
      </div>

      {/* Unclaimed payments */}
      {unclaimedPayments.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Unclaimed Payments</h3>
          <div className="space-y-2">
            {unclaimedPayments.map((payment) => (
              <div
                key={payment.txSignature}
                className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div>
                  <div className="font-medium">{formatAmount(payment.amount)} {payment.tokenSymbol || 'tokens'}</div>
                  <div className="text-xs text-gray-500">
                    {payment.stealthAddress.slice(0, 8)}...{payment.stealthAddress.slice(-8)}
                  </div>
                  <div className="text-xs text-gray-400">Slot: {payment.slot}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://explorer.solana.com/tx/${payment.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-purple-600 hover:underline"
                  >
                    View TX
                  </a>
                  <button
                    onClick={() => handleClaim(payment)}
                    disabled={isClaiming || claimingPaymentId === payment.txSignature}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claimingPaymentId === payment.txSignature ? 'Claiming...' : 'Claim'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claimed payments */}
      {claimedPayments.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Claimed Payments</h3>
          <div className="space-y-2">
            {claimedPayments.map((payment) => (
              <div
                key={payment.txSignature}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div>
                  <div className="font-medium text-green-800">
                    {formatAmount(payment.amount)} {payment.tokenSymbol || 'tokens'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {payment.stealthAddress.slice(0, 8)}...{payment.stealthAddress.slice(-8)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600">✓ Claimed</span>
                  {payment.claimResult && (
                    <a
                      href={payment.claimResult.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-purple-600 hover:underline"
                    >
                      View Claim TX
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {payments.length === 0 && !isScanning && (
        <div className="text-center py-8 text-gray-500">
          <p>No payments found yet.</p>
          <p className="text-sm mt-1">Click "Scan Now" to check for incoming payments.</p>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        <strong>How it works:</strong> The scanner checks for payments sent to your stealth
        addresses. Only you can see and claim these payments using your private keys. After
        claiming, funds are sent to your destination wallet.
      </div>
    </div>
  )
}

export default ReceivePayments
