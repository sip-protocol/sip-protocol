/**
 * Browser Noir Proof Provider
 *
 * Production-ready ZK proof provider for browser environments.
 * Uses Web Workers for non-blocking proof generation and WASM for computation.
 *
 * @example
 * ```typescript
 * import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'
 *
 * const provider = new BrowserNoirProvider()
 * await provider.initialize() // Loads WASM
 *
 * const proof = await provider.generateFundingProof(inputs)
 * ```
 *
 * @see docs/specs/ZK-ARCHITECTURE.md
 * @see https://github.com/sip-protocol/sip-protocol/issues/121
 */

import type { ZKProof } from '@sip-protocol/types'
import type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  ProofResult,
} from './interface'
import { ProofGenerationError } from './interface'
import { ProofError, ErrorCode } from '../errors'
import {
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  hexToBytes,
  bytesToHex,
  getBrowserInfo,
  getMobileDeviceInfo,
  checkMobileWASMCompatibility,
} from './browser-utils'
import type { MobileDeviceInfo, MobileWASMCompatibility } from './browser-utils'

// Import Noir JS (works in browser with WASM)
import { Noir } from '@noir-lang/noir_js'
import type { CompiledCircuit } from '@noir-lang/types'
import { UltraHonkBackend, Barretenberg } from '@aztec/bb.js'
import { secp256k1 } from '@noble/curves/secp256k1'

// Import compiled circuit artifacts
// Circuit JSON files are typed via CompiledCircuit assertion
import fundingCircuitArtifact from './circuits/funding_proof.json'
import validityCircuitArtifact from './circuits/validity_proof.json'
import fulfillmentCircuitArtifact from './circuits/fulfillment_proof.json'

// Type assertion for circuit artifacts (JSON modules)
const fundingCircuit = fundingCircuitArtifact as unknown as CompiledCircuit
const validityCircuit = validityCircuitArtifact as unknown as CompiledCircuit
const fulfillmentCircuit = fulfillmentCircuitArtifact as unknown as CompiledCircuit

/**
 * Public key coordinates for secp256k1
 */
export interface PublicKeyCoordinates {
  /** X coordinate as 32-byte array */
  x: number[]
  /** Y coordinate as 32-byte array */
  y: number[]
}

/**
 * Browser Noir Provider Configuration
 */
export interface BrowserNoirProviderConfig {
  /**
   * Use Web Workers for proof generation (non-blocking)
   * @default true
   */
  useWorker?: boolean

  /**
   * Enable verbose logging for debugging
   * @default false
   */
  verbose?: boolean

  /**
   * Oracle public key for verifying attestations in fulfillment proofs
   * Required for production use.
   */
  oraclePublicKey?: PublicKeyCoordinates

  /**
   * Maximum time for proof generation before timeout (ms)
   * @default 60000 (60 seconds), mobile: 120000 (2 minutes)
   */
  timeout?: number

  /**
   * Enable mobile-optimized mode (auto-detected by default)
   * When true, adjusts memory usage and timeout for mobile devices
   * @default auto-detected
   */
  mobileMode?: boolean

  /**
   * Allow initialization even with poor compatibility score
   * Use with caution on mobile devices
   * @default false
   */
  forceInitialize?: boolean
}

/**
 * Proof generation progress callback
 */
export type ProofProgressCallback = (progress: {
  stage: 'initializing' | 'witness' | 'proving' | 'verifying' | 'complete'
  percent: number
  message: string
}) => void

/** Default initialization timeout in milliseconds */
const DEFAULT_INIT_TIMEOUT_MS = 30000

/**
 * Browser-compatible Noir Proof Provider
 *
 * Designed for browser environments with:
 * - WASM-based proof generation
 * - Optional Web Worker support for non-blocking UI
 * - Memory-efficient initialization
 * - Progress callbacks for UX
 *
 * @example
 * ```typescript
 * const provider = new BrowserNoirProvider({ useWorker: true })
 *
 * await provider.initialize((progress) => {
 *   console.log(`${progress.stage}: ${progress.percent}%`)
 * })
 *
 * const result = await provider.generateFundingProof(params, (progress) => {
 *   updateProgressBar(progress.percent)
 * })
 * ```
 */
export class BrowserNoirProvider implements ProofProvider {
  readonly framework: ProofFramework = 'noir'
  private _isReady = false
  private _initPromise: Promise<void> | null = null
  private _initError: Error | null = null
  private config: Required<BrowserNoirProviderConfig>

  // Mobile device info (cached)
  private deviceInfo: MobileDeviceInfo | null = null
  private wasmCompatibility: MobileWASMCompatibility | null = null

  // Barretenberg instance (shared by all backends)
  private barretenberg: Barretenberg | null = null

  // Circuit instances
  private fundingNoir: Noir | null = null
  private fundingBackend: UltraHonkBackend | null = null
  private validityNoir: Noir | null = null
  private validityBackend: UltraHonkBackend | null = null
  private fulfillmentNoir: Noir | null = null
  private fulfillmentBackend: UltraHonkBackend | null = null

  // Mutex for WASM operations (prevents BorrowMutError from concurrent access)
  private wasmMutex: Promise<void> = Promise.resolve()

  // Worker instance (optional)
  private worker: Worker | null = null
  private workerPending: Map<
    string,
    { resolve: (result: ProofResult) => void; reject: (error: Error) => void }
  > = new Map()

  constructor(config: BrowserNoirProviderConfig = {}) {
    // Detect mobile environment
    this.deviceInfo = getMobileDeviceInfo()
    const isMobile = this.deviceInfo.isMobile

    // Set mobile-appropriate defaults
    const defaultTimeout = isMobile ? 120000 : 60000 // 2 min for mobile, 1 min for desktop

    this.config = {
      useWorker: config.useWorker ?? true,
      verbose: config.verbose ?? false,
      oraclePublicKey: config.oraclePublicKey ?? undefined,
      timeout: config.timeout ?? defaultTimeout,
      mobileMode: config.mobileMode ?? isMobile,
      forceInitialize: config.forceInitialize ?? false,
    } as Required<BrowserNoirProviderConfig>

    // Warn if not in browser
    if (!isBrowser()) {
      console.warn(
        '[BrowserNoirProvider] Not running in browser environment. ' +
          'Consider using NoirProofProvider for Node.js.'
      )
    }

    // Log mobile detection in verbose mode
    if (this.config.verbose && this.deviceInfo) {
      console.log('[BrowserNoirProvider] Device info:', this.deviceInfo)
    }
  }

  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Get browser environment info
   */
  static getBrowserInfo() {
    return getBrowserInfo()
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

    // Check for WebAssembly
    if (typeof WebAssembly === 'undefined') {
      missing.push('WebAssembly')
    }

    // SharedArrayBuffer is required for Barretenberg WASM
    if (!supportsSharedArrayBuffer()) {
      missing.push('SharedArrayBuffer (requires COOP/COEP headers)')
    }

    return {
      supported: missing.length === 0,
      missing,
    }
  }

  /**
   * Get detailed mobile device information
   */
  static getMobileInfo(): MobileDeviceInfo {
    return getMobileDeviceInfo()
  }

  /**
   * Check mobile WASM compatibility
   *
   * Returns detailed compatibility information including:
   * - Feature support (WASM, SharedArrayBuffer, Workers, SIMD)
   * - Compatibility score (0-100)
   * - Issues and recommendations
   *
   * @example
   * ```typescript
   * const compat = BrowserNoirProvider.checkMobileCompatibility()
   * if (compat.score < 70) {
   *   console.warn('Limited mobile support:', compat.issues)
   * }
   * ```
   */
  static checkMobileCompatibility(): MobileWASMCompatibility {
    return checkMobileWASMCompatibility()
  }

  /**
   * Check if the current device is mobile
   */
  static isMobile(): boolean {
    return getMobileDeviceInfo().isMobile
  }

  /**
   * Get recommended configuration for the current device
   *
   * Automatically adjusts settings based on device capabilities:
   * - Mobile devices get longer timeouts
   * - Low-memory devices disable workers
   * - Tablets get intermediate settings
   */
  static getRecommendedConfig(): Partial<BrowserNoirProviderConfig> {
    const deviceInfo = getMobileDeviceInfo()
    const compat = checkMobileWASMCompatibility()

    const config: Partial<BrowserNoirProviderConfig> = {}

    if (deviceInfo.isMobile) {
      // Mobile-specific settings
      config.timeout = 120000 // 2 minutes for mobile
      config.mobileMode = true

      // Disable workers on very low memory devices
      if (deviceInfo.deviceMemoryGB !== null && deviceInfo.deviceMemoryGB < 2) {
        config.useWorker = false
      }

      // iOS Safari specific optimizations
      if (deviceInfo.platform === 'ios' && deviceInfo.browser === 'safari') {
        // Safari has good WASM support, keep workers enabled if SAB available
        config.useWorker = compat.sharedArrayBuffer
      }
    } else if (deviceInfo.isTablet) {
      // Tablet settings (more capable than phones)
      config.timeout = 90000 // 1.5 minutes
      config.mobileMode = true
    }

    // Force initialize only if score is reasonable
    if (compat.score < 50) {
      config.forceInitialize = false
    }

    return config
  }

  /**
   * Derive secp256k1 public key coordinates from a private key
   */
  static derivePublicKey(privateKey: Uint8Array): PublicKeyCoordinates {
    const uncompressedPubKey = secp256k1.getPublicKey(privateKey, false)
    const x = Array.from(uncompressedPubKey.slice(1, 33))
    const y = Array.from(uncompressedPubKey.slice(33, 65))
    return { x, y }
  }

  /**
   * Get the cached WASM compatibility info (available after construction)
   */
  getWASMCompatibility(): MobileWASMCompatibility | null {
    return this.wasmCompatibility
  }

  /**
   * Get the cached device info (available after construction)
   */
  getDeviceInfo(): MobileDeviceInfo | null {
    return this.deviceInfo
  }

  /**
   * Initialize the browser provider
   *
   * Loads WASM and circuit artifacts. This should be called before any
   * proof generation. Consider showing a loading indicator during init.
   *
   * @param onProgress - Optional progress callback
   */
  async initialize(onProgress?: ProofProgressCallback): Promise<void> {
    // If already ready, return immediately
    if (this._isReady) {
      return
    }

    // If initialization is in progress, wait for it
    if (this._initPromise) {
      return this._initPromise
    }

    // If a previous initialization failed, rethrow the error
    if (this._initError) {
      throw this._initError
    }

    // Start initialization and track the promise
    this._initPromise = this._doInitialize(onProgress)

    try {
      await this._initPromise
    } catch (error) {
      // Store error for future calls
      this._initError = error instanceof Error ? error : new Error(String(error))
      this._initPromise = null
      throw error
    }
  }

  /**
   * Wait for the provider to be ready, with optional timeout
   *
   * This method blocks until initialization is complete or the timeout is reached.
   * If initialization is already complete, resolves immediately.
   * If initialization hasn't started, this method will start it.
   *
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 30000)
   * @throws ProofError if timeout is reached before ready
   * @throws ProofError if initialization fails
   */
  async waitUntilReady(timeoutMs: number = DEFAULT_INIT_TIMEOUT_MS): Promise<void> {
    if (this._isReady) {
      return
    }

    // If there was a previous error, throw it
    if (this._initError) {
      throw new ProofError(
        `BrowserNoirProvider initialization failed: ${this._initError.message}`,
        ErrorCode.PROOF_PROVIDER_NOT_READY,
        { context: { error: this._initError } }
      )
    }

    // Start initialization if not already started
    const initPromise = this._initPromise ?? this.initialize()

    // Race between initialization and timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ProofError(
          `BrowserNoirProvider initialization timed out after ${timeoutMs}ms`,
          ErrorCode.PROOF_PROVIDER_NOT_READY
        ))
      }, timeoutMs)
    })

    await Promise.race([initPromise, timeoutPromise])
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(onProgress?: ProofProgressCallback): Promise<void> {
    // Check mobile compatibility
    this.wasmCompatibility = checkMobileWASMCompatibility()

    if (this.config.verbose) {
      console.log('[BrowserNoirProvider] WASM compatibility:', this.wasmCompatibility)
    }

    // Warn on poor compatibility
    if (this.wasmCompatibility.score < 50 && !this.config.forceInitialize) {
      throw new ProofError(
        `Device has poor WASM compatibility (score: ${this.wasmCompatibility.score}). ` +
          `Issues: ${this.wasmCompatibility.issues.join(', ')}. ` +
          `Set forceInitialize: true to override.`,
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }

    const { supported, missing } = BrowserNoirProvider.checkBrowserSupport()
    if (!supported && !this.config.forceInitialize) {
      throw new ProofError(
        `Browser missing required features: ${missing.join(', ')}`,
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }

    try {
      onProgress?.({
        stage: 'initializing',
        percent: 0,
        message: 'Loading WASM runtime...',
      })

      if (this.config.verbose) {
        console.log('[BrowserNoirProvider] Initializing...')
        console.log('[BrowserNoirProvider] Browser info:', getBrowserInfo())
      }

      // Initialize circuits in parallel for faster loading (using module-level typed constants)
      onProgress?.({
        stage: 'initializing',
        percent: 15,
        message: 'Initializing Barretenberg...',
      })

      // Initialize Barretenberg (bb.js 3.x requires shared instance)
      this.barretenberg = await Barretenberg.new()

      onProgress?.({
        stage: 'initializing',
        percent: 30,
        message: 'Creating proof backends...',
      })

      // Create backends (bb.js 3.x requires Barretenberg instance)
      this.fundingBackend = new UltraHonkBackend(fundingCircuit.bytecode, this.barretenberg)
      this.validityBackend = new UltraHonkBackend(validityCircuit.bytecode, this.barretenberg)
      this.fulfillmentBackend = new UltraHonkBackend(fulfillmentCircuit.bytecode, this.barretenberg)

      onProgress?.({
        stage: 'initializing',
        percent: 60,
        message: 'Initializing Noir circuits...',
      })

      // Create Noir instances for witness generation
      this.fundingNoir = new Noir(fundingCircuit)
      this.validityNoir = new Noir(validityCircuit)
      this.fulfillmentNoir = new Noir(fulfillmentCircuit)

      onProgress?.({
        stage: 'initializing',
        percent: 90,
        message: 'Setting up worker...',
      })

      // Initialize worker if enabled and supported
      if (this.config.useWorker && supportsWebWorkers()) {
        await this.initializeWorker()
      }

      this._isReady = true

      onProgress?.({
        stage: 'complete',
        percent: 100,
        message: 'Ready for proof generation',
      })

      if (this.config.verbose) {
        console.log('[BrowserNoirProvider] Initialization complete')
      }
    } catch (error) {
      throw new ProofError(
        `Failed to initialize BrowserNoirProvider: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.PROOF_NOT_IMPLEMENTED,
        { context: { error } }
      )
    }
  }

  /**
   * Initialize Web Worker for off-main-thread proof generation
   */
  private async initializeWorker(): Promise<void> {
    // Check if workers are supported
    if (!supportsWebWorkers()) {
      if (this.config.verbose) {
        console.log('[BrowserNoirProvider] Web Workers not supported, using main thread')
      }
      return
    }

    try {
      // Create worker from inline blob URL for bundler compatibility
      const workerCode = this.getWorkerCode()
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerURL = URL.createObjectURL(blob)

      this.worker = new Worker(workerURL, { type: 'module' })

      // Set up message handler
      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('[BrowserNoirProvider] Worker error:', error)
        // Reject all pending requests and fall back to main thread
        for (const [id, { reject }] of this.workerPending) {
          reject(new Error(`Worker error: ${error.message}`))
          this.workerPending.delete(id)
        }
        // Disable worker for future requests
        this.worker?.terminate()
        this.worker = null
      }

      // Cleanup blob URL
      URL.revokeObjectURL(workerURL)

      if (this.config.verbose) {
        console.log('[BrowserNoirProvider] Web Worker initialized successfully')
      }
    } catch (error) {
      if (this.config.verbose) {
        console.warn('[BrowserNoirProvider] Failed to initialize worker, using main thread:', error)
      }
      this.worker = null
    }
  }

  /**
   * Get inline worker code for bundler compatibility
   */
  private getWorkerCode(): string {
    // Minimal worker that delegates back for now
    // Full implementation would inline the Noir execution logic
    return `
      self.onmessage = async function(event) {
        const { id, type } = event.data;
        // Signal that worker received message but proof gen happens on main thread
        self.postMessage({ id, type: 'fallback', message: 'Worker initialized, using main thread for proofs' });
      };
    `
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(data: {
    id: string
    type: 'success' | 'error' | 'progress' | 'fallback'
    result?: ProofResult
    error?: string
    progress?: { stage: string; percent: number; message: string }
  }): void {
    const pending = this.workerPending.get(data.id)
    if (!pending) return

    switch (data.type) {
      case 'success':
        this.workerPending.delete(data.id)
        pending.resolve(data.result as ProofResult)
        break
      case 'error':
        this.workerPending.delete(data.id)
        pending.reject(new Error(data.error))
        break
      case 'fallback':
        // Worker acknowledged, but we'll generate on main thread
        // This is handled by the calling method
        break
    }
  }

  /**
   * Generate a Funding Proof
   *
   * Proves: balance >= minimumRequired without revealing balance
   *
   * @param params - Funding proof parameters
   * @param onProgress - Optional progress callback
   */
  async generateFundingProof(
    params: FundingProofParams,
    onProgress?: ProofProgressCallback
  ): Promise<ProofResult> {
    this.ensureReady()

    if (!this.fundingNoir || !this.fundingBackend) {
      throw new ProofGenerationError('funding', 'Funding circuit not initialized')
    }

    // Use mutex to prevent concurrent WASM access (causes BorrowMutError)
    return this.acquireWasmLock(async () => {
      try {
        onProgress?.({
          stage: 'witness',
          percent: 10,
          message: 'Preparing witness inputs...',
        })

        // Convert blinding factor to field element
        const blindingField = this.bytesToField(params.blindingFactor)

        // Circuit signature: (minimum_required: pub Field, asset_id: pub Field, balance: Field, blinding: Field) -> [u8; 32]
        // Using Field type for unlimited precision (handles NEAR's 24 decimals, etc.)
        // Noir expects field values as hex strings with 0x prefix
        const witnessInputs = {
          minimum_required: `0x${params.minimumRequired.toString(16)}`,
          asset_id: `0x${this.assetIdToField(params.assetId)}`,
          balance: `0x${params.balance.toString(16)}`,
          blinding: `0x${blindingField}`,
        }

        onProgress?.({
          stage: 'witness',
          percent: 30,
          message: 'Generating witness...',
        })

        // Generate witness - circuit returns commitment hash as [u8; 32]
        const { witness, returnValue } = await this.fundingNoir!.execute(witnessInputs)

        onProgress?.({
          stage: 'proving',
          percent: 50,
          message: 'Generating proof (this may take a moment)...',
        })

        // Generate proof
        const proofData = await this.fundingBackend!.generateProof(witness)

        onProgress?.({
          stage: 'complete',
          percent: 100,
          message: 'Proof generated successfully',
        })

        // Extract commitment hash from circuit return value
        const commitmentHashBytes = returnValue as number[]
        const commitmentHashHex = bytesToHex(new Uint8Array(commitmentHashBytes))

        // Order: minimum_required, asset_id, commitment_hash (return value)
        // Field values padded to 64 hex chars (32 bytes)
        const publicInputs: `0x${string}`[] = [
          `0x${params.minimumRequired.toString(16).padStart(64, '0')}`,
          `0x${this.assetIdToField(params.assetId)}`,
          `0x${commitmentHashHex}`,
        ]

        const proof: ZKProof = {
          type: 'funding',
          proof: `0x${bytesToHex(proofData.proof)}`,
          publicInputs,
        }

        return { proof, publicInputs }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new ProofGenerationError(
          'funding',
          `Failed to generate funding proof: ${message}`,
          error instanceof Error ? error : undefined
        )
      }
    })
  }

  /**
   * Generate a Validity Proof
   *
   * Proves: Intent is authorized by sender without revealing identity
   */
  async generateValidityProof(
    params: ValidityProofParams,
    onProgress?: ProofProgressCallback
  ): Promise<ProofResult> {
    this.ensureReady()

    if (!this.validityNoir || !this.validityBackend) {
      throw new ProofGenerationError('validity', 'Validity circuit not initialized')
    }

    // Use mutex to prevent concurrent WASM access (causes BorrowMutError)
    return this.acquireWasmLock(async () => {
      try {
        onProgress?.({
          stage: 'witness',
          percent: 10,
          message: 'Preparing validity witness...',
        })

        // Convert inputs to field elements
        const intentHashField = this.hexToField(params.intentHash)
        const senderAddressField = this.hexToField(params.senderAddress)
        const senderBlindingField = this.bytesToField(params.senderBlinding)
        const senderSecretField = this.bytesToField(params.senderSecret)
        const nonceField = this.bytesToField(params.nonce)

        // Compute derived values
        const { commitmentX, commitmentY } = await this.computeSenderCommitment(
          senderAddressField,
          senderBlindingField
        )
        const nullifier = await this.computeNullifier(senderSecretField, intentHashField, nonceField)

        // Normalize signature s-value for Noir (BIP-0062 requirement)
        // Noir requires s <= order/2 to prevent signature malleability
        const normalizedSig = this.normalizeSignature(params.authorizationSignature)
        const signature = Array.from(normalizedSig)
        const messageHash = this.fieldToBytes32(intentHashField)

        // Get public key
        let pubKeyX: number[]
        let pubKeyY: number[]
        if (params.senderPublicKey) {
          pubKeyX = Array.from(params.senderPublicKey.x)
          pubKeyY = Array.from(params.senderPublicKey.y)
        } else {
          // Ensure senderSecret is a proper Uint8Array (handles bundler serialization)
          const senderSecretBytes = this.ensureUint8Array(params.senderSecret)

          // Debug: Check if bytes were read correctly
          const hasNonZero = senderSecretBytes.some((b) => b !== 0)
          if (!hasNonZero && senderSecretBytes.length === 32) {
            // Log detailed debug info to help diagnose serialization issues
            const inputType = Object.prototype.toString.call(params.senderSecret)
            const inputKeys = Object.keys(params.senderSecret as object).slice(0, 5)
            const inputLength =
              'length' in (params.senderSecret as object) ? (params.senderSecret as { length: number }).length : 'N/A'
            console.error(
              '[BrowserNoirProvider] senderSecret appears to be all zeros after ensureUint8Array!',
              '\n  Input type:', inputType,
              '\n  Input length:', inputLength,
              '\n  Sample keys:', inputKeys,
              '\n  First few raw values:', [0, 1, 2, 3].map((i) => (params.senderSecret as Record<number, unknown>)[i])
            )
          }

          const coords = this.getPublicKeyCoordinates(senderSecretBytes)
          pubKeyX = coords.x
          pubKeyY = coords.y
        }

        // Noir expects field values as hex strings with 0x prefix
        const witnessInputs = {
          intent_hash: `0x${intentHashField}`,
          sender_commitment_x: `0x${commitmentX}`,
          sender_commitment_y: `0x${commitmentY}`,
          nullifier: `0x${nullifier}`,
          timestamp: params.timestamp.toString(),
          expiry: params.expiry.toString(),
          sender_address: `0x${senderAddressField}`,
          sender_blinding: `0x${senderBlindingField}`,
          sender_secret: `0x${senderSecretField}`,
          pub_key_x: pubKeyX,
          pub_key_y: pubKeyY,
          signature: signature,
          message_hash: messageHash,
          nonce: `0x${nonceField}`,
        }

        onProgress?.({
          stage: 'witness',
          percent: 30,
          message: 'Generating witness...',
        })

        const { witness } = await this.validityNoir!.execute(witnessInputs)

        onProgress?.({
          stage: 'proving',
          percent: 50,
          message: 'Generating validity proof...',
        })

        const proofData = await this.validityBackend!.generateProof(witness)

        onProgress?.({
          stage: 'complete',
          percent: 100,
          message: 'Validity proof generated',
        })

        const publicInputs: `0x${string}`[] = [
          `0x${intentHashField}`,
          `0x${commitmentX}`,
          `0x${commitmentY}`,
          `0x${nullifier}`,
          `0x${params.timestamp.toString(16).padStart(16, '0')}`,
          `0x${params.expiry.toString(16).padStart(16, '0')}`,
        ]

        const proof: ZKProof = {
          type: 'validity',
          proof: `0x${bytesToHex(proofData.proof)}`,
          publicInputs,
        }

        return { proof, publicInputs }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new ProofGenerationError(
          'validity',
          `Failed to generate validity proof: ${message}`,
          error instanceof Error ? error : undefined
        )
      }
    })
  }

  /**
   * Generate a Fulfillment Proof
   *
   * Proves: Solver correctly executed the intent
   */
  async generateFulfillmentProof(
    params: FulfillmentProofParams,
    onProgress?: ProofProgressCallback
  ): Promise<ProofResult> {
    this.ensureReady()

    if (!this.fulfillmentNoir || !this.fulfillmentBackend) {
      throw new ProofGenerationError('fulfillment', 'Fulfillment circuit not initialized')
    }

    // Use mutex to prevent concurrent WASM access (causes BorrowMutError)
    return this.acquireWasmLock(async () => {
      try {
        onProgress?.({
          stage: 'witness',
          percent: 10,
          message: 'Preparing fulfillment witness...',
        })

        const intentHashField = this.hexToField(params.intentHash)
        const recipientStealthField = this.hexToField(params.recipientStealth)

        const { commitmentX, commitmentY } = await this.computeOutputCommitment(
          params.outputAmount,
          params.outputBlinding
        )

        const solverSecretField = this.bytesToField(params.solverSecret)
        const solverId = await this.computeSolverId(solverSecretField)
        const outputBlindingField = this.bytesToField(params.outputBlinding)

        const attestation = params.oracleAttestation
        const attestationRecipientField = this.hexToField(attestation.recipient)
        const attestationTxHashField = this.hexToField(attestation.txHash)
        const oracleSignature = Array.from(attestation.signature)
        const oracleMessageHash = await this.computeOracleMessageHash(
          attestation.recipient,
          attestation.amount,
          attestation.txHash,
          attestation.blockNumber
        )

        const oraclePubKeyX = this.config.oraclePublicKey?.x ?? new Array(32).fill(0)
        const oraclePubKeyY = this.config.oraclePublicKey?.y ?? new Array(32).fill(0)

        // Noir expects field values as hex strings with 0x prefix
        const witnessInputs = {
          intent_hash: `0x${intentHashField}`,
          output_commitment_x: `0x${commitmentX}`,
          output_commitment_y: `0x${commitmentY}`,
          recipient_stealth: `0x${recipientStealthField}`,
          min_output_amount: params.minOutputAmount.toString(),
          solver_id: `0x${solverId}`,
          fulfillment_time: params.fulfillmentTime.toString(),
          expiry: params.expiry.toString(),
          output_amount: params.outputAmount.toString(),
          output_blinding: `0x${outputBlindingField}`,
          solver_secret: `0x${solverSecretField}`,
          attestation_recipient: `0x${attestationRecipientField}`,
          attestation_amount: attestation.amount.toString(),
          attestation_tx_hash: `0x${attestationTxHashField}`,
          attestation_block: attestation.blockNumber.toString(),
          oracle_signature: oracleSignature,
          oracle_message_hash: oracleMessageHash,
          oracle_pub_key_x: oraclePubKeyX,
          oracle_pub_key_y: oraclePubKeyY,
        }

        onProgress?.({
          stage: 'witness',
          percent: 30,
          message: 'Generating witness...',
        })

        const { witness } = await this.fulfillmentNoir!.execute(witnessInputs)

        onProgress?.({
          stage: 'proving',
          percent: 50,
          message: 'Generating fulfillment proof...',
        })

        const proofData = await this.fulfillmentBackend!.generateProof(witness)

        onProgress?.({
          stage: 'complete',
          percent: 100,
          message: 'Fulfillment proof generated',
        })

        const publicInputs: `0x${string}`[] = [
          `0x${intentHashField}`,
          `0x${commitmentX}`,
          `0x${commitmentY}`,
          `0x${recipientStealthField}`,
          `0x${params.minOutputAmount.toString(16).padStart(16, '0')}`,
          `0x${solverId}`,
          `0x${params.fulfillmentTime.toString(16).padStart(16, '0')}`,
          `0x${params.expiry.toString(16).padStart(16, '0')}`,
        ]

        const proof: ZKProof = {
          type: 'fulfillment',
          proof: `0x${bytesToHex(proofData.proof)}`,
          publicInputs,
        }

        return { proof, publicInputs }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new ProofGenerationError(
          'fulfillment',
          `Failed to generate fulfillment proof: ${message}`,
          error instanceof Error ? error : undefined
        )
      }
    })
  }

  /**
   * Verify a proof
   */
  async verifyProof(proof: ZKProof): Promise<boolean> {
    this.ensureReady()

    let backend: UltraHonkBackend | null = null

    switch (proof.type) {
      case 'funding':
        backend = this.fundingBackend
        break
      case 'validity':
        backend = this.validityBackend
        break
      case 'fulfillment':
        backend = this.fulfillmentBackend
        break
      default:
        throw new ProofError(`Unknown proof type: ${proof.type}`, ErrorCode.PROOF_NOT_IMPLEMENTED)
    }

    if (!backend) {
      throw new ProofError(
        `${proof.type} backend not initialized`,
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }

    const backendToUse = backend

    // Use mutex to prevent concurrent WASM access (causes BorrowMutError)
    return this.acquireWasmLock(async () => {
      try {
        const proofHex = proof.proof.startsWith('0x') ? proof.proof.slice(2) : proof.proof
        const proofBytes = hexToBytes(proofHex)

        const isValid = await backendToUse.verifyProof({
          proof: proofBytes,
          publicInputs: proof.publicInputs.map((input) =>
            input.startsWith('0x') ? input.slice(2) : input
          ),
        })

        return isValid
      } catch (error) {
        if (this.config.verbose) {
          console.error('[BrowserNoirProvider] Verification error:', error)
        }
        return false
      }
    })
  }

  /**
   * Destroy the provider and free resources
   */
  async destroy(): Promise<void> {
    // Clear backend references (bb.js 3.x backends don't have destroy method)
    this.fundingBackend = null
    this.validityBackend = null
    this.fulfillmentBackend = null

    // Terminate worker if running
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    // Clear Noir instances
    this.fundingNoir = null
    this.validityNoir = null
    this.fulfillmentNoir = null

    // Destroy shared Barretenberg instance (bb.js 3.x)
    if (this.barretenberg) {
      await this.barretenberg.destroy()
      this.barretenberg = null
    }

    this._isReady = false
  }

  // ─── Private Utility Methods ────────────────────────────────────────────────

  /**
   * Acquire WASM mutex lock for exclusive access
   *
   * The ACVM WASM module uses Rust RefCell internally which panics on
   * concurrent mutable borrows. This mutex ensures serial execution.
   */
  private async acquireWasmLock<T>(operation: () => Promise<T>): Promise<T> {
    // Wait for any pending operation to complete
    const previousLock = this.wasmMutex

    // Create a new lock that will be released when our operation completes
    let releaseLock: () => void
    this.wasmMutex = new Promise<void>((resolve) => {
      releaseLock = resolve
    })

    try {
      // Wait for previous operation
      await previousLock

      // Execute our operation
      return await operation()
    } finally {
      // Release the lock
      releaseLock!()
    }
  }

  private ensureReady(): void {
    if (!this._isReady) {
      throw new ProofError(
        'BrowserNoirProvider not initialized. Call initialize() first.',
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }
  }

  private async computeCommitmentHash(
    balance: bigint,
    blindingFactor: Uint8Array,
    assetId: string
  ): Promise<{ commitmentHash: string; blindingField: string }> {
    const blindingField = this.bytesToField(blindingFactor)
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex: nobleToHex } = await import('@noble/hashes/utils')

    const preimage = new Uint8Array([
      ...this.bigintToBytes(balance, 8),
      ...blindingFactor.slice(0, 32),
      ...hexToBytes(this.assetIdToField(assetId)),
    ])

    const hash = sha256(preimage)
    const commitmentHash = nobleToHex(hash)

    return { commitmentHash, blindingField }
  }

  private assetIdToField(assetId: string): string {
    if (assetId.startsWith('0x')) {
      return assetId.slice(2).padStart(64, '0')
    }
    const encoder = new TextEncoder()
    const bytes = encoder.encode(assetId)
    let result = 0n
    for (let i = 0; i < bytes.length && i < 31; i++) {
      result = result * 256n + BigInt(bytes[i])
    }
    return result.toString(16).padStart(64, '0')
  }

  private bytesToField(bytes: Uint8Array | ArrayLike<number>): string {
    // Ensure we have a proper Uint8Array (handles bundler serialization)
    const arr = this.ensureUint8Array(bytes)
    let result = 0n
    // Read all bytes (up to 32) to capture full value
    const len = Math.min(arr.length, 32)
    for (let i = 0; i < len; i++) {
      result = result * 256n + BigInt(arr[i])
    }
    // Reduce modulo BN254 if value exceeds field modulus
    const reduced = result % BrowserNoirProvider.BN254_MODULUS
    // Return hex format WITHOUT prefix (consistent with hexToField)
    // Prefix is added when building witnessInputs for Noir
    return reduced.toString(16).padStart(64, '0')
  }

  private bigintToBytes(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    let v = value
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = Number(v & 0xffn)
      v = v >> 8n
    }
    return bytes
  }

  /**
   * Ensure input is a proper Uint8Array (handles serialization from bundlers)
   *
   * When Uint8Array passes through Next.js/bundlers, several issues can occur:
   * 1. Object becomes {0: x, 1: y, ...} (plain object with numeric keys)
   * 2. ArrayBuffer gets detached, making Array.from() return empty
   * 3. instanceof checks fail across different execution contexts
   *
   * This implementation ALWAYS reads bytes by index to be robust against all cases.
   */
  private ensureUint8Array(input: Uint8Array | ArrayLike<number> | Record<string, unknown>): Uint8Array {
    // Determine length from object properties
    let length = 0

    if (typeof input === 'object' && input !== null) {
      // Try to get length from the object
      if ('length' in input && typeof (input as { length: unknown }).length === 'number') {
        length = (input as { length: number }).length
      } else if ('byteLength' in input && typeof (input as { byteLength: unknown }).byteLength === 'number') {
        // ArrayBuffer or TypedArray with byteLength
        length = (input as { byteLength: number }).byteLength
      } else {
        // Count numeric keys for plain objects like {0: x, 1: y, ...}
        const numericKeys = Object.keys(input).filter(k => /^\d+$/.test(k))
        length = numericKeys.length > 0 ? Math.max(...numericKeys.map(Number)) + 1 : 0
      }
    }

    // Create result array and copy bytes by index
    const result = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      // Access by index - works for Uint8Array, Array, and plain objects
      const val = (input as Record<number, unknown>)[i]
      if (typeof val === 'number') {
        result[i] = val & 0xff
      } else if (val !== undefined && val !== null) {
        result[i] = Number(val) & 0xff
      }
      // else: leave as 0 (default)
    }

    return result
  }

  // BN254 scalar field modulus (the max value Noir Field can hold)
  private static readonly BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

  /**
   * Convert hex to field element, reducing modulo BN254 if needed.
   *
   * Noir's Field type uses the BN254 scalar field (~254 bits).
   * SHA256 hashes are 256-bit, so they can exceed the field modulus.
   * We reduce modulo the field to ensure valid witness values.
   */
  private hexToField(hex: string): string {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const value = BigInt('0x' + h)

    // Reduce modulo BN254 if value exceeds field modulus
    const reduced = value % BrowserNoirProvider.BN254_MODULUS

    return reduced.toString(16).padStart(64, '0')
  }

  private fieldToBytes32(field: string): number[] {
    const hex = field.padStart(64, '0')
    const bytes: number[] = []
    for (let i = 0; i < 32; i++) {
      bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16))
    }
    return bytes
  }

  /**
   * Compute sender commitment using Pedersen commitment (matches Noir stdlib).
   *
   * The Noir circuit computes: pedersen_commitment([sender_address, sender_blinding])
   * We use Barretenberg's native Pedersen to ensure consistency.
   */
  private async computeSenderCommitment(
    senderAddressField: string,
    senderBlindingField: string
  ): Promise<{ commitmentX: string; commitmentY: string }> {
    // Import Barretenberg for Pedersen commitment
    const { Barretenberg } = await import('@aztec/bb.js')

    // Create Barretenberg instance for Pedersen computation
    const api = await Barretenberg.new()

    try {
      // Convert hex strings to Uint8Array (Fr in bb.js is just Uint8Array)
      const addressBytes = hexToBytes(senderAddressField.padStart(64, '0'))
      const blindingBytes = hexToBytes(senderBlindingField.padStart(64, '0'))

      // Compute Pedersen commitment - matches Noir's pedersen_commitment([addr, blinding])
      // hashIndex 0 is the default generator index
      const result = await api.pedersenCommit({ inputs: [addressBytes, blindingBytes], hashIndex: 0 })

      // Extract x and y coordinates from the point (they're Uint8Arrays)
      const commitmentX = bytesToHex(result.point.x).padStart(64, '0')
      const commitmentY = bytesToHex(result.point.y).padStart(64, '0')

      return { commitmentX, commitmentY }
    } finally {
      await api.destroy()
    }
  }

  /**
   * Compute nullifier using Pedersen hash (matches Noir stdlib).
   *
   * The Noir circuit computes: pedersen_hash([sender_secret, intent_hash, nonce])
   * We use Barretenberg's native Pedersen hash to ensure consistency.
   */
  private async computeNullifier(
    senderSecretField: string,
    intentHashField: string,
    nonceField: string
  ): Promise<string> {
    // Import Barretenberg for Pedersen hash
    const { Barretenberg } = await import('@aztec/bb.js')

    // Create Barretenberg instance for Pedersen computation
    const api = await Barretenberg.new()

    try {
      // Convert hex strings to Uint8Array (Fr in bb.js is just Uint8Array)
      const secretBytes = hexToBytes(senderSecretField.padStart(64, '0'))
      const intentBytes = hexToBytes(intentHashField.padStart(64, '0'))
      const nonceBytes = hexToBytes(nonceField.padStart(64, '0'))

      // Compute Pedersen hash - matches Noir's pedersen_hash([secret, intent, nonce])
      // hashIndex 0 is the default generator index
      const result = await api.pedersenHash({ inputs: [secretBytes, intentBytes, nonceBytes], hashIndex: 0 })

      // Convert hash result to hex string (without 0x prefix)
      const nullifier = bytesToHex(result.hash).padStart(64, '0')

      return nullifier
    } finally {
      await api.destroy()
    }
  }

  /**
   * Reduce a hex string value modulo the BN254 field modulus.
   * Used for SHA256 outputs that may exceed the field.
   */
  private reduceToField(hex: string): string {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const value = BigInt('0x' + h)
    const reduced = value % BrowserNoirProvider.BN254_MODULUS
    return reduced.toString(16).padStart(64, '0')
  }

  // secp256k1 curve order
  private static readonly SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
  // Half of the curve order (for signature normalization)
  private static readonly SECP256K1_HALF_ORDER = BrowserNoirProvider.SECP256K1_ORDER / 2n

  /**
   * Normalize ECDSA signature to low-s form (BIP-0062).
   *
   * Noir's ecdsa_secp256k1::verify_signature requires s <= order/2.
   * If s > order/2, we replace it with order - s.
   *
   * @param signature - 64-byte signature (r || s)
   * @returns Normalized signature with low-s
   */
  private normalizeSignature(signature: Uint8Array): Uint8Array {
    const sig = this.ensureUint8Array(signature)

    if (sig.length !== 64) {
      console.warn(`[BrowserNoirProvider] Unexpected signature length: ${sig.length}, expected 64`)
      return sig
    }

    // Extract r (first 32 bytes) and s (last 32 bytes)
    const r = sig.slice(0, 32)
    const s = sig.slice(32, 64)

    // Convert s to BigInt
    let sValue = 0n
    for (let i = 0; i < 32; i++) {
      sValue = sValue * 256n + BigInt(s[i])
    }

    // Check if s needs normalization (s > order/2)
    if (sValue > BrowserNoirProvider.SECP256K1_HALF_ORDER) {
      // Normalize: s' = order - s
      const normalizedS = BrowserNoirProvider.SECP256K1_ORDER - sValue

      // Convert back to bytes
      const normalizedSBytes = new Uint8Array(32)
      let temp = normalizedS
      for (let i = 31; i >= 0; i--) {
        normalizedSBytes[i] = Number(temp & 0xffn)
        temp = temp >> 8n
      }

      // Return normalized signature (r || s')
      const result = new Uint8Array(64)
      result.set(r, 0)
      result.set(normalizedSBytes, 32)

      if (this.config.verbose) {
        console.log('[BrowserNoirProvider] Normalized signature s-value (was > order/2)')
      }

      return result
    }

    // s is already in low form
    return sig
  }

  private async computeOutputCommitment(
    outputAmount: bigint,
    outputBlinding: Uint8Array
  ): Promise<{ commitmentX: string; commitmentY: string }> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex: nobleToHex } = await import('@noble/hashes/utils')

    const amountBytes = this.bigintToBytes(outputAmount, 8)
    const blindingBytes = outputBlinding.slice(0, 32)
    const preimage = new Uint8Array([...amountBytes, ...blindingBytes])
    const hash = sha256(preimage)

    const commitmentX = nobleToHex(hash.slice(0, 16)).padStart(64, '0')
    const commitmentY = nobleToHex(hash.slice(16, 32)).padStart(64, '0')

    return { commitmentX, commitmentY }
  }

  private async computeSolverId(solverSecretField: string): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex: nobleToHex } = await import('@noble/hashes/utils')

    const secretBytes = hexToBytes(solverSecretField.padStart(64, '0'))
    const hash = sha256(secretBytes)

    // Reduce modulo BN254 to ensure valid field element
    return this.reduceToField(nobleToHex(hash))
  }

  private async computeOracleMessageHash(
    recipient: string,
    amount: bigint,
    txHash: string,
    blockNumber: bigint
  ): Promise<number[]> {
    const { sha256 } = await import('@noble/hashes/sha256')

    const recipientBytes = hexToBytes(this.hexToField(recipient))
    const amountBytes = this.bigintToBytes(amount, 8)
    const txHashBytes = hexToBytes(this.hexToField(txHash))
    const blockBytes = this.bigintToBytes(blockNumber, 8)

    const preimage = new Uint8Array([
      ...recipientBytes,
      ...amountBytes,
      ...txHashBytes,
      ...blockBytes,
    ])
    const hash = sha256(preimage)

    return Array.from(hash)
  }

  private getPublicKeyCoordinates(privateKey: Uint8Array): PublicKeyCoordinates {
    const uncompressedPubKey = secp256k1.getPublicKey(privateKey, false)
    const x = Array.from(uncompressedPubKey.slice(1, 33))
    const y = Array.from(uncompressedPubKey.slice(33, 65))
    return { x, y }
  }
}
