/**
 * Solana Chain Constants
 *
 * Token mints, RPC endpoints, and configuration for Solana same-chain privacy.
 */

/**
 * Common SPL token mint addresses on Solana mainnet
 */
export const SOLANA_TOKEN_MINTS = {
  /** USD Coin (USDC) - Circle's stablecoin */
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  /** Tether USD (USDT) */
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  /** Wrapped SOL (for SPL token operations with native SOL) */
  WSOL: 'So11111111111111111111111111111111111111112',
} as const

/**
 * Token decimals for Solana tokens
 */
export const SOLANA_TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  WSOL: 9,
  USDC: 6,
  USDT: 6,
}

/**
 * RPC endpoints for Solana clusters
 */
export const SOLANA_RPC_ENDPOINTS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
} as const

/**
 * Solana cluster types
 */
export type SolanaCluster = keyof typeof SOLANA_RPC_ENDPOINTS

/**
 * Explorer URLs for transaction viewing
 */
export const SOLANA_EXPLORER_URLS = {
  'mainnet-beta': 'https://solscan.io',
  mainnet: 'https://solscan.io',
  devnet: 'https://solscan.io?cluster=devnet',
  testnet: 'https://solscan.io?cluster=testnet',
  localnet: 'http://localhost:3000',
} as const

/**
 * Memo program ID for Solana
 */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

/**
 * SIP announcement memo prefix
 * Format: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
 */
export const SIP_MEMO_PREFIX = 'SIP:1:'

/**
 * Estimated transaction fee in lamports
 * Includes base fee + rent for ATA creation
 */
export const ESTIMATED_TX_FEE_LAMPORTS = 5000n

/**
 * Estimated ATA rent in lamports (for creating Associated Token Account)
 */
export const ATA_RENT_LAMPORTS = 2039280n

// L2 FIX: Named constants for magic numbers

/**
 * Maximum pagination pages to prevent infinite loops
 * Used in HeliusProvider.getAssetsByOwner
 */
export const MAX_PAGINATION_PAGES = 100

/**
 * Maximum valid view tag value (1 byte: 0-255)
 * View tags are used for efficient stealth address scanning
 */
export const MAX_VIEW_TAG_VALUE = 255

/**
 * Default limit for scanning transactions
 * Used in scanForPayments when limit is not specified
 */
export const DEFAULT_SCAN_LIMIT = 100

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  signature: string,
  cluster: SolanaCluster = 'mainnet-beta'
): string {
  const baseUrl = SOLANA_EXPLORER_URLS[cluster]
  return `${baseUrl}/tx/${signature}`
}

/**
 * Get token mint address from symbol
 */
export function getTokenMint(symbol: string): string | undefined {
  return SOLANA_TOKEN_MINTS[symbol as keyof typeof SOLANA_TOKEN_MINTS]
}

/**
 * Get token decimals from symbol
 */
export function getTokenDecimals(symbol: string): number {
  return SOLANA_TOKEN_DECIMALS[symbol] ?? 9 // Default to 9 (SOL decimals)
}
