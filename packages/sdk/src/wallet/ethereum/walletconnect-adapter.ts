/**
 * WalletConnect v2 Privacy Adapter
 *
 * Extends privacy wallet adapter for WalletConnect v2 protocol,
 * enabling mobile wallet privacy operations.
 *
 * @module wallet/ethereum/walletconnect-adapter
 */

import type { HexString } from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { WalletError } from '../errors'
import {
  PrivacyEthereumWalletAdapter,
  type PrivacyEthereumAdapterConfig,
  type PrivacyContext,
} from './privacy-adapter'
import type { EIP1193Provider, EIP712TypedData } from './types'
import { EthereumChainId } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * WalletConnect session info
 */
export interface WalletConnectSession {
  /** Session topic */
  topic: string
  /** Peer metadata */
  peer: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  /** Namespaces with accounts and methods */
  namespaces: {
    eip155?: {
      accounts: string[]
      methods: string[]
      events: string[]
      chains?: string[]
    }
  }
  /** Session expiry timestamp */
  expiry: number
  /** Acknowledged flag */
  acknowledged: boolean
}

/**
 * WalletConnect adapter configuration
 */
export interface WalletConnectAdapterConfig extends Omit<PrivacyEthereumAdapterConfig, 'provider' | 'wallet'> {
  /**
   * WalletConnect project ID from cloud.walletconnect.com
   */
  projectId: string
  /**
   * Relay URL (defaults to wss://relay.walletconnect.com)
   */
  relayUrl?: string
  /**
   * App metadata for pairing proposal
   */
  metadata?: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  /**
   * Required chain IDs for session
   */
  requiredChains?: number[]
  /**
   * Optional chain IDs
   */
  optionalChains?: number[]
  /**
   * Session storage key
   */
  storageKey?: string
  /**
   * Connection timeout in ms
   */
  connectionTimeout?: number
  /**
   * Auto-reconnect to previous session
   */
  autoReconnect?: boolean
}

/**
 * Connection result
 */
export interface WalletConnectResult {
  /** Connected address */
  address: string
  /** Chain ID */
  chainId: number
  /** Session info */
  session: WalletConnectSession
}

/**
 * Pairing URI for QR code
 */
export interface PairingUri {
  /** Full URI for QR code */
  uri: string
  /** Topic for tracking */
  topic: string
}

// ─── WalletConnect Adapter ──────────────────────────────────────────────────

/**
 * WalletConnect v2 Privacy Adapter
 *
 * Enables privacy operations through WalletConnect for mobile wallets.
 * Handles session management, reconnection, and multi-chain support.
 *
 * @example Basic usage
 * ```typescript
 * const adapter = new WalletConnectPrivacyAdapter({
 *   projectId: 'your-project-id',
 *   chainId: 1,
 * })
 *
 * // Generate pairing URI for QR code
 * const { uri } = await adapter.createPairing()
 * displayQRCode(uri)
 *
 * // Wait for connection
 * await adapter.connect()
 * await adapter.initializePrivacy()
 *
 * // Use privacy features
 * const metaAddress = adapter.getMetaAddress()
 * ```
 *
 * @example With auto-reconnect
 * ```typescript
 * const adapter = new WalletConnectPrivacyAdapter({
 *   projectId: 'your-project-id',
 *   autoReconnect: true,
 *   storageKey: 'my-app-wc-session',
 * })
 *
 * // Attempt to reconnect to previous session
 * const reconnected = await adapter.tryReconnect()
 * if (!reconnected) {
 *   // Create new pairing
 *   const { uri } = await adapter.createPairing()
 *   displayQRCode(uri)
 * }
 * ```
 */
export class WalletConnectPrivacyAdapter extends PrivacyEthereumWalletAdapter {
  private projectId: string
  private relayUrl: string
  private wcMetadata: Required<WalletConnectAdapterConfig>['metadata']
  private requiredChains: number[]
  private optionalChains: number[]
  private storageKey: string
  private connectionTimeout: number
  private autoReconnect: boolean
  private currentSession: WalletConnectSession | undefined
  private pairingUri: PairingUri | undefined
  private signClient: unknown // WalletConnect SignClient instance
  private wcProvider: EIP1193Provider | undefined

  constructor(config: WalletConnectAdapterConfig) {
    // Create with a placeholder provider - will be set during connect
    super({
      ...config,
      wallet: 'walletconnect',
      provider: undefined,
    })

    this.projectId = config.projectId
    this.relayUrl = config.relayUrl ?? 'wss://relay.walletconnect.com'
    this.wcMetadata = config.metadata ?? {
      name: 'SIP Protocol',
      description: 'Privacy-preserving transactions',
      url: 'https://sip-protocol.org',
      icons: ['https://sip-protocol.org/icon.png'],
    }
    this.requiredChains = config.requiredChains ?? [config.chainId ?? EthereumChainId.MAINNET]
    this.optionalChains = config.optionalChains ?? [
      EthereumChainId.MAINNET,
      EthereumChainId.SEPOLIA,
      EthereumChainId.ARBITRUM,
      EthereumChainId.OPTIMISM,
      EthereumChainId.BASE,
      EthereumChainId.POLYGON,
    ]
    this.storageKey = config.storageKey ?? 'sip-wc-session'
    this.connectionTimeout = config.connectionTimeout ?? 30000
    this.autoReconnect = config.autoReconnect ?? true
  }

  // ─── Session Management ─────────────────────────────────────────────────────

  /**
   * Create a pairing URI for QR code display
   *
   * Call this before connect() to get the pairing URI.
   *
   * @returns Pairing URI and topic
   */
  async createPairing(): Promise<PairingUri> {
    await this.ensureSignClient()

    // Create pairing proposal
    const { uri, approval } = await this.createConnectProposal()

    this.pairingUri = { uri, topic: '' }

    // Store approval promise for connect()
    ;(this as unknown as { _approval: Promise<WalletConnectSession> })._approval = approval

    return this.pairingUri
  }

  /**
   * Connect to WalletConnect
   *
   * If createPairing() was called, waits for user to scan QR.
   * Otherwise, attempts to reconnect to existing session.
   */
  async connect(): Promise<void> {
    try {
      this._connectionState = 'connecting'

      // Try auto-reconnect if enabled
      if (this.autoReconnect && !this.pairingUri) {
        const reconnected = await this.tryReconnect()
        if (reconnected) {
          return
        }
      }

      // Wait for approval from pairing
      const approval = (this as unknown as { _approval: Promise<WalletConnectSession> })._approval
      if (!approval) {
        throw new WalletError(
          'Call createPairing() first to get pairing URI',
          WalletErrorCode.NOT_CONNECTED
        )
      }

      // Wait for session with timeout
      const session = await Promise.race([
        approval,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout')),
            this.connectionTimeout
          )
        ),
      ])

      this.currentSession = session
      await this.setupFromSession(session)

      // Store session for reconnection
      this.storeSession(session)

    } catch (error) {
      this._connectionState = 'error'

      if (error instanceof WalletError) {
        throw error
      }

      throw new WalletError(
        `WalletConnect connection failed: ${String(error)}`,
        WalletErrorCode.CONNECTION_FAILED
      )
    }
  }

  /**
   * Try to reconnect to a previous session
   *
   * @returns True if successfully reconnected
   */
  async tryReconnect(): Promise<boolean> {
    const storedSession = this.loadSession()
    if (!storedSession) {
      return false
    }

    try {
      await this.ensureSignClient()

      // Check if session is still valid
      const now = Math.floor(Date.now() / 1000)
      if (storedSession.expiry < now) {
        this.clearStoredSession()
        return false
      }

      // Try to restore session
      this.currentSession = storedSession
      await this.setupFromSession(storedSession)

      return true
    } catch {
      this.clearStoredSession()
      return false
    }
  }

  /**
   * Disconnect from WalletConnect
   */
  async disconnect(): Promise<void> {
    if (this.currentSession && this.signClient) {
      try {
        // Disconnect WalletConnect session
        await (this.signClient as { disconnect: (params: { topic: string; reason: { code: number; message: string } }) => Promise<void> }).disconnect({
          topic: this.currentSession.topic,
          reason: { code: 6000, message: 'User disconnected' },
        })
      } catch {
        // Ignore disconnect errors
      }
    }

    this.currentSession = undefined
    this.wcProvider = undefined
    this.pairingUri = undefined
    this.clearStoredSession()
    this.clearPrivacy()

    await super.disconnect()
  }

  // ─── Session Info ───────────────────────────────────────────────────────────

  /**
   * Get current session info
   */
  getSession(): WalletConnectSession | undefined {
    return this.currentSession
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    if (!this.currentSession) return false
    const now = Math.floor(Date.now() / 1000)
    return this.currentSession.expiry > now
  }

  /**
   * Get connected peer metadata
   */
  getPeerMetadata(): WalletConnectSession['peer'] | undefined {
    return this.currentSession?.peer
  }

  /**
   * Get pairing URI for QR code
   */
  getPairingUri(): string | undefined {
    return this.pairingUri?.uri
  }

  // ─── Privacy Context Persistence ────────────────────────────────────────────

  /**
   * Save privacy context to storage
   *
   * Allows preserving privacy keys across page reloads.
   */
  savePrivacyContext(): void {
    const context = this.getPrivacyContext()
    if (context && typeof localStorage !== 'undefined') {
      localStorage.setItem(
        `${this.storageKey}-privacy`,
        JSON.stringify(context)
      )
    }
  }

  /**
   * Load and restore privacy context from storage
   *
   * @returns True if context was restored
   */
  loadPrivacyContext(): boolean {
    if (typeof localStorage === 'undefined') return false

    const stored = localStorage.getItem(`${this.storageKey}-privacy`)
    if (!stored) return false

    try {
      const context = JSON.parse(stored) as PrivacyContext
      this.setPrivacyContext(context)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clear stored privacy context
   */
  clearPrivacyContext(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${this.storageKey}-privacy`)
    }
  }

  // ─── Signing with Mobile Wallet Handling ────────────────────────────────────

  /**
   * Sign typed data with extended timeout for mobile
   *
   * Mobile wallets may take longer to respond due to user interaction.
   */
  async signTypedDataWithTimeout(
    typedData: EIP712TypedData,
    timeout: number = 60000
  ): Promise<HexString> {
    if (!this.wcProvider) {
      throw new WalletError(
        'WalletConnect not connected',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    const signature = await Promise.race([
      this.signTypedData(typedData),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new WalletError('Signing timeout', WalletErrorCode.SIGNING_FAILED)),
          timeout
        )
      ),
    ])

    return signature.signature
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Ensure SignClient is initialized
   */
  private async ensureSignClient(): Promise<void> {
    if (this.signClient) return

    // Dynamic import of WalletConnect
    // This allows the package to be optional
    try {
      // @ts-expect-error - Optional peer dependency, users must install separately
      const { SignClient } = await import('@walletconnect/sign-client')

      this.signClient = await SignClient.init({
        projectId: this.projectId,
        relayUrl: this.relayUrl,
        metadata: this.wcMetadata,
      })

      // Set up event handlers
      this.setupEventHandlers()
    } catch (error) {
      throw new WalletError(
        'Failed to initialize WalletConnect. Make sure @walletconnect/sign-client is installed.',
        WalletErrorCode.CONNECTION_FAILED
      )
    }
  }

  /**
   * Create connection proposal
   */
  private async createConnectProposal(): Promise<{
    uri: string
    approval: Promise<WalletConnectSession>
  }> {
    const client = this.signClient as {
      connect: (params: {
        requiredNamespaces: Record<string, { chains: string[]; methods: string[]; events: string[] }>
        optionalNamespaces?: Record<string, { chains: string[]; methods: string[]; events: string[] }>
      }) => Promise<{ uri: string; approval: () => Promise<{ topic: string; peer: { metadata: WalletConnectSession['peer'] }; namespaces: WalletConnectSession['namespaces']; expiry: number; acknowledged: boolean }> }>
    }

    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          chains: this.requiredChains.map(id => `eip155:${id}`),
          methods: [
            'eth_sendTransaction',
            'eth_signTransaction',
            'eth_sign',
            'personal_sign',
            'eth_signTypedData',
            'eth_signTypedData_v4',
          ],
          events: ['chainChanged', 'accountsChanged'],
        },
      },
      optionalNamespaces: {
        eip155: {
          chains: this.optionalChains.map(id => `eip155:${id}`),
          methods: [
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData_v4',
          ],
          events: ['chainChanged', 'accountsChanged'],
        },
      },
    })

    return {
      uri: uri ?? '',
      approval: approval().then(session => ({
        topic: session.topic,
        peer: session.peer.metadata,
        namespaces: session.namespaces,
        expiry: session.expiry,
        acknowledged: session.acknowledged,
      })),
    }
  }

  /**
   * Set up adapter from session
   */
  private async setupFromSession(session: WalletConnectSession): Promise<void> {
    // Get first account from session
    const account = session.namespaces.eip155?.accounts[0]
    if (!account) {
      throw new WalletError(
        'No accounts in WalletConnect session',
        WalletErrorCode.CONNECTION_FAILED
      )
    }

    // Parse account format: eip155:chainId:address
    const [, _chainIdStr, address] = account.split(':')

    // Create EIP-1193 provider from SignClient
    this.wcProvider = this.createProviderFromSession(session)

    // Set connected state
    this.setConnected(address, address as HexString)
  }

  /**
   * Create EIP-1193 provider from session
   */
  private createProviderFromSession(session: WalletConnectSession): EIP1193Provider {
    const client = this.signClient as {
      request: <T>(params: { topic: string; chainId: string; request: { method: string; params: unknown[] } }) => Promise<T>
    }
    const topic = session.topic
    const chainId = this.getChainId()

    return {
      request: async <T>({ method, params }: { method: string; params?: unknown[] }): Promise<T> => {
        return client.request<T>({
          topic,
          chainId: `eip155:${chainId}`,
          request: { method, params: params ?? [] },
        })
      },
      on: () => {},
      removeListener: () => {},
    }
  }

  /**
   * Set up WalletConnect event handlers
   */
  private setupEventHandlers(): void {
    const client = this.signClient as {
      on: (event: string, callback: (data: { topic: string; params?: { message?: string } }) => void) => void
    }

    client.on('session_delete', ({ topic }) => {
      if (this.currentSession?.topic === topic) {
        this.onWalletConnectDisconnect()
      }
    })

    client.on('session_expire', ({ topic }) => {
      if (this.currentSession?.topic === topic) {
        this.onWalletConnectDisconnect()
      }
    })

    client.on('session_event', () => {
      // Handle session events (chainChanged, accountsChanged)
    })
  }

  /**
   * Handle WalletConnect disconnect event
   */
  private onWalletConnectDisconnect(): void {
    this.currentSession = undefined
    this.wcProvider = undefined
    this.setDisconnected('WalletConnect session ended')
  }

  // ─── Session Storage ────────────────────────────────────────────────────────

  /**
   * Store session to localStorage
   */
  private storeSession(session: WalletConnectSession): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(session))
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): WalletConnectSession | undefined {
    if (typeof localStorage === 'undefined') return undefined

    const stored = localStorage.getItem(this.storageKey)
    if (!stored) return undefined

    try {
      return JSON.parse(stored) as WalletConnectSession
    } catch {
      return undefined
    }
  }

  /**
   * Clear stored session
   */
  private clearStoredSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey)
    }
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a WalletConnect privacy adapter
 *
 * @example
 * ```typescript
 * const adapter = createWalletConnectPrivacyAdapter({
 *   projectId: 'your-walletconnect-project-id',
 *   chainId: 1,
 * })
 *
 * const { uri } = await adapter.createPairing()
 * // Display QR code with uri
 *
 * await adapter.connect()
 * await adapter.initializePrivacy()
 * ```
 */
export function createWalletConnectPrivacyAdapter(
  config: WalletConnectAdapterConfig
): WalletConnectPrivacyAdapter {
  return new WalletConnectPrivacyAdapter(config)
}
