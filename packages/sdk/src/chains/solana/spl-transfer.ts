/**
 * Enhanced SPL Token Transfer with Privacy Wrapping
 *
 * Provides advanced SPL token transfer functionality with:
 * - Token metadata resolution for UI display
 * - Token balance validation before transfer
 * - Batch transfer support
 * - Enhanced error handling
 *
 * @module chains/solana/spl-transfer
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
} from '@solana/spl-token'
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

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Token metadata for UI display
 */
export interface TokenMetadata {
  /** Token mint address */
  mint: string
  /** Token name (e.g., "USD Coin") */
  name: string
  /** Token symbol (e.g., "USDC") */
  symbol: string
  /** Number of decimals */
  decimals: number
  /** Token logo URI */
  logoUri?: string
  /** Token supply */
  supply?: bigint
  /** Is token frozen */
  isFrozen?: boolean
}

/**
 * Token balance information
 */
export interface TokenBalance {
  /** Token mint address */
  mint: string
  /** Balance in smallest unit (raw) */
  amount: bigint
  /** Balance formatted with decimals */
  uiAmount: number
  /** Token decimals */
  decimals: number
  /** Associated token account address */
  tokenAccount: string
}

/**
 * Enhanced transfer parameters with validation options
 */
export interface EnhancedSPLTransferParams {
  /** Solana RPC connection */
  connection: Connection
  /** Sender's public key */
  sender: PublicKey
  /** Sender's token account (ATA) - auto-detected if not provided */
  senderTokenAccount?: PublicKey
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** SPL token mint address */
  mint: PublicKey
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
  /** Function to sign the transaction */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
  /** Skip balance validation (default: false) */
  skipBalanceCheck?: boolean
  /** Transaction commitment level */
  commitment?: Commitment
  /** Custom memo to append (will be added after SIP announcement) */
  customMemo?: string
}

/**
 * Enhanced transfer result with metadata
 */
export interface EnhancedSPLTransferResult {
  /** Transaction signature */
  txSignature: string
  /** Stealth address (base58 Solana address) */
  stealthAddress: string
  /** Ephemeral public key (base58) for recipient scanning */
  ephemeralPublicKey: string
  /** View tag for efficient scanning */
  viewTag: string
  /** Explorer URL for the transaction */
  explorerUrl: string
  /** Cluster the transaction was sent on */
  cluster: SolanaCluster
  /** Token metadata */
  tokenMetadata: TokenMetadata
  /** Amount transferred */
  amount: bigint
  /** UI amount (formatted with decimals) */
  uiAmount: number
  /** Whether ATA was created */
  ataCreated: boolean
  /** Estimated fee paid */
  estimatedFee: bigint
}

/**
 * Batch transfer item
 */
export interface BatchTransferItem {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress
  /** Amount to transfer (in token's smallest unit) */
  amount: bigint
  /** Custom memo for this transfer */
  customMemo?: string
}

/**
 * Batch transfer result
 */
export interface BatchTransferResult {
  /** Transaction signature */
  txSignature: string
  /** Individual transfer results */
  transfers: Array<{
    stealthAddress: string
    ephemeralPublicKey: string
    viewTag: string
    amount: bigint
    uiAmount: number
  }>
  /** Explorer URL */
  explorerUrl: string
  /** Cluster */
  cluster: SolanaCluster
  /** Total amount transferred */
  totalAmount: bigint
  /** Token metadata */
  tokenMetadata: TokenMetadata
}

/**
 * Transfer validation result
 */
export interface TransferValidation {
  /** Whether transfer is valid */
  isValid: boolean
  /** Validation errors (if any) */
  errors: string[]
  /** Sender's token balance */
  senderBalance?: TokenBalance
  /** Estimated total fee */
  estimatedFee: bigint
  /** Whether ATA needs creation */
  needsAtaCreation: boolean
  /** Token metadata */
  tokenMetadata?: TokenMetadata
}

// ─── Token Metadata ───────────────────────────────────────────────────────────

/**
 * Well-known token metadata (mainnet)
 * Used as fallback when metadata cannot be fetched
 */
const KNOWN_TOKENS: Record<string, Omit<TokenMetadata, 'mint' | 'supply' | 'isFrozen'>> = {
  // USDC
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  // USDT
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
  // SOL (wrapped)
  'So11111111111111111111111111111111111111112': {
    name: 'Wrapped SOL',
    symbol: 'SOL',
    decimals: 9,
    logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  // BONK
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    name: 'Bonk',
    symbol: 'BONK',
    decimals: 5,
    logoUri: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  },
  // JUP
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    name: 'Jupiter',
    symbol: 'JUP',
    decimals: 6,
    logoUri: 'https://static.jup.ag/jup/icon.png',
  },
  // RAY
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    name: 'Raydium',
    symbol: 'RAY',
    decimals: 6,
    logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  },
  // PYTH
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
    name: 'Pyth Network',
    symbol: 'PYTH',
    decimals: 6,
    logoUri: 'https://pyth.network/token.svg',
  },
}

/**
 * Resolve token metadata from mint address
 *
 * Attempts to fetch metadata from on-chain, falls back to known tokens.
 *
 * @param connection - Solana RPC connection
 * @param mint - Token mint address
 * @returns Token metadata
 */
export async function resolveTokenMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<TokenMetadata> {
  const mintAddress = mint.toBase58()

  // Try known tokens first
  const known = KNOWN_TOKENS[mintAddress]

  try {
    // Fetch on-chain mint data
    const mintInfo = await getMint(connection, mint)

    if (known) {
      return {
        mint: mintAddress,
        ...known,
        supply: mintInfo.supply,
        isFrozen: mintInfo.freezeAuthority !== null,
      }
    }

    // Unknown token - return basic info
    return {
      mint: mintAddress,
      name: `Token ${mintAddress.slice(0, 8)}...`,
      symbol: mintAddress.slice(0, 4).toUpperCase(),
      decimals: mintInfo.decimals,
      supply: mintInfo.supply,
      isFrozen: mintInfo.freezeAuthority !== null,
    }
  } catch (error) {
    // Fallback if mint fetch fails
    if (known) {
      return {
        mint: mintAddress,
        ...known,
      }
    }

    throw new ValidationError(
      `Failed to resolve token metadata for ${mintAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'mint'
    )
  }
}

/**
 * Get multiple token metadata at once
 *
 * @param connection - Solana RPC connection
 * @param mints - Array of token mint addresses
 * @returns Array of token metadata
 */
export async function batchResolveTokenMetadata(
  connection: Connection,
  mints: PublicKey[]
): Promise<TokenMetadata[]> {
  return Promise.all(mints.map(mint => resolveTokenMetadata(connection, mint)))
}

// ─── Token Balance ────────────────────────────────────────────────────────────

/**
 * Get token balance for an address
 *
 * @param connection - Solana RPC connection
 * @param owner - Owner public key
 * @param mint - Token mint address
 * @returns Token balance or null if no account
 */
export async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<TokenBalance | null> {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner, true)
    const account = await getAccount(connection, ata)
    const mintInfo = await getMint(connection, mint)

    return {
      mint: mint.toBase58(),
      amount: account.amount,
      uiAmount: Number(account.amount) / Math.pow(10, mintInfo.decimals),
      decimals: mintInfo.decimals,
      tokenAccount: ata.toBase58(),
    }
  } catch {
    return null
  }
}

/**
 * Get multiple token balances for an address
 *
 * @param connection - Solana RPC connection
 * @param owner - Owner public key
 * @param mints - Array of token mint addresses
 * @returns Array of token balances (null for missing accounts)
 */
export async function batchGetTokenBalances(
  connection: Connection,
  owner: PublicKey,
  mints: PublicKey[]
): Promise<(TokenBalance | null)[]> {
  return Promise.all(mints.map(mint => getTokenBalance(connection, owner, mint)))
}

// ─── Transfer Validation ──────────────────────────────────────────────────────

/**
 * Validate a transfer before execution
 *
 * Checks:
 * - Sender has sufficient balance
 * - Meta-address is valid for Solana
 * - Amount is valid
 * - ATA creation requirements
 *
 * @param params - Transfer parameters to validate
 * @returns Validation result
 */
export async function validateTransfer(
  params: Omit<EnhancedSPLTransferParams, 'signTransaction'>
): Promise<TransferValidation> {
  const errors: string[] = []
  let senderBalance: TokenBalance | undefined
  let tokenMetadata: TokenMetadata | undefined
  let needsAtaCreation = false
  let estimatedFee = ESTIMATED_TX_FEE_LAMPORTS

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
  if (params.amount > 2n ** 64n - 1n) {
    errors.push('Amount exceeds maximum SPL token amount')
  }

  // Get sender balance
  try {
    const balance = await getTokenBalance(params.connection, params.sender, params.mint)
    if (balance) {
      senderBalance = balance
      if (balance.amount < params.amount) {
        errors.push(
          `Insufficient balance: have ${balance.uiAmount}, need ${Number(params.amount) / Math.pow(10, balance.decimals)}`
        )
      }
    } else {
      errors.push('Sender does not have a token account for this mint')
    }
  } catch (error) {
    errors.push(`Failed to check sender balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Get token metadata
  try {
    tokenMetadata = await resolveTokenMetadata(params.connection, params.mint)
  } catch (error) {
    errors.push(`Failed to resolve token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check if stealth ATA needs creation
  if (params.recipientMetaAddress && params.recipientMetaAddress.chain === 'solana') {
    try {
      const { stealthAddress } = generateEd25519StealthAddress(params.recipientMetaAddress)
      const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      const stealthPubkey = new PublicKey(stealthAddressBase58)
      const stealthATA = await getAssociatedTokenAddress(params.mint, stealthPubkey, true)

      try {
        await getAccount(params.connection, stealthATA)
      } catch {
        needsAtaCreation = true
        const rentExemption = await params.connection.getMinimumBalanceForRentExemption(165)
        estimatedFee += BigInt(rentExemption)
      }
    } catch {
      // Cannot generate stealth address - error already captured
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    senderBalance,
    estimatedFee,
    needsAtaCreation,
    tokenMetadata,
  }
}

// ─── Enhanced Transfer ────────────────────────────────────────────────────────

/**
 * Send SPL tokens privately with enhanced features
 *
 * Improvements over base transfer:
 * - Auto-detects sender token account if not provided
 * - Validates balance before transfer
 * - Includes token metadata in result
 * - Better error messages
 *
 * @param params - Enhanced transfer parameters
 * @returns Enhanced transfer result
 *
 * @example
 * ```typescript
 * const result = await sendEnhancedSPLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   recipientMetaAddress: recipientMeta,
 *   mint: USDC_MINT,
 *   amount: 5_000_000n,
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * console.log(`Sent ${result.uiAmount} ${result.tokenMetadata.symbol}`)
 * console.log(`To stealth address: ${result.stealthAddress}`)
 * ```
 */
export async function sendEnhancedSPLTransfer(
  params: EnhancedSPLTransferParams
): Promise<EnhancedSPLTransferResult> {
  const {
    connection,
    sender,
    recipientMetaAddress,
    mint,
    amount,
    signTransaction,
    skipBalanceCheck = false,
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
  if (amount > 2n ** 64n - 1n) {
    throw new ValidationError('amount exceeds maximum SPL token amount', 'amount')
  }

  // Resolve token metadata
  const tokenMetadata = await resolveTokenMetadata(connection, mint)

  // Auto-detect sender token account if not provided
  let senderTokenAccount = params.senderTokenAccount
  if (!senderTokenAccount) {
    senderTokenAccount = await getAssociatedTokenAddress(mint, sender, false)
  }

  // Check balance (unless skipped)
  if (!skipBalanceCheck) {
    const balance = await getTokenBalance(connection, sender, mint)
    if (!balance) {
      throw new ValidationError(
        `Sender does not have a ${tokenMetadata.symbol} token account`,
        'sender'
      )
    }
    if (balance.amount < amount) {
      const uiAmount = Number(amount) / Math.pow(10, tokenMetadata.decimals)
      throw new ValidationError(
        `Insufficient ${tokenMetadata.symbol} balance: have ${balance.uiAmount}, need ${uiAmount}`,
        'amount'
      )
    }
  }

  // Generate stealth address
  const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const stealthPubkey = new PublicKey(stealthAddressBase58)
  const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

  // Get or create stealth ATA
  const stealthATA = await getAssociatedTokenAddress(mint, stealthPubkey, true)

  // Build transaction
  const transaction = new Transaction()
  let ataCreated = false
  let estimatedFee = ESTIMATED_TX_FEE_LAMPORTS

  // Check if stealth ATA exists
  try {
    await getAccount(connection, stealthATA)
  } catch {
    // Create ATA
    transaction.add(
      createAssociatedTokenAccountInstruction(
        sender,
        stealthATA,
        stealthPubkey,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
    ataCreated = true
    const rentExemption = await connection.getMinimumBalanceForRentExemption(165)
    estimatedFee += BigInt(rentExemption)
  }

  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      senderTokenAccount,
      stealthATA,
      sender,
      amount
    )
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

  // Detect cluster
  const cluster = detectCluster(connection.rpcEndpoint)

  return {
    txSignature,
    stealthAddress: stealthAddressBase58,
    ephemeralPublicKey: ephemeralPubkeyBase58,
    viewTag: viewTagHex,
    explorerUrl: getExplorerUrl(txSignature, cluster),
    cluster,
    tokenMetadata,
    amount,
    uiAmount: Number(amount) / Math.pow(10, tokenMetadata.decimals),
    ataCreated,
    estimatedFee,
  }
}

// ─── Batch Transfer ───────────────────────────────────────────────────────────

/**
 * Send SPL tokens to multiple stealth addresses in a single transaction
 *
 * Note: Solana transactions have size limits (~1232 bytes).
 * Batch size is limited to prevent failures.
 *
 * @param connection - Solana RPC connection
 * @param sender - Sender's public key
 * @param senderTokenAccount - Sender's token account (optional, auto-detected)
 * @param mint - Token mint address
 * @param transfers - Array of transfer items
 * @param signTransaction - Transaction signing function
 * @returns Batch transfer result
 */
export async function sendBatchSPLTransfer(
  connection: Connection,
  sender: PublicKey,
  senderTokenAccount: PublicKey | undefined,
  mint: PublicKey,
  transfers: BatchTransferItem[],
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
): Promise<BatchTransferResult> {
  // Validate batch size (max ~5-6 transfers per transaction due to size limits)
  const MAX_BATCH_SIZE = 5
  if (transfers.length > MAX_BATCH_SIZE) {
    throw new ValidationError(
      `Batch size ${transfers.length} exceeds maximum ${MAX_BATCH_SIZE}. Split into multiple transactions.`,
      'transfers'
    )
  }

  if (transfers.length === 0) {
    throw new ValidationError('At least one transfer is required', 'transfers')
  }

  // Resolve token metadata
  const tokenMetadata = await resolveTokenMetadata(connection, mint)

  // Auto-detect sender token account
  if (!senderTokenAccount) {
    senderTokenAccount = await getAssociatedTokenAddress(mint, sender, false)
  }

  // Calculate total amount
  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0n)

  // Check balance
  const balance = await getTokenBalance(connection, sender, mint)
  if (!balance || balance.amount < totalAmount) {
    const uiAmount = Number(totalAmount) / Math.pow(10, tokenMetadata.decimals)
    throw new ValidationError(
      `Insufficient ${tokenMetadata.symbol} balance for batch: need ${uiAmount}`,
      'amount'
    )
  }

  // Build transaction
  const transaction = new Transaction()
  const transferResults: BatchTransferResult['transfers'] = []

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

    // Get stealth ATA
    const stealthATA = await getAssociatedTokenAddress(mint, stealthPubkey, true)

    // Create ATA if needed
    try {
      await getAccount(connection, stealthATA)
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          sender,
          stealthATA,
          stealthPubkey,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    // Add transfer
    transaction.add(
      createTransferInstruction(senderTokenAccount, stealthATA, sender, transfer.amount)
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
      uiAmount: Number(transfer.amount) / Math.pow(10, tokenMetadata.decimals),
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
    tokenMetadata,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Format token amount for display
 *
 * @param amount - Raw token amount
 * @param decimals - Token decimals
 * @param maxDecimals - Maximum decimal places to show (default: 4)
 * @returns Formatted string
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxDecimals: number = 4
): string {
  const value = Number(amount) / Math.pow(10, decimals)

  if (value === 0) return '0'

  // For very small amounts, use scientific notation
  if (value < Math.pow(10, -maxDecimals) && value > 0) {
    return value.toExponential(2)
  }

  // Format with appropriate decimals
  const formatted = value.toFixed(maxDecimals)

  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, '')
}

/**
 * Parse token amount from user input
 *
 * @param input - User input string (e.g., "1.5", "100")
 * @param decimals - Token decimals
 * @returns Raw token amount as bigint
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  // Remove commas and whitespace
  const cleaned = input.replace(/[,\s]/g, '')

  // Parse as float
  const value = parseFloat(cleaned)
  if (isNaN(value) || value < 0) {
    throw new ValidationError(`Invalid amount: ${input}`, 'amount')
  }

  // Convert to smallest unit
  const multiplier = Math.pow(10, decimals)
  const raw = Math.round(value * multiplier)

  return BigInt(raw)
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
