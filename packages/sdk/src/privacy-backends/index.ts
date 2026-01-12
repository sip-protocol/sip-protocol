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
 * - **SIPNativeBackend** — Stealth addresses + Pedersen commitments (transaction privacy)
 * - **PrivacyCashBackend** — Pool mixing (Tornado Cash-style anonymity sets)
 * - **ArciumBackend** — MPC compute privacy + C-SPL confidential tokens
 * - **IncoBackend** — FHE compute privacy (coming in #482)
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
} from './interface'

// Registry
export { PrivacyBackendRegistry, defaultRegistry } from './registry'

// Backends
export { SIPNativeBackend, type SIPNativeBackendConfig } from './sip-native'
export { PrivacyCashBackend, type PrivacyCashBackendConfig } from './privacycash'
export {
  ArciumBackend,
  createArciumDevnetBackend,
  createArciumTestnetBackend,
  createArciumMainnetBackend,
} from './arcium'

// Arcium types (for C-SPL and MPC operations)
export {
  // Network
  ARCIUM_RPC_ENDPOINTS,
  ARCIUM_PROGRAM_IDS,
  // C-SPL Tokens
  CSPL_TOKEN_REGISTRY,
  hasCSPLSupport,
  getCSPLToken,
  deriveCSPLMint,
  // Utilities
  estimateArciumCost,
  validateCSPLTransferParams,
  // Error
  ArciumError,
  ArciumErrorCode,
  // Types
  type ArciumNetwork,
  type ArciumBackendConfig,
  type CSPLToken,
  type CSPLTransferParams,
  type CSPLTransferResult,
  type ComputationStatus,
  type ComputationReference,
  type ComputationResult,
  type ConfidentialSwapParams,
  type ConfidentialSwapResult,
  type WrapToCSPLParams,
  type UnwrapFromCSPLParams,
  type WrapResult,
} from './arcium-types'

// C-SPL Token Service
export {
  CSPLTokenService,
  createCSPLServiceDevnet,
  createCSPLServiceTestnet,
  createCSPLServiceMainnet,
  type CSPLTokenServiceConfig,
  type ConfidentialBalance,
  type CSPLTokenAccount,
  type WrapParams,
  type WrapResult as CSPLWrapResult,
  type UnwrapParams,
  type UnwrapResult as CSPLUnwrapResult,
  type ConfidentialTransferParams,
  type ConfidentialTransferResult,
  type ApproveParams,
  type ApproveResult,
} from './cspl-token'

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

// Router
export { SmartRouter } from './router'

// Combined Privacy Service (SIP + Arcium synergy)
export {
  CombinedPrivacyService,
  createCombinedPrivacyServiceDevnet,
  createCombinedPrivacyServiceTestnet,
  createCombinedPrivacyServiceMainnet,
  type CombinedPrivacyServiceConfig,
  type CombinedTransferParams,
  type CombinedTransferResult,
  type StealthAddressResult,
  type ClaimParams,
  type ClaimResult,
} from './combined-privacy'
