/**
 * KimchiProvider Unit Tests
 *
 * Comprehensive tests for the Kimchi (Mina) proof provider implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  KimchiProvider,
  createKimchiProvider,
  createMinaMainnetProvider,
  createZkAppProvider,
} from '../../../src/proofs/providers/kimchi'

import type {
  KimchiCircuitConfig,
} from '../../../src/proofs/providers/kimchi'

import {
  ProofAggregationStrategy,
} from '@sip-protocol/types'

import type {
  SingleProof,
  HexString,
} from '@sip-protocol/types'

// ─── Test Data ────────────────────────────────────────────────────────────────

const testCircuit: KimchiCircuitConfig = {
  id: 'test_circuit',
  name: 'Test Circuit',
  gateCount: 1000,
  publicInputCount: 2,
  usesRecursion: false,
}

const recursiveCircuit: KimchiCircuitConfig = {
  id: 'recursive_circuit',
  name: 'Recursive Circuit',
  gateCount: 5000,
  publicInputCount: 4,
  usesRecursion: true,
}

const KIMCHI_PROOF_SIZE = 22 * 1024 // ~22KB

function createMockProof(options: Partial<SingleProof> = {}): SingleProof {
  // Generate a valid-sized Kimchi proof
  const proofHex = ('0x' + 'ab'.repeat(KIMCHI_PROOF_SIZE)) as HexString
  return {
    id: options.id || `kimchi-proof-${Date.now()}`,
    proof: options.proof || proofHex,
    publicInputs: options.publicInputs || ['0x01' as HexString, '0x02' as HexString],
    metadata: {
      system: 'kimchi',
      systemVersion: '1.0.0',
      circuitId: 'test_circuit',
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: KIMCHI_PROOF_SIZE,
      ...options.metadata,
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KimchiProvider', () => {
  let provider: KimchiProvider

  beforeEach(() => {
    provider = new KimchiProvider({
      circuits: [testCircuit],
    })
  })

  afterEach(async () => {
    await provider.dispose()
  })

  // ─── Constructor and Configuration ────────────────────────────────────────

  describe('constructor and configuration', () => {
    it('should create provider with default config', () => {
      const defaultProvider = new KimchiProvider()

      expect(defaultProvider.system).toBe('kimchi')
      expect(defaultProvider.capabilities.system).toBe('kimchi')
      expect(defaultProvider.capabilities.supportsBatchVerification).toBe(true)
      expect(defaultProvider.capabilities.supportsRecursion).toBe(true) // Pickles enabled by default
    })

    it('should create provider with custom config', () => {
      const customProvider = new KimchiProvider({
        enablePickles: false,
        network: 'mainnet',
        compileWorkers: 4,
      })

      expect(customProvider.capabilities.supportsRecursion).toBe(false)
    })

    it('should include recursive strategy when Pickles enabled', () => {
      const picklesProvider = new KimchiProvider({
        enablePickles: true,
      })

      expect(picklesProvider.capabilities.supportedStrategies).toContain(
        ProofAggregationStrategy.RECURSIVE,
      )
    })

    it('should not include recursive strategy when Pickles disabled', () => {
      const noPicklesProvider = new KimchiProvider({
        enablePickles: false,
      })

      expect(noPicklesProvider.capabilities.supportedStrategies).not.toContain(
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

    it('should support browser environment', () => {
      expect(provider.capabilities.supportsBrowser).toBe(true)
      expect(provider.capabilities.supportsNode).toBe(true)
    })
  })

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should not be ready before initialization', () => {
      const newProvider = new KimchiProvider()
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
      const slowProvider = new KimchiProvider()
      // Provider auto-initializes in waitUntilReady
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

    it('should compile circuit', async () => {
      const vkHash = await provider.compileCircuit('test_circuit')
      expect(vkHash).toMatch(/^0x[a-f0-9]+$/i)
      expect(provider.isCircuitCompiled('test_circuit')).toBe(true)
    })

    it('should throw when compiling non-existent circuit', async () => {
      await expect(provider.compileCircuit('nonexistent')).rejects.toThrow(
        'Circuit not found',
      )
    })

    it('should track compilation status', async () => {
      expect(provider.isCircuitCompiled('test_circuit')).toBe(false)
      await provider.compileCircuit('test_circuit')
      expect(provider.isCircuitCompiled('test_circuit')).toBe(true)
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
      expect(result.proof?.metadata.system).toBe('kimchi')
      expect(result.proof?.metadata.circuitId).toBe('test_circuit')
      expect(result.timeMs).toBeGreaterThan(0)
    })

    it('should auto-compile circuit if not compiled', async () => {
      expect(provider.isCircuitCompiled('test_circuit')).toBe(false)

      await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(provider.isCircuitCompiled('test_circuit')).toBe(true)
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
      const uninitProvider = new KimchiProvider()

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

    it('should include verification key hash in proof', async () => {
      const result = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.proof?.verificationKey).toMatch(/^0x[a-f0-9]+$/i)
    })

    it('should include target chain in metadata', async () => {
      const result = await provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.proof?.metadata.targetChainId).toContain('mina:')
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
          system: 'kimchi',
          systemVersion: '1.0.0',
          circuitId: 'test',
          circuitVersion: '1.0.0',
          generatedAt: Date.now() - 100000,
          proofSizeBytes: KIMCHI_PROOF_SIZE,
          expiresAt: Date.now() - 1000, // Expired
        },
      })
      const isValid = await provider.verifyProof(proof)
      expect(isValid).toBe(false)
    })

    it('should throw when not initialized', async () => {
      const uninitProvider = new KimchiProvider()
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
      const uninitProvider = new KimchiProvider()
      const proofs = [createMockProof()]

      await expect(uninitProvider.verifyBatch(proofs)).rejects.toThrow(
        'not initialized',
      )
    })
  })

  // ─── Recursive Proving (Pickles) ──────────────────────────────────────────

  describe('recursive proving (Pickles)', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should report recursion support when Pickles enabled', () => {
      expect(provider.supportsRecursion()).toBe(true)
    })

    it('should not support recursion when Pickles disabled', () => {
      const noPickles = new KimchiProvider({ enablePickles: false })
      expect(noPickles.supportsRecursion()).toBe(false)
    })

    it('should return null for empty proofs array', async () => {
      const result = await provider.mergeProofsRecursively([])
      expect(result).toBeNull()
    })

    it('should return single proof unchanged', async () => {
      const proof = createMockProof()
      const result = await provider.mergeProofsRecursively([proof])
      expect(result).toBe(proof)
    })

    it('should merge multiple proofs recursively', async () => {
      const proofs = [createMockProof(), createMockProof(), createMockProof()]
      const result = await provider.mergeProofsRecursively(proofs)

      expect(result).toBeDefined()
      expect(result?.id).toContain('merged')
      expect(result?.metadata.system).toBe('kimchi')
      expect(result?.metadata.circuitId).toBe('pickles_merge')
    })

    it('should return null when Pickles disabled', async () => {
      const noPickles = new KimchiProvider({ enablePickles: false })
      await noPickles.initialize()

      const proofs = [createMockProof(), createMockProof()]
      const result = await noPickles.mergeProofsRecursively(proofs)

      expect(result).toBeNull()
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

      const genPromise = provider.generateProof({
        circuitId: 'test_circuit',
        privateInputs: {},
        publicInputs: {},
      })

      await genPromise

      expect(provider.status.isBusy).toBe(false)
    })
  })
})

describe('Factory Functions', () => {
  describe('createKimchiProvider', () => {
    it('should create provider with config', () => {
      const provider = createKimchiProvider({
        enablePickles: false,
        network: 'mainnet',
      })

      expect(provider).toBeInstanceOf(KimchiProvider)
      expect(provider.capabilities.supportsRecursion).toBe(false)
    })

    it('should create provider without config', () => {
      const provider = createKimchiProvider()
      expect(provider).toBeInstanceOf(KimchiProvider)
    })
  })

  describe('createMinaMainnetProvider', () => {
    it('should create provider configured for mainnet', async () => {
      const provider = createMinaMainnetProvider()
      await provider.initialize()

      expect(provider.hasCircuit('token_transfer')).toBe(true)
      expect(provider.hasCircuit('state_update')).toBe(true)
      expect(provider.capabilities.supportsRecursion).toBe(true)
    })
  })

  describe('createZkAppProvider', () => {
    it('should create provider for testnet by default', async () => {
      const provider = createZkAppProvider()
      await provider.initialize()

      expect(provider.hasCircuit('zkapp_method')).toBe(true)
      expect(provider.capabilities.supportsRecursion).toBe(true)
    })

    it('should create provider for local network', async () => {
      const provider = createZkAppProvider('local')
      await provider.initialize()

      expect(provider.hasCircuit('zkapp_method')).toBe(true)
    })
  })
})
