import { Router, Request, Response } from 'express'
import { MockProofProvider } from '@sip-protocol/sdk'
import { hexToBytes } from '@noble/hashes/utils'
import { validateRequest, schemas } from '../middleware'
import type { GenerateFundingProofRequest, FundingProofResponse, ApiResponse } from '../types/api'

const router: Router = Router()

// ─── Proof Provider Initialization State ───────────────────────────────────────

/**
 * Proof provider initialization configuration
 */
const INIT_CONFIG = {
  /** Maximum number of initialization attempts */
  maxRetries: 3,
  /** Base delay between retries in milliseconds */
  baseDelayMs: 1000,
  /** Whether to exit process on permanent failure */
  exitOnFailure: process.env.NODE_ENV === 'production',
} as const

/**
 * Proof provider initialization state
 */
interface ProofProviderState {
  ready: boolean
  error: Error | null
  initAttempt: number
  lastAttemptAt: string | null
}

const proofProviderState: ProofProviderState = {
  ready: false,
  error: null,
  initAttempt: 0,
  lastAttemptAt: null,
}

// Initialize proof provider (use MockProofProvider for now)
// In production, use NoirProofProvider from '@sip-protocol/sdk/proofs/noir'
const proofProvider = new MockProofProvider()

/**
 * Initialize proof provider with retry logic
 *
 * Implements exponential backoff on failure and exits process
 * if all retries are exhausted (12-factor app disposability).
 */
async function initializeProofProvider(): Promise<void> {
  for (let attempt = 1; attempt <= INIT_CONFIG.maxRetries; attempt++) {
    proofProviderState.initAttempt = attempt
    proofProviderState.lastAttemptAt = new Date().toISOString()

    try {
      console.log(`[ProofProvider] Initialization attempt ${attempt}/${INIT_CONFIG.maxRetries}...`)
      await proofProvider.initialize()

      proofProviderState.ready = true
      proofProviderState.error = null
      console.log('[ProofProvider] Initialized successfully')
      return
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      proofProviderState.error = error

      console.error(`[ProofProvider] Initialization failed (attempt ${attempt}/${INIT_CONFIG.maxRetries}):`, {
        error: error.message,
        attempt,
        maxRetries: INIT_CONFIG.maxRetries,
      })

      if (attempt < INIT_CONFIG.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delayMs = INIT_CONFIG.baseDelayMs * Math.pow(2, attempt - 1)
        console.log(`[ProofProvider] Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  // All retries exhausted - fail fast
  console.error('[ProofProvider] FATAL: All initialization attempts failed', {
    attempts: INIT_CONFIG.maxRetries,
    lastError: proofProviderState.error?.message,
  })

  if (INIT_CONFIG.exitOnFailure) {
    console.error('[ProofProvider] Exiting process (12-factor: fail fast)')
    process.exit(1)
  }
}

// Start initialization immediately (blocks health check readiness)
initializeProofProvider()

/**
 * Get proof provider status for health checks
 */
export function getProofProviderStatus(): {
  ready: boolean
  error: string | null
  initAttempt: number
  lastAttemptAt: string | null
} {
  return {
    ready: proofProviderState.ready,
    error: proofProviderState.error?.message ?? null,
    initAttempt: proofProviderState.initAttempt,
    lastAttemptAt: proofProviderState.lastAttemptAt,
  }
}

/**
 * Middleware to guard proof endpoints - returns 503 if provider not ready
 */
function requireProofProvider(_req: Request, res: Response, next: () => void) {
  if (!proofProviderState.ready) {
    const error = proofProviderState.error?.message || 'Proof provider initializing'
    return res.status(503).json({
      success: false,
      error: {
        code: 'PROOF_PROVIDER_NOT_READY',
        message: error,
        details: {
          initAttempt: proofProviderState.initAttempt,
          maxRetries: INIT_CONFIG.maxRetries,
        },
      },
    } satisfies ApiResponse<never>)
  }
  next()
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
  requireProofProvider,
  validateRequest({ body: schemas.generateFundingProof }),
  async (req: Request, res: Response) => {
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
