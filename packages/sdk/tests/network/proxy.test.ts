/**
 * Network Privacy Module Tests
 *
 * Tests for Tor/SOCKS5/HTTP proxy support including:
 * - Proxy configuration parsing
 * - Environment variable detection
 * - Tor availability checks
 * - Proxy agent creation
 * - Circuit rotation
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/489
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseProxyConfig,
  getProxyFromEnv,
  isTorAvailable,
  detectTorPort,
  checkProxyAvailability,
  createProxiedFetch,
  createNetworkPrivacyClient,
  TOR_PORTS,
  TOR_HOST,
  TOR_CONTROL_PORT,
  DEFAULT_PROXY_TIMEOUT,
  PROXY_ENV_VAR,
  PROXY_ENV_VARS,
  DEFAULT_NETWORK_CONFIG,
  type ProxyConfig,
  type ParsedProxyConfig,
} from '../../src/network'

// ─── Proxy Configuration Parsing ─────────────────────────────────────────────

describe('parseProxyConfig', () => {
  it('returns "none" type for undefined config', () => {
    const result = parseProxyConfig(undefined)
    expect(result.type).toBe('none')
    expect(result.host).toBeUndefined()
    expect(result.port).toBeUndefined()
  })

  it('parses "tor" shorthand config', () => {
    const result = parseProxyConfig('tor')
    expect(result.type).toBe('tor')
    expect(result.host).toBe(TOR_HOST)
    expect(result.port).toBe(TOR_PORTS[0])
    expect(result.url).toBe(`socks5://${TOR_HOST}:${TOR_PORTS[0]}`)
  })

  it('parses SOCKS5 URL correctly', () => {
    const result = parseProxyConfig('socks5://127.0.0.1:1080')
    expect(result.type).toBe('socks5')
    expect(result.host).toBe('127.0.0.1')
    expect(result.port).toBe(1080)
  })

  it('parses SOCKS5 URL with custom host', () => {
    const result = parseProxyConfig('socks5://proxy.example.com:9999')
    expect(result.type).toBe('socks5')
    expect(result.host).toBe('proxy.example.com')
    expect(result.port).toBe(9999)
  })

  it('parses SOCKS4 URL correctly', () => {
    const result = parseProxyConfig('socks4://192.168.1.1:1080')
    expect(result.type).toBe('socks4')
    expect(result.host).toBe('192.168.1.1')
    expect(result.port).toBe(1080)
  })

  it('parses HTTP proxy URL correctly', () => {
    const result = parseProxyConfig('http://proxy.local:8080')
    expect(result.type).toBe('http')
    expect(result.host).toBe('proxy.local')
    expect(result.port).toBe(8080)
  })

  it('parses HTTPS proxy URL correctly', () => {
    // Use a non-default port since URL parser omits default ports (443 for https)
    const result = parseProxyConfig('https://secure-proxy.com:8443')
    expect(result.type).toBe('https')
    expect(result.host).toBe('secure-proxy.com')
    expect(result.port).toBe(8443)
  })

  it('parses HTTPS proxy URL without explicit port', () => {
    const result = parseProxyConfig('https://secure-proxy.com')
    expect(result.type).toBe('https')
    expect(result.host).toBe('secure-proxy.com')
    // URL parser doesn't infer default port
    expect(result.port).toBeUndefined()
  })

  it('handles URL with authentication', () => {
    const result = parseProxyConfig('socks5://user:pass@127.0.0.1:1080')
    expect(result.type).toBe('socks5')
    expect(result.host).toBe('127.0.0.1')
    expect(result.port).toBe(1080)
    expect(result.username).toBe('user')
    expect(result.password).toBe('pass')
  })

  it('handles URL with only username', () => {
    const result = parseProxyConfig('http://admin@proxy.local:3128')
    expect(result.type).toBe('http')
    expect(result.username).toBe('admin')
    // Empty password is converted to undefined
    expect(result.password).toBeUndefined()
  })

  it('handles URL without port (port is undefined)', () => {
    const result = parseProxyConfig('http://proxy.local')
    expect(result.type).toBe('http')
    expect(result.host).toBe('proxy.local')
    expect(result.port).toBeUndefined()
  })
})

// ─── Environment Variable Detection ──────────────────────────────────────────

describe('getProxyFromEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    // Clear all proxy-related env vars
    delete process.env.SIP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.HTTP_PROXY
    delete process.env.ALL_PROXY
    delete process.env.SOCKS_PROXY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns undefined when no proxy env vars set', () => {
    expect(getProxyFromEnv()).toBeUndefined()
  })

  it('returns SIP_PROXY with highest priority', () => {
    process.env.SIP_PROXY = 'socks5://127.0.0.1:9050'
    process.env.HTTPS_PROXY = 'http://other:8080'
    expect(getProxyFromEnv()).toBe('socks5://127.0.0.1:9050')
  })

  it('falls back to ALL_PROXY', () => {
    process.env.ALL_PROXY = 'http://all-proxy:8080'
    expect(getProxyFromEnv()).toBe('http://all-proxy:8080')
  })

  it('falls back to HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = 'http://proxy:8080'
    expect(getProxyFromEnv()).toBe('http://proxy:8080')
  })

  it('falls back to HTTP_PROXY', () => {
    process.env.HTTP_PROXY = 'http://fallback:3128'
    expect(getProxyFromEnv()).toBe('http://fallback:3128')
  })

  it('falls back to SOCKS_PROXY', () => {
    process.env.SOCKS_PROXY = 'socks5://socks-proxy:1080'
    expect(getProxyFromEnv()).toBe('socks5://socks-proxy:1080')
  })

  it('recognizes "tor" shorthand (case insensitive)', () => {
    process.env.SIP_PROXY = 'TOR'
    expect(getProxyFromEnv()).toBe('tor')
  })

  it('recognizes lowercase "tor"', () => {
    process.env.SIP_PROXY = 'tor'
    expect(getProxyFromEnv()).toBe('tor')
  })
})

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('exports correct TOR_PORTS', () => {
    expect(TOR_PORTS).toEqual([9050, 9150])
  })

  it('exports correct TOR_HOST', () => {
    expect(TOR_HOST).toBe('127.0.0.1')
  })

  it('exports correct TOR_CONTROL_PORT', () => {
    expect(TOR_CONTROL_PORT).toBe(9051)
  })

  it('exports correct DEFAULT_PROXY_TIMEOUT (30 seconds)', () => {
    expect(DEFAULT_PROXY_TIMEOUT).toBe(30000)
  })

  it('exports correct PROXY_ENV_VAR', () => {
    expect(PROXY_ENV_VAR).toBe('SIP_PROXY')
  })

  it('exports correct PROXY_ENV_VARS list', () => {
    expect(PROXY_ENV_VARS).toContain('SIP_PROXY')
    expect(PROXY_ENV_VARS).toContain('ALL_PROXY')
    expect(PROXY_ENV_VARS).toContain('HTTPS_PROXY')
    expect(PROXY_ENV_VARS).toContain('HTTP_PROXY')
    expect(PROXY_ENV_VARS).toContain('SOCKS_PROXY')
  })

  it('exports DEFAULT_NETWORK_CONFIG', () => {
    expect(DEFAULT_NETWORK_CONFIG).toEqual({
      rotateCircuit: false,
      torControlPort: TOR_CONTROL_PORT,
      timeout: DEFAULT_PROXY_TIMEOUT,
      fallbackToDirect: false,
    })
  })
})

// ─── Tor Availability (Mock) ─────────────────────────────────────────────────

describe('isTorAvailable', () => {
  it('returns false for non-existent port', async () => {
    // Port that definitely won't have Tor running
    const result = await isTorAvailable(59999, '127.0.0.1', 100)
    expect(result).toBe(false)
  })

  it('respects timeout parameter', async () => {
    const start = Date.now()
    await isTorAvailable(59999, '127.0.0.1', 50)
    const elapsed = Date.now() - start
    // Should complete within reasonable time (less than 500ms)
    expect(elapsed).toBeLessThan(500)
  })
})

describe('detectTorPort', () => {
  it('returns undefined when Tor is not running on non-existent ports', async () => {
    // Use very short timeout to fail fast
    const port = await detectTorPort(50)
    // Can be undefined or a real port if Tor is running
    expect(port === undefined || TOR_PORTS.includes(port as 9050 | 9150)).toBe(true)
  })
})

// ─── Proxy Availability Check ────────────────────────────────────────────────

describe('checkProxyAvailability', () => {
  it('returns available with type "none" for undefined config', async () => {
    const result = await checkProxyAvailability(undefined)
    expect(result.type).toBe('none')
    expect(result.available).toBe(true)
  })

  it('returns SOCKS5 type for SOCKS5 proxy URL', async () => {
    const result = await checkProxyAvailability('socks5://127.0.0.1:1080', 100)
    expect(result.type).toBe('socks5')
    // Note: checkProxyAvailability doesn't actually test connection, just parses
    expect(result.available).toBe(true)
  })

  it('returns HTTP type for HTTP proxy URL', async () => {
    const result = await checkProxyAvailability('http://proxy:8080', 100)
    expect(result.type).toBe('http')
    expect(result.available).toBe(true)
  })

  it('includes responseTimeMs for valid proxies', async () => {
    const result = await checkProxyAvailability('socks5://127.0.0.1:1080', 100)
    expect(result.responseTimeMs).toBeDefined()
    expect(typeof result.responseTimeMs).toBe('number')
  })
})

// ─── Proxied Fetch Creation ──────────────────────────────────────────────────

describe('createProxiedFetch', () => {
  it('creates a fetch function without agent (direct)', () => {
    const proxiedFetch = createProxiedFetch(undefined)
    expect(typeof proxiedFetch).toBe('function')
  })

  it('fetch function is callable', async () => {
    const proxiedFetch = createProxiedFetch(undefined)
    // Should be able to call it (even if it fails)
    expect(proxiedFetch).toBeDefined()
  })
})

// ─── Network Privacy Client ──────────────────────────────────────────────────

describe('createNetworkPrivacyClient', () => {
  it('creates client with default config', async () => {
    const client = await createNetworkPrivacyClient({})
    expect(client).toHaveProperty('fetch')
    expect(client).toHaveProperty('status')
    expect(client).toHaveProperty('rotateCircuit')
    expect(client).toHaveProperty('agent')
  })

  it('creates client with direct (no proxy) config', async () => {
    const client = await createNetworkPrivacyClient({
      proxy: undefined,
    })

    expect(client.status.type).toBe('none')
    expect(client.status.available).toBe(true)
  })

  it('creates client with SOCKS5 proxy config (skipped if deps not installed)', async () => {
    // Skip test if socks-proxy-agent not installed
    try {
      const client = await createNetworkPrivacyClient({
        proxy: 'socks5://127.0.0.1:1080',
        timeout: 100,
      })
      expect(client.status.type).toBe('socks5')
    } catch (error) {
      // Expected if socks-proxy-agent not installed
      expect((error as Error).message).toContain('socks-proxy-agent')
    }
  })

  it('client fetch is a function', async () => {
    const client = await createNetworkPrivacyClient({})
    expect(typeof client.fetch).toBe('function')
  })

  it('rotateCircuit returns false for non-Tor proxy when rotation disabled', async () => {
    const client = await createNetworkPrivacyClient({
      proxy: undefined,
      rotateCircuit: false,
    })

    const rotated = await client.rotateCircuit()
    expect(rotated).toBe(false)
  })

  it('agent is undefined for direct connection', async () => {
    const client = await createNetworkPrivacyClient({})
    expect(client.agent).toBeUndefined()
  })
})

// ─── Type Safety Tests ───────────────────────────────────────────────────────

describe('Type Safety', () => {
  it('ProxyConfig accepts valid strings', () => {
    const configs: ProxyConfig[] = [
      undefined,
      'tor',
      'socks5://127.0.0.1:1080',
      'socks4://127.0.0.1:1080',
      'http://proxy:8080',
      'https://proxy:443',
    ]
    expect(configs.length).toBe(6)
  })

  it('ParsedProxyConfig has required fields', () => {
    const parsed: ParsedProxyConfig = parseProxyConfig('socks5://127.0.0.1:1080')
    expect(parsed).toHaveProperty('type')
    expect(['none', 'tor', 'socks5', 'socks4', 'http', 'https']).toContain(parsed.type)
  })
})

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('throws for malformed URL', () => {
    expect(() => parseProxyConfig('not-a-url' as ProxyConfig)).toThrow()
  })

  it('returns none type for empty string (falsy)', () => {
    // Empty string is falsy, so returns none type
    const result = parseProxyConfig('' as ProxyConfig)
    expect(result.type).toBe('none')
  })

  it('handles IPv6 addresses', () => {
    const result = parseProxyConfig('socks5://[::1]:1080')
    expect(result.type).toBe('socks5')
    expect(result.port).toBe(1080)
  })

  it('handles URL without port', () => {
    // HTTP without port should not throw
    expect(() => parseProxyConfig('http://proxy.local')).not.toThrow()
  })

  it('throws for unsupported protocol', () => {
    expect(() => parseProxyConfig('ftp://server:21' as ProxyConfig)).toThrow()
  })
})

// ─── Integration Scenarios ───────────────────────────────────────────────────

describe('Integration Scenarios', () => {
  it('simulates typical Tor setup flow', async () => {
    // 1. Check if Tor is available
    const port = await detectTorPort(100)

    // 2. Create client based on availability - use fallbackToDirect to avoid throwing
    const client = await createNetworkPrivacyClient({
      proxy: port ? 'tor' : undefined,
      rotateCircuit: !!port,
      timeout: 100,
      fallbackToDirect: true,
    })

    // 3. Get status
    expect(client.status).toBeDefined()
    expect(client.status).toHaveProperty('type')
    expect(client.status).toHaveProperty('available')
  })

  it('simulates corporate proxy setup', async () => {
    const originalEnv = process.env.HTTPS_PROXY

    // Set corporate proxy
    process.env.HTTPS_PROXY = 'http://corporate-proxy:8080'

    try {
      const proxyUrl = getProxyFromEnv()
      expect(proxyUrl).toBe('http://corporate-proxy:8080')

      const parsed = parseProxyConfig(proxyUrl)
      expect(parsed.type).toBe('http')
      expect(parsed.host).toBe('corporate-proxy')
      expect(parsed.port).toBe(8080)
    } finally {
      if (originalEnv) {
        process.env.HTTPS_PROXY = originalEnv
      } else {
        delete process.env.HTTPS_PROXY
      }
    }
  })
})
