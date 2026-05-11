import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { bytesToHex } from '@noble/hashes/utils'

// Mock the Bonfida API surface we use:
//   - createRecordInstruction: async (connection, domain, record, data, owner, payer) => TransactionInstruction
// The SDK derives a PDA for the subdomain <RECORD>.<DOMAIN> and returns a single
// `createInstruction` against the SNS program. We don't care about its internal
// shape — only that buildPublishTx passes the right arguments and produces a
// well-formed Transaction.
vi.mock('@bonfida/spl-name-service', () => ({
  createRecordInstruction: vi.fn(),
}))

import { createRecordInstruction } from '@bonfida/spl-name-service'
import { buildPublishTx } from '../src/publish'

const mockBlockhash = 'EkSnNWid2cYwsbqzdGyaDkjyAa3pYBtjwjsJqDxN1RfV'
const mockConnection = {
  getLatestBlockhash: vi.fn(),
} as unknown as Connection

// A valid base58 PublicKey for tests
const payer = new PublicKey('11111111111111111111111111111111')

// Build a no-op TransactionInstruction we can return from the mocked SDK call.
// SystemProgram.transfer gives us a real, valid instruction without any side
// effects when we add it to a Transaction.
const noopIx = (): TransactionInstruction =>
  SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: payer,
    lamports: 0,
  })

describe('buildPublishTx', () => {
  beforeEach(() => {
    vi.mocked(createRecordInstruction).mockReset()
    vi.mocked(createRecordInstruction).mockResolvedValue(noopIx())
    vi.mocked(mockConnection.getLatestBlockhash).mockReset()
    vi.mocked(mockConnection.getLatestBlockhash).mockResolvedValue({
      blockhash: mockBlockhash,
      lastValidBlockHeight: 100,
    })
  })

  it('builds a Transaction with the publisher set as fee payer and a fresh blockhash', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(1),
      viewing: new Uint8Array(32).fill(2),
    }

    const tx = await buildPublishTx(mockConnection, 'rector.sol', keys, payer)

    expect(tx).toBeInstanceOf(Transaction)
    expect(tx.feePayer?.toBase58()).toBe(payer.toBase58())
    expect(tx.recentBlockhash).toBe(mockBlockhash)
    expect(tx.instructions).toHaveLength(1)
  })

  it('normalizes the domain before writing the record', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(1),
      viewing: new Uint8Array(32).fill(2),
    }

    await buildPublishTx(mockConnection, 'RECTOR.SOL', keys, payer)

    const callArgs = vi.mocked(createRecordInstruction).mock.calls.at(-1)!
    expect(callArgs[1]).toBe('rector.sol')
  })

  it('encodes the record as canonical JSON with hex-encoded keys', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(0xaa),
      viewing: new Uint8Array(32).fill(0xbb),
    }

    await buildPublishTx(mockConnection, 'rector.sol', keys, payer)

    const callArgs = vi.mocked(createRecordInstruction).mock.calls.at(-1)!
    const recordValue = callArgs[3]
    // Canonical JSON: stable key order, no whitespace.
    expect(recordValue).toBe(
      `{"v":1,"spending":"${bytesToHex(keys.spending)}","viewing":"${bytesToHex(keys.viewing)}"}`,
    )
  })

  it('passes the SIP-STEALTH record key and uses payer for both owner and fee payer', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(1),
      viewing: new Uint8Array(32).fill(2),
    }

    await buildPublishTx(mockConnection, 'rector.sol', keys, payer)

    const callArgs = vi.mocked(createRecordInstruction).mock.calls.at(-1)!
    // Args: (connection, domain, record, data, owner, payer)
    expect(callArgs[0]).toBe(mockConnection)
    expect(callArgs[2]).toBe('SIP-STEALTH')
    // Owner and payer default to the same caller — self-publish flow.
    expect((callArgs[4] as PublicKey).toBase58()).toBe(payer.toBase58())
    expect((callArgs[5] as PublicKey).toBase58()).toBe(payer.toBase58())
  })

  it('rejects non-32-byte spending key', async () => {
    const keys = {
      spending: new Uint8Array(20),
      viewing: new Uint8Array(32),
    }
    await expect(buildPublishTx(mockConnection, 'rector.sol', keys, payer))
      .rejects.toThrow(/spending key must be 32 bytes/i)
    expect(createRecordInstruction).not.toHaveBeenCalled()
  })

  it('rejects non-32-byte viewing key', async () => {
    const keys = {
      spending: new Uint8Array(32),
      viewing: new Uint8Array(33),
    }
    await expect(buildPublishTx(mockConnection, 'rector.sol', keys, payer))
      .rejects.toThrow(/viewing key must be 32 bytes/i)
    expect(createRecordInstruction).not.toHaveBeenCalled()
  })
})
