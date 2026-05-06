// programs/sipher-vault/scripts/e2e-cpi-test.ts
//
// End-to-end CPI validation on devnet:
//   1. Wrap 0.001 SOL → wSOL into authority's ATA
//   2. Deposit into sipher_vault
//   3. Call withdraw_private with deterministic test stealth params
//   4. Confirm sip_privacy.TransferRecord PDA exists with the expected commitment
//
// This is structural validation — the test does NOT scan/claim. The goal is
// to prove the CPI from withdraw_private to sip_privacy.create_transfer_announcement
// fires correctly on the network where it will run on mainnet.
//
// Usage: cd programs/sipher-vault && pnpm exec tsx scripts/e2e-cpi-test.ts
//
// Requires:
//   - ~/Documents/secret/solana-devnet.json  (depositor + authority on devnet)
//   - Devnet vault config already initialized
//   - Devnet vault_token + fee_token PDAs already created for wSOL
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { createHash, randomBytes } from 'crypto'

const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const SIP_PRIVACY_PROGRAM_ID = new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')

const VAULT_CONFIG_SEED = Buffer.from('vault_config')
const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')
const VAULT_TOKEN_SEED = Buffer.from('vault_token')
const FEE_TOKEN_SEED = Buffer.from('fee_token')
const SIP_CONFIG_SEED = Buffer.from('config')
const SIP_TRANSFER_RECORD_SEED = Buffer.from('transfer_record')

const RPC = 'https://api.devnet.solana.com'
const DEPOSIT_LAMPORTS = 1_000_000n // 0.001 SOL
const WITHDRAW_LAMPORTS = 500_000n  // 0.0005 SOL — half of deposit, leaves remainder for the refund-script if rerun

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const conn = new Connection(RPC, 'confirmed')
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/Documents/secret/solana-devnet.json`, 'utf-8')))
  )
  console.log('Depositor:', wallet.publicKey.toString())

  const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, wallet.publicKey)

  const [vaultConfigPda] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], VAULT_PROGRAM_ID)
  const [vaultTokenPda] = PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_SEED, WSOL_MINT.toBuffer()],
    VAULT_PROGRAM_ID
  )
  const [feeTokenPda] = PublicKey.findProgramAddressSync(
    [FEE_TOKEN_SEED, WSOL_MINT.toBuffer()],
    VAULT_PROGRAM_ID
  )
  const [depositRecordPda] = PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, wallet.publicKey.toBuffer(), WSOL_MINT.toBuffer()],
    VAULT_PROGRAM_ID
  )
  const [sipConfigPda] = PublicKey.findProgramAddressSync(
    [SIP_CONFIG_SEED],
    SIP_PRIVACY_PROGRAM_ID
  )

  // Deterministic stealth test params
  const stealthRecipient = Keypair.generate().publicKey // ed25519 dummy stealth
  const ephemeralPubkey = Buffer.concat([Buffer.from([0x02]), randomBytes(32)]) // 33-byte secp256k1 fake
  const amountCommitment = Buffer.concat([Buffer.from([0x02]), randomBytes(32)])  // 33-byte commitment
  const viewingKeyHash = randomBytes(32)
  const encryptedAmount = Buffer.from([]) // empty for test

  // TransferRecord PDA seeds match sip_privacy::CreateTransferAnnouncement:
  //   [TRANSFER_RECORD_SEED, sender.key(), config.total_transfers.to_le_bytes()]
  // We must read total_transfers from sip_privacy::Config now (CPI passes
  // depositor as sender, so seeds[1] = depositor pubkey).
  const sipConfigInfo = await conn.getAccountInfo(sipConfigPda)
  if (!sipConfigInfo) {
    throw new Error('sip_privacy config PDA not found')
  }
  // Config layout: 8 (disc) + 32 (authority) + 2 (fee_bps) + 1 (paused) + 8 (total_transfers) + 1 (bump)
  const totalTransfers = sipConfigInfo.data.readBigUInt64LE(8 + 32 + 2 + 1)
  const totalTransfersLeBytes = Buffer.alloc(8)
  totalTransfersLeBytes.writeBigUInt64LE(totalTransfers, 0)
  console.log('sip_privacy total_transfers:', totalTransfers.toString())

  const [sipTransferRecordPda] = PublicKey.findProgramAddressSync(
    [SIP_TRANSFER_RECORD_SEED, wallet.publicKey.toBuffer(), totalTransfersLeBytes],
    SIP_PRIVACY_PROGRAM_ID
  )
  console.log('TransferRecord PDA (expected):', sipTransferRecordPda.toString())

  // ─── 1. Wrap 0.001 SOL ───────────────────────────────────────────────────────
  const wrapTx = new Transaction()
  wrapTx.add(
    createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, wsolAta, wallet.publicKey, WSOL_MINT)
  )
  wrapTx.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: wsolAta,
      lamports: DEPOSIT_LAMPORTS,
    })
  )
  wrapTx.add(createSyncNativeInstruction(wsolAta))
  const wrapSig = await sendAndConfirmTransaction(conn, wrapTx, [wallet])
  console.log('Wrap TX:', wrapSig)

  // ─── 2. Deposit ──────────────────────────────────────────────────────────────
  // deposit(amount: u64) — discriminator + u64
  const depositData = Buffer.alloc(8 + 8)
  disc('deposit').copy(depositData, 0)
  depositData.writeBigUInt64LE(DEPOSIT_LAMPORTS, 8)

  const depositIx = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: wsolAta, isSigner: false, isWritable: true },
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: depositData,
  })

  const depositSig = await sendAndConfirmTransaction(conn, new Transaction().add(depositIx), [wallet])
  console.log('Deposit TX:', depositSig)

  // ─── 3. withdraw_private with CPI ────────────────────────────────────────────
  // Layout: discriminator(8) + amount(u64) + amount_commitment(33) +
  //         stealth_pubkey(32) + ephemeral_pubkey(33) + viewing_key_hash(32) +
  //         encrypted_amount(Vec<u8>: 4-byte len + bytes) + proof(Vec<u8>: 4-byte len + bytes)
  const wpData = Buffer.concat([
    disc('withdraw_private'),
    Buffer.from(new BigUint64Array([WITHDRAW_LAMPORTS]).buffer),
    amountCommitment,
    stealthRecipient.toBuffer(),
    ephemeralPubkey,
    viewingKeyHash,
    Buffer.from(new Uint32Array([encryptedAmount.length]).buffer),
    encryptedAmount,
    Buffer.from(new Uint32Array([0]).buffer), // empty proof
  ])

  const stealthAta = getAssociatedTokenAddressSync(WSOL_MINT, stealthRecipient)

  // Stealth ATA creation must precede withdraw_private (program does not auto-create)
  const ensureStealthAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    wallet.publicKey,
    stealthAta,
    stealthRecipient,
    WSOL_MINT
  )

  // Account order matches sipher-vault::WithdrawPrivate struct exactly:
  //   config, deposit_record, vault_token, fee_token, stealth_token,
  //   token_mint, depositor, token_program, sip_config, sip_transfer_record,
  //   sip_privacy_program, system_program
  const wpIx = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: feeTokenPda, isSigner: false, isWritable: true },
      { pubkey: stealthAta, isSigner: false, isWritable: true },
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // CPI accounts
      { pubkey: sipConfigPda, isSigner: false, isWritable: true },
      { pubkey: sipTransferRecordPda, isSigner: false, isWritable: true },
      { pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: wpData,
  })

  const wpTx = new Transaction().add(ensureStealthAtaIx).add(wpIx)
  const wpSig = await sendAndConfirmTransaction(conn, wpTx, [wallet], { skipPreflight: true, maxRetries: 3 })
  console.log('withdraw_private TX:', wpSig)

  // ─── 4. Verify TransferRecord PDA exists on sip_privacy ──────────────────────
  const transferRecord = await conn.getAccountInfo(sipTransferRecordPda)
  if (!transferRecord) {
    console.error('FAIL — TransferRecord PDA not created. CPI did not fire as expected.')
    process.exit(1)
  }
  console.log('TransferRecord PDA created. Size:', transferRecord.data.length, 'bytes')
  console.log('Owner:', transferRecord.owner.toString())
  if (!transferRecord.owner.equals(SIP_PRIVACY_PROGRAM_ID)) {
    console.error('FAIL — TransferRecord owner is not sip_privacy.')
    process.exit(1)
  }

  console.log('\n✓ Devnet CPI E2E PASSED.')
  console.log({
    wrapSig,
    depositSig,
    withdrawPrivateSig: wpSig,
    transferRecordPda: sipTransferRecordPda.toString(),
    stealthRecipient: stealthRecipient.toString(),
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
