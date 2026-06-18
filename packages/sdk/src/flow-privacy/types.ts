/**
 * Per-flow privacy-score types.
 *
 * Scores a single commingling-vault flow (a withdrawal to a stealth recipient),
 * distinct from the wallet-history scoring in `surveillance/`.
 *
 * @packageDocumentation
 */
import type { PrivacyTier } from '../fees/privacy-tier'

/** The flow being scored — derived from VaultWithdrawEvent + how the tx was submitted. */
export interface FlowInput {
  /** base58 mint; native SOL = the `Pubkey::default()` sentinel */
  mint: string
  /** plaintext base units (VaultWithdrawEvent.transfer_amount) */
  transferAmount: bigint
  /** unix seconds (VaultWithdrawEvent.timestamp) */
  timestamp: number
  /** was the relayer the fee-payer? (gasless cash-out) */
  gasless: boolean
  /** optional context — the one-time stealth recipient */
  stealthRecipient?: string
  /** optional — used to exclude this flow from the candidate set */
  signature?: string
}

/** A candidate withdrawal in the window — the subset of VaultWithdrawEvent a caller indexes. */
export interface WindowWithdrawal {
  mint: string
  transferAmount: bigint
  timestamp: number
  signature?: string
}

/** Options for `anonSetInWindow`. */
export interface AnonSetOptions {
  /** half-width of the time window in seconds (default 600) */
  windowSeconds?: number
  /** amount bucket width as a ratio in (0, 1] (default 0.5) */
  amountToleranceRatio?: number
}

/** The anonymity set a flow blends into. */
export interface AnonymitySet {
  /** same-mint AND similar-amount in window, self excluded */
  size: number
  /** same-mint, any amount (pre amount-bucket) — shows the bucket's effect */
  sameMintCount: number
  windowSeconds: number
  amountToleranceRatio: number
  /** signatures of the flows blended with (when supplied) */
  matched: string[]
}

/** Overall qualitative band for a flow. */
export type PrivacyBand = 'limited' | 'moderate' | 'strong'

/** Per-factor qualitative level. */
export type FactorLevel = 'weak' | 'moderate' | 'strong'

/** Honest amount-hiding status, mapped onto the PrivacyTier ladder. */
export interface AmountHiding {
  tier: PrivacyTier
  /** 'visible-but-commingled' | 'visible-but-unlinkable' | 'cryptographically-hidden' */
  label: string
  cryptographicallyHidden: boolean
}

/** The full per-flow assessment. */
export interface FlowPrivacyAssessment {
  /** 0–100, tier-capped so it cannot overclaim */
  score: number
  band: PrivacyBand
  anonymitySet: AnonymitySet
  gasless: boolean
  amountHiding: AmountHiding
  factors: {
    anonymity: FactorLevel
    linkability: FactorLevel
    amount: FactorLevel
  }
  /** honest, generated from factors — never silent */
  caveats: string[]
}

/** Options for `assessFlowPrivacy`. */
export interface AssessFlowOptions extends AnonSetOptions {
  /** the protocol tier the flow settled under (default CURRENT_PRIVACY_TIER) */
  tier?: PrivacyTier
}
