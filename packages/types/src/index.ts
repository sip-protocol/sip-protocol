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
