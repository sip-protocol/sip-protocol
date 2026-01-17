/**
 * SendPrivateForm.tsx
 *
 * Complete example of sending SPL tokens to a stealth address using useStealthTransfer.
 *
 * Features:
 * - Wallet connection integration (Phantom, Solflare, etc.)
 * - Fee estimation before sending
 * - Transaction status tracking with visual feedback
 * - Explorer link after success
 * - Error handling and recovery
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { useStealthTransfer } from '@sip-protocol/react'

// Common SPL token mints (devnet)
const TOKEN_MINTS = {
  USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Devnet USDT
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
} as const

interface SendPrivateFormProps {
  /** Default recipient meta-address (optional) */
  defaultRecipient?: string
  /** Default token mint (optional) */
  defaultMint?: keyof typeof TOKEN_MINTS
}

/**
 * SendPrivateForm - UI for sending private SPL token transfers
 *
 * @example
 * ```tsx
 * import { SendPrivateForm } from './SendPrivateForm'
 *
 * function App() {
 *   return (
 *     <WalletProvider>
 *       <SendPrivateForm defaultMint="USDC" />
 *     </WalletProvider>
 *   )
 * }
 * ```
 */
export function SendPrivateForm({ defaultRecipient = '', defaultMint = 'USDC' }: SendPrivateFormProps) {
  const { connection } = useConnection()
  const { publicKey, signTransaction, connected } = useWallet()

  // Form state
  const [recipient, setRecipient] = useState(defaultRecipient)
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState<keyof typeof TOKEN_MINTS>(defaultMint)

  // Hook for stealth transfers
  const {
    transfer,
    estimateFee,
    status,
    isLoading,
    error,
    result,
    estimatedFee,
    reset,
    clearError,
  } = useStealthTransfer({
    connection,
    sender: publicKey,
    signTransaction,
  })

  /**
   * Handle fee estimation
   */
  const handleEstimateFee = useCallback(async () => {
    if (!selectedToken) return
    const mint = new PublicKey(TOKEN_MINTS[selectedToken])
    await estimateFee(mint)
  }, [estimateFee, selectedToken])

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!publicKey || !recipient || !amount) {
        return
      }

      const mint = new PublicKey(TOKEN_MINTS[selectedToken])
      const senderATA = getAssociatedTokenAddressSync(mint, publicKey)

      // Convert amount to token's smallest unit (assuming 6 decimals for stablecoins)
      const decimals = selectedToken === 'SOL' ? 9 : 6
      const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals))

      await transfer({
        recipientMetaAddress: recipient,
        mint,
        senderTokenAccount: senderATA,
        amount: amountInSmallestUnit,
      })
    },
    [publicKey, recipient, amount, selectedToken, transfer]
  )

  /**
   * Reset form after successful transfer
   */
  const handleReset = useCallback(() => {
    setRecipient('')
    setAmount('')
    reset()
  }, [reset])

  // Render wallet connection prompt if not connected
  if (!connected) {
    return (
      <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Send Private Payment</h2>
        <p className="text-gray-600">Connect your wallet to send private payments.</p>
      </div>
    )
  }

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Send Private Payment</h2>

      {/* Success state */}
      {status === 'success' && result && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-800">Transfer Successful!</h3>
          <p className="text-sm text-green-700 mt-1">
            Sent to stealth address: {result.stealthAddress.slice(0, 8)}...
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-green-600 hover:underline"
            >
              View on Explorer →
            </a>
            <button onClick={handleReset} className="text-sm text-gray-600 hover:underline">
              Send Another
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-medium text-red-800">Transfer Failed</h3>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <button onClick={clearError} className="mt-2 text-sm text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient */}
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
            Recipient Stealth Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="sip:solana:0x..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
            disabled={isLoading}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the recipient's stealth meta-address (starts with sip:solana:)
          </p>
        </div>

        {/* Token selection */}
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700">
            Token
          </label>
          <select
            id="token"
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value as keyof typeof TOKEN_MINTS)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
            disabled={isLoading}
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="SOL">Wrapped SOL</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <div className="mt-1 relative">
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.000001"
              min="0"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
              disabled={isLoading}
              required
            />
            <span className="absolute right-3 top-2 text-gray-500">{selectedToken}</span>
          </div>
        </div>

        {/* Fee estimation */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Estimated fee:</span>
          <div className="flex items-center gap-2">
            {estimatedFee !== null ? (
              <span className="font-mono">{(Number(estimatedFee) / LAMPORTS_PER_SOL).toFixed(6)} SOL</span>
            ) : (
              <span className="text-gray-400">--</span>
            )}
            <button
              type="button"
              onClick={handleEstimateFee}
              className="text-purple-600 hover:underline"
              disabled={isLoading}
            >
              Estimate
            </button>
          </div>
        </div>

        {/* Status indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
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
            <span>
              {status === 'estimating' && 'Estimating fee...'}
              {status === 'signing' && 'Waiting for signature...'}
              {status === 'sending' && 'Sending transaction...'}
              {status === 'confirming' && 'Confirming...'}
            </span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !recipient || !amount}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Send Private Payment'}
        </button>
      </form>

      {/* Info box */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
        <strong>Privacy Note:</strong> This payment uses a stealth address. The recipient is the
        only one who can claim these funds. The transaction will appear on-chain but the recipient's
        identity remains hidden.
      </div>
    </div>
  )
}

export default SendPrivateForm
