/**
 * Lazy Proof Generation
 *
 * @module proofs/lazy
 * @description Deferred proof generation with cancellation and priority queue
 *
 * M20-14: Add lazy proof generation support (#319)
 *
 * ## Overview
 *
 * Lazy proofs defer computation until absolutely necessary, improving:
 * - Perceived performance (don't block on proof generation)
 * - Resource usage (only generate proofs that are actually needed)
 * - User experience (can cancel unnecessary proof generation)
 *
 * ## Usage
 *
 * ```typescript
 * import { LazyProof, ProofGenerationQueue } from '@sip-protocol/sdk'
 *
 * // Create a lazy proof
 * const lazy = new LazyProof(async (signal) => {
 *   return await provider.generateProof(inputs, signal)
 * })
 *
 * // Proof is NOT generated yet
 * console.log(lazy.status) // 'pending'
 *
 * // Trigger generation when needed
 * const proof = await lazy.resolve()
 *
 * // Or cancel if no longer needed
 * lazy.cancel()
 * ```
 */

import type { SingleProof, ProofSystem } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Status of a lazy proof
 */
export type LazyProofStatus =
  | 'pending'      // Not yet started
  | 'generating'   // Currently being generated
  | 'resolved'     // Successfully generated
  | 'cancelled'    // Generation was cancelled
  | 'failed'       // Generation failed

/**
 * Trigger for automatic proof generation
 */
export type ProofTrigger =
  | 'manual'       // Only on explicit resolve()
  | 'on-verify'    // When verification is requested
  | 'on-serialize' // When serialization is requested
  | 'immediate'    // Start immediately (eager)

/**
 * Priority level for proof generation
 */
export type ProofPriority = 'low' | 'normal' | 'high' | 'critical'

/**
 * Configuration for lazy proof
 */
export interface LazyProofConfig {
  /** When to trigger proof generation */
  readonly trigger: ProofTrigger
  /** Priority in the generation queue */
  readonly priority: ProofPriority
  /** Timeout in milliseconds (0 = no timeout) */
  readonly timeoutMs: number
  /** Retry attempts on failure */
  readonly maxRetries: number
  /** Delay between retries in milliseconds */
  readonly retryDelayMs: number
  /** Enable speculative prefetching */
  readonly prefetch: boolean
}

/**
 * Default lazy proof configuration
 */
export const DEFAULT_LAZY_CONFIG: LazyProofConfig = {
  trigger: 'manual',
  priority: 'normal',
  timeoutMs: 60000, // 1 minute
  maxRetries: 2,
  retryDelayMs: 1000,
  prefetch: false,
}

/**
 * Proof generator function type
 */
export type ProofGenerator<T = SingleProof> = (
  signal: AbortSignal
) => Promise<T>

/**
 * Event types for lazy proof
 */
export type LazyProofEventType =
  | 'start'
  | 'progress'
  | 'complete'
  | 'cancel'
  | 'error'
  | 'retry'

/**
 * Lazy proof event
 */
export interface LazyProofEvent {
  readonly type: LazyProofEventType
  readonly timestamp: number
  readonly data?: {
    readonly progress?: number
    readonly error?: Error
    readonly attempt?: number
  }
}

/**
 * Event listener for lazy proof
 */
export type LazyProofEventListener = (event: LazyProofEvent) => void

/**
 * Serialized lazy proof (for persistence)
 */
export interface SerializedLazyProof<T = SingleProof> {
  readonly status: LazyProofStatus
  readonly proof?: T
  readonly error?: string
  readonly config: LazyProofConfig
  readonly metadata?: {
    readonly system?: ProofSystem
    readonly circuitId?: string
    readonly createdAt: number
    readonly resolvedAt?: number
  }
}

// ─── LazyProof Class ──────────────────────────────────────────────────────────

/**
 * A lazy proof that defers generation until needed
 */
export class LazyProof<T = SingleProof> {
  private _status: LazyProofStatus = 'pending'
  private _proof: T | null = null
  private _error: Error | null = null
  private _promise: Promise<T> | null = null
  private _abortController: AbortController | null = null
  private _retryCount = 0
  private _createdAt = Date.now()
  private _resolvedAt: number | null = null
  private readonly _listeners = new Set<LazyProofEventListener>()

  readonly config: LazyProofConfig

  constructor(
    private readonly generator: ProofGenerator<T>,
    config: Partial<LazyProofConfig> = {},
    private readonly metadata?: {
      system?: ProofSystem
      circuitId?: string
    }
  ) {
    this.config = { ...DEFAULT_LAZY_CONFIG, ...config }
    // Start immediately if configured
    if (this.config.trigger === 'immediate') {
      this.resolve().catch(() => {})
    }
  }

  /**
   * Get the current status
   */
  get status(): LazyProofStatus {
    return this._status
  }

  /**
   * Check if the proof is resolved
   */
  get isResolved(): boolean {
    return this._status === 'resolved'
  }

  /**
   * Check if generation is in progress
   */
  get isGenerating(): boolean {
    return this._status === 'generating'
  }

  /**
   * Check if cancelled
   */
  get isCancelled(): boolean {
    return this._status === 'cancelled'
  }

  /**
   * Check if failed
   */
  get isFailed(): boolean {
    return this._status === 'failed'
  }

  /**
   * Get the proof (throws if not resolved)
   */
  get proof(): T {
    if (!this._proof) {
      throw new LazyProofError(
        'Proof not yet resolved. Call resolve() first.',
        'NOT_RESOLVED'
      )
    }
    return this._proof
  }

  /**
   * Get the proof if available (doesn't throw)
   */
  get proofOrNull(): T | null {
    return this._proof
  }

  /**
   * Get the error if failed
   */
  get error(): Error | null {
    return this._error
  }

  /**
   * Resolve (generate) the proof
   */
  async resolve(): Promise<T> {
    // Already resolved
    if (this._status === 'resolved' && this._proof) {
      return this._proof
    }

    // Already generating - return existing promise
    if (this._status === 'generating' && this._promise) {
      return this._promise
    }

    // Cannot resolve cancelled proof
    if (this._status === 'cancelled') {
      throw new LazyProofError('Proof generation was cancelled', 'CANCELLED')
    }

    // Start generation
    this._promise = this._generate()
    return this._promise
  }

  /**
   * Cancel proof generation
   */
  cancel(): boolean {
    if (this._status === 'resolved' || this._status === 'cancelled') {
      return false
    }

    this._status = 'cancelled'
    this._abortController?.abort()
    this._emit({ type: 'cancel', timestamp: Date.now() })
    return true
  }

  /**
   * Reset to pending state (allows re-generation)
   */
  reset(): void {
    if (this._status === 'generating') {
      this.cancel()
    }

    this._status = 'pending'
    this._proof = null
    this._error = null
    this._promise = null
    this._retryCount = 0
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: LazyProofEventListener): void {
    this._listeners.add(listener)
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: LazyProofEventListener): void {
    this._listeners.delete(listener)
  }

  /**
   * Serialize the lazy proof
   */
  serialize(): SerializedLazyProof<T> {
    // Trigger generation if configured
    if (this.config.trigger === 'on-serialize' && this._status === 'pending') {
      this.resolve().catch(() => {})
    }

    return {
      status: this._status,
      proof: this._proof ?? undefined,
      error: this._error?.message,
      config: this.config,
      metadata: {
        system: this.metadata?.system,
        circuitId: this.metadata?.circuitId,
        createdAt: this._createdAt,
        resolvedAt: this._resolvedAt ?? undefined,
      },
    }
  }

  /**
   * Create from serialized state
   */
  static deserialize<T = SingleProof>(
    data: SerializedLazyProof<T>,
    generator: ProofGenerator<T>
  ): LazyProof<T> {
    const lazy = new LazyProof<T>(generator, data.config, {
      system: data.metadata?.system,
      circuitId: data.metadata?.circuitId,
    })

    if (data.status === 'resolved' && data.proof) {
      lazy._status = 'resolved'
      lazy._proof = data.proof
      lazy._resolvedAt = data.metadata?.resolvedAt ?? null
    } else if (data.status === 'failed' && data.error) {
      lazy._status = 'failed'
      lazy._error = new Error(data.error)
    } else if (data.status === 'cancelled') {
      lazy._status = 'cancelled'
    }

    return lazy
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private async _generate(): Promise<T> {
    this._status = 'generating'
    this._abortController = new AbortController()
    this._emit({ type: 'start', timestamp: Date.now() })

    const { timeoutMs, maxRetries, retryDelayMs } = this.config

    while (this._retryCount <= maxRetries) {
      try {
        // Create timeout if configured
        const timeoutId = timeoutMs > 0
          ? setTimeout(() => this._abortController?.abort(), timeoutMs)
          : null

        try {
          const proof = await this.generator(this._abortController.signal)

          // Success!
          this._proof = proof
          this._status = 'resolved'
          this._resolvedAt = Date.now()
          this._emit({ type: 'complete', timestamp: Date.now() })
          return proof
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }
      } catch (err) {
        // Check if cancelled (cast needed - cancel() can be called concurrently)
        if (this._abortController.signal.aborted) {
          if ((this._status as LazyProofStatus) === 'cancelled') {
            throw new LazyProofError('Proof generation was cancelled', 'CANCELLED')
          }
          throw new LazyProofError('Proof generation timed out', 'TIMEOUT')
        }

        // Retry logic
        this._retryCount++
        const error = err instanceof Error ? err : new Error(String(err))

        if (this._retryCount <= maxRetries) {
          this._emit({
            type: 'retry',
            timestamp: Date.now(),
            data: { attempt: this._retryCount, error },
          })
          await this._delay(retryDelayMs)
          // Create new abort controller for retry
          this._abortController = new AbortController()
        } else {
          // Max retries exceeded
          this._status = 'failed'
          this._error = error
          this._emit({ type: 'error', timestamp: Date.now(), data: { error } })
          throw error
        }
      }
    }

    // Should never reach here
    throw new LazyProofError('Unexpected error in proof generation', 'INTERNAL')
  }

  private _emit(event: LazyProofEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Proof Generation Queue ───────────────────────────────────────────────────

/**
 * Queue item for proof generation
 */
interface QueueItem<T = SingleProof> {
  readonly id: string
  readonly lazy: LazyProof<T>
  readonly priority: ProofPriority
  readonly addedAt: number
}

/**
 * Priority values for sorting
 */
const PRIORITY_VALUES: Record<ProofPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * Configuration for proof generation queue
 */
export interface ProofQueueConfig {
  /** Maximum concurrent proof generations */
  readonly maxConcurrent: number
  /** Maximum queue size (0 = unlimited) */
  readonly maxQueueSize: number
  /** Enable automatic processing */
  readonly autoProcess: boolean
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: ProofQueueConfig = {
  maxConcurrent: 2,
  maxQueueSize: 100,
  autoProcess: true,
}

/**
 * Queue statistics
 */
export interface QueueStats {
  readonly queued: number
  readonly processing: number
  readonly completed: number
  readonly failed: number
  readonly cancelled: number
}

/**
 * Priority queue for proof generation
 */
export class ProofGenerationQueue<T = SingleProof> {
  private readonly queue: QueueItem<T>[] = []
  private readonly processing = new Map<string, LazyProof<T>>()
  private readonly config: ProofQueueConfig
  private _completed = 0
  private _failed = 0
  private _cancelled = 0
  private _idCounter = 0
  private _isProcessing = false

  constructor(config: Partial<ProofQueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config }
  }

  /**
   * Add a lazy proof to the queue
   */
  enqueue(lazy: LazyProof<T>, priority?: ProofPriority): string {
    if (
      this.config.maxQueueSize > 0 &&
      this.queue.length >= this.config.maxQueueSize
    ) {
      throw new LazyProofError('Queue is full', 'QUEUE_FULL')
    }

    const id = `proof-${++this._idCounter}`
    const item: QueueItem<T> = {
      id,
      lazy,
      priority: priority ?? lazy.config.priority,
      addedAt: Date.now(),
    }

    // Insert in priority order
    const insertIndex = this.queue.findIndex(
      (q) => PRIORITY_VALUES[q.priority] < PRIORITY_VALUES[item.priority]
    )

    if (insertIndex === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(insertIndex, 0, item)
    }

    // Auto-process if enabled
    if (this.config.autoProcess) {
      this._processNext()
    }

    return id
  }

  /**
   * Remove a proof from the queue
   */
  dequeue(id: string): boolean {
    const index = this.queue.findIndex((q) => q.id === id)
    if (index !== -1) {
      const [item] = this.queue.splice(index, 1)
      item.lazy.cancel()
      this._cancelled++
      return true
    }

    // Check if currently processing
    const processing = this.processing.get(id)
    if (processing) {
      processing.cancel()
      this.processing.delete(id)
      this._cancelled++
      return true
    }

    return false
  }

  /**
   * Process the queue manually
   */
  async process(): Promise<void> {
    if (this._isProcessing) return

    this._isProcessing = true

    try {
      while (this.queue.length > 0 || this.processing.size > 0) {
        await this._processNext()
        // Small delay to prevent tight loop
        await new Promise((r) => setTimeout(r, 10))
      }
    } finally {
      this._isProcessing = false
    }
  }

  /**
   * Cancel all pending and processing proofs
   */
  cancelAll(): number {
    let cancelled = 0

    // Cancel queued
    for (const item of this.queue) {
      item.lazy.cancel()
      cancelled++
    }
    this.queue.length = 0

    // Cancel processing
    for (const [id, lazy] of this.processing) {
      lazy.cancel()
      this.processing.delete(id)
      cancelled++
    }

    this._cancelled += cancelled
    return cancelled
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this._completed,
      failed: this._failed,
      cancelled: this._cancelled,
    }
  }

  /**
   * Get the current queue size
   */
  get size(): number {
    return this.queue.length + this.processing.size
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0 && this.processing.size === 0
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private async _processNext(): Promise<void> {
    // Check if we can process more
    if (this.processing.size >= this.config.maxConcurrent) {
      return
    }

    // Get next item
    const item = this.queue.shift()
    if (!item) return

    // Start processing
    this.processing.set(item.id, item.lazy)

    try {
      await item.lazy.resolve()
      this._completed++
    } catch {
      if (item.lazy.isCancelled) {
        this._cancelled++
      } else {
        this._failed++
      }
    } finally {
      this.processing.delete(item.id)
    }

    // Process next if auto-process enabled
    if (this.config.autoProcess && this.queue.length > 0) {
      this._processNext()
    }
  }
}

// ─── Lazy Verification Key Loading ────────────────────────────────────────────

/**
 * A lazy-loaded verification key
 */
export class LazyVerificationKey {
  private _vk: string | null = null
  private _promise: Promise<string> | null = null
  private _status: 'pending' | 'loading' | 'loaded' | 'failed' = 'pending'

  constructor(
    private readonly loader: () => Promise<string>,
    private readonly _system: ProofSystem,
    private readonly _circuitId: string
  ) {}

  /**
   * Get the proof system this key belongs to
   */
  get system(): ProofSystem {
    return this._system
  }

  /**
   * Get the circuit ID
   */
  get circuitId(): string {
    return this._circuitId
  }

  /**
   * Get the verification key (loads if necessary)
   */
  async get(): Promise<string> {
    if (this._vk) return this._vk

    if (this._promise) return this._promise

    this._status = 'loading'
    this._promise = this._load()
    return this._promise
  }

  /**
   * Get the verification key synchronously (null if not loaded)
   */
  getSync(): string | null {
    return this._vk
  }

  /**
   * Check if loaded
   */
  get isLoaded(): boolean {
    return this._status === 'loaded'
  }

  /**
   * Preload the verification key
   */
  preload(): void {
    if (this._status === 'pending') {
      this.get().catch(() => {})
    }
  }

  private async _load(): Promise<string> {
    try {
      this._vk = await this.loader()
      this._status = 'loaded'
      return this._vk
    } catch (err) {
      this._status = 'failed'
      throw err
    }
  }
}

/**
 * Registry for lazy verification keys
 */
export class VerificationKeyRegistry {
  private readonly keys = new Map<string, LazyVerificationKey>()

  /**
   * Register a verification key loader
   */
  register(
    system: ProofSystem,
    circuitId: string,
    loader: () => Promise<string>
  ): void {
    const key = this._makeKey(system, circuitId)
    this.keys.set(key, new LazyVerificationKey(loader, system, circuitId))
  }

  /**
   * Get a verification key
   */
  async get(system: ProofSystem, circuitId: string): Promise<string> {
    const key = this._makeKey(system, circuitId)
    const lazy = this.keys.get(key)

    if (!lazy) {
      throw new LazyProofError(
        `No verification key registered for ${system}:${circuitId}`,
        'VK_NOT_FOUND'
      )
    }

    return lazy.get()
  }

  /**
   * Preload verification keys for specified circuits
   */
  preload(circuits: Array<{ system: ProofSystem; circuitId: string }>): void {
    for (const { system, circuitId } of circuits) {
      const key = this._makeKey(system, circuitId)
      this.keys.get(key)?.preload()
    }
  }

  /**
   * Preload all registered verification keys
   */
  preloadAll(): void {
    for (const lazy of this.keys.values()) {
      lazy.preload()
    }
  }

  private _makeKey(system: ProofSystem, circuitId: string): string {
    return `${system}:${circuitId}`
  }
}

// ─── Speculative Prefetching ──────────────────────────────────────────────────

/**
 * Configuration for speculative prefetching
 */
export interface PrefetchConfig {
  /** Maximum proofs to prefetch */
  readonly maxPrefetch: number
  /** Prefetch when likelihood exceeds this threshold (0-1) */
  readonly likelihoodThreshold: number
  /** Time window for access pattern analysis (ms) */
  readonly analysisWindowMs: number
}

/**
 * Default prefetch configuration
 */
export const DEFAULT_PREFETCH_CONFIG: PrefetchConfig = {
  maxPrefetch: 5,
  likelihoodThreshold: 0.7,
  analysisWindowMs: 300000, // 5 minutes
}

/**
 * Speculative prefetcher for proofs
 */
export class SpeculativePrefetcher<T = SingleProof> {
  private readonly config: PrefetchConfig
  private readonly accessHistory: Array<{
    circuitId: string
    timestamp: number
  }> = []
  private readonly prefetched = new Map<string, LazyProof<T>>()
  private readonly generators = new Map<string, ProofGenerator<T>>()

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = { ...DEFAULT_PREFETCH_CONFIG, ...config }
  }

  /**
   * Register a proof generator for prefetching
   */
  register(circuitId: string, generator: ProofGenerator<T>): void {
    this.generators.set(circuitId, generator)
  }

  /**
   * Record an access and trigger prefetching
   */
  recordAccess(circuitId: string): void {
    // Record access
    this.accessHistory.push({ circuitId, timestamp: Date.now() })

    // Trim old history
    const cutoff = Date.now() - this.config.analysisWindowMs
    while (this.accessHistory.length > 0 && this.accessHistory[0].timestamp < cutoff) {
      this.accessHistory.shift()
    }

    // Analyze and prefetch
    this._prefetchLikely()
  }

  /**
   * Get a prefetched proof if available
   */
  getPrefetched(circuitId: string): LazyProof<T> | null {
    return this.prefetched.get(circuitId) ?? null
  }

  /**
   * Clear all prefetched proofs
   */
  clear(): void {
    for (const lazy of this.prefetched.values()) {
      lazy.cancel()
    }
    this.prefetched.clear()
    this.accessHistory.length = 0
  }

  private _prefetchLikely(): void {
    // Calculate access frequencies
    const frequencies = new Map<string, number>()
    for (const { circuitId } of this.accessHistory) {
      frequencies.set(circuitId, (frequencies.get(circuitId) ?? 0) + 1)
    }

    // Calculate likelihoods
    const total = this.accessHistory.length
    const likelihoods: Array<{ circuitId: string; likelihood: number }> = []

    for (const [circuitId, count] of frequencies) {
      const likelihood = count / total
      if (likelihood >= this.config.likelihoodThreshold) {
        likelihoods.push({ circuitId, likelihood })
      }
    }

    // Sort by likelihood
    likelihoods.sort((a, b) => b.likelihood - a.likelihood)

    // Prefetch top candidates (respecting maxPrefetch limit including existing)
    for (const { circuitId } of likelihoods) {
      // Check total prefetched count (existing + new)
      if (this.prefetched.size >= this.config.maxPrefetch) break

      // Skip if already prefetched
      if (this.prefetched.has(circuitId)) continue

      // Skip if no generator
      const generator = this.generators.get(circuitId)
      if (!generator) continue

      // Create lazy proof with immediate trigger
      const lazy = new LazyProof(generator, {
        ...DEFAULT_LAZY_CONFIG,
        trigger: 'immediate',
        priority: 'low',
      })

      this.prefetched.set(circuitId, lazy)
    }
  }
}

// ─── Error Class ──────────────────────────────────────────────────────────────

/**
 * Error codes for lazy proof operations
 */
export type LazyProofErrorCode =
  | 'NOT_RESOLVED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'QUEUE_FULL'
  | 'VK_NOT_FOUND'
  | 'INTERNAL'

/**
 * Error class for lazy proof operations
 */
export class LazyProofError extends Error {
  constructor(
    message: string,
    public readonly code: LazyProofErrorCode
  ) {
    super(message)
    this.name = 'LazyProofError'
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a lazy proof with default configuration
 */
export function createLazyProof<T = SingleProof>(
  generator: ProofGenerator<T>,
  config?: Partial<LazyProofConfig>,
  metadata?: { system?: ProofSystem; circuitId?: string }
): LazyProof<T> {
  return new LazyProof<T>(
    generator,
    { ...DEFAULT_LAZY_CONFIG, ...config },
    metadata
  )
}

/**
 * Create a proof generation queue
 */
export function createProofQueue<T = SingleProof>(
  config?: Partial<ProofQueueConfig>
): ProofGenerationQueue<T> {
  return new ProofGenerationQueue<T>(config)
}

/**
 * Create a verification key registry
 */
export function createVKRegistry(): VerificationKeyRegistry {
  return new VerificationKeyRegistry()
}

/**
 * Create a speculative prefetcher
 */
export function createPrefetcher<T = SingleProof>(
  config?: Partial<PrefetchConfig>
): SpeculativePrefetcher<T> {
  return new SpeculativePrefetcher<T>(config)
}
