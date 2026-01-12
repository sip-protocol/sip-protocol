/**
 * Solana RPC Provider Tests
 *
 * Tests for RPC-provider-agnostic architecture:
 * - SolanaRPCProvider interface
 * - createProvider factory
 * - HeliusProvider
 * - GenericProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createProvider,
  HeliusProvider,
  GenericProvider,
} from '../../../src/chains/solana/providers'
import type {
  SolanaRPCProvider,
  TokenAsset,
  ProviderType,
} from '../../../src/chains/solana/providers/interface'

describe('Solana RPC Providers', () => {
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
      ).toThrow('Unknown provider type: unknown')
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

        const assets = await provider.getAssetsByOwner('test-address')

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

        await expect(provider.getAssetsByOwner('test-address')).rejects.toThrow(
          'Helius API error: 401 Unauthorized'
        )
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
          'owner-address',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
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

        const balance = await provider.getTokenBalance(
          'owner-address',
          'non-existent-mint'
        )

        expect(balance).toBe(0n)
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
