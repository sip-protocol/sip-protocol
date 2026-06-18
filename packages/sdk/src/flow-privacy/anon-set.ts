/**
 * anonSetInWindow — the flows a given flow actually blends into.
 *
 * @packageDocumentation
 */
import { DEFAULT_WINDOW_SECONDS, DEFAULT_AMOUNT_TOLERANCE_RATIO } from './constants'
import { validateFlowInput, validateWindowWithdrawals, validateAnonSetOptions } from './validate'
import type { FlowInput, WindowWithdrawal, AnonSetOptions, AnonymitySet } from './types'

/**
 * Compute the anonymity set a flow blends into: same-mint, similar-amount
 * withdrawals within a time window, excluding the flow itself.
 *
 * @param flow - the flow being scored
 * @param candidates - withdrawals the caller observed near the flow (caller-supplied; no RPC)
 * @param opts - window + amount-tolerance overrides
 */
export function anonSetInWindow(
  flow: FlowInput,
  candidates: WindowWithdrawal[],
  opts: AnonSetOptions = {},
): AnonymitySet {
  validateFlowInput(flow)
  validateWindowWithdrawals(candidates)
  validateAnonSetOptions(opts)

  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS
  const amountToleranceRatio = opts.amountToleranceRatio ?? DEFAULT_AMOUNT_TOLERANCE_RATIO

  const isSelf = (c: WindowWithdrawal): boolean => {
    // Both have signatures: signature equality is the definitive check.
    if (flow.signature && c.signature) return c.signature === flow.signature
    // Candidate has a signature but the flow does not: the candidate is a
    // distinct, identified withdrawal — not this flow.
    if (!flow.signature && c.signature) return false
    // Neither has a signature, OR the flow knows its signature but the candidate's
    // is not populated (e.g. indexed before the field was filled): fall back to the
    // exact (mint, amount, timestamp) triple, so the flow's own un-signed copy is
    // still excluded rather than counted as a peer — counting it would overstate
    // the anonymity set (the dangerous, privacy-overclaiming direction).
    return (
      c.mint === flow.mint &&
      c.transferAmount === flow.transferAmount &&
      c.timestamp === flow.timestamp
    )
  }

  const inWindowSameMint = candidates.filter(
    (c) =>
      !isSelf(c) && c.mint === flow.mint && Math.abs(c.timestamp - flow.timestamp) <= windowSeconds,
  )

  // amount bucket: min/max >= 1 - tol, computed in integer space to avoid bigint/float mixing.
  // scale the float threshold by 1e6 (6-decimal precision on the ratio, so sub-0.001
  // tolerances are not silently collapsed to exact-match-only).
  const scaledThreshold = BigInt(Math.round((1 - amountToleranceRatio) * 1_000_000))
  const withinBucket = (c: WindowWithdrawal): boolean => {
    const a = flow.transferAmount
    const b = c.transferAmount
    if (a === 0n && b === 0n) return true
    if (a === 0n || b === 0n) return false
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    return lo * 1_000_000n >= hi * scaledThreshold
  }

  const matchedFlows = inWindowSameMint.filter(withinBucket)

  return {
    size: matchedFlows.length,
    sameMintCount: inWindowSameMint.length,
    windowSeconds,
    amountToleranceRatio,
    matched: matchedFlows
      .map((c) => c.signature)
      .filter((s): s is string => typeof s === 'string'),
  }
}
