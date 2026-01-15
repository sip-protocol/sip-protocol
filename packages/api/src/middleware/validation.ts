import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { ZodType } from 'zod'

/**
 * Maximum value for uint256 (2^256 - 1)
 */
export const MAX_UINT256 = 2n ** 256n - 1n

/**
 * Schema for validating BigInt amount strings
 *
 * Validates:
 * - Positive integers only (no zero, no negatives)
 * - No leading zeros
 * - Maximum 78 characters (max uint256 length)
 * - Value <= 2^256 - 1
 */
export const amountSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'Amount must be positive integer without leading zeros')
  .max(78, 'Amount exceeds maximum uint256 length')
  .refine(
    (v) => {
      try {
        const n = BigInt(v)
        return n > 0n && n <= MAX_UINT256
      } catch {
        return false
      }
    },
    { message: 'Invalid amount: must be positive integer <= 2^256-1' }
  )

/**
 * Schema for validating minimum threshold amounts (allows zero)
 *
 * Used for:
 * - minRequired in funding proofs (prove balance >= 0 is valid)
 * - minAmount in swap outputs
 *
 * Validates:
 * - Non-negative integers (zero allowed)
 * - No leading zeros (except "0" itself)
 * - Maximum 78 characters (max uint256 length)
 * - Value <= 2^256 - 1
 */
export const minAmountSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, 'Amount must be non-negative integer without leading zeros')
  .max(78, 'Amount exceeds maximum uint256 length')
  .refine(
    (v) => {
      try {
        const n = BigInt(v)
        return n >= 0n && n <= MAX_UINT256
      } catch {
        return false
      }
    },
    { message: 'Invalid amount: must be non-negative integer <= 2^256-1' }
  )

/**
 * Safely calculate minimum amount with slippage
 *
 * @param input - Input amount as bigint
 * @param slippageBps - Slippage in basis points (0-10000)
 * @returns Minimum output amount after slippage
 * @throws Error if slippage is out of range
 */
export function calculateMinAmount(input: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error('Invalid slippage: must be 0-10000 basis points')
  }
  const bps = BigInt(Math.floor(slippageBps))
  const multiplier = 10000n - bps
  return (input * multiplier) / 10000n
}

/**
 * Convert percentage (0-100) to basis points (0-10000)
 */
export function percentToBps(percent: number): number {
  return Math.floor(percent * 100)
}

/**
 * Zod schema validation middleware factory
 */
export function validateRequest(schema: {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body)
      }
      if (schema.query) {
        // Zod 4 returns unknown, cast to Express expected type
        req.query = (await schema.query.parseAsync(req.query)) as typeof req.query
      }
      if (schema.params) {
        // Zod 4 returns unknown, cast to Express expected type
        req.params = (await schema.params.parseAsync(
          req.params
        )) as typeof req.params
      }
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            // Zod 4 renamed 'errors' to 'issues'
            details: error.issues,
          },
        })
      }
      next(error)
    }
  }
}

/**
 * Validation schemas
 */
export const schemas = {
  generateStealth: z.object({
    chain: z.enum(['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'aptos', 'sui', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']),
    recipientMetaAddress: z.object({
      spendingKey: z.string().regex(/^0x[0-9a-fA-F]+$/),
      viewingKey: z.string().regex(/^0x[0-9a-fA-F]+$/),
      chain: z.enum(['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'aptos', 'sui', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']),
      label: z.string().optional(),
    }),
  }),

  createCommitment: z.object({
    value: amountSchema,
    blindingFactor: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  }),

  generateFundingProof: z.object({
    balance: amountSchema,
    minRequired: minAmountSchema, // Zero allowed: "prove I have >= 0" is valid
    balanceBlinding: z.string().regex(/^0x[0-9a-fA-F]+$/),
  }),

  getQuote: z.object({
    inputChain: z.enum(['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'aptos', 'sui', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']),
    inputToken: z.string().min(1),
    inputAmount: amountSchema,
    outputChain: z.enum(['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'aptos', 'sui', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']),
    outputToken: z.string().min(1),
    slippageTolerance: z.number().min(0).max(100).optional(),
  }),

  executeSwap: z.object({
    intentId: z.string().min(1),
    quoteId: z.string().min(1),
    privacy: z.enum(['transparent', 'shielded', 'compliant']).optional(),
    viewingKey: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  }),

  swapStatus: z.object({
    id: z.string().min(1),
  }),
}
