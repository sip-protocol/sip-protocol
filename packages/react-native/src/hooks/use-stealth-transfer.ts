/**
 * useStealthTransfer - Mobile-optimized private transfer hook
 *
 * Handles shielded SPL token transfers on Solana from mobile devices.
 *
 * @example
 * ```tsx
 * import { useStealthTransfer } from '@sip-protocol/react-native'
 *
 * function SendScreen() {
 *   const { transfer, status, error, isLoading } = useStealthTransfer({
 *     connection,
 *     wallet: walletAdapter,
 *   })
 *
 *   const handleSend = async () => {
 *     const result = await transfer({
 *       recipientMetaAddress: 'sip:solana:...',
 *       amount: 1000000n, // 1 USDC
 *       mint: USDC_MINT,
 *     })
 *     if (result.success) {
 *       Alert.alert('Success', 'Payment sent privately!')
 *     }
 *   }
 *
 *   return (
 *     <TouchableOpacity onPress={handleSend} disabled={isLoading}>
 *       <Text>{isLoading ? 'Sending...' : 'Send Private Payment'}</Text>
 *     </TouchableOpacity>
 *   )
 * }
 * ```
 */

import { useState, useCallback } from 'react'
import type { Connection, PublicKey } from '@solana/web3.js'
import type { VersionedTransaction } from '@solana/web3.js'

/**
 * Wallet adapter interface for mobile wallets
 */
export interface MobileWalletAdapter {
  publicKey: PublicKey | null
  signTransaction: <T extends VersionedTransaction>(transaction: T) => Promise<T>
  signAllTransactions?: <T extends VersionedTransaction>(transactions: T[]) => Promise<T[]>
}

/**
 * Transfer status enum
 */
export type TransferStatus =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'success'
  | 'error'

/**
 * Parameters for stealth transfer
 */
export interface TransferParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: string
  /** Amount in smallest units */
  amount: bigint
  /** SPL token mint address */
  mint: string
}

/**
 * Result of stealth transfer
 */
export interface TransferResult {
  success: boolean
  signature?: string
  stealthAddress?: string
  error?: Error
}

/**
 * Hook parameters
 */
export interface UseStealthTransferParams {
  /** Solana connection */
  connection: Connection
  /** Mobile wallet adapter */
  wallet: MobileWalletAdapter
}

/**
 * Hook return type
 */
export interface UseStealthTransferReturn {
  /** Execute a stealth transfer */
  transfer: (params: TransferParams) => Promise<TransferResult>
  /** Current transfer status */
  status: TransferStatus
  /** Error if any */
  error: Error | null
  /** Whether a transfer is in progress */
  isLoading: boolean
  /** Reset state */
  reset: () => void
}

/**
 * Mobile stealth transfer hook
 */
export function useStealthTransfer(params: UseStealthTransferParams): UseStealthTransferReturn {
  const { connection, wallet } = params

  const [status, setStatus] = useState<TransferStatus>('idle')
  const [error, setError] = useState<Error | null>(null)

  const transfer = useCallback(
    async (transferParams: TransferParams): Promise<TransferResult> => {
      const { recipientMetaAddress, amount, mint } = transferParams

      // Validate wallet connected
      if (!wallet.publicKey) {
        const err = new Error('Wallet not connected')
        setError(err)
        setStatus('error')
        return { success: false, error: err }
      }

      try {
        setStatus('preparing')
        setError(null)

        // Dynamic import to avoid bundling issues
        const { sendPrivateSPLTransfer, getAssociatedTokenAddress } = await import('@sip-protocol/sdk')
        const { PublicKey: SolanaPublicKey } = await import('@solana/web3.js')

        // Get sender's token account
        const mintPubkey = new SolanaPublicKey(mint)
        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          wallet.publicKey
        )

        setStatus('signing')

        // Execute private transfer
        const result = await sendPrivateSPLTransfer({
          connection,
          sender: wallet.publicKey,
          senderTokenAccount,
          recipientMetaAddress,
          mint: mintPubkey,
          amount,
          signTransaction: wallet.signTransaction,
        })

        setStatus('confirming')

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(
          result.signature,
          'confirmed'
        )

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`)
        }

        setStatus('success')
        setError(null)

        return {
          success: true,
          signature: result.signature,
          stealthAddress: result.stealthAddress,
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transfer failed')
        setError(error)
        setStatus('error')
        return { success: false, error }
      }
    },
    [connection, wallet]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return {
    transfer,
    status,
    error,
    isLoading: status !== 'idle' && status !== 'success' && status !== 'error',
    reset,
  }
}

/**
 * Get associated token address helper
 * Re-exported for convenience
 */
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const { getAssociatedTokenAddress: getATA } = await import('@sip-protocol/sdk')
  return getATA(mint, owner)
}
