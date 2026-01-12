/**
 * Private Payment Example
 *
 * Demonstrates sending and receiving private payments using SIP stealth addresses.
 *
 * Flow:
 * 1. Recipient generates a stealth meta-address (publish this)
 * 2. Sender creates a one-time stealth address for payment
 * 3. Recipient scans for incoming payments
 * 4. Recipient derives private key to claim funds
 *
 * Usage:
 *   npx ts-node examples/private-payment/index.ts
 */

import {
  // Stealth address functions (secp256k1 for EVM chains)
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  publicKeyToEthAddress,
  // Types
  type StealthMetaAddress,
  type StealthAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const CHAIN = 'ethereum' as const
const SAMPLE_PAYMENT_COUNT = 5 // Number of simulated payments to scan

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Private Payment Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ─── Step 1: Recipient Setup ──────────────────────────────────────────────

  console.log('STEP 1: Recipient generates stealth meta-address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate a new stealth meta-address for the recipient
  // This is done ONCE and can be shared publicly
  const recipientKeys = generateStealthMetaAddress(CHAIN, 'Alice Wallet')

  console.log('Recipient meta-address generated:')
  console.log(`  Chain: ${recipientKeys.metaAddress.chain}`)
  console.log(`  Label: ${recipientKeys.metaAddress.label}`)
  console.log(`  Spending Key: ${truncateHex(recipientKeys.metaAddress.spendingKey)}`)
  console.log(`  Viewing Key:  ${truncateHex(recipientKeys.metaAddress.viewingKey)}`)
  console.log('')

  // Encode for sharing (this is what you'd publish or share with senders)
  const encodedMetaAddress = encodeStealthMetaAddress(recipientKeys.metaAddress)
  console.log('Shareable meta-address:')
  console.log(`  ${encodedMetaAddress.slice(0, 50)}...`)
  console.log('')

  // Verify encoding/decoding works
  const decoded = decodeStealthMetaAddress(encodedMetaAddress)
  console.log('Meta-address decoded successfully:', decoded.chain === CHAIN ? '✓' : '✗')
  console.log('')

  // ─── Step 2: Sender Creates Payment ───────────────────────────────────────

  console.log('STEP 2: Sender creates private payment')
  console.log('─────────────────────────────────────────────────────────────────')

  // Sender generates a one-time stealth address from the recipient's meta-address
  const { stealthAddress, sharedSecret } = generateStealthAddress(
    recipientKeys.metaAddress
  )

  // Convert the stealth public key to an Ethereum address
  const ethAddress = publicKeyToEthAddress(stealthAddress.address)

  console.log('Stealth address generated:')
  console.log(`  Stealth Address:      ${truncateHex(stealthAddress.address)}`)
  console.log(`  Ethereum Address:     ${ethAddress}`)
  console.log(`  Ephemeral Public Key: ${truncateHex(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:             0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  console.log('What to do:')
  console.log(`  1. Send ETH/tokens to: ${ethAddress}`)
  console.log(`  2. Publish ephemeral key: ${truncateHex(stealthAddress.ephemeralPublicKey)}`)
  console.log(`     (This allows the recipient to find the payment)`)
  console.log('')

  // ─── Step 3: Recipient Scans for Payments ─────────────────────────────────

  console.log('STEP 3: Recipient scans for incoming payments')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate a list of published stealth addresses (from an announcement log)
  // In production, this would come from an on-chain event log or indexer
  const publishedPayments = generateDummyPayments(SAMPLE_PAYMENT_COUNT - 1)

  // Add our real payment somewhere in the list
  publishedPayments.splice(2, 0, stealthAddress)

  console.log(`Scanning ${publishedPayments.length} published payments...`)
  console.log('')

  let foundPayment: StealthAddress | null = null
  let scannedCount = 0

  for (const payment of publishedPayments) {
    scannedCount++

    // Quick check using view tag (optimization)
    // This avoids full EC computation for most non-matching payments
    const matches = checkStealthAddress(
      payment,
      recipientKeys.spendingPrivateKey,
      recipientKeys.viewingPrivateKey
    )

    if (matches) {
      foundPayment = payment
      console.log(`  [${scannedCount}/${publishedPayments.length}] ✓ PAYMENT FOUND!`)
      console.log(`      Address: ${truncateHex(payment.address)}`)
      break
    } else {
      console.log(`  [${scannedCount}/${publishedPayments.length}] ✗ Not ours`)
    }
  }

  console.log('')

  if (!foundPayment) {
    console.error('Error: Payment not found in scan!')
    process.exit(1)
  }

  // ─── Step 4: Recipient Claims Funds ───────────────────────────────────────

  console.log('STEP 4: Recipient derives private key to claim funds')
  console.log('─────────────────────────────────────────────────────────────────')

  // Derive the private key for the stealth address
  const recovery = deriveStealthPrivateKey(
    foundPayment,
    recipientKeys.spendingPrivateKey,
    recipientKeys.viewingPrivateKey
  )

  console.log('Recovery data:')
  console.log(`  Stealth Address:  ${truncateHex(recovery.stealthAddress)}`)
  console.log(`  Private Key:      ${truncateHex(recovery.privateKey)}`)
  console.log(`  Ephemeral Key:    ${truncateHex(recovery.ephemeralPublicKey)}`)
  console.log('')

  console.log('What to do next:')
  console.log('  1. Import the private key into a wallet (MetaMask, etc.)')
  console.log('  2. Sign a transaction to move funds to your main wallet')
  console.log('  3. The stealth address is used only once - funds are now accessible')
  console.log('')

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Privacy achieved:')
  console.log('  ✓ Sender cannot be linked to recipient')
  console.log('  ✓ Each payment uses a unique one-time address')
  console.log('  ✓ Recipient\'s main address never appears on-chain')
  console.log('  ✓ Only recipient can find and claim their payments')
  console.log('')
  console.log('For amount privacy, combine with Pedersen commitments.')
  console.log('See examples/compliance/ for selective disclosure with viewing keys.')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Truncate a hex string for display
 */
function truncateHex(hex: HexString, chars: number = 10): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

/**
 * Generate dummy stealth addresses for scanning example
 * These won't match the recipient's keys
 */
function generateDummyPayments(count: number): StealthAddress[] {
  const payments: StealthAddress[] = []

  for (let i = 0; i < count; i++) {
    // Generate a random stealth meta-address (won't match our recipient)
    const dummy = generateStealthMetaAddress(CHAIN)
    const { stealthAddress } = generateStealthAddress(dummy.metaAddress)
    payments.push(stealthAddress)
  }

  return payments
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
