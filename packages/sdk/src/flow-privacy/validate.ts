/**
 * Boundary validators for the flow-privacy primitives.
 *
 * @packageDocumentation
 */
import { ValidationError } from '../errors'
import { PrivacyTier } from '../fees/privacy-tier'
import type { FlowInput, WindowWithdrawal, AnonSetOptions } from './types'

/** Validate a FlowInput, throwing ValidationError on the first problem. */
export function validateFlowInput(flow: FlowInput): void {
  if (!flow || typeof flow !== 'object') throw new ValidationError('flow is required', 'flow')
  if (typeof flow.mint !== 'string' || flow.mint.length === 0)
    throw new ValidationError('mint must be a non-empty string', 'flow.mint')
  if (typeof flow.transferAmount !== 'bigint' || flow.transferAmount < 0n)
    throw new ValidationError('transferAmount must be a non-negative bigint', 'flow.transferAmount')
  if (!Number.isFinite(flow.timestamp))
    throw new ValidationError('timestamp must be a finite number', 'flow.timestamp')
  if (typeof flow.gasless !== 'boolean')
    throw new ValidationError('gasless must be a boolean', 'flow.gasless')
}

/** Validate the candidate array. */
export function validateWindowWithdrawals(candidates: WindowWithdrawal[]): void {
  if (!Array.isArray(candidates))
    throw new ValidationError('candidates must be an array', 'candidates')
  candidates.forEach((c, i) => {
    if (typeof c.mint !== 'string' || c.mint.length === 0)
      throw new ValidationError('mint must be a non-empty string', `candidates[${i}].mint`)
    if (typeof c.transferAmount !== 'bigint' || c.transferAmount < 0n)
      throw new ValidationError('transferAmount must be a non-negative bigint', `candidates[${i}].transferAmount`)
    if (!Number.isFinite(c.timestamp))
      throw new ValidationError('timestamp must be a finite number', `candidates[${i}].timestamp`)
  })
}

/** Validate anonymity-set options. */
export function validateAnonSetOptions(opts: AnonSetOptions): void {
  const { windowSeconds, amountToleranceRatio } = opts
  if (windowSeconds !== undefined && (!Number.isFinite(windowSeconds) || windowSeconds <= 0))
    throw new ValidationError('windowSeconds must be a positive number', 'windowSeconds')
  if (
    amountToleranceRatio !== undefined &&
    (!Number.isFinite(amountToleranceRatio) || amountToleranceRatio <= 0 || amountToleranceRatio > 1)
  )
    throw new ValidationError('amountToleranceRatio must be in (0, 1]', 'amountToleranceRatio')
}

/** Validate that a value is a known PrivacyTier. */
export function validateTier(tier: PrivacyTier): void {
  if (!Object.values(PrivacyTier).includes(tier))
    throw new ValidationError('tier must be a valid PrivacyTier', 'tier')
}
