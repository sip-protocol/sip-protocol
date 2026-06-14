import { describe, it, expect } from 'vitest'
import { Keypair, PublicKey, type Connection } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
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

/** Mock connection: stealth ATA holds `gross`; dest ATA exists unless destMissing. */
function mockConn(gross: bigint, destMissing = false): Connection {
  return {
    rpcEndpoint: 'https://api.devnet.solana.com',
    getLatestBlockhash: async () => ({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 100,
    }),
    getTokenAccountBalance: async () => ({
      value: { amount: gross.toString(), decimals: 6, uiAmount: 0, uiAmountString: '0' },
    }),
    getAccountInfo: async () => (destMissing ? null : ({ lamports: 1 } as unknown as object)),
  } as unknown as Connection
}

describe('buildGaslessCashout', () => {
  const relayer = Keypair.generate()
  const relayerFeeAccount = Keypair.generate().publicKey
  const destination = Keypair.generate().publicKey

  it('builds a stealth-signed tx with feePayer = relayer and net = gross - fee', async () => {
    const s = scenario()
    const build = await buildGaslessCashout({
      connection: mockConn(1_000_000_000n), // 1000 USDC
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: destination.toBase58(),
      mint: USDC_MINT,
      relayerPublicKey: relayer.publicKey,
      relayerFeeAccount,
      feeConfig: { flatFloor: 10_000n, bps: 10 },
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

    // Two SPL transfers (fee + net); no create-ATA since dest exists.
    expect(build.transaction.instructions.length).toBe(2)
    // Both instructions are SPL token transfers (fee + net)
    expect(build.transaction.instructions.every(i => i.programId.equals(TOKEN_PROGRAM_ID))).toBe(true)
  })

  it('adds a create-ATA instruction (relayer as payer) when the dest ATA is missing', async () => {
    const s = scenario()
    const build = await buildGaslessCashout({
      connection: mockConn(1_000_000_000n, true),
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: destination.toBase58(),
      mint: USDC_MINT,
      relayerPublicKey: relayer.publicKey,
      relayerFeeAccount,
      feeConfig: { flatFloor: 10_000n, bps: 10 },
    })
    expect(build.transaction.instructions.length).toBe(3) // create-ATA + fee + net
    expect(build.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
    expect(build.transaction.instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
    expect(build.transaction.instructions[2].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('throws when the fee would consume the entire claim', async () => {
    const s = scenario()
    await expect(buildGaslessCashout({
      connection: mockConn(5_000n), // gross < floor
      stealthAddress: s.stealthB58,
      ephemeralPublicKey: s.ephemeralB58,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPrivateKey: s.recipient.spendingPrivateKey,
      destinationAddress: destination.toBase58(),
      mint: USDC_MINT,
      relayerPublicKey: relayer.publicKey,
      relayerFeeAccount,
      feeConfig: { flatFloor: 10_000n, bps: 10 },
    })).rejects.toThrow('exceeds the claim amount')
  })
})

describe('submitGaslessCashout', () => {
  const relayerFeeAccount = Keypair.generate().publicKey

  async function buildFor(relayer: Keypair) {
    const s = scenario()
    return buildGaslessCashout({
      connection: mockConn(1_000_000_000n),
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

  it('Jito path: routes through the relayer when jitoRelayer is provided', async () => {
    const relayer = Keypair.generate()
    const build = await buildFor(relayer)
    const connection = { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } as unknown as Connection
    const jitoRelayer = {
      relayTransaction: async () => ({
        signature: 'JitoSig1111111111111111111111111111111111111',
        bundleId: 'bundle-1',
        status: 'submitted',
        relayed: true,
      }),
    } as unknown as JitoRelayer

    const result = await submitGaslessCashout({ connection, build, relayerKeypair: relayer, jitoRelayer })
    expect(result.viaJito).toBe(true)
    expect(result.txSignature).toBe('JitoSig1111111111111111111111111111111111111')
    expect(result.amount).toBe(build.netAmount)
  })
})
