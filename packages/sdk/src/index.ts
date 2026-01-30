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
  SecurityError,
  // Legacy errors (now extend proper parent classes)
  ProofNotImplementedError,
  EncryptionNotImplementedError,
  // Utility functions
  isSIPError,
  isSecurityError,
  hasErrorCode,
  wrapError,
  getErrorMessage,
} from './errors'

export type { SerializedError } from './errors'

// Main client
export { SIP, createSIP, createProductionSIP } from './sip'
export type {
  SIPConfig,
  WalletAdapter,
  ProductionQuote,
  SameChainExecuteParams,
  SameChainExecuteResult,
} from './sip'

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
  // Parsing utilities
  parseStealthAddress,
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
  // Compliance proofs (Aztec/Noir bounty - Non-Financial ZK)
  ComplianceProofProvider,
  DEFAULT_VALIDITY_PERIOD_SECONDS,
  SUPPORTED_JURISDICTIONS,
  COMPLIANCE_CIRCUIT_IDS,
  // ─── Proof Composition (M20) ────────────────────────────────────────────────
  // Proof Aggregator
  ProofAggregator,
  createProofAggregator,
  DEFAULT_AGGREGATOR_CONFIG,
  // Verification Pipeline
  VerificationPipeline,
  createVerificationPipeline,
  DEFAULT_PIPELINE_CONFIG,
  // Cross-System Validator
  CrossSystemValidator,
  createCrossSystemValidator,
  SYSTEM_INFO,
  BN254_MODULUS,
  PALLAS_MODULUS,
  VESTA_MODULUS,
  BLS12_381_MODULUS,
  // Proof Orchestrator
  ProofOrchestrator,
  createProofOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
  BUILTIN_TEMPLATES,
  // Composer interfaces and errors
  BaseProofComposer,
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
  IncompatibleSystemsError,
  // Composable Proof Providers (no WASM - safe for all environments)
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
  KimchiProvider,
  createKimchiProvider,
  createMinaMainnetProvider,
  createZkAppProvider,
  // Proof Composition types from @sip-protocol/types
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
  DEFAULT_COMPOSITION_CONFIG,
  // ─── Proof Caching (M20-13) ─────────────────────────────────────────────────
  LRUCache,
  createLRUCache,
  IndexedDBCache,
  FileCache,
  createPersistentCache,
  createIndexedDBCache,
  createFileCache,
  MultiTierCache,
  createMultiTierCache,
  CacheKeyGenerator,
  createCacheKeyGenerator,
  cacheKeyGenerator,
  DEFAULT_LRU_CONFIG,
  DEFAULT_PERSISTENT_CONFIG,
  DEFAULT_MULTI_TIER_CONFIG,
  DEFAULT_WARMING_CONFIG,
  INITIAL_PROOF_CACHE_STATS,
  // ─── Proof Format Converters (M20-08) ──────────────────────────────────────────
  NoirProofConverter,
  createNoirConverter,
  Halo2ProofConverter,
  createHalo2Converter,
  KimchiProofConverter,
  createKimchiConverter,
  UnifiedProofConverter,
  createUnifiedConverter,
  convertToSIP,
  convertFromSIP,
  ProofConversionError,
  InvalidProofError,
  UnsupportedVersionError,
  DEFAULT_CONVERSION_OPTIONS,
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
  // Compliance proof types
  ComplianceProofType,
  ComplianceProofConfig,
  ViewingKeyAccessParams,
  SanctionsClearParams,
  BalanceAttestationParams,
  HistoryCompletenessParams,
  ComplianceProofResult,
  // ─── Proof Composition Types (M20) ──────────────────────────────────────────
  // Aggregator types
  AggregatorConfig,
  AggregationProgressEvent,
  AggregationProgressCallback,
  SequentialAggregationOptions,
  ParallelAggregationOptions,
  RecursiveAggregationOptions,
  AggregationStepResult,
  DetailedAggregationResult,
  // Verification Pipeline types
  VerificationPipelineConfig,
  ProofDependency,
  VerificationOrder,
  DetailedVerificationResult,
  LinkValidationResult,
  SystemVerificationStats,
  VerificationProgressEvent,
  VerificationProgressCallback,
  VerifyOptions,
  // Cross-System Validator types
  EllipticCurve,
  FieldCharacteristics,
  SystemInfo,
  ValidationCheck,
  ValidationReport,
  CompatibilityEntry,
  ValidationOptions,
  // Orchestrator types
  OrchestratorConfig,
  CompositionState,
  CompositionPlan,
  CompositionRequest,
  OrchestratorResult,
  AuditLogEntry as ProofAuditLogEntry,
  OrchestratorProgressEvent,
  OrchestratorProgressCallback,
  CompositionTemplate,
  // Composer interfaces
  ComposableProofProvider,
  ProofComposer,
  ProofProviderFactory,
  ProofProviderRegistry,
  // Composer SDK types
  ProofProviderRegistration,
  RegisterProviderOptions,
  ProofGenerationRequest,
  ProofGenerationResult,
  ComposeProofsOptions,
  VerifyComposedProofOptions,
  AggregateProofsOptions,
  AggregationResult,
  ConvertProofOptions,
  ConversionResult,
  ProofCacheEntry,
  CacheStats,
  WorkerPoolConfig,
  WorkerPoolStatus,
  SystemCompatibility,
  CompatibilityMatrix,
  FallbackConfig,
  ProofTelemetry,
  TelemetryCollector,
  ProofTelemetryMetrics,
  // Provider config types
  Halo2ProviderConfig,
  Halo2CircuitConfig,
  Halo2ProvingKey,
  KimchiProviderConfig,
  KimchiCircuitConfig,
  // Proof system types from @sip-protocol/types
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
  VerificationResult as ProofVerificationResult,
  IndividualVerificationResult,
  CompositionEventType,
  CompositionEvent,
  CompositionProgressEvent,
  CompositionEventListener,
  // ─── Proof Cache Types (M20-13) ─────────────────────────────────────────────
  CacheKeyComponents,
  CacheKey,
  CacheEntryMetadata,
  CacheEntry,
  CacheLookupResult,
  LRUCacheConfig,
  PersistentCacheConfig,
  MultiTierCacheConfig,
  ProofCacheStats,
  CacheEventType,
  CacheEvent,
  CacheEventListener,
  InvalidationStrategy,
  InvalidationRule,
  CacheWarmingConfig,
  WarmingResult,
  ICacheKeyGenerator,
  IProofCache,
  ILRUCache,
  IPersistentCache,
  IMultiTierCache,
  IVerificationKeyCache,
  ICompiledCircuitCache,
  // ─── Proof Converter Types (M20-08) ─────────────────────────────────────────
  NativeProofFormat,
  NoirNativeProof,
  Halo2NativeProof,
  KimchiNativeProof,
  ConversionOptions,
  ConversionResult as ConverterConversionResult,
  ConversionMetadata,
  ConversionErrorCode,
  ProofConverter,
  ValidationResult as ConverterValidationResult,
  ValidationError as ConverterValidationError,
  AnyNativeProof,
  ProofSystemToNativeMap,
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

// Token registry
export {
  getTokenDecimals,
  getAsset,
  getNativeToken,
  getTokenByAddress,
  isKnownToken,
  getTokensForChain,
} from './tokens'

export type { TokenMetadata } from './tokens'

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
  // Range SAS Integration
  AttestationGatedDisclosure,
  AttestationSchema,
  createMockAttestation,
  verifyAttestationSignature,
  fetchAttestation,
  fetchWalletAttestations,
  KNOWN_ISSUERS,
  DEFAULT_RANGE_API_ENDPOINT,
  type RangeSASAttestation,
  type AttestationGatedConfig,
  type ViewingKeyDerivationResult,
  type ViewingKeyScope,
  type AttestationVerificationResult,
  type RangeAPIConfig,
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

// Solana Same-Chain Privacy
export {
  // Transfer
  sendPrivateSPLTransfer,
  estimatePrivateTransferFee,
  hasTokenAccount,
  // Scan and Claim
  scanForPayments,
  claimStealthPayment,
  getStealthBalance,
  // Constants
  SOLANA_TOKEN_MINTS,
  SOLANA_TOKEN_DECIMALS,
  SOLANA_RPC_ENDPOINTS,
  SOLANA_EXPLORER_URLS,
  MEMO_PROGRAM_ID,
  SIP_MEMO_PREFIX,
  getExplorerUrl as getSolanaExplorerUrl,
  getTokenMint,
  getSolanaTokenDecimals,
  // Types helpers
  parseAnnouncement,
  createAnnouncementMemo,
  // RPC Providers (Infrastructure Agnostic)
  createProvider,
  HeliusProvider,
  GenericProvider,
  // Helius Webhook (Real-time Scanning)
  createWebhookHandler,
  processWebhookTransaction,
  verifyWebhookSignature,
  verifyAuthToken,
  // Helius Enhanced Transactions (Human-readable TX data)
  HeliusEnhanced,
  createHeliusEnhanced,
} from './chains/solana'

// Solana Noir Verification (Aztec/Noir bounty)
export {
  SolanaNoirVerifier,
  createDevnetVerifier,
  createMainnetVerifier,
  // Type guards
  isNoirCircuitType,
  isValidSolanaProof,
  // Utilities
  estimateComputeUnits,
  // Error
  SolanaNoirError,
  SolanaNoirErrorCode,
  // Constants
  CIRCUIT_METADATA,
  DEFAULT_RPC_URLS,
  SOLANA_ZK_PROGRAM_IDS,
  MAX_PROOF_SIZE_BYTES,
  MAX_PUBLIC_INPUTS,
} from './solana'

// Jito Relayer (Solana Gas Abstraction)
export {
  JitoRelayer,
  createJitoRelayer,
  createMainnetRelayer,
  JitoRelayerError,
  JitoRelayerErrorCode,
  JITO_BLOCK_ENGINES,
  JITO_TIP_ACCOUNTS,
  JITO_DEFAULTS,
} from './solana'

export type {
  JitoRelayerConfig,
  JitoBundleRequest,
  JitoBundleResult,
  RelayedTransactionRequest,
  RelayedTransactionResult,
} from './solana'

export type {
  NoirCircuitType,
  SolanaVerificationKey,
  SolanaSerializedProof,
  SolanaVerifyInstruction,
  SolanaVerificationResult,
  SolanaNoirVerifierConfig,
  SolanaNoirErrorCode as SolanaNoirErrorCodeType,
  ProofStatistics,
  BatchVerificationRequest,
  BatchVerificationResult,
} from './solana'

export type {
  SolanaPrivateTransferParams,
  SolanaPrivateTransferResult,
  SolanaScanParams,
  SolanaScanResult,
  SolanaClaimParams,
  SolanaClaimResult,
  SolanaAnnouncement,
  SolanaCluster as SolanaSameChainCluster,
  // RPC Provider types
  SolanaRPCProvider,
  TokenAsset,
  ProviderConfig,
  ProviderType,
  GenericProviderConfig,
  HeliusProviderConfig,
  // Webhook types
  HeliusWebhookTransaction,
  HeliusEnhancedTransaction,
  HeliusWebhookPayload,
  WebhookHandlerConfig,
  WebhookProcessResult,
  WebhookRequest,
  WebhookHandler,
  // Helius Enhanced Transactions types
  HeliusEnhancedConfig,
  EnhancedTransactionType,
  NativeTransfer,
  TokenTransfer,
  NftTransfer,
  SwapEvent,
  EnhancedTransactionEvents,
  EnhancedAccountData,
  EnhancedTransaction,
  ParseTransactionsOptions,
  GetTransactionHistoryOptions,
  PrivacyDisplayOptions,
  SIPTransactionMetadata,
  SIPEnhancedTransaction,
  TransactionSummary,
} from './chains/solana'

// NEAR Same-Chain Privacy (M17-NEAR)
export {
  // Constants
  NEAR_RPC_ENDPOINTS,
  NEAR_EXPLORER_URLS,
  NEAR_TOKEN_CONTRACTS,
  NEAR_TOKEN_DECIMALS,
  NEAR_IMPLICIT_ACCOUNT_LENGTH,
  DEFAULT_GAS as NEAR_DEFAULT_GAS,
  ONE_NEAR,
  ONE_YOCTO,
  SIP_MEMO_PREFIX as NEAR_SIP_MEMO_PREFIX,
  getExplorerUrl as getNEARExplorerUrl,
  getAccountExplorerUrl as getNEARAccountExplorerUrl,
  getTokenContract as getNEARTokenContract,
  isImplicitAccount,
  isNamedAccount,
  isValidAccountId as isValidNEARAccountId,
  // Stealth Address (M17-NEAR-01, M17-NEAR-02)
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
  // Types (re-exported from types.ts)
  parseAnnouncement as parseNEARAnnouncement,
  createAnnouncementMemo as createNEARAnnouncementMemo,
  // Pedersen Commitments (M17-NEAR-03)
  commitNEAR,
  verifyOpeningNEAR,
  commitNEP141Token,
  verifyNEP141TokenCommitment,
  toYoctoNEAR,
  fromYoctoNEAR,
  addCommitmentsNEAR,
  subtractCommitmentsNEAR,
  addBlindingsNEAR,
  subtractBlindingsNEAR,
  getGeneratorsNEAR,
  generateBlindingNEAR,
  NEAR_ED25519_ORDER,
  MAX_NEAR_AMOUNT,
  NEAR_MAX_COMMITMENT_VALUE,
  // Viewing Keys (M17-NEAR-04)
  generateNEARViewingKeyFromSpending,
  generateRandomNEARViewingKey,
  computeNEARViewingKeyHash,
  computeNEARViewingKeyHashFromPrivate,
  exportNEARViewingKey,
  importNEARViewingKey,
  encryptForNEARViewing,
  decryptWithNEARViewing,
  createNEARMemoryStorage,
  isNEARAnnouncementForViewingKey,
  deriveNEARChildViewingKey,
  getNEARViewingPublicKey,
  validateNEARViewingKey,
} from './chains/near'

export type {
  NEARNetwork,
  NEARAnnouncement,
  NEARPrivateTransferParams,
  NEARPrivateTransferResult,
  NEARScanParams,
  NEARScanResult,
  NEARDetectedPayment,
  NEARClaimParams,
  NEARClaimResult,
  NEARStealthBalance,
  NEARStealthAddressResult,
  NEARStealthMetaAddressResult,
  // Commitment types (M17-NEAR-03)
  NEARPedersenCommitment,
  NEARCommitmentPoint,
  NEP141TokenCommitment,
  // Viewing key types (M17-NEAR-04)
  NEARViewingKey,
  NEARViewingKeyExport,
  NEAREncryptedPayload,
  NEARTransactionData,
  NEARViewingKeyStorage,
  // Transaction history types (M17-NEAR-20)
  NEARTransactionType,
  NEARHistoryPrivacyLevel,
  NEARHistoricalTransaction,
  NEARTransactionHistoryParams,
  NEARTransactionHistoryResult,
  NEARExportFormat,
  NEARExportOptions,
} from './chains/near'

// NEAR Transaction History (M17-NEAR-20)
export {
  getTransactionHistory,
  getTransactionByHash,
  getTransactionCount,
  exportTransactions,
  getTransactionSummary,
} from './chains/near'

// Same-Chain Executors
export {
  SolanaSameChainExecutor,
  createSameChainExecutor,
  isSameChainSupported,
  getSupportedSameChainChains,
} from './executors'

export type {
  SameChainExecutor,
  SameChainTransferParams,
  SameChainTransferResult,
  SolanaSameChainConfig,
} from './executors'

// Privacy Backends (Privacy Aggregator Layer)
export {
  // Registry
  PrivacyBackendRegistry,
  defaultRegistry,
  // Backends
  SIPNativeBackend,
  // C-SPL (Confidential SPL Tokens)
  CSPLClient,
  CSPLTokenService,
  // Router
  SmartRouter as PrivacySmartRouter,
} from './privacy-backends'

export type {
  // Core interface
  PrivacyBackend,
  BackendType as PrivacyBackendType,
  LatencyEstimate,
  BackendCapabilities as PrivacyBackendCapabilities,
  TransferParams as PrivacyTransferParams,
  TransactionResult as PrivacyTransactionResult,
  AvailabilityResult as PrivacyAvailabilityResult,
  // Router types
  RouterPriority,
  SmartRouterConfig as PrivacySmartRouterConfig,
  BackendSelectionResult as PrivacyBackendSelectionResult,
  // Registration
  BackendRegistrationOptions,
  RegisteredBackend,
  // Backend config
  SIPNativeBackendConfig,
  // C-SPL types
  CSPLClientConfig,
  CSPLTokenServiceConfig,
  WrapParams,
  WrapResult,
  UnwrapParams,
  UnwrapResult,
  ApproveParams,
  ApproveResult,
  CSPLServiceStatus,
} from './privacy-backends'

// Surveillance Analysis (Privacy Scoring)
export {
  // Main analyzer
  SurveillanceAnalyzer,
  createSurveillanceAnalyzer,
  // Individual algorithms
  analyzeAddressReuse,
  detectClusters,
  detectExchangeExposure,
  analyzeTemporalPatterns,
  // Scoring utilities
  calculatePrivacyScore,
  calculateSIPComparison,
  // Known exchanges
  KNOWN_EXCHANGES,
} from './surveillance'

export type {
  // Core types
  RiskLevel,
  PrivacyScore,
  PrivacyScoreBreakdown,
  PrivacyRecommendation,
  FullAnalysisResult,
  SurveillanceAnalyzerConfig,
  // Analysis results
  AddressReuseResult,
  ClusterResult,
  ExchangeExposureResult,
  TemporalPatternResult,
  SocialLinkResult,
  SIPProtectionComparison,
  // Supporting types
  AnalyzableTransaction,
  KnownExchange,
} from './surveillance'

// Privacy Advisor Agent (LangChain-powered)
export {
  PrivacyAdvisorAgent,
  createPrivacyAdvisor,
  // LangChain tools
  createPrivacyAdvisorTools,
  createAnalyzeWalletTool,
  createQuickScoreTool,
  createSIPComparisonTool,
  createExplainTool,
} from './advisor'

export type {
  // Core types
  AdvisorRole,
  AdvisorMessage,
  AdvisorStatus,
  // Configuration
  PrivacyAdvisorConfig,
  AdvisoryContext,
  // Response types
  AdvisorResponse,
  PrivacyAdvisoryReport,
  AdvisorRecommendation,
  // Utilities
  ToolResult,
  StreamCallback,
  // Tools config
  ToolsConfig,
} from './advisor'

// Privacy-Aware Logging (prevents sensitive data in logs)
export {
  PrivacyLogger,
  createPrivacyLogger,
  privacyLogger,
  redactAddress,
  redactSignature,
  maskAmount,
  redactSensitiveData,
} from './privacy-logger'

export type {
  LogLevel,
  PrivacyLoggerConfig,
  SensitiveData,
} from './privacy-logger'

// Structured Logging (pino-based)
export {
  logger,
  createLogger,
  configureLogger,
  silenceLogger,
  setLogLevel,
  getLogLevelName,
  isLevelEnabled,
} from './logger'

export type {
  SIPLogLevel,
  SIPLoggerConfig,
  PinoLogger,
} from './logger'

// Production Safety Checks
export {
  // Environment detection
  isProductionEnvironment,
  isLocalhostAllowed,
  // URL validation
  isLocalhostUrl,
  validateProductionConfig,
  assertNoLocalhost,
  getProductionUrl,
  createProductionConfig,
  // Error class
  ProductionSafetyError,
} from './production-safety'

export type {
  ProductionConfigValidationResult,
  ProductionConfigError,
  ProductionConfigWarning,
} from './production-safety'

// Configurable Endpoint Configuration
// All localhost defaults are configurable via environment variables
export {
  SOLANA_RPC_ENDPOINTS as CONFIGURABLE_SOLANA_RPC,
  ETH_RPC_ENDPOINTS as CONFIGURABLE_ETH_RPC,
  SUI_RPC_ENDPOINTS as CONFIGURABLE_SUI_RPC,
  ZCASH_RPC_CONFIG as CONFIGURABLE_ZCASH_RPC,
} from './config/endpoints'

export type { ZcashRpcConfig } from './config/endpoints'

// Network Privacy (Tor/SOCKS5 Proxy Support)
export {
  // Types
  type ProxyConfig,
  type ProxyType,
  type ParsedProxyConfig,
  type ProxyAgentOptions,
  type ProxyCheckResult,
  type ProxiedFetch,
  type NetworkPrivacyConfig,
  // Constants
  TOR_PORTS,
  TOR_HOST,
  TOR_CONTROL_PORT,
  DEFAULT_PROXY_TIMEOUT,
  PROXY_ENV_VAR,
  PROXY_ENV_VARS,
  DEFAULT_NETWORK_CONFIG,
  // Functions
  parseProxyConfig,
  getProxyFromEnv,
  isTorAvailable,
  detectTorPort,
  checkProxyAvailability,
  createProxyAgent,
  createProxiedFetch,
  rotateCircuit,
  createNetworkPrivacyClient,
} from './network'

// ─── Oblivious Sync (M20-27) ────────────────────────────────────────────────

// Oblivious synchronization where sync services learn NOTHING about user transactions
// Inspired by Project Tachyon: https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/
export {
  // Types (ChainId already exported from solana module)
  type BlockRange,
  type EncryptedNote,
  type MerkleProof,
  type SyncRandomness,
  type ObliviousNullifier,
  type ObliviousSyncQuery,
  type ObliviousSyncResponse,
  type SyncServiceHealth,
  type ObliviousSyncConfig,
  type ObliviousSyncProvider,
  type WalletSyncState,
  type TimeWindowedViewingKey,
  type MockSyncProviderConfig,
  type SyncManagerConfig,
  type SyncProgressEvent,
  type SyncCompletionEvent,
  type SyncEventListener,
  type SyncOptions,
  // Constants
  DEFAULT_SYNC_CONFIG,
  DEFAULT_MOCK_CONFIG,
  DEFAULT_MANAGER_CONFIG,
  // Sync randomness functions
  generateSyncRandomness,
  isSyncRandomnessValid,
  getCurrentEpoch,
  // Nullifier functions
  deriveObliviousNullifier,
  deriveTraditionalNullifier,
  // Sync state management
  createSyncState,
  updateSyncState,
  // Viewing key integration
  createTimeWindowedKey,
  isNoteInWindow,
  // Errors
  ObliviousSyncError,
  ObliviousSyncErrorCode,
  // Mock provider
  MockObliviousSyncProvider,
  createMockSyncProvider,
  // Sync manager
  SyncManager,
  createSyncManager,
} from './sync'

// ─── Chain-Specific Optimizations (M20-29) ──────────────────────────────────

// Provides optimized configurations for different blockchains:
// - Solana: Compute unit budgeting, priority fees, ALT recommendations
// - Ethereum/EVM: Gas optimization, L2 strategies, EIP-4844 blob support
// - BNB Chain: PancakeSwap routing, cross-chain cost comparison
// - Auto-selection: Smart chain detection and configuration selection
export {
  // Namespaced chain-specific modules
  solanaOptimizations,
  evmOptimizations,
  bnbOptimizations,
  // Chain detection and characteristics
  detectChainFamily,
  getChainCharacteristics,
  // Auto-selection
  selectOptimalConfig,
  // Cost comparison
  compareCrossChainCosts,
  recommendCheapestChain,
  recommendProfile,
} from './optimizations'

export type {
  // Common types
  ChainFamily,
  UnifiedOptimizationProfile,
  ChainCharacteristics,
  UnifiedOptimizationResult,
} from './optimizations'

// ─── Fee Module ──────────────────────────────────────────────────────────────

export {
  // Calculator
  FeeCalculator,
  createFeeCalculator,
  estimateFee,
  formatFee,
  bpsToPercent,
  percentToBps,
  DEFAULT_FEE_TIERS,
  DEFAULT_CHAIN_FEES,
  // NEAR Contract
  NEARFeeContract,
  createNEARFeeContract,
  createMainnetFeeContract,
  createTestnetFeeContract,
  calculateFeeForSwap,
  NEAR_FEE_CONTRACTS,
  DEFAULT_TREASURY,
} from './fees'

export type {
  // Fee types
  FeeModel,
  FeeTier,
  ChainFeeConfig,
  FeeCalculationInput,
  FeeCalculationResult,
  FeeBreakdown,
  TreasuryConfig as FeeTreasuryConfig, // Aliased to avoid conflict with existing TreasuryConfig
  FeeCollectionEvent,
  FeeStats,
  FeeContractState,
  FeeContractMethods,
  FeeWaiverType,
  FeeWaiver,
  FeeGovernanceProposal,
  FeeCalculatorOptions,
  NEARFeeContractOptions,
  FeeCollectionParams,
  FeeCollectionResult,
} from './fees'
