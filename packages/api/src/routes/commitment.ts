import { Router, Request, Response } from 'express'
import { commit } from '@sip-protocol/sdk'
import { hexToBytes } from '@noble/hashes/utils'
import { validateRequest, schemas } from '../middleware'
import type { CreateCommitmentRequest, CommitmentResponse, ApiResponse } from '../types/api'

const router: Router = Router()

/**
 * POST /commitment/create
 * Create a Pedersen commitment to a value
 *
 * @openapi
 * /commitment/create:
 *   post:
 *     summary: Create Pedersen commitment
 *     description: Create a cryptographic commitment to hide transaction amounts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *                 description: Value to commit (as string to handle bigint)
 *                 example: "1000000000"
 *               blindingFactor:
 *                 type: string
 *                 description: Optional blinding factor (hex string)
 *                 pattern: ^0x[0-9a-fA-F]+$
 *     responses:
 *       200:
 *         description: Commitment created successfully
 *       400:
 *         description: Invalid request parameters
 */
router.post(
  '/create',
  validateRequest({ body: schemas.createCommitment }),
  async (req: Request, res: Response) => {
    const { value, blindingFactor } = req.body as CreateCommitmentRequest

    const valueBigInt = BigInt(value)
    const blindingBytes = blindingFactor ? hexToBytes(blindingFactor.replace(/^0x/, '')) : undefined

    const result = commit(valueBigInt, blindingBytes)

    const response: ApiResponse<CommitmentResponse> = {
      success: true,
      data: {
        commitment: result.commitment,
        blindingFactor: result.blinding,
      },
    }

    res.json(response)
  }
)

export default router
