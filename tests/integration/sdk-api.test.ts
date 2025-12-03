import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'http'
import {
  generateStealthMetaAddress,
  commit,
  verifyOpening,
} from '@sip-protocol/sdk'
import { TEST_FIXTURES } from './setup'

/**
 * Integration Tests: SDK + REST API
 *
 * These tests verify that the REST API correctly uses SDK functions
 * and returns valid responses.
 */

let server: Server
let baseUrl: string

// Dynamically import app to avoid module issues
async function startServer(): Promise<{ server: Server; baseUrl: string }> {
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

async function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

describe('SDK + REST API Integration', () => {
  beforeAll(async () => {
    const result = await startServer()
    server = result.server
    baseUrl = result.baseUrl
  })

  afterAll(async () => {
    if (server) {
      await stopServer(server)
    }
  })

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await fetch(`${baseUrl}/`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('@sip-protocol/api')
      expect(data.endpoints).toBeDefined()
    })
  })

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('healthy')
    })
  })

  describe('POST /api/v1/stealth/generate', () => {
    it('should generate valid stealth address using SDK', async () => {
      const metaAddress = generateStealthMetaAddress('ethereum')

      const response = await fetch(`${baseUrl}/api/v1/stealth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'ethereum',
          recipientMetaAddress: metaAddress.metaAddress,
        }),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.stealthAddress).toBeDefined()

      const { stealthAddress } = data.data

      // Verify address format (Ethereum address)
      expect(stealthAddress.address).toMatch(/^0x[0-9a-f]{40}$/i)

      // Verify ephemeral public key format
      expect(stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]+$/)

      // Verify view tag exists
      expect(stealthAddress.viewTag).toBeDefined()
    })

    it('should generate different addresses for each request', async () => {
      const metaAddress = generateStealthMetaAddress('ethereum')

      const response1 = await fetch(`${baseUrl}/api/v1/stealth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'ethereum',
          recipientMetaAddress: metaAddress.metaAddress,
        }),
      })

      const response2 = await fetch(`${baseUrl}/api/v1/stealth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'ethereum',
          recipientMetaAddress: metaAddress.metaAddress,
        }),
      })

      const data1 = await response1.json()
      const data2 = await response2.json()

      expect(data1.data.stealthAddress.address).not.toBe(
        data2.data.stealthAddress.address
      )
    })

    it('should reject invalid meta-address', async () => {
      const response = await fetch(`${baseUrl}/api/v1/stealth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'ethereum',
          recipientMetaAddress: {
            chain: 'ethereum',
            spendingKey: 'invalid',
            viewingKey: 'invalid',
          },
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/v1/commitment/create', () => {
    it('should create valid Pedersen commitment using SDK', async () => {
      const value = '1000000'

      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.commitment).toBeDefined()
      expect(data.data.blindingFactor).toBeDefined()

      // Verify commitment format
      expect(data.data.commitment).toMatch(/^0x[0-9a-f]+$/)
      expect(data.data.blindingFactor).toMatch(/^0x[0-9a-f]+$/)

      // Verify commitment is valid using SDK
      const isValid = verifyOpening(
        data.data.commitment,
        BigInt(value),
        data.data.blindingFactor
      )
      expect(isValid).toBe(true)
    })

    it('should create commitment with custom blinding factor', async () => {
      const value = '5000000'
      const customBlinding = '0x' + '11'.repeat(32)

      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          blindingFactor: customBlinding,
        }),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.blindingFactor).toBe(customBlinding)
    })

    it('should create different commitments for same value', async () => {
      const value = '1000000'

      const response1 = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })

      const response2 = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })

      const data1 = await response1.json()
      const data2 = await response2.json()

      // Different random blinding factors = different commitments
      expect(data1.data.commitment).not.toBe(data2.data.commitment)
      expect(data1.data.blindingFactor).not.toBe(data2.data.blindingFactor)
    })

    it('should reject invalid value', async () => {
      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: 'not-a-number',
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/v1/proof/funding', () => {
    it('should generate funding proof using SDK', async () => {
      const response = await fetch(`${baseUrl}/api/v1/proof/funding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: '10000000',
          minimumRequired: '1000000',
          assetId: 'ETH',
          userAddress: '0x' + '00'.repeat(20),
        }),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.proof).toBeDefined()
      expect(data.data.publicInputs).toBeDefined()
      expect(data.data.framework).toBeDefined()

      // Should use mock framework
      expect(data.data.framework).toBe('mock')
    })

    it('should reject invalid balance', async () => {
      const response = await fetch(`${baseUrl}/api/v1/proof/funding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: 'invalid',
          minimumRequired: '1000000',
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('API error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${baseUrl}/api/v1/unknown`)

      expect(response.status).toBe(404)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })

    it('should handle malformed JSON', async () => {
      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      expect(response.status).toBe(400)
    })
  })

  describe('API + SDK consistency', () => {
    it('should generate same commitment format as SDK', async () => {
      const value = BigInt(1000000)

      // Generate via SDK
      const sdkCommitment = commit(value)

      // Generate via API
      const response = await fetch(`${baseUrl}/api/v1/commitment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: value.toString() }),
      })

      const data = await response.json()

      // Both should be valid hex strings
      expect(sdkCommitment.commitment).toMatch(/^0x[0-9a-f]+$/)
      expect(data.data.commitment).toMatch(/^0x[0-9a-f]+$/)

      // API commitment should be verifiable with SDK
      const isValid = verifyOpening(
        data.data.commitment,
        value,
        data.data.blindingFactor
      )
      expect(isValid).toBe(true)
    })

    it('should generate compatible stealth addresses', async () => {
      // Generate meta-address via SDK
      const sdkMeta = generateStealthMetaAddress('ethereum')

      // Generate stealth address via API
      const response = await fetch(`${baseUrl}/api/v1/stealth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'ethereum',
          recipientMetaAddress: sdkMeta.metaAddress,
        }),
      })

      const data = await response.json()

      // Should have same format as SDK output
      expect(data.data.stealthAddress.address).toMatch(/^0x[0-9a-f]{40}$/i)
      expect(data.data.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]+$/)
    })
  })
})
