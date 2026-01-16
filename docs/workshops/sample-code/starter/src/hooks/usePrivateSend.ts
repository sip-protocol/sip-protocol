/**
 * Exercise 2: Send Private Payment
 *
 * Goal: Send SOL or USDC privately to another stealth address.
 *
 * Instructions:
 * 1. Import decodeStealthMetaAddress, generateStealthAddress,
 *    sendPrivateSPLTransfer, createProvider from @sip-protocol/sdk
 * 2. Use wallet adapter to get publicKey and signTransaction
 * 3. Implement sendPrivate() that:
 *    - Decodes recipient's meta-address
 *    - Generates one-time stealth address
 *    - Creates Helius provider
 *    - Calls sendPrivateSPLTransfer()
 * 4. Handle loading and error states
 *
 * See hands-on-tutorial.md for full solution.
 */

import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
// TODO: Import from @sip-protocol/sdk

export function usePrivateSend() {
  const { publicKey, signTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendPrivate = useCallback(async (params: {
    recipientMeta: string
    amount: number
    token: 'SOL' | 'USDC'
  }) => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    setLoading(true)
    setError(null)

    try {
      // TODO: Implement private send
      // 1. Decode recipient meta-address
      // 2. Generate one-time stealth address
      // 3. Create provider
      // 4. Send transfer

      throw new Error('Not implemented - complete Exercise 2')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
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
