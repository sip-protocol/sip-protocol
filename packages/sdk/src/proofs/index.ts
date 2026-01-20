/**
 * Proof Providers for SIP Protocol
 *
 * This module provides a pluggable interface for ZK proof generation.
 *
 * ## Available Providers
 *
 * - **MockProofProvider**: For testing only - provides NO cryptographic security
 * - **NoirProofProvider**: Production provider using Noir circuits (coming in #14, #15, #16)
 *
 * ## Usage
 *
 * ```typescript
 * import { MockProofProvider, NoirProofProvider } from '@sip-protocol/sdk'
 *
 * // For testing
 * const mockProvider = new MockProofProvider()
 * await mockProvider.initialize()
 *
 * // For production (when available)
 * const noirProvider = new NoirProofProvider()
 * await noirProvider.initialize()
 *
 * // Use with SIP client
 * const sip = new SIP({
 *   network: 'testnet',
 *   proofProvider: noirProvider,
 * })
 * ```
 *
 * @module proofs
 */

// Interface and types
export type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  OracleAttestation,
  ProofResult,
} from './interface'

export { ProofGenerationError } from './interface'

// Mock provider (testing only)
export { MockProofProvider } from './mock'
export type { MockProofProviderOptions } from './mock'

// NOTE: NoirProofProvider is NOT exported from main entry to avoid bundling WASM
// in server-side builds (e.g., Next.js SSR). Import directly if needed:
//
//   import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'
//
// Types are safe to export (no runtime WASM dependency)
export type { NoirProviderConfig } from './noir'

// Browser utilities (no WASM dependencies - safe for all environments)
export {
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  getBrowserInfo,
  hexToBytes as browserHexToBytes,
  bytesToHex as browserBytesToHex,
} from './browser-utils'

// NOTE: BrowserNoirProvider is NOT exported from main entry to avoid bundling WASM
// in server-side builds. Import from '@sip-protocol/sdk/browser' instead:
//
//   import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'
//
// Types are safe to export (no runtime WASM dependency)
export type { BrowserNoirProviderConfig, ProofProgressCallback } from './browser'

// Compliance proofs (non-financial ZK use cases)
// For Aztec/Noir bounty - "Best Non-Financial ZK Use Case"
export { ComplianceProofProvider } from './compliance-proof'
export {
  DEFAULT_VALIDITY_PERIOD_SECONDS,
  SUPPORTED_JURISDICTIONS,
  COMPLIANCE_CIRCUIT_IDS,
} from './compliance-proof'
export type {
  ComplianceProofType,
  ComplianceProofConfig,
  ViewingKeyAccessParams,
  SanctionsClearParams,
  BalanceAttestationParams,
  HistoryCompletenessParams,
  ComplianceProofResult,
} from './compliance-proof'

// ─── Proof Composition (M20) ────────────────────────────────────────────────

// Proof Aggregator
export {
  ProofAggregator,
  createProofAggregator,
  DEFAULT_AGGREGATOR_CONFIG,
} from './aggregator'

export type {
  AggregatorConfig,
  AggregationProgressEvent,
  AggregationProgressCallback,
  SequentialAggregationOptions,
  ParallelAggregationOptions,
  RecursiveAggregationOptions,
  AggregationStepResult,
  DetailedAggregationResult,
} from './aggregator'

// Verification Pipeline
export {
  VerificationPipeline,
  createVerificationPipeline,
  DEFAULT_PIPELINE_CONFIG,
} from './verifier'

export type {
  VerificationPipelineConfig,
  ProofDependency,
  VerificationOrder,
  DetailedVerificationResult,
  LinkValidationResult,
  SystemVerificationStats,
  VerificationProgressEvent,
  VerificationProgressCallback,
  VerifyOptions,
} from './verifier'

// Cross-System Validator
export {
  CrossSystemValidator,
  createCrossSystemValidator,
  SYSTEM_INFO,
  BN254_MODULUS,
  PALLAS_MODULUS,
  VESTA_MODULUS,
  BLS12_381_MODULUS,
} from './validator'

export type {
  EllipticCurve,
  FieldCharacteristics,
  SystemInfo,
  ValidationCheck,
  ValidationReport,
  CompatibilityEntry,
  ValidationOptions,
} from './validator'

// Proof Orchestrator
export {
  ProofOrchestrator,
  createProofOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
  BUILTIN_TEMPLATES,
} from './orchestrator'

export type {
  OrchestratorConfig,
  CompositionState,
  CompositionPlan,
  CompositionRequest,
  OrchestratorResult,
  AuditLogEntry,
  OrchestratorProgressEvent,
  OrchestratorProgressCallback,
  CompositionTemplate,
} from './orchestrator'

// ─── Fallback Strategies (M20-11) ───────────────────────────────────────────

// Fallback classes and factory functions
export {
  SequentialFallbackStrategy,
  ExponentialBackoffStrategy,
  PriorityFallbackStrategy,
  CircuitBreaker,
  FallbackExecutor,
  createFallbackExecutor,
  createCircuitBreaker,
  createMockFallbackProvider,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
} from './fallback'

// Fallback types
export type {
  FallbackStrategy,
  CircuitBreakerState,
  CircuitBreakerConfig,
  ProviderHealth,
  FallbackEventType,
  FallbackEvent,
  FallbackEventListener,
  FallbackExecutorConfig,
} from './fallback'

// Composer interfaces and errors
export {
  type ComposableProofProvider,
  type ProofComposer,
  type ProofProviderFactory,
  type ProofProviderRegistry,
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
  IncompatibleSystemsError,
  BaseProofComposer,
} from './composer'

// Composable Proof Providers
export {
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
  KimchiProvider,
  createKimchiProvider,
  createMinaMainnetProvider,
  createZkAppProvider,
} from './providers'

export type {
  Halo2ProviderConfig,
  Halo2CircuitConfig,
  Halo2ProvingKey,
  KimchiProviderConfig,
  KimchiCircuitConfig,
} from './providers'

// ─── Proof Format Converters (M20-08) ────────────────────────────────────────

// Converter classes and factory functions
export {
  NoirProofConverter,
  createNoirConverter,
  Halo2ProofConverter,
  createHalo2Converter,
  KimchiProofConverter,
  createKimchiConverter,
  UnifiedProofConverter,
  createUnifiedConverter,
  convertToSIP,
  convertFromSIP,
  ProofConversionError,
  InvalidProofError,
  UnsupportedVersionError,
  DEFAULT_CONVERSION_OPTIONS,
} from './converters'

// Converter types
export type {
  NativeProofFormat,
  NoirNativeProof,
  Halo2NativeProof,
  KimchiNativeProof,
  ConversionOptions,
  ConversionResult as ConverterConversionResult,
  ConversionMetadata,
  ConversionErrorCode,
  ProofConverter,
  ValidationResult,
  ValidationError,
  AnyNativeProof,
  ProofSystemToNativeMap,
} from './converters'

// Composer SDK types
export type {
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
  ProofCacheEntry,
  CacheStats,
  WorkerPoolConfig,
  WorkerPoolStatus,
  SystemCompatibility,
  CompatibilityMatrix,
  FallbackConfig,
  ProofTelemetry,
  TelemetryCollector,
  ProofTelemetryMetrics,
} from './composer'

// Re-export base types from @sip-protocol/types for convenience
export {
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
  DEFAULT_COMPOSITION_CONFIG,
} from '@sip-protocol/types'

export type {
  ProofSystem,
  ProofMetadata,
  SingleProof,
  ComposedProof,
  CompositionMetadata,
  VerificationHints,
  ProofCompositionConfig,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  CompositionResult,
  CompositionError,
  CompositionMetrics,
  VerificationResult,
  IndividualVerificationResult,
  CompositionEventType,
  CompositionEvent,
  CompositionProgressEvent,
  CompositionEventListener,
} from '@sip-protocol/types'
