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

function getInstructionDiscriminator(name: string): Buffer {
  const hash = createHash('sha256').update(`global:${name}`).digest()
  return hash.subarray(0, 8)
}

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
  const keypairPath = `${homedir()}/Documents/secret/solana-devnet.json`
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'))
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData))

  const [configPDA, configBump] = PublicKey.findProgramAddressSync(
    [VAULT_CONFIG_SEED],
    PROGRAM_ID,
  )

  console.log('Program ID:', PROGRAM_ID.toString())
  console.log('Config PDA:', configPDA.toString())
  console.log('Authority:', authority.publicKey.toString())

  // Check if already initialized
  const existing = await connection.getAccountInfo(configPDA)
  if (existing) {
    console.log('Vault already initialized! Account size:', existing.data.length, 'bytes')
    console.log('Owner:', existing.owner.toString())
    return
  }

  // Build initialize instruction data
  // Discriminator + fee_bps(u16) + refund_timeout(i64)
  const discriminator = getInstructionDiscriminator('initialize')
  const data = Buffer.alloc(8 + 2 + 8) // discriminator + u16 + i64
  discriminator.copy(data, 0)
  data.writeUInt16LE(10, 8)          // fee_bps = 10
  data.writeBigInt64LE(86400n, 10)   // refund_timeout = 86400

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  console.log('Initializing vault (10bps fee, 86400s timeout)...')
  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [authority])
  console.log('TX:', sig)

  // Verify
  const account = await connection.getAccountInfo(configPDA)
  if (account) {
    console.log('Vault initialized! Account size:', account.data.length, 'bytes')
    // Parse: 8 discriminator + 32 authority + 2 fee_bps + 8 timeout + 1 paused + 8 deposits + 8 depositors + 1 bump
    const d = account.data
    const authKey = new PublicKey(d.subarray(8, 40))
    const feeBps = d.readUInt16LE(40)
    const timeout = Number(d.readBigInt64LE(42))
    const paused = d[50] !== 0
    console.log('  Authority:', authKey.toString())
    console.log('  Fee:', feeBps, 'bps')
    console.log('  Timeout:', timeout, 's')
    console.log('  Paused:', paused)
  }
}

main().catch(console.error)
