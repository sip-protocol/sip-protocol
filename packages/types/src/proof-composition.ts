/**
 * Proof Composition Types
 *
 * Type definitions for the proof composition system that enables
 * combining proofs from multiple ZK systems (Noir, Halo2, Kimchi).
 *
 * @packageDocumentation
 * @module proof-composition
 */

import type { HexString } from './crypto'

// ─── Proof System Types ─────────────────────────────────────────────────────

/**
 * Supported proof systems for composition
 */
export type ProofSystem = 'noir' | 'halo2' | 'kimchi' | 'groth16' | 'plonk'

/**
 * Proof aggregation strategies
 */
export enum ProofAggregationStrategy {
  /** Proofs are verified sequentially, one after another */
  SEQUENTIAL = 'sequential',
  /** Proofs are verified in parallel (when possible) */
  PARALLEL = 'parallel',
  /** Proofs are recursively aggregated into a single proof */
  RECURSIVE = 'recursive',
  /** Proofs are batched and verified together */
  BATCH = 'batch',
}

/**
 * Status of a composed proof
 */
export enum ComposedProofStatus {
  /** Proof is being generated */
  GENERATING = 'generating',
  /** Proof generation complete, awaiting verification */
  PENDING_VERIFICATION = 'pending_verification',
  /** Proof has been verified */
  VERIFIED = 'verified',
  /** Proof verification failed */
  FAILED = 'failed',
  /** Proof has expired */
  EXPIRED = 'expired',
}

// ─── Proof Data Types ───────────────────────────────────────────────────────

/**
 * Metadata about a proof's origin and properties
 */
export interface ProofMetadata {
  /** The proof system that generated this proof */
  system: ProofSystem
  /** Version of the proof system */
  systemVersion: string
  /** Circuit identifier or name */
  circuitId: string
  /** Circuit version/hash for verification */
  circuitVersion: string
  /** Timestamp when proof was generated */
  generatedAt: number
  /** Optional expiry timestamp */
  expiresAt?: number
  /** Size of the proof in bytes */
  proofSizeBytes: number
  /** Estimated verification cost (gas units or similar) */
  verificationCost?: bigint
  /** Chain ID where proof is intended to be verified */
  targetChainId?: string
}

/**
 * A single proof from one proof system
 */
export interface SingleProof {
  /** Unique identifier for this proof */
  id: string
  /** The raw proof data */
  proof: HexString
  /** Public inputs for verification */
  publicInputs: HexString[]
  /** Verification key (if needed) */
  verificationKey?: HexString
  /** Metadata about the proof */
  metadata: ProofMetadata
}

/**
 * A composed proof combining multiple proofs
 */
export interface ComposedProof {
  /** Unique identifier for the composed proof */
  id: string
  /** The individual proofs that were composed */
  proofs: SingleProof[]
  /** The aggregation strategy used */
  strategy: ProofAggregationStrategy
  /** Current status of the composed proof */
  status: ComposedProofStatus
  /** Aggregated proof data (if strategy produces one) */
  aggregatedProof?: HexString
  /** Combined public inputs */
  combinedPublicInputs: HexString[]
  /** Composition metadata */
  compositionMetadata: CompositionMetadata
  /** Verification hints for efficient verification */
  verificationHints: VerificationHints
}

/**
 * Metadata about the composition process
 */
export interface CompositionMetadata {
  /** Total number of proofs composed */
  proofCount: number
  /** Systems involved in composition */
  systems: ProofSystem[]
  /** Time taken to compose (milliseconds) */
  compositionTimeMs: number
  /** Whether composition was successful */
  success: boolean
  /** Error message if composition failed */
  error?: string
  /** Hash of all input proofs for integrity */
  inputHash: HexString
}

/**
 * Hints to optimize verification
 */
export interface VerificationHints {
  /** Recommended verification order */
  verificationOrder: string[]
  /** Proofs that can be verified in parallel */
  parallelGroups: string[][]
  /** Estimated total verification time (milliseconds) */
  estimatedTimeMs: number
  /** Estimated total verification cost */
  estimatedCost: bigint
  /** Whether batch verification is supported */
  supportsBatchVerification: boolean
}

// ─── Configuration Types ────────────────────────────────────────────────────

/**
 * Configuration for proof composition
 */
export interface ProofCompositionConfig {
  /** Aggregation strategy to use */
  strategy: ProofAggregationStrategy
  /** Maximum number of proofs to compose */
  maxProofs: number
  /** Timeout for composition (milliseconds) */
  timeoutMs: number
  /** Whether to enable parallel proof generation */
  enableParallelGeneration: boolean
  /** Maximum parallel workers */
  maxParallelWorkers: number
  /** Whether to cache intermediate results */
  enableCaching: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs: number
  /** Whether to enable recursive aggregation */
  enableRecursiveAggregation: boolean
  /** Maximum recursion depth for recursive aggregation */
  maxRecursionDepth: number
  /** Target chain for optimized verification */
  targetChain?: string
}

/**
 * Default configuration for proof composition
 */
export const DEFAULT_COMPOSITION_CONFIG: ProofCompositionConfig = {
  strategy: ProofAggregationStrategy.SEQUENTIAL,
  maxProofs: 10,
  timeoutMs: 300000, // 5 minutes
  enableParallelGeneration: true,
  maxParallelWorkers: 4,
  enableCaching: true,
  cacheTtlMs: 3600000, // 1 hour
  enableRecursiveAggregation: false,
  maxRecursionDepth: 3,
}

// ─── Provider Types ─────────────────────────────────────────────────────────

/**
 * Capabilities of a proof provider
 */
export interface ProofProviderCapabilities {
  /** Proof system this provider uses */
  system: ProofSystem
  /** Whether provider supports recursive proofs */
  supportsRecursion: boolean
  /** Whether provider supports batch verification */
  supportsBatchVerification: boolean
  /** Whether provider can run in browser */
  supportsBrowser: boolean
  /** Whether provider can run in Node.js */
  supportsNode: boolean
  /** Maximum proof size supported */
  maxProofSize: number
  /** Supported aggregation strategies */
  supportedStrategies: ProofAggregationStrategy[]
  /** Circuits available in this provider */
  availableCircuits: string[]
}

/**
 * Status of a proof provider
 */
export interface ProofProviderStatus {
  /** Whether provider is initialized and ready */
  isReady: boolean
  /** Whether provider is currently generating a proof */
  isBusy: boolean
  /** Number of proofs in queue */
  queueLength: number
  /** Last error (if any) */
  lastError?: string
  /** Provider health metrics */
  metrics: ProofProviderMetrics
}

/**
 * Metrics for a proof provider
 */
export interface ProofProviderMetrics {
  /** Total proofs generated */
  proofsGenerated: number
  /** Total proofs verified */
  proofsVerified: number
  /** Average generation time (milliseconds) */
  avgGenerationTimeMs: number
  /** Average verification time (milliseconds) */
  avgVerificationTimeMs: number
  /** Success rate (0-1) */
  successRate: number
  /** Memory usage in bytes */
  memoryUsageBytes: number
}

// ─── Result Types ───────────────────────────────────────────────────────────

/**
 * Result of a composition operation
 */
export interface CompositionResult {
  /** Whether composition was successful */
  success: boolean
  /** The composed proof (if successful) */
  composedProof?: ComposedProof
  /** Error details (if failed) */
  error?: CompositionError
  /** Performance metrics */
  metrics: CompositionMetrics
}

/**
 * Error during composition
 */
export interface CompositionError {
  /** Error code */
  code: CompositionErrorCode
  /** Human-readable message */
  message: string
  /** Proof ID that caused the error (if applicable) */
  proofId?: string
  /** System that caused the error (if applicable) */
  system?: ProofSystem
  /** Original error (if wrapped) */
  cause?: Error
}

/**
 * Error codes for composition failures
 */
export enum CompositionErrorCode {
  /** Invalid proof format */
  INVALID_PROOF = 'INVALID_PROOF',
  /** Incompatible proof systems */
  INCOMPATIBLE_SYSTEMS = 'INCOMPATIBLE_SYSTEMS',
  /** Composition timeout */
  TIMEOUT = 'TIMEOUT',
  /** Provider not ready */
  PROVIDER_NOT_READY = 'PROVIDER_NOT_READY',
  /** Verification failed */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  /** Too many proofs */
  TOO_MANY_PROOFS = 'TOO_MANY_PROOFS',
  /** Circuit not found */
  CIRCUIT_NOT_FOUND = 'CIRCUIT_NOT_FOUND',
  /** Out of memory */
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Performance metrics for composition
 */
export interface CompositionMetrics {
  /** Total time for composition (milliseconds) */
  totalTimeMs: number
  /** Time spent generating proofs (milliseconds) */
  generationTimeMs: number
  /** Time spent verifying proofs (milliseconds) */
  verificationTimeMs: number
  /** Time spent aggregating proofs (milliseconds) */
  aggregationTimeMs: number
  /** Peak memory usage (bytes) */
  peakMemoryBytes: number
  /** Number of proofs processed */
  proofsProcessed: number
}

// ─── Verification Types ─────────────────────────────────────────────────────

/**
 * Result of verifying a composed proof
 */
export interface VerificationResult {
  /** Whether all proofs verified successfully */
  valid: boolean
  /** Individual verification results */
  results: IndividualVerificationResult[]
  /** Total verification time (milliseconds) */
  totalTimeMs: number
  /** Verification method used */
  method: 'individual' | 'batch' | 'aggregated'
}

/**
 * Verification result for a single proof
 */
export interface IndividualVerificationResult {
  /** Proof ID */
  proofId: string
  /** Whether this proof is valid */
  valid: boolean
  /** Verification time (milliseconds) */
  timeMs: number
  /** Error message if invalid */
  error?: string
}

// ─── Event Types ────────────────────────────────────────────────────────────

/**
 * Events emitted during proof composition
 */
export type CompositionEventType =
  | 'composition:started'
  | 'composition:progress'
  | 'composition:completed'
  | 'composition:failed'
  | 'proof:generating'
  | 'proof:generated'
  | 'proof:verifying'
  | 'proof:verified'
  | 'aggregation:started'
  | 'aggregation:completed'

/**
 * Base event for composition
 */
export interface CompositionEvent {
  type: CompositionEventType
  timestamp: number
  compositionId: string
}

/**
 * Progress event during composition
 */
export interface CompositionProgressEvent extends CompositionEvent {
  type: 'composition:progress'
  /** Current step (0-based) */
  currentStep: number
  /** Total steps */
  totalSteps: number
  /** Current operation description */
  operation: string
  /** Progress percentage (0-100) */
  percentage: number
}

/**
 * Event listener for composition events
 */
export type CompositionEventListener = (event: CompositionEvent) => void
