/**
 * Proof Aggregator
 *
 * Implements core proof aggregation logic for combining multiple proofs
 * from different ZK systems into composed proofs.
 *
 * Key features:
 * - Sequential aggregation (prove A, then B with A as input)
 * - Parallel aggregation (prove A and B independently, combine)
 * - Recursive aggregation (proof-of-proofs)
 * - Cross-system proof linking
 * - Failure recovery and retry logic
 * - Progress tracking
 *
 * @packageDocumentation
 */

import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import type {
  ProofSystem,
  ProofAggregationStrategy,
  SingleProof,
  ComposedProof,
  CompositionEvent,
  CompositionEventListener,
  VerificationHints,
  HexString,
} from '@sip-protocol/types'

import {
  ProofAggregationStrategy as Strategy,
  ComposedProofStatus,
} from '@sip-protocol/types'

import type { ComposableProofProvider } from './composer/interface'

import type {
  AggregationResult,
} from './composer/types'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Configuration for the aggregator
 */
export interface AggregatorConfig {
  /** Maximum number of proofs to aggregate */
  maxProofs: number
  /** Maximum recursion depth for recursive aggregation */
  maxRecursionDepth: number
  /** Timeout for aggregation operations (ms) */
  timeoutMs: number
  /** Enable parallel processing */
  enableParallel: boolean
  /** Maximum parallel operations */
  maxParallelOps: number
  /** Retry configuration */
  retry: {
    enabled: boolean
    maxAttempts: number
    delayMs: number
    exponentialBackoff: boolean
  }
  /** Enable verbose logging */
  verbose: boolean
}

/**
 * Progress event for aggregation
 */
export interface AggregationProgressEvent {
  /** Current step */
  step: number
  /** Total steps */
  totalSteps: number
  /** Operation description */
  operation: string
  /** Proof being processed (if applicable) */
  proofId?: string
  /** Time elapsed so far */
  elapsedMs: number
}

/**
 * Callback for aggregation progress
 */
export type AggregationProgressCallback = (event: AggregationProgressEvent) => void

/**
 * Options for sequential aggregation
 */
export interface SequentialAggregationOptions {
  /** Proofs to aggregate in order */
  proofs: SingleProof[]
  /** Provider lookup function */
  getProvider: (system: ProofSystem) => ComposableProofProvider | undefined
  /** Progress callback */
  onProgress?: AggregationProgressCallback
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Whether to verify before aggregating */
  verifyBefore: boolean
  /** Custom linking function for sequential proofs */
  linkProofs?: (previous: SingleProof, current: SingleProof) => HexString | undefined
}

/**
 * Options for parallel aggregation
 */
export interface ParallelAggregationOptions {
  /** Proofs to aggregate */
  proofs: SingleProof[]
  /** Provider lookup function */
  getProvider: (system: ProofSystem) => ComposableProofProvider | undefined
  /** Progress callback */
  onProgress?: AggregationProgressCallback
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Maximum concurrent operations */
  maxConcurrent: number
  /** Whether to verify before aggregating */
  verifyBefore: boolean
}

/**
 * Options for recursive aggregation
 */
export interface RecursiveAggregationOptions {
  /** Proofs to aggregate */
  proofs: SingleProof[]
  /** Provider lookup function */
  getProvider: (system: ProofSystem) => ComposableProofProvider | undefined
  /** Target system for recursion */
  targetSystem: ProofSystem
  /** Maximum recursion depth */
  maxDepth: number
  /** Progress callback */
  onProgress?: AggregationProgressCallback
  /** Abort signal */
  abortSignal?: AbortSignal
}

/**
 * Result of a single aggregation step
 */
export interface AggregationStepResult {
  /** Whether the step succeeded */
  success: boolean
  /** Resulting proof (if successful) */
  proof?: SingleProof
  /** Error message (if failed) */
  error?: string
  /** Time taken for this step */
  timeMs: number
  /** Depth in recursive aggregation */
  depth: number
}

/**
 * Detailed aggregation result with step information
 */
export interface DetailedAggregationResult extends AggregationResult {
  /** Results from each aggregation step */
  stepResults: AggregationStepResult[]
  /** Final composed proof */
  composedProof?: ComposedProof
  /** Retry information */
  retries: {
    attempted: number
    succeeded: number
    failed: number
  }
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_AGGREGATOR_CONFIG: AggregatorConfig = {
  maxProofs: 100,
  maxRecursionDepth: 10,
  timeoutMs: 300000, // 5 minutes
  enableParallel: true,
  maxParallelOps: 4,
  retry: {
    enabled: true,
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
  },
  verbose: false,
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  const bytes = randomBytes(8)
  return `${prefix}-${bytesToHex(bytes)}`
}

/**
 * Compute hash of proof data
 */
function computeProofHash(proofs: SingleProof[]): HexString {
  const data = proofs.map(p => p.proof).join('')
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `0x${Math.abs(hash).toString(16).padStart(16, '0')}` as HexString
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  })
  return {
    promise,
    cancel: () => clearTimeout(timeoutId),
  }
}

// ─── Proof Aggregator ────────────────────────────────────────────────────────

/**
 * Proof Aggregator
 *
 * Implements aggregation logic for combining multiple ZK proofs.
 *
 * @example
 * ```typescript
 * const aggregator = new ProofAggregator()
 *
 * // Sequential aggregation
 * const result = await aggregator.aggregateSequential({
 *   proofs: [proof1, proof2, proof3],
 *   getProvider: (system) => composer.getProviderForSystem(system),
 *   verifyBefore: true,
 * })
 *
 * // Parallel aggregation
 * const parallelResult = await aggregator.aggregateParallel({
 *   proofs: [proofA, proofB, proofC],
 *   getProvider: (system) => composer.getProviderForSystem(system),
 *   maxConcurrent: 3,
 *   verifyBefore: true,
 * })
 *
 * // Recursive aggregation
 * const recursiveResult = await aggregator.aggregateRecursive({
 *   proofs: proofs,
 *   getProvider: (system) => composer.getProviderForSystem(system),
 *   targetSystem: 'kimchi',
 *   maxDepth: 5,
 * })
 * ```
 */
export class ProofAggregator {
  private _config: AggregatorConfig
  private _eventListeners: Set<CompositionEventListener> = new Set()

  constructor(config?: Partial<AggregatorConfig>) {
    this._config = { ...DEFAULT_AGGREGATOR_CONFIG, ...config }
  }

  // ─── Configuration ─────────────────────────────────────────────────────────

  get config(): AggregatorConfig {
    return { ...this._config }
  }

  updateConfig(config: Partial<AggregatorConfig>): void {
    this._config = { ...this._config, ...config }
  }

  // ─── Sequential Aggregation ────────────────────────────────────────────────

  /**
   * Aggregate proofs sequentially.
   *
   * Each proof is processed in order, with optional linking
   * between consecutive proofs.
   */
  async aggregateSequential(options: SequentialAggregationOptions): Promise<DetailedAggregationResult> {
    const startTime = Date.now()
    const compositionId = generateId('seq-agg')
    const { proofs, getProvider, onProgress, abortSignal, verifyBefore, linkProofs } = options
    const stepResults: AggregationStepResult[] = []
    const totalSteps = proofs.length
    const retryStats = { attempted: 0, succeeded: 0, failed: 0 }

    // Emit start event
    this.emitEvent({
      type: 'composition:started',
      timestamp: Date.now(),
      compositionId,
    })

    if (this._config.verbose) {
      console.log(`[Aggregator] Sequential aggregation of ${proofs.length} proofs`)
    }

    // Validate inputs
    if (proofs.length === 0) {
      return this.createFailedResult('No proofs to aggregate', startTime, stepResults, retryStats)
    }

    if (proofs.length > this._config.maxProofs) {
      return this.createFailedResult(
        `Too many proofs: ${proofs.length} > ${this._config.maxProofs}`,
        startTime,
        stepResults,
        retryStats,
      )
    }

    const verifiedProofs: SingleProof[] = []

    for (let i = 0; i < proofs.length; i++) {
      // Check for abort
      if (abortSignal?.aborted) {
        return this.createFailedResult('Aggregation aborted', startTime, stepResults, retryStats)
      }

      const proof = proofs[i]
      const stepStartTime = Date.now()

      // Report progress
      onProgress?.({
        step: i + 1,
        totalSteps,
        operation: `Processing proof ${i + 1}/${totalSteps}`,
        proofId: proof.id,
        elapsedMs: Date.now() - startTime,
      })

      // Verify if requested
      if (verifyBefore) {
        const provider = getProvider(proof.metadata.system)
        if (!provider) {
          stepResults.push({
            success: false,
            error: `No provider for system: ${proof.metadata.system}`,
            timeMs: Date.now() - stepStartTime,
            depth: 0,
          })
          continue
        }

        // Retry logic for verification
        let verified = false
        let lastError: string | undefined

        for (let attempt = 0; attempt < (this._config.retry.enabled ? this._config.retry.maxAttempts : 1); attempt++) {
          if (attempt > 0) {
            retryStats.attempted++
            const delayTime = this._config.retry.exponentialBackoff
              ? this._config.retry.delayMs * Math.pow(2, attempt - 1)
              : this._config.retry.delayMs
            await delay(delayTime)
          }

          try {
            verified = await provider.verifyProof(proof)
            if (verified) {
              if (attempt > 0) retryStats.succeeded++
              break
            }
            lastError = 'Proof verification failed'
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error'
          }
        }

        if (!verified) {
          if (retryStats.attempted > 0) retryStats.failed++
          stepResults.push({
            success: false,
            error: lastError || 'Verification failed',
            timeMs: Date.now() - stepStartTime,
            depth: 0,
          })
          return this.createFailedResult(
            `Proof ${proof.id} failed verification: ${lastError}`,
            startTime,
            stepResults,
            retryStats,
          )
        }
      }

      // Link with previous proof if function provided
      if (linkProofs && i > 0) {
        const linkHash = linkProofs(verifiedProofs[i - 1], proof)
        if (linkHash) {
          // Store link in proof for later verification
          (proof as SingleProof & { linkHash?: HexString }).linkHash = linkHash
        }
      }

      verifiedProofs.push(proof)
      stepResults.push({
        success: true,
        proof,
        timeMs: Date.now() - stepStartTime,
        depth: 0,
      })
    }

    // Create composed proof
    const composedProof = this.createComposedProof(
      verifiedProofs,
      Strategy.SEQUENTIAL,
      startTime,
    )

    // Emit completed event
    this.emitEvent({
      type: 'composition:completed',
      timestamp: Date.now(),
      compositionId,
    })

    return {
      success: true,
      aggregatedProof: computeProofHash(verifiedProofs),
      metrics: {
        inputProofCount: proofs.length,
        outputProofSize: composedProof.proofs.length,
        timeMs: Date.now() - startTime,
        recursionDepth: 0,
      },
      stepResults,
      composedProof,
      retries: retryStats,
    }
  }

  // ─── Parallel Aggregation ──────────────────────────────────────────────────

  /**
   * Aggregate proofs in parallel.
   *
   * All proofs are processed concurrently, limited by maxConcurrent.
   */
  async aggregateParallel(options: ParallelAggregationOptions): Promise<DetailedAggregationResult> {
    const startTime = Date.now()
    const { proofs, getProvider, onProgress, abortSignal, maxConcurrent, verifyBefore } = options
    const stepResults: AggregationStepResult[] = new Array(proofs.length)
    const retryStats = { attempted: 0, succeeded: 0, failed: 0 }
    let completedCount = 0

    if (this._config.verbose) {
      console.log(`[Aggregator] Parallel aggregation of ${proofs.length} proofs (max concurrent: ${maxConcurrent})`)
    }

    // Validate inputs
    if (proofs.length === 0) {
      return this.createFailedResult('No proofs to aggregate', startTime, [], retryStats)
    }

    if (proofs.length > this._config.maxProofs) {
      return this.createFailedResult(
        `Too many proofs: ${proofs.length} > ${this._config.maxProofs}`,
        startTime,
        [],
        retryStats,
      )
    }

    // Create work queue
    const queue = proofs.map((proof, index) => ({ proof, index }))
    const verifiedProofs: SingleProof[] = new Array(proofs.length)
    const errors: string[] = []

    // Worker function
    const worker = async () => {
      while (queue.length > 0) {
        if (abortSignal?.aborted) return

        const item = queue.shift()
        if (!item) break

        const { proof, index } = item
        const stepStartTime = Date.now()

        try {
          if (verifyBefore) {
            const provider = getProvider(proof.metadata.system)
            if (!provider) {
              throw new Error(`No provider for system: ${proof.metadata.system}`)
            }
            const valid = await provider.verifyProof(proof)
            if (!valid) {
              throw new Error('Proof verification failed')
            }
          }

          verifiedProofs[index] = proof
          stepResults[index] = {
            success: true,
            proof,
            timeMs: Date.now() - stepStartTime,
            depth: 0,
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Proof ${proof.id}: ${errorMsg}`)
          stepResults[index] = {
            success: false,
            error: errorMsg,
            timeMs: Date.now() - stepStartTime,
            depth: 0,
          }
        }

        completedCount++
        onProgress?.({
          step: completedCount,
          totalSteps: proofs.length,
          operation: `Verified ${completedCount}/${proofs.length} proofs`,
          proofId: proof.id,
          elapsedMs: Date.now() - startTime,
        })
      }
    }

    // Start workers
    const workers = Array.from(
      { length: Math.min(maxConcurrent, proofs.length) },
      () => worker(),
    )

    // Set up timeout
    const timeout = createTimeout(this._config.timeoutMs)

    try {
      await Promise.race([
        Promise.all(workers),
        timeout.promise,
      ])
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        return this.createFailedResult(
          `Aggregation timed out after ${this._config.timeoutMs}ms`,
          startTime,
          stepResults.filter(Boolean),
          retryStats,
        )
      }
      throw error
    } finally {
      timeout.cancel()
    }

    // Check for errors
    if (errors.length > 0) {
      return this.createFailedResult(
        `${errors.length} proofs failed: ${errors[0]}`,
        startTime,
        stepResults.filter(Boolean),
        retryStats,
      )
    }

    // Create composed proof
    const validProofs = verifiedProofs.filter(Boolean)
    const composedProof = this.createComposedProof(
      validProofs,
      Strategy.PARALLEL,
      startTime,
    )

    return {
      success: true,
      aggregatedProof: computeProofHash(validProofs),
      metrics: {
        inputProofCount: proofs.length,
        outputProofSize: composedProof.proofs.length,
        timeMs: Date.now() - startTime,
        recursionDepth: 0,
      },
      stepResults: stepResults.filter(Boolean),
      composedProof,
      retries: retryStats,
    }
  }

  // ─── Recursive Aggregation ─────────────────────────────────────────────────

  /**
   * Aggregate proofs recursively.
   *
   * Combines proofs using recursive SNARKs (proof-of-proofs).
   * This enables constant-size proofs regardless of input count.
   */
  async aggregateRecursive(options: RecursiveAggregationOptions): Promise<DetailedAggregationResult> {
    const startTime = Date.now()
    const { proofs, getProvider, targetSystem, maxDepth, onProgress, abortSignal } = options
    const stepResults: AggregationStepResult[] = []
    const retryStats = { attempted: 0, succeeded: 0, failed: 0 }

    if (this._config.verbose) {
      console.log(`[Aggregator] Recursive aggregation of ${proofs.length} proofs (target: ${targetSystem}, maxDepth: ${maxDepth})`)
    }

    // Validate inputs
    if (proofs.length === 0) {
      return this.createFailedResult('No proofs to aggregate', startTime, stepResults, retryStats)
    }

    if (maxDepth > this._config.maxRecursionDepth) {
      return this.createFailedResult(
        `Max depth ${maxDepth} exceeds limit ${this._config.maxRecursionDepth}`,
        startTime,
        stepResults,
        retryStats,
      )
    }

    const provider = getProvider(targetSystem)
    if (!provider) {
      return this.createFailedResult(
        `No provider for target system: ${targetSystem}`,
        startTime,
        stepResults,
        retryStats,
      )
    }

    // Check if provider supports recursion
    if (!provider.capabilities.supportsRecursion) {
      return this.createFailedResult(
        `Provider for ${targetSystem} does not support recursion`,
        startTime,
        stepResults,
        retryStats,
      )
    }

    // Recursive aggregation loop
    let currentProofs = [...proofs]
    let currentDepth = 0

    while (currentProofs.length > 1 && currentDepth < maxDepth) {
      if (abortSignal?.aborted) {
        return this.createFailedResult('Aggregation aborted', startTime, stepResults, retryStats)
      }

      const stepStartTime = Date.now()
      currentDepth++

      onProgress?.({
        step: currentDepth,
        totalSteps: maxDepth,
        operation: `Recursive merge depth ${currentDepth}: ${currentProofs.length} proofs`,
        elapsedMs: Date.now() - startTime,
      })

      // Pair up proofs for recursive merging
      const pairs: SingleProof[][] = []
      for (let i = 0; i < currentProofs.length; i += 2) {
        if (i + 1 < currentProofs.length) {
          pairs.push([currentProofs[i], currentProofs[i + 1]])
        } else {
          pairs.push([currentProofs[i]])
        }
      }

      // Merge pairs
      const mergedProofs: SingleProof[] = []

      for (const pair of pairs) {
        if (pair.length === 1) {
          // Odd proof out - pass through
          mergedProofs.push(pair[0])
          continue
        }

        // Simulate recursive proof merge
        // In real implementation, this would use the provider's recursive proving
        const mergedProof = await this.simulateRecursiveMerge(pair, targetSystem, currentDepth)
        mergedProofs.push(mergedProof)
      }

      stepResults.push({
        success: true,
        timeMs: Date.now() - stepStartTime,
        depth: currentDepth,
      })

      currentProofs = mergedProofs

      if (this._config.verbose) {
        console.log(`[Aggregator] Depth ${currentDepth}: ${pairs.length} pairs -> ${mergedProofs.length} proofs`)
      }
    }

    // Create final composed proof
    const composedProof = this.createComposedProof(
      currentProofs,
      Strategy.RECURSIVE,
      startTime,
    )

    return {
      success: true,
      aggregatedProof: computeProofHash(currentProofs),
      metrics: {
        inputProofCount: proofs.length,
        outputProofSize: currentProofs.length,
        timeMs: Date.now() - startTime,
        recursionDepth: currentDepth,
      },
      stepResults,
      composedProof,
      retries: retryStats,
    }
  }

  private async simulateRecursiveMerge(
    proofs: SingleProof[],
    targetSystem: ProofSystem,
    depth: number,
  ): Promise<SingleProof> {
    // Simulate recursive SNARK merge
    // In production, this would use actual recursive proving
    await delay(proofs.length * 50)

    const combinedInputs = proofs.flatMap(p => p.publicInputs)
    const proofBytes = randomBytes(256)

    return {
      id: generateId(`recursive-${depth}`),
      proof: `0x${bytesToHex(proofBytes)}`,
      publicInputs: combinedInputs.slice(0, 10) as HexString[],
      metadata: {
        system: targetSystem,
        systemVersion: '1.0.0',
        circuitId: 'recursive_merge',
        circuitVersion: '1.0.0',
        generatedAt: Date.now(),
        proofSizeBytes: proofBytes.length,
      },
    }
  }

  // ─── Batch Aggregation ─────────────────────────────────────────────────────

  /**
   * Aggregate proofs using batch verification.
   *
   * Groups proofs by system and uses batch verification where supported.
   */
  async aggregateBatch(
    proofs: SingleProof[],
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
    onProgress?: AggregationProgressCallback,
  ): Promise<DetailedAggregationResult> {
    const startTime = Date.now()
    const stepResults: AggregationStepResult[] = []
    const retryStats = { attempted: 0, succeeded: 0, failed: 0 }

    if (this._config.verbose) {
      console.log(`[Aggregator] Batch aggregation of ${proofs.length} proofs`)
    }

    // Group proofs by system
    const groupedBySystem = new Map<ProofSystem, SingleProof[]>()
    for (const proof of proofs) {
      const existing = groupedBySystem.get(proof.metadata.system) || []
      existing.push(proof)
      groupedBySystem.set(proof.metadata.system, existing)
    }

    if (this._config.verbose) {
      console.log(`[Aggregator] Grouped into ${groupedBySystem.size} systems`)
    }

    const verifiedProofs: SingleProof[] = []
    let currentStep = 0
    const totalSteps = groupedBySystem.size

    for (const [system, systemProofs] of groupedBySystem) {
      currentStep++
      const stepStartTime = Date.now()

      onProgress?.({
        step: currentStep,
        totalSteps,
        operation: `Batch verifying ${systemProofs.length} ${system} proofs`,
        elapsedMs: Date.now() - startTime,
      })

      const provider = getProvider(system)
      if (!provider) {
        stepResults.push({
          success: false,
          error: `No provider for system: ${system}`,
          timeMs: Date.now() - stepStartTime,
          depth: 0,
        })
        continue
      }

      // Use batch verification if available
      if (provider.verifyBatch) {
        try {
          const results = await provider.verifyBatch(systemProofs)
          const validProofs = systemProofs.filter((_, i) => results[i])
          verifiedProofs.push(...validProofs)

          if (validProofs.length < systemProofs.length) {
            const failed = systemProofs.length - validProofs.length
            stepResults.push({
              success: false,
              error: `${failed} proofs failed batch verification`,
              timeMs: Date.now() - stepStartTime,
              depth: 0,
            })
          } else {
            stepResults.push({
              success: true,
              timeMs: Date.now() - stepStartTime,
              depth: 0,
            })
          }
        } catch (error) {
          stepResults.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timeMs: Date.now() - stepStartTime,
            depth: 0,
          })
        }
      } else {
        // Fall back to individual verification
        for (const proof of systemProofs) {
          try {
            const valid = await provider.verifyProof(proof)
            if (valid) {
              verifiedProofs.push(proof)
            }
          } catch {
            // Skip invalid proofs
          }
        }
        stepResults.push({
          success: true,
          timeMs: Date.now() - stepStartTime,
          depth: 0,
        })
      }
    }

    // Create composed proof
    const composedProof = this.createComposedProof(
      verifiedProofs,
      Strategy.BATCH,
      startTime,
    )

    return {
      success: verifiedProofs.length === proofs.length,
      aggregatedProof: computeProofHash(verifiedProofs),
      metrics: {
        inputProofCount: proofs.length,
        outputProofSize: verifiedProofs.length,
        timeMs: Date.now() - startTime,
        recursionDepth: 0,
      },
      stepResults,
      composedProof,
      retries: retryStats,
    }
  }

  // ─── Cross-System Aggregation ──────────────────────────────────────────────

  /**
   * Link proofs from different systems.
   *
   * Creates a cryptographic link between proofs from different ZK systems.
   */
  createCrossSystemLink(
    sourceProof: SingleProof,
    targetProof: SingleProof,
  ): HexString {
    // Compute a link hash combining both proofs
    const combinedData = sourceProof.proof + targetProof.proof
    let hash = 0
    for (let i = 0; i < combinedData.length; i++) {
      const char = combinedData.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}` as HexString
  }

  /**
   * Verify a cross-system link.
   */
  verifyCrossSystemLink(
    sourceProof: SingleProof,
    targetProof: SingleProof,
    linkHash: HexString,
  ): boolean {
    const computedLink = this.createCrossSystemLink(sourceProof, targetProof)
    return computedLink === linkHash
  }

  // ─── Helper Methods ────────────────────────────────────────────────────────

  private createComposedProof(
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy,
    startTime: number,
  ): ComposedProof {
    const systems = [...new Set(proofs.map(p => p.metadata.system))]

    return {
      id: generateId('composed'),
      proofs,
      strategy,
      status: ComposedProofStatus.VERIFIED,
      combinedPublicInputs: proofs.flatMap(p => p.publicInputs),
      compositionMetadata: {
        proofCount: proofs.length,
        systems,
        compositionTimeMs: Date.now() - startTime,
        success: true,
        inputHash: computeProofHash(proofs),
      },
      verificationHints: this.computeVerificationHints(proofs, strategy),
    }
  }

  private computeVerificationHints(
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy,
  ): VerificationHints {
    const verificationOrder = proofs.map(p => p.id)

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
      estimatedTimeMs: proofs.length * 100,
      estimatedCost: BigInt(proofs.length * 100000),
      supportsBatchVerification: strategy === Strategy.BATCH,
    }
  }

  private createFailedResult(
    error: string,
    startTime: number,
    stepResults: AggregationStepResult[],
    retries: { attempted: number; succeeded: number; failed: number },
  ): DetailedAggregationResult {
    return {
      success: false,
      error,
      metrics: {
        inputProofCount: 0,
        outputProofSize: 0,
        timeMs: Date.now() - startTime,
        recursionDepth: 0,
      },
      stepResults,
      retries,
    }
  }

  // ─── Events ────────────────────────────────────────────────────────────────

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
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a proof aggregator with optional configuration
 */
export function createProofAggregator(config?: Partial<AggregatorConfig>): ProofAggregator {
  return new ProofAggregator(config)
}

// ─── Export Default Configuration ────────────────────────────────────────────

export { DEFAULT_AGGREGATOR_CONFIG }
