/**
 * Arcium SDK Type Definitions
 *
 * Type definitions for the @arcium-hq/client and @arcium-hq/reader packages.
 * Arcium provides MPC (Multi-Party Computation) for encrypted computation on Solana.
 *
 * ## Architecture
 *
 * - **Client SDK**: Handles encryption/decryption and computation submission
 * - **Reader SDK**: Queries computation state and subscribes to updates
 * - **MPC Nodes**: Process encrypted data without seeing plaintext
 *
 * @see https://docs.arcium.com/developers
 * @see https://ts.arcium.com/api
 */

import type { CipherType, ComputationStatus } from './interface'
import { SIPError, ErrorCode } from '../errors'

// ─── Re-export from interface ────────────────────────────────────────────────

export type { CipherType, ComputationStatus }

// ─── Arcium-Specific Types ───────────────────────────────────────────────────

/**
 * Arcium network configuration
 */
export type ArciumNetwork = 'devnet' | 'testnet' | 'mainnet-beta'

/**
 * Configuration for Arcium SDK connection
 */
export interface ArciumConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string
  /** Network type */
  network: ArciumNetwork
  /** Default MPC cluster to use */
  cluster?: string
  /** Default cipher for encryption */
  defaultCipher?: CipherType
}

/**
 * MPC cluster information
 *
 * Clusters are groups of MPC nodes that coordinate computation.
 */
export interface ArciumCluster {
  /** Cluster identifier */
  id: string
  /** Human-readable cluster name */
  name: string
  /** Number of MPC nodes in the cluster */
  nodes: number
  /** Cluster operational status */
  status: 'active' | 'inactive' | 'maintenance'
  /** Minimum nodes required for computation */
  threshold: number
  /** Supported cipher types */
  supportedCiphers: CipherType[]
}

/**
 * Circuit definition for MPC computation
 *
 * Circuits define the computation logic that runs on encrypted data.
 */
export interface ArciumCircuit {
  /** Circuit identifier */
  id: string
  /** Human-readable circuit name */
  name: string
  /** Number of encrypted inputs */
  inputCount: number
  /** Number of outputs */
  outputCount: number
  /** Circuit version */
  version?: string
  /** Circuit description */
  description?: string
}

/**
 * Parameters for submitting a computation to Arcium
 */
export interface SubmitComputationParams {
  /** Circuit to execute */
  circuitId: string
  /** Encrypted input data */
  encryptedInputs: Uint8Array[]
  /** MPC cluster to use */
  cluster: string
  /** Callback program address for results */
  callback?: string
  /** Priority level (affects ordering) */
  priority?: 'low' | 'normal' | 'high'
}

/**
 * Result from a completed computation
 */
export interface ComputationOutput {
  /** Unique computation identifier */
  computationId: string
  /** Decrypted output data */
  output: Uint8Array
  /** Proof of correct computation */
  proof: string
  /** Completion timestamp */
  timestamp: number
  /** Cluster that processed the computation */
  cluster: string
  /** Number of MPC nodes that participated */
  participatingNodes: number
}

/**
 * Computation state information
 */
export interface ComputationInfo {
  /** Computation identifier */
  id: string
  /** Current status */
  status: ComputationStatus
  /** Circuit being executed */
  circuitId: string
  /** Cluster processing the computation */
  cluster: string
  /** Submission timestamp */
  submittedAt: number
  /** Completion timestamp (if completed) */
  completedAt?: number
  /** Error message (if failed) */
  error?: string
  /** Progress percentage (0-100) */
  progress?: number
}

/**
 * Encryption result from the client SDK
 */
export interface EncryptionResult {
  /** Encrypted data */
  ciphertext: Uint8Array
  /** Cipher type used */
  cipher: CipherType
  /** Encryption nonce/IV */
  nonce: Uint8Array
}

/**
 * Decryption result from the client SDK
 */
export interface DecryptionResult {
  /** Decrypted plaintext */
  plaintext: Uint8Array
  /** Whether decryption was verified */
  verified: boolean
}

// ─── SDK Interfaces ──────────────────────────────────────────────────────────

/**
 * Arcium Client SDK interface
 *
 * The actual SDK is @arcium-hq/client.
 * This interface defines the expected API for our adapter.
 */
export interface IArciumClient {
  /**
   * Initialize connection to Arcium network
   */
  connect(config: ArciumConfig): Promise<void>

  /**
   * Disconnect from Arcium network
   */
  disconnect(): Promise<void>

  /**
   * Encrypt data for MPC computation
   *
   * @param data - Plaintext data to encrypt
   * @param cipher - Cipher type to use
   * @returns Encrypted data
   */
  encrypt(data: Uint8Array, cipher: CipherType): Promise<EncryptionResult>

  /**
   * Decrypt computation output
   *
   * @param ciphertext - Encrypted data
   * @returns Decrypted data
   */
  decrypt(ciphertext: Uint8Array): Promise<DecryptionResult>

  /**
   * Upload a circuit definition
   *
   * @param circuit - Circuit to upload
   * @returns Circuit ID
   */
  uploadCircuit(circuit: ArciumCircuit): Promise<string>

  /**
   * Submit a computation to the MPC network
   *
   * @param params - Computation parameters
   * @returns Computation ID for tracking
   */
  submitComputation(params: SubmitComputationParams): Promise<string>

  /**
   * Wait for computation to complete
   *
   * @param computationId - Computation to wait for
   * @param timeout - Optional timeout in milliseconds
   * @returns Computation output
   */
  awaitFinalization(
    computationId: string,
    timeout?: number
  ): Promise<ComputationOutput>

  /**
   * Get computation status
   *
   * @param computationId - Computation to check
   * @returns Current status
   */
  getComputationStatus(computationId: string): Promise<ComputationStatus>

  /**
   * Get detailed computation info
   *
   * @param computationId - Computation to query
   * @returns Full computation info
   */
  getComputationInfo(computationId: string): Promise<ComputationInfo>

  /**
   * List available MPC clusters
   *
   * @returns Array of available clusters
   */
  listClusters(): Promise<ArciumCluster[]>

  /**
   * Get cluster by ID
   *
   * @param clusterId - Cluster identifier
   * @returns Cluster info
   */
  getCluster(clusterId: string): Promise<ArciumCluster>
}

/**
 * Arcium Reader SDK interface
 *
 * The actual SDK is @arcium-hq/reader.
 * This interface defines the expected API for querying state.
 */
export interface IArciumReader {
  /**
   * Get computation account info
   *
   * @param computationId - Computation identifier
   * @returns Computation info
   */
  getComputationAccInfo(computationId: string): Promise<ComputationInfo>

  /**
   * Subscribe to computation updates
   *
   * @param computationId - Computation to watch
   * @param callback - Called on status changes
   * @returns Unsubscribe function
   */
  subscribeComputation(
    computationId: string,
    callback: (info: ComputationInfo) => void
  ): () => void

  /**
   * Get cluster account info
   *
   * @param clusterId - Cluster identifier
   * @returns Cluster info
   */
  getClusterAccInfo(clusterId: string): Promise<ArciumCluster>
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default Arcium clusters on different networks
 */
export const ARCIUM_CLUSTERS: Record<ArciumNetwork, string> = {
  devnet: 'devnet-cluster-1',
  testnet: 'testnet-cluster-1',
  'mainnet-beta': 'mainnet-cluster-1',
}

/**
 * Arcium program addresses on Solana
 *
 * NOTE: These are PLACEHOLDER addresses for type safety only.
 * Real program IDs come from @arcium-hq/client SDK at runtime.
 * The PLACEHOLDER prefix makes them obviously invalid to prevent
 * accidental use in production or devnet testing.
 */
export const ARCIUM_PROGRAM_IDS: Record<ArciumNetwork, string> = {
  devnet: 'PLACEHLDRArciumDevnet11111111111111111111111',
  testnet: 'PLACEHLDRArciumTestnet1111111111111111111111',
  'mainnet-beta': 'PLACEHLDRArciumMainnet1111111111111111111111',
}

/**
 * Default timeout for computation finalization (5 minutes)
 */
export const DEFAULT_COMPUTATION_TIMEOUT_MS = 300_000

/**
 * Estimated time for MPC computation (varies by circuit complexity)
 */
export const ESTIMATED_COMPUTATION_TIME_MS = 60_000

/**
 * Base cost for Arcium computation (in lamports)
 * Actual cost depends on circuit complexity and cluster fees
 */
export const BASE_COMPUTATION_COST_LAMPORTS = BigInt(50_000_000) // ~0.05 SOL

// ─── Cost Calculation Constants ───────────────────────────────────────────────

/**
 * Cost per encrypted input in lamports (~0.001 SOL)
 * Used in computation cost estimation
 */
export const COST_PER_ENCRYPTED_INPUT_LAMPORTS = BigInt(1_000_000)

/**
 * Cost per kilobyte of input data in lamports (~0.0005 SOL)
 * Used in computation cost estimation for larger payloads
 */
export const COST_PER_INPUT_KB_LAMPORTS = BigInt(500_000)

/**
 * Bytes per kilobyte for size calculations
 * Using 1000 (SI standard) rather than 1024 (binary)
 */
export const BYTES_PER_KB = 1000

/**
 * Solana slot time in milliseconds
 * Average time between Solana slots (~400ms)
 * @see https://docs.solana.com/cluster/synchronization
 */
export const SOLANA_SLOT_TIME_MS = 400

// ─── Upper Bound Validation Constants ─────────────────────────────────────────

/**
 * Default maximum number of encrypted inputs per computation
 * Prevents excessive MPC coordination overhead
 */
export const DEFAULT_MAX_ENCRYPTED_INPUTS = 100

/**
 * @deprecated Use DEFAULT_MAX_ENCRYPTED_INPUTS instead
 */
export const MAX_ENCRYPTED_INPUTS = DEFAULT_MAX_ENCRYPTED_INPUTS

/**
 * Default maximum size of a single encrypted input (1 MB)
 * Prevents memory exhaustion during encryption/decryption
 */
export const DEFAULT_MAX_INPUT_SIZE_BYTES = 1_048_576

/**
 * @deprecated Use DEFAULT_MAX_INPUT_SIZE_BYTES instead
 */
export const MAX_INPUT_SIZE_BYTES = DEFAULT_MAX_INPUT_SIZE_BYTES

/**
 * Default maximum total size of all inputs combined (10 MB)
 * Prevents excessive network/computation load
 */
export const DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES = 10_485_760

/**
 * @deprecated Use DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES instead
 */
export const MAX_TOTAL_INPUT_SIZE_BYTES = DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES

/**
 * Default maximum reasonable computation cost (~1 SOL)
 * Prevents overflow and unreasonable cost estimates
 */
export const DEFAULT_MAX_COMPUTATION_COST_LAMPORTS = BigInt(1_000_000_000)

/**
 * @deprecated Use DEFAULT_MAX_COMPUTATION_COST_LAMPORTS instead
 */
export const MAX_COMPUTATION_COST_LAMPORTS = DEFAULT_MAX_COMPUTATION_COST_LAMPORTS

// ─── Configurable Limits Types ────────────────────────────────────────────────

/**
 * Configuration for Arcium validation limits.
 * All fields are optional - defaults from DEFAULT_* constants are used if not specified.
 */
export interface ArciumLimitsConfig {
  /** Maximum number of encrypted inputs per computation */
  maxEncryptedInputs?: number
  /** Maximum size of a single encrypted input in bytes */
  maxInputSizeBytes?: number
  /** Maximum total size of all inputs combined in bytes */
  maxTotalInputSizeBytes?: number
  /** Maximum computation cost in lamports */
  maxComputationCostLamports?: bigint
}

/**
 * Resolved limits configuration with all values set.
 * Used internally after merging user config with defaults.
 */
export interface ArciumLimitsResolved {
  maxEncryptedInputs: number
  maxInputSizeBytes: number
  maxTotalInputSizeBytes: number
  maxComputationCostLamports: bigint
}

// ─── Error Types ──────────────────────────────────────────────────────────────

/**
 * Arcium-specific error codes
 */
export type ArciumErrorCode =
  | 'ARCIUM_ERROR'
  | 'ARCIUM_INVALID_NETWORK'
  | 'ARCIUM_COMPUTATION_FAILED'
  | 'ARCIUM_COMPUTATION_TIMEOUT'
  | 'ARCIUM_CLUSTER_UNAVAILABLE'
  | 'ARCIUM_CIRCUIT_NOT_FOUND'

/**
 * Error thrown by Arcium backend operations
 *
 * Extends SIPError with Arcium-specific context and error codes.
 *
 * @example
 * ```typescript
 * throw new ArciumError('Invalid network', 'ARCIUM_INVALID_NETWORK', {
 *   context: { network: 'invalid', validNetworks: ['devnet', 'testnet', 'mainnet-beta'] }
 * })
 * ```
 */
export class ArciumError extends SIPError {
  /** Arcium-specific error code */
  readonly arciumCode: ArciumErrorCode

  /** Network where error occurred */
  readonly network?: ArciumNetwork

  /** Computation ID if applicable */
  readonly computationId?: string

  /** Cluster involved if applicable */
  readonly cluster?: string

  constructor(
    message: string,
    arciumCode: ArciumErrorCode = 'ARCIUM_ERROR',
    options?: {
      cause?: Error
      context?: Record<string, unknown>
      network?: ArciumNetwork
      computationId?: string
      cluster?: string
    }
  ) {
    // Map Arcium code to SIP error code
    let sipCode: ErrorCode
    switch (arciumCode) {
      case 'ARCIUM_INVALID_NETWORK':
        sipCode = ErrorCode.ARCIUM_INVALID_NETWORK
        break
      case 'ARCIUM_COMPUTATION_FAILED':
        sipCode = ErrorCode.ARCIUM_COMPUTATION_FAILED
        break
      case 'ARCIUM_COMPUTATION_TIMEOUT':
        sipCode = ErrorCode.ARCIUM_COMPUTATION_TIMEOUT
        break
      case 'ARCIUM_CLUSTER_UNAVAILABLE':
        sipCode = ErrorCode.ARCIUM_CLUSTER_UNAVAILABLE
        break
      case 'ARCIUM_CIRCUIT_NOT_FOUND':
        sipCode = ErrorCode.ARCIUM_CIRCUIT_NOT_FOUND
        break
      default:
        sipCode = ErrorCode.ARCIUM_ERROR
    }

    super(message, sipCode, options)
    this.name = 'ArciumError'
    this.arciumCode = arciumCode
    this.network = options?.network
    this.computationId = options?.computationId
    this.cluster = options?.cluster
  }

  /**
   * Check if this is a network configuration error
   */
  isNetworkError(): boolean {
    return this.arciumCode === 'ARCIUM_INVALID_NETWORK'
  }

  /**
   * Check if this is a computation-related error
   */
  isComputationError(): boolean {
    return (
      this.arciumCode === 'ARCIUM_COMPUTATION_FAILED' ||
      this.arciumCode === 'ARCIUM_COMPUTATION_TIMEOUT'
    )
  }

  /**
   * Check if this is a cluster-related error
   */
  isClusterError(): boolean {
    return this.arciumCode === 'ARCIUM_CLUSTER_UNAVAILABLE'
  }
}

/**
 * Check if an error is an ArciumError
 */
export function isArciumError(error: unknown): error is ArciumError {
  return error instanceof ArciumError
}

// ─── Environment Variable Configuration ──────────────────────────────────────

/**
 * Environment variable names for Arcium configuration
 *
 * Allows runtime override of SDK settings without code changes.
 * Priority: network-specific env → generic env → config → default
 *
 * @example
 * ```bash
 * # Generic RPC URL (used if network-specific not set)
 * export ARCIUM_RPC_URL=https://my-rpc.example.com
 *
 * # Network-specific RPC URLs (highest priority)
 * export ARCIUM_RPC_URL_DEVNET=https://devnet.my-rpc.example.com
 * export ARCIUM_RPC_URL_MAINNET=https://mainnet.my-rpc.example.com
 *
 * # Other settings
 * export ARCIUM_NETWORK=devnet
 * export ARCIUM_TIMEOUT_MS=600000
 * ```
 */
export const ARCIUM_ENV_VARS = {
  /** Generic RPC URL (fallback if network-specific not set) */
  RPC_URL: 'ARCIUM_RPC_URL',
  /** Devnet-specific RPC URL */
  RPC_URL_DEVNET: 'ARCIUM_RPC_URL_DEVNET',
  /** Testnet-specific RPC URL */
  RPC_URL_TESTNET: 'ARCIUM_RPC_URL_TESTNET',
  /** Mainnet-specific RPC URL */
  RPC_URL_MAINNET: 'ARCIUM_RPC_URL_MAINNET',
  /** Default network */
  NETWORK: 'ARCIUM_NETWORK',
  /** Default MPC cluster */
  CLUSTER: 'ARCIUM_CLUSTER',
  /** Default cipher type */
  CIPHER: 'ARCIUM_CIPHER',
  /** Computation timeout in milliseconds */
  TIMEOUT_MS: 'ARCIUM_TIMEOUT_MS',
} as const

/**
 * Default Solana RPC endpoints per network
 *
 * Used as fallback when no env var or config is provided.
 */
export const DEFAULT_RPC_ENDPOINTS: Record<ArciumNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

/**
 * Get environment variable value (cross-platform)
 *
 * Works in both Node.js and browser environments.
 *
 * @param name - Environment variable name
 * @returns Value if set, undefined otherwise
 */
export function getEnvVar(name: string): string | undefined {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name]
  }
  // Browser environment (globalThis fallback)
  if (typeof globalThis !== 'undefined') {
    const global = globalThis as Record<string, unknown>
    if (global[name] !== undefined) {
      return String(global[name])
    }
  }
  return undefined
}

/**
 * Resolve RPC URL with fallback chain
 *
 * Priority: network-specific env → generic env → config → default
 *
 * @param network - Target network
 * @param configUrl - URL from config (optional)
 * @returns Resolved RPC URL
 *
 * @example
 * ```typescript
 * // Uses ARCIUM_RPC_URL_DEVNET if set, else ARCIUM_RPC_URL, else config, else default
 * const rpcUrl = resolveRpcUrl('devnet', config.rpcUrl)
 * ```
 */
export function resolveRpcUrl(
  network: ArciumNetwork,
  configUrl?: string
): string {
  // Map network to its specific env var
  const networkEnvMap: Record<ArciumNetwork, string> = {
    devnet: ARCIUM_ENV_VARS.RPC_URL_DEVNET,
    testnet: ARCIUM_ENV_VARS.RPC_URL_TESTNET,
    'mainnet-beta': ARCIUM_ENV_VARS.RPC_URL_MAINNET,
  }

  // 1. Check network-specific env var (highest priority)
  const networkEnvUrl = getEnvVar(networkEnvMap[network])
  if (networkEnvUrl) {
    return networkEnvUrl
  }

  // 2. Check generic env var
  const genericEnvUrl = getEnvVar(ARCIUM_ENV_VARS.RPC_URL)
  if (genericEnvUrl) {
    return genericEnvUrl
  }

  // 3. Use config value if provided
  if (configUrl) {
    return configUrl
  }

  // 4. Fall back to default
  return DEFAULT_RPC_ENDPOINTS[network]
}

/**
 * Resolve network from env or config
 *
 * @param configNetwork - Network from config (optional)
 * @returns Resolved network, defaults to 'devnet'
 */
export function resolveNetwork(configNetwork?: ArciumNetwork): ArciumNetwork {
  const envNetwork = getEnvVar(ARCIUM_ENV_VARS.NETWORK)
  if (envNetwork && isValidNetwork(envNetwork)) {
    return envNetwork as ArciumNetwork
  }
  return configNetwork ?? 'devnet'
}

/**
 * Resolve computation timeout from env or config
 *
 * @param configTimeout - Timeout from config in ms (optional)
 * @returns Resolved timeout in ms
 */
export function resolveTimeout(configTimeout?: number): number {
  const envTimeout = getEnvVar(ARCIUM_ENV_VARS.TIMEOUT_MS)
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return configTimeout ?? DEFAULT_COMPUTATION_TIMEOUT_MS
}

/**
 * Resolve cluster from env or config
 *
 * @param network - Target network (for default cluster selection)
 * @param configCluster - Cluster from config (optional)
 * @returns Resolved cluster ID
 */
export function resolveCluster(
  network: ArciumNetwork,
  configCluster?: string
): string {
  const envCluster = getEnvVar(ARCIUM_ENV_VARS.CLUSTER)
  if (envCluster) {
    return envCluster
  }
  return configCluster ?? ARCIUM_CLUSTERS[network]
}

/**
 * Check if a string is a valid ArciumNetwork value
 *
 * @param value - String to validate
 * @returns True if valid network
 */
function isValidNetwork(value: string): value is ArciumNetwork {
  return value === 'devnet' || value === 'testnet' || value === 'mainnet-beta'
}
