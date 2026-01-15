import type { ChainId } from '@sip-protocol/types'

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  symbol: string
  decimals: number
  name: string
  address?: string
}

/**
 * Token registry with known tokens and their metadata
 *
 * IMPORTANT: This is a static registry for common tokens.
 * In production, fetch metadata from on-chain or token list APIs.
 */
const TOKEN_REGISTRY: Record<string, Record<string, TokenMetadata>> = {
  // Solana tokens
  solana: {
    SOL: { symbol: 'SOL', decimals: 9, name: 'Solana' },
    USDC: { symbol: 'USDC', decimals: 6, name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    USDT: { symbol: 'USDT', decimals: 6, name: 'Tether USD', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
    RAY: { symbol: 'RAY', decimals: 6, name: 'Raydium', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
    BONK: { symbol: 'BONK', decimals: 5, name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    JUP: { symbol: 'JUP', decimals: 6, name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  },
  // Ethereum tokens
  ethereum: {
    ETH: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    USDC: { symbol: 'USDC', decimals: 6, name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    USDT: { symbol: 'USDT', decimals: 6, name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    WETH: { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    DAI: { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EesdeB131e560dA7' },
    WBTC: { symbol: 'WBTC', decimals: 8, name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  },
  // NEAR tokens
  near: {
    NEAR: { symbol: 'NEAR', decimals: 24, name: 'NEAR Protocol' },
    USDC: { symbol: 'USDC', decimals: 6, name: 'USD Coin', address: 'usdc.near' },
    USDT: { symbol: 'USDT', decimals: 6, name: 'Tether USD', address: 'usdt.near' },
    wNEAR: { symbol: 'wNEAR', decimals: 24, name: 'Wrapped NEAR', address: 'wrap.near' },
  },
  // Bitcoin (mostly for reference)
  bitcoin: {
    BTC: { symbol: 'BTC', decimals: 8, name: 'Bitcoin' },
  },
}

/**
 * Get token metadata for a given chain and symbol
 *
 * @throws Error if token not found (never silently return wrong decimals)
 */
export function getTokenMetadata(chain: ChainId, symbol: string): TokenMetadata {
  const chainTokens = TOKEN_REGISTRY[chain]
  if (!chainTokens) {
    throw new Error(`Unknown chain: ${chain}. Supported chains: ${Object.keys(TOKEN_REGISTRY).join(', ')}`)
  }

  // Case-insensitive lookup
  const normalizedSymbol = symbol.toUpperCase()
  const token = chainTokens[normalizedSymbol]
  if (!token) {
    throw new Error(`Unknown token ${symbol} on ${chain}. Known tokens: ${Object.keys(chainTokens).join(', ')}`)
  }

  return token
}

/**
 * Get token decimals for a given chain and symbol
 *
 * @throws Error if token not found (never silently return wrong decimals)
 */
export function getTokenDecimals(chain: ChainId, symbol: string): number {
  return getTokenMetadata(chain, symbol).decimals
}

/**
 * Check if token exists in registry
 */
export function isKnownToken(chain: ChainId, symbol: string): boolean {
  try {
    getTokenMetadata(chain, symbol)
    return true
  } catch {
    return false
  }
}
