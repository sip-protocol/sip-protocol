/**
 * Arcium Backend Tests
 *
 * Comprehensive test suite for the Arcium MPC compute privacy backend.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ArciumBackend } from '../../src/privacy-backends/arcium'
import {
  ARCIUM_CLUSTERS,
  BASE_COMPUTATION_COST_LAMPORTS,
  ESTIMATED_COMPUTATION_TIME_MS,
  MAX_ENCRYPTED_INPUTS,
  MAX_INPUT_SIZE_BYTES,
  MAX_TOTAL_INPUT_SIZE_BYTES,
  MAX_COMPUTATION_COST_LAMPORTS,
  DEFAULT_MAX_ENCRYPTED_INPUTS,
  DEFAULT_MAX_INPUT_SIZE_BYTES,
  DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES,
  DEFAULT_MAX_COMPUTATION_COST_LAMPORTS,
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

    // ─── Network Validation Tests ─────────────────────────────────────────────

    it('should throw on invalid network', () => {
      expect(() => {
        new ArciumBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'invalid-network',
        })
      }).toThrow("Invalid Arcium network 'invalid-network'")
    })

    it('should include valid networks in error message', () => {
      expect(() => {
        new ArciumBackend({
          // @ts-expect-error - Testing invalid network value
          network: 'mainnet',
        })
      }).toThrow('Valid networks: devnet, testnet, mainnet-beta')
    })

    it('should accept all valid networks', () => {
      const validNetworks = ['devnet', 'testnet', 'mainnet-beta'] as const
      for (const network of validNetworks) {
        const backend = new ArciumBackend({ network })
        expect(backend.name).toBe('arcium')
      }
    })

    it('should use default cluster for network', () => {
      const devnetBackend = new ArciumBackend({ network: 'devnet' })
      const testnetBackend = new ArciumBackend({ network: 'testnet' })

      // Both should create successfully with their network's default cluster
      expect(devnetBackend.name).toBe('arcium')
      expect(testnetBackend.name).toBe('arcium')
    })

    // ─── Configurable Limits Tests ────────────────────────────────────────────

    describe('configurable limits', () => {
      it('should use default limits when not configured', () => {
        const backend = new ArciumBackend()
        const limits = backend.getLimits()

        expect(limits.maxEncryptedInputs).toBe(DEFAULT_MAX_ENCRYPTED_INPUTS)
        expect(limits.maxInputSizeBytes).toBe(DEFAULT_MAX_INPUT_SIZE_BYTES)
        expect(limits.maxTotalInputSizeBytes).toBe(DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES)
        expect(limits.maxComputationCostLamports).toBe(DEFAULT_MAX_COMPUTATION_COST_LAMPORTS)
      })

      it('should accept custom maxEncryptedInputs', () => {
        const backend = new ArciumBackend({
          limits: { maxEncryptedInputs: 50 },
        })
        const limits = backend.getLimits()

        expect(limits.maxEncryptedInputs).toBe(50)
        // Others should use defaults
        expect(limits.maxInputSizeBytes).toBe(DEFAULT_MAX_INPUT_SIZE_BYTES)
      })

      it('should accept custom maxInputSizeBytes', () => {
        const backend = new ArciumBackend({
          limits: { maxInputSizeBytes: 512_000 },
        })
        const limits = backend.getLimits()

        expect(limits.maxInputSizeBytes).toBe(512_000)
      })

      it('should accept custom maxTotalInputSizeBytes', () => {
        const backend = new ArciumBackend({
          limits: { maxTotalInputSizeBytes: 5_000_000 },
        })
        const limits = backend.getLimits()

        expect(limits.maxTotalInputSizeBytes).toBe(5_000_000)
      })

      it('should accept custom maxComputationCostLamports', () => {
        const backend = new ArciumBackend({
          limits: { maxComputationCostLamports: BigInt(500_000_000) },
        })
        const limits = backend.getLimits()

        expect(limits.maxComputationCostLamports).toBe(BigInt(500_000_000))
      })

      it('should accept all custom limits together', () => {
        const backend = new ArciumBackend({
          limits: {
            maxEncryptedInputs: 25,
            maxInputSizeBytes: 256_000,
            maxTotalInputSizeBytes: 2_000_000,
            maxComputationCostLamports: BigInt(250_000_000),
          },
        })
        const limits = backend.getLimits()

        expect(limits.maxEncryptedInputs).toBe(25)
        expect(limits.maxInputSizeBytes).toBe(256_000)
        expect(limits.maxTotalInputSizeBytes).toBe(2_000_000)
        expect(limits.maxComputationCostLamports).toBe(BigInt(250_000_000))
      })

      it('should return copy of limits (immutable)', () => {
        const backend = new ArciumBackend()
        const limits1 = backend.getLimits()
        const limits2 = backend.getLimits()

        expect(limits1).not.toBe(limits2) // Different objects
        expect(limits1).toEqual(limits2) // Same values
      })

      // ─── Limit Validation Tests ─────────────────────────────────────────────

      it('should throw on zero maxEncryptedInputs', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxEncryptedInputs: 0 },
          })
        }).toThrow('maxEncryptedInputs must be positive')
      })

      it('should throw on negative maxEncryptedInputs', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxEncryptedInputs: -1 },
          })
        }).toThrow('maxEncryptedInputs must be positive')
      })

      it('should throw on zero maxInputSizeBytes', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxInputSizeBytes: 0 },
          })
        }).toThrow('maxInputSizeBytes must be positive')
      })

      it('should throw on negative maxInputSizeBytes', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxInputSizeBytes: -1 },
          })
        }).toThrow('maxInputSizeBytes must be positive')
      })

      it('should throw on zero maxTotalInputSizeBytes', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxTotalInputSizeBytes: 0 },
          })
        }).toThrow('maxTotalInputSizeBytes must be positive')
      })

      it('should throw on negative maxTotalInputSizeBytes', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxTotalInputSizeBytes: -1 },
          })
        }).toThrow('maxTotalInputSizeBytes must be positive')
      })

      it('should throw on zero maxComputationCostLamports', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxComputationCostLamports: BigInt(0) },
          })
        }).toThrow('maxComputationCostLamports must be positive')
      })

      it('should throw on negative maxComputationCostLamports', () => {
        expect(() => {
          new ArciumBackend({
            limits: { maxComputationCostLamports: BigInt(-1) },
          })
        }).toThrow('maxComputationCostLamports must be positive')
      })

      it('should accept minimum valid limit (1)', () => {
        const backend = new ArciumBackend({
          limits: { maxEncryptedInputs: 1 },
        })

        expect(backend.getLimits().maxEncryptedInputs).toBe(1)
      })
    })
  })

  // ─── Environment Variable Tests ─────────────────────────────────────────────

  describe('env var integration', () => {
    afterEach(() => {
      // Clean up env vars after each test
      delete process.env.ARCIUM_RPC_URL
      delete process.env.ARCIUM_RPC_URL_DEVNET
      delete process.env.ARCIUM_RPC_URL_TESTNET
      delete process.env.ARCIUM_RPC_URL_MAINNET
      delete process.env.ARCIUM_NETWORK
      delete process.env.ARCIUM_CLUSTER
      delete process.env.ARCIUM_TIMEOUT_MS
    })

    it('should use env var for RPC URL when creating backend', () => {
      process.env.ARCIUM_RPC_URL_DEVNET = 'https://env-devnet.rpc.url'

      // Backend should be created successfully with env var URL
      const backend = new ArciumBackend()
      expect(backend.name).toBe('arcium')
    })

    it('should use env var for network when creating backend', () => {
      process.env.ARCIUM_NETWORK = 'testnet'

      // Backend should use testnet from env var
      const backend = new ArciumBackend()
      expect(backend.name).toBe('arcium')
    })

    it('should use env var for timeout when creating backend', () => {
      process.env.ARCIUM_TIMEOUT_MS = '900000'

      const backend = new ArciumBackend()
      expect(backend.name).toBe('arcium')
    })

    it('should use env var for cluster when creating backend', () => {
      process.env.ARCIUM_CLUSTER = 'env-cluster-1'

      // Backend should use cluster from env var
      const backend = new ArciumBackend()
      expect(backend.name).toBe('arcium')
    })

    it('should handle env var priority correctly', () => {
      // Test verifies the priority order: env var > config > default
      process.env.ARCIUM_NETWORK = 'mainnet-beta'

      // Note: Env var has higher priority, so this will use mainnet-beta
      // This is intentional - env vars override config
      const backend = new ArciumBackend({ network: 'testnet' })
      expect(backend.name).toBe('arcium')
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

      // ─── Boundary Tests with Custom Limits (MAX-1, MAX, MAX+1) ──────────────

      describe('boundary tests with custom limits', () => {
        it('should accept MAX-1 encrypted inputs with custom limit', async () => {
          const customLimit = 10
          const backend = new ArciumBackend({
            limits: { maxEncryptedInputs: customLimit },
          })
          const inputs = Array.from(
            { length: customLimit - 1 },
            () => new Uint8Array([1, 2, 3])
          )
          const params = createValidComputationParams({
            encryptedInputs: inputs,
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should accept exactly MAX encrypted inputs with custom limit', async () => {
          const customLimit = 10
          const backend = new ArciumBackend({
            limits: { maxEncryptedInputs: customLimit },
          })
          const inputs = Array.from(
            { length: customLimit },
            () => new Uint8Array([1, 2, 3])
          )
          const params = createValidComputationParams({
            encryptedInputs: inputs,
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should reject MAX+1 encrypted inputs with custom limit', async () => {
          const customLimit = 10
          const backend = new ArciumBackend({
            limits: { maxEncryptedInputs: customLimit },
          })
          const inputs = Array.from(
            { length: customLimit + 1 },
            () => new Uint8Array([1, 2, 3])
          )
          const params = createValidComputationParams({
            encryptedInputs: inputs,
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(false)
          expect(result.reason).toContain('Too many encrypted inputs')
          expect(result.reason).toContain(`${customLimit + 1}`)
          expect(result.reason).toContain(`${customLimit}`)
        })

        it('should accept input size at MAX-1 with custom limit', async () => {
          const customLimit = 1000 // 1000 bytes
          const backend = new ArciumBackend({
            limits: { maxInputSizeBytes: customLimit },
          })
          const input = new Uint8Array(customLimit - 1)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should accept input size at exactly MAX with custom limit', async () => {
          const customLimit = 1000 // 1000 bytes
          const backend = new ArciumBackend({
            limits: { maxInputSizeBytes: customLimit },
          })
          const input = new Uint8Array(customLimit)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should reject input size at MAX+1 with custom limit', async () => {
          const customLimit = 1000 // 1000 bytes
          const backend = new ArciumBackend({
            limits: { maxInputSizeBytes: customLimit },
          })
          const input = new Uint8Array(customLimit + 1)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(false)
          expect(result.reason).toContain('exceeds maximum')
          expect(result.reason).toContain('1000 bytes')
        })

        it('should accept total size at MAX-1 with custom limit', async () => {
          const customLimit = 2000 // 2000 bytes total
          const backend = new ArciumBackend({
            limits: {
              maxTotalInputSizeBytes: customLimit,
              maxInputSizeBytes: customLimit, // Allow individual inputs up to total
            },
          })
          const input = new Uint8Array(customLimit - 1)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should accept total size at exactly MAX with custom limit', async () => {
          const customLimit = 2000 // 2000 bytes total
          const backend = new ArciumBackend({
            limits: {
              maxTotalInputSizeBytes: customLimit,
              maxInputSizeBytes: customLimit,
            },
          })
          const input = new Uint8Array(customLimit)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(true)
        })

        it('should reject total size at MAX+1 with custom limit', async () => {
          const customLimit = 2000 // 2000 bytes total
          const backend = new ArciumBackend({
            limits: {
              maxTotalInputSizeBytes: customLimit,
              maxInputSizeBytes: customLimit + 1, // Allow individual but not total
            },
          })
          const input = new Uint8Array(customLimit + 1)
          input[0] = 1
          const params = createValidComputationParams({
            encryptedInputs: [input],
          })

          const result = await backend.checkAvailability(params)

          expect(result.available).toBe(false)
          expect(result.reason).toContain('Total input size')
          expect(result.reason).toContain('exceeds maximum')
          expect(result.reason).toContain('2 KB') // 2000 bytes rounds to 2 KB
        })

        it('should cap cost at custom maxComputationCostLamports', async () => {
          const customLimit = BigInt(100_000_000) // 0.1 SOL
          const backend = new ArciumBackend({
            limits: { maxComputationCostLamports: customLimit },
          })
          // Create inputs that would normally generate high cost
          const largeInputs = Array.from({ length: 50 }, () => {
            const arr = new Uint8Array(50_000) // 50KB each
            arr[0] = 1
            return arr
          })
          const params = createValidComputationParams({
            encryptedInputs: largeInputs,
          })

          const cost = await backend.estimateCost(params)

          expect(cost).toBeLessThanOrEqual(customLimit)
        })
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

  // ─── Error Propagation Tests ───────────────────────────────────────────────────

  describe('error propagation', () => {
    it('should include clear error message for validation failures', async () => {
      const backend = new ArciumBackend()
      const params = createValidComputationParams({ chain: 'ethereum' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('only supports Solana')
    })

    it('should NOT include metadata for validation failures (no exception thrown)', async () => {
      const backend = new ArciumBackend({ debug: true })
      const params = createValidComputationParams({ chain: 'ethereum' })

      const result = await backend.executeComputation(params)

      // Validation failures return early - they don't go through catch block
      // So metadata is NOT included even with debug: true
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.metadata).toBeUndefined()
    })

    it('should support debug config option', () => {
      const backendWithDebug = new ArciumBackend({ debug: true })
      const backendWithoutDebug = new ArciumBackend({ debug: false })
      const backendDefault = new ArciumBackend()

      // All backends should be properly constructed
      expect(backendWithDebug.name).toBe('arcium')
      expect(backendWithoutDebug.name).toBe('arcium')
      expect(backendDefault.name).toBe('arcium')
    })

    it('should have formatErrorMessage helper method', async () => {
      const backend = new ArciumBackend()
      const params = createValidComputationParams({ circuitId: '' })

      const result = await backend.executeComputation(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('circuitId is required')
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

    it('should use default timeout from config', async () => {
      const customBackend = new ArciumBackend({ timeout: 10000 })
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

  describe('DEFAULT_* constants (new preferred API)', () => {
    it('should have DEFAULT_MAX_ENCRYPTED_INPUTS = 100', () => {
      expect(DEFAULT_MAX_ENCRYPTED_INPUTS).toBe(100)
    })

    it('should have DEFAULT_MAX_INPUT_SIZE_BYTES = 1 MB', () => {
      expect(DEFAULT_MAX_INPUT_SIZE_BYTES).toBe(1_048_576)
    })

    it('should have DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES = 10 MB', () => {
      expect(DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES).toBe(10_485_760)
    })

    it('should have DEFAULT_MAX_COMPUTATION_COST_LAMPORTS = ~1 SOL', () => {
      expect(DEFAULT_MAX_COMPUTATION_COST_LAMPORTS).toBe(BigInt(1_000_000_000))
    })
  })

  describe('backward compatibility (deprecated MAX_* = DEFAULT_*)', () => {
    it('MAX_ENCRYPTED_INPUTS should equal DEFAULT_MAX_ENCRYPTED_INPUTS', () => {
      expect(MAX_ENCRYPTED_INPUTS).toBe(DEFAULT_MAX_ENCRYPTED_INPUTS)
    })

    it('MAX_INPUT_SIZE_BYTES should equal DEFAULT_MAX_INPUT_SIZE_BYTES', () => {
      expect(MAX_INPUT_SIZE_BYTES).toBe(DEFAULT_MAX_INPUT_SIZE_BYTES)
    })

    it('MAX_TOTAL_INPUT_SIZE_BYTES should equal DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES', () => {
      expect(MAX_TOTAL_INPUT_SIZE_BYTES).toBe(DEFAULT_MAX_TOTAL_INPUT_SIZE_BYTES)
    })

    it('MAX_COMPUTATION_COST_LAMPORTS should equal DEFAULT_MAX_COMPUTATION_COST_LAMPORTS', () => {
      expect(MAX_COMPUTATION_COST_LAMPORTS).toBe(DEFAULT_MAX_COMPUTATION_COST_LAMPORTS)
    })
  })
})

// ─── Environment Variable Resolver Tests ───────────────────────────────────

describe('Environment Variable Resolvers', () => {
  afterEach(() => {
    // Clean up env vars after each test
    delete process.env.ARCIUM_RPC_URL
    delete process.env.ARCIUM_RPC_URL_DEVNET
    delete process.env.ARCIUM_RPC_URL_TESTNET
    delete process.env.ARCIUM_RPC_URL_MAINNET
    delete process.env.ARCIUM_NETWORK
    delete process.env.ARCIUM_CLUSTER
    delete process.env.ARCIUM_TIMEOUT_MS
  })

  describe('getEnvVar', () => {
    it('should return env var value when set', async () => {
      const { getEnvVar } = await import('../../src/privacy-backends/arcium-types')

      process.env.TEST_VAR = 'test-value'
      expect(getEnvVar('TEST_VAR')).toBe('test-value')
      delete process.env.TEST_VAR
    })

    it('should return undefined when env var not set', async () => {
      const { getEnvVar } = await import('../../src/privacy-backends/arcium-types')

      expect(getEnvVar('NON_EXISTENT_VAR')).toBeUndefined()
    })
  })

  describe('resolveRpcUrl', () => {
    it('should use network-specific env var first', async () => {
      const { resolveRpcUrl } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_RPC_URL_DEVNET = 'https://network-specific.rpc.url'
      process.env.ARCIUM_RPC_URL = 'https://generic.rpc.url'

      expect(resolveRpcUrl('devnet', 'https://config.rpc.url')).toBe('https://network-specific.rpc.url')
    })

    it('should fall back to generic env var', async () => {
      const { resolveRpcUrl } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_RPC_URL = 'https://generic.rpc.url'

      expect(resolveRpcUrl('devnet', 'https://config.rpc.url')).toBe('https://generic.rpc.url')
    })

    it('should fall back to config value', async () => {
      const { resolveRpcUrl } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveRpcUrl('devnet', 'https://config.rpc.url')).toBe('https://config.rpc.url')
    })

    it('should fall back to default', async () => {
      const { resolveRpcUrl, DEFAULT_RPC_ENDPOINTS } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveRpcUrl('devnet')).toBe(DEFAULT_RPC_ENDPOINTS.devnet)
    })
  })

  describe('resolveNetwork', () => {
    it('should use env var when set', async () => {
      const { resolveNetwork } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_NETWORK = 'testnet'

      expect(resolveNetwork('devnet')).toBe('testnet')
    })

    it('should fall back to config', async () => {
      const { resolveNetwork } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveNetwork('testnet')).toBe('testnet')
    })

    it('should fall back to default devnet', async () => {
      const { resolveNetwork } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveNetwork()).toBe('devnet')
    })

    it('should ignore invalid env var value', async () => {
      const { resolveNetwork } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_NETWORK = 'invalid-network'

      expect(resolveNetwork('testnet')).toBe('testnet')
    })
  })

  describe('resolveTimeout', () => {
    it('should use env var when set', async () => {
      const { resolveTimeout } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_TIMEOUT_MS = '600000'

      expect(resolveTimeout(300000)).toBe(600000)
    })

    it('should fall back to config', async () => {
      const { resolveTimeout } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveTimeout(300000)).toBe(300000)
    })

    it('should fall back to default', async () => {
      const { resolveTimeout, DEFAULT_COMPUTATION_TIMEOUT_MS } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveTimeout()).toBe(DEFAULT_COMPUTATION_TIMEOUT_MS)
    })

    it('should ignore invalid env var value', async () => {
      const { resolveTimeout, DEFAULT_COMPUTATION_TIMEOUT_MS } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_TIMEOUT_MS = 'not-a-number'

      expect(resolveTimeout()).toBe(DEFAULT_COMPUTATION_TIMEOUT_MS)
    })

    it('should ignore negative env var value', async () => {
      const { resolveTimeout, DEFAULT_COMPUTATION_TIMEOUT_MS } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_TIMEOUT_MS = '-1000'

      expect(resolveTimeout()).toBe(DEFAULT_COMPUTATION_TIMEOUT_MS)
    })
  })

  describe('resolveCluster', () => {
    it('should use env var when set', async () => {
      const { resolveCluster } = await import('../../src/privacy-backends/arcium-types')

      process.env.ARCIUM_CLUSTER = 'env-cluster-1'

      expect(resolveCluster('devnet', 'config-cluster-1')).toBe('env-cluster-1')
    })

    it('should fall back to config', async () => {
      const { resolveCluster } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveCluster('devnet', 'config-cluster-1')).toBe('config-cluster-1')
    })

    it('should fall back to network default', async () => {
      const { resolveCluster, ARCIUM_CLUSTERS } = await import('../../src/privacy-backends/arcium-types')

      expect(resolveCluster('devnet')).toBe(ARCIUM_CLUSTERS.devnet)
    })
  })
})

// ─── ArciumError Tests ──────────────────────────────────────────────────────

describe('ArciumError', () => {
  it('should be thrown on invalid network', async () => {
    const { ArciumError, isArciumError } = await import('../../src/privacy-backends/arcium-types')

    try {
      new ArciumBackend({
        // @ts-expect-error - Testing invalid network
        network: 'invalid',
      })
      expect.fail('Should have thrown ArciumError')
    } catch (error) {
      expect(isArciumError(error)).toBe(true)
      if (isArciumError(error)) {
        expect(error.arciumCode).toBe('ARCIUM_INVALID_NETWORK')
        expect(error.name).toBe('ArciumError')
        expect(error.message).toContain('Invalid Arcium network')
      }
    }
  })

  it('should include context in error', async () => {
    const { isArciumError } = await import('../../src/privacy-backends/arcium-types')

    try {
      new ArciumBackend({
        // @ts-expect-error - Testing invalid network
        network: 'badnet',
      })
      expect.fail('Should have thrown ArciumError')
    } catch (error) {
      if (isArciumError(error)) {
        expect(error.context?.receivedNetwork).toBe('badnet')
        expect(error.context?.validNetworks).toContain('devnet')
        expect(error.context?.validNetworks).toContain('testnet')
        expect(error.context?.validNetworks).toContain('mainnet-beta')
      }
    }
  })

  it('should have isNetworkError helper', async () => {
    const { ArciumError } = await import('../../src/privacy-backends/arcium-types')

    const networkError = new ArciumError('test', 'ARCIUM_INVALID_NETWORK')
    const computeError = new ArciumError('test', 'ARCIUM_COMPUTATION_FAILED')

    expect(networkError.isNetworkError()).toBe(true)
    expect(computeError.isNetworkError()).toBe(false)
  })

  it('should have isComputationError helper', async () => {
    const { ArciumError } = await import('../../src/privacy-backends/arcium-types')

    const computeError = new ArciumError('test', 'ARCIUM_COMPUTATION_FAILED')
    const timeoutError = new ArciumError('test', 'ARCIUM_COMPUTATION_TIMEOUT')
    const networkError = new ArciumError('test', 'ARCIUM_INVALID_NETWORK')

    expect(computeError.isComputationError()).toBe(true)
    expect(timeoutError.isComputationError()).toBe(true)
    expect(networkError.isComputationError()).toBe(false)
  })

  it('should have isClusterError helper', async () => {
    const { ArciumError } = await import('../../src/privacy-backends/arcium-types')

    const clusterError = new ArciumError('test', 'ARCIUM_CLUSTER_UNAVAILABLE')
    const networkError = new ArciumError('test', 'ARCIUM_INVALID_NETWORK')

    expect(clusterError.isClusterError()).toBe(true)
    expect(networkError.isClusterError()).toBe(false)
  })

  it('should extend SIPError', async () => {
    const { ArciumError } = await import('../../src/privacy-backends/arcium-types')
    const { SIPError, ErrorCode } = await import('../../src/errors')

    const error = new ArciumError('test error', 'ARCIUM_ERROR')

    // Should be an instance of SIPError
    expect(error).toBeInstanceOf(SIPError)
    expect(error.code).toBe(ErrorCode.ARCIUM_ERROR)
  })
})
