/**
 * Compliance Proof Module
 *
 * USER-SIDE tool for generating ZK proofs for regulatory compliance.
 *
 * ## IMPORTANT: Protocol Neutrality
 *
 * **This module is for USERS to prove compliance — NOT protocol-level enforcement.**
 *
 * SIP Protocol follows the Zcash model:
 * - Protocol is neutral infrastructure (like TCP/IP)
 * - Protocol does NOT screen, block, or filter transactions
 * - Users CHOOSE to generate compliance proofs when they need them
 * - Compliance is voluntary, not mandatory
 *
 * This is why Zcash avoided OFAC sanctions while Tornado Cash was sanctioned:
 * Zcash provides compliance TOOLS (viewing keys), not enforcement.
 *
 * ## Use Cases
 *
 * 1. **Viewing Key Disclosure**: User proves to auditor they can decrypt a transaction
 *    without revealing the transaction details
 *
 * 2. **Sanctions Self-Check**: User proves they checked sanctions list (their choice)
 *    — NOT protocol blocking sanctioned addresses
 *
 * 3. **Balance Attestation**: User proves sufficient funds without revealing balance
 *
 * 4. **Tax Compliance**: User proves transaction history is complete for tax filing
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  USER-SIDE COMPLIANCE PROOFS                                │
 * │  (Protocol remains neutral — user generates proofs by choice)
 * │                                                             │
 * │  ┌─────────────────┐    ┌─────────────────┐                │
 * │  │ User            │    │ Auditor/        │                │
 * │  │ (generates      │───►│ Regulator       │                │
 * │  │  proof)         │    │ (verifies)      │                │
 * │  └─────────────────┘    └─────────────────┘                │
 * │                                                             │
 * │  What user can prove:                                       │
 * │  ✓ Transaction exists and is valid                         │
 * │  ✓ User has viewing key access                             │
 * │  ✓ User checked sanctions list (voluntary)                 │
 * │                                                             │
 * │  What remains hidden:                                       │
 * │  ✗ Actual transaction amount                               │
 * │  ✗ Sender/recipient identities (unless user discloses)     │
 * │  ✗ Transaction path                                        │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module proofs/compliance-proof
 */

import type { ZKProof, ViewingKey } from '@sip-protocol/types'
import type { ProofResult } from './interface'
import { ProofGenerationError } from './interface'
import { ProofError, ErrorCode } from '../errors'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Compliance proof types
 */
export type ComplianceProofType =
  | 'viewing_key_access' // Prove viewing key holder can access transaction
  | 'sanctions_clear' // Prove no sanctions list matches
  | 'balance_attestation' // Prove balance meets requirement
  | 'history_complete' // Prove complete transaction history

/**
 * Parameters for viewing key access proof
 *
 * Proves that the holder of a viewing key can decrypt a specific transaction
 * without revealing the decrypted contents.
 */
export interface ViewingKeyAccessParams {
  /** The viewing key (private) */
  viewingKey: ViewingKey
  /** Transaction hash to prove access to */
  transactionHash: string
  /** Encrypted transaction data */
  encryptedData: Uint8Array
  /** Auditor's public key for verification */
  auditorPublicKey: string
  /** Timestamp of proof generation */
  timestamp: number
  /** Optional: Chain ID for multi-chain support */
  chainId?: string
}

/**
 * Parameters for sanctions clearance proof
 *
 * Proves that sender and recipient are not on a sanctions list
 * without revealing their actual addresses.
 */
export interface SanctionsClearParams {
  /** Sender address (private) */
  senderAddress: string
  /** Recipient address (private) */
  recipientAddress: string
  /** Blinding factor for sender (private) */
  senderBlinding: Uint8Array
  /** Blinding factor for recipient (private) */
  recipientBlinding: Uint8Array
  /** Merkle root of known sanctions list (public) */
  sanctionsListRoot: string
  /** Timestamp of check */
  checkTimestamp: number
  /** Jurisdiction (e.g., "US", "EU") */
  jurisdiction: string
}

/**
 * Parameters for balance attestation proof
 *
 * Proves balance meets a threshold without revealing exact balance.
 */
export interface BalanceAttestationParams {
  /** Actual balance (private) */
  balance: bigint
  /** Blinding factor (private) */
  blindingFactor: Uint8Array
  /** Minimum required balance (public) */
  minimumRequired: bigint
  /** Asset identifier (public) */
  assetId: string
  /** Account identifier (public commitment) */
  accountCommitment: string
  /** Attestation timestamp */
  attestationTime: number
}

/**
 * Parameters for history completeness proof
 *
 * Proves that all transactions in a time range have been disclosed
 * without revealing transaction amounts.
 */
export interface HistoryCompletenessParams {
  /** Transaction count in range (private) */
  transactionCount: number
  /** Merkle root of transaction hashes (public) */
  historyMerkleRoot: string
  /** Start of time range (public) */
  startTimestamp: number
  /** End of time range (public) */
  endTimestamp: number
  /** Total volume commitment (public) */
  volumeCommitment: string
  /** Viewing key for verification */
  viewingKey: ViewingKey
}

/**
 * Compliance proof result
 */
export interface ComplianceProofResult extends ProofResult {
  /** Type of compliance proof */
  complianceType: ComplianceProofType
  /** Expiry time for this proof (Unix timestamp) */
  validUntil: number
  /** Jurisdiction this proof is valid for */
  jurisdiction?: string
  /** Auditor verification hash */
  auditorHash?: string
}

/**
 * Compliance proof provider configuration
 */
export interface ComplianceProofConfig {
  /** Default proof validity period in seconds */
  defaultValidityPeriod?: number
  /** Enable verbose logging */
  verbose?: boolean
  /** Supported jurisdictions */
  jurisdictions?: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default proof validity period (24 hours)
 */
export const DEFAULT_VALIDITY_PERIOD_SECONDS = 86400

/**
 * Supported compliance jurisdictions
 */
export const SUPPORTED_JURISDICTIONS = [
  'US', // United States
  'EU', // European Union
  'UK', // United Kingdom
  'SG', // Singapore
  'CH', // Switzerland
  'GLOBAL', // Global sanctions lists
] as const

/**
 * Compliance proof circuit IDs
 */
export const COMPLIANCE_CIRCUIT_IDS = {
  viewing_key_access: 'compliance_viewing_key_v1',
  sanctions_clear: 'compliance_sanctions_v1',
  balance_attestation: 'compliance_balance_v1',
  history_complete: 'compliance_history_v1',
} as const

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Compliance Proof Provider
 *
 * Generates ZK proofs for regulatory compliance without revealing sensitive data.
 *
 * @example
 * ```typescript
 * const provider = new ComplianceProofProvider()
 * await provider.initialize()
 *
 * // Prove viewing key access to auditor
 * const result = await provider.generateViewingKeyAccessProof({
 *   viewingKey: myViewingKey,
 *   transactionHash: '0x...',
 *   encryptedData: encryptedTxData,
 *   auditorPublicKey: '0x...',
 *   timestamp: Date.now(),
 * })
 *
 * // Share proof with auditor (they can verify without seeing data)
 * await sendToAuditor(result.proof)
 * ```
 */
export class ComplianceProofProvider {
  private config: Required<ComplianceProofConfig>
  private _isReady = false

  constructor(config: ComplianceProofConfig = {}) {
    this.config = {
      defaultValidityPeriod: config.defaultValidityPeriod ?? DEFAULT_VALIDITY_PERIOD_SECONDS,
      verbose: config.verbose ?? false,
      jurisdictions: config.jurisdictions ?? [...SUPPORTED_JURISDICTIONS],
    }
  }

  /**
   * Check if provider is initialized
   */
  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Initialize the compliance proof provider
   */
  async initialize(): Promise<void> {
    if (this._isReady) {
      return
    }

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Initializing...')
    }

    // In production, this would load compliance-specific circuits
    // For now, we reuse the existing Noir circuits with compliance parameters

    this._isReady = true

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Ready')
    }
  }

  /**
   * Generate a viewing key access proof
   *
   * Proves to an auditor that the holder of a viewing key can decrypt
   * a specific transaction without revealing the decrypted contents.
   *
   * @param params - Viewing key access parameters
   * @returns Compliance proof result
   */
  async generateViewingKeyAccessProof(
    params: ViewingKeyAccessParams
  ): Promise<ComplianceProofResult> {
    this.ensureReady()

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Generating viewing key access proof...')
    }

    try {
      // Validate parameters
      this.validateViewingKeyAccessParams(params)

      // Compute proof components
      const viewingKeyHash = await this.hashViewingKey(params.viewingKey)
      const decryptionCommitment = await this.computeDecryptionCommitment(
        params.viewingKey,
        params.encryptedData
      )
      const auditorHash = await this.computeAuditorHash(
        params.auditorPublicKey,
        params.transactionHash
      )

      // Build public inputs
      const publicInputs: `0x${string}`[] = [
        `0x${params.transactionHash.replace('0x', '').padStart(64, '0')}`,
        `0x${viewingKeyHash}`,
        `0x${decryptionCommitment}`,
        `0x${params.timestamp.toString(16).padStart(16, '0')}`,
        `0x${auditorHash}`,
      ]

      // Generate proof (in production, this would use the Noir circuit)
      const proofBytes = await this.generateComplianceProofBytes(
        'viewing_key_access',
        publicInputs
      )

      const proof: ZKProof = {
        type: 'validity', // Reuses validity proof structure
        proof: `0x${proofBytes}`,
        publicInputs,
      }

      const validUntil = params.timestamp + this.config.defaultValidityPeriod

      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] Viewing key access proof generated')
      }

      return {
        proof,
        publicInputs,
        complianceType: 'viewing_key_access',
        validUntil,
        auditorHash,
      }
    } catch (error) {
      throw new ProofGenerationError(
        'validity', // Viewing key access uses validity proof structure
        `Failed to generate viewing key access proof: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate a sanctions clearance proof
   *
   * Proves that sender and recipient are not on any sanctions lists
   * without revealing their actual addresses.
   *
   * @param params - Sanctions clearance parameters
   * @returns Compliance proof result
   */
  async generateSanctionsClearProof(
    params: SanctionsClearParams
  ): Promise<ComplianceProofResult> {
    this.ensureReady()

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Generating sanctions clearance proof...')
    }

    try {
      // Validate parameters
      this.validateSanctionsClearParams(params)

      // Compute address commitments (hide actual addresses)
      const senderCommitment = await this.computeAddressCommitment(
        params.senderAddress,
        params.senderBlinding
      )
      const recipientCommitment = await this.computeAddressCommitment(
        params.recipientAddress,
        params.recipientBlinding
      )

      // Compute non-membership proof in sanctions list
      const nonMembershipProof = await this.computeNonMembershipProof(
        params.senderAddress,
        params.recipientAddress,
        params.sanctionsListRoot
      )

      // Build public inputs
      const publicInputs: `0x${string}`[] = [
        `0x${senderCommitment}`,
        `0x${recipientCommitment}`,
        `0x${params.sanctionsListRoot.replace('0x', '').padStart(64, '0')}`,
        `0x${params.checkTimestamp.toString(16).padStart(16, '0')}`,
        `0x${nonMembershipProof}`,
      ]

      // Generate proof
      const proofBytes = await this.generateComplianceProofBytes(
        'sanctions_clear',
        publicInputs
      )

      const proof: ZKProof = {
        type: 'validity',
        proof: `0x${proofBytes}`,
        publicInputs,
      }

      const validUntil = params.checkTimestamp + this.config.defaultValidityPeriod

      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] Sanctions clearance proof generated')
      }

      return {
        proof,
        publicInputs,
        complianceType: 'sanctions_clear',
        validUntil,
        jurisdiction: params.jurisdiction,
      }
    } catch (error) {
      throw new ProofGenerationError(
        'validity', // Sanctions clearance uses validity proof structure
        `Failed to generate sanctions clearance proof: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate a balance attestation proof
   *
   * Proves that an account has at least a certain balance
   * without revealing the exact balance.
   *
   * @param params - Balance attestation parameters
   * @returns Compliance proof result
   */
  async generateBalanceAttestationProof(
    params: BalanceAttestationParams
  ): Promise<ComplianceProofResult> {
    this.ensureReady()

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Generating balance attestation proof...')
    }

    try {
      // Validate parameters
      this.validateBalanceAttestationParams(params)

      // Compute balance commitment
      const balanceCommitment = await this.computeBalanceCommitment(
        params.balance,
        params.blindingFactor
      )

      // Build public inputs
      const publicInputs: `0x${string}`[] = [
        `0x${params.minimumRequired.toString(16).padStart(64, '0')}`,
        `0x${params.assetId.replace('0x', '').padStart(64, '0')}`,
        `0x${params.accountCommitment.replace('0x', '').padStart(64, '0')}`,
        `0x${balanceCommitment}`,
        `0x${params.attestationTime.toString(16).padStart(16, '0')}`,
      ]

      // Generate proof (reuses funding proof logic)
      const proofBytes = await this.generateComplianceProofBytes(
        'balance_attestation',
        publicInputs
      )

      const proof: ZKProof = {
        type: 'funding', // Reuses funding proof structure
        proof: `0x${proofBytes}`,
        publicInputs,
      }

      const validUntil = params.attestationTime + this.config.defaultValidityPeriod

      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] Balance attestation proof generated')
      }

      return {
        proof,
        publicInputs,
        complianceType: 'balance_attestation',
        validUntil,
      }
    } catch (error) {
      throw new ProofGenerationError(
        'funding', // Balance attestation uses funding proof structure
        `Failed to generate balance attestation proof: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate a history completeness proof
   *
   * Proves that all transactions in a time range have been disclosed
   * without revealing individual transaction amounts.
   *
   * @param params - History completeness parameters
   * @returns Compliance proof result
   */
  async generateHistoryCompletenessProof(
    params: HistoryCompletenessParams
  ): Promise<ComplianceProofResult> {
    this.ensureReady()

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Generating history completeness proof...')
    }

    try {
      // Validate parameters
      this.validateHistoryCompletenessParams(params)

      // Compute viewing key hash
      const viewingKeyHash = await this.hashViewingKey(params.viewingKey)

      // Build public inputs
      const publicInputs: `0x${string}`[] = [
        `0x${params.historyMerkleRoot.replace('0x', '').padStart(64, '0')}`,
        `0x${params.startTimestamp.toString(16).padStart(16, '0')}`,
        `0x${params.endTimestamp.toString(16).padStart(16, '0')}`,
        `0x${params.volumeCommitment.replace('0x', '').padStart(64, '0')}`,
        `0x${viewingKeyHash}`,
      ]

      // Generate proof
      const proofBytes = await this.generateComplianceProofBytes(
        'history_complete',
        publicInputs
      )

      const proof: ZKProof = {
        type: 'fulfillment', // Reuses fulfillment proof structure
        proof: `0x${proofBytes}`,
        publicInputs,
      }

      const validUntil = params.endTimestamp + this.config.defaultValidityPeriod

      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] History completeness proof generated')
      }

      return {
        proof,
        publicInputs,
        complianceType: 'history_complete',
        validUntil,
      }
    } catch (error) {
      throw new ProofGenerationError(
        'fulfillment', // History completeness uses fulfillment proof structure
        `Failed to generate history completeness proof: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Verify a compliance proof
   *
   * @param result - Compliance proof result to verify
   * @returns true if valid, false otherwise
   *
   * @remarks
   * **IMPORTANT: Mock Implementation**
   *
   * This verification performs structural validation only:
   * - Checks proof expiry
   * - Validates proof format and size
   * - Verifies public inputs exist
   * - Checks proof type matches compliance type
   *
   * It does NOT perform cryptographic verification of the ZK proof.
   * For production use, integrate with `SolanaNoirVerifier.verifyOffChain()`
   * or deploy a dedicated compliance circuit verifier.
   *
   * @example
   * ```typescript
   * // For production cryptographic verification:
   * const solanaVerifier = new SolanaNoirVerifier()
   * await solanaVerifier.initialize()
   * const cryptoValid = await solanaVerifier.verifyOffChain(result.proof)
   * const formatValid = await complianceProvider.verifyComplianceProof(result)
   * const isValid = cryptoValid && formatValid
   * ```
   */
  async verifyComplianceProof(result: ComplianceProofResult): Promise<boolean> {
    this.ensureReady()

    // Check if proof has expired
    if (Date.now() / 1000 > result.validUntil) {
      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] Proof has expired')
      }
      return false
    }

    // NOTE: This is a mock verification that only checks structure.
    // Production systems should use SolanaNoirVerifier for cryptographic verification.

    // Verify the underlying ZK proof structure
    const proofHex = result.proof.proof.replace('0x', '')

    // Check proof has minimum expected size (real proofs are ~2KB)
    if (proofHex.length < 64) {
      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] Proof too small')
      }
      return false
    }

    // Check public inputs match expected format
    if (result.publicInputs.length === 0) {
      if (this.config.verbose) {
        console.log('[ComplianceProofProvider] No public inputs')
      }
      return false
    }

    // Check proof type matches compliance type
    const expectedType = this.getExpectedProofType(result.complianceType)
    if (result.proof.type !== expectedType) {
      if (this.config.verbose) {
        console.log(`[ComplianceProofProvider] Type mismatch: expected ${expectedType}, got ${result.proof.type}`)
      }
      return false
    }

    if (this.config.verbose) {
      console.log('[ComplianceProofProvider] Mock verification: VALID (structural only, not cryptographic)')
    }

    return true
  }

  /**
   * Destroy the provider and free resources
   */
  async destroy(): Promise<void> {
    this._isReady = false
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this._isReady) {
      throw new ProofError(
        'ComplianceProofProvider not initialized. Call initialize() first.',
        ErrorCode.PROOF_PROVIDER_NOT_READY
      )
    }
  }

  private validateViewingKeyAccessParams(params: ViewingKeyAccessParams): void {
    if (!params.viewingKey) {
      throw new ProofError('Viewing key is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.transactionHash) {
      throw new ProofError('Transaction hash is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.encryptedData || params.encryptedData.length === 0) {
      throw new ProofError('Encrypted data is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.auditorPublicKey) {
      throw new ProofError('Auditor public key is required', ErrorCode.VALIDATION_FAILED)
    }
  }

  private validateSanctionsClearParams(params: SanctionsClearParams): void {
    if (!params.senderAddress) {
      throw new ProofError('Sender address is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.recipientAddress) {
      throw new ProofError('Recipient address is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.sanctionsListRoot) {
      throw new ProofError('Sanctions list root is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!this.config.jurisdictions.includes(params.jurisdiction as never)) {
      throw new ProofError(
        `Unsupported jurisdiction: ${params.jurisdiction}`,
        ErrorCode.VALIDATION_FAILED
      )
    }
  }

  private validateBalanceAttestationParams(params: BalanceAttestationParams): void {
    if (params.balance < 0n) {
      throw new ProofError('Balance cannot be negative', ErrorCode.VALIDATION_FAILED)
    }
    if (params.balance < params.minimumRequired) {
      throw new ProofError(
        'Balance must be at least minimum required',
        ErrorCode.VALIDATION_FAILED
      )
    }
    if (!params.assetId) {
      throw new ProofError('Asset ID is required', ErrorCode.VALIDATION_FAILED)
    }
  }

  private validateHistoryCompletenessParams(params: HistoryCompletenessParams): void {
    if (params.startTimestamp >= params.endTimestamp) {
      throw new ProofError('Start must be before end', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.historyMerkleRoot) {
      throw new ProofError('History merkle root is required', ErrorCode.VALIDATION_FAILED)
    }
    if (!params.viewingKey) {
      throw new ProofError('Viewing key is required', ErrorCode.VALIDATION_FAILED)
    }
  }

  private async hashViewingKey(viewingKey: ViewingKey): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Hash the viewing key public component
    const keyString = typeof viewingKey === 'string' ? viewingKey : JSON.stringify(viewingKey)
    const encoder = new TextEncoder()
    const keyBytes = encoder.encode(keyString)

    return bytesToHex(sha256(keyBytes))
  }

  private async computeDecryptionCommitment(
    viewingKey: ViewingKey,
    encryptedData: Uint8Array
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Commitment: hash(viewing_key || encrypted_data)
    const keyHash = await this.hashViewingKey(viewingKey)
    const keyBytes = this.hexToBytes(keyHash)

    const preimage = new Uint8Array([...keyBytes, ...encryptedData.slice(0, 32)])
    return bytesToHex(sha256(preimage))
  }

  private async computeAuditorHash(
    auditorPublicKey: string,
    transactionHash: string
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    const auditorBytes = this.hexToBytes(auditorPublicKey.replace('0x', '').padStart(64, '0'))
    const txBytes = this.hexToBytes(transactionHash.replace('0x', '').padStart(64, '0'))

    const preimage = new Uint8Array([...auditorBytes, ...txBytes])
    return bytesToHex(sha256(preimage))
  }

  private async computeAddressCommitment(
    address: string,
    blinding: Uint8Array
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    const addressBytes = this.hexToBytes(address.replace('0x', '').padStart(64, '0'))
    const preimage = new Uint8Array([...addressBytes, ...blinding.slice(0, 32)])

    return bytesToHex(sha256(preimage))
  }

  private async computeNonMembershipProof(
    senderAddress: string,
    recipientAddress: string,
    _sanctionsListRoot: string
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // In production, this would be a Merkle non-membership proof
    // For now, we generate a commitment that can be verified
    const senderBytes = this.hexToBytes(senderAddress.replace('0x', '').padStart(64, '0'))
    const recipientBytes = this.hexToBytes(recipientAddress.replace('0x', '').padStart(64, '0'))

    const preimage = new Uint8Array([...senderBytes, ...recipientBytes])
    return bytesToHex(sha256(preimage))
  }

  private async computeBalanceCommitment(
    balance: bigint,
    blinding: Uint8Array
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // Convert balance to bytes
    const balanceBytes = new Uint8Array(8)
    let v = balance
    for (let i = 7; i >= 0; i--) {
      balanceBytes[i] = Number(v & 0xffn)
      v = v >> 8n
    }

    const preimage = new Uint8Array([...balanceBytes, ...blinding.slice(0, 32)])
    return bytesToHex(sha256(preimage))
  }

  private async generateComplianceProofBytes(
    type: ComplianceProofType,
    publicInputs: string[]
  ): Promise<string> {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    // In production, this would call the Noir circuit
    // For mock, we generate deterministic proof bytes from inputs
    const circuitId = COMPLIANCE_CIRCUIT_IDS[type]
    const encoder = new TextEncoder()

    const inputBytes = publicInputs.flatMap((pi) => Array.from(this.hexToBytes(pi.replace('0x', ''))))
    const preimage = new Uint8Array([
      ...encoder.encode(circuitId),
      ...inputBytes,
    ])

    // Generate 256 bytes of proof data (typical proof size)
    const hash = sha256(preimage)
    let proofBytes = ''
    for (let i = 0; i < 8; i++) {
      proofBytes += bytesToHex(sha256(new Uint8Array([...hash, i])))
    }

    return proofBytes
  }

  private getExpectedProofType(complianceType: ComplianceProofType): string {
    switch (complianceType) {
      case 'viewing_key_access':
      case 'sanctions_clear':
        return 'validity'
      case 'balance_attestation':
        return 'funding'
      case 'history_complete':
        return 'fulfillment'
      default:
        return 'validity'
    }
  }

  private hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(h.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }
}
