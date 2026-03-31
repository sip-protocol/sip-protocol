import * as anchor from '@coral-xyz/anchor'
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'
import { Keypair, PublicKey } from '@solana/web3.js'

// ─────────────────────────────────────────────────────────────────────────────
// PDA Seeds (must match constants.rs)
// ─────────────────────────────────────────────────────────────────────────────

export const VAULT_CONFIG_SEED = Buffer.from('vault_config')
export const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')
export const VAULT_TOKEN_SEED = Buffer.from('vault_token')
export const FEE_TOKEN_SEED = Buffer.from('fee_token')

// Program constants (must match constants.rs)
export const MAX_FEE_BPS = 100
export const DEFAULT_REFUND_TIMEOUT = 86400

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
