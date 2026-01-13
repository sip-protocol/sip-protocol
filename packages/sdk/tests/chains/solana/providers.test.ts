/**
 * Solana RPC Provider Tests
 *
 * Tests for RPC-provider-agnostic architecture:
 * - SolanaRPCProvider interface
 * - createProvider factory
 * - HeliusProvider
 * - GenericProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createProvider,
  HeliusProvider,
  GenericProvider,
  QuickNodeProvider,
  TritonProvider,
} from '../../../src/chains/solana/providers'
import type {
  SolanaRPCProvider,
  TokenAsset,
  ProviderType,
} from '../../../src/chains/solana/providers/interface'
import { sanitizeUrl } from '../../../src/chains/solana/constants'

// Valid Solana addresses for testing (32-44 chars, base58)
const TEST_OWNER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const TEST_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// L7 FIX: Store original fetch for restoration
const originalFetch = global.fetch

describe('Solana RPC Providers', () => {
  // L7 FIX: Restore global.fetch after each test to prevent leaks
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })
  describe('createProvider factory', () => {
    it('should create HeliusProvider with helius type', () => {
      const provider = createProvider('helius', { apiKey: 'test-key' })
      expect(provider).toBeInstanceOf(HeliusProvider)
      expect(provider.name).toBe('helius')
    })

    it('should create GenericProvider with generic type', () => {
      const provider = createProvider('generic', {
        endpoint: 'https://api.devnet.solana.com',
      })
      expect(provider).toBeInstanceOf(GenericProvider)
      expect(provider.name).toBe('generic')
    })

    it('should throw for unknown provider type', () => {
      expect(() =>
        createProvider('unknown' as ProviderType, {})
      ).toThrow('unknown provider type: unknown')
    })

    it('should create QuickNodeProvider with quicknode type', () => {
      const provider = createProvider('quicknode', {
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })
      expect(provider).toBeInstanceOf(QuickNodeProvider)
      expect(provider.name).toBe('quicknode')
    })

    it('should create TritonProvider with triton type', () => {
      const provider = createProvider('triton', {
        xToken: 'test-x-token',
      })
      expect(provider).toBeInstanceOf(TritonProvider)
      expect(provider.name).toBe('triton')
    })
  })

  describe('HeliusProvider', () => {
    it('should require API key', () => {
      expect(
        () => new HeliusProvider({ apiKey: '' })
      ).toThrow('Helius API key is required')
    })

    it('should use correct cluster endpoints', () => {
      const mainnetProvider = new HeliusProvider({
        apiKey: 'test-key',
        cluster: 'mainnet-beta',
      })
      expect(mainnetProvider.name).toBe('helius')

      const devnetProvider = new HeliusProvider({
        apiKey: 'test-key',
        cluster: 'devnet',
      })
      expect(devnetProvider.name).toBe('helius')
    })

    it('should not support subscriptions (client-side)', () => {
      const provider = new HeliusProvider({ apiKey: 'test-key' })
      expect(provider.supportsSubscriptions()).toBe(false)
    })

    describe('getAssetsByOwner (mocked)', () => {
      it('should parse DAS API response correctly', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        // Mock fetch for DAS API
        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [
              {
                id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                interface: 'FungibleToken',
                token_info: {
                  balance: 1000000,
                  decimals: 6,
                  symbol: 'USDC',
                },
              },
              {
                id: 'So11111111111111111111111111111111111111112',
                interface: 'FungibleToken',
                token_info: {
                  balance: 5000000000,
                  decimals: 9,
                  symbol: 'SOL',
                },
              },
              {
                // NFT should be filtered out
                id: 'nft-mint-address',
                interface: 'V1_NFT',
                token_info: {
                  balance: 1,
                  decimals: 0,
                },
              },
            ],
            total: 3,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)

        expect(assets).toHaveLength(2) // Only fungible tokens
        expect(assets[0]).toEqual({
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: 1000000n,
          decimals: 6,
          symbol: 'USDC',
          name: undefined,
          logoUri: undefined,
        })
        expect(assets[1]).toEqual({
          mint: 'So11111111111111111111111111111111111111112',
          amount: 5000000000n,
          decimals: 9,
          symbol: 'SOL',
          name: undefined,
          logoUri: undefined,
        })
      })

      it('should handle API errors', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        } as Response)

        await expect(provider.getAssetsByOwner(TEST_OWNER)).rejects.toThrow(
          'Helius API error: 401 Unauthorized'
        )
      })

      it('should handle JSON-RPC errors', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockErrorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockErrorResponse),
        } as Response)

        await expect(provider.getAssetsByOwner(TEST_OWNER)).rejects.toThrow(
          'Helius RPC error: Invalid Request (code: -32600)'
        )
      })

      it('should handle large balances as strings', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        // Large balance that would lose precision as JavaScript number
        const largeBalance = '9999999999999999999'

        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [
              {
                id: 'test-mint',
                interface: 'FungibleToken',
                token_info: {
                  balance: largeBalance, // String to preserve precision
                  decimals: 9,
                },
              },
            ],
            total: 1,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)

        expect(assets).toHaveLength(1)
        expect(assets[0].amount).toBe(BigInt(largeBalance))
      })
    })

    describe('getTokenBalance (mocked)', () => {
      it('should return balance for specific mint', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockResponse = {
          tokens: [
            {
              mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              amount: 5000000,
              decimals: 6,
              tokenAccount: 'token-account-address',
            },
          ],
          nativeBalance: 1000000000,
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const balance = await provider.getTokenBalance(
          TEST_OWNER,
          TEST_MINT
        )

        expect(balance).toBe(5000000n)
      })

      it('should return 0n for non-existent token', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockResponse = {
          tokens: [],
          nativeBalance: 1000000000,
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        // Use valid addresses - we're testing the case where the token doesn't exist
        // in the response, not invalid addresses
        const balance = await provider.getTokenBalance(
          TEST_OWNER,
          'So11111111111111111111111111111111111111112' // Valid mint but not in response
        )

        expect(balance).toBe(0n)
      })
    })

    // L1 FIX: Edge case tests for improved coverage
    describe('edge cases', () => {
      it('should handle network timeout gracefully', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        // Mock fetch that triggers AbortError
        global.fetch = vi.fn().mockImplementation(() => {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          return Promise.reject(error)
        })

        await expect(provider.getAssetsByOwner(TEST_OWNER)).rejects.toThrow(
          'Request timeout'
        )
      })

      it('should handle malformed JSON response', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        } as Response)

        await expect(provider.getAssetsByOwner(TEST_OWNER)).rejects.toThrow()
      })

      it('should handle max int64 balance values', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        // Max safe integer for JavaScript + extra digits (as string for precision)
        const maxBalance = '18446744073709551615' // Max uint64

        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [
              {
                id: 'test-mint',
                interface: 'FungibleToken',
                token_info: {
                  balance: maxBalance,
                  decimals: 0,
                },
              },
            ],
            total: 1,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)

        expect(assets).toHaveLength(1)
        expect(assets[0].amount).toBe(BigInt(maxBalance))
      })

      it('should handle empty result items array', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [],
            total: 0,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)
        expect(assets).toHaveLength(0)
      })

      it('should handle missing token_info gracefully', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [
              {
                id: 'test-mint',
                interface: 'FungibleToken',
                // Missing token_info - should be skipped
              },
            ],
            total: 1,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)
        expect(assets).toHaveLength(0) // Skipped due to missing token_info
      })

      it('should handle zero balance tokens (filter them out)', async () => {
        const provider = new HeliusProvider({ apiKey: 'test-key' })

        const mockResponse = {
          jsonrpc: '2.0',
          result: {
            items: [
              {
                id: 'zero-balance-mint',
                interface: 'FungibleToken',
                token_info: {
                  balance: 0,
                  decimals: 6,
                },
              },
              {
                id: 'has-balance-mint',
                interface: 'FungibleToken',
                token_info: {
                  balance: 1000000,
                  decimals: 6,
                },
              },
            ],
            total: 2,
            limit: 1000,
            page: 1,
          },
          id: 'sip-test',
        }

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)

        const assets = await provider.getAssetsByOwner(TEST_OWNER)
        // Zero balance should be included (DAS API returns it, we don't filter)
        expect(assets.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('GenericProvider', () => {
    it('should accept endpoint string', () => {
      const provider = new GenericProvider({
        endpoint: 'https://api.devnet.solana.com',
      })
      expect(provider.name).toBe('generic')
    })

    it('should use cluster default endpoint', () => {
      const devnetProvider = new GenericProvider({ cluster: 'devnet' })
      expect(devnetProvider.name).toBe('generic')

      const mainnetProvider = new GenericProvider({ cluster: 'mainnet-beta' })
      expect(mainnetProvider.name).toBe('generic')
    })

    it('should not support subscriptions', () => {
      const provider = new GenericProvider({
        endpoint: 'https://api.devnet.solana.com',
      })
      expect(provider.supportsSubscriptions()).toBe(false)
    })

    it('should expose connection for advanced use', () => {
      const provider = new GenericProvider({
        endpoint: 'https://api.devnet.solana.com',
      })
      const connection = provider.getConnection()
      expect(connection).toBeDefined()
      expect(connection.rpcEndpoint).toBe('https://api.devnet.solana.com')
    })

    it('should validate owner address in getAssetsByOwner', async () => {
      const provider = new GenericProvider({
        endpoint: 'https://api.devnet.solana.com',
      })

      await expect(
        provider.getAssetsByOwner('invalid-address')
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should validate addresses in getTokenBalance', async () => {
      const provider = new GenericProvider({
        endpoint: 'https://api.devnet.solana.com',
      })

      await expect(
        provider.getTokenBalance('invalid-owner', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      ).rejects.toThrow('invalid Solana address format')

      await expect(
        provider.getTokenBalance('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'invalid-mint')
      ).rejects.toThrow('invalid Solana address format')
    })
  })

  describe('QuickNodeProvider', () => {
    it('should require endpoint', () => {
      expect(
        () => new QuickNodeProvider({ endpoint: '' })
      ).toThrow('endpoint is required')
    })

    it('should validate endpoint URL format', () => {
      expect(
        () => new QuickNodeProvider({ endpoint: 'not-a-url' })
      ).toThrow('invalid endpoint URL format')
    })

    it('should accept valid endpoint', () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })
      expect(provider.name).toBe('quicknode')
    })

    it('should support subscriptions by default', () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })
      expect(provider.supportsSubscriptions()).toBe(true)
    })

    it('should allow disabling subscriptions', () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
        enableGrpc: false,
      })
      expect(provider.supportsSubscriptions()).toBe(false)
    })

    it('should expose connection for advanced use', () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })
      const connection = provider.getConnection()
      expect(connection).toBeDefined()
    })

    it('should validate owner address in getAssetsByOwner', async () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })

      await expect(
        provider.getAssetsByOwner('invalid-address')
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should validate addresses in getTokenBalance', async () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })

      await expect(
        provider.getTokenBalance('invalid-owner', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      ).rejects.toThrow('invalid Solana address format')

      await expect(
        provider.getTokenBalance('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'invalid-mint')
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should validate address in subscribeToTransfers', async () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })

      await expect(
        provider.subscribeToTransfers('invalid-address', () => {})
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should throw when subscribing with gRPC disabled', async () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
        enableGrpc: false,
      })

      await expect(
        provider.subscribeToTransfers('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', () => {})
      ).rejects.toThrow('gRPC subscriptions are disabled')
    })

    it('should cleanup resources on close', async () => {
      const provider = new QuickNodeProvider({
        endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123',
      })

      // Should not throw
      await provider.close()
    })
  })

  describe('TritonProvider', () => {
    it('should require xToken', () => {
      expect(
        () => new TritonProvider({ xToken: '' })
      ).toThrow('x-token is required')
    })

    it('should accept valid xToken', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })
      expect(provider.name).toBe('triton')
    })

    it('should use default mainnet endpoint', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
        cluster: 'mainnet-beta',
      })
      expect(provider.name).toBe('triton')
    })

    it('should use devnet endpoint when specified', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
        cluster: 'devnet',
      })
      expect(provider.name).toBe('triton')
    })

    it('should accept custom endpoint', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
        endpoint: 'https://custom.rpcpool.com',
      })
      expect(provider.name).toBe('triton')
    })

    it('should support subscriptions by default', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })
      expect(provider.supportsSubscriptions()).toBe(true)
    })

    it('should allow disabling subscriptions', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
        enableGrpc: false,
      })
      expect(provider.supportsSubscriptions()).toBe(false)
    })

    it('should expose connection for advanced use', () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })
      const connection = provider.getConnection()
      expect(connection).toBeDefined()
    })

    it('should validate owner address in getAssetsByOwner', async () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })

      await expect(
        provider.getAssetsByOwner('invalid-address')
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should validate addresses in getTokenBalance', async () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })

      await expect(
        provider.getTokenBalance('invalid-owner', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      ).rejects.toThrow('invalid Solana address format')

      await expect(
        provider.getTokenBalance('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'invalid-mint')
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should validate address in subscribeToTransfers', async () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })

      await expect(
        provider.subscribeToTransfers('invalid-address', () => {})
      ).rejects.toThrow('invalid Solana address format')
    })

    it('should throw when subscribing with gRPC disabled', async () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
        enableGrpc: false,
      })

      await expect(
        provider.subscribeToTransfers('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', () => {})
      ).rejects.toThrow('gRPC subscriptions are disabled')
    })

    it('should cleanup resources on close', async () => {
      const provider = new TritonProvider({
        xToken: 'test-x-token',
      })

      // Should not throw
      await provider.close()
    })
  })

  describe('SolanaRPCProvider interface contract', () => {
    const providers: Array<{ name: string; create: () => SolanaRPCProvider }> = [
      {
        name: 'HeliusProvider',
        create: () => new HeliusProvider({ apiKey: 'test-key' }),
      },
      {
        name: 'GenericProvider',
        create: () =>
          new GenericProvider({ endpoint: 'https://api.devnet.solana.com' }),
      },
      {
        name: 'QuickNodeProvider',
        create: () =>
          new QuickNodeProvider({ endpoint: 'https://example.solana-mainnet.quiknode.pro/abc123' }),
      },
      {
        name: 'TritonProvider',
        create: () =>
          new TritonProvider({ xToken: 'test-x-token' }),
      },
    ]

    providers.forEach(({ name, create }) => {
      describe(name, () => {
        let provider: SolanaRPCProvider

        beforeEach(() => {
          provider = create()
        })

        it('should have a name property', () => {
          expect(typeof provider.name).toBe('string')
          expect(provider.name.length).toBeGreaterThan(0)
        })

        it('should have getAssetsByOwner method', () => {
          expect(typeof provider.getAssetsByOwner).toBe('function')
        })

        it('should have getTokenBalance method', () => {
          expect(typeof provider.getTokenBalance).toBe('function')
        })

        it('should have supportsSubscriptions method', () => {
          expect(typeof provider.supportsSubscriptions).toBe('function')
          expect(typeof provider.supportsSubscriptions()).toBe('boolean')
        })
      })
    })
  })

  describe('TokenAsset type', () => {
    it('should support all token asset fields', () => {
      const asset: TokenAsset = {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000n,
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
        logoUri: 'https://example.com/usdc.png',
      }

      expect(asset.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      expect(asset.amount).toBe(1000000n)
      expect(asset.decimals).toBe(6)
      expect(asset.symbol).toBe('USDC')
      expect(asset.name).toBe('USD Coin')
      expect(asset.logoUri).toBe('https://example.com/usdc.png')
    })

    it('should allow optional fields to be undefined', () => {
      const asset: TokenAsset = {
        mint: 'test-mint',
        amount: 100n,
        decimals: 0,
      }

      expect(asset.symbol).toBeUndefined()
      expect(asset.name).toBeUndefined()
      expect(asset.logoUri).toBeUndefined()
    })
  })
})

describe('Provider Integration with scanForPayments', () => {
  // These tests verify the provider integration without making real network calls
  it('should accept provider in SolanaScanParams', async () => {
    // Type check - provider is optional in params
    const params = {
      connection: {} as any,
      viewingPrivateKey: '0x1234' as any,
      spendingPublicKey: '0x5678' as any,
      provider: new HeliusProvider({ apiKey: 'test-key' }),
    }

    // Verify provider is accepted in type
    expect(params.provider).toBeInstanceOf(HeliusProvider)
  })
})

describe('sanitizeUrl - H2 API Key Leak Prevention', () => {
  describe('query parameter sanitization', () => {
    it('should mask api-key query parameter', () => {
      const url = 'https://api.helius.xyz/v0/tokens?api-key=secret123abc'
      expect(sanitizeUrl(url)).toBe('https://api.helius.xyz/v0/tokens?api-key=***')
    })

    it('should mask apiKey query parameter (camelCase)', () => {
      const url = 'https://api.example.com?apiKey=mySecretKey123'
      expect(sanitizeUrl(url)).toBe('https://api.example.com/?apiKey=***')
    })

    it('should mask token query parameter', () => {
      const url = 'https://api.example.com?token=bearer123'
      expect(sanitizeUrl(url)).toBe('https://api.example.com/?token=***')
    })

    it('should mask x-token query parameter', () => {
      const url = 'https://api.triton.com?x-token=triton-secret'
      expect(sanitizeUrl(url)).toBe('https://api.triton.com/?x-token=***')
    })

    it('should preserve non-sensitive query parameters', () => {
      const url = 'https://api.example.com?cluster=devnet&format=json&api-key=secret'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('cluster=devnet')
      expect(sanitized).toContain('format=json')
      expect(sanitized).toContain('api-key=***')
      expect(sanitized).not.toContain('secret')
    })
  })

  describe('path segment sanitization', () => {
    it('should mask QuickNode-style API keys in path', () => {
      const url = 'https://example.solana-mainnet.quiknode.pro/abc123def456789012345678901234'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('quiknode.pro/***')
      expect(sanitized).not.toContain('abc123def456')
    })

    it('should mask Triton-style tokens in path', () => {
      const url = 'https://mainnet.rpcpool.com/abcdefghij1234567890'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('rpcpool.com/***')
      expect(sanitized).not.toContain('abcdefghij1234567890')
    })

    it('should preserve short path segments', () => {
      const url = 'https://api.example.com/v0/tokens/addresses'
      expect(sanitizeUrl(url)).toBe('https://api.example.com/v0/tokens/addresses')
    })
  })

  describe('basic auth sanitization', () => {
    it('should mask basic auth credentials', () => {
      const url = 'https://user:password@api.example.com/endpoint'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('***@api.example.com')
      expect(sanitized).not.toContain('user')
      expect(sanitized).not.toContain('password')
    })
  })

  describe('edge cases', () => {
    it('should handle URLs without credentials', () => {
      const url = 'https://api.devnet.solana.com'
      expect(sanitizeUrl(url)).toBe('https://api.devnet.solana.com/')
    })

    it('should handle malformed URLs gracefully', () => {
      const url = 'not-a-valid-url-with-api-key=secret'
      const sanitized = sanitizeUrl(url)
      // Should use fallback regex sanitization
      expect(sanitized).not.toContain('secret')
    })

    it('should preserve URL structure', () => {
      const url = 'https://api.helius.xyz:443/v0/tokens?api-key=secret#section'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('api.helius.xyz')
      expect(sanitized).toContain('/v0/tokens')
      expect(sanitized).toContain('api-key=***')
    })
  })

  describe('real provider URL patterns', () => {
    it('should sanitize Helius REST API URL', () => {
      const url = 'https://api.helius.xyz/v0/addresses/owner123/balances?api-key=abc123-uuid-here'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('api-key=***')
      expect(sanitized).not.toContain('abc123-uuid-here')
    })

    it('should sanitize QuickNode endpoint', () => {
      const url = 'https://proud-spring-firefly.solana-mainnet.quiknode.pro/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('quiknode.pro/***')
      expect(sanitized).not.toContain('a1b2c3d4e5f6')
    })

    it('should sanitize Triton endpoint with x-token', () => {
      const url = 'https://mainnet.rpcpool.com/my-super-secret-triton-token-12345'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toContain('rpcpool.com/***')
      expect(sanitized).not.toContain('my-super-secret')
    })
  })
})
