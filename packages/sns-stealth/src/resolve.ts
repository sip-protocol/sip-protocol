import type { Connection } from '@solana/web3.js'
import {
  getRecord,
  getDomainKeySync,
  NameRegistryState,
  AccountDoesNotExistError,
  NoRecordDataError,
} from '@bonfida/spl-name-service'
import { TTLCache } from './cache'
import { parseRecord } from './schema'
import { normalizeDomain } from './derive'
import { NotFound, Malformed, NetworkError } from './errors'

// Per spec: 60-second TTL per domain. Tunable during integration testing.
const CACHE_TTL_MS = 60_000

// SNS record key for SIP stealth metadata. Matches the chain-record convention
// (uppercase, hyphen separator). Cast bypasses Bonfida's closed `Record` enum:
// at runtime the SDK passes this string through to `getRecordKeySync` which
// composes it as a subdomain `RECORD.DOMAIN`, so arbitrary strings work.
const SIP_STEALTH_RECORD = 'SIP-STEALTH' as never

export class MetaAddress {
  constructor(
    public readonly spending: Uint8Array,
    public readonly viewing: Uint8Array,
    public readonly chain: 'solana',
    public readonly domain: string,
  ) {}
}

export type ResolveResult = MetaAddress | NotFound | Malformed

const cache = new TTLCache<ResolveResult>(CACHE_TTL_MS)

export async function resolveSIPStealth(
  connection: Connection,
  domain: string,
): Promise<ResolveResult> {
  const normalized = normalizeDomain(domain)

  const cached = cache.get(normalized)
  if (cached !== undefined) return cached

  // Step 1: confirm the domain itself exists. Bonfida's `getRecord` derives a
  // subdomain key for the record PDA; if either the parent domain OR the
  // record is missing, it throws `AccountDoesNotExistError` with the same
  // shape. We probe the parent domain first to disambiguate NotFound('domain')
  // vs NotFound('record') — the spec requires distinct UX for each.
  try {
    const { pubkey } = getDomainKeySync(normalized)
    await NameRegistryState.retrieve(connection, pubkey)
  } catch (e) {
    if (e instanceof AccountDoesNotExistError) {
      const result = new NotFound('domain')
      cache.set(normalized, result)
      return result
    }
    throw new NetworkError(
      `SNS domain lookup failed: ${(e as Error).message ?? 'unknown error'}`,
      e,
    )
  }

  // Step 2: fetch the SIP-STEALTH record. `deserialize: true` returns the
  // record content as a UTF-8 string directly.
  let raw: string | undefined
  try {
    raw = await getRecord(connection, normalized, SIP_STEALTH_RECORD, true)
  } catch (e) {
    if (
      e instanceof AccountDoesNotExistError ||
      e instanceof NoRecordDataError
    ) {
      const result = new NotFound('record')
      cache.set(normalized, result)
      return result
    }
    throw new NetworkError(
      `SNS record lookup failed: ${(e as Error).message ?? 'unknown error'}`,
      e,
    )
  }

  if (raw === undefined) {
    const result = new NotFound('record')
    cache.set(normalized, result)
    return result
  }

  const parsed = parseRecord(raw)
  if (!parsed.ok) {
    const result = new Malformed(parsed.reason, parsed.error)
    cache.set(normalized, result)
    return result
  }

  const meta = new MetaAddress(
    hexToBytes(parsed.data.spending),
    hexToBytes(parsed.data.viewing),
    'solana',
    normalized,
  )
  cache.set(normalized, meta)
  return meta
}

export function invalidateCache(domain?: string): void {
  if (domain === undefined) {
    cache.clear()
    return
  }
  cache.invalidate(normalizeDomain(domain))
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}
