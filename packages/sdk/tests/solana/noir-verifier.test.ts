/**
 * Solana Noir Verifier Tests
 *
 * Tests for verifying Noir ZK proofs on Solana.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  SolanaNoirVerifier,
  createDevnetVerifier,
  createMainnetVerifier,
  CIRCUIT_METADATA,
  DEFAULT_RPC_URLS,
  SOLANA_ZK_PROGRAM_IDS,
  SUNSPOT_VERIFIER_PROGRAM_IDS,
  getSunspotVerifierProgramId,
  SolanaNoirError,
  SolanaNoirErrorCode,
  isNoirCircuitType,
  isValidSolanaProof,
  estimateComputeUnits,
} from '../../src/solana'
import type { ZKProof } from '@sip-protocol/types'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockProof(type: 'funding' | 'validity' | 'fulfillment'): ZKProof {
  const publicInputCounts = {
    funding: 3,
    validity: 6,
    fulfillment: 8,
  }

  const publicInputs = Array(publicInputCounts[type])
    .fill(0)
    .map((_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}`) as `0x${string}`[]

  return {
    type,
    proof: `0x${'ab'.repeat(256)}`, // Mock 256-byte proof
    publicInputs,
  }
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('SolanaNoirVerifier', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const verifier = new SolanaNoirVerifier()

      expect(verifier).toBeDefined()
      expect(verifier.isReady).toBe(false)
    })

    it('should use devnet by default', () => {
      const verifier = new SolanaNoirVerifier()
      const config = verifier.getConfig()

      expect(config.network).toBe('devnet')
    })

    it('should accept custom network', () => {
      const verifier = new SolanaNoirVerifier({ network: 'mainnet-beta' })
      const config = verifier.getConfig()

      expect(config.network).toBe('mainnet-beta')
    })

    it('should accept custom RPC URL', () => {
      const customUrl = 'https://my-rpc.example.com'
      const verifier = new SolanaNoirVerifier({ rpcUrl: customUrl })

      expect(verifier.getRpcUrl()).toBe(customUrl)
    })

    it('should use default RPC for network', () => {
      const verifier = new SolanaNoirVerifier({ network: 'testnet' })

      expect(verifier.getRpcUrl()).toBe(DEFAULT_RPC_URLS.testnet)
    })

    it('should accept verbose flag', () => {
      const verifier = new SolanaNoirVerifier({ verbose: true })
      const config = verifier.getConfig()

      expect(config.verbose).toBe(true)
    })

    it('should accept custom max compute units', () => {
      const verifier = new SolanaNoirVerifier({ maxComputeUnits: 500000 })
      const config = verifier.getConfig()

      expect(config.maxComputeUnits).toBe(500000)
    })
  })

  // ─── Factory Functions ─────────────────────────────────────────────────────

  describe('factory functions', () => {
    it('should create devnet verifier', () => {
      const verifier = createDevnetVerifier()
      const config = verifier.getConfig()

      expect(config.network).toBe('devnet')
    })

    it('should create mainnet verifier', () => {
      const verifier = createMainnetVerifier()
      const config = verifier.getConfig()

      expect(config.network).toBe('mainnet-beta')
    })

    it('should merge config with factory', () => {
      const verifier = createDevnetVerifier({ verbose: true })
      const config = verifier.getConfig()

      expect(config.network).toBe('devnet')
      expect(config.verbose).toBe(true)
    })
  })

  // ─── Initialization Tests ──────────────────────────────────────────────────

  describe('initialize', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(() => {
      verifier = new SolanaNoirVerifier()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should initialize successfully', async () => {
      await verifier.initialize()

      expect(verifier.isReady).toBe(true)
    })

    it('should be idempotent', async () => {
      await verifier.initialize()
      await verifier.initialize()

      expect(verifier.isReady).toBe(true)
    })

    it('should load verification keys', async () => {
      await verifier.initialize()

      const fundingKey = verifier.getVerificationKey('funding')
      const validityKey = verifier.getVerificationKey('validity')
      const fulfillmentKey = verifier.getVerificationKey('fulfillment')

      expect(fundingKey).toBeDefined()
      expect(validityKey).toBeDefined()
      expect(fulfillmentKey).toBeDefined()
    })

    it('should set correct public input counts', async () => {
      await verifier.initialize()

      const fundingKey = verifier.getVerificationKey('funding')
      const validityKey = verifier.getVerificationKey('validity')
      const fulfillmentKey = verifier.getVerificationKey('fulfillment')

      expect(fundingKey?.publicInputCount).toBe(3)
      expect(validityKey?.publicInputCount).toBe(6)
      expect(fulfillmentKey?.publicInputCount).toBe(8)
    })
  })

  // ─── Serialization Tests ───────────────────────────────────────────────────

  describe('serializeProof', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should serialize funding proof', () => {
      const proof = createMockProof('funding')

      const serialized = verifier.serializeProof(proof)

      expect(serialized.circuitType).toBe('funding')
      expect(serialized.proofBytes).toBeInstanceOf(Uint8Array)
      expect(serialized.publicInputs).toHaveLength(3)
    })

    it('should serialize validity proof', () => {
      const proof = createMockProof('validity')

      const serialized = verifier.serializeProof(proof)

      expect(serialized.circuitType).toBe('validity')
      expect(serialized.publicInputs).toHaveLength(6)
    })

    it('should serialize fulfillment proof', () => {
      const proof = createMockProof('fulfillment')

      const serialized = verifier.serializeProof(proof)

      expect(serialized.circuitType).toBe('fulfillment')
      expect(serialized.publicInputs).toHaveLength(8)
    })

    it('should calculate total size', () => {
      const proof = createMockProof('funding')

      const serialized = verifier.serializeProof(proof)

      expect(serialized.totalSize).toBeGreaterThan(0)
      expect(serialized.totalSize).toBe(
        serialized.proofBytes.length + serialized.publicInputs.length * 32
      )
    })

    it('should throw on invalid proof', () => {
      const invalidProof = { type: 'invalid', proof: '0x', publicInputs: [] }

      expect(() => verifier.serializeProof(invalidProof as ZKProof)).toThrow(SolanaNoirError)
    })
  })

  // ─── Instruction Tests ─────────────────────────────────────────────────────

  describe('createVerifyInstruction', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should create instruction with correct program ID', () => {
      const proof = createMockProof('funding')

      const instruction = verifier.createVerifyInstruction(proof)

      expect(instruction.programId).toBe(SOLANA_ZK_PROGRAM_IDS.SIP_NOIR_VERIFIER)
    })

    it('should include instruction data', () => {
      const proof = createMockProof('funding')

      const instruction = verifier.createVerifyInstruction(proof)

      expect(instruction.data).toBeInstanceOf(Uint8Array)
      expect(instruction.data.length).toBeGreaterThan(0)
    })

    it('should include account keys', () => {
      const proof = createMockProof('funding')

      const instruction = verifier.createVerifyInstruction(proof)

      expect(instruction.keys).toBeDefined()
      expect(instruction.keys.length).toBeGreaterThan(0)
    })

    it('should set correct discriminator', () => {
      const proof = createMockProof('funding')

      const instruction = verifier.createVerifyInstruction(proof)

      expect(instruction.data[0]).toBe(0x01) // Verify instruction discriminator
    })

    it('should set correct circuit type ID', () => {
      const fundingInstruction = verifier.createVerifyInstruction(createMockProof('funding'))
      const validityInstruction = verifier.createVerifyInstruction(createMockProof('validity'))
      const fulfillmentInstruction = verifier.createVerifyInstruction(createMockProof('fulfillment'))

      expect(fundingInstruction.data[1]).toBe(0)
      expect(validityInstruction.data[1]).toBe(1)
      expect(fulfillmentInstruction.data[1]).toBe(2)
    })
  })

  // ─── Statistics Tests ──────────────────────────────────────────────────────

  describe('getProofStatistics', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should return statistics for funding proof', () => {
      const proof = createMockProof('funding')

      const stats = verifier.getProofStatistics(proof)

      expect(stats.circuitType).toBe('funding')
      expect(stats.proofSize).toBeGreaterThan(0)
      expect(stats.publicInputsSize).toBe(3 * 32)
      expect(stats.estimatedComputeUnits).toBeGreaterThan(0)
    })

    it('should return higher CU estimate for validity proof', () => {
      const fundingStats = verifier.getProofStatistics(createMockProof('funding'))
      const validityStats = verifier.getProofStatistics(createMockProof('validity'))

      // Validity proof has more constraints, should need more CU
      expect(validityStats.estimatedComputeUnits).toBeGreaterThan(
        fundingStats.estimatedComputeUnits
      )
    })
  })

  // ─── Verification Tests ────────────────────────────────────────────────────

  describe('verifyOffChain', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should return false for invalid proof structure', async () => {
      const invalidProof = { type: 'invalid', proof: '0x', publicInputs: [] }

      const result = await verifier.verifyOffChain(invalidProof as ZKProof)

      expect(result).toBe(false)
    })

    it('should require initialization', async () => {
      const uninitializedVerifier = new SolanaNoirVerifier()
      const proof = createMockProof('funding')

      await expect(uninitializedVerifier.verifyOffChain(proof)).rejects.toThrow(SolanaNoirError)
    })
  })

  // ─── Batch Verification Tests ──────────────────────────────────────────────

  describe('batchVerify', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should verify multiple proofs', async () => {
      const proofs = [
        createMockProof('funding'),
        createMockProof('validity'),
        createMockProof('fulfillment'),
      ]

      const result = await verifier.batchVerify({ proofs })

      expect(result.totalVerified).toBe(3)
      expect(result.results).toHaveLength(3)
    })

    it('should calculate total compute units', async () => {
      const proofs = [createMockProof('funding'), createMockProof('validity')]

      const result = await verifier.batchVerify({ proofs })

      expect(result.totalComputeUnits).toBeGreaterThan(0)
    })

    it('should support fail fast mode', async () => {
      const proofs = [
        { type: 'invalid' as const, proof: '0x', publicInputs: [] } as unknown as ZKProof,
        createMockProof('funding'),
      ]

      const result = await verifier.batchVerify({ proofs, failFast: true })

      // Should stop after first invalid
      expect(result.totalVerified).toBe(1)
      expect(result.validCount).toBe(0)
    })
  })

  // ─── Destroy Tests ─────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('should reset ready state', async () => {
      const verifier = new SolanaNoirVerifier()
      await verifier.initialize()

      expect(verifier.isReady).toBe(true)

      await verifier.destroy()

      expect(verifier.isReady).toBe(false)
    })

    it('should clear verification keys', async () => {
      const verifier = new SolanaNoirVerifier()
      await verifier.initialize()

      expect(verifier.getVerificationKey('funding')).toBeDefined()

      await verifier.destroy()

      expect(verifier.getVerificationKey('funding')).toBeUndefined()
    })
  })
})

// ─── Type Guard Tests ────────────────────────────────────────────────────────

describe('Type Guards', () => {
  describe('isNoirCircuitType', () => {
    it('should return true for valid types', () => {
      expect(isNoirCircuitType('funding')).toBe(true)
      expect(isNoirCircuitType('validity')).toBe(true)
      expect(isNoirCircuitType('fulfillment')).toBe(true)
    })

    it('should return false for invalid types', () => {
      expect(isNoirCircuitType('invalid')).toBe(false)
      expect(isNoirCircuitType('')).toBe(false)
      expect(isNoirCircuitType('FUNDING')).toBe(false)
    })
  })

  describe('isValidSolanaProof', () => {
    it('should return true for valid proof', () => {
      const proof = createMockProof('funding')

      expect(isValidSolanaProof(proof)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidSolanaProof(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidSolanaProof(undefined)).toBe(false)
    })

    it('should return false for invalid type', () => {
      expect(isValidSolanaProof({ type: 'invalid', proof: '0x', publicInputs: [] })).toBe(false)
    })

    it('should return false for missing proof', () => {
      expect(isValidSolanaProof({ type: 'funding', publicInputs: [] })).toBe(false)
    })

    it('should return false for missing publicInputs', () => {
      expect(isValidSolanaProof({ type: 'funding', proof: '0x' })).toBe(false)
    })
  })
})

// ─── Utility Function Tests ──────────────────────────────────────────────────

describe('Utility Functions', () => {
  describe('estimateComputeUnits', () => {
    it('should estimate for funding circuit', () => {
      const cu = estimateComputeUnits('funding')

      expect(cu).toBeGreaterThan(0)
      expect(cu).toBeLessThan(100000) // Funding is small circuit
    })

    it('should estimate for validity circuit', () => {
      const cu = estimateComputeUnits('validity')

      expect(cu).toBeGreaterThan(estimateComputeUnits('funding'))
    })

    it('should estimate for fulfillment circuit', () => {
      const cu = estimateComputeUnits('fulfillment')

      expect(cu).toBeGreaterThan(estimateComputeUnits('funding'))
    })
  })
})

// ─── Constants Tests ─────────────────────────────────────────────────────────

describe('Constants', () => {
  describe('CIRCUIT_METADATA', () => {
    it('should have metadata for all circuit types', () => {
      expect(CIRCUIT_METADATA.funding).toBeDefined()
      expect(CIRCUIT_METADATA.validity).toBeDefined()
      expect(CIRCUIT_METADATA.fulfillment).toBeDefined()
    })

    it('should have correct public input counts', () => {
      expect(CIRCUIT_METADATA.funding.publicInputCount).toBe(3)
      expect(CIRCUIT_METADATA.validity.publicInputCount).toBe(6)
      expect(CIRCUIT_METADATA.fulfillment.publicInputCount).toBe(8)
    })

    it('should have constraint counts', () => {
      expect(CIRCUIT_METADATA.funding.constraintCount).toBeGreaterThan(0)
      expect(CIRCUIT_METADATA.validity.constraintCount).toBeGreaterThan(0)
      expect(CIRCUIT_METADATA.fulfillment.constraintCount).toBeGreaterThan(0)
    })
  })

  describe('DEFAULT_RPC_URLS', () => {
    it('should have URLs for all networks', () => {
      expect(DEFAULT_RPC_URLS['mainnet-beta']).toBeDefined()
      expect(DEFAULT_RPC_URLS.devnet).toBeDefined()
      expect(DEFAULT_RPC_URLS.testnet).toBeDefined()
      expect(DEFAULT_RPC_URLS.localnet).toBeDefined()
    })

    it('should use HTTPS for public networks', () => {
      expect(DEFAULT_RPC_URLS['mainnet-beta']).toMatch(/^https:/)
      expect(DEFAULT_RPC_URLS.devnet).toMatch(/^https:/)
      expect(DEFAULT_RPC_URLS.testnet).toMatch(/^https:/)
    })

    it('should use HTTP for localnet', () => {
      expect(DEFAULT_RPC_URLS.localnet).toMatch(/^http:/)
    })
  })

  describe('SOLANA_ZK_PROGRAM_IDS', () => {
    it('should have all program IDs', () => {
      expect(SOLANA_ZK_PROGRAM_IDS.ZK_TOKEN_PROOF).toBeDefined()
      expect(SOLANA_ZK_PROGRAM_IDS.ZK_ELGAMAL_PROOF).toBeDefined()
      expect(SOLANA_ZK_PROGRAM_IDS.SIP_NOIR_VERIFIER).toBeDefined()
    })
  })
})

// ─── Error Tests ─────────────────────────────────────────────────────────────

describe('SolanaNoirError', () => {
  it('should create error with message and code', () => {
    const error = new SolanaNoirError(
      'Test error',
      SolanaNoirErrorCode.INVALID_PROOF_FORMAT
    )

    expect(error.message).toBe('Test error')
    expect(error.code).toBe(SolanaNoirErrorCode.INVALID_PROOF_FORMAT)
    expect(error.name).toBe('SolanaNoirError')
  })

  it('should include details', () => {
    const error = new SolanaNoirError(
      'Test error',
      SolanaNoirErrorCode.VERIFICATION_FAILED,
      { reason: 'bad proof' }
    )

    expect(error.details).toEqual({ reason: 'bad proof' })
  })

  it('should be instanceof Error', () => {
    const error = new SolanaNoirError(
      'Test error',
      SolanaNoirErrorCode.NETWORK_ERROR
    )

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SolanaNoirError)
  })
})

// ─── Sunspot Integration Tests ────────────────────────────────────────────────

describe('Sunspot Integration', () => {
  describe('SUNSPOT_VERIFIER_PROGRAM_IDS', () => {
    it('should have funding proof verifier on devnet', () => {
      expect(SUNSPOT_VERIFIER_PROGRAM_IDS.FUNDING_PROOF_DEVNET).toBe(
        '3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim'
      )
    })

    it('should have placeholders for other verifiers', () => {
      // These are TBD - will be deployed as part of the pipeline
      expect(SUNSPOT_VERIFIER_PROGRAM_IDS.VALIDITY_PROOF_DEVNET).toBeDefined()
      expect(SUNSPOT_VERIFIER_PROGRAM_IDS.FULFILLMENT_PROOF_DEVNET).toBeDefined()
    })
  })

  describe('getSunspotVerifierProgramId', () => {
    it('should return funding proof verifier for devnet', () => {
      const programId = getSunspotVerifierProgramId('funding', 'devnet')

      expect(programId).toBe('3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim')
    })

    it('should return null for validity proof on devnet (not deployed yet)', () => {
      const programId = getSunspotVerifierProgramId('validity', 'devnet')

      expect(programId).toBeNull()
    })

    it('should return null for mainnet (not deployed yet)', () => {
      const programId = getSunspotVerifierProgramId('funding', 'mainnet-beta')

      expect(programId).toBeNull()
    })
  })

  describe('serializeProofForSunspot', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should serialize proof for Sunspot verifier', () => {
      const proof = createMockProof('funding')

      const serialized = verifier.serializeProofForSunspot(proof)

      // Should be Buffer
      expect(Buffer.isBuffer(serialized)).toBe(true)

      // Should contain proof bytes + public witness
      expect(serialized.length).toBeGreaterThan(256)
    })

    it('should include public witness header', () => {
      const proof = createMockProof('funding')

      const serialized = verifier.serializeProofForSunspot(proof)

      // Proof is 256 bytes (mock), then public witness starts
      // Public witness format: [num_inputs (4 bytes)] [inputs...]
      const numInputs = serialized.readUInt32LE(256)
      expect(numInputs).toBe(3) // funding proof has 3 public inputs
    })

    it('should include all public inputs', () => {
      const proof = createMockProof('funding')

      const serialized = verifier.serializeProofForSunspot(proof)

      // Total size: 256 (proof) + 4 (count) + 3*32 (inputs) = 356 bytes
      expect(serialized.length).toBe(256 + 4 + 3 * 32)
    })
  })

  describe('createSunspotVerifyInstruction', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should create instruction with correct program ID', () => {
      const proof = createMockProof('funding')
      const programId = '3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim'

      const instruction = verifier.createSunspotVerifyInstruction(proof, programId)

      expect(instruction.programId.toBase58()).toBe(programId)
    })

    it('should have no required accounts', () => {
      const proof = createMockProof('funding')
      const programId = '3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim'

      const instruction = verifier.createSunspotVerifyInstruction(proof, programId)

      // Sunspot verifiers don't require any accounts
      expect(instruction.keys).toHaveLength(0)
    })

    it('should include serialized proof as data', () => {
      const proof = createMockProof('funding')
      const programId = '3nqQEuio4AVJo8H9pZJoERNFERWD5JNSqYan4UnsHhim'

      const instruction = verifier.createSunspotVerifyInstruction(proof, programId)

      // Data should match serializeProofForSunspot output
      const expectedData = verifier.serializeProofForSunspot(proof)
      expect(instruction.data).toEqual(expectedData)
    })
  })

  describe('verifyOnChain with Sunspot', () => {
    let verifier: SolanaNoirVerifier

    beforeEach(async () => {
      verifier = new SolanaNoirVerifier()
      await verifier.initialize()
    })

    afterEach(async () => {
      await verifier.destroy()
    })

    it('should return error for circuits without deployed verifier', async () => {
      const proof = createMockProof('validity') // validity not deployed yet

      const mockWallet = {
        publicKey: { toBase58: () => 'mockPublicKey' },
        signTransaction: async <T>(tx: T) => tx,
      }

      const result = await verifier.verifyOnChain(proof, mockWallet)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('No Sunspot verifier deployed')
    })
  })

  describe('getConnection', () => {
    it('should return Solana connection', () => {
      const verifier = new SolanaNoirVerifier()

      const connection = verifier.getConnection()

      expect(connection).toBeDefined()
      expect(connection.rpcEndpoint).toBe(DEFAULT_RPC_URLS.devnet)
    })

    it('should use custom RPC URL', () => {
      const customUrl = 'https://custom-rpc.example.com'
      const verifier = new SolanaNoirVerifier({ rpcUrl: customUrl })

      const connection = verifier.getConnection()

      expect(connection.rpcEndpoint).toBe(customUrl)
    })
  })
})
