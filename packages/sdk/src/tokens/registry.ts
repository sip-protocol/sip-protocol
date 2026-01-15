/**
 * Token Registry - Lookup token metadata by symbol or address
 *
 * This module provides a centralized registry for token metadata,
 * ensuring correct decimals are used throughout the protocol.
 *
 * CRITICAL: Never hardcode decimals (e.g., `decimals: 9`).
 * Always use this registry to get the correct decimals for a token.
 *
 * @example
 * ```typescript
 * import { getTokenDecimals, getAsset } from '@sip-protocol/sdk'
 *
 * // Get decimals for USDC on Solana
 * const decimals = getTokenDecimals('USDC', 'solana')  // Returns 6, not 9!
 *
 * // Get full asset info
 * const asset = getAsset('SOL', 'solana')
 * // { chain: 'solana', symbol: 'SOL', address: null, decimals: 9 }
 * ```
 */

import type { Asset, ChainId, HexString } from '@sip-protocol/types'
import { NATIVE_TOKENS } from '@sip-protocol/types'
import { ValidationError, ErrorCode } from '../errors'

/**
 * Extended token metadata with optional fields
 */
export interface TokenMetadata extends Asset {
  /** Common name (e.g., "USD Coin", "Tether") */
  name?: string
  /** Logo URL */
  logoUri?: string
  /** Whether this is a stablecoin */
  isStablecoin?: boolean
}

/**
 * Well-known SPL tokens on Solana with verified decimals
 */
const SOLANA_TOKENS: TokenMetadata[] = [
  // Native
  { chain: 'solana', symbol: 'SOL', address: null, decimals: 9, name: 'Solana' },
  // Stablecoins
  {
    chain: 'solana',
    symbol: 'USDC',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as HexString,
    decimals: 6,
    name: 'USD Coin',
    isStablecoin: true,
  },
  {
    chain: 'solana',
    symbol: 'USDT',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' as HexString,
    decimals: 6,
    name: 'Tether USD',
    isStablecoin: true,
  },
  // Wrapped tokens
  {
    chain: 'solana',
    symbol: 'WBTC',
    address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh' as HexString,
    decimals: 8,
    name: 'Wrapped Bitcoin',
  },
  {
    chain: 'solana',
    symbol: 'WETH',
    address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' as HexString,
    decimals: 8,
    name: 'Wrapped Ether',
  },
  // Popular DeFi tokens
  {
    chain: 'solana',
    symbol: 'RAY',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' as HexString,
    decimals: 6,
    name: 'Raydium',
  },
  {
    chain: 'solana',
    symbol: 'JUP',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' as HexString,
    decimals: 6,
    name: 'Jupiter',
  },
  {
    chain: 'solana',
    symbol: 'BONK',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' as HexString,
    decimals: 5,
    name: 'Bonk',
  },
]

/**
 * Well-known ERC-20 tokens on Ethereum with verified decimals
 */
const ETHEREUM_TOKENS: TokenMetadata[] = [
  // Native
  { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18, name: 'Ether' },
  // Stablecoins
  {
    chain: 'ethereum',
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as HexString,
    decimals: 6,
    name: 'USD Coin',
    isStablecoin: true,
  },
  {
    chain: 'ethereum',
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as HexString,
    decimals: 6,
    name: 'Tether USD',
    isStablecoin: true,
  },
  {
    chain: 'ethereum',
    symbol: 'DAI',
    address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830' as HexString,
    decimals: 18,
    name: 'Dai Stablecoin',
    isStablecoin: true,
  },
  // Wrapped tokens
  {
    chain: 'ethereum',
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as HexString,
    decimals: 8,
    name: 'Wrapped Bitcoin',
  },
  {
    chain: 'ethereum',
    symbol: 'WETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as HexString,
    decimals: 18,
    name: 'Wrapped Ether',
  },
]

/**
 * Combined token registry indexed by chain
 */
const TOKEN_REGISTRY: Map<ChainId, TokenMetadata[]> = new Map([
  ['solana', SOLANA_TOKENS],
  ['ethereum', ETHEREUM_TOKENS],
  // Other chains use NATIVE_TOKENS only for now
])

/**
 * Get token decimals by symbol and chain
 *
 * @param symbol - Token symbol (e.g., 'USDC', 'SOL', 'ETH')
 * @param chain - Chain identifier
 * @returns Number of decimals for the token
 * @throws {ValidationError} If token is unknown
 *
 * @example
 * ```typescript
 * // Correct usage - always lookup decimals
 * const decimals = getTokenDecimals('USDC', 'solana')  // 6
 * const solDecimals = getTokenDecimals('SOL', 'solana')  // 9
 * const ethDecimals = getTokenDecimals('ETH', 'ethereum')  // 18
 *
 * // This prevents the common bug of hardcoding 9:
 * // WRONG: decimals: 9
 * // RIGHT: decimals: getTokenDecimals(symbol, chain)
 * ```
 */
export function getTokenDecimals(symbol: string, chain: ChainId): number {
  const token = findToken(symbol, chain)
  if (!token) {
    throw new ValidationError(
      `Unknown token: ${symbol} on ${chain}. Register it in the token registry.`,
      'symbol',
      undefined,
      ErrorCode.TOKEN_NOT_FOUND
    )
  }
  return token.decimals
}

/**
 * Get full asset info by symbol and chain
 *
 * @param symbol - Token symbol (e.g., 'USDC', 'SOL', 'ETH')
 * @param chain - Chain identifier
 * @returns Asset object with all metadata
 * @throws {ValidationError} If token is unknown
 */
export function getAsset(symbol: string, chain: ChainId): Asset {
  const token = findToken(symbol, chain)
  if (!token) {
    throw new ValidationError(
      `Unknown token: ${symbol} on ${chain}. Register it in the token registry.`,
      'symbol',
      undefined,
      ErrorCode.TOKEN_NOT_FOUND
    )
  }
  return {
    chain: token.chain,
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals,
  }
}

/**
 * Get native token asset for a chain
 *
 * @param chain - Chain identifier
 * @returns Native token asset (SOL for Solana, ETH for Ethereum, etc.)
 * @throws {ValidationError} If chain is not supported
 */
export function getNativeToken(chain: ChainId): Asset {
  const native = NATIVE_TOKENS[chain]
  if (!native) {
    throw new ValidationError(
      `No native token defined for chain: ${chain}`,
      'chain',
      undefined,
      ErrorCode.UNSUPPORTED_CHAIN
    )
  }
  return native
}

/**
 * Get token by contract address
 *
 * @param address - Token contract address
 * @param chain - Chain identifier
 * @returns Token metadata or null if not found
 */
export function getTokenByAddress(address: string, chain: ChainId): TokenMetadata | null {
  const tokens = TOKEN_REGISTRY.get(chain) || []
  return tokens.find(t => t.address?.toLowerCase() === address.toLowerCase()) || null
}

/**
 * Check if a token is registered in the registry
 *
 * @param symbol - Token symbol
 * @param chain - Chain identifier
 * @returns true if token is known, false otherwise
 */
export function isKnownToken(symbol: string, chain: ChainId): boolean {
  return findToken(symbol, chain) !== null
}

/**
 * Get all registered tokens for a chain
 *
 * @param chain - Chain identifier
 * @returns Array of token metadata
 */
export function getTokensForChain(chain: ChainId): TokenMetadata[] {
  const tokens = TOKEN_REGISTRY.get(chain)
  if (tokens) {
    return [...tokens]
  }

  // Fall back to native token only
  const native = NATIVE_TOKENS[chain]
  if (native) {
    return [{ ...native }]
  }

  return []
}

/**
 * Internal: Find token in registry
 */
function findToken(symbol: string, chain: ChainId): TokenMetadata | null {
  const upperSymbol = symbol.toUpperCase()

  // Check chain-specific registry first
  const chainTokens = TOKEN_REGISTRY.get(chain)
  if (chainTokens) {
    const found = chainTokens.find(t => t.symbol.toUpperCase() === upperSymbol)
    if (found) return found
  }

  // Fall back to native tokens
  const native = NATIVE_TOKENS[chain]
  if (native && native.symbol.toUpperCase() === upperSymbol) {
    return { ...native }
  }

  return null
}
