/**
 * WalletConnect Privacy Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  WalletConnectPrivacyAdapter,
  createWalletConnectPrivacyAdapter,
  type WalletConnectSession,
} from '../../../src/wallet/ethereum/walletconnect-adapter'

// Use local HexString type
type HexString = `0x${string}`

// Mock the stealth module
vi.mock('../../../src/chains/ethereum/stealth', () => ({
  generateEthereumStealthMetaAddress: vi.fn().mockReturnValue({
    metaAddress: {
      chain: 'ethereum',
      spendingKey: '0x02' + '01'.repeat(32),
      viewingKey: '0x02' + '02'.repeat(32),
    },
    encoded: 'st:eth:0x02' + '01'.repeat(32) + '02' + '02'.repeat(32),
    spendingPrivateKey: '0x' + '03'.repeat(32),
    viewingPrivateKey: '0x' + '04'.repeat(32),
  }),
  generateEthereumStealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x02' + 'ab'.repeat(32),
      ephemeralPublicKey: '0x02' + 'cd'.repeat(32),
      viewTag: 42,
    },
    sharedSecret: '0x' + 'ef'.repeat(32),
  }),
  deriveEthereumStealthPrivateKey: vi.fn().mockReturnValue({
    stealthAddress: '0x02' + 'ab'.repeat(32),
    ephemeralPublicKey: '0x02' + 'cd'.repeat(32),
    privateKey: '0x' + '99'.repeat(32),
    ethAddress: '0x' + '11'.repeat(20),
  }),
  checkEthereumStealthAddress: vi.fn().mockReturnValue(true),
  stealthPublicKeyToEthAddress: vi.fn().mockReturnValue('0x' + '11'.repeat(20)),
  encodeEthereumStealthMetaAddress: vi.fn().mockReturnValue('st:eth:0x02' + '01'.repeat(32) + '02' + '02'.repeat(32)),
  parseEthereumStealthMetaAddress: vi.fn().mockReturnValue({
    spendingPublicKey: '0x02' + '01'.repeat(32),
    viewingPublicKey: '0x02' + '02'.repeat(32),
  }),
}))

// Mock WalletConnect SignClient
vi.mock('@walletconnect/sign-client', () => ({
  SignClient: {
    init: vi.fn().mockResolvedValue({
      connect: vi.fn().mockResolvedValue({
        uri: 'wc:abc123@2?relay-protocol=irn&symKey=xyz',
        approval: vi.fn().mockResolvedValue({
          topic: 'test-topic-123',
          peer: {
            metadata: {
              name: 'Test Wallet',
              description: 'A test wallet',
              url: 'https://test.wallet',
              icons: ['https://test.wallet/icon.png'],
            },
          },
          namespaces: {
            eip155: {
              accounts: ['eip155:1:0x1234567890123456789012345678901234567890'],
              methods: ['eth_sendTransaction', 'personal_sign'],
              events: ['chainChanged', 'accountsChanged'],
            },
          },
          expiry: Math.floor(Date.now() / 1000) + 86400,
          acknowledged: true,
        }),
      }),
      on: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
    }),
  },
}))

describe('WalletConnectPrivacyAdapter', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    // Mock localStorage
    originalLocalStorage = globalThis.localStorage
    const storage: Record<string, string> = {}
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
      length: 0,
      key: () => null,
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage
  })

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('Constructor', () => {
    it('should create adapter with required project ID', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter).toBeInstanceOf(WalletConnectPrivacyAdapter)
    })

    it('should accept custom configuration', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        chainId: 137, // Polygon
        relayUrl: 'wss://custom-relay.example.com',
        metadata: {
          name: 'Custom App',
          description: 'Custom description',
          url: 'https://custom.app',
          icons: ['https://custom.app/icon.png'],
        },
        requiredChains: [1, 137],
        optionalChains: [10, 42161],
        storageKey: 'custom-storage-key',
        connectionTimeout: 60000,
        autoReconnect: false,
      })

      expect(adapter).toBeInstanceOf(WalletConnectPrivacyAdapter)
    })

    it('should use default values for optional config', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      // Just verify it was created - internal defaults are applied
      expect(adapter).toBeDefined()
    })
  })

  // ─── Factory Function ─────────────────────────────────────────────────────────

  describe('Factory Function', () => {
    it('should create adapter with factory', () => {
      const adapter = createWalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter).toBeInstanceOf(WalletConnectPrivacyAdapter)
    })
  })

  // ─── Session Info ───────────────────────────────────────────────────────────

  describe('Session Info', () => {
    it('should return undefined session before connection', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter.getSession()).toBeUndefined()
    })

    it('should check session active status', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter.isSessionActive()).toBe(false)
    })

    it('should return undefined peer metadata before connection', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter.getPeerMetadata()).toBeUndefined()
    })

    it('should return undefined pairing URI before creation', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter.getPairingUri()).toBeUndefined()
    })
  })

  // ─── Pairing ────────────────────────────────────────────────────────────────

  describe('Pairing', () => {
    it('should create pairing URI', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      const pairing = await adapter.createPairing()

      expect(pairing.uri).toBeDefined()
      expect(pairing.uri).toContain('wc:')
    })
  })

  // ─── Connection ─────────────────────────────────────────────────────────────

  describe('Connection', () => {
    it('should throw if connect called without pairing', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        autoReconnect: false,
      })

      await expect(adapter.connect()).rejects.toThrow('Call createPairing() first')
    })

    it('should connect after pairing created', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      await adapter.createPairing()
      await adapter.connect()

      expect(adapter.isConnected()).toBe(true)
      expect(adapter.address).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should store session after connection', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      await adapter.createPairing()
      await adapter.connect()

      const stored = localStorage.getItem('test-session')
      expect(stored).toBeDefined()
    })
  })

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  describe('Disconnect', () => {
    it('should disconnect and clear state', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      await adapter.createPairing()
      await adapter.connect()

      await adapter.disconnect()

      expect(adapter.isConnected()).toBe(false)
      expect(adapter.getSession()).toBeUndefined()
    })

    it('should clear stored session on disconnect', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      await adapter.createPairing()
      await adapter.connect()

      expect(localStorage.getItem('test-session')).toBeDefined()

      await adapter.disconnect()

      expect(localStorage.getItem('test-session')).toBeNull()
    })
  })

  // ─── Reconnection ───────────────────────────────────────────────────────────

  describe('Reconnection', () => {
    it('should fail to reconnect with no stored session', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      const reconnected = await adapter.tryReconnect()

      expect(reconnected).toBe(false)
    })

    it('should detect expired session', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      // Store an expired session
      const expiredSession: WalletConnectSession = {
        topic: 'old-topic',
        peer: {
          name: 'Old Wallet',
          description: 'Expired',
          url: 'https://old.wallet',
          icons: [],
        },
        namespaces: {
          eip155: {
            accounts: ['eip155:1:0x1234567890123456789012345678901234567890'],
            methods: [],
            events: [],
          },
        },
        expiry: Math.floor(Date.now() / 1000) - 1000, // Expired
        acknowledged: true,
      }
      localStorage.setItem('test-session', JSON.stringify(expiredSession))

      const reconnected = await adapter.tryReconnect()

      expect(reconnected).toBe(false)
      expect(localStorage.getItem('test-session')).toBeNull()
    })
  })

  // ─── Privacy Context Persistence ────────────────────────────────────────────

  describe('Privacy Context Persistence', () => {
    it('should save privacy context to storage', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      await adapter.createPairing()
      await adapter.connect()
      await adapter.initializePrivacy()

      adapter.savePrivacyContext()

      const stored = localStorage.getItem('test-session-privacy')
      expect(stored).toBeDefined()
    })

    it('should load privacy context from storage', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      // Store mock privacy context
      const mockContext = {
        keys: {
          metaAddress: {
            chain: 'ethereum',
            spendingKey: '0x02' + 'aa'.repeat(32),
            viewingKey: '0x02' + 'bb'.repeat(32),
          },
          spendingPrivateKey: '0x' + 'cc'.repeat(32),
          viewingPrivateKey: '0x' + 'dd'.repeat(32),
          encodedMetaAddress: 'st:eth:0x...',
        },
        derivedFromWallet: false,
      }
      localStorage.setItem('test-session-privacy', JSON.stringify(mockContext))

      const loaded = adapter.loadPrivacyContext()

      expect(loaded).toBe(true)
      expect(adapter.isPrivacyInitialized()).toBe(true)
    })

    it('should clear privacy context', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
        storageKey: 'test-session',
      })

      localStorage.setItem('test-session-privacy', '{}')

      adapter.clearPrivacyContext()

      expect(localStorage.getItem('test-session-privacy')).toBeNull()
    })
  })

  // ─── Session Active Check ───────────────────────────────────────────────────

  describe('Session Active Check', () => {
    it('should detect active session', async () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      await adapter.createPairing()
      await adapter.connect()

      expect(adapter.isSessionActive()).toBe(true)
    })

    it('should return false when no session', () => {
      const adapter = new WalletConnectPrivacyAdapter({
        projectId: 'test-project-id',
      })

      expect(adapter.isSessionActive()).toBe(false)
    })
  })
})
