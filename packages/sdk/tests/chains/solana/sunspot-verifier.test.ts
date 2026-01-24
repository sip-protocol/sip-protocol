/**
 * Sunspot ZK Verifier Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey, Connection, Transaction } from '@solana/web3.js'
import {
  SunspotVerifier,
  ProofType,
  createVerifyInstructionData,
  formatFundingInputs,
  formatOwnershipInputs,
} from '../../../src/chains/solana/sunspot-verifier'

// Mock @solana/web3.js
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
        lastValidBlockHeight: 100,
      }),
      sendRawTransaction: vi.fn().mockResolvedValue(
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      ),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
      getTransaction: vi.fn().mockResolvedValue({
        meta: { computeUnitsConsumed: 200000 },
      }),
    })),
  }
})

describe('SunspotVerifier', () => {
  // Use system program and token program as mock verifier addresses
  const mockFundingVerifier = new PublicKey('11111111111111111111111111111111')
  const mockOwnershipVerifier = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  const mockPayer = new PublicKey('11111111111111111111111111111111')

  let verifier: SunspotVerifier
  let mockConnection: Connection
  let mockSignTransaction: <T extends Transaction>(tx: T) => Promise<T>

  beforeEach(() => {
    vi.clearAllMocks()

    verifier = new SunspotVerifier({
      fundingVerifierProgram: mockFundingVerifier,
      ownershipVerifierProgram: mockOwnershipVerifier,
    })

    mockConnection = new Connection('https://api.devnet.solana.com')
    mockSignTransaction = vi.fn().mockImplementation(async (tx) => {
      tx.addSignature(mockPayer, Buffer.alloc(64))
      return tx
    })
  })

  describe('Configuration', () => {
    it('creates verifier with program IDs', () => {
      expect(verifier.getVerifierProgram(ProofType.Funding)).toEqual(mockFundingVerifier)
      expect(verifier.getVerifierProgram(ProofType.Ownership)).toEqual(mockOwnershipVerifier)
    })

    it('accepts string program IDs', () => {
      const v = new SunspotVerifier({
        fundingVerifierProgram: '11111111111111111111111111111111',
      })
      expect(v.isSupported(ProofType.Funding)).toBe(true)
    })

    it('returns undefined for unconfigured proof types', () => {
      expect(verifier.getVerifierProgram(ProofType.Validity)).toBeUndefined()
    })

    it('checks if proof type is supported', () => {
      expect(verifier.isSupported(ProofType.Funding)).toBe(true)
      expect(verifier.isSupported(ProofType.Validity)).toBe(false)
    })
  })

  describe('Proof Verification', () => {
    // Mock compressed Groth16 proof (131 bytes)
    const mockProof = new Uint8Array(131)
    mockProof[0] = 0x02 // Compressed point prefix

    it('verifies valid proof', async () => {
      const result = await verifier.verify({
        connection: mockConnection,
        proofType: ProofType.Funding,
        proof: mockProof,
        publicInputs: [
          new Uint8Array(32), // commitment hash
          1000n,              // minimum required
          new Uint8Array(32), // asset id
        ],
        payer: mockPayer,
        signTransaction: mockSignTransaction,
      })

      expect(result.verified).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.computeUnits).toBeGreaterThan(0)
    })

    it('accepts hex string proof', async () => {
      const hexProof = '0x' + '02'.padEnd(262, '0') // 131 bytes as hex

      const result = await verifier.verify({
        connection: mockConnection,
        proofType: ProofType.Funding,
        proof: hexProof as `0x${string}`,
        publicInputs: [1000n],
        payer: mockPayer,
        signTransaction: mockSignTransaction,
      })

      expect(result.verified).toBe(true)
    })

    it('throws on unsupported proof type', async () => {
      await expect(
        verifier.verify({
          connection: mockConnection,
          proofType: ProofType.Validity,
          proof: mockProof,
          publicInputs: [],
          payer: mockPayer,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('No verifier program configured')
    })

    it('throws on invalid proof size', async () => {
      const invalidProof = new Uint8Array(100) // Wrong size

      await expect(
        verifier.verify({
          connection: mockConnection,
          proofType: ProofType.Funding,
          proof: invalidProof,
          publicInputs: [],
          payer: mockPayer,
          signTransaction: mockSignTransaction,
        })
      ).rejects.toThrow('Invalid proof size')
    })

    it('handles uncompressed proofs (256 bytes)', async () => {
      const uncompressedProof = new Uint8Array(256)

      const result = await verifier.verify({
        connection: mockConnection,
        proofType: ProofType.Funding,
        proof: uncompressedProof,
        publicInputs: [],
        payer: mockPayer,
        signTransaction: mockSignTransaction,
      })

      expect(result.verified).toBe(true)
    })
  })

  describe('Compute Unit Estimation', () => {
    it('estimates CU for funding proof', () => {
      expect(verifier.estimateComputeUnits(ProofType.Funding)).toBe(220_000)
    })

    it('estimates CU for ownership proof', () => {
      expect(verifier.estimateComputeUnits(ProofType.Ownership)).toBe(200_000)
    })

    it('estimates CU for validity proof', () => {
      expect(verifier.estimateComputeUnits(ProofType.Validity)).toBe(250_000)
    })

    it('estimates CU for fulfillment proof', () => {
      expect(verifier.estimateComputeUnits(ProofType.Fulfillment)).toBe(230_000)
    })
  })

  describe('Proof Parsing', () => {
    it('parses compressed proof (131 bytes)', () => {
      const proofBytes = new Uint8Array(131)
      proofBytes.fill(0xaa, 0, 33)   // a
      proofBytes.fill(0xbb, 33, 98)  // b
      proofBytes.fill(0xcc, 98, 131) // c

      const proof = SunspotVerifier.parseProof(proofBytes)

      expect(proof.a.length).toBe(33)
      expect(proof.b.length).toBe(65)
      expect(proof.c.length).toBe(33)
      expect(proof.a[0]).toBe(0xaa)
      expect(proof.b[0]).toBe(0xbb)
      expect(proof.c[0]).toBe(0xcc)
    })

    it('parses uncompressed proof (256 bytes)', () => {
      const proofBytes = new Uint8Array(256)
      proofBytes.fill(0xaa, 0, 64)    // a
      proofBytes.fill(0xbb, 64, 192)  // b
      proofBytes.fill(0xcc, 192, 256) // c

      const proof = SunspotVerifier.parseProof(proofBytes)

      expect(proof.a.length).toBe(64)
      expect(proof.b.length).toBe(128)
      expect(proof.c.length).toBe(64)
    })

    it('throws on invalid proof size', () => {
      const invalidProof = new Uint8Array(100)

      expect(() => SunspotVerifier.parseProof(invalidProof)).toThrow('Invalid proof size')
    })

    it('serializes proof back to bytes', () => {
      const proof = {
        a: new Uint8Array([1, 2, 3]),
        b: new Uint8Array([4, 5, 6]),
        c: new Uint8Array([7, 8, 9]),
      }

      const serialized = SunspotVerifier.serializeProof(proof)

      expect(serialized).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    })
  })

  describe('Instruction Data Helpers', () => {
    it('creates verify instruction data', () => {
      const proof = new Uint8Array([1, 2, 3])
      const inputs = [new Uint8Array([4, 5]), new Uint8Array([6, 7, 8])]

      const data = createVerifyInstructionData(proof, inputs)

      expect(data).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))
    })

    it('formats funding proof inputs', () => {
      const inputs = formatFundingInputs({
        commitmentHash: `0x${'ab'.repeat(32)}` as `0x${string}`,
        minimumRequired: 1000n,
        assetId: `0x${'cd'.repeat(32)}` as `0x${string}`,
      })

      expect(inputs.length).toBe(3)
      expect(inputs[0].length).toBe(32) // commitment hash
      expect(inputs[1].length).toBe(32) // minimum (padded to 32 bytes)
      expect(inputs[2].length).toBe(32) // asset id
    })

    it('formats ownership proof inputs', () => {
      const inputs = formatOwnershipInputs({
        stealthPubkey: `0x${'ab'.repeat(32)}` as `0x${string}`,
        ephemeralPubkey: `0x${'cd'.repeat(32)}` as `0x${string}`,
        nullifier: `0x${'ef'.repeat(32)}` as `0x${string}`,
      })

      expect(inputs.length).toBe(3)
      expect(inputs[0].length).toBe(32) // stealth pubkey
      expect(inputs[1].length).toBe(32) // ephemeral pubkey
      expect(inputs[2].length).toBe(32) // nullifier
    })
  })

  describe('Error Handling', () => {
    it('returns error result on transaction failure', async () => {
      const mockConnectionWithError = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
          blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
          lastValidBlockHeight: 100,
        }),
        sendRawTransaction: vi.fn().mockResolvedValue('sig123'),
        confirmTransaction: vi.fn().mockResolvedValue({
          value: { err: { InstructionError: [0, 'Custom'] } },
        }),
      } as unknown as Connection

      const result = await verifier.verify({
        connection: mockConnectionWithError,
        proofType: ProofType.Funding,
        proof: new Uint8Array(131),
        publicInputs: [],
        payer: mockPayer,
        signTransaction: mockSignTransaction,
      })

      expect(result.verified).toBe(false)
      expect(result.error).toContain('Verification failed')
    })

    it('catches sign transaction errors', async () => {
      const failingSign = vi.fn().mockRejectedValue(new Error('User rejected'))

      const result = await verifier.verify({
        connection: mockConnection,
        proofType: ProofType.Funding,
        proof: new Uint8Array(131),
        publicInputs: [],
        payer: mockPayer,
        signTransaction: failingSign,
      })

      expect(result.verified).toBe(false)
      expect(result.error).toBe('User rejected')
    })
  })
})

describe('ProofType Enum', () => {
  it('has all expected values', () => {
    expect(ProofType.Funding).toBe('funding')
    expect(ProofType.Ownership).toBe('ownership')
    expect(ProofType.Validity).toBe('validity')
    expect(ProofType.Fulfillment).toBe('fulfillment')
  })
})
