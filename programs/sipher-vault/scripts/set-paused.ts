// programs/sipher-vault/scripts/set-paused.ts
//
// Set or clear the paused flag on the sipher_vault config PDA.
// Authority-only — the signing keypair must equal config.authority.
//
// Usage: cd programs/sipher-vault && pnpm exec tsx scripts/set-paused.ts <true|false>
//
// Network and authority are env-driven:
//   ANCHOR_PROVIDER_URL  — RPC endpoint (default: https://api.devnet.solana.com)
//   ANCHOR_WALLET        — path to authority keypair JSON (REQUIRED — no default)
//
// Re-reads the paused byte from the config PDA after the TX so the
// operator sees confirmed state, not just transaction success. Emits
// VaultPausedEvent on-chain (subscribers can listen via program log).
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const VAULT_CONFIG_SEED = Buffer.from('vault_config')

function discriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const arg = process.argv[2]
  if (arg !== 'true' && arg !== 'false') {
    console.error('Usage: tsx scripts/set-paused.ts <true|false>')
    process.exit(1)
  }
  const targetPaused = arg === 'true'

  const rpc = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const walletPath = process.env.ANCHOR_WALLET
  if (!walletPath) {
    console.error('ANCHOR_WALLET env var required (path to authority keypair JSON)')
    process.exit(1)
  }

  const connection = new Connection(rpc, 'confirmed')
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')))
  )
  const [configPDA] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

  console.log('Network:    ', rpc)
  console.log('Authority:  ', authority.publicKey.toString())
  console.log('Config PDA: ', configPDA.toString())
  console.log('Target:     paused =', targetPaused)

  // Build set_paused instruction: discriminator + bool(u8)
  const data = Buffer.alloc(8 + 1)
  discriminator('set_paused').copy(data, 0)
  data.writeUInt8(targetPaused ? 1 : 0, 8)

  // Account order matches sipher_vault::SetPaused struct exactly:
  //   config (mut, has_one = authority), authority (Signer)
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [authority])
  console.log('TX:', sig)

  // Verify by re-reading the config PDA. Layout:
  //   8 disc + 32 authority + 2 fee_tenths_bps + 8 refund_timeout + 1 paused + ...
  // → paused byte at offset 50.
  const account = await connection.getAccountInfo(configPDA)
  if (!account) throw new Error('Config PDA missing post-tx')
  const observed = account.data[50] !== 0
  console.log('Observed paused =', observed)
  if (observed !== targetPaused) {
    console.error('Mismatch! Expected', targetPaused, 'got', observed)
    process.exit(1)
  }
  console.log('OK — pause state confirmed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
