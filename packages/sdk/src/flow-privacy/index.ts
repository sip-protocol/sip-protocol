/**
 * Per-flow privacy-score primitives.
 *
 * Honest assessment of a single commingling-vault flow (anonymity set, gasless,
 * amount-hiding), distinct from the wallet-history scoring in `surveillance/`.
 * Pure — the caller supplies the candidate window; no RPC.
 *
 * @packageDocumentation
 */
export { anonSetInWindow } from './anon-set'
export { gaslessFlag, amountHidingStatus } from './factors'
export { assessFlowPrivacy } from './assess'

export type {
  FlowInput,
  WindowWithdrawal,
  AnonSetOptions,
  AnonymitySet,
  PrivacyBand,
  FactorLevel,
  AmountHiding,
  FlowPrivacyAssessment,
  AssessFlowOptions,
} from './types'
