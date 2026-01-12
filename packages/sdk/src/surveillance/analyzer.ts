/**
 * Surveillance Analyzer
 *
 * Main class for analyzing wallet privacy and surveillance exposure.
 * Orchestrates all analysis algorithms and produces comprehensive results.
 *
 * @packageDocumentation
 */

import type {
  SurveillanceAnalyzerConfig,
  FullAnalysisResult,
  AnalyzableTransaction,
  SocialLinkResult,
} from './types'
import { analyzeAddressReuse } from './algorithms/address-reuse'
import { detectClusters } from './algorithms/cluster'
import { detectExchangeExposure } from './algorithms/exchange'
import { analyzeTemporalPatterns } from './algorithms/temporal'
import { calculatePrivacyScore, calculateSIPComparison } from './scoring'

/**
 * Helius transaction history response
 */
interface HeliusTransaction {
  signature: string
  slot: number
  timestamp: number
  type: string
  fee: number
  feePayer: string
  nativeTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
  tokenTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    mint: string
    tokenAmount: number
  }>
  accountData?: Array<{
    account: string
    nativeBalanceChange: number
  }>
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: number }
      nativeOutput?: { account: string; amount: number }
      tokenInputs?: Array<{ mint: string; amount: number }>
      tokenOutputs?: Array<{ mint: string; amount: number }>
    }
  }
}

/**
 * SurveillanceAnalyzer - Analyze wallet privacy exposure
 *
 * @example
 * ```typescript
 * import { SurveillanceAnalyzer } from '@sip-protocol/sdk'
 *
 * const analyzer = new SurveillanceAnalyzer({
 *   heliusApiKey: process.env.HELIUS_API_KEY!,
 *   cluster: 'mainnet-beta',
 * })
 *
 * const result = await analyzer.analyze('7xK9...')
 * console.log(result.privacyScore.overall) // 45
 * console.log(result.privacyScore.risk) // 'high'
 * ```
 */
export class SurveillanceAnalyzer {
  private config: Required<SurveillanceAnalyzerConfig>
  private heliusUrl: string

  constructor(config: SurveillanceAnalyzerConfig) {
    if (!config.heliusApiKey) {
      throw new Error(
        'Helius API key is required. Get one at https://dev.helius.xyz'
      )
    }

    this.config = {
      heliusApiKey: config.heliusApiKey,
      cluster: config.cluster ?? 'mainnet-beta',
      maxTransactions: config.maxTransactions ?? 1000,
      includeSocialLinks: config.includeSocialLinks ?? false,
      customExchangeAddresses: config.customExchangeAddresses ?? [],
    }

    // Use Enhanced Transactions API
    this.heliusUrl =
      this.config.cluster === 'devnet'
        ? `https://api-devnet.helius.xyz/v0`
        : `https://api.helius.xyz/v0`
  }

  /**
   * Perform full privacy analysis on a wallet
   *
   * @param walletAddress - Solana wallet address to analyze
   * @returns Complete analysis result with all details
   */
  async analyze(walletAddress: string): Promise<FullAnalysisResult> {
    const startTime = Date.now()

    // Fetch transaction history
    const transactions = await this.fetchTransactionHistory(walletAddress)

    // Run all analysis algorithms
    const addressReuse = analyzeAddressReuse(transactions, walletAddress)
    const cluster = detectClusters(transactions, walletAddress)
    const exchangeExposure = detectExchangeExposure(
      transactions,
      walletAddress,
      this.config.customExchangeAddresses
    )
    const temporalPatterns = analyzeTemporalPatterns(transactions)

    // Social links (placeholder - requires external API integration)
    const socialLinks = await this.analyzeSocialLinks(walletAddress)

    // Calculate final privacy score
    const privacyScore = calculatePrivacyScore(
      addressReuse,
      cluster,
      exchangeExposure,
      temporalPatterns,
      socialLinks,
      walletAddress
    )

    // Calculate SIP protection comparison
    const sipComparison = calculateSIPComparison(privacyScore)

    const analysisDurationMs = Date.now() - startTime

    return {
      privacyScore,
      addressReuse,
      cluster,
      exchangeExposure,
      temporalPatterns,
      socialLinks,
      sipComparison,
      transactionCount: transactions.length,
      analysisDurationMs,
    }
  }

  /**
   * Fetch transaction history using Helius Enhanced Transactions API
   */
  private async fetchTransactionHistory(
    walletAddress: string
  ): Promise<AnalyzableTransaction[]> {
    const transactions: AnalyzableTransaction[] = []
    let beforeSignature: string | undefined
    let hasMore = true

    while (hasMore && transactions.length < this.config.maxTransactions) {
      const url = new URL(`${this.heliusUrl}/addresses/${walletAddress}/transactions`)
      url.searchParams.set('api-key', this.config.heliusApiKey)
      url.searchParams.set('limit', '100')

      if (beforeSignature) {
        url.searchParams.set('before', beforeSignature)
      }

      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      let response: Response
      try {
        response = await fetch(url.toString(), {
          signal: controller.signal,
        })
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Helius API request timed out after 30 seconds')
        }
        throw error
      }
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(
          `Helius API error: ${response.status} ${response.statusText}`
        )
      }

      const data = (await response.json()) as HeliusTransaction[]

      if (data.length === 0) {
        hasMore = false
        break
      }

      for (const tx of data) {
        const analyzable = this.parseTransaction(tx, walletAddress)
        if (analyzable) {
          transactions.push(analyzable)
        }
      }

      beforeSignature = data[data.length - 1]?.signature
      hasMore = data.length === 100

      // Rate limiting protection
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return transactions
  }

  /**
   * Parse Helius transaction into analyzable format
   */
  private parseTransaction(
    tx: HeliusTransaction,
    walletAddress: string
  ): AnalyzableTransaction | null {
    const involvedAddresses = new Set<string>()

    // Extract all involved addresses
    if (tx.feePayer) {
      involvedAddresses.add(tx.feePayer)
    }

    // Native transfers
    let sender: string | null = null
    let recipient: string | null = null
    let amount = BigInt(0)

    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      for (const transfer of tx.nativeTransfers) {
        involvedAddresses.add(transfer.fromUserAccount)
        involvedAddresses.add(transfer.toUserAccount)

        if (transfer.fromUserAccount === walletAddress) {
          sender = walletAddress
          recipient = transfer.toUserAccount
          amount = BigInt(transfer.amount)
        } else if (transfer.toUserAccount === walletAddress) {
          sender = transfer.fromUserAccount
          recipient = walletAddress
          amount = BigInt(transfer.amount)
        }
      }
    }

    // Token transfers
    let mint: string | null = null

    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.fromUserAccount) {
          involvedAddresses.add(transfer.fromUserAccount)
        }
        if (transfer.toUserAccount) {
          involvedAddresses.add(transfer.toUserAccount)
        }

        if (transfer.fromUserAccount === walletAddress) {
          sender = walletAddress
          recipient = transfer.toUserAccount
          amount = BigInt(Math.floor(transfer.tokenAmount))
          mint = transfer.mint
        } else if (transfer.toUserAccount === walletAddress) {
          sender = transfer.fromUserAccount
          recipient = walletAddress
          amount = BigInt(Math.floor(transfer.tokenAmount))
          mint = transfer.mint
        }
      }
    }

    // Account data for additional addresses
    if (tx.accountData) {
      for (const account of tx.accountData) {
        involvedAddresses.add(account.account)
      }
    }

    // Determine transaction type
    let type: AnalyzableTransaction['type'] = 'other'
    if (tx.type === 'SWAP' || tx.events?.swap) {
      type = 'swap'
    } else if (tx.type === 'TRANSFER' || tx.nativeTransfers?.length || tx.tokenTransfers?.length) {
      type = 'transfer'
    } else if (tx.type?.includes('STAKE')) {
      type = 'stake'
    }

    return {
      signature: tx.signature,
      slot: tx.slot,
      timestamp: tx.timestamp,
      sender,
      recipient,
      amount,
      mint,
      fee: BigInt(tx.fee || 0),
      involvedAddresses: Array.from(involvedAddresses),
      type,
      success: true, // Helius only returns successful transactions
    }
  }

  /**
   * Analyze social links (placeholder for external API integration)
   *
   * In production, this would query:
   * - SNS (Solana Name Service)
   * - Arkham Intelligence
   * - 0xppl API
   * - Other identity providers
   */
  private async analyzeSocialLinks(
    walletAddress: string
  ): Promise<SocialLinkResult> {
    // If social link analysis is disabled, return empty result
    if (!this.config.includeSocialLinks) {
      return {
        isDoxxed: false,
        partialExposure: false,
        scoreDeduction: 0,
        links: [],
      }
    }

    // Check SNS (Solana Name Service)
    try {
      const snsResult = await this.checkSNS(walletAddress)
      if (snsResult) {
        return {
          isDoxxed: false,
          partialExposure: true,
          scoreDeduction: 7,
          links: [snsResult],
        }
      }
    } catch {
      // SNS lookup failed, continue without it
    }

    return {
      isDoxxed: false,
      partialExposure: false,
      scoreDeduction: 0,
      links: [],
    }
  }

  /**
   * Check Solana Name Service for domain names
   */
  private async checkSNS(
    walletAddress: string
  ): Promise<SocialLinkResult['links'][0] | null> {
    // This is a placeholder - in production you'd use the SNS SDK
    // or Helius name lookup API
    try {
      const url = `${this.heliusUrl}/addresses/${walletAddress}/names?api-key=${this.config.heliusApiKey}`
      const response = await fetch(url)

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        return {
          platform: 'sns',
          identifier: data[0].name || data[0],
          confidence: 1.0,
        }
      }
    } catch {
      // Ignore errors
    }

    return null
  }

  /**
   * Get quick privacy score without full analysis
   *
   * Performs a lighter analysis suitable for real-time display.
   * Uses only the most recent transactions (100 max).
   */
  async quickScore(walletAddress: string): Promise<{
    score: number
    risk: 'critical' | 'high' | 'medium' | 'low'
    topIssue: string | null
  }> {
    // Create a temporary analyzer with limited transactions for quick analysis
    // This avoids mutating shared state and is thread-safe
    const quickAnalyzer = new SurveillanceAnalyzer({
      heliusApiKey: this.config.heliusApiKey,
      cluster: this.config.cluster,
      maxTransactions: 100,
      includeSocialLinks: false, // Skip social links for speed
      customExchangeAddresses: this.config.customExchangeAddresses,
    })

    const result = await quickAnalyzer.analyze(walletAddress)
    const topRecommendation = result.privacyScore.recommendations[0]

    return {
      score: result.privacyScore.overall,
      risk: result.privacyScore.risk,
      topIssue: topRecommendation?.title ?? null,
    }
  }
}

/**
 * Create a new SurveillanceAnalyzer instance
 *
 * @param config - Analyzer configuration
 * @returns SurveillanceAnalyzer instance
 *
 * @example
 * ```typescript
 * const analyzer = createSurveillanceAnalyzer({
 *   heliusApiKey: 'your-api-key',
 * })
 *
 * const result = await analyzer.analyze('wallet-address')
 * ```
 */
export function createSurveillanceAnalyzer(
  config: SurveillanceAnalyzerConfig
): SurveillanceAnalyzer {
  return new SurveillanceAnalyzer(config)
}
