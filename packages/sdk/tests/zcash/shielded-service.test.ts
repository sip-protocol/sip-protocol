/**
 * ZcashShieldedService unit tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ZcashShieldedService,
  createZcashShieldedService,
} from '../../src/zcash/shielded-service'
import { PrivacyLevel } from '@sip-protocol/types'

// Mock the RPC client
vi.mock('../../src/zcash/rpc-client', () => {
  const mockClient = {
    getBlockCount: vi.fn(),
    getAddressForAccount: vi.fn(),
    createAccount: vi.fn(),
    validateAddress: vi.fn(),
    getAccountBalance: vi.fn(),
    listUnspent: vi.fn(),
    sendShielded: vi.fn(),
    waitForOperation: vi.fn(),
    exportViewingKey: vi.fn(),
    importViewingKey: vi.fn(),
    getOperationStatus: vi.fn(),
    isTestnet: true,
  }

  return {
    ZcashRPCClient: vi.fn(() => mockClient),
    ZcashRPCError: class ZcashRPCError extends Error {
      constructor(
        message: string,
        public code: number,
      ) {
        super(message)
        this.name = 'ZcashRPCError'
      }
    },
    createZcashClient: vi.fn(() => mockClient),
    __mockClient: mockClient,
  }
})

// Get mock client reference
import { __mockClient as mockClient } from '../../src/zcash/rpc-client'

describe('ZcashShieldedService', () => {
  let service: ZcashShieldedService

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    ;(mockClient.getBlockCount as any).mockResolvedValue(2000000)
    ;(mockClient.getAddressForAccount as any).mockResolvedValue({
      account: 0,
      diversifier_index: 0,
      receiver_types: ['sapling', 'orchard'],
      address: 'u1testunifiedaddress',
    })
    ;(mockClient.validateAddress as any).mockResolvedValue({
      isvalid: true,
      address: 'u1testunifiedaddress',
      address_type: 'unified',
      ismine: true,
    })
    ;(mockClient.getAccountBalance as any).mockResolvedValue({
      pools: {
        transparent: { valueZat: 0 },
        sapling: { valueZat: 100000000 }, // 1 ZEC
        orchard: { valueZat: 50000000 }, // 0.5 ZEC
      },
      minimum_confirmations: 1,
    })
    ;(mockClient.listUnspent as any).mockResolvedValue([
      {
        txid: 'abc123',
        pool: 'sapling',
        outindex: 0,
        confirmations: 10,
        spendable: true,
        address: 'zs1testaddr',
        amount: 1.0,
        memo: '00',
        change: false,
      },
    ])
    ;(mockClient.sendShielded as any).mockResolvedValue('opid-12345')
    ;(mockClient.waitForOperation as any).mockResolvedValue({
      id: 'opid-12345',
      status: 'success',
      result: { txid: 'txhash123' },
    })
    ;(mockClient.exportViewingKey as any).mockResolvedValue('zxviews1testkey')
    ;(mockClient.importViewingKey as any).mockResolvedValue(undefined)
    ;(mockClient.getOperationStatus as any).mockResolvedValue([])

    service = new ZcashShieldedService({
      rpcConfig: {
        username: 'testuser',
        password: 'testpass',
        testnet: true,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create service with config', () => {
      const service = new ZcashShieldedService({
        rpcConfig: { username: 'user', password: 'pass' },
      })
      expect(service).toBeInstanceOf(ZcashShieldedService)
      expect(service.currentAccount).toBe(0)
    })

    it('should accept custom account number', () => {
      const service = new ZcashShieldedService({
        rpcConfig: { username: 'user', password: 'pass' },
        defaultAccount: 5,
      })
      expect(service.currentAccount).toBe(5)
    })
  })

  // ─── createZcashShieldedService ──────────────────────────────────────────────

  describe('createZcashShieldedService', () => {
    it('should create service instance', () => {
      const service = createZcashShieldedService({
        rpcConfig: { username: 'user', password: 'pass' },
      })
      expect(service).toBeInstanceOf(ZcashShieldedService)
    })
  })

  // ─── Initialization ──────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('should initialize and get account address', async () => {
      await service.initialize()

      expect(mockClient.getBlockCount).toHaveBeenCalled()
      expect(mockClient.getAddressForAccount).toHaveBeenCalledWith(0, ['sapling', 'orchard'])
      expect(service.getAddress()).toBe('u1testunifiedaddress')
    })

    it('should create account if not exists', async () => {
      // Import the mock error class
      const { ZcashRPCError } = await import('../../src/zcash/rpc-client')

      ;(mockClient.getAddressForAccount as any)
        .mockRejectedValueOnce(new ZcashRPCError('Account not found', -8))
        .mockResolvedValueOnce({
          account: 0,
          address: 'u1newaddress',
          receiver_types: ['sapling'],
          diversifier_index: 0,
        })
      ;(mockClient.createAccount as any).mockResolvedValue({ account: 0 })

      await service.initialize()

      expect(mockClient.createAccount).toHaveBeenCalled()
    })

    it('should only initialize once', async () => {
      await service.initialize()
      await service.initialize()

      expect(mockClient.getBlockCount).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Address Operations ──────────────────────────────────────────────────────

  describe('getAddress', () => {
    it('should throw if not initialized', () => {
      expect(() => service.getAddress()).toThrow('not initialized')
    })

    it('should return address after initialization', async () => {
      await service.initialize()
      expect(service.getAddress()).toBe('u1testunifiedaddress')
    })
  })

  describe('generateNewAddress', () => {
    it('should generate diversified address', async () => {
      await service.initialize()
      ;(mockClient.getAddressForAccount as any).mockResolvedValueOnce({
        account: 0,
        address: 'u1newdiversified',
        receiver_types: ['sapling', 'orchard'],
        diversifier_index: 1,
      })

      const address = await service.generateNewAddress()
      expect(address).toBe('u1newdiversified')
    })
  })

  describe('validateAddress', () => {
    it('should validate address', async () => {
      const result = await service.validateAddress('u1testaddr')
      expect(result.isvalid).toBe(true)
    })
  })

  describe('isShieldedAddress', () => {
    it('should return true for shielded address', async () => {
      ;(mockClient.validateAddress as any).mockResolvedValue({
        isvalid: true,
        address_type: 'sapling',
      })

      const result = await service.isShieldedAddress('zs1test')
      expect(result).toBe(true)
    })

    it('should return true for unified address', async () => {
      ;(mockClient.validateAddress as any).mockResolvedValue({
        isvalid: true,
        address_type: 'unified',
      })

      const result = await service.isShieldedAddress('u1test')
      expect(result).toBe(true)
    })

    it('should return false for transparent address', async () => {
      ;(mockClient.validateAddress as any).mockResolvedValue({
        isvalid: true,
        address_type: 'p2pkh',
      })

      const result = await service.isShieldedAddress('t1test')
      expect(result).toBe(false)
    })

    it('should return false for invalid address', async () => {
      ;(mockClient.validateAddress as any).mockResolvedValue({
        isvalid: false,
      })

      const result = await service.isShieldedAddress('invalid')
      expect(result).toBe(false)
    })
  })

  // ─── Balance Operations ──────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return balance summary', async () => {
      await service.initialize()
      const balance = await service.getBalance()

      expect(balance.confirmed).toBe(1.5) // 1 + 0.5 ZEC
      expect(balance.pools.sapling).toBe(1.0)
      expect(balance.pools.orchard).toBe(0.5)
      expect(balance.pools.transparent).toBe(0)
      expect(balance.spendableNotes).toBe(1)
    })

    it('should use custom minConf', async () => {
      await service.initialize()
      await service.getBalance(10)

      expect(mockClient.getAccountBalance).toHaveBeenCalledWith(0, 10)
    })
  })

  // ─── Send Operations ─────────────────────────────────────────────────────────

  describe('sendShielded', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should send shielded transaction', async () => {
      const result = await service.sendShielded({
        to: 'zs1recipient',
        amount: 0.5,
      })

      expect(result.txid).toBe('txhash123')
      expect(result.operationId).toBe('opid-12345')
      expect(result.amount).toBe(0.5)
    })

    it('should include memo in transaction', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 0.5,
        memo: 'Test payment',
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [
            expect.objectContaining({
              memo: expect.stringMatching(/^[0-9a-f]+$/i), // hex-encoded
            }),
          ],
        }),
      )
    })

    it('should use FullPrivacy policy for SHIELDED level', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 0.5,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyPolicy: 'FullPrivacy',
        }),
      )
    })

    it('should throw for invalid recipient', async () => {
      ;(mockClient.validateAddress as any).mockResolvedValue({ isvalid: false })

      await expect(
        service.sendShielded({
          to: 'invalid',
          amount: 0.5,
        }),
      ).rejects.toThrow('Invalid recipient')
    })

    it('should throw for non-positive amount', async () => {
      await expect(
        service.sendShielded({
          to: 'zs1recipient',
          amount: 0,
        }),
      ).rejects.toThrow('positive')

      await expect(
        service.sendShielded({
          to: 'zs1recipient',
          amount: -1,
        }),
      ).rejects.toThrow('positive')
    })

    it('should use custom from address', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 0.5,
        from: 'zs1customfrom',
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAddress: 'zs1customfrom',
        }),
      )
    })
  })

  describe('sendWithPrivacy', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should send with SHIELDED privacy level', async () => {
      const result = await service.sendWithPrivacy('zs1to', 1.0, PrivacyLevel.SHIELDED)
      expect(result.txid).toBe('txhash123')
    })

    it('should send with COMPLIANT privacy level', async () => {
      const result = await service.sendWithPrivacy('zs1to', 1.0, PrivacyLevel.COMPLIANT)
      expect(result.txid).toBe('txhash123')
    })

    it('should reject TRANSPARENT privacy level', async () => {
      await expect(
        service.sendWithPrivacy('zs1to', 1.0, PrivacyLevel.TRANSPARENT),
      ).rejects.toThrow('Transparent mode not supported')
    })
  })

  // ─── Receive Operations ──────────────────────────────────────────────────────

  describe('getReceivedNotes', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should get received notes', async () => {
      const notes = await service.getReceivedNotes()

      expect(notes).toHaveLength(1)
      expect(notes[0].txid).toBe('abc123')
      expect(notes[0].amount).toBe(1.0)
      expect(notes[0].pool).toBe('sapling')
    })

    it('should filter only spendable', async () => {
      ;(mockClient.listUnspent as any).mockResolvedValue([
        { txid: 'tx1', pool: 'sapling', spendable: true, amount: 1, confirmations: 10, address: 'zs1', memo: '00', change: false },
        { txid: 'tx2', pool: 'sapling', spendable: false, amount: 2, confirmations: 10, address: 'zs1', memo: '00', change: false },
      ])

      const notes = await service.getReceivedNotes(1, true)

      expect(notes).toHaveLength(1)
      expect(notes[0].txid).toBe('tx1')
    })

    it('should decode memo string', async () => {
      ;(mockClient.listUnspent as any).mockResolvedValue([
        {
          txid: 'tx1',
          pool: 'sapling',
          spendable: true,
          amount: 1,
          confirmations: 10,
          address: 'zs1',
          memo: Buffer.from('Hello').toString('hex'),
          change: false,
        },
      ])

      const notes = await service.getReceivedNotes()

      expect(notes[0].memo).toBe('Hello')
    })

    it('should use memoStr if available', async () => {
      ;(mockClient.listUnspent as any).mockResolvedValue([
        {
          txid: 'tx1',
          pool: 'sapling',
          spendable: true,
          amount: 1,
          confirmations: 10,
          address: 'zs1',
          memo: '00',
          memoStr: 'Already decoded',
          change: false,
        },
      ])

      const notes = await service.getReceivedNotes()

      expect(notes[0].memo).toBe('Already decoded')
    })
  })

  describe('getPendingNotes', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should get only unconfirmed notes', async () => {
      ;(mockClient.listUnspent as any).mockResolvedValue([
        { txid: 'tx1', pool: 'sapling', confirmations: 0, spendable: true, amount: 1, address: 'zs1', memo: '00', change: false },
        { txid: 'tx2', pool: 'sapling', confirmations: 5, spendable: true, amount: 2, address: 'zs1', memo: '00', change: false },
      ])

      const notes = await service.getPendingNotes()

      expect(notes).toHaveLength(1)
      expect(notes[0].txid).toBe('tx1')
    })
  })

  describe('waitForNote', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should find matching note', async () => {
      const note = await service.waitForNote(
        (n) => n.amount === 1.0,
        1000,
        10,
      )

      expect(note.txid).toBe('abc123')
    })

    it('should timeout if note not found', async () => {
      ;(mockClient.listUnspent as any).mockResolvedValue([])

      await expect(
        service.waitForNote(() => true, 100, 10),
      ).rejects.toThrow('Timed out')
    })
  })

  // ─── Viewing Key Operations ──────────────────────────────────────────────────

  describe('exportViewingKey', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should export viewing key', async () => {
      const result = await service.exportViewingKey()

      expect(result.key).toBe('zxviews1testkey')
      expect(result.address).toBe('u1testunifiedaddress')
      expect(result.account).toBe(0)
      expect(result.exportedAt).toBeGreaterThan(0)
    })

    it('should export for specific address', async () => {
      await service.exportViewingKey('zs1specificaddr')

      expect(mockClient.exportViewingKey).toHaveBeenCalledWith('zs1specificaddr')
    })
  })

  describe('importViewingKey', () => {
    it('should import viewing key', async () => {
      await service.importViewingKey('zxviews1key')

      expect(mockClient.importViewingKey).toHaveBeenCalledWith(
        'zxviews1key',
        'whenkeyisnew',
        undefined,
      )
    })

    it('should pass rescan option', async () => {
      await service.importViewingKey('zxviews1key', 'yes', 1000000)

      expect(mockClient.importViewingKey).toHaveBeenCalledWith(
        'zxviews1key',
        'yes',
        1000000,
      )
    })
  })

  describe('exportForCompliance', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should export viewing key for compliance', async () => {
      const result = await service.exportForCompliance()

      expect(result.viewingKey.key).toBe('zxviews1testkey')
      expect(result.privacyLevel).toBe(PrivacyLevel.COMPLIANT)
      expect(result.disclaimer).toContain('read-only')
    })
  })

  // ─── Operation Tracking ──────────────────────────────────────────────────────

  describe('getOperationStatus', () => {
    it('should get operation status', async () => {
      ;(mockClient.getOperationStatus as any).mockResolvedValue([
        { id: 'opid-123', status: 'executing' },
      ])

      const result = await service.getOperationStatus('opid-123')

      expect(result?.id).toBe('opid-123')
      expect(result?.status).toBe('executing')
    })

    it('should return null for unknown operation', async () => {
      ;(mockClient.getOperationStatus as any).mockResolvedValue([])

      const result = await service.getOperationStatus('opid-unknown')

      expect(result).toBeNull()
    })
  })

  describe('listPendingOperations', () => {
    it('should list pending operations', async () => {
      ;(mockClient.getOperationStatus as any).mockResolvedValue([
        { id: 'opid-1', status: 'executing' },
        { id: 'opid-2', status: 'queued' },
        { id: 'opid-3', status: 'success' },
      ])

      const result = await service.listPendingOperations()

      expect(result).toHaveLength(2)
      expect(result.map((op) => op.id)).toEqual(['opid-1', 'opid-2'])
    })
  })

  // ─── Blockchain Info ─────────────────────────────────────────────────────────

  describe('getBlockHeight', () => {
    it('should get current block height', async () => {
      const height = await service.getBlockHeight()
      expect(height).toBe(2000000)
    })
  })

  describe('isTestnet', () => {
    it('should return testnet status', () => {
      expect(service.isTestnet()).toBe(true)
    })
  })

  // ─── Privacy Level Mapping ───────────────────────────────────────────────────

  describe('privacy level to policy mapping', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should map SHIELDED to FullPrivacy', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 1,
        privacyLevel: PrivacyLevel.SHIELDED,
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyPolicy: 'FullPrivacy',
        }),
      )
    })

    it('should map COMPLIANT to FullPrivacy', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 1,
        privacyLevel: PrivacyLevel.COMPLIANT,
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyPolicy: 'FullPrivacy',
        }),
      )
    })

    it('should map TRANSPARENT to NoPrivacy', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 1,
        privacyLevel: PrivacyLevel.TRANSPARENT,
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyPolicy: 'NoPrivacy',
        }),
      )
    })

    it('should default to FullPrivacy when no privacy level specified', async () => {
      await service.sendShielded({
        to: 'zs1recipient',
        amount: 1,
      })

      expect(mockClient.sendShielded).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyPolicy: 'FullPrivacy',
        }),
      )
    })
  })

  // ─── RPC Client Access ───────────────────────────────────────────────────────

  describe('rpcClient', () => {
    it('should expose underlying RPC client', () => {
      const client = service.rpcClient
      expect(client).toBeDefined()
    })
  })
})
