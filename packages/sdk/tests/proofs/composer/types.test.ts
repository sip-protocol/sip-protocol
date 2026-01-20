/**
 * Proof Composition Types Tests
 *
 * Tests for type definitions and exports in the proof composition module.
 */

import { describe, it, expect } from 'vitest'
import {
  // Enums
  ProofAggregationStrategy,
  ComposedProofStatus,
  CompositionErrorCode,
  // Constants
  DEFAULT_COMPOSITION_CONFIG,
  // Error classes
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
  IncompatibleSystemsError,
} from '../../../src/proofs/composer'

import type {
  // Base types from @sip-protocol/types
  ProofSystem,
  ProofMetadata,
  SingleProof,
  ComposedProof,
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
  // SDK-specific types
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
  // Interfaces
  ComposableProofProvider,
  ProofComposer,
  ProofProviderFactory,
  ProofProviderRegistry,
} from '../../../src/proofs/composer'

describe('Proof Composition Types', () => {
  // ─── Enum Tests ─────────────────────────────────────────────────────────────

  describe('ProofAggregationStrategy', () => {
    it('should have all expected values', () => {
      expect(ProofAggregationStrategy.SEQUENTIAL).toBe('sequential')
      expect(ProofAggregationStrategy.PARALLEL).toBe('parallel')
      expect(ProofAggregationStrategy.RECURSIVE).toBe('recursive')
      expect(ProofAggregationStrategy.BATCH).toBe('batch')
    })

    it('should have exactly 4 strategies', () => {
      const values = Object.values(ProofAggregationStrategy)
      expect(values).toHaveLength(4)
    })
  })

  describe('ComposedProofStatus', () => {
    it('should have all expected values', () => {
      expect(ComposedProofStatus.GENERATING).toBe('generating')
      expect(ComposedProofStatus.PENDING_VERIFICATION).toBe('pending_verification')
      expect(ComposedProofStatus.VERIFIED).toBe('verified')
      expect(ComposedProofStatus.FAILED).toBe('failed')
      expect(ComposedProofStatus.EXPIRED).toBe('expired')
    })

    it('should have exactly 5 statuses', () => {
      const values = Object.values(ComposedProofStatus)
      expect(values).toHaveLength(5)
    })
  })

  describe('CompositionErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(CompositionErrorCode.INVALID_PROOF).toBe('INVALID_PROOF')
      expect(CompositionErrorCode.INCOMPATIBLE_SYSTEMS).toBe('INCOMPATIBLE_SYSTEMS')
      expect(CompositionErrorCode.TIMEOUT).toBe('TIMEOUT')
      expect(CompositionErrorCode.PROVIDER_NOT_READY).toBe('PROVIDER_NOT_READY')
      expect(CompositionErrorCode.VERIFICATION_FAILED).toBe('VERIFICATION_FAILED')
      expect(CompositionErrorCode.TOO_MANY_PROOFS).toBe('TOO_MANY_PROOFS')
      expect(CompositionErrorCode.CIRCUIT_NOT_FOUND).toBe('CIRCUIT_NOT_FOUND')
      expect(CompositionErrorCode.OUT_OF_MEMORY).toBe('OUT_OF_MEMORY')
      expect(CompositionErrorCode.UNKNOWN).toBe('UNKNOWN')
    })

    it('should have exactly 9 error codes', () => {
      const values = Object.values(CompositionErrorCode)
      expect(values).toHaveLength(9)
    })
  })

  // ─── Default Configuration Tests ────────────────────────────────────────────

  describe('DEFAULT_COMPOSITION_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_COMPOSITION_CONFIG.strategy).toBe(ProofAggregationStrategy.SEQUENTIAL)
      expect(DEFAULT_COMPOSITION_CONFIG.maxProofs).toBe(10)
      expect(DEFAULT_COMPOSITION_CONFIG.timeoutMs).toBe(300000) // 5 minutes
      expect(DEFAULT_COMPOSITION_CONFIG.enableParallelGeneration).toBe(true)
      expect(DEFAULT_COMPOSITION_CONFIG.maxParallelWorkers).toBe(4)
      expect(DEFAULT_COMPOSITION_CONFIG.enableCaching).toBe(true)
      expect(DEFAULT_COMPOSITION_CONFIG.cacheTtlMs).toBe(3600000) // 1 hour
      expect(DEFAULT_COMPOSITION_CONFIG.enableRecursiveAggregation).toBe(false)
      expect(DEFAULT_COMPOSITION_CONFIG.maxRecursionDepth).toBe(3)
    })

    it('should be a valid ProofCompositionConfig', () => {
      const config: ProofCompositionConfig = DEFAULT_COMPOSITION_CONFIG
      expect(config).toBeDefined()
    })
  })

  // ─── Error Class Tests ──────────────────────────────────────────────────────

  describe('ProofCompositionError', () => {
    it('should create error with code and message', () => {
      const error = new ProofCompositionError('TEST_CODE', 'Test message')
      expect(error.name).toBe('ProofCompositionError')
      expect(error.code).toBe('TEST_CODE')
      expect(error.message).toBe('Test message')
    })

    it('should accept optional options', () => {
      const cause = new Error('Original error')
      const error = new ProofCompositionError('TEST_CODE', 'Test message', {
        system: 'noir',
        proofId: 'proof-123',
        cause,
      })
      expect(error.system).toBe('noir')
      expect(error.proofId).toBe('proof-123')
      expect(error.cause).toBe(cause)
    })

    it('should be an instance of Error', () => {
      const error = new ProofCompositionError('CODE', 'message')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ProofCompositionError)
    })
  })

  describe('ProviderNotFoundError', () => {
    it('should create error with system name', () => {
      const error = new ProviderNotFoundError('halo2')
      expect(error.name).toBe('ProviderNotFoundError')
      expect(error.code).toBe('PROVIDER_NOT_FOUND')
      expect(error.message).toContain('halo2')
      expect(error.system).toBe('halo2')
    })

    it('should be an instance of ProofCompositionError', () => {
      const error = new ProviderNotFoundError('noir')
      expect(error).toBeInstanceOf(ProofCompositionError)
    })
  })

  describe('CompositionTimeoutError', () => {
    it('should create error with timeout value', () => {
      const error = new CompositionTimeoutError(5000)
      expect(error.name).toBe('CompositionTimeoutError')
      expect(error.code).toBe('TIMEOUT')
      expect(error.message).toContain('5000')
      expect(error.timeoutMs).toBe(5000)
    })

    it('should be an instance of ProofCompositionError', () => {
      const error = new CompositionTimeoutError(1000)
      expect(error).toBeInstanceOf(ProofCompositionError)
    })
  })

  describe('IncompatibleSystemsError', () => {
    it('should create error with source and target', () => {
      const error = new IncompatibleSystemsError('noir', 'kimchi')
      expect(error.name).toBe('IncompatibleSystemsError')
      expect(error.code).toBe('INCOMPATIBLE_SYSTEMS')
      expect(error.message).toContain('noir')
      expect(error.message).toContain('kimchi')
      expect(error.source).toBe('noir')
      expect(error.target).toBe('kimchi')
    })

    it('should be an instance of ProofCompositionError', () => {
      const error = new IncompatibleSystemsError('halo2', 'groth16')
      expect(error).toBeInstanceOf(ProofCompositionError)
    })
  })

  // ─── Type Structure Tests ───────────────────────────────────────────────────

  describe('Type Structures', () => {
    it('should allow creating valid ProofMetadata', () => {
      const metadata: ProofMetadata = {
        system: 'noir',
        systemVersion: '0.30.0',
        circuitId: 'funding_proof',
        circuitVersion: '1.0.0',
        generatedAt: Date.now(),
        proofSizeBytes: 1024,
      }
      expect(metadata.system).toBe('noir')
    })

    it('should allow creating valid SingleProof', () => {
      const proof: SingleProof = {
        id: 'proof-1',
        proof: '0xabcdef',
        publicInputs: ['0x123', '0x456'],
        metadata: {
          system: 'halo2',
          systemVersion: '1.0.0',
          circuitId: 'test',
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: 512,
        },
      }
      expect(proof.id).toBe('proof-1')
    })

    it('should allow creating valid CompositionResult', () => {
      const result: CompositionResult = {
        success: true,
        metrics: {
          totalTimeMs: 1000,
          generationTimeMs: 500,
          verificationTimeMs: 300,
          aggregationTimeMs: 200,
          peakMemoryBytes: 1024 * 1024,
          proofsProcessed: 2,
        },
      }
      expect(result.success).toBe(true)
    })

    it('should allow creating valid VerificationResult', () => {
      const result: VerificationResult = {
        valid: true,
        results: [
          { proofId: 'p1', valid: true, timeMs: 100 },
          { proofId: 'p2', valid: true, timeMs: 150 },
        ],
        totalTimeMs: 250,
        method: 'batch',
      }
      expect(result.valid).toBe(true)
    })

    it('should allow creating valid FallbackConfig', () => {
      const config: FallbackConfig = {
        primary: 'noir',
        fallbackChain: ['halo2', 'kimchi'],
        retryOnFailure: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        exponentialBackoff: true,
      }
      expect(config.primary).toBe('noir')
    })

    it('should allow creating valid WorkerPoolConfig', () => {
      const config: WorkerPoolConfig = {
        minWorkers: 1,
        maxWorkers: 8,
        idleTimeoutMs: 60000,
        maxQueueSize: 100,
        useSharedMemory: true,
      }
      expect(config.maxWorkers).toBe(8)
    })

    it('should allow creating valid ProofGenerationRequest', () => {
      const request: ProofGenerationRequest = {
        circuitId: 'funding_proof',
        privateInputs: { balance: 1000n },
        publicInputs: { minRequired: 100n },
        timeoutMs: 30000,
      }
      expect(request.circuitId).toBe('funding_proof')
    })
  })

  // ─── ProofSystem Type Tests ─────────────────────────────────────────────────

  describe('ProofSystem Type', () => {
    it('should accept valid proof systems', () => {
      const systems: ProofSystem[] = ['noir', 'halo2', 'kimchi', 'groth16', 'plonk']
      expect(systems).toHaveLength(5)
      systems.forEach(system => {
        expect(typeof system).toBe('string')
      })
    })
  })

  // ─── Event Types Tests ──────────────────────────────────────────────────────

  describe('Event Types', () => {
    it('should allow creating valid CompositionEvent', () => {
      const event: CompositionEvent = {
        type: 'composition:started',
        timestamp: Date.now(),
        compositionId: 'comp-123',
      }
      expect(event.type).toBe('composition:started')
    })

    it('should allow creating valid CompositionProgressEvent', () => {
      const event: CompositionProgressEvent = {
        type: 'composition:progress',
        timestamp: Date.now(),
        compositionId: 'comp-123',
        currentStep: 2,
        totalSteps: 5,
        operation: 'Generating proof',
        percentage: 40,
      }
      expect(event.percentage).toBe(40)
    })

    it('should accept event listener function', () => {
      const listener: CompositionEventListener = (event) => {
        expect(event.compositionId).toBeDefined()
      }
      listener({
        type: 'composition:completed',
        timestamp: Date.now(),
        compositionId: 'test',
      })
    })
  })
})

describe('Interface Contracts', () => {
  // These tests verify the interface contracts are exported correctly
  // Actual implementation tests will be in M20-02

  describe('ComposableProofProvider interface', () => {
    it('should have required properties defined in type', () => {
      // Type-level check - if this compiles, the interface is correct
      const mockProvider: Partial<ComposableProofProvider> = {
        system: 'noir',
        capabilities: {
          system: 'noir',
          supportsRecursion: true,
          supportsBatchVerification: true,
          supportsBrowser: true,
          supportsNode: true,
          maxProofSize: 1024 * 1024,
          supportedStrategies: [ProofAggregationStrategy.SEQUENTIAL],
          availableCircuits: ['funding_proof'],
        },
      }
      expect(mockProvider.system).toBe('noir')
    })
  })

  describe('ProofComposer interface', () => {
    it('should accept partial implementation for testing', () => {
      // Type-level check
      const mockComposer: Partial<ProofComposer> = {
        config: DEFAULT_COMPOSITION_CONFIG,
      }
      expect(mockComposer.config).toBeDefined()
    })
  })
})
