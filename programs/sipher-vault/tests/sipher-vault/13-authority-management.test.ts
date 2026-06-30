// tests/sipher-vault/13-authority-management.test.ts
//
// M1 — two-step authority transfer (update_authority / accept_authority) +
// update_fee. These are the config-authority lifecycle instructions the mainnet
// plan needs in order to hand control to a multisig WITHOUT redeploying a live
// custody program, and to adjust the fee without a redeploy.
//
// IDL-free bankrun harness (raw instructions). Each test gets a fresh vault via
// beforeEach so authority mutations never leak across tests.

import { assert } from 'chai'
import { Keypair, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'

import {
  ixInitialize,
  ixUpdateAuthority,
  ixAcceptAuthority,
  ixUpdateFee,
  sendIx,
  startVault,
  getAccountData,
  parseVaultConfig,
  assertFails,
  VAULT_PROGRAM_ID,
} from './bankrun-helpers'
import { getVaultConfigPDA, MAX_FEE_TENTHS_BPS } from './setup'

describe('13 · authority management (M1: two-step transfer + update_fee)', () => {
  let ctx: ProgramTestContext
  let authority: Keypair

  const FEE_TENTHS_BPS = 100
  const REFUND_TIMEOUT = 86400n

  // Anchor custom errors start at 6000.
  //   Unauthorized = 6001 (0x1771), FeeTooHigh = 6007 (0x1777).

  // Fresh vault per test — authority changes in some tests, so isolation matters.
  beforeEach(async () => {
    ctx = await startVault()
    authority = ctx.payer
    await sendIx(ctx, [ixInitialize(authority.publicKey, FEE_TENTHS_BPS, REFUND_TIMEOUT)], [authority])
  })

  async function readConfig() {
    const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
    return parseVaultConfig(await getAccountData(ctx, configPda))
  }

  // Fund a fresh keypair from the authority so it can pay its own tx fees.
  async function fund(kp: Keypair, lamports: number): Promise<void> {
    await sendIx(ctx, [
      SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: kp.publicKey, lamports }),
    ], [authority])
  }

  // ── update_authority (propose) ────────────────────────────────────────────

  it('update_authority → records pending_authority; current authority unchanged', async () => {
    const newAuth = Keypair.generate()
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, newAuth.publicKey)], [authority])

    const cfg = await readConfig()
    assert.ok(cfg.pendingAuthority?.equals(newAuth.publicKey), 'pending_authority should be the proposed key')
    assert.ok(cfg.authority.equals(authority.publicKey), 'authority must NOT change until accept')
  })

  it('update_authority → a second proposal overwrites the pending authority', async () => {
    const first = Keypair.generate()
    const second = Keypair.generate()
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, first.publicKey)], [authority])
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, second.publicKey)], [authority])

    const cfg = await readConfig()
    assert.ok(cfg.pendingAuthority?.equals(second.publicKey), 'a re-proposal must overwrite pending_authority')
  })

  it('update_authority → rejects a non-authority proposer (Unauthorized)', async () => {
    const attacker = Keypair.generate()
    await fund(attacker, 5_000_000)
    const newAuth = Keypair.generate()
    await assertFails(
      () => sendIx(ctx, [ixUpdateAuthority(attacker.publicKey, newAuth.publicKey)], [attacker]),
      ['unauthorized', '1771'],
    )
  })

  // ── accept_authority (accept) ─────────────────────────────────────────────

  it('accept_authority → promotes the pending authority and clears pending', async () => {
    const newAuth = Keypair.generate()
    await fund(newAuth, 5_000_000)
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, newAuth.publicKey)], [authority])
    await sendIx(ctx, [ixAcceptAuthority(newAuth.publicKey)], [newAuth])

    const cfg = await readConfig()
    assert.ok(cfg.authority.equals(newAuth.publicKey), 'authority should be the promoted key')
    assert.strictEqual(cfg.pendingAuthority, null, 'pending_authority must be cleared after accept')
  })

  it('accept_authority → rejects a key that is not the pending authority', async () => {
    const newAuth = Keypair.generate()
    const impostor = Keypair.generate()
    await fund(impostor, 5_000_000)
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, newAuth.publicKey)], [authority])
    await assertFails(
      () => sendIx(ctx, [ixAcceptAuthority(impostor.publicKey)], [impostor]),
      ['unauthorized', '1771'],
    )
  })

  it('accept_authority → rejects when there is no pending transfer', async () => {
    const someone = Keypair.generate()
    await fund(someone, 5_000_000)
    await assertFails(
      () => sendIx(ctx, [ixAcceptAuthority(someone.publicKey)], [someone]),
      ['unauthorized', '1771'],
    )
  })

  // ── update_fee ────────────────────────────────────────────────────────────

  it('update_fee → authority sets a new fee within the cap', async () => {
    await sendIx(ctx, [ixUpdateFee(authority.publicKey, 50)], [authority])
    const cfg = await readConfig()
    assert.strictEqual(cfg.feeTenthsBps, 50, 'fee_tenths_bps should be updated')
  })

  it('update_fee → rejects a non-authority (Unauthorized)', async () => {
    const attacker = Keypair.generate()
    await fund(attacker, 5_000_000)
    await assertFails(
      () => sendIx(ctx, [ixUpdateFee(attacker.publicKey, 20)], [attacker]),
      ['unauthorized', '1771'],
    )
  })

  it('update_fee → rejects a fee above MAX_FEE_TENTHS_BPS (FeeTooHigh)', async () => {
    await assertFails(
      () => sendIx(ctx, [ixUpdateFee(authority.publicKey, MAX_FEE_TENTHS_BPS + 1)], [authority]),
      ['feetoohigh', '1777'],
    )
  })

  // ── end-to-end: control actually moves ──────────────────────────────────────

  it('after handoff → the old authority loses control; the new authority gains it', async () => {
    const newAuth = Keypair.generate()
    await fund(newAuth, 5_000_000)
    await sendIx(ctx, [ixUpdateAuthority(authority.publicKey, newAuth.publicKey)], [authority])
    await sendIx(ctx, [ixAcceptAuthority(newAuth.publicKey)], [newAuth])

    // Old authority can no longer update the fee.
    await assertFails(
      () => sendIx(ctx, [ixUpdateFee(authority.publicKey, 20)], [authority]),
      ['unauthorized', '1771'],
    )

    // New authority can.
    await sendIx(ctx, [ixUpdateFee(newAuth.publicKey, 25)], [newAuth])
    const cfg = await readConfig()
    assert.strictEqual(cfg.feeTenthsBps, 25, 'the promoted authority should control the fee')
  })
})
