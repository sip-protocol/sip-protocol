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

// VaultConfig account sizes (mirror the Rust program): the pre-M1 legacy layout
// and the current layout after `migrate_config` appends `pending_authority: None`.
const LEGACY_VAULT_CONFIG_LEN = 68
const NEW_VAULT_CONFIG_LEN = 101

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

  // Guard: refuse to run on mainnet-beta. `migrate_config` mutates a live config
  // account in place; on mainnet the layout migration must go through the gated
  // mainnet deploy (self-audit → mainnet), never this devnet helper. A stray
  // ANCHOR_PROVIDER_URL must not be able to realloc a production config.
  const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
  const genesisHash = await connection.getGenesisHash()
  if (genesisHash === MAINNET_GENESIS) {
    console.error('ERROR: refusing to run against mainnet-beta — migrate_config is devnet-only here')
    process.exit(1)
  }

  const [configPda] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

  const before = await connection.getAccountInfo(configPda)
  console.log('config before:', configPda.toBase58(), 'len=', before?.data.length)
  if (before?.data.length === NEW_VAULT_CONFIG_LEN) {
    console.log(`already migrated (${NEW_VAULT_CONFIG_LEN} bytes) — nothing to do`)
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
  console.log('config after: len=', after?.data.length, `(expected ${NEW_VAULT_CONFIG_LEN})`)
  if (after?.data.length !== NEW_VAULT_CONFIG_LEN) {
    throw new Error(`migration did not reach ${NEW_VAULT_CONFIG_LEN} bytes`)
  }
  console.log(`OK — VaultConfig migrated ${LEGACY_VAULT_CONFIG_LEN} → ${NEW_VAULT_CONFIG_LEN}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
