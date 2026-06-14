import { describe, it, expect } from 'vitest'
import { Keypair, PublicKey, type Connection, type AccountInfo } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
  ACCOUNT_SIZE,
  AccountState,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import type { ChainId } from '@sip-protocol/types'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import { buildGaslessCashout, submitGaslessCashout } from '../../../src/chains/solana/gasless-cashout'
import type { JitoRelayer } from '../../../src/solana/jito-relayer'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

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
 * Encode a valid, initialized SPL token-account buffer so `getAccount` decodes it.
 *
 * @param mint - mint the account holds
 * @param owner - wallet owner stored inside the account data
 * @param tokenProgramId - program that OWNS the account (must match the programId
 *   `getAccount` unpacks with, else unpackAccount throws TokenInvalidAccountOwnerError)
 */
function encodeTokenAccountInfo(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): AccountInfo<Buffer> {
  const data = Buffer.alloc(ACCOUNT_SIZE)
  AccountLayout.encode(
    {
      mint,
      owner,
      amount: 0n,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: AccountState.Initialized,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data
  )
  return {
    lamports: 2_039_280,
    owner: tokenProgramId,
    executable: false,
    rentEpoch: 0,
    data,
  }
}

interface MockConnOptions {
  /** Gross balance reported for the stealth token account */
  gross: bigint
  /** Make getTokenAccountBalance reject (stealth ATA missing) */
  balanceThrows?: boolean
  /** Mint to report on the relayerFeeAccount (default: USDC_MINT) */
  feeAccountMint?: PublicKey
  /** Owner to report on the relayerFeeAccount token account (default: a fresh key) */
  feeAccountOwner?: PublicKey
  /**
   * Token program that owns the relayerFeeAccount (default: classic TOKEN_PROGRAM_ID).
   * Must match the `tokenProgramId` passed to buildGaslessCashout so `getAccount` unpacks.
   */
  feeAccountProgram?: PublicKey
}

/**
 * Mock connection. The stealth ATA reports `gross`. `getAccountInfo` returns a valid
 * SPL token-account for the relayer fee account so `getAccount` decodes it (mint =
 * feeAccountMint, default USDC_MINT). The dest ATA no longer needs a gate read.
 */
function mockConn(opts: MockConnOptions): Connection {
  const feeMint = opts.feeAccountMint ?? USDC_MINT
  const feeOwner = opts.feeAccountOwner ?? Keypair.generate().publicKey
  const feeProgram = opts.feeAccountProgram ?? TOKEN_PROGRAM_ID
  return {
    rpcEndpoint: 'https://api.devnet.solana.com',
    getLatestBlockhash: async () => ({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 100,
    }),
    getTokenAccountBalance: async () => {
      if (opts.balanceThrows) {
        throw new Error('could not find account')
      }
      return {
        value: { amount: opts.gross.toString(), decimals: 6, uiAmount: 0, uiAmountString: '0' },
      }
    },
    getAccountInfo: async () => encodeTokenAccountInfo(feeMint, feeOwner, feeProgram),
  } as unknown as Connection
}

describe('buildGaslessCashout', () => {
  const relayer = Keypair.generate()
  const relayerFeeAccount = Keypair.generate().publicKey
  const destination = Keypair.generate().publicKey

  function baseParams(s: ReturnType<typeof scenario>) {
    return {
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: destination.toBase58(),
      mint: USDC_MINT,
      relayerPublicKey: relayer.publicKey,
      relayerFeeAccount,
      feeConfig: { flatFloor: 10_000n, bps: 10 },
    }
  }

  it('builds a stealth-signed tx with feePayer = relayer and net = gross - fee', async () => {
    const s = scenario()
    const build = await buildGaslessCashout({
      connection: mockConn({ gross: 1_000_000_000n }), // 1000 USDC
      ...baseParams(s),
      version: '2',
    })

    expect(build.grossAmount).toBe(1_000_000_000n)
    expect(build.relayerFee).toBe(1_000_000n) // 1000 USDC * 10bps
    expect(build.netAmount).toBe(999_000_000n)
    expect(build.destinationAddress).toBe(destination.toBase58())
    expect(build.transaction.feePayer?.toBase58()).toBe(relayer.publicKey.toBase58())

    // Relayer slot still empty (filled at submit); stealth slot signed + valid.
    const relayerSig = build.transaction.signatures.find(x => x.publicKey.equals(relayer.publicKey))
    expect(relayerSig?.signature).toBeNull()
    const stealthSig = build.transaction.signatures.find(x => x.publicKey.equals(new PublicKey(s.stealthB58)))
    expect(stealthSig?.signature).not.toBeNull()
    expect(build.transaction.verifySignatures(false)).toBe(true) // present sigs valid; relayer allowed missing

    // create-ATA (idempotent) + fee transfer + net transfer.
    expect(build.transaction.instructions.length).toBe(3)
    expect(build.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
    expect(build.transaction.instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
    expect(build.transaction.instructions[2].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('always includes the idempotent create-ATA instruction for the destination (no separate gate read)', async () => {
    const s = scenario()
    let getAccountInfoCalls = 0
    const conn = mockConn({ gross: 1_000_000_000n })
    const wrapped = {
      ...conn,
      getAccountInfo: async (...args: unknown[]) => {
        getAccountInfoCalls++
        return (conn.getAccountInfo as unknown as (...a: unknown[]) => Promise<unknown>)(...args)
      },
    } as unknown as Connection

    const build = await buildGaslessCashout({
      connection: wrapped,
      ...baseParams(s),
    })

    // create-ATA + fee + net, with the create-ATA being idempotent.
    expect(build.transaction.instructions.length).toBe(3)
    expect(build.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
    // getAccountInfo is consumed only by getAccount (fee-account validation), NOT a dest gate.
    expect(getAccountInfoCalls).toBe(1)
  })

  it('throws when the fee would consume the entire claim', async () => {
    const s = scenario()
    await expect(buildGaslessCashout({
      connection: mockConn({ gross: 5_000n }), // gross < floor
      ...baseParams(s),
    })).rejects.toThrow('exceeds the claim amount')
  })

  // 2a — B5: clear error when the stealth ATA is missing / holds no balance
  it('throws a clear error when the stealth token account does not exist', async () => {
    const s = scenario()
    await expect(buildGaslessCashout({
      connection: mockConn({ gross: 0n, balanceThrows: true }),
      ...baseParams(s),
    })).rejects.toThrow(/does not exist or holds no balance/)
  })

  // 2b — B1: reject destination == stealth
  it('rejects when the destination resolves to the stealth token account', async () => {
    const s = scenario()
    await expect(buildGaslessCashout({
      connection: mockConn({ gross: 1_000_000_000n }),
      ...baseParams(s),
      destinationAddress: s.stealthB58, // same owner -> same ATA
    })).rejects.toThrow(/stealth token account/)
  })

  // 2c — B4: relayerFeeAccount must belong to `mint`
  it('rejects a relayerFeeAccount whose on-chain mint differs from the given mint', async () => {
    const s = scenario()
    const otherMint = new PublicKey('So11111111111111111111111111111111111111112') // wSOL
    await expect(buildGaslessCashout({
      connection: mockConn({ gross: 1_000_000_000n, feeAccountMint: otherMint }),
      ...baseParams(s),
    })).rejects.toThrow(/not an associated token account for the given mint/)
  })

  it('rejects when the relayerFeeAccount is not a token account at all', async () => {
    const s = scenario()
    const conn = mockConn({ gross: 1_000_000_000n })
    // getAccount throws when getAccountInfo returns null (no account).
    const wrapped = {
      ...conn,
      getAccountInfo: async () => null,
    } as unknown as Connection
    await expect(buildGaslessCashout({
      connection: wrapped,
      ...baseParams(s),
    })).rejects.toThrow(/relayerFeeAccount does not exist or is not a token account/)
  })

  // S1 — Token-2022 support: program id must flow into ATA derivation + instructions
  it('derives Token-2022 ATAs and targets the Token-2022 program when tokenProgramId is set', async () => {
    const s = scenario()
    const build = await buildGaslessCashout({
      connection: mockConn({
        gross: 1_000_000_000n,
        feeAccountProgram: TOKEN_2022_PROGRAM_ID, // fee account owned by Token-2022
      }),
      ...baseParams(s),
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    })

    // The two transfer instructions (fee + net) must target the Token-2022 program.
    const transfers = build.transaction.instructions.filter((ix) =>
      ix.programId.equals(TOKEN_2022_PROGRAM_ID)
    )
    expect(transfers.length).toBe(2)
    // No classic-program transfer leaked in.
    expect(
      build.transaction.instructions.some((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
    ).toBe(false)
    // The idempotent create-ATA still routes through the associated-token program,
    // but is told to create a Token-2022 account (program id is a passed key/arg).
    expect(
      build.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)
    ).toBe(true)

    // The source account (stealth ATA, keys[0]) must be the Token-2022-derived ATA,
    // which differs from the classic-program ATA for the same mint+owner.
    const feeTransfer = build.transaction.instructions[1]
    const stealthATA_2022 = feeTransfer.keys[0].pubkey
    const stealthPubkey = new PublicKey(s.stealthB58)
    const classicATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true, TOKEN_PROGRAM_ID)
    const expected2022ATA = getAssociatedTokenAddressSync(
      USDC_MINT,
      stealthPubkey,
      true,
      TOKEN_2022_PROGRAM_ID
    )
    expect(stealthATA_2022.equals(expected2022ATA)).toBe(true)
    expect(stealthATA_2022.equals(classicATA)).toBe(false)
  })

  // S1 regression: default (no tokenProgramId) stays classic — derivation + instructions
  it('defaults to the classic token program and ATA when tokenProgramId is omitted', async () => {
    const s = scenario()
    const build = await buildGaslessCashout({
      connection: mockConn({ gross: 1_000_000_000n }),
      ...baseParams(s),
    })

    const transfers = build.transaction.instructions.filter((ix) =>
      ix.programId.equals(TOKEN_PROGRAM_ID)
    )
    expect(transfers.length).toBe(2)
    expect(
      build.transaction.instructions.some((ix) => ix.programId.equals(TOKEN_2022_PROGRAM_ID))
    ).toBe(false)

    const stealthPubkey = new PublicKey(s.stealthB58)
    const classicATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true, TOKEN_PROGRAM_ID)
    expect(build.transaction.instructions[1].keys[0].pubkey.equals(classicATA)).toBe(true)
  })
})

describe('submitGaslessCashout', () => {
  const relayerFeeAccount = Keypair.generate().publicKey

  async function buildFor(relayer: Keypair) {
    const s = scenario()
    return buildGaslessCashout({
      connection: mockConn({ gross: 1_000_000_000n }),
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: Keypair.generate().publicKey.toBase58(),
      mint: USDC_MINT,
      relayerPublicKey: relayer.publicKey,
      relayerFeeAccount,
      feeConfig: { flatFloor: 10_000n, bps: 10 },
    })
  }

  it('direct path: relayer co-signs as fee-payer, sends, returns the base58 signature', async () => {
    const relayer = Keypair.generate()
    let sentRaw: Uint8Array | null = null
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      sendRawTransaction: async (raw: Uint8Array) => {
        sentRaw = raw
        return '5wHu1qwD4kT3zr8nF2sZ9q7vXpYbN6cM1aE4dR7tG9hJ2kL3mP8qS5vT6wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR'
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as unknown as Connection

    const build = await buildFor(relayer)

    // Before submit: stealth has signed but relayer hasn't — verifySignatures(true) requires ALL.
    expect(build.transaction.verifySignatures(true)).toBe(false)

    const result = await submitGaslessCashout({ connection, build, relayerKeypair: relayer })

    // After submit: partialSign(relayer) mutates build.transaction — both signatures now present.
    expect(build.transaction.verifySignatures(true)).toBe(true)

    expect(result.viaJito).toBe(false)
    expect(result.txSignature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/) // base58
    expect(result.amount).toBe(build.netAmount)
    expect(result.relayerFee).toBe(build.relayerFee)
    expect(result.destinationAddress).toBe(build.destinationAddress)
    expect(sentRaw).not.toBeNull() // a fully-signed tx was serialized + sent
  })

  it('rejects if the relayer keypair does not match the build fee-payer', async () => {
    const relayer = Keypair.generate()
    const wrong = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'x' } as unknown as Connection
    await expect(
      submitGaslessCashout({ connection, build, relayerKeypair: wrong })
    ).rejects.toThrow('does not match')
  })

  it('throws if the transaction lands but fails on-chain', async () => {
    const relayer = Keypair.generate()
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      sendRawTransaction: async () =>
        '5wHu1qwD4kT3zr8nF2sZ9q7vXpYbN6cM1aE4dR7tG9hJ2kL3mP8qS5vT6wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR',
      confirmTransaction: async () => ({ value: { err: { InstructionError: [1, 'Custom'] } } }),
    } as unknown as Connection

    const build = await buildFor(relayer)
    await expect(
      submitGaslessCashout({ connection, build, relayerKeypair: relayer })
    ).rejects.toThrow('failed on-chain')
  })

  // 2e — B3: idempotent relayer signing on retry (no duplicate relayer signature)
  it('does not re-sign as the relayer when retried with the same build', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)

    // Spy on partialSign — it must run exactly once across the failed attempt + retry.
    const realPartialSign = build.transaction.partialSign.bind(build.transaction)
    let partialSignCalls = 0
    build.transaction.partialSign = ((...signers: Parameters<typeof realPartialSign>) => {
      partialSignCalls++
      return realPartialSign(...signers)
    }) as typeof build.transaction.partialSign

    let attempts = 0
    const connection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      sendRawTransaction: async () => {
        attempts++
        if (attempts === 1) {
          throw new Error('Transaction simulation failed: blockhash not found')
        }
        return '5wHu1qwD4kT3zr8nF2sZ9q7vXpYbN6cM1aE4dR7tG9hJ2kL3mP8qS5vT6wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR'
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as unknown as Connection

    // First submit fails on a transient send error.
    await expect(
      submitGaslessCashout({ connection, build, relayerKeypair: relayer })
    ).rejects.toThrow('blockhash not found')

    const sigCountAfterFirst = build.transaction.signatures.filter(s => s.signature !== null).length

    // Retry the SAME build — must succeed without re-signing as the relayer.
    const result = await submitGaslessCashout({ connection, build, relayerKeypair: relayer })
    expect(result.viaJito).toBe(false)

    const sigCountAfterRetry = build.transaction.signatures.filter(s => s.signature !== null).length
    expect(sigCountAfterRetry).toBe(sigCountAfterFirst)
    // The relayer signed exactly once — the retry detected the existing signature and skipped.
    expect(partialSignCalls).toBe(1)
  })

  it('Jito path: routes through the relayer when jitoRelayer confirms', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } as unknown as Connection
    const jitoRelayer = {
      relayTransaction: async () => ({
        signature: 'JitoSig1111111111111111111111111111111111111',
        bundleId: 'bundle-1',
        status: 'confirmed',
        relayed: true,
      }),
    } as unknown as JitoRelayer

    const result = await submitGaslessCashout({ connection, build, relayerKeypair: relayer, jitoRelayer })
    expect(result.viaJito).toBe(true)
    expect(result.txSignature).toBe('JitoSig1111111111111111111111111111111111111')
    expect(result.amount).toBe(build.netAmount)
  })

  // 2f — J1: a non-confirmed Jito status must reject (not be reported as success)
  it('Jito path: rejects when the bundle does not confirm', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } as unknown as Connection
    const jitoRelayer = {
      relayTransaction: async () => ({
        signature: 'x',
        status: 'failed',
        error: 'bundle expired',
        relayed: true,
      }),
    } as unknown as JitoRelayer

    await expect(
      submitGaslessCashout({ connection, build, relayerKeypair: relayer, jitoRelayer })
    ).rejects.toThrow(/did not confirm/)
  })

  // 2f — J2: confirmed but empty signature must reject
  it('Jito path: rejects when the confirmed result has an empty signature', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } as unknown as Connection
    const jitoRelayer = {
      relayTransaction: async () => ({
        signature: '',
        status: 'confirmed',
        relayed: true,
      }),
    } as unknown as JitoRelayer

    await expect(
      submitGaslessCashout({ connection, build, relayerKeypair: relayer, jitoRelayer })
    ).rejects.toThrow(/empty transaction signature/)
  })

  // 2f — J5: report the TRUE relay path (relayed=false -> viaJito=false)
  it('Jito path: reports viaJito = false when the relayer fell back to direct submission', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } as unknown as Connection
    const jitoRelayer = {
      relayTransaction: async () => ({
        signature: 'sig123',
        status: 'confirmed',
        relayed: false,
      }),
    } as unknown as JitoRelayer

    const result = await submitGaslessCashout({ connection, build, relayerKeypair: relayer, jitoRelayer })
    expect(result.viaJito).toBe(false)
    expect(result.txSignature).toBe('sig123')
  })
})
