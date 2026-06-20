// tests/sipher-vault/11-token2022-allowlist.test.ts
//
// TDD — Task 4: fail-closed Token-2022 extension allowlist.
//
// The vault's create_vault_token instruction must:
//   ACCEPT — plain T2022 (no extensions) and MetadataPointer
//   REJECT  — PermanentDelegate, TransferFeeConfig, TransferHook,
//             NonTransferable, DefaultAccountState, MintCloseAuthority
//
// All tests use fresh mints per case. The vault config is shared (initialized
// once in before()). Error code for UnsupportedMintExtension: 6011 (0x177b).

import { assert } from 'chai'
import { Keypair, SystemProgram } from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeNonTransferableMintInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeTransferHookInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintCloseAuthorityInstruction,
  createInitializeInterestBearingMintInstruction,
  AccountState,
} from '@solana/spl-token'
import { ProgramTestContext } from 'solana-bankrun'

import { ixInitialize, ixCreateVaultToken, sendIx, startVault, VAULT_PROGRAM_ID } from './bankrun-helpers'
import { getVaultTokenPDA } from './setup'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Anchor custom errors start at 6000. UnsupportedMintExtension is index 11.
const UNSUPPORTED_MINT_EXTENSION_CODE = 6011
// Hex representation for log/message matching
const UNSUPPORTED_MINT_EXTENSION_HEX = (UNSUPPORTED_MINT_EXTENSION_CODE).toString(16) // '177b'

const FEE_BPS = 10
const REFUND_TIMEOUT = 86400n // 24h — not relevant for these tests

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert a promise rejects with UnsupportedMintExtension (6011 / 0x177b).
 * Bankrun embeds the error code in the transaction failure message.
 */
async function assertUnsupportedMintExtension(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    assert.fail('Expected transaction to fail with UnsupportedMintExtension but it succeeded')
  } catch (e: unknown) {
    const err = e as Error
    if (err.message && err.message.includes('Expected transaction to fail')) {
      throw err // re-throw the assert.fail
    }
    const msg = (err?.message ?? String(err)).toLowerCase()
    const matchesCode =
      msg.includes(String(UNSUPPORTED_MINT_EXTENSION_CODE)) ||
      msg.includes(UNSUPPORTED_MINT_EXTENSION_HEX) ||
      msg.includes('unsupportedmintextension')
    assert.ok(
      matchesCode,
      `Expected UnsupportedMintExtension (${UNSUPPORTED_MINT_EXTENSION_CODE} / 0x${UNSUPPORTED_MINT_EXTENSION_HEX}), got: ${err?.message ?? String(err)}`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('11 · Token-2022 extension allowlist (fail-closed)', function () {
  this.timeout(30_000)

  let ctx: ProgramTestContext
  let authority: Keypair

  // ── before: spin up bankrun + initialize vault config ───────────────────

  before(async function () {
    ctx = await startVault()
    authority = ctx.payer

    await sendIx(ctx, [
      ixInitialize(authority.publicKey, FEE_BPS, REFUND_TIMEOUT),
    ], [authority])
  })

  // ── ACCEPT: plain T2022 (no extensions) ────────────────────────────────

  it('ACCEPT: plain T2022 mint (no extensions) → create_vault_token succeeds', async function () {
    const mintKp = Keypair.generate()
    const space = getMintLen([]) // 82 bytes — classic mint layout, T2022-owned
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await sendIx(ctx, [
      ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
    ], [authority])

    // Assert vault token PDA was actually created and is owned by the program
    const [vaultTokenPda] = getVaultTokenPDA(mintKp.publicKey, VAULT_PROGRAM_ID)
    const pdaAccount = await ctx.banksClient.getAccount(vaultTokenPda)
    assert.isNotNull(pdaAccount, 'vault token PDA should exist after create_vault_token')
    assert.strictEqual(
      pdaAccount!.owner.toBase58(),
      TOKEN_2022_PROGRAM_ID.toBase58(),
      'vault token PDA should be owned by Token-2022 program',
    )
  })

  // ── ACCEPT: MetadataPointer ─────────────────────────────────────────────

  it('ACCEPT: MetadataPointer mint → create_vault_token succeeds', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.MetadataPointer]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    const metadataPointerIx = createInitializeMetadataPointerInstruction(
      mintKp.publicKey,
      authority.publicKey,       // authority
      mintKp.publicKey,          // metadataAddress = mint itself (standard pattern)
      TOKEN_2022_PROGRAM_ID,
    )

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      metadataPointerIx,
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await sendIx(ctx, [
      ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
    ], [authority])

    // Assert vault token PDA was actually created and is owned by the program
    const [vaultTokenPda] = getVaultTokenPDA(mintKp.publicKey, VAULT_PROGRAM_ID)
    const pdaAccount = await ctx.banksClient.getAccount(vaultTokenPda)
    assert.isNotNull(pdaAccount, 'vault token PDA should exist after create_vault_token')
    assert.strictEqual(
      pdaAccount!.owner.toBase58(),
      TOKEN_2022_PROGRAM_ID.toBase58(),
      'vault token PDA should be owned by Token-2022 program',
    )
  })

  // ── ACCEPT: InterestBearingConfig ───────────────────────────────────────

  it('ACCEPT: InterestBearingConfig mint → create_vault_token succeeds', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.InterestBearingConfig]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeInterestBearingMintInstruction(
        mintKp.publicKey,
        authority.publicKey, // rateAuthority
        100,                 // rate (bps) — interest is UI-only; raw vault accounting is unaffected
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await sendIx(ctx, [
      ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
    ], [authority])

    // Assert vault token PDA was actually created and is owned by the program
    const [vaultTokenPda] = getVaultTokenPDA(mintKp.publicKey, VAULT_PROGRAM_ID)
    const pdaAccount = await ctx.banksClient.getAccount(vaultTokenPda)
    assert.isNotNull(pdaAccount, 'vault token PDA should exist after create_vault_token')
    assert.strictEqual(
      pdaAccount!.owner.toBase58(),
      TOKEN_2022_PROGRAM_ID.toBase58(),
      'vault token PDA should be owned by Token-2022 program',
    )
  })

  // ── REJECT: PermanentDelegate ───────────────────────────────────────────

  it('REJECT: PermanentDelegate mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.PermanentDelegate]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializePermanentDelegateInstruction(
        mintKp.publicKey,
        authority.publicKey, // permanentDelegate
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })

  // ── REJECT: TransferFeeConfig ───────────────────────────────────────────

  it('REJECT: TransferFeeConfig mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.TransferFeeConfig]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferFeeConfigInstruction(
        mintKp.publicKey,
        authority.publicKey,   // transferFeeConfigAuthority
        authority.publicKey,   // withdrawWithheldAuthority
        100,                   // transferFeeBasisPoints
        BigInt(1_000_000),     // maximumFee
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })

  // ── REJECT: TransferHook ────────────────────────────────────────────────

  it('REJECT: TransferHook mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const hookProgramId = Keypair.generate().publicKey // dummy hook program
    const extTypes = [ExtensionType.TransferHook]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mintKp.publicKey,
        authority.publicKey, // authority
        hookProgramId,       // hook program
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })

  // ── REJECT: NonTransferable ─────────────────────────────────────────────

  it('REJECT: NonTransferable mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.NonTransferable]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeNonTransferableMintInstruction(
        mintKp.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })

  // ── REJECT: DefaultAccountState ────────────────────────────────────────

  it('REJECT: DefaultAccountState mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.DefaultAccountState]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeDefaultAccountStateInstruction(
        mintKp.publicKey,
        AccountState.Frozen,   // default state = Frozen
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        authority.publicKey, // freeze authority required by DefaultAccountState.Frozen
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })

  // ── REJECT: MintCloseAuthority (unknown/non-listed) ─────────────────────

  it('REJECT: MintCloseAuthority mint → create_vault_token fails with UnsupportedMintExtension', async function () {
    const mintKp = Keypair.generate()
    const extTypes = [ExtensionType.MintCloseAuthority]
    const space = getMintLen(extTypes)
    const rent = await ctx.banksClient.getRent()
    const mintLamports = Number(rent.minimumBalance(BigInt(space)))

    await sendIx(ctx, [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: mintLamports,
        space,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintCloseAuthorityInstruction(
        mintKp.publicKey,
        authority.publicKey, // closeAuthority
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mintKp.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    ], [authority, mintKp])

    await assertUnsupportedMintExtension(async () => {
      await sendIx(ctx, [
        ixCreateVaultToken(mintKp.publicKey, authority.publicKey, TOKEN_2022_PROGRAM_ID),
      ], [authority])
    })
  })
})
