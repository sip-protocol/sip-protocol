/**
 * ShieldedIntent class for SIP Protocol
 *
 * Main interface for creating and managing shielded intents.
 */

import {
  SIP_VERSION,
  IntentStatus,
  PrivacyLevel as PrivacyLevelEnum,
  type ShieldedIntent,
  type CreateIntentParams,
  type TrackedIntent,
  type Quote,
  type FulfillmentResult,
  type StealthMetaAddress,
  type Commitment,
  type HexString,
  type PrivacyLevel,
} from '@sip-protocol/types'
import { generateStealthAddress, decodeStealthMetaAddress } from './stealth'
import {
  createCommitment,
  generateIntentId,
  hash,
} from './crypto'
import { hexToBytes } from '@noble/hashes/utils'
import { getPrivacyConfig, generateViewingKey } from './privacy'
import type { ProofProvider } from './proofs'

/**
 * Options for creating a shielded intent
 */
export interface CreateIntentOptions {
  /** Sender address (for ownership proof) */
  senderAddress?: string
  /**
   * Proof provider for generating ZK proofs
   * If provided and privacy level requires proofs, they will be generated automatically
   */
  proofProvider?: ProofProvider
}

/**
 * Builder class for creating shielded intents
 */
export class IntentBuilder {
  private params: Partial<CreateIntentParams> = {}
  private senderAddress?: string
  private proofProvider?: ProofProvider

  /**
   * Set the input for the intent
   */
  input(
    chain: string,
    token: string,
    amount: number | bigint,
    sourceAddress?: string,
  ): this {
    this.params.input = {
      asset: {
        chain: chain as any,
        symbol: token,
        address: null,
        decimals: 18, // Default, should be looked up
      },
      amount: typeof amount === 'number' ? BigInt(Math.floor(amount * 1e18)) : amount,
      sourceAddress,
    }
    this.senderAddress = sourceAddress
    return this
  }

  /**
   * Set the output for the intent
   */
  output(chain: string, token: string, minAmount?: number | bigint): this {
    this.params.output = {
      asset: {
        chain: chain as any,
        symbol: token,
        address: null,
        decimals: 18,
      },
      minAmount: minAmount
        ? typeof minAmount === 'number'
          ? BigInt(Math.floor(minAmount * 1e18))
          : minAmount
        : 0n,
      maxSlippage: 0.01, // 1% default
    }
    return this
  }

  /**
   * Set the privacy level
   */
  privacy(level: PrivacyLevel): this {
    this.params.privacy = level
    return this
  }

  /**
   * Set the recipient's stealth meta-address
   */
  recipient(metaAddress: string): this {
    this.params.recipientMetaAddress = metaAddress
    return this
  }

  /**
   * Set slippage tolerance
   */
  slippage(percent: number): this {
    if (this.params.output) {
      this.params.output.maxSlippage = percent / 100
    }
    return this
  }

  /**
   * Set time-to-live in seconds
   */
  ttl(seconds: number): this {
    this.params.ttl = seconds
    return this
  }

  /**
   * Set the proof provider for automatic proof generation
   *
   * @param provider - The proof provider to use
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * const intent = await builder
   *   .input('near', 'NEAR', 100n)
   *   .output('zcash', 'ZEC', 95n)
   *   .privacy(PrivacyLevel.SHIELDED)
   *   .withProvider(mockProvider)
   *   .build()
   * ```
   */
  withProvider(provider: ProofProvider): this {
    this.proofProvider = provider
    return this
  }

  /**
   * Build the shielded intent
   *
   * If a proof provider is set and the privacy level requires proofs,
   * they will be generated automatically.
   *
   * @returns Promise resolving to the shielded intent
   */
  async build(): Promise<ShieldedIntent> {
    return createShieldedIntent(this.params as CreateIntentParams, {
      senderAddress: this.senderAddress,
      proofProvider: this.proofProvider,
    })
  }
}

/**
 * Create a new shielded intent
 *
 * @param params - Intent creation parameters
 * @param options - Optional configuration (sender address, proof provider)
 * @returns Promise resolving to the shielded intent
 *
 * @example
 * ```typescript
 * // Without proof provider (proofs need to be attached later)
 * const intent = await createShieldedIntent(params)
 *
 * // With proof provider (proofs generated automatically for SHIELDED/COMPLIANT)
 * const intent = await createShieldedIntent(params, {
 *   senderAddress: wallet.address,
 *   proofProvider: mockProvider,
 * })
 * ```
 */
export async function createShieldedIntent(
  params: CreateIntentParams,
  options?: CreateIntentOptions,
): Promise<ShieldedIntent> {
  const { input, output, privacy, recipientMetaAddress, viewingKey, ttl = 300 } = params
  const { senderAddress, proofProvider } = options ?? {}

  // Validate required fields
  if (!input || !output || !privacy) {
    throw new Error('Missing required parameters: input, output, privacy')
  }

  // Get privacy configuration
  const privacyConfig = getPrivacyConfig(
    privacy,
    viewingKey ? { key: viewingKey, path: 'm/0', hash: hash(viewingKey) } : undefined,
  )

  // Generate intent ID
  const intentId = generateIntentId()

  // Create commitments for private fields
  const inputCommitment = createCommitment(input.amount)
  const senderCommitment = createCommitment(
    BigInt(senderAddress ? hash(senderAddress).slice(2, 18) : '0'),
  )

  // Generate stealth address for recipient (if shielded)
  let recipientStealth
  if (privacyConfig.useStealth && recipientMetaAddress) {
    const metaAddress = decodeStealthMetaAddress(recipientMetaAddress)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    recipientStealth = stealthAddress
  } else {
    // For transparent mode, create a placeholder
    recipientStealth = {
      address: '0x0' as HexString,
      ephemeralPublicKey: '0x0' as HexString,
      viewTag: 0,
    }
  }

  const now = Math.floor(Date.now() / 1000)

  // Generate proofs if provider is available and privacy level requires them
  let fundingProof: import('@sip-protocol/types').ZKProof | undefined
  let validityProof: import('@sip-protocol/types').ZKProof | undefined

  const requiresProofs = privacy !== PrivacyLevelEnum.TRANSPARENT

  if (requiresProofs && proofProvider && proofProvider.isReady) {
    // Helper to convert HexString to Uint8Array
    const hexToUint8 = (hex: HexString): Uint8Array => {
      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
      return hexToBytes(cleanHex)
    }

    // Generate funding proof
    const fundingResult = await proofProvider.generateFundingProof({
      balance: input.amount,
      minimumRequired: output.minAmount,
      blindingFactor: hexToUint8(inputCommitment.blindingFactor as HexString),
      assetId: input.asset.symbol,
      userAddress: senderAddress ?? '0x0',
      ownershipSignature: new Uint8Array(64), // Placeholder - would come from wallet
    })
    fundingProof = fundingResult.proof

    // Generate validity proof
    const validityResult = await proofProvider.generateValidityProof({
      intentHash: hash(intentId) as HexString,
      senderAddress: senderAddress ?? '0x0',
      senderBlinding: hexToUint8(senderCommitment.blindingFactor as HexString),
      senderSecret: new Uint8Array(32), // Placeholder - would come from wallet
      authorizationSignature: new Uint8Array(64), // Placeholder - would come from wallet
      nonce: new Uint8Array(32), // Could use randomBytes here
      timestamp: now,
      expiry: now + ttl,
    })
    validityProof = validityResult.proof
  }

  return {
    intentId,
    version: SIP_VERSION,
    privacyLevel: privacy,
    createdAt: now,
    expiry: now + ttl,

    outputAsset: output.asset,
    minOutputAmount: output.minAmount,
    maxSlippage: output.maxSlippage,

    inputCommitment,
    senderCommitment,
    recipientStealth,

    // Proofs are undefined if:
    // - TRANSPARENT mode (not required)
    // - No proof provider given
    // - Provider not ready
    fundingProof: fundingProof as any,
    validityProof: validityProof as any,

    viewingKeyHash: privacyConfig.viewingKey?.hash,
  }
}

/**
 * Attach proofs to a shielded intent
 *
 * For SHIELDED and COMPLIANT modes, proofs are required before the intent
 * can be submitted. This function attaches the proofs to an intent.
 *
 * @param intent - The intent to attach proofs to
 * @param fundingProof - The funding proof (balance >= minimum)
 * @param validityProof - The validity proof (authorization)
 * @returns The intent with proofs attached
 */
export function attachProofs(
  intent: ShieldedIntent,
  fundingProof: import('@sip-protocol/types').ZKProof,
  validityProof: import('@sip-protocol/types').ZKProof,
): ShieldedIntent {
  return {
    ...intent,
    fundingProof,
    validityProof,
  }
}

/**
 * Check if an intent has all required proofs
 */
export function hasRequiredProofs(intent: ShieldedIntent): boolean {
  // TRANSPARENT mode doesn't require proofs
  if (intent.privacyLevel === 'transparent') {
    return true
  }

  // SHIELDED and COMPLIANT modes require both proofs
  return !!(intent.fundingProof && intent.validityProof)
}

/**
 * Wrap a shielded intent with status tracking
 */
export function trackIntent(intent: ShieldedIntent): TrackedIntent {
  return {
    ...intent,
    status: IntentStatus.PENDING,
    quotes: [],
  }
}

/**
 * Check if an intent has expired
 */
export function isExpired(intent: ShieldedIntent): boolean {
  return Math.floor(Date.now() / 1000) > intent.expiry
}

/**
 * Get time remaining until intent expires (in seconds)
 */
export function getTimeRemaining(intent: ShieldedIntent): number {
  const remaining = intent.expiry - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Serialize a shielded intent to JSON
 */
export function serializeIntent(intent: ShieldedIntent): string {
  return JSON.stringify(intent, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}

/**
 * Deserialize a shielded intent from JSON
 */
export function deserializeIntent(json: string): ShieldedIntent {
  return JSON.parse(json, (key, value) => {
    // Convert string numbers back to bigint for known fields
    if (
      typeof value === 'string' &&
      /^\d+$/.test(value) &&
      ['minOutputAmount', 'amount'].includes(key)
    ) {
      return BigInt(value)
    }
    return value
  })
}

/**
 * Get a human-readable summary of the intent
 */
export function getIntentSummary(intent: ShieldedIntent): string {
  const privacy = intent.privacyLevel.toUpperCase()
  const output = intent.outputAsset.symbol
  const expiry = new Date(intent.expiry * 1000).toISOString()

  return `[${privacy}] Intent ${intent.intentId.slice(0, 16)}... → ${output} (expires: ${expiry})`
}
