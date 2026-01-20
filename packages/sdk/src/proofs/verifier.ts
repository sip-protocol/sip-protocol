/**
 * Proof Verification Pipeline
 *
 * Implements a verification pipeline for composed proofs from multiple ZK systems.
 * Handles verification ordering, cross-validation of proof linkages, and provides
 * detailed verification results.
 *
 * Key features:
 * - Multi-provider verification routing
 * - Dependency-based verification ordering
 * - Cross-proof link validation
 * - Batch verification optimization
 * - Verification proof generation
 * - Caching for repeated verifications
 *
 * @packageDocumentation
 */

import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import type {
  ProofSystem,
  SingleProof,
  ComposedProof,
  VerificationResult,
  IndividualVerificationResult,
  HexString,
} from '@sip-protocol/types'

import type { ComposableProofProvider } from './composer/interface'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Configuration for the verification pipeline
 */
export interface VerificationPipelineConfig {
  /** Enable parallel verification where possible */
  enableParallel: boolean
  /** Maximum concurrent verifications */
  maxConcurrent: number
  /** Enable batch verification for same-system proofs */
  enableBatch: boolean
  /** Timeout for individual verification (ms) */
  verificationTimeoutMs: number
  /** Enable verification caching */
  enableCache: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs: number
  /** Enable verbose logging */
  verbose: boolean
  /** Strict mode - fail fast on first error */
  strictMode: boolean
  /** Generate verification proof */
  generateVerificationProof: boolean
}

/**
 * Proof dependency graph node
 */
export interface ProofDependency {
  /** Proof ID */
  proofId: string
  /** IDs of proofs this depends on */
  dependsOn: string[]
  /** IDs of proofs that depend on this */
  dependedBy: string[]
  /** Link hash connecting to previous proof */
  linkHash?: HexString
}

/**
 * Verification order computed from dependency analysis
 */
export interface VerificationOrder {
  /** Ordered list of proof IDs to verify */
  order: string[]
  /** Groups that can be verified in parallel */
  parallelGroups: string[][]
  /** Dependency graph */
  dependencies: Map<string, ProofDependency>
  /** Estimated total time */
  estimatedTimeMs: number
}

/**
 * Detailed verification result
 */
export interface DetailedVerificationResult extends VerificationResult {
  /** Verification order used */
  verificationOrder: string[]
  /** Cross-link validation results */
  linkValidation: LinkValidationResult[]
  /** Verification proof (if generated) */
  verificationProof?: HexString
  /** Cache hit information */
  cacheStats: {
    hits: number
    misses: number
  }
  /** Per-system verification stats */
  systemStats: Map<ProofSystem, SystemVerificationStats>
}

/**
 * Result of validating a cross-proof link
 */
export interface LinkValidationResult {
  /** Source proof ID */
  sourceProofId: string
  /** Target proof ID */
  targetProofId: string
  /** Expected link hash */
  expectedHash: HexString
  /** Computed link hash */
  computedHash: HexString
  /** Whether link is valid */
  valid: boolean
}

/**
 * Statistics for a proof system's verification
 */
export interface SystemVerificationStats {
  /** Number of proofs verified */
  proofsVerified: number
  /** Number of successful verifications */
  successCount: number
  /** Number of failed verifications */
  failCount: number
  /** Total verification time */
  totalTimeMs: number
  /** Average verification time */
  avgTimeMs: number
  /** Whether batch verification was used */
  usedBatch: boolean
}

/**
 * Progress event for verification
 */
export interface VerificationProgressEvent {
  /** Current step */
  step: number
  /** Total steps */
  totalSteps: number
  /** Operation description */
  operation: string
  /** Proof being verified (if applicable) */
  proofId?: string
  /** Time elapsed */
  elapsedMs: number
}

/**
 * Callback for verification progress
 */
export type VerificationProgressCallback = (event: VerificationProgressEvent) => void

/**
 * Options for pipeline verification
 */
export interface VerifyOptions {
  /** Provider lookup function */
  getProvider: (system: ProofSystem) => ComposableProofProvider | undefined
  /** Progress callback */
  onProgress?: VerificationProgressCallback
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Override config options */
  config?: Partial<VerificationPipelineConfig>
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_PIPELINE_CONFIG: VerificationPipelineConfig = {
  enableParallel: true,
  maxConcurrent: 4,
  enableBatch: true,
  verificationTimeoutMs: 30000,
  enableCache: true,
  cacheTtlMs: 300000, // 5 minutes
  verbose: false,
  strictMode: false,
  generateVerificationProof: false,
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${bytesToHex(randomBytes(8))}`
}

/**
 * Compute hash for cross-proof link validation
 */
function computeLinkHash(sourceProof: SingleProof, targetProof: SingleProof): HexString {
  const combinedData = sourceProof.proof + targetProof.proof
  let hash = 0
  for (let i = 0; i < combinedData.length; i++) {
    const char = combinedData.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}` as HexString
}


// ─── Verification Pipeline ───────────────────────────────────────────────────

/**
 * Verification Pipeline
 *
 * Orchestrates verification of composed proofs from multiple ZK systems.
 *
 * @example
 * ```typescript
 * const pipeline = new VerificationPipeline()
 *
 * const result = await pipeline.verify(composedProof, {
 *   getProvider: (system) => composer.getProviderForSystem(system),
 *   onProgress: (event) => console.log(event.operation),
 * })
 *
 * if (result.valid) {
 *   console.log('All proofs verified!')
 * }
 * ```
 */
export class VerificationPipeline {
  private _config: VerificationPipelineConfig
  private _cache: Map<string, { valid: boolean; expiresAt: number }> = new Map()
  private _cacheHits = 0
  private _cacheMisses = 0

  constructor(config?: Partial<VerificationPipelineConfig>) {
    this._config = { ...DEFAULT_PIPELINE_CONFIG, ...config }
  }

  // ─── Configuration ─────────────────────────────────────────────────────────

  get config(): VerificationPipelineConfig {
    return { ...this._config }
  }

  updateConfig(config: Partial<VerificationPipelineConfig>): void {
    this._config = { ...this._config, ...config }
  }

  // ─── Main Verification ─────────────────────────────────────────────────────

  /**
   * Verify a composed proof
   */
  async verify(
    composedProof: ComposedProof,
    options: VerifyOptions,
  ): Promise<DetailedVerificationResult> {
    const startTime = Date.now()
    const config = { ...this._config, ...options.config }
    const { getProvider, onProgress, abortSignal } = options

    if (config.verbose) {
      console.log(`[VerificationPipeline] Starting verification of ${composedProof.proofs.length} proofs`)
    }

    // Build dependency graph and compute verification order
    const verificationOrder = this.computeVerificationOrder(composedProof)

    // Initialize stats
    const systemStats = new Map<ProofSystem, SystemVerificationStats>()
    const results: IndividualVerificationResult[] = []
    const linkValidation: LinkValidationResult[] = []

    // Verify proofs based on computed order
    if (config.enableParallel && verificationOrder.parallelGroups.length > 0) {
      // Parallel verification with dependency ordering
      await this.verifyParallel(
        composedProof,
        verificationOrder,
        config,
        getProvider,
        results,
        systemStats,
        onProgress,
        abortSignal,
        startTime,
      )
    } else {
      // Sequential verification
      await this.verifySequential(
        composedProof,
        verificationOrder.order,
        config,
        getProvider,
        results,
        systemStats,
        onProgress,
        abortSignal,
        startTime,
      )
    }

    // Validate cross-proof links
    if (composedProof.proofs.length > 1) {
      await this.validateLinks(composedProof, linkValidation, config)
    }

    // Check for abort
    if (abortSignal?.aborted) {
      return this.createAbortedResult(startTime, results, linkValidation, systemStats)
    }

    // Compute overall validity
    const allProofsValid = results.every(r => r.valid)
    const allLinksValid = linkValidation.every(l => l.valid)
    const valid = allProofsValid && allLinksValid

    // Generate verification proof if requested
    let verificationProof: HexString | undefined
    if (config.generateVerificationProof && valid) {
      verificationProof = await this.generateVerificationProof(composedProof, results)
    }

    const totalTime = Date.now() - startTime

    if (config.verbose) {
      console.log(`[VerificationPipeline] Verification complete: valid=${valid}, time=${totalTime}ms`)
    }

    return {
      valid,
      results,
      totalTimeMs: totalTime,
      method: config.enableBatch ? 'batch' : (config.enableParallel ? 'individual' : 'individual'),
      verificationOrder: verificationOrder.order,
      linkValidation,
      verificationProof,
      cacheStats: {
        hits: this._cacheHits,
        misses: this._cacheMisses,
      },
      systemStats,
    }
  }

  /**
   * Verify a single proof
   */
  async verifySingle(
    proof: SingleProof,
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
  ): Promise<IndividualVerificationResult> {
    const startTime = Date.now()

    // Check cache
    if (this._config.enableCache) {
      const cached = this._cache.get(proof.id)
      if (cached && cached.expiresAt > Date.now()) {
        this._cacheHits++
        return {
          proofId: proof.id,
          valid: cached.valid,
          timeMs: Date.now() - startTime,
        }
      }
      this._cacheMisses++
    }

    const provider = getProvider(proof.metadata.system)
    if (!provider) {
      return {
        proofId: proof.id,
        valid: false,
        timeMs: Date.now() - startTime,
        error: `No provider for system: ${proof.metadata.system}`,
      }
    }

    try {
      const valid = await provider.verifyProof(proof)

      // Update cache
      if (this._config.enableCache) {
        this._cache.set(proof.id, {
          valid,
          expiresAt: Date.now() + this._config.cacheTtlMs,
        })
      }

      return {
        proofId: proof.id,
        valid,
        timeMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        proofId: proof.id,
        valid: false,
        timeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Batch verify proofs from the same system
   */
  async verifyBatch(
    proofs: SingleProof[],
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
  ): Promise<IndividualVerificationResult[]> {
    if (proofs.length === 0) return []

    const system = proofs[0].metadata.system
    const provider = getProvider(system)

    if (!provider) {
      return proofs.map(p => ({
        proofId: p.id,
        valid: false,
        timeMs: 0,
        error: `No provider for system: ${system}`,
      }))
    }

    const startTime = Date.now()

    // Use batch verification if available
    if (provider.verifyBatch) {
      try {
        const batchResults = await provider.verifyBatch(proofs)
        const timePerProof = (Date.now() - startTime) / proofs.length

        return proofs.map((proof, i) => {
          // Update cache
          if (this._config.enableCache) {
            this._cache.set(proof.id, {
              valid: batchResults[i],
              expiresAt: Date.now() + this._config.cacheTtlMs,
            })
          }

          return {
            proofId: proof.id,
            valid: batchResults[i],
            timeMs: timePerProof,
          }
        })
      } catch (error) {
        // Fall back to individual verification
        return this.verifyIndividually(proofs, getProvider)
      }
    }

    // Fall back to individual verification
    return this.verifyIndividually(proofs, getProvider)
  }

  // ─── Verification Ordering ─────────────────────────────────────────────────

  /**
   * Compute optimal verification order based on proof dependencies
   */
  computeVerificationOrder(composedProof: ComposedProof): VerificationOrder {
    const proofs = composedProof.proofs
    const dependencies = new Map<string, ProofDependency>()

    // Build dependency graph
    for (let i = 0; i < proofs.length; i++) {
      const proof = proofs[i]
      const proofWithLink = proof as SingleProof & { linkHash?: HexString }

      dependencies.set(proof.id, {
        proofId: proof.id,
        dependsOn: i > 0 ? [proofs[i - 1].id] : [], // Sequential dependency
        dependedBy: i < proofs.length - 1 ? [proofs[i + 1].id] : [],
        linkHash: proofWithLink.linkHash,
      })
    }

    // Use hints if available
    if (composedProof.verificationHints) {
      const hints = composedProof.verificationHints
      return {
        order: hints.verificationOrder,
        parallelGroups: hints.parallelGroups,
        dependencies,
        estimatedTimeMs: hints.estimatedTimeMs,
      }
    }

    // Compute optimal order using topological sort
    const order = this.topologicalSort(dependencies)

    // Identify parallel groups (proofs with no dependencies on each other)
    const parallelGroups = this.identifyParallelGroups(dependencies, order)

    // Estimate time
    const estimatedTimeMs = proofs.length * 100 // Rough estimate

    return {
      order,
      parallelGroups,
      dependencies,
      estimatedTimeMs,
    }
  }

  private topologicalSort(dependencies: Map<string, ProofDependency>): string[] {
    const visited = new Set<string>()
    const result: string[] = []

    const visit = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)

      const dep = dependencies.get(id)
      if (dep) {
        for (const depId of dep.dependsOn) {
          visit(depId)
        }
      }

      result.push(id)
    }

    for (const id of dependencies.keys()) {
      visit(id)
    }

    return result
  }

  private identifyParallelGroups(
    _dependencies: Map<string, ProofDependency>,
    order: string[],
  ): string[][] {
    // Group proofs into chunks for parallel verification
    // In a more sophisticated implementation, we'd analyze the DAG for true independence
    // For now, return groups based on order chunks
    const groups: string[][] = []
    let currentGroup: string[] = []

    for (const id of order) {
      currentGroup.push(id)
      if (currentGroup.length >= 4) {
        groups.push([...currentGroup])
        currentGroup = []
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }

  // ─── Private Verification Methods ──────────────────────────────────────────

  private async verifySequential(
    composedProof: ComposedProof,
    order: string[],
    config: VerificationPipelineConfig,
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
    results: IndividualVerificationResult[],
    systemStats: Map<ProofSystem, SystemVerificationStats>,
    onProgress?: VerificationProgressCallback,
    abortSignal?: AbortSignal,
    startTime?: number,
  ): Promise<void> {
    const proofMap = new Map(composedProof.proofs.map(p => [p.id, p]))

    for (let i = 0; i < order.length; i++) {
      if (abortSignal?.aborted) return

      const proofId = order[i]
      const proof = proofMap.get(proofId)

      if (!proof) {
        results.push({
          proofId,
          valid: false,
          timeMs: 0,
          error: 'Proof not found',
        })
        continue
      }

      onProgress?.({
        step: i + 1,
        totalSteps: order.length,
        operation: `Verifying proof ${i + 1}/${order.length}`,
        proofId,
        elapsedMs: Date.now() - (startTime || Date.now()),
      })

      const result = await this.verifySingle(proof, getProvider)
      results.push(result)

      // Update system stats
      this.updateSystemStats(systemStats, proof.metadata.system, result, false)

      // Strict mode - fail fast
      if (config.strictMode && !result.valid) {
        return
      }
    }
  }

  private async verifyParallel(
    composedProof: ComposedProof,
    verificationOrder: VerificationOrder,
    config: VerificationPipelineConfig,
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
    results: IndividualVerificationResult[],
    systemStats: Map<ProofSystem, SystemVerificationStats>,
    onProgress?: VerificationProgressCallback,
    abortSignal?: AbortSignal,
    startTime?: number,
  ): Promise<void> {
    const proofMap = new Map(composedProof.proofs.map(p => [p.id, p]))
    const resultMap = new Map<string, IndividualVerificationResult>()

    // Process groups in order (groups can be verified in parallel)
    for (let groupIdx = 0; groupIdx < verificationOrder.parallelGroups.length; groupIdx++) {
      if (abortSignal?.aborted) break

      const group = verificationOrder.parallelGroups[groupIdx]

      onProgress?.({
        step: groupIdx + 1,
        totalSteps: verificationOrder.parallelGroups.length,
        operation: `Verifying group ${groupIdx + 1}/${verificationOrder.parallelGroups.length} (${group.length} proofs)`,
        elapsedMs: Date.now() - (startTime || Date.now()),
      })

      // Group proofs by system for batch verification
      if (config.enableBatch) {
        const systemProofs = new Map<ProofSystem, SingleProof[]>()

        for (const proofId of group) {
          const proof = proofMap.get(proofId)
          if (!proof) continue

          const existing = systemProofs.get(proof.metadata.system) || []
          existing.push(proof)
          systemProofs.set(proof.metadata.system, existing)
        }

        // Batch verify each system's proofs
        const batchPromises: Promise<IndividualVerificationResult[]>[] = []

        for (const [, proofs] of systemProofs) {
          batchPromises.push(this.verifyBatch(proofs, getProvider))
        }

        const batchResults = await Promise.all(batchPromises)

        for (const batchResult of batchResults) {
          for (const result of batchResult) {
            resultMap.set(result.proofId, result)

            const proof = proofMap.get(result.proofId)
            if (proof) {
              this.updateSystemStats(systemStats, proof.metadata.system, result, true)
            }
          }
        }
      } else {
        // Parallel individual verification
        const proofs = group.map(id => proofMap.get(id)).filter(Boolean) as SingleProof[]
        const promises = proofs.map(proof => this.verifySingle(proof, getProvider))

        const groupResults = await Promise.all(promises)

        for (const result of groupResults) {
          resultMap.set(result.proofId, result)

          const proof = proofMap.get(result.proofId)
          if (proof) {
            this.updateSystemStats(systemStats, proof.metadata.system, result, false)
          }
        }
      }
    }

    // Collect results in order
    for (const proofId of verificationOrder.order) {
      const result = resultMap.get(proofId)
      if (result) {
        results.push(result)
      }
    }
  }

  private async verifyIndividually(
    proofs: SingleProof[],
    getProvider: (system: ProofSystem) => ComposableProofProvider | undefined,
  ): Promise<IndividualVerificationResult[]> {
    const results: IndividualVerificationResult[] = []

    for (const proof of proofs) {
      results.push(await this.verifySingle(proof, getProvider))
    }

    return results
  }

  // ─── Link Validation ───────────────────────────────────────────────────────

  private async validateLinks(
    composedProof: ComposedProof,
    linkValidation: LinkValidationResult[],
    config: VerificationPipelineConfig,
  ): Promise<void> {
    const proofs = composedProof.proofs

    for (let i = 1; i < proofs.length; i++) {
      const sourceProof = proofs[i - 1]
      const targetProof = proofs[i]
      const proofWithLink = targetProof as SingleProof & { linkHash?: HexString }

      if (proofWithLink.linkHash) {
        const computedHash = computeLinkHash(sourceProof, targetProof)
        const valid = computedHash === proofWithLink.linkHash

        linkValidation.push({
          sourceProofId: sourceProof.id,
          targetProofId: targetProof.id,
          expectedHash: proofWithLink.linkHash,
          computedHash,
          valid,
        })

        if (config.verbose && !valid) {
          console.warn(`[VerificationPipeline] Link validation failed: ${sourceProof.id} -> ${targetProof.id}`)
        }
      }
    }
  }

  // ─── Verification Proof Generation ─────────────────────────────────────────

  private async generateVerificationProof(
    composedProof: ComposedProof,
    results: IndividualVerificationResult[],
  ): Promise<HexString> {
    // Generate a proof attesting that verification succeeded
    // In production, this would use a ZK circuit to prove verification

    const validProofIds = results.filter(r => r.valid).map(r => r.proofId)
    const timestamp = Date.now()

    // Create verification attestation
    const attestation = {
      composedProofId: composedProof.id,
      validProofIds,
      timestamp,
      verifierId: generateId('verifier'),
    }

    // Simple hash-based proof (in production, use actual ZK proof)
    const data = JSON.stringify(attestation)
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i)
      hash = hash & hash
    }

    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}` as HexString
  }

  // ─── Stats and Cache ───────────────────────────────────────────────────────

  private updateSystemStats(
    stats: Map<ProofSystem, SystemVerificationStats>,
    system: ProofSystem,
    result: IndividualVerificationResult,
    usedBatch: boolean,
  ): void {
    const existing = stats.get(system) || {
      proofsVerified: 0,
      successCount: 0,
      failCount: 0,
      totalTimeMs: 0,
      avgTimeMs: 0,
      usedBatch: false,
    }

    existing.proofsVerified++
    if (result.valid) {
      existing.successCount++
    } else {
      existing.failCount++
    }
    existing.totalTimeMs += result.timeMs
    existing.avgTimeMs = existing.totalTimeMs / existing.proofsVerified
    existing.usedBatch = existing.usedBatch || usedBatch

    stats.set(system, existing)
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this._cache.clear()
    this._cacheHits = 0
    this._cacheMisses = 0
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this._cacheHits + this._cacheMisses
    return {
      size: this._cache.size,
      hits: this._cacheHits,
      misses: this._cacheMisses,
      hitRate: total > 0 ? this._cacheHits / total : 0,
    }
  }

  // ─── Result Helpers ────────────────────────────────────────────────────────

  private createAbortedResult(
    startTime: number,
    results: IndividualVerificationResult[],
    linkValidation: LinkValidationResult[],
    systemStats: Map<ProofSystem, SystemVerificationStats>,
  ): DetailedVerificationResult {
    return {
      valid: false,
      results,
      totalTimeMs: Date.now() - startTime,
      method: 'individual',
      verificationOrder: [],
      linkValidation,
      cacheStats: {
        hits: this._cacheHits,
        misses: this._cacheMisses,
      },
      systemStats,
    }
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a verification pipeline with optional configuration
 */
export function createVerificationPipeline(
  config?: Partial<VerificationPipelineConfig>,
): VerificationPipeline {
  return new VerificationPipeline(config)
}

// ─── Export Default Config ───────────────────────────────────────────────────

export { DEFAULT_PIPELINE_CONFIG }
