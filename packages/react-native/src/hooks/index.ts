/**
 * React Native Hooks for SIP Protocol
 *
 * Mobile-optimized hooks with native storage and clipboard support.
 */

export {
  useStealthAddress,
  type UseStealthAddressOptions,
  type UseStealthAddressReturn,
} from './use-stealth-address'

export {
  useStealthTransfer,
  type MobileWalletAdapter,
  type TransferStatus,
  type TransferParams,
  type TransferResult,
  type UseStealthTransferParams,
  type UseStealthTransferReturn,
  getAssociatedTokenAddress,
} from './use-stealth-transfer'

export {
  useScanPayments,
  type ScannedPayment,
  type ScanStatus,
  type UseScanPaymentsParams,
  type UseScanPaymentsReturn,
} from './use-scan-payments'
