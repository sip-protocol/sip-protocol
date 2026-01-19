/**
 * Ethereum Privacy Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  EthereumPrivacyAdapter,
  createEthereumPrivacyAdapter,
  createMainnetEthereumPrivacyAdapter,
  createSepoliaEthereumPrivacyAdapter,
  createArbitrumPrivacyAdapter,
  createOptimismPrivacyAdapter,
  createBasePrivacyAdapter,
  toWei,
} from '../../../src/chains/ethereum'

describe('EthereumPrivacyAdapter', () => {
  let adapter: EthereumPrivacyAdapter

  beforeEach(() => {
    adapter = new EthereumPrivacyAdapter({
      network: 'mainnet',
    })
  })

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new EthereumPrivacyAdapter()
      const state = defaultAdapter.getState()

      expect(state.network).toBe('mainnet')
      expect(state.chainId).toBe(1)
      expect(state.defaultPrivacyLevel).toBe('shielded')
      expect(state.isConnected).toBe(true)
    })

    it('should respect custom config', () => {
      const customAdapter = new EthereumPrivacyAdapter({
        network: 'arbitrum',
        defaultPrivacyLevel: 'compliant',
        rpcUrl: 'https://custom-rpc.com',
      })
      const state = customAdapter.getState()

      expect(state.network).toBe('arbitrum')
      expect(state.chainId).toBe(42161)
      expect(state.defaultPrivacyLevel).toBe('compliant')
      expect(state.rpcUrl).toBe('https://custom-rpc.com')
    })
  })

  describe('generateMetaAddress', () => {
    it('should generate a valid meta-address', () => {
      const result = adapter.generateMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('ethereum')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.encoded).toMatch(/^st:eth:0x[0-9a-f]{132}$/i)
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should include label when provided', () => {
      const result = adapter.generateMetaAddress('My Wallet')
      expect(result.metaAddress.label).toBe('My Wallet')
    })
  })

  describe('parseMetaAddress', () => {
    it('should parse encoded meta-address', () => {
      const generated = adapter.generateMetaAddress()
      const parsed = adapter.parseMetaAddress(generated.encoded)

      expect(parsed.spendingKey).toBe(generated.metaAddress.spendingKey)
      expect(parsed.viewingKey).toBe(generated.metaAddress.viewingKey)
    })
  })

  describe('encodeMetaAddress', () => {
    it('should encode meta-address', () => {
      const generated = adapter.generateMetaAddress()
      const encoded = adapter.encodeMetaAddress(generated.metaAddress)

      expect(encoded).toBe(generated.encoded)
    })
  })

  describe('resolveStealthAddress', () => {
    it('should resolve meta-address to stealth address', () => {
      const meta = adapter.generateMetaAddress()
      const result = adapter.resolveStealthAddress(meta.metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(result.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should resolve from encoded string', () => {
      const meta = adapter.generateMetaAddress()
      const result = adapter.resolveStealthAddress(meta.encoded)

      expect(result.ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should generate unique stealth addresses', () => {
      const meta = adapter.generateMetaAddress()
      const result1 = adapter.resolveStealthAddress(meta.metaAddress)
      const result2 = adapter.resolveStealthAddress(meta.metaAddress)

      expect(result1.ethAddress).not.toBe(result2.ethAddress)
    })
  })

  describe('checkStealthAddress', () => {
    it('should return true for matching stealth address', () => {
      const meta = adapter.generateMetaAddress()
      const stealth = adapter.resolveStealthAddress(meta.metaAddress)

      const isOwner = adapter.checkStealthAddress(
        stealth.stealthAddress,
        meta.spendingPrivateKey,
        meta.viewingPrivateKey
      )

      expect(isOwner).toBe(true)
    })

    it('should return false for non-matching stealth address', () => {
      const meta1 = adapter.generateMetaAddress()
      const meta2 = adapter.generateMetaAddress()
      const stealth = adapter.resolveStealthAddress(meta1.metaAddress)

      const isOwner = adapter.checkStealthAddress(
        stealth.stealthAddress,
        meta2.spendingPrivateKey,
        meta2.viewingPrivateKey
      )

      expect(isOwner).toBe(false)
    })
  })

  describe('buildShieldedTransfer', () => {
    it('should build a shielded ETH transfer', () => {
      const recipient = adapter.generateMetaAddress()
      const amount = toWei(1) // 1 ETH

      const build = adapter.buildShieldedTransfer({
        recipient: recipient.metaAddress,
        amount,
      })

      expect(build.stealthAddress).toBeDefined()
      expect(build.stealthEthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(build.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(build.viewTag).toBeGreaterThanOrEqual(0)
      expect(build.viewTag).toBeLessThanOrEqual(255)
      expect(build.amountCommitment).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(build.blindingFactor).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(build.transferTx.to).toBe(build.stealthEthAddress)
      expect(build.transferTx.value).toBe(amount)
      expect(build.announcementTx.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(build.announcementTx.data).toMatch(/^0x[0-9a-f]+$/i)
      expect(build.estimatedGas).toBeGreaterThan(0n)
    })

    it('should build transfer from encoded meta-address', () => {
      const recipient = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTransfer({
        recipient: recipient.encoded,
        amount: toWei(0.5),
      })

      expect(build.stealthEthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should throw for transparent privacy level', () => {
      const recipient = adapter.generateMetaAddress()

      expect(() =>
        adapter.buildShieldedTransfer({
          recipient: recipient.metaAddress,
          amount: toWei(1),
          privacyLevel: 'transparent',
        })
      ).toThrow()
    })
  })

  describe('buildShieldedTokenTransfer', () => {
    it('should build a shielded ERC-20 transfer', () => {
      const recipient = adapter.generateMetaAddress()
      const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
      const amount = 100_000_000n // 100 USDC (6 decimals)

      const build = adapter.buildShieldedTokenTransfer({
        recipient: recipient.metaAddress,
        amount,
        tokenContract,
        decimals: 6,
      })

      expect(build.stealthEthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(build.transferTx.to.toLowerCase()).toBe(tokenContract.toLowerCase())
      expect(build.transferTx.value).toBe(0n)
      expect(build.transferTx.data).toMatch(/^0xa9059cbb/i) // transfer selector
      expect(build.tokenTransferData).toBe(build.transferTx.data)
    })
  })

  describe('scan recipients', () => {
    it('should add and remove scan recipients', () => {
      const meta = adapter.generateMetaAddress()

      adapter.addScanRecipient({
        viewingPrivateKey: meta.viewingPrivateKey,
        spendingPublicKey: meta.metaAddress.spendingKey,
        label: 'Test',
      })

      expect(adapter.getScanRecipients()).toHaveLength(1)
      expect(adapter.getState().scanRecipientCount).toBe(1)

      adapter.removeScanRecipient(meta.viewingPrivateKey)

      expect(adapter.getScanRecipients()).toHaveLength(0)
    })
  })

  describe('gas estimation', () => {
    it('should estimate transfer gas', () => {
      const estimate = adapter.estimateTransferGas(false)

      expect(estimate.gasLimit).toBeGreaterThan(0n)
      expect(estimate.estimatedCost).toBeGreaterThan(0n)
      expect(estimate.estimatedCostEth).toBeTruthy()
    })

    it('should estimate token transfer gas', () => {
      const estimate = adapter.estimateTransferGas(true)

      expect(estimate.gasLimit).toBeGreaterThan(0n)
    })

    it('should estimate claim gas', () => {
      const estimate = adapter.estimateClaimGas(false)

      expect(estimate.gasLimit).toBeGreaterThan(0n)
    })
  })

  describe('utility methods', () => {
    it('should get state', () => {
      const state = adapter.getState()

      expect(state.network).toBe('mainnet')
      expect(state.chainId).toBe(1)
      expect(state.isConnected).toBe(true)
    })

    it('should get RPC URL', () => {
      expect(adapter.getRpcUrl()).toBeTruthy()
    })

    it('should get network', () => {
      expect(adapter.getNetwork()).toBe('mainnet')
    })

    it('should get chain ID', () => {
      expect(adapter.getChainId()).toBe(1)
    })

    it('should get transaction explorer URL', () => {
      const url = adapter.getTransactionExplorerUrl('0x1234')
      expect(url).toContain('etherscan.io')
      expect(url).toContain('0x1234')
    })

    it('should dispose resources', () => {
      const meta = adapter.generateMetaAddress()
      adapter.addScanRecipient({
        viewingPrivateKey: meta.viewingPrivateKey,
        spendingPublicKey: meta.metaAddress.spendingKey,
      })

      adapter.dispose()

      expect(adapter.getScanRecipients()).toHaveLength(0)
    })
  })

  describe('factory functions', () => {
    it('should create adapter with factory', () => {
      const factoryAdapter = createEthereumPrivacyAdapter({ network: 'sepolia' })
      expect(factoryAdapter.getNetwork()).toBe('sepolia')
    })

    it('should create mainnet adapter', () => {
      const mainnet = createMainnetEthereumPrivacyAdapter()
      expect(mainnet.getNetwork()).toBe('mainnet')
      expect(mainnet.getChainId()).toBe(1)
    })

    it('should create Sepolia adapter', () => {
      const sepolia = createSepoliaEthereumPrivacyAdapter()
      expect(sepolia.getNetwork()).toBe('sepolia')
      expect(sepolia.getChainId()).toBe(11155111)
    })

    it('should create Arbitrum adapter', () => {
      const arbitrum = createArbitrumPrivacyAdapter()
      expect(arbitrum.getNetwork()).toBe('arbitrum')
      expect(arbitrum.getChainId()).toBe(42161)
    })

    it('should create Optimism adapter', () => {
      const optimism = createOptimismPrivacyAdapter()
      expect(optimism.getNetwork()).toBe('optimism')
      expect(optimism.getChainId()).toBe(10)
    })

    it('should create Base adapter', () => {
      const base = createBasePrivacyAdapter()
      expect(base.getNetwork()).toBe('base')
      expect(base.getChainId()).toBe(8453)
    })
  })
})
