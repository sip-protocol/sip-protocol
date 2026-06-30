// programs/sipher-vault/scripts/update-fee.ts
//
// Set the protocol fee on the sipher_vault config PDA, in tenths-of-a-bps
// (75 = 7.5 bps, 100 = 10 bps). Authority-only — the signing keypair must
// equal config.authority. Capped at MAX_FEE_TENTHS_BPS (1000 = 1%).
//
// Usage: cd programs/sipher-vault && pnpm exec tsx scripts/update-fee.ts <fee_tenths_bps>
//   e.g. scripts/update-fee.ts 75   # 7.5 bps
//
// Network and authority are env-driven:
//   ANCHOR_PROVIDER_URL  — RPC endpoint (default: https://api.devnet.solana.com)
//   ANCHOR_WALLET        — path to authority keypair JSON (REQUIRED — no default)
//
// Re-reads fee_tenths_bps from the config PDA after the TX so the operator sees
// the confirmed on-chain value, not just transaction success. Run back-to-back
// with upgrade-devnet.ts to close the fee re-precision "semantic-reset window"
// in a single command (no hand-assembled Borsh).
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
const MAX_FEE_TENTHS_BPS = 1000 // mirrors the on-chain constant (1% cap)

function discriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const arg = process.argv[2]
  const fee = Number(arg)
  if (!arg || !Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_TENTHS_BPS) {
    console.error(
      `Usage: tsx scripts/update-fee.ts <fee_tenths_bps>  (integer 0..${MAX_FEE_TENTHS_BPS}; 75 = 7.5 bps)`,
    )
    process.exit(1)
  }

  const rpc = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const walletPath = process.env.ANCHOR_WALLET
  if (!walletPath) {
    console.error('ANCHOR_WALLET env var required (path to authority keypair JSON)')
    process.exit(1)
  }

  const connection = new Connection(rpc, 'confirmed')
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8'))),
  )
  const [configPDA] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

  console.log('Network:    ', rpc)
  console.log('Authority:  ', authority.publicKey.toString())
  console.log('Config PDA: ', configPDA.toString())
  console.log('Target:     fee_tenths_bps =', fee, '(=', fee / 10, 'bps)')

  // Build update_fee instruction: discriminator + new_fee_tenths_bps(u16 LE)
  const data = Buffer.alloc(8 + 2)
  discriminator('update_fee').copy(data, 0)
  data.writeUInt16LE(fee, 8)

  // Account order matches sipher_vault::UpdateFee struct exactly:
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
  //   8 disc + 32 authority + 2 fee_tenths_bps + ...  → fee at offset 40.
  const account = await connection.getAccountInfo(configPDA)
  if (!account) throw new Error('Config PDA missing post-tx')
  const observed = account.data.readUInt16LE(40)
  console.log('Observed fee_tenths_bps =', observed, '(=', observed / 10, 'bps)')
  if (observed !== fee) {
    console.error('Mismatch! Expected', fee, 'got', observed)
    process.exit(1)
  }
  console.log('OK — fee confirmed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
