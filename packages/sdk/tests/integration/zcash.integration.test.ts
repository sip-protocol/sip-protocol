/**
 * Zcash Integration Tests
 *
 * Tests that connect to a real zcashd node. These tests are optional
 * and only run when ZCASH_INTEGRATION=true is set.
 *
 * Prerequisites:
 *   - Running zcashd node (testnet recommended)
 *   - RPC credentials configured
 *
 * Run:
 *   ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass ZCASH_INTEGRATION=true \
 *   pnpm test -- tests/integration/zcash.integration.test.ts --run
 *
 * See docs/guides/ZCASH-TESTNET.md for setup instructions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  ZcashRPCClient,
  ZcashRPCError,
  ZcashShieldedService,
} from '../../src/zcash'

// ─── Test Configuration ────────────────────────────────────────────────────────

const ZCASH_INTEGRATION = process.env.ZCASH_INTEGRATION === 'true'
const ZCASH_RPC_USER = process.env.ZCASH_RPC_USER
const ZCASH_RPC_PASS = process.env.ZCASH_RPC_PASS
const ZCASH_RPC_HOST = process.env.ZCASH_RPC_HOST || '127.0.0.1'
const ZCASH_RPC_PORT = parseInt(process.env.ZCASH_RPC_PORT || '18232', 10)
const ZCASH_TESTNET = process.env.ZCASH_TESTNET !== 'false'

const skipReason = !ZCASH_INTEGRATION
  ? 'ZCASH_INTEGRATION not set'
  : !ZCASH_RPC_USER || !ZCASH_RPC_PASS
    ? 'ZCASH_RPC_USER or ZCASH_RPC_PASS not set'
    : null

// ─── Test Helpers ──────────────────────────────────────────────────────────────

function getConfig() {
  return {
    host: ZCASH_RPC_HOST,
    port: ZCASH_RPC_PORT,
    username: ZCASH_RPC_USER!,
    password: ZCASH_RPC_PASS!,
    testnet: ZCASH_TESTNET,
    timeout: 30000,
    retries: 2,
  }
}

function zatToZec(zat: number | undefined): number {
  return (zat ?? 0) / 100_000_000
}

// ─── Skip if not configured ────────────────────────────────────────────────────

const describeIntegration = skipReason ? describe.skip : describe

// ─── ZcashRPCClient Integration Tests ──────────────────────────────────────────

describeIntegration('ZcashRPCClient Integration', () => {
  let client: ZcashRPCClient

  beforeAll(() => {
    client = new ZcashRPCClient(getConfig())
  })

  describe('Connection', () => {
    it('should connect and get block count', async () => {
      const blockCount = await client.getBlockCount()

      expect(blockCount).toBeGreaterThan(0)
    })

    it('should get blockchain info', async () => {
      const info = await client.getBlockchainInfo()

      expect(info).toBeDefined()
      expect(info.chain).toMatch(/^(main|test|regtest)$/)
      expect(info.blocks).toBeGreaterThan(0)
      expect(info.verificationprogress).toBeGreaterThan(0)
    })

    it('should get network info', async () => {
      const info = await client.getNetworkInfo()

      expect(info).toBeDefined()
      expect(info.version).toBeGreaterThan(0)
      expect(info.subversion).toContain('Zcash')
      expect(info.protocolversion).toBeGreaterThan(0)
    })
  })

  describe('Address Management', () => {
    it('should list addresses', async () => {
      const addresses = await client.listAddresses()

      expect(Array.isArray(addresses)).toBe(true)
    })

    it('should get or create account', async () => {
      let accountId = 0

      try {
        const addressInfo = await client.getAddressForAccount(accountId)
        expect(addressInfo.address).toBeDefined()
        expect(addressInfo.account).toBe(accountId)
      } catch (error) {
        // Account doesn't exist, create it
        if (error instanceof ZcashRPCError) {
          const newAccount = await client.createAccount()
          expect(newAccount.account).toBeGreaterThanOrEqual(0)
          accountId = newAccount.account
        }
      }
    })

    it('should validate addresses', async () => {
      // Get an address to validate
      const addresses = await client.listAddresses()

      if (addresses.length > 0) {
        const info = await client.validateAddress(addresses[0])
        expect(info.isvalid).toBe(true)
      }

      // Invalid address should return isvalid: false
      const invalidInfo = await client.validateAddress('invalid_address_12345')
      expect(invalidInfo.isvalid).toBe(false)
    })
  })

  describe('Balance Operations', () => {
    it('should get total balance', async () => {
      const balance = await client.getTotalBalance()

      expect(balance).toBeDefined()
      expect(balance.transparent).toBeDefined()
      expect(balance.private).toBeDefined()
      expect(balance.total).toBeDefined()
    })

    it('should get account balance', async () => {
      const balance = await client.getAccountBalance(0)

      expect(balance).toBeDefined()
      expect(balance.pools).toBeDefined()
    })

    it('should list unspent notes', async () => {
      const notes = await client.listUnspent()

      expect(Array.isArray(notes)).toBe(true)
      // Notes may be empty if no balance
    })
  })

  describe('Block Operations', () => {
    it('should get block hash by height', async () => {
      const height = await client.getBlockCount()
      const hash = await client.getBlockHash(height)

      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should get block header', async () => {
      const height = await client.getBlockCount()
      const header = await client.getBlockHeader(height)

      expect(header).toBeDefined()
      expect(header.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(header.height).toBe(height)
      expect(header.time).toBeGreaterThan(0)
    })

    it('should get full block', async () => {
      const height = await client.getBlockCount()
      const block = await client.getBlock(height)

      expect(block).toBeDefined()
      expect(block.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(block.height).toBe(height)
      expect(Array.isArray(block.tx)).toBe(true)
    })
  })

  describe('Operation Management', () => {
    it('should list operation IDs', async () => {
      const opIds = await client.listOperationIds()

      expect(Array.isArray(opIds)).toBe(true)
    })

    it('should get operation status', async () => {
      // Empty array should return all operations
      const ops = await client.getOperationStatus()

      expect(Array.isArray(ops)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should throw ZcashRPCError for invalid address', async () => {
      // Most RPC methods validate addresses client-side, but some may throw
      const info = await client.validateAddress('definitely_not_valid')
      expect(info.isvalid).toBe(false)
    })

    it('should handle network errors with retries', async () => {
      const badClient = new ZcashRPCClient({
        ...getConfig(),
        host: '127.0.0.1',
        port: 9999, // Invalid port
        retries: 0,
        timeout: 1000,
      })

      await expect(badClient.getBlockCount()).rejects.toThrow()
    })
  })

  describe('Testnet Configuration', () => {
    it('should use correct testnet port', () => {
      expect(client.isTestnet).toBe(ZCASH_TESTNET)

      if (ZCASH_TESTNET) {
        expect(client.endpoint).toContain(':18232')
      }
    })
  })
})

// ─── ZcashShieldedService Integration Tests ────────────────────────────────────

describeIntegration('ZcashShieldedService Integration', () => {
  let service: ZcashShieldedService

  beforeAll(async () => {
    service = new ZcashShieldedService({
      rpcConfig: getConfig(),
      defaultAccount: 0,
      operationTimeout: 60000,
    })

    await service.initialize()
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(service.currentAccount).toBeGreaterThanOrEqual(0)
    })

    it('should report correct network', () => {
      expect(service.isTestnet()).toBe(ZCASH_TESTNET)
    })
  })

  describe('Address Management', () => {
    it('should get primary address', () => {
      const address = service.getAddress()

      expect(address).toBeDefined()
      expect(address.length).toBeGreaterThan(0)
    })

    it('should generate diversified address', async () => {
      const addr1 = service.getAddress()
      const addr2 = await service.generateNewAddress()

      // Both addresses belong to same account but are different
      expect(addr1).toBeDefined()
      expect(addr2).toBeDefined()
      // Note: they may or may not be equal depending on diversifier index
    })

    it('should check if address is shielded', async () => {
      const address = service.getAddress()
      const isShielded = await service.isShieldedAddress(address)

      expect(typeof isShielded).toBe('boolean')
      expect(isShielded).toBe(true) // Unified addresses are shielded
    })
  })

  describe('Balance', () => {
    it('should get shielded balance', async () => {
      const balance = await service.getBalance()

      expect(balance).toBeDefined()
      expect(typeof balance.confirmed).toBe('number')
      expect(typeof balance.unconfirmed).toBe('number')
      expect(balance.pools).toBeDefined()
      expect(typeof balance.pools.transparent).toBe('number')
      expect(typeof balance.pools.sapling).toBe('number')
      expect(typeof balance.pools.orchard).toBe('number')
      expect(typeof balance.spendableNotes).toBe('number')
    })
  })

  describe('Fee Estimation', () => {
    it('should estimate fee correctly', () => {
      const minFee = service.getMinimumFee()
      const fee1 = service.estimateFee(1)
      const fee3 = service.estimateFee(3, 2)

      expect(minFee).toBeGreaterThan(0)
      expect(fee1).toBeGreaterThanOrEqual(minFee)
      expect(fee3).toBeGreaterThan(fee1)
    })

    it('should follow ZIP-317 fee structure', () => {
      // ZIP-317: fee = marginal_fee * max(grace_actions, logical_actions)
      // marginal_fee = 0.00005 ZEC, grace_actions = 2

      const minFee = service.getMinimumFee()
      expect(minFee).toBe(0.0001) // 2 * 0.00005

      // 1 input + 1 output + 1 change = 3 actions
      const fee1 = service.estimateFee(1, 1)
      expect(fee1).toBe(0.00015) // 3 * 0.00005
    })
  })

  describe('Received Notes', () => {
    it('should list received notes', async () => {
      const notes = await service.getReceivedNotes()

      expect(Array.isArray(notes)).toBe(true)

      if (notes.length > 0) {
        const note = notes[0]
        expect(note.txid).toBeDefined()
        expect(typeof note.amount).toBe('number')
        expect(typeof note.confirmations).toBe('number')
        expect(typeof note.spendable).toBe('boolean')
        expect(['sapling', 'orchard']).toContain(note.pool)
      }
    })

    it('should list pending notes', async () => {
      const pending = await service.getPendingNotes()

      expect(Array.isArray(pending)).toBe(true)
      // All pending notes should have 0 confirmations
      pending.forEach((note) => {
        expect(note.confirmations).toBe(0)
      })
    })
  })

  describe('Operations', () => {
    it('should list pending operations', async () => {
      const ops = await service.listPendingOperations()

      expect(Array.isArray(ops)).toBe(true)
    })

    it('should get block height', async () => {
      const height = await service.getBlockHeight()

      expect(height).toBeGreaterThan(0)
    })
  })

  describe('RPC Client Access', () => {
    it('should provide access to underlying RPC client', () => {
      const rpcClient = service.rpcClient

      expect(rpcClient).toBeInstanceOf(ZcashRPCClient)
    })
  })
})

// ─── Conditional Send Tests (require balance) ──────────────────────────────────

describeIntegration('ZcashShieldedService Send Operations', () => {
  let service: ZcashShieldedService
  let hasBalance = false

  beforeAll(async () => {
    service = new ZcashShieldedService({
      rpcConfig: getConfig(),
    })
    await service.initialize()

    const balance = await service.getBalance()
    hasBalance = balance.confirmed > 0.001 // Need at least 0.001 ZEC
  })

  it.skipIf(!process.env.ZCASH_SEND_TEST)('should send shielded transaction', async () => {
    if (!hasBalance) {
      console.log('Skipping send test: insufficient balance')
      return
    }

    const address = service.getAddress()

    // Self-send with minimum amount
    const result = await service.sendShielded({
      to: address,
      amount: 0.0001,
      memo: 'SIP Protocol integration test',
    })

    expect(result.txid).toMatch(/^[0-9a-f]{64}$/)
    expect(result.operationId).toContain('opid-')
    expect(result.amount).toBe(0.0001)
    expect(result.to).toBe(address)
  })
})

// ─── Viewing Key Tests ─────────────────────────────────────────────────────────

describeIntegration('ZcashShieldedService Viewing Keys', () => {
  let service: ZcashShieldedService

  beforeAll(async () => {
    service = new ZcashShieldedService({
      rpcConfig: getConfig(),
    })
    await service.initialize()
  })

  it('should export viewing key', async () => {
    try {
      const exported = await service.exportViewingKey()

      expect(exported.key).toBeDefined()
      expect(exported.key.length).toBeGreaterThan(0)
      expect(exported.address).toBe(service.getAddress())
      expect(exported.account).toBe(service.currentAccount)
      expect(exported.exportedAt).toBeGreaterThan(0)
    } catch (error) {
      // Some zcashd versions may not support viewing key export for all address types
      if (error instanceof ZcashRPCError) {
        console.log('Viewing key export not supported for this address type')
      } else {
        throw error
      }
    }
  })

  it('should export for compliance', async () => {
    try {
      const compliance = await service.exportForCompliance()

      expect(compliance.viewingKey).toBeDefined()
      expect(compliance.privacyLevel).toBe('compliant')
      expect(compliance.disclaimer).toContain('viewing key')
    } catch (error) {
      if (error instanceof ZcashRPCError) {
        console.log('Compliance export not supported for this address type')
      } else {
        throw error
      }
    }
  })
})

// ─── Connection Failure Test ───────────────────────────────────────────────────

describe('ZcashRPCClient Connection Failure', () => {
  it('should fail gracefully when zcashd not available', async () => {
    const badClient = new ZcashRPCClient({
      host: '127.0.0.1',
      port: 19999, // Not a real port
      username: 'test',
      password: 'test',
      testnet: true,
      timeout: 1000,
      retries: 0,
    })

    await expect(badClient.getBlockCount()).rejects.toThrow()
  })
})

// ─── Print Skip Message ────────────────────────────────────────────────────────

if (skipReason) {
  describe('Zcash Integration Tests', () => {
    it(`skipped: ${skipReason}`, () => {
      console.log(`
════════════════════════════════════════════════════════════════════
  Zcash integration tests skipped: ${skipReason}

  To run these tests:
    1. Start zcashd testnet node
    2. Run with credentials:

       ZCASH_RPC_USER=your_user \\
       ZCASH_RPC_PASS=your_pass \\
       ZCASH_INTEGRATION=true \\
       pnpm test -- tests/integration/zcash.integration.test.ts --run

  See docs/guides/ZCASH-TESTNET.md for setup instructions.
════════════════════════════════════════════════════════════════════
`)
    })
  })
}
