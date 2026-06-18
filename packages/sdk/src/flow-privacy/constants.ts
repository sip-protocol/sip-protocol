/**
 * Tunable constants for per-flow privacy scoring. All thresholds, weights, and
 * caps live here so the model is auditable in one place.
 *
 * @packageDocumentation
 */
import { PrivacyTier } from '../fees/privacy-tier'

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
