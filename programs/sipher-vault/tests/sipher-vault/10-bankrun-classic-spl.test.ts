// tests/sipher-vault/10-bankrun-classic-spl.test.ts
//
// IDL-free bankrun regression baseline for the current (classic-SPL) sipher_vault.
// Validates: initialize → createVaultToken/FeeToken → deposit → withdraw_private →
//            refund (after timeout) → collect_fee.
//
// All account orders match lib.rs verbatim. No Anchor IDL or TS client.

import { assert } from 'chai'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from '@solana/spl-token'
import { ProgramTestContext, Clock } from 'solana-bankrun'
import { randomBytes } from 'crypto'

import {
  getVaultConfigPDA,
  getDepositRecordPDA,
  getVaultTokenPDA,
  getFeeTokenPDA,
  getSipConfigPDA,
  getSipTransferRecordPDA,
} from './setup'

import {
  VAULT_PROGRAM_ID,
  disc,
  u64le,
  startVault,
  sendIx,
  getAccountData,
  parseDepositRecord,
  parseVaultConfig,
  parseSipConfig,
  ixInitialize,
  ixCreateVaultToken,
  ixCreateFeeToken,
  ixDeposit,
  ixWithdrawPrivate,
  ixRefund,
  ixCollectFee,
  ixSipPrivacyInitialize,
} from './bankrun-helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FEE_BPS = 10         // 10 bps = 0.1%
const REFUND_TIMEOUT = 5n  // 5-second timeout for fast test iteration

const DEPOSIT_AMOUNT = 500_000n
const WITHDRAW_AMOUNT = 200_000n  // partial withdrawal to leave a refundable balance

// Expected fee on withdrawal: floor(WITHDRAW_AMOUNT * FEE_BPS / 10_000)
const EXPECTED_FEE = WITHDRAW_AMOUNT * BigInt(FEE_BPS) / 10_000n
const EXPECTED_NET = WITHDRAW_AMOUNT - EXPECTED_FEE

// Mint space for classic SPL (82 bytes)
const MINT_SPACE = 82

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('10 · bankrun classic-SPL regression baseline', function () {
  this.timeout(120_000) // cold Anchor build + bankrun startup

  let ctx: ProgramTestContext
  let authority: Keypair  // bankrun payer — authority + mint authority + depositor
  let mintKp: Keypair
  let mint: PublicKey
  let depositorAta: PublicKey
  let stealthKp: Keypair
  let stealthAta: PublicKey
  let authorityAta: PublicKey // for collect_fee assertion

  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)

  // ── before: initialize bankrun + setup mint + vault ───────────────────────

  before(async function () {
    // startVault spins up bankrun + loads sipher_vault (workspace binary) +
    // sip_privacy (tests/fixtures/sip_privacy.so by name).
    ctx = await startVault()
    authority = ctx.payer // funded with 1,000,000,000 SOL by bankrun

    mintKp = Keypair.generate()
    mint = mintKp.publicKey
    stealthKp = Keypair.generate()

    // 1. Create classic SPL mint (2 ixs: create-account + init-mint)
    const rent = await ctx.banksClient.getRent()
    // rent.minimumBalance returns bigint; SystemProgram.createAccount needs number
    const mintLamports = Number(rent.minimumBalance(BigInt(MINT_SPACE)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint,
        lamports: mintLamports,
        space: MINT_SPACE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint,
        6,             // decimals
        authority.publicKey,  // mint authority
        null,          // freeze authority
      ),
    ], [authority, mintKp])

    // 2. Create depositor ATA + stealth ATA + authority ATA
    depositorAta = getAssociatedTokenAddressSync(mint, authority.publicKey)
    stealthAta = getAssociatedTokenAddressSync(mint, stealthKp.publicKey)
    authorityAta = getAssociatedTokenAddressSync(mint, authority.publicKey)
    // depositorAta === authorityAta since payer == authority, which is fine

    await sendIx(ctx, [
      createAssociatedTokenAccountInstruction(
        authority.publicKey, depositorAta, authority.publicKey, mint,
      ),
      createAssociatedTokenAccountInstruction(
        authority.publicKey, stealthAta, stealthKp.publicKey, mint,
      ),
    ], [authority])

    // 3. Mint tokens to depositor ATA
    await sendIx(ctx, [
      createMintToInstruction(mint, depositorAta, authority.publicKey, DEPOSIT_AMOUNT * 2n),
    ], [authority])

    // 4. Initialize sip_privacy config (prerequisite for CPI in withdraw_private)
    await sendIx(ctx, [
      ixSipPrivacyInitialize(authority.publicKey, 50), // 50 bps = sip_privacy default
    ], [authority])

    // 5. Initialize vault (fee=10 bps, timeout=5s)
    await sendIx(ctx, [
      ixInitialize(authority.publicKey, FEE_BPS, REFUND_TIMEOUT),
    ], [authority])

    // 6. Create vault token PDA + fee token PDA for the mint
    await sendIx(ctx, [
      ixCreateVaultToken(mint, authority.publicKey),
    ], [authority])

    await sendIx(ctx, [
      ixCreateFeeToken(mint, authority.publicKey),
    ], [authority])
  })

  // ── it: deposit 500_000 ───────────────────────────────────────────────────

  it('deposit 500_000 → balance and vault_token match', async function () {
    await sendIx(ctx, [
      ixDeposit(authority.publicKey, depositorAta, mint, DEPOSIT_AMOUNT),
    ], [authority])

    // Assert DepositRecord.balance
    const [depositRecordPda] = getDepositRecordPDA(authority.publicKey, mint, VAULT_PROGRAM_ID)
    const recData = await getAccountData(ctx, depositRecordPda)
    const rec = parseDepositRecord(recData)

    assert.strictEqual(rec.balance, DEPOSIT_AMOUNT, 'deposit_record.balance mismatch')
    assert.strictEqual(rec.cumulativeVolume, DEPOSIT_AMOUNT, 'cumulative_volume mismatch')
    assert.ok(rec.depositor.equals(authority.publicKey), 'depositor pubkey mismatch')
    assert.ok(rec.tokenMint.equals(mint), 'token_mint mismatch')

    // Assert vault_token balance
    const [vaultTokenPda] = getVaultTokenPDA(mint, VAULT_PROGRAM_ID)
    const vaultAcct = await ctx.banksClient.getAccount(vaultTokenPda)
    assert.ok(vaultAcct, 'vault_token PDA not found')
    // Token account data: 32(mint) + 32(owner) + 8(amount) at offset 64
    const vaultBalance = Buffer.from(vaultAcct.data).readBigUInt64LE(64)
    assert.strictEqual(vaultBalance, DEPOSIT_AMOUNT, 'vault_token balance mismatch')
  })

  // ── it: VaultConfig initialized correctly ────────────────────────────────

  it('VaultConfig reflects fee_bps and refund_timeout', async function () {
    const cfgData = await getAccountData(ctx, configPda)
    const cfg = parseVaultConfig(cfgData)

    assert.strictEqual(cfg.feeBps, FEE_BPS, 'fee_bps mismatch')
    assert.strictEqual(cfg.refundTimeout, REFUND_TIMEOUT, 'refund_timeout mismatch')
    assert.strictEqual(cfg.paused, false, 'paused should be false')
    assert.strictEqual(cfg.totalDeposits, 1n, 'total_deposits should be 1')
    assert.strictEqual(cfg.totalDepositors, 1n, 'total_depositors should be 1 for new depositor')
    assert.ok(cfg.authority.equals(authority.publicKey), 'authority mismatch')
  })

  // ── it: withdraw_private → stealth gets net, fee_token gets fee ──────────

  it('withdraw_private → net to stealth, fee to fee_token, TransferRecord PDA created', async function () {
    // Snapshot vault and fee token balances before
    const [vaultTokenPda] = getVaultTokenPDA(mint, VAULT_PROGRAM_ID)
    const [feeTokenPda] = getFeeTokenPDA(mint, VAULT_PROGRAM_ID)

    const vaultBefore = Buffer.from((await ctx.banksClient.getAccount(vaultTokenPda))!.data).readBigUInt64LE(64)
    const feeBefore = Buffer.from((await ctx.banksClient.getAccount(feeTokenPda))!.data).readBigUInt64LE(64)

    // Read sip_privacy total_transfers to derive the correct TransferRecord PDA
    const [sipConfigPda] = getSipConfigPDA()
    const sipCfgData = await getAccountData(ctx, sipConfigPda)
    const { totalTransfers } = parseSipConfig(sipCfgData)

    const [sipTransferRecordPda] = getSipTransferRecordPDA(authority.publicKey, totalTransfers)

    // Deterministic dummy stealth params (not cryptographically meaningful for test)
    const amountCommitment = Buffer.concat([Buffer.from([0x02]), randomBytes(32)]) // 33 bytes
    const ephemeralPubkey = Buffer.concat([Buffer.from([0x02]), randomBytes(32)])  // 33 bytes
    const viewingKeyHash = randomBytes(32) // 32 bytes
    const encryptedAmount = Buffer.from([]) // empty
    const proof = Buffer.from([])           // empty (stub-verified by program)

    await sendIx(ctx, [
      ixWithdrawPrivate(
        authority.publicKey,
        stealthAta,
        mint,
        sipTransferRecordPda,
        WITHDRAW_AMOUNT,
        amountCommitment,
        stealthKp.publicKey,
        ephemeralPubkey,
        viewingKeyHash,
        encryptedAmount,
        proof,
      ),
    ], [authority])

    // ── Assert: stealth_token received net amount ──
    const stealthAcct = await ctx.banksClient.getAccount(stealthAta)
    assert.ok(stealthAcct, 'stealth_token account not found')
    const stealthBalance = Buffer.from(stealthAcct.data).readBigUInt64LE(64)
    assert.strictEqual(stealthBalance, EXPECTED_NET, `stealth_token balance: expected ${EXPECTED_NET}, got ${stealthBalance}`)

    // ── Assert: fee_token accumulated the fee ──
    const feeAcct = await ctx.banksClient.getAccount(feeTokenPda)
    assert.ok(feeAcct, 'fee_token account not found')
    const feeBalance = Buffer.from(feeAcct.data).readBigUInt64LE(64)
    const feeDelta = feeBalance - feeBefore
    assert.strictEqual(feeDelta, EXPECTED_FEE, `fee_token delta: expected ${EXPECTED_FEE}, got ${feeDelta}`)

    // ── Assert: vault_token reduced by full WITHDRAW_AMOUNT ──
    const vaultAcct = await ctx.banksClient.getAccount(vaultTokenPda)
    const vaultAfter = Buffer.from(vaultAcct!.data).readBigUInt64LE(64)
    assert.strictEqual(
      vaultBefore - vaultAfter,
      WITHDRAW_AMOUNT,
      `vault reduction: expected ${WITHDRAW_AMOUNT}, got ${vaultBefore - vaultAfter}`,
    )

    // ── Assert: DepositRecord.balance reduced ──
    const [depositRecordPda] = getDepositRecordPDA(authority.publicKey, mint, VAULT_PROGRAM_ID)
    const recData = await getAccountData(ctx, depositRecordPda)
    const rec = parseDepositRecord(recData)
    assert.strictEqual(
      rec.balance,
      DEPOSIT_AMOUNT - WITHDRAW_AMOUNT,
      `deposit_record.balance after withdrawal mismatch`,
    )

    // ── Assert: sip_privacy TransferRecord PDA was created by CPI ──
    const transferRecord = await ctx.banksClient.getAccount(sipTransferRecordPda)
    assert.ok(transferRecord, 'sip_privacy TransferRecord PDA not created — CPI failed')
    assert.ok(
      new PublicKey(transferRecord.owner).equals(
        new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'),
      ),
      'TransferRecord owner should be sip_privacy program',
    )
  })

  // ── it: refund after timeout ─────────────────────────────────────────────

  it('refund after timeout → depositor receives remaining balance', async function () {
    const [depositRecordPda] = getDepositRecordPDA(authority.publicKey, mint, VAULT_PROGRAM_ID)
    const [vaultTokenPda] = getVaultTokenPDA(mint, VAULT_PROGRAM_ID)

    // Read current deposit record to know what's available
    const recBefore = parseDepositRecord(await getAccountData(ctx, depositRecordPda))
    const available = recBefore.balance
    assert.ok(available > 0n, 'nothing to refund — test state error')

    // Snapshot depositor ATA before refund
    const depositorAcctBefore = await ctx.banksClient.getAccount(depositorAta)
    const depositorBalBefore = Buffer.from(depositorAcctBefore!.data).readBigUInt64LE(64)

    // Advance clock beyond refund_timeout to pass on-chain check
    const currentClock = await ctx.banksClient.getClock()
    const newClock = new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      // unix_timestamp past last_deposit_at + REFUND_TIMEOUT
      recBefore.lastDepositAt + REFUND_TIMEOUT + 10n,
    )
    ctx.setClock(newClock)

    await sendIx(ctx, [
      ixRefund(authority.publicKey, depositorAta, mint),
    ], [authority])

    // ── Assert: depositor ATA received the refund ──
    const depositorAcctAfter = await ctx.banksClient.getAccount(depositorAta)
    const depositorBalAfter = Buffer.from(depositorAcctAfter!.data).readBigUInt64LE(64)
    assert.strictEqual(
      depositorBalAfter - depositorBalBefore,
      available,
      `depositor did not receive correct refund amount`,
    )

    // ── Assert: DepositRecord.balance is now 0 after full refund ──
    const recAfter = parseDepositRecord(await getAccountData(ctx, depositRecordPda))
    assert.strictEqual(recAfter.balance, 0n, 'deposit_record.balance should be 0 after full refund')

    // ── Assert: vault_token balance reduced accordingly ──
    const vaultAcct = await ctx.banksClient.getAccount(vaultTokenPda)
    const vaultBalance = Buffer.from(vaultAcct!.data).readBigUInt64LE(64)
    // vault should hold only the fee that was already collected into fee_token
    // vault = original_deposit - withdraw_amount - refund
    //       = DEPOSIT_AMOUNT - WITHDRAW_AMOUNT - available = 0
    assert.strictEqual(vaultBalance, 0n, 'vault_token should be empty after refund')
  })

  // ── it: collect_fee → authority receives fee ─────────────────────────────

  it('collect_fee → authority token account receives accumulated fees', async function () {
    const [feeTokenPda] = getFeeTokenPDA(mint, VAULT_PROGRAM_ID)

    // Snapshot fee_token balance
    const feeAcctBefore = await ctx.banksClient.getAccount(feeTokenPda)
    const feeBal = Buffer.from(feeAcctBefore!.data).readBigUInt64LE(64)
    assert.ok(feeBal > 0n, 'fee_token is empty — nothing to collect (test state error)')

    // Snapshot authority ATA before collect
    const authAcctBefore = await ctx.banksClient.getAccount(authorityAta)
    const authBalBefore = Buffer.from(authAcctBefore!.data).readBigUInt64LE(64)

    // collect_fee(0) = drain all
    await sendIx(ctx, [
      ixCollectFee(authority.publicKey, authorityAta, mint, 0n),
    ], [authority])

    // ── Assert: authority ATA received all fees ──
    const authAcctAfter = await ctx.banksClient.getAccount(authorityAta)
    const authBalAfter = Buffer.from(authAcctAfter!.data).readBigUInt64LE(64)
    assert.strictEqual(
      authBalAfter - authBalBefore,
      feeBal,
      `authority did not receive all fees: expected ${feeBal}, got ${authBalAfter - authBalBefore}`,
    )

    // ── Assert: fee_token is empty ──
    const feeAcctAfter = await ctx.banksClient.getAccount(feeTokenPda)
    const feeBalAfter = Buffer.from(feeAcctAfter!.data).readBigUInt64LE(64)
    assert.strictEqual(feeBalAfter, 0n, 'fee_token should be empty after collect_fee(0)')
  })
})
