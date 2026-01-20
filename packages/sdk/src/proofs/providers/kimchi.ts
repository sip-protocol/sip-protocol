/**
 * Kimchi Proof Provider
 *
 * Implements ComposableProofProvider interface for Mina's Kimchi proof system.
 * Kimchi is the proving system behind Mina Protocol, providing succinct proofs
 * and efficient recursive composition via Pickles.
 *
 * Key features:
 * - Constant-size proofs (~22KB)
 * - Recursive proof composition (Pickles wrapper)
 * - Efficient verification
 * - Browser WASM support via o1js
 *
 * @see https://docs.minaprotocol.com/ for Kimchi documentation
 * @packageDocumentation
 */

import { randomBytes, bytesToHex } from '@noble/hashes/utils'

import type { HexString } from '@sip-protocol/types'
import {
  ProofAggregationStrategy,
} from '@sip-protocol/types'

import type {
  ComposableProofProvider,
} from '../composer/interface'

import type {
  ProofSystem,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  SingleProof,
} from '@sip-protocol/types'

import type {
  ProofGenerationRequest,
  ProofGenerationResult,
} from '../composer/types'

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Kimchi circuit configuration
 */
export interface KimchiCircuitConfig {
  /** Circuit identifier */
  id: string
  /** Circuit name */
  name: string
  /** Number of gates in the circuit */
  gateCount: number
  /** Public input count */
  publicInputCount: number
  /** Whether circuit uses recursion (Pickles) */
  usesRecursion: boolean
  /** Verification key hash (for caching) */
  verificationKeyHash?: string
}

/**
 * Kimchi provider configuration
 */
export interface KimchiProviderConfig {
  /**
   * Pre-configured circuits
   */
  circuits?: KimchiCircuitConfig[]

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean

  /**
   * Network for proof generation
   * @default 'testnet'
   */
  network?: 'mainnet' | 'testnet' | 'local'

  /**
   * Enable Pickles recursive proving
   * @default true
   */
  enablePickles?: boolean

  /**
   * Proof compilation cache directory
   */
  cacheDir?: string

  /**
   * Number of workers for parallel compilation
   * @default 2
   */
  compileWorkers?: number
}

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_KIMCHI_CONFIG: Required<KimchiProviderConfig> = {
  circuits: [],
  verbose: false,
  network: 'testnet',
  enablePickles: true,
  cacheDir: '',
  compileWorkers: 2,
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Standard Kimchi proof size (~22KB) */
const KIMCHI_PROOF_SIZE = 22 * 1024

/** Kimchi system version (o1js version) */
const KIMCHI_VERSION = '1.0.0'

// ─── Kimchi Provider ────────────────────────────────────────────────────────

/**
 * Kimchi Proof Provider
 *
 * Implements ComposableProofProvider for Mina's Kimchi proof system.
 *
 * @example
 * ```typescript
 * const provider = new KimchiProvider({
 *   enablePickles: true,
 *   network: 'testnet',
 * })
 *
 * await provider.initialize()
 *
 * const result = await provider.generateProof({
 *   circuitId: 'transfer_proof',
 *   privateInputs: { sender: '...', amount: '...' },
 *   publicInputs: { commitment: '...' },
 * })
 * ```
 */
export class KimchiProvider implements ComposableProofProvider {
  readonly system: ProofSystem = 'kimchi'

  private _config: Required<KimchiProviderConfig>
  private _status: ProofProviderStatus
  private _capabilities: ProofProviderCapabilities
  private _metrics: ProofProviderMetrics
  private _circuits: Map<string, KimchiCircuitConfig> = new Map()
  private _compiledCircuits: Map<string, { compiled: boolean; vkHash?: string }> = new Map()
  private _initPromise: Promise<void> | null = null
  private _initError: Error | null = null

  constructor(config: KimchiProviderConfig = {}) {
    this._config = { ...DEFAULT_KIMCHI_CONFIG, ...config }

    this._metrics = {
      proofsGenerated: 0,
      proofsVerified: 0,
      avgGenerationTimeMs: 0,
      avgVerificationTimeMs: 0,
      successRate: 1,
      memoryUsageBytes: 0,
    }

    this._status = {
      isReady: false,
      isBusy: false,
      queueLength: 0,
      metrics: this._metrics,
    }

    this._capabilities = {
      system: 'kimchi',
      supportsRecursion: this._config.enablePickles,
      supportsBatchVerification: true,
      supportsBrowser: true,
      supportsNode: true,
      maxProofSize: KIMCHI_PROOF_SIZE * 10, // Allow some overhead
      supportedStrategies: [
        ProofAggregationStrategy.SEQUENTIAL,
        ProofAggregationStrategy.PARALLEL,
        ProofAggregationStrategy.BATCH,
        ...(this._config.enablePickles ? [ProofAggregationStrategy.RECURSIVE] : []),
      ],
      availableCircuits: [],
    }

    // Pre-load circuit configs
    for (const circuit of this._config.circuits) {
      this._circuits.set(circuit.id, circuit)
    }
  }

  // ─── Properties ───────────────────────────────────────────────────────────

  get capabilities(): ProofProviderCapabilities {
    return {
      ...this._capabilities,
      availableCircuits: Array.from(this._circuits.keys()),
    }
  }

  get status(): ProofProviderStatus {
    return { ...this._status }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._status.isReady) return

    if (this._initPromise) {
      return this._initPromise
    }

    this._initPromise = this.doInitialize()
    return this._initPromise
  }

  private async doInitialize(): Promise<void> {
    try {
      if (this._config.verbose) {
        console.log('[KimchiProvider] Initializing...')
        console.log(`[KimchiProvider] Network: ${this._config.network}`)
        console.log(`[KimchiProvider] Pickles enabled: ${this._config.enablePickles}`)
      }

      // TODO: Initialize o1js/snarkyjs
      // For now, simulate initialization
      await this.simulateAsyncLoad()

      this._status.isReady = true

      if (this._config.verbose) {
        console.log('[KimchiProvider] Initialization complete')
        console.log(`[KimchiProvider] Available circuits: ${Array.from(this._circuits.keys()).join(', ') || 'none'}`)
      }
    } catch (error) {
      this._initError = error instanceof Error ? error : new Error(String(error))
      this._status.lastError = this._initError.message
      throw this._initError
    }
  }

  async waitUntilReady(timeoutMs = 30000): Promise<void> {
    if (this._status.isReady) return

    if (this._initError) {
      throw this._initError
    }

    if (!this._initPromise) {
      this._initPromise = this.doInitialize()
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`KimchiProvider initialization timed out after ${timeoutMs}ms`)), timeoutMs)
    })

    await Promise.race([this._initPromise, timeoutPromise])
  }

  async dispose(): Promise<void> {
    this._compiledCircuits.clear()
    this._status.isReady = false
    this._initPromise = null
    this._initError = null

    if (this._config.verbose) {
      console.log('[KimchiProvider] Disposed')
    }
  }

  // ─── Circuit Management ───────────────────────────────────────────────────

  getAvailableCircuits(): string[] {
    return Array.from(this._circuits.keys())
  }

  hasCircuit(circuitId: string): boolean {
    return this._circuits.has(circuitId)
  }

  /**
   * Register a circuit configuration
   */
  registerCircuit(config: KimchiCircuitConfig): void {
    this._circuits.set(config.id, config)

    if (this._config.verbose) {
      console.log(`[KimchiProvider] Registered circuit: ${config.id} (${config.gateCount} gates)`)
    }
  }

  /**
   * Compile a circuit for proof generation
   *
   * Compiling in Kimchi/o1js creates the verification key and prepares
   * the circuit for proving.
   */
  async compileCircuit(circuitId: string): Promise<string> {
    const circuit = this._circuits.get(circuitId)
    if (!circuit) {
      throw new Error(`Circuit not found: ${circuitId}`)
    }

    if (this._config.verbose) {
      console.log(`[KimchiProvider] Compiling circuit: ${circuitId}`)
    }

    // TODO: Actual compilation with o1js
    // For now, simulate compilation
    await this.delay(100 + circuit.gateCount * 0.1)

    // Generate a mock verification key hash
    const vkHash = `0x${bytesToHex(randomBytes(32))}`

    this._compiledCircuits.set(circuitId, {
      compiled: true,
      vkHash,
    })

    if (this._config.verbose) {
      console.log(`[KimchiProvider] Circuit compiled: ${circuitId}, vkHash: ${vkHash.slice(0, 18)}...`)
    }

    return vkHash
  }

  /**
   * Check if a circuit is compiled
   */
  isCircuitCompiled(circuitId: string): boolean {
    return this._compiledCircuits.get(circuitId)?.compiled === true
  }

  // ─── Proof Generation ─────────────────────────────────────────────────────

  async generateProof(request: ProofGenerationRequest): Promise<ProofGenerationResult> {
    const startTime = Date.now()

    if (!this._status.isReady) {
      return {
        success: false,
        error: 'Provider not initialized',
        timeMs: Date.now() - startTime,
        providerId: `kimchi-${this.generateProviderId()}`,
      }
    }

    const circuit = this._circuits.get(request.circuitId)
    if (!circuit) {
      return {
        success: false,
        error: `Circuit not found: ${request.circuitId}`,
        timeMs: Date.now() - startTime,
        providerId: `kimchi-${this.generateProviderId()}`,
      }
    }

    try {
      this._status.isBusy = true

      // Auto-compile if not compiled
      if (!this.isCircuitCompiled(request.circuitId)) {
        await this.compileCircuit(request.circuitId)
      }

      // TODO: Implement actual Kimchi proof generation with o1js
      const proof = await this.generateMockProof(request, circuit)

      // Update metrics
      const timeMs = Date.now() - startTime
      this._metrics.proofsGenerated++
      this._metrics.avgGenerationTimeMs = (
        (this._metrics.avgGenerationTimeMs * (this._metrics.proofsGenerated - 1) + timeMs) /
        this._metrics.proofsGenerated
      )

      return {
        success: true,
        proof,
        timeMs,
        providerId: `kimchi-${this.generateProviderId()}`,
      }
    } catch (error) {
      this._metrics.successRate = this._metrics.proofsGenerated > 0
        ? (this._metrics.proofsGenerated - 1) / this._metrics.proofsGenerated
        : 0

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during proof generation',
        timeMs: Date.now() - startTime,
        providerId: `kimchi-${this.generateProviderId()}`,
      }
    } finally {
      this._status.isBusy = false
    }
  }

  private async generateMockProof(
    request: ProofGenerationRequest,
    circuit: KimchiCircuitConfig,
  ): Promise<SingleProof> {
    // Simulate proof generation time based on circuit complexity
    const simulatedTimeMs = Math.min(200 + circuit.gateCount * 0.5, 5000)
    await this.delay(simulatedTimeMs)

    // Generate Kimchi-style proof (~22KB)
    const proofBytes = randomBytes(KIMCHI_PROOF_SIZE)
    const proofHex = `0x${bytesToHex(proofBytes)}` as HexString

    // Convert public inputs to HexString array
    const publicInputs: HexString[] = Object.values(request.publicInputs).map((v) => {
      if (typeof v === 'string' && v.startsWith('0x')) {
        return v as HexString
      }
      if (typeof v === 'bigint' || typeof v === 'number') {
        return `0x${v.toString(16).padStart(64, '0')}` as HexString
      }
      return `0x${Buffer.from(String(v)).toString('hex')}` as HexString
    })

    const vkHash = this._compiledCircuits.get(request.circuitId)?.vkHash

    return {
      id: `kimchi-proof-${Date.now()}-${randomBytes(4).reduce((a, b) => a + b.toString(16), '')}`,
      proof: proofHex,
      publicInputs,
      verificationKey: vkHash as HexString | undefined,
      metadata: {
        system: 'kimchi',
        systemVersion: KIMCHI_VERSION,
        circuitId: circuit.id,
        circuitVersion: '1.0.0',
        generatedAt: Date.now(),
        proofSizeBytes: KIMCHI_PROOF_SIZE,
        verificationCost: BigInt(Math.ceil(circuit.gateCount / 10)),
        targetChainId: this._config.network === 'mainnet' ? 'mina:mainnet' : 'mina:testnet',
      },
    }
  }

  // ─── Verification ─────────────────────────────────────────────────────────

  async verifyProof(proof: SingleProof): Promise<boolean> {
    if (!this._status.isReady) {
      throw new Error('Provider not initialized')
    }

    const startTime = Date.now()

    try {
      // TODO: Implement actual Kimchi verification
      const isValid = this.validateProofFormat(proof)

      // Update metrics
      const timeMs = Date.now() - startTime
      this._metrics.proofsVerified++
      this._metrics.avgVerificationTimeMs = (
        (this._metrics.avgVerificationTimeMs * (this._metrics.proofsVerified - 1) + timeMs) /
        this._metrics.proofsVerified
      )

      return isValid
    } catch {
      return false
    }
  }

  async verifyBatch(proofs: SingleProof[]): Promise<boolean[]> {
    if (!this._status.isReady) {
      throw new Error('Provider not initialized')
    }

    // TODO: Implement batch verification
    const results: boolean[] = []
    for (const proof of proofs) {
      results.push(await this.verifyProof(proof))
    }
    return results
  }

  private validateProofFormat(proof: SingleProof): boolean {
    if (!proof.id || !proof.proof || !proof.metadata) {
      return false
    }

    if (proof.metadata.system !== 'kimchi') {
      return false
    }

    if (!proof.proof.startsWith('0x')) {
      return false
    }

    // Kimchi proofs should be approximately 22KB
    const proofBytes = (proof.proof.length - 2) / 2
    if (proofBytes < KIMCHI_PROOF_SIZE * 0.5 || proofBytes > KIMCHI_PROOF_SIZE * 2) {
      // Allow some variance but flag significantly wrong sizes
      if (this._config.verbose) {
        console.warn(`[KimchiProvider] Unusual proof size: ${proofBytes} bytes (expected ~${KIMCHI_PROOF_SIZE})`)
      }
    }

    if (proof.metadata.expiresAt && proof.metadata.expiresAt < Date.now()) {
      return false
    }

    return true
  }

  // ─── Recursive Proving (Pickles) ──────────────────────────────────────────

  /**
   * Check if Pickles recursive proving is available
   */
  supportsRecursion(): boolean {
    return this._config.enablePickles
  }

  /**
   * Merge multiple proofs recursively using Pickles
   *
   * This enables constant-size proofs regardless of how many
   * proofs are combined.
   */
  async mergeProofsRecursively(proofs: SingleProof[]): Promise<SingleProof | null> {
    if (!this._config.enablePickles) {
      if (this._config.verbose) {
        console.warn('[KimchiProvider] Pickles not enabled for recursive merging')
      }
      return null
    }

    if (proofs.length === 0) {
      return null
    }

    if (proofs.length === 1) {
      return proofs[0]
    }

    // TODO: Implement actual Pickles recursive merge
    // For now, return a mock merged proof
    if (this._config.verbose) {
      console.log(`[KimchiProvider] Merging ${proofs.length} proofs recursively`)
    }

    await this.delay(proofs.length * 100)

    const mergedProofBytes = randomBytes(KIMCHI_PROOF_SIZE)
    const combinedInputs = proofs.flatMap(p => p.publicInputs)

    return {
      id: `kimchi-merged-${Date.now()}`,
      proof: `0x${bytesToHex(mergedProofBytes)}`,
      publicInputs: combinedInputs.slice(0, 10) as HexString[], // Limit public inputs
      metadata: {
        system: 'kimchi',
        systemVersion: KIMCHI_VERSION,
        circuitId: 'pickles_merge',
        circuitVersion: '1.0.0',
        generatedAt: Date.now(),
        proofSizeBytes: KIMCHI_PROOF_SIZE,
      },
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async simulateAsyncLoad(): Promise<void> {
    await this.delay(50)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateProviderId(): string {
    return bytesToHex(randomBytes(4))
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create a Kimchi provider with standard configuration
 */
export function createKimchiProvider(config?: KimchiProviderConfig): KimchiProvider {
  return new KimchiProvider(config)
}

/**
 * Create a Kimchi provider configured for Mina mainnet
 */
export function createMinaMainnetProvider(): KimchiProvider {
  return new KimchiProvider({
    network: 'mainnet',
    enablePickles: true,
    circuits: [
      {
        id: 'token_transfer',
        name: 'Token Transfer Circuit',
        gateCount: 5000,
        publicInputCount: 4,
        usesRecursion: false,
      },
      {
        id: 'state_update',
        name: 'State Update Circuit',
        gateCount: 8000,
        publicInputCount: 6,
        usesRecursion: true,
      },
    ],
  })
}

/**
 * Create a Kimchi provider configured for zkApp development
 */
export function createZkAppProvider(network: 'testnet' | 'local' = 'testnet'): KimchiProvider {
  return new KimchiProvider({
    network,
    enablePickles: true,
    verbose: network === 'local',
    circuits: [
      {
        id: 'zkapp_method',
        name: 'zkApp Method Circuit',
        gateCount: 3000,
        publicInputCount: 3,
        usesRecursion: false,
      },
    ],
  })
}
