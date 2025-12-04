import { Router, Request, Response } from 'express'
import { MockProofProvider } from '@sip-protocol/sdk'
import { hexToBytes } from '@noble/hashes/utils'
import { validateRequest, schemas } from '../middleware'
import type { GenerateFundingProofRequest, FundingProofResponse, ApiResponse } from '../types/api'

const router: Router = Router()

// Initialize proof provider (use MockProofProvider for now)
// In production, use NoirProofProvider from '@sip-protocol/sdk/proofs/noir'
const proofProvider = new MockProofProvider()

// Initialize the provider (fire-and-forget, provider handles internal state)
proofProvider.initialize().catch(console.error)

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
