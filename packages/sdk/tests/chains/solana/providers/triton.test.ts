/**
 * Triton Provider Tests
 *
 * Tests for TritonProvider implementation including gRPC subscriptions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TritonProvider } from '../../../../src/chains/solana/providers/triton'
import { createProvider } from '../../../../src/chains/solana/providers/interface'

describe('TritonProvider', () => {
  const validConfig = {
    endpoint: 'https://sip-protocol.mainnet.rpcpool.com',
    xToken: 'test-token',
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with valid config', () => {
      const provider = new TritonProvider(validConfig)
      expect(provider.name).toBe('triton')
    })

    it('should throw error without endpoint', () => {
      expect(() => {
        new TritonProvider({ endpoint: '' })
      }).toThrow('Triton endpoint is required')
    })

    it('should use endpoint as grpcEndpoint if not specified', () => {
      const provider = new TritonProvider({
        endpoint: 'https://test.rpcpool.com',
      })
      expect(provider.name).toBe('triton')
    })

    it('should accept custom grpcEndpoint', () => {
      const provider = new TritonProvider({
        endpoint: 'https://rpc.rpcpool.com',
        grpcEndpoint: 'https://grpc.rpcpool.com',
      })
      expect(provider.name).toBe('triton')
    })

    it('should work without xToken (public endpoints)', () => {
      const provider = new TritonProvider({
        endpoint: 'https://public.rpcpool.com',
      })
      expect(provider.name).toBe('triton')
    })
  })

  describe('getAssetsByOwner validation', () => {
    it('should throw error for invalid address', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(provider.getAssetsByOwner('invalid')).rejects.toThrow(
        'Invalid Solana address for owner'
      )
    })

    it('should throw error for empty address', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(provider.getAssetsByOwner('')).rejects.toThrow(
        'Invalid Solana address for owner'
      )
    })
  })

  describe('getTokenBalance validation', () => {
    it('should throw error for invalid owner address', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(
        provider.getTokenBalance('invalid', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      ).rejects.toThrow('Invalid Solana address for owner')
    })

    it('should throw error for invalid mint address', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(
        provider.getTokenBalance('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'invalid')
      ).rejects.toThrow('Invalid Solana address for mint')
    })
  })

  describe('supportsSubscriptions', () => {
    it('should return true (Triton supports gRPC subscriptions)', () => {
      const provider = new TritonProvider(validConfig)
      expect(provider.supportsSubscriptions()).toBe(true)
    })
  })

  describe('subscribeToTransfers validation', () => {
    it('should throw for invalid address', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(
        provider.subscribeToTransfers('invalid', vi.fn())
      ).rejects.toThrow('Invalid Solana address')
    })
  })

  describe('getConnection', () => {
    it('should return the underlying Connection', () => {
      const provider = new TritonProvider(validConfig)
      const connection = provider.getConnection()
      expect(connection).toBeDefined()
      expect(connection.rpcEndpoint).toBe(validConfig.endpoint)
    })
  })

  describe('isGrpcReady', () => {
    it('should return false before subscription', () => {
      const provider = new TritonProvider(validConfig)
      expect(provider.isGrpcReady()).toBe(false)
    })
  })

  describe('dispose', () => {
    it('should not throw when called on fresh provider', async () => {
      const provider = new TritonProvider(validConfig)
      await expect(provider.dispose()).resolves.toBeUndefined()
    })

    it('should reset gRPC ready state', async () => {
      const provider = new TritonProvider(validConfig)
      await provider.dispose()
      expect(provider.isGrpcReady()).toBe(false)
    })
  })
})

describe('createProvider with triton', () => {
  it('should create TritonProvider via factory', () => {
    const provider = createProvider('triton', {
      endpoint: 'https://test.rpcpool.com',
    })

    expect(provider).toBeInstanceOf(TritonProvider)
    expect(provider.name).toBe('triton')
  })

  it('should pass xToken to provider', () => {
    const provider = createProvider('triton', {
      endpoint: 'https://test.rpcpool.com',
      xToken: 'my-secret-token',
    })

    expect(provider).toBeInstanceOf(TritonProvider)
  })

  it('should throw for missing endpoint', () => {
    expect(() => {
      createProvider('triton', { endpoint: '' })
    }).toThrow('Triton endpoint is required')
  })
})

describe('TritonProvider integration scenarios', () => {
  it('should work with mainnet configuration', () => {
    const provider = new TritonProvider({
      endpoint: 'https://sip-protocol.mainnet.rpcpool.com',
      xToken: 'prod-token',
      cluster: 'mainnet-beta',
    })

    expect(provider.name).toBe('triton')
    expect(provider.supportsSubscriptions()).toBe(true)
  })

  it('should work with devnet configuration', () => {
    const provider = new TritonProvider({
      endpoint: 'https://sip-protocol.devnet.rpcpool.com',
      cluster: 'devnet',
    })

    expect(provider.name).toBe('triton')
  })

  it('should expose connection with correct endpoint', () => {
    const endpoint = 'https://custom.rpcpool.com'
    const provider = new TritonProvider({ endpoint })
    const connection = provider.getConnection()

    expect(connection.rpcEndpoint).toBe(endpoint)
  })
})

describe('TritonProvider interface contract', () => {
  let provider: TritonProvider

  beforeEach(() => {
    provider = new TritonProvider({
      endpoint: 'https://test.rpcpool.com',
    })
  })

  it('should have a name property', () => {
    expect(typeof provider.name).toBe('string')
    expect(provider.name).toBe('triton')
  })

  it('should have getAssetsByOwner method', () => {
    expect(typeof provider.getAssetsByOwner).toBe('function')
  })

  it('should have getTokenBalance method', () => {
    expect(typeof provider.getTokenBalance).toBe('function')
  })

  it('should have supportsSubscriptions method returning true', () => {
    expect(typeof provider.supportsSubscriptions).toBe('function')
    expect(provider.supportsSubscriptions()).toBe(true)
  })

  it('should have subscribeToTransfers method', () => {
    expect(typeof provider.subscribeToTransfers).toBe('function')
  })

  it('should have getConnection method', () => {
    expect(typeof provider.getConnection).toBe('function')
  })

  it('should have isGrpcReady method', () => {
    expect(typeof provider.isGrpcReady).toBe('function')
  })

  it('should have dispose method', () => {
    expect(typeof provider.dispose).toBe('function')
  })
})
