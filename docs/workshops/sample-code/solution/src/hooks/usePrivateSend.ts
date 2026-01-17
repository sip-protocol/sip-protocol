/**
 * Exercise 2 Solution: Send Private Payment
 */

import { useState, useCallback } from 'react'
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
  sendPrivateSPLTransfer,
  createProvider,
} from '@sip-protocol/sdk'
import { useWallet } from '@solana/wallet-adapter-react'

export function usePrivateSend() {
  const { publicKey, signTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendPrivate = useCallback(async (params: {
    recipientMeta: string  // sip:solana:0x...
    amount: number         // in UI units (e.g., 1.5 for 1.5 SOL)
    token: 'SOL' | 'USDC'
  }) => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Decode recipient's meta-address
      const recipientMeta = decodeStealthMetaAddress(params.recipientMeta)

      // 2. Generate one-time stealth address for this payment
      // This creates a unique address that only the recipient can spend from
      const stealth = generateStealthAddress(recipientMeta)

      // 3. Create RPC provider (using Helius for indexed data)
      const provider = createProvider('helius', {
        apiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      // 4. Convert amount to smallest units (lamports for SOL, 6 decimals for USDC)
      const decimals = params.token === 'SOL' ? 9 : 6
      const amount = BigInt(Math.floor(params.amount * 10 ** decimals))

      // 5. Send the private transfer
      // This sends to the stealth address and includes the ephemeral key in memo
      const result = await sendPrivateSPLTransfer({
        provider,
        senderPublicKey: publicKey.toBase58(),
        stealthAddress: stealth.stealthAddress,
        ephemeralPublicKey: stealth.ephemeralPublicKey,
        amount,
        tokenMint: params.token === 'SOL' ? 'native' : 'USDC',
        signTransaction,
      })

      return {
        signature: result.signature,
        stealthAddress: stealth.stealthAddress,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [publicKey, signTransaction])

  return {
    sendPrivate,
    loading,
    error,
  }
}
