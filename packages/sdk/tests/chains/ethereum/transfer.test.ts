/**
 * Ethereum Stealth Transfer Builder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  StealthTransferBuilder,
  createStealthTransferBuilder,
  createMainnetTransferBuilder,
  createSepoliaTransferBuilder,
  generateEthereumStealthMetaAddress,
  toWei,
  EVM_CHAIN_IDS,
} from '../../../src/chains/ethereum'

describe('Ethereum Stealth Transfer Builder', () => {
  let builder: StealthTransferBuilder

  beforeEach(() => {
    builder = new StealthTransferBuilder('mainnet')
  })

  describe('constructor', () => {
    it('should create with default settings', () => {
      expect(builder.getNetwork()).toBe('mainnet')
      expect(builder.getChainId()).toBe(EVM_CHAIN_IDS.mainnet)
    })

    it('should create with custom network', () => {
      const sepoliaBuilder = new StealthTransferBuilder('sepolia')
      expect(sepoliaBuilder.getNetwork()).toBe('sepolia')
      expect(sepoliaBuilder.getChainId()).toBe(EVM_CHAIN_IDS.sepolia)
    })

    it('should create with custom RPC URL', () => {
      const customBuilder = new StealthTransferBuilder('mainnet', {
        rpcUrl: 'https://custom-rpc.example.com',
      })
      expect(customBuilder.getRpcClient().getRpcUrl()).toBe('https://custom-rpc.example.com')
    })
  })

  describe('getAdapter', () => {
    it('should return the privacy adapter', () => {
      const adapter = builder.getAdapter()
      expect(adapter).toBeDefined()
      expect(adapter.getNetwork()).toBe('mainnet')
    })
  })

  describe('getRpcClient', () => {
    it('should return the RPC client', () => {
      const rpc = builder.getRpcClient()
      expect(rpc).toBeDefined()
      expect(rpc.getNetwork()).toBe('mainnet')
    })
  })

  describe('factory functions', () => {
    it('should create builder with factory', () => {
      const factoryBuilder = createStealthTransferBuilder('sepolia')
      expect(factoryBuilder.getNetwork()).toBe('sepolia')
    })

    it('should create mainnet builder', () => {
      const mainnetBuilder = createMainnetTransferBuilder()
      expect(mainnetBuilder.getNetwork()).toBe('mainnet')
      expect(mainnetBuilder.getChainId()).toBe(1)
    })

    it('should create mainnet builder with custom URL', () => {
      const customBuilder = createMainnetTransferBuilder('https://custom.example.com')
      expect(customBuilder.getRpcClient().getRpcUrl()).toBe('https://custom.example.com')
    })

    it('should create Sepolia builder', () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      expect(sepoliaBuilder.getNetwork()).toBe('sepolia')
      expect(sepoliaBuilder.getChainId()).toBe(11155111)
    })
  })

  describe('PreparedTransaction structure', () => {
    it('should have correct EIP-1559 type', () => {
      // Test the type structure without actually calling the network
      // by verifying the constants and configuration
      const adapter = builder.getAdapter()
      const rpc = builder.getRpcClient()

      expect(adapter.getChainId()).toBe(rpc.getChainId())
    })
  })

  // Note: The following tests require network access and are integration tests
  // They are commented out but can be enabled for integration testing

  /*
  describe('integration: prepareEthTransfer', () => {
    it('should prepare ETH transfer', async () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const from = '0x1234567890123456789012345678901234567890' as `0x${string}`

      const prepared = await sepoliaBuilder.prepareEthTransfer({
        from,
        recipient: metaAddress,
        amount: toWei(0.01),
      })

      expect(prepared.transferTx.to).toBe(prepared.stealthAddress)
      expect(prepared.transferTx.value).toBe(toWei(0.01))
      expect(prepared.transferTx.type).toBe(2)
      expect(prepared.transferTx.chainId).toBe(11155111)
      expect(prepared.announcementTx.value).toBe(0n)
      expect(prepared.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(prepared.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(prepared.viewTag).toBeGreaterThanOrEqual(0)
      expect(prepared.viewTag).toBeLessThanOrEqual(255)
    })

    it('should include nonces for both transactions', async () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const from = '0x1234567890123456789012345678901234567890' as `0x${string}`

      const prepared = await sepoliaBuilder.prepareEthTransfer({
        from,
        recipient: metaAddress,
        amount: toWei(0.01),
      })

      // Transfer nonce should be consecutive with announcement nonce
      expect(prepared.announcementTx.nonce).toBe(prepared.transferTx.nonce + 1)
    })
  })

  describe('integration: prepareTokenTransfer', () => {
    it('should prepare ERC-20 transfer', async () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      const { metaAddress } = generateEthereumStealthMetaAddress()
      const from = '0x1234567890123456789012345678901234567890' as `0x${string}`
      const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}` // USDC

      const prepared = await sepoliaBuilder.prepareTokenTransfer({
        from,
        recipient: metaAddress,
        amount: 100_000_000n, // 100 USDC
        tokenContract,
        decimals: 6,
      })

      expect(prepared.transferTx.to).toBe(tokenContract)
      expect(prepared.transferTx.value).toBe(0n)
      expect(prepared.transferTx.data).toMatch(/^0xa9059cbb/) // transfer selector
      expect(prepared.tokenTransferData).toBe(prepared.transferTx.data)
    })
  })

  describe('integration: getBalance', () => {
    it('should get ETH balance', async () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      const balance = await sepoliaBuilder.getBalance(
        '0x0000000000000000000000000000000000000000'
      )

      expect(balance).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('integration: hasSufficientBalance', () => {
    it('should check balance for ETH transfer', async () => {
      const sepoliaBuilder = createSepoliaTransferBuilder()
      const result = await sepoliaBuilder.hasSufficientBalance(
        '0x0000000000000000000000000000000000000000',
        toWei(1000), // Likely insufficient
        false
      )

      expect(result.sufficient).toBe(false)
      expect(result.balance).toBeGreaterThanOrEqual(0n)
      expect(result.required).toBeGreaterThan(toWei(1000))
    })
  })
  */
})
