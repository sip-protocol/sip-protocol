/**
 * NEAR 1Click API HTTP Client
 *
 * Provides typed access to the NEAR Intents 1Click API for cross-chain swaps.
 *
 * @see https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api
 */

import {
  type OneClickConfig,
  type OneClickToken,
  type OneClickQuoteRequest,
  type OneClickQuoteResponse,
  type OneClickDepositSubmit,
  type OneClickStatusResponse,
  type OneClickWithdrawal,
  type OneClickError,
  OneClickSwapStatus,
  OneClickErrorCode,
} from '@sip-protocol/types'
import { NetworkError, ErrorCode, ValidationError } from '../errors'

/**
 * Default configuration values
 */
const DEFAULTS = {
  baseUrl: 'https://1click.chaindefuser.com',
  timeout: 30000,
} as const

/**
 * HTTP client for NEAR 1Click API
 *
 * @example
 * ```typescript
 * const client = new OneClickClient({
 *   jwtToken: process.env.NEAR_INTENTS_JWT,
 * })
 *
 * // Get available tokens
 * const tokens = await client.getTokens()
 *
 * // Request a quote
 * const quote = await client.quote({
 *   swapType: OneClickSwapType.EXACT_INPUT,
 *   originAsset: 'near:mainnet:wrap.near',
 *   destinationAsset: 'eth:1:native',
 *   amount: '1000000000000000000000000',
 *   refundTo: 'user.near',
 *   recipient: '0x742d35Cc...',
 *   depositType: 'near',
 *   refundType: 'near',
 *   recipientType: 'eth',
 * })
 *
 * // Check status
 * const status = await client.getStatus(quote.depositAddress)
 * ```
 */
export class OneClickClient {
  private readonly baseUrl: string
  private readonly jwtToken?: string
  private readonly timeout: number
  private readonly fetchFn: typeof fetch

  constructor(config: OneClickConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULTS.baseUrl
    this.jwtToken = config.jwtToken
    this.timeout = config.timeout ?? DEFAULTS.timeout
    // Bind fetch to globalThis to preserve 'this' context in browsers
    // Without this, fetch() throws "Illegal invocation" when assigned to a property
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis)
  }

  /**
   * Get all supported tokens
   *
   * @returns Array of supported tokens with metadata
   */
  async getTokens(): Promise<OneClickToken[]> {
    return this.get<OneClickToken[]>('/v0/tokens')
  }

  /**
   * Request a swap quote
   *
   * @param request - Quote request parameters
   * @returns Quote response with deposit address and amounts
   * @throws {NetworkError} On API errors
   * @throws {ValidationError} On invalid parameters
   */
  async quote(request: OneClickQuoteRequest): Promise<OneClickQuoteResponse> {
    this.validateQuoteRequest(request)
    // The 1Click API returns a nested structure: { quote: {...}, signature, timestamp }
    // We flatten it to match our OneClickQuoteResponse type
    const rawResponse = await this.post<{
      quote: {
        amountIn: string
        amountInFormatted: string
        amountInUsd?: string
        amountOut: string
        amountOutFormatted: string
        amountOutUsd?: string
        depositAddress: string
        deadline: string
        timeEstimate: number
      }
      quoteRequest: OneClickQuoteRequest
      signature: string
      timestamp: string
    }>('/v0/quote', request)

    // Flatten the response
    return {
      quoteId: rawResponse.timestamp, // Use timestamp as quoteId since API doesn't provide one
      depositAddress: rawResponse.quote.depositAddress,
      amountIn: rawResponse.quote.amountIn,
      amountInFormatted: rawResponse.quote.amountInFormatted,
      amountOut: rawResponse.quote.amountOut,
      amountOutFormatted: rawResponse.quote.amountOutFormatted,
      amountOutUsd: rawResponse.quote.amountOutUsd,
      deadline: rawResponse.quote.deadline,
      timeEstimate: rawResponse.quote.timeEstimate,
      signature: rawResponse.signature,
      request: rawResponse.quoteRequest,
    }
  }

  /**
   * Request a dry quote (preview without deposit address)
   *
   * Useful for UI price estimates without committing to a swap.
   *
   * @param request - Quote request parameters (dry flag set automatically)
   * @returns Quote preview without deposit address
   */
  async dryQuote(request: Omit<OneClickQuoteRequest, 'dry'>): Promise<OneClickQuoteResponse> {
    return this.quote({ ...request, dry: true })
  }

  /**
   * Submit deposit transaction notification
   *
   * Call this after depositing to the depositAddress to speed up detection.
   *
   * @param deposit - Deposit submission details
   * @returns Updated quote response
   */
  async submitDeposit(deposit: OneClickDepositSubmit): Promise<OneClickQuoteResponse> {
    if (!deposit.txHash) {
      throw new ValidationError('txHash is required', 'deposit.txHash')
    }
    if (!deposit.depositAddress) {
      throw new ValidationError('depositAddress is required', 'deposit.depositAddress')
    }
    return this.post<OneClickQuoteResponse>('/v0/deposit/submit', deposit)
  }

  /**
   * Get swap status
   *
   * @param depositAddress - Deposit address from quote
   * @param depositMemo - Optional memo for memo-based deposits
   * @returns Current swap status
   */
  async getStatus(depositAddress: string, depositMemo?: string): Promise<OneClickStatusResponse> {
    if (!depositAddress) {
      throw new ValidationError('depositAddress is required', 'depositAddress')
    }

    const params = new URLSearchParams({ depositAddress })
    if (depositMemo) {
      params.set('depositMemo', depositMemo)
    }

    return this.get<OneClickStatusResponse>(`/v0/status?${params.toString()}`)
  }

  /**
   * Poll status until terminal state or timeout
   *
   * @param depositAddress - Deposit address from quote
   * @param options - Polling options
   * @returns Final status when terminal state reached
   */
  async waitForStatus(
    depositAddress: string,
    options: {
      /** Polling interval in ms (default: 3000) */
      interval?: number
      /** Maximum wait time in ms (default: 300000 = 5 minutes) */
      timeout?: number
      /** Callback on each status check */
      onStatus?: (status: OneClickStatusResponse) => void
    } = {}
  ): Promise<OneClickStatusResponse> {
    const interval = options.interval ?? 3000
    const timeout = options.timeout ?? 300000
    const startTime = Date.now()

    const terminalStates = new Set([
      OneClickSwapStatus.SUCCESS,
      OneClickSwapStatus.FAILED,
      OneClickSwapStatus.REFUNDED,
    ])

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(depositAddress)

      if (options.onStatus) {
        options.onStatus(status)
      }

      if (terminalStates.has(status.status)) {
        return status
      }

      await this.delay(interval)
    }

    throw new NetworkError(
      `Status polling timed out after ${timeout}ms`,
      ErrorCode.NETWORK_TIMEOUT,
      { endpoint: '/v0/status', context: { depositAddress, timeout } }
    )
  }

  /**
   * Get withdrawals for ANY_INPUT deposits
   *
   * @param depositAddress - Deposit address
   * @param depositMemo - Optional deposit memo
   * @param options - Pagination options
   * @returns Array of withdrawals
   */
  async getWithdrawals(
    depositAddress: string,
    depositMemo?: string,
    options: {
      timestampFrom?: string
      page?: number
      limit?: number
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<OneClickWithdrawal[]> {
    const params = new URLSearchParams({ depositAddress })
    if (depositMemo) params.set('depositMemo', depositMemo)
    if (options.timestampFrom) params.set('timestampFrom', options.timestampFrom)
    if (options.page) params.set('page', options.page.toString())
    if (options.limit) params.set('limit', options.limit.toString())
    if (options.sortOrder) params.set('sortOrder', options.sortOrder)

    return this.get<OneClickWithdrawal[]>(`/v0/any-input/withdrawals?${params.toString()}`)
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private validateQuoteRequest(request: OneClickQuoteRequest): void {
    if (!request.swapType) {
      throw new ValidationError('swapType is required', 'request.swapType')
    }
    if (!request.originAsset) {
      throw new ValidationError('originAsset is required', 'request.originAsset')
    }
    if (!request.destinationAsset) {
      throw new ValidationError('destinationAsset is required', 'request.destinationAsset')
    }
    if (!request.amount) {
      throw new ValidationError('amount is required', 'request.amount')
    }
    if (!request.refundTo) {
      throw new ValidationError('refundTo is required', 'request.refundTo')
    }
    if (!request.recipient) {
      throw new ValidationError('recipient is required', 'request.recipient')
    }
    if (!request.depositType) {
      throw new ValidationError('depositType is required', 'request.depositType')
    }
    if (!request.refundType) {
      throw new ValidationError('refundType is required', 'request.refundType')
    }
    if (!request.recipientType) {
      throw new ValidationError('recipientType is required', 'request.recipientType')
    }
    if (request.slippageTolerance === undefined || request.slippageTolerance === null) {
      throw new ValidationError('slippageTolerance is required (0-10000 basis points)', 'request.slippageTolerance')
    }
    if (!request.deadline) {
      throw new ValidationError('deadline is required (ISO 8601 format)', 'request.deadline')
    }
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await this.parseError(response)
        throw new NetworkError(
          error.message || `API request failed with status ${response.status}`,
          this.mapErrorCode(error.code, response.status),
          {
            endpoint: url,
            statusCode: response.status,
            context: { error },
          }
        )
      }

      return response.json() as Promise<T>
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof NetworkError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError(
          `Request timed out after ${this.timeout}ms`,
          ErrorCode.NETWORK_TIMEOUT,
          { endpoint: url }
        )
      }

      throw new NetworkError(
        `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NETWORK_FAILED,
        { endpoint: url, cause: error instanceof Error ? error : undefined }
      )
    }
  }

  private async parseError(response: Response): Promise<OneClickError> {
    try {
      return await response.json()
    } catch {
      return {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
  }

  private mapErrorCode(apiCode: string | undefined, statusCode: number): ErrorCode {
    if (apiCode) {
      switch (apiCode) {
        case OneClickErrorCode.INSUFFICIENT_LIQUIDITY:
        case OneClickErrorCode.UNSUPPORTED_PAIR:
        case OneClickErrorCode.AMOUNT_TOO_LOW:
        case OneClickErrorCode.DEADLINE_TOO_SHORT:
        case OneClickErrorCode.INVALID_PARAMS:
          return ErrorCode.VALIDATION_FAILED

        case OneClickErrorCode.RATE_LIMITED:
          return ErrorCode.RATE_LIMITED
      }
    }

    switch (statusCode) {
      case 400:
        return ErrorCode.VALIDATION_FAILED
      case 401:
        return ErrorCode.API_ERROR
      case 429:
        return ErrorCode.RATE_LIMITED
      case 500:
      case 502:
      case 503:
        return ErrorCode.NETWORK_UNAVAILABLE
      default:
        return ErrorCode.API_ERROR
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
