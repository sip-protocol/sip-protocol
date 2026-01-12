/**
 * Exchange Exposure Detection Algorithm
 *
 * Detects interactions with known exchange addresses to identify
 * KYC exposure points. Deposits to centralized exchanges are
 * particularly privacy-degrading as they link on-chain activity
 * to verified identities.
 *
 * @packageDocumentation
 */

import type {
  AnalyzableTransaction,
  ExchangeExposureResult,
  KnownExchange,
} from '../types'

/**
 * Maximum score deduction for exchange exposure (out of 20)
 */
const MAX_DEDUCTION = 20

/**
 * Deduction per unique CEX (KYC required)
 */
const DEDUCTION_PER_CEX = 8

/**
 * Deduction per unique DEX (no KYC but still traceable)
 */
const DEDUCTION_PER_DEX = 2

/**
 * Known Solana exchange addresses
 * Sources: Arkham Intelligence, public documentation
 */
export const KNOWN_EXCHANGES: KnownExchange[] = [
  // Centralized Exchanges (KYC Required)
  {
    name: 'Binance',
    addresses: [
      '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'Coinbase',
    addresses: [
      'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
      '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
      'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'Kraken',
    addresses: [
      'krakenmRKej41L9sX8N8Z2mhjZ8UpVHHBMzkKzfBh54',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'FTX (Defunct)',
    addresses: [
      'FTXkd8cjuYGRLzPVdvqxNxNNNYBfFPPjrF3vW2Yq8p7',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'KuCoin',
    addresses: [
      'BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'OKX',
    addresses: [
      'GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'Bybit',
    addresses: [
      'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW3',
    ],
    type: 'cex',
    kycRequired: true,
  },
  {
    name: 'Gate.io',
    addresses: [
      'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
    ],
    type: 'cex',
    kycRequired: true,
  },

  // Decentralized Exchanges (No KYC but traceable)
  {
    name: 'Jupiter',
    addresses: [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    ],
    type: 'dex',
    kycRequired: false,
  },
  {
    name: 'Raydium',
    addresses: [
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ],
    type: 'dex',
    kycRequired: false,
  },
  {
    name: 'Orca',
    addresses: [
      '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    ],
    type: 'dex',
    kycRequired: false,
  },
  {
    name: 'Marinade',
    addresses: [
      'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    ],
    type: 'dex',
    kycRequired: false,
  },
  {
    name: 'Phantom Swap',
    addresses: [
      'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    ],
    type: 'dex',
    kycRequired: false,
  },
]

/**
 * Build address lookup map for efficient detection
 */
function buildExchangeLookup(
  exchanges: KnownExchange[]
): Map<string, KnownExchange> {
  const lookup = new Map<string, KnownExchange>()

  for (const exchange of exchanges) {
    for (const address of exchange.addresses) {
      lookup.set(address, exchange)
    }
  }

  return lookup
}

/**
 * Detect exchange interactions in transaction history
 *
 * @param transactions - Transaction history to analyze
 * @param walletAddress - The wallet being analyzed
 * @param customExchanges - Optional custom exchange list
 * @returns Exchange exposure analysis result
 *
 * @example
 * ```typescript
 * const result = detectExchangeExposure(transactions, 'abc123...')
 * console.log(result.exchangeCount) // 2
 * console.log(result.exchanges[0].name) // 'Binance'
 * ```
 */
export function detectExchangeExposure(
  transactions: AnalyzableTransaction[],
  walletAddress: string,
  customExchanges?: KnownExchange[]
): ExchangeExposureResult {
  const exchanges = customExchanges
    ? [...KNOWN_EXCHANGES, ...customExchanges]
    : KNOWN_EXCHANGES

  const lookup = buildExchangeLookup(exchanges)

  // Track interactions per exchange
  const exchangeStats = new Map<
    string,
    {
      exchange: KnownExchange
      deposits: number
      withdrawals: number
      firstInteraction: number
      lastInteraction: number
    }
  >()

  for (const tx of transactions) {
    if (!tx.success) continue

    // Check all involved addresses
    for (const addr of tx.involvedAddresses) {
      const exchange = lookup.get(addr)
      if (!exchange) continue

      // Initialize stats if first interaction
      if (!exchangeStats.has(exchange.name)) {
        exchangeStats.set(exchange.name, {
          exchange,
          deposits: 0,
          withdrawals: 0,
          firstInteraction: tx.timestamp,
          lastInteraction: tx.timestamp,
        })
      }

      const stats = exchangeStats.get(exchange.name)!

      // Update timestamps
      stats.firstInteraction = Math.min(stats.firstInteraction, tx.timestamp)
      stats.lastInteraction = Math.max(stats.lastInteraction, tx.timestamp)

      // Determine deposit vs withdrawal
      if (tx.sender === walletAddress && tx.recipient === addr) {
        // Wallet sent TO exchange = deposit
        stats.deposits++
      } else if (tx.sender === addr && tx.recipient === walletAddress) {
        // Exchange sent TO wallet = withdrawal
        stats.withdrawals++
      } else if (tx.sender === walletAddress) {
        // Wallet interacted with exchange (could be swap)
        stats.deposits++
      }
    }
  }

  // Calculate totals
  let totalDeposits = 0
  let totalWithdrawals = 0
  let cexCount = 0
  let dexCount = 0

  const exchangeResults: ExchangeExposureResult['exchanges'] = []

  for (const [name, stats] of Array.from(exchangeStats.entries())) {
    totalDeposits += stats.deposits
    totalWithdrawals += stats.withdrawals

    if (stats.exchange.type === 'cex') {
      cexCount++
    } else {
      dexCount++
    }

    exchangeResults.push({
      name,
      type: stats.exchange.type,
      kycRequired: stats.exchange.kycRequired,
      deposits: stats.deposits,
      withdrawals: stats.withdrawals,
      firstInteraction: stats.firstInteraction,
      lastInteraction: stats.lastInteraction,
    })
  }

  // Sort by interaction count (most active first)
  exchangeResults.sort(
    (a, b) => b.deposits + b.withdrawals - (a.deposits + a.withdrawals)
  )

  // Calculate score deduction
  const cexDeduction = cexCount * DEDUCTION_PER_CEX
  const dexDeduction = dexCount * DEDUCTION_PER_DEX
  const rawDeduction = cexDeduction + dexDeduction
  const scoreDeduction = Math.min(rawDeduction, MAX_DEDUCTION)

  return {
    exchangeCount: exchangeStats.size,
    depositCount: totalDeposits,
    withdrawalCount: totalWithdrawals,
    scoreDeduction,
    exchanges: exchangeResults,
  }
}
