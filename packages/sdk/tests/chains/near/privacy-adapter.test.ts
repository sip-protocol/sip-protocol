/**
 * Tests for NEAR Privacy Adapter
 *
 * @module tests/chains/near/privacy-adapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  NEARPrivacyAdapter,
  createNEARPrivacyAdapter,
  createMainnetNEARPrivacyAdapter,
  createTestnetNEARPrivacyAdapter,
  ONE_NEAR,
  NEAR_RPC_ENDPOINTS,
} from '../../../src/chains/near'

describe('NEARPrivacyAdapter', () => {
  let adapter: NEARPrivacyAdapter

  beforeEach(() => {
    adapter = createNEARPrivacyAdapter({
      rpcUrl: 'https://rpc.mainnet.near.org',
      network: 'mainnet',
    })
  })

  describe('initialization', () => {
    it('should create adapter with default config', () => {
      const state = adapter.getState()

      expect(state.isInitialized).toBe(true)
      expect(state.network).toBe('mainnet')
      expect(state.defaultPrivacyLevel).toBe('shielded')
      expect(state.scannerRecipientCount).toBe(0)
    })

    it('should create adapter with custom config', () => {
      const customAdapter = createNEARPrivacyAdapter({
        rpcUrl: 'https://rpc.testnet.near.org',
        network: 'testnet',
        defaultPrivacyLevel: 'compliant',
      })

      const state = customAdapter.getState()
      expect(state.network).toBe('testnet')
      expect(state.defaultPrivacyLevel).toBe('compliant')
    })

    it('should create mainnet adapter with factory', () => {
      const mainnetAdapter = createMainnetNEARPrivacyAdapter()
      const state = mainnetAdapter.getState()

      expect(state.network).toBe('mainnet')
      expect(state.rpcUrl).toBe(NEAR_RPC_ENDPOINTS.mainnet)
    })

    it('should create testnet adapter with factory', () => {
      const testnetAdapter = createTestnetNEARPrivacyAdapter()
      const state = testnetAdapter.getState()

      expect(state.network).toBe('testnet')
      expect(state.rpcUrl).toBe(NEAR_RPC_ENDPOINTS.testnet)
    })
  })

  describe('meta-address generation', () => {
    it('should generate meta-address', () => {
      const result = adapter.generateMetaAddress('Test Wallet')

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
      expect(result.encoded).toMatch(/^sip:near:0x[a-f0-9]+:0x[a-f0-9]+$/)
      expect(result.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should generate unique meta-addresses', () => {
      const result1 = adapter.generateMetaAddress()
      const result2 = adapter.generateMetaAddress()

      expect(result1.encoded).not.toBe(result2.encoded)
      expect(result1.viewingPrivateKey).not.toBe(result2.viewingPrivateKey)
      expect(result1.spendingPrivateKey).not.toBe(result2.spendingPrivateKey)
    })

    it('should parse encoded meta-address', () => {
      const generated = adapter.generateMetaAddress()
      const parsed = adapter.parseMetaAddress(generated.encoded)

      expect(parsed.chain).toBe('near')
      expect(parsed.spendingKey).toBe(generated.metaAddress.spendingKey)
      expect(parsed.viewingKey).toBe(generated.metaAddress.viewingKey)
    })

    it('should encode meta-address', () => {
      const generated = adapter.generateMetaAddress()
      const encoded = adapter.encodeMetaAddress(generated.metaAddress)

      expect(encoded).toBe(generated.encoded)
    })
  })

  describe('stealth address resolution', () => {
    it('should resolve stealth address from meta-address', () => {
      const { metaAddress } = adapter.generateMetaAddress()
      const result = adapter.resolveStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.address).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.stealthAddress.ephemeralPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.stealthAddress.viewTag).toBeLessThanOrEqual(255)
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.sharedSecret).toMatch(/^0x[a-f0-9]+$/)
    })

    it('should resolve stealth address from encoded string', () => {
      const { encoded } = adapter.generateMetaAddress()
      const result = adapter.resolveStealthAddress(encoded)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate unique stealth addresses each time', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      const result1 = adapter.resolveStealthAddress(metaAddress)
      const result2 = adapter.resolveStealthAddress(metaAddress)

      expect(result1.stealthAccountId).not.toBe(result2.stealthAccountId)
      expect(result1.stealthAddress.ephemeralPublicKey).not.toBe(
        result2.stealthAddress.ephemeralPublicKey
      )
    })
  })

  describe('shielded transfers', () => {
    it('should build shielded NEAR transfer', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTransfer({
        senderAccountId: 'alice.near',
        recipient: metaAddress,
        amount: ONE_NEAR,
      })

      expect(build.privacyLevel).toBe('shielded')
      expect(build.transfer).toBeDefined()
      expect(build.transfer.actions).toBeDefined()
      expect(build.transfer.actions.length).toBeGreaterThan(0)
      expect(build.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should build shielded transfer with encoded meta-address', () => {
      const { encoded } = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTransfer({
        senderAccountId: 'alice.near',
        recipient: encoded,
        amount: ONE_NEAR,
      })

      expect(build.privacyLevel).toBe('shielded')
      expect(build.transfer).toBeDefined()
    })

    it('should throw for transparent privacy level', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      expect(() =>
        adapter.buildShieldedTransfer({
          senderAccountId: 'alice.near',
          recipient: metaAddress,
          amount: ONE_NEAR,
          privacyLevel: 'transparent',
        })
      ).toThrow('Use regular NEAR transfer for transparent privacy level')
    })

    it('should build shielded token transfer', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTokenTransfer({
        senderAccountId: 'alice.near',
        recipient: metaAddress,
        tokenContract: 'usdc.near',
        amount: 1_000_000n,
      })

      expect(build.privacyLevel).toBe('shielded')
      expect(build.transfer).toBeDefined()
      expect(build.transfer.actions).toBeDefined()
    })

    it('should throw for invalid token contract', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      expect(() =>
        adapter.buildShieldedTokenTransfer({
          senderAccountId: 'alice.near',
          recipient: metaAddress,
          tokenContract: 'X', // Invalid - too short
          amount: 1_000_000n,
        })
      ).toThrow('Invalid token contract')
    })

    it('should build storage deposit', () => {
      // Use an implicit account (64 hex chars)
      const stealthAccountId = 'a'.repeat(64)
      const actions = adapter.buildStorageDeposit(
        stealthAccountId,
        'usdc.near'
      )

      expect(actions).toBeDefined()
      expect(actions.length).toBe(1)
      expect(actions[0].type).toBe('FunctionCall')
    })
  })

  describe('gas estimation', () => {
    it('should estimate native transfer gas', () => {
      const estimate = adapter.estimateTransferGas(false, false)

      expect(estimate.gas).toBeGreaterThan(0n)
      expect(estimate.estimatedCost).toBeGreaterThan(0n)
      expect(estimate.breakdown.length).toBe(1)
      expect(estimate.breakdown[0].action).toBe('transfer')
    })

    it('should estimate token transfer gas', () => {
      const estimate = adapter.estimateTransferGas(true, false)

      expect(estimate.gas).toBeGreaterThan(0n)
      expect(estimate.breakdown[0].action).toBe('ft_transfer')
    })

    it('should estimate gas with storage deposit', () => {
      const withStorage = adapter.estimateTransferGas(true, true)
      const withoutStorage = adapter.estimateTransferGas(true, false)

      expect(withStorage.gas).toBeGreaterThan(withoutStorage.gas)
      expect(withStorage.breakdown.length).toBe(2)
    })

    it('should estimate claim gas', () => {
      const withDelete = adapter.estimateClaimGas(true)
      const withoutDelete = adapter.estimateClaimGas(false)

      expect(withDelete.gas).toBeGreaterThan(withoutDelete.gas)
      expect(withDelete.breakdown.some(b => b.action === 'delete_account')).toBe(true)
      expect(withoutDelete.breakdown.some(b => b.action === 'delete_account')).toBe(false)
    })
  })

  describe('recipient management', () => {
    it('should add scan recipient', () => {
      const { viewingPrivateKey, spendingPrivateKey } = adapter.generateMetaAddress()

      adapter.addScanRecipient({
        viewingPrivateKey,
        spendingPrivateKey,
        label: 'Test',
      })

      const recipients = adapter.getScanRecipients()
      expect(recipients.length).toBe(1)
      expect(recipients[0].label).toBe('Test')
    })

    it('should remove scan recipient', () => {
      const { viewingPrivateKey, spendingPrivateKey } = adapter.generateMetaAddress()

      adapter.addScanRecipient({
        viewingPrivateKey,
        spendingPrivateKey,
        label: 'Test',
      })

      adapter.removeScanRecipient('Test')

      const recipients = adapter.getScanRecipients()
      expect(recipients.length).toBe(0)
    })

    it('should clear all recipients', () => {
      const meta1 = adapter.generateMetaAddress()
      const meta2 = adapter.generateMetaAddress()

      adapter.addScanRecipient({
        viewingPrivateKey: meta1.viewingPrivateKey,
        spendingPrivateKey: meta1.spendingPrivateKey,
        label: 'Wallet 1',
      })

      adapter.addScanRecipient({
        viewingPrivateKey: meta2.viewingPrivateKey,
        spendingPrivateKey: meta2.spendingPrivateKey,
        label: 'Wallet 2',
      })

      expect(adapter.getScanRecipients().length).toBe(2)

      adapter.clearScanRecipients()

      expect(adapter.getScanRecipients().length).toBe(0)
    })
  })

  describe('checkStealthAddress', () => {
    it('should verify stealth address ownership', () => {
      const { metaAddress, viewingPrivateKey, spendingPrivateKey } =
        adapter.generateMetaAddress()

      const { stealthAddress } = adapter.resolveStealthAddress(metaAddress)

      const isOwner = adapter.checkStealthAddress(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(isOwner).toBe(true)
    })

    it('should reject non-owned stealth address', () => {
      const meta1 = adapter.generateMetaAddress()
      const meta2 = adapter.generateMetaAddress()

      const { stealthAddress } = adapter.resolveStealthAddress(meta1.metaAddress)

      // Use wrong keys
      const isOwner = adapter.checkStealthAddress(
        stealthAddress,
        meta2.spendingPrivateKey,
        meta2.viewingPrivateKey
      )

      expect(isOwner).toBe(false)
    })
  })

  describe('deriveStealthPrivateKey', () => {
    it('should derive stealth private key', () => {
      const { metaAddress, viewingPrivateKey, spendingPrivateKey } =
        adapter.generateMetaAddress()

      const { stealthAddress } = adapter.resolveStealthAddress(metaAddress)

      const recovery = adapter.deriveStealthPrivateKey(
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(recovery.privateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(recovery.stealthAddress).toBe(stealthAddress.address)
      expect(recovery.ephemeralPublicKey).toBe(stealthAddress.ephemeralPublicKey)
    })
  })

  describe('utilities', () => {
    it('should return RPC URL', () => {
      expect(adapter.getRpcUrl()).toBe('https://rpc.mainnet.near.org')
    })

    it('should return network', () => {
      expect(adapter.getNetwork()).toBe('mainnet')
    })

    it('should return explorer URL', () => {
      const url = adapter.getTransactionExplorerUrl('abc123')
      expect(url).toContain('abc123')
      expect(url).toContain('nearblocks')
    })

    it('should return default RPC URL', () => {
      expect(NEARPrivacyAdapter.getDefaultRpcUrl('mainnet')).toBe(
        NEAR_RPC_ENDPOINTS.mainnet
      )
      expect(NEARPrivacyAdapter.getDefaultRpcUrl('testnet')).toBe(
        NEAR_RPC_ENDPOINTS.testnet
      )
    })

    it('should dispose adapter', () => {
      const meta = adapter.generateMetaAddress()
      adapter.addScanRecipient({
        viewingPrivateKey: meta.viewingPrivateKey,
        spendingPrivateKey: meta.spendingPrivateKey,
        label: 'Test',
      })

      adapter.dispose()

      const state = adapter.getState()
      expect(state.isInitialized).toBe(false)
      expect(state.scannerRecipientCount).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should enable and disable cache', () => {
      adapter.enableCache()
      adapter.disableCache()
      // No errors means it works
      expect(true).toBe(true)
    })
  })

  describe('integration: full privacy flow', () => {
    it('should complete send-scan-claim flow', async () => {
      // 1. Recipient generates meta-address
      const { viewingPrivateKey, spendingPrivateKey, encoded } =
        adapter.generateMetaAddress('Recipient Wallet')

      // 2. Sender builds shielded transfer
      const build = adapter.buildShieldedTransfer({
        senderAccountId: 'sender.near',
        recipient: encoded,
        amount: ONE_NEAR,
      })

      expect(build.transfer.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(build.transfer.announcementMemo).toBeDefined()

      // 3. Recipient adds themselves to scanner
      adapter.addScanRecipient({
        viewingPrivateKey,
        spendingPrivateKey,
        label: 'Recipient Wallet',
      })

      // 4. Verify stealth address ownership
      const isOwner = adapter.checkStealthAddress(
        build.stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )
      expect(isOwner).toBe(true)

      // 5. Derive private key for claiming
      const recovery = adapter.deriveStealthPrivateKey(
        build.stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )
      expect(recovery.privateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })
})
