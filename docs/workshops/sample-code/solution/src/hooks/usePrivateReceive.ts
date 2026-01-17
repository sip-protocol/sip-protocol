/**
 * Exercise 3 Solution: Scan & Claim Payments
 */

import { useState, useCallback } from 'react'
import {
  scanForPayments,
  claimStealthPayment,
  deriveStealthPrivateKey,
  createProvider,
} from '@sip-protocol/sdk'
import { useWallet } from '@solana/wallet-adapter-react'

interface IncomingPayment {
  signature: string
  amount: bigint
  token: string
  ephemeralPublicKey: string
  stealthAddress: string
  claimed: boolean
}

interface PrivateAddress {
  spendingKey: string
  viewingKey: string
  publicSpendingKey: string
}

export function usePrivateReceive(privateAddress: PrivateAddress | null) {
  const { publicKey, signTransaction } = useWallet()
  const [payments, setPayments] = useState<IncomingPayment[]>([])
  const [scanning, setScanning] = useState(false)
  const [claiming, setClaiming] = useState(false)

  // Scan for incoming payments using viewing key
  const scan = useCallback(async () => {
    if (!privateAddress) {
      throw new Error('No private address configured')
    }

    setScanning(true)

    try {
      // Create provider for RPC calls
      const provider = createProvider('helius', {
        apiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      // Scan for payments addressed to our stealth meta-address
      // This uses the viewing key to decrypt ephemeral keys from memos
      // and checks if we can derive a matching stealth address
      const found = await scanForPayments({
        provider,
        viewingPrivateKey: privateAddress.viewingKey,
        spendingPublicKey: privateAddress.publicSpendingKey,
      })

      // Update state with found payments
      setPayments(found.map(p => ({
        signature: p.signature,
        amount: p.amount,
        token: p.token,
        ephemeralPublicKey: p.ephemeralPublicKey,
        stealthAddress: p.stealthAddress,
        claimed: false,
      })))

      return found
    } finally {
      setScanning(false)
    }
  }, [privateAddress])

  // Claim a specific payment to main wallet
  const claim = useCallback(async (payment: IncomingPayment) => {
    if (!privateAddress || !publicKey || !signTransaction) {
      throw new Error('Not ready to claim')
    }

    setClaiming(true)

    try {
      const provider = createProvider('helius', {
        apiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      // Derive the private key for this specific stealth address
      // This combines our spending key with the ephemeral public key
      // Only we can do this derivation since we have the spending key
      const stealthPrivateKey = deriveStealthPrivateKey(
        privateAddress.spendingKey,
        payment.ephemeralPublicKey
      )

      // Transfer funds from stealth address to our main wallet
      const result = await claimStealthPayment({
        provider,
        stealthPrivateKey,
        stealthAddress: payment.stealthAddress,
        destinationAddress: publicKey.toBase58(),
        tokenMint: payment.token,
        amount: payment.amount,
        signTransaction,
      })

      // Mark as claimed in our local state
      setPayments(prev =>
        prev.map(p =>
          p.signature === payment.signature
            ? { ...p, claimed: true }
            : p
        )
      )

      return result
    } finally {
      setClaiming(false)
    }
  }, [privateAddress, publicKey, signTransaction])

  // Claim all unclaimed payments
  const claimAll = useCallback(async () => {
    const unclaimed = payments.filter(p => !p.claimed)
    const results = []

    for (const payment of unclaimed) {
      const result = await claim(payment)
      results.push(result)
    }

    return results
  }, [payments, claim])

  return {
    payments,
    scan,
    claim,
    claimAll,
    scanning,
    claiming,
    unclaimedCount: payments.filter(p => !p.claimed).length,
  }
}
