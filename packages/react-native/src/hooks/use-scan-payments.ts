/**
 * useScanPayments - Mobile-optimized payment scanning hook
 *
 * Scans for incoming stealth payments using viewing key.
 *
 * @example
 * ```tsx
 * import { useScanPayments } from '@sip-protocol/react-native'
 *
 * function InboxScreen() {
 *   const { payments, isScanning, scan, claim } = useScanPayments({
 *     connection,
 *     provider: heliusProvider,
 *   })
 *
 *   useEffect(() => {
 *     // Load keys from keychain and scan
 *     loadKeysAndScan()
 *   }, [])
 *
 *   return (
 *     <FlatList
 *       data={payments}
 *       renderItem={({ item }) => (
 *         <PaymentCard
 *           payment={item}
 *           onClaim={() => claim(item.signature)}
 *         />
 *       )}
 *     />
 *   )
 * }
 * ```
 */

import { useState, useCallback, useRef } from 'react'
import type { Connection } from '@solana/web3.js'

/**
 * Scanned payment info
 */
export interface ScannedPayment {
  /** Transaction signature */
  signature: string
  /** Stealth address that received the payment */
  stealthAddress: string
  /** Ephemeral public key */
  ephemeralPublicKey: string
  /** Token mint address */
  mint: string
  /** Amount in smallest units */
  amount: bigint
  /** Block timestamp */
  timestamp: number
  /** Whether this payment has been claimed */
  claimed: boolean
}

/**
 * Scan status
 */
export type ScanStatus = 'idle' | 'scanning' | 'claiming' | 'error'

/**
 * Hook parameters
 */
export interface UseScanPaymentsParams {
  /** Solana connection */
  connection: Connection
  /** RPC provider (Helius recommended) */
  provider?: unknown
}

/**
 * Hook return type
 */
export interface UseScanPaymentsReturn {
  /** Scanned payments */
  payments: ScannedPayment[]
  /** Current status */
  status: ScanStatus
  /** Error if any */
  error: Error | null
  /** Whether scanning is in progress */
  isScanning: boolean
  /** Scan for payments */
  scan: (viewingPrivateKey: string, spendingPublicKey: string) => Promise<void>
  /** Claim a specific payment */
  claim: (signature: string, spendingPrivateKey: string, destinationAddress: string) => Promise<string | null>
  /** Claim all unclaimed payments */
  claimAll: (spendingPrivateKey: string, destinationAddress: string) => Promise<string[]>
  /** Clear payments */
  clear: () => void
}

/**
 * Mobile payment scanning hook
 */
export function useScanPayments(params: UseScanPaymentsParams): UseScanPaymentsReturn {
  const { connection } = params

  const [payments, setPayments] = useState<ScannedPayment[]>([])
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const scanningRef = useRef(false)

  const scan = useCallback(
    async (viewingPrivateKey: string, spendingPublicKey: string) => {
      if (scanningRef.current) return
      scanningRef.current = true

      try {
        setStatus('scanning')
        setError(null)

        // Dynamic import
        const { scanForPayments } = await import('@sip-protocol/sdk')

        const result = await scanForPayments({
          connection,
          viewingPrivateKey,
          spendingPublicKey,
          // provider, // Could use Helius provider for efficiency
        })

        // Map to our payment type
        const scannedPayments: ScannedPayment[] = result.map((p) => ({
          signature: p.signature,
          stealthAddress: p.stealthAddress,
          ephemeralPublicKey: p.ephemeralPublicKey,
          mint: p.mint,
          amount: p.amount,
          timestamp: p.timestamp ?? Date.now(),
          claimed: false,
        }))

        setPayments((prev) => {
          // Merge with existing, avoiding duplicates
          const existingSigs = new Set(prev.map((p) => p.signature))
          const newPayments = scannedPayments.filter((p) => !existingSigs.has(p.signature))
          return [...prev, ...newPayments]
        })

        setStatus('idle')
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Scan failed')
        setError(error)
        setStatus('error')
      } finally {
        scanningRef.current = false
      }
    },
    [connection]
  )

  const claim = useCallback(
    async (
      signature: string,
      spendingPrivateKey: string,
      destinationAddress: string
    ): Promise<string | null> => {
      try {
        setStatus('claiming')
        setError(null)

        const payment = payments.find((p) => p.signature === signature)
        if (!payment) {
          throw new Error('Payment not found')
        }

        const { claimStealthPayment } = await import('@sip-protocol/sdk')
        const { PublicKey } = await import('@solana/web3.js')

        const result = await claimStealthPayment({
          connection,
          stealthAddress: payment.stealthAddress,
          ephemeralPublicKey: payment.ephemeralPublicKey,
          viewingPrivateKey: '', // Not needed for claiming
          spendingPrivateKey,
          destinationAddress: new PublicKey(destinationAddress),
          mint: new PublicKey(payment.mint),
        })

        // Mark as claimed
        setPayments((prev) =>
          prev.map((p) =>
            p.signature === signature ? { ...p, claimed: true } : p
          )
        )

        setStatus('idle')
        return result.signature
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Claim failed')
        setError(error)
        setStatus('error')
        return null
      }
    },
    [connection, payments]
  )

  const claimAll = useCallback(
    async (
      spendingPrivateKey: string,
      destinationAddress: string
    ): Promise<string[]> => {
      const unclaimedPayments = payments.filter((p) => !p.claimed)
      const signatures: string[] = []

      for (const payment of unclaimedPayments) {
        const sig = await claim(payment.signature, spendingPrivateKey, destinationAddress)
        if (sig) {
          signatures.push(sig)
        }
      }

      return signatures
    },
    [payments, claim]
  )

  const clear = useCallback(() => {
    setPayments([])
    setError(null)
    setStatus('idle')
  }, [])

  return {
    payments,
    status,
    error,
    isScanning: status === 'scanning',
    scan,
    claim,
    claimAll,
    clear,
  }
}
