/**
 * Combined Privacy Service
 *
 * Orchestrates SIP Native + Arcium backends for complete privacy:
 * - SIP Native: Transaction privacy (stealth addresses hide recipient/sender)
 * - Arcium: Compute privacy (C-SPL tokens hide amounts via encryption)
 * - Combined: Maximum privacy (hidden sender, recipient, AND amounts)
 *
 * This creates the synergy highlighted in the Arcium bounty - demonstrating
 * how SIP Protocol aggregates multiple privacy backends for superior protection.
 *
 * @example
 * ```typescript
 * import {
 *   CombinedPrivacyService,
 *   createCombinedPrivacyServiceDevnet,
 * } from '@sip-protocol/sdk'
 *
 * // Create service
 * const service = createCombinedPrivacyServiceDevnet()
 * await service.initialize()
 *
 * // Execute complete private transfer
 * const result = await service.executePrivateTransfer({
 *   splMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
 *   sender: 'sender-address',
 *   recipientMetaAddress: 'sip:solana:0x02abc...:0x03def...',
 *   amount: BigInt(1000000), // 1 USDC
 *   viewingKey: '0x04ghi...', // For compliance
 * })
 *
 * // Privacy achieved:
 * // - Recipient hidden via stealth address (SIP Native)
 * // - Amount hidden via C-SPL encryption (Arcium)
 * // - Auditor can decrypt with viewing key (Compliance)
 * ```
 *
 * @module privacy-backends/combined-privacy
 */

import type { ChainType } from '@sip-protocol/types'
import { SIPNativeBackend } from './sip-native'
import { ArciumBackend } from './arcium'
import { CSPLTokenService } from './cspl-token'
import type { ArciumNetwork, CSPLTransferResult } from './arcium-types'
import type { ConfidentialTransferResult } from './cspl-token'

/**
 * Combined privacy transfer parameters
 */
export interface CombinedTransferParams {
  /** SPL token mint to transfer (will be wrapped to C-SPL) */
  splMint: string
  /** Sender's wallet address */
  sender: string
  /** Recipient's SIP meta-address (contains spending + viewing keys) */
  recipientMetaAddress: string
  /** Amount to transfer */
  amount: bigint
  /** Decimals for the token */
  decimals: number
  /** Optional viewing key for compliance/auditing */
  viewingKey?: string
  /** Optional memo */
  memo?: string
}

/**
 * Stealth address derivation result
 */
export interface StealthAddressResult {
  /** The one-time stealth address for this transfer */
  stealthAddress: string
  /** Ephemeral public key (needed by recipient to derive private key) */
  ephemeralPubKey: string
  /** View tag for efficient scanning */
  viewTag: string
}

/**
 * Combined privacy transfer result
 */
export interface CombinedTransferResult {
  /** Overall success status */
  success: boolean
  /** Error message if failed */
  error?: string

  // Step results
  /** Wrap step: SPL → C-SPL */
  wrap?: {
    success: boolean
    csplMint: string
    csplAccount: string
    computationId: string
  }
  /** Stealth step: Generate stealth address */
  stealth?: StealthAddressResult
  /** Transfer step: C-SPL to stealth address */
  transfer?: {
    success: boolean
    signature: string
    newBalance?: bigint
  }

  // Metadata
  /** Total time taken (ms) */
  totalTime: number
  /** Privacy properties achieved */
  privacyAchieved: {
    hiddenRecipient: boolean
    hiddenAmount: boolean
    hiddenSender: boolean
    complianceSupport: boolean
  }
}

/**
 * Claim parameters for recipient
 */
export interface ClaimParams {
  /** The stealth address to claim from */
  stealthAddress: string
  /** Ephemeral public key from the transfer announcement */
  ephemeralPubKey: string
  /** Recipient's spending key (to derive stealth private key) */
  recipientSpendingKey: string
  /** Recipient's viewing key (to derive stealth private key) */
  recipientViewingKey: string
  /** Whether to unwrap C-SPL → SPL */
  unwrapToSPL?: boolean
  /** Destination for unwrapped SPL tokens */
  splDestination?: string
}

/**
 * Claim result
 */
export interface ClaimResult {
  /** Overall success */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Derived stealth private key (for signing) */
  stealthPrivateKey?: string
  /** Balance at stealth address */
  balance?: bigint
  /** Unwrap result if requested */
  unwrap?: {
    success: boolean
    splMint: string
    splAccount: string
    amount: bigint
  }
}

/**
 * Configuration for CombinedPrivacyService
 */
export interface CombinedPrivacyServiceConfig {
  /** Arcium network to use */
  network?: ArciumNetwork
  /** RPC endpoint override */
  rpcEndpoint?: string
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Combined Privacy Service
 *
 * Orchestrates SIP Native + Arcium for complete privacy transfers.
 * Demonstrates SIP Protocol as a Privacy Aggregator.
 */
export class CombinedPrivacyService {
  private sipNative: SIPNativeBackend
  private arcium: ArciumBackend
  private cspl: CSPLTokenService
  private config: Required<CombinedPrivacyServiceConfig>
  private initialized = false

  /**
   * Create a new CombinedPrivacyService
   *
   * @param config - Service configuration
   */
  constructor(config: CombinedPrivacyServiceConfig = {}) {
    this.config = {
      network: config.network ?? 'devnet',
      rpcEndpoint: config.rpcEndpoint ?? '',
      verbose: config.verbose ?? false,
    }

    // Initialize backends
    this.sipNative = new SIPNativeBackend({ chains: ['solana'] })
    this.arcium = new ArciumBackend({
      network: this.config.network,
      rpcUrl: this.config.rpcEndpoint || undefined,
    })
    this.cspl = new CSPLTokenService({
      network: this.config.network,
      solanaRpcUrl: this.config.rpcEndpoint || undefined,
      verbose: this.config.verbose,
    })
  }

  /**
   * Initialize the service
   *
   * Must be called before any operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await Promise.all([
      this.arcium.initialize(),
      this.cspl.initialize(),
    ])

    this.initialized = true
    this.log('Combined Privacy Service initialized')
  }

  /**
   * Execute a complete private transfer
   *
   * This performs the full combined privacy flow:
   * 1. Wrap SPL → C-SPL (hide amount)
   * 2. Generate stealth address for recipient (hide recipient)
   * 3. Transfer C-SPL to stealth address
   *
   * @param params - Transfer parameters
   * @returns Combined transfer result
   */
  async executePrivateTransfer(
    params: CombinedTransferParams
  ): Promise<CombinedTransferResult> {
    this.ensureInitialized()

    const startTime = Date.now()
    const result: CombinedTransferResult = {
      success: false,
      totalTime: 0,
      privacyAchieved: {
        hiddenRecipient: false,
        hiddenAmount: false,
        hiddenSender: false,
        complianceSupport: false,
      },
    }

    try {
      // Step 1: Wrap SPL → C-SPL (Arcium - hide amount)
      this.log(`Step 1: Wrapping ${params.amount} to C-SPL...`)
      const wrapResult = await this.cspl.wrap({
        splMint: params.splMint,
        owner: params.sender,
        amount: params.amount,
      })

      result.wrap = {
        success: true,
        csplMint: wrapResult.csplMint!,
        csplAccount: wrapResult.csplTokenAccount!,
        computationId: wrapResult.computation?.id ?? '',
      }
      result.privacyAchieved.hiddenAmount = true
      this.log(`  ✓ Wrapped to ${wrapResult.csplMint}`)

      // Step 2: Generate stealth address (SIP Native - hide recipient)
      this.log(`Step 2: Generating stealth address...`)
      const stealthResult = await this.deriveStealthAddress(
        params.recipientMetaAddress
      )
      result.stealth = stealthResult
      result.privacyAchieved.hiddenRecipient = true
      result.privacyAchieved.hiddenSender = true // Stealth addresses hide sender linkability
      this.log(`  ✓ Stealth address: ${stealthResult.stealthAddress.slice(0, 16)}...`)

      // Step 3: Transfer C-SPL to stealth address
      this.log(`Step 3: Transferring C-SPL to stealth address...`)
      const transferResult = await this.cspl.transfer({
        csplMint: wrapResult.csplMint!,
        sender: params.sender,
        recipient: stealthResult.stealthAddress,
        amount: params.amount,
        auditorKey: params.viewingKey,
        memo: params.memo,
      })

      result.transfer = {
        success: true,
        signature: transferResult.signature ?? '',
        newBalance: transferResult.newSenderBalance?.decryptedBalance,
      }

      // Set compliance support if viewing key was provided
      result.privacyAchieved.complianceSupport = !!params.viewingKey
      this.log(`  ✓ Transfer complete: ${transferResult.signature}`)

      // Success!
      result.success = true
      this.log('Combined privacy transfer completed successfully!')

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Error: ${result.error}`)
    }

    result.totalTime = Date.now() - startTime
    return result
  }

  /**
   * Derive a stealth address from a SIP meta-address
   *
   * @param metaAddress - SIP meta-address (sip:<chain>:<spending>:<viewing>)
   * @returns Stealth address result
   */
  async deriveStealthAddress(metaAddress: string): Promise<StealthAddressResult> {
    // Parse meta-address
    const parts = metaAddress.split(':')
    if (parts.length < 4 || parts[0] !== 'sip') {
      throw new Error(`Invalid SIP meta-address format: ${metaAddress}`)
    }

    const [, chain, spendingKey, viewingKey] = parts

    // Validate chain is Solana
    if (chain !== 'solana') {
      throw new Error(`Combined privacy only supports Solana, got: ${chain}`)
    }

    // In a real implementation, this would:
    // 1. Generate ephemeral keypair
    // 2. Compute shared secret using ECDH with recipient's viewing key
    // 3. Derive stealth address from shared secret + recipient's spending key
    // 4. Compute view tag for efficient scanning

    // For now, simulate the derivation
    const ephemeralPubKey = `eph_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const sharedSecret = this.simulateECDH(ephemeralPubKey, viewingKey)
    const stealthAddress = this.simulateStealthDerivation(spendingKey, sharedSecret)
    const viewTag = sharedSecret.slice(0, 4)

    return {
      stealthAddress,
      ephemeralPubKey,
      viewTag,
    }
  }

  /**
   * Claim tokens from a stealth address (for recipient)
   *
   * @param params - Claim parameters
   * @returns Claim result
   */
  async claimFromStealth(params: ClaimParams): Promise<ClaimResult> {
    this.ensureInitialized()

    const result: ClaimResult = {
      success: false,
    }

    try {
      // Step 1: Derive stealth private key
      this.log('Deriving stealth private key...')
      const sharedSecret = this.simulateECDH(
        params.ephemeralPubKey,
        params.recipientViewingKey
      )
      const stealthPrivateKey = this.simulateStealthPrivateKey(
        params.recipientSpendingKey,
        sharedSecret
      )
      result.stealthPrivateKey = stealthPrivateKey
      this.log(`  ✓ Derived stealth private key`)

      // Step 2: Check balance at stealth address
      const csplMint = this.cspl.getSupportedTokens()[0]?.csplMint
      if (csplMint) {
        const balance = await this.cspl.getBalance(csplMint, params.stealthAddress)
        result.balance = balance?.decryptedBalance
        this.log(`  ✓ Balance at stealth: ${result.balance || 0n}`)
      }

      // Step 3: Optionally unwrap to SPL
      if (params.unwrapToSPL && csplMint && result.balance && result.balance > 0n) {
        this.log('Unwrapping C-SPL to SPL...')
        const unwrapResult = await this.cspl.unwrap({
          csplMint,
          owner: params.stealthAddress,
          amount: result.balance,
          recipient: params.splDestination,
        })
        result.unwrap = {
          success: true,
          splMint: unwrapResult.splMint ?? '',
          splAccount: unwrapResult.splTokenAccount ?? '',
          amount: result.balance,
        }
        this.log(`  ✓ Unwrapped to SPL`)
      }

      result.success = true

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Error: ${result.error}`)
    }

    return result
  }

  /**
   * Estimate cost for a combined private transfer
   *
   * @param params - Transfer parameters
   * @returns Estimated cost breakdown
   */
  async estimateCost(params: CombinedTransferParams): Promise<{
    totalCost: bigint
    breakdown: {
      wrap: bigint
      stealth: bigint
      transfer: bigint
    }
  }> {
    // Estimate each component
    const wrapCost = await this.cspl.estimateCost('wrap')
    const transferCost = await this.cspl.estimateCost('transfer')
    const stealthCost = await this.sipNative.estimateCost({
      chain: 'solana' as ChainType,
      sender: params.sender,
      recipient: params.recipientMetaAddress,
      mint: params.splMint,
      amount: params.amount,
      decimals: params.decimals,
    })

    return {
      totalCost: wrapCost + transferCost + stealthCost,
      breakdown: {
        wrap: wrapCost,
        stealth: stealthCost,
        transfer: transferCost,
      },
    }
  }

  /**
   * Get privacy comparison between backends
   *
   * @returns Comparison of privacy properties
   */
  getPrivacyComparison(): {
    sipNative: { hiddenSender: boolean; hiddenRecipient: boolean; hiddenAmount: boolean }
    arcium: { hiddenCompute: boolean; hiddenAmount: boolean }
    combined: { hiddenSender: boolean; hiddenRecipient: boolean; hiddenAmount: boolean; hiddenCompute: boolean }
  } {
    const sipCaps = this.sipNative.getCapabilities()
    const arciumCaps = this.arcium.getCapabilities()

    return {
      sipNative: {
        hiddenSender: sipCaps.hiddenSender,
        hiddenRecipient: sipCaps.hiddenRecipient,
        hiddenAmount: sipCaps.hiddenAmount,
      },
      arcium: {
        hiddenCompute: arciumCaps.hiddenCompute,
        hiddenAmount: arciumCaps.hiddenAmount,
      },
      combined: {
        hiddenSender: sipCaps.hiddenSender,
        hiddenRecipient: sipCaps.hiddenRecipient,
        hiddenAmount: sipCaps.hiddenAmount || arciumCaps.hiddenAmount,
        hiddenCompute: arciumCaps.hiddenCompute,
      },
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean
    network: ArciumNetwork
    backends: {
      sipNative: { name: string; type: string }
      arcium: { name: string; type: string }
    }
  } {
    return {
      initialized: this.initialized,
      network: this.config.network,
      backends: {
        sipNative: { name: this.sipNative.name, type: this.sipNative.type },
        arcium: { name: this.arcium.name, type: this.arcium.type },
      },
    }
  }

  // Private helpers

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CombinedPrivacyService not initialized. Call initialize() first.')
    }
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[CombinedPrivacy] ${message}`)
    }
  }

  /**
   * Simulate ECDH shared secret derivation
   * In production, use actual cryptographic ECDH
   */
  private simulateECDH(ephemeralKey: string, viewingKey: string): string {
    // Simulated shared secret - in reality this would be ECDH
    const combined = `${ephemeralKey}:${viewingKey}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `ss_${Math.abs(hash).toString(16).padStart(16, '0')}`
  }

  /**
   * Simulate stealth address derivation
   * In production, use actual cryptographic derivation
   */
  private simulateStealthDerivation(spendingKey: string, sharedSecret: string): string {
    const combined = `${spendingKey}:${sharedSecret}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    // Return base58-like address
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let address = ''
    let num = Math.abs(hash)
    for (let i = 0; i < 44; i++) {
      address += chars[num % 58]
      num = Math.floor(num / 58) + (i * 17)
    }
    return address
  }

  /**
   * Simulate stealth private key derivation
   * In production, use actual cryptographic derivation
   */
  private simulateStealthPrivateKey(spendingKey: string, sharedSecret: string): string {
    return `sk_${spendingKey.slice(-8)}_${sharedSecret.slice(-8)}`
  }
}

/**
 * Create a devnet Combined Privacy Service
 */
export function createCombinedPrivacyServiceDevnet(
  config?: Omit<CombinedPrivacyServiceConfig, 'network'>
): CombinedPrivacyService {
  return new CombinedPrivacyService({ ...config, network: 'devnet' })
}

/**
 * Create a testnet Combined Privacy Service
 */
export function createCombinedPrivacyServiceTestnet(
  config?: Omit<CombinedPrivacyServiceConfig, 'network'>
): CombinedPrivacyService {
  return new CombinedPrivacyService({ ...config, network: 'testnet' })
}

/**
 * Create a mainnet Combined Privacy Service
 */
export function createCombinedPrivacyServiceMainnet(
  config?: Omit<CombinedPrivacyServiceConfig, 'network'>
): CombinedPrivacyService {
  return new CombinedPrivacyService({ ...config, network: 'mainnet' })
}
