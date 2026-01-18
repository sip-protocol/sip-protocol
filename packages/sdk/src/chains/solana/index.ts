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
