// programs/sipher-vault/scripts/create-sol-vault.ts
//
// Initialises the native-SOL vault PDAs (SolVault + SolFee) on devnet.
//
// PREREQUISITES:
//   1. The universal-asset binary MUST be redeployed first:
//      `ANCHOR_WALLET=~/Documents/secret/solana-devnet.json pnpm exec tsx scripts/upgrade-devnet.ts`
//   2. The vault config must already be initialised (scripts/init-devnet.ts).
//
// Usage: cd programs/sipher-vault && pnpm exec tsx scripts/create-sol-vault.ts
//
// Accounts:
//   config      vault_config PDA   [seeds: b"vault_config"]     (read-only)
//   sol_vault   SolVault PDA       [seeds: b"vault_sol"]        (init)
//   sol_fee     SolFee PDA         [seeds: b"fee_sol"]          (init)
//   payer       devnet wallet      (signer, mut)
//   system_program
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { createHash } from 'crypto'

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const VAULT_CONFIG_SEED = Buffer.from('vault_config')
const VAULT_SOL_SEED = Buffer.from('vault_sol')
const FEE_SOL_SEED = Buffer.from('fee_sol')

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const conn = new Connection(rpc, 'confirmed')

  // Guard: refuse to run on mainnet-beta. This is a devnet-only initializer; the
  // SOL vault PDAs on mainnet must be created through the gated mainnet deploy
  // (self-audit → mainnet), never via this helper. A stray ANCHOR_PROVIDER_URL
  // must not be able to initialize the singletons on the wrong cluster.
  const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
  const genesisHash = await conn.getGenesisHash()
  if (genesisHash === MAINNET_GENESIS) {
    console.error('ERROR: refusing to run against mainnet-beta — this initializer is devnet-only')
    process.exit(1)
  }

  const walletPath = process.env.ANCHOR_WALLET ?? `${homedir()}/Documents/secret/solana-devnet.json`
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')))
  )

  const [configPda] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)
  const [solVaultPda] = PublicKey.findProgramAddressSync([VAULT_SOL_SEED], PROGRAM_ID)
  const [solFeePda] = PublicKey.findProgramAddressSync([FEE_SOL_SEED], PROGRAM_ID)

  console.log('Program ID:   ', PROGRAM_ID.toString())
  console.log('Config PDA:   ', configPda.toString())
  console.log('SolVault PDA: ', solVaultPda.toString())
  console.log('SolFee PDA:   ', solFeePda.toString())
  console.log('Payer:        ', payer.publicKey.toString())

  // Guard: vault config must exist — deployer must have run init-devnet.ts first
  const configInfo = await conn.getAccountInfo(configPda)
  if (!configInfo) {
    console.error('ERROR: vault_config PDA not found — run scripts/init-devnet.ts first')
    process.exit(1)
  }
  console.log('vault_config OK (size', configInfo.data.length, 'bytes)')

  // Guard: idempotent — skip if already initialised
  const existingVault = await conn.getAccountInfo(solVaultPda)
  if (existingVault) {
    console.log('SolVault already initialised (size', existingVault.data.length, 'bytes) — nothing to do')
    const existingFee = await conn.getAccountInfo(solFeePda)
    if (existingFee) {
      console.log('SolFee already initialised (size', existingFee.data.length, 'bytes)')
    }
    return
  }

  // create_sol_vault takes no arguments — discriminator only
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPda,              isSigner: false, isWritable: false },
      { pubkey: solVaultPda,            isSigner: false, isWritable: true  },
      { pubkey: solFeePda,              isSigner: false, isWritable: true  },
      { pubkey: payer.publicKey,        isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('create_sol_vault'),
  })

  console.log('\nSending create_sol_vault...')
  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(conn, tx, [payer])
  console.log('TX:', sig)

  // Verify both PDAs were created
  const [vaultInfo, feeInfo] = await Promise.all([
    conn.getAccountInfo(solVaultPda),
    conn.getAccountInfo(solFeePda),
  ])

  if (!vaultInfo) {
    console.error('FAIL — SolVault PDA not created after TX')
    process.exit(1)
  }
  if (!feeInfo) {
    console.error('FAIL — SolFee PDA not created after TX')
    process.exit(1)
  }

  console.log('\nSolVault created. Size:', vaultInfo.data.length, 'bytes. Owner:', vaultInfo.owner.toString())
  console.log('SolFee  created. Size:', feeInfo.data.length,  'bytes. Owner:', feeInfo.owner.toString())

  if (!vaultInfo.owner.equals(PROGRAM_ID) || !feeInfo.owner.equals(PROGRAM_ID)) {
    console.error('FAIL — unexpected owner (expected program ID)')
    process.exit(1)
  }

  console.log('\nNative SOL vault initialised successfully.')
  console.log({
    tx: sig,
    solVaultPda: solVaultPda.toString(),
    solFeePda:   solFeePda.toString(),
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
