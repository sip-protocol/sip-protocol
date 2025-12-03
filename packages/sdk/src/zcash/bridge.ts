/**
 * Zcash Bridge Module
 *
 * Bridges source chain tokens (ETH, SOL, etc.) to ZEC and optionally
 * shields them to z-addresses in a single operation.
 *
 * @example
 * ```typescript
 * const bridge = new ZcashBridge({
 *   zcashService: zcashShieldedService,
 *   mode: 'demo',
 * })
 *
 * // Get supported routes
 * const routes = bridge.getSupportedRoutes()
 *
 * // Bridge ETH to shielded ZEC
 * const result = await bridge.bridgeToShielded({
 *   sourceChain: 'ethereum',
 *   sourceToken: 'ETH',
 *   amount: 1000000000000000000n, // 1 ETH
 *   recipientZAddress: 'zs1...',
 * })
 * ```
 */

import { ValidationError, IntentError, ErrorCode } from '../errors'
import type { ZcashShieldedService } from './shielded-service'
import type {
  ZcashSwapSourceChain,
  ZcashSwapSourceToken,
  BridgeProvider,
  PriceFeed,
} from './swap-service'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Bridge route definition
 */
export interface BridgeRoute {
  /** Source chain identifier */
  sourceChain: ZcashSwapSourceChain
  /** Source token symbol */
  sourceToken: ZcashSwapSourceToken
  /** Whether route is currently active */
  active: boolean
  /** Minimum amount in smallest unit */
  minAmount: bigint
  /** Maximum amount in smallest unit */
  maxAmount: bigint
  /** Estimated time in seconds */
  estimatedTime: number
  /** Fee percentage (basis points) */
  feeBps: number
}

/**
 * Bridge parameters for bridging to shielded ZEC
 */
export interface BridgeParams {
  /** Source blockchain */
  sourceChain: ZcashSwapSourceChain
  /** Source token symbol */
  sourceToken: ZcashSwapSourceToken
  /** Amount in smallest unit (wei, lamports, etc.) */
  amount: bigint
  /** Recipient z-address (shielded) or t-address (transparent) */
  recipientAddress: string
  /** Whether to shield after bridging (default: true) */
  shield?: boolean
  /** Optional memo for shielded transaction */
  memo?: string
  /** Sender's source chain address (for tracking) */
  senderAddress?: string
  /** Custom slippage tolerance (basis points) */
  slippage?: number
}

/**
 * Bridge result
 */
export interface BridgeResult {
  /** Unique bridge request ID */
  requestId: string
  /** Current status */
  status: BridgeStatus
  /** Source chain transaction hash */
  sourceTxHash?: string
  /** Intermediate transparent address (if shielding) */
  transparentAddress?: string
  /** Transparent receive transaction (if shielding) */
  transparentTxHash?: string
  /** Final shielded transaction ID */
  shieldedTxId?: string
  /** Amount received in ZEC (zatoshis) */
  amountReceived?: bigint
  /** Amount received in ZEC formatted */
  amountReceivedFormatted?: string
  /** Recipient address */
  recipientAddress: string
  /** Total fee paid (zatoshis) */
  totalFee: bigint
  /** Timestamp of request */
  timestamp: number
  /** Error message if failed */
  error?: string
}

/**
 * Bridge status
 */
export type BridgeStatus =
  | 'pending'             // Waiting to start
  | 'bridging'            // Cross-chain bridge in progress
  | 'bridge_confirmed'    // Bridge complete, ZEC received at t-addr
  | 'shielding'           // Shielding transparent ZEC
  | 'completed'           // All done
  | 'failed'              // Bridge failed

/**
 * Bridge configuration
 */
export interface ZcashBridgeConfig {
  /** Zcash shielded service (required for shielding) */
  zcashService?: ZcashShieldedService
  /** Operating mode */
  mode: 'demo' | 'production'
  /** External bridge provider for production */
  bridgeProvider?: BridgeProvider
  /** Price feed for conversions */
  priceFeed?: PriceFeed
  /** Default slippage (basis points, default: 100 = 1%) */
  defaultSlippage?: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Token decimals by symbol
 */
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  SOL: 9,
  NEAR: 24,
  MATIC: 18,
  USDC: 6,
  USDT: 6,
  ZEC: 8,
}

/**
 * Mock prices for demo mode (USD)
 */
const MOCK_PRICES: Record<string, number> = {
  ETH: 2500,
  SOL: 120,
  NEAR: 5,
  MATIC: 0.8,
  USDC: 1,
  USDT: 1,
  ZEC: 35,
}

/**
 * Route configurations
 */
const ROUTE_CONFIG: Record<string, { minUsd: number; maxUsd: number; feeBps: number; time: number }> = {
  'ethereum:ETH': { minUsd: 10, maxUsd: 100000, feeBps: 50, time: 900 },
  'ethereum:USDC': { minUsd: 10, maxUsd: 100000, feeBps: 30, time: 900 },
  'ethereum:USDT': { minUsd: 10, maxUsd: 100000, feeBps: 30, time: 900 },
  'solana:SOL': { minUsd: 10, maxUsd: 50000, feeBps: 50, time: 300 },
  'solana:USDC': { minUsd: 10, maxUsd: 50000, feeBps: 30, time: 300 },
  'solana:USDT': { minUsd: 10, maxUsd: 50000, feeBps: 30, time: 300 },
  'near:NEAR': { minUsd: 10, maxUsd: 25000, feeBps: 50, time: 300 },
  'near:USDC': { minUsd: 10, maxUsd: 25000, feeBps: 30, time: 300 },
  'polygon:MATIC': { minUsd: 10, maxUsd: 50000, feeBps: 50, time: 600 },
  'polygon:USDC': { minUsd: 10, maxUsd: 50000, feeBps: 30, time: 600 },
  'arbitrum:ETH': { minUsd: 10, maxUsd: 100000, feeBps: 50, time: 600 },
  'arbitrum:USDC': { minUsd: 10, maxUsd: 100000, feeBps: 30, time: 600 },
  'base:ETH': { minUsd: 10, maxUsd: 50000, feeBps: 50, time: 600 },
  'base:USDC': { minUsd: 10, maxUsd: 50000, feeBps: 30, time: 600 },
}

// ─── Bridge Implementation ─────────────────────────────────────────────────────

/**
 * Zcash Bridge
 *
 * Bridges tokens from Ethereum, Solana, and other chains to Zcash,
 * with optional shielding to z-addresses.
 */
export class ZcashBridge {
  private readonly config: Required<Omit<ZcashBridgeConfig, 'zcashService' | 'bridgeProvider' | 'priceFeed'>>
  private readonly zcashService?: ZcashShieldedService
  private readonly bridgeProvider?: BridgeProvider
  private readonly priceFeed?: PriceFeed
  private readonly bridgeRequests: Map<string, BridgeResult> = new Map()

  constructor(config: ZcashBridgeConfig) {
    this.config = {
      mode: config.mode,
      defaultSlippage: config.defaultSlippage ?? 100,
    }
    this.zcashService = config.zcashService
    this.bridgeProvider = config.bridgeProvider
    this.priceFeed = config.priceFeed
  }

  // ─── Route Discovery ─────────────────────────────────────────────────────────

  /**
   * Get all supported bridge routes
   */
  getSupportedRoutes(): BridgeRoute[] {
    const routes: BridgeRoute[] = []

    for (const [key, routeConfig] of Object.entries(ROUTE_CONFIG)) {
      const [chain, token] = key.split(':') as [ZcashSwapSourceChain, ZcashSwapSourceToken]
      const decimals = TOKEN_DECIMALS[token] ?? 18
      const price = MOCK_PRICES[token] ?? 1

      // Calculate min/max in token's smallest unit
      const minAmount = BigInt(Math.floor((routeConfig.minUsd / price) * 10 ** decimals))
      const maxAmount = BigInt(Math.floor((routeConfig.maxUsd / price) * 10 ** decimals))

      routes.push({
        sourceChain: chain,
        sourceToken: token,
        active: true,
        minAmount,
        maxAmount,
        estimatedTime: routeConfig.time,
        feeBps: routeConfig.feeBps,
      })
    }

    return routes
  }

  /**
   * Get routes for a specific source chain
   */
  getRoutesForChain(chain: ZcashSwapSourceChain): BridgeRoute[] {
    return this.getSupportedRoutes().filter((r) => r.sourceChain === chain)
  }

  /**
   * Check if a specific route is supported
   */
  isRouteSupported(chain: ZcashSwapSourceChain, token: ZcashSwapSourceToken): boolean {
    const key = `${chain}:${token}`
    return key in ROUTE_CONFIG
  }

  /**
   * Get route details
   */
  getRoute(chain: ZcashSwapSourceChain, token: ZcashSwapSourceToken): BridgeRoute | null {
    const routes = this.getSupportedRoutes()
    return routes.find((r) => r.sourceChain === chain && r.sourceToken === token) ?? null
  }

  // ─── Bridge Operations ───────────────────────────────────────────────────────

  /**
   * Bridge tokens to shielded ZEC
   *
   * This is the main entry point for bridging. It:
   * 1. Bridges source tokens to a Zcash transparent address
   * 2. Optionally shields the ZEC to a z-address
   *
   * @param params - Bridge parameters
   * @returns Bridge result with transaction details
   */
  async bridgeToShielded(params: BridgeParams): Promise<BridgeResult> {
    // Validate parameters
    this.validateParams(params)

    // Validate recipient address
    await this.validateRecipientAddress(params.recipientAddress, params.shield ?? true)

    // Create request
    const requestId = this.generateRequestId()
    const result: BridgeResult = {
      requestId,
      status: 'pending',
      recipientAddress: params.recipientAddress,
      totalFee: 0n,
      timestamp: Math.floor(Date.now() / 1000),
    }

    this.bridgeRequests.set(requestId, result)

    // Execute based on mode
    if (this.config.mode === 'production') {
      if (!this.bridgeProvider) {
        throw new IntentError(
          'Bridge provider not configured for production mode',
          ErrorCode.INTENT_INVALID_STATE,
        )
      }
      return this.executeProductionBridge(result, params)
    }

    return this.executeDemoBridge(result, params)
  }

  /**
   * Execute bridge in demo mode
   */
  private async executeDemoBridge(result: BridgeResult, params: BridgeParams): Promise<BridgeResult> {
    const shouldShield = params.shield !== false

    try {
      // Step 1: Simulate cross-chain bridge
      result.status = 'bridging'
      result.sourceTxHash = `0x${this.randomHex(64)}`
      this.bridgeRequests.set(result.requestId, { ...result })

      // Calculate ZEC amount
      const zecAmount = await this.calculateZecAmount(params)
      const fee = await this.calculateFee(params)

      await this.delay(50) // Simulate bridge time

      // Step 2: Bridge confirmed - ZEC at transparent address
      result.status = 'bridge_confirmed'
      if (shouldShield) {
        result.transparentAddress = this.generateMockTransparentAddress()
        result.transparentTxHash = this.randomHex(64)
      }
      this.bridgeRequests.set(result.requestId, { ...result })

      // Step 3: Shield to z-address (if requested)
      if (shouldShield && this.zcashService) {
        result.status = 'shielding'
        this.bridgeRequests.set(result.requestId, { ...result })

        try {
          const zecAmountFormatted = Number(zecAmount) / 100_000_000
          const sendResult = await this.zcashService.sendShielded({
            to: params.recipientAddress,
            amount: zecAmountFormatted,
            memo: params.memo ?? `SIP Bridge: ${params.sourceToken} → ZEC`,
          })

          result.shieldedTxId = sendResult.txid
          result.amountReceived = zecAmount
          result.amountReceivedFormatted = zecAmountFormatted.toFixed(8)
        } catch {
          // Fall back to mock if zcashd not available
          result.shieldedTxId = this.randomHex(64)
          result.amountReceived = zecAmount
          result.amountReceivedFormatted = (Number(zecAmount) / 100_000_000).toFixed(8)
        }
      } else if (shouldShield) {
        // No zcash service, mock shielding
        result.status = 'shielding'
        this.bridgeRequests.set(result.requestId, { ...result })

        await this.delay(50)

        result.shieldedTxId = this.randomHex(64)
        result.amountReceived = zecAmount
        result.amountReceivedFormatted = (Number(zecAmount) / 100_000_000).toFixed(8)
      } else {
        // No shielding - direct to transparent
        result.amountReceived = zecAmount
        result.amountReceivedFormatted = (Number(zecAmount) / 100_000_000).toFixed(8)
      }

      result.status = 'completed'
      result.totalFee = fee
      this.bridgeRequests.set(result.requestId, { ...result })

      return result
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Bridge failed'
      this.bridgeRequests.set(result.requestId, { ...result })
      throw error
    }
  }

  /**
   * Execute bridge in production mode
   */
  private async executeProductionBridge(result: BridgeResult, params: BridgeParams): Promise<BridgeResult> {
    if (!this.bridgeProvider) {
      throw new IntentError(
        'Bridge provider not configured for production mode',
        ErrorCode.INTENT_INVALID_STATE,
      )
    }

    const shouldShield = params.shield !== false

    try {
      // Step 1: Get quote from bridge provider
      const quote = await this.bridgeProvider.getQuote({
        sourceChain: params.sourceChain,
        sourceToken: params.sourceToken,
        amount: params.amount,
        recipientAddress: shouldShield
          ? this.generateMockTransparentAddress() // Intermediate t-addr
          : params.recipientAddress,
      })

      result.status = 'bridging'
      this.bridgeRequests.set(result.requestId, { ...result })

      // Step 2: Execute bridge
      const bridgeResult = await this.bridgeProvider.executeSwap({
        sourceChain: params.sourceChain,
        sourceToken: params.sourceToken,
        amount: params.amount,
        recipientAddress: params.recipientAddress,
        quoteId: quote.quoteId,
        depositAddress: '', // Provider handles this
      })

      result.sourceTxHash = bridgeResult.txHash

      if (bridgeResult.status === 'failed') {
        result.status = 'failed'
        result.error = 'Bridge execution failed'
        this.bridgeRequests.set(result.requestId, { ...result })
        return result
      }

      result.status = 'bridge_confirmed'
      this.bridgeRequests.set(result.requestId, { ...result })

      // Step 3: Shield if requested
      if (shouldShield && this.zcashService && bridgeResult.amountReceived) {
        result.status = 'shielding'
        this.bridgeRequests.set(result.requestId, { ...result })

        const zecAmount = Number(bridgeResult.amountReceived) / 100_000_000
        const sendResult = await this.zcashService.sendShielded({
          to: params.recipientAddress,
          amount: zecAmount,
          memo: params.memo ?? `SIP Bridge: ${params.sourceToken} → ZEC`,
        })

        result.shieldedTxId = sendResult.txid
        result.amountReceived = bridgeResult.amountReceived
        result.amountReceivedFormatted = zecAmount.toFixed(8)
      } else if (bridgeResult.amountReceived) {
        result.amountReceived = bridgeResult.amountReceived
        result.amountReceivedFormatted = (Number(bridgeResult.amountReceived) / 100_000_000).toFixed(8)
      }

      result.status = 'completed'
      result.totalFee = quote.fee
      this.bridgeRequests.set(result.requestId, { ...result })

      return result
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Production bridge failed'
      this.bridgeRequests.set(result.requestId, { ...result })
      throw error
    }
  }

  // ─── Status Methods ──────────────────────────────────────────────────────────

  /**
   * Get bridge request status
   */
  getStatus(requestId: string): BridgeResult | null {
    return this.bridgeRequests.get(requestId) ?? null
  }

  /**
   * Wait for bridge completion
   */
  async waitForCompletion(
    requestId: string,
    timeout: number = 600000,
    pollInterval: number = 5000,
  ): Promise<BridgeResult> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = this.getStatus(requestId)

      if (!status) {
        throw new IntentError(
          'Bridge request not found',
          ErrorCode.INTENT_NOT_FOUND,
          { context: { requestId } },
        )
      }

      if (status.status === 'completed') {
        return status
      }

      if (status.status === 'failed') {
        throw new IntentError(
          `Bridge failed: ${status.error ?? 'Unknown error'}`,
          ErrorCode.INTENT_FAILED,
          { context: { requestId, status } },
        )
      }

      await this.delay(pollInterval)
    }

    throw new IntentError(
      'Bridge timeout',
      ErrorCode.NETWORK_TIMEOUT,
      { context: { requestId, timeout } },
    )
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  private validateParams(params: BridgeParams): void {
    if (!params.sourceChain) {
      throw new ValidationError(
        'Source chain is required',
        'sourceChain',
        undefined,
        ErrorCode.VALIDATION_FAILED,
      )
    }

    if (!params.sourceToken) {
      throw new ValidationError(
        'Source token is required',
        'sourceToken',
        undefined,
        ErrorCode.VALIDATION_FAILED,
      )
    }

    if (!params.amount || params.amount <= 0n) {
      throw new ValidationError(
        'Amount must be positive',
        'amount',
        { received: params.amount },
        ErrorCode.INVALID_AMOUNT,
      )
    }

    if (!params.recipientAddress) {
      throw new ValidationError(
        'Recipient address is required',
        'recipientAddress',
        undefined,
        ErrorCode.VALIDATION_FAILED,
      )
    }

    if (!this.isRouteSupported(params.sourceChain, params.sourceToken)) {
      throw new ValidationError(
        `Unsupported route: ${params.sourceChain}:${params.sourceToken} → ZEC`,
        'sourceChain',
        { chain: params.sourceChain, token: params.sourceToken },
        ErrorCode.VALIDATION_FAILED,
      )
    }

    // Validate amount is within limits
    const route = this.getRoute(params.sourceChain, params.sourceToken)
    if (route) {
      if (params.amount < route.minAmount) {
        throw new ValidationError(
          `Amount below minimum: ${params.amount} < ${route.minAmount}`,
          'amount',
          { received: params.amount, minimum: route.minAmount },
          ErrorCode.INVALID_AMOUNT,
        )
      }
      if (params.amount > route.maxAmount) {
        throw new ValidationError(
          `Amount above maximum: ${params.amount} > ${route.maxAmount}`,
          'amount',
          { received: params.amount, maximum: route.maxAmount },
          ErrorCode.INVALID_AMOUNT,
        )
      }
    }
  }

  private async validateRecipientAddress(address: string, requireShielded: boolean): Promise<void> {
    if (this.zcashService) {
      const info = await this.zcashService.validateAddress(address)
      if (!info.isvalid) {
        throw new ValidationError(
          'Invalid Zcash address',
          'recipientAddress',
          { received: address },
          ErrorCode.INVALID_ADDRESS,
        )
      }

      if (requireShielded) {
        const isShielded = await this.zcashService.isShieldedAddress(address)
        if (!isShielded) {
          throw new ValidationError(
            'Shielded address (z-address) required for bridgeToShielded',
            'recipientAddress',
            { received: address },
            ErrorCode.INVALID_ADDRESS,
          )
        }
      }
    } else {
      // Basic format validation without zcashd
      if (requireShielded) {
        if (!this.isShieldedAddressFormat(address)) {
          throw new ValidationError(
            'Invalid shielded address format. Expected zs1... or u1...',
            'recipientAddress',
            { received: address },
            ErrorCode.INVALID_ADDRESS,
          )
        }
      } else {
        if (!this.isValidZcashAddressFormat(address)) {
          throw new ValidationError(
            'Invalid Zcash address format',
            'recipientAddress',
            { received: address },
            ErrorCode.INVALID_ADDRESS,
          )
        }
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async calculateZecAmount(params: BridgeParams): Promise<bigint> {
    const sourcePrice = this.priceFeed
      ? await this.priceFeed.getPrice(params.sourceToken)
      : MOCK_PRICES[params.sourceToken] ?? 1

    const zecPrice = this.priceFeed
      ? await this.priceFeed.getZecPrice()
      : MOCK_PRICES.ZEC

    const sourceDecimals = TOKEN_DECIMALS[params.sourceToken] ?? 18
    const amountInUsd = (Number(params.amount) / 10 ** sourceDecimals) * sourcePrice

    // Get route fee
    const route = this.getRoute(params.sourceChain, params.sourceToken)
    const feeBps = route?.feeBps ?? 50
    const feeAmount = amountInUsd * (feeBps / 10000)
    const networkFee = 2 // ~$2 network fee

    const netAmountUsd = amountInUsd - feeAmount - networkFee
    const zecAmount = netAmountUsd / zecPrice

    return BigInt(Math.floor(zecAmount * 100_000_000))
  }

  private async calculateFee(params: BridgeParams): Promise<bigint> {
    const sourcePrice = this.priceFeed
      ? await this.priceFeed.getPrice(params.sourceToken)
      : MOCK_PRICES[params.sourceToken] ?? 1

    const zecPrice = this.priceFeed
      ? await this.priceFeed.getZecPrice()
      : MOCK_PRICES.ZEC

    const sourceDecimals = TOKEN_DECIMALS[params.sourceToken] ?? 18
    const amountInUsd = (Number(params.amount) / 10 ** sourceDecimals) * sourcePrice

    const route = this.getRoute(params.sourceChain, params.sourceToken)
    const feeBps = route?.feeBps ?? 50
    const feeUsd = amountInUsd * (feeBps / 10000) + 2 // +$2 network

    // Convert fee to zatoshis
    const feeZec = feeUsd / zecPrice
    return BigInt(Math.floor(feeZec * 100_000_000))
  }

  private isShieldedAddressFormat(address: string): boolean {
    return (
      address.startsWith('zs1') ||
      address.startsWith('u1') ||
      address.startsWith('ztestsapling') ||
      address.startsWith('utest')
    )
  }

  private isValidZcashAddressFormat(address: string): boolean {
    return (
      this.isShieldedAddressFormat(address) ||
      address.startsWith('t1') || // mainnet transparent
      address.startsWith('t3') || // mainnet P2SH
      address.startsWith('tm')    // testnet transparent
    )
  }

  private generateMockTransparentAddress(): string {
    return `t1${this.randomBase58(33)}`
  }

  private generateRequestId(): string {
    return `bridge_${Date.now()}_${this.randomHex(8)}`
  }

  private randomHex(length: number): string {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  private randomBase58(length: number): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create a Zcash bridge instance
 */
export function createZcashBridge(config: ZcashBridgeConfig): ZcashBridge {
  return new ZcashBridge(config)
}
