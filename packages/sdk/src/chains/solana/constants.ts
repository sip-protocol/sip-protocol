/**
 * Solana Chain Constants
 *
 * Token mints, RPC endpoints, and configuration for Solana same-chain privacy.
 */

import {
  SOLANA_RPC_ENDPOINTS as SOLANA_RPC_CONFIG,
  SOLANA_EXPLORER_ENDPOINTS as SOLANA_EXPLORER_CONFIG,
} from '../../config/endpoints'

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
 * Localnet is configurable via SOLANA_LOCALNET_RPC environment variable
 */
export const SOLANA_RPC_ENDPOINTS = {
  'mainnet-beta': SOLANA_RPC_CONFIG.mainnet,
  mainnet: SOLANA_RPC_CONFIG.mainnet,
  devnet: SOLANA_RPC_CONFIG.devnet,
  testnet: SOLANA_RPC_CONFIG.testnet,
  localnet: SOLANA_RPC_CONFIG.localnet,
} as const

/**
 * Solana cluster types
 */
export type SolanaCluster = keyof typeof SOLANA_RPC_ENDPOINTS

/**
 * Explorer URLs for transaction viewing
 * Localnet is configurable via SOLANA_LOCALNET_EXPLORER environment variable
 */
export const SOLANA_EXPLORER_URLS = {
  'mainnet-beta': SOLANA_EXPLORER_CONFIG.mainnet,
  mainnet: SOLANA_EXPLORER_CONFIG.mainnet,
  devnet: `${SOLANA_EXPLORER_CONFIG.devnet}?cluster=devnet`,
  testnet: `${SOLANA_EXPLORER_CONFIG.testnet}?cluster=testnet`,
  localnet: SOLANA_EXPLORER_CONFIG.localnet,
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

// ============================================================================
// Named constants for magic numbers
// ============================================================================

/** Solana address minimum length (base58 encoded 32-byte public keys) */
export const SOLANA_ADDRESS_MIN_LENGTH = 32

/** Solana address maximum length (base58 encoded 32-byte public keys) */
export const SOLANA_ADDRESS_MAX_LENGTH = 44

/** View tag minimum value */
export const VIEW_TAG_MIN = 0

/** View tag maximum value (1 byte) */
export const VIEW_TAG_MAX = 255

/** Ed25519 key size in bytes */
export const ED25519_KEY_BYTES = 32

/** Ed25519 key hex length including '0x' prefix */
export const ED25519_KEY_HEX_LENGTH = 66

/** Default scan limit for pagination */
export const DEFAULT_SCAN_LIMIT = 100

/** Helius DAS API page limit */
export const HELIUS_DAS_PAGE_LIMIT = 1000

/** Helius maximum pages for pagination */
export const HELIUS_MAX_PAGES = 100

/** Helius API key minimum length */
export const HELIUS_API_KEY_MIN_LENGTH = 8

/** Webhook batch processing limit */
export const WEBHOOK_MAX_BATCH_SIZE = 100

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
 * Get token decimals from symbol (Solana-specific, legacy)
 *
 * @deprecated Use `getTokenDecimals(symbol, 'solana')` from the main SDK export
 * which throws on unknown tokens instead of silently returning 9.
 */
export function getSolanaTokenDecimals(symbol: string): number {
  return SOLANA_TOKEN_DECIMALS[symbol] ?? 9 // Default to 9 (SOL decimals)
}

/**
 * Sanitize a URL by masking potential credentials
 *
 * Removes or masks:
 * - API keys in query parameters (api-key, apiKey, key, token, x-token)
 * - Credentials in URL path (common for QuickNode, Triton)
 * - Basic auth credentials (user:pass@host)
 *
 * @param url - URL string to sanitize
 * @returns Sanitized URL safe for logging/error messages
 *
 * @example
 * sanitizeUrl('https://api.helius.xyz?api-key=secret123')
 * // => 'https://api.helius.xyz?api-key=***'
 *
 * sanitizeUrl('https://example.quiknode.pro/abc123def456')
 * // => 'https://example.quiknode.pro/***'
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Remove basic auth credentials
    if (parsed.username || parsed.password) {
      parsed.username = '***'
      parsed.password = ''
    }

    // Mask sensitive query parameters (case-insensitive)
    const sensitivePatterns = ['api-key', 'apikey', 'api_key', 'key', 'token', 'x-token', 'xtoken', 'secret', 'auth']
    const keysToMask: string[] = []
    for (const [key] of parsed.searchParams) {
      const keyLower = key.toLowerCase()
      if (sensitivePatterns.some((pattern) => keyLower === pattern || keyLower.includes(pattern))) {
        keysToMask.push(key)
      }
    }
    for (const key of keysToMask) {
      parsed.searchParams.set(key, '***')
    }

    // Mask path segments that look like API keys/tokens
    // QuickNode: /abc123def456 (32+ char alphanumeric)
    // Triton: /x-token-value
    const pathParts = parsed.pathname.split('/')
    const maskedParts = pathParts.map((part) => {
      // Skip empty parts and common path segments
      if (!part || part.length < 16) return part
      // If part looks like a token (long alphanumeric string), mask it
      if (/^[a-zA-Z0-9_-]{16,}$/.test(part)) {
        return '***'
      }
      return part
    })
    parsed.pathname = maskedParts.join('/')

    return parsed.toString()
  } catch {
    // If URL parsing fails, do basic string sanitization
    return url
      .replace(/api-key=[^&]+/gi, 'api-key=***')
      .replace(/apikey=[^&]+/gi, 'apikey=***')
      .replace(/token=[^&]+/gi, 'token=***')
      .replace(/\/[a-zA-Z0-9_-]{16,}(\/|$)/g, '/***$1')
  }
}
