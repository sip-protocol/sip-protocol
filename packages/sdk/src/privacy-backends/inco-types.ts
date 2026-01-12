/**
 * Inco SDK Type Definitions
 *
 * Type definitions for the @inco/js package.
 * Inco provides FHE (Fully Homomorphic Encryption) for encrypted state computation.
 *
 * ## Architecture
 *
 * - **FHE Engine**: Computes over encrypted data without decryption
 * - **Encrypted Types**: euint256, ebool, eaddress
 * - **Handles**: Unique identifiers for encrypted values on-chain
 * - **Attestations**: Verified decryption mechanisms
 *
 * ## Products
 *
 * - **Inco Lightning**: TEE-based, faster, lower security guarantees
 * - **Inco Atlas**: FHE+MPC, stronger cryptographic guarantees
 *
 * @see https://docs.inco.org
 * @see https://www.npmjs.com/package/@inco/js
 */

import type { ComputationStatus } from './interface'

// ─── Re-export from interface ────────────────────────────────────────────────

export type { ComputationStatus }

// ─── Inco-Specific Types ─────────────────────────────────────────────────────

/**
 * Inco network configuration
 */
export type IncoNetwork = 'testnet' | 'mainnet'

/**
 * Inco product type
 *
 * - Lightning: TEE-based, faster
 * - Atlas: FHE+MPC, stronger guarantees
 */
export type IncoProduct = 'lightning' | 'atlas'

/**
 * Supported encrypted data types in Inco FHE
 *
 * - euint256: Encrypted unsigned 256-bit integer
 * - ebool: Encrypted boolean
 * - eaddress: Encrypted Ethereum address
 */
export type EncryptedType = 'euint256' | 'ebool' | 'eaddress'

/**
 * Configuration for Inco SDK connection
 */
export interface IncoConfig {
  /** RPC endpoint URL */
  rpcUrl: string
  /** Network type */
  network: IncoNetwork
  /** Chain ID for EVM networks */
  chainId?: number
  /** Inco product to use */
  product?: IncoProduct
}

/**
 * Encrypted value handle
 *
 * Represents an encrypted value stored on-chain.
 * The handle is used to reference the value in computations.
 */
export interface EncryptedValue {
  /** Unique handle identifier for the encrypted value */
  handle: string
  /** Type of encrypted data */
  type: EncryptedType
  /** Raw ciphertext (if available) */
  ciphertext?: Uint8Array
  /** Chain where the value is stored */
  chainId?: number
}

/**
 * Parameters for encrypting a value
 */
export interface EncryptParams {
  /** Value to encrypt (bigint for euint256, boolean for ebool, string for eaddress) */
  value: bigint | boolean | string
  /** Target encrypted type */
  type: EncryptedType
  /** Destination contract address */
  contractAddress?: string
}

/**
 * Parameters for decrypting a value
 */
export interface DecryptParams {
  /** Handle of the encrypted value */
  handle: string
  /** Expected type (for validation) */
  type?: EncryptedType
}

/**
 * Decryption result
 */
export interface DecryptResult {
  /** Decrypted value */
  value: bigint | boolean | string
  /** Type of the decrypted value */
  type: EncryptedType
  /** Whether decryption was verified/attested */
  attested: boolean
}

/**
 * Parameters for submitting FHE computation
 */
export interface SubmitFHEParams {
  /** Contract address containing the FHE logic */
  contractAddress: string
  /** Function selector or name */
  functionName: string
  /** Encrypted input handles */
  encryptedInputs: string[]
  /** Additional plaintext arguments */
  plaintextArgs?: unknown[]
  /** Gas limit for the transaction */
  gasLimit?: bigint
}

/**
 * FHE computation state information
 */
export interface FHEComputationInfo {
  /** Computation identifier */
  id: string
  /** Current status */
  status: ComputationStatus
  /** Contract address */
  contractAddress: string
  /** Function executed */
  functionName: string
  /** Input handles used */
  inputHandles: string[]
  /** Output handle (if completed) */
  outputHandle?: string
  /** Submission timestamp */
  submittedAt: number
  /** Completion timestamp (if completed) */
  completedAt?: number
  /** Transaction hash */
  txHash?: string
  /** Error message (if failed) */
  error?: string
}

/**
 * Attestation types for decryption
 */
export type AttestationType = 'decrypt' | 'reveal' | 'compute'

/**
 * Attestation request for verified decryption
 */
export interface AttestationRequest {
  /** Type of attestation */
  type: AttestationType
  /** Handle to attest */
  handle: string
  /** Requester address */
  requester: string
  /** Callback contract (optional) */
  callbackContract?: string
}

/**
 * Attestation result
 */
export interface AttestationResult {
  /** Whether attestation succeeded */
  success: boolean
  /** Decrypted/revealed value (if applicable) */
  value?: bigint | boolean | string
  /** Attestation proof */
  proof?: string
  /** Timestamp */
  timestamp: number
}

// ─── SDK Interfaces ──────────────────────────────────────────────────────────

/**
 * Inco Client SDK interface
 *
 * The actual SDK is @inco/js.
 * This interface defines the expected API for our adapter.
 */
export interface IIncoClient {
  /**
   * Initialize connection to Inco network
   */
  connect(config: IncoConfig): Promise<void>

  /**
   * Disconnect from Inco network
   */
  disconnect(): Promise<void>

  /**
   * Encrypt a value for FHE computation
   *
   * @param params - Encryption parameters
   * @returns Encrypted value with handle
   */
  encrypt(params: EncryptParams): Promise<EncryptedValue>

  /**
   * Decrypt an encrypted value (requires authorization)
   *
   * @param params - Decryption parameters
   * @returns Decrypted value
   */
  decrypt(params: DecryptParams): Promise<DecryptResult>

  /**
   * Submit an FHE computation
   *
   * @param params - Computation parameters
   * @returns Computation ID for tracking
   */
  submitComputation(params: SubmitFHEParams): Promise<string>

  /**
   * Get computation status
   *
   * @param computationId - Computation to check
   * @returns Current status
   */
  getComputationStatus(computationId: string): Promise<ComputationStatus>

  /**
   * Get detailed computation info
   *
   * @param computationId - Computation to query
   * @returns Full computation info
   */
  getComputationInfo(computationId: string): Promise<FHEComputationInfo>

  /**
   * Wait for computation to complete
   *
   * @param computationId - Computation to wait for
   * @param timeout - Optional timeout in milliseconds
   * @returns Computation info on completion
   */
  awaitCompletion(
    computationId: string,
    timeout?: number
  ): Promise<FHEComputationInfo>

  /**
   * Request attested decryption
   *
   * @param request - Attestation request
   * @returns Attestation result
   */
  requestAttestation(request: AttestationRequest): Promise<AttestationResult>
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Inco network RPC endpoints
 */
export const INCO_RPC_URLS: Record<IncoNetwork, string> = {
  testnet: 'https://testnet.inco.org',
  mainnet: 'https://mainnet.inco.org',
}

/**
 * Inco chain IDs
 */
export const INCO_CHAIN_IDS: Record<IncoNetwork, number> = {
  testnet: 9090,
  mainnet: 9091, // Placeholder - actual mainnet chain ID TBD
}

/**
 * Supported EVM chains for Inco integration
 */
export const INCO_SUPPORTED_CHAINS = [
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
] as const

/**
 * Default timeout for FHE computation (3 minutes)
 * FHE is generally faster than MPC
 */
export const DEFAULT_FHE_TIMEOUT_MS = 180_000

/**
 * Estimated time for FHE computation (30 seconds)
 * Faster than MPC due to no multi-party coordination
 */
export const ESTIMATED_FHE_TIME_MS = 30_000

/**
 * Base cost for Inco FHE computation (in wei)
 * Actual cost depends on computation complexity
 */
export const BASE_FHE_COST_WEI = BigInt('10000000000000000') // 0.01 ETH

/**
 * Cost per encrypted input (in wei)
 */
export const COST_PER_ENCRYPTED_INPUT_WEI = BigInt('1000000000000000') // 0.001 ETH
