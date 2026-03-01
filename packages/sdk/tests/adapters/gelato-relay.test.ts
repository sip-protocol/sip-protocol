import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  GelatoRelayAdapter,
  createGelatoRelayAdapter,
  functionSelector,
} from '../../src/adapters/gelato-relay'
import type {
  GelatoRelayConfig,
  RelayClaimParams,
  SyncFeeClaimParams,
} from '../../src/adapters/gelato-relay'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'

// ═══════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════

const SEPOLIA_CHAIN_ID = 11155111
const SIP_PRIVACY = '0x1FED19684dC108304960db2818CF5a961d28405E'
const SIP_RELAYER = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
const RECIPIENT = '0x7890123456789012345678901234567890123456'
const FEE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const ERC20_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

function makeConfig(overrides: Partial<GelatoRelayConfig> = {}): GelatoRelayConfig {
  return {
    apiKey: 'test-api-key',
    chainId: SEPOLIA_CHAIN_ID,
    sipPrivacyAddress: SIP_PRIVACY,
    sipRelayerAddress: SIP_RELAYER,
    ...overrides,
  }
}

function makeClaimParams(overrides: Partial<RelayClaimParams> = {}): RelayClaimParams {
  return {
    transferId: 42n,
    nullifier: '0x' + 'ab'.repeat(32),
    proof: '0x' + 'cd'.repeat(64),
    recipient: RECIPIENT,
    ...overrides,
  }
}

function makeSyncFeeParams(overrides: Partial<SyncFeeClaimParams> = {}): SyncFeeClaimParams {
  return {
    ...makeClaimParams(),
    feeToken: FEE_TOKEN,
    maxFee: 1000000000000000n, // 0.001 ETH
    ...overrides,
  }
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function mockFetchError(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(statusText),
  })
}

// ═══════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════

describe('GelatoRelayAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ─────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────

  describe('constructor', () => {
    it('accepts valid config', () => {
      const adapter = new GelatoRelayAdapter(makeConfig())
      expect(adapter).toBeInstanceOf(GelatoRelayAdapter)
    })

    it('throws without sipPrivacyAddress', () => {
      expect(() => new GelatoRelayAdapter(makeConfig({ sipPrivacyAddress: '' })))
        .toThrow('sipPrivacyAddress is required')
    })

    it('throws without chainId', () => {
      expect(() => new GelatoRelayAdapter(makeConfig({ chainId: 0 })))
        .toThrow('chainId is required')
    })
  })

  // ─────────────────────────────────────────
  // sponsoredClaim
  // ─────────────────────────────────────────

  describe('sponsoredClaim', () => {
    let adapter: GelatoRelayAdapter

    beforeEach(() => {
      adapter = new GelatoRelayAdapter(makeConfig())
    })

    it('calls correct endpoint with chainId, target, apiKey, and encoded data', async () => {
      const mockFn = mockFetchOk({ taskId: 'task-123' })
      vi.stubGlobal('fetch', mockFn)

      const result = await adapter.sponsoredClaim(makeClaimParams())

      expect(result).toEqual({ taskId: 'task-123', mode: 'sponsored' })
      expect(mockFn).toHaveBeenCalledOnce()

      // Verify endpoint
      const url = mockFn.mock.calls[0][0]
      expect(url).toBe('https://relay.gelato.digital/relays/v2/sponsored-call')

      // Verify body
      const opts = mockFn.mock.calls[0][1]
      const body = JSON.parse(opts.body)
      expect(body.chainId).toBe(SEPOLIA_CHAIN_ID)
      expect(body.target).toBe(SIP_PRIVACY)
      expect(body.sponsorApiKey).toBe('test-api-key')
      expect(body.data).toMatch(/^0x[0-9a-f]+$/)

      // Verify data starts with withdrawDeposit selector
      const expectedSelector = functionSelector('withdrawDeposit(uint256,bytes32,bytes,address)')
      expect(body.data.startsWith(expectedSelector)).toBe(true)
    })

    it('throws without API key', async () => {
      const noKeyAdapter = new GelatoRelayAdapter(makeConfig({ apiKey: undefined }))

      await expect(noKeyAdapter.sponsoredClaim(makeClaimParams()))
        .rejects.toThrow('API key required for sponsoredCall')
    })

    it('throws on API error (429)', async () => {
      vi.stubGlobal('fetch', mockFetchError(429, 'Too Many Requests'))

      await expect(adapter.sponsoredClaim(makeClaimParams()))
        .rejects.toThrow('Gelato relay error: 429')
    })

    it('throws on API error (500)', async () => {
      vi.stubGlobal('fetch', mockFetchError(500, 'Internal Server Error'))

      await expect(adapter.sponsoredClaim(makeClaimParams()))
        .rejects.toThrow('Gelato relay error: 500')
    })
  })

  // ─────────────────────────────────────────
  // syncFeeClaim
  // ─────────────────────────────────────────

  describe('syncFeeClaim', () => {
    let adapter: GelatoRelayAdapter

    beforeEach(() => {
      adapter = new GelatoRelayAdapter(makeConfig())
    })

    it('calls correct endpoint with relayer target and isRelayContext', async () => {
      const mockFn = mockFetchOk({ taskId: 'task-456' })
      vi.stubGlobal('fetch', mockFn)

      const result = await adapter.syncFeeClaim(makeSyncFeeParams())

      expect(result).toEqual({ taskId: 'task-456', mode: 'syncFee' })
      expect(mockFn).toHaveBeenCalledOnce()

      // Verify endpoint
      const url = mockFn.mock.calls[0][0]
      expect(url).toBe('https://relay.gelato.digital/relays/v2/call-with-sync-fee')

      // Verify body
      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      expect(body.target).toBe(SIP_RELAYER)
      expect(body.feeToken).toBe(FEE_TOKEN)
      expect(body.isRelayContext).toBe(true)
      expect(body.chainId).toBe(SEPOLIA_CHAIN_ID)

      // Verify data starts with relayedWithdrawETH selector (no token = ETH mode)
      const expectedSelector = functionSelector('relayedWithdrawETH(uint256,bytes32,bytes,address,uint256)')
      expect(body.data.startsWith(expectedSelector)).toBe(true)
    })

    it('throws without relayer address', async () => {
      const noRelayerAdapter = new GelatoRelayAdapter(makeConfig({ sipRelayerAddress: undefined }))

      await expect(noRelayerAdapter.syncFeeClaim(makeSyncFeeParams()))
        .rejects.toThrow('SIPRelayer address required for callWithSyncFee')
    })

    it('routes ERC20 via relayedWithdrawToken when token is set', async () => {
      const mockFn = mockFetchOk({ taskId: 'task-789' })
      vi.stubGlobal('fetch', mockFn)

      await adapter.syncFeeClaim(makeSyncFeeParams({ token: ERC20_TOKEN }))

      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      const expectedSelector = functionSelector('relayedWithdrawToken(uint256,bytes32,bytes,address,address,uint256)')
      expect(body.data.startsWith(expectedSelector)).toBe(true)
    })

    it('routes via relayedWithdrawETH when token is zero address', async () => {
      const mockFn = mockFetchOk({ taskId: 'task-eth' })
      vi.stubGlobal('fetch', mockFn)

      await adapter.syncFeeClaim(makeSyncFeeParams({
        token: '0x0000000000000000000000000000000000000000',
      }))

      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      const expectedSelector = functionSelector('relayedWithdrawETH(uint256,bytes32,bytes,address,uint256)')
      expect(body.data.startsWith(expectedSelector)).toBe(true)
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', mockFetchError(400, 'Bad Request'))

      await expect(adapter.syncFeeClaim(makeSyncFeeParams()))
        .rejects.toThrow('Gelato relay error: 400')
    })
  })

  // ─────────────────────────────────────────
  // getTaskStatus
  // ─────────────────────────────────────────

  describe('getTaskStatus', () => {
    let adapter: GelatoRelayAdapter

    beforeEach(() => {
      adapter = new GelatoRelayAdapter(makeConfig())
    })

    it('returns task status from API', async () => {
      const mockFn = mockFetchOk({
        task: {
          taskId: 'task-123',
          taskState: 'ExecSuccess',
          transactionHash: '0xdeadbeef',
          blockNumber: 12345,
        },
      })
      vi.stubGlobal('fetch', mockFn)

      const status = await adapter.getTaskStatus('task-123')

      expect(status).toEqual({
        taskId: 'task-123',
        taskState: 'ExecSuccess',
        transactionHash: '0xdeadbeef',
        blockNumber: 12345,
      })

      // Verify correct URL
      expect(mockFn.mock.calls[0][0]).toBe(
        'https://relay.gelato.digital/tasks/status/task-123'
      )
    })

    it('returns pending status without tx hash', async () => {
      vi.stubGlobal('fetch', mockFetchOk({
        task: {
          taskId: 'task-456',
          taskState: 'CheckPending',
        },
      }))

      const status = await adapter.getTaskStatus('task-456')

      expect(status.taskState).toBe('CheckPending')
      expect(status.transactionHash).toBeUndefined()
      expect(status.blockNumber).toBeUndefined()
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', mockFetchError(404, 'Not Found'))

      await expect(adapter.getTaskStatus('nonexistent'))
        .rejects.toThrow('Gelato status error: 404')
    })

    it('throws with empty taskId', async () => {
      await expect(adapter.getTaskStatus(''))
        .rejects.toThrow('taskId is required')
    })
  })

  // ─────────────────────────────────────────
  // Factory
  // ─────────────────────────────────────────

  describe('createGelatoRelayAdapter', () => {
    it('creates adapter instance', () => {
      const adapter = createGelatoRelayAdapter(makeConfig())
      expect(adapter).toBeInstanceOf(GelatoRelayAdapter)
    })

    it('created adapter works for sponsoredClaim', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ taskId: 'factory-task' }))

      const adapter = createGelatoRelayAdapter(makeConfig())
      const result = await adapter.sponsoredClaim(makeClaimParams())

      expect(result.taskId).toBe('factory-task')
      expect(result.mode).toBe('sponsored')
    })
  })

  // ─────────────────────────────────────────
  // ABI Encoding
  // ─────────────────────────────────────────

  describe('ABI encoding', () => {
    it('functionSelector computes correct keccak256', () => {
      // Verify against known keccak256 values
      const sig = 'withdrawDeposit(uint256,bytes32,bytes,address)'
      const selector = functionSelector(sig)

      // Compute expected manually
      const hash = keccak_256(new TextEncoder().encode(sig))
      const expected = '0x' + bytesToHex(hash).slice(0, 8)

      expect(selector).toBe(expected)
      expect(selector).toMatch(/^0x[0-9a-f]{8}$/)
    })

    it('different signatures produce different selectors', () => {
      const s1 = functionSelector('withdrawDeposit(uint256,bytes32,bytes,address)')
      const s2 = functionSelector('relayedWithdrawETH(uint256,bytes32,bytes,address,uint256)')
      const s3 = functionSelector('relayedWithdrawToken(uint256,bytes32,bytes,address,address,uint256)')

      expect(s1).not.toBe(s2)
      expect(s2).not.toBe(s3)
      expect(s1).not.toBe(s3)
    })

    it('encodes transferId as 32-byte left-padded hex in calldata', async () => {
      const mockFn = mockFetchOk({ taskId: 'test' })
      vi.stubGlobal('fetch', mockFn)

      const adapter = new GelatoRelayAdapter(makeConfig())
      await adapter.sponsoredClaim(makeClaimParams({ transferId: 255n }))

      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      const data = body.data as string
      // After 4-byte selector (8 hex chars + '0x' prefix), first 64 chars = transferId
      const transferIdHex = data.slice(10, 74)
      expect(transferIdHex).toBe('00000000000000000000000000000000000000000000000000000000000000ff')
    })

    it('encodes nullifier as bytes32 in calldata', async () => {
      const mockFn = mockFetchOk({ taskId: 'test' })
      vi.stubGlobal('fetch', mockFn)

      const nullifier = '0x' + '11'.repeat(32)
      const adapter = new GelatoRelayAdapter(makeConfig())
      await adapter.sponsoredClaim(makeClaimParams({ nullifier }))

      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      const data = body.data as string
      // Nullifier is at offset 74 (10 + 64), 64 hex chars
      const nullifierHex = data.slice(74, 138)
      expect(nullifierHex).toBe('11'.repeat(32))
    })

    it('encodes recipient address left-padded to 32 bytes', async () => {
      const mockFn = mockFetchOk({ taskId: 'test' })
      vi.stubGlobal('fetch', mockFn)

      const adapter = new GelatoRelayAdapter(makeConfig())
      await adapter.sponsoredClaim(makeClaimParams({
        recipient: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      }))

      const body = JSON.parse(mockFn.mock.calls[0][1].body)
      const data = body.data as string
      // recipient is at slot 3 (after transferId, nullifier, proofOffset)
      // offset = 10 + 64*3 = 202, length = 64
      const recipientHex = data.slice(202, 266)
      expect(recipientHex).toBe('000000000000000000000000deadbeefdeadbeefdeadbeefdead' + 'beefdeadbee' + 'f')
      expect(recipientHex.endsWith('deadbeefdeadbeefdeadbeefdead' + 'beefdeadbee' + 'f')).toBe(true)
      // Just verify it contains the address lowercase
      expect(recipientHex).toContain('deadbeefdead')
    })
  })
})
