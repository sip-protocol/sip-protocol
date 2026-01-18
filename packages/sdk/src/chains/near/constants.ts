/**
 * NEAR Chain Constants
 *
 * Token addresses, RPC endpoints, and configuration for NEAR same-chain privacy.
 *
 * @packageDocumentation
 */

/**
 * Get environment variable or return default
 * Works in both Node.js and browser environments
 */
function getEnvVar(name: string, defaultValue: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || defaultValue
  }
  return defaultValue
}

/**
 * NEAR RPC endpoints by network
 */
export const NEAR_RPC_ENDPOINTS = {
  mainnet: getEnvVar('NEAR_MAINNET_RPC', 'https://rpc.mainnet.near.org'),
  testnet: getEnvVar('NEAR_TESTNET_RPC', 'https://rpc.testnet.near.org'),
  betanet: getEnvVar('NEAR_BETANET_RPC', 'https://rpc.betanet.near.org'),
  localnet: getEnvVar('NEAR_LOCALNET_RPC', 'http://localhost:3030'),
} as const

/**
 * NEAR network types
 */
export type NEARNetwork = keyof typeof NEAR_RPC_ENDPOINTS

/**
 * NEAR explorer URLs by network
 */
export const NEAR_EXPLORER_URLS = {
  mainnet: 'https://nearblocks.io',
  testnet: 'https://testnet.nearblocks.io',
  betanet: 'https://betanet.nearblocks.io',
  localnet: getEnvVar('NEAR_LOCALNET_EXPLORER', 'http://localhost:3000'),
} as const

/**
 * Common NEP-141 token contract addresses on NEAR mainnet
 */
export const NEAR_TOKEN_CONTRACTS = {
  /** Wrapped NEAR (wNEAR) */
  wNEAR: 'wrap.near',
  /** USD Coin (USDC.e) - Bridged from Ethereum */
  USDC: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
  /** Tether USD (USDT.e) - Bridged from Ethereum */
  USDT: 'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near',
  /** Aurora */
  AURORA: 'aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near',
  /** REF Finance */
  REF: 'token.v2.ref-finance.near',
  /** Linear Protocol */
  LINEAR: 'linear-protocol.near',
  /** Meta Pool stNEAR */
  stNEAR: 'meta-pool.near',
} as const

/**
 * Token decimals for NEAR tokens
 */
export const NEAR_TOKEN_DECIMALS: Record<string, number> = {
  NEAR: 24,
  wNEAR: 24,
  USDC: 6,
  USDT: 6,
  AURORA: 18,
  REF: 18,
  LINEAR: 24,
  stNEAR: 24,
}

/**
 * SIP announcement prefix for NEAR memos
 * Format: SIP:1:<ephemeral_pubkey_hex>:<view_tag_hex>
 */
export const SIP_MEMO_PREFIX = 'SIP:1:'

/**
 * NEAR implicit account length (64 hex characters = 32 bytes)
 */
export const NEAR_IMPLICIT_ACCOUNT_LENGTH = 64

/**
 * Minimum NEAR account ID length (e.g., "a.near")
 */
export const NEAR_ACCOUNT_ID_MIN_LENGTH = 2

/**
 * Maximum NEAR account ID length (64 chars for implicit, longer for named)
 */
export const NEAR_ACCOUNT_ID_MAX_LENGTH = 64

/**
 * Ed25519 key size in bytes
 */
export const ED25519_KEY_BYTES = 32

/**
 * Ed25519 key hex length including '0x' prefix
 */
export const ED25519_KEY_HEX_LENGTH = 66

/**
 * View tag minimum value
 */
export const VIEW_TAG_MIN = 0

/**
 * View tag maximum value (1 byte)
 */
export const VIEW_TAG_MAX = 255

/**
 * Default gas for NEAR transactions (300 TGas)
 */
export const DEFAULT_GAS = 300_000_000_000_000n

/**
 * Minimum storage balance for NEAR accounts (0.00125 NEAR)
 */
export const STORAGE_BALANCE_MIN = 1_250_000_000_000_000_000_000n

/**
 * Default storage deposit for NEP-141 token registration (0.0125 NEAR)
 */
export const STORAGE_DEPOSIT_DEFAULT = 12_500_000_000_000_000_000_000n

/**
 * One yoctoNEAR (smallest unit)
 */
export const ONE_YOCTO = 1n

/**
 * One NEAR in yoctoNEAR
 */
export const ONE_NEAR = 1_000_000_000_000_000_000_000_000n

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  txHash: string,
  network: NEARNetwork = 'mainnet'
): string {
  const baseUrl = NEAR_EXPLORER_URLS[network]
  return `${baseUrl}/txns/${txHash}`
}

/**
 * Get explorer URL for an account
 */
export function getAccountExplorerUrl(
  accountId: string,
  network: NEARNetwork = 'mainnet'
): string {
  const baseUrl = NEAR_EXPLORER_URLS[network]
  return `${baseUrl}/address/${accountId}`
}

/**
 * Get token contract address from symbol
 */
export function getTokenContract(symbol: string): string | undefined {
  return NEAR_TOKEN_CONTRACTS[symbol as keyof typeof NEAR_TOKEN_CONTRACTS]
}

/**
 * Get token decimals from symbol
 *
 * @deprecated Use `getTokenDecimals(symbol, 'near')` from the main SDK export
 * which throws on unknown tokens instead of silently returning 24.
 */
export function getNEARTokenDecimals(symbol: string): number {
  return NEAR_TOKEN_DECIMALS[symbol] ?? 24 // Default to 24 (NEAR decimals)
}

/**
 * Check if an account ID is an implicit account (64 hex chars)
 */
export function isImplicitAccount(accountId: string): boolean {
  return (
    accountId.length === NEAR_IMPLICIT_ACCOUNT_LENGTH &&
    /^[0-9a-f]{64}$/i.test(accountId)
  )
}

/**
 * Check if an account ID is a named account (e.g., "alice.near")
 */
export function isNamedAccount(accountId: string): boolean {
  return (
    !isImplicitAccount(accountId) &&
    /^[a-z0-9._-]+$/.test(accountId) &&
    accountId.includes('.')
  )
}

/**
 * Validate a NEAR account ID format
 */
export function isValidAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') {
    return false
  }

  // Implicit accounts: 64 hex characters
  if (isImplicitAccount(accountId)) {
    return true
  }

  // Named accounts: lowercase alphanumeric with dots, dashes, underscores
  // Min 2 chars, max 64 chars
  if (
    accountId.length >= NEAR_ACCOUNT_ID_MIN_LENGTH &&
    accountId.length <= NEAR_ACCOUNT_ID_MAX_LENGTH &&
    /^[a-z0-9._-]+$/.test(accountId) &&
    !accountId.startsWith('.') &&
    !accountId.startsWith('-') &&
    !accountId.startsWith('_') &&
    !accountId.endsWith('.') &&
    !accountId.endsWith('-') &&
    !accountId.endsWith('_')
  ) {
    return true
  }

  return false
}

/**
 * Sanitize a URL by masking potential credentials
 *
 * @param url - URL string to sanitize
 * @returns Sanitized URL safe for logging/error messages
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    if (parsed.username || parsed.password) {
      parsed.username = '***'
      parsed.password = ''
    }

    const sensitivePatterns = [
      'api-key',
      'apikey',
      'api_key',
      'key',
      'token',
      'x-token',
      'secret',
      'auth',
    ]
    const keysToMask: string[] = []
    for (const [key] of parsed.searchParams) {
      const keyLower = key.toLowerCase()
      if (
        sensitivePatterns.some(
          (pattern) => keyLower === pattern || keyLower.includes(pattern)
        )
      ) {
        keysToMask.push(key)
      }
    }
    for (const key of keysToMask) {
      parsed.searchParams.set(key, '***')
    }

    return parsed.toString()
  } catch {
    return url
      .replace(/api-key=[^&]+/gi, 'api-key=***')
      .replace(/apikey=[^&]+/gi, 'apikey=***')
      .replace(/token=[^&]+/gi, 'token=***')
  }
}
