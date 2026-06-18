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
    // If both have signatures, signature equality is the definitive check.
    if (flow.signature && c.signature) return c.signature === flow.signature
    // If the candidate has a signature but flow does not (or vice versa), they are
    // distinguishable — treat as distinct flows.
    if (flow.signature || c.signature) return false
    // Neither has a signature: fall back to the exact (mint, amount, timestamp) triple.
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
  // scale the float threshold by 1000 (3-decimal precision on the ratio).
  const scaledThreshold = BigInt(Math.round((1 - amountToleranceRatio) * 1000))
  const withinBucket = (c: WindowWithdrawal): boolean => {
    const a = flow.transferAmount
    const b = c.transferAmount
    if (a === 0n && b === 0n) return true
    if (a === 0n || b === 0n) return false
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    return lo * 1000n >= hi * scaledThreshold
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
