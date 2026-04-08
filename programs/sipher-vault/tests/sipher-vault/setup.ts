import * as anchor from '@coral-xyz/anchor'
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'
import { Keypair, PublicKey } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// PDA Seeds (must match constants.rs)
// ─────────────────────────────────────────────────────────────────────────────

export const VAULT_CONFIG_SEED = Buffer.from('vault_config')
export const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')
export const VAULT_TOKEN_SEED = Buffer.from('vault_token')
export const FEE_TOKEN_SEED = Buffer.from('fee_token')

// SIP Privacy program seeds (must match sip_privacy constants)
export const SIP_CONFIG_SEED = Buffer.from('config')
export const SIP_TRANSFER_RECORD_SEED = Buffer.from('transfer_record')

// Program constants (must match constants.rs)
export const MAX_FEE_BPS = 100
export const DEFAULT_REFUND_TIMEOUT = 86400

// SIP Privacy program ID
export const SIP_PRIVACY_PROGRAM_ID = new PublicKey(
  'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
)

/**
 * Load the sip_privacy program .so for bankrun tests.
 * Returns [programId, programData] tuple for startAnchor's extra programs.
 */
export function loadSipPrivacyProgram(): [string, Uint8Array] {
  const soPath = path.resolve(
    __dirname,
    '../../../../programs/sip-privacy/target/deploy/sip_privacy.so',
  )
  const programData = fs.readFileSync(soPath)
  return [SIP_PRIVACY_PROGRAM_ID.toBase58(), new Uint8Array(programData)]
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getVaultConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], programId)
}

export function getDepositRecordPDA(
  depositor: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, depositor.toBuffer(), tokenMint.toBuffer()],
    programId,
  )
}

export function getVaultTokenPDA(
  tokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_SEED, tokenMint.toBuffer()],
    programId,
  )
}

export function getFeeTokenPDA(
  tokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FEE_TOKEN_SEED, tokenMint.toBuffer()],
    programId,
  )
}

/**
 * Derive the SIP Privacy Config PDA.
 * Seeds: [b"config"]
 */
export function getSipConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SIP_CONFIG_SEED],
    SIP_PRIVACY_PROGRAM_ID,
  )
}

/**
 * Derive a SIP Privacy TransferRecord PDA.
 * Seeds: [b"transfer_record", sender, total_transfers.to_le_bytes()]
 */
export function getSipTransferRecordPDA(
  sender: PublicKey,
  totalTransfers: number | bigint,
): [PublicKey, number] {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(totalTransfers))
  return PublicKey.findProgramAddressSync(
    [SIP_TRANSFER_RECORD_SEED, sender.toBuffer(), buf],
    SIP_PRIVACY_PROGRAM_ID,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Helpers (reusable for deposit/withdraw/refund tests)
// ─────────────────────────────────────────────────────────────────────────────

export async function setupTestMint(
  provider: anchor.AnchorProvider,
  authority: Keypair,
  decimals = 6,
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    decimals,
  )
}

export async function setupTokenAccount(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
  amount = 0,
): Promise<PublicKey> {
  const ata = await createAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
  )
  if (amount > 0) {
    await mintTo(provider.connection, payer, mint, ata, payer, amount)
  }
  return ata
}
