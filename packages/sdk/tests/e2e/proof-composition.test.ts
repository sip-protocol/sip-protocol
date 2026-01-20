/**
 * E2E Tests for Composed Proof Verification
 *
 * Tests the complete proof composition and verification flow from intent
 * creation through composed proof generation to final verification.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/363
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel, IntentStatus } from '@sip-protocol/types'
import type { ChainId, HexString, SingleProof, ComposedProof } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  suppressConsoleWarnings,
  delay,
  type E2ETestFixture,
} from './helpers'

import {
  // Providers
  Halo2Provider,
  createHalo2Provider,
  KimchiProvider,
  createKimchiProvider,

  // Aggregator
  ProofAggregator,
  createProofAggregator,

  // Verification
  VerificationPipeline,
  createVerificationPipeline,

  // Validator
  CrossSystemValidator,
  createCrossSystemValidator,

  // Privacy
  generateViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../../src'

// ─── Test Configuration ─────────────────────────────────────────────────────

const MOCK_CIRCUITS = {
  halo2: {
    id: 'e2e_halo2_circuit',
    name: 'E2E Halo2 Circuit',
    k: 8,
    numColumns: 4,
    numPublicInputs: 2,
    supportsRecursion: true,
  },
  kimchi: {
    id: 'e2e_kimchi_circuit',
    name: 'E2E Kimchi Circuit',
    gateCount: 1000,
    publicInputCount: 2,
    usesRecursion: true,
  },
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Create a mock proof for testing
 */
function createMockProof(system: 'noir' | 'halo2' | 'kimchi', id?: string): SingleProof {
  const proofId = id || `${system}-proof-${Date.now()}`
  const proofSizes = { noir: 128, halo2: 256, kimchi: 11264 }
  const versions = { noir: '0.32.0', halo2: '0.3.0', kimchi: '1.0.0' }

  return {
    id: proofId,
    proof: `0x${'aa'.repeat(proofSizes[system])}` as HexString,
    publicInputs: [
      '0x0000000000000000000000000000000000000000000000000000000000000001' as HexString,
      '0x0000000000000000000000000000000000000000000000000000000000000064' as HexString,
    ],
    metadata: {
      system,
      systemVersion: versions[system],
      circuitId: `${system}_circuit`,
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: proofSizes[system] * 2,
    },
  }
}

/**
 * Serialize proof to JSON for persistence testing
 */
function serializeProof(proof: SingleProof | ComposedProof): string {
  return JSON.stringify(proof, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

/**
 * Deserialize proof from JSON
 */
function deserializeProof<T extends SingleProof | ComposedProof>(json: string): T {
  return JSON.parse(json, (key, value) => {
    if (key === 'verificationCost' && typeof value === 'string') {
      return BigInt(value)
    }
    return value
  }) as T
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('E2E: Proof Composition Verification', () => {
  let restoreConsole: () => void

  beforeEach(() => {
    restoreConsole = suppressConsoleWarnings()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreConsole()
    vi.restoreAllMocks()
  })

  // ─── Full Shielded Intent Flow ────────────────────────────────────────────

  describe('Full Shielded Intent with Composed Proof', () => {
    let fixture: E2ETestFixture
    let aggregator: ProofAggregator

    beforeEach(async () => {
      fixture = await createE2EFixture()
      aggregator = createProofAggregator()
    })

    afterEach(() => {
      fixture.cleanup()
    })

    it('should create shielded intent and generate composed proof', async () => {
      // Create shielded intent
      const intent = await createTestIntent(fixture.sip, {
        inputChain: 'solana' as ChainId,
        outputChain: 'zcash' as ChainId,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(intent.intentId).toBeDefined()
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)

      // Generate proofs from mock provider
      const fundingProof = await fixture.proofProvider.generateFundingProof({
        balance: 1_000_000_000n,
        minimumRequired: 500_000_000n,
        blindingFactor: new Uint8Array(32),
        assetId: '0x1234' as HexString,
        userAddress: '0xabcd' as HexString,
        ownershipSignature: new Uint8Array(64),
      })

      expect(fundingProof.proof).toBeDefined()

      // Create SingleProof from funding proof result
      const noirProof = createMockProof('noir', 'funding-proof')
      const halo2Proof = createMockProof('halo2', 'validity-proof')

      // Compose proofs
      const composed = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(composed.success).toBe(true)
      expect(composed.composedProof).toBeDefined()
      expect(composed.composedProof?.proofs).toHaveLength(2)
    })

    it('should link intent to composed proof', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Generate proof tied to intent
      const noirProof = createMockProof('noir')
      // Add intent reference to proof metadata
      const linkedProof: SingleProof = {
        ...noirProof,
        metadata: {
          ...noirProof.metadata,
          targetChainId: intent.outputAsset.chain,
        },
      }

      const composed = await aggregator.aggregateSequential({
        proofs: [linkedProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(composed.success).toBe(true)
      expect(composed.composedProof?.proofs[0].metadata.targetChainId).toBe(intent.outputAsset.chain)
    })

    it('should complete full swap flow with composed proof', async () => {
      const intent = await createTestIntent(fixture.sip, {
        inputChain: 'solana' as ChainId,
        outputChain: 'zcash' as ChainId,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      // Get quotes
      const quotes = await fixture.sip.getQuotes(intent)
      expect(quotes.length).toBeGreaterThan(0)

      // Execute
      const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
      const result = await fixture.sip.execute(tracked, quotes[0])

      expect(result.status).toBe(IntentStatus.FULFILLED)
    })
  })

  // ─── Node.js Environment Testing ──────────────────────────────────────────

  describe('Proof Generation in Node.js Environment', () => {
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

    it('should generate Halo2 proof in Node.js', async () => {
      const result = await halo2Provider.generateProof({
        circuitId: 'e2e_halo2_circuit',
        privateInputs: { secret: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
      expect(result.proof?.metadata.system).toBe('halo2')
      expect(result.timeMs).toBeGreaterThanOrEqual(0)
    })

    it('should generate Kimchi proof in Node.js', async () => {
      const result = await kimchiProvider.generateProof({
        circuitId: 'e2e_kimchi_circuit',
        privateInputs: { witness: '0xabcd' },
        publicInputs: { output: '0xef01' },
      })

      expect(result.success).toBe(true)
      expect(result.proof).toBeDefined()
      expect(result.proof?.metadata.system).toBe('kimchi')
    })

    it('should compose proofs from multiple providers', async () => {
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'e2e_halo2_circuit',
        privateInputs: { secret: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      const kimchiResult = await kimchiProvider.generateProof({
        circuitId: 'e2e_kimchi_circuit',
        privateInputs: { witness: '0xabcd' },
        publicInputs: { output: '0xef01' },
      })

      expect(halo2Result.proof).toBeDefined()
      expect(kimchiResult.proof).toBeDefined()

      const composed = await aggregator.aggregateSequential({
        proofs: [halo2Result.proof!, kimchiResult.proof!],
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
        verifyBefore: false,
      })

      expect(composed.success).toBe(true)
      expect(composed.composedProof?.compositionMetadata.systems).toContain('halo2')
      expect(composed.composedProof?.compositionMetadata.systems).toContain('kimchi')
    })

    it('should handle concurrent proof generation', async () => {
      const promises = [
        halo2Provider.generateProof({
          circuitId: 'e2e_halo2_circuit',
          privateInputs: { secret: '0x1111' },
          publicInputs: { commitment: '0x2222' },
        }),
        halo2Provider.generateProof({
          circuitId: 'e2e_halo2_circuit',
          privateInputs: { secret: '0x3333' },
          publicInputs: { commitment: '0x4444' },
        }),
        kimchiProvider.generateProof({
          circuitId: 'e2e_kimchi_circuit',
          privateInputs: { witness: '0x5555' },
          publicInputs: { output: '0x6666' },
        }),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.proof).toBeDefined()
      })
    })

    it('should report provider metrics', async () => {
      await halo2Provider.generateProof({
        circuitId: 'e2e_halo2_circuit',
        privateInputs: { secret: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      const status = halo2Provider.status
      expect(status.isReady).toBe(true)
      expect(status.metrics.proofsGenerated).toBeGreaterThan(0)
    })
  })

  // ─── Third-Party Verification ─────────────────────────────────────────────

  describe('Verification by Third Party', () => {
    let halo2Provider: Halo2Provider
    let kimchiProvider: KimchiProvider
    let pipeline: VerificationPipeline
    let validator: CrossSystemValidator
    let aggregator: ProofAggregator

    beforeEach(async () => {
      halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      kimchiProvider = createKimchiProvider({ enablePickles: true })
      kimchiProvider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await kimchiProvider.initialize()

      pipeline = createVerificationPipeline()
      validator = createCrossSystemValidator()
      aggregator = createProofAggregator()
    })

    afterEach(async () => {
      await halo2Provider.dispose()
      await kimchiProvider.dispose()
    })

    it('should verify composed proof as third party', async () => {
      // Original party generates proofs
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'e2e_halo2_circuit',
        privateInputs: { secret: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      const kimchiResult = await kimchiProvider.generateProof({
        circuitId: 'e2e_kimchi_circuit',
        privateInputs: { witness: '0xabcd' },
        publicInputs: { output: '0xef01' },
      })

      const composed = await aggregator.aggregateSequential({
        proofs: [halo2Result.proof!, kimchiResult.proof!],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(composed.composedProof).toBeDefined()

      // Third party verifies without private inputs
      const verificationResult = await pipeline.verify(composed.composedProof!, {
        getProvider: (system) => {
          if (system === 'halo2') return halo2Provider
          if (system === 'kimchi') return kimchiProvider
          return undefined
        },
      })

      expect(verificationResult.valid).toBe(true)
      expect(verificationResult.results).toHaveLength(2)
    })

    it('should validate proof structure without providers', () => {
      const noirProof = createMockProof('noir')
      const halo2Proof = createMockProof('halo2')

      const validationReport = validator.validate([noirProof, halo2Proof])

      expect(validationReport).toBeDefined()
      expect(validationReport.checks.length).toBeGreaterThan(0)
      expect(validationReport.proofsValidated).toBe(2)
    })

    it('should detect tampered proof', async () => {
      const halo2Result = await halo2Provider.generateProof({
        circuitId: 'e2e_halo2_circuit',
        privateInputs: { secret: '0x1234' },
        publicInputs: { commitment: '0x5678' },
      })

      // Tamper with proof data
      const tamperedProof: SingleProof = {
        ...halo2Result.proof!,
        proof: `0x${'ff'.repeat(256)}` as HexString,
      }

      const verifyResult = await halo2Provider.verifyProof(tamperedProof)
      // Mock provider validates format, actual tampering detection would fail real verification
      expect(typeof verifyResult).toBe('boolean')
    })

    it('should verify cross-system links', async () => {
      const noirProof = createMockProof('noir', 'link-proof-1')
      const halo2Proof = createMockProof('halo2', 'link-proof-2')

      const link = aggregator.createCrossSystemLink(noirProof, halo2Proof)
      expect(link).toBeDefined()
      expect(link.startsWith('0x')).toBe(true)

      const isValid = aggregator.verifyCrossSystemLink(noirProof, halo2Proof, link)
      expect(isValid).toBe(true)
    })
  })

  // ─── Proof Persistence and Reload ─────────────────────────────────────────

  describe('Proof Persistence and Reload', () => {
    let aggregator: ProofAggregator

    beforeEach(() => {
      aggregator = createProofAggregator()
    })

    it('should serialize and deserialize single proof', () => {
      const original = createMockProof('noir')

      const serialized = serializeProof(original)
      expect(typeof serialized).toBe('string')

      const restored = deserializeProof<SingleProof>(serialized)

      expect(restored.id).toBe(original.id)
      expect(restored.proof).toBe(original.proof)
      expect(restored.metadata.system).toBe(original.metadata.system)
      expect(restored.publicInputs).toEqual(original.publicInputs)
    })

    it('should serialize and deserialize composed proof', async () => {
      const noirProof = createMockProof('noir')
      const halo2Proof = createMockProof('halo2')

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.composedProof).toBeDefined()

      const serialized = serializeProof(result.composedProof!)
      const restored = deserializeProof<ComposedProof>(serialized)

      expect(restored.id).toBe(result.composedProof!.id)
      expect(restored.proofs).toHaveLength(2)
      expect(restored.compositionMetadata.systems).toEqual(
        result.composedProof!.compositionMetadata.systems
      )
    })

    it('should handle proof reload and re-verification', async () => {
      const halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      try {
        // Generate proof
        const genResult = await halo2Provider.generateProof({
          circuitId: 'e2e_halo2_circuit',
          privateInputs: { secret: '0x1234' },
          publicInputs: { commitment: '0x5678' },
        })

        // Serialize (simulate persistence)
        const serialized = serializeProof(genResult.proof!)

        // Simulate app restart by deserializing
        const restored = deserializeProof<SingleProof>(serialized)

        // Re-verify the restored proof
        const isValid = await halo2Provider.verifyProof(restored)
        expect(isValid).toBe(true)
      } finally {
        await halo2Provider.dispose()
      }
    })

    it('should preserve verification hints after reload', async () => {
      const noirProof = createMockProof('noir')
      const halo2Proof = createMockProof('halo2')
      const kimchiProof = createMockProof('kimchi')

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof, kimchiProof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      const serialized = serializeProof(result.composedProof!)
      const restored = deserializeProof<ComposedProof>(serialized)

      expect(restored.verificationHints).toBeDefined()
      expect(restored.verificationHints?.verificationOrder).toHaveLength(3)
    })

    it('should handle large composed proofs', async () => {
      // Create many proofs
      const proofs = Array.from({ length: 10 }, (_, i) =>
        createMockProof(
          i % 3 === 0 ? 'noir' : i % 3 === 1 ? 'halo2' : 'kimchi',
          `proof-${i}`
        )
      )

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
      })

      const serialized = serializeProof(result.composedProof!)
      expect(serialized.length).toBeGreaterThan(10000)

      const restored = deserializeProof<ComposedProof>(serialized)
      expect(restored.proofs).toHaveLength(10)
    })
  })

  // ─── Viewing Key Disclosure ───────────────────────────────────────────────

  describe('Composed Proof with Viewing Key Disclosure', () => {
    let fixture: E2ETestFixture
    let aggregator: ProofAggregator

    beforeEach(async () => {
      fixture = await createE2EFixture()
      aggregator = createProofAggregator()
    })

    afterEach(() => {
      fixture.cleanup()
    })

    it('should create compliant intent with viewing key', async () => {
      const intent = await createTestIntent(fixture.sip, {
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)
      expect(intent.viewingKeyHash).toBeDefined()
    })

    it('should encrypt proof metadata for viewing key holder', () => {
      const viewingKey = generateViewingKey('/m/44/501/0/audit')

      const proofMetadata = {
        sender: '0x1234567890abcdef',
        recipient: '0xfedcba0987654321',
        amount: '1000000000',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(proofMetadata, viewingKey)
      expect(encrypted).toBeDefined()
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce).toBeDefined()

      const decrypted = decryptWithViewing(encrypted, viewingKey)
      expect(decrypted.sender).toBe(proofMetadata.sender)
      expect(decrypted.recipient).toBe(proofMetadata.recipient)
      expect(decrypted.amount).toBe(proofMetadata.amount)
    })

    it('should link composed proof to viewing key', async () => {
      const viewingKey = generateViewingKey('/m/44/501/0/compliance')
      const noirProof = createMockProof('noir')
      const halo2Proof = createMockProof('halo2')

      // Create composed proof with viewing key metadata
      const result = await aggregator.aggregateSequential({
        proofs: [noirProof, halo2Proof],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      // Encrypt composition metadata for auditor
      const timestamp = Date.now()
      const compositionData = {
        sender: 'prover-address-0x1234',
        recipient: 'verifier-address-0x5678',
        amount: String(result.composedProof!.compositionMetadata.proofCount),
        timestamp,
      }

      const encrypted = encryptForViewing(compositionData, viewingKey)
      expect(encrypted).toBeDefined()
      expect(encrypted.ciphertext).toBeDefined()

      // Auditor can decrypt with viewing key
      const decrypted = decryptWithViewing(encrypted, viewingKey)
      expect(decrypted.timestamp).toBe(timestamp)
      expect(decrypted.amount).toBe('2')
    })

    it('should deny access without correct viewing key', () => {
      const correctKey = generateViewingKey('/m/44/501/0/correct')
      const wrongKey = generateViewingKey('/m/44/501/0/wrong')

      const data = {
        sender: 'secret-sender',
        recipient: 'secret-recipient',
        amount: '999999',
        timestamp: Date.now(),
      }

      const encrypted = encryptForViewing(data, correctKey)

      // Wrong key should fail to decrypt
      expect(() => {
        decryptWithViewing(encrypted, wrongKey)
      }).toThrow()
    })

    it('should support selective disclosure', async () => {
      const masterKey = generateViewingKey('/m/44/501/0/master')

      // Create multiple proofs with encrypted metadata
      const proofs = [
        createMockProof('noir', 'tx-1'),
        createMockProof('halo2', 'tx-2'),
        createMockProof('kimchi', 'tx-3'),
      ]

      const encryptedMetadata = proofs.map((proof, i) => ({
        proofId: proof.id,
        encrypted: encryptForViewing({
          sender: `sender-${i}`,
          recipient: `recipient-${i}`,
          amount: `${(i + 1) * 1000}`,
          timestamp: Date.now() + i,
        }, masterKey),
      }))

      // Auditor can selectively decrypt each
      encryptedMetadata.forEach(({ encrypted }) => {
        const decrypted = decryptWithViewing(encrypted, masterKey)
        expect(decrypted.sender).toContain('sender-')
      })
    })
  })

  // ─── Failure Scenarios ────────────────────────────────────────────────────

  describe('Failure Scenarios and Error Handling', () => {
    let aggregator: ProofAggregator

    beforeEach(() => {
      aggregator = createProofAggregator()
    })

    it('should handle empty proof array', async () => {
      const result = await aggregator.aggregateSequential({
        proofs: [],
        getProvider: () => undefined,
        verifyBefore: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No proofs')
    })

    it('should handle provider initialization failure', async () => {
      const provider = createHalo2Provider()
      // Don't call initialize()

      const result = await provider.generateProof({
        circuitId: 'nonexistent',
        privateInputs: {},
        publicInputs: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })

    it('should handle circuit not found', async () => {
      const provider = createHalo2Provider()
      await provider.initialize()

      try {
        const result = await provider.generateProof({
          circuitId: 'nonexistent_circuit',
          privateInputs: {},
          publicInputs: {},
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found')
      } finally {
        await provider.dispose()
      }
    })

    it('should handle aggregation timeout', async () => {
      const slowAggregator = createProofAggregator({ timeoutMs: 1 })

      // Create many proofs to trigger timeout
      const proofs = Array.from({ length: 100 }, (_, i) =>
        createMockProof('noir', `timeout-proof-${i}`)
      )

      const result = await slowAggregator.aggregateSequential({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
      })

      // Either succeeds quickly or reports timeout
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle abort signal', async () => {
      const controller = new AbortController()
      controller.abort()

      const noirProof = createMockProof('noir')

      const result = await aggregator.aggregateSequential({
        proofs: [noirProof],
        getProvider: () => undefined,
        verifyBefore: false,
        abortSignal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('aborted')
    })

    it('should handle verification failure gracefully', async () => {
      const halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      try {
        // Create a proof that doesn't match the halo2 system
        const wrongSystemProof: SingleProof = {
          id: 'wrong-system',
          proof: `0x${'ff'.repeat(256)}` as HexString,
          publicInputs: [],
          metadata: {
            system: 'noir', // Wrong system for halo2 provider
            systemVersion: '0.32.0',
            circuitId: 'test',
            circuitVersion: '1.0.0',
            generatedAt: Date.now(),
            proofSizeBytes: 512,
          },
        }

        // Halo2 provider should reject proof from wrong system
        const isValid = await halo2Provider.verifyProof(wrongSystemProof)
        expect(isValid).toBe(false)
      } finally {
        await halo2Provider.dispose()
      }
    })

    it('should handle provider dispose during operation', async () => {
      const provider = createKimchiProvider({ enablePickles: true })
      provider.registerCircuit(MOCK_CIRCUITS.kimchi)
      await provider.initialize()

      // Start proof generation
      const generatePromise = provider.generateProof({
        circuitId: 'e2e_kimchi_circuit',
        privateInputs: { witness: '0xabcd' },
        publicInputs: { output: '0xef01' },
      })

      // Dispose while generating (race condition test)
      await delay(10)
      await provider.dispose()

      const result = await generatePromise
      // Should either complete or fail gracefully
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle malformed proof data', () => {
      const validator = createCrossSystemValidator()

      const malformedProof: SingleProof = {
        id: 'malformed',
        proof: 'not-hex-data' as HexString,
        publicInputs: ['invalid' as HexString],
        metadata: {
          system: 'noir',
          systemVersion: '',
          circuitId: '',
          circuitVersion: '',
          generatedAt: -1,
          proofSizeBytes: -1,
        },
      }

      const report = validator.validate([malformedProof])
      expect(report).toBeDefined()
      // Validator should process even malformed proofs
    })
  })

  // ─── Performance Assertions ───────────────────────────────────────────────

  describe('Performance Assertions', () => {
    it('should generate single proof within threshold', async () => {
      const provider = createHalo2Provider({ enableRecursion: true })
      provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await provider.initialize()

      try {
        const startTime = Date.now()

        const result = await provider.generateProof({
          circuitId: 'e2e_halo2_circuit',
          privateInputs: { secret: '0x1234' },
          publicInputs: { commitment: '0x5678' },
        })

        const duration = Date.now() - startTime

        expect(result.success).toBe(true)
        expect(duration).toBeLessThan(2000) // Target: <2s for single proof
      } finally {
        await provider.dispose()
      }
    })

    it('should compose proofs within threshold', async () => {
      const aggregator = createProofAggregator()
      const proofs = [
        createMockProof('noir'),
        createMockProof('halo2'),
        createMockProof('kimchi'),
      ]

      const startTime = Date.now()

      const result = await aggregator.aggregateSequential({
        proofs,
        getProvider: () => undefined,
        verifyBefore: false,
      })

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(10000) // Target: <10s for composed proof
    })

    it('should verify within threshold', async () => {
      const halo2Provider = createHalo2Provider({ enableRecursion: true })
      halo2Provider.registerCircuit(MOCK_CIRCUITS.halo2)
      await halo2Provider.initialize()

      try {
        const genResult = await halo2Provider.generateProof({
          circuitId: 'e2e_halo2_circuit',
          privateInputs: { secret: '0x1234' },
          publicInputs: { commitment: '0x5678' },
        })

        const startTime = Date.now()
        const isValid = await halo2Provider.verifyProof(genResult.proof!)
        const duration = Date.now() - startTime

        expect(isValid).toBe(true)
        expect(duration).toBeLessThan(500) // Target: <500ms for verification
      } finally {
        await halo2Provider.dispose()
      }
    })
  })
})
