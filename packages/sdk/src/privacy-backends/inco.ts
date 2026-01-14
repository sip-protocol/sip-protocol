/**
 * Inco Privacy Backend
 *
 * Implements the PrivacyBackend interface using Inco FHE (Fully Homomorphic Encryption).
 * Inco provides compute privacy with encrypted on-chain state.
 *
 * ## Key Characteristics
 *
 * - **FHE Computation**: Compute over encrypted data without decryption
 * - **Encrypted State**: Contract state remains encrypted on-chain
 * - **Type System**: euint256, ebool, eaddress encrypted types
 * - **Attestations**: Verified decryption mechanisms
 *
 * ## Trade-offs vs Other Backends
 *
 * | Feature | Inco (FHE) | Arcium (MPC) | SIP Native |
 * |---------|------------|--------------|------------|
 * | Hides sender | ❌ | ❌ | ✅ Stealth |
 * | Hides amount | ✅ (in state) | ❌ | ✅ Pedersen |
 * | Hides computation | ✅ FHE | ✅ MPC | ❌ |
 * | Encrypted state | ✅ | ❌ | ❌ |
 * | Setup required | ✅ Contract | ✅ Circuit | ❌ |
 * | Latency | Medium | Slow | Fast |
 *
 * ## Use Cases
 *
 * - Private voting (encrypted tallies)
 * - Private gaming (encrypted game state)
 * - Confidential DeFi (encrypted positions)
 * - Private NFTs (encrypted metadata)
 *
 * @example
 * ```typescript
 * import { IncoBackend, PrivacyBackendRegistry } from '@sip-protocol/sdk'
 *
 * const backend = new IncoBackend({
 *   rpcUrl: 'https://testnet.inco.org',
 *   network: 'testnet',
 * })
 *
 * const registry = new PrivacyBackendRegistry()
 * registry.register(backend, { priority: 65 })
 *
 * // Execute FHE computation
 * const result = await backend.executeComputation({
 *   chain: 'ethereum',
 *   circuitId: 'private-vote-contract',
 *   encryptedInputs: [encryptedVote],
 * })
 *
 * if (result.success) {
 *   console.log(`Computation ${result.computationId} completed`)
 * }
 * ```
 *
 * @see https://docs.inco.org
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
} from './interface'

import {
  isComputationParams,
  withTimeout,
  ComputationTimeoutError,
  deepFreeze,
} from './interface'

import type {
  IncoProduct,
  EncryptedType,
  EncryptedValue,
  FHEComputationInfo,
  IIncoClient,
} from './inco-types'

import {
  INCO_RPC_URLS,
  INCO_SUPPORTED_CHAINS,
  DEFAULT_FHE_TIMEOUT_MS,
  ESTIMATED_FHE_TIME_MS,
  BASE_FHE_COST_WEI,
  COST_PER_ENCRYPTED_INPUT_WEI,
  type IncoNetwork,
} from './inco-types'

/**
 * Configuration options for Inco backend
 */
export interface IncoBackendConfig {
  /** RPC endpoint URL */
  rpcUrl?: string
  /** Network type */
  network?: IncoNetwork
  /** Chain ID for EVM networks */
  chainId?: number
  /** Inco product (lightning or atlas) */
  product?: IncoProduct
  /** Computation timeout in milliseconds */
  timeout?: number
  /** Custom SDK client (for testing) */
  client?: IIncoClient
}

/**
 * Inco capabilities (static)
 *
 * Key difference from Arcium: Inco can hide amounts in encrypted state
 */
const INCO_CAPABILITIES: BackendCapabilities = {
  hiddenAmount: true, // FHE can encrypt amounts in contract state
  hiddenSender: false, // Transaction sender is visible
  hiddenRecipient: false, // Transaction recipient is visible
  hiddenCompute: true, // PRIMARY PURPOSE: Encrypted state computation
  complianceSupport: false, // No viewing keys for FHE (yet)
  anonymitySet: undefined, // Not applicable for FHE
  setupRequired: true, // Contract must use Inco SDK
  latencyEstimate: 'medium', // Faster than MPC, slower than plain
  supportedTokens: 'all', // Can work with any token in encrypted state
}

/**
 * Inco FHE Compute Privacy Backend
 *
 * Provides compute privacy through Fully Homomorphic Encryption.
 * Use this backend for encrypted on-chain state and computation.
 */
export class IncoBackend implements PrivacyBackend {
  readonly name = 'inco'
  readonly type: BackendType = 'compute'
  readonly chains: string[] = [...INCO_SUPPORTED_CHAINS, 'solana']

  private config: Required<Omit<IncoBackendConfig, 'client'>> & {
    client?: IIncoClient
  }
  private computationCache: Map<string, FHEComputationInfo> = new Map()

  /**
   * Create a new Inco backend
   *
   * @param config - Backend configuration
   * @throws {Error} If network is invalid
   */
  constructor(config: IncoBackendConfig = {}) {
    // Validate network parameter if provided
    if (config.network !== undefined) {
      const validNetworks: IncoNetwork[] = ['testnet', 'mainnet']
      if (!validNetworks.includes(config.network)) {
        throw new Error(
          `Invalid Inco network '${config.network}'. ` +
            `Valid networks: ${validNetworks.join(', ')}`
        )
      }
    }

    this.config = {
      rpcUrl: config.rpcUrl ?? INCO_RPC_URLS[config.network ?? 'testnet'],
      network: config.network ?? 'testnet',
      chainId: config.chainId ?? 9090,
      product: config.product ?? 'lightning',
      timeout: config.timeout ?? DEFAULT_FHE_TIMEOUT_MS,
      client: config.client,
    }
  }

  /**
   * Check if backend is available for given parameters
   */
  async checkAvailability(params: BackendParams): Promise<AvailabilityResult> {
    // Must be computation params for Inco
    if (!isComputationParams(params)) {
      return {
        available: false,
        reason:
          'Inco is a compute backend. Use ComputationParams with circuitId and encryptedInputs.',
      }
    }

    return this.checkComputeAvailability(params)
  }

  /**
   * Check availability for computation params
   */
  private async checkComputeAvailability(
    params: ComputationParams
  ): Promise<AvailabilityResult> {
    // Validate chain - Inco supports EVM chains + Solana (beta)
    const supportedChains = [...INCO_SUPPORTED_CHAINS, 'solana']
    if (!supportedChains.includes(params.chain as typeof INCO_SUPPORTED_CHAINS[number])) {
      return {
        available: false,
        reason: `Inco supports ${supportedChains.join(', ')}. Got: '${params.chain}'`,
      }
    }

    // Validate circuitId (contract address for Inco)
    if (!params.circuitId || params.circuitId.trim() === '') {
      return {
        available: false,
        reason: 'circuitId (contract address) is required for Inco computations',
      }
    }

    // Validate encrypted inputs
    if (!params.encryptedInputs || params.encryptedInputs.length === 0) {
      return {
        available: false,
        reason: 'encryptedInputs array is required and must not be empty',
      }
    }

    // Validate each input is a valid Uint8Array
    for (let i = 0; i < params.encryptedInputs.length; i++) {
      const input = params.encryptedInputs[i]
      if (!(input instanceof Uint8Array) || input.length === 0) {
        return {
          available: false,
          reason: `encryptedInputs[${i}] must be a non-empty Uint8Array`,
        }
      }
    }

    // In production, would check:
    // - Contract exists and uses Inco SDK
    // - Network is reachable
    // - User has necessary permissions

    return {
      available: true,
      estimatedCost: this.estimateFHECost(params),
      estimatedTime: ESTIMATED_FHE_TIME_MS,
    }
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities {
    return { ...INCO_CAPABILITIES }
  }

  /**
   * Execute a privacy-preserving transfer
   *
   * Inco is a compute backend - this method returns an error
   * directing users to use executeComputation() instead.
   */
  async execute(_params: TransferParams): Promise<TransactionResult> {
    return {
      success: false,
      error:
        'Inco is a compute privacy backend for FHE operations. ' +
        'Use executeComputation() for encrypted state computations. ' +
        'For transaction privacy, use SIPNativeBackend or PrivacyCashBackend.',
      backend: this.name,
      metadata: {
        hint: 'executeComputation',
        paramsType: 'ComputationParams',
      },
    }
  }

  /**
   * Execute a privacy-preserving computation via FHE
   *
   * This submits encrypted data to an Inco-enabled smart contract
   * for computation over encrypted state.
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
      // In a real implementation with the SDK:
      // 1. const client = await this.getClient()
      // 2. const computationId = await client.submitComputation({
      //      contractAddress: params.circuitId,
      //      functionName: params.options?.functionName ?? 'compute',
      //      encryptedInputs: params.encryptedInputs.map(i => handleFromBytes(i)),
      //    })
      // 3. Optionally await completion

      // Simulated result (SDK integration pending)
      const simulatedComputationId = this.generateComputationId()

      // Cache the computation info
      const info: FHEComputationInfo = {
        id: simulatedComputationId,
        status: 'submitted',
        contractAddress: params.circuitId,
        functionName: (params.options?.functionName as string) ?? 'compute',
        inputHandles: params.encryptedInputs.map((_, i) => `handle_${i}`),
        submittedAt: Date.now(),
      }
      this.computationCache.set(simulatedComputationId, info)

      return {
        success: true,
        computationId: simulatedComputationId,
        backend: this.name,
        status: 'submitted',
        metadata: {
          contractAddress: params.circuitId,
          functionName: info.functionName,
          inputCount: params.encryptedInputs.length,
          network: this.config.network,
          product: this.config.product,
          chainId: this.config.chainId,
          submittedAt: Date.now(),
          warning: 'Simulated result - SDK integration pending',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        backend: this.name,
        status: 'failed',
      }
    }
  }

  /**
   * Estimate cost for an operation
   */
  async estimateCost(params: BackendParams): Promise<bigint> {
    if (isComputationParams(params)) {
      return this.estimateFHECost(params)
    }

    // Transfer params - return 0 as we don't support transfers
    return BigInt(0)
  }

  /**
   * Encrypt a value for FHE computation
   *
   * Helper method for encrypting plaintext values into FHE-compatible format.
   *
   * @param value - Value to encrypt
   * @param type - Target encrypted type
   * @returns Encrypted value with handle
   */
  async encryptValue(
    value: bigint | boolean | string,
    type: EncryptedType
  ): Promise<EncryptedValue> {
    // Validate type matches value
    if (type === 'euint256' && typeof value !== 'bigint') {
      throw new Error('euint256 requires a bigint value')
    }
    if (type === 'ebool' && typeof value !== 'boolean') {
      throw new Error('ebool requires a boolean value')
    }
    if (type === 'eaddress' && typeof value !== 'string') {
      throw new Error('eaddress requires a string value')
    }

    // In production, would use the SDK:
    // const client = await this.getClient()
    // return client.encrypt({ value, type })

    // Simulated encryption
    const handle = `inco_${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const ciphertext = this.simulateEncryption(value, type)

    return {
      handle,
      type,
      ciphertext,
      chainId: this.config.chainId,
    }
  }

  /**
   * Decrypt an encrypted value
   *
   * Requires proper authorization (attestation) in production.
   *
   * @param handle - Handle of the encrypted value
   * @param type - Expected type (for validation)
   * @returns Decrypted value
   */
  async decryptValue(
    handle: string,
    type: EncryptedType
  ): Promise<bigint | boolean | string> {
    // In production, would use the SDK with attestation:
    // const client = await this.getClient()
    // const result = await client.decrypt({ handle, type })
    // return result.value
    void handle // Mark as intentionally unused (for future SDK integration)

    // Simulated decryption - return type-appropriate default
    switch (type) {
      case 'euint256':
        return BigInt(0)
      case 'ebool':
        return false
      case 'eaddress':
        return '0x0000000000000000000000000000000000000000'
      default:
        throw new Error(`Unknown encrypted type: ${type}`)
    }
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

    // In production, would query the Inco network:
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
  ): Promise<FHEComputationInfo | undefined> {
    // Check cache
    const cached = this.computationCache.get(computationId)
    if (cached) {
      return cached
    }

    // In production, would query the Inco network
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
   * In production, this would poll the Inco network for completion.
   * Currently simulates immediate completion for testing.
   */
  private async pollComputationResult(
    computationId: string,
    info: FHEComputationInfo
  ): Promise<ComputationResult> {
    // In production, would poll the Inco network:
    // const client = await this.getClient()
    // const output = await client.awaitFinalization(computationId)

    // Simulated: Mark as completed immediately
    info.status = 'completed'
    info.completedAt = Date.now()
    info.outputHandle = `output_${computationId}`
    this.computationCache.set(computationId, info)

    return {
      success: true,
      computationId,
      output: new Uint8Array([0, 1, 2, 3]), // Simulated output
      backend: this.name,
      status: 'completed',
      completedAt: info.completedAt,
      metadata: {
        contractAddress: info.contractAddress,
        functionName: info.functionName,
        outputHandle: info.outputHandle,
        duration: info.completedAt - info.submittedAt,
        warning: 'Simulated result - SDK integration pending',
      },
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Estimate cost for an FHE computation
   */
  private estimateFHECost(params: ComputationParams): bigint {
    let cost = BASE_FHE_COST_WEI

    // More inputs = higher cost
    const inputCost = BigInt(params.encryptedInputs.length) * COST_PER_ENCRYPTED_INPUT_WEI
    cost += inputCost

    // Larger inputs = higher cost (per KB)
    const totalInputSize = params.encryptedInputs.reduce(
      (sum, input) => sum + input.length,
      0
    )
    const sizeCostPerKB = BigInt('100000000000000') // 0.0001 ETH per KB
    const sizeCost = BigInt(Math.ceil(totalInputSize / 1000)) * sizeCostPerKB
    cost += sizeCost

    return cost
  }

  /**
   * Generate a unique computation ID
   */
  private generateComputationId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 10)
    return `inco_${timestamp}_${random}`
  }

  /**
   * Simulate encryption (for testing without SDK)
   */
  private simulateEncryption(
    value: bigint | boolean | string,
    type: EncryptedType
  ): Uint8Array {
    // Create a deterministic but fake ciphertext
    const encoder = new TextEncoder()
    const valueStr = String(value)
    const combined = `${type}:${valueStr}:${Date.now()}`
    return encoder.encode(combined)
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

  /**
   * Get current configuration (deeply frozen copy)
   */
  getConfig(): Readonly<Omit<IncoBackendConfig, 'client'>> {
    return deepFreeze({
      rpcUrl: this.config.rpcUrl,
      network: this.config.network,
      chainId: this.config.chainId,
      product: this.config.product,
      timeout: this.config.timeout,
    })
  }
}
