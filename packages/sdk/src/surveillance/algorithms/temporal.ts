/**
 * Temporal Pattern Detection Algorithm
 *
 * Analyzes transaction timing patterns to detect:
 * - Regular schedules (e.g., weekly DCA, monthly payments)
 * - Timezone inference from activity hours
 * - Activity bursts that might indicate specific events
 *
 * These patterns can be used to de-anonymize users.
 *
 * @packageDocumentation
 */

import type { AnalyzableTransaction, TemporalPatternResult } from '../types'

/**
 * Maximum score deduction for temporal patterns (out of 15)
 */
const MAX_DEDUCTION = 15

/**
 * Deduction per detected pattern
 */
const DEDUCTION_PER_PATTERN = 5

/**
 * Minimum transactions to detect patterns
 */
const MIN_TRANSACTIONS_FOR_PATTERN = 5

/**
 * Threshold for considering a day-of-week as "regular"
 * (percentage of transactions on that day)
 */
const DAY_REGULARITY_THRESHOLD = 0.3

/**
 * Threshold for considering an hour as "regular"
 */
const HOUR_REGULARITY_THRESHOLD = 0.25

/**
 * Timezone offset possibilities (UTC offsets)
 */
const TIMEZONES: Record<string, number> = {
  'UTC-12': -12,
  'UTC-11': -11,
  'HST': -10,
  'AKST': -9,
  'PST': -8,
  'MST': -7,
  'CST': -6,
  'EST': -5,
  'AST': -4,
  'BRT': -3,
  'UTC-2': -2,
  'UTC-1': -1,
  'UTC': 0,
  'CET': 1,
  'EET': 2,
  'MSK': 3,
  'GST': 4,
  'PKT': 5,
  'BST': 6,
  'ICT': 7,
  'CST_ASIA': 8,
  'JST': 9,
  'AEST': 10,
  'AEDT': 11,
  'NZST': 12,
}

/**
 * Analyze temporal patterns in transaction history
 *
 * @param transactions - Transaction history to analyze
 * @returns Temporal pattern analysis result
 *
 * @example
 * ```typescript
 * const result = analyzeTemporalPatterns(transactions)
 * console.log(result.patterns[0].type) // 'regular-schedule'
 * console.log(result.inferredTimezone) // 'EST'
 * ```
 */
export function analyzeTemporalPatterns(
  transactions: AnalyzableTransaction[]
): TemporalPatternResult {
  const patterns: TemporalPatternResult['patterns'] = []

  if (transactions.length < MIN_TRANSACTIONS_FOR_PATTERN) {
    return {
      patterns: [],
      scoreDeduction: 0,
    }
  }

  // Extract timing data
  const txTimes = transactions
    .filter((tx) => tx.success && tx.timestamp > 0)
    .map((tx) => new Date(tx.timestamp * 1000))

  if (txTimes.length < MIN_TRANSACTIONS_FOR_PATTERN) {
    return {
      patterns: [],
      scoreDeduction: 0,
    }
  }

  // Analyze day-of-week distribution
  const dayOfWeekPattern = analyzeDayOfWeekPattern(txTimes)
  if (dayOfWeekPattern) {
    patterns.push(dayOfWeekPattern)
  }

  // Analyze hour-of-day distribution
  const hourPattern = analyzeHourPattern(txTimes)
  if (hourPattern) {
    patterns.push(hourPattern)
  }

  // Detect timezone from activity hours
  const inferredTimezone = inferTimezone(txTimes)

  // Detect activity bursts
  const burstPattern = detectActivityBursts(transactions)
  if (burstPattern) {
    patterns.push(burstPattern)
  }

  // Calculate score deduction
  const rawDeduction = patterns.length * DEDUCTION_PER_PATTERN
  const scoreDeduction = Math.min(rawDeduction, MAX_DEDUCTION)

  return {
    patterns,
    inferredTimezone,
    scoreDeduction,
  }
}

/**
 * Analyze day-of-week transaction patterns
 */
function analyzeDayOfWeekPattern(
  times: Date[]
): TemporalPatternResult['patterns'][0] | null {
  const dayCount = new Array(7).fill(0)

  for (const time of times) {
    dayCount[time.getUTCDay()]++
  }

  // Find dominant days
  const total = times.length
  const dominantDays: number[] = []

  for (let day = 0; day < 7; day++) {
    const percentage = dayCount[day] / total
    if (percentage >= DAY_REGULARITY_THRESHOLD) {
      dominantDays.push(day)
    }
  }

  if (dominantDays.length === 0 || dominantDays.length > 3) {
    return null // No clear pattern or too spread out
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dominantDayNames = dominantDays.map((d) => dayNames[d]).join(', ')

  return {
    type: 'regular-schedule',
    description: `Most transactions occur on ${dominantDayNames}`,
    confidence: Math.max(...dominantDays.map((d) => dayCount[d] / total)),
    evidence: {
      dayOfWeek: dominantDays,
    },
  }
}

/**
 * Analyze hour-of-day transaction patterns
 */
function analyzeHourPattern(
  times: Date[]
): TemporalPatternResult['patterns'][0] | null {
  const hourCount = new Array(24).fill(0)

  for (const time of times) {
    hourCount[time.getUTCHours()]++
  }

  // Find active hours (group into 3-hour windows)
  const total = times.length
  const activeHours: number[] = []

  for (let hour = 0; hour < 24; hour++) {
    // Consider 3-hour windows
    const windowCount =
      hourCount[hour] +
      hourCount[(hour + 1) % 24] +
      hourCount[(hour + 2) % 24]
    const windowPercentage = windowCount / total

    if (windowPercentage >= HOUR_REGULARITY_THRESHOLD) {
      if (!activeHours.includes(hour)) {
        activeHours.push(hour)
      }
    }
  }

  if (activeHours.length === 0 || activeHours.length > 8) {
    return null // No clear pattern
  }

  // Check if activity is concentrated (privacy risk)
  const activeHourRange = Math.max(...activeHours) - Math.min(...activeHours)

  if (activeHourRange <= 6) {
    const startHour = Math.min(...activeHours)
    const endHour = Math.max(...activeHours) + 2

    return {
      type: 'timezone-inference',
      description: `Activity concentrated between ${startHour}:00-${endHour}:00 UTC`,
      confidence: 0.7,
      evidence: {
        hourOfDay: activeHours,
      },
    }
  }

  return null
}

/**
 * Infer timezone from activity patterns
 * Assumes user is active during waking hours (8am-11pm local time)
 */
function inferTimezone(times: Date[]): string | undefined {
  const hourCount = new Array(24).fill(0)

  for (const time of times) {
    hourCount[time.getUTCHours()]++
  }

  // Find the 8-hour window with most activity
  let maxActivity = 0
  let bestStartHour = 0

  for (let start = 0; start < 24; start++) {
    let windowActivity = 0
    for (let i = 0; i < 8; i++) {
      windowActivity += hourCount[(start + i) % 24]
    }

    if (windowActivity > maxActivity) {
      maxActivity = windowActivity
      bestStartHour = start
    }
  }

  // If activity is concentrated, infer timezone
  const totalActivity = times.length
  if (maxActivity / totalActivity < 0.6) {
    return undefined // Activity too spread out
  }

  // Assume peak activity is around 10am-6pm local time
  // So if peak starts at hour X UTC, user is probably at UTC+(14-X) or similar
  const assumedLocalNoon = 12
  const peakMidpoint = (bestStartHour + 4) % 24
  const inferredOffset = (assumedLocalNoon - peakMidpoint + 24) % 24

  // Find closest timezone
  const normalizedOffset = inferredOffset > 12 ? inferredOffset - 24 : inferredOffset

  for (const [name, offset] of Object.entries(TIMEZONES)) {
    if (Math.abs(offset - normalizedOffset) <= 1) {
      return name
    }
  }

  return `UTC${normalizedOffset >= 0 ? '+' : ''}${normalizedOffset}`
}

/**
 * Detect unusual activity bursts
 */
function detectActivityBursts(
  transactions: AnalyzableTransaction[]
): TemporalPatternResult['patterns'][0] | null {
  if (transactions.length < 10) {
    return null
  }

  // Sort by timestamp
  const sorted = [...transactions]
    .filter((tx) => tx.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp)

  // Calculate gaps between transactions
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp)
  }

  // Calculate average gap
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length

  // Find bursts (gaps < 10% of average)
  const burstThreshold = avgGap * 0.1
  let burstCount = 0

  for (const gap of gaps) {
    if (gap < burstThreshold && gap < 3600) {
      // Less than 1 hour
      burstCount++
    }
  }

  const burstPercentage = burstCount / gaps.length

  if (burstPercentage > 0.2) {
    return {
      type: 'activity-burst',
      description: `${Math.round(burstPercentage * 100)}% of transactions occur in rapid succession`,
      confidence: burstPercentage,
      evidence: {
        frequency: `${burstCount} bursts detected`,
      },
    }
  }

  return null
}
