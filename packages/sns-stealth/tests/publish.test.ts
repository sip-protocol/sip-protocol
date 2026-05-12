import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  Connection,
  PublicKey,
  Transaction,
  type AccountInfo,
} from '@solana/web3.js'
import {
  getRecordKeySync,
  serializeRecord,
  NAME_PROGRAM_ID,
  NameRegistryState,
} from '@bonfida/spl-name-service'
import { bytesToHex } from '@noble/hashes/utils'
import { buildPublishTx } from '../src/publish'

// Tests use the REAL Bonfida API surface and only mock the `Connection` RPC
// methods. This catches wire-format regressions (e.g. the v0.1.0 bug where
// `buildPublishTx` emitted a single `createInstruction` and silently published
// 162 bytes of zeros) by decoding the resulting Transaction's instruction
// bytes — Bonfida's instruction discriminators are stable and documented:
//   0 = create, 1 = update, 3 = delete (see `instructions/*Instruction.js`).

const SIP_STEALTH_RECORD = 'SIP-STEALTH' as never

const PAYER = new PublicKey('11111111111111111111111111111111')
const MOCK_BLOCKHASH = 'EkSnNWid2cYwsbqzdGyaDkjyAa3pYBtjwjsJqDxN1RfV'

const SPENDING_BYTES = new Uint8Array(32).fill(0xaa)
const VIEWING_BYTES = new Uint8Array(32).fill(0xbb)
const KEYS = { spending: SPENDING_BYTES, viewing: VIEWING_BYTES }

const EXPECTED_RECORD_JSON =
  `{"v":1,"spending":"${bytesToHex(SPENDING_BYTES)}","viewing":"${bytesToHex(VIEWING_BYTES)}"}`
const EXPECTED_DATA_BYTES = serializeRecord(
  EXPECTED_RECORD_JSON,
  SIP_STEALTH_RECORD,
)

function mockConnection(opts: {
  account?: AccountInfo<Buffer> | null
} = {}): Connection {
  return {
    getAccountInfo: vi.fn().mockResolvedValue(opts.account ?? null),
    getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(1_000_000),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: MOCK_BLOCKHASH,
      lastValidBlockHeight: 100,
    }),
  } as unknown as Connection
}

function fakeRecordAccount(dataAreaLen: number): AccountInfo<Buffer> {
  return {
    data: Buffer.alloc(NameRegistryState.HEADER_LEN + dataAreaLen),
    executable: false,
    lamports: 1_000_000,
    owner: NAME_PROGRAM_ID,
    rentEpoch: 0,
  }
}

// Bonfida's update instruction body layout (from `updateInstruction.js`):
//   [u8 discriminator=1][u32 offset][u32 data_length][data...]
function decodeUpdateData(ixData: Buffer): Buffer {
  const discriminator = ixData[0]
  expect(discriminator).toBe(1)
  // Skip 1-byte discriminator + 4-byte offset + 4-byte length prefix.
  return ixData.subarray(1 + 4 + 4)
}

describe('buildPublishTx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fresh domain (no existing record account)', () => {
    it('builds a Transaction with the publisher as fee payer and a fresh blockhash', async () => {
      const conn = mockConnection({ account: null })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      expect(tx).toBeInstanceOf(Transaction)
      expect(tx.feePayer?.toBase58()).toBe(PAYER.toBase58())
      expect(tx.recentBlockhash).toBe(MOCK_BLOCKHASH)
    })

    it('emits BOTH a create (allocate) AND an update (write) instruction', async () => {
      // This is the v0.1.0 regression test: the bug was that only the create
      // instruction was emitted, leaving the record account allocated but
      // empty. Without the update instruction, `getRecord` returns undefined
      // and `resolveSIPStealth` returns NotFound('record').
      const conn = mockConnection({ account: null })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      expect(tx.instructions).toHaveLength(2)
      expect(tx.instructions[0]!.data[0]).toBe(0) // create discriminator
      expect(tx.instructions[1]!.data[0]).toBe(1) // update discriminator
    })

    it('writes the canonical JSON payload as the update instruction data', async () => {
      const conn = mockConnection({ account: null })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      const updateIx = tx.instructions[1]!
      expect(updateIx.programId.toBase58()).toBe(NAME_PROGRAM_ID.toBase58())

      const payload = decodeUpdateData(updateIx.data)
      expect(payload.equals(EXPECTED_DATA_BYTES)).toBe(true)
    })

    it('targets the SIP-STEALTH record account derived from the normalized domain', async () => {
      const conn = mockConnection({ account: null })

      const tx = await buildPublishTx(conn, 'RECTOR.SOL', KEYS, PAYER)

      // Normalized domain → 'rector.sol'.
      const expectedRecordKey = getRecordKeySync('rector.sol', SIP_STEALTH_RECORD)
      const updateIx = tx.instructions[1]!
      expect(updateIx.keys[0]!.pubkey.toBase58()).toBe(
        expectedRecordKey.toBase58(),
      )
      expect(updateIx.keys[0]!.isWritable).toBe(true)
    })

    it('uses the payer as both update signer and create owner/payer', async () => {
      const conn = mockConnection({ account: null })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      // Update ix: account 1 is the signer (== payer for self-publish).
      const updateIx = tx.instructions[1]!
      expect(updateIx.keys[1]!.pubkey.toBase58()).toBe(PAYER.toBase58())
      expect(updateIx.keys[1]!.isSigner).toBe(true)
    })
  })

  describe('existing record account with matching data length', () => {
    it('emits ONLY an update instruction (no create — account already allocated)', async () => {
      // The current v=1 schema always serializes to 162 bytes, so this is the
      // path that lands when re-publishing on a domain whose previous publish
      // was the v0.1.0 bug (allocated 162 bytes of zeros).
      const conn = mockConnection({
        account: fakeRecordAccount(EXPECTED_DATA_BYTES.length),
      })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      expect(tx.instructions).toHaveLength(1)
      expect(tx.instructions[0]!.data[0]).toBe(1) // update discriminator
      const payload = decodeUpdateData(tx.instructions[0]!.data)
      expect(payload.equals(EXPECTED_DATA_BYTES)).toBe(true)
    })
  })

  describe('existing record account with mismatched data length', () => {
    it('emits delete + create + update to rebuild the account at the right size', async () => {
      // Defensive: if the schema ever evolves (e.g., v=2 with extra fields)
      // and a stale v=1 account is encountered, we free + recreate it instead
      // of silently failing on a too-small write.
      const conn = mockConnection({
        account: fakeRecordAccount(EXPECTED_DATA_BYTES.length + 64),
      })

      const tx = await buildPublishTx(conn, 'rector.sol', KEYS, PAYER)

      expect(tx.instructions).toHaveLength(3)
      expect(tx.instructions[0]!.data[0]).toBe(3) // delete discriminator
      expect(tx.instructions[1]!.data[0]).toBe(0) // create discriminator
      expect(tx.instructions[2]!.data[0]).toBe(1) // update discriminator
    })
  })

  describe('input validation', () => {
    it('rejects non-32-byte spending key without touching the connection', async () => {
      const conn = mockConnection({ account: null })

      await expect(
        buildPublishTx(
          conn,
          'rector.sol',
          { spending: new Uint8Array(20), viewing: new Uint8Array(32) },
          PAYER,
        ),
      ).rejects.toThrow(/spending key must be 32 bytes/i)

      expect(conn.getAccountInfo).not.toHaveBeenCalled()
      expect(conn.getLatestBlockhash).not.toHaveBeenCalled()
    })

    it('rejects non-32-byte viewing key without touching the connection', async () => {
      const conn = mockConnection({ account: null })

      await expect(
        buildPublishTx(
          conn,
          'rector.sol',
          { spending: new Uint8Array(32), viewing: new Uint8Array(33) },
          PAYER,
        ),
      ).rejects.toThrow(/viewing key must be 32 bytes/i)

      expect(conn.getAccountInfo).not.toHaveBeenCalled()
      expect(conn.getLatestBlockhash).not.toHaveBeenCalled()
    })
  })
})
