/**
 * 01-basic-stealth-transfer.ts
 *
 * Demonstrates sending SPL tokens privately to a stealth address.
 *
 * This example shows:
 * 1. Generating a stealth meta-address (recipient)
 * 2. Creating a one-time stealth address (sender)
 * 3. Sending SPL tokens to the stealth address
 * 4. Viewing the transaction on explorer
 *
 * Usage:
 *   npx ts-node examples/solana-integration/01-basic-stealth-transfer.ts
 *
 * @packageDocumentation
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  sendPrivateSPLTransfer,
  type StealthMetaAddress,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const CLUSTER = process.env.CLUSTER || 'devnet'
const RPC_URL = process.env.RPC_URL || `https://api.${CLUSTER}.solana.com`

// USDC devnet mint address
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

// Amount to send (5 USDC = 5_000_000 with 6 decimals)
const AMOUNT = 5_000_000n

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: BASIC STEALTH TRANSFER (SOLANA)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Cluster: ${CLUSTER}`)
  console.log(`RPC:     ${RPC_URL}`)
  console.log('')

  // Initialize connection
  const connection = new Connection(RPC_URL, 'confirmed')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: RECIPIENT SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Recipient generates stealth meta-address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate a stealth meta-address for the recipient
  // This is done ONCE and shared publicly (like a regular address)
  const recipientKeys = generateStealthMetaAddress('solana', 'Demo Wallet')

  console.log('Meta-address generated:')
  console.log(`  Chain:       ${recipientKeys.metaAddress.chain}`)
  console.log(`  Label:       ${recipientKeys.metaAddress.label}`)
  console.log(`  Spending:    ${truncate(recipientKeys.metaAddress.spendingKey)}`)
  console.log(`  Viewing:     ${truncate(recipientKeys.metaAddress.viewingKey)}`)
  console.log('')

  // Encode for sharing (this is what recipients share publicly)
  const encodedAddress = encodeStealthMetaAddress(recipientKeys.metaAddress)
  console.log('Shareable meta-address:')
  console.log(`  ${encodedAddress.slice(0, 60)}...`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SENDER SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Sender prepares transaction')
  console.log('─────────────────────────────────────────────────────────────────')

  // In a real app, the sender would use their connected wallet
  // For demo purposes, we'll check if a keypair file exists or use a mock

  // Try to load sender keypair from environment
  const senderSecret = process.env.SENDER_PRIVATE_KEY
  let sender: Keypair | null = null

  if (senderSecret) {
    try {
      const secretKey = Uint8Array.from(JSON.parse(senderSecret))
      sender = Keypair.fromSecretKey(secretKey)
      console.log(`Sender address: ${sender.publicKey.toBase58()}`)
    } catch {
      console.log('Invalid SENDER_PRIVATE_KEY format')
    }
  }

  if (!sender) {
    console.log('No sender keypair provided.')
    console.log('')
    console.log('To run with real transactions:')
    console.log('  1. Export your Solana keypair:')
    console.log('     solana config get keypair')
    console.log('  2. Set SENDER_PRIVATE_KEY environment variable')
    console.log('  3. Ensure you have SOL and USDC on devnet')
    console.log('')
    console.log('Continuing with mock transaction...')
    console.log('')

    // Create a mock sender for demonstration
    sender = Keypair.generate()
  }

  // Get sender's USDC token account
  const senderATA = getAssociatedTokenAddressSync(USDC_MINT, sender.publicKey)
  console.log(`Sender token account: ${senderATA.toBase58()}`)
  console.log('')

  // Check sender balance (optional, for feedback)
  try {
    const balance = await connection.getBalance(sender.publicKey)
    console.log(`SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`)
  } catch {
    console.log('Could not fetch balance (expected if mock sender)')
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SEND PRIVATE TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Send private SPL transfer')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`Amount:    ${Number(AMOUNT) / 1_000_000} USDC`)
  console.log(`Recipient: (stealth address - unlinkable to meta-address)`)
  console.log('')

  // Skip actual transaction if no real sender
  if (!process.env.SENDER_PRIVATE_KEY) {
    console.log('[MOCK MODE] Skipping actual transaction')
    console.log('')
    console.log('What would happen:')
    console.log('  1. Generate one-time stealth address from meta-address')
    console.log('  2. Create/get Associated Token Account for stealth address')
    console.log('  3. Transfer USDC to stealth address')
    console.log('  4. Emit memo with ephemeral key for scanning')
    console.log('')
    printSummary(recipientKeys.metaAddress, null)
    return
  }

  try {
    // Send the private transfer
    const result = await sendPrivateSPLTransfer({
      connection,
      sender: sender.publicKey,
      senderTokenAccount: senderATA,
      recipientMetaAddress: recipientKeys.metaAddress,
      mint: USDC_MINT,
      amount: AMOUNT,
      signTransaction: async (tx) => {
        tx.sign(sender)
        return tx
      },
    })

    console.log('Transfer successful!')
    console.log('')
    console.log(`  Transaction:        ${result.txSignature}`)
    console.log(`  Stealth Address:    ${result.stealthAddress}`)
    console.log(`  Ephemeral Key:      ${result.ephemeralPublicKey}`)
    console.log(`  View Tag:           0x${result.viewTag}`)
    console.log('')
    console.log(`  Explorer: ${result.explorerUrl}`)
    console.log('')

    printSummary(recipientKeys.metaAddress, result.stealthAddress)
  } catch (error) {
    console.error('Transfer failed:', error instanceof Error ? error.message : error)
    console.log('')
    console.log('Common issues:')
    console.log('  - Insufficient SOL for transaction fees')
    console.log('  - Insufficient USDC balance')
    console.log('  - RPC rate limits')
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function printSummary(metaAddress: StealthMetaAddress, stealthAddress: string | null) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Privacy achieved:')
  console.log('  ✓ Each payment uses a unique one-time address')
  console.log('  ✓ Stealth address cannot be linked to meta-address')
  console.log('  ✓ Only recipient can find and claim the payment')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Recipient scans for payments (02-scan-and-claim.ts)')
  console.log('  2. Recipient derives private key and claims funds')
  console.log('  3. Funds moved to recipient\'s main wallet')
  console.log('')
  if (stealthAddress) {
    console.log(`Stealth address to scan: ${stealthAddress}`)
  }
  console.log('')
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
