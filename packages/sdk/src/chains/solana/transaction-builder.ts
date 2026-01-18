/**
 * Shielded Transaction Builder
 *
 * Builds properly structured Solana transactions for privacy operations.
 * Handles instruction ordering, compute budget, and versioned transactions.
 *
 * @module chains/solana/transaction-builder
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
  AddressLookupTableAccount,
  type Commitment,
  type Blockhash,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../stealth'
import type { StealthMetaAddress } from '@sip-protocol/types'
import { createAnnouncementMemo } from './types'
import { MEMO_PROGRAM_ID } from './constants'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default compute unit limit for shielded transactions
 * Higher than standard to accommodate memo + potential ATA creation
 */
export const DEFAULT_COMPUTE_UNITS = 200_000

/**
 * Default priority fee in micro-lamports per compute unit
 */
export const DEFAULT_PRIORITY_FEE = 1_000

/**
 * Minimum compute units for a simple transfer
 */
export const MIN_COMPUTE_UNITS = 50_000

/**
 * Maximum compute units allowed
 */
export const MAX_COMPUTE_UNITS = 1_400_000

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Transaction type enumeration
 */
export enum ShieldedTransactionType {
  /** SPL token transfer to stealth address */
  SPL_TRANSFER = 'spl_transfer',
  /** Native SOL transfer to stealth address */
  SOL_TRANSFER = 'sol_transfer',
  /** Claim from stealth address */
  CLAIM = 'claim',
  /** Batch transfer to multiple stealth addresses */
  BATCH_TRANSFER = 'batch_transfer',
}

/**
 * Compute budget configuration
 */
export interface ComputeBudgetConfig {
  /** Compute unit limit (default: 200,000) */
  units?: number
  /** Priority fee in micro-lamports per compute unit (default: 1,000) */
  priorityFee?: number
}

/**
 * Transaction builder configuration
 */
export interface TransactionBuilderConfig {
  /** Solana RPC connection */
  connection: Connection
  /** Fee payer public key */
  feePayer: PublicKey
  /** Use versioned transactions (default: false for legacy) */
  useVersionedTransaction?: boolean
  /** Compute budget configuration */
  computeBudget?: ComputeBudgetConfig
  /** Address lookup tables for account compression */
  lookupTables?: AddressLookupTableAccount[]
  /** Transaction commitment level */
  commitment?: Commitment
}

/**
 * SPL transfer instruction parameters
 */
export interface SPLTransferInstruction {
  /** Token mint address */
  mint: PublicKey
  /** Source token account */
  sourceAccount: PublicKey
  /** Source account owner */
  owner: PublicKey
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount to transfer */
  amount: bigint
}

/**
 * SOL transfer instruction parameters
 */
export interface SOLTransferInstruction {
  /** Source account (sender) */
  sender: PublicKey
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount in lamports */
  amount: bigint
}

/**
 * Built transaction result
 */
export interface BuiltTransaction {
  /** Transaction type */
  type: ShieldedTransactionType
  /** Legacy transaction (if useVersionedTransaction is false) */
  transaction?: Transaction
  /** Versioned transaction (if useVersionedTransaction is true) */
  versionedTransaction?: VersionedTransaction
  /** Stealth address details */
  stealthDetails: Array<{
    stealthAddress: string
    ephemeralPublicKey: string
    viewTag: string
    mint?: string
    amount: bigint
  }>
  /** Recent blockhash used */
  blockhash: Blockhash
  /** Last valid block height */
  lastValidBlockHeight: number
  /** Estimated compute units */
  estimatedComputeUnits: number
  /** Estimated fee in lamports */
  estimatedFee: bigint
}

/**
 * Serialized transaction for external signing
 */
export interface SerializedTransaction {
  /** Base64 encoded transaction */
  serialized: string
  /** Transaction type */
  type: ShieldedTransactionType
  /** Stealth details for reference */
  stealthDetails: BuiltTransaction['stealthDetails']
  /** Blockhash */
  blockhash: string
  /** Is versioned transaction */
  isVersioned: boolean
}

// ─── Transaction Builder Class ────────────────────────────────────────────────

/**
 * Shielded Transaction Builder
 *
 * Builds properly structured Solana transactions for privacy operations.
 *
 * @example Legacy transaction
 * ```typescript
 * const builder = new ShieldedTransactionBuilder({
 *   connection,
 *   feePayer: wallet.publicKey,
 * })
 *
 * const built = await builder.buildSPLTransfer({
 *   mint: USDC_MINT,
 *   sourceAccount: senderATA,
 *   owner: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   amount: 5_000_000n,
 * })
 *
 * const signedTx = await wallet.signTransaction(built.transaction!)
 * ```
 *
 * @example Versioned transaction with priority fees
 * ```typescript
 * const builder = new ShieldedTransactionBuilder({
 *   connection,
 *   feePayer: wallet.publicKey,
 *   useVersionedTransaction: true,
 *   computeBudget: { units: 300_000, priorityFee: 5_000 },
 * })
 *
 * const built = await builder.buildSOLTransfer({
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   amount: 1_000_000_000n,
 * })
 *
 * const signedTx = await wallet.signTransaction(built.versionedTransaction!)
 * ```
 */
export class ShieldedTransactionBuilder {
  private connection: Connection
  private feePayer: PublicKey
  private useVersioned: boolean
  private computeUnits: number
  private priorityFee: number
  private lookupTables: AddressLookupTableAccount[]
  private commitment: Commitment

  constructor(config: TransactionBuilderConfig) {
    this.connection = config.connection
    this.feePayer = config.feePayer
    this.useVersioned = config.useVersionedTransaction ?? false
    this.computeUnits = config.computeBudget?.units ?? DEFAULT_COMPUTE_UNITS
    this.priorityFee = config.computeBudget?.priorityFee ?? DEFAULT_PRIORITY_FEE
    this.lookupTables = config.lookupTables ?? []
    this.commitment = config.commitment ?? 'confirmed'

    // Validate compute units
    if (this.computeUnits < MIN_COMPUTE_UNITS || this.computeUnits > MAX_COMPUTE_UNITS) {
      throw new Error(
        `Compute units must be between ${MIN_COMPUTE_UNITS} and ${MAX_COMPUTE_UNITS}`
      )
    }
  }

  // ─── SPL Transfer ─────────────────────────────────────────────────────────────

  /**
   * Build SPL token transfer to stealth address
   *
   * Creates a transaction with:
   * 1. Compute budget instructions (if priority fee > 0)
   * 2. ATA creation instruction (if needed)
   * 3. SPL transfer instruction
   * 4. Memo with ephemeral key announcement
   */
  async buildSPLTransfer(params: SPLTransferInstruction): Promise<BuiltTransaction> {
    const { mint, sourceAccount, owner, recipientMetaAddress, amount } = params

    // Validate chain
    if (recipientMetaAddress.chain !== 'solana') {
      throw new Error(`Invalid chain: expected 'solana', got '${recipientMetaAddress.chain}'`)
    }

    // Generate stealth address
    const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
    const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const stealthPubkey = new PublicKey(stealthAddressBase58)
    const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    // Get stealth ATA
    const stealthATA = await getAssociatedTokenAddress(mint, stealthPubkey, true)

    // Build instructions
    const instructions: TransactionInstruction[] = []

    // 1. Compute budget (priority fee)
    if (this.priorityFee > 0) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitLimit({ units: this.computeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.priorityFee })
      )
    }

    // 2. ATA creation (if needed)
    let needsAtaCreation = false
    try {
      const accountInfo = await this.connection.getAccountInfo(stealthATA)
      needsAtaCreation = accountInfo === null
    } catch {
      needsAtaCreation = true
    }

    if (needsAtaCreation) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          this.feePayer,
          stealthATA,
          stealthPubkey,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    // 3. SPL transfer
    instructions.push(
      createTransferInstruction(sourceAccount, stealthATA, owner, amount)
    )

    // 4. Announcement memo
    const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
    const memoContent = createAnnouncementMemo(
      ephemeralPubkeyBase58,
      viewTagHex,
      stealthAddressBase58
    )

    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(memoContent, 'utf-8'),
      })
    )

    return this.buildTransaction(
      instructions,
      ShieldedTransactionType.SPL_TRANSFER,
      [{
        stealthAddress: stealthAddressBase58,
        ephemeralPublicKey: ephemeralPubkeyBase58,
        viewTag: viewTagHex,
        mint: mint.toBase58(),
        amount,
      }]
    )
  }

  // ─── SOL Transfer ─────────────────────────────────────────────────────────────

  /**
   * Build native SOL transfer to stealth address
   *
   * Creates a transaction with:
   * 1. Compute budget instructions (if priority fee > 0)
   * 2. System program transfer
   * 3. Memo with ephemeral key announcement
   */
  async buildSOLTransfer(params: SOLTransferInstruction): Promise<BuiltTransaction> {
    const { sender, recipientMetaAddress, amount } = params

    // Validate chain
    if (recipientMetaAddress.chain !== 'solana') {
      throw new Error(`Invalid chain: expected 'solana', got '${recipientMetaAddress.chain}'`)
    }

    // Generate stealth address
    const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
    const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const stealthPubkey = new PublicKey(stealthAddressBase58)
    const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    // Build instructions
    const instructions: TransactionInstruction[] = []

    // 1. Compute budget (priority fee)
    if (this.priorityFee > 0) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitLimit({ units: this.computeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.priorityFee })
      )
    }

    // 2. System transfer
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: stealthPubkey,
        lamports: amount,
      })
    )

    // 3. Announcement memo
    const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
    const memoContent = createAnnouncementMemo(
      ephemeralPubkeyBase58,
      viewTagHex,
      stealthAddressBase58
    )

    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(memoContent, 'utf-8'),
      })
    )

    return this.buildTransaction(
      instructions,
      ShieldedTransactionType.SOL_TRANSFER,
      [{
        stealthAddress: stealthAddressBase58,
        ephemeralPublicKey: ephemeralPubkeyBase58,
        viewTag: viewTagHex,
        amount,
      }]
    )
  }

  // ─── Batch Transfer ───────────────────────────────────────────────────────────

  /**
   * Build batch SPL transfer to multiple stealth addresses
   *
   * @param mint - Token mint
   * @param sourceAccount - Source token account
   * @param owner - Source account owner
   * @param transfers - Array of recipient + amount pairs
   */
  async buildBatchSPLTransfer(
    mint: PublicKey,
    sourceAccount: PublicKey,
    owner: PublicKey,
    transfers: Array<{ recipientMetaAddress: StealthMetaAddress; amount: bigint }>
  ): Promise<BuiltTransaction> {
    const instructions: TransactionInstruction[] = []
    const stealthDetails: BuiltTransaction['stealthDetails'] = []

    // 1. Compute budget (higher for batch)
    const batchComputeUnits = Math.min(
      this.computeUnits * Math.ceil(transfers.length / 2),
      MAX_COMPUTE_UNITS
    )

    if (this.priorityFee > 0) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitLimit({ units: batchComputeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.priorityFee })
      )
    }

    // 2. Process each transfer
    for (const transfer of transfers) {
      if (transfer.recipientMetaAddress.chain !== 'solana') {
        throw new Error(`Invalid chain: expected 'solana'`)
      }

      // Generate stealth address
      const { stealthAddress } = generateEd25519StealthAddress(transfer.recipientMetaAddress)
      const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      const stealthPubkey = new PublicKey(stealthAddressBase58)
      const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

      // Get/create ATA
      const stealthATA = await getAssociatedTokenAddress(mint, stealthPubkey, true)

      try {
        const accountInfo = await this.connection.getAccountInfo(stealthATA)
        if (accountInfo === null) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              this.feePayer,
              stealthATA,
              stealthPubkey,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          )
        }
      } catch {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            this.feePayer,
            stealthATA,
            stealthPubkey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      // Transfer
      instructions.push(
        createTransferInstruction(sourceAccount, stealthATA, owner, transfer.amount)
      )

      // Announcement
      const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
      const memoContent = createAnnouncementMemo(
        ephemeralPubkeyBase58,
        viewTagHex,
        stealthAddressBase58
      )

      instructions.push(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(memoContent, 'utf-8'),
        })
      )

      stealthDetails.push({
        stealthAddress: stealthAddressBase58,
        ephemeralPublicKey: ephemeralPubkeyBase58,
        viewTag: viewTagHex,
        mint: mint.toBase58(),
        amount: transfer.amount,
      })
    }

    return this.buildTransaction(
      instructions,
      ShieldedTransactionType.BATCH_TRANSFER,
      stealthDetails,
      batchComputeUnits
    )
  }

  // ─── Core Builder ─────────────────────────────────────────────────────────────

  /**
   * Build transaction from instructions
   */
  private async buildTransaction(
    instructions: TransactionInstruction[],
    type: ShieldedTransactionType,
    stealthDetails: BuiltTransaction['stealthDetails'],
    computeUnits?: number
  ): Promise<BuiltTransaction> {
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
      this.commitment
    )

    const effectiveComputeUnits = computeUnits ?? this.computeUnits

    // Calculate estimated fee
    const baseFee = 5000n // Base transaction fee
    const priorityFee = BigInt(Math.ceil((effectiveComputeUnits * this.priorityFee) / 1_000_000))
    const estimatedFee = baseFee + priorityFee

    if (this.useVersioned) {
      // Build versioned transaction
      const messageV0 = new TransactionMessage({
        payerKey: this.feePayer,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(this.lookupTables.length > 0 ? this.lookupTables : undefined)

      const versionedTransaction = new VersionedTransaction(messageV0)

      return {
        type,
        versionedTransaction,
        stealthDetails,
        blockhash,
        lastValidBlockHeight,
        estimatedComputeUnits: effectiveComputeUnits,
        estimatedFee,
      }
    } else {
      // Build legacy transaction
      const transaction = new Transaction()
      transaction.recentBlockhash = blockhash
      transaction.lastValidBlockHeight = lastValidBlockHeight
      transaction.feePayer = this.feePayer
      instructions.forEach((ix) => transaction.add(ix))

      return {
        type,
        transaction,
        stealthDetails,
        blockhash,
        lastValidBlockHeight,
        estimatedComputeUnits: effectiveComputeUnits,
        estimatedFee,
      }
    }
  }

  // ─── Serialization ────────────────────────────────────────────────────────────

  /**
   * Serialize transaction for external signing
   *
   * Useful for wallets that require base64 serialized transactions.
   */
  serializeForSigning(built: BuiltTransaction): SerializedTransaction {
    let serialized: string

    if (built.versionedTransaction) {
      serialized = Buffer.from(built.versionedTransaction.serialize()).toString('base64')
    } else if (built.transaction) {
      serialized = built.transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('base64')
    } else {
      throw new Error('No transaction to serialize')
    }

    return {
      serialized,
      type: built.type,
      stealthDetails: built.stealthDetails,
      blockhash: built.blockhash,
      isVersioned: !!built.versionedTransaction,
    }
  }

  /**
   * Deserialize a signed transaction
   */
  deserializeSignedTransaction(
    serialized: string,
    isVersioned: boolean
  ): Transaction | VersionedTransaction {
    const buffer = Buffer.from(serialized, 'base64')

    if (isVersioned) {
      return VersionedTransaction.deserialize(buffer)
    } else {
      return Transaction.from(buffer)
    }
  }

  // ─── Configuration ────────────────────────────────────────────────────────────

  /**
   * Update compute budget configuration
   */
  setComputeBudget(config: ComputeBudgetConfig): void {
    if (config.units !== undefined) {
      if (config.units < MIN_COMPUTE_UNITS || config.units > MAX_COMPUTE_UNITS) {
        throw new Error(
          `Compute units must be between ${MIN_COMPUTE_UNITS} and ${MAX_COMPUTE_UNITS}`
        )
      }
      this.computeUnits = config.units
    }
    if (config.priorityFee !== undefined) {
      this.priorityFee = config.priorityFee
    }
  }

  /**
   * Set lookup tables for account compression
   */
  setLookupTables(tables: AddressLookupTableAccount[]): void {
    this.lookupTables = tables
  }

  /**
   * Enable or disable versioned transactions
   */
  setVersionedTransactions(enabled: boolean): void {
    this.useVersioned = enabled
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    computeUnits: number
    priorityFee: number
    useVersioned: boolean
    lookupTablesCount: number
  } {
    return {
      computeUnits: this.computeUnits,
      priorityFee: this.priorityFee,
      useVersioned: this.useVersioned,
      lookupTablesCount: this.lookupTables.length,
    }
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a shielded transaction builder
 *
 * @example
 * ```typescript
 * const builder = createTransactionBuilder({
 *   connection,
 *   feePayer: wallet.publicKey,
 *   computeBudget: { priorityFee: 5000 },
 * })
 * ```
 */
export function createTransactionBuilder(
  config: TransactionBuilderConfig
): ShieldedTransactionBuilder {
  return new ShieldedTransactionBuilder(config)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Estimate compute units for a transaction
 *
 * @param instructions - Transaction instructions
 * @returns Estimated compute units
 */
export function estimateComputeUnits(instructions: TransactionInstruction[]): number {
  // Base compute per instruction
  let units = 5000 * instructions.length

  // Additional compute for specific programs
  for (const ix of instructions) {
    const programId = ix.programId.toBase58()

    if (programId === TOKEN_PROGRAM_ID.toBase58()) {
      units += 10000 // Token transfer
    } else if (programId === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) {
      units += 30000 // ATA creation
    } else if (programId === MEMO_PROGRAM_ID) {
      units += 2000 // Memo
    } else if (programId === SystemProgram.programId.toBase58()) {
      units += 3000 // System transfer
    } else if (programId === ComputeBudgetProgram.programId.toBase58()) {
      units += 500 // Compute budget
    }
  }

  return Math.min(units, MAX_COMPUTE_UNITS)
}

/**
 * Calculate priority fee from desired priority
 *
 * @param priority - Priority level (low, medium, high, urgent)
 * @returns Priority fee in micro-lamports
 */
export function calculatePriorityFee(
  priority: 'low' | 'medium' | 'high' | 'urgent'
): number {
  switch (priority) {
    case 'low':
      return 100
    case 'medium':
      return 1_000
    case 'high':
      return 10_000
    case 'urgent':
      return 100_000
    default:
      return 1_000
  }
}
