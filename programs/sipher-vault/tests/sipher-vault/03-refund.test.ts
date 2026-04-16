import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
} from '@solana/spl-token'
import { BankrunProvider, startAnchor } from 'anchor-bankrun'
import { Clock } from 'solana-bankrun'
import {
  getVaultConfigPDA,
  getDepositRecordPDA,
  getVaultTokenPDA,
  DEFAULT_REFUND_TIMEOUT,
} from './setup'

// ─────────────────────────────────────────────────────────────────────────────
// Refund tests use anchor-bankrun to control the Clock sysvar.
//
// The refund instruction enforces a timeout check:
//   elapsed = now - last_deposit_at >= config.refund_timeout
//
// With refund_timeout=86400 (24h), standard anchor tests can't advance time.
// Bankrun's ProgramTestContext.setClock() lets us warp the unix timestamp
// forward, enabling full happy-path and error-path coverage.
// ─────────────────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')

describe('sipher-vault: refund', () => {
  let provider: BankrunProvider
  let program: Program<SipherVault>
  let payer: Keypair

  let mint: PublicKey
  let depositorAta: PublicKey
  let configPDA: PublicKey
  let vaultTokenPDA: PublicKey
  let depositRecordPDA: PublicKey

  const DEPOSIT_AMOUNT_1 = 500_000
  const DEPOSIT_AMOUNT_2 = 200_000
  const TOTAL_DEPOSITED = DEPOSIT_AMOUNT_1 + DEPOSIT_AMOUNT_2
  const MINT_SUPPLY = 10_000_000

  before(async () => {
    // Spin up a bankrun environment with the program deployed
    // startAnchor path is relative to CWD — anchor test runs from project root
    const context = await startAnchor('', [], [])
    provider = new BankrunProvider(context)

    const IDL = require('../../target/idl/sipher_vault.json')
    program = new Program<SipherVault>(IDL, provider as any)

    payer = context.payer

    // ── Create SPL mint via raw transaction ──────────────────────────────
    const mintKeypair = Keypair.generate()
    mint = mintKeypair.publicKey

    const lamports = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE)
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint,
        6,
        payer.publicKey,
        null,
      ),
    )
    createMintTx.feePayer = payer.publicKey
    createMintTx.recentBlockhash = context.lastBlockhash
    createMintTx.sign(payer, mintKeypair)
    await context.banksClient.processTransaction(createMintTx)

    // ── Create depositor ATA and fund it ─────────────────────────────────
    depositorAta = getAssociatedTokenAddressSync(mint, payer.publicKey)

    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        depositorAta,
        payer.publicKey,
        mint,
      ),
      createMintToInstruction(
        mint,
        depositorAta,
        payer.publicKey,
        MINT_SUPPLY,
      ),
    )
    createAtaTx.feePayer = payer.publicKey
    createAtaTx.recentBlockhash = context.lastBlockhash
    createAtaTx.sign(payer)
    await context.banksClient.processTransaction(createAtaTx)

    // ── Derive PDAs ──────────────────────────────────────────────────────
    ;[configPDA] = getVaultConfigPDA(PROGRAM_ID)
    ;[vaultTokenPDA] = getVaultTokenPDA(mint, PROGRAM_ID)
    ;[depositRecordPDA] = getDepositRecordPDA(payer.publicKey, mint, PROGRAM_ID)

    // ── Initialize vault (refund_timeout falls back to 86400) ────────────
    await program.methods
      .initialize(10, new anchor.BN(0))
      .accounts({ authority: payer.publicKey })
      .rpc()

    // ── Create vault token PDA ───────────────────────────────────────────
    await program.methods
      .createVaultToken()
      .accounts({
        config: configPDA,
        tokenMint: mint,
        payer: payer.publicKey,
      })
      .rpc()

    // ── Deposit 500k + 200k = 700k ──────────────────────────────────────
    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT_1))
      .accounts({
        config: configPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT_2))
      .accounts({
        config: configPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    // Sanity: verify deposits landed
    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.balance.toNumber()).to.equal(TOTAL_DEPOSITED)
    expect(record.lockedAmount.toNumber()).to.equal(0)
  })

  // ── Test 1: RefundNotExpired fires before timeout elapses ──────────────

  it('rejects refund before timeout expires (RefundNotExpired)', async () => {
    try {
      await program.methods
        .refund()
        .accounts({
          config: configPDA,
          depositRecord: depositRecordPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          depositor: payer.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown RefundNotExpired')
    } catch (err: any) {
      const hasAnchorError = err.error?.errorCode?.code === 'RefundNotExpired'
      const hasErrorInLogs = err.logs?.some(
        (log: string) =>
          log.includes('RefundNotExpired') || log.includes('0x1775'),
      )
      const hasErrorInString = err.toString().includes('RefundNotExpired')

      expect(
        hasAnchorError || hasErrorInLogs || hasErrorInString,
        `Expected RefundNotExpired error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Test 2: Happy-path refund after warping time past timeout ──────────

  it('refunds available balance to depositor after timeout', async () => {
    // Snapshot balances before refund
    const recordBefore = await program.account.depositRecord.fetch(
      depositRecordPDA,
    )
    const depositorBalanceBefore = await getTokenBalance(
      provider,
      depositorAta,
    )
    const vaultBalanceBefore = await getTokenBalance(provider, vaultTokenPDA)
    const availableToRefund =
      recordBefore.balance.toNumber() - recordBefore.lockedAmount.toNumber()

    expect(availableToRefund).to.equal(TOTAL_DEPOSITED)
    expect(vaultBalanceBefore).to.equal(TOTAL_DEPOSITED)

    // Warp the bank forward to generate a fresh blockhash — without this,
    // bankrun deduplicates the refund() tx (same accounts, same blockhash as
    // the failed RefundNotExpired call in Test 1). setClock only updates the
    // sysvar; warpToSlot actually advances the bank's internal slot counter.
    const clock = await provider.context.banksClient.getClock()
    const warpedSlot = clock.slot + 2n
    provider.context.warpToSlot(warpedSlot)

    // Now set the clock timestamp past the refund timeout (86400s + 1s buffer)
    const warpedTimestamp =
      clock.unixTimestamp + BigInt(DEFAULT_REFUND_TIMEOUT) + 1n
    provider.context.setClock(
      new Clock(
        warpedSlot,
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        warpedTimestamp,
      ),
    )

    // Execute refund
    await program.methods
      .refund()
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        depositor: payer.publicKey,
      })
      .rpc()

    // Verify deposit record: balance should drop to locked_amount (0)
    const recordAfter = await program.account.depositRecord.fetch(
      depositRecordPDA,
    )
    expect(recordAfter.balance.toNumber()).to.equal(
      recordAfter.lockedAmount.toNumber(),
    )
    expect(recordAfter.balance.toNumber()).to.equal(0)

    // Verify depositor received the refunded tokens
    const depositorBalanceAfter = await getTokenBalance(
      provider,
      depositorAta,
    )
    expect(depositorBalanceAfter).to.equal(
      depositorBalanceBefore + availableToRefund,
    )

    // Verify vault token balance decreased
    const vaultBalanceAfter = await getTokenBalance(provider, vaultTokenPDA)
    expect(vaultBalanceAfter).to.equal(
      vaultBalanceBefore - availableToRefund,
    )
    expect(vaultBalanceAfter).to.equal(0)
  })

  // ── Test 3: NothingToRefund after full refund ──────────────────────────

  it('rejects refund when nothing to refund (NothingToRefund)', async () => {
    // Advance the bank slot to force a fresh blockhash — without this, bankrun
    // deduplicates the identical refund() tx from Test 2 at the transport layer
    // before the program ever executes.
    const clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    // Post-refund: balance=0, locked_amount=0 -> available=0
    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.balance.toNumber()).to.equal(0)

    try {
      await program.methods
        .refund()
        .accounts({
          config: configPDA,
          depositRecord: depositRecordPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          depositor: payer.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown NothingToRefund')
    } catch (err: any) {
      const hasAnchorError = err.error?.errorCode?.code === 'NothingToRefund'
      const hasErrorInLogs = err.logs?.some(
        (log: string) =>
          log.includes('NothingToRefund') || log.includes('0x1776'),
      )
      const hasErrorInString = err.toString().includes('NothingToRefund')

      expect(
        hasAnchorError || hasErrorInLogs || hasErrorInString,
        `Expected NothingToRefund error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Authority Refund tests ──────────────────────────────────────────────

  describe('authority_refund', () => {
    // Re-deposit so there's balance to refund (previous tests emptied it)
    before(async () => {
      // Advance slot for fresh blockhash
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      await program.methods
        .deposit(new anchor.BN(DEPOSIT_AMOUNT_1))
        .accounts({
          config: configPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          tokenMint: mint,
          depositor: payer.publicKey,
        })
        .rpc()

      const record = await program.account.depositRecord.fetch(depositRecordPDA)
      expect(record.balance.toNumber()).to.equal(DEPOSIT_AMOUNT_1)
    })

    it('rejects authority_refund before timeout (RefundNotExpired)', async () => {
      // Don't advance time — deposit just happened
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      try {
        await program.methods
          .authorityRefund()
          .accounts({
            config: configPDA,
            depositRecord: depositRecordPDA,
            vaultToken: vaultTokenPDA,
            depositorToken: depositorAta,
            depositor: payer.publicKey,
            authority: payer.publicKey,
          })
          .rpc()
        expect.fail('Should have thrown RefundNotExpired')
      } catch (err: any) {
        const hasError =
          err.error?.errorCode?.code === 'RefundNotExpired' ||
          err.logs?.some((log: string) => log.includes('RefundNotExpired')) ||
          err.toString().includes('RefundNotExpired')
        expect(hasError, `Expected RefundNotExpired, got: ${err.message || err}`).to.be.true
      }
    })

    it('rejects authority_refund from non-authority signer (Unauthorized)', async () => {
      const fakeSigner = Keypair.generate()

      // Fund the fake signer so it can pay tx fees
      const transferIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: fakeSigner.publicKey,
        lamports: 100_000_000,
      })
      const fundTx = new Transaction().add(transferIx)
      fundTx.feePayer = payer.publicKey
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)
      fundTx.recentBlockhash = provider.context.lastBlockhash
      fundTx.sign(payer)
      await provider.context.banksClient.processTransaction(fundTx)

      // Warp past timeout so only the auth check should fail
      const clock2 = await provider.context.banksClient.getClock()
      const warpedSlot = clock2.slot + 2n
      provider.context.warpToSlot(warpedSlot)
      const warpedTimestamp = clock2.unixTimestamp + BigInt(DEFAULT_REFUND_TIMEOUT) + 1n
      provider.context.setClock(
        new Clock(warpedSlot, clock2.epochStartTimestamp, clock2.epoch, clock2.leaderScheduleEpoch, warpedTimestamp),
      )

      try {
        await program.methods
          .authorityRefund()
          .accounts({
            config: configPDA,
            depositRecord: depositRecordPDA,
            vaultToken: vaultTokenPDA,
            depositorToken: depositorAta,
            depositor: payer.publicKey,
            authority: fakeSigner.publicKey,
          })
          .signers([fakeSigner])
          .rpc()
        expect.fail('Should have thrown Unauthorized')
      } catch (err: any) {
        const hasError =
          err.error?.errorCode?.code === 'Unauthorized' ||
          err.logs?.some((log: string) => log.includes('Unauthorized') || log.includes('has_one')) ||
          err.toString().includes('Unauthorized') ||
          err.toString().includes('ConstraintHasOne') ||
          err.toString().includes('2001')
        expect(hasError, `Expected Unauthorized, got: ${err.message || err}`).to.be.true
      }
    })

    it('authority_refund succeeds after timeout (authority signs, tokens return to depositor)', async () => {
      // Time is already warped past timeout from the previous test
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      const depositorBalanceBefore = await getTokenBalance(provider, depositorAta)
      const vaultBalanceBefore = await getTokenBalance(provider, vaultTokenPDA)
      const record = await program.account.depositRecord.fetch(depositRecordPDA)
      const availableToRefund = record.balance.toNumber() - record.lockedAmount.toNumber()

      expect(availableToRefund).to.equal(DEPOSIT_AMOUNT_1)

      await program.methods
        .authorityRefund()
        .accounts({
          config: configPDA,
          depositRecord: depositRecordPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          depositor: payer.publicKey,
          authority: payer.publicKey,
        })
        .rpc()

      // Verify: deposit record balance zeroed
      const recordAfter = await program.account.depositRecord.fetch(depositRecordPDA)
      expect(recordAfter.balance.toNumber()).to.equal(recordAfter.lockedAmount.toNumber())
      expect(recordAfter.balance.toNumber()).to.equal(0)

      // Verify: depositor received tokens
      const depositorBalanceAfter = await getTokenBalance(provider, depositorAta)
      expect(depositorBalanceAfter).to.equal(depositorBalanceBefore + availableToRefund)

      // Verify: vault balance decreased
      const vaultBalanceAfter = await getTokenBalance(provider, vaultTokenPDA)
      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore - availableToRefund)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getTokenBalance(
  provider: BankrunProvider,
  tokenAccount: PublicKey,
): Promise<number> {
  const info = await provider.connection.getAccountInfo(tokenAccount)
  if (!info) throw new Error(`Token account not found: ${tokenAccount}`)
  // SPL Token account data: offset 64 = amount (u64 LE)
  const amount = info.data.readBigUInt64LE(64)
  return Number(amount)
}
