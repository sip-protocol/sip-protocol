/**
 * Direct Chain Settlement Backend
 *
 * Handles same-chain transfers with privacy via stealth addresses.
 * Only works when fromChain === toChain (no cross-chain).
 *
 * Use cases:
 * - ETH→ETH (same chain private transfer)
 * - SOL→SOL
 * - NEAR→NEAR
 * - Any single-chain transfer with privacy
 *
 * @module settlement/backends/direct-chain
 */

import type {
  ChainId,
  HexString,
  StealthMetaAddress,
  WalletAdapter,
} from '@sip-protocol/types'
import { PrivacyLevel } from '@sip-protocol/types'
import {
  type SettlementBackend,
  type QuoteParams,
  type Quote,
  type SwapParams,
  type SwapResult,
  type SwapStatusResponse,
  type BackendCapabilities,
  SwapStatus,
} from '../interface'
import {
  generateStealthAddress,
  generateEd25519StealthAddress,
  decodeStealthMetaAddress,
  publicKeyToEthAddress,
  ed25519PublicKeyToSolanaAddress,
  ed25519PublicKeyToNearAddress,
  isEd25519Chain,
} from '../../stealth'
import { ed25519PublicKeyToAptosAddress } from '../../move/aptos'
import { ed25519PublicKeyToSuiAddress } from '../../move/sui'
import { ValidationError } from '../../errors'
import { randomBytes, bytesToHex } from '@noble/hashes/utils'

/**
 * Configuration for DirectChainBackend
 */
export interface DirectChainBackendConfig {
  /**
   * Wallet adapter for signing and sending transactions
   * If not provided, backend will only generate quotes
   */
  walletAdapter?: WalletAdapter

  /**
   * Estimated gas fees per chain (in native token smallest units)
   * Used for quote generation
   */
  gasFees?: Partial<Record<ChainId, bigint>>

  /**
   * Protocol fee in basis points (100 = 1%)
   * Default: 0 (no protocol fee for direct transfers)
   */
  protocolFeeBps?: number
}

/**
 * Swap tracking data
 */
interface SwapData {
  quoteId: string
  swapId: string
  fromChain: ChainId
  toChain: ChainId
  fromToken: string
  toToken: string
  amountIn: string
  amountOut: string
  minAmountOut: string
  recipientAddress: string
  depositAddress: string
  refundAddress?: string
  privacyLevel: PrivacyLevel
  stealthAddress?: {
    address: HexString
    ephemeralPublicKey: HexString
    viewTag: number
  }
  status: SwapStatus
  depositTxHash?: string
  settlementTxHash?: string
  errorMessage?: string
  createdAt: number
  updatedAt: number
}

/**
 * Default gas fees for supported chains (in smallest units)
 */
const DEFAULT_GAS_FEES: Record<ChainId, bigint> = {
  ethereum: 21000n * 50n * 1000000000n, // 21k gas * 50 gwei = 0.00105 ETH
  solana: 5000n, // 5000 lamports = 0.000005 SOL
  near: 300000000000000000000n, // 0.3 NEAR in yoctoNEAR
  zcash: 10000n, // 0.0001 ZEC in zatoshi
  polygon: 21000n * 30n * 1000000000n, // 21k gas * 30 gwei POL
  arbitrum: 2100000000n, // 21k gas * 0.1 gwei ETH = 2100 gwei = 2.1e9 wei
  optimism: 21000000n, // 21k gas * 0.001 gwei ETH = 21 gwei = 21e6 wei
  base: 2100000000n, // 21k gas * 0.1 gwei ETH = 2100 gwei = 2.1e9 wei
  bitcoin: 10000n, // 10000 sats = 0.0001 BTC (estimate for 1 input, 2 outputs)
  aptos: 100n, // 0.000001 APT in octas (gas units)
  sui: 1000n, // 0.000001 SUI in MIST
  cosmos: 5000n, // 0.005 ATOM in uatom
  osmosis: 5000n, // 0.005 OSMO in uosmo
  injective: 5000n, // 0.000005 INJ in inj (18 decimals)
  celestia: 5000n, // 0.005 TIA in utia
  sei: 5000n, // 0.005 SEI in usei
  dydx: 5000n, // 0.000005 DYDX in dydx (18 decimals)
}

/**
 * Direct Chain Settlement Backend
 *
 * Implements single-chain transfers with privacy via stealth addresses.
 * Only supports same-chain transfers (fromChain === toChain).
 *
 * @example
 * ```typescript
 * const backend = new DirectChainBackend({
 *   walletAdapter: myEthereumWallet,
 * })
 *
 * // Get quote for ETH→ETH transfer
 * const quote = await backend.getQuote({
 *   fromChain: 'ethereum',
 *   toChain: 'ethereum',
 *   fromToken: 'ETH',
 *   toToken: 'ETH',
 *   amount: 1000000000000000000n, // 1 ETH
 *   privacyLevel: 'shielded',
 *   recipientMetaAddress: 'sip:ethereum:0x...:0x...',
 * })
 *
 * // Execute swap
 * const result = await backend.executeSwap({
 *   quoteId: quote.quoteId,
 * })
 * ```
 */
export class DirectChainBackend implements SettlementBackend {
  readonly name = 'direct-chain' as const

  readonly capabilities: BackendCapabilities = {
    supportedSourceChains: [
      'ethereum',
      'solana',
      'near',
      'zcash',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'bitcoin',
      'aptos',
      'sui',
    ],
    supportedDestinationChains: [
      'ethereum',
      'solana',
      'near',
      'zcash',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'bitcoin',
      'aptos',
      'sui',
    ],
    supportedPrivacyLevels: [
      PrivacyLevel.TRANSPARENT,
      PrivacyLevel.SHIELDED,
      PrivacyLevel.COMPLIANT,
    ],
    supportsCancellation: false,
    supportsRefunds: true,
    averageExecutionTime: 30, // 30 seconds for same-chain transfers
    features: [
      'same-chain-only',
      'stealth-addresses',
      'minimal-fees',
      'instant-settlement',
    ],
  }

  private walletAdapter?: WalletAdapter
  private gasFees: Record<ChainId, bigint>
  private protocolFeeBps: number
  private swaps: Map<string, SwapData> = new Map()

  constructor(config: DirectChainBackendConfig = {}) {
    this.walletAdapter = config.walletAdapter
    this.gasFees = { ...DEFAULT_GAS_FEES, ...config.gasFees }
    this.protocolFeeBps = config.protocolFeeBps ?? 0
  }

  /**
   * Get a quote for a same-chain transfer
   *
   * @throws {ValidationError} If chains don't match or parameters are invalid
   */
  async getQuote(params: QuoteParams): Promise<Quote> {
    // Validate same-chain requirement
    if (params.fromChain !== params.toChain) {
      throw new ValidationError(
        `DirectChainBackend only supports same-chain transfers. Got fromChain=${params.fromChain}, toChain=${params.toChain}. ` +
        `For cross-chain swaps, use NEARIntentsBackend or another cross-chain settlement backend.`,
        'toChain',
        {
          fromChain: params.fromChain,
          toChain: params.toChain,
          hint: 'Use NEARIntentsBackend for cross-chain swaps',
        }
      )
    }

    // Validate chains are supported
    if (!this.capabilities.supportedSourceChains.includes(params.fromChain)) {
      throw new ValidationError(
        `Chain ${params.fromChain} is not supported by DirectChainBackend`,
        'fromChain',
        { chain: params.fromChain }
      )
    }

    // Validate privacy level is supported
    if (!this.capabilities.supportedPrivacyLevels.includes(params.privacyLevel)) {
      throw new ValidationError(
        `Privacy level ${params.privacyLevel} is not supported`,
        'privacyLevel',
        { privacyLevel: params.privacyLevel }
      )
    }

    // For same-chain transfer, amount out = amount in (minus fees)
    const chain = params.fromChain
    const gasFee = this.gasFees[chain]
    const protocolFee = (params.amount * BigInt(this.protocolFeeBps)) / 10000n
    const totalFees = gasFee + protocolFee
    const amountOut = params.amount - totalFees

    if (amountOut <= 0n) {
      throw new ValidationError(
        `Amount too small to cover fees. Amount: ${params.amount}, fees: ${totalFees}`,
        'amount',
        { amount: params.amount.toString(), fees: totalFees.toString() }
      )
    }

    // Generate stealth address for privacy modes
    let recipientAddress: string
    let stealthData: SwapData['stealthAddress']

    if (params.privacyLevel === PrivacyLevel.TRANSPARENT) {
      // Transparent mode: use sender address as recipient
      if (!params.senderAddress) {
        throw new ValidationError(
          'senderAddress is required for transparent mode',
          'senderAddress'
        )
      }
      recipientAddress = params.senderAddress
    } else {
      // Shielded/compliant mode: generate stealth address
      if (!params.recipientMetaAddress) {
        throw new ValidationError(
          'recipientMetaAddress is required for shielded/compliant modes',
          'recipientMetaAddress'
        )
      }

      const metaAddr = typeof params.recipientMetaAddress === 'string'
        ? decodeStealthMetaAddress(params.recipientMetaAddress)
        : params.recipientMetaAddress

      if (isEd25519Chain(chain)) {
        // Ed25519 chains (Solana, NEAR, Aptos, Sui)
        const { stealthAddress } = generateEd25519StealthAddress(metaAddr)
        stealthData = stealthAddress

        if (chain === 'solana') {
          recipientAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
        } else if (chain === 'near') {
          recipientAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
        } else if (chain === 'aptos') {
          recipientAddress = ed25519PublicKeyToAptosAddress(stealthAddress.address)
        } else if (chain === 'sui') {
          recipientAddress = ed25519PublicKeyToSuiAddress(stealthAddress.address)
        } else {
          // This should not happen if ED25519_CHAINS is kept in sync
          throw new ValidationError(
            `Ed25519 address derivation not implemented for ${chain}. Please add support in direct-chain.ts.`,
            'toChain',
            { chain, hint: 'Add address derivation function for this chain' }
          )
        }
      } else {
        // Secp256k1 chains (EVM)
        const { stealthAddress } = generateStealthAddress(metaAddr)
        stealthData = stealthAddress
        recipientAddress = publicKeyToEthAddress(stealthAddress.address)
      }
    }

    // Generate unique IDs
    const quoteId = `quote-${bytesToHex(randomBytes(16))}`
    const swapId = `swap-${bytesToHex(randomBytes(16))}`
    const depositAddress = params.senderAddress ?? recipientAddress

    // Calculate slippage (0 for same-chain, but respect user setting)
    const slippageBps = params.slippageTolerance ?? 0
    const slippageAmount = (amountOut * BigInt(slippageBps)) / 10000n
    const minAmountOut = amountOut - slippageAmount

    // Calculate expiry
    const expiresAt = params.deadline ?? Math.floor(Date.now() / 1000) + 3600 // 1 hour default

    // Store swap data
    const swapData: SwapData = {
      quoteId,
      swapId,
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amountIn: params.amount.toString(),
      amountOut: amountOut.toString(),
      minAmountOut: minAmountOut.toString(),
      recipientAddress,
      depositAddress,
      refundAddress: params.senderAddress,
      privacyLevel: params.privacyLevel,
      stealthAddress: stealthData,
      status: SwapStatus.PENDING_DEPOSIT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.swaps.set(quoteId, swapData)
    this.swaps.set(swapId, swapData) // Also index by swapId

    return {
      quoteId,
      amountIn: params.amount.toString(),
      amountOut: amountOut.toString(),
      minAmountOut: minAmountOut.toString(),
      priceImpact: 0, // No price impact for same-chain
      fees: {
        networkFee: gasFee.toString(),
        protocolFee: protocolFee.toString(),
      },
      depositAddress,
      recipientAddress,
      refundAddress: params.senderAddress,
      expiresAt,
      estimatedTime: 30, // 30 seconds
      route: {
        steps: [
          {
            protocol: 'direct-chain',
            tokenIn: {
              chain: params.fromChain,
              symbol: params.fromToken,
              address: '0x0000000000000000000000000000000000000000' as HexString, // Native token
              decimals: 18, // Default decimals
            },
            tokenOut: {
              chain: params.toChain,
              symbol: params.toToken,
              address: '0x0000000000000000000000000000000000000000' as HexString, // Native token
              decimals: 18, // Default decimals
            },
          },
        ],
        hops: 1,
      },
      metadata: {
        backend: 'direct-chain',
        swapId,
        privacyLevel: params.privacyLevel,
        stealthAddress: stealthData,
      },
    }
  }

  /**
   * Execute a same-chain swap
   *
   * @throws {ValidationError} If quote is invalid or wallet adapter not configured
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const swapData = this.swaps.get(params.quoteId)

    if (!swapData) {
      throw new ValidationError(
        `Quote not found: ${params.quoteId}`,
        'quoteId',
        { quoteId: params.quoteId }
      )
    }

    if (!this.walletAdapter) {
      throw new ValidationError(
        'Wallet adapter not configured. Cannot execute swap without wallet.',
        'walletAdapter',
        { hint: 'Provide a wallet adapter in DirectChainBackend constructor' }
      )
    }

    // Validate wallet is connected
    if (!this.walletAdapter.isConnected()) {
      throw new ValidationError(
        'Wallet not connected',
        'walletAdapter',
        { hint: 'Connect wallet before executing swap' }
      )
    }

    // Validate wallet chain matches swap chain
    if (this.walletAdapter.chain !== swapData.fromChain) {
      throw new ValidationError(
        `Wallet chain mismatch. Expected ${swapData.fromChain}, got ${this.walletAdapter.chain}`,
        'walletAdapter',
        {
          expectedChain: swapData.fromChain,
          actualChain: this.walletAdapter.chain,
        }
      )
    }

    // Update status to in progress
    swapData.status = SwapStatus.IN_PROGRESS
    swapData.updatedAt = Date.now()

    try {
      // Build transaction
      const tx = {
        chain: swapData.fromChain,
        data: {
          to: swapData.recipientAddress,
          value: swapData.amountOut, // Keep as string for serialization
          stealthMetadata: swapData.privacyLevel !== PrivacyLevel.TRANSPARENT
            ? swapData.stealthAddress
            : undefined,
        },
      }

      // Sign and send transaction
      const receipt = await this.walletAdapter.signAndSendTransaction(tx)

      // Update swap data
      swapData.status = SwapStatus.SUCCESS
      swapData.depositTxHash = receipt.txHash
      swapData.settlementTxHash = receipt.txHash
      swapData.updatedAt = Date.now()

      return {
        swapId: swapData.swapId,
        status: SwapStatus.SUCCESS,
        quoteId: params.quoteId,
        depositAddress: swapData.depositAddress,
        depositTxHash: receipt.txHash,
        settlementTxHash: receipt.txHash,
        actualAmountOut: swapData.amountOut,
        metadata: {
          stealthAddress: swapData.stealthAddress,
          privacyLevel: swapData.privacyLevel,
        },
      }
    } catch (error) {
      // Update status to failed
      swapData.status = SwapStatus.FAILED
      swapData.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      swapData.updatedAt = Date.now()

      return {
        swapId: swapData.swapId,
        status: SwapStatus.FAILED,
        quoteId: params.quoteId,
        depositAddress: swapData.depositAddress,
        errorMessage: swapData.errorMessage,
        metadata: {
          stealthAddress: swapData.stealthAddress,
          privacyLevel: swapData.privacyLevel,
        },
      }
    }
  }

  /**
   * Get current swap status
   *
   * @throws {ValidationError} If swap ID is invalid
   */
  async getStatus(swapId: string): Promise<SwapStatusResponse> {
    const swapData = this.swaps.get(swapId)

    if (!swapData) {
      throw new ValidationError(
        `Swap not found: ${swapId}`,
        'swapId',
        { swapId }
      )
    }

    return {
      swapId: swapData.swapId,
      status: swapData.status,
      quoteId: swapData.quoteId,
      depositAddress: swapData.depositAddress,
      amountIn: swapData.amountIn,
      amountOut: swapData.amountOut,
      depositTxHash: swapData.depositTxHash,
      settlementTxHash: swapData.settlementTxHash,
      actualAmountOut: swapData.status === SwapStatus.SUCCESS ? swapData.amountOut : undefined,
      errorMessage: swapData.errorMessage,
      stealthRecipient: swapData.stealthAddress?.address,
      ephemeralPublicKey: swapData.stealthAddress?.ephemeralPublicKey,
      updatedAt: swapData.updatedAt,
      metadata: {
        fromChain: swapData.fromChain,
        toChain: swapData.toChain,
        fromToken: swapData.fromToken,
        toToken: swapData.toToken,
        privacyLevel: swapData.privacyLevel,
      },
    }
  }

  /**
   * Get dry quote (preview without creating swap)
   *
   * This returns the same as getQuote but doesn't store swap data.
   */
  async getDryQuote(params: QuoteParams): Promise<Quote> {
    const quote = await this.getQuote(params)

    // Remove from storage (it was just added by getQuote)
    this.swaps.delete(quote.quoteId)
    if (quote.metadata?.swapId) {
      this.swaps.delete(quote.metadata.swapId as string)
    }

    return quote
  }

  /**
   * Set wallet adapter (for updating wallet connection)
   */
  setWalletAdapter(adapter: WalletAdapter): void {
    this.walletAdapter = adapter
  }

  /**
   * Get current wallet adapter
   */
  getWalletAdapter(): WalletAdapter | undefined {
    return this.walletAdapter
  }

  /**
   * Clear all swap data (for testing)
   */
  clearSwaps(): void {
    this.swaps.clear()
  }
}

/**
 * Create a DirectChainBackend instance
 */
export function createDirectChainBackend(
  config?: DirectChainBackendConfig
): DirectChainBackend {
  return new DirectChainBackend(config)
}
