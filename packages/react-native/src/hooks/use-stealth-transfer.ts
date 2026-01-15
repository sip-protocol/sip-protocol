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

/**
 * Wallet adapter interface for mobile wallets
 */
export interface MobileWalletAdapter {
  publicKey: { toBase58(): string } | null
  signTransaction: <T>(transaction: T) => Promise<T>
  signAllTransactions?: <T>(transactions: T[]) => Promise<T[]>
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
 * Connection interface (subset of @solana/web3.js Connection)
 */
export interface SolanaConnection {
  confirmTransaction(
    signature: string,
    commitment?: string
  ): Promise<{ value: { err: unknown } }>
}

/**
 * Parameters for useStealthTransfer hook
 */
export interface UseStealthTransferParams {
  /** Solana connection */
  connection: SolanaConnection
  /** Wallet adapter */
  wallet: MobileWalletAdapter
}

/**
 * Return type for useStealthTransfer hook
 */
export interface UseStealthTransferReturn {
  /** Execute a private transfer */
  transfer: (params: TransferParams) => Promise<TransferResult>
  /** Current transfer status */
  status: TransferStatus
  /** Error if any occurred */
  error: Error | null
  /** Whether a transfer is in progress */
  isLoading: boolean
  /** Reset the hook state */
  reset: () => void
}

/**
 * Mobile-optimized stealth transfer hook
 *
 * @param params - Hook parameters
 */
export function useStealthTransfer(
  params: UseStealthTransferParams
): UseStealthTransferReturn {
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

        // Dynamic import SDK functions to avoid bundling issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdk: any = await import('@sip-protocol/sdk')

        // Check if sendPrivateSPLTransfer is available
        if (!sdk.sendPrivateSPLTransfer) {
          throw new Error(
            'sendPrivateSPLTransfer not available. Install @sip-protocol/sdk with Solana support.'
          )
        }

        const sendPrivateSPLTransfer = sdk.sendPrivateSPLTransfer as (params: {
          connection: unknown
          sender: unknown
          senderTokenAccount: unknown
          recipientMetaAddress: string
          mint: unknown
          amount: bigint
          signTransaction: unknown
        }) => Promise<{ signature: string; stealthAddress: string }>

        // Dynamic import Solana libraries
        const { PublicKey } = await import('@solana/web3.js')
        const { getAssociatedTokenAddress } = await import('@solana/spl-token')

        // Get sender's token account
        const mintPubkey = new PublicKey(mint)
        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          new PublicKey(wallet.publicKey.toBase58())
        )

        setStatus('signing')

        // Execute private transfer
        const result = await sendPrivateSPLTransfer({
          connection,
          sender: new PublicKey(wallet.publicKey.toBase58()),
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
 *
 * Dynamically imports from @solana/spl-token
 *
 * @param mint - Token mint address string
 * @param owner - Owner address string
 * @returns Associated token address
 */
export async function getAssociatedTokenAddress(
  mint: string,
  owner: string
): Promise<string> {
  const { PublicKey } = await import('@solana/web3.js')
  const { getAssociatedTokenAddress: getATA } = await import('@solana/spl-token')
  const ata = await getATA(new PublicKey(mint), new PublicKey(owner))
  return ata.toBase58()
}
