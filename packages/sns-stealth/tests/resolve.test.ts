import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress, invalidateCache } from '../src/resolve'
import { NotFound, Malformed, NetworkError } from '../src/errors'

// Mock the Bonfida API surface we use:
//   - getRecord (v1 records, with deserialize:true returns the raw JSON string)
//   - getDomainKeySync (sync, returns { pubkey, ... })
//   - NameRegistryState.retrieve (async, throws AccountDoesNotExistError if domain missing)
//   - AccountDoesNotExistError / NoRecordDataError (error classes used for branch matching)
vi.mock('@bonfida/spl-name-service', () => {
  class AccountDoesNotExistError extends Error {
    readonly type = 'AccountDoesNotExist'
    constructor(message: string) {
      super(message)
      this.name = 'SNSError'
    }
  }
  class NoRecordDataError extends Error {
    readonly type = 'NoRecordData'
    constructor(message: string) {
      super(message)
      this.name = 'SNSError'
    }
  }
  return {
    AccountDoesNotExistError,
    NoRecordDataError,
    getRecord: vi.fn(),
    getDomainKeySync: vi.fn(() => ({ pubkey: { toBase58: () => 'fake' } })),
    NameRegistryState: {
      retrieve: vi.fn(),
    },
  }
})

import {
  getRecord,
  NameRegistryState,
  AccountDoesNotExistError,
  NoRecordDataError,
} from '@bonfida/spl-name-service'

const mockConnection = {} as Connection
const validHex = 'a'.repeat(64)

describe('resolveSIPStealth', () => {
  beforeEach(() => {
    vi.mocked(getRecord).mockReset()
    vi.mocked(NameRegistryState.retrieve).mockReset()
    // Default: domain exists (NameRegistryState.retrieve succeeds).
    vi.mocked(NameRegistryState.retrieve).mockResolvedValue({} as never)
    invalidateCache()
  })

  it('returns MetaAddress on valid record', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce(
      JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
    )

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(MetaAddress)
    if (result instanceof MetaAddress) {
      expect(result.domain).toBe('rector.sol')
      expect(result.chain).toBe('solana')
      expect(result.spending).toHaveLength(32)
      expect(result.viewing).toHaveLength(32)
    }
  })

  it('returns NotFound("domain") when domain does not exist', async () => {
    vi.mocked(NameRegistryState.retrieve).mockRejectedValueOnce(
      new AccountDoesNotExistError('The name account does not exist'),
    )

    const result = await resolveSIPStealth(mockConnection, 'nonexistent.sol')

    expect(result).toBeInstanceOf(NotFound)
    if (result instanceof NotFound) expect(result.subject).toBe('domain')
  })

  it('returns NotFound("record") when AccountDoesNotExistError on record fetch', async () => {
    vi.mocked(getRecord).mockRejectedValueOnce(
      new AccountDoesNotExistError('The name account does not exist'),
    )

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(NotFound)
    if (result instanceof NotFound) expect(result.subject).toBe('record')
  })

  it('returns NotFound("record") when NoRecordDataError on record fetch', async () => {
    vi.mocked(getRecord).mockRejectedValueOnce(
      new NoRecordDataError('The record data is empty'),
    )

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(NotFound)
    if (result instanceof NotFound) expect(result.subject).toBe('record')
  })

  it('returns Malformed on bad JSON', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce('{not json}')

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(Malformed)
    if (result instanceof Malformed) expect(result.reason).toBe('json-parse')
  })

  it('returns Malformed on schema mismatch', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce(
      JSON.stringify({ v: 99, spending: 'x', viewing: 'y' }),
    )

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(Malformed)
    if (result instanceof Malformed) expect(result.reason).toBe('schema')
  })

  it('normalizes domain before lookup', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce(
      JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
    )

    await resolveSIPStealth(mockConnection, 'RECTOR.SOL')

    const callArgs = vi.mocked(getRecord).mock.calls[0]
    expect(callArgs[1]).toBe('rector.sol')
  })

  it('uses cache on second call within TTL (same reference)', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce(
      JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
    )

    const a = await resolveSIPStealth(mockConnection, 'rector.sol')
    const b = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(a).toBe(b)
    expect(getRecord).toHaveBeenCalledTimes(1)
  })

  it('invalidateCache(domain) forces re-fetch', async () => {
    vi.mocked(getRecord)
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: 'b'.repeat(64), viewing: validHex }),
      )

    const a = await resolveSIPStealth(mockConnection, 'rector.sol')
    invalidateCache('rector.sol')
    const b = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(a).not.toBe(b)
    expect(getRecord).toHaveBeenCalledTimes(2)
  })

  it('throws NetworkError on unexpected error during domain probe', async () => {
    vi.mocked(NameRegistryState.retrieve).mockRejectedValueOnce(
      new Error('connection reset'),
    )

    await expect(resolveSIPStealth(mockConnection, 'rector.sol'))
      .rejects.toThrow(NetworkError)
  })

  it('throws NetworkError on unexpected error during record fetch', async () => {
    vi.mocked(getRecord).mockRejectedValueOnce(
      new Error('rpc timeout'),
    )

    await expect(resolveSIPStealth(mockConnection, 'rector.sol'))
      .rejects.toThrow(NetworkError)
  })

  it('invalidateCache normalizes the domain argument', async () => {
    vi.mocked(getRecord)
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: 'e'.repeat(64), viewing: validHex }),
      )

    // Cache stores under normalized key 'rector.sol'
    const a = await resolveSIPStealth(mockConnection, 'rector.sol')
    // Invalidate with non-normalized argument
    invalidateCache('RECTOR.SOL.')
    // Next lookup should bypass cache and re-fetch
    const b = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(a).not.toBe(b)
    expect(getRecord).toHaveBeenCalledTimes(2)
  })

  it('invalidateCache() with no args clears all entries', async () => {
    vi.mocked(getRecord)
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: validHex, viewing: validHex }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: validHex, viewing: 'c'.repeat(64) }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ v: 1, spending: 'd'.repeat(64), viewing: validHex }),
      )

    const a = await resolveSIPStealth(mockConnection, 'alice.sol')
    const b = await resolveSIPStealth(mockConnection, 'bob.sol')
    invalidateCache()
    const aAgain = await resolveSIPStealth(mockConnection, 'alice.sol')

    expect(a).not.toBe(aAgain)
    // alice + bob + alice-again = 3 fetches
    expect(getRecord).toHaveBeenCalledTimes(3)
    // sanity: b was cached before clear, fresh fetch wouldn't be triggered
    void b
  })
})
