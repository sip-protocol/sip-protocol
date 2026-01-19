/**
 * Ethereum RPC Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  EthereumRpcClient,
  createRpcClient,
  createMainnetRpcClient,
  createSepoliaRpcClient,
  ETHEREUM_RPC_ENDPOINTS,
  EVM_CHAIN_IDS,
} from '../../../src/chains/ethereum'

describe('Ethereum RPC Client', () => {
  let rpc: EthereumRpcClient

  beforeEach(() => {
    rpc = new EthereumRpcClient('mainnet')
    rpc.clearNonceCache()
    rpc.clearTrackedTransactions()
  })

  describe('constructor', () => {
    it('should create with default settings', () => {
      const client = new EthereumRpcClient()

      expect(client.getNetwork()).toBe('mainnet')
      expect(client.getChainId()).toBe(EVM_CHAIN_IDS.mainnet)
      expect(client.getRpcUrl()).toBe(ETHEREUM_RPC_ENDPOINTS.mainnet)
    })

    it('should accept custom RPC URL', () => {
      const customUrl = 'https://custom-rpc.example.com'
      const client = new EthereumRpcClient('mainnet', { rpcUrl: customUrl })

      expect(client.getRpcUrl()).toBe(customUrl)
    })

    it('should use network-specific RPC URL', () => {
      const sepolia = new EthereumRpcClient('sepolia')
      const arbitrum = new EthereumRpcClient('arbitrum')

      expect(sepolia.getRpcUrl()).toBe(ETHEREUM_RPC_ENDPOINTS.sepolia)
      expect(arbitrum.getRpcUrl()).toBe(ETHEREUM_RPC_ENDPOINTS.arbitrum)
    })

    it('should get correct chain ID for network', () => {
      const mainnet = new EthereumRpcClient('mainnet')
      const sepolia = new EthereumRpcClient('sepolia')
      const arbitrum = new EthereumRpcClient('arbitrum')

      expect(mainnet.getChainId()).toBe(1)
      expect(sepolia.getChainId()).toBe(11155111)
      expect(arbitrum.getChainId()).toBe(42161)
    })
  })

  describe('nonce management', () => {
    it('should reserve nonces sequentially', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`

      const nonce1 = rpc.reserveNonce(address)
      const nonce2 = rpc.reserveNonce(address)
      const nonce3 = rpc.reserveNonce(address)

      expect(nonce1).toBe(0)
      expect(nonce2).toBe(1)
      expect(nonce3).toBe(2)
    })

    it('should release nonces', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`

      rpc.reserveNonce(address) // 0
      rpc.reserveNonce(address) // 1
      const nonce = rpc.reserveNonce(address) // 2

      // Release nonce 2
      rpc.releaseNonce(address, nonce)

      // Next reservation should be 2 again
      const nextNonce = rpc.reserveNonce(address)
      expect(nextNonce).toBe(2)
    })

    it('should clear nonce cache', () => {
      const address = '0x1234567890123456789012345678901234567890' as `0x${string}`

      rpc.reserveNonce(address)
      rpc.reserveNonce(address)

      rpc.clearNonceCache()

      // Should start from 0 again
      const nonce = rpc.reserveNonce(address)
      expect(nonce).toBe(0)
    })
  })

  describe('transaction tracking', () => {
    it('should return empty pending transactions initially', () => {
      const pending = rpc.getPendingTransactions()
      expect(pending).toHaveLength(0)
    })

    it('should track transactions after submission (mock)', () => {
      // Since we can't actually submit, we test the tracking mechanism
      // by calling getTrackedTransaction
      const txHash = '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`

      const tracked = rpc.getTrackedTransaction(txHash)
      expect(tracked).toBeUndefined()
    })

    it('should clear tracked transactions', () => {
      rpc.clearTrackedTransactions()
      const pending = rpc.getPendingTransactions()
      expect(pending).toHaveLength(0)
    })
  })

  describe('factory functions', () => {
    it('should create RPC client with factory', () => {
      const client = createRpcClient('sepolia')
      expect(client.getNetwork()).toBe('sepolia')
    })

    it('should create mainnet RPC client', () => {
      const client = createMainnetRpcClient()
      expect(client.getNetwork()).toBe('mainnet')
      expect(client.getChainId()).toBe(1)
    })

    it('should create mainnet RPC client with custom URL', () => {
      const customUrl = 'https://custom.example.com'
      const client = createMainnetRpcClient(customUrl)
      expect(client.getRpcUrl()).toBe(customUrl)
    })

    it('should create Sepolia RPC client', () => {
      const client = createSepoliaRpcClient()
      expect(client.getNetwork()).toBe('sepolia')
      expect(client.getChainId()).toBe(11155111)
    })
  })

  describe('network configuration', () => {
    it('should support all major networks', () => {
      const networks = [
        { name: 'mainnet' as const, chainId: 1 },
        { name: 'sepolia' as const, chainId: 11155111 },
        { name: 'arbitrum' as const, chainId: 42161 },
        { name: 'optimism' as const, chainId: 10 },
        { name: 'base' as const, chainId: 8453 },
        { name: 'polygon' as const, chainId: 137 },
      ]

      for (const network of networks) {
        const client = new EthereumRpcClient(network.name)
        expect(client.getNetwork()).toBe(network.name)
        expect(client.getChainId()).toBe(network.chainId)
        expect(client.getRpcUrl()).toBeTruthy()
      }
    })
  })

  // Note: The following tests require network access and are integration tests
  // They are commented out but can be enabled for integration testing

  /*
  describe('integration: gas price', () => {
    it('should fetch gas price', async () => {
      const client = createSepoliaRpcClient()
      const gasPrice = await client.getGasPrice()

      expect(gasPrice).toBeGreaterThan(0n)
    })

    it('should fetch fee data', async () => {
      const client = createSepoliaRpcClient()
      const feeData = await client.getFeeData()

      expect(feeData.baseFeePerGas).toBeGreaterThan(0n)
      expect(feeData.maxPriorityFeePerGas).toBeGreaterThan(0n)
      expect(feeData.maxFeePerGas).toBeGreaterThan(feeData.baseFeePerGas)
    })
  })

  describe('integration: account data', () => {
    it('should get transaction count', async () => {
      const client = createSepoliaRpcClient()
      const count = await client.getTransactionCount(
        '0x0000000000000000000000000000000000000000'
      )

      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should get balance', async () => {
      const client = createSepoliaRpcClient()
      const balance = await client.getBalance(
        '0x0000000000000000000000000000000000000000'
      )

      expect(balance).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('integration: block data', () => {
    it('should get block number', async () => {
      const client = createSepoliaRpcClient()
      const blockNumber = await client.getBlockNumber()

      expect(blockNumber).toBeGreaterThan(0)
    })
  })
  */
})
