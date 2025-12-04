import { useState, useEffect, useCallback } from 'react'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  encodeStealthMetaAddress,
  isEd25519Chain,
} from '@sip-protocol/sdk'
import type { ChainId } from '@sip-protocol/types'

/**
 * useStealthAddress - Generate and manage stealth addresses
 *
 * @remarks
 * This hook handles stealth address generation for privacy-preserving transactions.
 * It automatically generates a meta-address on mount and allows regeneration of
 * one-time stealth addresses from that meta-address.
 *
 * Features:
 * - Auto-generates meta-address for the specified chain
 * - Generates one-time stealth addresses
 * - Supports both secp256k1 (EVM) and ed25519 (Solana/NEAR) chains
 * - Copy-to-clipboard functionality
 * - Loading state management
 *
 * @param chain - Target blockchain (determines curve type and address format)
 *
 * @example
 * ```tsx
 * import { useStealthAddress } from '@sip-protocol/react'
 *
 * function ReceivePayment() {
 *   const {
 *     metaAddress,
 *     stealthAddress,
 *     isGenerating,
 *     regenerate,
 *     copyToClipboard,
 *   } = useStealthAddress('ethereum')
 *
 *   return (
 *     <div>
 *       <p>Share this: {metaAddress}</p>
 *       <p>One-time address: {stealthAddress}</p>
 *       <button onClick={regenerate}>Generate New</button>
 *       <button onClick={copyToClipboard}>Copy</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useStealthAddress(chain: ChainId): {
  metaAddress: string | null
  stealthAddress: string | null
  isGenerating: boolean
  error: Error | null
  regenerate: () => void
  copyToClipboard: () => Promise<void>
  clearError: () => void
} {
  const [metaAddress, setMetaAddress] = useState<string | null>(null)
  const [stealthAddress, setStealthAddress] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Generate meta-address on mount
  useEffect(() => {
    let cancelled = false

    setIsGenerating(true)

    // Use setTimeout to make it async and allow state to flush
    const timer = setTimeout(() => {
      if (cancelled) return

      try {
        // Use ed25519 for Solana/NEAR/Aptos/Sui, secp256k1 for others
        const isEd25519 = isEd25519Chain(chain)

        const metaAddressData = isEd25519
          ? generateEd25519StealthMetaAddress(chain)
          : generateStealthMetaAddress(chain)

        const encoded = encodeStealthMetaAddress(metaAddressData.metaAddress)
        if (cancelled) return
        setMetaAddress(encoded)

        // Generate initial stealth address from meta-address
        const stealthData = isEd25519
          ? generateEd25519StealthAddress(metaAddressData.metaAddress)
          : generateStealthAddress(metaAddressData.metaAddress)

        if (cancelled) return
        setStealthAddress(stealthData.stealthAddress.address)
        setError(null) // Clear any previous error on success
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error('Failed to generate stealth addresses')
        setError(error)
        setMetaAddress(null)
        setStealthAddress(null)
      } finally {
        if (!cancelled) {
          setIsGenerating(false)
        }
      }
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [chain])

  // Regenerate stealth address from existing meta-address
  const regenerate = useCallback(() => {
    if (!metaAddress) {
      return
    }

    setIsGenerating(true)

    // Use setTimeout to make it async
    setTimeout(() => {
      try {
        // Parse the meta-address back to object
        const parts = metaAddress.split(':')
        if (parts.length < 4) {
          throw new Error('Invalid meta-address format')
        }

        const [, chainId, spendingKey, viewingKey] = parts
        const metaAddressObj = {
          chain: chainId as ChainId,
          spendingKey: (spendingKey.startsWith('0x') ? spendingKey : `0x${spendingKey}`) as `0x${string}`,
          viewingKey: (viewingKey.startsWith('0x') ? viewingKey : `0x${viewingKey}`) as `0x${string}`,
        }

        // Generate new stealth address
        const isEd25519 = isEd25519Chain(chain)
        const stealthData = isEd25519
          ? generateEd25519StealthAddress(metaAddressObj)
          : generateStealthAddress(metaAddressObj)

        setStealthAddress(stealthData.stealthAddress.address)
        setError(null) // Clear any previous error on success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to regenerate stealth address')
        setError(error)
      } finally {
        setIsGenerating(false)
      }
    }, 0)
  }, [metaAddress, chain])

  // Copy stealth address to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!stealthAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(stealthAddress)
      setError(null) // Clear any previous error on success
    } catch (clipboardErr) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = stealthAddress
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setError(null) // Clear any previous error on success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy to clipboard')
        setError(error)
      } finally {
        document.body.removeChild(textArea)
      }
    }
  }, [stealthAddress])

  // Clear error state
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    metaAddress,
    stealthAddress,
    isGenerating,
    error,
    regenerate,
    copyToClipboard,
    clearError,
  }
}
