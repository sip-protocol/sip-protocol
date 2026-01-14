/**
 * Privacy Backends Module
 *
 * Unified interface for all privacy approaches in SIP Protocol.
 * Enables SIP as a Privacy Aggregator across different backends.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   PrivacyBackendRegistry,
 *   SIPNativeBackend,
 *   SmartRouter,
 * } from '@sip-protocol/sdk'
 *
 * // Set up registry
 * const registry = new PrivacyBackendRegistry()
 * registry.register(new SIPNativeBackend())
 *
 * // Use SmartRouter for automatic backend selection
 * const router = new SmartRouter(registry)
 * const result = await router.execute({
 *   chain: 'solana',
 *   sender: 'sender-address',
 *   recipient: 'stealth-address',
 *   mint: 'token-mint',
 *   amount: 1000000n,
 *   decimals: 6,
 * }, {
 *   prioritize: 'compliance',
 *   requireViewingKeys: true,
 * })
 * ```
 *
 * ## Available Backends
 *
 * ### Transaction Privacy (hide sender/amount/recipient)
 * - **SIPNativeBackend** — Stealth addresses + Pedersen commitments
 * - **PrivacyCashBackend** — Pool mixing (Tornado Cash-style anonymity sets)
 * - **ShadowWireBackend** — Pedersen Commitments + Bulletproofs (Radr Labs)
 *
 * ### Compute Privacy (hide contract execution)
 * - **ArciumBackend** — MPC (Multi-Party Computation)
 * - **IncoBackend** — FHE (Fully Homomorphic Encryption)
 *
 * ### TEE Privacy (hardware-based)
 * - **MagicBlockBackend** — Intel TDX TEE (Ephemeral Rollups)
 *
 * ### Confidential Tokens
 * - **CSPLClient** — C-SPL (Confidential SPL) token operations
 * - **PrivateSwap** — Full privacy swaps (SIP + C-SPL + Arcium)
 *
 * @module privacy-backends
 */

// Core types
export type {
  BackendType,
  LatencyEstimate,
  BackendCapabilities,
  TransferParams,
  TransactionResult,
  AvailabilityResult,
  PrivacyBackend,
  RouterPriority,
  SmartRouterConfig,
  BackendSelectionResult,
  BackendRegistrationOptions,
  RegisteredBackend,
  // Compute privacy types
  CipherType,
  ComputationStatus,
  ComputationParams,
  ComputationResult,
  BackendParams,
  // Health & circuit breaker types
  CircuitState,
  BackendHealthState,
  BackendMetrics,
  CircuitBreakerConfig,
} from './interface'

// Type guards
export { isComputationParams, isTransferParams } from './interface'

// Error types
export {
  AllBackendsFailedError,
  CircuitOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './interface'

// Health tracking
export { BackendHealthTracker } from './health'

// Registry
export {
  PrivacyBackendRegistry,
  defaultRegistry,
  type PrivacyBackendRegistryConfig,
} from './registry'

// Transaction Backends
export { SIPNativeBackend, type SIPNativeBackendConfig } from './sip-native'
export { PrivacyCashBackend, type PrivacyCashBackendConfig } from './privacycash'
export {
  ShadowWireBackend,
  createShadowWireBackend,
  SHADOWWIRE_TOKEN_MINTS,
  type ShadowWireBackendConfig,
} from './shadowwire'

// Mock Backend (for testing)
export { MockBackend, createMockFactory, type MockBackendConfig } from './mock'

// Compute Backends
export { ArciumBackend, type ArciumBackendConfig } from './arcium'
export { IncoBackend, type IncoBackendConfig } from './inco'

// TEE Backend (Hardware-based Privacy)
export {
  MagicBlockBackend,
  createMagicBlockBackend,
  MAGICBLOCK_ENDPOINTS,
  type MagicBlockBackendConfig,
  type MagicBlockNetwork,
} from './magicblock'

// PrivacyCash types (for advanced usage)
export {
  SOL_POOL_SIZES,
  USDC_POOL_SIZES,
  USDT_POOL_SIZES,
  SOL_POOL_AMOUNTS,
  SPL_POOL_AMOUNTS,
  SPL_TOKEN_MINTS,
  findMatchingPoolSize,
  findNearestPoolSize,
  isValidPoolAmount,
  getAvailablePoolSizes,
  type PrivacyCashSPLToken,
  type PoolInfo,
  type IPrivacyCashSDK,
} from './privacycash-types'

// Arcium types (for advanced usage)
export {
  ARCIUM_CLUSTERS,
  ARCIUM_PROGRAM_IDS,
  DEFAULT_COMPUTATION_TIMEOUT_MS,
  ESTIMATED_COMPUTATION_TIME_MS,
  BASE_COMPUTATION_COST_LAMPORTS,
  COST_PER_ENCRYPTED_INPUT_LAMPORTS,
  COST_PER_INPUT_KB_LAMPORTS,
  BYTES_PER_KB,
  SOLANA_SLOT_TIME_MS,
  MAX_ENCRYPTED_INPUTS,
  MAX_INPUT_SIZE_BYTES,
  MAX_TOTAL_INPUT_SIZE_BYTES,
  MAX_COMPUTATION_COST_LAMPORTS,
  ArciumError,
  isArciumError,
  type ArciumErrorCode,
  type ArciumNetwork,
  type ArciumConfig,
  type ArciumCluster,
  type ArciumCircuit,
  type SubmitComputationParams,
  type ComputationOutput,
  type ComputationInfo,
  type EncryptionResult,
  type DecryptionResult,
  type IArciumClient,
  type IArciumReader,
} from './arcium-types'

// Inco types (for advanced usage)
export {
  INCO_RPC_URLS,
  INCO_CHAIN_IDS,
  INCO_SUPPORTED_CHAINS,
  DEFAULT_FHE_TIMEOUT_MS,
  ESTIMATED_FHE_TIME_MS,
  BASE_FHE_COST_WEI,
  COST_PER_ENCRYPTED_INPUT_WEI,
  type IncoNetwork,
  type IncoProduct,
  type EncryptedType,
  type EncryptedValue,
  type EncryptParams,
  type DecryptParams,
  type DecryptResult,
  type SubmitFHEParams,
  type FHEComputationInfo,
  type AttestationType,
  type AttestationRequest,
  type AttestationResult,
  type IIncoClient,
  type IncoConfig,
} from './inco-types'

// C-SPL (Confidential SPL) types and client
export { CSPLClient, type CSPLClientConfig } from './cspl'
export {
  CSPL_TOKENS,
  CSPL_PROGRAM_IDS,
  CSPL_OPERATION_COSTS,
  CSPL_OPERATION_TIMES,
  DEFAULT_SWAP_SLIPPAGE_BPS,
  MAX_PENDING_TRANSFERS,
  type CSPLToken,
  type ConfidentialTokenAccount,
  type ConfidentialBalance,
  type ConfidentialTransferParams,
  type ConfidentialTransferResult,
  type WrapTokenParams,
  type WrapTokenResult,
  type UnwrapTokenParams,
  type UnwrapTokenResult,
  type ConfidentialSwapParams,
  type ConfidentialSwapResult,
  type ConfidentialPool,
  type CSPLEncryptionParams,
  type CSPLDecryptionParams,
  type EncryptedAmount,
  type CSPLEncryptionType,
  type CSPLAuditorConfig,
  type CSPLAuditorPermission,
  type CompliantTransferParams,
  type ICSPLClient,
} from './cspl-types'

// Private Swap (SIP Native + C-SPL + Arcium integration)
export {
  PrivateSwap,
  type PrivateSwapConfig,
  type PrivateSwapParams,
  type PrivateSwapResult,
  type PrivateSwapStep,
} from './private-swap'

// C-SPL Token Service (higher-level wrapper)
export {
  CSPLTokenService,
  type CSPLTokenServiceConfig,
  type WrapParams,
  type WrapResult,
  type UnwrapParams,
  type UnwrapResult,
  type ApproveParams,
  type ApproveResult,
  type CSPLServiceStatus,
} from './cspl-token'

// Combined Privacy Service (SIP Native + C-SPL integration)
export {
  CombinedPrivacyService,
  createCombinedPrivacyServiceDevnet,
  createCombinedPrivacyServiceMainnet,
  type CombinedPrivacyServiceConfig,
  type CombinedTransferParams,
  type CombinedTransferResult,
  type StealthAddressResult,
  type ClaimParams,
  type ClaimResult,
  type CostBreakdown,
  type PrivacyComparison,
  type ServiceStatus,
} from './combined-privacy'

// Router
export { SmartRouter } from './router'
