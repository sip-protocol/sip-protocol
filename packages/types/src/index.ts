/**
 * @sip-protocol/types
 *
 * TypeScript type definitions for Shielded Intents Protocol (SIP)
 */

// Privacy
export { PrivacyLevel, isPrivate, supportsViewingKey } from './privacy'

// Crypto primitives
export type {
  HexString,
  Hash,
  Commitment,
  ZKProof,
  ViewingKey,
  EncryptedTransaction,
  ViewingProof,
} from './crypto'

// Stealth addresses
export type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  ChainId,
  StealthRegistryEntry,
} from './stealth'

// Assets
export type {
  Asset,
  AssetAmount,
  IntentInput,
  IntentOutput,
} from './asset'
export { NATIVE_TOKENS } from './asset'

// Intents
export { SIP_VERSION, IntentStatus } from './intent'
export type {
  ShieldedIntent,
  CreateIntentParams,
  Quote,
  FulfillmentResult,
  TrackedIntent,
} from './intent'

// Solver
export type {
  Solver,
  SolverCapabilities,
  SolverVisibleIntent,
  SolverQuote,
  SwapRoute,
  SwapRouteStep,
  SIPSolver,
  FulfillmentStatus,
  FulfillmentRequest,
  FulfillmentCommitment,
  FulfillmentProof,
  SolverEvent,
  SolverEventListener,
} from './solver'

// NEAR Intents
export {
  OneClickSwapType,
  OneClickDepositMode,
  OneClickSwapStatus,
  OneClickDepositType,
  OneClickRefundType,
  OneClickRecipientType,
  SolverIntentStatus,
  SolverSignatureType,
  OneClickErrorCode,
} from './near-intents'
export type {
  DefuseAssetId,
  ChainType,
  OneClickToken,
  OneClickAppFee,
  OneClickQuoteRequest,
  OneClickQuoteResponse,
  OneClickDepositSubmit,
  OneClickChainTx,
  OneClickStatusResponse,
  OneClickWithdrawal,
  SolverQuoteRequest,
  SolverQuoteResponse,
  SolverSignedData,
  SolverPublishIntent,
  SolverStatusResponse,
  TokenDiffIntent,
  SolverQuoteEvent,
  SolverQuoteStatusEvent,
  OneClickError,
  OneClickConfig,
  SolverRelayConfig,
} from './near-intents'

// Zcash
export { ZcashErrorCode } from './zcash'
export type {
  ZcashConfig,
  ZcashNetwork,
  ZcashAddressType,
  ZcashReceiverType,
  ZcashAddressInfo,
  ZcashNewAccount,
  ZcashAccountAddress,
  ZcashPoolBalance,
  ZcashAccountBalance,
  ZcashPool,
  ZcashUnspentNote,
  ZcashSendRecipient,
  ZcashPrivacyPolicy,
  ZcashShieldedSendParams,
  ZcashOperationStatus,
  ZcashOperationTxResult,
  ZcashOperationError,
  ZcashOperation,
  ZcashBlockHeader,
  ZcashBlock,
  ZcashRPCRequest,
  ZcashRPCResponse,
  ZcashRPCError,
  ZcashErrorCodeType,
  ZcashBlockchainInfo,
  ZcashNetworkInfo,
} from './zcash'

// Payments
export { PaymentStatus } from './payment'
export type {
  StablecoinSymbol,
  PaymentPurpose,
  PaymentStatusType,
  ShieldedPayment,
  CreatePaymentParams,
  PaymentReceipt,
  TrackedPayment,
} from './payment'

// Treasury
export { ProposalStatus } from './treasury'
export type {
  TreasuryRole,
  ProposalStatusType,
  ProposalType,
  TreasuryMember,
  TreasuryConfig,
  BatchPaymentRecipient,
  BatchPaymentRequest,
  ProposalSignature,
  TreasuryProposal,
  TreasuryBalance,
  TreasuryTransaction,
  CreateTreasuryParams,
  CreatePaymentProposalParams,
  CreateBatchProposalParams,
  AuditorViewingKey,
} from './treasury'

// Compliance
export { ReportStatus } from './compliance'
export type {
  ComplianceRole,
  AuditScope,
  AuditorRegistration,
  DisclosedTransaction,
  ReportType,
  ReportFormat,
  ReportStatusType,
  ComplianceReport,
  ReportData,
  ComplianceConfig,
  CreateComplianceConfigParams,
  RegisterAuditorParams,
  GenerateReportParams,
  DisclosureRequest,
  AuditLogEntry,
  ComplianceMetrics,
} from './compliance'

// NFT Types
export type {
  PrivateNFTOwnership,
  OwnershipProof,
  CreatePrivateOwnershipParams,
  ProveOwnershipParams,
  OwnershipVerification,
  TransferPrivatelyParams,
  TransferResult,
  NFTTransfer,
  OwnedNFT,
} from './nft'

// Auction Types
export type {
  WinnerResult,
  WinnerProof,
  WinnerVerification,
} from './auction'

// Proof Composition
export {
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
  DEFAULT_COMPOSITION_CONFIG,
} from './proof-composition'
export type {
  ProofSystem,
  ProofMetadata,
  SingleProof,
  ComposedProof,
  CompositionMetadata,
  VerificationHints,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  CompositionResult,
  CompositionError,
  CompositionMetrics,
  VerificationResult,
  IndividualVerificationResult,
  CompositionEventType,
  CompositionEvent,
  CompositionProgressEvent,
  CompositionEventListener,
} from './proof-composition'

// Wallet Adapters
export { WalletErrorCode } from './wallet'
export type {
  // Core types
  WalletConnectionState,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  // Events
  WalletEventType,
  WalletEventBase,
  WalletConnectEvent,
  WalletDisconnectEvent,
  WalletAccountChangedEvent,
  WalletChainChangedEvent,
  WalletErrorEvent,
  WalletEvent,
  WalletEventHandler,
  // Adapter interfaces
  WalletAdapter,
  PrivateWalletAdapter,
  // Privacy params
  ShieldedSendParams as WalletShieldedSendParams,
  ShieldedSendResult as WalletShieldedSendResult,
  // Error types
  WalletErrorCodeType,
  // Registry
  WalletInfo,
  WalletAdapterFactory,
  WalletRegistryEntry,
} from './wallet'
