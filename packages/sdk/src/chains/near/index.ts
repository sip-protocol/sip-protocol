/**
 * NEAR Same-Chain Privacy Module
 *
 * Provides privacy-preserving NEAR and NEP-141 token transfers using stealth addresses.
 *
 * @example Sender flow
 * ```typescript
 * import { sendPrivateNEARTransfer } from '@sip-protocol/sdk'
 *
 * const result = await sendPrivateNEARTransfer({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   senderAccountId: 'alice.near',
 *   senderPrivateKey: 'ed25519:...',
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   amount: 1_000_000_000_000_000_000_000_000n, // 1 NEAR
 * })
 * ```
 *
 * @example Recipient flow
 * ```typescript
 * import { scanForNEARPayments, claimNEARPayment } from '@sip-protocol/sdk'
 *
 * // Scan for incoming payments
 * const payments = await scanForNEARPayments({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   viewingPrivateKey,
 *   spendingPublicKey,
 * })
 *
 * // Claim a payment
 * const result = await claimNEARPayment({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   stealthAddress: payments[0].stealthAddress,
 *   ephemeralPublicKey: payments[0].ephemeralPublicKey,
 *   viewingPrivateKey,
 *   spendingPrivateKey,
 *   destinationAccountId: 'alice.near',
 * })
 * ```
 *
 * @packageDocumentation
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  NEAR_RPC_ENDPOINTS,
  NEAR_EXPLORER_URLS,
  NEAR_TOKEN_CONTRACTS,
  NEAR_TOKEN_DECIMALS,
  SIP_MEMO_PREFIX,
  NEAR_IMPLICIT_ACCOUNT_LENGTH,
  NEAR_ACCOUNT_ID_MIN_LENGTH,
  NEAR_ACCOUNT_ID_MAX_LENGTH,
  ED25519_KEY_BYTES,
  ED25519_KEY_HEX_LENGTH,
  VIEW_TAG_MIN,
  VIEW_TAG_MAX,
  DEFAULT_GAS,
  STORAGE_BALANCE_MIN,
  STORAGE_DEPOSIT_DEFAULT,
  ONE_YOCTO,
  ONE_NEAR,
  getExplorerUrl,
  getAccountExplorerUrl,
  getTokenContract,
  getNEARTokenDecimals,
  isImplicitAccount,
  isNamedAccount,
  isValidAccountId,
  sanitizeUrl,
  type NEARNetwork,
} from './constants'

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  NEARAnnouncement,
  NEARPrivateTransferParams,
  NEARPrivateTransferResult,
  NEARScanParams,
  NEARScanResult,
  NEARDetectedPayment,
  NEARClaimParams,
  NEARClaimResult,
  NEARStealthBalance,
  NEARRpcError,
  NEARTransactionOutcome,
} from './types'

export { parseAnnouncement, createAnnouncementMemo } from './types'

// ─── Stealth Address (M17-NEAR-01, M17-NEAR-02) ──────────────────────────────

export {
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  checkNEARStealthAddress,
  ed25519PublicKeyToImplicitAccount,
  implicitAccountToEd25519PublicKey,
  encodeNEARStealthMetaAddress,
  parseNEARStealthMetaAddress,
  validateNEARStealthMetaAddress,
  validateNEARStealthAddress,
  type NEARStealthAddressResult,
  type NEARStealthMetaAddressResult,
} from './stealth'

// ─── Pedersen Commitments (M17-NEAR-03) ──────────────────────────────────────

export {
  // Core commitment functions
  commitNEAR,
  verifyOpeningNEAR,
  // NEP-141 token commitments
  commitNEP141Token,
  verifyNEP141TokenCommitment,
  // Amount conversion utilities
  toYoctoNEAR,
  fromYoctoNEAR,
  // Homomorphic operations
  addCommitmentsNEAR,
  subtractCommitmentsNEAR,
  addBlindingsNEAR,
  subtractBlindingsNEAR,
  // Utility functions
  getGeneratorsNEAR,
  generateBlindingNEAR,
  // Constants
  ED25519_ORDER as NEAR_ED25519_ORDER,
  MAX_NEAR_AMOUNT,
  MAX_COMMITMENT_VALUE as NEAR_MAX_COMMITMENT_VALUE,
  // Types
  type NEARPedersenCommitment,
  type NEARCommitmentPoint,
  type NEP141TokenCommitment,
} from './commitment'

// ─── Viewing Keys (M17-NEAR-04) ───────────────────────────────────────────────

export {
  // Key generation
  generateNEARViewingKeyFromSpending,
  generateRandomNEARViewingKey,
  // Hash computation
  computeNEARViewingKeyHash,
  computeNEARViewingKeyHashFromPrivate,
  // Export/Import
  exportNEARViewingKey,
  importNEARViewingKey,
  // Encryption/Decryption
  encryptForNEARViewing,
  decryptWithNEARViewing,
  // Storage
  createNEARMemoryStorage,
  // Utilities
  isNEARAnnouncementForViewingKey,
  deriveNEARChildViewingKey,
  getNEARViewingPublicKey,
  validateNEARViewingKey,
  // Types
  type NEARViewingKey,
  type NEARViewingKeyExport,
  type NEAREncryptedPayload,
  type NEARTransactionData,
  type NEARViewingKeyStorage,
} from './viewing-key'

// ─── Stealth Address Resolver (M17-NEAR-05) ───────────────────────────────────

export {
  // Scanner class
  NEARStealthScanner,
  createNEARStealthScanner,
  // Cache
  createNEARAnnouncementCache,
  // Batch utilities
  batchScanNEARAnnouncements,
  hasNEARAnnouncementMatch,
  // Types
  type NEARScanRecipient,
  type NEARStealthScannerOptions,
  type NEARHistoricalScanOptions,
  type NEARDetectedPaymentResult,
  type NEARHistoricalScanResult,
  type NEARPaymentCallback,
  type NEARErrorCallback,
  type NEARAnnouncementCache,
} from './resolver'

// ─── Implicit Account Privacy (M17-NEAR-06) ───────────────────────────────────

export {
  // Private transfer building
  buildPrivateTransfer,
  buildPrivateTokenTransfer,
  buildStorageDeposit,
  // Key derivation
  deriveStealthAccountKeyPair,
  // Claim transactions
  buildClaimTransaction,
  buildDeleteStealthAccount,
  // Access key management
  buildAddAccessKey,
  buildKeyRotation,
  // Account utilities
  isStealthCompatibleAccount,
  getImplicitAccountPublicKey,
  verifyImplicitAccountMatch,
  // Types
  type NEARPrivateTransferBuild,
  type NEARAction,
  type NEARTransferAction,
  type NEARFunctionCallAction,
  type NEARAddKeyAction,
  type NEARDeleteKeyAction,
  type NEARDeleteAccountAction,
  type NEARStealthKeyPair,
  type DeriveStealthKeyPairParams,
  type NEARClaimTransactionParams,
  type NEARClaimTransactionBuild,
  type NEARAddAccessKeyParams,
  type NEARKeyRotationParams,
} from './implicit-account'

// ─── Privacy Adapter (M17-NEAR-07) ────────────────────────────────────────────

export {
  // Adapter class
  NEARPrivacyAdapter,
  createNEARPrivacyAdapter,
  createMainnetNEARPrivacyAdapter,
  createTestnetNEARPrivacyAdapter,
  // Types
  type NEARPrivacyLevel,
  type NEARPrivacyAdapterConfig,
  type NEARShieldedTransferParams,
  type NEARShieldedTokenTransferParams,
  type NEARShieldedTransferBuild,
  type NEARAdapterClaimParams,
  type NEARGasEstimate,
  type NEARPrivacyAdapterState,
} from './privacy-adapter'

// ─── RPC Client (M17-NEAR-08) ─────────────────────────────────────────────────

export {
  // Client class
  NEARRpcClient,
  createNEARRpcClient,
  createMainnetRpcClient,
  createTestnetRpcClient,
  // Error handling
  NEARRpcClientError,
  NEARErrorCode,
  // Types
  type NEARFinality,
  type NEARTransactionStatus,
  type NEARRpcConfig,
  type NEARAccessKey,
  type NEARAccountInfo,
  type NEARBlockInfo,
  type NEARTransactionOutcome as NEARRpcTransactionOutcome,
  type NEARReceiptOutcome,
  type NEARSignedTransaction,
  type NEARTxStatusResult,
  type NEARPollOptions,
} from './rpc'

// ─── NEP-141 Token Privacy (M17-NEAR-09) ───────────────────────────────────────

export {
  // Privacy-wrapped transfers
  buildPrivateTokenTransferWithCommitment,
  buildPrivateTokenTransferCall,
  // Batch transfers
  buildBatchPrivateTokenTransfer,
  buildBatchStorageDeposit,
  // Storage management
  buildStorageWithdraw,
  buildStorageUnregister,
  // Token utilities
  parseTokenMetadata,
  formatTokenAmount,
  parseTokenAmount,
  // Commitment utilities
  extractCommitmentFromMemo,
  verifyCommitmentInMemo,
  // Constants
  FT_TRANSFER_CALL_GAS,
  FT_TRANSFER_CALL_TOTAL_GAS,
  // Types
  type PrivateTokenTransferWithCommitmentParams,
  type PrivateTokenTransferWithCommitmentResult,
  type PrivateTokenTransferCallParams,
  type PrivateTokenTransferCallResult,
  type BatchTokenTransferParams,
  type BatchTokenTransferResult,
  type NEP141TokenMetadata,
  type TokenBalanceInfo,
  type StorageDepositInfo,
} from './nep141'

// ─── Native Transfer (M17-NEAR-10) ─────────────────────────────────────────────

export {
  // Privacy-wrapped transfers
  buildPrivateNativeTransferWithCommitment,
  buildBatchPrivateNativeTransfer,
  // Gas sponsorship
  buildGasSponsoredTransfer,
  // Account creation helpers
  getAccountCreationCost,
  meetsMinimumBalance,
  calculateRecommendedAmount,
  adjustTransferAmount,
  // Amount formatting
  formatNEARAmount,
  parseNEARAmount,
  // Commitment verification
  verifyNativeTransferCommitment,
  createTransferCommitmentProof,
  // Constants
  IMPLICIT_ACCOUNT_CREATION_COST,
  STORAGE_COST_PER_BYTE,
  RECOMMENDED_STEALTH_MINIMUM,
  RELAYER_GAS,
  // Types
  type PrivateNativeTransferWithCommitmentParams,
  type PrivateNativeTransferWithCommitmentResult,
  type BatchNativeTransferParams,
  type BatchNativeTransferResult,
  type GasSponsoredTransferParams,
  type GasSponsoredTransferResult,
  type AccountCreationCost,
} from './native-transfer'

// ─── Function Call Privacy (M17-NEAR-11) ───────────────────────────────────────

export {
  // Private function calls
  buildPrivateFunctionCall,
  buildBatchPrivateFunctionCalls,
  buildMultiStepPrivateTransaction,
  // Access key management
  buildFunctionCallAccessKey,
  // NFT privacy
  buildPrivateNFTMint,
  buildPrivateNFTTransfer,
  // DeFi privacy
  buildPrivateDeFiSwap,
  // Gas estimation
  estimateFunctionCallGas,
  estimateMultiStepGas,
  // Constants
  FUNCTION_CALL_DEFAULT_GAS,
  NFT_MINT_GAS,
  NFT_STORAGE_DEPOSIT,
  DEX_SWAP_GAS,
  // Types
  type PrivateFunctionCallParams,
  type PrivateFunctionCallResult,
  type PrivateFunctionCallFromStealthParams,
  type MultiStepPrivateTransactionParams,
  type MultiStepPrivateTransactionResult,
  type FunctionCallAccessKeyParams,
  type PrivateNFTMintParams,
  type PrivateNFTMintResult,
  type PrivateDeFiSwapParams,
  type PrivateDeFiSwapResult,
} from './function-call'

// ─── Transaction History (M17-NEAR-20) ─────────────────────────────────────────

export {
  // History retrieval
  getTransactionHistory,
  getTransactionByHash,
  getTransactionCount,
  // Export utilities
  exportTransactions,
  // Statistics
  getTransactionSummary,
  // Types
  type NEARTransactionType,
  type NEARHistoryPrivacyLevel,
  type NEARHistoricalTransaction,
  type NEARTransactionHistoryParams,
  type NEARTransactionHistoryResult,
  type NEARExportFormat,
  type NEARExportOptions,
} from './history'
