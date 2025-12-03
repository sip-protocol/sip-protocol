/**
 * Mock Proof Provider
 *
 * ⚠️ WARNING: FOR TESTING ONLY - DO NOT USE IN PRODUCTION ⚠️
 *
 * This provider generates fake proofs that provide NO cryptographic guarantees.
 * It is intended solely for:
 * - Unit testing
 * - Integration testing
 * - Development/debugging
 *
 * The mock proofs are clearly marked and will be rejected by any real verifier.
 */

import type { ZKProof, HexString } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
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

/**
 * Mock proof marker - all mock proofs start with this prefix
 * This allows easy identification of mock proofs
 */
const MOCK_PROOF_PREFIX = '0x4d4f434b' // "MOCK" in hex

/**
 * Console warning message for mock provider usage
 */
const WARNING_MESSAGE = `
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  MOCK PROOF PROVIDER - NOT FOR PRODUCTION USE  ⚠️         ║
║                                                              ║
║  Mock proofs provide NO cryptographic security guarantees.   ║
║  Use NoirProofProvider for production deployments.           ║
╚══════════════════════════════════════════════════════════════╝
`

/**
 * Configuration options for MockProofProvider
 */
export interface MockProofProviderOptions {
  /**
   * Suppress the console warning about mock usage.
   *
   * Use this ONLY for SSR fallback scenarios where the mock provider
   * is a placeholder and real proofs will be generated client-side.
   *
   * @default false
   */
  silent?: boolean
}

/**
 * Mock Proof Provider for testing
 *
 * @example
 * ```typescript
 * // Only use in tests
 * const provider = new MockProofProvider()
 * await provider.initialize()
 *
 * const result = await provider.generateFundingProof({
 *   balance: 100n,
 *   minimumRequired: 50n,
 *   // ... other params
 * })
 * ```
 *
 * @example
 * ```typescript
 * // SSR fallback (silent mode)
 * const ssrFallback = new MockProofProvider({ silent: true })
 * ```
 */
export class MockProofProvider implements ProofProvider {
  readonly framework: ProofFramework = 'mock'
  private _isReady = false
  private _warningShown = false
  private _silent: boolean

  /**
   * Create a new MockProofProvider
   *
   * @param options - Configuration options
   */
  constructor(options?: MockProofProviderOptions) {
    this._silent = options?.silent ?? false
  }

  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Initialize the mock provider
   *
   * Logs a warning to console about mock usage (unless silent mode is enabled).
   */
  async initialize(): Promise<void> {
    if (!this._warningShown && !this._silent) {
      console.warn(WARNING_MESSAGE)
      this._warningShown = true
    }
    this._isReady = true
  }

  /**
   * Generate a mock funding proof
   *
   * ⚠️ This proof provides NO cryptographic guarantees!
   */
  async generateFundingProof(params: FundingProofParams): Promise<ProofResult> {
    this.ensureReady()

    // Validate parameters (actual validation, not cryptographic)
    if (params.balance < params.minimumRequired) {
      throw new ProofGenerationError(
        'funding',
        'Balance is less than minimum required',
      )
    }

    // Generate deterministic mock proof
    const proofData = this.generateMockProofData('funding', params)

    return {
      proof: {
        type: 'funding',
        proof: proofData,
        publicInputs: [
          this.hashToHex(params.assetId),
          `0x${params.minimumRequired.toString(16).padStart(16, '0')}`,
        ],
      },
      publicInputs: [
        this.hashToHex(params.assetId),
        `0x${params.minimumRequired.toString(16).padStart(16, '0')}`,
      ],
    }
  }

  /**
   * Generate a mock validity proof
   *
   * ⚠️ This proof provides NO cryptographic guarantees!
   */
  async generateValidityProof(params: ValidityProofParams): Promise<ProofResult> {
    this.ensureReady()

    // Validate parameters
    if (params.timestamp >= params.expiry) {
      throw new ProofGenerationError(
        'validity',
        'Intent has already expired',
      )
    }

    // Generate deterministic mock proof
    const proofData = this.generateMockProofData('validity', params)

    return {
      proof: {
        type: 'validity',
        proof: proofData,
        publicInputs: [
          params.intentHash,
          `0x${params.timestamp.toString(16)}`,
          `0x${params.expiry.toString(16)}`,
        ],
      },
      publicInputs: [
        params.intentHash,
        `0x${params.timestamp.toString(16)}`,
        `0x${params.expiry.toString(16)}`,
      ],
    }
  }

  /**
   * Generate a mock fulfillment proof
   *
   * ⚠️ This proof provides NO cryptographic guarantees!
   */
  async generateFulfillmentProof(params: FulfillmentProofParams): Promise<ProofResult> {
    this.ensureReady()

    // Validate parameters
    if (params.outputAmount < params.minOutputAmount) {
      throw new ProofGenerationError(
        'fulfillment',
        'Output amount is less than minimum required',
      )
    }

    if (params.fulfillmentTime > params.expiry) {
      throw new ProofGenerationError(
        'fulfillment',
        'Fulfillment time is after expiry',
      )
    }

    // Generate deterministic mock proof
    const proofData = this.generateMockProofData('fulfillment', params)

    return {
      proof: {
        type: 'fulfillment',
        proof: proofData,
        publicInputs: [
          params.intentHash,
          params.recipientStealth,
          `0x${params.minOutputAmount.toString(16).padStart(16, '0')}`,
        ],
      },
      publicInputs: [
        params.intentHash,
        params.recipientStealth,
        `0x${params.minOutputAmount.toString(16).padStart(16, '0')}`,
      ],
    }
  }

  /**
   * Verify a mock proof
   *
   * Only verifies that the proof has the mock prefix.
   * ⚠️ This provides NO cryptographic verification!
   */
  async verifyProof(proof: ZKProof): Promise<boolean> {
    this.ensureReady()

    // Mock verification: just check the prefix
    return proof.proof.startsWith(MOCK_PROOF_PREFIX)
  }

  /**
   * Check if a proof is a mock proof
   */
  static isMockProof(proof: ZKProof): boolean {
    return proof.proof.startsWith(MOCK_PROOF_PREFIX)
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this._isReady) {
      throw new ProofError(
        'MockProofProvider not initialized. Call initialize() first.',
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }
  }

  private generateMockProofData(
    proofType: string,
    params: unknown,
  ): HexString {
    // Create deterministic proof data from inputs
    const input = JSON.stringify({ type: proofType, params }, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    )
    const hash = sha256(new TextEncoder().encode(input))

    // Add some random bytes to make each proof unique
    const random = randomBytes(16)

    // Combine: MOCK prefix + hash + random
    const combined = new Uint8Array(4 + hash.length + random.length)
    combined.set(new TextEncoder().encode('MOCK'), 0)
    combined.set(hash, 4)
    combined.set(random, 4 + hash.length)

    return `${MOCK_PROOF_PREFIX}${bytesToHex(combined.slice(4))}` as HexString
  }

  private hashToHex(data: string): HexString {
    const hash = sha256(new TextEncoder().encode(data))
    return `0x${bytesToHex(hash)}` as HexString
  }
}
