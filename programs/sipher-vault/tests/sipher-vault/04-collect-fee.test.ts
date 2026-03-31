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
import {
  getVaultConfigPDA,
  getDepositRecordPDA,
  getVaultTokenPDA,
  getFeeTokenPDA,
} from './setup'

// ─────────────────────────────────────────────────────────────────────────────
// Collect fee tests use anchor-bankrun for full isolation.
//
// The test flow:
//   1. Initialize vault with 10 bps fee
//   2. Create vault_token + fee_token PDAs
//   3. Deposit tokens
//   4. withdraw_private to generate fees (fee = amount * 10 / 10000)
//   5. collect_fee to extract accumulated fees
//   6. Test authority-only access control
//   7. Test empty fee account rejection
// ─────────────────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')

describe('sipher-vault: collect_fee', () => {
  let provider: BankrunProvider
  let program: Program<SipherVault>
  let payer: Keypair

  let mint: PublicKey
  let depositorAta: PublicKey
  let authorityAta: PublicKey
  let configPDA: PublicKey
  let vaultTokenPDA: PublicKey
  let feeTokenPDA: PublicKey
  let depositRecordPDA: PublicKey
  let stealthKeypair: Keypair
  let stealthAta: PublicKey

  const FEE_BPS = 10 // 0.1%
  const DEPOSIT_AMOUNT = 1_000_000
  const WITHDRAW_AMOUNT = 100_000
  // fee = 100_000 * 10 / 10_000 = 100
  const EXPECTED_FEE = Math.floor((WITHDRAW_AMOUNT * FEE_BPS) / 10_000)
  const EXPECTED_NET = WITHDRAW_AMOUNT - EXPECTED_FEE
  const MINT_SUPPLY = 10_000_000

  before(async () => {
    const context = await startAnchor('', [], [])
    provider = new BankrunProvider(context)

    const IDL = require('../../target/idl/sipher_vault.json')
    program = new Program<SipherVault>(IDL, provider as any)

    payer = context.payer

    // ── Create SPL mint ─────────────────────────────────────────────────
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
      createInitializeMintInstruction(mint, 6, payer.publicKey, null),
    )
    createMintTx.feePayer = payer.publicKey
    createMintTx.recentBlockhash = context.lastBlockhash
    createMintTx.sign(payer, mintKeypair)
    await context.banksClient.processTransaction(createMintTx)

    // ── Create depositor ATA and fund it ────────────────────────────────
    depositorAta = getAssociatedTokenAddressSync(mint, payer.publicKey)

    const createDepositorAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        depositorAta,
        payer.publicKey,
        mint,
      ),
      createMintToInstruction(mint, depositorAta, payer.publicKey, MINT_SUPPLY),
    )
    createDepositorAtaTx.feePayer = payer.publicKey
    createDepositorAtaTx.recentBlockhash = context.lastBlockhash
    createDepositorAtaTx.sign(payer)
    await context.banksClient.processTransaction(createDepositorAtaTx)

    // ── Create authority ATA (for collecting fees) ──────────────────────
    // Authority = payer in this test; create a separate ATA to receive fees
    authorityAta = getAssociatedTokenAddressSync(mint, payer.publicKey)
    // authorityAta === depositorAta since authority === payer
    // This is fine — collect_fee just transfers to the authority's token account

    // ── Create stealth keypair + ATA for withdraw_private ───────────────
    stealthKeypair = Keypair.generate()
    stealthAta = getAssociatedTokenAddressSync(mint, stealthKeypair.publicKey)

    // Create stealth ATA (payer funds the rent)
    const clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    const createStealthAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        stealthAta,
        stealthKeypair.publicKey,
        mint,
      ),
    )
    createStealthAtaTx.feePayer = payer.publicKey
    createStealthAtaTx.recentBlockhash = (
      await provider.context.banksClient.getLatestBlockhash()
    )?.[0]!
    createStealthAtaTx.sign(payer)
    await provider.context.banksClient.processTransaction(createStealthAtaTx)

    // ── Derive PDAs ─────────────────────────────────────────────────────
    ;[configPDA] = getVaultConfigPDA(PROGRAM_ID)
    ;[vaultTokenPDA] = getVaultTokenPDA(mint, PROGRAM_ID)
    ;[feeTokenPDA] = getFeeTokenPDA(mint, PROGRAM_ID)
    ;[depositRecordPDA] = getDepositRecordPDA(payer.publicKey, mint, PROGRAM_ID)

    // ── Initialize vault (fee=10bps, timeout=86400) ─────────────────────
    await program.methods
      .initialize(FEE_BPS, new anchor.BN(0))
      .accounts({ authority: payer.publicKey })
      .rpc()

    // ── Create vault token PDA ──────────────────────────────────────────
    await program.methods
      .createVaultToken()
      .accounts({
        config: configPDA,
        tokenMint: mint,
        payer: payer.publicKey,
      })
      .rpc()

    // ── Create fee token PDA ────────────────────────────────────────────
    await program.methods
      .createFeeToken()
      .accounts({
        config: configPDA,
        tokenMint: mint,
        payer: payer.publicKey,
      })
      .rpc()

    // ── Deposit tokens ──────────────────────────────────────────────────
    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT))
      .accounts({
        config: configPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    // Sanity: verify deposit landed
    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.balance.toNumber()).to.equal(DEPOSIT_AMOUNT)

    // ── Execute withdraw_private to generate fees ───────────────────────
    // Dummy values for privacy params (not validated in Phase 1)
    const amountCommitment = Array.from(new Uint8Array(33))
    const ephemeralPubkey = Array.from(new Uint8Array(33))
    const viewingKeyHash = Array.from(new Uint8Array(32))

    await program.methods
      .withdrawPrivate(
        new anchor.BN(WITHDRAW_AMOUNT),
        amountCommitment,
        stealthKeypair.publicKey,
        ephemeralPubkey,
        viewingKeyHash,
        Buffer.from([]),
        Buffer.from([]),
      )
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultToken: vaultTokenPDA,
        feeToken: feeTokenPDA,
        stealthToken: stealthAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    // Sanity: verify fee token received the fee
    const feeBalance = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalance).to.equal(EXPECTED_FEE)
  })

  // ── Test 1: Authority collects accumulated fees ─────────────────────────

  it('authority collects accumulated fees', async () => {
    const feeBalanceBefore = await getTokenBalance(provider, feeTokenPDA)
    const authorityBalanceBefore = await getTokenBalance(provider, authorityAta)

    expect(feeBalanceBefore).to.equal(EXPECTED_FEE)
    expect(EXPECTED_FEE).to.equal(100) // 100_000 * 10 / 10_000

    // Warp slot to get a fresh blockhash
    const clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    // Collect all fees (amount=0 means collect all)
    await program.methods
      .collectFee(new anchor.BN(0))
      .accounts({
        config: configPDA,
        feeToken: feeTokenPDA,
        authorityToken: authorityAta,
        tokenMint: mint,
        authority: payer.publicKey,
      })
      .rpc()

    // Verify fee token is now empty
    const feeBalanceAfter = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalanceAfter).to.equal(0)

    // Verify authority received the fees
    const authorityBalanceAfter = await getTokenBalance(provider, authorityAta)
    expect(authorityBalanceAfter).to.equal(
      authorityBalanceBefore + EXPECTED_FEE,
    )
  })

  // ── Test 2: Non-authority cannot collect fees ───────────────────────────

  it('rejects non-authority fee collection (Unauthorized)', async () => {
    // First, generate more fees so fee_token has a balance
    // (Test 1 drained it, so we need another withdraw_private)

    // Warp to get fresh blockhash
    let clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    // Execute another withdraw_private to replenish fees
    const amountCommitment = Array.from(new Uint8Array(33))
    const ephemeralPubkey = Array.from(new Uint8Array(33))
    const viewingKeyHash = Array.from(new Uint8Array(32))

    await program.methods
      .withdrawPrivate(
        new anchor.BN(WITHDRAW_AMOUNT),
        amountCommitment,
        stealthKeypair.publicKey,
        ephemeralPubkey,
        viewingKeyHash,
        Buffer.from([]),
        Buffer.from([]),
      )
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultToken: vaultTokenPDA,
        feeToken: feeTokenPDA,
        stealthToken: stealthAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    // Verify fees exist
    const feeBalance = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalance).to.equal(EXPECTED_FEE)

    // Create a random keypair (non-authority) and their ATA
    const imposter = Keypair.generate()
    const imposterAta = getAssociatedTokenAddressSync(mint, imposter.publicKey)

    // Fund imposter with SOL for tx fees
    clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    const transferSolTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: imposter.publicKey,
        lamports: 100_000_000, // 0.1 SOL
      }),
    )
    transferSolTx.feePayer = payer.publicKey
    transferSolTx.recentBlockhash = (
      await provider.context.banksClient.getLatestBlockhash()
    )?.[0]!
    transferSolTx.sign(payer)
    await provider.context.banksClient.processTransaction(transferSolTx)

    // Create imposter ATA
    clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    const createImposterAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        imposterAta,
        imposter.publicKey,
        mint,
      ),
    )
    createImposterAtaTx.feePayer = payer.publicKey
    createImposterAtaTx.recentBlockhash = (
      await provider.context.banksClient.getLatestBlockhash()
    )?.[0]!
    createImposterAtaTx.sign(payer)
    await provider.context.banksClient.processTransaction(createImposterAtaTx)

    // Attempt fee collection as imposter
    clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    try {
      await program.methods
        .collectFee(new anchor.BN(0))
        .accounts({
          config: configPDA,
          feeToken: feeTokenPDA,
          authorityToken: imposterAta,
          tokenMint: mint,
          authority: imposter.publicKey,
        })
        .signers([imposter])
        .rpc()
      expect.fail('Should have thrown Unauthorized')
    } catch (err: any) {
      // has_one = authority constraint fires as Unauthorized or
      // Anchor ConstraintHasOne (2001 / 0x7d1)
      const hasAnchorError = err.error?.errorCode?.code === 'Unauthorized'
      const hasConstraintError =
        err.error?.errorCode?.code === 'ConstraintHasOne'
      const hasErrorInLogs = err.logs?.some(
        (log: string) =>
          log.includes('Unauthorized') ||
          log.includes('ConstraintHasOne') ||
          log.includes('0x1771') ||
          log.includes('0x7d1'),
      )
      const hasErrorInString =
        err.toString().includes('Unauthorized') ||
        err.toString().includes('ConstraintHasOne') ||
        err.toString().includes('has_one')

      expect(
        hasAnchorError ||
          hasConstraintError ||
          hasErrorInLogs ||
          hasErrorInString,
        `Expected Unauthorized/ConstraintHasOne error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Test 3: Rejects when no fees to collect ─────────────────────────────

  it('rejects when no fees to collect (NoFeesToCollect)', async () => {
    // First drain the fees so fee_token is empty
    const clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    await program.methods
      .collectFee(new anchor.BN(0))
      .accounts({
        config: configPDA,
        feeToken: feeTokenPDA,
        authorityToken: authorityAta,
        tokenMint: mint,
        authority: payer.publicKey,
      })
      .rpc()

    // Verify fee token is now empty
    const feeBalance = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalance).to.equal(0)

    // Now attempt to collect from empty account
    provider.context.warpToSlot(clock.slot + 4n)

    try {
      await program.methods
        .collectFee(new anchor.BN(0))
        .accounts({
          config: configPDA,
          feeToken: feeTokenPDA,
          authorityToken: authorityAta,
          tokenMint: mint,
          authority: payer.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown NoFeesToCollect')
    } catch (err: any) {
      const hasAnchorError = err.error?.errorCode?.code === 'NoFeesToCollect'
      const hasErrorInLogs = err.logs?.some(
        (log: string) =>
          log.includes('NoFeesToCollect') || log.includes('0x1778'),
      )
      const hasErrorInString = err.toString().includes('NoFeesToCollect')

      expect(
        hasAnchorError || hasErrorInLogs || hasErrorInString,
        `Expected NoFeesToCollect error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Test 4: Partial fee collection ──────────────────────────────────────

  it('collects partial fee amount when amount < balance', async () => {
    // Generate fees again with another withdrawal
    let clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    const amountCommitment = Array.from(new Uint8Array(33))
    const ephemeralPubkey = Array.from(new Uint8Array(33))
    const viewingKeyHash = Array.from(new Uint8Array(32))

    await program.methods
      .withdrawPrivate(
        new anchor.BN(WITHDRAW_AMOUNT),
        amountCommitment,
        stealthKeypair.publicKey,
        ephemeralPubkey,
        viewingKeyHash,
        Buffer.from([]),
        Buffer.from([]),
      )
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultToken: vaultTokenPDA,
        feeToken: feeTokenPDA,
        stealthToken: stealthAta,
        tokenMint: mint,
        depositor: payer.publicKey,
      })
      .rpc()

    const feeBalanceBefore = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalanceBefore).to.equal(EXPECTED_FEE) // 100

    const authorityBalanceBefore = await getTokenBalance(provider, authorityAta)

    // Collect only 40 of 100 available fees
    const partialAmount = 40
    clock = await provider.context.banksClient.getClock()
    provider.context.warpToSlot(clock.slot + 2n)

    await program.methods
      .collectFee(new anchor.BN(partialAmount))
      .accounts({
        config: configPDA,
        feeToken: feeTokenPDA,
        authorityToken: authorityAta,
        tokenMint: mint,
        authority: payer.publicKey,
      })
      .rpc()

    // Verify partial collection
    const feeBalanceAfter = await getTokenBalance(provider, feeTokenPDA)
    expect(feeBalanceAfter).to.equal(EXPECTED_FEE - partialAmount)

    const authorityBalanceAfter = await getTokenBalance(provider, authorityAta)
    expect(authorityBalanceAfter).to.equal(
      authorityBalanceBefore + partialAmount,
    )
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
