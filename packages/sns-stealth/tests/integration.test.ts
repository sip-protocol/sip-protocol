import { describe, it, expect, beforeAll } from 'vitest'
import { Connection, Keypair, sendAndConfirmTransaction } from '@solana/web3.js'
import { ed25519 } from '@noble/curves/ed25519'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  MetaAddress,
  invalidateCache,
} from '../src/index'

// Devnet round-trip integration test.
//
// Opt-in: requires BOTH the shared devnet keypair on disk AND an explicit
// `SIP_TEST_DOMAIN` env var pointing at a `.sol` already owned by that wallet.
// We don't ship a default domain because Bonfida's create instruction errors
// out with "given name account is incorrect" when the parent doesn't exist —
// that surfaces as a confusing failure for anyone who has the keypair but
// never provisioned the domain.
//
// Skips automatically when:
//   - The shared devnet keypair is not on disk (CI / contributors without it)
//   - `SIP_TEST_DOMAIN` is not set (operator hasn't provisioned a domain)
//   - `SIP_SKIP_INTEGRATION=1` is set (local opt-out for fast iteration)
//
// When it runs, it exercises the full public API surface — derive → publish →
// resolve — against the real .sol. We do NOT try to register the domain here;
// that's a one-time setup the operator handles via Bonfida's devnet UI.

const RPC = process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const TEST_DOMAIN = process.env.SIP_TEST_DOMAIN
const KEYPAIR_PATH = `${homedir()}/Documents/secret/solana-devnet.json`

const skipReason = (): string | false => {
  if (!existsSync(KEYPAIR_PATH)) return 'no devnet keypair'
  if (!TEST_DOMAIN) return 'SIP_TEST_DOMAIN not set'
  if (process.env.SIP_SKIP_INTEGRATION === '1') return 'SIP_SKIP_INTEGRATION=1'
  return false
}

describe.skipIf(skipReason() !== false)('integration: devnet round-trip', () => {
  let connection: Connection
  let payer: Keypair

  beforeAll(() => {
    connection = new Connection(RPC, 'confirmed')
    const secret = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'))
    payer = Keypair.fromSecretKey(new Uint8Array(secret))
  })

  it('publishes and resolves a SIP-STEALTH record', async () => {
    // Solana `Keypair.secretKey` is the 64-byte expanded form (seed || pubkey).
    // `@noble/curves` `ed25519.sign` expects the 32-byte seed, so we slice.
    const seed = payer.secretKey.slice(0, 32)
    const signer = {
      signMessage: async (msg: Uint8Array): Promise<Uint8Array> =>
        ed25519.sign(msg, seed),
    }

    const keys = await deriveStealthKeys(signer, TEST_DOMAIN)

    const tx = await buildPublishTx(
      connection,
      TEST_DOMAIN,
      { spending: keys.spending, viewing: keys.viewing },
      payer.publicKey,
    )

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])
    expect(sig).toBeTruthy()

    // Bypass the 60s TTL cache so we read fresh state after publishing.
    invalidateCache(TEST_DOMAIN)
    const result = await resolveSIPStealth(connection, TEST_DOMAIN)

    expect(result).toBeInstanceOf(MetaAddress)
    if (result instanceof MetaAddress) {
      expect(Buffer.from(result.spending).equals(Buffer.from(keys.spending))).toBe(true)
      expect(Buffer.from(result.viewing).equals(Buffer.from(keys.viewing))).toBe(true)
      expect(result.chain).toBe('solana')
      expect(result.domain).toBe(TEST_DOMAIN.toLowerCase())
    }
  }, 60_000)
})
