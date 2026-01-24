/**
 * Solana Same-Chain Privacy Module
 *
 * Provides privacy-preserving SPL token transfers using stealth addresses.
 *
 * @example Sender flow
 * ```typescript
 * import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'
 *
 * const result = await sendPrivateSPLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   senderTokenAccount: senderATA,
 *   recipientMetaAddress: recipientMeta,
 *   mint: USDC_MINT,
 *   amount: 5_000_000n,
 *   signTransaction: wallet.signTransaction,
 * })
 * ```
 *
 * @example Recipient flow
 * ```typescript
 * import { scanForPayments, claimStealthPayment } from '@sip-protocol/sdk'
 *
 * // Scan for incoming payments
 * const payments = await scanForPayments({
 *   connection,
 *   viewingPrivateKey,
 *   spendingPublicKey,
 * })
 *
 * // Claim a payment
 * const result = await claimStealthPayment({
 *   connection,
 *   stealthAddress: payments[0].stealthAddress,
 *   ephemeralPublicKey: payments[0].ephemeralPublicKey,
 *   viewingPrivateKey,
 *   spendingPrivateKey,
 *   destinationAddress: myWallet,
 *   mint: USDC_MINT,
 * })
 * ```
 *
 * @packageDocumentation
 */

// Constants
export {
  SOLANA_TOKEN_MINTS,
  SOLANA_TOKEN_DECIMALS,
  SOLANA_RPC_ENDPOINTS,
  SOLANA_EXPLORER_URLS,
  MEMO_PROGRAM_ID,
  SIP_MEMO_PREFIX,
  ESTIMATED_TX_FEE_LAMPORTS,
  ATA_RENT_LAMPORTS,
  getExplorerUrl,
  getTokenMint,
  getSolanaTokenDecimals,
  type SolanaCluster,
} from './constants'

// Types
export type {
  SolanaPrivateTransferParams,
  SolanaPrivateTransferResult,
  SolanaScanParams,
  SolanaScanResult,
  SolanaClaimParams,
  SolanaClaimResult,
  SolanaAnnouncement,
} from './types'
export { parseAnnouncement, createAnnouncementMemo } from './types'

// Transfer functions
export {
  sendPrivateSPLTransfer,
  estimatePrivateTransferFee,
  hasTokenAccount,
} from './transfer'

// Enhanced SPL Transfer (Issue #286)
export {
  resolveTokenMetadata,
  batchResolveTokenMetadata,
  getTokenBalance,
  batchGetTokenBalances,
  validateTransfer,
  sendEnhancedSPLTransfer,
  sendBatchSPLTransfer,
  formatTokenAmount,
  parseTokenAmount,
  type TokenMetadata,
  type TokenBalance,
  type EnhancedSPLTransferParams,
  type EnhancedSPLTransferResult,
  type BatchTransferItem,
  type BatchTransferResult,
  type TransferValidation,
} from './spl-transfer'

// Native SOL Transfer (Issue #292)
export {
  validateSOLTransfer,
  estimateSOLTransfer,
  sendSOLTransfer,
  sendMaxSOLTransfer,
  sendBatchSOLTransfer,
  formatLamports,
  parseSOLToLamports,
  getSOLBalance,
  RENT_EXEMPT_MINIMUM,
  STEALTH_ACCOUNT_BUFFER,
  type SOLTransferParams,
  type MaxSOLTransferParams,
  type SOLTransferResult,
  type SOLTransferValidation,
  type SOLTransferEstimate,
  type BatchSOLTransferItem,
  type BatchSOLTransferResult,
} from './sol-transfer'

// Scan and claim functions
export {
  scanForPayments,
  claimStealthPayment,
  getStealthBalance,
} from './scan'

// Advanced Stealth Scanner (Issue #262)
export {
  StealthScanner,
  createStealthScanner,
  batchScanForRecipients,
  fullHistoricalScan,
  type ScanRecipient,
  type StealthScannerOptions,
  type HistoricalScanOptions,
  type DetectedPayment,
  type HistoricalScanResult,
  type PaymentCallback,
  type ErrorCallback,
} from './stealth-scanner'

// Ephemeral Keypair Management (Issue #270)
export {
  generateEphemeralKeypair,
  generateManagedEphemeralKeypair,
  batchGenerateEphemeralKeypairs,
  batchGenerateManagedEphemeralKeypairs,
  disposeEphemeralKeypairs,
  wipeEphemeralPrivateKey,
  formatEphemeralAnnouncement,
  parseEphemeralAnnouncement,
  type EphemeralKeypair,
  type EphemeralKeyUsageResult,
  type ManagedEphemeralKeypair,
  type BatchGenerationOptions,
} from './ephemeral-keys'

// Privacy Adapter (Issue #276)
export {
  SolanaPrivacyAdapter,
  createSolanaPrivacyAdapter,
  type SolanaPrivacyAdapterConfig,
  type ShieldedTransferParams,
  type AdapterScanParams,
  type AdapterClaimParams,
  type PrivacyAdapterState,
} from './privacy-adapter'

// RPC Providers (Infrastructure Agnostic)
export {
  createProvider,
  HeliusProvider,
  GenericProvider,
  type SolanaRPCProvider,
  type TokenAsset,
  type ProviderConfig,
  type ProviderType,
  type GenericProviderConfig,
  type HeliusProviderConfig,
} from './providers'

// Helius Webhook (Real-time Scanning)
export {
  createWebhookHandler,
  processWebhookTransaction,
  verifyWebhookSignature,
  verifyAuthToken,
  type HeliusWebhookTransaction,
  type HeliusEnhancedTransaction,
  type HeliusWebhookPayload,
  type WebhookHandlerConfig,
  type WebhookProcessResult,
  type WebhookRequest,
  type WebhookHandler,
} from './providers'

// Helius Enhanced Transactions (Human-readable TX data)
export {
  HeliusEnhanced,
  createHeliusEnhanced,
  type HeliusEnhancedConfig,
  type EnhancedTransactionType,
  type NativeTransfer,
  type TokenTransfer,
  type NftTransfer,
  type SwapEvent,
  type EnhancedTransactionEvents,
  type EnhancedAccountData,
  type EnhancedTransaction,
  type ParseTransactionsOptions,
  type GetTransactionHistoryOptions,
  type PrivacyDisplayOptions,
  type SIPTransactionMetadata,
  type SIPEnhancedTransaction,
  type TransactionSummary,
} from './providers'

// Key Derivation (BIP39/SLIP-0010)
export {
  deriveSolanaStealthKeys,
  deriveViewingKeyFromSpending,
  generateMnemonic,
  isValidMnemonic,
  validateMnemonic,
  validateDerivationPath,
  getDerivationPath,
  SOLANA_DEFAULT_PATH,
  type SolanaKeyDerivationOptions,
  type SolanaKeyDerivationResult,
} from './key-derivation'

// Pedersen Commitments (ed25519)
export {
  commitSolana,
  verifyOpeningSolana,
  commitSPLToken,
  verifySPLTokenCommitment,
  toSmallestUnits,
  fromSmallestUnits,
  addCommitmentsSolana,
  subtractCommitmentsSolana,
  addBlindingsSolana,
  subtractBlindingsSolana,
  getGeneratorsSolana,
  generateBlindingSolana,
  ED25519_ORDER,
  MAX_SPL_AMOUNT,
  type SolanaPedersenCommitment,
  type SolanaCommitmentPoint,
  type SPLTokenCommitment,
} from './commitment'

// Viewing Key Management
export {
  generateViewingKeyFromSpending,
  generateRandomViewingKey,
  computeViewingKeyHash,
  computeViewingKeyHashFromPrivate,
  exportViewingKey,
  importViewingKey,
  encryptForViewing,
  decryptWithViewing,
  createMemoryStorage,
  isAnnouncementForViewingKey,
  deriveChildViewingKey,
  getViewingPublicKey,
  type SolanaViewingKey,
  type ViewingKeyExport,
  type EncryptedPayload,
  type SolanaTransactionData,
  type ViewingKeyStorage,
} from './viewing-key'

// RPC Client (Issue #280) + Network Privacy (Issue #798)
export {
  SolanaRPCClient,
  createRPCClient,
  createPrivateRPCClient,
  createClusterClient,
  RPC_ENDPOINTS,
  RPCErrorType,
  type RPCClientConfig,
  type ClassifiedRPCError,
  type PriorityFeeEstimate,
  type TransactionConfirmationResult,
  type SendTransactionOptions,
} from './rpc-client'

// Transaction Builder (Issue #298)
export {
  ShieldedTransactionBuilder,
  createTransactionBuilder,
  estimateComputeUnits,
  calculatePriorityFee,
  ShieldedTransactionType,
  DEFAULT_COMPUTE_UNITS,
  DEFAULT_PRIORITY_FEE,
  MIN_COMPUTE_UNITS,
  MAX_COMPUTE_UNITS,
  type TransactionBuilderConfig,
  type ComputeBudgetConfig,
  type SPLTransferInstruction,
  type SOLTransferInstruction,
  type BuiltTransaction,
  type SerializedTransaction,
} from './transaction-builder'

// Anchor Shielded Transfer (Issue #781)
// Uses the SIP Privacy Anchor program for on-chain privacy
export {
  shieldedTransfer,
  SIP_PRIVACY_PROGRAM_ID,
  CONFIG_PDA,
  FEE_COLLECTOR,
  type AnchorShieldedTransferParams,
  type AnchorShieldedTransferResult,
} from './anchor-transfer'

// @solana/kit Compatibility Bridge (Issue #931)
// Utilities for bridging between @solana/web3.js and @solana/kit types
export {
  toAddress,
  toPublicKey,
  createAddress,
  toKeyPair,
  toKitInstruction,
  toKitTransaction,
  createDualRpcClient,
  toKitCommitment,
  createBlockhash,
  toBlockhashInfo,
  LAMPORTS_PER_SOL as KIT_LAMPORTS_PER_SOL,
  solToLamports,
  lamportsToSol,
  isAddress,
  isPublicKey,
  normalizeAddress,
  RpcHelpers,
  type DualRpcClient,
  type Address,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type Blockhash as KitBlockhash,
} from './kit-compat'

// Sunspot ZK Verifier (Issue #779)
export {
  SunspotVerifier,
  ProofType,
  createVerifyInstructionData,
  formatFundingInputs,
  formatOwnershipInputs,
  type SunspotVerifierConfig,
  type VerifyProofParams,
  type VerifyProofResult,
  type Groth16Proof,
} from './sunspot-verifier'
