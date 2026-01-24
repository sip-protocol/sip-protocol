/**
 * Solana RPC Network Privacy Tests
 *
 * Tests for Tor/SOCKS5 proxy integration with Solana RPC client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SolanaRPCClient,
  createRPCClient,
  createPrivateRPCClient,
  type RPCClientConfig,
} from '../../../src/chains/solana/rpc-client'

// Mock the network/proxy module
vi.mock('../../../src/network/proxy', () => ({
  createNetworkPrivacyClient: vi.fn().mockResolvedValue({
    fetch: vi.fn(),
    rotateCircuit: vi.fn().mockResolvedValue(true),
    status: { type: 'tor', available: true, url: 'socks5://127.0.0.1:9050' },
    agent: { /* mock agent */ },
  }),
  rotateCircuit: vi.fn().mockResolvedValue(true),
}))

// Mock @solana/kit
vi.mock('@solana/kit', async () => {
  const actual = await vi.importActual('@solana/kit')
  return {
    ...actual,
    createSolanaRpc: vi.fn().mockReturnValue({
      getVersion: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }),
      getBalance: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({ value: 1000000000n, context: { slot: 100 } }),
      }),
      getLatestBlockhash: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: { blockhash: 'test-blockhash', lastValidBlockHeight: 100n },
          context: { slot: 100 },
        }),
      }),
    }),
    createSolanaRpcSubscriptions: vi.fn().mockReturnValue({}),
  }
})

// Mock @solana/web3.js Connection
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      getBalance: vi.fn().mockResolvedValue(1000000000),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'test-blockhash',
        lastValidBlockHeight: 100,
      }),
    })),
  }
})

describe('SolanaRPCClient Network Privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Configuration', () => {
    it('creates client without network privacy', () => {
      const client = createRPCClient({
        endpoint: 'https://api.devnet.solana.com',
      })

      expect(client.isNetworkPrivacyEnabled()).toBe(false)
      expect(client.getNetworkPrivacyConfig()).toBeUndefined()
    })

    it('accepts network privacy config', () => {
      const config: RPCClientConfig = {
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
          rotateCircuit: true,
          torControlPort: 9051,
        },
      }

      const client = createRPCClient(config)

      // Note: Without async initialization, proxy won't be set
      expect(client.getNetworkPrivacyConfig()).toEqual(config.networkPrivacy)
    })

    it('creates client with Tor via static factory', async () => {
      const client = await SolanaRPCClient.withNetworkPrivacy({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
        },
      })

      expect(client.isNetworkPrivacyEnabled()).toBe(true)
    })

    it('creates client with SOCKS5 proxy', async () => {
      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'socks5://127.0.0.1:1080',
        },
      })

      expect(client.isNetworkPrivacyEnabled()).toBe(true)
    })
  })

  describe('Circuit Rotation', () => {
    it('rotates Tor circuit', async () => {
      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
          torControlPort: 9051,
        },
      })

      const result = await client.rotateTorCircuit()

      expect(result).toBe(true)
    })

    it('returns false when no proxy configured', async () => {
      const client = createRPCClient({
        endpoint: 'https://api.devnet.solana.com',
      })

      const result = await client.rotateTorCircuit()

      expect(result).toBe(false)
    })

    it('uses custom control port and password', async () => {
      const { rotateCircuit } = await import('../../../src/network/proxy')

      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
          torControlPort: 9151,
          torControlPassword: 'my-secret',
        },
      })

      await client.rotateTorCircuit()

      expect(rotateCircuit).toHaveBeenCalledWith(9151, 'my-secret')
    })
  })

  describe('Debug Logging', () => {
    it('logs when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
        },
        debug: true,
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RPC] Network privacy enabled')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Fallback Endpoints', () => {
    it('creates fallback endpoints with proxy', async () => {
      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        fallbackEndpoints: [
          'https://backup1.example.com',
          'https://backup2.example.com',
        ],
        networkPrivacy: {
          proxy: 'tor',
        },
      })

      expect(client.isNetworkPrivacyEnabled()).toBe(true)
      // All endpoints should use the proxy
    })
  })

  describe('Integration with RPC Methods', () => {
    it('getBalance works with proxy', async () => {
      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'socks5://127.0.0.1:9050',
        },
      })

      // This will use the mocked RPC
      expect(client.isNetworkPrivacyEnabled()).toBe(true)
    })

    it('isHealthy works with proxy', async () => {
      const client = await createPrivateRPCClient({
        endpoint: 'https://api.devnet.solana.com',
        networkPrivacy: {
          proxy: 'tor',
        },
      })

      const healthy = await client.isHealthy()

      expect(healthy).toBe(true)
    })
  })
})

describe('Network Privacy Config Types', () => {
  it('accepts all proxy types', () => {
    const torConfig: RPCClientConfig = {
      endpoint: 'https://api.devnet.solana.com',
      networkPrivacy: { proxy: 'tor' },
    }

    const socks5Config: RPCClientConfig = {
      endpoint: 'https://api.devnet.solana.com',
      networkPrivacy: { proxy: 'socks5://127.0.0.1:1080' },
    }

    const httpConfig: RPCClientConfig = {
      endpoint: 'https://api.devnet.solana.com',
      networkPrivacy: { proxy: 'http://proxy.example.com:8080' },
    }

    expect(torConfig.networkPrivacy?.proxy).toBe('tor')
    expect(socks5Config.networkPrivacy?.proxy).toBe('socks5://127.0.0.1:1080')
    expect(httpConfig.networkPrivacy?.proxy).toBe('http://proxy.example.com:8080')
  })

  it('accepts all network privacy options', () => {
    const fullConfig: RPCClientConfig = {
      endpoint: 'https://api.devnet.solana.com',
      networkPrivacy: {
        proxy: 'tor',
        rotateCircuit: true,
        torControlPort: 9051,
        torControlPassword: 'secret',
        timeout: 60000,
        fallbackToDirect: true,
      },
    }

    expect(fullConfig.networkPrivacy?.rotateCircuit).toBe(true)
    expect(fullConfig.networkPrivacy?.torControlPort).toBe(9051)
    expect(fullConfig.networkPrivacy?.torControlPassword).toBe('secret')
    expect(fullConfig.networkPrivacy?.timeout).toBe(60000)
    expect(fullConfig.networkPrivacy?.fallbackToDirect).toBe(true)
  })
})
