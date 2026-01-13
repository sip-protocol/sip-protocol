/**
 * Solana Shared Utilities
 *
 * Common utility functions used across scan.ts and webhook.ts.
 * Extracted to reduce code duplication (L3 audit fix).
 */

import { SOLANA_TOKEN_MINTS } from './constants'

/**
 * Token balance entry from Solana transaction metadata
 *
 * Common interface for pre/post token balances used in both
 * standard RPC and webhook transaction parsing.
 */
export interface TokenBalanceEntry {
  accountIndex: number
  mint: string
  uiTokenAmount: {
    amount: string
    decimals: number
  }
}

/**
 * Result of parsing a token transfer from transaction balances
 */
export interface TokenTransferInfo {
  /** Token mint address (base58) */
  mint: string
  /** Transfer amount in smallest unit */
  amount: bigint
}

/**
 * Get token symbol from mint address
 *
 * Looks up the token symbol for a known mint address in our registry.
 * Returns undefined for unknown tokens.
 *
 * @param mint - SPL token mint address (base58)
 * @returns Token symbol (e.g., 'USDC') or undefined if not found
 *
 * @example
 * ```typescript
 * getTokenSymbol('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
 * // => 'USDC'
 *
 * getTokenSymbol('unknown-mint-address')
 * // => undefined
 * ```
 */
export function getTokenSymbol(mint: string): string | undefined {
  for (const [symbol, address] of Object.entries(SOLANA_TOKEN_MINTS)) {
    if (address === mint) {
      return symbol
    }
  }
  return undefined
}

/**
 * Parse token transfer info from pre/post balance changes
 *
 * Analyzes pre and post token balances to determine the transferred
 * token and amount. Finds the first account with an increased balance.
 *
 * @param preBalances - Pre-transaction token balances
 * @param postBalances - Post-transaction token balances
 * @returns Token mint and amount transferred, or null if no transfer found
 *
 * @example
 * ```typescript
 * const transfer = parseTokenTransferFromBalances(
 *   tx.meta.preTokenBalances,
 *   tx.meta.postTokenBalances
 * )
 *
 * if (transfer) {
 *   console.log(`Received ${transfer.amount} of ${transfer.mint}`)
 * }
 * ```
 */
export function parseTokenTransferFromBalances(
  preBalances: TokenBalanceEntry[] | undefined | null,
  postBalances: TokenBalanceEntry[] | undefined | null
): TokenTransferInfo | null {
  if (!postBalances || !preBalances) {
    return null
  }

  // Find token balance changes (account with increased balance)
  for (const post of postBalances) {
    const pre = preBalances.find(
      (p) => p.accountIndex === post.accountIndex
    )

    const postAmount = BigInt(post.uiTokenAmount.amount)
    const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n

    if (postAmount > preAmount) {
      return {
        mint: post.mint,
        amount: postAmount - preAmount,
      }
    }
  }

  return null
}
