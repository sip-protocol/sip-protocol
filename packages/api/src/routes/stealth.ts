import { Router, Request, Response } from 'express'
import { generateStealthAddress } from '@sip-protocol/sdk'
import { validateRequest, schemas } from '../middleware'
import type { GenerateStealthRequest, StealthAddressResponse, ApiResponse } from '../types/api'

const router: Router = Router()

/**
 * POST /stealth/generate
 * Generate a stealth address for a recipient
 *
 * @openapi
 * /stealth/generate:
 *   post:
 *     summary: Generate stealth address
 *     description: Generate a one-time stealth address for privacy-preserving transactions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chain
 *               - recipientMetaAddress
 *             properties:
 *               chain:
 *                 type: string
 *                 enum: [solana, ethereum, near, zcash, polygon, arbitrum, optimism, base, bitcoin]
 *               recipientMetaAddress:
 *                 type: object
 *                 required:
 *                   - spendingKey
 *                   - viewingKey
 *                   - chain
 *                 properties:
 *                   spendingKey:
 *                     type: string
 *                     pattern: ^0x[0-9a-fA-F]+$
 *                   viewingKey:
 *                     type: string
 *                     pattern: ^0x[0-9a-fA-F]+$
 *                   chain:
 *                     type: string
 *                   label:
 *                     type: string
 *     responses:
 *       200:
 *         description: Stealth address generated successfully
 *       400:
 *         description: Invalid request parameters
 */
router.post(
  '/generate',
  validateRequest({ body: schemas.generateStealth }),
  async (req: Request, res: Response) => {
    const { chain, recipientMetaAddress } = req.body as GenerateStealthRequest

    const result = generateStealthAddress(recipientMetaAddress)

    const response: ApiResponse<StealthAddressResponse> = {
      success: true,
      data: {
        stealthAddress: {
          address: result.stealthAddress.address,
          ephemeralPublicKey: result.stealthAddress.ephemeralPublicKey,
          viewTag: result.stealthAddress.viewTag,
        },
      },
    }

    res.json(response)
  }
)

export default router
