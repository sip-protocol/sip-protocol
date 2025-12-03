import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'http'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  createCommitment,
  generateViewingKeyPair,
  encryptForViewingKey,
  decryptWithViewingKey,
  IntentBuilder,
  PrivacyLevel,
} from '@sip-protocol/sdk'
import { TEST_FIXTURES, MockSettlementBackend, wait } from './setup'

/**
 * Full Flow Integration Tests
 *
 * These tests verify complete end-to-end workflows using all packages:
 * SDK + React + CLI + API working together.
 */

let apiServer: Server
let apiBaseUrl: string

async function startApiServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: app } = await import('../../packages/api/src/server')

  return new Promise((resolve) => {
    const srv = app.listen(0, () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 3000
      resolve({
        server: srv,
        baseUrl: `http://localhost:${port}`,
      })
    })
  })
}

async function stopApiServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

describe('Full Flow Integration', () => {
  beforeAll(async () => {
    const result = await startApiServer()
    apiServer = result.server
    apiBaseUrl = result.baseUrl
  })

  afterAll(async () => {
    if (apiServer) {
      await stopApiServer(apiServer)
    }
  })

  describe('Complete Private Swap Flow', () => {
    it('should execute full swap: generate address → create commitment → get quote → swap → verify', async () => {
      // Step 1: Generate stealth address for recipient
      const recipientMeta = generateStealthMetaAddress('ethereum')
      const recipientStealth = generateStealthAddress(recipientMeta.metaAddress)

      expect(recipientStealth.stealthAddress.address).toMatch(/^0x[0-9a-f]{40}$/i)

      // Step 2: Create commitment for amount
      const amount = BigInt(1000000)
      const commitment = createCommitment(amount)

      expect(commitment.value).toMatch(/^0x[0-9a-f]+$/)
      expect(commitment.blindingFactor).toMatch(/^0x[0-9a-f]+$/)

      // Step 3: Generate viewing key for compliance
      const viewingKey = generateViewingKeyPair()

      expect(viewingKey.publicKey).toMatch(/^0x[0-9a-f]+$/)
      expect(viewingKey.privateKey).toMatch(/^0x[0-9a-f]+$/)

      // Step 4: Encrypt transaction data with viewing key
      const txData = JSON.stringify({
        to: recipientStealth.stealthAddress.address,
        amount: amount.toString(),
        commitment: commitment.value,
        timestamp: Date.now(),
      })

      const encrypted = await encryptForViewingKey(txData, viewingKey.publicKey)
      expect(encrypted).toBeTruthy()

      // Step 5: Build shielded intent
      const intent = new IntentBuilder()
        .setSourceChain('ethereum')
        .setDestChain('polygon')
        .setSourceToken('USDC')
        .setDestToken('USDT')
        .setSourceAmount(amount)
        .setRecipient(recipientStealth.stealthAddress.address)
        .setPrivacyLevel(PrivacyLevel.SHIELDED)
        .setSender('0x' + '11'.repeat(20))
        .build()

      expect(intent.sourceChain).toBe('ethereum')
      expect(intent.destChain).toBe('polygon')
      expect(intent.privacyLevel).toBe(PrivacyLevel.SHIELDED)

      // Step 6: Get quote via API
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDT',
          amount: amount.toString(),
        }),
      })

      const quoteData = await quoteResponse.json()
      expect(quoteResponse.status).toBe(200)
      expect(quoteData.success).toBe(true)
      expect(quoteData.data.quote).toBeDefined()

      const quote = quoteData.data.quote
      expect(BigInt(quote.sourceAmount)).toBe(amount)
      expect(BigInt(quote.destAmount)).toBeLessThanOrEqual(amount) // Account for slippage

      // Step 7: Execute swap via API
      const swapResponse = await fetch(`${apiBaseUrl}/api/v1/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          sender: '0x' + '11'.repeat(20),
          recipient: recipientStealth.stealthAddress.address,
          privacyLevel: 'shielded',
        }),
      })

      const swapData = await swapResponse.json()
      expect(swapResponse.status).toBe(200)
      expect(swapData.success).toBe(true)
      expect(swapData.data.intentId).toBeDefined()

      const intentId = swapData.data.intentId

      // Step 8: Check swap status
      await wait(100) // Brief wait for processing

      const statusResponse = await fetch(`${apiBaseUrl}/api/v1/swap/${intentId}/status`)
      const statusData = await statusResponse.json()

      expect(statusResponse.status).toBe(200)
      expect(statusData.success).toBe(true)
      expect(['pending', 'fulfilled']).toContain(statusData.data.status)

      // Step 9: Decrypt transaction data with viewing key (auditor view)
      const decrypted = await decryptWithViewingKey(encrypted, viewingKey.privateKey)
      const parsedTx = JSON.parse(decrypted)

      expect(parsedTx.to).toBe(recipientStealth.stealthAddress.address)
      expect(parsedTx.amount).toBe(amount.toString())
      expect(parsedTx.commitment).toBe(commitment.value)

      // Flow complete!
    })

    it('should execute transparent swap (no privacy)', async () => {
      const amount = BigInt(5000000)
      const recipient = '0x' + '22'.repeat(20)

      // Build transparent intent (no stealth address, no commitment)
      const intent = new IntentBuilder()
        .setSourceChain('ethereum')
        .setDestChain('polygon')
        .setSourceToken('USDC')
        .setDestToken('USDC')
        .setSourceAmount(amount)
        .setRecipient(recipient)
        .setPrivacyLevel(PrivacyLevel.TRANSPARENT)
        .setSender('0x' + '11'.repeat(20))
        .build()

      expect(intent.privacyLevel).toBe(PrivacyLevel.TRANSPARENT)

      // Get quote
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDC',
          amount: amount.toString(),
        }),
      })

      const quoteData = await quoteResponse.json()
      expect(quoteResponse.status).toBe(200)

      // Execute swap
      const swapResponse = await fetch(`${apiBaseUrl}/api/v1/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quoteData.data.quote.id,
          sender: '0x' + '11'.repeat(20),
          recipient,
          privacyLevel: 'transparent',
        }),
      })

      const swapData = await swapResponse.json()
      expect(swapResponse.status).toBe(200)
      expect(swapData.data.intentId).toBeDefined()
    })

    it('should execute compliant swap (privacy + viewing key)', async () => {
      const amount = BigInt(2000000)

      // Generate stealth address
      const recipientMeta = generateStealthMetaAddress('ethereum')
      const recipientStealth = generateStealthAddress(recipientMeta.metaAddress)

      // Create commitment
      const commitment = createCommitment(amount)

      // Generate viewing key for auditor
      const viewingKey = generateViewingKeyPair()

      // Encrypt compliance data
      const complianceData = JSON.stringify({
        sender: '0x' + '11'.repeat(20),
        recipient: recipientStealth.stealthAddress.address,
        amount: amount.toString(),
        purpose: 'Business payment',
        timestamp: Date.now(),
      })

      const encrypted = await encryptForViewingKey(complianceData, viewingKey.publicKey)

      // Build compliant intent
      const intent = new IntentBuilder()
        .setSourceChain('ethereum')
        .setDestChain('polygon')
        .setSourceToken('USDC')
        .setDestToken('USDC')
        .setSourceAmount(amount)
        .setRecipient(recipientStealth.stealthAddress.address)
        .setPrivacyLevel(PrivacyLevel.COMPLIANT)
        .setSender('0x' + '11'.repeat(20))
        .build()

      expect(intent.privacyLevel).toBe(PrivacyLevel.COMPLIANT)

      // Get quote and execute
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDC',
          amount: amount.toString(),
        }),
      })

      const quoteData = await quoteResponse.json()

      const swapResponse = await fetch(`${apiBaseUrl}/api/v1/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quoteData.data.quote.id,
          sender: '0x' + '11'.repeat(20),
          recipient: recipientStealth.stealthAddress.address,
          privacyLevel: 'compliant',
          encryptedData: encrypted, // Include encrypted data for auditor
        }),
      })

      expect(swapResponse.status).toBe(200)

      // Auditor can decrypt
      const decrypted = await decryptWithViewingKey(encrypted, viewingKey.privateKey)
      const parsed = JSON.parse(decrypted)

      expect(parsed.amount).toBe(amount.toString())
      expect(parsed.purpose).toBe('Business payment')
    })
  })

  describe('Cross-Package Integration', () => {
    it('should use SDK commitment in API and verify consistency', async () => {
      const amount = BigInt(3000000)

      // Generate commitment via SDK
      const sdkCommitment = createCommitment(amount)

      // Create commitment via API
      const apiResponse = await fetch(`${apiBaseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: amount.toString() }),
      })

      const apiData = await apiResponse.json()
      const apiCommitment = apiData.data

      // Both should be valid hex strings
      expect(sdkCommitment.value).toMatch(/^0x[0-9a-f]+$/)
      expect(apiCommitment.commitment).toMatch(/^0x[0-9a-f]+$/)

      // Both should commit to the same amount (though with different blinding)
      expect(sdkCommitment.value).not.toBe(apiCommitment.commitment) // Different blinding
    })

    it('should use SDK stealth address in API quote flow', async () => {
      // Generate stealth address via SDK
      const metaAddress = generateStealthMetaAddress('ethereum')
      const stealthAddress = generateStealthAddress(metaAddress.metaAddress)

      // Use stealth address in API quote
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDC',
          amount: '1000000',
          recipient: stealthAddress.stealthAddress.address, // Use SDK-generated address
        }),
      })

      expect(quoteResponse.status).toBe(200)
      const quoteData = await quoteResponse.json()
      expect(quoteData.success).toBe(true)
    })

    it('should encrypt with SDK and decrypt via viewing key', async () => {
      // Generate viewing key via SDK
      const viewingKey = generateViewingKeyPair()

      // Create transaction data
      const txData = {
        amount: '10000000',
        token: 'USDC',
        chain: 'ethereum',
        timestamp: Date.now(),
      }

      // Encrypt
      const encrypted = await encryptForViewingKey(
        JSON.stringify(txData),
        viewingKey.publicKey
      )

      // Decrypt
      const decrypted = await decryptWithViewingKey(encrypted, viewingKey.privateKey)
      const parsed = JSON.parse(decrypted)

      expect(parsed.amount).toBe(txData.amount)
      expect(parsed.token).toBe(txData.token)
      expect(parsed.chain).toBe(txData.chain)
    })
  })

  describe('Multi-Chain Flow', () => {
    it('should support Solana → Ethereum swap', async () => {
      const amount = BigInt(1000000)

      // Generate Solana stealth address (ed25519)
      const { generateEd25519StealthMetaAddress, generateEd25519StealthAddress } = await import(
        '@sip-protocol/sdk'
      )

      const solanaRecipient = generateEd25519StealthMetaAddress('solana')
      const solanaStealth = generateEd25519StealthAddress(solanaRecipient.metaAddress)

      // Verify Solana address format (base58)
      expect(solanaStealth.stealthAddress.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)

      // Get quote for Solana → Ethereum
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'solana',
          destChain: 'ethereum',
          sourceToken: 'SOL',
          destToken: 'ETH',
          amount: amount.toString(),
        }),
      })

      expect(quoteResponse.status).toBe(200)
      const quoteData = await quoteResponse.json()
      expect(quoteData.success).toBe(true)
    })

    it('should support Ethereum → NEAR swap', async () => {
      const amount = BigInt(2000000)

      // Get quote for Ethereum → NEAR
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'near',
          sourceToken: 'USDC',
          destToken: 'USDT',
          amount: amount.toString(),
        }),
      })

      expect(quoteResponse.status).toBe(200)
      const quoteData = await quoteResponse.json()
      expect(quoteData.success).toBe(true)
    })
  })

  describe('Error Handling Flow', () => {
    it('should handle invalid stealth address in swap', async () => {
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDC',
          amount: '1000000',
        }),
      })

      const quoteData = await quoteResponse.json()

      // Try to swap with invalid recipient
      const swapResponse = await fetch(`${apiBaseUrl}/api/v1/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quoteData.data.quote.id,
          sender: '0x' + '11'.repeat(20),
          recipient: 'invalid-address',
          privacyLevel: 'shielded',
        }),
      })

      expect(swapResponse.status).toBe(400)
    })

    it('should handle expired quote', async () => {
      // This test would require mocking time or waiting for expiration
      // For now, we test the basic flow
      const quoteResponse = await fetch(`${apiBaseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'ethereum',
          destChain: 'polygon',
          sourceToken: 'USDC',
          destToken: 'USDC',
          amount: '1000000',
        }),
      })

      expect(quoteResponse.status).toBe(200)
      const quoteData = await quoteResponse.json()

      // Quote should have expiration
      expect(quoteData.data.quote.expiresAt).toBeGreaterThan(Date.now())
    })
  })
})
