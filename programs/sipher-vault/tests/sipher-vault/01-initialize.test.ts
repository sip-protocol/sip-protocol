import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import {
  getVaultConfigPDA,
  MAX_FEE_TENTHS_BPS,
  DEFAULT_REFUND_TIMEOUT,
} from './setup'

describe('sipher-vault: initialize', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>
  const authority = provider.wallet as anchor.Wallet

  const [configPDA] = getVaultConfigPDA(program.programId)

  // ── Constraint test: runs BEFORE happy path (PDA doesn't exist yet) ────
  // The require!(fee_tenths_bps <= MAX_FEE_TENTHS_BPS) check executes before
  // the PDA init instruction, so this fails with FeeTooHigh, not "already in use".

  it('rejects fee above MAX_FEE_TENTHS_BPS (1001)', async () => {
    try {
      await program.methods
        .initialize(MAX_FEE_TENTHS_BPS + 1, new anchor.BN(3600))
        .accounts({
          authority: authority.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown FeeTooHigh')
    } catch (err: any) {
      // Anchor surfaces custom program errors via err.error.errorCode
      // or as part of the SendTransactionError logs
      const hasAnchorError = err.error?.errorCode?.code === 'FeeTooHigh'
      const hasErrorInLogs = err.logs?.some(
        (log: string) => log.includes('FeeTooHigh') || log.includes('0x1777')
      )
      const hasErrorInString = err.toString().includes('FeeTooHigh')

      expect(
        hasAnchorError || hasErrorInLogs || hasErrorInString,
        `Expected FeeTooHigh error, got: ${err.message || err}`,
      ).to.be.true
    }
  })

  // ── Happy path: initialize with timeout=0 to verify DEFAULT fallback ───
  // Strategy: Use timeout=0 as the actual init so we can verify the
  // DEFAULT_REFUND_TIMEOUT fallback in the on-chain state.

  it('initializes with zero timeout, falls back to DEFAULT_REFUND_TIMEOUT', async () => {
    const feeTenthsBps = 100 // 10 bps list price

    await program.methods
      .initialize(feeTenthsBps, new anchor.BN(0))
      .accounts({
        authority: authority.publicKey,
      })
      .rpc()

    const config = await program.account.vaultConfig.fetch(configPDA)
    expect(config.authority.toString()).to.equal(
      authority.publicKey.toString(),
    )
    expect(config.feeTenthsBps).to.equal(feeTenthsBps)
    // refund_timeout=0 should fall back to DEFAULT_REFUND_TIMEOUT (86400)
    expect(config.refundTimeout.toNumber()).to.equal(DEFAULT_REFUND_TIMEOUT)
    expect(config.paused).to.equal(false)
    expect(config.totalDeposits.toNumber()).to.equal(0)
    expect(config.totalDepositors.toNumber()).to.equal(0)
    expect(config.bump).to.be.a('number')
  })

  // ── Boundary test: fee at MAX_FEE_TENTHS_BPS ───────────────────────────

  it('fee_tenths_bps at boundary (1000) does not trigger FeeTooHigh', async () => {
    // PDA already exists. If fee=1000 were invalid, FeeTooHigh would fire
    // before the init check. The error must be "already in use" instead.
    try {
      await program.methods
        .initialize(MAX_FEE_TENTHS_BPS, new anchor.BN(3600))
        .accounts({
          authority: authority.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown — PDA already exists')
    } catch (err: any) {
      const errStr = err.toString()
      expect(errStr).to.not.include('FeeTooHigh')
    }
  })

  // ── Re-init protection ─────────────────────────────────────────────────

  it('rejects re-initialization (PDA already exists)', async () => {
    try {
      await program.methods
        .initialize(10, new anchor.BN(3600))
        .accounts({
          authority: authority.publicKey,
        })
        .rpc()
      expect.fail('Should have thrown — config PDA already initialized')
    } catch (err: any) {
      // Anchor/Solana rejects `init` on an already-allocated account
      // with "already in use" at the runtime level
      const errStr = err.toString()
      const isAlreadyInUse = errStr.includes('already in use')
      const isCustomError = errStr.includes('custom program error')
      const hasLogs = err.logs?.length > 0

      expect(
        isAlreadyInUse || isCustomError || hasLogs,
        `Expected PDA-already-exists error, got: ${errStr}`,
      ).to.be.true
    }
  })
})
