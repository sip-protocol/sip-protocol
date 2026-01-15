import { Router, Request, Response } from 'express'
import { MockProofProvider } from '@sip-protocol/sdk'
import { hexToBytes } from '@noble/hashes/utils'
import { validateRequest, schemas } from '../middleware'
import { logger } from '../logger'
import type { GenerateFundingProofRequest, FundingProofResponse, ApiResponse } from '../types/api'

const router: Router = Router()

// Initialize proof provider (use MockProofProvider for now)
// In production, use NoirProofProvider from '@sip-protocol/sdk/proofs/noir'
const proofProvider = new MockProofProvider()

/**
 * Proof provider initialization state
 * Implements fail-fast pattern with retry for transient failures
 */
let proofProviderReady = false
let proofInitError: Error | null = null

const MAX_INIT_RETRIES = 3
const RETRY_DELAY_MS = 2000

async function initializeProofProvider(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
    try {
      await proofProvider.initialize()
      proofProviderReady = true
      proofInitError = null
      logger.info({ attempt }, 'Proof provider initialized successfully')
      return
    } catch (err) {
      proofInitError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, maxRetries: MAX_INIT_RETRIES, error: proofInitError.message },
        'Proof provider initialization failed, retrying...')

      if (attempt < MAX_INIT_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
      }
    }
  }

  // All retries exhausted - log fatal but don't crash (graceful degradation)
  // The readiness guard will reject proof requests until fixed
  logger.error({ error: proofInitError?.message },
    'Proof provider initialization failed after all retries')
}

// Start initialization immediately (non-blocking)
initializeProofProvider()

/**
 * Check if proof provider is ready
 */
export function isProofProviderReady(): boolean {
  return proofProviderReady
}

/**
 * Get proof provider initialization error (if any)
 */
export function getProofInitError(): Error | null {
  return proofInitError
}

/**
 * POST /proof/funding
 * Generate a funding proof (proves balance >= minimum without revealing exact balance)
 *
 * @openapi
 * /proof/funding:
 *   post:
 *     summary: Generate funding proof
 *     description: Generate a zero-knowledge proof that balance meets minimum requirement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - balance
 *               - minRequired
 *               - balanceBlinding
 *             properties:
 *               balance:
 *                 type: string
 *                 description: Actual balance (as string to handle bigint)
 *                 example: "1000000000"
 *               minRequired:
 *                 type: string
 *                 description: Minimum required balance
 *                 example: "500000000"
 *               balanceBlinding:
 *                 type: string
 *                 description: Blinding factor for balance commitment
 *                 pattern: ^0x[0-9a-fA-F]+$
 *     responses:
 *       200:
 *         description: Proof generated successfully
 *       400:
 *         description: Invalid request parameters or balance too low
 */
router.post(
  '/funding',
  validateRequest({ body: schemas.generateFundingProof }),
  async (req: Request, res: Response) => {
    // Readiness guard - reject requests if proof provider not initialized
    if (!proofProviderReady) {
      const errorMsg = proofInitError?.message || 'Proof provider is initializing'
      logger.warn({ error: errorMsg }, 'Proof request rejected - provider not ready')
      return res.status(503).json({
        success: false,
        error: {
          code: 'PROOF_PROVIDER_NOT_READY',
          message: 'Proof generation service is not ready',
          details: { reason: errorMsg },
        },
      })
    }

    const { balance, minRequired, balanceBlinding } = req.body as GenerateFundingProofRequest

    const balanceBigInt = BigInt(balance)
    const minRequiredBigInt = BigInt(minRequired)
    const balanceBlindingBytes = hexToBytes(balanceBlinding.replace(/^0x/, ''))

    const result = await proofProvider.generateFundingProof({
      balance: balanceBigInt,
      minimumRequired: minRequiredBigInt,
      blindingFactor: balanceBlindingBytes,
      assetId: 'SOL', // Default asset
      userAddress: '0x0000000000000000000000000000000000000000',
      ownershipSignature: new Uint8Array(64),
    })

    const response: ApiResponse<FundingProofResponse> = {
      success: true,
      data: {
        proof: result.proof.proof,
        publicInputs: result.proof.publicInputs,
      },
    }

    res.json(response)
  }
)

export default router
