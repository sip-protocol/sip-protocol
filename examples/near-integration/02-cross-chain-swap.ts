/**
 * 02-cross-chain-swap.ts
 *
 * Demonstrates cross-chain swaps with privacy via NEAR Intents (1Click API).
 *
 * This example shows:
 * 1. Setting up NEAR Intents adapter
 * 2. Preparing a swap with stealth recipient
 * 3. Getting quotes and executing swaps
 * 4. Tracking swap status
 *
 * Usage:
 *   NEAR_INTENTS_JWT=your_token npx ts-node examples/near-integration/02-cross-chain-swap.ts
 *
 * Note: NEAR Intents is MAINNET ONLY. Use dry mode for testing.
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  NEARIntentsAdapter,
  PrivacyLevel,
  type Asset,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const JWT_TOKEN = process.env.NEAR_INTENTS_JWT

// Whether to use dry mode (quotes only, no execution)
const DRY_MODE = !JWT_TOKEN || process.env.DRY_MODE === 'true'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: CROSS-CHAIN SWAP (NEAR INTENTS)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Mode: ${DRY_MODE ? 'DRY (quotes only)' : 'LIVE (real execution)'}`)
  console.log('')

  if (!JWT_TOKEN && !DRY_MODE) {
    console.log('NOTE: Set NEAR_INTENTS_JWT for live execution.')
    console.log('      Running in dry mode for demonstration.')
    console.log('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: SETUP ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Setup NEAR Intents adapter')
  console.log('─────────────────────────────────────────────────────────────────')

  const adapter = new NEARIntentsAdapter({
    jwtToken: JWT_TOKEN,
    defaultSlippage: 100, // 1%
    defaultDeadlineOffset: 3600, // 1 hour
  })

  console.log('Adapter configured:')
  console.log('  Slippage:  1%')
  console.log('  Deadline:  1 hour')
  console.log('')

  // Show supported assets
  console.log('Supported swap pairs (examples):')
  console.log('  ethereum:USDC → near:NEAR')
  console.log('  solana:SOL → ethereum:ETH')
  console.log('  near:NEAR → solana:USDC')
  console.log('  arbitrum:ETH → base:USDC')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE RECIPIENT META-ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate recipient stealth meta-address')
  console.log('─────────────────────────────────────────────────────────────────')

  // For ed25519 output chains (Solana, NEAR)
  const ed25519Recipient = generateStealthMetaAddress('near', 'NEAR Recipient')

  // For secp256k1 output chains (Ethereum, etc.)
  const secp256k1Recipient = generateStealthMetaAddress('ethereum', 'ETH Recipient')

  console.log('Recipients generated:')
  console.log(`  NEAR (ed25519):     ${truncate(ed25519Recipient.metaAddress.spendingKey)}`)
  console.log(`  Ethereum (secp256k1): ${truncate(secp256k1Recipient.metaAddress.spendingKey)}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: PREPARE SWAP
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Prepare swap with stealth recipient')
  console.log('─────────────────────────────────────────────────────────────────')

  // Example: Swap USDC on Ethereum to NEAR on NEAR Protocol
  const swapRequest = {
    requestId: `swap-${Date.now()}`,
    privacyLevel: PrivacyLevel.SHIELDED,
    inputAsset: { chain: 'ethereum', symbol: 'USDC' } as Asset,
    inputAmount: 100_000_000n, // 100 USDC (6 decimals)
    outputAsset: { chain: 'near', symbol: 'NEAR' } as Asset,
  }

  console.log('Swap request:')
  console.log(`  Input:   ${Number(swapRequest.inputAmount) / 1_000_000} USDC (Ethereum)`)
  console.log(`  Output:  NEAR (NEAR Protocol)`)
  console.log(`  Privacy: ${swapRequest.privacyLevel}`)
  console.log('')

  try {
    // Mock sender address (in production, this comes from connected wallet)
    const senderAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0aB12' // Example EVM address

    const prepared = await adapter.prepareSwap(
      swapRequest,
      ed25519Recipient.metaAddress,
      senderAddress
    )

    console.log('Swap prepared:')
    console.log(`  Stealth Address:  ${truncate(prepared.stealthAddress?.address || 'N/A')}`)
    console.log(`  Ephemeral Key:    ${truncate(prepared.stealthAddress?.ephemeralPublicKey || 'N/A')}`)
    console.log(`  Curve:            ${prepared.curve}`)
    console.log(`  Native Address:   ${truncate(prepared.nativeRecipientAddress || 'N/A', 12)}`)
    console.log('')

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 4: GET QUOTE
    // ═════════════════════════════════════════════════════════════════════════

    console.log('STEP 4: Get quote from 1Click API')
    console.log('─────────────────────────────────────────────────────────────────')

    if (DRY_MODE) {
      console.log('[DRY MODE] Getting dry quote (no execution)...')
      console.log('')

      // Simulate quote response
      const mockQuote = {
        quoteId: 'quote-mock-123',
        depositAddress: '0x1Click_Deposit_Address_Here',
        amountIn: swapRequest.inputAmount.toString(),
        amountOut: '25000000000000000000', // ~25 NEAR (mock)
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }

      console.log('Quote received (mock):')
      console.log(`  Quote ID:        ${mockQuote.quoteId}`)
      console.log(`  Deposit Address: ${mockQuote.depositAddress}`)
      console.log(`  Amount In:       ${Number(mockQuote.amountIn) / 1_000_000} USDC`)
      console.log(`  Amount Out:      ~${Number(mockQuote.amountOut) / 1e18} NEAR`)
      console.log(`  Expires:         ${mockQuote.expiresAt}`)
      console.log('')

      console.log('To execute:')
      console.log(`  1. Send ${Number(mockQuote.amountIn) / 1_000_000} USDC to ${mockQuote.depositAddress}`)
      console.log('  2. Call adapter.notifyDeposit(depositAddress, txHash)')
      console.log('  3. Call adapter.waitForCompletion(depositAddress)')
      console.log('  4. Recipient scans for payment at stealth address')
      console.log('')
    } else {
      // Real quote
      const quote = await adapter.getQuote(prepared)

      console.log('Quote received:')
      console.log(`  Quote ID:        ${quote.quoteId}`)
      console.log(`  Deposit Address: ${quote.depositAddress}`)
      console.log(`  Amount In:       ${Number(quote.amountIn) / 1_000_000} USDC`)
      console.log(`  Amount Out:      ~${Number(quote.amountOut) / 1e24} NEAR`)
      console.log('')

      console.log('To execute:')
      console.log(`  1. Send USDC to ${quote.depositAddress}`)
      console.log('  2. Notify 1Click of deposit')
      console.log('  3. Wait for completion')
      console.log('')
    }

  } catch (error) {
    console.error('Preparation failed:', error instanceof Error ? error.message : error)
    console.log('')
    console.log('Common issues:')
    console.log('  - Invalid JWT token')
    console.log('  - Unsupported asset pair')
    console.log('  - Address format mismatch')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: SWAP FLOW OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Complete swap flow')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Complete cross-chain swap with privacy:

┌─────────────────────────────────────────────────────────────────────────────┐
│  1. PREPARE                                                                 │
│     - Generate stealth meta-address (recipient)                             │
│     - Create swap request with privacy level                                │
│     - Generate stealth address for output chain                             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. QUOTE                                                                   │
│     - Call 1Click API for quote                                             │
│     - Receive deposit address and expected output                           │
│     - Quote valid for ~1 hour                                               │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. DEPOSIT                                                                 │
│     - User sends input tokens to deposit address                            │
│     - Notify 1Click of deposit transaction                                  │
│     - Wait for deposit confirmation                                         │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. SETTLEMENT                                                              │
│     - Defuse solver network executes swap                                   │
│     - Output tokens sent to stealth address                                 │
│     - Announcement emitted for recipient scanning                           │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. CLAIM                                                                   │
│     - Recipient scans for payment                                           │
│     - Derives stealth private key                                           │
│     - Claims tokens to main wallet                                          │
└─────────────────────────────────────────────────────────────────────────────┘
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('NEAR Intents + SIP Protocol:')
  console.log('  ✓ Cross-chain swaps with privacy')
  console.log('  ✓ Stealth addresses on any output chain')
  console.log('  ✓ No link between input and output chains')
  console.log('  ✓ Supports 10+ chains and 50+ assets')
  console.log('')
  console.log('Privacy levels:')
  console.log('  - TRANSPARENT: Direct recipient address')
  console.log('  - SHIELDED:    Stealth address recipient')
  console.log('  - COMPLIANT:   Stealth + viewing key')
  console.log('')
  console.log('Important:')
  console.log('  - 1Click API is MAINNET ONLY')
  console.log('  - Use dry mode for testing')
  console.log('  - Match curve to output chain (ed25519 vs secp256k1)')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
