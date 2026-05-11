import type { Connection, PublicKey } from '@solana/web3.js'
import { Transaction } from '@solana/web3.js'
import { createRecordInstruction } from '@bonfida/spl-name-service'
import { bytesToHex } from '@noble/hashes/utils'
import { normalizeDomain } from './derive'
import { encodeRecord } from './schema'

// SNS record key for SIP stealth metadata. Mirrors `resolve.ts`: cast bypasses
// Bonfida's closed `Record` enum because at runtime the SDK passes this string
// through to `getDomainKeySync` which composes it as a subdomain
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
 * @param connection Solana RPC connection (used for rent-exemption lookup + blockhash)
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

  // V1 createRecordInstruction signature:
  //   (connection, domain, record, data, owner, payer) => Promise<TransactionInstruction>
  // For the self-publish flow `owner === payer` (the user writing to their own
  // domain). If we ever need separate signers (e.g., relayer pays gas for a
  // hardware wallet owner), expose `owner` as a distinct parameter — but until
  // then collapsing them keeps the API simple and matches the common case.
  const ix = await createRecordInstruction(
    connection,
    normalized,
    SIP_STEALTH_RECORD,
    recordValue,
    payer,
    payer,
  )

  const tx = new Transaction()
  tx.add(ix)
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer
  return tx
}
