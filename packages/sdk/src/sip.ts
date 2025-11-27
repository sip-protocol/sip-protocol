/**
 * SIP SDK Main Client
 *
 * High-level interface for interacting with the Shielded Intents Protocol.
 */

import {
  PrivacyLevel,
  IntentStatus,
  type ShieldedIntent,
  type CreateIntentParams,
  type TrackedIntent,
  type Quote,
  type FulfillmentResult,
  type StealthMetaAddress,
  type ViewingKey,
} from '@sip-protocol/types'
import { IntentBuilder, createShieldedIntent, trackIntent, hasRequiredProofs } from './intent'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from './stealth'
import { generateViewingKey, deriveViewingKey } from './privacy'
import type { ChainId, HexString } from '@sip-protocol/types'
import type { ProofProvider } from './proofs'
import { ValidationError } from './errors'
import { isValidChainId } from './validation'

/**
 * SIP SDK configuration
 */
export interface SIPConfig {
  /** Network: mainnet or testnet */
  network: 'mainnet' | 'testnet'
  /** Default privacy level */
  defaultPrivacy?: PrivacyLevel
  /** RPC endpoints for chains */
  rpcEndpoints?: Partial<Record<ChainId, string>>
  /**
   * Proof provider for ZK proof generation
   *
   * If not provided, proof generation will not be available.
   * Use MockProofProvider for testing, NoirProofProvider for production.
   *
   * @example
   * ```typescript
   * import { MockProofProvider } from '@sip-protocol/sdk'
   *
   * const sip = new SIP({
   *   network: 'testnet',
   *   proofProvider: new MockProofProvider(),
   * })
   * ```
   */
  proofProvider?: ProofProvider
}

/**
 * Wallet adapter interface
 */
export interface WalletAdapter {
  /** Connected chain */
  chain: ChainId
  /** Wallet address */
  address: string
  /** Sign a message */
  signMessage(message: string): Promise<string>
  /** Sign a transaction */
  signTransaction(tx: unknown): Promise<unknown>
}

/**
 * Main SIP SDK class
 */
export class SIP {
  private config: SIPConfig
  private wallet?: WalletAdapter
  private stealthKeys?: {
    metaAddress: StealthMetaAddress
    spendingPrivateKey: HexString
    viewingPrivateKey: HexString
  }
  private proofProvider?: ProofProvider

  constructor(config: SIPConfig) {
    // Validate config
    if (!config || typeof config !== 'object') {
      throw new ValidationError('config must be an object')
    }

    if (config.network !== 'mainnet' && config.network !== 'testnet') {
      throw new ValidationError(
        `network must be 'mainnet' or 'testnet'`,
        'config.network',
        { received: config.network }
      )
    }

    if (config.defaultPrivacy !== undefined) {
      const validLevels = ['transparent', 'shielded', 'compliant']
      if (!validLevels.includes(config.defaultPrivacy)) {
        throw new ValidationError(
          `defaultPrivacy must be one of: ${validLevels.join(', ')}`,
          'config.defaultPrivacy',
          { received: config.defaultPrivacy }
        )
      }
    }

    this.config = {
      ...config,
      defaultPrivacy: config.defaultPrivacy ?? PrivacyLevel.SHIELDED,
    }
    this.proofProvider = config.proofProvider
  }

  /**
   * Get the configured proof provider
   */
  getProofProvider(): ProofProvider | undefined {
    return this.proofProvider
  }

  /**
   * Set or update the proof provider
   */
  setProofProvider(provider: ProofProvider): void {
    this.proofProvider = provider
  }

  /**
   * Check if proof provider is available and ready
   */
  hasProofProvider(): boolean {
    return !!(this.proofProvider && this.proofProvider.isReady)
  }

  /**
   * Connect a wallet
   */
  connect(wallet: WalletAdapter): void {
    this.wallet = wallet
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.wallet = undefined
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.wallet
  }

  /**
   * Get connected wallet
   */
  getWallet(): WalletAdapter | undefined {
    return this.wallet
  }

  /**
   * Generate and store stealth keys for this session
   *
   * @throws {ValidationError} If chain is invalid
   */
  generateStealthKeys(chain: ChainId, label?: string): StealthMetaAddress {
    // Validation delegated to generateStealthMetaAddress
    const keys = generateStealthMetaAddress(chain, label)
    this.stealthKeys = keys
    return keys.metaAddress
  }

  /**
   * Get the encoded stealth meta-address for receiving
   */
  getStealthAddress(): string | undefined {
    if (!this.stealthKeys) return undefined
    return encodeStealthMetaAddress(this.stealthKeys.metaAddress)
  }

  /**
   * Create a new intent builder
   *
   * The builder is automatically configured with the SIP client's proof provider
   * (if one is set), so proofs will be generated automatically when `.build()` is called.
   *
   * @example
   * ```typescript
   * const intent = await sip.intent()
   *   .input('near', 'NEAR', 100n)
   *   .output('zcash', 'ZEC', 95n)
   *   .privacy(PrivacyLevel.SHIELDED)
   *   .build()
   * ```
   */
  intent(): IntentBuilder {
    const builder = new IntentBuilder()
    if (this.proofProvider) {
      builder.withProvider(this.proofProvider)
    }
    return builder
  }

  /**
   * Create a shielded intent directly
   *
   * Uses the SIP client's configured proof provider (if any) to generate proofs
   * automatically for SHIELDED and COMPLIANT privacy levels.
   */
  async createIntent(params: CreateIntentParams): Promise<TrackedIntent> {
    const intent = await createShieldedIntent(params, {
      senderAddress: this.wallet?.address,
      proofProvider: this.proofProvider,
    })
    return trackIntent(intent)
  }

  /**
   * Get quotes for an intent (mock implementation)
   */
  async getQuotes(intent: ShieldedIntent): Promise<Quote[]> {
    // Mock quotes for demo
    const baseAmount = intent.minOutputAmount

    return [
      {
        quoteId: `quote-${Date.now()}-1`,
        intentId: intent.intentId,
        solverId: 'solver-1',
        outputAmount: baseAmount + (baseAmount * 2n) / 100n, // +2%
        estimatedTime: 30,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: baseAmount / 200n, // 0.5%
      },
      {
        quoteId: `quote-${Date.now()}-2`,
        intentId: intent.intentId,
        solverId: 'solver-2',
        outputAmount: baseAmount + (baseAmount * 1n) / 100n, // +1%
        estimatedTime: 15,
        expiry: Math.floor(Date.now() / 1000) + 60,
        fee: baseAmount / 100n, // 1%
      },
    ]
  }

  /**
   * Execute an intent with a selected quote (mock implementation)
   */
  async execute(
    intent: TrackedIntent,
    quote: Quote,
  ): Promise<FulfillmentResult> {
    // Mock execution
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return {
      intentId: intent.intentId,
      status: IntentStatus.FULFILLED,
      outputAmount: quote.outputAmount,
      txHash: intent.privacyLevel === PrivacyLevel.TRANSPARENT ? `0x${Date.now().toString(16)}` : undefined,
      fulfilledAt: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Generate a viewing key for compliant mode
   */
  generateViewingKey(path?: string): ViewingKey {
    return generateViewingKey(path)
  }

  /**
   * Derive a child viewing key
   */
  deriveViewingKey(masterKey: ViewingKey, childPath: string): ViewingKey {
    return deriveViewingKey(masterKey, childPath)
  }

  /**
   * Get network configuration
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.config.network
  }
}

/**
 * Create a new SIP instance with default testnet config
 */
export function createSIP(network: 'mainnet' | 'testnet' = 'testnet'): SIP {
  return new SIP({ network })
}
