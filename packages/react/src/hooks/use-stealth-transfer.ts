import { useState, useCallback } from 'react'
import {
  sendPrivateSPLTransfer,
  estimatePrivateTransferFee,
  hasTokenAccount,
} from '@sip-protocol/sdk'
import type {
  SolanaPrivateTransferParams,
  SolanaPrivateTransferResult,
} from '@sip-protocol/sdk'
import type { StealthMetaAddress } from '@sip-protocol/types'

/**
 * Transfer status states
 */
export type TransferStatus = 'idle' | 'estimating' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'

/**
 * Parameters for useStealthTransfer hook
 *
 * Uses generic types for Solana objects to avoid direct @solana/web3.js dependency.
 * Pass actual Connection, PublicKey, and Transaction objects from your wallet adapter.
 */
export interface UseStealthTransferParams {
  /** Solana RPC connection (pass actual Connection from @solana/web3.js) */
  connection: SolanaPrivateTransferParams['connection']
  /** Sender's public key (pass actual PublicKey from @solana/web3.js) */
  sender: SolanaPrivateTransferParams['sender'] | null
  /** Function to sign transactions (from wallet adapter) */
  signTransaction?: SolanaPrivateTransferParams['signTransaction']
}

/**
 * Parameters for initiating a transfer
 */
export interface TransferParams {
  /** Recipient's stealth meta-address (sip:solana:...) or StealthMetaAddress object */
  recipientMetaAddress: StealthMetaAddress | string
  /** SPL token mint address (PublicKey) */
  mint: SolanaPrivateTransferParams['mint']
  /** Sender's token account ATA (PublicKey) */
  senderTokenAccount: SolanaPrivateTransferParams['senderTokenAccount']
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
}

/**
 * Return type for useStealthTransfer hook
 */
export interface UseStealthTransferReturn {
  /** Current transfer status */
  status: TransferStatus
  /** Whether a transfer is in progress */
  isLoading: boolean
  /** Error message if transfer failed */
  error: Error | null
  /** Result of the last successful transfer */
  result: SolanaPrivateTransferResult | null
  /** Estimated fee for the transfer (in lamports) */
  estimatedFee: bigint | null
  /** Initiate a stealth transfer */
  transfer: (params: TransferParams) => Promise<SolanaPrivateTransferResult | null>
  /** Estimate the transfer fee */
  estimateFee: (mint: SolanaPrivateTransferParams['mint'], stealthAddress?: string) => Promise<bigint>
  /** Reset state */
  reset: () => void
  /** Clear error */
  clearError: () => void
}

/**
 * Parse meta-address from string or object
 */
function parseMetaAddress(input: StealthMetaAddress | string): StealthMetaAddress {
  if (typeof input === 'object') {
    return input
  }

  // Parse string format: sip:solana:<spendingKey>:<viewingKey>
  const parts = input.split(':')
  if (parts.length < 4 || parts[0] !== 'sip' || parts[1] !== 'solana') {
    throw new Error('Invalid stealth meta-address format. Expected: sip:solana:<spendingKey>:<viewingKey>')
  }

  return {
    chain: 'solana',
    spendingKey: (parts[2].startsWith('0x') ? parts[2] : `0x${parts[2]}`) as `0x${string}`,
    viewingKey: (parts[3].startsWith('0x') ? parts[3] : `0x${parts[3]}`) as `0x${string}`,
  }
}

/**
 * useStealthTransfer - Send SPL tokens to stealth addresses on Solana
 *
 * @remarks
 * This hook provides a React-friendly interface for sending private SPL token
 * transfers using stealth addresses. It handles transaction building, signing,
 * and confirmation with status tracking and error handling.
 *
 * Features:
 * - Send tokens to stealth meta-addresses
 * - Automatic ATA creation for stealth addresses
 * - Fee estimation
 * - Transaction status tracking
 * - Error handling and recovery
 *
 * @param params - Hook configuration parameters
 *
 * @example
 * ```tsx
 * import { useStealthTransfer } from '@sip-protocol/react'
 * import { useConnection, useWallet } from '@solana/wallet-adapter-react'
 * import { PublicKey } from '@solana/web3.js'
 *
 * function SendPrivate() {
 *   const { connection } = useConnection()
 *   const { publicKey, signTransaction } = useWallet()
 *
 *   const {
 *     transfer,
 *     status,
 *     isLoading,
 *     error,
 *     result,
 *   } = useStealthTransfer({
 *     connection,
 *     sender: publicKey,
 *     signTransaction,
 *   })
 *
 *   const handleSend = async () => {
 *     await transfer({
 *       recipientMetaAddress: 'sip:solana:0x...:0x...',
 *       mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
 *       senderTokenAccount: myUSDCAccount,
 *       amount: 5_000_000n, // 5 USDC
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleSend} disabled={isLoading}>
 *         {isLoading ? `${status}...` : 'Send Private'}
 *       </button>
 *       {error && <p>Error: {error.message}</p>}
 *       {result && (
 *         <a href={result.explorerUrl} target="_blank" rel="noreferrer">
 *           View on Solscan
 *         </a>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useStealthTransfer(params: UseStealthTransferParams): UseStealthTransferReturn {
  const { connection, sender, signTransaction } = params

  const [status, setStatus] = useState<TransferStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<SolanaPrivateTransferResult | null>(null)
  const [estimatedFee, setEstimatedFee] = useState<bigint | null>(null)

  const isLoading = status !== 'idle' && status !== 'success' && status !== 'error'

  /**
   * Estimate transfer fee
   */
  const estimateFee = useCallback(
    async (mint: SolanaPrivateTransferParams['mint'], stealthAddress?: string): Promise<bigint> => {
      setStatus('estimating')
      try {
        // Check if ATA needs to be created
        let needsATA = true
        if (stealthAddress) {
          needsATA = !(await hasTokenAccount(connection, stealthAddress, mint))
        }

        const fee = await estimatePrivateTransferFee(connection, needsATA)
        setEstimatedFee(fee)
        setStatus('idle')
        return fee
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to estimate fee')
        setError(error)
        setStatus('error')
        throw error
      }
    },
    [connection]
  )

  /**
   * Execute stealth transfer
   */
  const transfer = useCallback(
    async (transferParams: TransferParams): Promise<SolanaPrivateTransferResult | null> => {
      // Validate prerequisites
      if (!sender) {
        const err = new Error('Wallet not connected: sender is null')
        setError(err)
        setStatus('error')
        return null
      }

      if (!signTransaction) {
        const err = new Error('Wallet does not support signing transactions')
        setError(err)
        setStatus('error')
        return null
      }

      setError(null)
      setResult(null)

      try {
        // Parse meta-address
        setStatus('estimating')
        const recipientMetaAddress = parseMetaAddress(transferParams.recipientMetaAddress)

        // Build SDK params
        setStatus('signing')
        const sdkParams: SolanaPrivateTransferParams = {
          connection,
          sender,
          senderTokenAccount: transferParams.senderTokenAccount,
          recipientMetaAddress,
          mint: transferParams.mint,
          amount: transferParams.amount,
          signTransaction,
        }

        // Execute transfer
        setStatus('sending')
        const transferResult = await sendPrivateSPLTransfer(sdkParams)

        setStatus('confirming')
        // Transaction is already confirmed by sendPrivateSPLTransfer

        setResult(transferResult)
        setStatus('success')
        return transferResult
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transfer failed')
        setError(error)
        setStatus('error')
        return null
      }
    },
    [connection, sender, signTransaction]
  )

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    setEstimatedFee(null)
  }, [])

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
    result,
    estimatedFee,
    transfer,
    estimateFee,
    reset,
    clearError,
  }
}
