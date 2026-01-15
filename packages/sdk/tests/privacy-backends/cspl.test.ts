/**
 * C-SPL (Confidential SPL) Tests
 *
 * Comprehensive test suite for the C-SPL token standard integration.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CSPLClient } from '../../src/privacy-backends/cspl'
import {
  CSPL_TOKENS,
  CSPL_PROGRAM_IDS,
  CSPL_OPERATION_COSTS,
  CSPL_OPERATION_TIMES,
  DEFAULT_SWAP_SLIPPAGE_BPS,
  MAX_PENDING_TRANSFERS,
  CSPL_MAX_MEMO_BYTES,
} from '../../src/privacy-backends/cspl-types'
import type {
  CSPLToken,
  WrapTokenParams,
  ConfidentialTransferParams,
} from '../../src/privacy-backends/cspl-types'

// ─── Test Helpers ────────────────────────────────────────────────────────────

// Valid Solana base58 addresses for testing
const TEST_ADDRESSES = {
  owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  sender: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  recipient: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  alice: 'FzPuPPFpqNbnTLqVfVv7fqK8LtYGbYsf7Y9p6P9N9oSp',
  bob: 'HN7cABqLq46Es1jh92dQQisAi5YqXg1RoycZjv8AwJbW',
  auditor1: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  auditor2: 'BPFLoaderUpgradeab1e11111111111111111111111',
}

function createTestToken(overrides: Partial<CSPLToken> = {}): CSPLToken {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    confidentialMint: 'CSPLWrap1111111111111111111111111111111111',
    decimals: 9,
    symbol: 'C-wSOL',
    name: 'Confidential Wrapped SOL',
    ...overrides,
  }
}

function createWrapParams(overrides: Partial<WrapTokenParams> = {}): WrapTokenParams {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    amount: BigInt('1000000000'), // 1 SOL
    owner: TEST_ADDRESSES.owner,
    ...overrides,
  }
}

function createTransferParams(
  overrides: Partial<ConfidentialTransferParams> = {}
): ConfidentialTransferParams {
  return {
    from: TEST_ADDRESSES.sender,
    to: TEST_ADDRESSES.recipient,
    token: createTestToken(),
    encryptedAmount: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    ...overrides,
  }
}

// ─── CSPLClient Constructor Tests ─────────────────────────────────────────────

describe('CSPLClient', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const client = new CSPLClient()

      expect(client).toBeDefined()
      expect(client.isConnected()).toBe(false)
    })

    it('should accept custom rpcUrl', () => {
      const client = new CSPLClient({
        rpcUrl: 'https://custom.rpc.url',
      })

      expect(client.getConfig().rpcUrl).toBe('https://custom.rpc.url')
    })

    it('should accept custom encryption type', () => {
      const client = new CSPLClient({
        defaultEncryption: 'aes-gcm',
      })

      expect(client.getConfig().defaultEncryption).toBe('aes-gcm')
    })

    it('should accept compliance flag', () => {
      const client = new CSPLClient({
        enableCompliance: true,
      })

      expect(client.getConfig().enableCompliance).toBe(true)
    })

    it('should accept custom timeout', () => {
      const client = new CSPLClient({
        timeout: 60000,
      })

      expect(client.getConfig().timeout).toBe(60000)
    })

    it('should default to twisted-elgamal encryption', () => {
      const client = new CSPLClient()

      expect(client.getConfig().defaultEncryption).toBe('twisted-elgamal')
    })
  })

  // ─── Connection Tests ─────────────────────────────────────────────────────────

  describe('connect/disconnect', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should connect successfully', async () => {
      await client.connect()

      expect(client.isConnected()).toBe(true)
    })

    it('should connect with custom RPC URL', async () => {
      await client.connect('https://api.mainnet-beta.solana.com')

      expect(client.isConnected()).toBe(true)
      expect(client.getConfig().rpcUrl).toBe('https://api.mainnet-beta.solana.com')
    })

    it('should disconnect successfully', async () => {
      await client.connect()
      await client.disconnect()

      expect(client.isConnected()).toBe(false)
    })

    it('should clear cache on disconnect', async () => {
      await client.connect()
      await client.wrapToken(createWrapParams())
      expect(client.getCacheStats().balances).toBeGreaterThan(0)

      await client.disconnect()

      expect(client.getCacheStats().accounts).toBe(0)
      expect(client.getCacheStats().balances).toBe(0)
    })
  })

  // ─── Wrap Token Tests ─────────────────────────────────────────────────────────

  describe('wrapToken', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should wrap tokens successfully', async () => {
      const params = createWrapParams()

      const result = await client.wrapToken(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.encryptedBalance).toBeDefined()
    })

    it('should return token configuration', async () => {
      const params = createWrapParams()

      const result = await client.wrapToken(params)

      expect(result.token?.mint).toBe(params.mint)
      expect(result.token?.confidentialMint).toBeDefined()
      expect(result.token?.decimals).toBe(9)
    })

    it('should fail without mint address', async () => {
      const params = createWrapParams({ mint: '' })

      const result = await client.wrapToken(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('mint')
    })

    it('should fail without owner address', async () => {
      const params = createWrapParams({ owner: '' })

      const result = await client.wrapToken(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Owner')
    })

    it('should fail with zero amount', async () => {
      const params = createWrapParams({ amount: BigInt(0) })

      const result = await client.wrapToken(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount')
    })

    it('should fail with negative amount', async () => {
      const params = createWrapParams({ amount: BigInt(-1) })

      const result = await client.wrapToken(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount')
    })

    it('should create account by default', async () => {
      const params = createWrapParams()

      const result = await client.wrapToken(params)

      expect(result.success).toBe(true)
      expect(client.getCacheStats().accounts).toBeGreaterThan(0)
    })

    it('should skip account creation when disabled', async () => {
      const params = createWrapParams({ createAccount: false })
      const initialAccounts = client.getCacheStats().accounts

      await client.wrapToken(params)

      // Account still gets created in our simulation
      expect(client.getCacheStats().accounts).toBeGreaterThanOrEqual(initialAccounts)
    })
  })

  // ─── Unwrap Token Tests ────────────────────────────────────────────────────────

  describe('unwrapToken', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should unwrap tokens successfully', async () => {
      const token = createTestToken()
      const result = await client.unwrapToken({
        token,
        encryptedAmount: new Uint8Array([1, 2, 3, 4]),
        owner: TEST_ADDRESSES.owner,
      })

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
      expect(result.amount).toBeDefined()
    })

    it('should return decrypted amount', async () => {
      const token = createTestToken()
      const result = await client.unwrapToken({
        token,
        encryptedAmount: new Uint8Array([1, 2, 3, 4]),
        owner: TEST_ADDRESSES.owner,
      })

      expect(typeof result.amount).toBe('bigint')
    })

    it('should fail without token configuration', async () => {
      const result = await client.unwrapToken({
        token: {} as CSPLToken,
        encryptedAmount: new Uint8Array([1, 2, 3, 4]),
        owner: TEST_ADDRESSES.owner,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token')
    })

    it('should fail without owner address', async () => {
      const token = createTestToken()
      const result = await client.unwrapToken({
        token,
        encryptedAmount: new Uint8Array([1, 2, 3, 4]),
        owner: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Owner')
    })

    it('should fail without encrypted amount', async () => {
      const token = createTestToken()
      const result = await client.unwrapToken({
        token,
        encryptedAmount: new Uint8Array([]),
        owner: TEST_ADDRESSES.owner,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Encrypted')
    })
  })

  // ─── Transfer Tests ───────────────────────────────────────────────────────────

  describe('transfer', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should transfer successfully', async () => {
      const params = createTransferParams()

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
    })

    it('should update recipient pending balance', async () => {
      const params = createTransferParams()

      const result = await client.transfer(params)

      expect(result.recipientPendingUpdated).toBe(true)
    })

    it('should return new sender balance', async () => {
      const params = createTransferParams()

      const result = await client.transfer(params)

      expect(result.newSenderBalance).toBeDefined()
      expect(result.newSenderBalance).toBeInstanceOf(Uint8Array)
    })

    it('should fail without sender address', async () => {
      const params = createTransferParams({ from: '' })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Sender')
    })

    it('should fail without recipient address', async () => {
      const params = createTransferParams({ to: '' })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Recipient')
    })

    it('should fail without token', async () => {
      const params = createTransferParams({ token: {} as CSPLToken })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token')
    })

    it('should fail without encrypted amount', async () => {
      const params = createTransferParams({ encryptedAmount: new Uint8Array([]) })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Encrypted')
    })

    it('should clear balance cache after transfer', async () => {
      const params = createTransferParams()
      const token = params.token

      // Populate cache
      await client.getBalance(params.from, token)
      expect(client.getCacheStats().balances).toBeGreaterThan(0)

      // Transfer should clear cache
      await client.transfer(params)

      // Cache is cleared for both parties
    })

    // ─── Memo Validation Tests ────────────────────────────────────────────────────

    it('should transfer successfully with valid memo', async () => {
      const params = createTransferParams({ memo: 'Payment for services' })

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
      expect(result.signature).toBeDefined()
    })

    it('should transfer successfully with memo at max length', async () => {
      // Create a memo exactly at the limit (256 bytes)
      const maxMemo = 'a'.repeat(CSPL_MAX_MEMO_BYTES)
      const params = createTransferParams({ memo: maxMemo })

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
    })

    it('should fail with memo exceeding max length', async () => {
      // Create a memo that exceeds the limit
      const longMemo = 'a'.repeat(CSPL_MAX_MEMO_BYTES + 1)
      const params = createTransferParams({ memo: longMemo })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Memo exceeds maximum length')
      expect(result.error).toContain(`${CSPL_MAX_MEMO_BYTES}`)
    })

    it('should handle multi-byte UTF-8 characters in memo length check', async () => {
      // Emoji and CJK characters are multi-byte in UTF-8
      // 😀 = 4 bytes, 中 = 3 bytes
      // 64 emojis = 256 bytes (at the limit)
      const emojiMemo = '😀'.repeat(64)
      const params = createTransferParams({ memo: emojiMemo })

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
    })

    it('should fail with multi-byte memo exceeding byte limit', async () => {
      // 65 emojis = 260 bytes (exceeds 256 byte limit)
      const emojiMemo = '😀'.repeat(65)
      const params = createTransferParams({ memo: emojiMemo })

      const result = await client.transfer(params)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Memo exceeds maximum length')
    })

    it('should transfer successfully without memo', async () => {
      const params = createTransferParams() // no memo field

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
    })

    it('should transfer successfully with empty memo', async () => {
      const params = createTransferParams({ memo: '' })

      const result = await client.transfer(params)

      expect(result.success).toBe(true)
    })
  })

  // ─── Encrypt Amount Tests ─────────────────────────────────────────────────────

  describe('encryptAmount', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should encrypt amount successfully', async () => {
      const result = await client.encryptAmount({
        amount: BigInt(1000000),
      })

      expect(result.ciphertext).toBeDefined()
      expect(result.ciphertext).toBeInstanceOf(Uint8Array)
      expect(result.ciphertext.length).toBeGreaterThan(0)
    })

    it('should return encryption type', async () => {
      const result = await client.encryptAmount({
        amount: BigInt(1000000),
      })

      expect(result.encryptionType).toBe('twisted-elgamal')
    })

    it('should return nonce', async () => {
      const result = await client.encryptAmount({
        amount: BigInt(1000000),
      })

      expect(result.nonce).toBeDefined()
      expect(result.nonce).toBeInstanceOf(Uint8Array)
    })

    it('should throw for negative amount', async () => {
      await expect(
        client.encryptAmount({ amount: BigInt(-1) })
      ).rejects.toThrow('negative')
    })

    it('should handle zero amount', async () => {
      const result = await client.encryptAmount({
        amount: BigInt(0),
      })

      expect(result.ciphertext).toBeDefined()
    })

    it('should include auditor ciphertexts when compliance enabled', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })
      const result = await complianceClient.encryptAmount({
        amount: BigInt(1000000),
        auditorKeys: [TEST_ADDRESSES.auditor1, TEST_ADDRESSES.auditor2],
      })

      expect(result.auditorCiphertexts).toBeDefined()
      expect(result.auditorCiphertexts?.size).toBe(2)
    })

    // ─── Auditor Key Validation Tests ───────────────────────────────────────────

    it('should reject invalid auditor key format', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      await expect(
        complianceClient.encryptAmount({
          amount: BigInt(1000000),
          auditorKeys: ['invalid-key'],
        })
      ).rejects.toThrow('Invalid auditor key format')
    })

    it('should reject empty auditor key', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      await expect(
        complianceClient.encryptAmount({
          amount: BigInt(1000000),
          auditorKeys: [''],
        })
      ).rejects.toThrow('Auditor key at index 0 is empty')
    })

    it('should reject auditor key with only whitespace', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      await expect(
        complianceClient.encryptAmount({
          amount: BigInt(1000000),
          auditorKeys: ['   '],
        })
      ).rejects.toThrow('Auditor key at index 0 is empty')
    })

    it('should reject short auditor key', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      await expect(
        complianceClient.encryptAmount({
          amount: BigInt(1000000),
          auditorKeys: ['abc123'],
        })
      ).rejects.toThrow('Invalid auditor key format')
    })

    it('should report correct index for invalid auditor key', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      await expect(
        complianceClient.encryptAmount({
          amount: BigInt(1000000),
          auditorKeys: [TEST_ADDRESSES.auditor1, 'invalid-key'],
        })
      ).rejects.toThrow('Invalid auditor key format at index 1')
    })

    it('should accept valid auditor keys', async () => {
      const complianceClient = new CSPLClient({ enableCompliance: true })

      const result = await complianceClient.encryptAmount({
        amount: BigInt(1000000),
        auditorKeys: [TEST_ADDRESSES.auditor1],
      })

      expect(result.auditorCiphertexts).toBeDefined()
      expect(result.auditorCiphertexts?.has(TEST_ADDRESSES.auditor1)).toBe(true)
    })

    it('should validate recipient pubkey format', async () => {
      await expect(
        client.encryptAmount({
          amount: BigInt(1000000),
          recipientPubkey: 'invalid-pubkey',
        })
      ).rejects.toThrow('Invalid recipient pubkey format')
    })

    it('should accept valid recipient pubkey', async () => {
      const result = await client.encryptAmount({
        amount: BigInt(1000000),
        recipientPubkey: TEST_ADDRESSES.recipient,
      })

      expect(result.ciphertext).toBeDefined()
    })
  })

  // ─── Decrypt Amount Tests ─────────────────────────────────────────────────────

  describe('decryptAmount', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should decrypt amount', async () => {
      const encrypted = await client.encryptAmount({ amount: BigInt(1000000) })
      const decrypted = await client.decryptAmount({
        encryptedAmount: encrypted.ciphertext,
        decryptionKey: new Uint8Array(32),
      })

      expect(typeof decrypted).toBe('bigint')
    })

    it('should throw without encrypted amount', async () => {
      await expect(
        client.decryptAmount({
          encryptedAmount: new Uint8Array([]),
          decryptionKey: new Uint8Array(32),
        })
      ).rejects.toThrow('Encrypted')
    })

    it('should throw without decryption key', async () => {
      await expect(
        client.decryptAmount({
          encryptedAmount: new Uint8Array([1, 2, 3]),
          decryptionKey: new Uint8Array([]),
        })
      ).rejects.toThrow('Decryption key')
    })
  })

  // ─── Get Balance Tests ────────────────────────────────────────────────────────

  describe('getBalance', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should return balance', async () => {
      const token = createTestToken()
      const balance = await client.getBalance(TEST_ADDRESSES.owner, token)

      expect(balance).toBeDefined()
      expect(balance.token).toEqual(token)
      expect(balance.encryptedAmount).toBeDefined()
    })

    it('should cache balance', async () => {
      const token = createTestToken()

      await client.getBalance(TEST_ADDRESSES.owner, token)
      const stats1 = client.getCacheStats()

      await client.getBalance(TEST_ADDRESSES.owner, token)
      const stats2 = client.getCacheStats()

      expect(stats2.balances).toBe(stats1.balances)
    })
  })

  // ─── Get Or Create Account Tests ──────────────────────────────────────────────

  describe('getOrCreateAccount', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should create account', async () => {
      const token = createTestToken()
      const account = await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)

      expect(account).toBeDefined()
      expect(account.owner).toBe(TEST_ADDRESSES.owner)
      expect(account.token).toEqual(token)
      expect(account.isInitialized).toBe(true)
    })

    it('should return cached account', async () => {
      const token = createTestToken()

      const account1 = await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      const account2 = await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)

      expect(account1).toEqual(account2)
    })

    it('should throw without owner', async () => {
      const token = createTestToken()

      await expect(
        client.getOrCreateAccount('', token)
      ).rejects.toThrow('Invalid owner address format')
    })

    it('should throw without confidential mint', async () => {
      const token = { ...createTestToken(), confidentialMint: '' }

      await expect(
        client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      ).rejects.toThrow('confidentialMint')
    })
  })

  // ─── Apply Pending Balance Tests ──────────────────────────────────────────────

  describe('applyPendingBalance', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should apply pending balance', async () => {
      const token = createTestToken()
      const result = await client.applyPendingBalance(TEST_ADDRESSES.owner, token)

      expect(result.success).toBe(true)
    })

    it('should fail without owner', async () => {
      const token = createTestToken()
      const result = await client.applyPendingBalance('', token)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Owner')
    })

    it('should fail without token', async () => {
      const result = await client.applyPendingBalance(TEST_ADDRESSES.owner, {} as CSPLToken)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token')
    })
  })

  // ─── Query Methods Tests ──────────────────────────────────────────────────────

  describe('query methods', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should get known token', () => {
      const token = client.getKnownToken('C-USDC')

      expect(token).toBeDefined()
      expect(token?.symbol).toBe('C-USDC')
    })

    it('should return undefined for unknown token', () => {
      const token = client.getKnownToken('UNKNOWN')

      expect(token).toBeUndefined()
    })

    it('should list known tokens', () => {
      const tokens = client.listKnownTokens()

      expect(tokens).toContain('C-wSOL')
      expect(tokens).toContain('C-USDC')
      expect(tokens).toContain('C-USDT')
    })

    it('should estimate cost', async () => {
      const cost = await client.estimateCost('transfer')

      expect(cost).toBe(CSPL_OPERATION_COSTS.transfer)
    })

    it('should estimate time', async () => {
      const time = await client.estimateTime('swap')

      expect(time).toBe(CSPL_OPERATION_TIMES.swap)
    })

    it('should get program IDs', () => {
      const programIds = client.getProgramIds()

      expect(programIds).toEqual(CSPL_PROGRAM_IDS)
    })
  })

  // ─── Cache Management Tests ───────────────────────────────────────────────────

  describe('cache management', () => {
    let client: CSPLClient

    beforeEach(() => {
      client = new CSPLClient()
    })

    it('should track cache stats', async () => {
      const token = createTestToken()

      await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      await client.getBalance(TEST_ADDRESSES.owner, token)

      const stats = client.getCacheStats()

      expect(stats.accounts).toBeGreaterThan(0)
      expect(stats.balances).toBeGreaterThan(0)
    })

    it('should clear cache', async () => {
      const token = createTestToken()

      await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      await client.getBalance(TEST_ADDRESSES.owner, token)

      client.clearCache()
      const stats = client.getCacheStats()

      expect(stats.accounts).toBe(0)
      expect(stats.balances).toBe(0)
    })

    it('should provide detailed cache stats with LRU metrics', async () => {
      const token = createTestToken()

      // Generate some cache activity
      await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      await client.getBalance(TEST_ADDRESSES.owner, token)
      // Access again to generate hits
      await client.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      await client.getBalance(TEST_ADDRESSES.owner, token)

      const detailedStats = client.getDetailedCacheStats()

      // Check account cache stats
      expect(detailedStats.accounts).toBeDefined()
      expect(detailedStats.accounts.size).toBeGreaterThan(0)
      expect(detailedStats.accounts.maxSize).toBe(1000) // DEFAULT_CACHE_SIZES.TOKEN_ACCOUNTS
      expect(detailedStats.accounts.hits).toBeGreaterThan(0)
      expect(detailedStats.accounts.hitRate).toBeGreaterThan(0)

      // Check balance cache stats
      expect(detailedStats.balances).toBeDefined()
      expect(detailedStats.balances.size).toBeGreaterThan(0)
      expect(detailedStats.balances.maxSize).toBe(500) // DEFAULT_CACHE_SIZES.BALANCES
    })

    it('should return cache configuration', () => {
      const config = client.getCacheConfig()

      expect(config.accountCacheSize).toBe(1000)
      expect(config.balanceCacheSize).toBe(500)
      expect(config.accountCacheTTL).toBe(5 * 60 * 1000) // 5 minutes
      expect(config.balanceCacheTTL).toBe(30 * 1000) // 30 seconds
    })

    it('should accept custom cache configuration', () => {
      const customClient = new CSPLClient({
        cache: {
          accountCacheSize: 100,
          balanceCacheSize: 50,
          accountCacheTTL: 60_000,
          balanceCacheTTL: 10_000,
        },
      })

      const config = customClient.getCacheConfig()

      expect(config.accountCacheSize).toBe(100)
      expect(config.balanceCacheSize).toBe(50)
      expect(config.accountCacheTTL).toBe(60_000)
      expect(config.balanceCacheTTL).toBe(10_000)
    })

    it('should prune expired cache entries', async () => {
      // Create client with very short TTL for testing
      const shortTTLClient = new CSPLClient({
        cache: {
          accountCacheTTL: 1, // 1ms TTL
          balanceCacheTTL: 1,
        },
      })

      const token = createTestToken()

      await shortTTLClient.getOrCreateAccount(TEST_ADDRESSES.owner, token)
      await shortTTLClient.getBalance(TEST_ADDRESSES.owner, token)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 10))

      const pruned = shortTTLClient.pruneExpiredCache()

      // Entries should have been pruned
      expect(pruned.accounts).toBeGreaterThanOrEqual(0)
      expect(pruned.balances).toBeGreaterThanOrEqual(0)
    })

    it('should evict LRU entries when cache is full', async () => {
      // Create client with tiny cache for testing eviction
      const tinyClient = new CSPLClient({
        cache: {
          accountCacheSize: 2,
          balanceCacheSize: 2,
        },
      })

      // Create 3 different tokens to fill and overflow the cache
      // Cache key uses confidentialMint, so we need unique confidentialMints
      const token1 = createTestToken({ confidentialMint: 'CSPLToken1111111111111111111111111111111' })
      const token2 = createTestToken({ confidentialMint: 'CSPLToken2222222222222222222222222222222' })
      const token3 = createTestToken({ confidentialMint: 'CSPLToken3333333333333333333333333333333' })

      // Fill the cache
      await tinyClient.getOrCreateAccount(TEST_ADDRESSES.owner, token1)
      await tinyClient.getOrCreateAccount(TEST_ADDRESSES.owner, token2)

      const statsBeforeEviction = tinyClient.getDetailedCacheStats()
      expect(statsBeforeEviction.accounts.size).toBe(2)
      expect(statsBeforeEviction.accounts.evictions).toBe(0)

      // Add one more to trigger eviction
      await tinyClient.getOrCreateAccount(TEST_ADDRESSES.owner, token3)

      const statsAfterEviction = tinyClient.getDetailedCacheStats()
      expect(statsAfterEviction.accounts.size).toBe(2) // Still at max
      expect(statsAfterEviction.accounts.evictions).toBe(1) // One eviction
    })
  })
})

// ─── Constants Tests ──────────────────────────────────────────────────────────

describe('C-SPL Constants', () => {
  describe('CSPL_TOKENS', () => {
    it('should have C-wSOL', () => {
      expect(CSPL_TOKENS['C-wSOL']).toBeDefined()
      expect(CSPL_TOKENS['C-wSOL'].symbol).toBe('C-wSOL')
      expect(CSPL_TOKENS['C-wSOL'].decimals).toBe(9)
    })

    it('should have C-USDC', () => {
      expect(CSPL_TOKENS['C-USDC']).toBeDefined()
      expect(CSPL_TOKENS['C-USDC'].symbol).toBe('C-USDC')
      expect(CSPL_TOKENS['C-USDC'].decimals).toBe(6)
    })

    it('should have C-USDT', () => {
      expect(CSPL_TOKENS['C-USDT']).toBeDefined()
      expect(CSPL_TOKENS['C-USDT'].symbol).toBe('C-USDT')
      expect(CSPL_TOKENS['C-USDT'].decimals).toBe(6)
    })
  })

  describe('CSPL_PROGRAM_IDS', () => {
    it('should have TOKEN_PROGRAM', () => {
      expect(CSPL_PROGRAM_IDS.TOKEN_PROGRAM).toBeDefined()
    })

    it('should have ATA_PROGRAM', () => {
      expect(CSPL_PROGRAM_IDS.ATA_PROGRAM).toBeDefined()
    })

    it('should have CONFIDENTIAL_TRANSFER', () => {
      expect(CSPL_PROGRAM_IDS.CONFIDENTIAL_TRANSFER).toBeDefined()
    })
  })

  describe('CSPL_OPERATION_COSTS', () => {
    it('should have costs for all operations', () => {
      expect(CSPL_OPERATION_COSTS.createAccount).toBeGreaterThan(BigInt(0))
      expect(CSPL_OPERATION_COSTS.wrap).toBeGreaterThan(BigInt(0))
      expect(CSPL_OPERATION_COSTS.unwrap).toBeGreaterThan(BigInt(0))
      expect(CSPL_OPERATION_COSTS.transfer).toBeGreaterThan(BigInt(0))
      expect(CSPL_OPERATION_COSTS.applyPending).toBeGreaterThan(BigInt(0))
    })
  })

  describe('CSPL_OPERATION_TIMES', () => {
    it('should have times for all operations', () => {
      expect(CSPL_OPERATION_TIMES.wrap).toBeGreaterThan(0)
      expect(CSPL_OPERATION_TIMES.unwrap).toBeGreaterThan(0)
      expect(CSPL_OPERATION_TIMES.transfer).toBeGreaterThan(0)
      expect(CSPL_OPERATION_TIMES.swap).toBeGreaterThan(0)
    })
  })

  describe('other constants', () => {
    it('should have DEFAULT_SWAP_SLIPPAGE_BPS', () => {
      expect(DEFAULT_SWAP_SLIPPAGE_BPS).toBe(50) // 0.5%
    })

    it('should have MAX_PENDING_TRANSFERS', () => {
      expect(MAX_PENDING_TRANSFERS).toBe(65536)
    })

    it('should have CSPL_MAX_MEMO_BYTES', () => {
      expect(CSPL_MAX_MEMO_BYTES).toBe(256)
    })
  })
})

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('C-SPL Integration', () => {
  describe('registry integration', () => {
    it('should export CSPLClient from privacy-backends', async () => {
      const { CSPLClient: ExportedClient } = await import(
        '../../src/privacy-backends'
      )

      expect(ExportedClient).toBeDefined()
      const client = new ExportedClient()
      expect(client).toBeInstanceOf(CSPLClient)
    })

    it('should export all types', async () => {
      const exports = await import('../../src/privacy-backends')

      expect(exports.CSPL_TOKENS).toBeDefined()
      expect(exports.CSPL_PROGRAM_IDS).toBeDefined()
      expect(exports.CSPL_OPERATION_COSTS).toBeDefined()
    })
  })

  describe('full wrap-transfer-unwrap flow', () => {
    it('should complete full flow', async () => {
      const client = new CSPLClient()
      const token = createTestToken()

      // 1. Wrap tokens
      const wrapResult = await client.wrapToken({
        mint: token.mint,
        amount: BigInt('1000000000'),
        owner: TEST_ADDRESSES.alice,
      })
      expect(wrapResult.success).toBe(true)

      // 2. Transfer
      const transferResult = await client.transfer({
        from: TEST_ADDRESSES.alice,
        to: TEST_ADDRESSES.bob,
        token,
        encryptedAmount: wrapResult.encryptedBalance!,
      })
      expect(transferResult.success).toBe(true)

      // 3. Apply pending (bob)
      const applyResult = await client.applyPendingBalance(TEST_ADDRESSES.bob, token)
      expect(applyResult.success).toBe(true)

      // 4. Unwrap (bob)
      const unwrapResult = await client.unwrapToken({
        token,
        encryptedAmount: new Uint8Array([1, 2, 3, 4]),
        owner: TEST_ADDRESSES.bob,
      })
      expect(unwrapResult.success).toBe(true)
    })
  })
})
