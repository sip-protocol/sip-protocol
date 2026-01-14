/**
 * Arcium Backend Tests
 *
 * Comprehensive test suite for the Arcium MPC compute privacy backend.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ArciumBackend } from '../../src/privacy-backends/arcium'
import {
  ARCIUM_CLUSTERS,
  BASE_COMPUTATION_COST_LAMPORTS,
  ESTIMATED_COMPUTATION_TIME_MS,
  MAX_ENCRYPTED_INPUTS,
  MAX_INPUT_SIZE_BYTES,
  MAX_TOTAL_INPUT_SIZE_BYTES,
  MAX_COMPUTATION_COST_LAMPORTS,
} from '../../src/privacy-backends/arcium-types'
import type {
  ComputationParams,
  TransferParams,
  CipherType,
} from '../../src/privacy-backends/interface'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createValidComputationParams(
  overrides: Partial<ComputationParams> = {}
): ComputationParams {
  return {
    chain: 'solana',
    circuitId: 'test-circuit',
    encryptedInputs: [new Uint8Array([1, 2, 3, 4])],
    ...overrides,
  }
}

function createValidTransferParams(
  overrides: Partial<TransferParams> = {}
): TransferParams {
  return {
    chain: 'solana',
    sender: 'sender-address',
    recipient: 'recipient-address',
    mint: null,
    amount: BigInt(1_000_000_000),
    decimals: 9,
    ...overrides,
  }
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('ArciumBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new ArciumBackend()

      expect(backend.name).toBe('arcium')
      expect(backend.type).toBe('compute')
      expect(backend.chains).toContain('solana')
    })

    it('should accept custom rpcUrl', () => {
      const backend = new ArciumBackend({
        rpcUrl: 'https://custom.rpc.url',
      })

      expect(backend.name).toBe('arcium')
    })

    it('should accept custom network', () => {
      const backend = new ArciumBackend({
        network: 'testnet',
      })

      expect(backend.name).toBe('arcium')
    })

    it('should accept custom cluster', () => {
      const backend = new ArciumBackend({
        cluster: 'custom-cluster-1',
      })

      expect(backend.name).toBe('arcium')
    })

    it('should accept custom defaultCipher', () => {
      const backend = new ArciumBackend({
        defaultCipher: 'aes128',
      })

      expect(backend.name).toBe('arcium')
    })

    it('should accept custom timeout', () => {
      const backend = new ArciumBackend({
        timeout: 600000,
      })

      expect(backend.name).toBe('arcium')
    })

    it('should use default cluster for network', () => {
      const devnetBackend = new ArciumBackend({ network: 'devnet' })
      const testnetBackend = new ArciumBackend({ network: 'testnet' })

      // Both should create successfully with their network's default cluster
      expect(devnetBackend.name).toBe('arcium')
      expect(testnetBackend.name).toBe('arcium')
    })
  })

  // ─── Capabilities Tests ──────────────────────────────────────────────────────

  describe('getCapabilities', () => {
    it('should return correct capabilities for compute backend', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      // Compute backend capabilities
      expect(caps.hiddenCompute).toBe(true) // PRIMARY PURPOSE
      expect(caps.setupRequired).toBe(true) // Need circuit upload
      expect(caps.latencyEstimate).toBe('slow') // MPC coordination
    })

    it('should NOT hide transaction details', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      // Arcium does NOT provide transaction privacy
      expect(caps.hiddenAmount).toBe(false)
      expect(caps.hiddenSender).toBe(false)
      expect(caps.hiddenRecipient).toBe(false)
    })

    it('should NOT support compliance features', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      expect(caps.complianceSupport).toBe(false)
      expect(caps.anonymitySet).toBeUndefined()
    })

    it('should support all tokens in compute', () => {
      const backend = new ArciumBackend()
      const caps = backend.getCapabilities()

      expect(caps.supportedTokens).toBe('all')
    })
  })

  // ─── checkAvailability Tests ─────────────────────────────────────────────────

  describe('checkAvailability', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    describe('with ComputationParams', () => {
      it('should be available for valid computation params', async () => {
        const params = createValidComputationParams()

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
        expect(result.estimatedCost).toBeDefined()
        expect(result.estimatedTime).toBeDefined()
      })

      it('should include estimated time', async () => {
        const params = createValidComputationParams()

        const result = await backend.checkAvailability(params)

        expect(result.estimatedTime).toBe(ESTIMATED_COMPUTATION_TIME_MS)
      })

      it('should not be available for unsupported chain', async () => {
        const params = createValidComputationParams({ chain: 'ethereum' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('only supports Solana')
      })

      it('should not be available without circuitId', async () => {
        const params = createValidComputationParams({ circuitId: '' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('circuitId is required')
      })

      it('should not be available without encryptedInputs', async () => {
        const params = createValidComputationParams({ encryptedInputs: [] })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('encryptedInputs')
      })

      it('should not be available with empty Uint8Array input', async () => {
        const params = createValidComputationParams({
          encryptedInputs: [new Uint8Array([])],
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('non-empty Uint8Array')
      })

      it('should accept valid cipher types', async () => {
        const ciphers: CipherType[] = ['aes128', 'aes192', 'aes256', 'rescue']

        for (const cipher of ciphers) {
          const params = createValidComputationParams({ cipher })
          const result = await backend.checkAvailability(params)
          expect(result.available).toBe(true)
        }
      })

      it('should reject invalid cipher type', async () => {
        const params = createValidComputationParams({
          cipher: 'invalid-cipher' as CipherType,
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('Invalid cipher')
      })

      it('should accept multiple encrypted inputs', async () => {
        const params = createValidComputationParams({
          encryptedInputs: [
            new Uint8Array([1, 2, 3]),
            new Uint8Array([4, 5, 6]),
            new Uint8Array([7, 8, 9]),
          ],
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      // ─── Upper Bound Validation Tests ─────────────────────────────────────────

      it('should reject too many encrypted inputs', async () => {
        const tooManyInputs = Array.from(
          { length: MAX_ENCRYPTED_INPUTS + 1 },
          () => new Uint8Array([1, 2, 3])
        )
        const params = createValidComputationParams({
          encryptedInputs: tooManyInputs,
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('Too many encrypted inputs')
        expect(result.reason).toContain(`${MAX_ENCRYPTED_INPUTS + 1}`)
        expect(result.reason).toContain(`${MAX_ENCRYPTED_INPUTS}`)
      })

      it('should accept exactly MAX_ENCRYPTED_INPUTS', async () => {
        const maxInputs = Array.from(
          { length: MAX_ENCRYPTED_INPUTS },
          () => new Uint8Array([1, 2, 3])
        )
        const params = createValidComputationParams({
          encryptedInputs: maxInputs,
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should reject oversized individual input', async () => {
        const oversizedInput = new Uint8Array(MAX_INPUT_SIZE_BYTES + 1)
        const params = createValidComputationParams({
          encryptedInputs: [oversizedInput],
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('size')
        expect(result.reason).toContain('exceeds maximum')
        expect(result.reason).toContain('1 MB')
      })

      it('should accept exactly MAX_INPUT_SIZE_BYTES', async () => {
        const maxSizeInput = new Uint8Array(MAX_INPUT_SIZE_BYTES)
        maxSizeInput[0] = 1 // Ensure non-empty
        const params = createValidComputationParams({
          encryptedInputs: [maxSizeInput],
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should reject when total input size exceeds maximum', async () => {
        // Create multiple inputs that individually fit but together exceed MAX_TOTAL_INPUT_SIZE_BYTES
        const inputSize = Math.floor(MAX_INPUT_SIZE_BYTES / 2) // Half of max individual
        const numInputs = Math.ceil((MAX_TOTAL_INPUT_SIZE_BYTES + 1) / inputSize)
        const inputs = Array.from({ length: numInputs }, () => {
          const arr = new Uint8Array(inputSize)
          arr[0] = 1 // Ensure non-empty
          return arr
        })
        const params = createValidComputationParams({
          encryptedInputs: inputs,
        })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('Total input size')
        expect(result.reason).toContain('exceeds maximum')
        expect(result.reason).toContain('10 MB')
      })
    })

    describe('with TransferParams', () => {
      it('should not be available for transfer params', async () => {
        const params = createValidTransferParams()

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('compute backend')
        expect(result.reason).toContain('ComputationParams')
      })
    })
  })

  // ─── execute Tests ───────────────────────────────────────────────────────────

  describe('execute', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should fail with helpful error message', async () => {
      const params = createValidTransferParams()

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('compute privacy backend')
      expect(result.error).toContain('executeComputation')
      expect(result.backend).toBe('arcium')
    })

    it('should include hint in metadata', async () => {
      const params = createValidTransferParams()

      const result = await backend.execute(params)

      expect(result.metadata?.hint).toBe('executeComputation')
      expect(result.metadata?.paramsType).toBe('ComputationParams')
    })
  })

  // ─── executeComputation Tests ────────────────────────────────────────────────

  describe('executeComputation', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should execute successfully for valid params', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(true)
      expect(result.computationId).toBeDefined()
      expect(result.backend).toBe('arcium')
      expect(result.status).toBe('submitted')
    })

    it('should include circuit info in metadata', async () => {
      const params = createValidComputationParams({
        circuitId: 'my-circuit',
      })

      const result = await backend.executeComputation(params)

      expect(result.metadata?.circuitId).toBe('my-circuit')
      expect(result.metadata?.inputCount).toBe(1)
    })

    it('should use custom cluster', async () => {
      const params = createValidComputationParams({
        cluster: 'custom-cluster',
      })

      const result = await backend.executeComputation(params)

      expect(result.metadata?.cluster).toBe('custom-cluster')
    })

    it('should use custom cipher', async () => {
      const params = createValidComputationParams({
        cipher: 'aes128',
      })

      const result = await backend.executeComputation(params)

      expect(result.metadata?.cipher).toBe('aes128')
    })

    it('should fail for invalid params', async () => {
      const params = createValidComputationParams({ circuitId: '' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fail for unsupported chain', async () => {
      const params = createValidComputationParams({ chain: 'ethereum' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('only supports Solana')
    })

    it('should include network in metadata', async () => {
      const backend = new ArciumBackend({ network: 'testnet' })
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.metadata?.network).toBe('testnet')
    })

    it('should generate unique computation IDs', async () => {
      const params = createValidComputationParams()

      const result1 = await backend.executeComputation(params)
      const result2 = await backend.executeComputation(params)

      expect(result1.computationId).not.toBe(result2.computationId)
    })
  })

  // ─── estimateCost Tests ──────────────────────────────────────────────────────

  describe('estimateCost', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should return cost for computation params', async () => {
      const params = createValidComputationParams()

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(BigInt(0))
    })

    it('should include base cost', async () => {
      const params = createValidComputationParams()

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThanOrEqual(BASE_COMPUTATION_COST_LAMPORTS)
    })

    it('should increase cost with more inputs', async () => {
      const smallParams = createValidComputationParams({
        encryptedInputs: [new Uint8Array([1, 2, 3])],
      })
      const largeParams = createValidComputationParams({
        encryptedInputs: [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
          new Uint8Array([10, 11, 12]),
        ],
      })

      const smallCost = await backend.estimateCost(smallParams)
      const largeCost = await backend.estimateCost(largeParams)

      expect(largeCost).toBeGreaterThan(smallCost)
    })

    it('should increase cost with larger inputs', async () => {
      const smallParams = createValidComputationParams({
        encryptedInputs: [new Uint8Array(100)],
      })
      const largeParams = createValidComputationParams({
        encryptedInputs: [new Uint8Array(10000)],
      })

      const smallCost = await backend.estimateCost(smallParams)
      const largeCost = await backend.estimateCost(largeParams)

      expect(largeCost).toBeGreaterThan(smallCost)
    })

    it('should return 0 for transfer params', async () => {
      const params = createValidTransferParams()

      const cost = await backend.estimateCost(params)

      expect(cost).toBe(BigInt(0))
    })

    it('should cap cost at MAX_COMPUTATION_COST_LAMPORTS', async () => {
      // Create params that would generate a very high cost
      // Note: This test uses max allowed inputs to push cost high
      const largeInputs = Array.from(
        { length: MAX_ENCRYPTED_INPUTS },
        () => {
          const arr = new Uint8Array(100_000) // 100KB each
          arr[0] = 1
          return arr
        }
      )
      const params = createValidComputationParams({
        encryptedInputs: largeInputs,
      })

      const cost = await backend.estimateCost(params)

      expect(cost).toBeLessThanOrEqual(MAX_COMPUTATION_COST_LAMPORTS)
    })
  })

  // ─── Computation Tracking Tests ──────────────────────────────────────────────

  describe('computation tracking', () => {
    let backend: ArciumBackend

    beforeEach(() => {
      backend = new ArciumBackend()
    })

    it('should cache computation info after execution', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)
      const info = await backend.getComputationInfo(result.computationId!)

      expect(info).toBeDefined()
      expect(info?.circuitId).toBe(params.circuitId)
      expect(info?.status).toBe('submitted')
    })

    it('should return status for cached computation', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)
      const status = await backend.getComputationStatus(result.computationId!)

      expect(status).toBe('submitted')
    })

    it('should return undefined for unknown computation', async () => {
      const status = await backend.getComputationStatus('unknown-id')

      expect(status).toBeUndefined()
    })

    it('should await computation completion', async () => {
      const params = createValidComputationParams()
      const execResult = await backend.executeComputation(params)

      const awaitResult = await backend.awaitComputation(execResult.computationId!)

      expect(awaitResult.success).toBe(true)
      expect(awaitResult.status).toBe('completed')
      expect(awaitResult.output).toBeDefined()
    })

    it('should fail await for unknown computation', async () => {
      const result = await backend.awaitComputation('unknown-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should clear computation cache', async () => {
      const params = createValidComputationParams()
      await backend.executeComputation(params)

      expect(backend.getCachedComputationCount()).toBe(1)

      backend.clearComputationCache()

      expect(backend.getCachedComputationCount()).toBe(0)
    })
  })

  // ─── PrivacyBackend Interface Compliance ─────────────────────────────────────

  describe('PrivacyBackend interface compliance', () => {
    it('should implement all required properties', () => {
      const backend = new ArciumBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new ArciumBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })

    it('should implement executeComputation method', () => {
      const backend = new ArciumBackend()

      expect(typeof backend.executeComputation).toBe('function')
    })

    it('should have type = compute', () => {
      const backend = new ArciumBackend()

      expect(backend.type).toBe('compute')
    })
  })
})

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Arcium Integration', () => {
  describe('registry integration', () => {
    it('should be registerable in PrivacyBackendRegistry', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new ArciumBackend()

      registry.register(backend)

      expect(registry.get('arcium')).toBe(backend)
    })

    it('should be findable by chain', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new ArciumBackend()

      registry.register(backend)

      const solanaBackends = registry.getByChain('solana')
      expect(solanaBackends).toContain(backend)
    })

    it('should be findable by type', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new ArciumBackend()

      registry.register(backend)

      const computeBackends = registry.getByType('compute')
      expect(computeBackends).toContain(backend)
    })

    it('should not appear in compliant backends', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new ArciumBackend()

      registry.register(backend)

      const compliantBackends = registry.getCompliant()
      expect(compliantBackends).not.toContain(backend)
    })
  })

  describe('comparison with transaction backends', () => {
    it('should have different capabilities than SIPNative', async () => {
      const { SIPNativeBackend } = await import('../../src/privacy-backends/sip-native')

      const arcium = new ArciumBackend()
      const sipNative = new SIPNativeBackend()

      const arciumCaps = arcium.getCapabilities()
      const sipNativeCaps = sipNative.getCapabilities()

      // Arcium provides compute privacy
      expect(arciumCaps.hiddenCompute).toBe(true)
      expect(sipNativeCaps.hiddenCompute).toBe(false)

      // SIPNative provides transaction privacy
      expect(arciumCaps.hiddenAmount).toBe(false)
      expect(sipNativeCaps.hiddenAmount).toBe(true)

      // Different latencies
      expect(arciumCaps.latencyEstimate).toBe('slow')
      expect(sipNativeCaps.latencyEstimate).toBe('fast')
    })

    it('should have different capabilities than PrivacyCash', async () => {
      const { PrivacyCashBackend } = await import('../../src/privacy-backends/privacycash')

      const arcium = new ArciumBackend()
      const privacyCash = new PrivacyCashBackend()

      const arciumCaps = arcium.getCapabilities()
      const pcCaps = privacyCash.getCapabilities()

      // Type comparison
      expect(arcium.type).toBe('compute')
      expect(privacyCash.type).toBe('transaction')

      // Compute vs transaction privacy
      expect(arciumCaps.hiddenCompute).toBe(true)
      expect(pcCaps.hiddenCompute).toBe(false)

      expect(arciumCaps.hiddenSender).toBe(false)
      expect(pcCaps.hiddenSender).toBe(true)
    })
  })

  describe('SmartRouter integration', () => {
    it('should be selectable via SmartRouter for compute operations', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const { SmartRouter } = await import('../../src/privacy-backends/router')

      const registry = new PrivacyBackendRegistry()
      const arcium = new ArciumBackend()
      registry.register(arcium)

      const router = new SmartRouter(registry)
      const params = createValidComputationParams()

      const selection = await router.selectComputeBackend(params)

      expect(selection.backend.name).toBe('arcium')
    })

    it('should execute computation via SmartRouter', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const { SmartRouter } = await import('../../src/privacy-backends/router')

      const registry = new PrivacyBackendRegistry()
      const arcium = new ArciumBackend()
      registry.register(arcium)

      const router = new SmartRouter(registry)
      const params = createValidComputationParams()

      const result = await router.executeComputation(params)

      expect(result.success).toBe(true)
      expect(result.backend).toBe('arcium')
    })
  })
})

// ─── Constants Tests ─────────────────────────────────────────────────────────

describe('Arcium Constants', () => {
  describe('ARCIUM_CLUSTERS', () => {
    it('should have cluster for each network', () => {
      expect(ARCIUM_CLUSTERS.devnet).toBeDefined()
      expect(ARCIUM_CLUSTERS.testnet).toBeDefined()
      expect(ARCIUM_CLUSTERS['mainnet-beta']).toBeDefined()
    })
  })

  describe('cost constants', () => {
    it('should have reasonable base cost', () => {
      // ~0.05 SOL
      expect(BASE_COMPUTATION_COST_LAMPORTS).toBe(BigInt(50_000_000))
    })

    it('should have reasonable estimated time', () => {
      // 60 seconds
      expect(ESTIMATED_COMPUTATION_TIME_MS).toBe(60_000)
    })
  })

  describe('upper bound constants', () => {
    it('should have MAX_ENCRYPTED_INPUTS = 100', () => {
      expect(MAX_ENCRYPTED_INPUTS).toBe(100)
    })

    it('should have MAX_INPUT_SIZE_BYTES = 1 MB', () => {
      expect(MAX_INPUT_SIZE_BYTES).toBe(1_048_576)
    })

    it('should have MAX_TOTAL_INPUT_SIZE_BYTES = 10 MB', () => {
      expect(MAX_TOTAL_INPUT_SIZE_BYTES).toBe(10_485_760)
    })

    it('should have MAX_COMPUTATION_COST_LAMPORTS = ~1 SOL', () => {
      expect(MAX_COMPUTATION_COST_LAMPORTS).toBe(BigInt(1_000_000_000))
    })

    it('should ensure max cost is greater than base cost', () => {
      expect(MAX_COMPUTATION_COST_LAMPORTS).toBeGreaterThan(BASE_COMPUTATION_COST_LAMPORTS)
    })
  })
})
