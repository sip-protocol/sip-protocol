/**
 * Privacy Scoring Module
 *
 * Calculates overall privacy score and generates recommendations
 * based on individual analysis results.
 *
 * @packageDocumentation
 */

import type {
  PrivacyScore,
  PrivacyScoreBreakdown,
  PrivacyRecommendation,
  RiskLevel,
  AddressReuseResult,
  ClusterResult,
  ExchangeExposureResult,
  TemporalPatternResult,
  SocialLinkResult,
  SIPProtectionComparison,
} from './types'

/**
 * Maximum points per category
 */
const MAX_POINTS = {
  addressReuse: 25,
  clusterExposure: 25,
  exchangeExposure: 20,
  temporalPatterns: 15,
  socialLinks: 15,
}

/**
 * Total maximum score
 */
const TOTAL_MAX_SCORE = Object.values(MAX_POINTS).reduce((a, b) => a + b, 0)

/**
 * Risk level thresholds
 */
const RISK_THRESHOLDS = {
  critical: 30,
  high: 50,
  medium: 70,
  low: 100,
}

/**
 * Calculate privacy score from analysis results
 *
 * @param addressReuse - Address reuse analysis result
 * @param cluster - Cluster detection result
 * @param exchangeExposure - Exchange exposure result
 * @param temporalPatterns - Temporal pattern result
 * @param socialLinks - Social link result
 * @param walletAddress - Wallet being analyzed
 * @returns Complete privacy score
 */
export function calculatePrivacyScore(
  addressReuse: AddressReuseResult,
  cluster: ClusterResult,
  exchangeExposure: ExchangeExposureResult,
  temporalPatterns: TemporalPatternResult,
  socialLinks: SocialLinkResult,
  walletAddress: string
): PrivacyScore {
  // Calculate category scores (higher = better)
  const breakdown: PrivacyScoreBreakdown = {
    addressReuse: MAX_POINTS.addressReuse - addressReuse.scoreDeduction,
    clusterExposure: MAX_POINTS.clusterExposure - cluster.scoreDeduction,
    exchangeExposure: MAX_POINTS.exchangeExposure - exchangeExposure.scoreDeduction,
    temporalPatterns: MAX_POINTS.temporalPatterns - temporalPatterns.scoreDeduction,
    socialLinks: MAX_POINTS.socialLinks - socialLinks.scoreDeduction,
  }

  // Calculate overall score
  const totalScore =
    breakdown.addressReuse +
    breakdown.clusterExposure +
    breakdown.exchangeExposure +
    breakdown.temporalPatterns +
    breakdown.socialLinks

  // Normalize to 0-100
  const overall = Math.round((totalScore / TOTAL_MAX_SCORE) * 100)

  // Determine risk level
  let risk: RiskLevel = 'low'
  if (overall < RISK_THRESHOLDS.critical) {
    risk = 'critical'
  } else if (overall < RISK_THRESHOLDS.high) {
    risk = 'high'
  } else if (overall < RISK_THRESHOLDS.medium) {
    risk = 'medium'
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    addressReuse,
    cluster,
    exchangeExposure,
    temporalPatterns,
    socialLinks
  )

  return {
    overall,
    breakdown,
    risk,
    recommendations,
    analyzedAt: Date.now(),
    walletAddress,
  }
}

/**
 * Generate actionable recommendations based on analysis results
 */
function generateRecommendations(
  addressReuse: AddressReuseResult,
  cluster: ClusterResult,
  exchangeExposure: ExchangeExposureResult,
  temporalPatterns: TemporalPatternResult,
  socialLinks: SocialLinkResult
): PrivacyRecommendation[] {
  const recommendations: PrivacyRecommendation[] = []

  // Address reuse recommendations
  if (addressReuse.scoreDeduction > 0) {
    const severity = getSeverity(addressReuse.scoreDeduction, MAX_POINTS.addressReuse)
    recommendations.push({
      id: 'address-reuse-001',
      severity,
      category: 'addressReuse',
      title: `Address reused ${addressReuse.totalReuseCount} times`,
      description:
        'Reusing the same address for multiple transactions creates linkability ' +
        'between your transactions, allowing observers to track your activity.',
      action:
        'Use SIP stealth addresses for each transaction. Each payment uses a unique ' +
        'one-time address that cannot be linked to your main address.',
      potentialGain: addressReuse.scoreDeduction,
    })
  }

  // Cluster exposure recommendations
  if (cluster.scoreDeduction > 0) {
    const severity = getSeverity(cluster.scoreDeduction, MAX_POINTS.clusterExposure)
    recommendations.push({
      id: 'cluster-001',
      severity,
      category: 'clusterExposure',
      title: `${cluster.linkedAddressCount} addresses linked to your wallet`,
      description:
        'Transaction analysis has linked multiple addresses to your wallet through ' +
        'common input ownership patterns. This expands your privacy exposure.',
      action:
        'Use SIP for all transactions to prevent cluster analysis. Stealth addresses ' +
        'break the link between your spending and receiving addresses.',
      potentialGain: cluster.scoreDeduction,
    })
  }

  // Exchange exposure recommendations
  if (exchangeExposure.scoreDeduction > 0) {
    const cexes = exchangeExposure.exchanges.filter((e) => e.kycRequired)
    const severity = getSeverity(exchangeExposure.scoreDeduction, MAX_POINTS.exchangeExposure)

    if (cexes.length > 0) {
      recommendations.push({
        id: 'exchange-cex-001',
        severity,
        category: 'exchangeExposure',
        title: `Interacted with ${cexes.length} KYC exchange(s)`,
        description:
          `Deposits to ${cexes.map((e) => e.name).join(', ')} link your on-chain ` +
          'activity to your verified identity. This is one of the biggest privacy risks.',
        action:
          'Use SIP viewing keys for selective disclosure. You can prove compliance ' +
          'to exchanges without exposing your full transaction history.',
        potentialGain: Math.min(cexes.length * 8, MAX_POINTS.exchangeExposure),
      })
    }

    const dexes = exchangeExposure.exchanges.filter((e) => !e.kycRequired)
    if (dexes.length > 0) {
      recommendations.push({
        id: 'exchange-dex-001',
        severity: 'low',
        category: 'exchangeExposure',
        title: `Used ${dexes.length} DEX(es) without privacy`,
        description:
          'DEX swaps are public and can be traced. While no KYC is required, ' +
          'your swap patterns can reveal trading strategies.',
        action:
          'Use SIP for private swaps. Amounts and swap details are hidden while ' +
          'still using your preferred DEX.',
        potentialGain: Math.min(dexes.length * 2, 6),
      })
    }
  }

  // Temporal pattern recommendations
  if (temporalPatterns.scoreDeduction > 0) {
    const severity = getSeverity(temporalPatterns.scoreDeduction, MAX_POINTS.temporalPatterns)

    for (const pattern of temporalPatterns.patterns) {
      if (pattern.type === 'regular-schedule') {
        recommendations.push({
          id: 'temporal-schedule-001',
          severity,
          category: 'temporalPatterns',
          title: 'Regular transaction schedule detected',
          description:
            `${pattern.description}. Predictable patterns make your activity ` +
            'easier to track and attribute.',
          action:
            'Vary your transaction timing. Consider using scheduled private ' +
            'transactions through SIP to obscure timing patterns.',
          potentialGain: 5,
        })
      }

      if (pattern.type === 'timezone-inference') {
        recommendations.push({
          id: 'temporal-timezone-001',
          severity: 'medium',
          category: 'temporalPatterns',
          title: 'Timezone can be inferred from activity',
          description:
            `${pattern.description}. This narrows down your geographic location ` +
            'based on when you transact.',
          action:
            'Use time-delayed transactions or vary your active hours. ' +
            'SIP can queue transactions for random future execution.',
          potentialGain: 5,
        })
      }
    }
  }

  // Social link recommendations
  if (socialLinks.scoreDeduction > 0) {
    const severity = getSeverity(socialLinks.scoreDeduction, MAX_POINTS.socialLinks)

    if (socialLinks.isDoxxed) {
      recommendations.push({
        id: 'social-doxxed-001',
        severity: 'critical',
        category: 'socialLinks',
        title: 'Wallet publicly linked to your identity',
        description:
          'Your wallet address is publicly associated with your real identity ' +
          'through ENS/SNS names or social profiles. All transactions are attributable to you.',
        action:
          'Use a fresh wallet with SIP for private transactions. Your viewing keys ' +
          'let you prove ownership when needed without constant exposure.',
        potentialGain: 15,
      })
    } else if (socialLinks.partialExposure) {
      recommendations.push({
        id: 'social-partial-001',
        severity,
        category: 'socialLinks',
        title: 'Partial identity exposure detected',
        description:
          'Some identifying information is linked to your wallet, such as ' +
          'ENS names or labeled addresses on block explorers.',
        action:
          'Consider using a separate wallet for private activities. ' +
          'SIP stealth addresses prevent linking to your main identity.',
        potentialGain: socialLinks.scoreDeduction,
      })
    }
  }

  // Sort by potential gain (most impactful first)
  recommendations.sort((a, b) => b.potentialGain - a.potentialGain)

  return recommendations
}

/**
 * Determine severity based on score deduction percentage
 */
function getSeverity(deduction: number, maxPoints: number): RiskLevel {
  const percentage = deduction / maxPoints

  if (percentage >= 0.8) return 'critical'
  if (percentage >= 0.5) return 'high'
  if (percentage >= 0.25) return 'medium'
  return 'low'
}

/**
 * Calculate SIP protection comparison
 *
 * Projects how the privacy score would improve with SIP protection.
 */
export function calculateSIPComparison(
  currentScore: PrivacyScore
): SIPProtectionComparison {
  const improvements: SIPProtectionComparison['improvements'] = []

  // With SIP stealth addresses, address reuse is impossible
  const addressReuseImprovement = MAX_POINTS.addressReuse - currentScore.breakdown.addressReuse
  if (addressReuseImprovement > 0) {
    improvements.push({
      category: 'addressReuse',
      currentScore: currentScore.breakdown.addressReuse,
      projectedScore: MAX_POINTS.addressReuse,
      reason: 'Stealth addresses prevent any address reuse',
    })
  }

  // SIP breaks cluster analysis
  const clusterImprovement = MAX_POINTS.clusterExposure - currentScore.breakdown.clusterExposure
  if (clusterImprovement > 0) {
    improvements.push({
      category: 'clusterExposure',
      currentScore: currentScore.breakdown.clusterExposure,
      projectedScore: MAX_POINTS.clusterExposure,
      reason: 'Stealth addresses cannot be linked via common input analysis',
    })
  }

  // SIP with viewing keys reduces exchange exposure impact
  const exchangeImprovement = Math.min(
    (MAX_POINTS.exchangeExposure - currentScore.breakdown.exchangeExposure) * 0.5,
    10
  )
  if (exchangeImprovement > 0) {
    improvements.push({
      category: 'exchangeExposure',
      currentScore: currentScore.breakdown.exchangeExposure,
      projectedScore: currentScore.breakdown.exchangeExposure + Math.round(exchangeImprovement),
      reason: 'Viewing keys allow selective disclosure without exposing full history',
    })
  }

  // SIP doesn't directly fix temporal patterns but can help with delayed execution
  const temporalImprovement = Math.min(
    (MAX_POINTS.temporalPatterns - currentScore.breakdown.temporalPatterns) * 0.3,
    5
  )
  if (temporalImprovement > 0) {
    improvements.push({
      category: 'temporalPatterns',
      currentScore: currentScore.breakdown.temporalPatterns,
      projectedScore: currentScore.breakdown.temporalPatterns + Math.round(temporalImprovement),
      reason: 'Private transactions reduce pattern correlation',
    })
  }

  // Calculate projected score
  const totalImprovement = improvements.reduce(
    (sum, imp) => sum + (imp.projectedScore - imp.currentScore),
    0
  )

  const projectedTotal =
    (currentScore.overall / 100) * TOTAL_MAX_SCORE + totalImprovement
  const projectedScore = Math.min(Math.round((projectedTotal / TOTAL_MAX_SCORE) * 100), 100)

  return {
    currentScore: currentScore.overall,
    projectedScore,
    improvement: projectedScore - currentScore.overall,
    improvements,
  }
}
