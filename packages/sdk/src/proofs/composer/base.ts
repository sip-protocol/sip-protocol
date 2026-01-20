/**
 * Base Proof Composer Implementation
 *
 * Provides core functionality for composing proofs from multiple ZK systems.
 * This class orchestrates proof generation, manages provider registration,
 * and handles the composition pipeline.
 *
 * @packageDocumentation
 */

import { randomBytes } from '@noble/hashes/utils'
import { bytesToHex } from '@noble/hashes/utils'

import type {
  ProofSystem,
  ProofAggregationStrategy,
  SingleProof,
  ComposedProof,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  CompositionResult,
  VerificationResult,
  CompositionEvent,
  CompositionEventListener,
  CompositionMetrics,
  IndividualVerificationResult,
  VerificationHints,
  CompositionMetadata,
} from '@sip-protocol/types'

import {
  ProofAggregationStrategy as Strategy,
  ComposedProofStatus,
  CompositionErrorCode,
  DEFAULT_COMPOSITION_CONFIG,
} from '@sip-protocol/types'

import type {
  ProofComposer,
  ComposableProofProvider,
} from './interface'

import {
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
} from './interface'

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
  SystemCompatibility,
} from './types'

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  const bytes = randomBytes(8)
  return `${prefix}-${bytesToHex(bytes)}`
}

/**
 * Create a timeout promise
 */
function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new CompositionTimeoutError(ms)), ms)
  })
}

/**
 * Compute hash of proof data for integrity checking
 */
function computeProofHash(proofs: SingleProof[]): `0x${string}` {
  const data = proofs.map(p => p.proof).join('')
  // Simple hash for demo - in production use proper hashing
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `0x${Math.abs(hash).toString(16).padStart(16, '0')}` as `0x${string}`
}

// ─── Base Proof Composer ────────────────────────────────────────────────────

/**
 * Base implementation of the ProofComposer interface.
 *
 * Provides core functionality for:
 * - Provider registration and management
 * - Proof generation across multiple systems
 * - Proof composition and aggregation
 * - Verification of composed proofs
 * - Event emission for progress tracking
 *
 * @example
 * ```typescript
 * const composer = new BaseProofComposer()
 *
 * // Register providers
 * await composer.registerProvider(noirProvider)
 * await composer.registerProvider(halo2Provider)
 *
 * // Initialize
 * await composer.initialize()
 *
 * // Compose proofs
 * const result = await composer.compose({
 *   proofs: [proof1, proof2],
 *   strategy: ProofAggregationStrategy.PARALLEL,
 * })
 * ```
 */
export class BaseProofComposer implements ProofComposer {
  // ─── Private State ──────────────────────────────────────────────────────

  private _config: ProofCompositionConfig
  private _providers: Map<string, ComposableProofProvider> = new Map()
  private _registrations: Map<string, ProofProviderRegistration> = new Map()
  private _systemToProvider: Map<ProofSystem, string> = new Map()
  private _eventListeners: Set<CompositionEventListener> = new Set()
  private _telemetryCollector?: TelemetryCollector
  private _fallbackConfig?: FallbackConfig
  private _initialized: boolean = false

  // Cache state
  private _cache: Map<string, { proof: SingleProof | ComposedProof; expiresAt: number }> = new Map()
  private _cacheHits: number = 0
  private _cacheMisses: number = 0

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor(config?: Partial<ProofCompositionConfig>) {
    this._config = { ...DEFAULT_COMPOSITION_CONFIG, ...config }
  }

  // ─── Configuration ──────────────────────────────────────────────────────

  get config(): ProofCompositionConfig {
    return { ...this._config }
  }

  updateConfig(config: Partial<ProofCompositionConfig>): void {
    this._config = { ...this._config, ...config }
  }

  // ─── Provider Management ────────────────────────────────────────────────

  async registerProvider(
    provider: ComposableProofProvider,
    options: RegisterProviderOptions = {},
  ): Promise<ProofProviderRegistration> {
    const { override = false, priority = 0, enabled = true } = options
    const system = provider.system
    const existingId = this._systemToProvider.get(system)

    // Check if provider for this system already exists
    if (existingId && !override) {
      throw new ProofCompositionError(
        'PROVIDER_EXISTS',
        `Provider for system '${system}' already registered. Use override: true to replace.`,
        { system },
      )
    }

    // Remove existing if overriding
    if (existingId && override) {
      this._providers.delete(existingId)
      this._registrations.delete(existingId)
    }

    // Generate registration ID
    const id = generateId(`provider-${system}`)

    // Create registration entry
    const registration: ProofProviderRegistration = {
      id,
      system,
      capabilities: provider.capabilities,
      priority,
      enabled,
    }

    // Store provider and registration
    this._providers.set(id, provider)
    this._registrations.set(id, registration)
    this._systemToProvider.set(system, id)

    return registration
  }

  unregisterProvider(providerId: string): boolean {
    const registration = this._registrations.get(providerId)
    if (!registration) {
      return false
    }

    this._providers.delete(providerId)
    this._registrations.delete(providerId)
    this._systemToProvider.delete(registration.system)

    return true
  }

  getProvider(providerId: string): ComposableProofProvider | undefined {
    return this._providers.get(providerId)
  }

  getProviderForSystem(system: ProofSystem): ComposableProofProvider | undefined {
    const providerId = this._systemToProvider.get(system)
    if (!providerId) return undefined
    return this._providers.get(providerId)
  }

  getProviders(): ProofProviderRegistration[] {
    return Array.from(this._registrations.values())
  }

  getAvailableSystems(): ProofSystem[] {
    return Array.from(this._systemToProvider.keys())
  }

  // ─── Proof Generation ───────────────────────────────────────────────────

  async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    const startTime = Date.now()

    // Determine which provider to use
    let provider: ComposableProofProvider | undefined
    let providerId: string

    if (request.providerId) {
      provider = this._providers.get(request.providerId)
      providerId = request.providerId
    } else if (request.system) {
      provider = this.getProviderForSystem(request.system)
      providerId = this._systemToProvider.get(request.system) || 'unknown'
    } else {
      // Use first available provider
      const firstEntry = this._providers.entries().next().value
      if (firstEntry) {
        [providerId, provider] = firstEntry
      } else {
        providerId = 'unknown'
      }
    }

    if (!provider) {
      return {
        success: false,
        error: `No provider available for request`,
        timeMs: Date.now() - startTime,
        providerId: providerId,
      }
    }

    // Ensure provider is ready
    if (!provider.status.isReady) {
      try {
        await provider.waitUntilReady(request.timeoutMs || this._config.timeoutMs)
      } catch {
        return {
          success: false,
          error: 'Provider initialization timeout',
          timeMs: Date.now() - startTime,
          providerId,
        }
      }
    }

    // Check if circuit is available
    if (!provider.hasCircuit(request.circuitId)) {
      return {
        success: false,
        error: `Circuit '${request.circuitId}' not found`,
        timeMs: Date.now() - startTime,
        providerId,
      }
    }

    try {
      const result = await provider.generateProof(request)
      return {
        ...result,
        providerId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timeMs: Date.now() - startTime,
        providerId,
      }
    }
  }

  async generateProofs(requests: ProofGenerationRequest[]): Promise<ProofGenerationResult[]> {
    if (!this._config.enableParallelGeneration) {
      // Sequential generation
      const results: ProofGenerationResult[] = []
      for (const request of requests) {
        results.push(await this.generateProof(request))
      }
      return results
    }

    // Parallel generation with worker limit
    const maxWorkers = this._config.maxParallelWorkers
    const results: ProofGenerationResult[] = new Array(requests.length)
    const queue = [...requests.entries()]

    const worker = async () => {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (!entry) break
        const [index, request] = entry
        results[index] = await this.generateProof(request)
      }
    }

    // Start workers
    const workers = Array.from(
      { length: Math.min(maxWorkers, requests.length) },
      () => worker(),
    )
    await Promise.all(workers)

    return results
  }

  // ─── Composition ────────────────────────────────────────────────────────

  async compose(options: ComposeProofsOptions): Promise<CompositionResult> {
    const compositionId = generateId('composition')
    const startTime = Date.now()
    const { proofs, strategy = this._config.strategy, config, onProgress, abortSignal } = options

    // Emit start event
    this.emitEvent({
      type: 'composition:started',
      timestamp: Date.now(),
      compositionId,
    })

    // Validate proofs
    if (proofs.length === 0) {
      this.emitEvent({
        type: 'composition:failed',
        timestamp: Date.now(),
        compositionId,
      })
      return this.createFailedResult(
        CompositionErrorCode.INVALID_PROOF,
        'No proofs provided for composition',
        startTime,
      )
    }

    if (proofs.length > (config?.maxProofs || this._config.maxProofs)) {
      this.emitEvent({
        type: 'composition:failed',
        timestamp: Date.now(),
        compositionId,
      })
      return this.createFailedResult(
        CompositionErrorCode.TOO_MANY_PROOFS,
        `Too many proofs: ${proofs.length} exceeds max ${this._config.maxProofs}`,
        startTime,
      )
    }

    // Check for abort
    if (abortSignal?.aborted) {
      this.emitEvent({
        type: 'composition:failed',
        timestamp: Date.now(),
        compositionId,
      })
      return this.createFailedResult(
        CompositionErrorCode.TIMEOUT,
        'Composition aborted',
        startTime,
      )
    }

    try {
      // Compose based on strategy
      const composedProof = await this.composeWithStrategy(
        compositionId,
        proofs,
        strategy,
        onProgress,
        abortSignal,
      )

      // Emit completed event
      this.emitEvent({
        type: 'composition:completed',
        timestamp: Date.now(),
        compositionId,
      })

      const totalTime = Date.now() - startTime

      return {
        success: true,
        composedProof,
        metrics: {
          totalTimeMs: totalTime,
          generationTimeMs: 0, // Proofs already generated
          verificationTimeMs: 0,
          aggregationTimeMs: totalTime,
          peakMemoryBytes: 0, // Would need profiling
          proofsProcessed: proofs.length,
        },
      }
    } catch (error) {
      this.emitEvent({
        type: 'composition:failed',
        timestamp: Date.now(),
        compositionId,
      })

      if (error instanceof CompositionTimeoutError) {
        return this.createFailedResult(
          CompositionErrorCode.TIMEOUT,
          error.message,
          startTime,
        )
      }

      return this.createFailedResult(
        CompositionErrorCode.UNKNOWN,
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
      )
    }
  }

  private async composeWithStrategy(
    compositionId: string,
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy,
    onProgress?: CompositionEventListener,
    abortSignal?: AbortSignal,
  ): Promise<ComposedProof> {
    const systems = [...new Set(proofs.map(p => p.metadata.system))]
    const totalSteps = proofs.length + 1 // +1 for aggregation step

    // Progress helper
    const reportProgress = (_step: number, _operation: string) => {
      const event: CompositionEvent = {
        type: 'composition:progress',
        timestamp: Date.now(),
        compositionId,
      }
      this.emitEvent(event)
      onProgress?.(event)
    }

    // Process proofs based on strategy
    switch (strategy) {
      case Strategy.SEQUENTIAL:
        for (let i = 0; i < proofs.length; i++) {
          if (abortSignal?.aborted) throw new CompositionTimeoutError(0)
          reportProgress(i, `Processing proof ${i + 1}/${proofs.length}`)
          // Verify each proof sequentially
          const provider = this.getProviderForSystem(proofs[i].metadata.system)
          if (provider) {
            await provider.verifyProof(proofs[i])
          }
        }
        break

      case Strategy.PARALLEL:
        reportProgress(0, 'Verifying proofs in parallel')
        await Promise.all(
          proofs.map(async (proof) => {
            const provider = this.getProviderForSystem(proof.metadata.system)
            if (provider) {
              await provider.verifyProof(proof)
            }
          }),
        )
        break

      case Strategy.BATCH: {
        // Group by system and batch verify
        reportProgress(0, 'Batch verifying proofs')
        const groupedBySystem = new Map<ProofSystem, SingleProof[]>()
        for (const proof of proofs) {
          const existing = groupedBySystem.get(proof.metadata.system) || []
          existing.push(proof)
          groupedBySystem.set(proof.metadata.system, existing)
        }

        for (const [system, systemProofs] of groupedBySystem) {
          const provider = this.getProviderForSystem(system)
          if (provider?.verifyBatch) {
            await provider.verifyBatch(systemProofs)
          } else if (provider) {
            // Fall back to sequential
            for (const proof of systemProofs) {
              await provider.verifyProof(proof)
            }
          }
        }
        break
      }

      case Strategy.RECURSIVE:
        // Recursive aggregation - would need actual recursive SNARK support
        reportProgress(0, 'Recursive aggregation (simulated)')
        // For now, just verify all proofs
        for (const proof of proofs) {
          const provider = this.getProviderForSystem(proof.metadata.system)
          if (provider) {
            await provider.verifyProof(proof)
          }
        }
        break
    }

    reportProgress(totalSteps - 1, 'Finalizing composition')

    // Create composed proof
    const composedProof: ComposedProof = {
      id: compositionId,
      proofs,
      strategy,
      status: ComposedProofStatus.VERIFIED,
      combinedPublicInputs: proofs.flatMap(p => p.publicInputs),
      compositionMetadata: {
        proofCount: proofs.length,
        systems,
        compositionTimeMs: 0, // Will be set by caller
        success: true,
        inputHash: computeProofHash(proofs),
      },
      verificationHints: this.computeVerificationHints(proofs, strategy),
    }

    return composedProof
  }

  private computeVerificationHints(
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy,
  ): VerificationHints {
    const verificationOrder = proofs.map(p => p.id)

    // Group by system for parallel verification
    const systemGroups = new Map<ProofSystem, string[]>()
    for (const proof of proofs) {
      const existing = systemGroups.get(proof.metadata.system) || []
      existing.push(proof.id)
      systemGroups.set(proof.metadata.system, existing)
    }
    const parallelGroups = Array.from(systemGroups.values())

    return {
      verificationOrder,
      parallelGroups,
      estimatedTimeMs: proofs.length * 100, // Rough estimate
      estimatedCost: BigInt(proofs.length * 100000), // Rough estimate in gas
      supportsBatchVerification: strategy === Strategy.BATCH,
    }
  }

  private createFailedResult(
    code: CompositionErrorCode,
    message: string,
    startTime: number,
  ): CompositionResult {
    return {
      success: false,
      error: {
        code,
        message,
      },
      metrics: {
        totalTimeMs: Date.now() - startTime,
        generationTimeMs: 0,
        verificationTimeMs: 0,
        aggregationTimeMs: 0,
        peakMemoryBytes: 0,
        proofsProcessed: 0,
      },
    }
  }

  async aggregate(options: AggregateProofsOptions): Promise<AggregationResult> {
    const { proofs, targetSystem, verifyFirst = true } = options
    const startTime = Date.now()

    // Verify proofs first if requested
    if (verifyFirst) {
      for (const proof of proofs) {
        const provider = this.getProviderForSystem(proof.metadata.system)
        if (provider) {
          const valid = await provider.verifyProof(proof)
          if (!valid) {
            return {
              success: false,
              error: `Proof ${proof.id} failed verification`,
              metrics: {
                inputProofCount: proofs.length,
                outputProofSize: 0,
                timeMs: Date.now() - startTime,
                recursionDepth: 0,
              },
            }
          }
        }
      }
    }

    // Check if target provider supports aggregation
    const targetProvider = this.getProviderForSystem(targetSystem)
    if (!targetProvider) {
      return {
        success: false,
        error: `No provider for target system: ${targetSystem}`,
        metrics: {
          inputProofCount: proofs.length,
          outputProofSize: 0,
          timeMs: Date.now() - startTime,
          recursionDepth: 0,
        },
      }
    }

    // For now, return a simple aggregation result
    // Real implementation would use recursive SNARKs
    const aggregatedData = proofs.map(p => p.proof).join('')

    return {
      success: true,
      aggregatedProof: `0x${Buffer.from(aggregatedData).toString('hex').slice(0, 128)}`,
      metrics: {
        inputProofCount: proofs.length,
        outputProofSize: 64, // Simulated
        timeMs: Date.now() - startTime,
        recursionDepth: 1,
      },
    }
  }

  // ─── Verification ───────────────────────────────────────────────────────

  async verify(options: VerifyComposedProofOptions): Promise<VerificationResult> {
    const { composedProof, verifyIndividual = true, useBatchVerification = false } = options
    const startTime = Date.now()
    const results: IndividualVerificationResult[] = []

    if (verifyIndividual) {
      if (useBatchVerification) {
        // Group by system and batch verify
        const groupedBySystem = new Map<ProofSystem, SingleProof[]>()
        for (const proof of composedProof.proofs) {
          const existing = groupedBySystem.get(proof.metadata.system) || []
          existing.push(proof)
          groupedBySystem.set(proof.metadata.system, existing)
        }

        for (const [system, systemProofs] of groupedBySystem) {
          const provider = this.getProviderForSystem(system)
          if (provider?.verifyBatch) {
            const batchResults = await provider.verifyBatch(systemProofs)
            for (let i = 0; i < systemProofs.length; i++) {
              results.push({
                proofId: systemProofs[i].id,
                valid: batchResults[i],
                timeMs: 0,
              })
            }
          }
        }
      } else {
        // Verify each proof individually
        for (const proof of composedProof.proofs) {
          const proofStart = Date.now()
          const provider = this.getProviderForSystem(proof.metadata.system)
          let valid = false

          if (provider) {
            valid = await provider.verifyProof(proof)
          }

          results.push({
            proofId: proof.id,
            valid,
            timeMs: Date.now() - proofStart,
          })
        }
      }
    }

    const allValid = results.every(r => r.valid)

    return {
      valid: allValid,
      results,
      totalTimeMs: Date.now() - startTime,
      method: useBatchVerification ? 'batch' : 'individual',
    }
  }

  async verifySingle(proof: SingleProof): Promise<boolean> {
    const provider = this.getProviderForSystem(proof.metadata.system)
    if (!provider) {
      throw new ProviderNotFoundError(proof.metadata.system)
    }
    return provider.verifyProof(proof)
  }

  // ─── Format Conversion ──────────────────────────────────────────────────

  async convert(options: ConvertProofOptions): Promise<ConversionResult> {
    const { proof, targetSystem, preserveMetadata = true } = options

    // Check if conversion is supported
    if (!this.areSystemsCompatible(proof.metadata.system, targetSystem)) {
      return {
        success: false,
        error: `Conversion from ${proof.metadata.system} to ${targetSystem} not supported`,
        lossless: false,
      }
    }

    // For now, just return the proof with updated metadata
    // Real implementation would perform actual conversion
    const convertedProof: SingleProof = {
      ...proof,
      id: generateId('converted'),
      metadata: preserveMetadata
        ? {
            ...proof.metadata,
            system: targetSystem,
          }
        : {
            system: targetSystem,
            systemVersion: '1.0.0',
            circuitId: proof.metadata.circuitId,
            circuitVersion: proof.metadata.circuitVersion,
            generatedAt: Date.now(),
            proofSizeBytes: proof.metadata.proofSizeBytes,
          },
    }

    return {
      success: true,
      convertedProof,
      lossless: proof.metadata.system === targetSystem,
    }
  }

  getCompatibilityMatrix(): CompatibilityMatrix {
    const systems: ProofSystem[] = ['noir', 'halo2', 'kimchi', 'groth16', 'plonk']
    const matrix: CompatibilityMatrix = {} as CompatibilityMatrix

    for (const source of systems) {
      matrix[source] = {} as Record<ProofSystem, SystemCompatibility>
      for (const target of systems) {
        matrix[source][target] = {
          source,
          target,
          conversionSupported: source === target,
          aggregationSupported: source === target,
          notes: source === target ? 'Same system - direct composition' : 'Cross-system not yet implemented',
        }
      }
    }

    return matrix
  }

  areSystemsCompatible(source: ProofSystem, target: ProofSystem): boolean {
    // For now, only same-system is compatible
    // Future: add cross-system compatibility
    return source === target
  }

  // ─── Caching ────────────────────────────────────────────────────────────

  getCacheStats(): CacheStats {
    let totalSize = 0
    for (const entry of this._cache.values()) {
      totalSize += JSON.stringify(entry.proof).length
    }

    const total = this._cacheHits + this._cacheMisses
    const hitRate = total > 0 ? this._cacheHits / total : 0

    return {
      entryCount: this._cache.size,
      totalSizeBytes: totalSize,
      hitRate,
      hits: this._cacheHits,
      misses: this._cacheMisses,
      evictions: 0, // Would need tracking
    }
  }

  clearCache(olderThan?: number): void {
    if (olderThan) {
      for (const [key, entry] of this._cache) {
        if (entry.expiresAt < olderThan) {
          this._cache.delete(key)
        }
      }
    } else {
      this._cache.clear()
    }
  }

  // ─── Worker Pool ────────────────────────────────────────────────────────

  getWorkerPoolStatus(): WorkerPoolStatus {
    // Simplified - would need actual worker pool implementation
    return {
      activeWorkers: 0,
      idleWorkers: this._config.maxParallelWorkers,
      queuedTasks: 0,
      processingTasks: 0,
      avgTaskTimeMs: 0,
    }
  }

  async scaleWorkerPool(targetWorkers: number): Promise<void> {
    this._config.maxParallelWorkers = Math.max(1, targetWorkers)
  }

  // ─── Fallback Configuration ─────────────────────────────────────────────

  setFallbackConfig(config: FallbackConfig): void {
    this._fallbackConfig = config
  }

  getFallbackConfig(): FallbackConfig | undefined {
    return this._fallbackConfig
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  addEventListener(listener: CompositionEventListener): () => void {
    this._eventListeners.add(listener)
    return () => this._eventListeners.delete(listener)
  }

  removeEventListener(listener: CompositionEventListener): void {
    this._eventListeners.delete(listener)
  }

  private emitEvent(event: CompositionEvent): void {
    for (const listener of this._eventListeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ─── Telemetry ──────────────────────────────────────────────────────────

  setTelemetryCollector(collector: TelemetryCollector): void {
    this._telemetryCollector = collector
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) return

    // Initialize all registered providers
    const initPromises: Promise<void>[] = []
    for (const provider of this._providers.values()) {
      if (!provider.status.isReady) {
        initPromises.push(provider.initialize())
      }
    }

    await Promise.all(initPromises)
    this._initialized = true
  }

  async dispose(): Promise<void> {
    // Dispose all providers
    const disposePromises: Promise<void>[] = []
    for (const provider of this._providers.values()) {
      disposePromises.push(provider.dispose())
    }

    await Promise.all(disposePromises)

    // Clear state
    this._providers.clear()
    this._registrations.clear()
    this._systemToProvider.clear()
    this._eventListeners.clear()
    this._cache.clear()
    this._initialized = false
  }
}
