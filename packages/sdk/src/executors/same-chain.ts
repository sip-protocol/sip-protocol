/**
 * Same-Chain Privacy Executor
 *
 * Executes privacy-preserving transfers on the same chain,
 * bypassing cross-chain settlement for direct transfers.
 */

import type { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import type { StealthMetaAddress, ChainId, HexString } from '@sip-protocol/types'
import {
  sendPrivateSPLTransfer,
  estimatePrivateTransferFee,
  type SolanaPrivateTransferResult,
} from '../chains/solana'

/**
 * Parameters for same-chain private transfer
 */
export interface SameChainTransferParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
  /** Token identifier (symbol or mint address) */
  token: string
}

/**
 * Result of same-chain private transfer
 */
export interface SameChainTransferResult {
  /** Transaction signature/hash */
  txHash: string
  /** Stealth address that received the funds */
  stealthAddress: string
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: string
  /** Explorer URL */
  explorerUrl: string
  /** Chain the transfer was executed on */
  chain: ChainId
}

/**
 * Same-chain executor interface
 */
export interface SameChainExecutor {
  /** Chain this executor handles */
  readonly chain: ChainId

  /**
   * Execute a same-chain private transfer
   */
  execute(params: SameChainTransferParams): Promise<SameChainTransferResult>

  /**
   * Estimate transaction fee
   */
  estimateFee(params: SameChainTransferParams): Promise<bigint>
}

/**
 * Solana-specific executor configuration
 */
export interface SolanaSameChainConfig {
  /** Solana RPC connection */
  connection: Connection
  /** Sender's public key */
  sender: PublicKey
  /** Sender's token account getter */
  getTokenAccount: (mint: PublicKey) => Promise<PublicKey>
  /** Transaction signer */
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
  /** Token mint resolver (symbol -> PublicKey) */
  getTokenMint: (symbol: string) => PublicKey
}

/**
 * Solana Same-Chain Executor
 *
 * Executes privacy-preserving SPL token transfers on Solana.
 */
export class SolanaSameChainExecutor implements SameChainExecutor {
  readonly chain = 'solana' as const
  private config: SolanaSameChainConfig

  constructor(config: SolanaSameChainConfig) {
    this.config = config
  }

  async execute(params: SameChainTransferParams): Promise<SameChainTransferResult> {
    const { recipientMetaAddress, amount, token } = params
    const { connection, sender, getTokenAccount, signTransaction, getTokenMint } = this.config

    // Resolve token mint
    const mint = getTokenMint(token)

    // Get sender's token account
    const senderTokenAccount = await getTokenAccount(mint)

    // Execute private transfer
    const result = await sendPrivateSPLTransfer({
      connection,
      sender,
      senderTokenAccount,
      recipientMetaAddress,
      mint,
      amount,
      signTransaction,
    })

    return {
      txHash: result.txSignature,
      stealthAddress: result.stealthAddress,
      ephemeralPublicKey: result.ephemeralPublicKey,
      explorerUrl: result.explorerUrl,
      chain: 'solana',
    }
  }

  async estimateFee(params: SameChainTransferParams): Promise<bigint> {
    // For now, assume ATA might need creation
    return estimatePrivateTransferFee(this.config.connection, true)
  }
}

/**
 * Factory function to create a same-chain executor for a given chain
 */
export function createSameChainExecutor(
  chain: ChainId,
  config: SolanaSameChainConfig
): SameChainExecutor {
  switch (chain) {
    case 'solana':
      return new SolanaSameChainExecutor(config)
    default:
      throw new Error(`Same-chain executor not available for chain: ${chain}`)
  }
}

/**
 * Check if same-chain privacy is supported for a chain
 */
export function isSameChainSupported(chain: ChainId): boolean {
  return chain === 'solana'
}

/**
 * Get supported same-chain privacy chains
 */
export function getSupportedSameChainChains(): ChainId[] {
  return ['solana']
}
