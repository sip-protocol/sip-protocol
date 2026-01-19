/**
 * Uniswap V3 Private Swap
 *
 * Execute swaps through Uniswap V3 with stealth address privacy.
 * Output tokens are sent to a fresh stealth address that only
 * the recipient can identify and claim.
 *
 * @example
 * ```typescript
 * const result = await privateUniswapSwap({
 *   recipientMetaAddress: 'sip:ethereum:0x02...:0x03...',
 *   inputToken: WETH_ADDRESS,
 *   inputAmount: '1.0',
 *   outputToken: USDC_ADDRESS,
 *   slippagePercent: 0.5,
 *   signer,
 * })
 * ```
 */

import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Private swap parameters
 */
export interface PrivateSwapParams {
  /** Recipient's stealth meta-address (SIP format) */
  recipientMetaAddress: string
  /** Input token address (use zero address for native ETH) */
  inputToken: string
  /** Input amount in human-readable format (e.g., '1.5') */
  inputAmount: string
  /** Output token address */
  outputToken: string
  /** Slippage tolerance in percent (e.g., 0.5 for 0.5%) */
  slippagePercent: number
  /** Pool fee tier (default: 3000 = 0.3%) */
  poolFee?: number
  /** Deadline in seconds from now (default: 20 minutes) */
  deadlineSeconds?: number
  /** Network to use */
  network?: 'mainnet' | 'arbitrum' | 'optimism' | 'base' | 'polygon'
}

/**
 * Private swap result
 */
export interface PrivateSwapResult {
  /** Swap transaction hash */
  swapTxHash: string
  /** Announcement transaction hash */
  announcementTxHash: string
  /** Stealth address that received the output */
  stealthAddress: string
  /** Ephemeral public key for recipient discovery */
  ephemeralPublicKey: string
  /** View tag for efficient scanning */
  viewTag: number
  /** Estimated output amount */
  estimatedOutput: string
  /** Actual output amount (after confirmation) */
  actualOutput?: string
}

/**
 * Built transaction ready for signing
 */
export interface BuiltSwapTransaction {
  /** Transaction to sign and send */
  transaction: {
    to: string
    data: string
    value: string
    gasLimit: string
  }
  /** Stealth address details */
  stealth: {
    address: string
    ephemeralPublicKey: string
    viewTag: number
  }
  /** Announcement data */
  announcement: {
    callData: string
    contractAddress: string
  }
  /** Quote information */
  quote: {
    inputAmount: string
    estimatedOutput: string
    priceImpact: string
    minimumOutput: string
  }
}

// ─── Contract Addresses ───────────────────────────────────────────────────────

/**
 * Uniswap V3 contract addresses by network
 */
const UNISWAP_ADDRESSES: Record<string, { router: string; quoter: string }> = {
  mainnet: {
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  arbitrum: {
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  optimism: {
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  base: {
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  },
  polygon: {
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
}

/**
 * SIP Announcer contract addresses (placeholder - deploy first)
 */
const SIP_ANNOUNCER_ADDRESSES: Record<string, string> = {
  mainnet: '0x55649E01B5Df198D18D95b5cc5051630cfD45564', // EIP-5564 singleton
  arbitrum: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  optimism: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  base: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  polygon: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
}

/**
 * Common token addresses
 */
export const TOKENS = {
  ETH: '0x0000000000000000000000000000000000000000',
  WETH: {
    mainnet: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    optimism: '0x4200000000000000000000000000000000000006',
    base: '0x4200000000000000000000000000000000000006',
    polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  },
  USDC: {
    mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  USDT: {
    mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
} as const

// ─── ABI Fragments ────────────────────────────────────────────────────────────

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)',
]

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
]

const ANNOUNCER_ABI = [
  'function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata) external',
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]

// ─── Main Functions ───────────────────────────────────────────────────────────

/**
 * Build a private swap transaction
 *
 * This function builds the transaction without executing it,
 * allowing inspection before signing.
 *
 * @param params - Swap parameters
 * @returns Built transaction ready for signing
 *
 * @example
 * ```typescript
 * const built = await buildPrivateSwap({
 *   recipientMetaAddress: 'sip:ethereum:0x02...:0x03...',
 *   inputToken: TOKENS.WETH.mainnet,
 *   inputAmount: '1.0',
 *   outputToken: TOKENS.USDC.mainnet,
 *   slippagePercent: 0.5,
 * })
 *
 * console.log('Sending to stealth:', built.stealth.address)
 * console.log('Expected output:', built.quote.estimatedOutput)
 * ```
 */
export async function buildPrivateSwap(
  params: Omit<PrivateSwapParams, 'signer'>
): Promise<BuiltSwapTransaction> {
  const {
    recipientMetaAddress,
    inputToken,
    inputAmount,
    outputToken,
    slippagePercent,
    poolFee = 3000,
    deadlineSeconds = 1200,
    network = 'mainnet',
  } = params

  // Dynamic import of SDK
  const { generateEthereumStealthAddress, parseEthereumStealthMetaAddress } = await import(
    '@sip-protocol/sdk'
  )

  // Validate meta-address
  const metaAddress = parseEthereumStealthMetaAddress(recipientMetaAddress)
  if (!metaAddress) {
    throw new Error('Invalid stealth meta-address')
  }

  // Generate stealth address for output
  const stealth = generateEthereumStealthAddress(metaAddress)

  // Get contract addresses
  const uniswapAddresses = UNISWAP_ADDRESSES[network]
  const announcerAddress = SIP_ANNOUNCER_ADDRESSES[network]

  if (!uniswapAddresses) {
    throw new Error(`Unsupported network: ${network}`)
  }

  // Parse input amount (assume 18 decimals for now)
  const inputDecimals = inputToken === TOKENS.ETH ? 18 : 18 // Would fetch from contract
  const amountIn = parseUnits(inputAmount, inputDecimals)

  // Calculate minimum output with slippage
  // In production, use Quoter contract for accurate quote
  const estimatedOutput = amountIn // Placeholder - would call Quoter
  const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100))
  const amountOutMinimum = (estimatedOutput * slippageMultiplier) / 10000n

  // Calculate deadline
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds

  // Encode swap call
  const swapCallData = encodeSwapCall({
    tokenIn: inputToken === TOKENS.ETH ? TOKENS.WETH[network as keyof typeof TOKENS.WETH] : inputToken,
    tokenOut: outputToken,
    fee: poolFee,
    recipient: stealth.stealthAddress.ethAddress,
    deadline,
    amountIn,
    amountOutMinimum,
  })

  // Encode announcement call
  const announcementCallData = encodeAnnouncementCall({
    schemeId: 1, // secp256k1
    stealthAddress: stealth.stealthAddress.ethAddress,
    ephemeralPublicKey: stealth.stealthAddress.ephemeralPublicKey,
    viewTag: stealth.stealthAddress.viewTag,
  })

  // Build transaction
  const isNativeInput = inputToken === TOKENS.ETH
  const value = isNativeInput ? amountIn.toString() : '0'

  return {
    transaction: {
      to: uniswapAddresses.router,
      data: swapCallData,
      value,
      gasLimit: '300000', // Conservative estimate
    },
    stealth: {
      address: stealth.stealthAddress.ethAddress,
      ephemeralPublicKey: stealth.stealthAddress.ephemeralPublicKey,
      viewTag: stealth.stealthAddress.viewTag,
    },
    announcement: {
      callData: announcementCallData,
      contractAddress: announcerAddress,
    },
    quote: {
      inputAmount: inputAmount,
      estimatedOutput: formatUnits(estimatedOutput, 6), // Assume USDC output
      priceImpact: '0.01%', // Placeholder
      minimumOutput: formatUnits(amountOutMinimum, 6),
    },
  }
}

/**
 * Get a quote for a private swap
 *
 * @param params - Quote parameters
 * @returns Quote with estimated output and price impact
 */
export async function getPrivateSwapQuote(params: {
  inputToken: string
  outputToken: string
  inputAmount: string
  poolFee?: number
  network?: string
}): Promise<{
  estimatedOutput: string
  priceImpact: string
  route: string[]
  gasEstimate: string
}> {
  // In production, call Uniswap Quoter contract
  // This is a simplified placeholder

  return {
    estimatedOutput: '0',
    priceImpact: '0%',
    route: [params.inputToken, params.outputToken],
    gasEstimate: '230000',
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Parse units with decimals
 */
function parseUnits(value: string, decimals: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

/**
 * Format units with decimals
 */
function formatUnits(value: bigint, decimals: number): string {
  const str = value.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, -decimals) || '0'
  const fraction = str.slice(-decimals)
  return `${whole}.${fraction}`.replace(/\.?0+$/, '')
}

/**
 * Encode swap function call
 */
function encodeSwapCall(params: {
  tokenIn: string
  tokenOut: string
  fee: number
  recipient: string
  deadline: number
  amountIn: bigint
  amountOutMinimum: bigint
}): string {
  // Simplified encoding - in production use ethers.Interface
  const selector = '0x414bf389' // exactInputSingle selector

  // ABI encode the struct
  const encoded = [
    params.tokenIn.slice(2).padStart(64, '0'),
    params.tokenOut.slice(2).padStart(64, '0'),
    params.fee.toString(16).padStart(64, '0'),
    params.recipient.slice(2).padStart(64, '0'),
    params.deadline.toString(16).padStart(64, '0'),
    params.amountIn.toString(16).padStart(64, '0'),
    params.amountOutMinimum.toString(16).padStart(64, '0'),
    '0'.padStart(64, '0'), // sqrtPriceLimitX96
  ].join('')

  return selector + encoded
}

/**
 * Encode announcement function call
 */
function encodeAnnouncementCall(params: {
  schemeId: number
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: number
}): string {
  // Simplified encoding - in production use ethers.Interface
  const selector = '0x...' // announce selector

  // This would be properly ABI encoded
  return selector
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { UNISWAP_ADDRESSES, SIP_ANNOUNCER_ADDRESSES, SWAP_ROUTER_ABI, QUOTER_ABI, ANNOUNCER_ABI, ERC20_ABI }
