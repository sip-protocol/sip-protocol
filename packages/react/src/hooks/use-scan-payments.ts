import { useState, useCallback, useEffect, useRef } from 'react'
import {
  scanForPayments,
  claimStealthPayment,
} from '@sip-protocol/sdk'
import type {
  SolanaScanParams,
  SolanaScanResult,
  SolanaClaimParams,
  SolanaClaimResult,
} from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'

/**
 * Scan status states
 */
export type ScanStatus = 'idle' | 'scanning' | 'claiming' | 'success' | 'error'

/**
 * Parameters for useScanPayments hook
 */
export interface UseScanPaymentsParams {
  /** Solana RPC connection */
  connection: SolanaScanParams['connection']
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending public key (hex) */
  spendingPublicKey: HexString
  /** Optional: Auto-scan interval in milliseconds (0 = disabled) */
  scanInterval?: number
  /** Optional: Initial from slot for scanning */
  fromSlot?: number
  /** Optional: Limit number of results per scan */
  limit?: number
}

/**
 * Payment with claim status
 */
export interface PaymentWithStatus extends SolanaScanResult {
  /** Whether this payment has been claimed */
  claimed: boolean
  /** Claim result if claimed */
  claimResult?: SolanaClaimResult
}

/**
 * Return type for useScanPayments hook
 */
export interface UseScanPaymentsReturn {
  /** Current scan/claim status */
  status: ScanStatus
  /** Whether scanning is in progress */
  isScanning: boolean
  /** Whether claiming is in progress */
  isClaiming: boolean
  /** Error message if scan/claim failed */
  error: Error | null
  /** Detected payments */
  payments: PaymentWithStatus[]
  /** Total unclaimed balance across all payments */
  totalUnclaimed: bigint
  /** Timestamp of last scan */
  lastScannedAt: Date | null
  /** Trigger a manual scan */
  scan: (options?: { fromSlot?: number; limit?: number }) => Promise<SolanaScanResult[]>
  /** Claim a specific payment */
  claim: (payment: SolanaScanResult, params: ClaimParams) => Promise<SolanaClaimResult | null>
  /** Claim all unclaimed payments */
  claimAll: (params: ClaimAllParams) => Promise<ClaimAllResult>
  /** Start auto-scanning */
  startAutoScan: (intervalMs?: number) => void
  /** Stop auto-scanning */
  stopAutoScan: () => void
  /** Clear all payments and reset state */
  reset: () => void
  /** Clear error */
  clearError: () => void
}

/**
 * Parameters for claiming a payment
 */
export interface ClaimParams {
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Destination address to send claimed funds (base58) */
  destinationAddress: string
  /** SPL token mint address */
  mint: SolanaClaimParams['mint']
}

/**
 * Mint resolver function type
 * Converts a mint address string to a PublicKey-like object for claiming
 */
export type MintResolver = (mintAddress: string) => SolanaClaimParams['mint']

/**
 * Parameters for claiming all payments
 */
export interface ClaimAllParams {
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Destination address to send claimed funds (base58) */
  destinationAddress: string
  /**
   * Function to convert mint address string to PublicKey object
   *
   * @example
   * ```typescript
   * import { PublicKey } from '@solana/web3.js'
   *
   * const mintResolver = (mint: string) => new PublicKey(mint)
   * await claimAll({ spendingPrivateKey, destinationAddress, mintResolver })
   * ```
   */
  mintResolver: MintResolver
}

/**
 * Result from claimAll operation
 */
export interface ClaimAllResult {
  /** Successful claim results */
  succeeded: SolanaClaimResult[]
  /** Failed claims with error info */
  failed: Array<{
    payment: PaymentWithStatus
    error: Error
  }>
  /** Total number of unclaimed payments attempted */
  totalAttempted: number
}

/**
 * useScanPayments - Scan for and claim incoming stealth payments on Solana
 *
 * @remarks
 * This hook provides a React-friendly interface for scanning the Solana blockchain
 * for incoming stealth payments and claiming them. It supports both manual and
 * automatic scanning with configurable intervals.
 *
 * Features:
 * - Scan for incoming stealth payments
 * - Auto-scanning with configurable interval
 * - Claim individual or all payments
 * - Track claimed vs unclaimed payments
 * - Error handling and recovery
 *
 * @param params - Hook configuration parameters
 *
 * @example
 * ```tsx
 * import { useScanPayments } from '@sip-protocol/react'
 * import { useConnection } from '@solana/wallet-adapter-react'
 * import { PublicKey } from '@solana/web3.js'
 *
 * function ReceivePayments() {
 *   const { connection } = useConnection()
 *
 *   const {
 *     payments,
 *     isScanning,
 *     scan,
 *     claim,
 *     totalUnclaimed,
 *     lastScannedAt,
 *   } = useScanPayments({
 *     connection,
 *     viewingPrivateKey: '0x...',
 *     spendingPublicKey: '0x...',
 *     scanInterval: 30000, // Auto-scan every 30 seconds
 *   })
 *
 *   const handleClaim = async (payment: SolanaScanResult) => {
 *     await claim(payment, {
 *       spendingPrivateKey: '0x...',
 *       destinationAddress: 'myWallet...',
 *       mint: new PublicKey(payment.mint),
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={() => scan()} disabled={isScanning}>
 *         {isScanning ? 'Scanning...' : 'Scan for Payments'}
 *       </button>
 *
 *       <p>Total unclaimed: {totalUnclaimed.toString()}</p>
 *       <p>Last scan: {lastScannedAt?.toLocaleString()}</p>
 *
 *       {payments.map((payment) => (
 *         <div key={payment.txSignature}>
 *           <p>{payment.amount.toString()} {payment.tokenSymbol}</p>
 *           {!payment.claimed && (
 *             <button onClick={() => handleClaim(payment)}>Claim</button>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useScanPayments(params: UseScanPaymentsParams): UseScanPaymentsReturn {
  const {
    connection,
    viewingPrivateKey,
    spendingPublicKey,
    scanInterval = 0,
    fromSlot: initialFromSlot,
    limit: defaultLimit = 100,
  } = params

  const [status, setStatus] = useState<ScanStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [payments, setPayments] = useState<PaymentWithStatus[]>([])
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null)
  const [lastScannedSlot, setLastScannedSlot] = useState<number | undefined>(initialFromSlot)

  const autoScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isAutoScanningRef = useRef(false)

  const isScanning = status === 'scanning'
  const isClaiming = status === 'claiming'

  // Calculate total unclaimed balance
  const totalUnclaimed = payments
    .filter((p) => !p.claimed)
    .reduce((sum, p) => sum + p.amount, 0n)

  /**
   * Scan for payments
   */
  const scan = useCallback(
    async (options?: { fromSlot?: number; limit?: number }): Promise<SolanaScanResult[]> => {
      setStatus('scanning')
      setError(null)

      try {
        const scanParams: SolanaScanParams = {
          connection,
          viewingPrivateKey,
          spendingPublicKey,
          fromSlot: options?.fromSlot ?? lastScannedSlot,
          limit: options?.limit ?? defaultLimit,
        }

        const results = await scanForPayments(scanParams)

        // Merge with existing payments, avoiding duplicates
        setPayments((prev) => {
          const existingTxs = new Set(prev.map((p) => p.txSignature))
          const newPayments = results
            .filter((r) => !existingTxs.has(r.txSignature))
            .map((r) => ({ ...r, claimed: false }))

          return [...prev, ...newPayments]
        })

        // Update last scanned slot to the highest slot we've seen
        if (results.length > 0) {
          const maxSlot = Math.max(...results.map((r) => r.slot))
          setLastScannedSlot(maxSlot + 1) // Start from next slot on subsequent scans
        }

        setLastScannedAt(new Date())
        setStatus('idle')

        return results
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Scan failed')
        setError(error)
        setStatus('error')
        throw error
      }
    },
    [connection, viewingPrivateKey, spendingPublicKey, lastScannedSlot, defaultLimit]
  )

  /**
   * Claim a specific payment
   */
  const claim = useCallback(
    async (payment: SolanaScanResult, claimParams: ClaimParams): Promise<SolanaClaimResult | null> => {
      setStatus('claiming')
      setError(null)

      try {
        const sdkParams: SolanaClaimParams = {
          connection,
          stealthAddress: payment.stealthAddress,
          ephemeralPublicKey: payment.ephemeralPublicKey,
          viewingPrivateKey,
          spendingPrivateKey: claimParams.spendingPrivateKey,
          destinationAddress: claimParams.destinationAddress,
          mint: claimParams.mint,
        }

        const result = await claimStealthPayment(sdkParams)

        // Update payment status
        setPayments((prev) =>
          prev.map((p) =>
            p.txSignature === payment.txSignature
              ? { ...p, claimed: true, claimResult: result }
              : p
          )
        )

        setStatus('success')
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Claim failed')
        setError(error)
        setStatus('error')
        return null
      }
    },
    [connection, viewingPrivateKey]
  )

  /**
   * Claim all unclaimed payments
   *
   * @remarks
   * Iterates through all unclaimed payments and attempts to claim each one.
   * Uses the provided mintResolver to convert mint address strings to PublicKey objects.
   * Handles partial failures gracefully - continues with remaining payments if one fails.
   *
   * @example
   * ```typescript
   * import { PublicKey } from '@solana/web3.js'
   *
   * const { claimAll } = useScanPayments({ ... })
   *
   * const result = await claimAll({
   *   spendingPrivateKey: '0x...',
   *   destinationAddress: 'myWallet...',
   *   mintResolver: (mint) => new PublicKey(mint),
   * })
   *
   * console.log(`Claimed ${result.succeeded.length} of ${result.totalAttempted}`)
   * if (result.failed.length > 0) {
   *   console.error('Failed claims:', result.failed)
   * }
   * ```
   */
  const claimAll = useCallback(
    async (claimAllParams: ClaimAllParams): Promise<ClaimAllResult> => {
      const { spendingPrivateKey, destinationAddress, mintResolver } = claimAllParams
      const unclaimed = payments.filter((p) => !p.claimed)

      if (unclaimed.length === 0) {
        return { succeeded: [], failed: [], totalAttempted: 0 }
      }

      setStatus('claiming')
      setError(null)

      const succeeded: SolanaClaimResult[] = []
      const failed: Array<{ payment: PaymentWithStatus; error: Error }> = []

      // Process claims sequentially to avoid overwhelming the RPC
      for (const payment of unclaimed) {
        try {
          const mint = mintResolver(payment.mint)
          const result = await claimStealthPayment({
            connection,
            stealthAddress: payment.stealthAddress,
            ephemeralPublicKey: payment.ephemeralPublicKey,
            viewingPrivateKey,
            spendingPrivateKey,
            destinationAddress,
            mint,
          })

          // Update payment status immediately
          setPayments((prev) =>
            prev.map((p) =>
              p.txSignature === payment.txSignature
                ? { ...p, claimed: true, claimResult: result }
                : p
            )
          )

          succeeded.push(result)
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Claim failed')
          failed.push({ payment, error })
        }
      }

      // Set final status based on results
      if (failed.length > 0 && succeeded.length === 0) {
        setStatus('error')
        setError(failed[0].error)
      } else if (failed.length > 0) {
        // Partial success - still set success but keep error for reference
        setStatus('success')
        setError(new Error(`${failed.length} of ${unclaimed.length} claims failed`))
      } else {
        setStatus('success')
      }

      return {
        succeeded,
        failed,
        totalAttempted: unclaimed.length,
      }
    },
    [payments, connection, viewingPrivateKey]
  )

  /**
   * Start auto-scanning
   */
  const startAutoScan = useCallback(
    (intervalMs?: number) => {
      const interval = intervalMs ?? scanInterval
      if (interval <= 0) return

      // Stop existing auto-scan
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current)
      }

      isAutoScanningRef.current = true

      // Initial scan
      scan().catch(console.error)

      // Set up interval
      autoScanIntervalRef.current = setInterval(() => {
        if (isAutoScanningRef.current && status !== 'scanning') {
          scan().catch(console.error)
        }
      }, interval)
    },
    [scan, scanInterval, status]
  )

  /**
   * Stop auto-scanning
   */
  const stopAutoScan = useCallback(() => {
    isAutoScanningRef.current = false
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current)
      autoScanIntervalRef.current = null
    }
  }, [])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    stopAutoScan()
    setStatus('idle')
    setError(null)
    setPayments([])
    setLastScannedAt(null)
    setLastScannedSlot(initialFromSlot)
  }, [stopAutoScan, initialFromSlot])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
    if (status === 'error') {
      setStatus('idle')
    }
  }, [status])

  // Auto-start scanning if interval is provided (runs only on mount/unmount)
  useEffect(() => {
    if (scanInterval > 0) {
      startAutoScan(scanInterval)
    }

    return () => {
      stopAutoScan()
    }
  }, [])

  return {
    status,
    isScanning,
    isClaiming,
    error,
    payments,
    totalUnclaimed,
    lastScannedAt,
    scan,
    claim,
    claimAll,
    startAutoScan,
    stopAutoScan,
    reset,
    clearError,
  }
}
