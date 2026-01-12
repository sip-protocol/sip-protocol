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
 *
 * ### Compute Privacy (hide contract execution)
 * - **ArciumBackend** — MPC (Multi-Party Computation)
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
  // Compute privacy types
  CipherType,
  ComputationStatus,
  ComputationParams,
  ComputationResult,
  BackendParams,
} from './interface'

// Type guards
export { isComputationParams, isTransferParams } from './interface'

// Registry
export { PrivacyBackendRegistry, defaultRegistry } from './registry'

// Transaction Backends
export { SIPNativeBackend, type SIPNativeBackendConfig } from './sip-native'
export { PrivacyCashBackend, type PrivacyCashBackendConfig } from './privacycash'

// Compute Backends
export { ArciumBackend, type ArciumBackendConfig } from './arcium'

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

// Router
export { SmartRouter } from './router'
