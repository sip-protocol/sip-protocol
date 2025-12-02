/**
 * Zcash RPC Integration Tests
 *
 * These tests connect to a REAL zcashd node.
 * They are skipped by default unless ZCASH_RPC_* environment variables are set.
 *
 * To run:
 *   ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass pnpm test -- tests/zcash/rpc-integration.test.ts --run
 *
 * See docs/guides/ZCASH-TESTNET.md for setup instructions.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ZcashRPCClient } from '../../src/zcash/rpc-client'

// Check if RPC credentials are configured
const RPC_CONFIGURED =
  process.env.ZCASH_RPC_USER &&
  process.env.ZCASH_RPC_PASS

// Skip reason for better test output
const SKIP_REASON = 'Zcash RPC not configured. Set ZCASH_RPC_USER and ZCASH_RPC_PASS to enable.'

describe.skipIf(!RPC_CONFIGURED)('ZcashRPCClient Integration', () => {
  let client: ZcashRPCClient
  let isConnected = false

  beforeAll(async () => {
    client = new ZcashRPCClient({
      host: process.env.ZCASH_RPC_HOST || '127.0.0.1',
      port: parseInt(process.env.ZCASH_RPC_PORT || '18232', 10),
      username: process.env.ZCASH_RPC_USER!,
      password: process.env.ZCASH_RPC_PASS!,
      testnet: process.env.ZCASH_TESTNET !== 'false',
      timeout: 30000,
      retries: 2,
    })

    // Test connection
    try {
      await client.getBlockCount()
      isConnected = true
    } catch {
      console.warn('⚠️  Could not connect to zcashd. Integration tests will fail.')
      isConnected = false
    }
  })

  describe('Connection', () => {
    it('should connect to zcashd node', async () => {
      expect(isConnected).toBe(true)
    })

    it('should get block count', async () => {
      const blockCount = await client.getBlockCount()
      expect(blockCount).toBeGreaterThan(0)
      expect(typeof blockCount).toBe('number')
    })

    it('should get blockchain info', async () => {
      const info = await client.getBlockchainInfo()

      expect(info).toBeDefined()
      expect(info.chain).toBeDefined()
      expect(['main', 'test', 'regtest']).toContain(info.chain)
      expect(info.blocks).toBeGreaterThan(0)
      expect(info.verificationprogress).toBeGreaterThan(0)
    })

    it('should get network info', async () => {
      const info = await client.getNetworkInfo()

      expect(info).toBeDefined()
      expect(info.version).toBeGreaterThan(0)
      expect(info.subversion).toBeDefined()
    })

    it('should identify testnet correctly', async () => {
      const info = await client.getBlockchainInfo()
      const isTestnet = client.isTestnet

      if (info.chain === 'test') {
        expect(isTestnet).toBe(true)
      } else if (info.chain === 'main') {
        expect(isTestnet).toBe(false)
      }
    })
  })

  describe('Account Operations', () => {
    it('should list addresses', async () => {
      const addresses = await client.listAddresses()

      expect(Array.isArray(addresses)).toBe(true)
      // May be empty if no addresses created yet
    })

    it('should get or create address for account 0', async () => {
      // Try to get address for account 0
      // This will create the account if it doesn't exist
      let addressInfo
      try {
        addressInfo = await client.getAddressForAccount(0)
      } catch {
        // Account doesn't exist, create it first
        await client.createAccount()
        addressInfo = await client.getAddressForAccount(0)
      }

      expect(addressInfo).toBeDefined()
      expect(addressInfo.account).toBe(0)
      expect(addressInfo.address).toBeDefined()
      expect(typeof addressInfo.address).toBe('string')
      expect(addressInfo.address.length).toBeGreaterThan(20)
    })

    it('should get balance for account', async () => {
      const balance = await client.getAccountBalance(0)

      expect(balance).toBeDefined()
      expect(balance.pools).toBeDefined()
      // Pools may be empty or have zero balance
      if (balance.pools.transparent) {
        expect(typeof balance.pools.transparent.valueZat).toBe('number')
      }
      if (balance.pools.sapling) {
        expect(typeof balance.pools.sapling.valueZat).toBe('number')
      }
      if (balance.pools.orchard) {
        expect(typeof balance.pools.orchard.valueZat).toBe('number')
      }
    })
  })

  describe('Address Operations', () => {
    it('should validate a unified address', async () => {
      // Get a real address to validate
      let addressInfo
      try {
        addressInfo = await client.getAddressForAccount(0)
      } catch {
        await client.createAccount()
        addressInfo = await client.getAddressForAccount(0)
      }

      const validation = await client.validateAddress(addressInfo.address)

      expect(validation).toBeDefined()
      expect(validation.isvalid).toBe(true)
    })

    it('should reject invalid address', async () => {
      const validation = await client.validateAddress('invalid-address-here')

      expect(validation).toBeDefined()
      expect(validation.isvalid).toBe(false)
    })
  })

  describe('Block Operations', () => {
    it('should get block by height', async () => {
      const block = await client.getBlock(1)

      expect(block).toBeDefined()
      expect(block.height).toBe(1)
      expect(block.hash).toBeDefined()
    })

    it('should get block header', async () => {
      const header = await client.getBlockHeader(1)

      expect(header).toBeDefined()
      expect(header.height).toBe(1)
      expect(header.hash).toBeDefined()
      expect(header.previousblockhash).toBeDefined()
    })

    it('should get hash for latest block', async () => {
      const blockCount = await client.getBlockCount()
      const hash = await client.getBlockHash(blockCount)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(64) // SHA256 hex string
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid method gracefully', async () => {
      // This test verifies the client handles errors properly
      await expect(
        client.validateAddress('')
      ).rejects.toThrow()
    })
  })
})

// Log skip reason if tests are skipped
if (!RPC_CONFIGURED) {
  console.log(`\n⚠️  ${SKIP_REASON}\n`)
}
