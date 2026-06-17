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
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'
import { randomBytes } from 'crypto'

import {
  getSolVaultPDA,
  getSolFeePDA,
  getDepositRecordPDA,
  getVaultConfigPDA,
  getSipConfigPDA,
  getSipTransferRecordPDA,
} from './setup'

import {
  VAULT_PROGRAM_ID,
  NATIVE_SOL_MINT,
  startVault,
  sendIx,
  ixInitialize,
  ixCreateSolVault,
  ixDepositSol,
  ixWithdrawPrivateSol,
  ixRefundSol,
  ixAuthorityRefundSol,
  ixCollectFeeSol,
  ixSipPrivacyInitialize,
  getAccountData,
  parseDepositRecord,
  parseVaultConfig,
  parseSipConfig,
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

  // ── Task 7: withdraw_private_sol ─────────────────────────────────────────
  //
  // High-risk: moves lamports OUT of the program-owned sol_vault PDA via checked
  // lamport mutation. These tests use a dedicated depositor (`wd`) funded from the
  // bankrun payer so they are independent of the deposit_sol tests above (which
  // key their DepositRecord to `authority`). sip_privacy's Config PDA is NOT
  // initialized by startVault(), so the first withdraw test bootstraps it (bankrun
  // deploys sip_privacy.so but does not run its `initialize`).

  // Anchor custom errors start at 6000. Enum order in errors.rs:
  //   ProgramPaused=6000, Unauthorized=6001, InsufficientBalance=6002,
  //   MathOverflow=6003, ZeroDeposit=6004, … , RentReserveViolation=6013.
  const INSUFFICIENT_BALANCE_CODE = 6002
  const INSUFFICIENT_BALANCE_HEX = INSUFFICIENT_BALANCE_CODE.toString(16) // '1772'
  const RENT_RESERVE_CODE = 6013
  const RENT_RESERVE_HEX = RENT_RESERVE_CODE.toString(16) // '177d'

  const FEE_DENOM = 10_000n

  // Dedicated withdraw depositor — funded once in a guarded helper below.
  const wd = Keypair.generate()
  let sipPrivacyInitialized = false

  // Fund `wd` from the bankrun payer and (once) initialize sip_privacy Config.
  async function ensureWithdrawSetup(): Promise<void> {
    if (!sipPrivacyInitialized) {
      // Bootstrap sip_privacy Config (CPI target for the announcement).
      await sendIx(ctx, [
        ixSipPrivacyInitialize(authority.publicKey, 50), // 50 bps = sip_privacy default
      ], [authority])
      // Fund the dedicated withdraw depositor (rent for DepositRecord + deposit + tx fees).
      await sendIx(ctx, [
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: wd.publicKey,
          lamports: 50_000_000, // generous: covers rent + deposits across all wd tests
        }),
      ], [authority])
      sipPrivacyInitialized = true
    }
  }

  // Build deterministic-but-valid announcement params. sip_privacy validates the
  // commitment prefix is 0x02/0x03, so honor that (the 33-byte commitment is a
  // compressed-point shape; the value is otherwise opaque to the program).
  function announceParams() {
    return {
      amountCommitment: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]), // 33 bytes
      ephemeralPubkey: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]),  // 33 bytes
      viewingKeyHash: randomBytes(32),                                          // 32 bytes
      encryptedAmount: Buffer.from([]),                                         // empty
      proof: Buffer.from([]),                                                   // empty (stub-verified)
    }
  }

  it('withdraw_private_sol → net to stealth, fee to sol_fee, vault debited, TransferRecord created', async function () {
    await ensureWithdrawSetup()

    const depositAmount = 1_000_000n
    const withdrawAmount = 500_000n
    const expectedFee = (withdrawAmount * BigInt(FEE_BPS)) / FEE_DENOM // floor → 500
    const expectedNet = withdrawAmount - expectedFee                   // 499_500

    // Deposit 1_000_000 from the dedicated withdraw depositor.
    await sendIx(ctx, [ixDepositSol(wd.publicKey, depositAmount)], [wd])

    // Snapshot sol_vault + sol_fee lamports before the withdrawal.
    const solVaultBefore = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)
    const solFeeBefore = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)

    // Stealth recipient. The on-chain program adds NO minimum-payout floor (spec
    // §8), but the Solana runtime's post-transaction rent check rejects a tx that
    // leaves a freshly-funded system account below the rent-exempt minimum
    // (≈890_880 lamports for 0 data). A real stealth recipient already exists
    // (created/funded by the relayer), so we pre-fund it to rent-exemption and
    // then assert the *delta* from the withdrawal is exactly `net`.
    const rent = await ctx.banksClient.getRent()
    const stealthRentMin = rent.minimumBalance(0n)
    const stealth = Keypair.generate().publicKey
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: stealth,
        lamports: Number(stealthRentMin),
      }),
    ], [authority])
    const stealthBefore = BigInt((await ctx.banksClient.getAccount(stealth))!.lamports)
    assert.strictEqual(stealthBefore, stealthRentMin, 'stealth should be pre-funded to rent-exempt min')

    // Derive the sip_privacy TransferRecord PDA from current total_transfers.
    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(wd.publicKey, totalTransfers)

    const p = announceParams()
    await sendIx(ctx, [
      ixWithdrawPrivateSol(
        wd.publicKey,
        stealth,
        sipTransferRecordPda,
        withdrawAmount,
        p.amountCommitment,
        stealth, // stealth_pubkey arg == the recipient account here
        p.ephemeralPubkey,
        p.viewingKeyHash,
        p.encryptedAmount,
        p.proof,
      ),
    ], [wd])

    // ── stealth received exactly net ──
    const stealthAfter = BigInt((await ctx.banksClient.getAccount(stealth))!.lamports)
    assert.strictEqual(
      stealthAfter - BigInt(stealthBefore),
      expectedNet,
      `stealth lamport delta: expected +${expectedNet}, got +${stealthAfter - BigInt(stealthBefore)}`,
    )

    // ── sol_fee received exactly fee ──
    const solFeeAfter = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)
    assert.strictEqual(
      solFeeAfter - solFeeBefore,
      expectedFee,
      `sol_fee lamport delta: expected +${expectedFee}, got +${solFeeAfter - solFeeBefore}`,
    )

    // ── sol_vault debited by the full gross amount ──
    const solVaultAfter = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)
    assert.strictEqual(
      solVaultBefore - solVaultAfter,
      withdrawAmount,
      `sol_vault lamport delta: expected -${withdrawAmount}, got -${solVaultBefore - solVaultAfter}`,
    )

    // ── DepositRecord.balance reduced by the gross amount ──
    const [recordPda] = getDepositRecordPDA(wd.publicKey, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
    const record = parseDepositRecord(await getAccountData(ctx, recordPda))
    assert.strictEqual(
      record.balance,
      depositAmount - withdrawAmount, // 500_000
      `DepositRecord.balance: expected ${depositAmount - withdrawAmount}, got ${record.balance}`,
    )

    // ── sip_privacy TransferRecord PDA created by the announcement CPI ──
    const transferRecord = await ctx.banksClient.getAccount(sipTransferRecordPda)
    assert.ok(transferRecord, 'sip_privacy TransferRecord PDA not created — announcement CPI failed')
    assert.ok(
      new PublicKey(transferRecord.owner).equals(
        new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'),
      ),
      'TransferRecord owner should be the sip_privacy program',
    )
  })

  it('withdraw_private_sol → rejects withdrawal exceeding available (InsufficientBalance 6002 / 0x1772)', async function () {
    await ensureWithdrawSetup()

    // After the happy path, wd's record balance is 500_000. Ask for more.
    const [recordPda] = getDepositRecordPDA(wd.publicKey, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
    const record = parseDepositRecord(await getAccountData(ctx, recordPda))
    const overAsk = record.balance + 1n // 1 lamport above available

    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(wd.publicKey, totalTransfers)

    const stealth = Keypair.generate().publicKey
    const p = announceParams()

    try {
      await sendIx(ctx, [
        ixWithdrawPrivateSol(
          wd.publicKey, stealth, sipTransferRecordPda, overAsk,
          p.amountCommitment, stealth, p.ephemeralPubkey, p.viewingKeyHash,
          p.encryptedAmount, p.proof,
        ),
      ], [wd])
      assert.fail('Expected InsufficientBalance error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected InsufficientBalance error but transaction succeeded')) {
        throw err
      }
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(INSUFFICIENT_BALANCE_CODE)) ||
        msg.includes(INSUFFICIENT_BALANCE_HEX) ||
        msg.includes('insufficientbalance')
      assert.ok(
        matchesCode,
        `Expected InsufficientBalance (${INSUFFICIENT_BALANCE_CODE} / 0x${INSUFFICIENT_BALANCE_HEX}), got: ${err?.message ?? String(err)}`,
      )
    }
  })

  it('withdraw_private_sol → rent guard fires when vault lamports are desynced below backing (RentReserveViolation 6013 / 0x177d)', async function () {
    await ensureWithdrawSetup()

    // Use a FRESH depositor so `available` is large and unrelated to wd's balance.
    const rentDepositor = Keypair.generate()
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: rentDepositor.publicKey,
        lamports: 10_000_000,
      }),
    ], [authority])

    // (a) Deposit 1_000_000 so the depositor's available balance ≫ the tiny withdraw.
    await sendIx(ctx, [ixDepositSol(rentDepositor.publicKey, 1_000_000n)], [rentDepositor])

    // (b) Read the SolVault account, compute its rent-exempt minimum, then desync:
    //     lower the vault's lamports to (rent_min + 100) while preserving its real
    //     data + owner. This makes the *backing* lamports inconsistent with the
    //     accounting (Σ balances), so a withdrawal that the balance check allows
    //     can still breach the rent floor.
    const solVaultAcct = (await ctx.banksClient.getAccount(solVaultPda))!
    const rent = await ctx.banksClient.getRent()
    const rentMin = rent.minimumBalance(BigInt(solVaultAcct.data.length)) // data = 8 + 1 = 9 bytes

    // Snapshot the real account to restore afterward (keep the file order-independent).
    const originalLamports = BigInt(solVaultAcct.lamports)
    const originalData = Buffer.from(solVaultAcct.data)
    const originalOwner = new PublicKey(solVaultAcct.owner)
    const originalRentEpoch = solVaultAcct.rentEpoch
    const originalExecutable = solVaultAcct.executable

    ctx.setAccount(solVaultPda, {
      lamports: Number(rentMin + 100n),
      data: originalData,
      owner: originalOwner,
      executable: originalExecutable,
      rentEpoch: originalRentEpoch,
    })

    // (c) Withdraw 200 lamports:
    //   available (1_000_000) ≥ 200             → passes InsufficientBalance check
    //   checked_sub(rentMin+100 − 200) ≥ 0      → no MathOverflow (rentMin ≫ 200)
    //   (rentMin+100 − 200) < rentMin           → RentReserveViolation fires
    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(rentDepositor.publicKey, totalTransfers)

    const stealth = Keypair.generate().publicKey
    const p = announceParams()

    let threw = false
    try {
      await sendIx(ctx, [
        ixWithdrawPrivateSol(
          rentDepositor.publicKey, stealth, sipTransferRecordPda, 200n,
          p.amountCommitment, stealth, p.ephemeralPubkey, p.viewingKeyHash,
          p.encryptedAmount, p.proof,
        ),
      ], [rentDepositor])
      assert.fail('Expected RentReserveViolation error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected RentReserveViolation error but transaction succeeded')) {
        throw err
      }
      threw = true
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(RENT_RESERVE_CODE)) ||
        msg.includes(RENT_RESERVE_HEX) ||
        msg.includes('rentreserveviolation')
      assert.ok(
        matchesCode,
        `Expected RentReserveViolation (${RENT_RESERVE_CODE} / 0x${RENT_RESERVE_HEX}), got: ${err?.message ?? String(err)}`,
      )
    } finally {
      // Restore the real sol_vault account so later test files / runs are unaffected.
      ctx.setAccount(solVaultPda, {
        lamports: Number(originalLamports),
        data: originalData,
        owner: originalOwner,
        executable: originalExecutable,
        rentEpoch: originalRentEpoch,
      })
    }
    assert.ok(threw, 'rent-guard test did not throw')
  })

  // ── Task 8: refund_sol + authority_refund_sol ────────────────────────────
  //
  // Anchor custom error codes (6000-base, enum order from errors.rs):
  //   RefundNotExpired = index 5 → 6005 / 0x1775
  //   NothingToRefund  = index 6 → 6006 / 0x1776
  //   Unauthorized     = index 1 → 6001 / 0x1771
  const REFUND_NOT_EXPIRED_CODE = 6005
  const REFUND_NOT_EXPIRED_HEX = REFUND_NOT_EXPIRED_CODE.toString(16) // '1775'
  const UNAUTHORIZED_CODE = 6001
  const UNAUTHORIZED_HEX = UNAUTHORIZED_CODE.toString(16) // '1771'

  // Dedicated keypair for refund_sol tests — independent of wd (withdraw tests above).
  const refunder = Keypair.generate()
  let refunderSetup = false

  async function ensureRefunderSetup(): Promise<void> {
    if (!refunderSetup) {
      // ensureWithdrawSetup runs sip_privacy initialize + funds wd; we only need the sip init.
      await ensureWithdrawSetup()
      // Fund the refunder (covers rent for DepositRecord + deposit + tx fees).
      await sendIx(ctx, [
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: refunder.publicKey,
          lamports: 20_000_000,
        }),
      ], [authority])
      refunderSetup = true
    }
  }

  it('refund_sol → depositor receives unlocked lamports and record.balance equals locked_amount', async function () {
    await ensureRefunderSetup()

    const depositAmount = 2_000_000n

    // Deposit so there is something to refund.
    await sendIx(ctx, [ixDepositSol(refunder.publicKey, depositAmount)], [refunder])

    // Confirm the record before the refund.
    const [recordPda] = getDepositRecordPDA(refunder.publicKey, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
    const recBefore = parseDepositRecord(await getAccountData(ctx, recordPda))
    const available = recBefore.balance - recBefore.lockedAmount
    assert.ok(available > 0n, 'no available balance to refund — test state error')

    // Snapshot depositor lamports before refund (lamports live on the system account).
    const refunderBefore = BigInt((await ctx.banksClient.getAccount(refunder.publicKey))!.lamports)
    // Snapshot sol_vault before refund — the vault side is exact (the depositor pays
    // tx fees from their own account, but the vault debit is precisely `available`).
    const solVaultBefore = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)

    // Advance the clock past the refund_timeout to satisfy the on-chain check.
    const currentClock = await ctx.banksClient.getClock()
    const { Clock } = await import('solana-bankrun')
    const newClock = new Clock(
      currentClock.slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      recBefore.lastDepositAt + REFUND_TIMEOUT + 10n,
    )
    ctx.setClock(newClock)

    await sendIx(ctx, [ixRefundSol(refunder.publicKey)], [refunder])

    // ── depositor lamports increased by exactly the available amount ──
    const refunderAfter = BigInt((await ctx.banksClient.getAccount(refunder.publicKey))!.lamports)
    // The depositor also pays tx fees, so we check the net gain ignoring fees:
    // lamports_after should be > lamports_before + available - some_fee_budget
    // To be precise, use a tolerance rather than an exact check since tx fees vary.
    const lamportGain = refunderAfter - refunderBefore
    // lamportGain = +available - tx_fees. tx_fees are tiny (< 10_000 lamports typically).
    // Assert the gain is within [available - 10_000, available] to confirm the transfer.
    assert.ok(
      lamportGain >= available - 10_000n && lamportGain <= available,
      `depositor lamport gain: expected ~+${available}, got +${lamportGain}`,
    )

    // ── sol_vault debited by exactly `available` (conservation — exact, no fee tolerance) ──
    const solVaultAfter = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)
    assert.strictEqual(
      solVaultBefore - solVaultAfter,
      available,
      `sol_vault lamport delta: expected -${available}, got -${solVaultBefore - solVaultAfter}`,
    )

    // ── record.balance == locked_amount (available portion zeroed) ──
    const recAfter = parseDepositRecord(await getAccountData(ctx, recordPda))
    assert.strictEqual(
      recAfter.balance,
      recAfter.lockedAmount,
      `record.balance should equal locked_amount after refund_sol`,
    )
    // Since locked_amount was 0, balance should also be 0.
    assert.strictEqual(recAfter.balance, 0n, 'balance should be 0 when locked_amount is 0')
  })

  it('refund_sol → rejects before timeout with RefundNotExpired (6005 / 0x1775)', async function () {
    await ensureRefunderSetup()

    const depositAmount2 = 1_000_000n

    // Deposit a fresh amount using a new keypair so the refund_timeout restarts.
    const prematureRefunder = Keypair.generate()
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: prematureRefunder.publicKey,
        lamports: 10_000_000,
      }),
    ], [authority])
    await sendIx(ctx, [ixDepositSol(prematureRefunder.publicKey, depositAmount2)], [prematureRefunder])

    // Reset clock to the current timestamp WITHOUT advancing past the timeout.
    const currentClock2 = await ctx.banksClient.getClock()
    const { Clock: Clock2 } = await import('solana-bankrun')
    // Set the unix_timestamp to "just now" — way before last_deposit_at + REFUND_TIMEOUT.
    const nowClock = new Clock2(
      currentClock2.slot,
      currentClock2.epochStartTimestamp,
      currentClock2.epoch,
      currentClock2.leaderScheduleEpoch,
      currentClock2.unixTimestamp, // do NOT advance
    )
    ctx.setClock(nowClock)

    try {
      await sendIx(ctx, [ixRefundSol(prematureRefunder.publicKey)], [prematureRefunder])
      assert.fail('Expected RefundNotExpired error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected RefundNotExpired error but transaction succeeded')) {
        throw err
      }
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(REFUND_NOT_EXPIRED_CODE)) ||
        msg.includes(REFUND_NOT_EXPIRED_HEX) ||
        msg.includes('refundnotexpired')
      assert.ok(
        matchesCode,
        `Expected RefundNotExpired (${REFUND_NOT_EXPIRED_CODE} / 0x${REFUND_NOT_EXPIRED_HEX}), got: ${err?.message ?? String(err)}`,
      )
    }
  })

  it('authority_refund_sol → authority returns lamports to original depositor (non-signer) after timeout', async function () {
    await ensureRefunderSetup()

    const depositAmount3 = 3_000_000n
    const authorityRefundDepositor = Keypair.generate()
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: authorityRefundDepositor.publicKey,
        lamports: 15_000_000,
      }),
    ], [authority])
    await sendIx(ctx, [ixDepositSol(authorityRefundDepositor.publicKey, depositAmount3)], [authorityRefundDepositor])

    const [recordPda3] = getDepositRecordPDA(authorityRefundDepositor.publicKey, NATIVE_SOL_MINT, VAULT_PROGRAM_ID)
    const rec3 = parseDepositRecord(await getAccountData(ctx, recordPda3))
    const available3 = rec3.balance - rec3.lockedAmount
    assert.ok(available3 > 0n, 'no available balance — test state error')

    // Snapshot depositor lamports before the authority refund.
    const depositorBefore = BigInt((await ctx.banksClient.getAccount(authorityRefundDepositor.publicKey))!.lamports)
    // Snapshot sol_vault before the refund (conservation: vault debit == depositor credit).
    const solVaultBefore = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)

    // Advance clock past the timeout.
    const currentClock3 = await ctx.banksClient.getClock()
    const { Clock: Clock3 } = await import('solana-bankrun')
    const fastClock = new Clock3(
      currentClock3.slot,
      currentClock3.epochStartTimestamp,
      currentClock3.epoch,
      currentClock3.leaderScheduleEpoch,
      rec3.lastDepositAt + REFUND_TIMEOUT + 10n,
    )
    ctx.setClock(fastClock)

    // authority signs; authorityRefundDepositor is the non-signer lamport destination.
    await sendIx(ctx, [
      ixAuthorityRefundSol(authorityRefundDepositor.publicKey, authority.publicKey),
    ], [authority])

    // ── depositor (non-signer) received the lamports ──
    const depositorAfter = BigInt((await ctx.banksClient.getAccount(authorityRefundDepositor.publicKey))!.lamports)
    assert.strictEqual(
      depositorAfter - depositorBefore,
      available3,
      `depositor lamport gain: expected +${available3}, got +${depositorAfter - depositorBefore}`,
    )

    // ── sol_vault debited by exactly the amount the depositor received (conservation) ──
    const solVaultAfter = BigInt((await ctx.banksClient.getAccount(solVaultPda))!.lamports)
    assert.strictEqual(
      solVaultBefore - solVaultAfter,
      available3,
      `sol_vault lamport delta: expected -${available3}, got -${solVaultBefore - solVaultAfter}`,
    )

    // ── record.balance == locked_amount ──
    const rec3After = parseDepositRecord(await getAccountData(ctx, recordPda3))
    assert.strictEqual(
      rec3After.balance,
      rec3After.lockedAmount,
      'record.balance should equal locked_amount after authority_refund_sol',
    )
  })

  it('authority_refund_sol → wrong authority is rejected with Unauthorized (6001 / 0x1771)', async function () {
    await ensureRefunderSetup()

    const wrongAuthority = Keypair.generate()
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: wrongAuthority.publicKey,
        lamports: 5_000_000,
      }),
    ], [authority])

    // Use the refunder's deposit_record that was created in the happy-path test.
    // We don't need a fresh deposit — the record may already have balance=0,
    // but the Unauthorized check fires BEFORE the balance check, so the record
    // only needs to exist (which it does from the first refund_sol test above).
    try {
      await sendIx(ctx, [
        ixAuthorityRefundSol(refunder.publicKey, wrongAuthority.publicKey),
      ], [wrongAuthority])
      assert.fail('Expected Unauthorized error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected Unauthorized error but transaction succeeded')) {
        throw err
      }
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(UNAUTHORIZED_CODE)) ||
        msg.includes(UNAUTHORIZED_HEX) ||
        msg.includes('unauthorized')
      assert.ok(
        matchesCode,
        `Expected Unauthorized (${UNAUTHORIZED_CODE} / 0x${UNAUTHORIZED_HEX}), got: ${err?.message ?? String(err)}`,
      )
    }
  })

  // ── Task 9: collect_fee_sol ──────────────────────────────────────────────
  //
  // Authority drains lamports above the rent-exempt floor from the SolFee PDA.
  // Fees accrue during withdraw_private_sol (10 bps per withdrawal).
  // collect_fee_sol(0) drains ALL collectable lamports; partial amounts also
  // supported. Wrong authority → Unauthorized (6001 / 0x1771).
  //
  // NoFeesToCollect = index 8 → 6008 / 0x1778
  const NO_FEES_CODE = 6008
  const NO_FEES_HEX = NO_FEES_CODE.toString(16) // '1778'

  // Dedicated keypair for collect_fee_sol tests — ensures the withdrawal that
  // accrues the fee is independent of refund_sol tests that zero out balances.
  const feeCollector = Keypair.generate()
  let feeCollectorSetup = false

  async function ensureFeeCollectorSetup(): Promise<void> {
    if (!feeCollectorSetup) {
      await ensureWithdrawSetup() // ensures sip_privacy initialized
      await sendIx(ctx, [
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: feeCollector.publicKey,
          lamports: 50_000_000,
        }),
      ], [authority])
      feeCollectorSetup = true
    }
  }

  it('collect_fee_sol → drains all collectable lamports to authority, sol_fee left at rent_min', async function () {
    await ensureFeeCollectorSetup()

    // Accrue a fee: deposit + withdraw. Fee = 10 bps of 1_000_000 = 1_000 lamports (floor div).
    const depositAmt = 5_000_000n
    const withdrawAmt = 1_000_000n
    const expectedFee = (withdrawAmt * BigInt(FEE_BPS)) / FEE_DENOM // 500 lamports

    await sendIx(ctx, [ixDepositSol(feeCollector.publicKey, depositAmt)], [feeCollector])

    const rent = await ctx.banksClient.getRent()
    const stealthRentMin = rent.minimumBalance(0n)
    const stealth = Keypair.generate().publicKey
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: stealth,
        lamports: Number(stealthRentMin),
      }),
    ], [authority])

    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(feeCollector.publicKey, totalTransfers)

    const p = announceParams()
    await sendIx(ctx, [
      ixWithdrawPrivateSol(
        feeCollector.publicKey,
        stealth,
        sipTransferRecordPda,
        withdrawAmt,
        p.amountCommitment,
        stealth,
        p.ephemeralPubkey,
        p.viewingKeyHash,
        p.encryptedAmount,
        p.proof,
      ),
    ], [feeCollector])

    // Confirm the fee landed in sol_fee PDA.
    const solFeeAfterWithdraw = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)
    const solFeeAcct = (await ctx.banksClient.getAccount(solFeePda))!
    const rentMin = rent.minimumBalance(BigInt(solFeeAcct.data.length))
    const collectable = solFeeAfterWithdraw - rentMin
    assert.ok(collectable > 0n, `Expected collectable > 0, got ${collectable} (fee accrued: ${expectedFee})`)

    // Snapshot authority lamports before collect.
    const authorityBefore = BigInt((await ctx.banksClient.getAccount(authority.publicKey))!.lamports)

    // collect_fee_sol(0) → drain ALL collectable.
    await sendIx(ctx, [
      ixCollectFeeSol(authority.publicKey, 0n),
    ], [authority])

    // sol_fee must be left at exactly rent_min.
    const solFeeAfterCollect = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)
    assert.strictEqual(
      solFeeAfterCollect,
      rentMin,
      `sol_fee after collect: expected ${rentMin} (rent_min), got ${solFeeAfterCollect}`,
    )

    // Authority must have received exactly collectable lamports (net of tx fee).
    // We tolerate a small tx-fee window (< 10_000 lamports) in the same way
    // as the refund_sol tests above.
    const authorityAfter = BigInt((await ctx.banksClient.getAccount(authority.publicKey))!.lamports)
    const authorityGain = authorityAfter - authorityBefore
    // authorityGain = collectable - tx_fees. Tx fees are tiny (< 10_000 lamports).
    assert.ok(
      authorityGain >= collectable - 10_000n && authorityGain <= collectable,
      `authority lamport gain: expected ~+${collectable}, got +${authorityGain}`,
    )
  })

  it('collect_fee_sol → wrong authority is rejected with Unauthorized (6001 / 0x1771)', async function () {
    await ensureFeeCollectorSetup()

    const wrongAuthority = Keypair.generate()
    await sendIx(ctx, [
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: wrongAuthority.publicKey,
        lamports: 5_000_000,
      }),
    ], [authority])

    try {
      await sendIx(ctx, [
        ixCollectFeeSol(wrongAuthority.publicKey, 0n),
      ], [wrongAuthority])
      assert.fail('Expected Unauthorized error but transaction succeeded')
    } catch (e: unknown) {
      const err = e as Error
      if (err.message && err.message.includes('Expected Unauthorized error but transaction succeeded')) {
        throw err
      }
      const msg = (err?.message ?? String(err)).toLowerCase()
      const matchesCode =
        msg.includes(String(UNAUTHORIZED_CODE)) ||
        msg.includes(UNAUTHORIZED_HEX) ||
        msg.includes('unauthorized')
      assert.ok(
        matchesCode,
        `Expected Unauthorized (${UNAUTHORIZED_CODE} / 0x${UNAUTHORIZED_HEX}), got: ${err?.message ?? String(err)}`,
      )
    }
  })
})
