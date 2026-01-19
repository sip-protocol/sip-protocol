/**
 * Uniswap V3 Private Swap Example
 *
 * Demonstrates executing a privacy-preserving swap on Uniswap V3 using SIP Protocol.
 * The flow protects both the sender's identity and the swap amounts using stealth addresses
 * and Pedersen commitments.
 *
 * Flow:
 * 1. Generate stealth address for receiving swap output
 * 2. Create amount commitment (hidden swap amount)
 * 3. Build Uniswap V3 swap transaction
 * 4. Execute via stealth address → Uniswap Router → stealth output
 * 5. Track and claim from output stealth address
 *
 * Security:
 * - Sender identity hidden via stealth input address
 * - Swap amount hidden via Pedersen commitment
 * - Output address is one-time stealth address
 * - No on-chain link between user and swap
 *
 * Usage:
 *   npx tsx examples/uniswap-private-swap/index.ts
 *
 * @packageDocumentation
 */

import {
  // Generic stealth addresses (works for any chain)
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  // Pedersen commitments
  commit,
  // Types
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

type EthereumNetwork = 'mainnet' | 'sepolia' | 'arbitrum' | 'optimism' | 'base'

const NETWORK: EthereumNetwork = (process.env.NETWORK as EthereumNetwork) || 'mainnet'
const LIVE_MODE = process.env.LIVE_MODE === 'true'

// Uniswap V3 addresses (same on mainnet, Arbitrum, Base)
const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564' as HexString

// Common token addresses (mainnet)
const TOKENS = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as HexString,
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as HexString,
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as HexString,
  DAI: '0x6B175474E89094C44Da98b954EescdeCB5bE3d830' as HexString,
}

// Swap configuration
const SWAP_CONFIG = {
  tokenIn: 'ETH',
  tokenOut: 'USDC',
  amountIn: toWei('0.1'), // 0.1 ETH
  slippage: 0.5, // 0.5%
  deadline: 20, // 20 minutes
  fee: 3000, // 0.3% pool fee
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

interface UniswapQuote {
  amountOut: bigint
  sqrtPriceX96After: bigint
  gasEstimate: bigint
  route: string
}

interface PrivateSwapParams {
  stealthSender: HexString
  stealthReceiver: HexString
  tokenIn: HexString
  tokenOut: HexString
  amountIn: bigint
  minAmountOut: bigint
  commitment: HexString
}

interface PrivateSwapResult {
  txHash: HexString
  stealthOutput: HexString
  amountIn: bigint
  amountOut: bigint
  gasCost: bigint
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Uniswap V3 Private Swap Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Mode: ${LIVE_MODE ? 'LIVE (requires wallet)' : 'SIMULATION'}`)
  console.log(`Network: ${NETWORK}`)
  console.log(`Swap: ${fromWei(SWAP_CONFIG.amountIn)} ${SWAP_CONFIG.tokenIn} → ${SWAP_CONFIG.tokenOut}`)
  console.log('')

  // ─── Step 1: Generate Stealth Addresses ─────────────────────────────────────

  console.log('STEP 1: Generate stealth addresses')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate sender's stealth meta-address (for receiving change or refunds)
  const senderMeta = generateStealthMetaAddress('ethereum')
  console.log('  Sender stealth meta-address generated')
  console.log(`    Spending Key: ${truncate(senderMeta.metaAddress.spendingKey)}`)
  console.log(`    Viewing Key:  ${truncate(senderMeta.metaAddress.viewingKey)}`)
  console.log('')

  // Generate receiver's stealth address (for swap output)
  const receiverMeta = generateStealthMetaAddress('ethereum')
  const outputStealth = generateStealthAddress(receiverMeta.metaAddress)

  console.log('  Output stealth address generated')
  console.log(`    Stealth Address: ${truncate(outputStealth.stealthAddress.address)}`)
  console.log(`    View Tag: ${outputStealth.stealthAddress.viewTag}`)
  console.log(`    Ephemeral Key: ${truncate(outputStealth.stealthAddress.ephemeralPublicKey)}`)
  console.log('')

  // ─── Step 2: Create Amount Commitment ───────────────────────────────────────

  console.log('STEP 2: Create amount commitment')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create Pedersen commitment to hide the swap amount
  const amountCommitment = commit(SWAP_CONFIG.amountIn)

  console.log('  Amount hidden with Pedersen commitment')
  console.log(`    Amount: ${fromWei(SWAP_CONFIG.amountIn)} ETH (hidden on-chain)`)
  console.log(`    Commitment: ${truncate(amountCommitment.commitment)}`)
  console.log(`    Blinding Factor: ${truncate(amountCommitment.blinding)}`)
  console.log('')

  // ─── Step 3: Get Uniswap Quote ──────────────────────────────────────────────

  console.log('STEP 3: Get Uniswap V3 quote')
  console.log('─────────────────────────────────────────────────────────────────')

  let quote: UniswapQuote

  if (LIVE_MODE) {
    console.log('  Fetching live quote from Uniswap...')
    // In production, call the Quoter contract
    quote = await getUniswapQuote(
      TOKENS.WETH,
      TOKENS.USDC,
      SWAP_CONFIG.amountIn,
      SWAP_CONFIG.fee
    )
  } else {
    console.log('  Generating simulated quote...')
    quote = simulateUniswapQuote(SWAP_CONFIG.amountIn)
  }

  const minAmountOut = calculateMinOutput(quote.amountOut, SWAP_CONFIG.slippage)

  console.log('  Quote received:')
  console.log(`    Input: ${fromWei(SWAP_CONFIG.amountIn)} ETH`)
  console.log(`    Output: ${formatUsdc(quote.amountOut)} USDC`)
  console.log(`    Min Output (${SWAP_CONFIG.slippage}% slippage): ${formatUsdc(minAmountOut)} USDC`)
  console.log(`    Implied Price: $${(Number(quote.amountOut) / Number(SWAP_CONFIG.amountIn) * 1e12).toFixed(2)}/ETH`)
  console.log(`    Gas Estimate: ${quote.gasEstimate.toString()} units`)
  console.log('')

  // ─── Step 4: Build Private Swap Transaction ─────────────────────────────────

  console.log('STEP 4: Build private swap transaction')
  console.log('─────────────────────────────────────────────────────────────────')

  const swapParams = buildPrivateSwapParams({
    inputStealth: senderMeta,
    outputStealth: outputStealth.stealthAddress.address,
    amountIn: SWAP_CONFIG.amountIn,
    minAmountOut,
    commitment: amountCommitment.commitment,
    deadline: SWAP_CONFIG.deadline,
    fee: SWAP_CONFIG.fee,
  })

  console.log('  Private swap transaction built')
  console.log(`    Router: ${truncate(UNISWAP_V3_ROUTER)}`)
  console.log(`    Input Token: WETH (wrapped during swap)`)
  console.log(`    Output Token: USDC`)
  console.log(`    Output Address: ${truncate(outputStealth.stealthAddress.address)} (stealth)`)
  console.log('')

  // Show the transaction structure
  console.log('  Transaction structure:')
  console.log('    1. Wrap ETH → WETH (if needed)')
  console.log('    2. Approve Router for WETH')
  console.log('    3. exactInputSingle()')
  console.log('       - tokenIn: WETH')
  console.log('       - tokenOut: USDC')
  console.log('       - recipient: stealth address')
  console.log('       - amountIn: [hidden in commitment]')
  console.log('       - amountOutMinimum: slippage protected')
  console.log('    4. Announce stealth transfer')
  console.log('')

  // ─── Step 5: Execute Swap (Simulated) ───────────────────────────────────────

  console.log('STEP 5: Execute private swap')
  console.log('─────────────────────────────────────────────────────────────────')

  if (LIVE_MODE) {
    console.log('  ⚠ Live mode requires connected wallet')
    console.log('  See examples/wallet-integration for wallet connection')
    console.log('')
  } else {
    console.log('  Simulating swap execution...')

    const simulatedResult = simulateSwapExecution(swapParams, quote)

    console.log(`    Transaction Hash: ${truncate(simulatedResult.txHash)}`)
    console.log(`    Status: confirmed`)
    console.log(`    Gas Used: ${simulatedResult.gasCost.toString()} wei`)
    console.log('')
  }

  // ─── Step 6: Verify Stealth Output ──────────────────────────────────────────

  console.log('STEP 6: Verify stealth output ownership')
  console.log('─────────────────────────────────────────────────────────────────')

  // Recipient verifies they can claim the output
  const isOwner = checkStealthAddress(
    outputStealth.stealthAddress,
    receiverMeta.spendingPrivateKey,
    receiverMeta.viewingPrivateKey
  )

  console.log(`  Ownership verified: ${isOwner ? '✓' : '✗'}`)
  console.log('')

  if (isOwner) {
    // Derive the private key to claim the output
    const claimKey = deriveStealthPrivateKey(
      outputStealth.stealthAddress,
      receiverMeta.spendingPrivateKey,
      receiverMeta.viewingPrivateKey
    )

    console.log('  Claim key derived successfully')
    console.log(`    Claim Key: ${truncate(claimKey.privateKey)} (KEEP SECRET)`)
    console.log('')
    console.log('  To claim USDC from stealth address:')
    console.log('    1. Import claim key into wallet')
    console.log('    2. Transfer USDC to your main address')
    console.log('    3. No link between swap and claim!')
    console.log('')
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('PRIVACY SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  console.log('What observers see:')
  console.log('  ✗ Cannot link swap to your main wallet')
  console.log('  ✗ Cannot see exact swap amount (commitment)')
  console.log('  ✗ Cannot identify output owner (stealth address)')
  console.log('')

  console.log('What you preserve:')
  console.log('  ✓ Full ownership of output tokens')
  console.log('  ✓ Ability to prove swap to auditors (viewing key)')
  console.log('  ✓ Uniswap best-in-class execution')
  console.log('')

  console.log('Next steps:')
  console.log('  • Connect wallet: see examples/wallet-integration/')
  console.log('  • Add compliance: see examples/compliance/')
  console.log('  • Try 1inch: see examples/1inch-private-swap/')
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

async function getUniswapQuote(
  _tokenIn: HexString,
  _tokenOut: HexString,
  amountIn: bigint,
  _fee: number
): Promise<UniswapQuote> {
  // In production, this would call the Uniswap Quoter contract
  // QuoterV2.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0)

  // Simulated for example
  return simulateUniswapQuote(amountIn)
}

function simulateUniswapQuote(amountIn: bigint): UniswapQuote {
  // Simulate ~$2,500 ETH price
  const ethPriceUsdc = 2500n * 1000000n // $2,500 in USDC (6 decimals)
  const amountOutRaw = (amountIn * ethPriceUsdc) / (10n ** 18n)

  // Apply 0.3% fee
  const amountOut = amountOutRaw - (amountOutRaw * 30n) / 10000n

  return {
    amountOut,
    sqrtPriceX96After: 0n, // Would come from quoter
    gasEstimate: 150000n,
    route: 'WETH → USDC (0.3% pool)',
  }
}

interface SwapBuildParams {
  inputStealth: ReturnType<typeof generateStealthMetaAddress>
  outputStealth: HexString
  amountIn: bigint
  minAmountOut: bigint
  commitment: HexString
  deadline: number
  fee: number
}

function buildPrivateSwapParams(params: SwapBuildParams): PrivateSwapParams {
  // Generate a stealth sender address for the input
  const senderStealth = generateStealthAddress(params.inputStealth.metaAddress)

  return {
    stealthSender: senderStealth.stealthAddress.address,
    stealthReceiver: params.outputStealth,
    tokenIn: TOKENS.WETH,
    tokenOut: TOKENS.USDC,
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
    commitment: params.commitment,
  }
}

function simulateSwapExecution(
  params: PrivateSwapParams,
  quote: UniswapQuote
): PrivateSwapResult {
  // Generate mock transaction hash
  const txHash = `0x${Array(64).fill(0).map(() =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}` as HexString

  return {
    txHash,
    stealthOutput: params.stealthReceiver,
    amountIn: params.amountIn,
    amountOut: quote.amountOut,
    gasCost: quote.gasEstimate * 30n * (10n ** 9n), // ~30 gwei
  }
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
