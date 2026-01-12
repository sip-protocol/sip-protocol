/**
 * Privacy Backend Interface
 *
 * Unified interface for all privacy approaches in SIP Protocol.
 * Enables SIP as a Privacy Aggregator across different backends.
 *
 * ## Architecture
 *
 * ```
 * TRANSACTION PRIVACY (Who sends what to whom):
 * • SIP Native — Stealth addresses + Pedersen commitments
 * • PrivacyCash — Pool mixing (integrated as backend)
 *
 * COMPUTE PRIVACY (What happens inside contracts):
 * • Arcium — MPC (Multi-Party Computation)
 * • Inco — FHE (Fully Homomorphic Encryption)
 * ```
 *
 * @example
 * ```typescript
 * import { PrivacyBackendRegistry, SIPNativeBackend } from '@sip-protocol/sdk'
 *
 * // Register backends
 * const registry = new PrivacyBackendRegistry()
 * registry.register(new SIPNativeBackend())
 *
 * // Use SmartRouter for auto-selection
 * const router = new SmartRouter(registry)
 * const result = await router.execute(params, {
 *   prioritize: 'compliance',
 *   requireViewingKeys: true,
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { ChainType, HexString, ViewingKey } from '@sip-protocol/types'

// ─── Core Types ──────────────────────────────────────────────────────────────

/**
 * Privacy backend type classification
 *
 * - `transaction`: Hides sender, recipient, amount (SIP Native, PrivacyCash)
 * - `compute`: Hides computation logic (Arcium, Inco)
 * - `both`: Full privacy stack
 */
export type BackendType = 'transaction' | 'compute' | 'both'

/**
 * Latency estimate for backend operations
 */
export type LatencyEstimate = 'fast' | 'medium' | 'slow'

/**
 * Backend capabilities describing what privacy features are supported
 */
export interface BackendCapabilities {
  /** Whether transaction amounts are hidden */
  hiddenAmount: boolean
  /** Whether sender address is hidden */
  hiddenSender: boolean
  /** Whether recipient address is hidden */
  hiddenRecipient: boolean
  /** Whether smart contract computation is private */
  hiddenCompute: boolean
  /** Whether viewing keys are supported for compliance */
  complianceSupport: boolean
  /** Size of anonymity set (for pool-based mixers) */
  anonymitySet?: number
  /** Whether setup is required before use (FHE, MPC coordination) */
  setupRequired: boolean
  /** Estimated latency for operations */
  latencyEstimate: LatencyEstimate
  /** Supported token types */
  supportedTokens: 'native' | 'spl' | 'all'
  /** Minimum transfer amount (if any) */
  minAmount?: bigint
  /** Maximum transfer amount (if any) */
  maxAmount?: bigint
}

/**
 * Parameters for a privacy-preserving transfer
 */
export interface TransferParams {
  /** Source chain */
  chain: ChainType
  /** Sender address (may be hidden by backend) */
  sender: string
  /** Recipient address or stealth address */
  recipient: string
  /** Token mint address (null for native token) */
  mint: string | null
  /** Transfer amount in smallest units */
  amount: bigint
  /** Token decimals */
  decimals: number
  /** Viewing key for compliance (optional) */
  viewingKey?: ViewingKey
  /** Additional backend-specific options */
  options?: Record<string, unknown>
}

/**
 * Result of a privacy-preserving transfer
 */
export interface TransactionResult {
  /** Whether the transaction was successful */
  success: boolean
  /** Transaction signature/hash */
  signature?: string
  /** Error message if failed */
  error?: string
  /** Backend that executed the transaction */
  backend: string
  /** Encrypted transaction data (for viewing key holders) */
  encryptedData?: HexString
  /** Proof data (for ZK backends) */
  proof?: HexString
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Backend availability check result
 */
export interface AvailabilityResult {
  /** Whether the backend can handle this transfer */
  available: boolean
  /** Reason if not available */
  reason?: string
  /** Estimated cost (in lamports/gas) */
  estimatedCost?: bigint
  /** Estimated time in milliseconds */
  estimatedTime?: number
}

// ─── Privacy Backend Interface ───────────────────────────────────────────────

/**
 * Core interface for all privacy backends
 *
 * All privacy implementations (SIP Native, PrivacyCash, Arcium, Inco)
 * must implement this interface for unified access.
 */
export interface PrivacyBackend {
  /** Unique backend identifier */
  readonly name: string

  /** Backend type classification */
  readonly type: BackendType

  /** Supported blockchain networks */
  readonly chains: ChainType[]

  /**
   * Check if backend is available for given parameters
   *
   * @param params - Transfer parameters
   * @returns Availability result with cost/time estimates
   */
  checkAvailability(params: TransferParams): Promise<AvailabilityResult>

  /**
   * Get backend capabilities and trade-offs
   *
   * @returns Static capability description
   */
  getCapabilities(): BackendCapabilities

  /**
   * Execute a privacy-preserving transfer
   *
   * @param params - Transfer parameters
   * @returns Transaction result
   */
  execute(params: TransferParams): Promise<TransactionResult>

  /**
   * Estimate cost for a transfer (without executing)
   *
   * @param params - Transfer parameters
   * @returns Estimated cost in native token smallest units
   */
  estimateCost(params: TransferParams): Promise<bigint>
}

// ─── SmartRouter Types ───────────────────────────────────────────────────────

/**
 * Priority for backend selection
 */
export type RouterPriority = 'privacy' | 'speed' | 'cost' | 'compliance'

/**
 * Configuration for SmartRouter backend selection
 */
export interface SmartRouterConfig {
  /** What to prioritize when selecting backend */
  prioritize: RouterPriority
  /** Minimum anonymity set size (for pool mixers) */
  minAnonymitySet?: number
  /** Require viewing key support */
  requireViewingKeys?: boolean
  /** Allow compute privacy backends */
  allowComputePrivacy?: boolean
  /** Preferred backend name (hint, not requirement) */
  preferredBackend?: string
  /** Excluded backend names */
  excludeBackends?: string[]
  /** Maximum acceptable cost */
  maxCost?: bigint
  /** Maximum acceptable latency in ms */
  maxLatency?: number
}

/**
 * Result of backend selection
 */
export interface BackendSelectionResult {
  /** Selected backend */
  backend: PrivacyBackend
  /** Why this backend was selected */
  reason: string
  /** Other considered backends */
  alternatives: Array<{
    backend: PrivacyBackend
    score: number
    reason: string
  }>
  /** Selection score (0-100) */
  score: number
}

// ─── Registry Types ──────────────────────────────────────────────────────────

/**
 * Backend registration options
 */
export interface BackendRegistrationOptions {
  /** Override existing backend with same name */
  override?: boolean
  /** Backend priority (higher = preferred) */
  priority?: number
  /** Whether backend is enabled by default */
  enabled?: boolean
}

/**
 * Registered backend entry
 */
export interface RegisteredBackend {
  /** The backend instance */
  backend: PrivacyBackend
  /** Registration priority */
  priority: number
  /** Whether backend is enabled */
  enabled: boolean
  /** Registration timestamp */
  registeredAt: number
}
