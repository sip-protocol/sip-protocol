import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import {
  getVaultConfigPDA,
  getDepositRecordPDA,
  getVaultTokenPDA,
  setupTestMint,
  setupTokenAccount,
} from './setup'

describe('sipher-vault: deposit', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>
  const authority = (provider.wallet as anchor.Wallet).payer

  const [configPDA] = getVaultConfigPDA(program.programId)

  // Shared state across tests (sequential execution in Mocha)
  let mint: anchor.web3.PublicKey
  let depositorAta: anchor.web3.PublicKey
  let vaultTokenPDA: anchor.web3.PublicKey
  let depositRecordPDA: anchor.web3.PublicKey

  const DEPOSIT_AMOUNT_1 = 500_000
  const DEPOSIT_AMOUNT_2 = 200_000
  const MINT_SUPPLY = 10_000_000

  before(async () => {
    // Create a test SPL mint (authority = wallet keypair)
    mint = await setupTestMint(provider, authority, 6)

    // Create depositor's ATA and fund it
    depositorAta = await setupTokenAccount(
      provider,
      mint,
      authority.publicKey,
      authority,
      MINT_SUPPLY,
    )

    // Derive PDAs
    ;[vaultTokenPDA] = getVaultTokenPDA(mint, program.programId)
    ;[depositRecordPDA] = getDepositRecordPDA(
      authority.publicKey,
      mint,
      program.programId,
    )

    // Create the vault token PDA via the program instruction
    // (must exist before first deposit)
    await program.methods
      .createVaultToken()
      .accounts({
        config: configPDA,
        tokenMint: mint,
        payer: authority.publicKey,
      })
      .rpc()
  })

  // ── Test 1: First deposit creates record ───────────────────────────────

  it('deposits tokens and creates deposit record', async () => {
    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT_1))
      .accounts({
        config: configPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        tokenMint: mint,
        depositor: authority.publicKey,
      })
      .rpc()

    // Verify deposit record
    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.depositor.toString()).to.equal(authority.publicKey.toString())
    expect(record.tokenMint.toString()).to.equal(mint.toString())
    expect(record.balance.toNumber()).to.equal(DEPOSIT_AMOUNT_1)
    expect(record.lockedAmount.toNumber()).to.equal(0)
    expect(record.cumulativeVolume.toNumber()).to.equal(DEPOSIT_AMOUNT_1)
    expect(record.lastDepositAt.toNumber()).to.be.greaterThan(0)
    expect(record.bump).to.be.a('number')

    // Verify global counters
    const config = await program.account.vaultConfig.fetch(configPDA)
    expect(config.totalDeposits.toNumber()).to.equal(1)
    expect(config.totalDepositors.toNumber()).to.equal(1)

    // Verify vault token balance
    const vaultAccount = await provider.connection.getTokenAccountBalance(
      vaultTokenPDA,
    )
    expect(Number(vaultAccount.value.amount)).to.equal(DEPOSIT_AMOUNT_1)
  })

  // ── Test 2: Second deposit adds to existing record ─────────────────────

  it('adds to existing deposit record on second deposit', async () => {
    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT_2))
      .accounts({
        config: configPDA,
        vaultToken: vaultTokenPDA,
        depositorToken: depositorAta,
        tokenMint: mint,
        depositor: authority.publicKey,
      })
      .rpc()

    const expectedBalance = DEPOSIT_AMOUNT_1 + DEPOSIT_AMOUNT_2
    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.balance.toNumber()).to.equal(expectedBalance)
    expect(record.cumulativeVolume.toNumber()).to.equal(expectedBalance)

    // Global counter: total_deposits incremented, total_depositors unchanged
    const config = await program.account.vaultConfig.fetch(configPDA)
    expect(config.totalDeposits.toNumber()).to.equal(2)
    expect(config.totalDepositors.toNumber()).to.equal(1) // same depositor

    // Vault token balance reflects both deposits
    const vaultAccount = await provider.connection.getTokenAccountBalance(
      vaultTokenPDA,
    )
    expect(Number(vaultAccount.value.amount)).to.equal(expectedBalance)
  })

  // ── Test 3: Zero deposit rejected ──────────────────────────────────────

  it('rejects zero deposit', async () => {
    try {
      await program.methods
        .deposit(new anchor.BN(0))
        .accounts({
          config: configPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          tokenMint: mint,
          depositor: authority.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown ZeroDeposit')
    } catch (err: any) {
      const hasAnchorError = err.error?.errorCode?.code === 'ZeroDeposit'
      const hasErrorInLogs = err.logs?.some(
        (log: string) => log.includes('ZeroDeposit') || log.includes('0x1774'),
      )
      const hasErrorInString = err.toString().includes('ZeroDeposit')

      expect(
        hasAnchorError || hasErrorInLogs || hasErrorInString,
        `Expected ZeroDeposit error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Test 4: Deposit when paused ────────────────────────────────────────
  // No `pause` instruction exists in Phase 1. Marking as pending.
  // When a `set_paused` instruction is added, this test should:
  // 1. Call set_paused(true) as authority
  // 2. Attempt deposit -> expect ProgramPaused error
  // 3. Call set_paused(false) to restore state for subsequent tests

  it.skip('rejects deposit when paused (pending: no pause instruction in Phase 1)')
})
