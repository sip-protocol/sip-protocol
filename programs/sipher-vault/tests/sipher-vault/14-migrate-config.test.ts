// tests/sipher-vault/14-migrate-config.test.ts
//
// migrate_config — grows a legacy (pre-M1, 68-byte) VaultConfig to the current
// 101-byte layout by appending pending_authority = None. Authority-gated,
// idempotent. IDL-free bankrun harness (raw instructions).

import { assert } from 'chai'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'

import {
  ixInitialize,
  ixMigrateConfig,
  ixUpdateFee,
  sendIx,
  startVault,
  getAccountData,
  parseVaultConfig,
  assertFails,
  VAULT_PROGRAM_ID,
} from './bankrun-helpers'
import { getVaultConfigPDA } from './setup'

const LEGACY_LEN = 68
const NEW_LEN = 101

describe('14 · migrate_config (B6 VaultConfig layout migration)', () => {
  let ctx: ProgramTestContext
  let authority: Keypair
  let configPda: PublicKey
  let bump: number
  // Real VaultConfig account discriminator, derived empirically from a live
  // initialize so synthetic legacy accounts carry the exact discriminator the
  // typed handlers (e.g. update_fee) check.
  let configDisc: Buffer

  before(async () => {
    const tmp = await startVault()
    const [pda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
    await sendIx(tmp, [ixInitialize(tmp.payer.publicKey, 10, 86400n)], [tmp.payer])
    configDisc = Buffer.from((await getAccountData(tmp, pda)).subarray(0, 8))
  })

  beforeEach(async () => {
    ctx = await startVault()
    authority = ctx.payer
    ;[configPda, bump] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  })

  async function plantLegacy(opts: {
    authority: PublicKey
    feeTenthsBps: number
    refundTimeout: bigint
    paused: boolean
    totalDeposits: bigint
    totalDepositors: bigint
  }): Promise<void> {
    const d = Buffer.alloc(LEGACY_LEN)
    configDisc.copy(d, 0)
    opts.authority.toBuffer().copy(d, 8)
    d.writeUInt16LE(opts.feeTenthsBps, 40)
    d.writeBigInt64LE(opts.refundTimeout, 42)
    d.writeUInt8(opts.paused ? 1 : 0, 50)
    d.writeBigUInt64LE(opts.totalDeposits, 51)
    d.writeBigUInt64LE(opts.totalDepositors, 59)
    d.writeUInt8(bump, 67)
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, {
      lamports: Number(rent.minimumBalance(BigInt(LEGACY_LEN))),
      data: d,
      owner: VAULT_PROGRAM_ID,
      executable: false,
      rentEpoch: 0,
    })
  }

  async function plantNew(pendingAuthority: PublicKey | null): Promise<void> {
    const d = Buffer.alloc(NEW_LEN)
    configDisc.copy(d, 0)
    authority.publicKey.toBuffer().copy(d, 8)
    d.writeUInt16LE(10, 40)
    d.writeBigInt64LE(86400n, 42)
    d.writeUInt8(0, 50)
    d.writeBigUInt64LE(0n, 51)
    d.writeBigUInt64LE(0n, 59)
    d.writeUInt8(bump, 67)
    if (pendingAuthority) {
      d.writeUInt8(1, 68)
      pendingAuthority.toBuffer().copy(d, 69)
    }
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, {
      lamports: Number(rent.minimumBalance(BigInt(NEW_LEN))),
      data: d,
      owner: VAULT_PROGRAM_ID,
      executable: false,
      rentEpoch: 0,
    })
  }

  it('migrates a legacy 68-byte config → 101 bytes, fields preserved, pending=None', async () => {
    await plantLegacy({ authority: authority.publicKey, feeTenthsBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 5n, totalDepositors: 3n })
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])

    const data = await getAccountData(ctx, configPda)
    assert.strictEqual(data.length, NEW_LEN, 'account grew to new layout length')
    const cfg = parseVaultConfig(data)
    assert.ok(cfg.authority.equals(authority.publicKey))
    assert.strictEqual(cfg.feeTenthsBps, 10)
    assert.strictEqual(cfg.refundTimeout, 86400n)
    assert.strictEqual(cfg.paused, false)
    assert.strictEqual(cfg.totalDeposits, 5n)
    assert.strictEqual(cfg.totalDepositors, 3n)
    assert.strictEqual(cfg.bump, bump)
    assert.strictEqual(cfg.pendingAuthority, null, 'pending_authority appended as None')
    const rent = await ctx.banksClient.getRent()
    const acct = await ctx.banksClient.getAccount(configPda)
    assert.ok(BigInt(acct!.lamports) >= rent.minimumBalance(BigInt(NEW_LEN)), 'rent-exempt at new size')
  })

  it('is idempotent: running on an already-migrated 101-byte config is a no-op', async () => {
    // Plant a config that is ALREADY at the new 101-byte layout (pendingAuthority=None).
    // Calling migrate_config on it must succeed (no-op path) and must not alter any field.
    await plantNew(null)
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.strictEqual(cfg.pendingAuthority, null, 'pending_authority still null after no-op')
    assert.strictEqual(cfg.feeTenthsBps, 10)
    assert.strictEqual(cfg.totalDeposits, 0n)
    assert.strictEqual(cfg.totalDepositors, 0n)
  })

  it('never clobbers a live pending_authority on an already-migrated config', async () => {
    const pending = Keypair.generate().publicKey
    await plantNew(pending)
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.ok(cfg.pendingAuthority?.equals(pending), 'pending_authority preserved (no-op path)')
  })

  it('rejects a non-authority signer even on an already-migrated config (no-op path stays gated)', async () => {
    await plantNew(null)
    const attacker = Keypair.generate()
    await sendIx(ctx, [SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: attacker.publicKey, lamports: 5_000_000 })], [authority])
    await assertFails(
      () => sendIx(ctx, [ixMigrateConfig(attacker.publicKey)], [attacker]),
      ['unauthorized', '1771'],
    )
  })

  it('rejects a non-authority signer (Unauthorized 6001/0x1771)', async () => {
    await plantLegacy({ authority: authority.publicKey, feeTenthsBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 0n, totalDepositors: 0n })
    const attacker = Keypair.generate()
    await sendIx(ctx, [SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: attacker.publicKey, lamports: 5_000_000 })], [authority])
    await assertFails(
      () => sendIx(ctx, [ixMigrateConfig(attacker.publicKey)], [attacker]),
      ['unauthorized', '1771'],
    )
  })

  it('rejects a malformed (wrong-size) config account (InvalidConfigAccount 6014/0x177e)', async () => {
    const d = Buffer.alloc(40)
    configDisc.copy(d, 0)
    authority.publicKey.toBuffer().copy(d, 8)
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, { lamports: Number(rent.minimumBalance(40n)), data: d, owner: VAULT_PROGRAM_ID, executable: false, rentEpoch: 0 })
    await assertFails(
      () => sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority]),
      ['invalidconfigaccount', '177e'],
    )
  })

  it('migrated config is fully usable: update_fee succeeds afterward', async () => {
    await plantLegacy({ authority: authority.publicKey, feeTenthsBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 0n, totalDepositors: 0n })
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    await sendIx(ctx, [ixUpdateFee(authority.publicKey, 25)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.strictEqual(cfg.feeTenthsBps, 25, 'typed handlers accept the migrated account')
  })
})
