// tests/sipher-vault/bankrun-helpers.ts
//
// IDL-free bankrun harness for sipher-vault tests.
// All instruction encoding is manual (8-byte Anchor discriminator + Borsh args).
// Account orders match the #[derive(Accounts)] structs in lib.rs verbatim.
//
// Consumed by Task-1 baseline and all downstream tasks in the universal-asset plan.

import { createHash } from 'crypto'
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  AccountMeta,
  SystemProgram,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { startAnchor, ProgramTestContext } from 'solana-bankrun'
import {
  SIP_PRIVACY_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
  SIP_CONFIG_SEED,
  SIP_TRANSFER_RECORD_SEED,
  getVaultConfigPDA,
  getDepositRecordPDA,
  getVaultTokenPDA,
  getFeeTokenPDA,
  getSipConfigPDA,
  getSipTransferRecordPDA,
  getSolVaultPDA,
  getSolFeePDA,
} from './setup'

// ─────────────────────────────────────────────────────────────────────────────
// Program ID
// ─────────────────────────────────────────────────────────────────────────────

export const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')

/**
 * Sentinel mint pubkey for native SOL deposits — all-zero (PublicKey.default()).
 * Used as the token_mint in DepositRecord and deposit_record PDA derivation
 * for native SOL. Exported for all test suites in the native-SOL track.
 */
export const NATIVE_SOL_MINT = new PublicKey(new Uint8Array(32))

// ─────────────────────────────────────────────────────────────────────────────
// Core utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Anchor instruction discriminator: sha256("global:<name>")[..8] */
export function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

/** Encode a u64 as 8-byte little-endian buffer (Borsh u64). */
export function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(n)
  return b
}

/** Encode a u16 as 2-byte little-endian buffer (Borsh u16). */
export function u16le(n: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

/** Encode an i64 as 8-byte little-endian buffer (Borsh i64). */
export function i64le(n: bigint): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigInt64LE(n)
  return b
}

// ─────────────────────────────────────────────────────────────────────────────
// Test context lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spin up bankrun with sipher_vault (from Anchor workspace target/) and
 * sip_privacy (from tests/fixtures/sip_privacy.so, resolved by name).
 *
 * The Anchor workspace root is '.', which startAnchor resolves relative to
 * the cwd at runtime (programs/sipher-vault when running with ts-mocha from
 * the Anchor project root).
 */
export async function startVault(): Promise<ProgramTestContext> {
  return startAnchor(
    '.',
    [{ name: 'sip_privacy', programId: SIP_PRIVACY_PROGRAM_ID }],
    [],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send one or more instructions as a single transaction.
 * The first signer pays fees. Blockhash is taken from ctx.lastBlockhash.
 */
export async function sendIx(
  ctx: ProgramTestContext,
  ixs: TransactionInstruction[],
  signers: Keypair[],
): Promise<void> {
  const tx = new Transaction()
  tx.recentBlockhash = ctx.lastBlockhash
  tx.feePayer = signers[0].publicKey
  ixs.forEach((ix) => tx.add(ix))
  tx.sign(...signers)
  await ctx.banksClient.processTransaction(tx)
}

// ─────────────────────────────────────────────────────────────────────────────
// Account data helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch raw account bytes. Throws if the account does not exist.
 * All callers should catch and rethrow with context.
 */
export async function getAccountData(ctx: ProgramTestContext, pk: PublicKey): Promise<Buffer> {
  const acct = await ctx.banksClient.getAccount(pk)
  if (!acct) throw new Error(`account ${pk.toBase58()} not found`)
  return Buffer.from(acct.data)
}

// ─────────────────────────────────────────────────────────────────────────────
// Account parsers (byte-offset, Anchor disc prefix = 8 bytes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a DepositRecord account.
 *
 * Layout (post-discriminator):
 *   depositor:         Pubkey  (32)
 *   token_mint:        Pubkey  (32)
 *   balance:           u64     (8)
 *   locked_amount:     u64     (8)
 *   cumulative_volume: u64     (8)
 *   last_deposit_at:   i64     (8)
 *   bump:              u8      (1)
 */
export function parseDepositRecord(d: Buffer): {
  depositor: PublicKey
  tokenMint: PublicKey
  balance: bigint
  lockedAmount: bigint
  cumulativeVolume: bigint
  lastDepositAt: bigint
  bump: number
} {
  let o = 8 // skip 8-byte Anchor discriminator
  const depositor = new PublicKey(d.subarray(o, o += 32))
  const tokenMint = new PublicKey(d.subarray(o, o += 32))
  const balance = d.readBigUInt64LE(o); o += 8
  const lockedAmount = d.readBigUInt64LE(o); o += 8
  const cumulativeVolume = d.readBigUInt64LE(o); o += 8
  const lastDepositAt = d.readBigInt64LE(o); o += 8
  const bump = d.readUInt8(o)
  return { depositor, tokenMint, balance, lockedAmount, cumulativeVolume, lastDepositAt, bump }
}

/**
 * Parse a VaultConfig account.
 *
 * Layout (post-discriminator):
 *   authority:         Pubkey  (32)
 *   fee_bps:           u16     (2)
 *   refund_timeout:    i64     (8)
 *   paused:            bool    (1)
 *   total_deposits:    u64     (8)
 *   total_depositors:  u64     (8)
 *   bump:              u8      (1)
 */
export function parseVaultConfig(d: Buffer): {
  authority: PublicKey
  feeBps: number
  refundTimeout: bigint
  paused: boolean
  totalDeposits: bigint
  totalDepositors: bigint
  bump: number
} {
  let o = 8 // skip 8-byte Anchor discriminator
  const authority = new PublicKey(d.subarray(o, o += 32))
  const feeBps = d.readUInt16LE(o); o += 2
  const refundTimeout = d.readBigInt64LE(o); o += 8
  const paused = d.readUInt8(o) !== 0; o += 1
  const totalDeposits = d.readBigUInt64LE(o); o += 8
  const totalDepositors = d.readBigUInt64LE(o); o += 8
  const bump = d.readUInt8(o)
  return { authority, feeBps, refundTimeout, paused, totalDeposits, totalDepositors, bump }
}

/**
 * Parse the sip_privacy Config account to get total_transfers.
 *
 * sip_privacy Config layout (post-discriminator):
 *   authority:       Pubkey  (32)
 *   fee_bps:         u16     (2)
 *   paused:          bool    (1)
 *   total_transfers: u64     (8)
 *   bump:            u8      (1)
 */
export function parseSipConfig(d: Buffer): { totalTransfers: bigint } {
  let o = 8 // skip discriminator
  o += 32 // authority
  o += 2  // fee_bps
  o += 1  // paused
  const totalTransfers = d.readBigUInt64LE(o)
  return { totalTransfers }
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction builders — account orders copied verbatim from lib.rs contexts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initialize(fee_bps: u16, refund_timeout: i64)
 *
 * Accounts (Initialize):
 *   config         mut, PDA
 *   authority      mut, signer
 *   system_program
 */
export function ixInitialize(
  authority: PublicKey,
  feeBps: number,
  refundTimeout: bigint,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)

  const data = Buffer.concat([
    disc('initialize'),
    u16le(feeBps),
    i64le(refundTimeout),
  ])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * create_vault_token() — no args
 *
 * Accounts (CreateVaultToken):
 *   config       readonly PDA
 *   vault_token  mut, PDA (init)
 *   token_mint   readonly
 *   payer        mut, signer
 *   token_program
 *   system_program
 *
 * @param tokenProgram - Defaults to TOKEN_PROGRAM_ID (classic SPL).
 *   Pass TOKEN_2022_PROGRAM_ID for Token-2022 mints.
 */
export function ixCreateVaultToken(
  tokenMint: PublicKey,
  payer: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [vaultTokenPda] = getVaultTokenPDA(tokenMint, VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('create_vault_token'),
  })
}

/**
 * create_fee_token() — no args
 *
 * Accounts (CreateFeeToken):
 *   config      readonly PDA
 *   fee_token   mut, PDA (init)
 *   token_mint  readonly
 *   payer       mut, signer
 *   token_program
 *   system_program
 */
export function ixCreateFeeToken(
  tokenMint: PublicKey,
  payer: PublicKey,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [feeTokenPda] = getFeeTokenPDA(tokenMint, VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: feeTokenPda, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('create_fee_token'),
  })
}

/**
 * deposit(amount: u64)
 *
 * Accounts (Deposit):
 *   config           mut, PDA
 *   deposit_record   mut, PDA (init_if_needed)
 *   vault_token      mut, PDA
 *   depositor_token  mut
 *   token_mint       readonly
 *   depositor        mut, signer
 *   token_program
 *   system_program
 */
export function ixDeposit(
  depositor: PublicKey,
  depositorToken: PublicKey,
  tokenMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, tokenMint, VAULT_PROGRAM_ID)
  const [vaultTokenPda] = getVaultTokenPDA(tokenMint, VAULT_PROGRAM_ID)

  const data = Buffer.concat([disc('deposit'), u64le(amount)])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: depositorToken, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * withdraw_private(
 *   amount: u64,
 *   amount_commitment: [u8;33],
 *   stealth_pubkey: Pubkey,
 *   ephemeral_pubkey: [u8;33],
 *   viewing_key_hash: [u8;32],
 *   encrypted_amount: Vec<u8>,
 *   proof: Vec<u8>,
 * )
 *
 * Accounts (WithdrawPrivate):
 *   config               readonly PDA
 *   deposit_record       mut, PDA
 *   vault_token          mut, PDA
 *   fee_token            mut, PDA
 *   stealth_token        mut (pre-created ATA owned by stealth address)
 *   token_mint           readonly
 *   depositor            mut, signer
 *   token_program
 *   sip_config           mut, CPI PDA
 *   sip_transfer_record  mut, CPI PDA (new)
 *   sip_privacy_program  readonly
 *   system_program
 */
export function ixWithdrawPrivate(
  depositor: PublicKey,
  stealthToken: PublicKey,
  tokenMint: PublicKey,
  sipTransferRecord: PublicKey,
  amount: bigint,
  amountCommitment: Buffer,   // 33 bytes
  stealthPubkey: PublicKey,
  ephemeralPubkey: Buffer,    // 33 bytes
  viewingKeyHash: Buffer,     // 32 bytes
  encryptedAmount: Buffer,
  proof: Buffer,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, tokenMint, VAULT_PROGRAM_ID)
  const [vaultTokenPda] = getVaultTokenPDA(tokenMint, VAULT_PROGRAM_ID)
  const [feeTokenPda] = getFeeTokenPDA(tokenMint, VAULT_PROGRAM_ID)
  const [sipConfigPda] = getSipConfigPDA()

  // Arg layout: disc(8) + amount(8) + commitment(33) + stealth_pk(32) +
  //             ephemeral(33) + vk_hash(32) + enc_len(4) + enc + proof_len(4) + proof
  const encLen = Buffer.alloc(4); encLen.writeUInt32LE(encryptedAmount.length)
  const proofLen = Buffer.alloc(4); proofLen.writeUInt32LE(proof.length)

  const data = Buffer.concat([
    disc('withdraw_private'),
    u64le(amount),
    amountCommitment,
    stealthPubkey.toBuffer(),
    ephemeralPubkey,
    viewingKeyHash,
    encLen,
    encryptedAmount,
    proofLen,
    proof,
  ])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: feeTokenPda, isSigner: false, isWritable: true },
      { pubkey: stealthToken, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // CPI accounts
      { pubkey: sipConfigPda, isSigner: false, isWritable: true },
      { pubkey: sipTransferRecord, isSigner: false, isWritable: true },
      { pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * refund() — no args
 *
 * Accounts (Refund):
 *   config           readonly PDA
 *   deposit_record   mut, PDA
 *   vault_token      mut, PDA
 *   depositor_token  mut
 *   token_mint       readonly  ← added for transfer_checked
 *   depositor        mut, signer
 *   token_program
 */
export function ixRefund(
  depositor: PublicKey,
  depositorToken: PublicKey,
  tokenMint: PublicKey,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, tokenMint, VAULT_PROGRAM_ID)
  const [vaultTokenPda] = getVaultTokenPDA(tokenMint, VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPda, isSigner: false, isWritable: true },
      { pubkey: depositorToken, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: disc('refund'),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// sip_privacy instruction builder (CPI prerequisite)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * create_sol_vault() — no args
 *
 * Accounts (CreateSolVault):
 *   config      readonly PDA
 *   sol_vault   mut, PDA (init)
 *   sol_fee     mut, PDA (init)
 *   payer       mut, signer
 *   system_program
 */
export function ixCreateSolVault(payer: PublicKey): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: solVaultPda, isSigner: false, isWritable: true },
      { pubkey: solFeePda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('create_sol_vault'),
  })
}

/**
 * deposit_sol(amount: u64)
 *
 * Accounts (DepositSol):
 *   config         mut, PDA
 *   deposit_record mut, PDA (init_if_needed)
 *   sol_vault      mut, PDA
 *   depositor      mut, signer
 *   system_program
 */
export function ixDepositSol(
  depositor: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)

  const data = Buffer.concat([disc('deposit_sol'), u64le(amount)])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: solVaultPda, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * withdraw_private_sol(
 *   amount: u64,
 *   amount_commitment: [u8;33],
 *   stealth_pubkey: Pubkey,
 *   ephemeral_pubkey: [u8;33],
 *   viewing_key_hash: [u8;32],
 *   encrypted_amount: Vec<u8>,
 *   proof: Vec<u8>,
 * )
 *
 * Accounts (WithdrawPrivateSol) — mirrors WithdrawPrivate minus all token accounts:
 *   config               readonly PDA
 *   deposit_record       mut, PDA  seeds=[…, depositor, NATIVE_SOL_MINT]
 *   sol_vault            mut, PDA  seeds=[VAULT_SOL_SEED]
 *   sol_fee              mut, PDA  seeds=[FEE_SOL_SEED]
 *   stealth              mut (plain writable system account — no ATA, no mint check)
 *   depositor            mut, signer
 *   sip_config           mut, CPI PDA
 *   sip_transfer_record  mut, CPI PDA (new)
 *   sip_privacy_program  readonly
 *   system_program
 *
 * Arg layout is identical to withdraw_private (the on-chain encoding is shared via
 * emit_transfer_announcement); only the native track has no token-specific args.
 */
export function ixWithdrawPrivateSol(
  depositor: PublicKey,
  stealth: PublicKey,
  sipTransferRecord: PublicKey,
  amount: bigint,
  amountCommitment: Buffer,   // 33 bytes
  stealthPubkey: PublicKey,
  ephemeralPubkey: Buffer,    // 33 bytes
  viewingKeyHash: Buffer,     // 32 bytes
  encryptedAmount: Buffer,
  proof: Buffer,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)
  const [sipConfigPda] = getSipConfigPDA()

  // Arg layout: disc(8) + amount(8) + commitment(33) + stealth_pk(32) +
  //             ephemeral(33) + vk_hash(32) + enc_len(4) + enc + proof_len(4) + proof
  const encLen = Buffer.alloc(4); encLen.writeUInt32LE(encryptedAmount.length)
  const proofLen = Buffer.alloc(4); proofLen.writeUInt32LE(proof.length)

  const data = Buffer.concat([
    disc('withdraw_private_sol'),
    u64le(amount),
    amountCommitment,
    stealthPubkey.toBuffer(),
    ephemeralPubkey,
    viewingKeyHash,
    encLen,
    encryptedAmount,
    proofLen,
    proof,
  ])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: solVaultPda, isSigner: false, isWritable: true },
      { pubkey: solFeePda, isSigner: false, isWritable: true },
      { pubkey: stealth, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      // CPI accounts
      { pubkey: sipConfigPda, isSigner: false, isWritable: true },
      { pubkey: sipTransferRecord, isSigner: false, isWritable: true },
      { pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * sip_privacy::initialize(fee_bps: u16) — creates the Config PDA.
 * Must be called once before any CPI from withdraw_private.
 *
 * Accounts (Initialize):
 *   config         mut, PDA   seeds=[b"config"]
 *   authority      mut, signer
 *   system_program
 */
export function ixSipPrivacyInitialize(
  authority: PublicKey,
  feeBps: number,
): TransactionInstruction {
  const [sipConfigPda] = getSipConfigPDA()

  const data = Buffer.concat([
    disc('initialize'),
    u16le(feeBps),
  ])

  return new TransactionInstruction({
    programId: SIP_PRIVACY_PROGRAM_ID,
    keys: [
      { pubkey: sipConfigPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * refund_sol() — no args
 *
 * Returns the available (unlocked) native-SOL balance to the original depositor.
 * Depositor is the signer and lamport destination.
 *
 * Accounts (RefundSol):
 *   config          readonly PDA
 *   deposit_record  mut, PDA  seeds=[DEPOSIT_RECORD_SEED, depositor, NATIVE_SOL_MINT]
 *   sol_vault       mut, PDA  seeds=[VAULT_SOL_SEED]
 *   depositor       mut, signer
 */
export function ixRefundSol(depositor: PublicKey): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: solVaultPda, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
    ],
    data: disc('refund_sol'),
  })
}

/**
 * authority_refund_sol() — no args
 *
 * Authority-signed refund: returns the available (unlocked) native-SOL balance
 * to the original depositor. Depositor is a NON-signer account (lamport destination).
 * Timeout is still enforced on-chain.
 *
 * Accounts (AuthorityRefundSol):
 *   config          readonly PDA  has_one = authority
 *   deposit_record  mut, PDA      seeds=[DEPOSIT_RECORD_SEED, depositor, NATIVE_SOL_MINT]
 *   sol_vault       mut, PDA      seeds=[VAULT_SOL_SEED]
 *   depositor       mut, SystemAccount (non-signer — lamport destination + seed source)
 *   authority       mut, signer
 */
export function ixAuthorityRefundSol(
  depositor: PublicKey,
  authority: PublicKey,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [depositRecordPda] = getDepositRecordPDA(depositor, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: depositRecordPda, isSigner: false, isWritable: true },
      { pubkey: solVaultPda, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    data: disc('authority_refund_sol'),
  })
}

/**
 * collect_fee_sol(amount: u64) — pass 0n to drain all collectable lamports
 *
 * Drains lamports above the rent-exempt minimum from the SolFee PDA to the
 * authority. amount=0 or amount > collectable both drain everything available.
 *
 * Accounts (CollectFeeSol):
 *   config    readonly PDA  seeds=[VAULT_CONFIG_SEED], has_one = authority
 *   sol_fee   mut, PDA      seeds=[FEE_SOL_SEED]
 *   authority mut, signer
 */
export function ixCollectFeeSol(
  authority: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)

  const data = Buffer.concat([disc('collect_fee_sol'), u64le(amount)])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: solFeePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    data,
  })
}

/**
 * collect_fee(amount: u64) — pass 0n to drain all
 *
 * Accounts (CollectFee):
 *   config          readonly PDA
 *   fee_token       mut, PDA
 *   authority_token mut
 *   token_mint      readonly
 *   authority       mut, signer
 *   token_program
 */
export function ixCollectFee(
  authority: PublicKey,
  authorityToken: PublicKey,
  tokenMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  const [feeTokenPda] = getFeeTokenPDA(tokenMint, VAULT_PROGRAM_ID)

  const data = Buffer.concat([disc('collect_fee'), u64le(amount)])

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: feeTokenPda, isSigner: false, isWritable: true },
      { pubkey: authorityToken, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  })
}
