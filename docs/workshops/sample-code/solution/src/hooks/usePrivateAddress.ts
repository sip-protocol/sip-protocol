/**
 * Exercise 1 Solution: Generate Stealth Meta-Address
 */

import { useState, useCallback } from 'react'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

interface PrivateAddressState {
  encoded: string
  spendingKey: string
  viewingKey: string
  publicSpendingKey: string
}

export function usePrivateAddress() {
  const [metaAddress, setMetaAddress] = useState<PrivateAddressState | null>(null)

  const generate = useCallback(() => {
    // Generate stealth meta-address with spending and viewing key pairs
    const meta = generateStealthMetaAddress()

    // Encode for sharing - this is the public "private address"
    const encoded = encodeStealthMetaAddress(meta)

    const state: PrivateAddressState = {
      encoded,
      // Private keys - store these securely in production!
      spendingKey: meta.spendingKey.privateKey,
      viewingKey: meta.viewingKey.privateKey,
      // Public spending key needed for scanning
      publicSpendingKey: meta.spendingKey.publicKey,
    }

    setMetaAddress(state)

    return encoded
  }, [])

  return {
    metaAddress,
    generate,
    receiveAddress: metaAddress?.encoded ?? null,
  }
}
