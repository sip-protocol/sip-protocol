import type { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import { Transaction } from '@solana/web3.js'
import {
  createRecordInstruction,
  updateInstruction,
  deleteInstruction,
  getRecordKeySync,
  serializeRecord,
  NAME_PROGRAM_ID,
  Numberu32,
  NameRegistryState,
} from '@bonfida/spl-name-service'
import { bytesToHex } from '@noble/hashes/utils'
import { normalizeDomain } from './derive'
import { encodeRecord } from './schema'

// SNS record key for SIP stealth metadata. Mirrors `resolve.ts`: cast bypasses
// Bonfida's closed `Record` enum because at runtime the SDK passes this string
// through to `getRecordKeySync` which composes it as a subdomain
// `<RECORD>.<DOMAIN>`, so arbitrary strings work.
const SIP_STEALTH_RECORD = 'SIP-STEALTH' as never

// Ed25519 public keys are always 32 bytes — same shape we publish in the
// record's `spending`/`viewing` fields.
const ED25519_PUBKEY_BYTES = 32

export interface PublishKeys {
  spending: Uint8Array  // 32-byte ed25519 pubkey
  viewing: Uint8Array   // 32-byte ed25519 pubkey
}

/**
 * Build an unsigned Solana transaction that writes the caller's stealth meta-address
 * to the SIP-STEALTH record on their `.sol` domain. The caller signs and sends
 * via their wallet (the function deliberately stays signing-free so it works
 * across hot/cold/hardware wallets and meta-tx relayers).
 *
 * Uses V1 records (mirrors the reader in `resolve.ts` which calls `getRecord`).
 * V2 would require switching both reader and writer in lockstep — out of scope
 * for the foundation milestone.
 *
 * Three on-chain paths, mirroring Bonfida's own `updateRecordInstruction` flow:
 *   • account missing      → allocate (create) + write (update)
 *   • account size matches → write only (update)
 *   • account size differs → free (delete) + reallocate (create) + write (update)
 *
 * `createRecordInstruction` ONLY allocates the record account; it never writes
 * the record value. Without a follow-up `updateInstruction` the published
 * record is `data.length` bytes of zeros — that was the v0.1.0 bug.
 *
 * @param connection Solana RPC connection (used for account lookup, rent, blockhash)
 * @param domain     The `.sol` domain (case-insensitive; normalized internally)
 * @param keys       The 32-byte ed25519 spending/viewing public keys to publish
 * @param payer      The domain owner / fee payer (single wallet for self-publish flow)
 */
export async function buildPublishTx(
  connection: Connection,
  domain: string,
  keys: PublishKeys,
  payer: PublicKey,
): Promise<Transaction> {
  if (keys.spending.length !== ED25519_PUBKEY_BYTES) {
    throw new Error(
      `Spending key must be 32 bytes (got ${keys.spending.length})`,
    )
  }
  if (keys.viewing.length !== ED25519_PUBKEY_BYTES) {
    throw new Error(
      `Viewing key must be 32 bytes (got ${keys.viewing.length})`,
    )
  }

  const normalized = normalizeDomain(domain)
  const recordValue = encodeRecord({
    v: 1,
    spending: bytesToHex(keys.spending),
    viewing: bytesToHex(keys.viewing),
  })

  const recordKey = getRecordKeySync(normalized, SIP_STEALTH_RECORD)
  const data = serializeRecord(recordValue, SIP_STEALTH_RECORD)
  const existing = await connection.getAccountInfo(recordKey)

  const ixs: TransactionInstruction[] = []

  if (existing === null) {
    // Fresh: allocate the account at the right size, then write the value.
    ixs.push(await buildCreateIx(connection, normalized, recordValue, payer))
    ixs.push(buildUpdateIx(recordKey, data, payer))
  } else if (
    existing.data.slice(NameRegistryState.HEADER_LEN).length === data.length
  ) {
    // Existing account, matching data area size — just overwrite.
    ixs.push(buildUpdateIx(recordKey, data, payer))
  } else {
    // Existing account, mismatched size — free + reallocate + write. Bonfida's
    // `updateInstruction` rejects writes when the new payload doesn't fit the
    // allocated space, so a stale account from a different schema version
    // would otherwise wedge the domain.
    ixs.push(deleteInstruction(NAME_PROGRAM_ID, recordKey, payer, payer))
    ixs.push(await buildCreateIx(connection, normalized, recordValue, payer))
    ixs.push(buildUpdateIx(recordKey, data, payer))
  }

  const tx = new Transaction()
  tx.add(...ixs)
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer
  return tx
}

// `createRecordInstruction` signature: (connection, domain, record, value, owner, payer).
// Self-publish flow collapses owner === payer; if a relayer-paid flow is ever
// needed, expose `owner` as a distinct parameter on `buildPublishTx`.
function buildCreateIx(
  connection: Connection,
  normalizedDomain: string,
  recordValue: string,
  payer: PublicKey,
): Promise<TransactionInstruction> {
  return createRecordInstruction(
    connection,
    normalizedDomain,
    SIP_STEALTH_RECORD,
    recordValue,
    payer,
    payer,
  )
}

function buildUpdateIx(
  recordKey: PublicKey,
  data: Buffer,
  payer: PublicKey,
): TransactionInstruction {
  return updateInstruction(
    NAME_PROGRAM_ID,
    recordKey,
    new Numberu32(0),
    data,
    payer,
  )
}
