/**
 * Tests for claimStealthPayment (packages/sdk/src/chains/solana/scan.ts).
 *
 * Two tests:
 *   (a) Low-SOL guard — rejects before any token-account access.
 *   (b) Happy path — proves the stealth scalar signer produces a fully-valid
 *       transaction; this is the regression guard for the headline bug where
 *       Keypair could not sign a scalar-derived stealth address.
 */

import { describe, it, expect } from 'vitest'
import { PublicKey, Transaction, type Connection } from '@solana/web3.js'
import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import type { ChainId } from '@sip-protocol/types'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import { claimStealthPayment, getStealthBalance } from '../../../src/chains/solana/scan'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

/**
 * Build a real stealth scenario using canonical SIP:2 derivation — the same
 * helper pattern used in gasless-cashout.test.ts.
 */
function scenario() {
  const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
  const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
  return {
    recipient,
    stealthB58: ed25519PublicKeyToSolanaAddress(stealthAddress.address),
    ephemeralB58: ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey),
  }
}

/**
 * Encode a minimal but valid 165-byte SPL token account buffer.
 *
 * `getAccount` from @solana/spl-token calls `connection.getAccountInfo(ata)`
 * and then calls `unpackAccount(address, info, TOKEN_PROGRAM_ID)`.
 * `unpackAccount` validates:
 *   - info !== null
 *   - info.owner.equals(TOKEN_PROGRAM_ID)   ← the *account program* owner
 *   - info.data.length >= ACCOUNT_SIZE (165)
 *
 * The owner field encoded *inside* the layout is the ATA's token owner
 * (stealthPubkey) — returned as data, not checked by unpackAccount itself.
 */
function makeTokenAccountInfo(
  stealthPubkey: PublicKey,
  amount: bigint,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
) {
  const data = Buffer.alloc(AccountLayout.span)
  AccountLayout.encode(
    {
      mint: USDC_MINT,
      owner: stealthPubkey,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1, // AccountState.Initialized
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
    0
  )
  return {
    data,
    owner: tokenProgramId, // the *program* that owns this account — must match the unpack programId
    executable: false,
    lamports: 2039280,
    rentEpoch: 0,
  }
}

// ─── (a) Low-SOL guard ───────────────────────────────────────────────────────

describe('claimStealthPayment', () => {
  it('(a) rejects with Insufficient SOL when balance < 5000 lamports', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)

    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getBalance: async (_pk: PublicKey) => 100, // well below the 5000-lamport minimum
    } as unknown as Connection

    await expect(
      claimStealthPayment({
        connection,
        stealthAddress: s.stealthB58,
        ephemeralPublicKey: s.ephemeralB58,
        viewingPrivateKey: s.recipient.viewingPrivateKey,
        spendingPrivateKey: s.recipient.spendingPrivateKey,
        destinationAddress: stealthPubkey.toBase58(), // destination can be anything valid
        mint: USDC_MINT,
      })
    ).rejects.toThrow('Insufficient SOL')
  })

  // ─── (b) Happy path — scalar signer regression guard ─────────────────────

  it('(b) resolves with correct amount + a fully-verifiable transaction (scalar-signer regression)', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 5_000_000n)

    // Capture the raw bytes that claimStealthPayment sends to the network.
    let capturedRaw: Uint8Array | null = null
    const fakeSignature = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi1v9eHNzaRZ2d5kH3J4b9mzSJ'

    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      // SOL balance check — must be >= 5000 lamports
      getBalance: async (_pk: PublicKey) => 10_000_000,
      // spl-token's getAccount() calls connection.getAccountInfo internally
      getAccountInfo: async (_address: PublicKey) => tokenAccountInfo,
      getLatestBlockhash: async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      }),
      sendRawTransaction: async (raw: Uint8Array) => {
        capturedRaw = raw
        return fakeSignature
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as unknown as Connection

    // Any valid Solana address works as the destination.
    const destination = 'So11111111111111111111111111111111111111112'

    const result = await claimStealthPayment({
      connection,
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: destination,
      mint: USDC_MINT,
      version: '2',
    })

    // ── Functional assertions ──────────────────────────────────────────────
    expect(result.amount).toBe(5_000_000n)
    expect(result.txSignature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/) // base58

    // ── Scalar-signer regression guard ────────────────────────────────────
    // On origin/main before the scalar-signer fix, Keypair could not sign a
    // stealth address whose private key is a raw scalar; transaction.serialize()
    // would have thrown or produced an invalid signature.
    //
    // We prove the produced tx is fully valid: every required signature is
    // present and cryptographically correct for the serialized message.
    expect(capturedRaw).not.toBeNull()
    const sentTx = Transaction.from(capturedRaw!)
    expect(sentTx.verifySignatures(true)).toBe(true)

    // The feePayer must be the stealth address itself (not a relayer).
    expect(sentTx.feePayer?.toBase58()).toBe(s.stealthB58)
  })

  // ─── (c) version is forwarded to the derivation ─────────────────────────────
  // Regression guard for the scan->claim version-threading bug: the `version`
  // passed to claimStealthPayment must reach deriveStealthSigner so it picks the
  // matching derivation. We prove forwarding by claiming a CANONICAL (SIP:2)
  // stealth address with version '1': that routes to the legacy derivation, whose
  // scalar does NOT reproduce the canonical public key, so deriveStealthSigner
  // throws. (With version '2' the same claim succeeds — see test (b).)
  it("(c) forwards version to deriveStealthSigner (canonical address + version '1' -> derivation mismatch)", async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 5_000_000n)

    // Sufficient SOL + a valid token account so execution reaches the signer
    // derivation rather than tripping the low-SOL guard.
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getBalance: async (_pk: PublicKey) => 10_000_000,
      getAccountInfo: async (_address: PublicKey) => tokenAccountInfo,
    } as unknown as Connection

    await expect(
      claimStealthPayment({
        connection,
        stealthAddress: s.stealthB58,
        ephemeralPublicKey: s.ephemeralB58,
        viewingPrivateKey: s.recipient.viewingPrivateKey,
        spendingPrivateKey: s.recipient.spendingPrivateKey,
        destinationAddress: 'So11111111111111111111111111111111111111112',
        mint: USDC_MINT,
        version: '1', // wrong scheme for a canonical address — must route to V1 derivation
      })
    ).rejects.toThrow('Stealth key derivation failed')
  })

  // ─── (d) S1: Token-2022 mint support ────────────────────────────────────────
  it('(d) derives the Token-2022 ATA and targets the Token-2022 program when tokenProgramId is set', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    // Token account is owned by the Token-2022 program; getAccount must unpack with it.
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 5_000_000n, TOKEN_2022_PROGRAM_ID)

    let capturedRaw: Uint8Array | null = null
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getBalance: async (_pk: PublicKey) => 10_000_000,
      getAccountInfo: async (_address: PublicKey) => tokenAccountInfo,
      getLatestBlockhash: async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      }),
      sendRawTransaction: async (raw: Uint8Array) => {
        capturedRaw = raw
        return '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi1v9eHNzaRZ2d5kH3J4b9mzSJ'
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as unknown as Connection

    const result = await claimStealthPayment({
      connection,
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: 'So11111111111111111111111111111111111111112',
      mint: USDC_MINT,
      version: '2',
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    })

    expect(result.amount).toBe(5_000_000n)

    // The transfer instruction must target the Token-2022 program, and its source
    // account (keys[0]) must be the Token-2022-derived ATA (≠ classic ATA).
    expect(capturedRaw).not.toBeNull()
    const sentTx = Transaction.from(capturedRaw!)
    const transferIx = sentTx.instructions.find((ix) =>
      ix.programId.equals(TOKEN_2022_PROGRAM_ID)
    )
    expect(transferIx).toBeDefined()
    expect(
      sentTx.instructions.some((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
    ).toBe(false)

    const expected2022ATA = getAssociatedTokenAddressSync(
      USDC_MINT,
      stealthPubkey,
      true,
      TOKEN_2022_PROGRAM_ID
    )
    const classicATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true, TOKEN_PROGRAM_ID)
    expect(transferIx!.keys[0].pubkey.equals(expected2022ATA)).toBe(true)
    expect(transferIx!.keys[0].pubkey.equals(classicATA)).toBe(false)
  })

  // ─── (e) S1 regression: default stays classic ───────────────────────────────
  it('(e) defaults to the classic token program when tokenProgramId is omitted', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 5_000_000n)

    let capturedRaw: Uint8Array | null = null
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getBalance: async (_pk: PublicKey) => 10_000_000,
      getAccountInfo: async (_address: PublicKey) => tokenAccountInfo,
      getLatestBlockhash: async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      }),
      sendRawTransaction: async (raw: Uint8Array) => {
        capturedRaw = raw
        return '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi1v9eHNzaRZ2d5kH3J4b9mzSJ'
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as unknown as Connection

    await claimStealthPayment({
      connection,
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: 'So11111111111111111111111111111111111111112',
      mint: USDC_MINT,
      version: '2',
    })

    const sentTx = Transaction.from(capturedRaw!)
    const transferIx = sentTx.instructions.find((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
    expect(transferIx).toBeDefined()
    const classicATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true, TOKEN_PROGRAM_ID)
    expect(transferIx!.keys[0].pubkey.equals(classicATA)).toBe(true)
  })
})

// ─── getStealthBalance — Token-2022 support ───────────────────────────────────

describe('getStealthBalance', () => {
  it('reads the Token-2022 ATA when tokenProgramId is provided', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    const expected2022ATA = getAssociatedTokenAddressSync(
      USDC_MINT,
      stealthPubkey,
      true,
      TOKEN_2022_PROGRAM_ID
    )
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 7_000_000n, TOKEN_2022_PROGRAM_ID)

    // Only return the account when queried at the Token-2022 ATA; anything else
    // (e.g. the classic ATA) returns null so getAccount would throw → balance 0n.
    let queriedAddress: PublicKey | null = null
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getAccountInfo: async (address: PublicKey) => {
        queriedAddress = address
        return address.equals(expected2022ATA) ? tokenAccountInfo : null
      },
    } as unknown as Connection

    const balance = await getStealthBalance(
      connection,
      s.stealthB58,
      USDC_MINT,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    expect(balance).toBe(7_000_000n)
    expect(queriedAddress).not.toBeNull()
    expect((queriedAddress as unknown as PublicKey).equals(expected2022ATA)).toBe(true)
  })

  it('defaults to the classic ATA when tokenProgramId is omitted', async () => {
    const s = scenario()
    const stealthPubkey = new PublicKey(s.stealthB58)
    const classicATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true, TOKEN_PROGRAM_ID)
    const tokenAccountInfo = makeTokenAccountInfo(stealthPubkey, 3_000_000n)

    let queriedAddress: PublicKey | null = null
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getAccountInfo: async (address: PublicKey) => {
        queriedAddress = address
        return address.equals(classicATA) ? tokenAccountInfo : null
      },
    } as unknown as Connection

    const balance = await getStealthBalance(connection, s.stealthB58, USDC_MINT)

    expect(balance).toBe(3_000_000n)
    expect((queriedAddress as unknown as PublicKey).equals(classicATA)).toBe(true)
  })
})
