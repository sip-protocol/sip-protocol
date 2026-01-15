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

// ─── Compute Privacy Types ───────────────────────────────────────────────────

/**
 * Supported cipher types for encrypted computation
 */
export type CipherType = 'aes128' | 'aes192' | 'aes256' | 'rescue'

/**
 * Computation status for tracking MPC/FHE operations
 */
export type ComputationStatus =
  | 'submitted'
  | 'encrypting'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'

/**
 * Parameters for a privacy-preserving computation
 *
 * Used by compute backends (Arcium, Inco) for MPC/FHE operations.
 *
 * @example
 * ```typescript
 * const params: ComputationParams = {
 *   chain: 'solana',
 *   circuitId: 'private-swap',
 *   encryptedInputs: [encryptedAmount, encryptedPrice],
 *   cluster: 'mainnet-cluster-1',
 * }
 * ```
 */
export interface ComputationParams {
  /** Target blockchain */
  chain: ChainType
  /** Circuit or program identifier for the computation */
  circuitId: string
  /** Encrypted inputs for the MPC/FHE computation */
  encryptedInputs: Uint8Array[]
  /** MPC cluster or FHE node to use */
  cluster?: string
  /** Callback address for computation results */
  callbackAddress?: string
  /** Cipher type for input encryption */
  cipher?: CipherType
  /** Timeout in milliseconds */
  timeout?: number
  /** Additional backend-specific options */
  options?: Record<string, unknown>
}

/**
 * Result of a privacy-preserving computation
 *
 * Returned by compute backends after MPC/FHE execution.
 */
export interface ComputationResult {
  /** Whether the computation was successful */
  success: boolean
  /** Unique computation identifier for tracking */
  computationId?: string
  /** Decrypted output data (if available and authorized) */
  output?: Uint8Array
  /** Error message if failed */
  error?: string
  /** Backend that executed the computation */
  backend: string
  /** Current computation status */
  status?: ComputationStatus
  /** Cryptographic proof of correct computation */
  proof?: HexString
  /** Timestamp when computation completed */
  completedAt?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Union type for backend operation parameters
 *
 * Backends accept either transfer params (transaction privacy)
 * or computation params (compute privacy).
 */
export type BackendParams = TransferParams | ComputationParams

/**
 * Type guard to check if params are for computation
 */
export function isComputationParams(
  params: BackendParams
): params is ComputationParams {
  return 'circuitId' in params && 'encryptedInputs' in params
}

/**
 * Type guard to check if params are for transfer
 */
export function isTransferParams(
  params: BackendParams
): params is TransferParams {
  return 'sender' in params && 'recipient' in params && 'amount' in params
}

// ─── Interface Versioning ────────────────────────────────────────────────────

/**
 * PrivacyBackend interface version
 *
 * ## Version History
 *
 * - **v1** (initial): Basic backend interface with execute/checkAvailability
 * - **v2** (current): Added version field, compute privacy support, circuit breaker integration
 *
 * ## Migration Guide
 *
 * ### v1 → v2
 *
 * 1. Add `version` property (set to 2)
 * 2. Optional: Implement `executeComputation()` for compute backends
 * 3. Optional: Add circuit breaker integration via `onHealthChange` callback
 *
 * ```typescript
 * // v1 backend (deprecated)
 * class MyBackendV1 implements PrivacyBackend {
 *   name = 'my-backend'
 *   type = 'transaction'
 *   chains = ['solana']
 *   // ... no version field
 * }
 *
 * // v2 backend (current)
 * class MyBackendV2 implements PrivacyBackend {
 *   version = 2
 *   name = 'my-backend'
 *   type = 'transaction'
 *   chains = ['solana']
 *   // ...
 * }
 * ```
 */
export type PrivacyBackendVersion = 1 | 2

/**
 * Current interface version
 */
export const CURRENT_BACKEND_VERSION: PrivacyBackendVersion = 2

/**
 * Minimum supported version (backends below this will be rejected)
 */
export const MIN_SUPPORTED_VERSION: PrivacyBackendVersion = 1

// ─── Privacy Backend Interface ───────────────────────────────────────────────

/**
 * Core interface for all privacy backends
 *
 * All privacy implementations (SIP Native, PrivacyCash, Arcium, Inco)
 * must implement this interface for unified access.
 *
 * ## Interface Version
 *
 * The current interface version is **v2**. Backends should set `version: 2`.
 * v1 backends without a version field are still supported but deprecated.
 *
 * ## Backend Types
 *
 * - **Transaction backends** (type: 'transaction'): Implement `execute()` for transfers
 * - **Compute backends** (type: 'compute'): Implement `executeComputation()` for MPC/FHE
 * - **Hybrid backends** (type: 'both'): Implement both methods
 *
 * @example
 * ```typescript
 * // Transaction backend usage
 * const sipNative = new SIPNativeBackend()
 * await sipNative.execute({ chain: 'solana', sender, recipient, amount, ... })
 *
 * // Compute backend usage
 * const arcium = new ArciumBackend()
 * await arcium.executeComputation({ chain: 'solana', circuitId, encryptedInputs, ... })
 * ```
 */
export interface PrivacyBackend {
  /**
   * Interface version implemented by this backend
   *
   * - v1: Initial interface (deprecated, no version field)
   * - v2: Current interface with versioning support
   *
   * Backends without a version field are treated as v1 with deprecation warning.
   *
   * @default 1 (for backwards compatibility)
   */
  readonly version?: PrivacyBackendVersion

  /** Unique backend identifier */
  readonly name: string

  /** Backend type classification */
  readonly type: BackendType

  /** Supported blockchain networks */
  readonly chains: string[]

  /**
   * Check if backend is available for given parameters
   *
   * Accepts either TransferParams (for transaction backends) or
   * ComputationParams (for compute backends).
   *
   * @param params - Transfer or computation parameters
   * @returns Availability result with cost/time estimates
   */
  checkAvailability(params: BackendParams): Promise<AvailabilityResult>

  /**
   * Get backend capabilities and trade-offs
   *
   * @returns Static capability description
   */
  getCapabilities(): BackendCapabilities

  /**
   * Execute a privacy-preserving transfer
   *
   * Implemented by transaction backends (SIP Native, PrivacyCash).
   * Compute backends should return an error directing users to executeComputation().
   *
   * @param params - Transfer parameters
   * @returns Transaction result
   */
  execute(params: TransferParams): Promise<TransactionResult>

  /**
   * Execute a privacy-preserving computation
   *
   * Implemented by compute backends (Arcium, Inco).
   * Transaction backends do not implement this method.
   *
   * @param params - Computation parameters
   * @returns Computation result with status and output
   */
  executeComputation?(params: ComputationParams): Promise<ComputationResult>

  /**
   * Estimate cost for an operation (without executing)
   *
   * Accepts either TransferParams or ComputationParams.
   *
   * @param params - Transfer or computation parameters
   * @returns Estimated cost in native token smallest units
   */
  estimateCost(params: BackendParams): Promise<bigint>
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
  /**
   * Enable automatic fallback to alternative backends on failure
   * @default true
   */
  enableFallback?: boolean
  /**
   * Include unhealthy backends (circuit open) in selection
   * @default false
   */
  includeUnhealthy?: boolean
  /**
   * Maximum number of fallback attempts
   * @default 3
   */
  maxFallbackAttempts?: number
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

// ─── Health & Circuit Breaker Types ─────────────────────────────────────────

/**
 * Circuit breaker state
 *
 * - `closed`: Backend is healthy, requests flow normally
 * - `open`: Backend is failing, requests are blocked
 * - `half-open`: Testing if backend recovered, limited requests allowed
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Health state tracking for circuit breaker pattern
 *
 * Tracks backend health to automatically disable failing backends
 * and re-enable them after recovery.
 */
export interface BackendHealthState {
  /** Current circuit state */
  circuitState: CircuitState
  /** Whether backend is considered healthy (circuit closed or half-open) */
  isHealthy: boolean
  /** Last health check timestamp */
  lastChecked: number
  /** Number of consecutive failures */
  consecutiveFailures: number
  /** Number of consecutive successes (for half-open recovery) */
  consecutiveSuccesses: number
  /** Last failure reason */
  lastFailureReason?: string
  /** Last failure timestamp */
  lastFailureTime?: number
  /** Timestamp when circuit opened */
  circuitOpenedAt?: number
}

/**
 * Metrics for backend observability
 *
 * Tracks request counts and latency for monitoring and debugging.
 */
export interface BackendMetrics {
  /** Total requests made to this backend */
  totalRequests: number
  /** Successful requests */
  successfulRequests: number
  /** Failed requests */
  failedRequests: number
  /** Total latency in milliseconds (for average calculation) */
  totalLatencyMs: number
  /** Average latency in milliseconds */
  averageLatencyMs: number
  /** Last request timestamp */
  lastRequestTime: number
  /** Last successful request timestamp */
  lastSuccessTime?: number
  /** Minimum latency observed */
  minLatencyMs?: number
  /** Maximum latency observed */
  maxLatencyMs?: number
}

/**
 * Circuit breaker configuration
 *
 * Controls when backends are disabled and re-enabled.
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening circuit
   * @default 3
   */
  failureThreshold: number
  /**
   * Time in ms before attempting to close circuit (half-open state)
   * @default 30000 (30 seconds)
   */
  resetTimeoutMs: number
  /**
   * Number of successful requests in half-open state before closing circuit
   * @default 2
   */
  successThreshold: number
  /**
   * Whether to track metrics
   * @default true
   */
  enableMetrics: boolean
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  successThreshold: 2,
  enableMetrics: true,
}

// ─── Error Types ────────────────────────────────────────────────────────────

/**
 * Error thrown when all backends fail during execution
 *
 * Contains details about which backends were attempted and why they failed.
 */
export class AllBackendsFailedError extends Error {
  readonly name = 'AllBackendsFailedError'

  constructor(
    /** Backends that were attempted */
    public readonly attemptedBackends: string[],
    /** Map of backend name to error message */
    public readonly errors: Map<string, string>,
    /** Original transfer parameters */
    public readonly params?: TransferParams
  ) {
    const backendList = attemptedBackends.join(', ')
    super(
      `All ${attemptedBackends.length} backend(s) failed: [${backendList}]. ` +
      `Check errors map for details.`
    )
    // Fix prototype chain for instanceof in transpiled code
    Object.setPrototypeOf(this, AllBackendsFailedError.prototype)
  }

  /**
   * Get formatted error summary
   */
  getSummary(): string {
    const lines = [`All backends failed (${this.attemptedBackends.length} attempted):`]
    for (const [backend, error] of this.errors) {
      lines.push(`  • ${backend}: ${error}`)
    }
    return lines.join('\n')
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  readonly name = 'CircuitOpenError'

  constructor(
    /** Backend name with open circuit */
    public readonly backendName: string,
    /** Time when circuit opened */
    public readonly openedAt: number,
    /** Time until reset attempt */
    public readonly resetTimeoutMs: number
  ) {
    const remainingMs = Math.max(0, (openedAt + resetTimeoutMs) - Date.now())
    const remainingSec = Math.ceil(remainingMs / 1000)
    super(
      `Circuit breaker open for '${backendName}'. ` +
      `Will attempt reset in ${remainingSec}s.`
    )
    // Fix prototype chain for instanceof in transpiled code
    Object.setPrototypeOf(this, CircuitOpenError.prototype)
  }
}

/**
 * Error thrown when a computation times out
 */
export class ComputationTimeoutError extends Error {
  readonly name = 'ComputationTimeoutError'

  constructor(
    /** Computation identifier */
    public readonly computationId: string,
    /** Timeout duration in milliseconds */
    public readonly timeoutMs: number,
    /** Backend name where timeout occurred */
    public readonly backendName: string
  ) {
    super(
      `Computation '${computationId}' timed out after ${timeoutMs}ms ` +
      `on backend '${backendName}'`
    )
    // Fix prototype chain for instanceof in transpiled code
    Object.setPrototypeOf(this, ComputationTimeoutError.prototype)
  }
}

// ─── Timeout Utilities ────────────────────────────────────────────────────────

/**
 * Wrap a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param onTimeout - Function to call when timeout occurs, should throw an error
 * @returns The promise result or throws the timeout error
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   () => { throw new Error('Request timed out') }
 * )
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => never
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        onTimeout()
      } catch (error) {
        reject(error)
      }
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Deep freeze an object to make it truly immutable
 *
 * Unlike Object.freeze() which only freezes the top level,
 * this recursively freezes all nested objects and arrays.
 *
 * @param obj - Object to freeze
 * @returns The same object, deeply frozen
 *
 * @example
 * ```typescript
 * const config = deepFreeze({ network: 'devnet', options: { timeout: 5000 } })
 * config.options.timeout = 10000 // Error in strict mode, silently ignored otherwise
 * ```
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  // Get all properties including non-enumerable
  const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[]

  // Freeze nested objects first (depth-first)
  for (const name of propNames) {
    const value = obj[name]
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object)
    }
  }

  // Freeze the object itself
  return Object.freeze(obj)
}

// ─── Version Migration Helpers ───────────────────────────────────────────────

/**
 * Result of version validation
 */
export interface VersionValidationResult {
  /** Whether the backend version is valid */
  valid: boolean
  /** Current version of the backend */
  version: PrivacyBackendVersion
  /** Whether the backend is using a deprecated version */
  deprecated: boolean
  /** Warning message if deprecated */
  warning?: string
  /** Error message if invalid */
  error?: string
}

/**
 * Validate a backend's interface version
 *
 * @param backend - The backend to validate
 * @returns Validation result with version info and any warnings/errors
 *
 * @example
 * ```typescript
 * const result = validateBackendVersion(myBackend)
 * if (result.deprecated) {
 *   console.warn(result.warning)
 * }
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * ```
 */
export function validateBackendVersion(
  backend: PrivacyBackend
): VersionValidationResult {
  const version = backend.version ?? 1

  // Check if version is below minimum supported
  if (version < MIN_SUPPORTED_VERSION) {
    return {
      valid: false,
      version,
      deprecated: true,
      error: `Backend '${backend.name}' uses unsupported version ${version}. ` +
        `Minimum supported version is ${MIN_SUPPORTED_VERSION}.`,
    }
  }

  // Check if version is deprecated (v1 without explicit version field)
  if (backend.version === undefined) {
    return {
      valid: true,
      version: 1,
      deprecated: true,
      warning: `Backend '${backend.name}' does not specify a version field. ` +
        `It is treated as v1 which is deprecated. ` +
        `Please update to v${CURRENT_BACKEND_VERSION} by adding 'version: ${CURRENT_BACKEND_VERSION}'.`,
    }
  }

  // Check if version is older than current
  if (version < CURRENT_BACKEND_VERSION) {
    return {
      valid: true,
      version,
      deprecated: true,
      warning: `Backend '${backend.name}' uses version ${version}. ` +
        `Consider upgrading to v${CURRENT_BACKEND_VERSION} for latest features.`,
    }
  }

  // Version is current
  return {
    valid: true,
    version,
    deprecated: false,
  }
}

/**
 * Get the effective version of a backend
 *
 * Returns 1 for backends without an explicit version field (v1 legacy).
 *
 * @param backend - The backend to check
 * @returns The backend's interface version
 */
export function getBackendVersion(backend: PrivacyBackend): PrivacyBackendVersion {
  return backend.version ?? 1
}

/**
 * Check if a backend supports a specific interface version
 *
 * @param backend - The backend to check
 * @param minVersion - Minimum version required
 * @returns True if backend version >= minVersion
 */
export function backendSupportsVersion(
  backend: PrivacyBackend,
  minVersion: PrivacyBackendVersion
): boolean {
  return getBackendVersion(backend) >= minVersion
}

/**
 * Type guard to check if backend is v2 or higher
 *
 * V2 backends have explicit version field and may have additional features.
 */
export function isV2Backend(backend: PrivacyBackend): backend is PrivacyBackend & { version: 2 } {
  return backend.version === 2
}

/**
 * Log deprecation warning for v1 backends
 *
 * Call this when registering backends to warn about deprecated versions.
 *
 * @param backend - The backend to check
 * @param logger - Optional custom logger (defaults to console.warn)
 */
export function warnIfDeprecatedVersion(
  backend: PrivacyBackend,
  logger: (message: string) => void = console.warn
): void {
  const result = validateBackendVersion(backend)
  if (result.deprecated && result.warning) {
    logger(`[SIP-SDK] DEPRECATION WARNING: ${result.warning}`)
  }
}

/**
 * Error thrown when a backend version is not supported
 */
export class UnsupportedVersionError extends Error {
  readonly name = 'UnsupportedVersionError'

  constructor(
    /** Backend name */
    public readonly backendName: string,
    /** Backend version */
    public readonly backendVersion: PrivacyBackendVersion,
    /** Minimum supported version */
    public readonly minSupported: PrivacyBackendVersion
  ) {
    super(
      `Backend '${backendName}' uses version ${backendVersion}, ` +
      `but minimum supported version is ${minSupported}.`
    )
    Object.setPrototypeOf(this, UnsupportedVersionError.prototype)
  }
}
