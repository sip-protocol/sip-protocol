import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { ZodType } from 'zod'

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
    value: z.string().regex(/^\d+$/), // bigint as string
    blindingFactor: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  }),

  generateFundingProof: z.object({
    balance: z.string().regex(/^\d+$/),
    minRequired: z.string().regex(/^\d+$/),
    balanceBlinding: z.string().regex(/^0x[0-9a-fA-F]+$/),
  }),

  getQuote: z.object({
    inputChain: z.enum(['solana', 'ethereum', 'near', 'zcash', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'aptos', 'sui', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx']),
    inputToken: z.string().min(1),
    inputAmount: z.string().regex(/^\d+$/),
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
