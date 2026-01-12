/**
 * Surveillance Analysis Module
 *
 * Analyzes wallet privacy exposure and surveillance vulnerability.
 * Provides privacy scoring, recommendations, and SIP protection comparison.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { createSurveillanceAnalyzer } from '@sip-protocol/sdk'
 *
 * const analyzer = createSurveillanceAnalyzer({
 *   heliusApiKey: process.env.HELIUS_API_KEY!,
 * })
 *
 * const result = await analyzer.analyze('7xK9abc123...')
 *
 * console.log(`Privacy Score: ${result.privacyScore.overall}/100`)
 * console.log(`Risk Level: ${result.privacyScore.risk}`)
 *
 * // Show recommendations
 * for (const rec of result.privacyScore.recommendations) {
 *   console.log(`- ${rec.title}: ${rec.action}`)
 * }
 *
 * // SIP protection comparison
 * console.log(`With SIP: ${result.sipComparison.projectedScore}/100`)
 * console.log(`Improvement: +${result.sipComparison.improvement} points`)
 * ```
 */

// Main analyzer
export {
  SurveillanceAnalyzer,
  createSurveillanceAnalyzer,
} from './analyzer'

// Types
export type {
  RiskLevel,
  PrivacyScore,
  PrivacyScoreBreakdown,
  PrivacyRecommendation,
  AddressReuseResult,
  ClusterResult,
  ExchangeExposureResult,
  TemporalPatternResult,
  SocialLinkResult,
  SIPProtectionComparison,
  FullAnalysisResult,
  SurveillanceAnalyzerConfig,
  AnalyzableTransaction,
  KnownExchange,
} from './types'

// Individual algorithms (for advanced usage)
export { analyzeAddressReuse } from './algorithms/address-reuse'
export { detectClusters } from './algorithms/cluster'
export { detectExchangeExposure, KNOWN_EXCHANGES } from './algorithms/exchange'
export { analyzeTemporalPatterns } from './algorithms/temporal'

// Scoring utilities
export { calculatePrivacyScore, calculateSIPComparison } from './scoring'
