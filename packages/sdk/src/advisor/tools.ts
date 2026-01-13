/**
 * Privacy Advisor LangChain Tools
 *
 * Tools for the Privacy Advisor Agent to analyze wallets and provide recommendations.
 *
 * @packageDocumentation
 */

import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { SurveillanceAnalyzer } from '../surveillance/analyzer'
import type { FullAnalysisResult, PrivacyRecommendation as SurveillanceRecommendation } from '../surveillance/types'

/**
 * Configuration for creating tools
 */
export interface ToolsConfig {
  /** Helius API key */
  heliusApiKey: string
  /** Solana cluster */
  cluster?: 'mainnet-beta' | 'devnet'
  /** Maximum transactions to analyze */
  maxTransactions?: number
}

/**
 * Create the analyze wallet tool
 *
 * @param config - Tool configuration
 * @returns LangChain tool for wallet analysis
 */
export function createAnalyzeWalletTool(config: ToolsConfig): DynamicStructuredTool {
  const analyzer = new SurveillanceAnalyzer({
    heliusApiKey: config.heliusApiKey,
    cluster: config.cluster ?? 'mainnet-beta',
    maxTransactions: config.maxTransactions ?? 500,
    includeSocialLinks: true,
  })

  return new DynamicStructuredTool({
    name: 'analyze_wallet',
    description: 'Analyze a Solana wallet for privacy risks and surveillance exposure. Returns detailed privacy score and risk breakdown.',
    schema: z.object({
      address: z.string().describe('The Solana wallet address to analyze (base58 encoded)'),
    }),
    func: async ({ address }): Promise<string> => {
      try {
        const result = await analyzer.analyze(address)
        return formatAnalysisResult(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return JSON.stringify({
          error: true,
          message: `Failed to analyze wallet: ${message}`,
        })
      }
    },
  })
}

/**
 * Create the quick score tool for faster analysis
 *
 * @param config - Tool configuration
 * @returns LangChain tool for quick scoring
 */
export function createQuickScoreTool(config: ToolsConfig): DynamicStructuredTool {
  const analyzer = new SurveillanceAnalyzer({
    heliusApiKey: config.heliusApiKey,
    cluster: config.cluster ?? 'mainnet-beta',
    maxTransactions: 100,
    includeSocialLinks: false,
  })

  return new DynamicStructuredTool({
    name: 'quick_privacy_score',
    description: 'Get a quick privacy score for a wallet without full analysis. Faster but less detailed.',
    schema: z.object({
      address: z.string().describe('The Solana wallet address to score'),
    }),
    func: async ({ address }): Promise<string> => {
      try {
        const result = await analyzer.quickScore(address)
        return JSON.stringify({
          score: result.score,
          risk: result.risk,
          topIssue: result.topIssue,
          summary: getQuickSummary(result.score),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return JSON.stringify({
          error: true,
          message: `Failed to get quick score: ${message}`,
        })
      }
    },
  })
}

/**
 * Create the SIP comparison tool
 *
 * @returns LangChain tool for SIP protection comparison
 */
export function createSIPComparisonTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'sip_protection_comparison',
    description: 'Calculate how much a privacy score would improve with SIP Protocol protection.',
    schema: z.object({
      currentScore: z.number().min(0).max(100).describe('Current privacy score'),
      addressReuseScore: z.number().min(0).max(25).describe('Address reuse score component'),
      clusterScore: z.number().min(0).max(25).describe('Cluster exposure score component'),
    }),
    func: async ({ currentScore, addressReuseScore, clusterScore }): Promise<string> => {
      // SIP stealth addresses eliminate address reuse and cluster linking
      const maxAddressImprovement = 25 - addressReuseScore
      const maxClusterImprovement = 25 - clusterScore

      // SIP typically provides 80-90% of theoretical maximum improvement
      const addressImprovement = Math.round(maxAddressImprovement * 0.85)
      const clusterImprovement = Math.round(maxClusterImprovement * 0.80)
      const totalImprovement = addressImprovement + clusterImprovement

      const projectedScore = Math.min(100, currentScore + totalImprovement)

      return JSON.stringify({
        currentScore,
        projectedScore,
        improvement: totalImprovement,
        breakdown: {
          addressReuse: {
            current: addressReuseScore,
            projected: addressReuseScore + addressImprovement,
            reason: 'Stealth addresses prevent address reuse',
          },
          cluster: {
            current: clusterScore,
            projected: clusterScore + clusterImprovement,
            reason: 'Each stealth address is unlinkable',
          },
        },
        recommendation: totalImprovement > 20
          ? 'SIP Protocol would significantly improve your privacy'
          : totalImprovement > 10
            ? 'SIP Protocol would moderately improve your privacy'
            : 'Your privacy is already good, but SIP can help maintain it',
      })
    },
  })
}

/**
 * Create the explain concept tool
 *
 * @returns LangChain tool for explaining privacy concepts
 */
export function createExplainTool(): DynamicStructuredTool {
  const explanations: Record<string, string> = {
    'stealth-address': 'A stealth address is like a P.O. Box that automatically changes after each delivery. When someone sends you crypto, it goes to a unique address that only you can access. Even if someone knows your main address, they cannot link all your received payments together.',
    'pedersen-commitment': 'A Pedersen commitment is like a sealed envelope with a number inside. You can prove the envelope contains a valid number without opening it. This lets blockchain verify transactions are correct without revealing the actual amounts.',
    'viewing-key': 'A viewing key is like giving someone read-only access to your bank statements. They can see your transactions but cannot spend your money. This is useful for tax preparers, auditors, or proving funds to a lender.',
    'address-reuse': 'Address reuse is when you receive multiple payments to the same address. This is bad for privacy because anyone watching that address can see all your incoming payments and potentially link them to your identity.',
    'cluster-analysis': 'Cluster analysis is a technique used to link multiple wallet addresses to the same owner. By analyzing transaction patterns (like which addresses send to each other or appear together), analysts can de-anonymize users.',
    'privacy-score': 'Your privacy score (0-100) measures how resistant your wallet is to surveillance. Higher is better. It considers: address reuse (are you using the same address?), cluster exposure (can your wallets be linked?), exchange interactions (do KYC exchanges know you?), and timing patterns.',
  }

  return new DynamicStructuredTool({
    name: 'explain_privacy_concept',
    description: 'Explain a privacy concept in simple terms',
    schema: z.object({
      concept: z.enum([
        'stealth-address',
        'pedersen-commitment',
        'viewing-key',
        'address-reuse',
        'cluster-analysis',
        'privacy-score',
      ]).describe('The concept to explain'),
    }),
    func: async ({ concept }): Promise<string> => {
      return explanations[concept] ?? 'I don\'t have an explanation for that concept yet.'
    },
  })
}

/**
 * Format analysis result for the agent
 */
function formatAnalysisResult(result: FullAnalysisResult): string {
  const { privacyScore, addressReuse, cluster, exchangeExposure, temporalPatterns, sipComparison } = result

  // Format recommendations for readability
  const topRecommendations = privacyScore.recommendations
    .slice(0, 5)
    .map((rec: SurveillanceRecommendation, i: number) => ({
      rank: i + 1,
      title: rec.title,
      action: rec.action,
      severity: rec.severity,
      potentialGain: rec.potentialGain,
    }))

  return JSON.stringify({
    // Summary
    overall: {
      score: privacyScore.overall,
      risk: privacyScore.risk,
      analyzedAt: new Date(privacyScore.analyzedAt).toISOString(),
    },

    // Score breakdown
    breakdown: privacyScore.breakdown,

    // Key findings
    findings: {
      addressReuse: {
        count: addressReuse.totalReuseCount,
        severity: addressReuse.scoreDeduction > 15 ? 'critical' : addressReuse.scoreDeduction > 8 ? 'high' : 'medium',
        mostReused: addressReuse.reusedAddresses.slice(0, 3),
      },
      clusterExposure: {
        linkedAddresses: cluster.linkedAddressCount,
        confidence: cluster.confidence,
        clusters: cluster.clusters.length,
      },
      exchangeExposure: {
        exchanges: exchangeExposure.exchangeCount,
        deposits: exchangeExposure.depositCount,
        withdrawals: exchangeExposure.withdrawalCount,
        kycExchanges: exchangeExposure.exchanges.filter((e: { kycRequired: boolean }) => e.kycRequired).length,
      },
      temporalPatterns: {
        patternsFound: temporalPatterns.patterns.length,
        inferredTimezone: temporalPatterns.inferredTimezone,
        patterns: temporalPatterns.patterns.map((p: { type: string; confidence: number }) => ({
          type: p.type,
          confidence: p.confidence,
        })),
      },
    },

    // SIP improvement projection
    sipComparison: {
      currentScore: sipComparison.currentScore,
      projectedScore: sipComparison.projectedScore,
      improvement: sipComparison.improvement,
    },

    // Top recommendations
    recommendations: topRecommendations,

    // Transaction count analyzed
    transactionCount: result.transactionCount,
  }, null, 2)
}

/**
 * Get a quick summary based on score
 */
function getQuickSummary(score: number): string {
  if (score >= 80) {
    return 'Excellent privacy. Your wallet shows minimal surveillance exposure.'
  } else if (score >= 60) {
    return 'Good privacy with some room for improvement. Consider using stealth addresses.'
  } else if (score >= 40) {
    return 'Moderate privacy risks detected. Your wallet activity may be trackable.'
  } else if (score >= 20) {
    return 'High privacy risks. Your wallet is significantly exposed to surveillance.'
  } else {
    return 'Critical privacy risks. Your wallet activity is highly visible to analysts.'
  }
}

/**
 * Create all tools for the Privacy Advisor agent
 *
 * @param config - Tool configuration
 * @returns Array of LangChain tools
 *
 * @example
 * ```typescript
 * const tools = createPrivacyAdvisorTools({
 *   heliusApiKey: process.env.HELIUS_API_KEY!,
 *   cluster: 'mainnet-beta',
 * })
 *
 * // Use with LangChain agent
 * const agent = await createOpenAIToolsAgent({
 *   llm: model,
 *   tools,
 *   prompt,
 * })
 * ```
 */
export function createPrivacyAdvisorTools(config: ToolsConfig): DynamicStructuredTool[] {
  return [
    createAnalyzeWalletTool(config),
    createQuickScoreTool(config),
    createSIPComparisonTool(),
    createExplainTool(),
  ]
}
