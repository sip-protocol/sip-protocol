/**
 * Helius Enhanced Transactions API Types
 *
 * Types for the Enhanced Transactions API which provides human-readable
 * transaction data with token metadata enrichment.
 *
 * @see https://docs.helius.dev/solana-apis/enhanced-transactions
 */

/**
 * Transaction types supported by Helius Enhanced Transactions API
 *
 * This is a subset of the most common types. The full list includes
 * 200+ types covering DeFi, NFTs, and protocol-specific operations.
 */
export type EnhancedTransactionType =
  // Common transaction types
  | 'TRANSFER'
  | 'SWAP'
  | 'BURN'
  | 'MINT'
  // NFT operations
  | 'NFT_SALE'
  | 'NFT_LISTING'
  | 'NFT_CANCEL_LISTING'
  | 'NFT_BID'
  | 'NFT_MINT'
  | 'NFT_BURN'
  | 'COMPRESSED_NFT_MINT'
  | 'COMPRESSED_NFT_TRANSFER'
  | 'COMPRESSED_NFT_BURN'
  // DeFi operations
  | 'ADD_LIQUIDITY'
  | 'REMOVE_LIQUIDITY'
  | 'STAKE'
  | 'UNSTAKE'
  | 'BORROW'
  | 'REPAY'
  | 'CLAIM_REWARDS'
  // Governance
  | 'VOTE'
  | 'CREATE_PROPOSAL'
  // Generic
  | 'UNKNOWN'
  | string // Allow for new types not yet defined

/**
 * Native SOL transfer details
 */
export interface NativeTransfer {
  /** Sender address */
  fromUserAccount: string
  /** Recipient address */
  toUserAccount: string
  /** Amount in lamports */
  amount: number
}

/**
 * SPL token transfer details
 */
export interface TokenTransfer {
  /** Sender address */
  fromUserAccount: string
  /** Recipient address */
  toUserAccount: string
  /** Sender's token account */
  fromTokenAccount: string
  /** Recipient's token account */
  toTokenAccount: string
  /** Token mint address */
  mint: string
  /** Amount in smallest units */
  tokenAmount: number
  /** Token symbol (e.g., 'USDC') */
  tokenSymbol?: string
  /** Token name (e.g., 'USD Coin') */
  tokenName?: string
  /** Token decimals */
  decimals?: number
}

/**
 * NFT transfer details
 */
export interface NftTransfer {
  /** NFT mint address */
  mint: string
  /** NFT name */
  name?: string
  /** NFT image URL */
  imageUrl?: string
  /** Collection name */
  collectionName?: string
  /** Sender address */
  fromUserAccount: string
  /** Recipient address */
  toUserAccount: string
}

/**
 * Swap event details
 */
export interface SwapEvent {
  /** Native SOL involved in swap */
  nativeInput?: {
    account: string
    amount: number
  }
  nativeOutput?: {
    account: string
    amount: number
  }
  /** Token inputs */
  tokenInputs: Array<{
    userAccount: string
    tokenAccount: string
    mint: string
    rawTokenAmount: {
      tokenAmount: string
      decimals: number
    }
  }>
  /** Token outputs */
  tokenOutputs: Array<{
    userAccount: string
    tokenAccount: string
    mint: string
    rawTokenAmount: {
      tokenAmount: string
      decimals: number
    }
  }>
  /** Program that executed the swap */
  innerSwaps?: Array<{
    programInfo: {
      source: string
      account: string
      programName: string
      instructionName: string
    }
    tokenInputs: Array<{
      mint: string
      rawTokenAmount: {
        tokenAmount: string
        decimals: number
      }
    }>
    tokenOutputs: Array<{
      mint: string
      rawTokenAmount: {
        tokenAmount: string
        decimals: number
      }
    }>
  }>
}

/**
 * Enhanced transaction event data
 */
export interface EnhancedTransactionEvents {
  /** Swap events */
  swap?: SwapEvent
  /** NFT-specific events */
  nft?: {
    seller?: string
    buyer?: string
    nfts?: Array<{
      mint: string
      name?: string
      imageUrl?: string
    }>
    saleType?: string
    amount?: number
  }
  /** Compressed NFT events */
  compressed?: Array<{
    type: string
    treeId: string
    leafIndex: number
    assetId: string
    newLeafOwner?: string
    oldLeafOwner?: string
  }>
}

/**
 * Account data from enhanced transaction
 */
export interface EnhancedAccountData {
  /** Account address */
  account: string
  /** Native SOL change in lamports */
  nativeBalanceChange: number
  /** Token balance changes */
  tokenBalanceChanges: Array<{
    mint: string
    rawTokenAmount: {
      tokenAmount: string
      decimals: number
    }
    userAccount: string
    tokenAccount: string
  }>
}

/**
 * Enhanced transaction returned by parseTransaction API
 */
export interface EnhancedTransaction {
  /** Transaction signature */
  signature: string
  /** Human-readable description */
  description: string
  /** Transaction type */
  type: EnhancedTransactionType
  /** Source of the transaction (program/protocol name) */
  source: string
  /** Fee in lamports */
  fee: number
  /** Fee payer address */
  feePayer: string
  /** Slot number */
  slot: number
  /** Block timestamp (Unix seconds) */
  timestamp: number
  /** Native SOL transfers */
  nativeTransfers: NativeTransfer[]
  /** SPL token transfers */
  tokenTransfers: TokenTransfer[]
  /** Account data with balance changes */
  accountData: EnhancedAccountData[]
  /** Transaction-specific events */
  events?: EnhancedTransactionEvents
  /** Transaction error if failed */
  transactionError?: {
    error: string
  } | null
}

/**
 * Options for parsing transactions
 */
export interface ParseTransactionsOptions {
  /** Transaction signatures to parse */
  signatures: string[]
}

/**
 * Options for getting transaction history
 */
export interface GetTransactionHistoryOptions {
  /** Filter by transaction type */
  type?: EnhancedTransactionType
  /** Limit number of results (default: 100, max: 100) */
  limit?: number
  /** Pagination cursor for next page */
  before?: string
}

/**
 * SIP-specific transaction metadata
 *
 * Extracted from memo program instructions in SIP transactions.
 * Used for privacy-preserving display to viewing key holders.
 */
export interface SIPTransactionMetadata {
  /** Whether this is a SIP shielded transaction */
  isSIPTransaction: boolean
  /** Ephemeral public key for stealth address derivation */
  ephemeralPubKey?: string
  /** View tag for fast scanning (1 byte) */
  viewTag?: number
  /** Encrypted amount (for viewing key holders only) */
  encryptedAmount?: string
  /** Stealth address recipient */
  stealthAddress?: string
  /** Token mint involved */
  tokenMint?: string
  /** Raw memo data */
  rawMemo?: string
}

/**
 * Enhanced transaction with SIP-specific metadata
 */
export interface SIPEnhancedTransaction extends EnhancedTransaction {
  /** SIP-specific metadata extracted from transaction */
  sipMetadata: SIPTransactionMetadata
}

/**
 * Privacy-preserving display options
 */
export interface PrivacyDisplayOptions {
  /** Viewing private key for decryption (hex) */
  viewingPrivateKey?: string
  /** Show amounts only to authorized viewers */
  hideAmountsForUnauthorized?: boolean
  /** Mask addresses for unauthorized viewers */
  maskAddresses?: boolean
}

/**
 * Human-readable transaction summary
 *
 * Provides a clean summary for UI display while respecting privacy.
 */
export interface TransactionSummary {
  /** Transaction signature */
  signature: string
  /** Human-readable title */
  title: string
  /** Detailed description */
  description: string
  /** Transaction type for categorization */
  type: EnhancedTransactionType
  /** Timestamp */
  timestamp: Date
  /** Fee in SOL */
  feeInSol: number
  /** Whether viewer is authorized to see full details */
  isAuthorizedViewer: boolean
  /** Tokens involved (with amounts if authorized) */
  tokens: Array<{
    symbol: string
    name?: string
    amount?: string // Formatted amount (hidden if not authorized)
    direction: 'in' | 'out'
  }>
  /** Status */
  status: 'success' | 'failed'
  /** Explorer URL */
  explorerUrl?: string
}
