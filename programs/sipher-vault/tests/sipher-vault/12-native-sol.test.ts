// tests/sipher-vault/12-native-sol.test.ts
//
// TDD — Task 5-9: native SOL vault track.
// Tasks 6-9 will add more it() blocks below — the before() is shared for the
// full native-SOL suite. This file owns the fixture for the native track.
//
// Task 5 scope: create_sol_vault
//   - before(): startVault() + initialize + create_sol_vault
//   - it(): both sol_vault PDA and sol_fee PDA exist, owned by vault program
//
// Task 6 scope: deposit_sol
//   - it(): deposit 1_000_000 lamports → DepositRecord.balance + sol_vault lamport delta
//   - it(): rejects zero-amount deposit

import { assert } from 'chai'
import { Keypair, PublicKey } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'

import { getSolVaultPDA, getSolFeePDA, getDepositRecordPDA, getVaultConfigPDA } from './setup'

import {
  VAULT_PROGRAM_ID,
  NATIVE_SOL_MINT,
  startVault,
  sendIx,
  ixInitialize,
  ixCreateSolVault,
  ixDepositSol,
  getAccountData,
  parseDepositRecord,
  parseVaultConfig,
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

  // ── Task 6: deposit_sol ──────────────────────────────────────────────────

  it('deposit_sol → DepositRecord balance equals deposited lamports and sol_vault lamports increase by exact amount', async function () {
    const depositAmount = 1_000_000n // 1M lamports

    // Read sol_vault lamports before deposit
    const solVaultBefore = await ctx.banksClient.getAccount(solVaultPda)
    assert.ok(solVaultBefore, 'sol_vault PDA not found before deposit')
    const lamportsBefore = BigInt(solVaultBefore.lamports)

    // Execute deposit
    await sendIx(ctx, [
      ixDepositSol(authority.publicKey, depositAmount),
    ], [authority])

    // Read sol_vault lamports after deposit
    const solVaultAfter = await ctx.banksClient.getAccount(solVaultPda)
    assert.ok(solVaultAfter, 'sol_vault PDA not found after deposit')
    const lamportsAfter = BigInt(solVaultAfter.lamports)

    // Assert lamport delta is exactly depositAmount
    assert.strictEqual(
      lamportsAfter - lamportsBefore,
      depositAmount,
      `sol_vault lamport delta mismatch: expected +${depositAmount}, got +${lamportsAfter - lamportsBefore}`,
    )

    // Assert DepositRecord balance
    const [depositRecordPda] = getDepositRecordPDA(authority.publicKey, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
    const recordData = await getAccountData(ctx, depositRecordPda)
    const record = parseDepositRecord(recordData)

    assert.strictEqual(
      record.balance,
      depositAmount,
      `DepositRecord.balance mismatch: expected ${depositAmount}, got ${record.balance}`,
    )
    assert.ok(
      record.tokenMint.equals(NATIVE_SOL_MINT),
      `DepositRecord.token_mint mismatch: expected ${NATIVE_SOL_MINT.toBase58()}, got ${record.tokenMint.toBase58()}`,
    )
    assert.ok(
      record.depositor.equals(authority.publicKey),
      `DepositRecord.depositor mismatch: expected ${authority.publicKey.toBase58()}, got ${record.depositor.toBase58()}`,
    )

    // Assert VaultConfig counters — is_new=true means both incremented on first deposit
    const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
    const configData = await getAccountData(ctx, configPda)
    const config = parseVaultConfig(configData)

    assert.strictEqual(
      config.totalDeposits,
      1n,
      `VaultConfig.total_deposits mismatch: expected 1, got ${config.totalDeposits}`,
    )
    assert.strictEqual(
      config.totalDepositors,
      1n,
      `VaultConfig.total_depositors mismatch: expected 1, got ${config.totalDepositors}`,
    )
  })

  // Anchor custom errors start at 6000; ZeroDeposit is index 4 → code 6004 (0x1774)
  const ZERO_DEPOSIT_CODE = 6004
  const ZERO_DEPOSIT_HEX = ZERO_DEPOSIT_CODE.toString(16) // '1774'

  it('deposit_sol → rejects zero-amount deposit with ZeroDeposit error (6004 / 0x1774)', async function () {
    try {
      await sendIx(ctx, [
        ixDepositSol(authority.publicKey, 0n),
      ], [authority])
      assert.fail('Expected ZeroDeposit error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected ZeroDeposit error but transaction succeeded')) {
        throw err // re-throw the assert.fail
      }
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(ZERO_DEPOSIT_CODE)) ||
        msg.includes(ZERO_DEPOSIT_HEX) ||
        msg.includes('zerodeposit')
      assert.ok(
        matchesCode,
        `Expected ZeroDeposit (${ZERO_DEPOSIT_CODE} / 0x${ZERO_DEPOSIT_HEX}), got: ${err?.message ?? String(err)}`,
      )
    }
  })
})
