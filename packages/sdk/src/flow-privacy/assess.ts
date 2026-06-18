/**
 * assessFlowPrivacy — composes the primitives into an honest, tier-capped
 * per-flow privacy assessment (score + band + factors + caveats).
 *
 * @packageDocumentation
 */
import { CURRENT_PRIVACY_TIER } from '../fees/privacy-tier'
import { anonSetInWindow } from './anon-set'
import {
  gaslessFlag,
  amountHidingStatus,
  deriveAnonymityLevel,
  deriveLinkabilityLevel,
  deriveAmountLevel,
} from './factors'
import {
  FACTOR_WEIGHTS,
  FACTOR_POINTS,
  TIER_SCORE_CAP,
  BAND_MODERATE_MIN,
  BAND_STRONG_MIN,
} from './constants'
import type {
  FlowInput,
  WindowWithdrawal,
  AssessFlowOptions,
  FlowPrivacyAssessment,
  PrivacyBand,
  AnonymitySet,
  AmountHiding,
} from './types'

function bandFor(score: number): PrivacyBand {
  if (score >= BAND_STRONG_MIN) return 'strong'
  if (score >= BAND_MODERATE_MIN) return 'moderate'
  return 'limited'
}

function buildCaveats(
  flow: FlowInput,
  anonymitySet: AnonymitySet,
  gasless: boolean,
  amountHiding: AmountHiding,
  anonymityStrong: boolean,
): string[] {
  const caveats: string[] = []
  if (!amountHiding.cryptographicallyHidden)
    caveats.push(
      `Withdrawal amount (${flow.transferAmount}) is visible on-chain — commingled, not cryptographically hidden.`,
    )
  if (!anonymityStrong) {
    const minutes = Math.round(anonymitySet.windowSeconds / 60)
    caveats.push(
      `Anonymity set is ${anonymitySet.size} similar-amount same-asset withdrawal(s) in a ${minutes}-minute window; small sets are correlatable.`,
    )
  }
  if (!gasless)
    caveats.push(
      'Cash-out paid its own gas — the fee-payer is linkable to the recipient. A gasless relayer removes this link.',
    )
  return caveats
}

/**
 * Score a single vault flow's privacy honestly, over caller-supplied data.
 *
 * @param flow - the flow being scored
 * @param candidates - withdrawals the caller observed near the flow (no RPC)
 * @param opts - window/tolerance + the settlement tier (default CURRENT_PRIVACY_TIER)
 */
export function assessFlowPrivacy(
  flow: FlowInput,
  candidates: WindowWithdrawal[],
  opts: AssessFlowOptions = {},
): FlowPrivacyAssessment {
  const tier = opts.tier ?? CURRENT_PRIVACY_TIER
  const anonymitySet = anonSetInWindow(flow, candidates, opts)
  const gasless = gaslessFlag(flow)
  const amountHiding = amountHidingStatus(flow, tier)

  const factors = {
    anonymity: deriveAnonymityLevel(anonymitySet.size),
    linkability: deriveLinkabilityLevel(gasless),
    amount: deriveAmountLevel(amountHiding),
  }

  const raw =
    100 *
    (FACTOR_WEIGHTS.anonymity * FACTOR_POINTS[factors.anonymity] +
      FACTOR_WEIGHTS.linkability * FACTOR_POINTS[factors.linkability] +
      FACTOR_WEIGHTS.amount * FACTOR_POINTS[factors.amount])

  const score = Math.min(Math.round(raw), TIER_SCORE_CAP[tier])
  const band = bandFor(score)
  const caveats = buildCaveats(flow, anonymitySet, gasless, amountHiding, factors.anonymity === 'strong')

  return { score, band, anonymitySet, gasless, amountHiding, factors, caveats }
}
