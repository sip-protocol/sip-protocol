/**
 * @sip-protocol/react-native
 *
 * React Native SDK for Shielded Intents Protocol - privacy on iOS/Android.
 *
 * @example
 * ```tsx
 * import {
 *   useStealthAddress,
 *   useStealthTransfer,
 *   useScanPayments,
 *   SecureStorage,
 * } from '@sip-protocol/react-native'
 *
 * function PrivacyWallet() {
 *   const { metaAddress, saveToKeychain } = useStealthAddress('solana', {
 *     autoSave: true,
 *     requireBiometrics: true,
 *   })
 *
 *   return <Text>Your private address: {metaAddress}</Text>
 * }
 * ```
 *
 * @packageDocumentation
 */

// Hooks
export {
  // Stealth address generation
  useStealthAddress,
  type UseStealthAddressOptions,
  type UseStealthAddressReturn,
  // Private transfers
  useStealthTransfer,
  type MobileWalletAdapter,
  type TransferStatus,
  type TransferParams,
  type TransferResult,
  type UseStealthTransferParams,
  type UseStealthTransferReturn,
  getAssociatedTokenAddress,
  // Payment scanning
  useScanPayments,
  type ScannedPayment,
  type ScanStatus,
  type UseScanPaymentsParams,
  type UseScanPaymentsReturn,
} from './hooks'

// Secure Storage (Keychain/Keystore)
export { SecureStorage, type SecureStorageOptions, type KeyType } from './storage'

// Utilities
export { copyToClipboard, readFromClipboard, isClipboardAvailable } from './utils'

// Re-export core types for convenience
export type { ChainId, Asset, HexString, PrivacyLevel } from '@sip-protocol/types'
