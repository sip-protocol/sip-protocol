/**
 * Network Privacy Module
 *
 * Provides network-level privacy features for SIP SDK including:
 * - Tor integration for anonymous RPC calls
 * - SOCKS5 proxy support
 * - HTTP/HTTPS proxy support
 * - Circuit rotation for unlinkability
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createNetworkPrivacyClient } from '@sip-protocol/sdk'
 *
 * // Using Tor (auto-detect)
 * const network = await createNetworkPrivacyClient({
 *   proxy: 'tor',
 *   rotateCircuit: true,
 * })
 *
 * // All API calls through Tor
 * const response = await network.fetch('https://api.example.com/data')
 * ```
 *
 * ## Proxy Types
 *
 * | Type | Example | Description |
 * |------|---------|-------------|
 * | Tor | `'tor'` | Auto-detect local Tor on ports 9050/9150 |
 * | SOCKS5 | `'socks5://host:port'` | Generic SOCKS5 proxy |
 * | HTTP | `'http://host:port'` | HTTP proxy |
 * | Direct | `undefined` | No proxy (default) |
 *
 * ## Environment Variables
 *
 * Set `SIP_PROXY` environment variable to configure proxy:
 *
 * ```bash
 * # Use Tor
 * export SIP_PROXY=tor
 *
 * # Use custom SOCKS5
 * export SIP_PROXY=socks5://127.0.0.1:1080
 * ```
 *
 * @module network
 * @see https://github.com/sip-protocol/sip-protocol/issues/489
 */

// Core proxy functionality
export {
  // Types
  type ProxyConfig,
  type ProxyType,
  type ParsedProxyConfig,
  type ProxyAgentOptions,
  type ProxyCheckResult,
  type ProxiedFetch,
  type NetworkPrivacyConfig,

  // Constants
  TOR_PORTS,
  TOR_HOST,
  TOR_CONTROL_PORT,
  DEFAULT_PROXY_TIMEOUT,
  PROXY_ENV_VAR,
  PROXY_ENV_VARS,
  DEFAULT_NETWORK_CONFIG,

  // Functions
  parseProxyConfig,
  getProxyFromEnv,
  isTorAvailable,
  detectTorPort,
  checkProxyAvailability,
  createProxyAgent,
  createProxiedFetch,
  rotateCircuit,
  createNetworkPrivacyClient,
} from './proxy'
