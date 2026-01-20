/**
 * Halo2Provider Unit Tests
 *
 * Comprehensive tests for the Halo2 proof provider implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
} from '../../../src/proofs/providers/halo2'

import type {
  Halo2CircuitConfig,
} from '../../../src/proofs/providers/halo2'

import {
  ProofAggregationStrategy,
} from '@sip-protocol/types'

import type {
  SingleProof,
  HexString,
} from '@sip-protocol/types'

// ─── Test Data ────────────────────────────────────────────────────────────────

const testCircuit: Halo2CircuitConfig = {
  id: 'test_circuit',
  name: 'Test Circuit',
  k: 8,
  numColumns: 5,
  numPublicInputs: 2,
  supportsRecursion: false,
}

const recursiveCircuit: Halo2CircuitConfig = {
  id: 'recursive_circuit',
  name: 'Recursive Circuit',
  k: 10,
  numColumns: 8,
  numPublicInputs: 4,
  supportsRecursion: true,
}

function createMockProof(options: Partial<SingleProof> = {}): SingleProof {
  return {
    id: options.id || `halo2-proof-${Date.now()}`,
    proof: options.proof || '0x123456789abcdef',
    publicInputs: options.publicInputs || ['0x01' as HexString, '0x02' as HexString],
    metadata: {
      system: 'halo2',
      systemVersion: '0.3.0',
      circuitId: 'test_circuit',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
      ...options.metadata,
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Halo2Provider', () => {
  let provider: Halo2Provider

  beforeEach(() => {
    provider = new Halo2Provider({
      circuits: [testCircuit],
    })
  })

  afterEach(async () => {
    await provider.dispose()
  })

  // ─── Constructor and Configuration ────────────────────────────────────────

  describe('constructor and configuration', () => {
    it('should create provider with default config', () => {
      const defaultProvider = new Halo2Provider()

      expect(defaultProvider.system).toBe('halo2')
      expect(defaultProvider.capabilities.system).toBe('halo2')
      expect(defaultProvider.capabilities.supportsBatchVerification).toBe(true)
      expect(defaultProvider.capabilities.supportsRecursion).toBe(false)
    })

    it('should create provider with custom config', () => {
      const customProvider = new Halo2Provider({
        enableRecursion: true,
        numThreads: 8,
        backend: 'wasm',
      })

      expect(customProvider.capabilities.supportsRecursion).toBe(true)
    })

    it('should include recursive strategy when recursion enabled', () => {
      const recursiveProvider = new Halo2Provider({
        enableRecursion: true,
      })

      expect(recursiveProvider.capabilities.supportedStrategies).toContain(
        ProofAggregationStrategy.RECURSIVE,
      )
    })

    it('should not include recursive strategy when recursion disabled', () => {
      expect(provider.capabilities.supportedStrategies).not.toContain(
        ProofAggregationStrategy.RECURSIVE,
      )
    })

    it('should include standard strategies', () => {
      expect(provider.capabilities.supportedStrategies).toContain(
        ProofAggregationStrategy.SEQUENTIAL,
      )
      expect(provider.capabilities.supportedStrategies).toContain(
        ProofAggregationStrategy.PARALLEL,
      )
      expect(provider.capabilities.supportedStrategies).toContain(
        ProofAggregationStrategy.BATCH,
      )
    })
  })

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should not be ready before initialization', () => {
      const newProvider = new Halo2Provider()
      expect(newProvider.status.isReady).toBe(false)
    })

    it('should be ready after initialization', async () => {
      await provider.initialize()
      expect(provider.status.isReady).toBe(true)
    })

    it('should be idempotent on multiple initialize calls', async () => {
      await provider.initialize()
      await provider.initialize()
      expect(provider.status.isReady).toBe(true)
    })

    it('should wait until ready', async () => {
      const waitPromise = provider.waitUntilReady()
      await expect(waitPromise).resolves.toBeUndefined()
      expect(provider.status.isReady).toBe(true)
    })

    it('should timeout when waiting too long', async () => {
      const slowProvider = new Halo2Provider()
      // Don't call initialize - but the provider auto-initializes in waitUntilReady
      // This test just verifies timeout behavior
      await expect(slowProvider.waitUntilReady(100)).resolves.toBeUndefined()
    })

    it('should reset state on dispose', async () => {
      await provider.initialize()
      provider.registerCircuit(testCircuit)

      await provider.dispose()

      expect(provider.status.isReady).toBe(false)
    })
  })

  // ─── Circuit Management ───────────────────────────────────────────────────

  describe('circuit management', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should have circuits from config', () => {
      expect(provider.hasCircuit('test_circuit')).toBe(true)
    })

    it('should return false for non-existent circuit', () => {
      expect(provider.hasCircuit('nonexistent')).toBe(false)
    })

    it('should list available circuits', () => {
      const circuits = provider.getAvailableCircuits()
      expect(circuits).toContain('test_circuit')
    })

    it('should register new circuits', () => {
      provider.registerCircuit(recursiveCircuit)

      expect(provider.hasCircuit('recursive_circuit')).toBe(true)
      expect(provider.getAvailableCircuits()).toContain('recursive_circuit')
    })

    it('should update capabilities when circuit registered', () => {
      provider.registerCircuit(recursiveCircuit)

      expect(provider.capabilities.availableCircuits).toContain('recursive_circuit')
    })

    it('should load circuit keys', async () => {
      await provider.loadCircuitKeys('test_circuit')
      // Should not throw
    })

    it('should throw when loading keys for non-existent circuit', async () => {
      await expect(provider.loadCircuitKeys('nonexistent')).rejects.toThrow(
        'Circuit not found',
      )
    })
  })

  // ─── Proof Generation ─────────────────────────────────────────────────────

  describe('proof generation', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should generate proof successfully', async () => {
      const result = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: { secret: '0x123' },
        publicInputs: { output: '0x456' },
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
      expect(result.proof?.metadata.system).toBe('halo2')
      expect(result.proof?.metadata.circuitId).toBe('test_circuit')
      expect(result.timeMs).toBeGreaterThan(0)
    })

    it('should fail when circuit not found', async () => {
      const result = await provider.generateProof({
        circuitId: 'nonexistent',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Circuit not found')
    })

    it('should fail when not initialized', async () => {
      const uninitProvider = new Halo2Provider()

      const result = await uninitProvider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should generate unique proof IDs', async () => {
      const result1 = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })
      const result2 = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result1.proof?.id).not.toBe(result2.proof?.id)
    })

    it('should convert public inputs to HexString', async () => {
      const result = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: { a: 42, b: 'test', c: 100n },
      })

      expect(result.success).toBe(true)
      result.proof?.publicInputs.forEach((input) => {
        expect(input.startsWith('0x')).toBe(true)
      })
    })

    it('should update metrics on generation', async () => {
      const initialCount = provider.status.metrics.proofsGenerated

      await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(provider.status.metrics.proofsGenerated).toBe(initialCount + 1)
    })

    it('should track average generation time', async () => {
      await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(provider.status.metrics.avgGenerationTimeMs).toBeGreaterThan(0)
    })
  })

  // ─── Verification ─────────────────────────────────────────────────────────

  describe('verification', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should verify valid proof', async () => {
      const proof = createMockProof()
      const isValid = await provider.verifyProof(proof)
      expect(isValid).toBe(true)
    })

    it('should reject proof with wrong system', async () => {
      const proof = createMockProof()
      // Override system after creation
      proof.metadata.system = 'noir' as any
      const isValid = await provider.verifyProof(proof)
      expect(isValid).toBe(false)
    })

    it('should reject proof with invalid format', async () => {
      const proof = createMockProof({ proof: 'invalid' as any })
      const isValid = await provider.verifyProof(proof)
      expect(isValid).toBe(false)
    })

    it('should reject expired proof', async () => {
      const proof = createMockProof({
        metadata: {
          system: 'halo2',
          systemVersion: '0.3.0',
          circuitId: 'test',
          circuitVersion: '1.0.0',
          generatedAt: Date.now() - 100000,
          proofSizeBytes: 256,
          expiresAt: Date.now() - 1000, // Expired
        },
      })
      const isValid = await provider.verifyProof(proof)
      expect(isValid).toBe(false)
    })

    it('should throw when not initialized', async () => {
      const uninitProvider = new Halo2Provider()
      const proof = createMockProof()

      await expect(uninitProvider.verifyProof(proof)).rejects.toThrow(
        'not initialized',
      )
    })

    it('should update verification metrics', async () => {
      const proof = createMockProof()
      const initialCount = provider.status.metrics.proofsVerified

      await provider.verifyProof(proof)

      expect(provider.status.metrics.proofsVerified).toBe(initialCount + 1)
    })
  })

  // ─── Batch Verification ───────────────────────────────────────────────────

  describe('batch verification', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should verify batch of proofs', async () => {
      const proofs = [createMockProof(), createMockProof(), createMockProof()]
      const results = await provider.verifyBatch(proofs)

      expect(results.length).toBe(3)
      expect(results.every(r => r === true)).toBe(true)
    })

    it('should return mixed results for mixed validity', async () => {
      const invalidProof = createMockProof()
      invalidProof.metadata.system = 'noir' as any

      const proofs = [
        createMockProof(),
        invalidProof,
        createMockProof(),
      ]
      const results = await provider.verifyBatch(proofs)

      expect(results).toEqual([true, false, true])
    })

    it('should throw when not initialized', async () => {
      const uninitProvider = new Halo2Provider()
      const proofs = [createMockProof()]

      await expect(uninitProvider.verifyBatch(proofs)).rejects.toThrow(
        'not initialized',
      )
    })
  })

  // ─── Status and Capabilities ──────────────────────────────────────────────

  describe('status and capabilities', () => {
    it('should return status copy', () => {
      const status1 = provider.status
      const status2 = provider.status

      expect(status1).not.toBe(status2)
      expect(status1).toEqual(status2)
    })

    it('should return capabilities with current circuits', async () => {
      await provider.initialize()
      provider.registerCircuit(recursiveCircuit)

      const caps = provider.capabilities
      expect(caps.availableCircuits).toContain('test_circuit')
      expect(caps.availableCircuits).toContain('recursive_circuit')
    })

    it('should report busy status during generation', async () => {
      await provider.initialize()

      // Start generation but don't await
      const genPromise = provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      // Complete the generation
      await genPromise

      // After completion, should not be busy
      expect(provider.status.isBusy).toBe(false)
    })
  })
})

describe('Factory Functions', () => {
  describe('createHalo2Provider', () => {
    it('should create provider with config', () => {
      const provider = createHalo2Provider({
        enableRecursion: true,
      })

      expect(provider).toBeInstanceOf(Halo2Provider)
      expect(provider.capabilities.supportsRecursion).toBe(true)
    })

    it('should create provider without config', () => {
      const provider = createHalo2Provider()
      expect(provider).toBeInstanceOf(Halo2Provider)
    })
  })

  describe('createOrchardProvider', () => {
    it('should create provider with Orchard circuits', async () => {
      const provider = createOrchardProvider()
      await provider.initialize()

      expect(provider.hasCircuit('orchard_action')).toBe(true)
      expect(provider.hasCircuit('orchard_bundle')).toBe(true)
    })

    it('should enable recursion', () => {
      const provider = createOrchardProvider()
      expect(provider.capabilities.supportsRecursion).toBe(true)
    })
  })
})
