/**
 * ZcashRPCClient unit tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ZcashRPCClient, ZcashRPCError, createZcashClient } from '../../src/zcash/rpc-client'
import { ZcashErrorCode } from '@sip-protocol/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create mock RPC response
function createRPCResponse<T>(result: T, error: null = null) {
  return {
    ok: true,
    json: async () => ({
      result,
      error,
      id: 1,
    }),
  }
}

function createRPCError(code: number, message: string) {
  return {
    ok: true,
    json: async () => ({
      result: null,
      error: { code, message },
      id: 1,
    }),
  }
}

function createHTTPError(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
  }
}

describe('ZcashRPCClient', () => {
  let client: ZcashRPCClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ZcashRPCClient({
      username: 'testuser',
      password: 'testpass',
      testnet: true,
      retries: 0, // Disable retries for faster tests
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new ZcashRPCClient({
        username: 'user',
        password: 'pass',
      })
      expect(client.isTestnet).toBe(false)
      expect(client.endpoint).toBe('http://127.0.0.1:8232')
    })

    it('should create testnet client with correct port', () => {
      const client = new ZcashRPCClient({
        username: 'user',
        password: 'pass',
        testnet: true,
      })
      expect(client.isTestnet).toBe(true)
      expect(client.endpoint).toBe('http://127.0.0.1:18232')
    })

    it('should allow custom host and port', () => {
      const client = new ZcashRPCClient({
        username: 'user',
        password: 'pass',
        host: '192.168.1.100',
        port: 9000,
      })
      expect(client.endpoint).toBe('http://192.168.1.100:9000')
    })
  })

  // ─── createZcashClient ───────────────────────────────────────────────────────

  describe('createZcashClient', () => {
    it('should create client instance', () => {
      const client = createZcashClient({
        username: 'user',
        password: 'pass',
      })
      expect(client).toBeInstanceOf(ZcashRPCClient)
    })
  })

  // ─── Address Operations ──────────────────────────────────────────────────────

  describe('validateAddress', () => {
    it('should validate valid address', async () => {
      const addressInfo = {
        isvalid: true,
        address: 'zs1testaddr123',
        address_type: 'sapling',
        ismine: true,
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse(addressInfo))

      const result = await client.validateAddress('zs1testaddr123')
      expect(result.isvalid).toBe(true)
      expect(result.address_type).toBe('sapling')
    })

    it('should return invalid for bad address', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse({ isvalid: false }))

      const result = await client.validateAddress('invalid')
      expect(result.isvalid).toBe(false)
    })
  })

  describe('createAccount', () => {
    it('should create new account', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse({ account: 0 }))

      const result = await client.createAccount()
      expect(result.account).toBe(0)
    })
  })

  describe('getAddressForAccount', () => {
    it('should get address for account', async () => {
      const addressResult = {
        account: 0,
        diversifier_index: 0,
        receiver_types: ['sapling', 'orchard'],
        address: 'u1testunifiedaddr',
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse(addressResult))

      const result = await client.getAddressForAccount(0)
      expect(result.address).toBe('u1testunifiedaddr')
      expect(result.receiver_types).toContain('sapling')
    })

    it('should pass receiver types parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCResponse({
          account: 0,
          diversifier_index: 0,
          receiver_types: ['orchard'],
          address: 'u1orchardaddr',
        }),
      )

      await client.getAddressForAccount(0, ['orchard'])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.params).toEqual([0, ['orchard']])
    })
  })

  describe('listAddresses', () => {
    it('should list all addresses', async () => {
      const addresses = ['zs1addr1', 'zs1addr2', 'zs1addr3']
      mockFetch.mockResolvedValueOnce(createRPCResponse(addresses))

      const result = await client.listAddresses()
      expect(result).toHaveLength(3)
      expect(result).toContain('zs1addr1')
    })
  })

  // ─── Balance Operations ──────────────────────────────────────────────────────

  describe('getAccountBalance', () => {
    it('should get account balance by pool', async () => {
      const balance = {
        pools: {
          sapling: { valueZat: 100000000 },
          orchard: { valueZat: 50000000 },
        },
        minimum_confirmations: 1,
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse(balance))

      const result = await client.getAccountBalance(0)
      expect(result.pools.sapling?.valueZat).toBe(100000000)
      expect(result.pools.orchard?.valueZat).toBe(50000000)
    })
  })

  describe('getTotalBalance', () => {
    it('should get total wallet balance', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCResponse({
          transparent: '0.5',
          private: '1.5',
          total: '2.0',
        }),
      )

      const result = await client.getTotalBalance()
      expect(result.total).toBe('2.0')
    })
  })

  // ─── UTXO Operations ─────────────────────────────────────────────────────────

  describe('listUnspent', () => {
    it('should list unspent notes', async () => {
      const notes = [
        {
          txid: 'abc123',
          pool: 'sapling',
          outindex: 0,
          confirmations: 10,
          spendable: true,
          address: 'zs1test',
          amount: 1.5,
          memo: '00',
          change: false,
        },
      ]
      mockFetch.mockResolvedValueOnce(createRPCResponse(notes))

      const result = await client.listUnspent()
      expect(result).toHaveLength(1)
      expect(result[0].pool).toBe('sapling')
      expect(result[0].amount).toBe(1.5)
    })

    it('should filter by addresses', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse([]))

      await client.listUnspent(1, 9999999, false, ['zs1specific'])

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.params).toEqual([1, 9999999, false, ['zs1specific']])
    })
  })

  // ─── Transaction Operations ──────────────────────────────────────────────────

  describe('sendShielded', () => {
    it('should send shielded transaction', async () => {
      const opId = 'opid-12345'
      mockFetch.mockResolvedValueOnce(createRPCResponse(opId))

      const result = await client.sendShielded({
        fromAddress: 'zs1from',
        recipients: [{ address: 'zs1to', amount: 1.0 }],
      })

      expect(result).toBe(opId)
    })

    it('should include memo in transaction', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse('opid-memo'))

      await client.sendShielded({
        fromAddress: 'zs1from',
        recipients: [{ address: 'zs1to', amount: 1.0, memo: '48656c6c6f' }],
      })

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.params[1][0].memo).toBe('48656c6c6f')
    })

    it('should pass optional parameters', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse('opid-params'))

      await client.sendShielded({
        fromAddress: 'zs1from',
        recipients: [{ address: 'zs1to', amount: 1.0 }],
        minConf: 5,
        fee: 0.0001,
        privacyPolicy: 'FullPrivacy',
      })

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.params).toEqual([
        'zs1from',
        [{ address: 'zs1to', amount: 1.0 }],
        5,
        0.0001,
        'FullPrivacy',
      ])
    })
  })

  // ─── Operation Management ────────────────────────────────────────────────────

  describe('getOperationStatus', () => {
    it('should get operation status', async () => {
      const ops = [
        {
          id: 'opid-123',
          status: 'executing',
          creation_time: 1700000000,
          method: 'z_sendmany',
          params: {},
        },
      ]
      mockFetch.mockResolvedValueOnce(createRPCResponse(ops))

      const result = await client.getOperationStatus(['opid-123'])
      expect(result[0].status).toBe('executing')
    })

    it('should get all operations when no IDs provided', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse([]))

      await client.getOperationStatus()

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.params).toEqual([])
    })
  })

  describe('waitForOperation', () => {
    it('should wait for successful operation', async () => {
      const successOp = {
        id: 'opid-success',
        status: 'success',
        creation_time: 1700000000,
        method: 'z_sendmany',
        params: {},
        result: { txid: 'txhash123' },
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse([successOp]))

      const result = await client.waitForOperation('opid-success', 10, 1000)
      expect(result.status).toBe('success')
      expect(result.result?.txid).toBe('txhash123')
    })

    it('should throw on failed operation', async () => {
      const failedOp = {
        id: 'opid-failed',
        status: 'failed',
        creation_time: 1700000000,
        method: 'z_sendmany',
        params: {},
        error: { code: -6, message: 'Insufficient funds' },
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse([failedOp]))

      await expect(client.waitForOperation('opid-failed', 10, 1000)).rejects.toThrow(
        'Insufficient funds',
      )
    })

    it('should throw on cancelled operation', async () => {
      const cancelledOp = {
        id: 'opid-cancelled',
        status: 'cancelled',
        creation_time: 1700000000,
        method: 'z_sendmany',
        params: {},
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse([cancelledOp]))

      await expect(client.waitForOperation('opid-cancelled', 10, 1000)).rejects.toThrow(
        'cancelled',
      )
    })

    it('should throw on unknown operation', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse([]))

      await expect(client.waitForOperation('opid-unknown', 10, 1000)).rejects.toThrow('not found')
    })

    it('should poll until complete', async () => {
      const executingOp = {
        id: 'opid-polling',
        status: 'executing',
        creation_time: 1700000000,
        method: 'z_sendmany',
        params: {},
      }
      const successOp = { ...executingOp, status: 'success', result: { txid: 'tx' } }

      mockFetch
        .mockResolvedValueOnce(createRPCResponse([executingOp]))
        .mockResolvedValueOnce(createRPCResponse([executingOp]))
        .mockResolvedValueOnce(createRPCResponse([successOp]))

      const result = await client.waitForOperation('opid-polling', 10, 5000)
      expect(result.status).toBe('success')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  // ─── Blockchain Operations ───────────────────────────────────────────────────

  describe('getBlockCount', () => {
    it('should get current block height', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse(2000000))

      const result = await client.getBlockCount()
      expect(result).toBe(2000000)
    })
  })

  describe('getBlockHash', () => {
    it('should get block hash at height', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse('0000000abc123'))

      const result = await client.getBlockHash(1000)
      expect(result).toBe('0000000abc123')
    })
  })

  describe('getBlockHeader', () => {
    it('should get block header by hash', async () => {
      const header = {
        hash: '0000000abc',
        confirmations: 100,
        height: 1000,
        version: 4,
        merkleroot: 'merkle123',
        time: 1700000000,
        nonce: '123',
        solution: 'solution',
        bits: 'bits',
        difficulty: 1.5,
        chainwork: 'work',
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse(header))

      const result = await client.getBlockHeader('0000000abc')
      expect(result.height).toBe(1000)
    })

    it('should get block header by height', async () => {
      mockFetch
        .mockResolvedValueOnce(createRPCResponse('0000000abc'))
        .mockResolvedValueOnce(
          createRPCResponse({
            hash: '0000000abc',
            height: 1000,
          }),
        )

      const result = await client.getBlockHeader(1000)
      expect(result.hash).toBe('0000000abc')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getBlockchainInfo', () => {
    it('should get blockchain info', async () => {
      const info = {
        chain: 'test',
        blocks: 2000000,
        headers: 2000000,
        bestblockhash: 'hash',
        difficulty: 1.5,
        verificationprogress: 1,
        chainwork: 'work',
        initialblockdownload: false,
        size_on_disk: 1000000,
        pruned: false,
        consensus: { chaintip: 'v5', nextblock: 'v5' },
      }
      mockFetch.mockResolvedValueOnce(createRPCResponse(info))

      const result = await client.getBlockchainInfo()
      expect(result.chain).toBe('test')
      expect(result.blocks).toBe(2000000)
    })
  })

  // ─── Key Management ──────────────────────────────────────────────────────────

  describe('exportViewingKey', () => {
    it('should export viewing key', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse('zxviews1testviewingkey'))

      const result = await client.exportViewingKey('zs1addr')
      expect(result).toBe('zxviews1testviewingkey')
    })
  })

  describe('importViewingKey', () => {
    it('should import viewing key', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse(null))

      await expect(
        client.importViewingKey('zxviews1key', 'whenkeyisnew'),
      ).resolves.toBeUndefined()
    })
  })

  // ─── Error Handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw ZcashRPCError on RPC error', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCError(ZcashErrorCode.WALLET_INSUFFICIENT_FUNDS, 'Insufficient funds'),
      )

      const promise = client.getBalance('zs1addr')
      await expect(promise).rejects.toThrow(ZcashRPCError)
      await expect(promise).rejects.toThrow('Insufficient funds')
    })

    it('should identify insufficient funds error', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCError(ZcashErrorCode.WALLET_INSUFFICIENT_FUNDS, 'Insufficient funds'),
      )

      try {
        await client.getBalance('zs1addr')
      } catch (e) {
        expect(e).toBeInstanceOf(ZcashRPCError)
        expect((e as ZcashRPCError).isInsufficientFunds()).toBe(true)
      }
    })

    it('should identify invalid address error', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCError(ZcashErrorCode.INVALID_ADDRESS_OR_KEY, 'Invalid address'),
      )

      try {
        await client.validateAddress('invalid')
      } catch (e) {
        expect(e).toBeInstanceOf(ZcashRPCError)
        expect((e as ZcashRPCError).isInvalidAddress()).toBe(true)
      }
    })

    it('should identify wallet locked error', async () => {
      mockFetch.mockResolvedValueOnce(
        createRPCError(ZcashErrorCode.WALLET_UNLOCK_NEEDED, 'Wallet locked'),
      )

      try {
        await client.sendShielded({
          fromAddress: 'zs1from',
          recipients: [{ address: 'zs1to', amount: 1 }],
        })
      } catch (e) {
        expect(e).toBeInstanceOf(ZcashRPCError)
        expect((e as ZcashRPCError).isWalletLocked()).toBe(true)
      }
    })

    it('should throw NetworkError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce(createHTTPError(500, 'Internal Server Error'))

      await expect(client.getBlockCount()).rejects.toThrow('HTTP error')
    })

    it('should throw NetworkError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(client.getBlockCount()).rejects.toThrow('Connection refused')
    })
  })

  // ─── Retry Logic ─────────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('should retry on network failure', async () => {
      const clientWithRetry = new ZcashRPCClient({
        username: 'user',
        password: 'pass',
        retries: 2,
        retryDelay: 10,
      })

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createRPCResponse(1000))

      const result = await clientWithRetry.getBlockCount()
      expect(result).toBe(1000)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should not retry on RPC error', async () => {
      const clientWithRetry = new ZcashRPCClient({
        username: 'user',
        password: 'pass',
        retries: 2,
        retryDelay: 10,
      })

      mockFetch.mockResolvedValueOnce(
        createRPCError(ZcashErrorCode.INVALID_PARAMETER, 'Invalid param'),
      )

      await expect(clientWithRetry.getBlockCount()).rejects.toThrow('Invalid param')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Authentication ──────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('should include Basic auth header', async () => {
      mockFetch.mockResolvedValueOnce(createRPCResponse(1000))

      await client.getBlockCount()

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers.Authorization).toMatch(/^Basic /)

      // Decode and verify credentials
      const encoded = options.headers.Authorization.replace('Basic ', '')
      const decoded = Buffer.from(encoded, 'base64').toString()
      expect(decoded).toBe('testuser:testpass')
    })
  })
})

// ─── ZcashRPCError ─────────────────────────────────────────────────────────────

describe('ZcashRPCError', () => {
  it('should create error with code and message', () => {
    const error = new ZcashRPCError('Test error', -6)
    expect(error.message).toBe('Test error')
    expect(error.code).toBe(-6)
    expect(error.name).toBe('ZcashRPCError')
  })

  it('should include optional data', () => {
    const error = new ZcashRPCError('Test error', -6, { extra: 'info' })
    expect(error.data).toEqual({ extra: 'info' })
  })

  it('should correctly identify error types', () => {
    const insufficientFunds = new ZcashRPCError('', ZcashErrorCode.WALLET_INSUFFICIENT_FUNDS)
    const invalidAddress = new ZcashRPCError('', ZcashErrorCode.INVALID_ADDRESS_OR_KEY)
    const walletLocked = new ZcashRPCError('', ZcashErrorCode.WALLET_UNLOCK_NEEDED)
    const otherError = new ZcashRPCError('', -1)

    expect(insufficientFunds.isInsufficientFunds()).toBe(true)
    expect(insufficientFunds.isInvalidAddress()).toBe(false)

    expect(invalidAddress.isInvalidAddress()).toBe(true)
    expect(invalidAddress.isWalletLocked()).toBe(false)

    expect(walletLocked.isWalletLocked()).toBe(true)
    expect(walletLocked.isInsufficientFunds()).toBe(false)

    expect(otherError.isInsufficientFunds()).toBe(false)
    expect(otherError.isInvalidAddress()).toBe(false)
    expect(otherError.isWalletLocked()).toBe(false)
  })
})
