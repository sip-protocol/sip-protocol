// Run the one-time migrate_config on devnet to grow the live VaultConfig
// (CpL4qy…) from the legacy 68-byte layout to the current 101-byte layout.
// Idempotent — safe to re-run (no-op once the config is already 101 bytes).
//
//   ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   pnpm exec tsx scripts/migrate-config-devnet.ts

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const VAULT_CONFIG_SEED = Buffer.from('vault_config')

// Anchor instruction discriminator: sha256("global:<name>")[..8]
function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const url = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const walletPath = (
    process.env.ANCHOR_WALLET ?? '~/Documents/secret/solana-devnet.json'
  ).replace(/^~/, os.homedir())
  const authority = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))),
  )
  const connection = new Connection(url, 'confirmed')
  const [configPda] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

  const before = await connection.getAccountInfo(configPda)
  console.log('config before:', configPda.toBase58(), 'len=', before?.data.length)
  if (before?.data.length === 101) {
    console.log('already migrated (101 bytes) — nothing to do')
    return
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('migrate_config'),
  })

  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [authority], {
    commitment: 'confirmed',
  })
  console.log('migrate_config TX:', sig)

  const after = await connection.getAccountInfo(configPda)
  console.log('config after: len=', after?.data.length, '(expected 101)')
  if (after?.data.length !== 101) throw new Error('migration did not reach 101 bytes')
  console.log('OK — VaultConfig migrated 68 → 101')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
