/**
 * @sip-protocol/sdk
 *
 * Core SDK for Shielded Intents Protocol (SIP)
 *
 * @example
 * ```typescript
 * import { SIP, PrivacyLevel } from '@sip-protocol/sdk'
 *
 * const sip = new SIP({ network: 'testnet' })
 *
 * const intent = await sip.createIntent({
 *   input: { chain: 'solana', token: 'SOL', amount: 10n },
 *   output: { chain: 'ethereum', token: 'ETH' },
 *   privacy: PrivacyLevel.SHIELDED,
 * })
 *
 * const quotes = await sip.getQuotes(intent)
 * const result = await sip.execute(intent, quotes[0])
 * ```
 */

// Errors and Error Utilities
export {
  // Error codes
  ErrorCode,
  // Base error
  SIPError,
  // Specialized errors
  ValidationError,
  CryptoError,
  ProofError,
  IntentError,
  NetworkError,
  // Legacy errors (now extend proper parent classes)
  ProofNotImplementedError,
  EncryptionNotImplementedError,
  // Utility functions
  isSIPError,
  hasErrorCode,
  wrapError,
  getErrorMessage,
} from './errors'

export type { SerializedError } from './errors'

// Main client
export { SIP, createSIP, createProductionSIP } from './sip'
export type { SIPConfig, WalletAdapter, ProductionQuote } from './sip'

// Intent creation
export {
  IntentBuilder,
  createShieldedIntent,
  attachProofs,
  hasRequiredProofs,
  trackIntent,
  isExpired,
  getTimeRemaining,
  serializeIntent,
  deserializeIntent,
  getIntentSummary,
} from './intent'
export type { CreateIntentOptions } from './intent'

// Stealth addresses
export {
  // secp256k1 (EVM chains)
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  publicKeyToEthAddress,
  // ed25519 (Solana, NEAR)
  isEd25519Chain,
  getCurveForChain,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  // Solana address derivation
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,
  // NEAR address derivation
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
  isValidNearImplicitAddress,
  isValidNearAccountId,
} from './stealth'

export type { StealthCurve } from './stealth'

// Move blockchain stealth addresses (Aptos, Sui)
export {
  // Aptos
  AptosStealthService,
  generateAptosStealthAddress,
  deriveAptosStealthPrivateKey,
  checkAptosStealthAddress,
  ed25519PublicKeyToAptosAddress,
  aptosAddressToAuthKey,
  isValidAptosAddress,
  // Sui
  SuiStealthService,
  generateSuiStealthAddress,
  deriveSuiStealthPrivateKey,
  checkSuiStealthAddress,
  ed25519PublicKeyToSuiAddress,
  normalizeSuiAddress,
  isValidSuiAddress,
} from './move'

export type { AptosStealthResult, SuiStealthResult } from './move'

// Cosmos blockchain stealth addresses
export {
  CosmosStealthService,
  generateCosmosStealthMetaAddress,
  generateCosmosStealthAddress,
  stealthKeyToCosmosAddress,
  isValidCosmosAddress,
  CHAIN_PREFIXES as COSMOS_CHAIN_PREFIXES,
} from './cosmos'

export type {
  CosmosChainId,
  CosmosStealthResult,
} from './cosmos'

// Privacy utilities
export {
  getPrivacyConfig,
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  getPrivacyDescription,
} from './privacy'
// Note: isValidPrivacyLevel is exported from validation.ts
export type { PrivacyConfig, TransactionData } from './privacy'

// Crypto utilities (legacy - use commitment module for new code)
// For ZK proofs, use ProofProvider from './proofs'
export {
  createCommitment,
  verifyCommitment,
  generateIntentId,
  hash,
  generateRandomBytes,
} from './crypto'

// Secure memory handling
export {
  secureWipe,
  secureWipeAll,
  withSecureBuffer,
  withSecureBufferSync,
} from './secure-memory'

// Pedersen Commitments (recommended for new code)
export {
  commit,
  verifyOpening,
  commitZero,
  addCommitments,
  subtractCommitments,
  addBlindings,
  subtractBlindings,
  getGenerators,
  generateBlinding,
} from './commitment'

export type {
  PedersenCommitment,
  CommitmentPoint,
} from './commitment'

// Validation utilities
export {
  isValidChainId,
  isValidPrivacyLevel,
  isValidHex,
  isValidHexLength,
  isValidAmount,
  isNonNegativeAmount,
  isValidSlippage,
  isValidStealthMetaAddress,
  isValidCompressedPublicKey,
  isValidEd25519PublicKey,
  isValidPrivateKey,
  isValidScalar,
  validateCreateIntentParams,
  validateAsset,
  validateIntentInput,
  validateIntentOutput,
  validateViewingKey,
  validateScalar,
} from './validation'

// Proof providers
// NOTE: NoirProofProvider and BrowserNoirProvider are NOT exported here
// to avoid bundling WASM in server builds (e.g., Next.js SSR).
// For ZK proof generation:
//   - Browser: import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'
//   - Node.js: import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'
export {
  MockProofProvider,
  ProofGenerationError,
  // Browser utilities (safe - no WASM)
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  getBrowserInfo,
  browserHexToBytes,
  browserBytesToHex,
} from './proofs'

export type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  OracleAttestation,
  ProofResult,
  NoirProviderConfig,
  BrowserNoirProviderConfig,
  ProofProgressCallback,
} from './proofs'

// Oracle attestation (for fulfillment proofs)
export {
  // Verification functions
  verifyAttestation,
  verifyOracleSignature,
  signAttestationMessage,
  deriveOracleId,
  // Registry management
  createOracleRegistry,
  addOracle,
  removeOracle,
  updateOracleStatus,
  getActiveOracles,
  hasEnoughOracles,
  // Serialization
  serializeAttestationMessage,
  deserializeAttestationMessage,
  computeAttestationHash,
  getChainNumericId,
  // Constants
  ORACLE_DOMAIN,
  ATTESTATION_VERSION,
  DEFAULT_THRESHOLD,
  DEFAULT_TOTAL_ORACLES,
  CHAIN_NUMERIC_IDS,
} from './oracle'

export type {
  OracleId,
  OracleStatus,
  OracleInfo,
  OracleAttestationMessage,
  OracleSignature,
  SignedOracleAttestation,
  OracleRegistry,
  OracleRegistryConfig,
  AttestationRequest,
  AttestationResult,
  VerificationResult,
} from './oracle'

// Re-export types for convenience
export {
  PrivacyLevel,
  IntentStatus,
  SIP_VERSION,
  NATIVE_TOKENS,
  isPrivate,
  supportsViewingKey,
} from '@sip-protocol/types'

export type {
  ShieldedIntent,
  CreateIntentParams,
  TrackedIntent,
  Quote,
  FulfillmentResult,
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  Commitment,
  ZKProof,
  ViewingKey,
  Asset,
  ChainId,
  HexString,
  Hash,
  // Payment types
  StablecoinSymbol,
  PaymentPurpose,
  PaymentStatusType,
  ShieldedPayment,
  CreatePaymentParams,
  PaymentReceipt,
  TrackedPayment,
  // NFT types
  PrivateNFTOwnership,
  OwnershipProof,
  CreatePrivateOwnershipParams,
  ProveOwnershipParams,
  OwnershipVerification,
} from '@sip-protocol/types'

// Payment status enum
export { PaymentStatus } from '@sip-protocol/types'

// Treasury types
export { ProposalStatus } from '@sip-protocol/types'
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
} from '@sip-protocol/types'

// Compliance types
export { ReportStatus } from '@sip-protocol/types'
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
} from '@sip-protocol/types'

// Network Adapters
export {
  OneClickClient,
  NEARIntentsAdapter,
  createNEARIntentsAdapter,
} from './adapters'

export type {
  SwapRequest,
  PreparedSwap,
  SwapResult,
  NEARIntentsAdapterConfig,
} from './adapters'

// Solver
export { MockSolver, createMockSolver } from './solver'
export type { MockSolverConfig } from './solver'

// Re-export solver types
export type {
  Solver,
  SolverCapabilities,
  SolverVisibleIntent,
  SolverQuote,
  SIPSolver,
  FulfillmentStatus,
  FulfillmentRequest,
  FulfillmentCommitment,
  FulfillmentProof,
  SwapRoute,
  SwapRouteStep,
  SolverEvent,
  SolverEventListener,
} from '@sip-protocol/types'

// Re-export NEAR Intents types for convenience
export {
  OneClickSwapType,
  OneClickSwapStatus,
  OneClickDepositMode,
  OneClickErrorCode,
} from '@sip-protocol/types'

export type {
  OneClickConfig,
  OneClickQuoteRequest,
  OneClickQuoteResponse,
  OneClickStatusResponse,
  DefuseAssetId,
} from '@sip-protocol/types'

// Settlement Backend Abstraction
export {
  SwapStatus,
  SettlementRegistry,
  SettlementRegistryError,
  type SettlementBackendName,
  type QuoteParams as SettlementQuoteParams,
  type Quote as SettlementQuote,
  type SwapRoute as SettlementSwapRoute,
  type SwapRouteStep as SettlementSwapRouteStep,
  type SwapParams as SettlementSwapParams,
  type SwapResult as SettlementSwapResult,
  type SwapStatusResponse,
  type BackendCapabilities,
  type SettlementBackend,
  type SettlementBackendFactory,
  type SettlementBackendRegistry,
  type Route,
  // Smart Router
  SmartRouter,
  createSmartRouter,
  type RouteWithQuote,
  type QuoteComparison,
  type FindBestRouteParams,
  // Settlement backends
  NEARIntentsBackend,
  createNEARIntentsBackend,
  ZcashNativeBackend,
  createZcashNativeBackend,
  type ZcashNativeBackendConfig,
} from './settlement'

// Zcash
export {
  ZcashRPCClient,
  ZcashRPCError,
  createZcashClient,
  ZcashShieldedService,
  createZcashShieldedService,
  ZcashSwapService,
  createZcashSwapService,
} from './zcash'
export { ZcashErrorCode } from '@sip-protocol/types'

export type {
  ZcashShieldedServiceConfig,
  ShieldedSendParams,
  ShieldedSendResult,
  ReceivedNote,
  ShieldedBalance,
  ExportedViewingKey,
  ZcashSwapServiceConfig,
  ZcashSwapSourceChain,
  ZcashSwapSourceToken,
  ZcashQuoteParams,
  ZcashQuote,
  ZcashSwapParams,
  ZcashSwapResult,
  ZcashSwapStatus,
  BridgeProvider,
  PriceFeed,
} from './zcash'

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
  ZcashBlockchainInfo,
  ZcashNetworkInfo,
} from '@sip-protocol/types'

// Bitcoin Taproot (BIP-340/341)
export {
  // BIP-340 Schnorr signatures
  schnorrSign,
  schnorrVerify,
  schnorrSignHex,
  schnorrVerifyHex,
  // BIP-341 Taproot
  getXOnlyPublicKey,
  computeTweakedKey,
  createTaprootOutput,
  createKeySpendOnlyOutput,
  taprootAddress,
  decodeTaprootAddress,
  isValidTaprootAddress,
} from './bitcoin'

export type {
  TaprootOutput,
  TapScript,
  BitcoinNetwork,
} from './bitcoin'

// Private Payments
export {
  PaymentBuilder,
  createShieldedPayment,
  decryptMemo,
  trackPayment,
  isPaymentExpired,
  getPaymentTimeRemaining,
  serializePayment,
  deserializePayment,
  getPaymentSummary,
  // Stablecoin registry
  STABLECOIN_INFO,
  STABLECOIN_ADDRESSES,
  STABLECOIN_DECIMALS,
  getStablecoin,
  getStablecoinsForChain,
  isStablecoin,
  getStablecoinInfo,
  getSupportedStablecoins,
  isStablecoinOnChain,
  getChainsForStablecoin,
  toStablecoinUnits,
  fromStablecoinUnits,
  formatStablecoinAmount,
} from './payment'
export type { CreatePaymentOptions, StablecoinInfo } from './payment'

// DAO Treasury
export { Treasury } from './treasury'

// Enterprise Compliance
export {
  ComplianceManager,
  ComplianceReporter,
  generatePdfReport,
  ConditionalDisclosure,
  AuditorKeyDerivation,
  AuditorType,
  ThresholdViewingKey,
  type GenerateAuditReportParams,
  type AuditReport,
  type DecryptedTransaction,
  type PdfExportOptions,
  type ExportForRegulatorParams,
  type RegulatoryExport,
  type RegulatoryFormat,
  type Jurisdiction,
  type FATFExport,
  type FATFTransaction,
  type FINCENExport,
  type FINCENTransaction,
  type CSVExport,
  type DerivedViewingKey,
  type DeriveViewingKeyParams,
  type DeriveMultipleParams,
  type ThresholdShares,
  type TimeLockResult,
  type UnlockResult,
  type TimeLockParams,
} from './compliance'

// Sealed-Bid Auctions
export {
  SealedBidAuction,
  createSealedBidAuction,
} from './auction'

export type {
  SealedBid,
  BidReceipt,
  CreateBidParams,
  VerifyBidParams,
} from './auction'

// Governance (Private Voting)
export {
  PrivateVoting,
  createPrivateVoting,
} from './governance'

export type {
  EncryptedVote,
  RevealedVote,
  CastVoteParams,
} from './governance'

// NFT Module
export {
  PrivateNFT,
  createPrivateOwnership,
  proveOwnership,
  verifyOwnership,
} from './nft'

// Wallet Adapters
export {
  BaseWalletAdapter,
  MockWalletAdapter,
  WalletError,
  notConnectedError,
  featureNotSupportedError,
  walletRegistry,
  registerWallet,
  createWalletFactory,
  isPrivateWalletAdapter,
  WalletErrorCode,
  // Solana
  SolanaWalletAdapter,
  createSolanaAdapter,
  MockSolanaAdapter,
  createMockSolanaAdapter,
  createMockSolanaProvider,
  createMockSolanaConnection,
  getSolanaProvider,
  detectSolanaWallets,
  solanaPublicKeyToHex,
  base58ToHex,
  // Ethereum
  EthereumWalletAdapter,
  createEthereumAdapter,
  MockEthereumAdapter,
  createMockEthereumAdapter,
  createMockEthereumProvider,
  getEthereumProvider,
  detectEthereumWallets,
  toHex,
  fromHex,
  hexToNumber,
  normalizeAddress,
  getDefaultRpcEndpoint,
  EthereumChainId,
  // Hardware wallets
  HardwareErrorCode,
  HardwareWalletError,
  DerivationPath,
  getDerivationPath,
  supportsWebUSB,
  supportsWebHID,
  supportsWebBluetooth,
  getAvailableTransports,
  LedgerWalletAdapter,
  createLedgerAdapter,
  TrezorWalletAdapter,
  createTrezorAdapter,
  MockLedgerAdapter,
  MockTrezorAdapter,
  createMockLedgerAdapter,
  createMockTrezorAdapter,
} from './wallet'

export type {
  WalletConnectionState,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  WalletEventType,
  WalletEvent,
  WalletEventHandler,
  WalletConnectEvent,
  WalletDisconnectEvent,
  WalletAccountChangedEvent,
  WalletChainChangedEvent,
  WalletErrorEvent,
  WalletAdapter as IWalletAdapter,
  PrivateWalletAdapter,
  WalletShieldedSendParams,
  WalletShieldedSendResult,
  WalletInfo,
  WalletAdapterFactory,
  WalletRegistryEntry,
  // Solana types
  SolanaPublicKey,
  SolanaTransaction,
  SolanaVersionedTransaction,
  SolanaWalletProvider,
  SolanaWalletName,
  SolanaCluster,
  SolanaAdapterConfig,
  SolanaConnection,
  SolanaSendOptions,
  SolanaUnsignedTransaction,
  SolanaSignature,
  MockSolanaAdapterConfig,
  // Ethereum types
  EIP1193Provider,
  EIP1193RequestArguments,
  EIP1193Event,
  EIP1193ConnectInfo,
  EIP1193ProviderRpcError,
  EIP712Domain,
  EIP712TypeDefinition,
  EIP712Types,
  EIP712TypedData,
  EthereumTransactionRequest,
  EthereumTransactionReceipt,
  EthereumTokenMetadata,
  EthereumChainMetadata,
  EthereumWalletName,
  EthereumAdapterConfig,
  EthereumChainIdType,
  MockEthereumAdapterConfig,
  // Hardware wallet types
  HardwareWalletType,
  LedgerModel,
  TrezorModel,
  HardwareConnectionStatus,
  TransportType,
  HardwareDeviceInfo,
  HardwareWalletConfig,
  LedgerConfig,
  TrezorConfig,
  HardwareSignRequest,
  HardwareEthereumTx,
  HardwareSignature,
  HardwareAccount,
  HardwareTransport,
  HardwareErrorCodeType,
  MockHardwareConfig,
} from './wallet'
