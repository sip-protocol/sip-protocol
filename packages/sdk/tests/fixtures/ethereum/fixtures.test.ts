/**
 * Ethereum Test Fixtures - Validation Tests
 *
 * Ensures all fixtures are valid and work correctly.
 */

import { describe, it, expect } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'

import type { HexString } from '@sip-protocol/types'

import {
  // Accounts
  aliceAccount,
  bobAccount,
  charlieAccount,
  auditorAccount,
  solverAccount,
  deployerAccount,
  testAccounts,
  stealthAccounts,
  ephemeralKeypairs,
  generateEphemeralKeypair,
  deriveStealthAddress,
  computeViewTag,
  generateTestAccounts,
  generateStealthAccounts,
  signWithAccount,
  verifyWithAccount,
  WEI,
  GWEI,
  ETH,
  // Contracts
  USDC,
  TEST_USDC,
  mainnetTokens,
  testTokens,
  MAINNET_ANNOUNCER,
  LOCAL_ANNOUNCER,
  announcerContracts,
  createMockAnnouncement,
  toRawAmount,
  fromRawAmount,
  formatTokenAmount,
  // Network
  ANVIL_CONFIG,
  SEPOLIA_CONFIG,
  networkConfigs,
  createMockRpcHandler,
  createMockBlock,
  createMockEthTransfer,
  createMockReceipt,
  createMockAnnouncementLog,
  // Composite
  createTestEnvironment,
  createMinimalTestEnvironment,
  createStealthPaymentScenario,
} from './index'

// ─── Account Fixtures ─────────────────────────────────────────────────────────

describe('Ethereum Test Fixtures', () => {
  describe('Account Fixtures', () => {
    it('should have valid test accounts', () => {
      const accounts = [aliceAccount, bobAccount, charlieAccount, auditorAccount, solverAccount, deployerAccount]

      for (const account of accounts) {
        expect(account.name).toBeDefined()
        expect(account.privateKey).toMatch(/^0x[a-f0-9]{64}$/i)
        expect(account.publicKey).toMatch(/^0x[a-f0-9]{66}$/i) // 33 bytes compressed
        expect(account.publicKeyUncompressed).toMatch(/^0x[a-f0-9]{130}$/i) // 65 bytes uncompressed
        expect(account.address).toMatch(/^0x[a-f0-9]{40}$/i)
        expect(account.balance).toBeGreaterThan(0n)
      }
    })

    it('should derive correct Ethereum addresses from public keys', () => {
      // Verify address derivation: keccak256(pubKey[1:65])[12:32]
      for (const account of [aliceAccount, bobAccount]) {
        const pubKeyBytes = hexToBytes(account.publicKeyUncompressed.slice(2))
        const hash = keccak_256(pubKeyBytes.slice(1)) // Remove 0x04 prefix
        const derivedAddress = '0x' + bytesToHex(hash.slice(12))

        expect(account.address.toLowerCase()).toBe(derivedAddress.toLowerCase())
      }
    })

    it('should have valid secp256k1 keypairs', () => {
      for (const account of [aliceAccount, bobAccount, charlieAccount]) {
        const privBytes = hexToBytes(account.privateKey.slice(2))
        const derivedPubKey = secp256k1.getPublicKey(privBytes, true)

        expect('0x' + bytesToHex(derivedPubKey)).toBe(account.publicKey)
      }
    })

    it('should have valid stealth accounts with spending/viewing keys', () => {
      for (const [name, account] of Object.entries(stealthAccounts)) {
        expect(account.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
        expect(account.spendingPublicKey).toMatch(/^0x[a-f0-9]{66}$/i)
        expect(account.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i)
        expect(account.viewingPublicKey).toMatch(/^0x[a-f0-9]{66}$/i)
        expect(account.metaAddress).toContain(`sip:ethereum:`)
        expect(account.schemeId).toBe(1)

        // Verify spending key derivation
        const spendPrivBytes = hexToBytes(account.spendingPrivateKey.slice(2))
        const derivedSpendPub = secp256k1.getPublicKey(spendPrivBytes, true)
        expect('0x' + bytesToHex(derivedSpendPub)).toBe(account.spendingPublicKey)

        // Verify viewing key derivation
        const viewPrivBytes = hexToBytes(account.viewingPrivateKey.slice(2))
        const derivedViewPub = secp256k1.getPublicKey(viewPrivBytes, true)
        expect('0x' + bytesToHex(derivedViewPub)).toBe(account.viewingPublicKey)

        expect(name).toBeDefined()
      }
    })

    it('should have unique addresses for all accounts', () => {
      const addresses = Object.values(testAccounts).map(a => a.address.toLowerCase())
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(addresses.length)
    })
  })

  describe('Ephemeral Keypairs', () => {
    it('should have pre-generated ephemeral keypairs', () => {
      expect(Object.keys(ephemeralKeypairs)).toHaveLength(6)

      for (const ephemeral of Object.values(ephemeralKeypairs)) {
        expect(ephemeral.id).toBeDefined()
        expect(ephemeral.privateKey).toMatch(/^0x[a-f0-9]{64}$/i)
        expect(ephemeral.publicKey).toMatch(/^0x[a-f0-9]{66}$/i)
        expect(ephemeral.publicKeyUncompressed).toMatch(/^0x[a-f0-9]{130}$/i)
      }
    })

    it('should generate deterministic ephemeral keypairs', () => {
      const key1 = generateEphemeralKeypair('test-tx', 0)
      const key2 = generateEphemeralKeypair('test-tx', 0)
      const key3 = generateEphemeralKeypair('test-tx', 1)

      expect(key1.privateKey).toBe(key2.privateKey)
      expect(key1.publicKey).toBe(key2.publicKey)
      expect(key1.privateKey).not.toBe(key3.privateKey)
    })
  })

  describe('Stealth Address Derivation', () => {
    it('should derive stealth addresses correctly', () => {
      const ephemeral = ephemeralKeypairs.tx1
      const result = deriveStealthAddress(
        ephemeral.privateKey,
        bobAccount.spendingPublicKey,
        bobAccount.viewingPublicKey
      )

      expect(result.stealthAddress).toMatch(/^0x[a-f0-9]{40}$/i)
      expect(result.ephemeralPublicKey).toBe(ephemeral.publicKey)
      expect(result.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.viewTag).toBeLessThanOrEqual(255)
    })

    it('should derive different stealth addresses for different ephemeral keys', () => {
      const result1 = deriveStealthAddress(
        ephemeralKeypairs.tx1.privateKey,
        bobAccount.spendingPublicKey,
        bobAccount.viewingPublicKey
      )
      const result2 = deriveStealthAddress(
        ephemeralKeypairs.tx2.privateKey,
        bobAccount.spendingPublicKey,
        bobAccount.viewingPublicKey
      )

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress)
    })

    it('should compute view tag from shared secret', () => {
      const hash = new Uint8Array([0x42, 0x11, 0x22, 0x33])
      expect(computeViewTag(hash)).toBe(0x42)
    })
  })

  describe('Batch Generation', () => {
    it('should generate multiple test accounts', () => {
      const accounts = generateTestAccounts(5, 'batch')
      expect(accounts).toHaveLength(5)

      for (const account of accounts) {
        expect(account.name).toContain('batch')
        expect(account.address).toMatch(/^0x[a-f0-9]{40}$/i)
      }
    })

    it('should generate multiple stealth accounts', () => {
      const accounts = generateStealthAccounts(3, 'stealth-batch')
      expect(accounts).toHaveLength(3)

      for (const account of accounts) {
        expect(account.name).toContain('stealth-batch')
        expect(account.spendingPublicKey).toBeDefined()
        expect(account.viewingPublicKey).toBeDefined()
      }
    })
  })

  describe('Signature Utilities', () => {
    it('should sign and verify messages', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5])
      const messageHash = keccak_256(message)

      const signature = signWithAccount(aliceAccount, messageHash)

      expect(signature.r).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(signature.s).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(signature.v).toBeGreaterThanOrEqual(27)
      expect(signature.v).toBeLessThanOrEqual(28)

      const isValid = verifyWithAccount(aliceAccount, messageHash, signature)
      expect(isValid).toBe(true)
    })

    it('should not verify with wrong account', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5])
      const messageHash = keccak_256(message)

      const signature = signWithAccount(aliceAccount, messageHash)
      const isValid = verifyWithAccount(bobAccount, messageHash, signature)

      expect(isValid).toBe(false)
    })
  })

  describe('Constants', () => {
    it('should have correct unit values', () => {
      expect(WEI).toBe(1n)
      expect(GWEI).toBe(10n ** 9n)
      expect(ETH).toBe(10n ** 18n)
    })
  })

  // ─── Contract Fixtures ────────────────────────────────────────────────────────

  describe('Token Fixtures', () => {
    it('should have valid mainnet tokens', () => {
      expect(mainnetTokens).toHaveLength(5)

      for (const token of mainnetTokens) {
        expect(token.name).toBeDefined()
        expect(token.symbol).toBeDefined()
        expect(token.decimals).toBeGreaterThanOrEqual(0)
        expect(token.decimals).toBeLessThanOrEqual(18)
        expect(token.address).toMatch(/^0x[a-f0-9]{40}$/i)
        expect(token.isTestToken).toBe(false)
      }
    })

    it('should have valid test tokens', () => {
      expect(testTokens).toHaveLength(4)

      for (const token of testTokens) {
        expect(token.isTestToken).toBe(true)
      }
    })

    it('should have USDC with correct properties', () => {
      expect(USDC.symbol).toBe('USDC')
      expect(USDC.decimals).toBe(6)
    })
  })

  describe('Amount Utilities', () => {
    it('should convert to raw amount', () => {
      expect(toRawAmount(100, 6)).toBe(100_000_000n)
      expect(toRawAmount('1.5', 18)).toBe(1_500_000_000_000_000_000n)
      expect(toRawAmount('0.000001', 6)).toBe(1n)
    })

    it('should convert from raw amount', () => {
      expect(fromRawAmount(100_000_000n, 6)).toBe('100')
      expect(fromRawAmount(1_500_000_000_000_000_000n, 18)).toBe('1.5')
      expect(fromRawAmount(1n, 6)).toBe('0.000001')
    })

    it('should format token amounts', () => {
      expect(formatTokenAmount(TEST_USDC, 1_000_000n)).toBe('1 tUSDC')
      expect(formatTokenAmount(TEST_USDC, 1_500_000n)).toBe('1.5 tUSDC')
    })
  })

  describe('Announcer Contracts', () => {
    it('should have valid announcer addresses', () => {
      for (const [name, announcer] of Object.entries(announcerContracts)) {
        expect(announcer.address).toMatch(/^0x[a-f0-9]{40}$/i)
        expect(announcer.schemeId).toBe(1)
        expect(announcer.chainId).toBeGreaterThan(0)
        expect(name).toBeDefined()
      }
    })

    it('should have correct chain IDs', () => {
      expect(MAINNET_ANNOUNCER.chainId).toBe(1)
      expect(LOCAL_ANNOUNCER.chainId).toBe(31337)
    })
  })

  describe('Mock Announcements', () => {
    it('should create valid mock announcements', () => {
      const announcement = createMockAnnouncement({
        stealthAddress: '0x1234567890123456789012345678901234567890' as HexString,
        ephemeralPubKey: ('0x02' + '1'.repeat(64)) as HexString,
        viewTag: 42,
      })

      expect(announcement.schemeId).toBe(1)
      expect(announcement.stealthAddress).toBeDefined()
      expect(announcement.ephemeralPubKey).toBeDefined()
      expect(announcement.viewTag).toBe(42)
      expect(announcement.txHash).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(announcement.blockNumber).toBeGreaterThan(0)
    })
  })

  // ─── Network Fixtures ─────────────────────────────────────────────────────────

  describe('Network Configurations', () => {
    it('should have valid network configs', () => {
      expect(Object.keys(networkConfigs)).toHaveLength(8)

      for (const config of Object.values(networkConfigs)) {
        expect(config.name).toBeDefined()
        expect(config.chainId).toBeGreaterThan(0)
        expect(config.rpcUrl).toMatch(/^https?:\/\//)
        expect(config.nativeCurrency.decimals).toBe(18)
      }
    })

    it('should have correct Anvil config', () => {
      expect(ANVIL_CONFIG.chainId).toBe(31337)
      expect(ANVIL_CONFIG.autoMine).toBe(true)
      expect(ANVIL_CONFIG.accountCount).toBe(10)
    })

    it('should have correct Sepolia config', () => {
      expect(SEPOLIA_CONFIG.chainId).toBe(11155111)
      expect(SEPOLIA_CONFIG.isTestnet).toBe(true)
    })
  })

  describe('Mock RPC Handler', () => {
    it('should handle standard RPC methods', () => {
      const handler = createMockRpcHandler()

      const chainIdResponse = handler('eth_chainId', [])
      expect(chainIdResponse.result).toBe('0x7a69')

      const balanceResponse = handler('eth_getBalance', ['0x1234', 'latest'])
      expect(balanceResponse.result).toBeDefined()

      const gasPriceResponse = handler('eth_gasPrice', [])
      expect(gasPriceResponse.result).toBeDefined()
    })

    it('should return error for unknown methods', () => {
      const handler = createMockRpcHandler()
      const response = handler('unknown_method', [])

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32601)
    })

    it('should allow custom overrides', () => {
      const handler = createMockRpcHandler({
        eth_chainId: () => '0x1',
      })

      const response = handler('eth_chainId', [])
      expect(response.result).toBe('0x1')
    })
  })

  describe('Mock Blocks and Transactions', () => {
    it('should create valid mock blocks', () => {
      const block = createMockBlock(1000000, 5)

      expect(block.number).toBe('0xf4240')
      expect(block.transactions).toHaveLength(5)
      expect(block.gasLimit).toBeDefined()
    })

    it('should create valid mock ETH transfers', () => {
      const tx = createMockEthTransfer({
        from: aliceAccount.address,
        to: bobAccount.address,
        value: ETH,
      })

      expect(tx.from).toBe(aliceAccount.address)
      expect(tx.to).toBe(bobAccount.address)
      expect(tx.value).toBe('0xde0b6b3a7640000')
      expect(tx.gas).toBe('0x5208')
    })

    it('should create valid mock receipts', () => {
      const tx = createMockEthTransfer({
        from: aliceAccount.address,
        to: bobAccount.address,
        value: ETH,
      })
      const receipt = createMockReceipt(tx, true)

      expect(receipt.transactionHash).toBe(tx.hash)
      expect(receipt.status).toBe('0x1')
      expect(receipt.from).toBe(tx.from)
      expect(receipt.to).toBe(tx.to)
    })

    it('should create failed receipts', () => {
      const tx = createMockEthTransfer({
        from: aliceAccount.address,
        to: bobAccount.address,
        value: ETH,
      })
      const receipt = createMockReceipt(tx, false)

      expect(receipt.status).toBe('0x0')
    })
  })

  describe('Mock Announcement Logs', () => {
    it('should create valid announcement logs', () => {
      const log = createMockAnnouncementLog({
        contractAddress: LOCAL_ANNOUNCER.address,
        schemeId: 1,
        stealthAddress: '0x1234567890123456789012345678901234567890' as HexString,
        caller: aliceAccount.address,
        ephemeralPubKey: ('0x02' + '1'.repeat(64)) as HexString,
        viewTag: 42,
      })

      expect(log.address).toBe(LOCAL_ANNOUNCER.address)
      expect(log.topics).toHaveLength(4)
      expect(log.data).toMatch(/^0x/)
    })
  })

  // ─── Composite Fixtures ───────────────────────────────────────────────────────

  describe('Composite Fixtures', () => {
    it('should create full test environment', () => {
      const env = createTestEnvironment()

      expect(env.network).toBe(ANVIL_CONFIG)
      expect(env.alice.account).toBe(aliceAccount)
      expect(env.bob.account).toBe(bobAccount)
      expect(env.charlie.account).toBe(charlieAccount)
      expect(env.tokens.usdc).toBe(TEST_USDC)
      expect(env.announcer).toBe(LOCAL_ANNOUNCER)
    })

    it('should create minimal test environment', () => {
      const env = createMinimalTestEnvironment()

      expect(env.sender).toBe(aliceAccount)
      expect(env.receiver).toBe(bobAccount)
      expect(env.ephemeralKey).toBe(ephemeralKeypairs.tx1)
    })

    it('should create stealth payment scenario', () => {
      const scenario = createStealthPaymentScenario()

      expect(scenario.sender).toBe(aliceAccount)
      expect(scenario.receiver).toBe(bobAccount)
      expect(scenario.ephemeral).toBe(ephemeralKeypairs.tx1)
      expect(scenario.stealthAddress).toMatch(/^0x[a-f0-9]{40}$/i)
      expect(scenario.ephemeralPublicKey).toBeDefined()
      expect(scenario.viewTag).toBeGreaterThanOrEqual(0)
      expect(scenario.viewTag).toBeLessThanOrEqual(255)
    })
  })
})
