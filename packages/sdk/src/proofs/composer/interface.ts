/**
 * Proof Composer Interface
 *
 * Defines the core interfaces for proof composition, including:
 * - ProofComposer: Main composition orchestrator
 * - ComposableProofProvider: Abstract provider for proof systems
 *
 * @packageDocumentation
 */

import type {
  ProofSystem,
  ProofAggregationStrategy,
  SingleProof,
  ComposedProof,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  ProofProviderStatus,
  CompositionResult,
  VerificationResult,
  CompositionEventListener,
} from '@sip-protocol/types'

import type {
  ProofProviderRegistration,
  RegisterProviderOptions,
  ProofGenerationRequest,
  ProofGenerationResult,
  ComposeProofsOptions,
  VerifyComposedProofOptions,
  AggregateProofsOptions,
  AggregationResult,
  ConvertProofOptions,
  ConversionResult,
  CacheStats,
  WorkerPoolStatus,
  CompatibilityMatrix,
  FallbackConfig,
  TelemetryCollector,
} from './types'

// ─── Composable Proof Provider ──────────────────────────────────────────────

/**
 * Abstract interface for proof providers that can participate in composition.
 *
 * Implementations of this interface provide proof generation and verification
 * for a specific proof system (Noir, Halo2, Kimchi, etc.).
 *
 * @example
 * ```typescript
 * class Halo2Provider implements ComposableProofProvider {
 *   readonly system = 'halo2'
 *
 *   async initialize() {
 *     // Load WASM, setup keys, etc.
 *   }
 *
 *   async generateProof(request) {
 *     // Generate Halo2 proof
 *   }
 *
 *   async verifyProof(proof) {
 *     // Verify Halo2 proof
 *   }
 * }
 * ```
 */
export interface ComposableProofProvider {
  /**
   * The proof system this provider implements
   */
  readonly system: ProofSystem

  /**
   * Provider capabilities
   */
  readonly capabilities: ProofProviderCapabilities

  /**
   * Current provider status
   */
  readonly status: ProofProviderStatus

  /**
   * Initialize the provider.
   * Must be called before generating or verifying proofs.
   *
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>

  /**
   * Wait for provider to be ready with optional timeout.
   *
   * @param timeoutMs - Maximum wait time in milliseconds (default: 30000)
   * @throws Error if timeout reached or initialization fails
   */
  waitUntilReady(timeoutMs?: number): Promise<void>

  /**
   * Generate a proof for the given request.
   *
   * @param request - Proof generation request
   * @returns Generation result with proof or error
   */
  generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult>

  /**
   * Verify a single proof.
   *
   * @param proof - The proof to verify
   * @returns true if valid, false otherwise
   */
  verifyProof(proof: SingleProof): Promise<boolean>

  /**
   * Verify multiple proofs in a batch (if supported).
   *
   * @param proofs - Proofs to verify
   * @returns Array of verification results
   */
  verifyBatch?(proofs: SingleProof[]): Promise<boolean[]>

  /**
   * Get available circuits for this provider.
   *
   * @returns Array of circuit identifiers
   */
  getAvailableCircuits(): string[]

  /**
   * Check if a specific circuit is available.
   *
   * @param circuitId - Circuit identifier
   * @returns true if circuit is available
   */
  hasCircuit(circuitId: string): boolean

  /**
   * Dispose of resources used by this provider.
   */
  dispose(): Promise<void>
}

// ─── Proof Composer Interface ───────────────────────────────────────────────

/**
 * Main interface for the proof composition system.
 *
 * ProofComposer orchestrates the composition of proofs from multiple
 * proof systems, handling:
 * - Provider registration and management
 * - Proof generation across systems
 * - Proof composition and aggregation
 * - Verification of composed proofs
 * - Caching and optimization
 *
 * @example
 * ```typescript
 * const composer = new ProofComposer(config)
 *
 * // Register providers
 * await composer.registerProvider(noirProvider)
 * await composer.registerProvider(halo2Provider)
 *
 * // Generate proofs
 * const proof1 = await composer.generateProof({
 *   circuitId: 'funding_proof',
 *   privateInputs: { balance: 1000n },
 *   publicInputs: { minRequired: 100n },
 * })
 *
 * const proof2 = await composer.generateProof({
 *   circuitId: 'validity_proof',
 *   privateInputs: { sender: '0x...' },
 *   publicInputs: { intentHash: '0x...' },
 * })
 *
 * // Compose proofs
 * const result = await composer.compose({
 *   proofs: [proof1.proof!, proof2.proof!],
 *   strategy: ProofAggregationStrategy.PARALLEL,
 * })
 *
 * // Verify composed proof
 * const verification = await composer.verify({
 *   composedProof: result.composedProof!,
 * })
 * ```
 */
export interface ProofComposer {
  // ─── Configuration ──────────────────────────────────────────────────────

  /**
   * Current configuration
   */
  readonly config: ProofCompositionConfig

  /**
   * Update configuration.
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<ProofCompositionConfig>): void

  // ─── Provider Management ────────────────────────────────────────────────

  /**
   * Register a proof provider.
   *
   * @param provider - The provider to register
   * @param options - Registration options
   * @returns Registration entry
   */
  registerProvider(
    provider: ComposableProofProvider,
    options?: RegisterProviderOptions,
  ): Promise<ProofProviderRegistration>

  /**
   * Unregister a provider.
   *
   * @param providerId - Provider ID to unregister
   * @returns true if provider was removed
   */
  unregisterProvider(providerId: string): boolean

  /**
   * Get a registered provider by ID.
   *
   * @param providerId - Provider ID
   * @returns Provider or undefined
   */
  getProvider(providerId: string): ComposableProofProvider | undefined

  /**
   * Get provider for a specific proof system.
   *
   * @param system - Proof system
   * @returns Provider or undefined
   */
  getProviderForSystem(system: ProofSystem): ComposableProofProvider | undefined

  /**
   * Get all registered providers.
   *
   * @returns Array of provider registrations
   */
  getProviders(): ProofProviderRegistration[]

  /**
   * Get available proof systems.
   *
   * @returns Array of available systems
   */
  getAvailableSystems(): ProofSystem[]

  // ─── Proof Generation ───────────────────────────────────────────────────

  /**
   * Generate a proof using the appropriate provider.
   *
   * @param request - Proof generation request
   * @returns Generation result
   */
  generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult>

  /**
   * Generate multiple proofs in parallel.
   *
   * @param requests - Array of proof requests
   * @returns Array of generation results
   */
  generateProofs(requests: ProofGenerationRequest[]): Promise<ProofGenerationResult[]>

  // ─── Composition ────────────────────────────────────────────────────────

  /**
   * Compose multiple proofs into a single composed proof.
   *
   * @param options - Composition options
   * @returns Composition result
   */
  compose(options: ComposeProofsOptions): Promise<CompositionResult>

  /**
   * Aggregate proofs into a single proof (if supported).
   *
   * @param options - Aggregation options
   * @returns Aggregation result
   */
  aggregate(options: AggregateProofsOptions): Promise<AggregationResult>

  // ─── Verification ───────────────────────────────────────────────────────

  /**
   * Verify a composed proof.
   *
   * @param options - Verification options
   * @returns Verification result
   */
  verify(options: VerifyComposedProofOptions): Promise<VerificationResult>

  /**
   * Verify a single proof.
   *
   * @param proof - Proof to verify
   * @returns true if valid
   */
  verifySingle(proof: SingleProof): Promise<boolean>

  // ─── Format Conversion ──────────────────────────────────────────────────

  /**
   * Convert a proof to a different format.
   *
   * @param options - Conversion options
   * @returns Conversion result
   */
  convert(options: ConvertProofOptions): Promise<ConversionResult>

  /**
   * Get the compatibility matrix for proof systems.
   *
   * @returns Compatibility matrix
   */
  getCompatibilityMatrix(): CompatibilityMatrix

  /**
   * Check if two systems are compatible for composition.
   *
   * @param source - Source system
   * @param target - Target system
   * @returns true if compatible
   */
  areSystemsCompatible(source: ProofSystem, target: ProofSystem): boolean

  // ─── Caching ────────────────────────────────────────────────────────────

  /**
   * Get cache statistics.
   *
   * @returns Cache stats
   */
  getCacheStats(): CacheStats

  /**
   * Clear the proof cache.
   *
   * @param olderThan - Optional: only clear entries older than this timestamp
   */
  clearCache(olderThan?: number): void

  // ─── Worker Pool ────────────────────────────────────────────────────────

  /**
   * Get worker pool status.
   *
   * @returns Worker pool status
   */
  getWorkerPoolStatus(): WorkerPoolStatus

  /**
   * Scale worker pool.
   *
   * @param targetWorkers - Target number of workers
   */
  scaleWorkerPool(targetWorkers: number): Promise<void>

  // ─── Fallback Configuration ─────────────────────────────────────────────

  /**
   * Set fallback configuration.
   *
   * @param config - Fallback configuration
   */
  setFallbackConfig(config: FallbackConfig): void

  /**
   * Get current fallback configuration.
   *
   * @returns Fallback config or undefined
   */
  getFallbackConfig(): FallbackConfig | undefined

  // ─── Events ─────────────────────────────────────────────────────────────

  /**
   * Add an event listener.
   *
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  addEventListener(listener: CompositionEventListener): () => void

  /**
   * Remove an event listener.
   *
   * @param listener - Listener to remove
   */
  removeEventListener(listener: CompositionEventListener): void

  // ─── Telemetry ──────────────────────────────────────────────────────────

  /**
   * Set telemetry collector.
   *
   * @param collector - Telemetry collector
   */
  setTelemetryCollector(collector: TelemetryCollector): void

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Initialize the composer and all providers.
   */
  initialize(): Promise<void>

  /**
   * Dispose of resources.
   */
  dispose(): Promise<void>
}

// ─── Factory Types ──────────────────────────────────────────────────────────

/**
 * Factory for creating proof providers
 */
export type ProofProviderFactory = (
  config?: Record<string, unknown>,
) => Promise<ComposableProofProvider>

/**
 * Registry of proof provider factories
 */
export interface ProofProviderRegistry {
  /** Register a provider factory */
  register(system: ProofSystem, factory: ProofProviderFactory): void
  /** Get a provider factory */
  get(system: ProofSystem): ProofProviderFactory | undefined
  /** Create a provider instance */
  create(system: ProofSystem, config?: Record<string, unknown>): Promise<ComposableProofProvider>
  /** Get all registered systems */
  getSystems(): ProofSystem[]
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/**
 * Error thrown during proof composition
 */
export class ProofCompositionError extends Error {
  readonly code: string
  readonly system?: ProofSystem
  readonly proofId?: string
  readonly cause?: Error

  constructor(
    code: string,
    message: string,
    options?: {
      system?: ProofSystem
      proofId?: string
      cause?: Error
    },
  ) {
    super(message)
    this.name = 'ProofCompositionError'
    this.code = code
    this.system = options?.system
    this.proofId = options?.proofId
    this.cause = options?.cause
  }
}

/**
 * Error thrown when a provider is not found
 */
export class ProviderNotFoundError extends ProofCompositionError {
  constructor(system: ProofSystem) {
    super('PROVIDER_NOT_FOUND', `No provider found for system: ${system}`, { system })
    this.name = 'ProviderNotFoundError'
  }
}

/**
 * Error thrown when composition times out
 */
export class CompositionTimeoutError extends ProofCompositionError {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super('TIMEOUT', `Composition timed out after ${timeoutMs}ms`)
    this.name = 'CompositionTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/**
 * Error thrown when proof systems are incompatible
 */
export class IncompatibleSystemsError extends ProofCompositionError {
  readonly source: ProofSystem
  readonly target: ProofSystem

  constructor(source: ProofSystem, target: ProofSystem) {
    super(
      'INCOMPATIBLE_SYSTEMS',
      `Proof systems are incompatible: ${source} -> ${target}`,
      { system: source },
    )
    this.name = 'IncompatibleSystemsError'
    this.source = source
    this.target = target
  }
}
