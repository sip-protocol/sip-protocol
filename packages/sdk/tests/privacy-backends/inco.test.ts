/**
 * Inco Backend Tests
 *
 * Comprehensive test suite for the Inco FHE compute privacy backend.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { IncoBackend } from '../../src/privacy-backends/inco'
import {
  INCO_RPC_URLS,
  INCO_SUPPORTED_CHAINS,
  BASE_FHE_COST_WEI,
  ESTIMATED_FHE_TIME_MS,
} from '../../src/privacy-backends/inco-types'
import type {
  ComputationParams,
  TransferParams,
} from '../../src/privacy-backends/interface'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createValidComputationParams(
  overrides: Partial<ComputationParams> = {}
): ComputationParams {
  return {
    chain: 'ethereum',
    circuitId: '0x1234567890abcdef1234567890abcdef12345678',
    encryptedInputs: [new Uint8Array([1, 2, 3, 4])],
    ...overrides,
  }
}

function createValidTransferParams(
  overrides: Partial<TransferParams> = {}
): TransferParams {
  return {
    chain: 'ethereum',
    sender: '0xsender',
    recipient: '0xrecipient',
    mint: null,
    amount: BigInt('1000000000000000000'),
    decimals: 18,
    ...overrides,
  }
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('IncoBackend', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const backend = new IncoBackend()

      expect(backend.name).toBe('inco')
      expect(backend.type).toBe('compute')
      expect(backend.chains).toContain('ethereum')
    })

    it('should accept custom rpcUrl', () => {
      const backend = new IncoBackend({
        rpcUrl: 'https://custom.rpc.url',
      })

      expect(backend.name).toBe('inco')
      expect(backend.getConfig().rpcUrl).toBe('https://custom.rpc.url')
    })

    it('should accept custom network', () => {
      const backend = new IncoBackend({
        network: 'mainnet',
      })

      expect(backend.getConfig().network).toBe('mainnet')
    })

    it('should accept custom chainId', () => {
      const backend = new IncoBackend({
        chainId: 1,
      })

      expect(backend.getConfig().chainId).toBe(1)
    })

    it('should accept custom product', () => {
      const backend = new IncoBackend({
        product: 'atlas',
      })

      expect(backend.getConfig().product).toBe('atlas')
    })

    it('should accept custom timeout', () => {
      const backend = new IncoBackend({
        timeout: 600000,
      })

      expect(backend.getConfig().timeout).toBe(600000)
    })

    // ─── Network Validation Tests ─────────────────────────────────────────────

    it('should throw on invalid network', () => {
      expect(() => {
        new IncoBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'invalid-network',
        })
      }).toThrow("Invalid Inco network 'invalid-network'")
    })

    it('should include valid networks in error message', () => {
      expect(() => {
        new IncoBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'devnet',
        })
      }).toThrow('Valid networks: testnet, mainnet')
    })

    it('should accept all valid networks', () => {
      const validNetworks = ['testnet', 'mainnet'] as const
      for (const network of validNetworks) {
        const backend = new IncoBackend({ network })
        expect(backend.name).toBe('inco')
      }
    })

    it('should use default RPC URL for testnet', () => {
      const backend = new IncoBackend({ network: 'testnet' })

      expect(backend.getConfig().rpcUrl).toBe(INCO_RPC_URLS.testnet)
    })

    it('should use default RPC URL for mainnet', () => {
      const backend = new IncoBackend({ network: 'mainnet' })

      expect(backend.getConfig().rpcUrl).toBe(INCO_RPC_URLS.mainnet)
    })
  })

  // ─── Capabilities Tests ──────────────────────────────────────────────────────

  describe('getCapabilities', () => {
    it('should return correct capabilities for FHE compute backend', () => {
      const backend = new IncoBackend()
      const caps = backend.getCapabilities()

      // FHE backend capabilities
      expect(caps.hiddenCompute).toBe(true) // PRIMARY PURPOSE
      expect(caps.setupRequired).toBe(true) // Contract must use Inco SDK
      expect(caps.latencyEstimate).toBe('medium') // Faster than MPC
    })

    it('should hide amounts in encrypted state', () => {
      const backend = new IncoBackend()
      const caps = backend.getCapabilities()

      // Key difference from Arcium: FHE can encrypt state including amounts
      expect(caps.hiddenAmount).toBe(true)
    })

    it('should NOT hide transaction details', () => {
      const backend = new IncoBackend()
      const caps = backend.getCapabilities()

      // FHE doesn't hide tx sender/recipient
      expect(caps.hiddenSender).toBe(false)
      expect(caps.hiddenRecipient).toBe(false)
    })

    it('should NOT support compliance features', () => {
      const backend = new IncoBackend()
      const caps = backend.getCapabilities()

      expect(caps.complianceSupport).toBe(false)
      expect(caps.anonymitySet).toBeUndefined()
    })

    it('should support all tokens', () => {
      const backend = new IncoBackend()
      const caps = backend.getCapabilities()

      expect(caps.supportedTokens).toBe('all')
    })
  })

  // ─── Chain Support Tests ───────────────────────────────────────────────────────

  describe('chain support', () => {
    it('should support all EVM chains', () => {
      const backend = new IncoBackend()

      for (const chain of INCO_SUPPORTED_CHAINS) {
        expect(backend.chains).toContain(chain)
      }
    })

    it('should support Solana (beta)', () => {
      const backend = new IncoBackend()

      expect(backend.chains).toContain('solana')
    })

    it('should support ethereum', () => {
      const backend = new IncoBackend()

      expect(backend.chains).toContain('ethereum')
    })

    it('should support base', () => {
      const backend = new IncoBackend()

      expect(backend.chains).toContain('base')
    })

    it('should support arbitrum', () => {
      const backend = new IncoBackend()

      expect(backend.chains).toContain('arbitrum')
    })
  })

  // ─── checkAvailability Tests ─────────────────────────────────────────────────

  describe('checkAvailability', () => {
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
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

        expect(result.estimatedTime).toBe(ESTIMATED_FHE_TIME_MS)
      })

      it('should be available for ethereum chain', async () => {
        const params = createValidComputationParams({ chain: 'ethereum' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should be available for base chain', async () => {
        const params = createValidComputationParams({ chain: 'base' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should be available for arbitrum chain', async () => {
        const params = createValidComputationParams({ chain: 'arbitrum' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should be available for solana chain (beta)', async () => {
        const params = createValidComputationParams({ chain: 'solana' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(true)
      })

      it('should not be available for unsupported chain', async () => {
        const params = createValidComputationParams({ chain: 'bitcoin' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('supports')
      })

      it('should not be available without circuitId', async () => {
        const params = createValidComputationParams({ circuitId: '' })

        const result = await backend.checkAvailability(params)

        expect(result.available).toBe(false)
        expect(result.reason).toContain('circuitId')
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
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should fail with helpful error message', async () => {
      const params = createValidTransferParams()

      const result = await backend.execute(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('compute privacy backend')
      expect(result.error).toContain('executeComputation')
      expect(result.backend).toBe('inco')
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
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should execute successfully for valid params', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(true)
      expect(result.computationId).toBeDefined()
      expect(result.backend).toBe('inco')
      expect(result.status).toBe('submitted')
    })

    it('should include contract info in metadata', async () => {
      const contractAddress = '0xcontract123'
      const params = createValidComputationParams({
        circuitId: contractAddress,
      })

      const result = await backend.executeComputation(params)

      expect(result.metadata?.contractAddress).toBe(contractAddress)
      expect(result.metadata?.inputCount).toBe(1)
    })

    it('should use custom function name from options', async () => {
      const params = createValidComputationParams({
        options: { functionName: 'vote' },
      })

      const result = await backend.executeComputation(params)

      expect(result.metadata?.functionName).toBe('vote')
    })

    it('should default to compute function name', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.metadata?.functionName).toBe('compute')
    })

    it('should fail for invalid params', async () => {
      const params = createValidComputationParams({ circuitId: '' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fail for unsupported chain', async () => {
      const params = createValidComputationParams({ chain: 'bitcoin' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('supports')
    })

    it('should include network in metadata', async () => {
      const backend = new IncoBackend({ network: 'mainnet' })
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.metadata?.network).toBe('mainnet')
    })

    it('should include product in metadata', async () => {
      const backend = new IncoBackend({ product: 'atlas' })
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)

      expect(result.metadata?.product).toBe('atlas')
    })

    it('should generate unique computation IDs', async () => {
      const params = createValidComputationParams()

      const result1 = await backend.executeComputation(params)
      const result2 = await backend.executeComputation(params)

      expect(result1.computationId).not.toBe(result2.computationId)
    })
  })

  // ─── encryptValue Tests ──────────────────────────────────────────────────────

  describe('encryptValue', () => {
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should encrypt bigint as euint256', async () => {
      const value = BigInt(12345)

      const result = await backend.encryptValue(value, 'euint256')

      expect(result.handle).toBeDefined()
      expect(result.type).toBe('euint256')
      expect(result.ciphertext).toBeInstanceOf(Uint8Array)
    })

    it('should encrypt boolean as ebool', async () => {
      const value = true

      const result = await backend.encryptValue(value, 'ebool')

      expect(result.handle).toBeDefined()
      expect(result.type).toBe('ebool')
    })

    it('should encrypt string as eaddress', async () => {
      const value = '0x1234567890abcdef1234567890abcdef12345678'

      const result = await backend.encryptValue(value, 'eaddress')

      expect(result.handle).toBeDefined()
      expect(result.type).toBe('eaddress')
    })

    it('should throw for type mismatch - euint256 needs bigint', async () => {
      await expect(
        backend.encryptValue(true, 'euint256')
      ).rejects.toThrow('euint256 requires a bigint value')
    })

    it('should throw for type mismatch - ebool needs boolean', async () => {
      await expect(
        backend.encryptValue(BigInt(1), 'ebool')
      ).rejects.toThrow('ebool requires a boolean value')
    })

    it('should throw for type mismatch - eaddress needs string', async () => {
      await expect(
        backend.encryptValue(true, 'eaddress')
      ).rejects.toThrow('eaddress requires a string value')
    })

    it('should include chainId in result', async () => {
      const backend = new IncoBackend({ chainId: 1 })

      const result = await backend.encryptValue(BigInt(100), 'euint256')

      expect(result.chainId).toBe(1)
    })
  })

  // ─── decryptValue Tests ──────────────────────────────────────────────────────

  describe('decryptValue', () => {
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should return bigint for euint256', async () => {
      const result = await backend.decryptValue('handle123', 'euint256')

      expect(typeof result).toBe('bigint')
    })

    it('should return boolean for ebool', async () => {
      const result = await backend.decryptValue('handle123', 'ebool')

      expect(typeof result).toBe('boolean')
    })

    it('should return string for eaddress', async () => {
      const result = await backend.decryptValue('handle123', 'eaddress')

      expect(typeof result).toBe('string')
    })
  })

  // ─── estimateCost Tests ──────────────────────────────────────────────────────

  describe('estimateCost', () => {
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should return cost for computation params', async () => {
      const params = createValidComputationParams()

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThan(BigInt(0))
    })

    it('should include base cost', async () => {
      const params = createValidComputationParams()

      const cost = await backend.estimateCost(params)

      expect(cost).toBeGreaterThanOrEqual(BASE_FHE_COST_WEI)
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
  })

  // ─── Computation Tracking Tests ──────────────────────────────────────────────

  describe('computation tracking', () => {
    let backend: IncoBackend

    beforeEach(() => {
      backend = new IncoBackend()
    })

    it('should cache computation info after execution', async () => {
      const params = createValidComputationParams()

      const result = await backend.executeComputation(params)
      const info = await backend.getComputationInfo(result.computationId!)

      expect(info).toBeDefined()
      expect(info?.contractAddress).toBe(params.circuitId)
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

    it('should include output handle after completion', async () => {
      const params = createValidComputationParams()
      const execResult = await backend.executeComputation(params)

      const awaitResult = await backend.awaitComputation(execResult.computationId!)

      expect(awaitResult.metadata?.outputHandle).toBeDefined()
    })

    it('should fail await for unknown computation', async () => {
      const result = await backend.awaitComputation('unknown-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should use default timeout from config', async () => {
      const customBackend = new IncoBackend({ timeout: 10000 })
      const params = createValidComputationParams()
      const execResult = await customBackend.executeComputation(params)

      // Should complete without timeout since simulation is instant
      const awaitResult = await customBackend.awaitComputation(execResult.computationId!)

      expect(awaitResult.success).toBe(true)
    })

    it('should use custom timeout when provided', async () => {
      const params = createValidComputationParams()
      const execResult = await backend.executeComputation(params)

      // Should complete without timeout since simulation is instant
      const awaitResult = await backend.awaitComputation(execResult.computationId!, 5000)

      expect(awaitResult.success).toBe(true)
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
      const backend = new IncoBackend()

      expect(typeof backend.name).toBe('string')
      expect(backend.name.length).toBeGreaterThan(0)
      expect(['transaction', 'compute', 'both']).toContain(backend.type)
      expect(Array.isArray(backend.chains)).toBe(true)
    })

    it('should implement all required methods', () => {
      const backend = new IncoBackend()

      expect(typeof backend.checkAvailability).toBe('function')
      expect(typeof backend.getCapabilities).toBe('function')
      expect(typeof backend.execute).toBe('function')
      expect(typeof backend.estimateCost).toBe('function')
    })

    it('should implement executeComputation method', () => {
      const backend = new IncoBackend()

      expect(typeof backend.executeComputation).toBe('function')
    })

    it('should have type = compute', () => {
      const backend = new IncoBackend()

      expect(backend.type).toBe('compute')
    })
  })
})

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Inco Integration', () => {
  describe('registry integration', () => {
    it('should be registerable in PrivacyBackendRegistry', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new IncoBackend()

      registry.register(backend)

      expect(registry.get('inco')).toBe(backend)
    })

    it('should be findable by chain', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new IncoBackend()

      registry.register(backend)

      const ethBackends = registry.getByChain('ethereum')
      expect(ethBackends).toContain(backend)
    })

    it('should be findable by type', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new IncoBackend()

      registry.register(backend)

      const computeBackends = registry.getByType('compute')
      expect(computeBackends).toContain(backend)
    })

    it('should not appear in compliant backends', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const registry = new PrivacyBackendRegistry()
      const backend = new IncoBackend()

      registry.register(backend)

      const compliantBackends = registry.getCompliant()
      expect(compliantBackends).not.toContain(backend)
    })
  })

  describe('comparison with other backends', () => {
    it('should have different capabilities than Arcium', async () => {
      const { ArciumBackend } = await import('../../src/privacy-backends/arcium')

      const inco = new IncoBackend()
      const arcium = new ArciumBackend()

      const incoCaps = inco.getCapabilities()
      const arciumCaps = arcium.getCapabilities()

      // Both provide compute privacy
      expect(incoCaps.hiddenCompute).toBe(true)
      expect(arciumCaps.hiddenCompute).toBe(true)

      // Key difference: Inco hides amounts (encrypted state)
      expect(incoCaps.hiddenAmount).toBe(true)
      expect(arciumCaps.hiddenAmount).toBe(false)

      // Different latencies (FHE faster than MPC)
      expect(incoCaps.latencyEstimate).toBe('medium')
      expect(arciumCaps.latencyEstimate).toBe('slow')
    })

    it('should have different capabilities than SIPNative', async () => {
      const { SIPNativeBackend } = await import('../../src/privacy-backends/sip-native')

      const inco = new IncoBackend()
      const sipNative = new SIPNativeBackend()

      const incoCaps = inco.getCapabilities()
      const sipNativeCaps = sipNative.getCapabilities()

      // Type comparison
      expect(inco.type).toBe('compute')
      expect(sipNative.type).toBe('transaction')

      // Compute vs transaction privacy
      expect(incoCaps.hiddenCompute).toBe(true)
      expect(sipNativeCaps.hiddenCompute).toBe(false)

      expect(incoCaps.hiddenSender).toBe(false)
      expect(sipNativeCaps.hiddenSender).toBe(true)
    })

    it('should support more chains than Arcium', async () => {
      const { ArciumBackend } = await import('../../src/privacy-backends/arcium')

      const inco = new IncoBackend()
      const arcium = new ArciumBackend()

      // Inco supports EVM chains + Solana
      expect(inco.chains.length).toBeGreaterThan(arcium.chains.length)
      expect(inco.chains).toContain('ethereum')
      expect(inco.chains).toContain('base')

      // Arcium only supports Solana
      expect(arcium.chains).toContain('solana')
      expect(arcium.chains).not.toContain('ethereum')
    })
  })

  describe('SmartRouter integration', () => {
    it('should be selectable via SmartRouter for compute operations', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const { SmartRouter } = await import('../../src/privacy-backends/router')

      const registry = new PrivacyBackendRegistry()
      const inco = new IncoBackend()
      registry.register(inco)

      const router = new SmartRouter(registry)
      const params = createValidComputationParams()

      const selection = await router.selectComputeBackend(params)

      expect(selection.backend.name).toBe('inco')
    })

    it('should execute computation via SmartRouter', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const { SmartRouter } = await import('../../src/privacy-backends/router')

      const registry = new PrivacyBackendRegistry()
      const inco = new IncoBackend()
      registry.register(inco)

      const router = new SmartRouter(registry)
      const params = createValidComputationParams()

      const result = await router.executeComputation(params)

      expect(result.success).toBe(true)
      expect(result.backend).toBe('inco')
    })

    it('should prefer Inco for ethereum compute operations', async () => {
      const { PrivacyBackendRegistry } = await import('../../src/privacy-backends/registry')
      const { SmartRouter } = await import('../../src/privacy-backends/router')
      const { ArciumBackend } = await import('../../src/privacy-backends/arcium')

      const registry = new PrivacyBackendRegistry()
      registry.register(new IncoBackend())
      registry.register(new ArciumBackend())

      const router = new SmartRouter(registry)
      const params = createValidComputationParams({ chain: 'ethereum' })

      const selection = await router.selectComputeBackend(params)

      // Inco should be selected for Ethereum (Arcium doesn't support it)
      expect(selection.backend.name).toBe('inco')
    })
  })
})

// ─── Constants Tests ─────────────────────────────────────────────────────────

describe('Inco Constants', () => {
  describe('INCO_RPC_URLS', () => {
    it('should have URL for each network', () => {
      expect(INCO_RPC_URLS.testnet).toBeDefined()
      expect(INCO_RPC_URLS.mainnet).toBeDefined()
    })
  })

  describe('INCO_SUPPORTED_CHAINS', () => {
    it('should include major EVM chains', () => {
      expect(INCO_SUPPORTED_CHAINS).toContain('ethereum')
      expect(INCO_SUPPORTED_CHAINS).toContain('base')
      expect(INCO_SUPPORTED_CHAINS).toContain('arbitrum')
    })
  })

  describe('cost constants', () => {
    it('should have reasonable base cost', () => {
      // 0.01 ETH
      expect(BASE_FHE_COST_WEI).toBe(BigInt('10000000000000000'))
    })

    it('should have reasonable estimated time', () => {
      // 30 seconds
      expect(ESTIMATED_FHE_TIME_MS).toBe(30_000)
    })
  })
})
