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
  type Hash,
  type PrivacyLevel,
  type ChainId,
} from '@sip-protocol/types'
import { generateStealthAddress, decodeStealthMetaAddress } from './stealth'
import {
  createCommitment,
  generateIntentId,
  hash,
} from './crypto'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'
import { getPrivacyConfig, generateViewingKey } from './privacy'
import type { ProofProvider } from './proofs'
import { ValidationError } from './errors'
import {
  validateCreateIntentParams,
  isValidChainId,
  isValidAmount,
  isValidSlippage,
  isValidPrivacyLevel,
  isValidStealthMetaAddress,
} from './validation'

/**
 * Options for creating a shielded intent
 *
 * Additional configuration passed to {@link createShieldedIntent} that
 * affects proof generation and sender identification.
 */
export interface CreateIntentOptions {
  /**
   * Wallet address of the sender
   *
   * Used for:
   * - Generating ownership proofs (proving control of input funds)
   * - Creating sender commitments
   * - Enabling refunds if transaction fails
   *
   * Optional but recommended for production use.
   */
  senderAddress?: string

  /**
   * Proof provider for automatic ZK proof generation
   *
   * If provided and privacy level is SHIELDED or COMPLIANT, proofs will be
   * generated automatically during intent creation. If not provided, proofs
   * must be attached later using {@link attachProofs}.
   *
   * **Available providers:**
   * - {@link MockProofProvider}: For testing
   * - `NoirProofProvider`: For production (Node.js)
   * - `BrowserNoirProvider`: For browsers
   *
   * @example
   * ```typescript
   * import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'
   *
   * const provider = new NoirProofProvider()
   * await provider.initialize()
   *
   * const intent = await createShieldedIntent(params, {
   *   senderAddress: wallet.address,
   *   proofProvider: provider,
   * })
   * ```
   */
  proofProvider?: ProofProvider

  /**
   * Signature proving ownership of the sender's address
   *
   * Required for production proof generation. This signature proves
   * the sender controls the address that holds the input funds.
   *
   * Should be a 64-byte ECDSA signature over the address.
   */
  ownershipSignature?: Uint8Array

  /**
   * Sender's secret key for nullifier derivation
   *
   * Required for production proof generation. Used to derive:
   * - Public key for ECDSA verification in proofs
   * - Nullifier to prevent double-spending
   *
   * Should be a 32-byte secret. Keep this secure!
   */
  senderSecret?: Uint8Array

  /**
   * Signature authorizing this specific intent
   *
   * Required for production proof generation. This signature proves
   * the sender authorized this intent (signs the intent hash).
   *
   * Should be a 64-byte ECDSA signature over the intent hash.
   */
  authorizationSignature?: Uint8Array

  /**
   * Allow placeholder signatures for development/testing
   *
   * When true, allows proof generation with empty placeholder signatures.
   * **WARNING**: Never use this in production! Proofs with placeholders
   * are not cryptographically valid.
   *
   * @default false
   */
  allowPlaceholders?: boolean
}

/**
 * Fluent builder for creating shielded intents
 *
 * Provides a chainable API for constructing intents step-by-step.
 * More ergonomic than passing a large parameter object directly.
 *
 * **Builder Methods:**
 * - {@link input}: Set input asset and amount
 * - {@link output}: Set output asset and constraints
 * - {@link privacy}: Set privacy level
 * - {@link recipient}: Set recipient stealth meta-address
 * - {@link slippage}: Set slippage tolerance
 * - {@link ttl}: Set time-to-live
 * - {@link withProvider}: Set proof provider
 * - {@link build}: Create the intent
 *
 * @example Basic intent
 * ```typescript
 * const intent = await new IntentBuilder()
 *   .input('solana', 'SOL', 10n * 10n**9n)
 *   .output('ethereum', 'ETH', 0n)
 *   .privacy(PrivacyLevel.SHIELDED)
 *   .build()
 * ```
 *
 * @example Full-featured intent with proofs
 * ```typescript
 * import { IntentBuilder, PrivacyLevel, MockProofProvider } from '@sip-protocol/sdk'
 *
 * const builder = new IntentBuilder()
 * const intent = await builder
 *   .input('near', 'NEAR', 100n * 10n**24n, wallet.address) // 100 NEAR
 *   .output('zcash', 'ZEC', 95n * 10n**8n)                   // Min 95 ZEC
 *   .privacy(PrivacyLevel.COMPLIANT)
 *   .recipient('sip:zcash:0x02abc...123:0x03def...456')
 *   .slippage(1) // 1%
 *   .ttl(600)    // 10 minutes
 *   .withProvider(new MockProofProvider())
 *   .build()
 *
 * console.log('Intent created:', intent.intentId)
 * console.log('Has proofs:', !!intent.fundingProof && !!intent.validityProof)
 * ```
 *
 * @see {@link createShieldedIntent} for the underlying implementation
 * @see {@link CreateIntentParams} for parameter types
 */
export class IntentBuilder {
  private params: Partial<CreateIntentParams> = {}
  private senderAddress?: string
  private proofProvider?: ProofProvider
  private ownershipSignature?: Uint8Array
  private senderSecret?: Uint8Array
  private authorizationSignature?: Uint8Array
  private allowPlaceholders?: boolean

  /**
   * Set the input for the intent
   *
   * @throws {ValidationError} If chain or amount is invalid
   */
  input(
    chain: string,
    token: string,
    amount: number | bigint,
    sourceAddress?: string,
  ): this {
    // Validate chain
    if (!isValidChainId(chain)) {
      throw new ValidationError(
        `invalid chain '${chain}', must be one of: solana, ethereum, near, zcash, polygon, arbitrum, optimism, base`,
        'input.chain'
      )
    }

    // Validate token
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new ValidationError('token must be a non-empty string', 'input.token')
    }

    // Validate amount
    const amountBigInt = typeof amount === 'number' ? BigInt(Math.floor(amount * 1e18)) : amount
    if (!isValidAmount(amountBigInt)) {
      throw new ValidationError('amount must be positive', 'input.amount')
    }

    this.params.input = {
      asset: {
        chain: chain as ChainId,
        symbol: token,
        address: null,
        decimals: 18, // Default, should be looked up
      },
      amount: amountBigInt,
      sourceAddress,
    }
    this.senderAddress = sourceAddress
    return this
  }

  /**
   * Set the output for the intent
   *
   * @throws {ValidationError} If chain is invalid
   */
  output(chain: string, token: string, minAmount?: number | bigint): this {
    // Validate chain
    if (!isValidChainId(chain)) {
      throw new ValidationError(
        `invalid chain '${chain}', must be one of: solana, ethereum, near, zcash, polygon, arbitrum, optimism, base`,
        'output.chain'
      )
    }

    // Validate token
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new ValidationError('token must be a non-empty string', 'output.token')
    }

    const minAmountBigInt = minAmount
      ? typeof minAmount === 'number'
        ? BigInt(Math.floor(minAmount * 1e18))
        : minAmount
      : 0n

    // minAmount can be 0 (no minimum), but not negative
    if (minAmountBigInt < 0n) {
      throw new ValidationError('minAmount cannot be negative', 'output.minAmount')
    }

    this.params.output = {
      asset: {
        chain: chain as ChainId,
        symbol: token,
        address: null,
        decimals: 18,
      },
      minAmount: minAmountBigInt,
      maxSlippage: 0.01, // 1% default
    }
    return this
  }

  /**
   * Set the privacy level
   *
   * @throws {ValidationError} If privacy level is invalid
   */
  privacy(level: PrivacyLevel): this {
    if (!isValidPrivacyLevel(level)) {
      throw new ValidationError(
        `invalid privacy level '${level}', must be one of: transparent, shielded, compliant`,
        'privacy'
      )
    }
    this.params.privacy = level
    return this
  }

  /**
   * Set the recipient's stealth meta-address
   *
   * @throws {ValidationError} If stealth meta-address format is invalid
   */
  recipient(metaAddress: string): this {
    if (metaAddress && !isValidStealthMetaAddress(metaAddress)) {
      throw new ValidationError(
        'invalid stealth meta-address format, expected: sip:<chain>:<spendingKey>:<viewingKey>',
        'recipientMetaAddress'
      )
    }
    this.params.recipientMetaAddress = metaAddress
    return this
  }

  /**
   * Set slippage tolerance
   *
   * @param percent - Slippage percentage (e.g., 1 for 1%)
   * @throws {ValidationError} If slippage is out of range
   */
  slippage(percent: number): this {
    const slippageDecimal = percent / 100
    if (!isValidSlippage(slippageDecimal)) {
      throw new ValidationError(
        'slippage must be a non-negative number less than 100%',
        'maxSlippage',
        { received: percent, asDecimal: slippageDecimal }
      )
    }
    if (this.params.output) {
      this.params.output.maxSlippage = slippageDecimal
    }
    return this
  }

  /**
   * Set time-to-live in seconds
   *
   * @throws {ValidationError} If TTL is not a positive integer
   */
  ttl(seconds: number): this {
    if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds <= 0) {
      throw new ValidationError(
        'ttl must be a positive integer (seconds)',
        'ttl',
        { received: seconds }
      )
    }
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
   * Set the signatures and secret for proof generation
   *
   * Required for production proof generation. Provides the cryptographic
   * materials needed to generate valid ZK proofs.
   *
   * @param signatures - Object containing ownership signature, sender secret, and authorization signature
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * const intent = await builder
   *   .input('near', 'NEAR', 100n)
   *   .output('zcash', 'ZEC', 95n)
   *   .privacy(PrivacyLevel.SHIELDED)
   *   .withProvider(noirProvider)
   *   .withSignatures({
   *     ownershipSignature: await wallet.signMessage(address),
   *     senderSecret: wallet.privateKey,
   *     authorizationSignature: await wallet.signMessage(intentHash),
   *   })
   *   .build()
   * ```
   */
  withSignatures(signatures: {
    ownershipSignature: Uint8Array
    senderSecret: Uint8Array
    authorizationSignature: Uint8Array
  }): this {
    this.ownershipSignature = signatures.ownershipSignature
    this.senderSecret = signatures.senderSecret
    this.authorizationSignature = signatures.authorizationSignature
    return this
  }

  /**
   * Allow placeholder signatures for development/testing
   *
   * **WARNING**: Never use this in production! Proofs with placeholders
   * are not cryptographically valid.
   *
   * @param allow - Whether to allow placeholders (default: true)
   * @returns this for chaining
   */
  withPlaceholders(allow: boolean = true): this {
    this.allowPlaceholders = allow
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
      ownershipSignature: this.ownershipSignature,
      senderSecret: this.senderSecret,
      authorizationSignature: this.authorizationSignature,
      allowPlaceholders: this.allowPlaceholders,
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
  // Comprehensive input validation
  validateCreateIntentParams(params)

  const { input, output, privacy, recipientMetaAddress, viewingKey, ttl = 300 } = params
  const {
    senderAddress,
    proofProvider,
    ownershipSignature,
    senderSecret,
    authorizationSignature,
    allowPlaceholders = false,
  } = options ?? {}

  // Get privacy configuration
  // Compute viewing key hash the same way as generateViewingKey():
  // Hash the raw key bytes, not the hex string
  let viewingKeyHash: Hash | undefined
  if (viewingKey) {
    const keyHex = viewingKey.startsWith('0x') ? viewingKey.slice(2) : viewingKey
    const keyBytes = hexToBytes(keyHex)
    viewingKeyHash = `0x${bytesToHex(sha256(keyBytes))}` as Hash
  }

  const privacyConfig = getPrivacyConfig(
    privacy,
    viewingKey ? { key: viewingKey, path: 'm/0', hash: viewingKeyHash! } : undefined,
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
    // Check if signatures are provided or placeholders are allowed
    const hasSignatures = ownershipSignature && senderSecret && authorizationSignature
    const usingPlaceholders = !hasSignatures

    if (usingPlaceholders && !allowPlaceholders) {
      throw new ValidationError(
        'Proof generation requires signatures. Provide ownershipSignature, senderSecret, and authorizationSignature in options, or set allowPlaceholders: true for development/testing.',
        'options',
        {
          missing: [
            !ownershipSignature && 'ownershipSignature',
            !senderSecret && 'senderSecret',
            !authorizationSignature && 'authorizationSignature',
          ].filter(Boolean),
        }
      )
    }

    if (usingPlaceholders) {
      console.warn(
        '[createShieldedIntent] WARNING: Using placeholder signatures for proof generation. ' +
        'These proofs are NOT cryptographically valid. Do NOT use in production!'
      )
    }

    // Helper to convert HexString to Uint8Array
    const hexToUint8 = (hex: HexString): Uint8Array => {
      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
      return hexToBytes(cleanHex)
    }

    // Use provided signatures or placeholders (if allowed)
    const effectiveOwnershipSig = ownershipSignature ?? new Uint8Array(64)
    const effectiveSenderSecret = senderSecret ?? new Uint8Array(32)
    const effectiveAuthSig = authorizationSignature ?? new Uint8Array(64)

    // Generate funding proof
    const fundingResult = await proofProvider.generateFundingProof({
      balance: input.amount,
      minimumRequired: output.minAmount,
      blindingFactor: hexToUint8(inputCommitment.blindingFactor as HexString),
      assetId: input.asset.symbol,
      userAddress: senderAddress ?? '0x0',
      ownershipSignature: effectiveOwnershipSig,
    })
    fundingProof = fundingResult.proof

    // Generate validity proof
    const validityResult = await proofProvider.generateValidityProof({
      intentHash: hash(intentId) as HexString,
      senderAddress: senderAddress ?? '0x0',
      senderBlinding: hexToUint8(senderCommitment.blindingFactor as HexString),
      senderSecret: effectiveSenderSecret,
      authorizationSignature: effectiveAuthSig,
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
    fundingProof,
    validityProof,

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
