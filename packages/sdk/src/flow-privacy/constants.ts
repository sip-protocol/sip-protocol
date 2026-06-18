/**
 * Tunable constants for per-flow privacy scoring. All thresholds, weights, and
 * caps live here so the model is auditable in one place.
 *
 * @packageDocumentation
 */

/** Default half-width of the anonymity-set time window (seconds). */
export const DEFAULT_WINDOW_SECONDS = 600

/** Default amount bucket width as a ratio in (0, 1]. */
export const DEFAULT_AMOUNT_TOLERANCE_RATIO = 0.5
