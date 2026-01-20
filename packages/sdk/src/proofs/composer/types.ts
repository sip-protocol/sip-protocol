/**
 * Proof Composer SDK Types
 *
 * SDK-specific types for the proof composition system.
 * These extend the base types from @sip-protocol/types with
 * implementation-specific details.
 *
 * @packageDocumentation
 */

import type {
  ProofSystem,
  ProofAggregationStrategy,
  SingleProof,
  ComposedProof,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  CompositionResult,
  VerificationResult,
  CompositionEventListener,
} from '@sip-protocol/types'
import type { HexString, ZKProof } from '@sip-protocol/types'

// ─── Provider Registration ──────────────────────────────────────────────────

/**
 * Registration entry for a proof provider
 */
export interface ProofProviderRegistration {
  /** Unique identifier for this provider instance */
  id: string
  /** The proof system */
  system: ProofSystem
  /** Provider capabilities */
  capabilities: ProofProviderCapabilities
  /** Priority for provider selection (higher = preferred) */
  priority: number
  /** Whether this provider is enabled */
  enabled: boolean
}

/**
 * Options for registering a proof provider
 */
export interface RegisterProviderOptions {
  /** Override existing provider with same system */
  override?: boolean
  /** Priority for this provider */
  priority?: number
  /** Enable immediately */
  enabled?: boolean
}

// ─── Proof Generation ───────────────────────────────────────────────────────

/**
 * Request to generate a proof
 */
export interface ProofGenerationRequest {
  /** Circuit to use */
  circuitId: string
  /** Private inputs (not revealed) */
  privateInputs: Record<string, unknown>
  /** Public inputs (revealed in proof) */
  publicInputs: Record<string, unknown>
  /** Optional: specific provider to use */
  providerId?: string
  /** Optional: specific proof system to use */
  system?: ProofSystem
  /** Optional: timeout override */
  timeoutMs?: number
}

/**
 * Result of proof generation
 */
export interface ProofGenerationResult {
  /** Whether generation was successful */
  success: boolean
  /** The generated proof (if successful) */
  proof?: SingleProof
  /** Error message (if failed) */
  error?: string
  /** Generation time in milliseconds */
  timeMs: number
  /** Provider that generated the proof */
  providerId: string
}

// ─── Composition Options ────────────────────────────────────────────────────

/**
 * Options for composing proofs
 */
export interface ComposeProofsOptions {
  /** Proofs to compose */
  proofs: SingleProof[]
  /** Override default strategy */
  strategy?: ProofAggregationStrategy
  /** Override default config */
  config?: Partial<ProofCompositionConfig>
  /** Event listener for progress updates */
  onProgress?: CompositionEventListener
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal
}

/**
 * Options for verifying a composed proof
 */
export interface VerifyComposedProofOptions {
  /** The composed proof to verify */
  composedProof: ComposedProof
  /** Whether to verify individual proofs */
  verifyIndividual?: boolean
  /** Whether to use batch verification if available */
  useBatchVerification?: boolean
  /** Timeout for verification */
  timeoutMs?: number
}

// ─── Aggregation ────────────────────────────────────────────────────────────

/**
 * Options for aggregating proofs
 */
export interface AggregateProofsOptions {
  /** Proofs to aggregate */
  proofs: SingleProof[]
  /** Target proof system for aggregated proof */
  targetSystem: ProofSystem
  /** Whether to verify before aggregating */
  verifyFirst?: boolean
  /** Maximum recursion depth */
  maxRecursionDepth?: number
}

/**
 * Result of proof aggregation
 */
export interface AggregationResult {
  /** Whether aggregation was successful */
  success: boolean
  /** The aggregated proof (if successful) */
  aggregatedProof?: HexString
  /** Error message (if failed) */
  error?: string
  /** Aggregation metrics */
  metrics: {
    inputProofCount: number
    outputProofSize: number
    timeMs: number
    recursionDepth: number
  }
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Options for converting proof formats
 */
export interface ConvertProofOptions {
  /** Source proof */
  proof: SingleProof
  /** Target proof system */
  targetSystem: ProofSystem
  /** Whether to preserve metadata */
  preserveMetadata?: boolean
}

/**
 * Result of proof conversion
 */
export interface ConversionResult {
  /** Whether conversion was successful */
  success: boolean
  /** The converted proof (if successful) */
  convertedProof?: SingleProof
  /** Error message (if failed) */
  error?: string
  /** Whether conversion was lossless */
  lossless: boolean
}

// ─── Caching ────────────────────────────────────────────────────────────────

/**
 * Cache entry for a proof
 */
export interface ProofCacheEntry {
  /** The cached proof */
  proof: SingleProof | ComposedProof
  /** When the entry was created */
  createdAt: number
  /** When the entry expires */
  expiresAt: number
  /** Number of times this entry was accessed */
  accessCount: number
  /** Last access timestamp */
  lastAccessedAt: number
  /** Size in bytes */
  sizeBytes: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries in cache */
  entryCount: number
  /** Total size in bytes */
  totalSizeBytes: number
  /** Hit rate (0-1) */
  hitRate: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Number of evictions */
  evictions: number
}

// ─── Worker Pool ────────────────────────────────────────────────────────────

/**
 * Configuration for the worker pool
 */
export interface WorkerPoolConfig {
  /** Minimum number of workers */
  minWorkers: number
  /** Maximum number of workers */
  maxWorkers: number
  /** Worker idle timeout (milliseconds) */
  idleTimeoutMs: number
  /** Task queue size limit */
  maxQueueSize: number
  /** Whether to use shared array buffers */
  useSharedMemory: boolean
}

/**
 * Status of the worker pool
 */
export interface WorkerPoolStatus {
  /** Number of active workers */
  activeWorkers: number
  /** Number of idle workers */
  idleWorkers: number
  /** Number of tasks in queue */
  queuedTasks: number
  /** Number of tasks being processed */
  processingTasks: number
  /** Average task completion time (milliseconds) */
  avgTaskTimeMs: number
}

// ─── Cross-System Compatibility ─────────────────────────────────────────────

/**
 * Compatibility matrix entry
 */
export interface SystemCompatibility {
  /** Source system */
  source: ProofSystem
  /** Target system */
  target: ProofSystem
  /** Whether conversion is supported */
  conversionSupported: boolean
  /** Whether aggregation is supported */
  aggregationSupported: boolean
  /** Compatibility notes */
  notes?: string
}

/**
 * Full compatibility matrix
 */
export type CompatibilityMatrix = Record<ProofSystem, Record<ProofSystem, SystemCompatibility>>

// ─── Fallback Configuration ─────────────────────────────────────────────────

/**
 * Fallback strategy configuration
 */
export interface FallbackConfig {
  /** Primary proof system */
  primary: ProofSystem
  /** Fallback chain (in order of preference) */
  fallbackChain: ProofSystem[]
  /** Whether to retry on failure */
  retryOnFailure: boolean
  /** Maximum retry attempts */
  maxRetries: number
  /** Delay between retries (milliseconds) */
  retryDelayMs: number
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean
}

// ─── Telemetry ──────────────────────────────────────────────────────────────

/**
 * Telemetry data for proof operations
 */
export interface ProofTelemetry {
  /** Operation type */
  operation: 'generate' | 'verify' | 'compose' | 'aggregate' | 'convert'
  /** Proof system used */
  system: ProofSystem
  /** Circuit ID */
  circuitId: string
  /** Duration in milliseconds */
  durationMs: number
  /** Whether operation succeeded */
  success: boolean
  /** Error code (if failed) */
  errorCode?: string
  /** Memory usage (bytes) */
  memoryUsage?: number
  /** Timestamp */
  timestamp: number
}

/**
 * Telemetry collector interface
 */
export interface TelemetryCollector {
  /** Record a telemetry event */
  record(telemetry: ProofTelemetry): void
  /** Flush pending telemetry */
  flush(): Promise<void>
  /** Get aggregated metrics */
  getMetrics(): ProofTelemetryMetrics
}

/**
 * Aggregated telemetry metrics
 */
export interface ProofTelemetryMetrics {
  /** Operations by type */
  operationCounts: Record<string, number>
  /** Average duration by operation type */
  avgDurationMs: Record<string, number>
  /** Success rate by operation type */
  successRates: Record<string, number>
  /** Total operations */
  totalOperations: number
  /** Time window for these metrics */
  timeWindowMs: number
}

// ─── Re-exports for Convenience ─────────────────────────────────────────────

// Enums (must be exported as values, not types)
export {
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
  DEFAULT_COMPOSITION_CONFIG,
} from '@sip-protocol/types'

// Types
export type {
  ProofSystem,
  SingleProof,
  ComposedProof,
  ProofMetadata,
  CompositionMetadata,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  CompositionResult,
  CompositionError,
  CompositionMetrics,
  VerificationResult,
  IndividualVerificationResult,
  VerificationHints,
  CompositionEventType,
  CompositionEvent,
  CompositionProgressEvent,
  CompositionEventListener,
} from '@sip-protocol/types'
