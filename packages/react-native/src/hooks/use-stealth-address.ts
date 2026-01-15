/**
 * useStealthAddress - Mobile-optimized stealth address hook
 *
 * React Native version with secure storage and native clipboard support.
 *
 * @example
 * ```tsx
 * import { useStealthAddress } from '@sip-protocol/react-native'
 *
 * function ReceiveScreen() {
 *   const {
 *     metaAddress,
 *     stealthAddress,
 *     isGenerating,
 *     regenerate,
 *     copyToClipboard,
 *     saveToKeychain,
 *   } = useStealthAddress('solana')
 *
 *   return (
 *     <View>
 *       <Text>Share: {metaAddress}</Text>
 *       <TouchableOpacity onPress={copyToClipboard}>
 *         <Text>Copy</Text>
 *       </TouchableOpacity>
 *       <TouchableOpacity onPress={saveToKeychain}>
 *         <Text>Save Securely</Text>
 *       </TouchableOpacity>
 *     </View>
 *   )
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { copyToClipboard as nativeCopyToClipboard } from '../utils/clipboard'
import { SecureStorage } from '../storage/secure-storage'

/**
 * Supported chain IDs (matches @sip-protocol/types ChainId)
 */
export type SupportedChainId =
  | 'ethereum'
  | 'solana'
  | 'near'
  | 'bitcoin'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'bsc'
  | 'avalanche'
  | 'cosmos'
  | 'aptos'
  | 'sui'
  | 'polkadot'
  | 'tezos'

/**
 * Stealth meta-address structure from SDK
 */
interface StealthMetaAddressResult {
  metaAddress: {
    chain: string
    spendingKey: string
    viewingKey: string
  }
  spendingPrivateKey: string
  viewingPrivateKey: string
}

/**
 * Stealth address generation result from SDK
 */
interface StealthAddressResult {
  stealthAddress: {
    address: string
  }
  ephemeralPublicKey: string
}

/**
 * Options for useStealthAddress hook
 */
export interface UseStealthAddressOptions {
  /** Auto-save to secure storage on generation */
  autoSave?: boolean
  /** Require biometrics to access stored keys */
  requireBiometrics?: boolean
  /** Wallet identifier for storage (default: 'default') */
  walletId?: string
}

/**
 * Return type for useStealthAddress hook
 */
export interface UseStealthAddressReturn {
  /** Encoded meta-address for sharing */
  metaAddress: string | null
  /** One-time stealth address */
  stealthAddress: string | null
  /** Spending private key (for claiming) */
  spendingPrivateKey: string | null
  /** Viewing private key (for scanning) */
  viewingPrivateKey: string | null
  /** Whether generation is in progress */
  isGenerating: boolean
  /** Error if any occurred */
  error: Error | null
  /** Generate a new stealth address */
  regenerate: () => void
  /** Copy stealth address to clipboard */
  copyToClipboard: () => Promise<boolean>
  /** Save keys to secure storage */
  saveToKeychain: () => Promise<boolean>
  /** Load keys from secure storage */
  loadFromKeychain: () => Promise<boolean>
  /** Clear error state */
  clearError: () => void
}

/**
 * Mobile-optimized stealth address hook
 *
 * @param chain - Target blockchain
 * @param options - Hook options
 */
export function useStealthAddress(
  chain: SupportedChainId,
  options: UseStealthAddressOptions = {}
): UseStealthAddressReturn {
  const { autoSave = false, requireBiometrics = false, walletId = 'default' } = options

  const [metaAddress, setMetaAddress] = useState<string | null>(null)
  const [stealthAddress, setStealthAddress] = useState<string | null>(null)
  const [spendingPrivateKey, setSpendingPrivateKey] = useState<string | null>(null)
  const [viewingPrivateKey, setViewingPrivateKey] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Generate keys on mount
  useEffect(() => {
    let cancelled = false

    const generate = async () => {
      setIsGenerating(true)

      try {
        // Dynamic import SDK functions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdk: any = await import('@sip-protocol/sdk')

        // Generate meta-address with keys (handles Ed25519 vs secp256k1 internally)
        const generateStealthMetaAddress = sdk.generateStealthMetaAddress as (
          chain: string
        ) => StealthMetaAddressResult

        const metaAddressData = generateStealthMetaAddress(chain)

        if (cancelled) return

        const encodeStealthMetaAddress = sdk.encodeStealthMetaAddress as (
          metaAddress: { chain: string; spendingKey: string; viewingKey: string }
        ) => string

        const encoded = encodeStealthMetaAddress(metaAddressData.metaAddress)
        setMetaAddress(encoded)
        setSpendingPrivateKey(metaAddressData.spendingPrivateKey)
        setViewingPrivateKey(metaAddressData.viewingPrivateKey)

        // Generate initial stealth address
        const generateStealthAddress = sdk.generateStealthAddress as (
          metaAddress: { chain: string; spendingKey: string; viewingKey: string }
        ) => StealthAddressResult

        const stealthData = generateStealthAddress(metaAddressData.metaAddress)

        if (cancelled) return
        setStealthAddress(stealthData.stealthAddress.address)
        setError(null)

        // Auto-save if enabled
        if (autoSave && !cancelled) {
          await SecureStorage.setSpendingKey(walletId, metaAddressData.spendingPrivateKey, {
            requireBiometrics,
          })
          await SecureStorage.setViewingKey(walletId, metaAddressData.viewingPrivateKey, {
            requireBiometrics,
          })
          await SecureStorage.setMetaAddress(walletId, encoded, { requireBiometrics })
        }
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error('Failed to generate stealth addresses')
        setError(error)
        setMetaAddress(null)
        setStealthAddress(null)
        setSpendingPrivateKey(null)
        setViewingPrivateKey(null)
      } finally {
        if (!cancelled) {
          setIsGenerating(false)
        }
      }
    }

    generate()

    return () => {
      cancelled = true
    }
  }, [chain, autoSave, requireBiometrics, walletId])

  // Regenerate stealth address
  const regenerate = useCallback(() => {
    if (!metaAddress) return

    setIsGenerating(true)

    // Use setTimeout to avoid blocking UI
    setTimeout(async () => {
      try {
        const parts = metaAddress.split(':')
        if (parts.length < 4) {
          throw new Error('Invalid meta-address format')
        }

        const [, chainId, spendingKey, viewingKey] = parts
        const metaAddressObj = {
          chain: chainId,
          spendingKey: spendingKey.startsWith('0x') ? spendingKey : `0x${spendingKey}`,
          viewingKey: viewingKey.startsWith('0x') ? viewingKey : `0x${viewingKey}`,
        }

        // Dynamic import SDK
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdk: any = await import('@sip-protocol/sdk')
        const generateStealthAddress = sdk.generateStealthAddress as (
          metaAddress: { chain: string; spendingKey: string; viewingKey: string }
        ) => StealthAddressResult

        const stealthData = generateStealthAddress(metaAddressObj)

        setStealthAddress(stealthData.stealthAddress.address)
        setError(null)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to regenerate stealth address')
        setError(error)
      } finally {
        setIsGenerating(false)
      }
    }, 0)
  }, [metaAddress])

  // Copy to clipboard (native)
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!stealthAddress) return false
    const success = await nativeCopyToClipboard(stealthAddress)
    if (!success) {
      setError(new Error('Failed to copy to clipboard'))
    } else {
      setError(null)
    }
    return success
  }, [stealthAddress])

  // Save to secure storage
  const saveToKeychain = useCallback(async (): Promise<boolean> => {
    if (!spendingPrivateKey || !viewingPrivateKey || !metaAddress) {
      setError(new Error('No keys to save'))
      return false
    }

    try {
      await SecureStorage.setSpendingKey(walletId, spendingPrivateKey, { requireBiometrics })
      await SecureStorage.setViewingKey(walletId, viewingPrivateKey, { requireBiometrics })
      await SecureStorage.setMetaAddress(walletId, metaAddress, { requireBiometrics })
      setError(null)
      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save to keychain')
      setError(error)
      return false
    }
  }, [spendingPrivateKey, viewingPrivateKey, metaAddress, walletId, requireBiometrics])

  // Load from secure storage
  const loadFromKeychain = useCallback(async (): Promise<boolean> => {
    try {
      const storedMeta = await SecureStorage.getMetaAddress(walletId, { requireBiometrics })
      const storedSpending = await SecureStorage.getSpendingKey(walletId, { requireBiometrics })
      const storedViewing = await SecureStorage.getViewingKey(walletId, { requireBiometrics })

      if (!storedMeta || !storedSpending || !storedViewing) {
        setError(new Error('No keys found in keychain'))
        return false
      }

      setMetaAddress(storedMeta)
      setSpendingPrivateKey(storedSpending)
      setViewingPrivateKey(storedViewing)
      setError(null)
      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load from keychain')
      setError(error)
      return false
    }
  }, [walletId, requireBiometrics])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    metaAddress,
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey,
    isGenerating,
    error,
    regenerate,
    copyToClipboard,
    saveToKeychain,
    loadFromKeychain,
    clearError,
  }
}
