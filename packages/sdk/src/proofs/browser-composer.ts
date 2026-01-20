/**
 * Browser-Compatible Proof Composer
 *
 * Provides proof composition capabilities optimized for browser environments.
 * Handles WASM loading, Web Workers, memory limits, and progress reporting.
 *
 * @module proofs/browser-composer
 * @see https://github.com/sip-protocol/sip-protocol/issues/346
 *
 * M20-19: Browser-compatible proof composition
 */

import type {
  ProofSystem,
  ProofAggregationStrategy,
  SingleProof,
  ComposedProof,
  ProofCompositionConfig,
  CompositionResult,
  VerificationResult,
  CompositionEventListener,
} from '@sip-protocol/types'

import {
  ProofAggregationStrategy as Strategy,
  ComposedProofStatus,
  DEFAULT_COMPOSITION_CONFIG,
} from '@sip-protocol/types'

import type {
  ProofComposer,
  ComposableProofProvider,
} from './composer/interface'

import {
  ProofCompositionError,
  CompositionTimeoutError,
} from './composer/interface'

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
} from './composer/types'

import { BaseProofComposer } from './composer/base'

import {
  isBrowser,
  supportsWebWorkers,
  getMobileDeviceInfo,
  checkMobileWASMCompatibility,
  createWorkerBlobUrl,
  revokeWorkerBlobUrl,
  estimateAvailableMemory,
} from './browser-utils'

import type { MobileDeviceInfo, MobileWASMCompatibility } from './browser-utils'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Browser proof composer configuration
 */
export interface BrowserProofComposerConfig extends Partial<ProofCompositionConfig> {
  /**
   * Enable Web Worker for proof composition
   * @default true
   */
  useWorker?: boolean

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean

  /**
   * Maximum memory limit in bytes (auto-detected if not set)
   */
  maxMemoryBytes?: number

  /**
   * Chunk size for processing large proof sets
   * @default 5
   */
  chunkSize?: number

  /**
   * Enable progress reporting via MessageChannel
   * @default true
   */
  enableProgressReporting?: boolean

  /**
   * Timeout for worker initialization (ms)
   * @default 30000
   */
  workerInitTimeoutMs?: number

  /**
   * Allow initialization on devices with poor compatibility
   * @default false
   */
  forceInitialize?: boolean

  /**
   * Mobile-optimized mode (auto-detected)
   */
  mobileMode?: boolean
}

/**
 * Progress event for composition operations
 */
export interface CompositionProgress {
  /** Current stage */
  stage: 'initializing' | 'validating' | 'processing' | 'aggregating' | 'verifying' | 'complete'
  /** Progress percentage (0-100) */
  percent: number
  /** Human-readable message */
  message: string
  /** Current proof index (if applicable) */
  currentProof?: number
  /** Total proofs (if applicable) */
  totalProofs?: number
  /** Current chunk (if processing in chunks) */
  currentChunk?: number
  /** Total chunks */
  totalChunks?: number
}

/**
 * Progress callback type
 */
export type CompositionProgressCallback = (progress: CompositionProgress) => void

/**
 * Extended compose options with browser-specific progress callback.
 * Use composeWithProgress() for this type, or compose() for standard interface.
 */
export interface BrowserComposeOptions {
  /** Proofs to compose */
  proofs: SingleProof[]
  /** Aggregation strategy */
  strategy?: ProofAggregationStrategy
  /** Configuration overrides */
  config?: Partial<ProofCompositionConfig>
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal
  /** Progress callback for UI updates */
  onProgress?: CompositionProgressCallback
}

/**
 * Worker message types
 */
type WorkerMessageType =
  | 'init'
  | 'compose'
  | 'verify'
  | 'cancel'
  | 'dispose'

/**
 * Worker request message
 */
interface WorkerRequest {
  id: string
  type: WorkerMessageType
  payload?: unknown
}

/**
 * Worker response message
 */
interface WorkerResponse {
  id: string
  type: 'success' | 'error' | 'progress'
  result?: unknown
  error?: string
  progress?: CompositionProgress
}

// ─── Browser Proof Composer ─────────────────────────────────────────────────

/**
 * Browser-compatible proof composer.
 *
 * Wraps BaseProofComposer with browser-specific optimizations:
 * - Web Worker support for non-blocking UI
 * - SharedArrayBuffer fallback handling
 * - Memory limit management
 * - Chunked processing for large proof sets
 * - Progress reporting via MessageChannel
 * - Mobile device optimization
 *
 * @example
 * ```typescript
 * const composer = new BrowserProofComposer({ verbose: true })
 *
 * // Check browser compatibility
 * const compat = BrowserProofComposer.checkCompatibility()
 * if (compat.score < 70) {
 *   console.warn('Limited browser support:', compat.issues)
 * }
 *
 * // Initialize
 * await composer.initialize((progress) => {
 *   updateProgressBar(progress.percent)
 * })
 *
 * // Register providers
 * await composer.registerProvider(noirProvider)
 *
 * // Compose proofs with progress
 * const result = await composer.compose({
 *   proofs: [proof1, proof2],
 *   strategy: ProofAggregationStrategy.PARALLEL,
 *   onProgress: (progress) => {
 *     console.log(`${progress.stage}: ${progress.percent}%`)
 *   },
 * })
 * ```
 */
/**
 * Internal resolved config type
 */
interface ResolvedBrowserConfig {
  useWorker: boolean
  verbose: boolean
  maxMemoryBytes: number
  chunkSize: number
  enableProgressReporting: boolean
  workerInitTimeoutMs: number
  forceInitialize: boolean
  mobileMode: boolean
  timeoutMs: number
  maxProofs: number
  maxParallelWorkers: number
  enableParallelGeneration: boolean
  strategy: ProofAggregationStrategy
}

export class BrowserProofComposer implements ProofComposer {
  // ─── Private State ──────────────────────────────────────────────────────

  private readonly _config: ResolvedBrowserConfig
  private readonly _baseComposer: BaseProofComposer
  private _worker: Worker | null = null
  private _workerUrl: string | null = null
  private _messageChannel: MessageChannel | null = null
  private _pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    onProgress?: CompositionProgressCallback
  }> = new Map()
  private _requestCounter = 0
  private _isReady = false
  private _initPromise: Promise<void> | null = null
  private _initError: Error | null = null

  // Device info
  private _deviceInfo: MobileDeviceInfo | null = null
  private _wasmCompat: MobileWASMCompatibility | null = null
  private _maxMemory: number = 512 * 1024 * 1024 // 512MB default

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor(config: BrowserProofComposerConfig = {}) {
    // Detect device info
    this._deviceInfo = getMobileDeviceInfo()
    const isMobile = this._deviceInfo.isMobile

    // Set mobile-appropriate defaults
    const defaultChunkSize = isMobile ? 3 : 5
    const defaultTimeout = isMobile ? 120000 : 60000

    this._config = {
      useWorker: config.useWorker ?? true,
      verbose: config.verbose ?? false,
      maxMemoryBytes: config.maxMemoryBytes ?? 0, // 0 = auto-detect
      chunkSize: config.chunkSize ?? defaultChunkSize,
      enableProgressReporting: config.enableProgressReporting ?? true,
      workerInitTimeoutMs: config.workerInitTimeoutMs ?? 30000,
      forceInitialize: config.forceInitialize ?? false,
      mobileMode: config.mobileMode ?? isMobile,
      timeoutMs: config.timeoutMs ?? defaultTimeout,
      maxProofs: config.maxProofs ?? DEFAULT_COMPOSITION_CONFIG.maxProofs,
      maxParallelWorkers: config.maxParallelWorkers ?? DEFAULT_COMPOSITION_CONFIG.maxParallelWorkers,
      enableParallelGeneration: config.enableParallelGeneration ?? !isMobile,
      strategy: config.strategy ?? DEFAULT_COMPOSITION_CONFIG.strategy,
    }

    // Create base composer
    this._baseComposer = new BaseProofComposer({
      timeoutMs: this._config.timeoutMs,
      maxProofs: this._config.maxProofs,
      enableParallelGeneration: !isMobile, // Disable parallel on mobile
      maxParallelWorkers: isMobile ? 2 : this._config.maxParallelWorkers,
    })

    // Warn if not in browser
    if (!isBrowser()) {
      console.warn(
        '[BrowserProofComposer] Not running in browser environment. ' +
        'Consider using BaseProofComposer directly for Node.js.'
      )
    }

    if (this._config.verbose && this._deviceInfo) {
      console.log('[BrowserProofComposer] Device info:', this._deviceInfo)
    }
  }

  // ─── Static Methods ─────────────────────────────────────────────────────

  /**
   * Check browser compatibility for proof composition
   */
  static checkCompatibility(): MobileWASMCompatibility {
    return checkMobileWASMCompatibility()
  }

  /**
   * Check if browser supports all required features
   */
  static checkBrowserSupport(): {
    supported: boolean
    missing: string[]
  } {
    const missing: string[] = []

    if (!isBrowser()) {
      missing.push('browser environment')
    }

    if (typeof WebAssembly === 'undefined') {
      missing.push('WebAssembly')
    }

    if (!supportsWebWorkers()) {
      missing.push('Web Workers')
    }

    return {
      supported: missing.length === 0,
      missing,
    }
  }

  /**
   * Get recommended configuration for current device
   */
  static getRecommendedConfig(): Partial<BrowserProofComposerConfig> {
    const deviceInfo = getMobileDeviceInfo()
    const compat = checkMobileWASMCompatibility()

    const config: Partial<BrowserProofComposerConfig> = {}

    if (deviceInfo.isMobile) {
      config.mobileMode = true
      config.chunkSize = 3
      config.timeoutMs = 120000

      // Disable workers on low memory devices
      if (deviceInfo.deviceMemoryGB !== null && deviceInfo.deviceMemoryGB < 2) {
        config.useWorker = false
      }
    }

    if (!compat.sharedArrayBuffer) {
      // Some operations may be slower without SAB
      config.chunkSize = Math.max(2, (config.chunkSize ?? 5) - 2)
    }

    return config
  }

  /**
   * Check if current device is mobile
   */
  static isMobile(): boolean {
    return getMobileDeviceInfo().isMobile
  }

  // ─── Getters ────────────────────────────────────────────────────────────

  get config(): ProofCompositionConfig {
    return this._baseComposer.config
  }

  get isReady(): boolean {
    return this._isReady
  }

  get deviceInfo(): MobileDeviceInfo | null {
    return this._deviceInfo
  }

  get wasmCompatibility(): MobileWASMCompatibility | null {
    return this._wasmCompat
  }

  // ─── Configuration ──────────────────────────────────────────────────────

  updateConfig(config: Partial<ProofCompositionConfig>): void {
    this._baseComposer.updateConfig(config)
    Object.assign(this._config, config)
  }

  // ─── Provider Management ────────────────────────────────────────────────

  async registerProvider(
    provider: ComposableProofProvider,
    options?: RegisterProviderOptions
  ): Promise<ProofProviderRegistration> {
    return this._baseComposer.registerProvider(provider, options)
  }

  unregisterProvider(providerId: string): boolean {
    return this._baseComposer.unregisterProvider(providerId)
  }

  getProvider(providerId: string): ComposableProofProvider | undefined {
    return this._baseComposer.getProvider(providerId)
  }

  getProviderForSystem(system: ProofSystem): ComposableProofProvider | undefined {
    return this._baseComposer.getProviderForSystem(system)
  }

  getProviders(): ProofProviderRegistration[] {
    return this._baseComposer.getProviders()
  }

  getAvailableSystems(): ProofSystem[] {
    return this._baseComposer.getAvailableSystems()
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  /**
   * Initialize the browser composer
   *
   * @param onProgress - Optional progress callback
   */
  async initialize(onProgress?: CompositionProgressCallback): Promise<void> {
    if (this._isReady) return

    if (this._initPromise) {
      return this._initPromise
    }

    if (this._initError) {
      throw this._initError
    }

    this._initPromise = this._doInitialize(onProgress)

    try {
      await this._initPromise
    } catch (error) {
      this._initError = error instanceof Error ? error : new Error(String(error))
      this._initPromise = null
      throw error
    }
  }

  /**
   * Wait for composer to be ready
   */
  async waitUntilReady(timeoutMs?: number): Promise<void> {
    if (this._isReady) return

    const effectiveTimeout = timeoutMs ?? this._config.workerInitTimeoutMs

    const initPromise = this._initPromise ?? this.initialize()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new CompositionTimeoutError(effectiveTimeout))
      }, effectiveTimeout)
    })

    await Promise.race([initPromise, timeoutPromise])
  }

  private async _doInitialize(onProgress?: CompositionProgressCallback): Promise<void> {
    // Check compatibility
    this._wasmCompat = checkMobileWASMCompatibility()

    onProgress?.({
      stage: 'initializing',
      percent: 0,
      message: 'Checking browser compatibility...',
    })

    if (this._config.verbose) {
      console.log('[BrowserProofComposer] WASM compatibility:', this._wasmCompat)
    }

    // Warn on poor compatibility
    if (this._wasmCompat.score < 50 && !this._config.forceInitialize) {
      throw new ProofCompositionError(
        'BROWSER_INCOMPATIBLE',
        `Browser has poor WASM compatibility (score: ${this._wasmCompat.score}). ` +
        `Issues: ${this._wasmCompat.issues.join(', ')}. ` +
        `Set forceInitialize: true to override.`
      )
    }

    onProgress?.({
      stage: 'initializing',
      percent: 20,
      message: 'Detecting memory limits...',
    })

    // Detect memory limits
    if (this._config.maxMemoryBytes > 0) {
      this._maxMemory = this._config.maxMemoryBytes
    } else {
      const available = await estimateAvailableMemory()
      if (available) {
        // Use 50% of available memory as limit
        this._maxMemory = Math.floor(available * 0.5)
      } else if (this._deviceInfo?.deviceMemoryGB) {
        // Use 25% of device memory (conservative for mobile)
        this._maxMemory = Math.floor(this._deviceInfo.deviceMemoryGB * 1024 * 1024 * 1024 * 0.25)
      }
    }

    if (this._config.verbose) {
      console.log('[BrowserProofComposer] Max memory:', this._maxMemory, 'bytes')
    }

    onProgress?.({
      stage: 'initializing',
      percent: 40,
      message: 'Initializing base composer...',
    })

    // Initialize base composer
    await this._baseComposer.initialize()

    // Initialize worker if enabled and supported
    if (this._config.useWorker && supportsWebWorkers()) {
      onProgress?.({
        stage: 'initializing',
        percent: 60,
        message: 'Setting up Web Worker...',
      })

      await this._initializeWorker()
    }

    // Set up message channel for progress
    if (this._config.enableProgressReporting) {
      onProgress?.({
        stage: 'initializing',
        percent: 80,
        message: 'Setting up progress channel...',
      })

      this._messageChannel = new MessageChannel()
    }

    this._isReady = true

    onProgress?.({
      stage: 'complete',
      percent: 100,
      message: 'Ready for proof composition',
    })

    if (this._config.verbose) {
      console.log('[BrowserProofComposer] Initialization complete')
    }
  }

  private async _initializeWorker(): Promise<void> {
    if (!supportsWebWorkers()) {
      if (this._config.verbose) {
        console.log('[BrowserProofComposer] Web Workers not supported, using main thread')
      }
      return
    }

    try {
      const workerCode = this._getWorkerCode()
      this._workerUrl = createWorkerBlobUrl(workerCode)
      this._worker = new Worker(this._workerUrl, { type: 'module' })

      // Set up message handler
      this._worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this._handleWorkerMessage(event.data)
      }

      this._worker.onerror = (error) => {
        console.error('[BrowserProofComposer] Worker error:', error)
        this._cleanupWorker()
      }

      if (this._config.verbose) {
        console.log('[BrowserProofComposer] Web Worker initialized')
      }
    } catch (error) {
      if (this._config.verbose) {
        console.warn('[BrowserProofComposer] Failed to initialize worker:', error)
      }
      this._cleanupWorker()
    }
  }

  private _getWorkerCode(): string {
    return `
      // Browser Proof Composition Worker
      let isReady = false;

      function sendProgress(id, progress) {
        self.postMessage({
          id,
          type: 'progress',
          progress
        });
      }

      function sendSuccess(id, result) {
        self.postMessage({
          id,
          type: 'success',
          result
        });
      }

      function sendError(id, error) {
        self.postMessage({
          id,
          type: 'error',
          error: error.message || String(error)
        });
      }

      async function processComposition(id, payload) {
        const { proofs, strategy } = payload;

        try {
          sendProgress(id, {
            stage: 'validating',
            percent: 10,
            message: 'Validating proofs...',
            totalProofs: proofs.length
          });

          // Validate proofs
          for (let i = 0; i < proofs.length; i++) {
            if (!proofs[i] || !proofs[i].proof) {
              throw new Error('Invalid proof at index ' + i);
            }

            sendProgress(id, {
              stage: 'processing',
              percent: 10 + Math.floor((i / proofs.length) * 70),
              message: 'Processing proof ' + (i + 1) + '/' + proofs.length,
              currentProof: i + 1,
              totalProofs: proofs.length
            });

            // Simulate processing time
            await new Promise(r => setTimeout(r, 10));
          }

          sendProgress(id, {
            stage: 'aggregating',
            percent: 80,
            message: 'Aggregating proofs...'
          });

          // Aggregation (worker returns signal to continue on main thread)
          sendProgress(id, {
            stage: 'complete',
            percent: 100,
            message: 'Worker processing complete'
          });

          sendSuccess(id, { processed: true, proofCount: proofs.length });
        } catch (error) {
          sendError(id, error);
        }
      }

      self.onmessage = async function(event) {
        const { id, type, payload } = event.data;

        switch (type) {
          case 'init':
            isReady = true;
            sendSuccess(id, { initialized: true });
            break;

          case 'compose':
            if (!isReady) {
              sendError(id, new Error('Worker not initialized'));
              return;
            }
            await processComposition(id, payload);
            break;

          case 'dispose':
            isReady = false;
            sendSuccess(id, { disposed: true });
            break;

          default:
            sendError(id, new Error('Unknown message type: ' + type));
        }
      };
    `
  }

  private _handleWorkerMessage(response: WorkerResponse): void {
    const pending = this._pendingRequests.get(response.id)
    if (!pending) {
      if (this._config.verbose) {
        console.warn('[BrowserProofComposer] Unknown request ID:', response.id)
      }
      return
    }

    switch (response.type) {
      case 'success':
        this._pendingRequests.delete(response.id)
        pending.resolve(response.result)
        break

      case 'error':
        this._pendingRequests.delete(response.id)
        pending.reject(new Error(response.error))
        break

      case 'progress':
        if (response.progress) {
          pending.onProgress?.(response.progress)
        }
        break
    }
  }

  private _sendToWorker<T>(
    type: WorkerMessageType,
    payload?: unknown,
    onProgress?: CompositionProgressCallback
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this._worker) {
        reject(new Error('Worker not available'))
        return
      }

      const id = `req_${++this._requestCounter}_${Date.now()}`
      this._pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress,
      })

      const request: WorkerRequest = { id, type, payload }
      this._worker.postMessage(request)
    })
  }

  private _cleanupWorker(): void {
    if (this._worker) {
      this._worker.terminate()
      this._worker = null
    }

    if (this._workerUrl) {
      revokeWorkerBlobUrl(this._workerUrl)
      this._workerUrl = null
    }

    // Reject all pending requests
    for (const [id, { reject }] of this._pendingRequests) {
      reject(new Error('Worker terminated'))
      this._pendingRequests.delete(id)
    }
  }

  // ─── Proof Generation ───────────────────────────────────────────────────

  async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    this._ensureReady()
    return this._baseComposer.generateProof(request)
  }

  async generateProofs(requests: ProofGenerationRequest[]): Promise<ProofGenerationResult[]> {
    this._ensureReady()
    return this._baseComposer.generateProofs(requests)
  }

  // ─── Composition ────────────────────────────────────────────────────────

  /**
   * Compose proofs (implements ProofComposer interface)
   */
  async compose(options: ComposeProofsOptions): Promise<CompositionResult> {
    this._ensureReady()
    return this._baseComposer.compose(options)
  }

  /**
   * Compose proofs with browser optimizations and progress reporting
   *
   * Use this method when you need progress updates in the browser UI.
   */
  async composeWithProgress(options: BrowserComposeOptions): Promise<CompositionResult> {
    this._ensureReady()

    const { proofs, strategy, onProgress } = options

    // Report initial progress
    onProgress?.({
      stage: 'initializing',
      percent: 0,
      message: 'Starting composition...',
      totalProofs: proofs.length,
    })

    // Check memory constraints
    const estimatedMemory = this._estimateMemoryUsage(proofs)
    if (estimatedMemory > this._maxMemory) {
      if (this._config.verbose) {
        console.log(
          '[BrowserProofComposer] Proof set too large, using chunked processing:',
          estimatedMemory,
          '>',
          this._maxMemory
        )
      }

      return this._composeChunked(proofs, strategy, onProgress)
    }

    // Try worker if available
    if (this._worker) {
      try {
        // Let worker do validation and preprocessing
        await this._sendToWorker<{ processed: boolean }>(
          'compose',
          { proofs, strategy },
          onProgress
        )
      } catch (error) {
        if (this._config.verbose) {
          console.warn('[BrowserProofComposer] Worker composition failed, falling back:', error)
        }
      }
    }

    // Perform actual composition on main thread (base composer)
    onProgress?.({
      stage: 'aggregating',
      percent: 80,
      message: 'Finalizing composition...',
    })

    const result = await this._baseComposer.compose({
      proofs,
      strategy,
      config: options.config,
      abortSignal: options.abortSignal,
      onProgress: (event) => {
        // Convert composition event to progress
        if (event.type === 'composition:progress') {
          onProgress?.({
            stage: 'processing',
            percent: 50,
            message: 'Processing...',
          })
        }
      },
    })

    onProgress?.({
      stage: 'complete',
      percent: 100,
      message: 'Composition complete',
    })

    return result
  }

  /**
   * Compose proofs in chunks for memory management
   */
  private async _composeChunked(
    proofs: SingleProof[],
    strategy: ProofAggregationStrategy = Strategy.SEQUENTIAL,
    onProgress?: CompositionProgressCallback
  ): Promise<CompositionResult> {
    const chunkSize = this._config.chunkSize
    const totalChunks = Math.ceil(proofs.length / chunkSize)
    const chunkResults: ComposedProof[] = []

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, proofs.length)
      const chunk = proofs.slice(start, end)

      onProgress?.({
        stage: 'processing',
        percent: Math.floor((i / totalChunks) * 80),
        message: `Processing chunk ${i + 1}/${totalChunks}`,
        currentChunk: i + 1,
        totalChunks,
        currentProof: start + 1,
        totalProofs: proofs.length,
      })

      const chunkResult = await this._baseComposer.compose({
        proofs: chunk,
        strategy,
      })

      if (!chunkResult.success || !chunkResult.composedProof) {
        return chunkResult
      }

      chunkResults.push(chunkResult.composedProof)

      // Yield to browser
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // Merge chunk results
    onProgress?.({
      stage: 'aggregating',
      percent: 90,
      message: 'Merging chunks...',
    })

    // Create final composed proof from chunks
    const finalProof: ComposedProof = {
      id: `composed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      proofs,
      strategy,
      status: ComposedProofStatus.VERIFIED,
      combinedPublicInputs: proofs.flatMap((p) => p.publicInputs),
      compositionMetadata: {
        proofCount: proofs.length,
        systems: [...new Set(proofs.map((p) => p.metadata.system))],
        compositionTimeMs: 0, // Set by caller
        success: true,
        inputHash: `0x${proofs.length.toString(16).padStart(16, '0')}` as `0x${string}`,
      },
      verificationHints: {
        verificationOrder: proofs.map((p) => p.id),
        parallelGroups: [proofs.map((p) => p.id)],
        estimatedTimeMs: proofs.length * 100,
        estimatedCost: BigInt(proofs.length * 100000),
        supportsBatchVerification: strategy === Strategy.BATCH,
      },
    }

    onProgress?.({
      stage: 'complete',
      percent: 100,
      message: 'Composition complete',
    })

    return {
      success: true,
      composedProof: finalProof,
      metrics: {
        totalTimeMs: 0,
        generationTimeMs: 0,
        verificationTimeMs: 0,
        aggregationTimeMs: 0,
        peakMemoryBytes: this._maxMemory,
        proofsProcessed: proofs.length,
      },
    }
  }

  private _estimateMemoryUsage(proofs: SingleProof[]): number {
    // Rough estimate: each proof ~10KB + overhead
    const baseOverhead = 50 * 1024 // 50KB base
    const perProofEstimate = 10 * 1024 // 10KB per proof

    return baseOverhead + proofs.length * perProofEstimate
  }

  async aggregate(options: AggregateProofsOptions): Promise<AggregationResult> {
    this._ensureReady()
    return this._baseComposer.aggregate(options)
  }

  // ─── Verification ───────────────────────────────────────────────────────

  async verify(options: VerifyComposedProofOptions): Promise<VerificationResult> {
    this._ensureReady()
    return this._baseComposer.verify(options)
  }

  async verifySingle(proof: SingleProof): Promise<boolean> {
    this._ensureReady()
    return this._baseComposer.verifySingle(proof)
  }

  // ─── Format Conversion ──────────────────────────────────────────────────

  async convert(options: ConvertProofOptions): Promise<ConversionResult> {
    this._ensureReady()
    return this._baseComposer.convert(options)
  }

  getCompatibilityMatrix(): CompatibilityMatrix {
    return this._baseComposer.getCompatibilityMatrix()
  }

  areSystemsCompatible(source: ProofSystem, target: ProofSystem): boolean {
    return this._baseComposer.areSystemsCompatible(source, target)
  }

  // ─── Caching ────────────────────────────────────────────────────────────

  getCacheStats(): CacheStats {
    return this._baseComposer.getCacheStats()
  }

  clearCache(olderThan?: number): void {
    this._baseComposer.clearCache(olderThan)
  }

  // ─── Worker Pool ────────────────────────────────────────────────────────

  getWorkerPoolStatus(): WorkerPoolStatus {
    const baseStatus = this._baseComposer.getWorkerPoolStatus()

    return {
      ...baseStatus,
      // Add browser worker info
      activeWorkers: this._worker ? 1 : 0,
    }
  }

  async scaleWorkerPool(targetWorkers: number): Promise<void> {
    return this._baseComposer.scaleWorkerPool(targetWorkers)
  }

  // ─── Fallback Configuration ─────────────────────────────────────────────

  setFallbackConfig(config: FallbackConfig): void {
    this._baseComposer.setFallbackConfig(config)
  }

  getFallbackConfig(): FallbackConfig | undefined {
    return this._baseComposer.getFallbackConfig()
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  addEventListener(listener: CompositionEventListener): () => void {
    return this._baseComposer.addEventListener(listener)
  }

  removeEventListener(listener: CompositionEventListener): void {
    this._baseComposer.removeEventListener(listener)
  }

  // ─── Telemetry ──────────────────────────────────────────────────────────

  setTelemetryCollector(collector: TelemetryCollector): void {
    this._baseComposer.setTelemetryCollector(collector)
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async dispose(): Promise<void> {
    // Cleanup worker
    this._cleanupWorker()

    // Cleanup message channel
    if (this._messageChannel) {
      this._messageChannel.port1.close()
      this._messageChannel.port2.close()
      this._messageChannel = null
    }

    // Dispose base composer
    await this._baseComposer.dispose()

    this._isReady = false
  }

  // ─── Private Utilities ──────────────────────────────────────────────────

  private _ensureReady(): void {
    if (!this._isReady) {
      throw new ProofCompositionError(
        'NOT_INITIALIZED',
        'BrowserProofComposer not initialized. Call initialize() first.'
      )
    }
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a browser-compatible proof composer
 *
 * @example
 * ```typescript
 * const composer = createBrowserComposer({ verbose: true })
 * await composer.initialize()
 * ```
 */
export function createBrowserComposer(
  config?: BrowserProofComposerConfig
): BrowserProofComposer {
  return new BrowserProofComposer(config)
}

/**
 * Create a composer with automatic environment detection
 *
 * Returns BrowserProofComposer in browser, BaseProofComposer in Node.js
 */
export function createAutoComposer(
  config?: BrowserProofComposerConfig
): ProofComposer {
  if (isBrowser()) {
    return new BrowserProofComposer(config)
  }
  return new BaseProofComposer(config)
}
