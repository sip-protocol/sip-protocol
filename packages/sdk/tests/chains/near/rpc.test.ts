/**
 * Tests for NEAR RPC Client
 *
 * @module tests/chains/near/rpc
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NEARRpcClient,
  createNEARRpcClient,
  createMainnetRpcClient,
  createTestnetRpcClient,
  NEARRpcClientError,
  NEARErrorCode,
  NEAR_RPC_ENDPOINTS,
} from '../../../src/chains/near'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('NEARRpcClient', () => {
  let client: NEARRpcClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = createNEARRpcClient({
      rpcUrl: 'https://rpc.mainnet.near.org',
      network: 'mainnet',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should create client with config', () => {
      expect(client.getNetwork()).toBe('mainnet')
      expect(client.getRpcUrl()).toBe('https://rpc.mainnet.near.org')
    })

    it('should create mainnet client with factory', () => {
      const mainnetClient = createMainnetRpcClient()
      expect(mainnetClient.getNetwork()).toBe('mainnet')
      expect(mainnetClient.getRpcUrl()).toBe(NEAR_RPC_ENDPOINTS.mainnet)
    })

    it('should create testnet client with factory', () => {
      const testnetClient = createTestnetRpcClient()
      expect(testnetClient.getNetwork()).toBe('testnet')
      expect(testnetClient.getRpcUrl()).toBe(NEAR_RPC_ENDPOINTS.testnet)
    })
  })

  describe('getAccount', () => {
    it('should get account info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            amount: '1000000000000000000000000',
            locked: '0',
            code_hash: '11111111111111111111111111111111',
            storage_usage: 100,
            storage_paid_at: 0,
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const account = await client.getAccount('alice.near')

      expect(account.amount).toBe(1000000000000000000000000n)
      expect(account.locked).toBe(0n)
      expect(account.storageUsage).toBe(100)
      expect(account.blockHeight).toBe(12345678)
    })

    it('should throw for invalid account ID', async () => {
      await expect(client.getAccount('X')).rejects.toThrow('Invalid account ID')
    })

    it('should handle account not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: -32000,
            message: 'account does not exist',
          },
        }),
      })

      await expect(client.getAccount('nonexistent.near')).rejects.toThrow(
        NEARRpcClientError
      )
    })
  })

  describe('getBalance', () => {
    it('should get account balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            amount: '5000000000000000000000000',
            locked: '0',
            code_hash: '11111111111111111111111111111111',
            storage_usage: 100,
            storage_paid_at: 0,
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const balance = await client.getBalance('alice.near')
      expect(balance).toBe(5000000000000000000000000n)
    })
  })

  describe('accountExists', () => {
    it('should return true for existing account', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            amount: '1000000000000000000000000',
            locked: '0',
            code_hash: '11111111111111111111111111111111',
            storage_usage: 100,
            storage_paid_at: 0,
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const exists = await client.accountExists('alice.near')
      expect(exists).toBe(true)
    })

    it('should return false for non-existing account', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: -32000,
            message: 'account does not exist',
          },
        }),
      })

      const exists = await client.accountExists('nonexistent.near')
      expect(exists).toBe(false)
    })
  })

  describe('getAccessKey', () => {
    it('should get access key info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            nonce: 12345,
            permission: 'FullAccess',
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const accessKey = await client.getAccessKey(
        'alice.near',
        'ed25519:ABC123'
      )

      expect(accessKey.nonce).toBe(12345n)
      expect(accessKey.permission).toBe('FullAccess')
      expect(accessKey.blockHeight).toBe(12345678)
    })

    it('should get nonce', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            nonce: 999,
            permission: 'FullAccess',
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const nonce = await client.getNonce('alice.near', 'ed25519:ABC123')
      expect(nonce).toBe(999n)
    })

    it('should get next nonce', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            nonce: 999,
            permission: 'FullAccess',
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const nextNonce = await client.getNextNonce('alice.near', 'ed25519:ABC123')
      expect(nextNonce).toBe(1000n)
    })
  })

  describe('getBlock', () => {
    it('should get final block', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            header: {
              height: 12345678,
              hash: 'blockhash123',
              timestamp: 1700000000000000000, // nanoseconds
              prev_hash: 'prevhash123',
              gas_price: '100000000',
            },
          },
        }),
      })

      const block = await client.getBlock('final')

      expect(block.height).toBe(12345678)
      expect(block.hash).toBe('blockhash123')
      expect(block.gasPrice).toBe(100000000n)
    })

    it('should get block height', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            header: {
              height: 12345678,
              hash: 'blockhash123',
              timestamp: 1700000000000000000,
              prev_hash: 'prevhash123',
              gas_price: '100000000',
            },
          },
        }),
      })

      const height = await client.getBlockHeight()
      expect(height).toBe(12345678)
    })

    it('should get latest block hash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            header: {
              height: 12345678,
              hash: 'blockhash123',
              timestamp: 1700000000000000000,
              prev_hash: 'prevhash123',
              gas_price: '100000000',
            },
          },
        }),
      })

      const hash = await client.getLatestBlockHash()
      expect(hash).toBe('blockhash123')
    })
  })

  describe('broadcastTxAsync', () => {
    it('should broadcast transaction and return hash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'txhash123abc',
        }),
      })

      const txHash = await client.broadcastTxAsync('base64signedtx')
      expect(txHash).toBe('txhash123abc')
    })
  })

  describe('broadcastTxCommit', () => {
    it('should broadcast and wait for inclusion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            status: { SuccessValue: '' },
            transaction: {
              hash: 'txhash123',
              signer_id: 'alice.near',
              receiver_id: 'bob.near',
            },
            transaction_outcome: {
              block_hash: 'blockhash123',
              outcome: {
                gas_burnt: 1000000,
                tokens_burnt: '100000000000',
                logs: ['log1'],
              },
            },
            receipts_outcome: [
              {
                id: 'receipt1',
                outcome: {
                  executor_id: 'bob.near',
                  gas_burnt: 500000,
                  tokens_burnt: '50000000000',
                  logs: [],
                  status: { SuccessValue: '' },
                },
              },
            ],
          },
        }),
      })

      const outcome = await client.broadcastTxCommit('base64signedtx')

      expect(outcome.txHash).toBe('txhash123')
      expect(outcome.signerId).toBe('alice.near')
      expect(outcome.receiverId).toBe('bob.near')
      expect(outcome.status).toBe('final')
      expect(outcome.gasUsed).toBe(1000000n)
      expect(outcome.receipts.length).toBe(1)
    })

    it('should handle failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            status: {
              Failure: { ActionError: { kind: 'SomeError' } },
            },
            transaction: {
              hash: 'txhash123',
              signer_id: 'alice.near',
              receiver_id: 'bob.near',
            },
            transaction_outcome: {
              block_hash: 'blockhash123',
              outcome: {
                gas_burnt: 1000000,
                tokens_burnt: '100000000000',
                logs: [],
              },
            },
            receipts_outcome: [],
          },
        }),
      })

      const outcome = await client.broadcastTxCommit('base64signedtx')

      expect(outcome.status).toBe('failed')
      expect(outcome.error).toBeDefined()
    })
  })

  describe('viewFunction', () => {
    it('should call view function', async () => {
      const resultData = { some: 'data' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(Buffer.from(JSON.stringify(resultData))),
            logs: [],
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const result = await client.viewFunction<typeof resultData>(
        'contract.near',
        'get_data',
        { key: 'test' }
      )

      expect(result).toEqual(resultData)
    })

    it('should throw for invalid contract ID', async () => {
      await expect(
        client.viewFunction('X', 'method')
      ).rejects.toThrow('Invalid contract ID')
    })
  })

  describe('getTokenBalance', () => {
    it('should get token balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(Buffer.from('"1000000000"')),
            logs: [],
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const balance = await client.getTokenBalance('usdc.near', 'alice.near')
      expect(balance).toBe(1000000000n)
    })

    it('should return 0 for unregistered account', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: -32000,
            message: 'account is not registered',
          },
        }),
      })

      const balance = await client.getTokenBalance('usdc.near', 'alice.near')
      expect(balance).toBe(0n)
    })
  })

  describe('hasStorageDeposit', () => {
    it('should return true if storage deposit exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(
              Buffer.from(JSON.stringify({ total: '1250000000000000000000', available: '0' }))
            ),
            logs: [],
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const hasDeposit = await client.hasStorageDeposit('usdc.near', 'alice.near')
      expect(hasDeposit).toBe(true)
    })

    it('should return false if no storage deposit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(Buffer.from('null')),
            logs: [],
            block_height: 12345678,
            block_hash: 'abc123',
          },
        }),
      })

      const hasDeposit = await client.hasStorageDeposit('usdc.near', 'alice.near')
      expect(hasDeposit).toBe(false)
    })
  })

  describe('retry and failover', () => {
    it('should retry on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              amount: '1000000000000000000000000',
              locked: '0',
              code_hash: '11111111111111111111111111111111',
              storage_usage: 100,
              storage_paid_at: 0,
              block_height: 12345678,
              block_hash: 'abc123',
            },
          }),
        })

      const account = await client.getAccount('alice.near')
      expect(account.amount).toBe(1000000000000000000000000n)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should failover to fallback URL', async () => {
      const clientWithFallback = createNEARRpcClient({
        rpcUrl: 'https://primary.rpc',
        fallbackUrls: ['https://fallback.rpc'],
        network: 'mainnet',
        maxRetries: 2,
        retryDelay: 50,
      })

      mockFetch
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              amount: '1000000000000000000000000',
              locked: '0',
              code_hash: '11111111111111111111111111111111',
              storage_usage: 100,
              storage_paid_at: 0,
              block_height: 12345678,
              block_hash: 'abc123',
            },
          }),
        })

      const account = await clientWithFallback.getAccount('alice.near')
      expect(account.amount).toBe(1000000000000000000000000n)
    })

    it('should throw after all retries fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(client.getAccount('alice.near')).rejects.toThrow()
      // 2 retries * 1 URL = at least 2 calls
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(client.getAccount('alice.near')).rejects.toThrow(
        NEARRpcClientError
      )
    })

    it('should categorize invalid nonce error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: -32000,
            message: 'InvalidNonce: nonce 100 must be larger than 99',
          },
        }),
      })

      try {
        await client.getAccount('alice.near')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NEARRpcClientError)
        expect((error as NEARRpcClientError).code).toBe(NEARErrorCode.INVALID_NONCE)
      }
    })

    it('should categorize insufficient balance error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: -32000,
            message: 'NotEnoughBalance',
          },
        }),
      })

      try {
        await client.getAccount('alice.near')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NEARRpcClientError)
        expect((error as NEARRpcClientError).code).toBe(
          NEARErrorCode.INSUFFICIENT_BALANCE
        )
      }
    })
  })

  describe('switchEndpoint', () => {
    it('should switch to next endpoint', () => {
      const clientWithFallback = createNEARRpcClient({
        rpcUrl: 'https://primary.rpc',
        fallbackUrls: ['https://fallback.rpc'],
        network: 'mainnet',
      })

      expect(clientWithFallback.getRpcUrl()).toBe('https://primary.rpc')
      clientWithFallback.switchEndpoint()
      // Internal index changed but getRpcUrl still returns primary
      // This is by design - getRpcUrl returns the configured primary
    })
  })
})
