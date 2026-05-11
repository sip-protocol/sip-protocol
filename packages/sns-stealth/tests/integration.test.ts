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
// Skips automatically when:
//   - The shared devnet keypair is not on disk (CI / contributors without it)
//   - `SIP_SKIP_INTEGRATION=1` is set (local opt-out for fast iteration)
//
// When it runs, it exercises the full public API surface — derive → publish →
// resolve — against a real .sol domain. The test domain must already be
// provisioned (owned by the devnet wallet) on Bonfida's devnet UI; if not, the
// publish step will fail at `sendAndConfirmTransaction`. We do NOT try to
// register the domain here — that's a one-time setup the operator handles.

const RPC = process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const TEST_DOMAIN = process.env.SIP_TEST_DOMAIN ?? 'test.sipher.sol'
const KEYPAIR_PATH = `${homedir()}/Documents/secret/solana-devnet.json`

const skipReason = (): string | false => {
  if (!existsSync(KEYPAIR_PATH)) return 'no devnet keypair'
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
