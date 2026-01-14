/**
 * Arcium Privacy Backend
 *
 * Implements the PrivacyBackend interface using Arcium MPC (Multi-Party Computation).
 * Arcium provides compute privacy - hiding what happens inside smart contracts.
 *
 * ## Key Characteristics
 *
 * - **MPC Computation**: Encrypted data processed by multiple nodes
 * - **Compute Privacy**: Hides contract execution logic, not transaction details
 * - **Circuit-Based**: Computations defined by pre-uploaded circuits
 * - **Cluster Coordination**: MPC nodes coordinate to produce results
 *
 * ## Trade-offs vs Transaction Backends
 *
 * | Feature | Arcium (Compute) | SIP Native (Transaction) |
 * |---------|------------------|--------------------------|
 * | Hides sender | ❌ | ✅ Stealth addresses |
 * | Hides amount | ❌ (in tx) | ✅ Pedersen |
 * | Hides computation | ✅ MPC | ❌ |
 * | Setup required | ✅ Circuit upload | ❌ |
 * | Latency | Slow (MPC coord) | Fast |
 *
 * ## Use Cases
 *
 * - Private DEX swap logic (hide slippage, routing)
 * - Private auctions (hide bid amounts during bidding)
 * - Private lending (hide collateral ratios)
 * - Private governance (hide vote weights)
 *
 * @example
 * ```typescript
 * import { ArciumBackend, PrivacyBackendRegistry } from '@sip-protocol/sdk'
 *
 * const backend = new ArciumBackend({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   network: 'devnet',
 * })
 *
 * const registry = new PrivacyBackendRegistry()
 * registry.register(backend, { priority: 70 })
 *
 * // Execute private computation
 * const result = await backend.executeComputation({
 *   chain: 'solana',
 *   circuitId: 'private-swap',
 *   encryptedInputs: [encryptedAmount, encryptedPrice],
 *   cluster: 'devnet-cluster-1',
 * })
 *
 * if (result.success) {
 *   console.log(`Computation ${result.computationId} completed`)
 * }
 * ```
 *
 * @see https://docs.arcium.com/developers
 */

import type {
  PrivacyBackend,
  BackendType,
  BackendCapabilities,
  TransferParams,
  TransactionResult,
  ComputationParams,
  ComputationResult,
  AvailabilityResult,
  BackendParams,
  ComputationStatus,
  CipherType,
} from './interface'

import {
  isComputationParams,
  withTimeout,
  ComputationTimeoutError,
} from './interface'

import {
  ARCIUM_CLUSTERS,
  DEFAULT_COMPUTATION_TIMEOUT_MS,
  ESTIMATED_COMPUTATION_TIME_MS,
  BASE_COMPUTATION_COST_LAMPORTS,
  COST_PER_ENCRYPTED_INPUT_LAMPORTS,
  COST_PER_INPUT_KB_LAMPORTS,
  BYTES_PER_KB,
  DEFAULT_MAX_ENCRYPTED_INPUTS,
  DEFAULT_MAX_INPUT_SIZE_BYTES,
  DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES,
  DEFAULT_MAX_COMPUTATION_COST_LAMPORTS,
  ArciumError,
  // Environment variable configuration
  resolveRpcUrl,
  resolveNetwork,
  resolveTimeout,
  resolveCluster,
  type ArciumNetwork,
  type IArciumClient,
  type ComputationInfo,
  type ArciumLimitsConfig,
  type ArciumLimitsResolved,
} from './arcium-types'

import { createPrivacyLogger } from '../privacy-logger'

const arciumLogger = createPrivacyLogger('Arcium')

/**
 * Configuration options for Arcium backend
 */
export interface ArciumBackendConfig {
  /** Solana RPC endpoint URL */
  rpcUrl?: string
  /** Network type */
  network?: ArciumNetwork
  /** Default MPC cluster to use */
  cluster?: string
  /** Default cipher for encryption */
  defaultCipher?: CipherType
  /** Computation timeout in milliseconds */
  timeout?: number
  /** Custom SDK client (for testing) */
  client?: IArciumClient
  /** Enable debug mode (includes stack traces in error responses) */
  debug?: boolean
  /** Configurable validation limits */
  limits?: ArciumLimitsConfig
}

/**
 * Arcium capabilities (static)
 */
const ARCIUM_CAPABILITIES: BackendCapabilities = {
  hiddenAmount: false, // Arcium hides compute, not amounts
  hiddenSender: false, // Arcium doesn't hide transaction sender
  hiddenRecipient: false, // Arcium doesn't hide transaction recipient
  hiddenCompute: true, // PRIMARY PURPOSE: Hide computation logic
  complianceSupport: false, // No viewing keys for MPC
  anonymitySet: undefined, // Not applicable for MPC
  setupRequired: true, // Need circuit upload before use
  latencyEstimate: 'slow', // MPC coordination takes time
  supportedTokens: 'all', // Can work with any token in compute
}

/**
 * Arcium MPC Compute Privacy Backend
 *
 * Provides compute privacy through Multi-Party Computation.
 * Use this backend to hide smart contract execution logic.
 */
export class ArciumBackend implements PrivacyBackend {
  readonly name = 'arcium'
  readonly type: BackendType = 'compute'
  readonly chains: string[] = ['solana']

  private config: Required<Omit<ArciumBackendConfig, 'client' | 'limits'>> & {
    client?: IArciumClient
  }
  private computationCache: Map<string, ComputationInfo> = new Map()
  private limits: ArciumLimitsResolved

  /**
   * Create a new Arcium backend
   *
   * Configuration is resolved with the following priority:
   * 1. Environment variables (highest priority)
   * 2. Config parameters
   * 3. Default values
   *
   * @param config - Backend configuration
   * @throws {ArciumError} If network is invalid
   * @throws {Error} If limits are invalid (non-positive values)
   *
   * @example
   * ```bash
   * # Configure via environment variables
   * export ARCIUM_RPC_URL_DEVNET=https://my-rpc.example.com
   * export ARCIUM_NETWORK=devnet
   * export ARCIUM_TIMEOUT_MS=600000
   * ```
   *
   * @example
   * ```typescript
   * // Or configure via constructor
   * const backend = new ArciumBackend({
   *   rpcUrl: 'https://my-rpc.example.com',
   *   network: 'devnet',
   *   timeout: 600_000,
   * })
   * ```
   */
  constructor(config: ArciumBackendConfig = {}) {
    // Resolve network first (needed for other resolvers)
    const network = resolveNetwork(config.network)

    // Validate network parameter if explicitly provided
    if (config.network !== undefined) {
      const validNetworks: ArciumNetwork[] = ['devnet', 'testnet', 'mainnet-beta']
      if (!validNetworks.includes(config.network)) {
        throw new ArciumError(
          `Invalid Arcium network '${config.network}'. Valid networks: ${validNetworks.join(', ')}`,
          'ARCIUM_INVALID_NETWORK',
          {
            context: {
              receivedNetwork: config.network,
              validNetworks,
            },
          }
        )
      }
    }

    this.config = {
      rpcUrl: resolveRpcUrl(network, config.rpcUrl),
      network,
      cluster: resolveCluster(network, config.cluster),
      defaultCipher: config.defaultCipher ?? 'aes256',
      timeout: resolveTimeout(config.timeout),
      client: config.client,
      debug: config.debug ?? false,
    }

    // Resolve limits with defaults
    this.limits = {
      maxEncryptedInputs:
        config.limits?.maxEncryptedInputs ?? DEFAULT_MAX_ENCRYPTED_INPUTS,
      maxInputSizeBytes:
        config.limits?.maxInputSizeBytes ?? DEFAULT_MAX_INPUT_SIZE_BYTES,
      maxTotalInputSizeBytes:
        config.limits?.maxTotalInputSizeBytes ?? DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES,
      maxComputationCostLamports:
        config.limits?.maxComputationCostLamports ?? DEFAULT_MAX_COMPUTATION_COST_LAMPORTS,
    }

    // Validate configured limits are positive
    if (this.limits.maxEncryptedInputs <= 0) {
      throw new Error('maxEncryptedInputs must be positive')
    }
    if (this.limits.maxInputSizeBytes <= 0) {
      throw new Error('maxInputSizeBytes must be positive')
    }
    if (this.limits.maxTotalInputSizeBytes <= 0) {
      throw new Error('maxTotalInputSizeBytes must be positive')
    }
    if (this.limits.maxComputationCostLamports <= BigInt(0)) {
      throw new Error('maxComputationCostLamports must be positive')
    }
  }

  /**
   * Get the current resolved limits configuration
   * @returns A copy of the resolved limits
   */
  getLimits(): ArciumLimitsResolved {
    return { ...this.limits }
  }

  /**
   * Check if backend is available for given parameters
   */
  async checkAvailability(params: BackendParams): Promise<AvailabilityResult> {
    // Must be computation params for Arcium
    if (!isComputationParams(params)) {
      return {
        available: false,
        reason:
          'Arcium is a compute backend. Use ComputationParams with circuitId and encryptedInputs.',
      }
    }

    return this.checkComputeAvailability(params)
  }

  /**
   * Check availability for computation params
   */
  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes >= 1_048_576) {
      return `${Math.round(bytes / 1_048_576)} MB`
    }
    if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)} KB`
    }
    return `${bytes} bytes`
  }

  private async checkComputeAvailability(
    params: ComputationParams
  ): Promise<AvailabilityResult> {
    // Validate chain
    if (params.chain !== 'solana') {
      return {
        available: false,
        reason: `Arcium only supports Solana, not '${params.chain}'`,
      }
    }

    // Validate circuitId
    if (!params.circuitId || params.circuitId.trim() === '') {
      return {
        available: false,
        reason: 'circuitId is required for Arcium computations',
      }
    }

    // Validate encrypted inputs
    if (!params.encryptedInputs || params.encryptedInputs.length === 0) {
      return {
        available: false,
        reason: 'encryptedInputs array is required and must not be empty',
      }
    }

    // Validate number of inputs doesn't exceed maximum
    if (params.encryptedInputs.length > this.limits.maxEncryptedInputs) {
      arciumLogger.warn('Validation failed: too many inputs', {
        amount: params.encryptedInputs.length,
      })
      return {
        available: false,
        reason: `Too many encrypted inputs: ${params.encryptedInputs.length} exceeds maximum of ${this.limits.maxEncryptedInputs}`,
      }
    }

    // Validate each input is a valid Uint8Array with size bounds
    let totalInputSize = 0
    for (let i = 0; i < params.encryptedInputs.length; i++) {
      const input = params.encryptedInputs[i]
      if (!(input instanceof Uint8Array) || input.length === 0) {
        return {
          available: false,
          reason: `encryptedInputs[${i}] must be a non-empty Uint8Array`,
        }
      }
      if (input.length > this.limits.maxInputSizeBytes) {
        arciumLogger.warn('Validation failed: input too large', {
          amount: input.length,
        })
        return {
          available: false,
          reason: `encryptedInputs[${i}] size ${input.length} bytes exceeds maximum of ${this.formatBytes(this.limits.maxInputSizeBytes)}`,
        }
      }
      totalInputSize += input.length
    }

    // Validate total input size
    if (totalInputSize > this.limits.maxTotalInputSizeBytes) {
      arciumLogger.warn('Validation failed: total input size exceeded', {
        amount: totalInputSize,
      })
      return {
        available: false,
        reason: `Total input size ${this.formatBytes(totalInputSize)} exceeds maximum of ${this.formatBytes(this.limits.maxTotalInputSizeBytes)}`,
      }
    }

    // Validate cipher type if provided
    if (params.cipher) {
      const validCiphers: CipherType[] = ['aes128', 'aes192', 'aes256', 'rescue']
      if (!validCiphers.includes(params.cipher)) {
        return {
          available: false,
          reason: `Invalid cipher '${params.cipher}'. Supported: ${validCiphers.join(', ')}`,
        }
      }
    }

    // In production, would check:
    // - Circuit exists and is valid
    // - Cluster is available
    // - User has permissions

    return {
      available: true,
      estimatedCost: this.estimateComputeCost(params),
      estimatedTime: ESTIMATED_COMPUTATION_TIME_MS,
    }
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities {
    return { ...ARCIUM_CAPABILITIES }
  }

  /**
   * Execute a privacy-preserving transfer
   *
   * Arcium is a compute backend - this method returns an error
   * directing users to use executeComputation() instead.
   */
  async execute(_params: TransferParams): Promise<TransactionResult> {
    return {
      success: false,
      error:
        'Arcium is a compute privacy backend. ' +
        'Use executeComputation() for MPC operations. ' +
        'For transaction privacy, use SIPNativeBackend or PrivacyCashBackend.',
      backend: this.name,
      metadata: {
        hint: 'executeComputation',
        paramsType: 'ComputationParams',
      },
    }
  }

  /**
   * Execute a privacy-preserving computation via MPC
   *
   * This submits encrypted data to the Arcium MPC network for processing.
   * The computation is defined by a pre-uploaded circuit.
   *
   * @param params - Computation parameters
   * @returns Computation result with ID for tracking
   */
  async executeComputation(
    params: ComputationParams
  ): Promise<ComputationResult> {
    // Validate availability first
    const availability = await this.checkComputeAvailability(params)
    if (!availability.available) {
      return {
        success: false,
        error: availability.reason,
        backend: this.name,
      }
    }

    try {
      const cluster = params.cluster ?? this.config.cluster
      const cipher = params.cipher ?? this.config.defaultCipher

      // In a real implementation with the SDK:
      // 1. const client = await this.getClient()
      // 2. const computationId = await client.submitComputation({
      //      circuitId: params.circuitId,
      //      encryptedInputs: params.encryptedInputs,
      //      cluster,
      //      callback: params.callbackAddress,
      //    })
      // 3. Optionally await finalization

      // Simulated result (SDK integration pending)
      const simulatedComputationId = this.generateComputationId()

      // Cache the computation info
      const info: ComputationInfo = {
        id: simulatedComputationId,
        status: 'submitted',
        circuitId: params.circuitId,
        cluster,
        submittedAt: Date.now(),
      }
      this.computationCache.set(simulatedComputationId, info)

      return {
        success: true,
        computationId: simulatedComputationId,
        backend: this.name,
        status: 'submitted',
        metadata: {
          circuitId: params.circuitId,
          cluster,
          cipher,
          inputCount: params.encryptedInputs.length,
          network: this.config.network,
          submittedAt: Date.now(),
          warning: 'Simulated result - SDK integration pending',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatErrorMessage(error),
        backend: this.name,
        status: 'failed',
        metadata: this.config.debug ? this.getErrorMetadata(error) : undefined,
      }
    }
  }

  /**
   * Estimate cost for an operation
   */
  async estimateCost(params: BackendParams): Promise<bigint> {
    if (isComputationParams(params)) {
      return this.estimateComputeCost(params)
    }

    // Transfer params - return 0 as we don't support transfers
    return BigInt(0)
  }

  /**
   * Get computation status
   *
   * @param computationId - Computation to check
   * @returns Current status or undefined if not found
   */
  async getComputationStatus(
    computationId: string
  ): Promise<ComputationStatus | undefined> {
    // Check cache first
    const cached = this.computationCache.get(computationId)
    if (cached) {
      return cached.status
    }

    // In production, would query the Arcium network:
    // const client = await this.getClient()
    // return client.getComputationStatus(computationId)

    return undefined
  }

  /**
   * Get computation info
   *
   * @param computationId - Computation to query
   * @returns Computation info or undefined if not found
   */
  async getComputationInfo(
    computationId: string
  ): Promise<ComputationInfo | undefined> {
    // Check cache
    const cached = this.computationCache.get(computationId)
    if (cached) {
      return cached
    }

    // In production, would query the Arcium network
    return undefined
  }

  /**
   * Wait for computation to complete
   *
   * @param computationId - Computation to wait for
   * @param timeout - Optional timeout override (defaults to config.timeout)
   * @returns Computation result
   * @throws {ComputationTimeoutError} If computation exceeds timeout
   */
  async awaitComputation(
    computationId: string,
    timeout?: number
  ): Promise<ComputationResult> {
    const timeoutMs = timeout ?? this.config.timeout

    // Check if computation exists before waiting
    const info = this.computationCache.get(computationId)
    if (!info) {
      return {
        success: false,
        error: `Computation ${computationId} not found`,
        backend: this.name,
        status: 'failed',
      }
    }

    // Wrap the polling/waiting logic with timeout
    return withTimeout(
      this.pollComputationResult(computationId, info),
      timeoutMs,
      () => {
        throw new ComputationTimeoutError(computationId, timeoutMs, this.name)
      }
    )
  }

  /**
   * Poll for computation result (simulation)
   *
   * In production, this would poll the Arcium network for completion.
   * Currently simulates immediate completion for testing.
   */
  private async pollComputationResult(
    computationId: string,
    info: ComputationInfo
  ): Promise<ComputationResult> {
    // In production, would poll the Arcium network:
    // const client = await this.getClient()
    // const output = await client.awaitFinalization(computationId)

    // Simulated: Mark as completed immediately
    info.status = 'completed'
    info.completedAt = Date.now()
    this.computationCache.set(computationId, info)

    return {
      success: true,
      computationId,
      output: new Uint8Array([0, 1, 2, 3]), // Simulated output
      backend: this.name,
      status: 'completed',
      completedAt: info.completedAt,
      metadata: {
        circuitId: info.circuitId,
        cluster: info.cluster,
        duration: info.completedAt - info.submittedAt,
        warning: 'Simulated result - SDK integration pending',
      },
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Estimate cost for a computation
   */
  private estimateComputeCost(params: ComputationParams): bigint {
    let cost = BASE_COMPUTATION_COST_LAMPORTS

    // More inputs = higher cost
    const inputCost =
      BigInt(params.encryptedInputs.length) * COST_PER_ENCRYPTED_INPUT_LAMPORTS
    cost += inputCost

    // Larger inputs = higher cost
    const totalInputSize = params.encryptedInputs.reduce(
      (sum, input) => sum + input.length,
      0
    )
    const sizeCost =
      BigInt(Math.ceil(totalInputSize / BYTES_PER_KB)) * COST_PER_INPUT_KB_LAMPORTS
    cost += sizeCost

    // Cap at maximum reasonable cost to prevent unexpected charges
    if (cost > this.limits.maxComputationCostLamports) {
      return this.limits.maxComputationCostLamports
    }

    return cost
  }

  /**
   * Generate a unique computation ID
   */
  private generateComputationId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 10)
    return `arcium_${timestamp}_${random}`
  }

  /**
   * Clear computation cache
   */
  clearComputationCache(): void {
    this.computationCache.clear()
  }

  /**
   * Get cached computation count
   */
  getCachedComputationCount(): number {
    return this.computationCache.size
  }

  // ─── Error Handling Helpers ─────────────────────────────────────────────────

  /**
   * Format an error message for user-facing output
   *
   * Include error type for better debugging while keeping the message clear.
   */
  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const errorType = error.name !== 'Error' ? `[${error.name}] ` : ''
      return `${errorType}${error.message}`
    }
    return 'Unknown error occurred'
  }

  /**
   * Get detailed error metadata for debugging
   *
   * Only called when debug mode is enabled. Includes stack trace and
   * error chain information for troubleshooting.
   */
  private getErrorMetadata(error: unknown): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    }

    if (error instanceof Error) {
      metadata.errorName = error.name
      metadata.errorMessage = error.message
      metadata.stack = error.stack

      // Preserve error cause chain
      if (error.cause) {
        metadata.cause =
          error.cause instanceof Error
            ? {
                name: error.cause.name,
                message: error.cause.message,
                stack: error.cause.stack,
              }
            : String(error.cause)
      }

      // Handle SIPError-specific fields
      if ('code' in error && typeof (error as Record<string, unknown>).code === 'string') {
        metadata.errorCode = (error as Record<string, unknown>).code
      }
      if ('context' in error) {
        metadata.errorContext = (error as Record<string, unknown>).context
      }
    } else {
      metadata.rawError = String(error)
    }

    return metadata
  }
}
