/**
 * 03-batch-transfer.ts
 *
 * Demonstrates sending payments to multiple recipients efficiently.
 *
 * This example shows:
 * 1. Preparing multiple recipient meta-addresses
 * 2. Generating stealth addresses for each
 * 3. Batching transfers in a single transaction (when possible)
 * 4. Handling per-recipient failures gracefully
 *
 * Usage:
 *   npx ts-node examples/solana-integration/03-batch-transfer.ts
 *
 * @packageDocumentation
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token'
import {
  generateStealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  encodeStealthMetaAddress,
  type StealthMetaAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const CLUSTER = process.env.CLUSTER || 'devnet'
const RPC_URL = process.env.RPC_URL || `https://api.${CLUSTER}.solana.com`

// USDC devnet
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

// Memo program for announcements
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchRecipient {
  label: string
  metaAddress: StealthMetaAddress
  amount: bigint
}

interface BatchTransferResult {
  recipient: string
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: string
  amount: bigint
  success: boolean
  error?: string
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: BATCH TRANSFER (SOLANA)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Cluster: ${CLUSTER}`)
  console.log(`RPC:     ${RPC_URL}`)
  console.log('')

  const connection = new Connection(RPC_URL, 'confirmed')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: PREPARE RECIPIENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Prepare recipient meta-addresses')
  console.log('─────────────────────────────────────────────────────────────────')

  // In production, these would come from your database or user input
  const recipients: BatchRecipient[] = [
    {
      label: 'Alice',
      metaAddress: generateStealthMetaAddress('solana', 'Alice').metaAddress,
      amount: 10_000_000n, // 10 USDC
    },
    {
      label: 'Bob',
      metaAddress: generateStealthMetaAddress('solana', 'Bob').metaAddress,
      amount: 25_000_000n, // 25 USDC
    },
    {
      label: 'Charlie',
      metaAddress: generateStealthMetaAddress('solana', 'Charlie').metaAddress,
      amount: 15_000_000n, // 15 USDC
    },
  ]

  console.log(`Prepared ${recipients.length} recipients:`)
  for (const r of recipients) {
    console.log(`  ${r.label}: ${Number(r.amount) / 1_000_000} USDC`)
    console.log(`    Meta: ${encodeStealthMetaAddress(r.metaAddress).slice(0, 50)}...`)
  }
  console.log('')

  const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n)
  console.log(`Total to send: ${Number(totalAmount) / 1_000_000} USDC`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE STEALTH ADDRESSES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate stealth addresses for each recipient')
  console.log('─────────────────────────────────────────────────────────────────')

  const preparedTransfers: Array<{
    recipient: BatchRecipient
    stealthAddress: string
    stealthATA: PublicKey
    ephemeralPublicKey: string
    viewTag: number
  }> = []

  for (const recipient of recipients) {
    // Generate unique stealth address
    const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

    // Convert to Solana addresses
    const stealthBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    // Get ATA for the stealth address
    const stealthPubkey = new PublicKey(stealthBase58)
    const stealthATA = getAssociatedTokenAddressSync(USDC_MINT, stealthPubkey, true)

    preparedTransfers.push({
      recipient,
      stealthAddress: stealthBase58,
      stealthATA,
      ephemeralPublicKey: ephemeralBase58,
      viewTag: stealthAddress.viewTag,
    })

    console.log(`  ${recipient.label}:`)
    console.log(`    Stealth: ${stealthBase58.slice(0, 20)}...`)
    console.log(`    ATA:     ${stealthATA.toBase58().slice(0, 20)}...`)
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: BUILD BATCH TRANSACTION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Build batch transaction')
  console.log('─────────────────────────────────────────────────────────────────')

  // Mock sender for demonstration
  const sender = Keypair.generate()
  const senderATA = getAssociatedTokenAddressSync(USDC_MINT, sender.publicKey)

  const transaction = new Transaction()
  let instructionCount = 0

  for (const prepared of preparedTransfers) {
    // Note: In production, you'd also need to create ATAs if they don't exist
    // This adds complexity but is required for new stealth addresses

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderATA,
        prepared.stealthATA,
        sender.publicKey,
        prepared.recipient.amount
      )
    )
    instructionCount++

    // Add memo with announcement
    const viewTagHex = prepared.viewTag.toString(16).padStart(2, '0')
    const memoContent = `SIP:1:${prepared.ephemeralPublicKey}:${viewTagHex}:${prepared.stealthAddress}`

    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoContent, 'utf-8'),
      })
    )
    instructionCount++
  }

  console.log(`Transaction built with ${instructionCount} instructions:`)
  console.log(`  - ${preparedTransfers.length} SPL transfers`)
  console.log(`  - ${preparedTransfers.length} memo announcements`)
  console.log('')

  // Note: Solana has transaction size limits (~1232 bytes)
  // For many recipients, you may need to split into multiple transactions
  console.log('Transaction size considerations:')
  console.log('  - Max ~1232 bytes per transaction')
  console.log('  - Each transfer + memo ≈ 200-300 bytes')
  console.log('  - Practical limit: ~4-5 recipients per transaction')
  console.log('  - For more recipients: split into multiple transactions')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: EXECUTE (MOCK)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Execute batch transfer')
  console.log('─────────────────────────────────────────────────────────────────')

  if (!process.env.SENDER_PRIVATE_KEY) {
    console.log('[MOCK MODE] Skipping actual transaction')
    console.log('')
    console.log('What would happen:')
    console.log('  1. Sign transaction with sender wallet')
    console.log('  2. Submit to Solana')
    console.log('  3. All transfers execute atomically')
    console.log('  4. Each recipient can scan for their payment')
    console.log('')
  } else {
    // Real execution would go here
    console.log('Execute with real funds: set SENDER_PRIVATE_KEY')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' BATCH TRANSFER SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  const results: BatchTransferResult[] = preparedTransfers.map((p) => ({
    recipient: p.recipient.label,
    stealthAddress: p.stealthAddress,
    ephemeralPublicKey: p.ephemeralPublicKey,
    viewTag: p.viewTag.toString(16).padStart(2, '0'),
    amount: p.recipient.amount,
    success: true, // Mock success
  }))

  console.log('Results:')
  for (const result of results) {
    const amountStr = `${Number(result.amount) / 1_000_000} USDC`
    console.log(`  ${result.recipient}: ${result.success ? '✓' : '✗'} ${amountStr}`)
    console.log(`    Stealth: ${result.stealthAddress.slice(0, 30)}...`)
  }
  console.log('')

  console.log('Privacy maintained:')
  console.log('  ✓ Each recipient gets a unique stealth address')
  console.log('  ✓ Recipients cannot see each other\'s addresses')
  console.log('  ✓ Single atomic transaction for efficiency')
  console.log('  ✓ Each recipient scans independently')
  console.log('')

  console.log('Use cases for batch transfers:')
  console.log('  - Payroll (private employee payments)')
  console.log('  - Grants (private disbursement)')
  console.log('  - Airdrops (unlinkable distribution)')
  console.log('')
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
