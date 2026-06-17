// tests/sipher-vault/12-native-sol.test.ts
//
// TDD — Task 5-9: native SOL vault track.
// Tasks 6-9 will add more it() blocks below — the before() is shared for the
// full native-SOL suite. This file owns the fixture for the native track.
//
// Task 5 scope: create_sol_vault
//   - before(): startVault() + initialize + create_sol_vault
//   - it(): both sol_vault PDA and sol_fee PDA exist, owned by vault program

import { assert } from 'chai'
import { Keypair, PublicKey } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'

import { getSolVaultPDA, getSolFeePDA } from './setup'

import {
  VAULT_PROGRAM_ID,
  startVault,
  sendIx,
  ixInitialize,
  ixCreateSolVault,
} from './bankrun-helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FEE_BPS = 10
const REFUND_TIMEOUT = 5n // 5-second timeout for fast test iteration

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('12 · native SOL vault track', function () {
  this.timeout(120_000) // cold Anchor build + bankrun startup

  let ctx: ProgramTestContext
  let authority: Keypair

  // Pre-derive the PDAs once — used by all tasks in this suite
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)

  // ── before: initialize bankrun + vault config + create_sol_vault ──────────

  before(async function () {
    ctx = await startVault()
    authority = ctx.payer // funded with 1,000,000,000 SOL by bankrun

    // 1. Initialize vault config (fee=10 bps, timeout=5s)
    await sendIx(ctx, [
      ixInitialize(authority.publicKey, FEE_BPS, REFUND_TIMEOUT),
    ], [authority])

    // 2. Create the native-SOL vault + fee PDAs
    await sendIx(ctx, [
      ixCreateSolVault(authority.publicKey),
    ], [authority])
  })

  // ── Task 5: create_sol_vault ─────────────────────────────────────────────

  it('create_sol_vault → sol_vault and sol_fee PDAs exist and are program-owned', async function () {
    // SolVault PDA must exist
    const solVaultAcct = await ctx.banksClient.getAccount(solVaultPda)
    assert.ok(solVaultAcct, 'sol_vault PDA not found — create_sol_vault did not initialize it')

    // SolFee PDA must exist
    const solFeeAcct = await ctx.banksClient.getAccount(solFeePda)
    assert.ok(solFeeAcct, 'sol_fee PDA not found — create_sol_vault did not initialize it')

    // Both must be owned by the vault program
    assert.ok(
      new PublicKey(solVaultAcct.owner).equals(VAULT_PROGRAM_ID),
      `sol_vault owner mismatch: expected ${VAULT_PROGRAM_ID.toBase58()}, got ${new PublicKey(solVaultAcct.owner).toBase58()}`,
    )
    assert.ok(
      new PublicKey(solFeeAcct.owner).equals(VAULT_PROGRAM_ID),
      `sol_fee owner mismatch: expected ${VAULT_PROGRAM_ID.toBase58()}, got ${new PublicKey(solFeeAcct.owner).toBase58()}`,
    )
  })
})
