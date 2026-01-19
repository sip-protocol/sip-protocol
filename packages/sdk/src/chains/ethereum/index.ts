/**
 * Ethereum Same-Chain Privacy Module
 *
 * Provides EIP-5564 compliant stealth addresses, Pedersen commitments,
 * viewing key management, and announcement parsing for Ethereum.
 *
 * @packageDocumentation
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  type EthereumNetwork,
  EVM_CHAIN_IDS,
  ETHEREUM_RPC_ENDPOINTS,
  ETHEREUM_EXPLORER_URLS,
  ETHEREUM_TOKEN_CONTRACTS,
  ETHEREUM_TOKEN_DECIMALS,
  EIP5564_ANNOUNCER_ADDRESS,
  EIP5564_REGISTRY_ADDRESS,
  ANNOUNCEMENT_EVENT_SIGNATURE,
  SECP256K1_SCHEME_ID,
  VIEW_TAG_MIN,
  VIEW_TAG_MAX,
  SECP256K1_PUBKEY_LENGTH,
  SECP256K1_PUBKEY_HEX_LENGTH,
  ETH_ADDRESS_LENGTH,
  ETH_ADDRESS_HEX_LENGTH,
  DEFAULT_GAS_LIMITS,
  ONE_ETH,
  ONE_GWEI,
  getExplorerUrl,
  getAddressExplorerUrl,
  getTokenExplorerUrl,
  getTokenContract,
  getEthereumTokenDecimals,
  getChainId,
  getNetworkFromChainId,
  isTestnet,
  isL2Network,
  isValidEthAddress,
  sanitizeUrl,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  EthereumPrivacyLevel,
  EthereumAnnouncement,
  AnnouncementMetadata,
  EthereumPrivateTransferParams,
  EthereumShieldedTransferBuild,
  EthereumPrivateTransferResult,
  EthereumScanParams,
  EthereumScanResult,
  EthereumDetectedPayment,
  EthereumClaimParams,
  EthereumClaimBuild,
  EthereumClaimResult,
  EthereumStealthBalance,
  EthereumViewingKeyExport,
  EthereumViewingKeyPair,
  EthereumGasEstimate,
  RegistryEntry,
  AnnouncementEvent,
  EthereumPedersenCommitment,
  ERC20TokenCommitment,
  EthereumPrivacyAdapterState,
  EthereumScanRecipient,
  EthereumDetectedPaymentResult,
} from './types'

// ─── Stealth Addresses ────────────────────────────────────────────────────────
export {
  type EthereumStealthMetaAddress,
  type EthereumStealthAddress,
  type EthereumStealthMetaAddressResult,
  type EthereumStealthAddressResult,
  EIP5564_PREFIX,
  SCHEME_ID,
  generateEthereumStealthMetaAddress,
  encodeEthereumStealthMetaAddress,
  parseEthereumStealthMetaAddress,
  isValidEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  checkViewTag,
  stealthPublicKeyToEthAddress,
  extractPublicKeys,
  createMetaAddressFromPublicKeys,
  getSchemeId,
} from './stealth'

// ─── Pedersen Commitments ─────────────────────────────────────────────────────
export {
  type EthereumCommitmentPoint,
  SECP256K1_ORDER,
  MAX_ETH_AMOUNT,
  MAX_COMMITMENT_VALUE,
  commitETH,
  verifyOpeningETH,
  commitERC20Token,
  verifyERC20TokenCommitment,
  addCommitmentsETH,
  subtractCommitmentsETH,
  addBlindingsETH,
  subtractBlindingsETH,
  getGeneratorsETH,
  generateBlindingETH,
  toWei,
  fromWei,
  createZeroCommitmentETH,
  isZeroCommitmentETH,
} from './commitment'

// ─── Viewing Keys ─────────────────────────────────────────────────────────────
export {
  type ViewingKeyScope,
  type ViewingKeyPermissions,
  type SharedViewingKey,
  generateViewingKeyPair,
  deriveViewingPublicKey,
  exportViewingKey,
  importViewingKey,
  serializeViewingKey,
  verifyViewingKeyMatches,
  isViewingKeyExpired,
  createSharedViewingKey,
  createFullAccessViewingKey,
  createRangeRestrictedViewingKey,
  hashViewingKey,
  computeRegistryHash,
  getViewingKeyUsage,
  extractViewingComponents,
  validatePermissions,
} from './viewing-key'

// ─── Announcements ────────────────────────────────────────────────────────────
export {
  ZERO_ADDRESS,
  METADATA_VERSION,
  parseAnnouncementLog,
  parseAnnouncementData,
  parseAnnouncementMetadata,
  createAnnouncementMetadata,
  encodeAnnouncementCallData,
  filterBySchemeId,
  filterByViewTag,
  filterByBlockRange,
  filterByToken,
  announcementToStealthAddress,
  createAnnouncementFromStealth,
  isValidAnnouncement,
  getAnnouncementEventTopic,
  buildAnnouncementTopics,
} from './announcement'

// ─── Privacy Adapter ──────────────────────────────────────────────────────────
export {
  EthereumPrivacyAdapter,
  type EthereumPrivacyAdapterConfig,
  type EthereumShieldedTransferParams,
  type EthereumShieldedTokenTransferParams,
  type EthereumBuiltTransaction,
  createEthereumPrivacyAdapter,
  createMainnetEthereumPrivacyAdapter,
  createSepoliaEthereumPrivacyAdapter,
  createArbitrumPrivacyAdapter,
  createOptimismPrivacyAdapter,
  createBasePrivacyAdapter,
} from './privacy-adapter'

// ─── Gas Estimation ──────────────────────────────────────────────────────────
export {
  type EIP1559GasPrice,
  type GasEstimateBreakdown,
  type DetailedGasEstimate,
  type GasEstimationOptions,
  estimateEthTransferGas,
  estimateTokenTransferGas,
  estimateClaimGas,
  estimateRegistryGas,
  clearGasPriceCache,
  updateGasPriceCache,
  parseGasPriceResponse,
  parseFeeHistoryResponse,
  calculateEffectiveGasPrice,
  formatGasCost,
  getGasPriceSuggestion,
} from './gas-estimation'

// ─── Registry ────────────────────────────────────────────────────────────────
export {
  RegistryClient,
  type StealthRegistryEntry,
  type RegistryLookupOptions,
  type RegistryRegisterOptions,
  type RegistryQueryResult,
  type RegistryTransaction,
  createRegistryClient,
  createMainnetRegistryClient,
  createSepoliaRegistryClient,
  isRegistered,
  extractSchemeId,
} from './registry'

// ─── RPC Client ──────────────────────────────────────────────────────────────
export {
  EthereumRpcClient,
  type TransactionStatus,
  type SubmittedTransaction,
  type TransactionReceipt,
  type RpcRequestOptions,
  createRpcClient,
  createMainnetRpcClient,
  createSepoliaRpcClient,
} from './rpc'

// ─── Transfer Builder ────────────────────────────────────────────────────────
export {
  StealthTransferBuilder,
  type PreparedTransaction,
  type PreparedStealthTransfer,
  type TransferResult,
  type PreparedClaim,
  createStealthTransferBuilder,
  createMainnetTransferBuilder,
  createSepoliaTransferBuilder,
} from './transfer'

// ─── Token Helper ────────────────────────────────────────────────────────────
export {
  TokenHelper,
  type TokenMetadata,
  type TokenAllowance,
  type PermitData,
  type PermitTypedData,
  type PreparedApproval,
  type TransferCheck,
  MAX_UINT256,
  createTokenHelper,
  createMainnetTokenHelper,
  createSepoliaTokenHelper,
} from './token'

// ─── L2 Deployment ───────────────────────────────────────────────────────────
export {
  type L2NetworkConfig,
  type DeploymentResult,
  type VerificationRequest,
  type VerificationResult,
  type DeploymentConfig,
  type MultiL2DeploymentStatus,
  type L2GasComparison,
  L2_NETWORK_CONFIGS,
  getL2Config,
  getSupportedL2s,
  getL2ConfigByChainId,
  isSupportedL2,
  generateDeploymentTx,
  estimateDeploymentGas,
  getVerificationUrl,
  getContractUrl,
  buildVerificationBody,
  checkVerificationStatus,
  createDeploymentPlan,
  getDeploymentOrder,
  compareL2GasPrices,
} from './deployment'
