/**
 * Helius Webhook Server Example
 *
 * Real-time stealth payment detection using Helius webhooks.
 * This example demonstrates how to set up an Express.js server
 * that receives Helius webhook notifications and detects
 * stealth payments using the SIP Protocol.
 *
 * Run with: npx tsx examples/helius-webhook-server.ts
 *
 * Setup:
 * 1. Deploy this server to a public URL
 * 2. Go to https://dev.helius.xyz/webhooks
 * 3. Create a webhook with:
 *    - URL: https://your-server.com/webhook/helius
 *    - Type: raw (required for SIP announcements)
 *    - Transaction Type: Any (or TRANSFER)
 *
 * Bounty: Solana Privacy Hack - Helius Track ($5,000)
 * Issue: https://github.com/sip-protocol/sip-protocol/issues/447
 */

import {
  createWebhookHandler,
  processWebhookTransaction,
  generateEd25519StealthMetaAddress,
  type HeliusWebhookPayload,
  type SolanaScanResult,
  type HeliusWebhookTransaction,
} from '../src'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000

// Generate recipient keys for demo (in production, load from secure storage)
const recipientKeys = generateEd25519StealthMetaAddress('solana')

console.log('========================================================')
console.log('   SIP Protocol + Helius: Webhook Server Demo')
console.log('   Solana Privacy Hack - Helius Track ($5,000)')
console.log('========================================================\n')

console.log('Recipient Keys (Demo):')
console.log(`  Meta Address: sip:solana:${recipientKeys.metaAddress.spendingKey.slice(0, 16)}...:${recipientKeys.metaAddress.viewingKey.slice(0, 16)}...`)
console.log(`  Viewing Key: ${recipientKeys.viewingPrivateKey.slice(0, 20)}...`)
console.log()

// ─────────────────────────────────────────────────────────────────────────────
// Payment Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentFound(payment: SolanaScanResult): Promise<void> {
  console.log('\n==============================================')
  console.log('   STEALTH PAYMENT DETECTED!')
  console.log('==============================================\n')

  console.log('Payment Details:')
  console.log(`  Stealth Address: ${payment.stealthAddress}`)
  console.log(`  Amount: ${payment.amount} ${payment.tokenSymbol || 'tokens'}`)
  console.log(`  Mint: ${payment.mint}`)
  console.log(`  Tx Signature: ${payment.txSignature}`)
  console.log(`  Slot: ${payment.slot}`)
  console.log(`  Timestamp: ${new Date((payment.timestamp || 0) * 1000).toISOString()}`)
  console.log()

  // In production, you would:
  // 1. Save to database
  // 2. Notify the user (push notification, email, etc.)
  // 3. Queue the claim transaction
  // 4. Update UI in real-time

  console.log('Actions to take:')
  console.log('  1. Save payment to database')
  console.log('  2. Notify user')
  console.log('  3. Queue claim transaction')
  console.log()
}

function handleError(error: Error, transaction?: HeliusWebhookTransaction): void {
  console.error('\nWebhook Processing Error:')
  console.error(`  Error: ${error.message}`)
  if (transaction) {
    const sig = transaction.transaction?.signatures?.[0] || 'unknown'
    console.error(`  Transaction: ${sig}`)
  }
  console.error()
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Webhook Handler
// ─────────────────────────────────────────────────────────────────────────────

const webhookHandler = createWebhookHandler({
  viewingPrivateKey: recipientKeys.viewingPrivateKey,
  spendingPublicKey: recipientKeys.metaAddress.spendingKey,
  onPaymentFound: handlePaymentFound,
  onError: handleError,
})

// ─────────────────────────────────────────────────────────────────────────────
// Express Server Setup
// ─────────────────────────────────────────────────────────────────────────────

// Note: In a real application, you would use:
// import express from 'express'
// const app = express()

// For this demo, we'll use a simple HTTP server
import { createServer, IncomingMessage, ServerResponse } from 'http'

function parseJSON(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  // Webhook endpoint
  if (req.method === 'POST' && req.url === '/webhook/helius') {
    try {
      console.log('\n--- Incoming Webhook ---')
      console.log(`Time: ${new Date().toISOString()}`)

      const payload = await parseJSON(req) as HeliusWebhookPayload

      // Process the webhook
      const results = await webhookHandler(payload)

      // Log results
      const found = results.filter(r => r.found)
      console.log(`Processed: ${results.length} transactions`)
      console.log(`Payments found: ${found.length}`)

      for (const result of results) {
        console.log(`  ${result.signature.slice(0, 16)}... - ${result.found ? 'FOUND' : 'not ours'}`)
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        processed: results.length,
        found: found.length,
      }))
    } catch (error) {
      console.error('Webhook error:', error)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to process webhook' }))
    }
    return
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ─────────────────────────────────────────────────────────────────────────────
// Alternative: Using processWebhookTransaction directly
// ─────────────────────────────────────────────────────────────────────────────

async function processTransactionDirectly(tx: HeliusWebhookTransaction): Promise<SolanaScanResult | null> {
  // Lower-level function for custom webhook handling
  return processWebhookTransaction(
    tx,
    recipientKeys.viewingPrivateKey,
    recipientKeys.metaAddress.spendingKey
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('Server Configuration:')
  console.log(`  Port: ${PORT}`)
  console.log(`  Health: http://localhost:${PORT}/health`)
  console.log(`  Webhook: http://localhost:${PORT}/webhook/helius`)
  console.log()

  console.log('Helius Dashboard Setup:')
  console.log('  1. Go to https://dev.helius.xyz/webhooks')
  console.log('  2. Create a new webhook:')
  console.log(`     - URL: https://your-domain.com/webhook/helius`)
  console.log('     - Type: raw (required for SIP announcements)')
  console.log('     - Transaction Type: Any')
  console.log('  3. Save and test')
  console.log()

  console.log('Waiting for webhooks...')
  console.log('(Press Ctrl+C to stop)\n')
})

// ─────────────────────────────────────────────────────────────────────────────
// Test with Mock Data
// ─────────────────────────────────────────────────────────────────────────────

// Uncomment to test with mock data:
/*
setTimeout(async () => {
  console.log('\n--- Testing with mock transaction ---\n')

  const mockTx: HeliusWebhookTransaction = {
    blockTime: Math.floor(Date.now() / 1000),
    slot: 250000000,
    meta: {
      err: null,
      fee: 5000,
      innerInstructions: [],
      logMessages: [
        'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr invoke [1]',
        'Program log: SIP:1:TestEphemeralKey123456789012345678:ab:TestStealthAddress12345678901234567',
        'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr success',
      ],
      postBalances: [1000000000],
      preBalances: [1500000000],
      postTokenBalances: [
        {
          accountIndex: 0,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          uiTokenAmount: {
            amount: '1000000',
            decimals: 6,
            uiAmount: 1.0,
            uiAmountString: '1.0',
          },
        },
      ],
      preTokenBalances: [],
      rewards: [],
    },
    transaction: {
      message: {
        accountKeys: ['sender', 'recipient'],
        instructions: [],
        recentBlockhash: 'blockhash123',
      },
      signatures: ['test-signature-' + Date.now()],
    },
  }

  const results = await webhookHandler(mockTx)
  console.log('Mock test results:', results)
}, 2000)
*/

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...')
  server.close(() => {
    console.log('Server stopped.')
    process.exit(0)
  })
})
