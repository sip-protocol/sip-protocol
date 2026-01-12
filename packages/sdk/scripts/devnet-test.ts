#!/usr/bin/env npx tsx
/**
 * Solana Devnet Integration Test
 *
 * Demonstrates end-to-end stealth transfer flow on Solana devnet:
 * 1. Generate wallets and stealth meta-address
 * 2. Airdrop devnet SOL
 * 3. Execute private SPL transfer (WSOL)
 * 4. Scan for incoming payments
 * 5. Claim the payment
 *
 * Usage:
 *   npx tsx scripts/devnet-test.ts
 *
 * Requirements:
 *   - Internet connection to Solana devnet
 *   - No API keys needed (uses public RPC)
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from '@solana/web3.js'
import {
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  getAccount,
} from '@solana/spl-token'

import {
  generateStealthMetaAddress,
  sendPrivateSPLTransfer,
  scanForPayments,
  claimStealthPayment,
  SOLANA_RPC_ENDPOINTS,
  getSolanaExplorerUrl,
} from '../src'

// Configuration
const RPC_ENDPOINT = SOLANA_RPC_ENDPOINTS.devnet
const TRANSFER_AMOUNT = 0.01 * LAMPORTS_PER_SOL // 0.01 SOL per transfer
const NUM_TRANSFERS = 3

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log()
  log(`${'='.repeat(60)}`, colors.cyan)
  log(`  ${title}`, colors.bright)
  log(`${'='.repeat(60)}`, colors.cyan)
}

async function main() {
  log('\n  SIP Protocol - Solana Devnet Integration Test', colors.bright)
  log('  =============================================\n', colors.cyan)

  // Initialize connection
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')
  log(`RPC Endpoint: ${RPC_ENDPOINT}`, colors.blue)

  // ============================================================
  // STEP 1: Generate Wallets
  // ============================================================
  logSection('Step 1: Generate Wallets')

  // Sender wallet (will sign transactions)
  const sender = Keypair.generate()
  log(`Sender Address: ${sender.publicKey.toBase58()}`, colors.green)

  // Recipient stealth meta-address
  const recipient = generateStealthMetaAddress('solana', 'Devnet Test Recipient')
  log(`Recipient Spending Key: ${recipient.metaAddress.spendingKey.slice(0, 20)}...`, colors.green)
  log(`Recipient Viewing Key: ${recipient.metaAddress.viewingKey.slice(0, 20)}...`, colors.green)

  // Destination wallet for claiming (separate from stealth addresses)
  const destination = Keypair.generate()
  log(`Claim Destination: ${destination.publicKey.toBase58()}`, colors.green)

  // ============================================================
  // STEP 2: Airdrop Devnet SOL
  // ============================================================
  logSection('Step 2: Airdrop Devnet SOL')

  const airdropAmount = 2 * LAMPORTS_PER_SOL
  log(`Requesting ${airdropAmount / LAMPORTS_PER_SOL} SOL airdrop...`, colors.yellow)

  try {
    const airdropSig = await connection.requestAirdrop(sender.publicKey, airdropAmount)
    await connection.confirmTransaction(airdropSig, 'confirmed')
    log(`Airdrop confirmed: ${airdropSig.slice(0, 20)}...`, colors.green)

    const balance = await connection.getBalance(sender.publicKey)
    log(`Sender balance: ${balance / LAMPORTS_PER_SOL} SOL`, colors.green)
  } catch (error) {
    log(`Airdrop failed (rate limited?). Trying alternative...`, colors.red)
    // Wait and retry
    await sleep(2000)
    const airdropSig = await connection.requestAirdrop(sender.publicKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction(airdropSig, 'confirmed')
    log(`Smaller airdrop confirmed`, colors.yellow)
  }

  // ============================================================
  // STEP 3: Setup WSOL (Wrapped SOL) for SPL Transfer
  // ============================================================
  logSection('Step 3: Setup Wrapped SOL (WSOL)')

  // Get sender's WSOL ATA
  const senderWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, sender.publicKey)

  // Create ATA and wrap SOL
  const wrapAmount = BigInt(Math.floor(0.5 * LAMPORTS_PER_SOL))
  log(`Wrapping ${Number(wrapAmount) / LAMPORTS_PER_SOL} SOL to WSOL...`, colors.yellow)

  const wrapTx = new Transaction()

  // Create ATA if needed
  try {
    await getAccount(connection, senderWsolAta)
    log('WSOL ATA already exists', colors.green)
  } catch {
    wrapTx.add(
      createAssociatedTokenAccountInstruction(
        sender.publicKey,
        senderWsolAta,
        sender.publicKey,
        NATIVE_MINT
      )
    )
    log('Creating WSOL ATA...', colors.yellow)
  }

  // Transfer SOL to WSOL ATA and sync
  wrapTx.add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: senderWsolAta,
      lamports: wrapAmount,
    }),
    createSyncNativeInstruction(senderWsolAta)
  )

  const { blockhash } = await connection.getLatestBlockhash()
  wrapTx.recentBlockhash = blockhash
  wrapTx.feePayer = sender.publicKey
  wrapTx.sign(sender)

  const wrapSig = await connection.sendRawTransaction(wrapTx.serialize())
  await connection.confirmTransaction(wrapSig, 'confirmed')
  log(`WSOL wrapped: ${wrapSig.slice(0, 20)}...`, colors.green)

  // ============================================================
  // STEP 4: Execute Private Transfers
  // ============================================================
  logSection(`Step 4: Execute ${NUM_TRANSFERS} Private Transfers`)

  const transferResults: Array<{
    txSignature: string
    stealthAddress: string
    ephemeralPublicKey: string
    explorerUrl: string
    amount: bigint
  }> = []

  for (let i = 0; i < NUM_TRANSFERS; i++) {
    log(`\nTransfer ${i + 1}/${NUM_TRANSFERS}:`, colors.bright)

    const amount = BigInt(TRANSFER_AMOUNT)

    try {
      const result = await sendPrivateSPLTransfer({
        connection,
        sender: sender.publicKey,
        senderTokenAccount: senderWsolAta,
        recipientMetaAddress: recipient.metaAddress,
        mint: NATIVE_MINT,
        amount,
        signTransaction: async (tx) => {
          if ('partialSign' in tx) {
            tx.partialSign(sender)
          } else {
            tx.sign([sender])
          }
          return tx
        },
      })

      transferResults.push({
        ...result,
        amount,
      })

      log(`  TX: ${result.txSignature}`, colors.green)
      log(`  Stealth Address: ${result.stealthAddress}`, colors.cyan)
      log(`  Explorer: ${result.explorerUrl}`, colors.blue)

      // Small delay between transfers
      await sleep(1000)
    } catch (error) {
      log(`  Transfer failed: ${error}`, colors.red)
    }
  }

  log(`\nCompleted ${transferResults.length}/${NUM_TRANSFERS} transfers`, colors.bright)

  // ============================================================
  // STEP 5: Scan for Payments
  // ============================================================
  logSection('Step 5: Scan for Incoming Payments')

  log('Scanning blockchain for stealth payments...', colors.yellow)

  // Wait for transactions to finalize
  await sleep(3000)

  const payments = await scanForPayments({
    connection,
    viewingPrivateKey: recipient.viewingPrivateKey,
    spendingPublicKey: recipient.metaAddress.spendingKey,
    limit: 10,
  })

  log(`Found ${payments.length} payments:`, colors.green)
  for (const payment of payments) {
    log(`  - ${Number(payment.amount) / LAMPORTS_PER_SOL} WSOL at ${payment.stealthAddress.slice(0, 20)}...`, colors.cyan)
    log(`    TX: ${payment.txSignature.slice(0, 30)}...`, colors.blue)
  }

  // ============================================================
  // STEP 6: Claim Payments
  // ============================================================
  logSection('Step 6: Claim Payments')

  // First, airdrop some SOL to destination for rent
  log('Airdropping SOL to destination wallet for fees...', colors.yellow)
  try {
    const destAirdrop = await connection.requestAirdrop(
      destination.publicKey,
      0.1 * LAMPORTS_PER_SOL
    )
    await connection.confirmTransaction(destAirdrop, 'confirmed')
    log('Destination funded', colors.green)
  } catch {
    log('Destination airdrop failed (may already have funds)', colors.yellow)
  }

  const claimResults: Array<{ txSignature: string; amount: bigint }> = []

  for (let i = 0; i < Math.min(payments.length, 1); i++) {
    const payment = payments[i]
    log(`\nClaiming payment ${i + 1}:`, colors.bright)
    log(`  From stealth: ${payment.stealthAddress.slice(0, 20)}...`, colors.cyan)

    try {
      const claimResult = await claimStealthPayment({
        connection,
        stealthAddress: payment.stealthAddress,
        ephemeralPublicKey: payment.ephemeralPublicKey,
        viewingPrivateKey: recipient.viewingPrivateKey,
        spendingPrivateKey: recipient.spendingPrivateKey,
        destinationAddress: destination.publicKey.toBase58(),
        mint: NATIVE_MINT,
      })

      claimResults.push({
        txSignature: claimResult.txSignature,
        amount: claimResult.amount,
      })

      log(`  Claimed: ${claimResult.txSignature}`, colors.green)
      log(`  Amount: ${Number(claimResult.amount) / LAMPORTS_PER_SOL} WSOL`, colors.green)
      log(`  Explorer: ${claimResult.explorerUrl}`, colors.blue)
    } catch (error) {
      log(`  Claim failed: ${error}`, colors.red)
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  logSection('Summary')

  log('\nTransfer Results:', colors.bright)
  log('-'.repeat(50), colors.cyan)
  for (let i = 0; i < transferResults.length; i++) {
    const r = transferResults[i]
    log(`${i + 1}. TX: ${r.txSignature}`, colors.green)
    log(`   Amount: ${Number(r.amount) / LAMPORTS_PER_SOL} WSOL`, colors.cyan)
    log(`   Explorer: ${r.explorerUrl}`, colors.blue)
  }

  log('\nClaim Results:', colors.bright)
  log('-'.repeat(50), colors.cyan)
  for (let i = 0; i < claimResults.length; i++) {
    const r = claimResults[i]
    log(`${i + 1}. TX: ${r.txSignature}`, colors.green)
    log(`   Amount: ${Number(r.amount) / LAMPORTS_PER_SOL} WSOL`, colors.cyan)
    log(`   Explorer: ${getSolanaExplorerUrl(r.txSignature, 'devnet')}`, colors.blue)
  }

  log('\n' + '='.repeat(60), colors.cyan)
  log('  Devnet Integration Test Complete!', colors.bright)
  log('='.repeat(60) + '\n', colors.cyan)

  // Output for documentation
  console.log('\n--- TRANSACTION SIGNATURES FOR DOCUMENTATION ---')
  console.log('Transfers:')
  transferResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.txSignature}`)
  })
  console.log('Claims:')
  claimResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.txSignature}`)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Run
main().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})
