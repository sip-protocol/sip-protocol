/**
 * 02-scan-and-claim.ts
 *
 * Demonstrates scanning for incoming stealth payments and claiming funds.
 *
 * This example shows:
 * 1. Setting up scanning parameters
 * 2. Scanning the blockchain for incoming payments
 * 3. Deriving the private key for matched payments
 * 4. Claiming funds to the recipient's main wallet
 *
 * Usage:
 *   npx ts-node examples/solana-integration/02-scan-and-claim.ts
 *
 * @packageDocumentation
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  generateStealthMetaAddress,
  scanForPayments,
  claimStealthPayment,
  checkEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const CLUSTER = process.env.CLUSTER || 'devnet'
const RPC_URL = process.env.RPC_URL || `https://api.${CLUSTER}.solana.com`

// How many recent slots to scan (more = slower but more thorough)
const SCAN_LIMIT = 100

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: SCAN AND CLAIM PAYMENTS (SOLANA)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Cluster: ${CLUSTER}`)
  console.log(`RPC:     ${RPC_URL}`)
  console.log('')

  const connection = new Connection(RPC_URL, 'confirmed')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: RECIPIENT SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Load recipient keys')
  console.log('─────────────────────────────────────────────────────────────────')

  // In production, these would be securely stored keys
  // For demo, we generate fresh keys (won't find any payments)
  const recipientKeys = generateStealthMetaAddress('solana', 'Scanner Wallet')

  console.log('Recipient keys loaded:')
  console.log(`  Spending Public:  ${truncate(recipientKeys.metaAddress.spendingKey)}`)
  console.log(`  Viewing Public:   ${truncate(recipientKeys.metaAddress.viewingKey)}`)
  console.log(`  Spending Private: ${truncate(recipientKeys.spendingPrivateKey)}`)
  console.log(`  Viewing Private:  ${truncate(recipientKeys.viewingPrivateKey)}`)
  console.log('')

  // Destination wallet for claimed funds
  // In production, this would be the user's main wallet
  const destinationWallet = Keypair.generate()
  console.log(`Destination wallet: ${destinationWallet.publicKey.toBase58()}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SCAN FOR PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Scan for incoming payments')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`Scanning last ${SCAN_LIMIT} memo transactions...`)
  console.log('')

  try {
    const payments = await scanForPayments({
      connection,
      viewingPrivateKey: recipientKeys.viewingPrivateKey,
      spendingPublicKey: recipientKeys.metaAddress.spendingKey,
      limit: SCAN_LIMIT,
    })

    if (payments.length === 0) {
      console.log('No payments found.')
      console.log('')
      console.log('This is expected with fresh keys.')
      console.log('To test with real payments:')
      console.log('  1. Run 01-basic-stealth-transfer.ts with SENDER_PRIVATE_KEY')
      console.log('  2. Use the same recipient keys here')
      console.log('')

      // Continue with mock example
      demonstrateScanningLogic(recipientKeys)
      return
    }

    console.log(`Found ${payments.length} payment(s)!`)
    console.log('')

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i]
      console.log(`Payment ${i + 1}:`)
      console.log(`  Stealth Address:  ${payment.stealthAddress}`)
      console.log(`  Amount:           ${formatTokenAmount(payment.amount, payment.tokenSymbol)}`)
      console.log(`  Token:            ${payment.tokenSymbol}`)
      console.log(`  Slot:             ${payment.slot}`)
      console.log(`  Transaction:      ${payment.txSignature}`)
      console.log('')
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 3: CLAIM PAYMENTS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('STEP 3: Claim payments')
    console.log('─────────────────────────────────────────────────────────────────')

    for (const payment of payments) {
      console.log(`Claiming ${formatTokenAmount(payment.amount, payment.tokenSymbol)}...`)

      try {
        const result = await claimStealthPayment({
          connection,
          stealthAddress: payment.stealthAddress,
          ephemeralPublicKey: payment.ephemeralPublicKey,
          viewingPrivateKey: recipientKeys.viewingPrivateKey,
          spendingPrivateKey: recipientKeys.spendingPrivateKey,
          destinationAddress: destinationWallet.publicKey.toBase58(),
          mint: new PublicKey(payment.mint),
        })

        console.log('  Claimed successfully!')
        console.log(`  Transaction: ${result.txSignature}`)
        console.log(`  Explorer:    ${result.explorerUrl}`)
        console.log('')
      } catch (error) {
        console.error(`  Claim failed: ${error instanceof Error ? error.message : error}`)
        console.log('')
      }
    }

    printSummary(payments.length)
  } catch (error) {
    console.error('Scan failed:', error instanceof Error ? error.message : error)
    console.log('')
    console.log('Common issues:')
    console.log('  - RPC rate limits (try a premium endpoint)')
    console.log('  - Network connectivity')
    console.log('')

    // Show mock example anyway
    demonstrateScanningLogic(recipientKeys)
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Demonstrate the scanning logic without network calls
 */
function demonstrateScanningLogic(recipientKeys: ReturnType<typeof generateStealthMetaAddress>) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SCANNING LOGIC DEMONSTRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // Simulate a payment by generating a stealth address
  const { generateEd25519StealthAddress } = require('@sip-protocol/sdk')
  const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(recipientKeys.metaAddress)

  console.log('Simulated payment received:')
  console.log(`  Stealth Address:     ${truncate(stealthAddress.address)}`)
  console.log(`  Ephemeral Key:       ${truncate(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:            0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  // Step 1: View tag check (fast, eliminates ~99.6% of non-matches)
  console.log('Step 1: View tag check')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log('  View tag is first byte of shared secret hash.')
  console.log('  This allows fast filtering without full EC computation.')
  console.log(`  Expected tag: 0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  // Step 2: Full verification
  console.log('Step 2: Full stealth address check')
  console.log('─────────────────────────────────────────────────────────────────')

  const isOurs = checkEd25519StealthAddress(
    stealthAddress,
    recipientKeys.spendingPrivateKey,
    recipientKeys.viewingPrivateKey
  )

  console.log(`  Result: ${isOurs ? '✓ MATCH - Payment is ours!' : '✗ Not ours'}`)
  console.log('')

  // Step 3: Key derivation
  if (isOurs) {
    console.log('Step 3: Derive private key')
    console.log('─────────────────────────────────────────────────────────────────')

    const recovery = deriveEd25519StealthPrivateKey(
      stealthAddress,
      recipientKeys.spendingPrivateKey,
      recipientKeys.viewingPrivateKey
    )

    console.log('  Private key derived successfully!')
    console.log(`  Stealth Address: ${truncate(recovery.stealthAddress)}`)
    console.log(`  Private Key:     ${truncate(recovery.privateKey)}`)
    console.log('')
    console.log('  This private key can now sign transactions to move funds.')
    console.log('')
  }

  printSummary(0)
}

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatTokenAmount(amount: bigint, symbol: string): string {
  // Assume 6 decimals for most tokens
  const decimals = symbol === 'SOL' ? 9 : 6
  const formatted = Number(amount) / Math.pow(10, decimals)
  return `${formatted.toLocaleString()} ${symbol}`
}

function printSummary(claimedCount: number) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Scanning process:')
  console.log('  1. Query memo program for SIP announcements')
  console.log('  2. Parse ephemeral key and view tag from each')
  console.log('  3. Quick filter using view tag (1 byte check)')
  console.log('  4. Full EC computation only for tag matches')
  console.log('  5. Derive private key for confirmed payments')
  console.log('')
  console.log('Privacy maintained:')
  console.log('  ✓ Only viewing key holder can identify payments')
  console.log('  ✓ Stealth addresses appear as normal addresses')
  console.log('  ✓ No link between payments and meta-address')
  console.log('')
  if (claimedCount > 0) {
    console.log(`Claimed ${claimedCount} payment(s) successfully!`)
    console.log('')
  }
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
