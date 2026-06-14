/**
 * Gasless cash-out for stealth recipients.
 *
 * A stealth address that received SPL tokens typically holds ZERO SOL, so it cannot
 * pay a transaction fee to move those tokens out. Here a relayer is the fee-payer; the
 * stealth address signs only the token transfers (via its raw ed25519 scalar — see
 * deriveStealthSigner). The relayer recovers its SOL cost as an SPL fee deducted from
 * the tokens being moved (fee-from-claim). Direct submission is the primary path; a
 * Jito bundle is an optional mainnet hardening layer (see submitGaslessCashout).
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import type { HexString } from '@sip-protocol/types'
import { deriveStealthSigner } from './stealth-signer'
import { computeRelayerFee, type RelayerFeeConfig } from './relayer-fee'
import { detectCluster, getExplorerUrl } from './constants'
import type { JitoRelayer } from '../../solana/jito-relayer'

/** Parameters for building a gasless cash-out transaction. */
export interface GaslessCashoutParams {
  /** Solana RPC connection */
  connection: Connection
  /** Stealth address holding the tokens (base58) */
  stealthAddress: string
  /** Ephemeral public key from the payment (base58) */
  ephemeralPublicKey: string
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Final destination address (base58) */
  destinationAddress: string
  /** SPL token mint */
  mint: PublicKey
  /** Relayer public key — the transaction fee-payer (must hold SOL) */
  relayerPublicKey: PublicKey
  /** Relayer's token account that receives the fee (ATA for `mint`) */
  relayerFeeAccount: PublicKey
  /** Fee model */
  feeConfig: RelayerFeeConfig
  /** Announcement scheme version: '2' canonical (default) | '1' legacy */
  version?: '1' | '2'
  /**
   * SPL token program owning the mint — defaults to the classic Token program;
   * pass TOKEN_2022_PROGRAM_ID for Token-2022 mints. A wrong program id derives the
   * wrong ATA and targets the wrong program (on-chain failure).
   */
  tokenProgramId?: PublicKey
}

/** A stealth-signed gasless cash-out transaction, awaiting the relayer's fee-payer signature. */
export interface GaslessCashoutBuild {
  /** Transaction signed by the stealth address; feePayer = relayer (relayer must still sign) */
  transaction: Transaction
  /** Stealth address (base58) */
  stealthAddress: string
  /** Final destination (base58) */
  destinationAddress: string
  /** Gross amount in the stealth token account (base units) */
  grossAmount: bigint
  /** Relayer fee deducted (base units) */
  relayerFee: bigint
  /** Net amount forwarded to the destination (base units) */
  netAmount: bigint
  /** Blockhash the transaction is bound to */
  blockhash: string
  /** Last valid block height for confirmation */
  lastValidBlockHeight: number
}

/**
 * Build a gasless cash-out transaction.
 *
 * Derives the stealth signer from the recipient's keys, computes the fee-from-claim,
 * assembles a two- (or three-) instruction transaction with the relayer as fee-payer,
 * and pre-signs with the stealth scalar. The relayer must add its own signature before
 * broadcasting.
 *
 * @throws If the relayer fee >= the gross claim amount (nothing left for the recipient)
 */
export async function buildGaslessCashout(
  params: GaslessCashoutParams
): Promise<GaslessCashoutBuild> {
  const {
    connection,
    stealthAddress,
    ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    destinationAddress,
    mint,
    relayerPublicKey,
    relayerFeeAccount,
    feeConfig,
    version = '2',
  } = params
  const tokenProgramId = params.tokenProgramId ?? TOKEN_PROGRAM_ID

  const stealthSigner = deriveStealthSigner({
    stealthAddress,
    ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    version,
  })
  const stealthPubkey = stealthSigner.publicKey

  const stealthATA = await getAssociatedTokenAddress(mint, stealthPubkey, true, tokenProgramId)
  const destinationPubkey = new PublicKey(destinationAddress)
  const destinationATA = await getAssociatedTokenAddress(
    mint,
    destinationPubkey,
    false,
    tokenProgramId
  )

  if (destinationATA.equals(stealthATA)) {
    throw new Error(
      'destinationAddress resolves to the stealth token account; choose a different destination'
    )
  }

  // The three RPC reads below are independent — fire them concurrently and then
  // validate the settled results in a FIXED order so failures stay deterministic
  // (Promise.all would surface whichever rejects first, which is nondeterministic).
  const [feeAccountSettled, balanceSettled, blockhashSettled] = await Promise.allSettled([
    // Validate the relayer fee account is a token account for `mint` — otherwise the fee
    // transfer would fail (mint mismatch) or the fee would be unrecoverable.
    getAccount(connection, relayerFeeAccount, undefined, tokenProgramId),
    // Gross balance held by the stealth ATA.
    connection.getTokenAccountBalance(stealthATA),
    connection.getLatestBlockhash(),
  ])

  // 1. Relayer fee account: existence first, then mint match.
  if (feeAccountSettled.status === 'rejected') {
    throw new Error('relayerFeeAccount does not exist or is not a token account')
  }
  if (!feeAccountSettled.value.mint.equals(mint)) {
    throw new Error('relayerFeeAccount is not an associated token account for the given mint')
  }

  // 2. Stealth ATA balance.
  if (balanceSettled.status === 'rejected') {
    throw new Error(
      `Stealth token account ${stealthATA.toBase58()} for mint ${mint.toBase58()} does not exist or holds no balance; nothing to cash out`
    )
  }
  const grossAmount = BigInt(balanceSettled.value.value.amount)

  // 3. Recent blockhash — bound below after the fee guard so we never sign a tx with
  // a stale/absent blockhash; surface a clear error instead of an unhandled rejection.
  if (blockhashSettled.status === 'rejected') {
    throw new Error('Failed to fetch a recent blockhash for the cash-out transaction')
  }
  const { blockhash, lastValidBlockHeight } = blockhashSettled.value

  const relayerFee = computeRelayerFee(grossAmount, feeConfig)
  if (relayerFee >= grossAmount) {
    throw new Error(
      `Relayer fee (${relayerFee}) equals or exceeds the claim amount (${grossAmount}); nothing left to forward`
    )
  }
  const netAmount = grossAmount - relayerFee

  const transaction = new Transaction()

  // Idempotently create the destination ATA — relayer pays rent. Idempotent means a
  // no-op if it already exists, so no separate existence read is needed (one fewer RPC,
  // and no TOCTOU gap between the read and broadcast). The flat-floor fee is intended to
  // cover this rent, but it is denominated in token base units (no price oracle in v1),
  // so SOL-rent recovery is approximate, not guaranteed.
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      relayerPublicKey, // payer (relayer pays rent)
      destinationATA,
      destinationPubkey,
      mint,
      tokenProgramId
    )
  )

  // Fee: stealth -> relayer fee account
  transaction.add(
    createTransferInstruction(stealthATA, relayerFeeAccount, stealthPubkey, relayerFee, [], tokenProgramId)
  )
  // Net: stealth -> destination
  transaction.add(
    createTransferInstruction(stealthATA, destinationATA, stealthPubkey, netAmount, [], tokenProgramId)
  )

  // Blockhash was fetched concurrently above and validated before this point.
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = relayerPublicKey

  // Stealth signs the token transfers via its scalar; relayer (fee-payer) signs at submit time.
  // Must be done AFTER feePayer + recentBlockhash + all instructions are set.
  stealthSigner.signTransaction(transaction)

  return {
    transaction,
    stealthAddress,
    destinationAddress,
    grossAmount,
    relayerFee,
    netAmount,
    blockhash,
    lastValidBlockHeight,
  }
}

/** Parameters for submitting a built gasless cash-out. */
export interface SubmitGaslessCashoutParams {
  /** Solana RPC connection */
  connection: Connection
  /** Output of buildGaslessCashout (stealth already signed) */
  build: GaslessCashoutBuild
  /** Relayer keypair — must equal build.transaction.feePayer */
  relayerKeypair: Keypair
  /** Optional Jito relayer for the bundle path (mainnet hardening). Default: direct submit. */
  jitoRelayer?: JitoRelayer
  /** Tip in lamports for the Jito path (ignored on the direct path) */
  tipLamports?: number
}

/** Result of a gasless cash-out. */
export interface GaslessCashoutResult {
  /** Transaction signature (base58) */
  txSignature: string
  /** Destination that received the net amount (base58) */
  destinationAddress: string
  /** Net amount forwarded (base units) */
  amount: bigint
  /** Relayer fee charged (base units) */
  relayerFee: bigint
  /** Explorer URL */
  explorerUrl: string
  /** Whether the Jito bundle path was used */
  viaJito: boolean
}

/**
 * Sign as the relayer (fee-payer) and submit a gasless cash-out.
 *
 * Direct submission is the primary path (works on devnet + mainnet). Supplying a
 * `jitoRelayer` routes through a Jito bundle instead (optional mainnet hardening;
 * Jito has no devnet block engine).
 *
 * @throws If `relayerKeypair` is not the transaction's fee-payer
 */
export async function submitGaslessCashout(
  params: SubmitGaslessCashoutParams
): Promise<GaslessCashoutResult> {
  const { connection, build, relayerKeypair, jitoRelayer, tipLamports } = params
  const { transaction, netAmount, relayerFee, destinationAddress } = build

  if (!transaction.feePayer || !transaction.feePayer.equals(relayerKeypair.publicKey)) {
    throw new Error('relayerKeypair does not match the transaction fee-payer')
  }

  // Relayer adds its fee-payer signature alongside the stealth signature. Guard against
  // re-signing when the same build is retried after a transient send failure — a second
  // partialSign is wasteful and could surprise callers inspecting the signature set.
  const relayerAlreadySigned = transaction.signatures.some(
    (s) => s.publicKey.equals(relayerKeypair.publicKey) && s.signature !== null
  )
  if (!relayerAlreadySigned) {
    transaction.partialSign(relayerKeypair)
  }

  const cluster = detectCluster(connection.rpcEndpoint)

  // Optional Jito path (mainnet only — Jito has no devnet block engine).
  if (jitoRelayer) {
    const relayed = await jitoRelayer.relayTransaction({
      transaction,
      tipLamports,
      tipPayer: relayerKeypair,
      waitForConfirmation: true,
    })
    // Only a confirmed bundle means the funds actually moved. A 'submitted'/'failed'
    // status is NOT success — surfacing it as one would silently lose the cash-out.
    if (relayed.status !== 'confirmed') {
      throw new Error(
        `Gasless cash-out via Jito did not confirm (status: ${relayed.status})` +
        (relayed.error ? `: ${relayed.error}` : '')
      )
    }
    if (!relayed.signature) {
      throw new Error('Gasless cash-out via Jito returned an empty transaction signature')
    }
    return {
      txSignature: relayed.signature,
      destinationAddress,
      amount: netAmount,
      relayerFee,
      explorerUrl: getExplorerUrl(relayed.signature, cluster),
      // Report the TRUE path: the relayer may have fallen back to direct submission.
      viaJito: relayed.relayed,
    }
  }

  // Direct path (primary): relayer is fee-payer; sendRawTransaction returns a base58 sig.
  const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  const confirmation = await connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash: build.blockhash,
      lastValidBlockHeight: build.lastValidBlockHeight,
    },
    'confirmed'
  )
  if (confirmation.value.err) {
    throw new Error(
      `Gasless cash-out landed but failed on-chain: ${JSON.stringify(confirmation.value.err)}`
    )
  }

  return {
    txSignature,
    destinationAddress,
    amount: netAmount,
    relayerFee,
    explorerUrl: getExplorerUrl(txSignature, cluster),
    viaJito: false,
  }
}
