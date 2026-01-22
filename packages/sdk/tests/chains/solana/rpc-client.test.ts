/**
 * Solana RPC Client Tests
 *
 * Tests for the RPC client with retry logic and failover.
 * Now includes mocks for both @solana/web3.js and @solana/kit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PublicKey, Transaction, Keypair } from '@solana/web3.js'
import {
  SolanaRPCClient,
  createRPCClient,
  createClusterClient,
  RPCErrorType,
  RPC_ENDPOINTS,
  type RPCClientConfig,
} from '../../../src/chains/solana/rpc-client'

// Create mock RPC object factory
const createMockRpc = () => ({
  getVersion: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({ 'solana-core': '1.14.0', 'feature-set': 1234 }),
  }),
  getLatestBlockhash: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({
      value: {
        blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
        lastValidBlockHeight: 1000n,
      },
      context: { slot: 12345n },
    }),
  }),
  getBalance: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({
      value: 1_000_000_000n,
      context: { slot: 12345n },
    }),
  }),
  getAccountInfo: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({
      value: null,
      context: { slot: 12345n },
    }),
  }),
  sendTransaction: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue('mockSignature123'),
  }),
  getSignatureStatuses: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
      context: { slot: 12345n },
    }),
  }),
  getRecentPrioritizationFees: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue([
      { slot: 100n, prioritizationFee: 1000n },
      { slot: 101n, prioritizationFee: 2000n },
      { slot: 102n, prioritizationFee: 1500n },
    ]),
  }),
})

// Mock @solana/kit
vi.mock('@solana/kit', async () => {
  const actual = await vi.importActual<typeof import('@solana/kit')>('@solana/kit')
  return {
    ...actual,
    createSolanaRpc: vi.fn().mockImplementation(() => createMockRpc()),
    createSolanaRpcSubscriptions: vi.fn().mockImplementation(() => ({})),
  }
})

// Mock the Connection class from @solana/web3.js
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
  return {
    ...actual,
    Connection: vi.fn().mockImplementation((endpoint: string) => ({
      rpcEndpoint: endpoint,
      getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.14.0' }),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
        lastValidBlockHeight: 1000,
      }),
      getBalance: vi.fn().mockResolvedValue(1_000_000_000),
      getAccountInfo: vi.fn().mockResolvedValue(null),
      sendRawTransaction: vi.fn().mockResolvedValue('mockSignature123'),
      confirmTransaction: vi.fn().mockResolvedValue({
        context: { slot: 12345 },
        value: { err: null },
      }),
      getRecentPrioritizationFees: vi.fn().mockResolvedValue([
        { slot: 100, prioritizationFee: 1000 },
        { slot: 101, prioritizationFee: 2000 },
        { slot: 102, prioritizationFee: 1500 },
      ]),
    })),
  }
})

describe('Solana RPC Client', () => {
  // ─── Construction ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create client with minimal config', () => {
      const client = new SolanaRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      expect(client).toBeInstanceOf(SolanaRPCClient)
      expect(client.getConnections()).toHaveLength(1)
    })

    it('should create client with fallback endpoints', () => {
      const client = new SolanaRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
        fallbackEndpoints: [
          'https://solana-api.projectserum.com',
          'https://rpc.ankr.com/solana',
        ],
      })

      expect(client.getConnections()).toHaveLength(3)
    })

    it('should accept custom options', () => {
      const client = new SolanaRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
        commitment: 'finalized',
        maxRetries: 5,
        retryBaseDelay: 1000,
        usePriorityFees: true,
        debug: true,
      })

      expect(client).toBeInstanceOf(SolanaRPCClient)
    })
  })

  describe('createRPCClient', () => {
    it('should create client via factory function', () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      expect(client).toBeInstanceOf(SolanaRPCClient)
    })
  })

  describe('createClusterClient', () => {
    it('should create mainnet client', () => {
      const client = createClusterClient('mainnet-beta')

      expect(client).toBeInstanceOf(SolanaRPCClient)
      expect(client.getCurrentEndpoint()).toBe(RPC_ENDPOINTS['mainnet-beta'][0])
    })

    it('should create devnet client', () => {
      const client = createClusterClient('devnet')

      expect(client.getCurrentEndpoint()).toBe(RPC_ENDPOINTS['devnet'][0])
    })

    it('should accept additional options', () => {
      const client = createClusterClient('mainnet-beta', {
        maxRetries: 5,
        usePriorityFees: true,
      })

      expect(client).toBeInstanceOf(SolanaRPCClient)
    })
  })

  // ─── Connection Management ────────────────────────────────────────────────

  describe('connection management', () => {
    it('should get current connection', () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      const connection = client.getConnection()
      expect(connection).toBeDefined()
      expect(connection.rpcEndpoint).toBe('https://api.mainnet-beta.solana.com')
    })

    it('should get current endpoint', () => {
      const client = createRPCClient({
        endpoint: 'https://custom-endpoint.com',
      })

      expect(client.getCurrentEndpoint()).toBe('https://custom-endpoint.com')
    })
  })

  // ─── Error Classification ─────────────────────────────────────────────────

  describe('classifyError', () => {
    let client: SolanaRPCClient

    beforeEach(() => {
      client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })
    })

    it('should classify network errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.NETWORK)
      expect(classified.retryable).toBe(true)
    })

    it('should classify rate limit errors', () => {
      const error = new Error('429: Too Many Requests')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.RATE_LIMIT)
      expect(classified.retryable).toBe(true)
      expect(classified.suggestedDelay).toBe(5000)
    })

    it('should classify blockhash expired errors', () => {
      const error = new Error('Transaction failed: blockhash expired')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.BLOCKHASH_EXPIRED)
      expect(classified.retryable).toBe(true)
    })

    it('should classify simulation errors as non-retryable', () => {
      const error = new Error('Transaction simulation failed')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.SIMULATION_FAILED)
      expect(classified.retryable).toBe(false)
    })

    it('should classify insufficient funds as non-retryable', () => {
      const error = new Error('Insufficient balance for transaction')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.INSUFFICIENT_FUNDS)
      expect(classified.retryable).toBe(false)
    })

    it('should classify unknown errors as retryable', () => {
      const error = new Error('Some unknown error occurred')
      const classified = client.classifyError(error)

      expect(classified.type).toBe(RPCErrorType.UNKNOWN)
      expect(classified.retryable).toBe(true)
    })
  })

  // ─── Utility Methods ──────────────────────────────────────────────────────

  describe('getLatestBlockhash', () => {
    it('should get latest blockhash', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      const result = await client.getLatestBlockhash()

      expect(result.blockhash).toBeDefined()
      expect(result.lastValidBlockHeight).toBeGreaterThan(0)
    })
  })

  describe('getBalance', () => {
    it('should get balance', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      const balance = await client.getBalance(PublicKey.default)

      expect(typeof balance).toBe('bigint')
      expect(balance).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('isHealthy', () => {
    it('should return true for healthy connection', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      const healthy = await client.isHealthy()

      expect(healthy).toBe(true)
    })
  })

  // ─── Priority Fees ────────────────────────────────────────────────────────

  describe('estimatePriorityFee', () => {
    it('should estimate priority fee', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
        usePriorityFees: true,
      })

      const transaction = new Transaction()
      transaction.add({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      })
      transaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
      transaction.feePayer = PublicKey.default

      const estimate = await client.estimatePriorityFee(transaction)

      expect(estimate.microLamportsPerComputeUnit).toBeGreaterThan(0)
      expect(estimate.totalLamports).toBeGreaterThan(0n)
      expect(estimate.percentile).toBe(75)
    })
  })

  describe('addPriorityFee', () => {
    it('should add priority fee instructions', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
        usePriorityFees: true,
      })

      const transaction = new Transaction()
      transaction.add({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      })
      transaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
      transaction.feePayer = PublicKey.default

      const modifiedTx = await client.addPriorityFee(transaction, 5000, 300_000)

      // Should have 3 instructions: compute limit, compute price, original
      expect(modifiedTx.instructions).toHaveLength(3)
    })
  })

  // ─── RPC Endpoints ────────────────────────────────────────────────────────

  describe('RPC_ENDPOINTS', () => {
    it('should have mainnet endpoints', () => {
      expect(RPC_ENDPOINTS['mainnet-beta'].length).toBeGreaterThan(0)
    })

    it('should have devnet endpoints', () => {
      expect(RPC_ENDPOINTS['devnet'].length).toBeGreaterThan(0)
    })

    it('should have testnet endpoints', () => {
      expect(RPC_ENDPOINTS['testnet'].length).toBeGreaterThan(0)
    })
  })

  // ─── Transaction Submission ───────────────────────────────────────────────

  describe('sendTransaction', () => {
    it('should send transaction', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      // Create a keypair and use it as fee payer
      const keypair = Keypair.generate()

      const transaction = new Transaction()
      transaction.add({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      })
      transaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
      transaction.feePayer = keypair.publicKey

      // Sign the transaction
      transaction.sign(keypair)

      const signature = await client.sendTransaction(transaction)

      expect(signature).toBeDefined()
      expect(typeof signature).toBe('string')
    })
  })

  describe('sendAndConfirmTransaction', () => {
    it('should send and confirm transaction', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.mainnet-beta.solana.com',
      })

      // Create a keypair and use it as fee payer
      const keypair = Keypair.generate()

      const transaction = new Transaction()
      transaction.add({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      })
      transaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
      transaction.feePayer = keypair.publicKey

      // Sign the transaction
      transaction.sign(keypair)

      const result = await client.sendAndConfirmTransaction(transaction)

      expect(result.confirmed).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.confirmationTime).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── Integration ──────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support full workflow: create, estimate, add fees', async () => {
      const client = createClusterClient('mainnet-beta', {
        usePriorityFees: true,
      })

      // Create transaction
      const transaction = new Transaction()
      transaction.add({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      })
      transaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
      transaction.feePayer = PublicKey.default

      // Estimate priority fee
      const estimate = await client.estimatePriorityFee(transaction)
      expect(estimate.microLamportsPerComputeUnit).toBeGreaterThan(0)

      // Add priority fee
      const modifiedTx = await client.addPriorityFee(
        transaction,
        estimate.microLamportsPerComputeUnit,
        250_000
      )
      expect(modifiedTx.instructions.length).toBeGreaterThan(1)
    })

    it('should handle multiple endpoints gracefully', () => {
      const client = createRPCClient({
        endpoint: 'https://primary.solana.com',
        fallbackEndpoints: [
          'https://fallback1.solana.com',
          'https://fallback2.solana.com',
        ],
      })

      expect(client.getConnections()).toHaveLength(3)
      expect(client.getCurrentEndpoint()).toBe('https://primary.solana.com')
    })
  })
})
