export { useSIP, type UseSIPReturn } from './use-sip'
export { useStealthAddress } from './use-stealth-address'
export {
  usePrivateSwap,
  type SwapStatus,
  type QuoteParams,
  type SwapParams,
  type SwapResult,
} from './use-private-swap'
export { useViewingKey } from './use-viewing-key'

// Solana same-chain privacy hooks
export {
  useStealthTransfer,
  type TransferStatus,
  type UseStealthTransferParams,
  type TransferParams,
  type UseStealthTransferReturn,
} from './use-stealth-transfer'

export {
  useScanPayments,
  type ScanStatus,
  type UseScanPaymentsParams,
  type PaymentWithStatus,
  type UseScanPaymentsReturn,
  type ClaimParams,
  type ClaimAllParams,
  type ClaimAllResult,
  type MintResolver,
} from './use-scan-payments'

// Privacy Advisor hook (LangChain-powered)
export {
  usePrivacyAdvisor,
  type UsePrivacyAdvisorParams,
  type UsePrivacyAdvisorReturn,
} from './use-privacy-advisor'

// NEAR Transaction History (M17-NEAR-20)
export {
  useTransactionHistory,
  type HistoryStatus,
  type UseTransactionHistoryParams,
  type HistoryFilters,
  type TransactionSummary,
  type UseTransactionHistoryReturn,
} from './use-transaction-history'

// Proof Composition Hooks (M20-17)
export {
  // Main hooks
  useProofComposer,
  useProofVerification,
  useComposedProof,
  useProofCache,
  useSystemCompatibility,
  // Types
  type ProofOperationStatus,
  type UseProofComposerConfig,
  type UseProofComposerReturn,
  type UseProofVerificationConfig,
  type UseProofVerificationReturn,
  type UseComposedProofConfig,
  type UseComposedProofReturn,
  type UseProofCacheConfig,
  type UseProofCacheReturn,
  type UseSystemCompatibilityReturn,
} from './use-proof-composition'

// Note: useProofGeneration and useProofQueue will be added after M20-14 merges
