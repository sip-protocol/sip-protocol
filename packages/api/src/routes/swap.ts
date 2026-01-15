import { Router, Request, Response } from 'express'
import { SIP, PrivacyLevel, getAsset, isKnownToken } from '@sip-protocol/sdk'
import { validateRequest, schemas, calculateMinAmount, percentToBps } from '../middleware'
import { swapStore } from '../stores'
import { env } from '../config'
import { logger } from '../logger'
import type {
  GetQuoteRequest,
  ExecuteSwapRequest,
  QuoteResponse,
  SwapResponse,
  SwapStatusResponse,
  ApiResponse
} from '../types/api'

const router: Router = Router()

// Initialize SIP client
const sip = new SIP({ network: 'testnet' })

/**
 * Check if mock mode is allowed
 * In production, mock mode should be explicitly disabled
 */
const MOCK_MODE_ENABLED = env.NODE_ENV !== 'production'

if (!MOCK_MODE_ENABLED) {
  logger.warn('Production mode: Mock quotes and swaps are DISABLED')
}

/**
 * POST /quote
 * Get a swap quote
 *
 * @openapi
 * /quote:
 *   post:
 *     summary: Get swap quote
 *     description: Get a quote for a cross-chain swap
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inputChain
 *               - inputToken
 *               - inputAmount
 *               - outputChain
 *               - outputToken
 *             properties:
 *               inputChain:
 *                 type: string
 *               inputToken:
 *                 type: string
 *               inputAmount:
 *                 type: string
 *               outputChain:
 *                 type: string
 *               outputToken:
 *                 type: string
 *               slippageTolerance:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 */
router.post(
  '/',
  validateRequest({ body: schemas.getQuote }),
  async (req: Request, res: Response) => {
    const {
      inputChain,
      inputToken,
      inputAmount,
      outputChain,
      outputToken,
      slippageTolerance
    } = req.body as GetQuoteRequest

    // PRODUCTION MODE: Fail if quote aggregator not configured
    if (!MOCK_MODE_ENABLED) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'QUOTE_SERVICE_UNAVAILABLE',
          message: 'Real quote aggregator not configured. This API is not ready for production use.',
          details: {
            hint: 'Configure QUOTE_AGGREGATOR_URL or use development mode',
          },
        },
      })
    }

    // Validate tokens are known (fail fast on unknown tokens)
    if (!isKnownToken(inputToken, inputChain)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNKNOWN_TOKEN',
          message: `Unknown input token: ${inputToken} on ${inputChain}`,
        },
      } satisfies ApiResponse<never>)
    }
    if (!isKnownToken(outputToken, outputChain)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNKNOWN_TOKEN',
          message: `Unknown output token: ${outputToken} on ${outputChain}`,
        },
      } satisfies ApiResponse<never>)
    }

    // Get asset info with correct decimals from registry
    const inputAsset = getAsset(inputToken, inputChain)
    const outputAsset = getAsset(outputToken, outputChain)

    // Parse and validate amount (already validated by schema, safe to parse)
    const inputAmountBigInt = BigInt(inputAmount)
    const slippagePercent = slippageTolerance ?? 1
    const slippageBps = percentToBps(slippagePercent)

    // Create intent with safe slippage calculation
    const intent = await sip.createIntent({
      input: {
        asset: inputAsset,
        amount: inputAmountBigInt,
      },
      output: {
        asset: outputAsset,
        minAmount: calculateMinAmount(inputAmountBigInt, slippageBps),
        maxSlippage: slippagePercent / 100,
      },
      privacy: PrivacyLevel.TRANSPARENT, // Default to transparent for quote
    })

    // DEV MODE: Return mock quote with warning
    // In production, this block would never execute (see check above)
    logger.warn({
      inputChain,
      inputToken,
      outputChain,
      outputToken,
      inputAmount,
    }, 'Returning MOCK quote - not for production use')

    const mockQuote: QuoteResponse = {
      quoteId: `quote-${Date.now()}`,
      inputAmount,
      // Mock: 5% fee (clearly fake rate)
      outputAmount: (BigInt(inputAmount) * 95n / 100n).toString(),
      rate: '0.95',
      estimatedTime: 30,
      fees: {
        network: '0.001',
        protocol: '0.003',
      },
      route: {
        steps: [
          {
            chain: inputChain,
            protocol: 'NEAR Intents',
            fromToken: inputToken,
            toToken: outputToken,
          },
        ],
      },
    }

    const response: ApiResponse<QuoteResponse & { _warning?: string }> = {
      success: true,
      data: {
        ...mockQuote,
        _warning: 'MOCK_DATA: This quote uses simulated pricing. Do not use for real transactions.',
      },
    }

    res.json(response)
  }
)

/**
 * POST /swap
 * Execute a swap
 *
 * @openapi
 * /swap:
 *   post:
 *     summary: Execute swap
 *     description: Execute a cross-chain swap with optional privacy
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - intentId
 *               - quoteId
 *             properties:
 *               intentId:
 *                 type: string
 *               quoteId:
 *                 type: string
 *               privacy:
 *                 type: string
 *                 enum: [transparent, shielded, compliant]
 *               viewingKey:
 *                 type: string
 *                 pattern: ^0x[0-9a-fA-F]+$
 *     responses:
 *       200:
 *         description: Swap initiated successfully
 */
router.post(
  '/swap',
  validateRequest({ body: schemas.executeSwap }),
  async (req: Request, res: Response) => {
    const { intentId, quoteId, inputAmount } = req.body as ExecuteSwapRequest & { inputAmount?: string }

    // PRODUCTION MODE: Fail if swap executor not configured
    if (!MOCK_MODE_ENABLED) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SWAP_SERVICE_UNAVAILABLE',
          message: 'Real swap executor not configured. This API is not ready for production use.',
          details: {
            hint: 'Configure SWAP_EXECUTOR_URL or use development mode',
          },
        },
      })
    }

    // Generate swap ID
    const swapId = `swap-${Date.now()}`

    // Track actual input amount from request (not hardcoded)
    // In dev mode, allow a default for testing but warn about it
    const actualInputAmount = inputAmount || '0'
    if (!inputAmount) {
      logger.warn({ swapId, quoteId, intentId }, 'Swap created without inputAmount - using 0')
    }

    // Store swap in LRU cache with TTL
    const swap = {
      id: swapId,
      status: 'pending' as const,
      inputAmount: actualInputAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    swapStore.set(swapId, swap)

    logger.warn({
      swapId,
      quoteId,
      intentId,
      inputAmount: actualInputAmount,
    }, 'Creating MOCK swap - not for production use')

    const response: ApiResponse<SwapResponse & { _warning?: string }> = {
      success: true,
      data: {
        swapId,
        status: 'pending',
        timestamp: new Date().toISOString(),
        _warning: 'MOCK_DATA: This swap is simulated. No real transaction will be executed.',
      },
    }

    res.json(response)
  }
)

/**
 * GET /swap/:id/status
 * Get swap status
 *
 * @openapi
 * /swap/{id}/status:
 *   get:
 *     summary: Get swap status
 *     description: Check the status of a swap transaction
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Swap ID
 *     responses:
 *       200:
 *         description: Swap status retrieved
 *       404:
 *         description: Swap not found
 */
router.get(
  '/:id/status',
  validateRequest({ params: schemas.swapStatus }),
  async (req: Request, res: Response) => {
    const { id } = req.params
    // Express 5 types params as string | string[] - ensure we have a string
    const swapId = Array.isArray(id) ? id[0] : id

    const swap = swapStore.get(swapId)

    if (!swap) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SWAP_NOT_FOUND',
          message: `Swap ${swapId} not found`,
        },
      })
    }

    const response: ApiResponse<SwapStatusResponse> = {
      success: true,
      data: swap,
    }

    res.json(response)
  }
)

export default router
