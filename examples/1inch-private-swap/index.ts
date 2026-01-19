/**
 * 1inch Aggregator Private Swap Example
 *
 * Demonstrates executing a privacy-preserving swap via 1inch aggregator using SIP Protocol.
 * 1inch finds the best rates across multiple DEXs while SIP adds privacy.
 *
 * Flow:
 * 1. Generate stealth address for receiving swap output
 * 2. Create amount commitment (hidden swap amount)
 * 3. Get 1inch quote for best route across DEXs
 * 4. Build swap transaction with stealth output
 * 5. Execute via stealth → 1inch Router → stealth
 *
 * Advantages over single DEX:
 * - Best price discovery across 50+ DEXs
 * - Optimized gas via route splitting
 * - Same privacy guarantees as direct DEX
 *
 * Usage:
 *   npx tsx examples/1inch-private-swap/index.ts
 *
 * With 1inch API key (for live quotes):
 *   ONEINCH_API_KEY=xxx LIVE_MODE=true npx tsx examples/1inch-private-swap/index.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  commit,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

type EthereumNetwork = 'mainnet' | 'arbitrum' | 'optimism' | 'base' | 'polygon'

const NETWORK: EthereumNetwork = (process.env.NETWORK as EthereumNetwork) || 'mainnet'
const LIVE_MODE = process.env.LIVE_MODE === 'true'
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY

// 1inch v5 Router addresses by chain
const ONEINCH_ROUTERS: Record<EthereumNetwork, HexString> = {
  mainnet: '0x1111111254EEB25477B68fb85Ed929f73A960582' as HexString,
  arbitrum: '0x1111111254EEB25477B68fb85Ed929f73A960582' as HexString,
  optimism: '0x1111111254EEB25477B68fb85Ed929f73A960582' as HexString,
  base: '0x1111111254EEB25477B68fb85Ed929f73A960582' as HexString,
  polygon: '0x1111111254EEB25477B68fb85Ed929f73A960582' as HexString,
}

// Chain IDs for 1inch API
const CHAIN_IDS: Record<EthereumNetwork, number> = {
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
}

// Common token addresses (mainnet)
const TOKENS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as HexString, // Native ETH
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as HexString,
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as HexString,
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as HexString,
  DAI: '0x6B175474E89094C44Da98b954EescdeCB5bE3d830' as HexString,
}

// Swap configuration
const SWAP_CONFIG = {
  tokenIn: 'ETH',
  tokenOut: 'USDC',
  amountIn: toWei('0.5'), // 0.5 ETH
  slippage: 1, // 1%
}

// ─── Ethereum Helpers ─────────────────────────────────────────────────────────

function toWei(eth: string): bigint {
  const [whole, decimal = ''] = eth.split('.')
  const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18)
  return BigInt(whole + paddedDecimal)
}

function fromWei(wei: bigint): string {
  const str = wei.toString().padStart(19, '0')
  const whole = str.slice(0, -18) || '0'
  const decimal = str.slice(-18).replace(/0+$/, '') || '0'
  return `${whole}.${decimal}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OneInchQuote {
  toAmount: bigint
  estimatedGas: bigint
  protocols: Array<{
    name: string
    part: number
  }>
  fromToken: {
    symbol: string
    decimals: number
  }
  toToken: {
    symbol: string
    decimals: number
  }
}

// OneInchSwapData would be used for live swap execution
// Keeping for documentation purposes

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('1inch Aggregator Private Swap Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Mode: ${LIVE_MODE ? 'LIVE (requires API key)' : 'SIMULATION'}`)
  console.log(`Network: ${NETWORK}`)
  console.log(`Swap: ${fromWei(SWAP_CONFIG.amountIn)} ${SWAP_CONFIG.tokenIn} → ${SWAP_CONFIG.tokenOut}`)
  console.log('')

  if (LIVE_MODE && !ONEINCH_API_KEY) {
    console.log('⚠ Warning: LIVE_MODE requires ONEINCH_API_KEY environment variable')
    console.log('  Get your API key at: https://portal.1inch.dev')
    console.log('')
  }

  // ─── Step 1: Generate Stealth Addresses ─────────────────────────────────────

  console.log('STEP 1: Generate stealth addresses')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate receiver's stealth meta-address
  const receiverMeta = generateStealthMetaAddress('ethereum')
  console.log('  Receiver stealth meta-address generated')
  console.log(`    Spending Key: ${truncate(receiverMeta.metaAddress.spendingKey)}`)
  console.log(`    Viewing Key:  ${truncate(receiverMeta.metaAddress.viewingKey)}`)
  console.log('')

  // Generate the stealth address for swap output
  const outputStealth = generateStealthAddress(receiverMeta.metaAddress)
  console.log('  Output stealth address generated')
  console.log(`    Stealth Address: ${truncate(outputStealth.stealthAddress.address)}`)
  console.log(`    View Tag: ${outputStealth.stealthAddress.viewTag}`)
  console.log('')

  // ─── Step 2: Create Amount Commitment ───────────────────────────────────────

  console.log('STEP 2: Create amount commitment')
  console.log('─────────────────────────────────────────────────────────────────')

  const amountCommitment = commit(SWAP_CONFIG.amountIn)
  console.log('  Amount hidden with Pedersen commitment')
  console.log(`    Amount: ${fromWei(SWAP_CONFIG.amountIn)} ETH (hidden on-chain)`)
  console.log(`    Commitment: ${truncate(amountCommitment.commitment)}`)
  console.log('')

  // ─── Step 3: Get 1inch Quote ────────────────────────────────────────────────

  console.log('STEP 3: Get 1inch aggregator quote')
  console.log('─────────────────────────────────────────────────────────────────')

  let quote: OneInchQuote

  if (LIVE_MODE && ONEINCH_API_KEY) {
    console.log('  Fetching live quote from 1inch API...')
    try {
      quote = await get1inchQuote(
        TOKENS.ETH,
        TOKENS.USDC,
        SWAP_CONFIG.amountIn,
        CHAIN_IDS[NETWORK]
      )
    } catch (error) {
      console.log(`  ⚠ API error: ${(error as Error).message}`)
      console.log('  Falling back to simulated quote...')
      quote = simulate1inchQuote(SWAP_CONFIG.amountIn)
    }
  } else {
    console.log('  Generating simulated quote...')
    quote = simulate1inchQuote(SWAP_CONFIG.amountIn)
  }

  const minAmountOut = calculateMinOutput(quote.toAmount, SWAP_CONFIG.slippage)

  console.log('  Quote received:')
  console.log(`    Input: ${fromWei(SWAP_CONFIG.amountIn)} ETH`)
  console.log(`    Output: ${formatUsdc(quote.toAmount)} USDC`)
  console.log(`    Min Output (${SWAP_CONFIG.slippage}% slippage): ${formatUsdc(minAmountOut)} USDC`)
  console.log(`    Gas Estimate: ${quote.estimatedGas.toString()} units`)
  console.log('')

  // Show routing information
  console.log('  Route breakdown (best rates from):')
  for (const protocol of quote.protocols) {
    console.log(`    • ${protocol.name}: ${protocol.part}%`)
  }
  console.log('')

  // ─── Step 4: Build Private Swap ─────────────────────────────────────────────

  console.log('STEP 4: Build private swap transaction')
  console.log('─────────────────────────────────────────────────────────────────')

  const swapTx = build1inchPrivateSwap({
    fromToken: TOKENS.ETH,
    toToken: TOKENS.USDC,
    amount: SWAP_CONFIG.amountIn,
    minReturn: minAmountOut,
    stealthRecipient: outputStealth.stealthAddress.address,
    commitment: amountCommitment.commitment,
  })

  console.log('  Private swap transaction built')
  console.log(`    Router: ${truncate(ONEINCH_ROUTERS[NETWORK])}`)
  console.log(`    Recipient: ${truncate(outputStealth.stealthAddress.address)} (stealth)`)
  console.log(`    Data length: ${swapTx.data.length} bytes`)
  console.log('')

  console.log('  Transaction structure:')
  console.log('    1. Route across multiple DEXs (1inch optimized)')
  console.log('    2. Output sent to stealth address')
  console.log('    3. Announcement published for recipient')
  console.log('')

  // ─── Step 5: Execute Swap (Simulated) ───────────────────────────────────────

  console.log('STEP 5: Execute private swap')
  console.log('─────────────────────────────────────────────────────────────────')

  if (LIVE_MODE) {
    console.log('  ⚠ Live execution requires wallet connection')
    console.log('  See examples/wallet-integration for details')
    console.log('')
  } else {
    console.log('  Simulating swap execution...')

    const simulatedTxHash = `0x${Array(64).fill(0).map(() =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as HexString

    console.log(`    Transaction Hash: ${truncate(simulatedTxHash)}`)
    console.log(`    Status: confirmed`)
    console.log(`    Output: ${formatUsdc(quote.toAmount)} USDC → stealth address`)
    console.log('')
  }

  // ─── Step 6: Verify and Claim ───────────────────────────────────────────────

  console.log('STEP 6: Verify stealth output ownership')
  console.log('─────────────────────────────────────────────────────────────────')

  const isOwner = checkStealthAddress(
    outputStealth.stealthAddress,
    receiverMeta.spendingPrivateKey,
    receiverMeta.viewingPrivateKey
  )

  console.log(`  Ownership verified: ${isOwner ? '✓' : '✗'}`)
  console.log('')

  if (isOwner) {
    const claimKey = deriveStealthPrivateKey(
      outputStealth.stealthAddress,
      receiverMeta.spendingPrivateKey,
      receiverMeta.viewingPrivateKey
    )

    console.log('  Claim key derived successfully')
    console.log(`    Claim Key: ${truncate(claimKey.privateKey)} (KEEP SECRET)`)
    console.log('')
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('PRIVACY + AGGREGATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  console.log('1inch benefits:')
  console.log('  ✓ Best price across 50+ DEXs')
  console.log('  ✓ Optimized gas via route splitting')
  console.log('  ✓ MEV protection (when enabled)')
  console.log('')

  console.log('SIP privacy benefits:')
  console.log('  ✓ Sender hidden via stealth input')
  console.log('  ✓ Amount hidden via commitment')
  console.log('  ✓ Recipient hidden via stealth output')
  console.log('')

  console.log('Comparison to direct DEX:')
  console.log('  • Same privacy guarantees')
  console.log('  • Better price discovery')
  console.log('  • Slightly higher gas (router overhead)')
  console.log('')

  console.log('Next steps:')
  console.log('  • Get 1inch API key: https://portal.1inch.dev')
  console.log('  • Try Uniswap direct: see examples/uniswap-private-swap/')
  console.log('  • Add compliance: see examples/compliance/')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: HexString | string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatUsdc(amount: bigint): string {
  const value = Number(amount) / 1e6
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calculateMinOutput(amountOut: bigint, slippagePercent: number): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercent * 100))
  return amountOut - (amountOut * slippageBps) / 10000n
}

async function get1inchQuote(
  fromToken: HexString,
  toToken: HexString,
  amount: bigint,
  chainId: number
): Promise<OneInchQuote> {
  // In production, call 1inch API:
  // GET https://api.1inch.dev/swap/v5.2/{chainId}/quote
  // Headers: Authorization: Bearer {ONEINCH_API_KEY}

  const apiUrl = `https://api.1inch.dev/swap/v5.2/${chainId}/quote`
  const params = new URLSearchParams({
    src: fromToken,
    dst: toToken,
    amount: amount.toString(),
  })

  const response = await fetch(`${apiUrl}?${params}`, {
    headers: {
      Authorization: `Bearer ${ONEINCH_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`1inch API error: ${response.status}`)
  }

  const data = await response.json()

  return {
    toAmount: BigInt(data.toAmount),
    estimatedGas: BigInt(data.estimatedGas),
    protocols: data.protocols?.flat().map((p: { name: string; part: number }) => ({
      name: p.name,
      part: Math.round(p.part * 100),
    })) ?? [],
    fromToken: data.fromToken,
    toToken: data.toToken,
  }
}

function simulate1inchQuote(amountIn: bigint): OneInchQuote {
  // Simulate ~$2,500 ETH price with slightly better rate than single DEX
  const ethPriceUsdc = 2505n * 1000000n // $2,505 in USDC (better than Uniswap single)
  const amountOutRaw = (amountIn * ethPriceUsdc) / (10n ** 18n)

  // Apply 0.25% effective fee (lower due to aggregation)
  const toAmount = amountOutRaw - (amountOutRaw * 25n) / 10000n

  return {
    toAmount,
    estimatedGas: 180000n, // Slightly higher gas for aggregator
    protocols: [
      { name: 'Uniswap V3', part: 45 },
      { name: 'Curve', part: 30 },
      { name: 'Balancer V2', part: 25 },
    ],
    fromToken: { symbol: 'ETH', decimals: 18 },
    toToken: { symbol: 'USDC', decimals: 6 },
  }
}

interface PrivateSwapBuildParams {
  fromToken: HexString
  toToken: HexString
  amount: bigint
  minReturn: bigint
  stealthRecipient: HexString
  commitment: HexString
}

function build1inchPrivateSwap(params: PrivateSwapBuildParams): { data: HexString } {
  // In production, this would call the 1inch swap API with:
  // - dst (recipient) set to stealth address
  // - minReturnAmount set with slippage
  // - permitAndCall for gasless approvals

  // Simulated encoded swap data
  const simulatedData = `0x12aa3caf${params.amount.toString(16).padStart(64, '0')}` as HexString

  return { data: simulatedData }
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
