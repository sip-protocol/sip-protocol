/**
 * Flow privacy factor primitives: gasless flag, amount-hiding status, and the
 * qualitative factor-level derivations consumed by the composer.
 *
 * @packageDocumentation
 */
import { PrivacyTier, CURRENT_PRIVACY_TIER } from '../fees/privacy-tier'
import { ANON_SET_MODERATE_MIN, ANON_SET_STRONG_MIN, AMOUNT_HIDING_LABELS } from './constants'
import { validateFlowInput, validateTier } from './validate'
import type { FlowInput, FactorLevel, AmountHiding } from './types'

/** Whether the cash-out was gasless (relayer fee-payer → no fee-payer→recipient link). */
export function gaslessFlag(flow: FlowInput): boolean {
  validateFlowInput(flow)
  return flow.gasless
}

/** Honest amount-hiding status for the tier the flow settled under. */
export function amountHidingStatus(
  flow: FlowInput,
  tier: PrivacyTier = CURRENT_PRIVACY_TIER,
): AmountHiding {
  validateFlowInput(flow)
  validateTier(tier)
  return {
    tier,
    label: AMOUNT_HIDING_LABELS[tier],
    cryptographicallyHidden: tier === PrivacyTier.TIER_3,
  }
}

/** Anonymity factor level from the anonymity-set size. */
export function deriveAnonymityLevel(size: number): FactorLevel {
  if (size >= ANON_SET_STRONG_MIN) return 'strong'
  if (size >= ANON_SET_MODERATE_MIN) return 'moderate'
  return 'weak'
}

/** Linkability factor level (the recipient is always a one-time stealth address). */
export function deriveLinkabilityLevel(gasless: boolean): FactorLevel {
  return gasless ? 'strong' : 'moderate'
}

/** Amount factor level — only cryptographic hiding is 'strong'. */
export function deriveAmountLevel(amountHiding: AmountHiding): FactorLevel {
  return amountHiding.cryptographicallyHidden ? 'strong' : 'weak'
}
