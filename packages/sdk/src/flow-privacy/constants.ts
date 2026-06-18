/**
 * Tunable constants for per-flow privacy scoring. All thresholds, weights, and
 * caps live here so the model is auditable in one place.
 *
 * @packageDocumentation
 */
import { PrivacyTier } from '../fees/privacy-tier'
import type { FactorLevel } from './types'

/** Default half-width of the anonymity-set time window (seconds). */
export const DEFAULT_WINDOW_SECONDS = 600

/** Default amount bucket width as a ratio in (0, 1]. */
export const DEFAULT_AMOUNT_TOLERANCE_RATIO = 0.5

/** Anonymity-set size at/above which the anonymity factor is at least 'moderate'. */
export const ANON_SET_MODERATE_MIN = 3

/** Anonymity-set size at/above which the anonymity factor is 'strong'. */
export const ANON_SET_STRONG_MIN = 10

/** Honest amount-hiding label per tier. */
export const AMOUNT_HIDING_LABELS: Record<PrivacyTier, string> = {
  [PrivacyTier.TIER_1]: 'visible-but-commingled',
  [PrivacyTier.TIER_2]: 'visible-but-unlinkable',
  [PrivacyTier.TIER_3]: 'cryptographically-hidden',
}

/** Weight of each factor in the raw score (sum to 1). */
export const FACTOR_WEIGHTS: Record<'anonymity' | 'linkability' | 'amount', number> = {
  anonymity: 0.4,
  linkability: 0.3,
  amount: 0.3,
}

/** Points awarded per factor level. */
export const FACTOR_POINTS: Record<FactorLevel, number> = {
  weak: 0,
  moderate: 0.5,
  strong: 1,
}

/** Maximum score per tier — the honesty cap. TIER_1 cannot exceed 'moderate'. */
export const TIER_SCORE_CAP: Record<PrivacyTier, number> = {
  [PrivacyTier.TIER_1]: 59,
  [PrivacyTier.TIER_2]: 84,
  [PrivacyTier.TIER_3]: 100,
}

/** Band cutoffs on the capped score. */
export const BAND_MODERATE_MIN = 40
export const BAND_STRONG_MIN = 70
