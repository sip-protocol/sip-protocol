/**
 * Tests for Ethereum wallet utilities
 */

import { describe, it, expect } from 'vitest'
import {
  toHex,
  fromHex,
  hexToNumber,
  normalizeAddress,
  getDefaultRpcEndpoint,
  createMockEthereumProvider,
  EthereumChainId,
} from '../../../src/wallet'

describe('toHex', () => {
  it('should convert number to hex', () => {
    expect(toHex(0)).toBe('0x0')
    expect(toHex(1)).toBe('0x1')
    expect(toHex(255)).toBe('0xff')
    expect(toHex(256)).toBe('0x100')
    expect(toHex(1000000)).toBe('0xf4240')
  })

  it('should convert bigint to hex', () => {
    expect(toHex(0n)).toBe('0x0')
    expect(toHex(1_000_000_000_000_000_000n)).toBe('0xde0b6b3a7640000')
  })

  it('should handle chain IDs', () => {
    expect(toHex(1)).toBe('0x1')
    expect(toHex(137)).toBe('0x89')
    expect(toHex(11155111)).toBe('0xaa36a7')
  })
})

describe('fromHex', () => {
  it('should convert hex to bigint', () => {
    expect(fromHex('0x0')).toBe(0n)
    expect(fromHex('0x1')).toBe(1n)
    expect(fromHex('0xff')).toBe(255n)
    expect(fromHex('0x100')).toBe(256n)
  })

  it('should handle large values', () => {
    expect(fromHex('0xde0b6b3a7640000')).toBe(1_000_000_000_000_000_000n)
  })
})

describe('hexToNumber', () => {
  it('should convert hex to number', () => {
    expect(hexToNumber('0x0')).toBe(0)
    expect(hexToNumber('0x1')).toBe(1)
    expect(hexToNumber('0xff')).toBe(255)
    expect(hexToNumber('0x89')).toBe(137) // Polygon
  })

  it('should handle chain IDs', () => {
    expect(hexToNumber('0x1')).toBe(EthereumChainId.MAINNET)
    expect(hexToNumber('0x89')).toBe(EthereumChainId.POLYGON)
    expect(hexToNumber('0xa')).toBe(EthereumChainId.OPTIMISM)
  })
})

describe('normalizeAddress', () => {
  it('should lowercase address', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b'
    expect(normalizeAddress(address)).toBe(address.toLowerCase())
  })

  it('should handle already lowercase address', () => {
    const address = '0x742d35cc6634c0532925a3b844bc9e7595f8fb1b'
    expect(normalizeAddress(address)).toBe(address)
  })
})

describe('getDefaultRpcEndpoint', () => {
  it('should return mainnet endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.MAINNET)).toBe(
      'https://eth.llamarpc.com'
    )
  })

  it('should return polygon endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.POLYGON)).toBe(
      'https://polygon-rpc.com'
    )
  })

  it('should return sepolia endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.SEPOLIA)).toBe(
      'https://rpc.sepolia.org'
    )
  })

  it('should return arbitrum endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.ARBITRUM)).toBe(
      'https://arb1.arbitrum.io/rpc'
    )
  })

  it('should return optimism endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.OPTIMISM)).toBe(
      'https://mainnet.optimism.io'
    )
  })

  it('should return base endpoint', () => {
    expect(getDefaultRpcEndpoint(EthereumChainId.BASE)).toBe(
      'https://mainnet.base.org'
    )
  })

  it('should return localhost for unknown chains', () => {
    expect(getDefaultRpcEndpoint(99999)).toBe('http://localhost:8545')
  })
})

describe('createMockEthereumProvider', () => {
  it('should create provider with default config', () => {
    const provider = createMockEthereumProvider()
    expect(provider.isMetaMask).toBe(true)
    expect(provider.isConnected?.()).toBe(false)
    expect(provider.selectedAddress).toBeNull()
  })

  it('should connect successfully', async () => {
    const provider = createMockEthereumProvider()
    const accounts = await provider.request({ method: 'eth_requestAccounts' })

    expect(accounts).toBeInstanceOf(Array)
    expect(accounts).toHaveLength(1)
    expect(provider.isConnected?.()).toBe(true)
    expect(provider.selectedAddress).toBeTruthy()
  })

  it('should return chain ID', async () => {
    const provider = createMockEthereumProvider({
      chainId: EthereumChainId.POLYGON,
    })
    const chainId = await provider.request({ method: 'eth_chainId' })

    expect(chainId).toBe('0x89')
  })

  it('should return balance', async () => {
    const balance = 5_000_000_000_000_000_000n
    const provider = createMockEthereumProvider({ balance })
    await provider.request({ method: 'eth_requestAccounts' })

    const result = await provider.request({
      method: 'eth_getBalance',
      params: ['0x123', 'latest'],
    })

    expect(result).toBe(toHex(balance))
  })

  it('should sign message', async () => {
    const provider = createMockEthereumProvider()
    await provider.request({ method: 'eth_requestAccounts' })

    const signature = await provider.request({
      method: 'personal_sign',
      params: ['0x48656c6c6f', '0x123'],
    })

    expect(signature).toMatch(/^0x[0-9a-f]+$/)
  })

  it('should send transaction', async () => {
    const provider = createMockEthereumProvider()
    await provider.request({ method: 'eth_requestAccounts' })

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ to: '0x123', value: '0x100' }],
    })

    expect(txHash).toMatch(/^0x[0-9a-f]+$/)
  })

  it('should fail connect when configured', async () => {
    const provider = createMockEthereumProvider({ shouldFailConnect: true })

    await expect(
      provider.request({ method: 'eth_requestAccounts' })
    ).rejects.toThrow()
  })

  it('should fail sign when configured', async () => {
    const provider = createMockEthereumProvider({ shouldFailSign: true })
    await provider.request({ method: 'eth_requestAccounts' })

    await expect(
      provider.request({ method: 'personal_sign', params: ['0x', '0x'] })
    ).rejects.toThrow()
  })

  it('should fail transaction when configured', async () => {
    const provider = createMockEthereumProvider({ shouldFailTransaction: true })
    await provider.request({ method: 'eth_requestAccounts' })

    await expect(
      provider.request({ method: 'eth_sendTransaction', params: [{}] })
    ).rejects.toThrow()
  })

  it('should handle events', async () => {
    const provider = createMockEthereumProvider()
    let chainChanged = false

    provider.on('chainChanged', () => {
      chainChanged = true
    })

    await provider.request({ method: 'eth_requestAccounts' })
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    })

    expect(chainChanged).toBe(true)
  })

  it('should get transaction receipt', async () => {
    const provider = createMockEthereumProvider()
    await provider.request({ method: 'eth_requestAccounts' })

    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: ['0x123'],
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionHash).toBe('0x123')
    expect(receipt.status).toBe('0x1')
  })
})

describe('EthereumChainId', () => {
  it('should have correct chain IDs', () => {
    expect(EthereumChainId.MAINNET).toBe(1)
    expect(EthereumChainId.GOERLI).toBe(5)
    expect(EthereumChainId.SEPOLIA).toBe(11155111)
    expect(EthereumChainId.POLYGON).toBe(137)
    expect(EthereumChainId.ARBITRUM).toBe(42161)
    expect(EthereumChainId.OPTIMISM).toBe(10)
    expect(EthereumChainId.BASE).toBe(8453)
    expect(EthereumChainId.LOCALHOST).toBe(1337)
  })
})
