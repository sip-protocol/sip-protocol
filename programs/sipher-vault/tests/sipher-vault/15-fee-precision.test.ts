// tests/sipher-vault/15-fee-precision.test.ts
//
// Proves the tenths-of-bps fee unit: a 7.5 bps rate (fee_tenths_bps = 75) is
// exactly representable and applied as fee = amount * 75 / 100_000.

import { assert } from 'chai'
import { Keypair, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'
import { randomBytes } from 'crypto'

import {
  getSolVaultPDA,
  getSolFeePDA,
  getSipConfigPDA,
  getSipTransferRecordPDA,
} from './setup'
import {
  VAULT_PROGRAM_ID,
  startVault,
  sendIx,
  ixInitialize,
  ixCreateSolVault,
  ixDepositSol,
  ixWithdrawPrivateSol,
  ixSipPrivacyInitialize,
  getAccountData,
  parseSipConfig,
} from './bankrun-helpers'

const FEE_TENTHS_BPS = 75 // 7.5 bps
const REFUND_TIMEOUT = 5n

describe('15 · fee precision (7.5 bps)', function () {
  this.timeout(120_000)

  let ctx: ProgramTestContext
  let authority: Keypair
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)

  before(async function () {
    ctx = await startVault()
    authority = ctx.payer
    await sendIx(ctx, [ixInitialize(authority.publicKey, FEE_TENTHS_BPS, REFUND_TIMEOUT)], [authority])
    await sendIx(ctx, [ixCreateSolVault(authority.publicKey)], [authority])
    await sendIx(ctx, [ixSipPrivacyInitialize(authority.publicKey, 50)], [authority])
  })

  function announceParams() {
    return {
      amountCommitment: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]),
      ephemeralPubkey: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]),
      viewingKeyHash: randomBytes(32),
      encryptedAmount: Buffer.from([]),
      proof: Buffer.from([]),
    }
  }

  async function withdrawAndMeasureFee(withdrawAmount: bigint): Promise<bigint> {
    const wd = Keypair.generate()
    await sendIx(ctx, [SystemProgram.transfer({
      fromPubkey: authority.publicKey, toPubkey: wd.publicKey, lamports: 60_000_000_000,
    })], [authority])
    await sendIx(ctx, [ixDepositSol(wd.publicKey, withdrawAmount + 1_000_000_000n)], [wd])

    const rent = await ctx.banksClient.getRent()
    const stealth = Keypair.generate().publicKey
    await sendIx(ctx, [SystemProgram.transfer({
      fromPubkey: authority.publicKey, toPubkey: stealth, lamports: Number(rent.minimumBalance(0n)),
    })], [authority])

    const feeBefore = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)

    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(wd.publicKey, totalTransfers)

    const p = announceParams()
    await sendIx(ctx, [ixWithdrawPrivateSol(
      wd.publicKey, stealth, sipTransferRecordPda, withdrawAmount,
      p.amountCommitment, stealth, p.ephemeralPubkey, p.viewingKeyHash, p.encryptedAmount, p.proof,
    )], [wd])

    const feeAfter = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)
    return feeAfter - feeBefore
  }

  it('charges exactly 7.5 bps on a 10 SOL withdrawal (0.0075 SOL)', async function () {
    const fee = await withdrawAndMeasureFee(10_000_000_000n) // 10 SOL
    assert.strictEqual(fee, 7_500_000n, 'fee must be exactly 0.0075 SOL')
  })

  it('floors the sub-lamport remainder (100_001 → 75)', async function () {
    const fee = await withdrawAndMeasureFee(100_001n) // 100_001 * 75 / 100_000 = 75.00075 → 75
    assert.strictEqual(fee, 75n)
  })
})
