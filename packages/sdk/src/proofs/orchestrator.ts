/**
 * Proof Composition Orchestrator
 *
 * High-level orchestrator that manages the entire proof composition workflow.
 * Coordinates providers, manages state, handles the composition lifecycle,
 * and provides retry logic with exponential backoff.
 *
 * Key features:
 * - Composition planning (determine which proofs needed)
 * - Provider selection and initialization
 * - Composition state machine
 * - Timeout and cancellation handling
 * - Retry logic with exponential backoff
 * - Composition audit logging
 * - Composition templates for common patterns
 * - Dry-run/preview support
 *
 * @packageDocumentation
 */

import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import type {
  ProofSystem,
  SingleProof,
  ComposedProof,
  ProofAggregationStrategy,
  HexString,
} from '@sip-protocol/types'

import {
  ProofAggregationStrategy as Strategy,
  ComposedProofStatus,
} from '@sip-protocol/types'

import type { ComposableProofProvider } from './composer/interface'
import type { ProofGenerationRequest } from './composer/types'
import { CrossSystemValidator } from './validator'
import type { ValidationReport } from './validator'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Maximum retries for failed operations */
  maxRetries: number
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: number
  /** Maximum delay between retries (ms) */
  maxDelayMs: number
  /** Overall composition timeout (ms) */
  timeoutMs: number
  /** Enable audit logging */
  enableAuditLog: boolean
  /** Enable dry-run mode by default */
  dryRunDefault: boolean
  /** Validate proofs before composition */
  validateBeforeCompose: boolean
  /** Strict validation mode */
  strictValidation: boolean
  /** Enable parallel provider initialization */
  parallelInit: boolean
}

/**
 * Composition state
 */
export type CompositionState =
  | 'idle'
  | 'planning'
  | 'initializing'
  | 'generating'
  | 'composing'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Composition plan
 */
export interface CompositionPlan {
  /** Unique plan ID */
  id: string
  /** Proofs to generate */
  proofRequests: ProofGenerationRequest[]
  /** Providers needed */
  requiredProviders: ProofSystem[]
  /** Aggregation strategy */
  strategy: ProofAggregationStrategy
  /** Estimated total time (ms) */
  estimatedTimeMs: number
  /** Whether plan is valid */
  valid: boolean
  /** Validation errors if any */
  errors: string[]
  /** Recommendations */
  recommendations: string[]
}

/**
 * Composition request
 */
export interface CompositionRequest {
  /** Proof generation requests */
  proofs: ProofGenerationRequest[]
  /** Aggregation strategy (default: SEQUENTIAL) */
  strategy?: ProofAggregationStrategy
  /** Custom timeout for this request */
  timeoutMs?: number
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Dry-run mode (plan without executing) */
  dryRun?: boolean
  /** Use template */
  template?: string
  /** Template parameters */
  templateParams?: Record<string, unknown>
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Orchestrator execution result
 */
export interface OrchestratorResult {
  /** Whether composition succeeded */
  success: boolean
  /** Composed proof (if successful) */
  composedProof?: ComposedProof
  /** Error message (if failed) */
  error?: string
  /** Final state */
  state: CompositionState
  /** Time taken (ms) */
  timeMs: number
  /** Number of retries */
  retries: number
  /** Validation report */
  validationReport?: ValidationReport
  /** Audit log entries */
  auditLog: AuditLogEntry[]
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Timestamp */
  timestamp: number
  /** Event type */
  event: string
  /** Event details */
  details: Record<string, unknown>
  /** Duration (ms) if applicable */
  durationMs?: number
}

/**
 * Progress event
 */
export interface OrchestratorProgressEvent {
  /** Current state */
  state: CompositionState
  /** Progress percentage (0-100) */
  progress: number
  /** Current operation */
  operation: string
  /** Time elapsed (ms) */
  elapsedMs: number
  /** Estimated remaining time (ms) */
  estimatedRemainingMs?: number
}

/**
 * Progress callback
 */
export type OrchestratorProgressCallback = (event: OrchestratorProgressEvent) => void

/**
 * Composition template
 */
export interface CompositionTemplate {
  /** Template ID */
  id: string
  /** Template name */
  name: string
  /** Description */
  description: string
  /** Required proof types */
  requiredProofs: {
    circuitId: string
    system?: ProofSystem
    required: boolean
  }[]
  /** Default strategy */
  defaultStrategy: ProofAggregationStrategy
  /** Parameter schema */
  parameterSchema?: Record<string, unknown>
}

// ─── Default Configuration ───────────────────────────────────────────────────

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 300000, // 5 minutes
  enableAuditLog: true,
  dryRunDefault: false,
  validateBeforeCompose: true,
  strictValidation: false,
  parallelInit: true,
}

// ─── Built-in Templates ──────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: CompositionTemplate[] = [
  {
    id: 'shielded-transfer',
    name: 'Shielded Transfer',
    description: 'Standard shielded transfer with funding and validity proofs',
    requiredProofs: [
      { circuitId: 'funding_proof', required: true },
      { circuitId: 'validity_proof', required: true },
    ],
    defaultStrategy: Strategy.SEQUENTIAL,
  },
  {
    id: 'compliant-transfer',
    name: 'Compliant Transfer',
    description: 'Shielded transfer with compliance proof for regulated transfers',
    requiredProofs: [
      { circuitId: 'funding_proof', required: true },
      { circuitId: 'validity_proof', required: true },
      { circuitId: 'compliance_proof', required: true },
    ],
    defaultStrategy: Strategy.SEQUENTIAL,
  },
  {
    id: 'multi-chain-bridge',
    name: 'Multi-Chain Bridge',
    description: 'Cross-chain proof composition for bridge transfers',
    requiredProofs: [
      { circuitId: 'source_chain_proof', required: true },
      { circuitId: 'bridge_proof', required: true },
      { circuitId: 'destination_chain_proof', required: true },
    ],
    defaultStrategy: Strategy.SEQUENTIAL,
  },
  {
    id: 'batch-verification',
    name: 'Batch Verification',
    description: 'Batch multiple proofs for efficient verification',
    requiredProofs: [],
    defaultStrategy: Strategy.BATCH,
  },
]

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${bytesToHex(randomBytes(8))}`
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

// ─── Proof Orchestrator ──────────────────────────────────────────────────────

/**
 * ProofOrchestrator
 *
 * High-level orchestrator for proof composition workflows.
 *
 * @example
 * ```typescript
 * const orchestrator = new ProofOrchestrator()
 *
 * // Register providers
 * orchestrator.registerProvider(noirProvider)
 * orchestrator.registerProvider(halo2Provider)
 *
 * // Plan composition
 * const plan = await orchestrator.plan({
 *   proofs: [
 *     { circuitId: 'funding_proof', ... },
 *     { circuitId: 'validity_proof', ... },
 *   ],
 *   strategy: ProofAggregationStrategy.SEQUENTIAL,
 * })
 *
 * // Execute composition
 * const result = await orchestrator.execute({
 *   proofs: [...],
 *   onProgress: (event) => console.log(event),
 * })
 * ```
 */
export class ProofOrchestrator {
  private _config: OrchestratorConfig
  private _providers: Map<ProofSystem, ComposableProofProvider> = new Map()
  private _templates: Map<string, CompositionTemplate> = new Map()
  private _validator: CrossSystemValidator
  private _state: CompositionState = 'idle'
  private _auditLog: AuditLogEntry[] = []
  private _currentAbortController?: AbortController

  constructor(config?: Partial<OrchestratorConfig>) {
    this._config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config }
    this._validator = new CrossSystemValidator({
      strictMode: this._config.strictValidation,
    })

    // Register built-in templates
    for (const template of BUILTIN_TEMPLATES) {
      this._templates.set(template.id, template)
    }
  }

  // ─── Configuration ─────────────────────────────────────────────────────────

  get config(): OrchestratorConfig {
    return { ...this._config }
  }

  get state(): CompositionState {
    return this._state
  }

  updateConfig(config: Partial<OrchestratorConfig>): void {
    this._config = { ...this._config, ...config }
  }

  // ─── Provider Management ───────────────────────────────────────────────────

  registerProvider(provider: ComposableProofProvider): void {
    this._providers.set(provider.system, provider)
    this._log('provider_registered', { system: provider.system })
  }

  unregisterProvider(system: ProofSystem): boolean {
    const removed = this._providers.delete(system)
    if (removed) {
      this._log('provider_unregistered', { system })
    }
    return removed
  }

  getProvider(system: ProofSystem): ComposableProofProvider | undefined {
    return this._providers.get(system)
  }

  getAvailableSystems(): ProofSystem[] {
    return Array.from(this._providers.keys())
  }

  // ─── Template Management ───────────────────────────────────────────────────

  registerTemplate(template: CompositionTemplate): void {
    this._templates.set(template.id, template)
    this._log('template_registered', { templateId: template.id })
  }

  getTemplate(id: string): CompositionTemplate | undefined {
    return this._templates.get(id)
  }

  getTemplates(): CompositionTemplate[] {
    return Array.from(this._templates.values())
  }

  // ─── Planning ──────────────────────────────────────────────────────────────

  /**
   * Create a composition plan without executing
   */
  async plan(request: CompositionRequest): Promise<CompositionPlan> {
    const startTime = Date.now()
    this._setState('planning')

    const planId = generateId('plan')
    const errors: string[] = []
    const recommendations: string[] = []

    // Apply template if specified
    const proofRequests = [...request.proofs]
    let strategy = request.strategy || Strategy.SEQUENTIAL

    if (request.template) {
      const template = this._templates.get(request.template)
      if (!template) {
        errors.push(`Template '${request.template}' not found`)
      } else {
        strategy = template.defaultStrategy
        // Merge template requirements with provided proofs
        for (const req of template.requiredProofs) {
          const hasProof = proofRequests.some(p => p.circuitId === req.circuitId)
          if (!hasProof && req.required) {
            errors.push(`Required proof '${req.circuitId}' from template not provided`)
          }
        }
      }
    }

    // Determine required providers
    const requiredProviders = new Set<ProofSystem>()
    for (const proof of proofRequests) {
      const system = proof.system || this._inferSystem(proof.circuitId)
      if (system) {
        requiredProviders.add(system)
      } else {
        errors.push(`Cannot determine system for circuit '${proof.circuitId}'`)
      }
    }

    // Check provider availability
    for (const system of requiredProviders) {
      if (!this._providers.has(system)) {
        errors.push(`No provider registered for system '${system}'`)
      }
    }

    // Estimate time
    let estimatedTimeMs = 0
    for (const system of requiredProviders) {
      const provider = this._providers.get(system)
      if (provider) {
        estimatedTimeMs += provider.capabilities.maxProofSize > 0 ? 5000 : 10000
      }
    }
    estimatedTimeMs *= proofRequests.length

    // Generate recommendations
    if (proofRequests.length > 3 && strategy === Strategy.SEQUENTIAL) {
      recommendations.push('Consider using PARALLEL or BATCH strategy for better performance')
    }

    const requiredProvidersArray = Array.from(requiredProviders)
    if (requiredProvidersArray.length > 1) {
      const compatible = this._checkProviderCompatibility(requiredProvidersArray)
      if (!compatible) {
        recommendations.push('Multi-system composition detected - ensure cross-system validation')
      }
    }

    this._setState('idle')
    this._log('plan_created', {
      planId,
      proofCount: proofRequests.length,
      providers: requiredProvidersArray,
      errors: errors.length,
      timeMs: Date.now() - startTime,
    })

    return {
      id: planId,
      proofRequests,
      requiredProviders: requiredProvidersArray,
      strategy,
      estimatedTimeMs,
      valid: errors.length === 0,
      errors,
      recommendations,
    }
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Execute a composition request
   */
  async execute(
    request: CompositionRequest,
    onProgress?: OrchestratorProgressCallback,
  ): Promise<OrchestratorResult> {
    const startTime = Date.now()
    const auditLog: AuditLogEntry[] = []

    // Check for dry-run
    if (request.dryRun ?? this._config.dryRunDefault) {
      const plan = await this.plan(request)
      return {
        success: plan.valid,
        error: plan.errors.length > 0 ? plan.errors.join('; ') : undefined,
        state: 'completed',
        timeMs: Date.now() - startTime,
        retries: 0,
        auditLog,
      }
    }

    // Setup abort handling
    this._currentAbortController = new AbortController()
    const combinedSignal = request.abortSignal
      ? this._combineAbortSignals(request.abortSignal, this._currentAbortController.signal)
      : this._currentAbortController.signal

    let retries = 0
    let lastError: string | undefined

    try {
      while (retries <= this._config.maxRetries) {
        try {
          const result = await this._executeOnce(
            request,
            combinedSignal,
            onProgress,
            startTime,
            auditLog,
          )

          if (result.success) {
            return result
          }

          lastError = result.error
          retries++

          if (retries <= this._config.maxRetries) {
            const backoffDelay = computeBackoffDelay(
              retries - 1,
              this._config.baseDelayMs,
              this._config.maxDelayMs,
            )

            this._log('retry_scheduled', { attempt: retries, delayMs: backoffDelay }, auditLog)

            await delay(backoffDelay)

            if (combinedSignal.aborted) {
              return this._createCancelledResult(startTime, auditLog)
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error'
          retries++

          if (retries > this._config.maxRetries) {
            break
          }

          const backoffDelay = computeBackoffDelay(
            retries - 1,
            this._config.baseDelayMs,
            this._config.maxDelayMs,
          )

          this._log('error_retry', { error: lastError, attempt: retries, delayMs: backoffDelay }, auditLog)

          await delay(backoffDelay)

          if (combinedSignal.aborted) {
            return this._createCancelledResult(startTime, auditLog)
          }
        }
      }

      // All retries exhausted
      this._setState('failed')
      return {
        success: false,
        error: lastError || 'Max retries exceeded',
        state: 'failed',
        timeMs: Date.now() - startTime,
        retries,
        auditLog,
      }
    } finally {
      this._currentAbortController = undefined
    }
  }

  /**
   * Cancel current composition
   */
  cancel(): void {
    if (this._currentAbortController) {
      this._currentAbortController.abort()
      this._setState('cancelled')
      this._log('composition_cancelled', {})
    }
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private async _executeOnce(
    request: CompositionRequest,
    abortSignal: AbortSignal,
    onProgress?: OrchestratorProgressCallback,
    startTime?: number,
    auditLog?: AuditLogEntry[],
  ): Promise<OrchestratorResult> {
    const start = startTime || Date.now()
    const log = auditLog || []

    // Create timeout
    const timeoutMs = request.timeoutMs || this._config.timeoutMs
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Composition timeout')), timeoutMs)
    })

    try {
      // Planning phase
      this._setState('planning')
      this._reportProgress(onProgress, 'planning', 5, start)
      this._log('execution_started', { proofCount: request.proofs.length }, log)

      const plan = await this.plan(request)
      if (!plan.valid) {
        return {
          success: false,
          error: plan.errors.join('; '),
          state: 'failed',
          timeMs: Date.now() - start,
          retries: 0,
          auditLog: log,
        }
      }

      if (abortSignal.aborted) {
        return this._createCancelledResult(start, log)
      }

      // Initialize providers
      this._setState('initializing')
      this._reportProgress(onProgress, 'initializing', 15, start)
      this._log('providers_initializing', { count: plan.requiredProviders.length }, log)

      await Promise.race([
        this._initializeProviders(plan.requiredProviders),
        timeoutPromise,
      ])

      if (abortSignal.aborted) {
        return this._createCancelledResult(start, log)
      }

      // Generate proofs
      this._setState('generating')
      this._reportProgress(onProgress, 'generating', 30, start)
      this._log('proof_generation_started', { count: plan.proofRequests.length }, log)

      const proofs = await Promise.race([
        this._generateProofs(plan.proofRequests, onProgress, start),
        timeoutPromise,
      ])

      if (abortSignal.aborted) {
        return this._createCancelledResult(start, log)
      }

      // Validate proofs
      let validationReport: ValidationReport | undefined
      if (this._config.validateBeforeCompose) {
        this._setState('validating')
        this._reportProgress(onProgress, 'validating', 70, start)
        this._log('validation_started', {}, log)

        validationReport = this._validator.validate(proofs)
        this._log('validation_completed', {
          valid: validationReport.valid,
          errors: validationReport.errorCount,
          warnings: validationReport.warningCount,
        }, log)

        if (!validationReport.valid) {
          return {
            success: false,
            error: 'Proof validation failed',
            state: 'failed',
            timeMs: Date.now() - start,
            retries: 0,
            validationReport,
            auditLog: log,
          }
        }
      }

      if (abortSignal.aborted) {
        return this._createCancelledResult(start, log)
      }

      // Compose proofs
      this._setState('composing')
      this._reportProgress(onProgress, 'composing', 85, start)
      this._log('composition_started', { strategy: plan.strategy }, log)

      const composedProof = await Promise.race([
        this._composeProofs(proofs, plan.strategy),
        timeoutPromise,
      ])

      // Complete
      this._setState('completed')
      this._reportProgress(onProgress, 'completed', 100, start)
      this._log('composition_completed', {
        composedProofId: composedProof.id,
        timeMs: Date.now() - start,
      }, log)

      return {
        success: true,
        composedProof,
        state: 'completed',
        timeMs: Date.now() - start,
        retries: 0,
        validationReport,
        auditLog: log,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._log('execution_error', { error: errorMessage }, log)
      throw error
    }
  }

  private async _initializeProviders(systems: ProofSystem[]): Promise<void> {
    const initPromises = systems.map(async (system) => {
      const provider = this._providers.get(system)
      if (provider && !provider.status.isReady) {
        await provider.initialize()
      }
    })

    if (this._config.parallelInit) {
      await Promise.all(initPromises)
    } else {
      for (const promise of initPromises) {
        await promise
      }
    }
  }

  private async _generateProofs(
    requests: ProofGenerationRequest[],
    onProgress?: OrchestratorProgressCallback,
    startTime?: number,
  ): Promise<SingleProof[]> {
    const proofs: SingleProof[] = []
    const start = startTime || Date.now()

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      const system = request.system || this._inferSystem(request.circuitId)

      if (!system) {
        throw new Error(`Cannot determine system for circuit '${request.circuitId}'`)
      }

      const provider = this._providers.get(system)
      if (!provider) {
        throw new Error(`No provider for system '${system}'`)
      }

      const progressPercent = 30 + Math.floor((i / requests.length) * 40)
      this._reportProgress(
        onProgress,
        `generating proof ${i + 1}/${requests.length}`,
        progressPercent,
        start,
      )

      const result = await provider.generateProof(request)

      if (!result.success || !result.proof) {
        throw new Error(result.error || 'Proof generation failed')
      }

      proofs.push(result.proof)
    }

    return proofs
  }

  private async _composeProofs(
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy,
  ): Promise<ComposedProof> {
    // Create composed proof structure
    const composedProof: ComposedProof = {
      id: generateId('composed'),
      proofs,
      strategy,
      status: ComposedProofStatus.VERIFIED,
      combinedPublicInputs: proofs.flatMap(p => p.publicInputs),
      compositionMetadata: {
        proofCount: proofs.length,
        systems: [...new Set(proofs.map(p => p.metadata.system))],
        compositionTimeMs: 0,
        success: true,
        inputHash: this._computeInputHash(proofs),
      },
      verificationHints: {
        verificationOrder: proofs.map(p => p.id),
        parallelGroups: strategy === Strategy.PARALLEL ? [proofs.map(p => p.id)] : [],
        estimatedTimeMs: proofs.length * 100,
        estimatedCost: BigInt(proofs.length * 1000),
        supportsBatchVerification: strategy === Strategy.BATCH,
      },
    }

    return composedProof
  }

  private _computeInputHash(proofs: SingleProof[]): HexString {
    const data = proofs.map(p => p.proof).join('')
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i)
      hash = hash & hash
    }
    return `0x${Math.abs(hash).toString(16).padStart(16, '0')}` as HexString
  }

  private _inferSystem(circuitId: string): ProofSystem | undefined {
    // Check if any provider has this circuit
    for (const [system, provider] of this._providers) {
      if (provider.hasCircuit(circuitId)) {
        return system
      }
    }

    // Infer from circuit ID naming convention
    if (circuitId.includes('noir') || circuitId.includes('funding') || circuitId.includes('validity')) {
      return 'noir'
    }
    if (circuitId.includes('halo2') || circuitId.includes('orchard')) {
      return 'halo2'
    }
    if (circuitId.includes('kimchi') || circuitId.includes('mina')) {
      return 'kimchi'
    }

    return undefined
  }

  private _checkProviderCompatibility(systems: ProofSystem[]): boolean {
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        if (!this._validator.areSystemsCompatible(systems[i], systems[j])) {
          return false
        }
      }
    }
    return true
  }

  private _setState(state: CompositionState): void {
    this._state = state
  }

  private _reportProgress(
    callback: OrchestratorProgressCallback | undefined,
    operation: string,
    progress: number,
    startTime: number,
  ): void {
    if (callback) {
      const elapsedMs = Date.now() - startTime
      const estimatedRemainingMs = progress > 0
        ? Math.floor((elapsedMs / progress) * (100 - progress))
        : undefined

      callback({
        state: this._state,
        progress,
        operation,
        elapsedMs,
        estimatedRemainingMs,
      })
    }
  }

  private _log(
    event: string,
    details: Record<string, unknown>,
    targetLog?: AuditLogEntry[],
  ): void {
    if (!this._config.enableAuditLog) return

    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      event,
      details,
    }

    this._auditLog.push(entry)
    if (targetLog) {
      targetLog.push(entry)
    }
  }

  private _combineAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController()

    const onAbort = () => controller.abort()

    signal1.addEventListener('abort', onAbort)
    signal2.addEventListener('abort', onAbort)

    if (signal1.aborted || signal2.aborted) {
      controller.abort()
    }

    return controller.signal
  }

  private _createCancelledResult(startTime: number, auditLog: AuditLogEntry[]): OrchestratorResult {
    this._setState('cancelled')
    return {
      success: false,
      error: 'Composition cancelled',
      state: 'cancelled',
      timeMs: Date.now() - startTime,
      retries: 0,
      auditLog,
    }
  }

  // ─── Audit Log Access ──────────────────────────────────────────────────────

  /**
   * Get full audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this._auditLog]
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this._auditLog = []
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a proof orchestrator with optional configuration
 */
export function createProofOrchestrator(
  config?: Partial<OrchestratorConfig>,
): ProofOrchestrator {
  return new ProofOrchestrator(config)
}
