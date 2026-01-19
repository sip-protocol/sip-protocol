/**
 * 1inch Private Swap
 *
 * Execute swaps through 1inch aggregator with stealth address privacy.
 * Leverages 1inch's liquidity aggregation while sending output to
 * a fresh stealth address.
 *
 * @example
 * ```typescript
 * const result = await privateOneInchSwap({
 *   recipientMetaAddress: 'sip:ethereum:0x02...:0x03...',
 *   fromToken: ETH_ADDRESS,
 *   toToken: USDC_ADDRESS,
 *   amount: '1000000000000000000',
 *   slippagePercent: 1,
 *   signer,
 * })
 * ```
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * 1inch swap parameters
 */
export interface OneInchSwapParams {
  /** Recipient's stealth meta-address (SIP format) */
  recipientMetaAddress: string
  /** Source token address (use ETH_ADDRESS for native) */
  fromToken: string
  /** Destination token address */
  toToken: string
  /** Amount in wei (string to handle large numbers) */
  amount: string
  /** Slippage tolerance in percent */
  slippagePercent: number
  /** Chain ID (default: 1 for mainnet) */
  chainId?: number
  /** 1inch API key */
  apiKey?: string
}

/**
 * 1inch quote response
 */
export interface OneInchQuote {
  /** Destination token amount */
  toAmount: string
  /** Estimated gas */
  estimatedGas: string
  /** Protocol distribution */
  protocols: Array<{
    name: string
    part: number
  }>
}

/**
 * 1inch swap response
 */
export interface OneInchSwapResponse {
  /** Transaction to sign */
  tx: {
    from: string
    to: string
    data: string
    value: string
    gas: string
    gasPrice: string
  }
  /** Output amount */
  toAmount: string
}

/**
 * Private swap result
 */
export interface PrivateSwapResult {
  /** Swap transaction hash */
  swapTxHash: string
  /** Announcement transaction hash */
  announcementTxHash: string
  /** Stealth address that received output */
  stealthAddress: string
  /** Ephemeral public key */
  ephemeralPublicKey: string
  /** View tag */
  viewTag: number
  /** Actual output amount */
  outputAmount: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * 1inch API base URL
 */
const ONEINCH_API_BASE = 'https://api.1inch.dev/swap/v6.0'

/**
 * 1inch router addresses
 */
const ONEINCH_ROUTER: Record<number, string> = {
  1: '0x111111125421cA6dc452d289314280a0f8842A65', // Mainnet
  10: '0x111111125421cA6dc452d289314280a0f8842A65', // Optimism
  137: '0x111111125421cA6dc452d289314280a0f8842A65', // Polygon
  8453: '0x111111125421cA6dc452d289314280a0f8842A65', // Base
  42161: '0x111111125421cA6dc452d289314280a0f8842A65', // Arbitrum
}

/**
 * SIP Announcer addresses
 */
const SIP_ANNOUNCER: Record<number, string> = {
  1: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  10: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  137: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  8453: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  42161: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
}

/**
 * Native token address used by 1inch
 */
export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

/**
 * Common token addresses
 */
export const TOKENS = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  WETH: {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    10: '0x4200000000000000000000000000000000000006',
    137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    8453: '0x4200000000000000000000000000000000000006',
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
} as const

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Get a quote from 1inch API
 *
 * @param params - Quote parameters
 * @returns Quote with expected output
 *
 * @example
 * ```typescript
 * const quote = await getOneInchQuote({
 *   fromToken: ETH_ADDRESS,
 *   toToken: TOKENS.USDC[1],
 *   amount: '1000000000000000000', // 1 ETH
 *   chainId: 1,
 * })
 * console.log('Expected:', quote.toAmount)
 * ```
 */
export async function getOneInchQuote(params: {
  fromToken: string
  toToken: string
  amount: string
  chainId?: number
  apiKey?: string
}): Promise<OneInchQuote> {
  const { fromToken, toToken, amount, chainId = 1, apiKey } = params

  const url = new URL(`${ONEINCH_API_BASE}/${chainId}/quote`)
  url.searchParams.set('src', fromToken)
  url.searchParams.set('dst', toToken)
  url.searchParams.set('amount', amount)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(url.toString(), { headers })

  if (!response.ok) {
    throw new Error(`1inch API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    toAmount: data.toAmount,
    estimatedGas: data.gas?.toString() ?? '300000',
    protocols: data.protocols?.flat().flat() ?? [],
  }
}

/**
 * Build a 1inch swap transaction with stealth recipient
 *
 * @param params - Swap parameters
 * @returns Swap transaction data
 */
export async function buildOneInchSwap(params: {
  fromToken: string
  toToken: string
  amount: string
  fromAddress: string
  stealthAddress: string
  slippagePercent: number
  chainId?: number
  apiKey?: string
}): Promise<OneInchSwapResponse> {
  const {
    fromToken,
    toToken,
    amount,
    fromAddress,
    stealthAddress,
    slippagePercent,
    chainId = 1,
    apiKey,
  } = params

  const url = new URL(`${ONEINCH_API_BASE}/${chainId}/swap`)
  url.searchParams.set('src', fromToken)
  url.searchParams.set('dst', toToken)
  url.searchParams.set('amount', amount)
  url.searchParams.set('from', fromAddress)
  url.searchParams.set('receiver', stealthAddress) // Key: output goes to stealth!
  url.searchParams.set('slippage', slippagePercent.toString())
  url.searchParams.set('disableEstimate', 'true')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(url.toString(), { headers })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`1inch swap error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ─── Main Functions ───────────────────────────────────────────────────────────

/**
 * Build a private 1inch swap (without executing)
 *
 * @param params - Swap parameters
 * @returns Built transaction ready for signing
 *
 * @example
 * ```typescript
 * const built = await buildPrivateOneInchSwap({
 *   recipientMetaAddress: 'sip:ethereum:0x02...:0x03...',
 *   fromToken: ETH_ADDRESS,
 *   toToken: TOKENS.USDC[1],
 *   amount: '1000000000000000000',
 *   fromAddress: '0x...',
 *   slippagePercent: 1,
 * })
 *
 * console.log('Output to:', built.stealth.address)
 * console.log('Expected:', built.quote.toAmount)
 * ```
 */
export async function buildPrivateOneInchSwap(params: {
  recipientMetaAddress: string
  fromToken: string
  toToken: string
  amount: string
  fromAddress: string
  slippagePercent: number
  chainId?: number
  apiKey?: string
}): Promise<{
  transaction: OneInchSwapResponse['tx']
  stealth: {
    address: string
    ephemeralPublicKey: string
    viewTag: number
  }
  quote: OneInchQuote
  announcement: {
    contractAddress: string
    schemeId: number
  }
}> {
  const { recipientMetaAddress, chainId = 1, ...rest } = params

  // Dynamic import of SDK
  const sdk = await import('@sip-protocol/sdk')

  // Parse and validate meta-address
  const metaAddress = sdk.parseEthereumStealthMetaAddress(recipientMetaAddress)
  if (!metaAddress) {
    throw new Error('Invalid stealth meta-address format')
  }

  // Generate stealth address for output
  const stealthResult = sdk.generateEthereumStealthAddress(metaAddress)

  // Get quote first
  const quote = await getOneInchQuote({
    fromToken: rest.fromToken,
    toToken: rest.toToken,
    amount: rest.amount,
    chainId,
    apiKey: rest.apiKey,
  })

  // Build swap with stealth recipient
  const swapResponse = await buildOneInchSwap({
    ...rest,
    stealthAddress: stealthResult.stealthAddress.ethAddress,
    chainId,
  })

  return {
    transaction: swapResponse.tx,
    stealth: {
      address: stealthResult.stealthAddress.ethAddress,
      ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
      viewTag: stealthResult.stealthAddress.viewTag,
    },
    quote,
    announcement: {
      contractAddress: SIP_ANNOUNCER[chainId] ?? SIP_ANNOUNCER[1],
      schemeId: 1, // secp256k1
    },
  }
}

/**
 * Compare quotes across DEXs
 *
 * @param params - Comparison parameters
 * @returns Quotes from multiple sources
 */
export async function compareQuotes(params: {
  fromToken: string
  toToken: string
  amount: string
  chainId?: number
}): Promise<{
  oneinch: OneInchQuote | null
  // uniswap: UniswapQuote | null  // Could add more sources
}> {
  const { fromToken, toToken, amount, chainId = 1 } = params

  let oneinchQuote: OneInchQuote | null = null

  try {
    oneinchQuote = await getOneInchQuote({
      fromToken,
      toToken,
      amount,
      chainId,
    })
  } catch {
    // 1inch quote failed
  }

  return {
    oneinch: oneinchQuote,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Check if address is native ETH
 */
export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === ETH_ADDRESS.toLowerCase()
}

/**
 * Format token amount for display
 */
export function formatAmount(amount: string, decimals: number): string {
  const value = BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor

  const fractionStr = fraction.toString().padStart(decimals, '0')
  return `${whole}.${fractionStr.slice(0, 6)}`
}

/**
 * Get chain name from ID
 */
export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
  }
  return names[chainId] ?? `Chain ${chainId}`
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ONEINCH_API_BASE, ONEINCH_ROUTER, SIP_ANNOUNCER }
