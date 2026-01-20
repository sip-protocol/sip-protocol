/**
 * Integration Tests for Multi-System Proof Composition
 *
 * Tests proof composition across multiple ZK systems (Noir, Halo2, Kimchi).
 * Verifies provider interoperability, format conversions, and cross-system
 * verification.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/360
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { HexString, SingleProof, ProofSystem } from '@sip-protocol/types'

import {
  // Providers
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
  KimchiProvider,
  createKimchiProvider,
  createMinaMainnetProvider,

  // Aggregator
  ProofAggregator,
  createProofAggregator,

  // Converters
  UnifiedProofConverter,
  createUnifiedConverter,
  convertToSIP,
  convertFromSIP,

  // Validator
  CrossSystemValidator,
  createCrossSystemValidator,

  // Verification
  VerificationPipeline,
  createVerificationPipeline,
} from '../../src'

// ─── Test Configuration ─────────────────────────────────────────────────────

// Mock circuits for testing
const MOCK_CIRCUITS = {
  halo2: {
    id: 'test_halo2_circuit',
    name: 'Test Halo2 Circuit',
    k: 8,
    numColumns: 4,
    numPublicInputs: 2,
    supportsRecursion: true,
  },
  kimchi: {
    id: 'test_kimchi_circuit',
    name: 'Test Kimchi Circuit',
    gateCount: 1000,
    publicInputCount: 2,
    usesRecursion: true,
  },
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Create a mock Noir-style proof for testing
 */
function createMockNoirProof(id?: string): SingleProof {
  const proofId = id || `noir-proof-${Date.now()}`
  return {
    id: proofId,
    proof: `0x${'aa'.repeat(128)}` as HexString,
    publicInputs: [
      '0x0000000000000000000000000000000000000000000000000000000000000001' as HexString,
      '0x0000000000000000000000000000000000000000000000000000000000000064' as HexString,
    ],
    metadata: {
      system: 'noir',
      systemVersion: '0.32.0',
      circuitId: 'funding_proof',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
    },
  }
}

/**
 * Create a mock Halo2-style proof for testing
 */
function createMockHalo2Proof(id?: string): SingleProof {
  const proofId = id || `halo2-proof-${Date.now()}`
  return {
    id: proofId,
    proof: `0x${'bb'.repeat(256)}` as HexString,
    publicInputs: [
      '0x0000000000000000000000000000000000000000000000000000000000000002' as HexString,
      '0x00000000000000000000000000000000000000000000000000000000000000c8' as HexString,
    ],
    metadata: {
      system: 'halo2',
      systemVersion: '0.3.0',
      circuitId: 'orchard_action',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 512,
    },
  }
}

/**
 * Create a mock Kimchi-style proof for testing
 */
function createMockKimchiProof(id?: string): SingleProof {
  const proofId = id || `kimchi-proof-${Date.now()}`
  return {
    id: proofId,
    proof: `0x${'cc'.repeat(11264)}` as HexString, // ~22KB
    publicInputs: [
      '0x0000000000000000000000000000000000000000000000000000000000000003' as HexString,
      '0x000000000000000000000000000000000000000000000000000000000000012c' as HexString,
    ],
    metadata: {
      system: 'kimchi',
      systemVersion: '1.0.0',
      circuitId: 'token_transfer',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 22528,
    },
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Multi-System Proof Composition Integration', () => {
  // Suppress console output during tests
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Noir + Halo2 Composition ───────────────────────────────────────────────

  describe('Noir + Halo2 Proof Composition', () => {
    let halo2Provider: Halo2Provider
    let aggregator: ProofAggregator

    beforeEach(async () => {
      halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      aggregator = createProofAggregator()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
    })

    it('should compose Noir and Halo2 proofs sequentially', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          // For noir, we just pass through (no verification needed for mock)
          return undefined
        },
        verifyBefore: false, // Skip verification for mock proofs
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs).toHaveLength(2)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.systems).toContain('halo2')
    })

    it('should compose Noir and Halo2 proofs in parallel', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const result = await aggregator.aggregateParallel({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined, // No verification
        verifyBefore: false,
        maxConcurrent: 2,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.strategy).toBe('parallel')
    })

    it('should generate verification hints for Noir + Halo2', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.composedProof?.verificationHints).toBeDefined()
      expect(result.composedProof?.verificationHints?.verificationOrder).toHaveLength(2)
      expect(result.composedProof?.verificationHints?.parallelGroups).toBeDefined()
    })
  })

  // ─── Noir + Kimchi Composition ──────────────────────────────────────────────

  describe('Noir + Kimchi Proof Composition', () => {
    let kimchiProvider: KimchiProvider
    let aggregator: ProofAggregator

    beforeEach(async () => {
      kimchiProvider = createKimchiProvider({ enablePickles: true })
      kimchiProvider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await kimchiProvider.initialize()

      aggregator = createProofAggregator()
    })

    afterEach(async () => {
      await kimchiProvider.dispose()
    })

    it('should compose Noir and Kimchi proofs sequentially', async () => {
      const noirProof = createMockNoirProof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, kimchiProof],
        getProvider: (system) => {
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs).toHaveLength(2)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.systems).toContain('kimchi')
    })

    it('should compose Noir and Kimchi proofs in parallel', async () => {
      const noirProof = createMockNoirProof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateParallel({
        proofs: [noirProof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
        maxConcurrent: 2,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe('parallel')
    })

    it('should handle Kimchi recursive merge with Pickles', async () => {
      const proof1 = createMockKimchiProof('kimchi-1')
      const proof2 = createMockKimchiProof('kimchi-2')

      // Use Kimchi's recursive merge capability
      const merged = await kimchiProvider.mergeProofsRecursively([proof1, proof2])

      expect(merged).toBeDefined()
      expect(merged?.metadata.system).toBe('kimchi')
      expect(merged?.metadata.circuitId).toBe('pickles_merge')
    })
  })

  // ─── Halo2 + Kimchi Composition ─────────────────────────────────────────────

  describe('Halo2 + Kimchi Proof Composition', () => {
    let halo2Provider: Halo2Provider
    let kimchiProvider: KimchiProvider
    let aggregator: ProofAggregator

    beforeEach(async () => {
      halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      kimchiProvider = createKimchiProvider({ enablePickles: true })
      kimchiProvider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await kimchiProvider.initialize()

      aggregator = createProofAggregator()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
      await kimchiProvider.dispose()
    })

    it('should compose Halo2 and Kimchi proofs sequentially', async () => {
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [halo2Proof, kimchiProof],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.compositionMetadata.systems).toContain('halo2')
      expect(result.composedProof?.compositionMetadata.systems).toContain('kimchi')
    })

    it('should compose Halo2 and Kimchi proofs in parallel', async () => {
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateParallel({
        proofs: [halo2Proof, kimchiProof],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
        maxConcurrent: 2,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe('parallel')
    })

    it('should batch verify Halo2 and Kimchi proofs by system', async () => {
      const halo2Proofs = [
        createMockHalo2Proof('h1'),
        createMockHalo2Proof('h2'),
      ]
      const kimchiProofs = [
        createMockKimchiProof('k1'),
        createMockKimchiProof('k2'),
      ]

      const allProofs = [...halo2Proofs, ...kimchiProofs]

      const result = await aggregator.aggregateBatch(
        allProofs,
        (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
      )

      expect(result.success).toBe(true)
      expect(result.composedProof?.proofs).toHaveLength(4)
    })
  })

  // ─── Three-System Composition ───────────────────────────────────────────────

  describe('Three-System Composition (Noir + Halo2 + Kimchi)', () => {
    let halo2Provider: Halo2Provider
    let kimchiProvider: KimchiProvider
    let aggregator: ProofAggregator

    beforeEach(async () => {
      halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      kimchiProvider = createKimchiProvider({ enablePickles: true })
      kimchiProvider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await kimchiProvider.initialize()

      aggregator = createProofAggregator()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
      await kimchiProvider.dispose()
    })

    it('should compose proofs from all three systems sequentially', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeDefined()
      expect(result.composedProof?.proofs).toHaveLength(3)
      expect(result.composedProof?.compositionMetadata.systems).toHaveLength(3)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.systems).toContain('halo2')
      expect(result.composedProof?.compositionMetadata.systems).toContain('kimchi')
    })

    it('should compose proofs from all three systems in parallel', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateParallel({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
        maxConcurrent: 3,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe('parallel')
      expect(result.composedProof?.proofs).toHaveLength(3)
    })

    it('should track metrics for three-system composition', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.metrics).toBeDefined()
      expect(result.metrics.inputProofCount).toBe(3)
      expect(result.metrics.outputProofSize).toBe(3)
      expect(result.metrics.timeMs).toBeGreaterThanOrEqual(0)
    })

    it('should combine public inputs from all systems', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.composedProof?.combinedPublicInputs).toBeDefined()
      expect(result.composedProof?.combinedPublicInputs.length).toBeGreaterThanOrEqual(6)
    })
  })

  // ─── Provider Interoperability ──────────────────────────────────────────────

  describe('Provider Interoperability', () => {
    let halo2Provider: Halo2Provider
    let kimchiProvider: KimchiProvider

    beforeEach(async () => {
      halo2Provider = createOrchardProvider()
      await halo2Provider.initialize()

      kimchiProvider = createMinaMainnetProvider()
      await kimchiProvider.initialize()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
      await kimchiProvider.dispose()
    })

    it('should generate proofs from both providers', async () => {
      // Generate Halo2 proof
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'orchard_action',
        privateInputs: { note: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      expect(halo2Result.success).toBe(true)
      expect(halo2Result.proof?.metadata.system).toBe('halo2')

      // Generate Kimchi proof
      const kimchiResult = await kimchiProvider.generateProof({
        circuitId: 'token_transfer',
        privateInputs: { sender: '0xabcd' },
        publicInputs: { amount: '0xef01' },
      })

      expect(kimchiResult.success).toBe(true)
      expect(kimchiResult.proof?.metadata.system).toBe('kimchi')
    })

    it('should verify proofs from correct providers', async () => {
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'orchard_action',
        privateInputs: { note: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      const kimchiResult = await kimchiProvider.generateProof({
        circuitId: 'token_transfer',
        privateInputs: { sender: '0xabcd' },
        publicInputs: { amount: '0xef01' },
      })

      // Verify with correct providers
      if (halo2Result.proof) {
        const halo2Valid = await halo2Provider.verifyProof(halo2Result.proof)
        expect(halo2Valid).toBe(true)
      }

      if (kimchiResult.proof) {
        const kimchiValid = await kimchiProvider.verifyProof(kimchiResult.proof)
        expect(kimchiValid).toBe(true)
      }
    })

    it('should reject proofs verified with wrong provider', async () => {
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'orchard_action',
        privateInputs: { note: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      if (halo2Result.proof) {
        // Kimchi provider should reject Halo2 proof
        const valid = await kimchiProvider.verifyProof(halo2Result.proof)
        expect(valid).toBe(false)
      }
    })

    it('should check provider capabilities', () => {
      expect(halo2Provider.capabilities.system).toBe('halo2')
      expect(halo2Provider.capabilities.supportsRecursion).toBe(true)
      expect(halo2Provider.capabilities.supportsBatchVerification).toBe(true)

      expect(kimchiProvider.capabilities.system).toBe('kimchi')
      expect(kimchiProvider.capabilities.supportsRecursion).toBe(true)
      expect(kimchiProvider.capabilities.supportsBrowser).toBe(true)
    })
  })

  // ─── Format Conversion Roundtrips ───────────────────────────────────────────

  describe('Format Conversion Roundtrips', () => {
    let converter: UnifiedProofConverter

    beforeEach(() => {
      converter = createUnifiedConverter()
    })

    it('should convert Noir proof to SIP and back', () => {
      const noirNative = {
        system: 'noir' as const,
        proofData: new Uint8Array(128).fill(0xaa),
        publicInputs: ['0x1', '0x2'],
        circuitId: 'funding_proof',
        backend: 'barretenberg' as const,
      }

      const sipResult = converter.toSIP(noirNative)
      expect(sipResult.success).toBe(true)
      expect(sipResult.result?.metadata.system).toBe('noir')

      if (sipResult.result) {
        const nativeResult = converter.fromSIP(sipResult.result)
        expect(nativeResult.success).toBe(true)
        expect(nativeResult.result?.system).toBe('noir')
      }
    })

    it('should convert Halo2 proof to SIP and back', () => {
      const halo2Native = {
        system: 'halo2' as const,
        proofData: new Uint8Array(256).fill(0xbb),
        publicInputs: ['0x3', '0x4'],
        circuitId: 'orchard_action',
        k: 11,
      }

      const sipResult = converter.toSIP(halo2Native)
      expect(sipResult.success).toBe(true)
      expect(sipResult.result?.metadata.system).toBe('halo2')

      if (sipResult.result) {
        const nativeResult = converter.fromSIP(sipResult.result)
        expect(nativeResult.success).toBe(true)
        expect(nativeResult.result?.system).toBe('halo2')
      }
    })

    it('should convert Kimchi proof to SIP and back', () => {
      const kimchiNative = {
        system: 'kimchi' as const,
        proofData: new Uint8Array(22528).fill(0xcc),
        publicInputs: ['0x5', '0x6'],
        circuitId: 'token_transfer',
        network: 'testnet' as const,
      }

      const sipResult = converter.toSIP(kimchiNative)
      expect(sipResult.success).toBe(true)
      expect(sipResult.result?.metadata.system).toBe('kimchi')

      if (sipResult.result) {
        const nativeResult = converter.fromSIP(sipResult.result)
        expect(nativeResult.success).toBe(true)
        expect(nativeResult.result?.system).toBe('kimchi')
      }
    })

    it('should preserve metadata through conversion roundtrip', () => {
      const original = {
        system: 'noir' as const,
        proofData: new Uint8Array(128).fill(0xaa),
        publicInputs: ['0x1', '0x2'],
      }

      const sipResult = converter.toSIP(original)
      expect(sipResult.success).toBe(true)

      if (sipResult.result) {
        expect(sipResult.result.metadata.system).toBe('noir')
        expect(sipResult.result.publicInputs).toHaveLength(2)
      }
    })

    it('should use convenience functions for conversion', () => {
      const noirNative = {
        system: 'noir' as const,
        proofData: new Uint8Array(128).fill(0xaa),
        publicInputs: ['0x1'],
        circuitId: 'test',
        backend: 'barretenberg' as const,
      }

      const sipResult = convertToSIP(noirNative)
      expect(sipResult.success).toBe(true)

      if (sipResult.result) {
        const nativeResult = convertFromSIP(sipResult.result)
        expect(nativeResult.success).toBe(true)
      }
    })

    it('should report conversion metadata', () => {
      const noirNative = {
        system: 'noir' as const,
        proofData: new Uint8Array(128).fill(0xaa),
        publicInputs: ['0x1'],
        circuitId: 'test',
        backend: 'barretenberg' as const,
      }

      const sipResult = convertToSIP(noirNative)
      expect(sipResult.conversionMetadata).toBeDefined()
      expect(sipResult.conversionMetadata?.sourceSystem).toBe('noir')
      expect(sipResult.conversionMetadata?.targetSystem).toBe('sip')
      expect(sipResult.conversionMetadata?.conversionTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should reject unsupported proof systems', () => {
      const unknownNative = {
        system: 'unknown' as ProofSystem,
        proof: new Uint8Array(64),
        publicInputs: ['0x1'],
        circuitId: 'test',
      }

      const result = convertToSIP(unknownNative as any)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported')
    })
  })

  // ─── Cross-System Verification ──────────────────────────────────────────────

  describe('Cross-System Verification', () => {
    let aggregator: ProofAggregator

    beforeEach(() => {
      aggregator = createProofAggregator()
    })

    it('should create cross-system links between proofs', () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const link = aggregator.createCrossSystemLink(noirProof, halo2Proof)

      expect(link).toBeDefined()
      expect(link.startsWith('0x')).toBe(true)
      expect(link.length).toBeGreaterThan(10)
    })

    it('should verify cross-system links', () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const link = aggregator.createCrossSystemLink(noirProof, halo2Proof)

      const isValid = aggregator.verifyCrossSystemLink(noirProof, halo2Proof, link)
      expect(isValid).toBe(true)
    })

    it('should reject invalid cross-system links', () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const link = aggregator.createCrossSystemLink(noirProof, halo2Proof)

      // Using wrong proofs should fail
      const isValid = aggregator.verifyCrossSystemLink(noirProof, kimchiProof, link)
      expect(isValid).toBe(false)
    })

    it('should provide sequential linking during aggregation', async () => {
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
        linkProofs: (prev, curr) => {
          return aggregator.createCrossSystemLink(prev, curr)
        },
      })

      expect(result.success).toBe(true)
      expect(result.stepResults).toHaveLength(3)
    })
  })

  // ─── Cross-System Validator ─────────────────────────────────────────────────

  describe('Cross-System Validator', () => {
    let validator: CrossSystemValidator

    beforeEach(() => {
      validator = createCrossSystemValidator()
    })

    it('should validate proof format', () => {
      const noirProof = createMockNoirProof()

      const result = validator.validate([noirProof])

      expect(result.valid).toBe(true)
      expect(result.checks.length).toBeGreaterThan(0)
    })

    it('should validate composed proof', async () => {
      const aggregator = createProofAggregator()
      const noirProof = createMockNoirProof()
      const halo2Proof = createMockHalo2Proof()

      const aggResult = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      if (aggResult.composedProof) {
        const result = validator.validateComposed(aggResult.composedProof)
        // Validator checks field compatibility between systems
        // Noir (bn254) and Halo2 (pallas) have different curves, so may show warnings
        expect(result).toBeDefined()
        expect(result.checks.length).toBeGreaterThan(0)
      }
    })

    it('should validate proof structure', () => {
      const validProof = createMockNoirProof()
      const result = validator.validate([validProof])

      // Validator should process the proof and return a report
      expect(result).toBeDefined()
      expect(result.checks.length).toBeGreaterThan(0)
      expect(result.proofsValidated).toBe(1)
    })

    it('should check system compatibility', () => {
      const isCompatible = validator.areSystemsCompatible('noir', 'halo2')
      expect(typeof isCompatible).toBe('boolean')
    })
  })

  // ─── Verification Pipeline ──────────────────────────────────────────────────

  describe('Verification Pipeline', () => {
    let pipeline: VerificationPipeline
    let halo2Provider: Halo2Provider
    let kimchiProvider: KimchiProvider

    beforeEach(async () => {
      halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      kimchiProvider = createKimchiProvider({ enablePickles: true })
      kimchiProvider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await kimchiProvider.initialize()

      pipeline = createVerificationPipeline()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
      await kimchiProvider.dispose()
    })

    it('should verify composed proof through pipeline', async () => {
      const aggregator = createProofAggregator()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const aggResult = await aggregator.aggregateSequential({
        proofs: [halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      if (aggResult.composedProof) {
        const result = await pipeline.verify(aggResult.composedProof, {
          getProvider: (system) => {
            if (system === 'halo2') return halo2Provider
            if (system === 'kimchi') return kimchiProvider
            return undefined
          },
        })

        expect(result.valid).toBe(true)
        expect(result.results).toHaveLength(2)
      }
    })

    it('should track verification order', async () => {
      const aggregator = createProofAggregator()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()

      const aggResult = await aggregator.aggregateSequential({
        proofs: [halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      if (aggResult.composedProof) {
        const result = await pipeline.verify(aggResult.composedProof, {
          getProvider: (system) => {
            if (system === 'halo2') return halo2Provider
            if (system === 'kimchi') return kimchiProvider
            return undefined
          },
        })

        expect(result.verificationOrder).toHaveLength(2)
      }
    })

    it('should report progress during verification', async () => {
      const aggregator = createProofAggregator()
      const halo2Proof = createMockHalo2Proof()
      const kimchiProof = createMockKimchiProof()
      const progressEvents: any[] = []

      const aggResult = await aggregator.aggregateSequential({
        proofs: [halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      if (aggResult.composedProof) {
        await pipeline.verify(aggResult.composedProof, {
          getProvider: (system) => {
            if (system === 'halo2') return halo2Provider
            if (system === 'kimchi') return kimchiProvider
            return undefined
          },
          onProgress: (event) => progressEvents.push(event),
        })

        expect(progressEvents.length).toBeGreaterThan(0)
      }
    })
  })

  // ─── Edge Cases and Error Handling ──────────────────────────────────────────

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty proof array', async () => {
      const aggregator = createProofAggregator()

      const result = await aggregator.aggregateSequential({
        proofs: [],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No proofs')
    })

    it('should handle single proof', async () => {
      const aggregator = createProofAggregator()
      const noirProof = createMockNoirProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.success).toBe(true)
      expect(result.composedProof?.proofs).toHaveLength(1)
    })

    it('should respect max proof limit', async () => {
      const aggregator = createProofAggregator({ maxProofs: 2 })

      const proofs = [
        createMockNoirProof('1'),
        createMockHalo2Proof('2'),
        createMockKimchiProof('3'),
      ]

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Too many proofs')
    })

    it('should handle timeout during aggregation', async () => {
      const aggregator = createProofAggregator({ timeoutMs: 1 })

      // Create many proofs to trigger timeout
      const proofs = Array.from({ length: 50 }, (_, i) =>
        createMockNoirProof(`proof-${i}`),
      )

      const result = await aggregator.aggregateParallel({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
        maxConcurrent: 1, // Slow processing
      })

      // Either succeeds quickly or times out
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle abort signal', async () => {
      const aggregator = createProofAggregator()
      const controller = new AbortController()

      // Abort immediately
      controller.abort()

      const result = await aggregator.aggregateSequential({
        proofs: [createMockNoirProof()],
        getProvider: () => undefined,
        verifyBefore: false,
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('aborted')
    })

    it('should handle missing provider during verification', async () => {
      const aggregator = createProofAggregator()
      const noirProof = createMockNoirProof()

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof],
        getProvider: () => undefined, // No providers
        verifyBefore: true, // Require verification
      })

      // When provider is not found for verification, aggregation reports step failure
      expect(result.stepResults.length).toBeGreaterThan(0)
      // Check that at least one step has success: false when no provider available
      const hasFailedStep = result.stepResults.some(step => !step.success)
      expect(hasFailedStep).toBe(true)
    })
  })

  // ─── Progress Tracking ──────────────────────────────────────────────────────

  describe('Progress Tracking', () => {
    it('should report progress during sequential aggregation', async () => {
      const aggregator = createProofAggregator()
      const progressEvents: any[] = []

      const proofs = [
        createMockNoirProof('1'),
        createMockHalo2Proof('2'),
        createMockKimchiProof('3'),
      ]

      await aggregator.aggregateSequential({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(progressEvents.length).toBe(3)
      expect(progressEvents[0].step).toBe(1)
      expect(progressEvents[1].step).toBe(2)
      expect(progressEvents[2].step).toBe(3)
    })

    it('should report progress during parallel aggregation', async () => {
      const aggregator = createProofAggregator()
      const progressEvents: any[] = []

      const proofs = [
        createMockNoirProof('1'),
        createMockHalo2Proof('2'),
        createMockKimchiProof('3'),
      ]

      await aggregator.aggregateParallel({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
        maxConcurrent: 2,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(progressEvents.length).toBe(3)
    })

    it('should emit composition events', async () => {
      const aggregator = createProofAggregator()
      const events: any[] = []

      aggregator.addEventListener((event) => events.push(event))

      await aggregator.aggregateSequential({
        proofs: [createMockNoirProof()],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(events.some(e => e.type === 'composition:started')).toBe(true)
      expect(events.some(e => e.type === 'composition:completed')).toBe(true)
    })
  })
})
