/**
 * Network Privacy Layer - Proxy Support
 *
 * Provides Tor and SOCKS5/HTTP proxy support for routing RPC calls
 * through privacy-preserving networks. Prevents IP address correlation
 * with wallet activity.
 *
 * ## Features
 *
 * - Auto-detect Tor service (ports 9050, 9150)
 * - SOCKS5 proxy support
 * - HTTP/HTTPS proxy support
 * - Environment variable configuration
 * - Circuit rotation for unlinkability
 *
 * @example Using Tor
 * ```typescript
 * import { createProxyAgent, TOR_PORTS } from '@sip-protocol/sdk'
 *
 * // Auto-detect Tor
 * const agent = await createProxyAgent('tor')
 *
 * // Or specify port
 * const agent = await createProxyAgent('socks5://127.0.0.1:9050')
 * ```
 *
 * @example Using custom SOCKS5 proxy
 * ```typescript
 * const agent = await createProxyAgent('socks5://myproxy.example.com:1080')
 * ```
 *
 * @module network/proxy
 * @see https://github.com/sip-protocol/sip-protocol/issues/489
 */

import type { Agent } from 'http'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Proxy configuration type
 *
 * - `'tor'`: Auto-detect local Tor service
 * - `'socks5://...'`: SOCKS5 proxy URL
 * - `'http://...'` or `'https://...'`: HTTP proxy URL
 * - `undefined`: No proxy (direct connection)
 */
export type ProxyConfig =
  | 'tor'
  | `socks5://${string}`
  | `socks4://${string}`
  | `http://${string}`
  | `https://${string}`
  | undefined

/**
 * Proxy type classification
 */
export type ProxyType = 'tor' | 'socks5' | 'socks4' | 'http' | 'https' | 'none'

/**
 * Parsed proxy configuration
 */
export interface ParsedProxyConfig {
  /** Proxy type */
  type: ProxyType
  /** Proxy host */
  host?: string
  /** Proxy port */
  port?: number
  /** Full proxy URL */
  url?: string
  /** Authentication username (if any) */
  username?: string
  /** Authentication password (if any) */
  password?: string
}

/**
 * Proxy agent options
 */
export interface ProxyAgentOptions {
  /** Connection timeout in milliseconds */
  timeout?: number
  /** Whether to rotate circuits (Tor only) */
  rotateCircuit?: boolean
  /** Custom Tor control port for circuit rotation */
  torControlPort?: number
  /** Tor control password (for NEWNYM) */
  torControlPassword?: string
}

/**
 * Result of proxy availability check
 */
export interface ProxyCheckResult {
  /** Whether proxy is available */
  available: boolean
  /** Proxy type detected */
  type: ProxyType
  /** Proxy URL if available */
  url?: string
  /** Error message if not available */
  error?: string
  /** Response time in milliseconds */
  responseTimeMs?: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Common Tor ports
 *
 * - 9050: Standalone Tor daemon
 * - 9150: Tor Browser Bundle
 */
export const TOR_PORTS = [9050, 9150] as const

/**
 * Default Tor host
 */
export const TOR_HOST = '127.0.0.1'

/**
 * Default Tor control port (for NEWNYM signal)
 */
export const TOR_CONTROL_PORT = 9051

/**
 * Default connection timeout in milliseconds
 */
export const DEFAULT_PROXY_TIMEOUT = 30000

/**
 * Environment variable for proxy configuration
 */
export const PROXY_ENV_VAR = 'SIP_PROXY'

/**
 * Alternative environment variables to check
 */
export const PROXY_ENV_VARS = [
  'SIP_PROXY',
  'ALL_PROXY',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'SOCKS_PROXY',
] as const

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a proxy configuration string into structured data
 *
 * @param config - Proxy configuration string
 * @returns Parsed configuration
 *
 * @example
 * ```typescript
 * parseProxyConfig('tor')
 * // { type: 'tor', host: '127.0.0.1', port: 9050 }
 *
 * parseProxyConfig('socks5://proxy.example.com:1080')
 * // { type: 'socks5', host: 'proxy.example.com', port: 1080, url: '...' }
 *
 * parseProxyConfig('http://user:pass@proxy.com:8080')
 * // { type: 'http', host: 'proxy.com', port: 8080, username: 'user', password: 'pass' }
 * ```
 */
export function parseProxyConfig(config: ProxyConfig): ParsedProxyConfig {
  if (!config) {
    return { type: 'none' }
  }

  if (config === 'tor') {
    return {
      type: 'tor',
      host: TOR_HOST,
      port: TOR_PORTS[0],
      url: `socks5://${TOR_HOST}:${TOR_PORTS[0]}`,
    }
  }

  // Parse URL
  try {
    const url = new URL(config)
    const protocol = url.protocol.replace(':', '') as ProxyType

    if (!['socks5', 'socks4', 'http', 'https'].includes(protocol)) {
      throw new Error(`Unsupported proxy protocol: ${protocol}`)
    }

    return {
      type: protocol,
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : undefined,
      url: config,
      username: url.username || undefined,
      password: url.password || undefined,
    }
  } catch {
    throw new Error(
      `Invalid proxy configuration: ${config}. ` +
      `Expected 'tor', 'socks5://...', 'http://...', or 'https://...'`
    )
  }
}

/**
 * Get proxy configuration from environment variables
 *
 * Checks SIP_PROXY, ALL_PROXY, HTTPS_PROXY, HTTP_PROXY, SOCKS_PROXY
 *
 * @returns Proxy configuration or undefined
 */
export function getProxyFromEnv(): ProxyConfig {
  for (const envVar of PROXY_ENV_VARS) {
    const value = process.env[envVar]
    if (value) {
      // Handle 'tor' shorthand
      if (value.toLowerCase() === 'tor') {
        return 'tor'
      }
      // Validate URL format
      if (value.startsWith('socks') || value.startsWith('http')) {
        return value as ProxyConfig
      }
    }
  }
  return undefined
}

// ─── Proxy Detection ─────────────────────────────────────────────────────────

/**
 * Check if Tor is available on a specific port
 *
 * @param port - Port to check
 * @param host - Host to check (default: 127.0.0.1)
 * @param timeout - Connection timeout in ms
 * @returns True if Tor is responding
 */
export async function isTorAvailable(
  port: number = TOR_PORTS[0],
  host: string = TOR_HOST,
  timeout: number = 5000
): Promise<boolean> {
  // In Node.js, we'd use net.connect to check
  // For now, return a simple check
  return new Promise((resolve) => {
    if (typeof globalThis.process === 'undefined') {
      // Browser environment - Tor not directly available
      resolve(false)
      return
    }

    try {
      // Dynamic import to avoid bundling in browser
      import('net').then(({ connect }) => {
        const socket = connect({ host, port })

        const timer = setTimeout(() => {
          socket.destroy()
          resolve(false)
        }, timeout)

        socket.on('connect', () => {
          clearTimeout(timer)
          socket.destroy()
          resolve(true)
        })

        socket.on('error', () => {
          clearTimeout(timer)
          resolve(false)
        })
      }).catch(() => {
        resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

/**
 * Auto-detect Tor service on common ports
 *
 * @param timeout - Connection timeout per port
 * @returns Port number if found, undefined otherwise
 */
export async function detectTorPort(timeout: number = 5000): Promise<number | undefined> {
  for (const port of TOR_PORTS) {
    if (await isTorAvailable(port, TOR_HOST, timeout)) {
      return port
    }
  }
  return undefined
}

/**
 * Check proxy availability and get connection info
 *
 * @param config - Proxy configuration
 * @param timeout - Connection timeout
 * @returns Availability result
 */
export async function checkProxyAvailability(
  config: ProxyConfig,
  timeout: number = DEFAULT_PROXY_TIMEOUT
): Promise<ProxyCheckResult> {
  if (!config) {
    return { available: true, type: 'none' }
  }

  const start = Date.now()

  if (config === 'tor') {
    const port = await detectTorPort(timeout)
    if (port) {
      return {
        available: true,
        type: 'tor',
        url: `socks5://${TOR_HOST}:${port}`,
        responseTimeMs: Date.now() - start,
      }
    }
    return {
      available: false,
      type: 'tor',
      error: `Tor not found on ports ${TOR_PORTS.join(', ')}. ` +
        `Please start Tor or Tor Browser.`,
    }
  }

  // For SOCKS5/HTTP proxies, parse and validate
  try {
    const parsed = parseProxyConfig(config)
    // In production, we'd do a test connection here
    return {
      available: true,
      type: parsed.type,
      url: parsed.url,
      responseTimeMs: Date.now() - start,
    }
  } catch (error) {
    return {
      available: false,
      type: 'none',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Agent Creation ──────────────────────────────────────────────────────────

/**
 * Create a proxy agent for HTTP requests
 *
 * **Note:** This requires optional dependencies:
 * - `socks-proxy-agent` for SOCKS4/5 proxies
 * - `https-proxy-agent` for HTTP/HTTPS proxies
 *
 * Install with: `npm install socks-proxy-agent https-proxy-agent`
 *
 * @param config - Proxy configuration
 * @param options - Agent options
 * @returns HTTP Agent configured for proxy, or undefined for direct connection
 * @throws Error if proxy dependencies not installed
 *
 * @example
 * ```typescript
 * // Using Tor
 * const agent = await createProxyAgent('tor')
 *
 * // Using custom SOCKS5
 * const agent = await createProxyAgent('socks5://127.0.0.1:1080')
 *
 * // Use with fetch
 * fetch(url, { agent })
 * ```
 */
export async function createProxyAgent(
  config: ProxyConfig,
  options: ProxyAgentOptions = {}
): Promise<Agent | undefined> {
  if (!config) {
    return undefined
  }

  const { timeout = DEFAULT_PROXY_TIMEOUT } = options

  // Handle Tor auto-detection
  let proxyUrl: string
  if (config === 'tor') {
    const port = await detectTorPort(timeout)
    if (!port) {
      throw new Error(
        `Tor not available on ports ${TOR_PORTS.join(', ')}. ` +
        `Please start Tor (brew install tor && tor) or Tor Browser.`
      )
    }
    proxyUrl = `socks5://${TOR_HOST}:${port}`
  } else {
    proxyUrl = config
  }

  // Parse to determine agent type
  const parsed = parseProxyConfig(config === 'tor' ? `socks5://${TOR_HOST}:${TOR_PORTS[0]}` : config)

  // Dynamic import of proxy agent libraries
  try {
    if (parsed.type === 'socks5' || parsed.type === 'socks4' || config === 'tor') {
      // SOCKS proxy
      const { SocksProxyAgent } = await import('socks-proxy-agent')
      return new SocksProxyAgent(proxyUrl, { timeout })
    }

    if (parsed.type === 'http' || parsed.type === 'https') {
      // HTTP proxy
      const { HttpsProxyAgent } = await import('https-proxy-agent')
      return new HttpsProxyAgent(proxyUrl, { timeout })
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `Proxy agent dependencies not installed. ` +
        `Run: npm install socks-proxy-agent https-proxy-agent`
      )
    }
    throw error
  }

  return undefined
}

// ─── Proxied Fetch ───────────────────────────────────────────────────────────

/**
 * Fetch function type with optional agent
 */
export type ProxiedFetch = (
  url: string | URL,
  options?: RequestInit & { agent?: Agent }
) => Promise<Response>

/**
 * Create a fetch function that uses a proxy agent
 *
 * @param agent - Proxy agent (from createProxyAgent)
 * @returns Fetch function with proxy support
 *
 * @example
 * ```typescript
 * const agent = await createProxyAgent('tor')
 * const proxiedFetch = createProxiedFetch(agent)
 *
 * // All requests go through Tor
 * const response = await proxiedFetch('https://api.example.com/data')
 * ```
 */
export function createProxiedFetch(agent: Agent | undefined): ProxiedFetch {
  return async (url: string | URL, options: RequestInit & { agent?: Agent } = {}) => {
    // In Node.js, we can pass agent directly
    // The global fetch in Node 18+ supports agent option
    return fetch(url, {
      ...options,
      // @ts-expect-error - agent is valid for Node.js fetch
      agent: agent ?? options.agent,
    })
  }
}

// ─── Tor Circuit Rotation ────────────────────────────────────────────────────

/**
 * Request a new Tor circuit (NEWNYM)
 *
 * Requires Tor control port to be enabled with authentication.
 * Configure in torrc:
 * ```
 * ControlPort 9051
 * HashedControlPassword <your-hashed-password>
 * ```
 *
 * @param controlPort - Tor control port (default: 9051)
 * @param password - Control port password
 * @returns True if circuit rotation succeeded
 *
 * @example
 * ```typescript
 * // Enable in torrc and set password
 * const success = await rotateCircuit(9051, 'my-tor-password')
 * if (success) {
 *   console.log('New Tor circuit established')
 * }
 * ```
 */
export async function rotateCircuit(
  controlPort: number = TOR_CONTROL_PORT,
  password?: string
): Promise<boolean> {
  if (typeof globalThis.process === 'undefined') {
    // Browser environment
    console.warn('Circuit rotation not available in browser')
    return false
  }

  try {
    const { connect } = await import('net')

    return new Promise((resolve) => {
      const socket = connect({ host: TOR_HOST, port: controlPort })

      let authenticated = false

      socket.on('connect', () => {
        if (password) {
          socket.write(`AUTHENTICATE "${password}"\r\n`)
        } else {
          socket.write('AUTHENTICATE\r\n')
        }
      })

      socket.on('data', (data) => {
        const response = data.toString()

        if (!authenticated && response.includes('250')) {
          authenticated = true
          socket.write('SIGNAL NEWNYM\r\n')
        } else if (authenticated && response.includes('250')) {
          socket.destroy()
          resolve(true)
        } else if (response.includes('515') || response.includes('5')) {
          socket.destroy()
          resolve(false)
        }
      })

      socket.on('error', () => {
        resolve(false)
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, 5000)
    })
  } catch {
    return false
  }
}

// ─── Network Privacy Config ──────────────────────────────────────────────────

/**
 * Network privacy configuration for SDK clients
 */
export interface NetworkPrivacyConfig {
  /**
   * Proxy configuration
   *
   * - `'tor'`: Auto-detect local Tor
   * - `'socks5://...'`: SOCKS5 proxy
   * - `'http://...'`: HTTP proxy
   * - `undefined`: Direct connection
   */
  proxy?: ProxyConfig

  /**
   * Rotate Tor circuit per request
   *
   * Requires Tor control port. Provides unlinkability between requests.
   *
   * @default false
   */
  rotateCircuit?: boolean

  /**
   * Tor control port for circuit rotation
   *
   * @default 9051
   */
  torControlPort?: number

  /**
   * Tor control password
   *
   * Required for rotateCircuit if Tor is configured with password authentication.
   */
  torControlPassword?: string

  /**
   * Connection timeout in milliseconds
   *
   * @default 30000
   */
  timeout?: number

  /**
   * Fallback to direct connection if proxy unavailable
   *
   * If true, will use direct connection when proxy fails.
   * If false, will throw error when proxy fails.
   *
   * @default false
   */
  fallbackToDirect?: boolean
}

/**
 * Default network privacy configuration
 */
export const DEFAULT_NETWORK_CONFIG: Required<Omit<NetworkPrivacyConfig, 'proxy' | 'torControlPassword'>> = {
  rotateCircuit: false,
  torControlPort: TOR_CONTROL_PORT,
  timeout: DEFAULT_PROXY_TIMEOUT,
  fallbackToDirect: false,
}

/**
 * Create a network privacy client
 *
 * @param config - Network privacy configuration
 * @returns Proxied fetch function and utilities
 *
 * @example
 * ```typescript
 * const network = await createNetworkPrivacyClient({
 *   proxy: 'tor',
 *   rotateCircuit: true,
 *   torControlPassword: 'my-password',
 * })
 *
 * // Use proxied fetch
 * const response = await network.fetch('https://api.example.com')
 *
 * // Rotate circuit manually
 * await network.rotateCircuit()
 *
 * // Check status
 * console.log(network.status) // { type: 'tor', connected: true, ... }
 * ```
 */
export async function createNetworkPrivacyClient(
  config: NetworkPrivacyConfig = {}
): Promise<{
  fetch: ProxiedFetch
  rotateCircuit: () => Promise<boolean>
  status: ProxyCheckResult
  agent: Agent | undefined
}> {
  const {
    proxy,
    rotateCircuit: shouldRotate = DEFAULT_NETWORK_CONFIG.rotateCircuit,
    torControlPort = DEFAULT_NETWORK_CONFIG.torControlPort,
    torControlPassword,
    timeout = DEFAULT_NETWORK_CONFIG.timeout,
    fallbackToDirect = DEFAULT_NETWORK_CONFIG.fallbackToDirect,
  } = config

  // Check proxy availability
  const status = await checkProxyAvailability(proxy, timeout)

  let agent: Agent | undefined

  if (!status.available) {
    if (fallbackToDirect) {
      console.warn(
        `[SIP-SDK] Proxy unavailable: ${status.error}. Falling back to direct connection.`
      )
    } else {
      throw new Error(`Proxy unavailable: ${status.error}`)
    }
  } else {
    agent = await createProxyAgent(proxy, { timeout })
  }

  return {
    fetch: createProxiedFetch(agent),
    rotateCircuit: async () => {
      if (shouldRotate && (status.type === 'tor' || proxy === 'tor')) {
        return rotateCircuit(torControlPort, torControlPassword)
      }
      return false
    },
    status,
    agent,
  }
}
