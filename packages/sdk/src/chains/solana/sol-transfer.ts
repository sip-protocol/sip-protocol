/**
 * Native SOL Transfer with Stealth Addresses
 *
 * Provides private SOL transfers using stealth addresses.
 * Simpler than SPL transfers - no ATA required.
 *
 * @module chains/solana/sol-transfer
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  type Commitment,
} from '@solana/web3.js'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../stealth'
import { ValidationError } from '../../errors'
import type { StealthMetaAddress } from '@sip-protocol/types'
import { createAnnouncementMemo } from './types'
import {
  MEMO_PROGRAM_ID,
  getExplorerUrl,
  ESTIMATED_TX_FEE_LAMPORTS,
  type SolanaCluster,
} from './constants'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum rent-exempt balance for a Solana account (in lamports)
 * This is approximately 0.00089 SOL
 */
export const RENT_EXEMPT_MINIMUM = 890_880n

/**
 * Recommended buffer for new stealth accounts
 * Slightly more than minimum to cover edge cases
 */
export const STEALTH_ACCOUNT_BUFFER = 1_000_000n // ~0.001 SOL

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Parameters for native SOL transfer to stealth address
 */
export interface SOLTransferParams {
  /** Solana RPC connection */
  connection: Connection
  /** Sender's public key */
  sender: PublicKey
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount to transfer (in lamports) */
  amount: bigint
  /** Function to sign the transaction */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
  /** Include rent-exempt buffer (default: true for new accounts) */
  includeRentBuffer?: boolean
  /** Transaction commitment level */
  commitment?: Commitment
  /** Custom memo to append */
  customMemo?: string
}

/**
 * Parameters for max SOL transfer (send all available balance)
 */
export interface MaxSOLTransferParams extends Omit<SOLTransferParams, 'amount'> {
  /** Minimum to leave in sender account (default: 0) */
  keepMinimum?: bigint
}

/**
 * Result of a native SOL transfer
 */
export interface SOLTransferResult {
  /** Transaction signature */
  txSignature: string
  /** Stealth address (base58) */
  stealthAddress: string
  /** Ephemeral public key (base58) */
  ephemeralPublicKey: string
  /** View tag for scanning */
  viewTag: string
  /** Explorer URL */
  explorerUrl: string
  /** Cluster */
  cluster: SolanaCluster
  /** Amount transferred (lamports) */
  amount: bigint
  /** Amount in SOL */
  amountSol: number
  /** Whether rent buffer was included */
  rentBufferIncluded: boolean
  /** Estimated fee paid */
  estimatedFee: bigint
}

/**
 * SOL transfer validation result
 */
export interface SOLTransferValidation {
  /** Whether transfer is valid */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Sender's SOL balance (lamports) */
  senderBalance?: bigint
  /** Sender's SOL balance in SOL */
  senderBalanceSol?: number
  /** Whether stealth account exists */
  stealthAccountExists?: boolean
  /** Recommended rent buffer */
  recommendedRentBuffer: bigint
  /** Estimated total fee */
  estimatedFee: bigint
  /** Maximum transferable amount */
  maxTransferable?: bigint
}

/**
 * Gas estimation for SOL transfer
 */
export interface SOLTransferEstimate {
  /** Base transaction fee (lamports) */
  baseFee: bigint
  /** Rent buffer for new account (if needed) */
  rentBuffer: bigint
  /** Total estimated cost (fee + rent) */
  totalCost: bigint
  /** Whether stealth account exists */
  stealthAccountExists: boolean
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a SOL transfer before execution
 *
 * Checks:
 * - Sender has sufficient balance
 * - Meta-address is valid for Solana
 * - Amount is valid and meets minimums
 * - Stealth account requirements
 *
 * @param params - Transfer parameters to validate
 * @returns Validation result
 */
export async function validateSOLTransfer(
  params: Omit<SOLTransferParams, 'signTransaction'>
): Promise<SOLTransferValidation> {
  const errors: string[] = []
  let senderBalance: bigint | undefined
  let senderBalanceSol: number | undefined
  let stealthAccountExists = false
  let maxTransferable: bigint | undefined

  const estimatedFee = ESTIMATED_TX_FEE_LAMPORTS
  let recommendedRentBuffer = 0n

  // Validate meta-address
  if (!params.recipientMetaAddress) {
    errors.push('Recipient meta-address is required')
  } else if (params.recipientMetaAddress.chain !== 'solana') {
    errors.push(`Invalid chain: expected 'solana', got '${params.recipientMetaAddress.chain}'`)
  }

  // Validate amount
  if (params.amount <= 0n) {
    errors.push('Amount must be greater than 0')
  }

  // Get sender balance
  try {
    const balance = await params.connection.getBalance(params.sender)
    senderBalance = BigInt(balance)
    senderBalanceSol = balance / LAMPORTS_PER_SOL

    // Calculate max transferable (balance - fee)
    maxTransferable = senderBalance > estimatedFee ? senderBalance - estimatedFee : 0n
  } catch (error) {
    errors.push(`Failed to check sender balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check if stealth account exists and calculate rent buffer
  if (params.recipientMetaAddress && params.recipientMetaAddress.chain === 'solana') {
    try {
      const { stealthAddress } = generateEd25519StealthAddress(params.recipientMetaAddress)
      const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      const stealthPubkey = new PublicKey(stealthAddressBase58)

      const accountInfo = await params.connection.getAccountInfo(stealthPubkey)
      stealthAccountExists = accountInfo !== null

      if (!stealthAccountExists) {
        // Account doesn't exist, recommend rent buffer
        recommendedRentBuffer = STEALTH_ACCOUNT_BUFFER

        // Amount must be >= rent-exempt minimum
        if (params.amount < RENT_EXEMPT_MINIMUM) {
          errors.push(
            `Amount ${formatLamports(params.amount)} SOL is below rent-exempt minimum ${formatLamports(RENT_EXEMPT_MINIMUM)} SOL`
          )
        }
      }
    } catch {
      // Cannot generate stealth address - error already captured
    }
  }

  // Check sufficient balance
  if (senderBalance !== undefined) {
    const totalNeeded = params.amount + estimatedFee
    if (senderBalance < totalNeeded) {
      errors.push(
        `Insufficient balance: have ${formatLamports(senderBalance)} SOL, need ${formatLamports(totalNeeded)} SOL (including fee)`
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    senderBalance,
    senderBalanceSol,
    stealthAccountExists,
    recommendedRentBuffer,
    estimatedFee,
    maxTransferable,
  }
}

/**
 * Estimate gas and costs for SOL transfer
 *
 * @param connection - Solana RPC connection
 * @param recipientMetaAddress - Recipient's meta-address
 * @returns Gas estimation
 */
export async function estimateSOLTransfer(
  connection: Connection,
  recipientMetaAddress: StealthMetaAddress
): Promise<SOLTransferEstimate> {
  const baseFee = ESTIMATED_TX_FEE_LAMPORTS
  let rentBuffer = 0n
  let stealthAccountExists = false

  // Check if stealth account exists
  const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const stealthPubkey = new PublicKey(stealthAddressBase58)

  const accountInfo = await connection.getAccountInfo(stealthPubkey)
  stealthAccountExists = accountInfo !== null

  if (!stealthAccountExists) {
    rentBuffer = STEALTH_ACCOUNT_BUFFER
  }

  return {
    baseFee,
    rentBuffer,
    totalCost: baseFee + rentBuffer,
    stealthAccountExists,
  }
}

// ─── Transfer Functions ───────────────────────────────────────────────────────

/**
 * Send native SOL privately to a stealth address
 *
 * @param params - Transfer parameters
 * @returns Transfer result
 *
 * @example
 * ```typescript
 * const result = await sendSOLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   amount: 1_000_000_000n, // 1 SOL
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * console.log(`Sent ${result.amountSol} SOL to ${result.stealthAddress}`)
 * ```
 */
export async function sendSOLTransfer(
  params: SOLTransferParams
): Promise<SOLTransferResult> {
  const {
    connection,
    sender,
    recipientMetaAddress,
    amount,
    signTransaction,
    includeRentBuffer = true,
    commitment = 'confirmed',
    customMemo,
  } = params

  // Validate meta-address
  if (!recipientMetaAddress) {
    throw new ValidationError('recipientMetaAddress is required', 'recipientMetaAddress')
  }
  if (recipientMetaAddress.chain !== 'solana') {
    throw new ValidationError(
      `Invalid chain: expected 'solana', got '${recipientMetaAddress.chain}'`,
      'recipientMetaAddress.chain'
    )
  }

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Generate stealth address
  const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const stealthPubkey = new PublicKey(stealthAddressBase58)
  const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

  // Check if stealth account exists
  const accountInfo = await connection.getAccountInfo(stealthPubkey)
  const stealthAccountExists = accountInfo !== null

  // Calculate actual transfer amount
  const transferAmount = amount
  let rentBufferIncluded = false

  if (!stealthAccountExists && includeRentBuffer) {
    // Check if amount is below rent-exempt minimum
    if (amount < RENT_EXEMPT_MINIMUM) {
      throw new ValidationError(
        `Amount ${formatLamports(amount)} SOL is below rent-exempt minimum ${formatLamports(RENT_EXEMPT_MINIMUM)} SOL for new accounts`,
        'amount'
      )
    }
    rentBufferIncluded = true
  }

  // Build transaction
  const transaction = new Transaction()

  // Add SOL transfer instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: stealthPubkey,
      lamports: transferAmount,
    })
  )

  // Add SIP announcement memo
  const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
  const memoContent = createAnnouncementMemo(
    ephemeralPubkeyBase58,
    viewTagHex,
    stealthAddressBase58
  )

  transaction.add(
    new TransactionInstruction({
      keys: [],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(memoContent, 'utf-8'),
    })
  )

  // Add custom memo if provided
  if (customMemo) {
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(customMemo, 'utf-8'),
      })
    )
  }

  // Get blockhash and sign
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = sender

  const signedTx = await signTransaction(transaction)

  // Send and confirm
  const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: commitment,
  })

  await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    commitment
  )

  const cluster = detectCluster(connection.rpcEndpoint)

  return {
    txSignature,
    stealthAddress: stealthAddressBase58,
    ephemeralPublicKey: ephemeralPubkeyBase58,
    viewTag: viewTagHex,
    explorerUrl: getExplorerUrl(txSignature, cluster),
    cluster,
    amount: transferAmount,
    amountSol: Number(transferAmount) / LAMPORTS_PER_SOL,
    rentBufferIncluded,
    estimatedFee: ESTIMATED_TX_FEE_LAMPORTS,
  }
}

/**
 * Send maximum available SOL privately to a stealth address
 *
 * Calculates maximum transferable amount (balance - fee - keepMinimum)
 * and sends that amount.
 *
 * @param params - Transfer parameters
 * @returns Transfer result
 *
 * @example
 * ```typescript
 * // Send all SOL
 * const result = await sendMaxSOLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * // Keep 0.1 SOL
 * const result = await sendMaxSOLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   keepMinimum: 100_000_000n, // 0.1 SOL
 *   signTransaction: wallet.signTransaction,
 * })
 * ```
 */
export async function sendMaxSOLTransfer(
  params: MaxSOLTransferParams
): Promise<SOLTransferResult> {
  const {
    connection,
    sender,
    recipientMetaAddress,
    signTransaction,
    keepMinimum = 0n,
    includeRentBuffer = true,
    commitment = 'confirmed',
    customMemo,
  } = params

  // Get sender balance
  const balance = await connection.getBalance(sender)
  const balanceLamports = BigInt(balance)

  // Calculate max transferable
  const estimatedFee = ESTIMATED_TX_FEE_LAMPORTS
  const reserved = estimatedFee + keepMinimum

  if (balanceLamports <= reserved) {
    throw new ValidationError(
      `Insufficient balance for max transfer: have ${formatLamports(balanceLamports)} SOL, need at least ${formatLamports(reserved + 1n)} SOL`,
      'amount'
    )
  }

  const maxAmount = balanceLamports - reserved

  // Check rent requirement for new accounts
  const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const stealthPubkey = new PublicKey(stealthAddressBase58)

  const accountInfo = await connection.getAccountInfo(stealthPubkey)
  const stealthAccountExists = accountInfo !== null

  if (!stealthAccountExists && maxAmount < RENT_EXEMPT_MINIMUM) {
    throw new ValidationError(
      `Insufficient balance for max transfer to new account: need at least ${formatLamports(RENT_EXEMPT_MINIMUM)} SOL after fees`,
      'amount'
    )
  }

  return sendSOLTransfer({
    connection,
    sender,
    recipientMetaAddress,
    amount: maxAmount,
    signTransaction,
    includeRentBuffer,
    commitment,
    customMemo,
  })
}

// ─── Batch Transfer ───────────────────────────────────────────────────────────

/**
 * Batch SOL transfer item
 */
export interface BatchSOLTransferItem {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount in lamports */
  amount: bigint
  /** Custom memo */
  customMemo?: string
}

/**
 * Batch SOL transfer result
 */
export interface BatchSOLTransferResult {
  /** Transaction signature */
  txSignature: string
  /** Individual transfer results */
  transfers: Array<{
    stealthAddress: string
    ephemeralPublicKey: string
    viewTag: string
    amount: bigint
    amountSol: number
  }>
  /** Explorer URL */
  explorerUrl: string
  /** Cluster */
  cluster: SolanaCluster
  /** Total amount transferred */
  totalAmount: bigint
  /** Total amount in SOL */
  totalAmountSol: number
}

/**
 * Send SOL to multiple stealth addresses in a single transaction
 *
 * @param connection - Solana RPC connection
 * @param sender - Sender's public key
 * @param transfers - Array of transfer items
 * @param signTransaction - Transaction signing function
 * @returns Batch transfer result
 */
export async function sendBatchSOLTransfer(
  connection: Connection,
  sender: PublicKey,
  transfers: BatchSOLTransferItem[],
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
): Promise<BatchSOLTransferResult> {
  // Validate batch size
  const MAX_BATCH_SIZE = 8 // SOL transfers are smaller than SPL
  if (transfers.length > MAX_BATCH_SIZE) {
    throw new ValidationError(
      `Batch size ${transfers.length} exceeds maximum ${MAX_BATCH_SIZE}`,
      'transfers'
    )
  }

  if (transfers.length === 0) {
    throw new ValidationError('At least one transfer is required', 'transfers')
  }

  // Calculate total amount
  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0n)

  // Check balance
  const balance = await connection.getBalance(sender)
  const balanceLamports = BigInt(balance)
  const estimatedFee = ESTIMATED_TX_FEE_LAMPORTS

  if (balanceLamports < totalAmount + estimatedFee) {
    throw new ValidationError(
      `Insufficient balance for batch: have ${formatLamports(balanceLamports)} SOL, need ${formatLamports(totalAmount + estimatedFee)} SOL`,
      'amount'
    )
  }

  // Build transaction
  const transaction = new Transaction()
  const transferResults: BatchSOLTransferResult['transfers'] = []

  for (const transfer of transfers) {
    // Validate meta-address
    if (transfer.recipientMetaAddress.chain !== 'solana') {
      throw new ValidationError(
        `Invalid chain for recipient: expected 'solana', got '${transfer.recipientMetaAddress.chain}'`,
        'recipientMetaAddress'
      )
    }

    // Generate stealth address
    const { stealthAddress } = generateEd25519StealthAddress(transfer.recipientMetaAddress)
    const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const stealthPubkey = new PublicKey(stealthAddressBase58)
    const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    // Add transfer
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: stealthPubkey,
        lamports: transfer.amount,
      })
    )

    // Add announcement memo
    const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
    const memoContent = createAnnouncementMemo(
      ephemeralPubkeyBase58,
      viewTagHex,
      stealthAddressBase58
    )

    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(memoContent, 'utf-8'),
      })
    )

    // Add custom memo if provided
    if (transfer.customMemo) {
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(transfer.customMemo, 'utf-8'),
        })
      )
    }

    transferResults.push({
      stealthAddress: stealthAddressBase58,
      ephemeralPublicKey: ephemeralPubkeyBase58,
      viewTag: viewTagHex,
      amount: transfer.amount,
      amountSol: Number(transfer.amount) / LAMPORTS_PER_SOL,
    })
  }

  // Get blockhash and sign
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = sender

  const signedTx = await signTransaction(transaction)

  // Send and confirm
  const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  const cluster = detectCluster(connection.rpcEndpoint)

  return {
    txSignature,
    transfers: transferResults,
    explorerUrl: getExplorerUrl(txSignature, cluster),
    cluster,
    totalAmount,
    totalAmountSol: Number(totalAmount) / LAMPORTS_PER_SOL,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Format lamports as SOL string
 */
export function formatLamports(lamports: bigint): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL
  if (sol === 0) return '0'
  if (sol < 0.0001) return sol.toExponential(2)
  return sol.toFixed(sol < 1 ? 4 : 2).replace(/\.?0+$/, '')
}

/**
 * Parse SOL amount to lamports
 */
export function parseSOLToLamports(sol: string | number): bigint {
  const value = typeof sol === 'string' ? parseFloat(sol.replace(/[,\s]/g, '')) : sol
  if (isNaN(value) || value < 0) {
    throw new ValidationError(`Invalid SOL amount: ${sol}`, 'amount')
  }
  return BigInt(Math.round(value * LAMPORTS_PER_SOL))
}

/**
 * Get sender's SOL balance
 */
export async function getSOLBalance(
  connection: Connection,
  address: PublicKey
): Promise<{ lamports: bigint; sol: number }> {
  const balance = await connection.getBalance(address)
  return {
    lamports: BigInt(balance),
    sol: balance / LAMPORTS_PER_SOL,
  }
}

/**
 * Detect Solana cluster from RPC endpoint
 */
function detectCluster(endpoint: string): SolanaCluster {
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('testnet')) return 'testnet'
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) return 'localnet'
  return 'mainnet-beta'
}
