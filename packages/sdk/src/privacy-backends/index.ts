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
 * - **SIPNativeBackend** — Stealth addresses + Pedersen commitments
 * - **PrivacyCashBackend** — Pool mixing (Tornado Cash-style anonymity sets)
 * - **ArciumBackend** — MPC compute privacy (coming in #481)
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
  // Health & circuit breaker types
  CircuitState,
  BackendHealthState,
  BackendMetrics,
  CircuitBreakerConfig,
} from './interface'

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

// Backends
export { SIPNativeBackend, type SIPNativeBackendConfig } from './sip-native'
export { PrivacyCashBackend, type PrivacyCashBackendConfig } from './privacycash'

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
