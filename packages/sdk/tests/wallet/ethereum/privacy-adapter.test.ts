/**
 * Privacy-Extended Ethereum Wallet Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrivacyEthereumWalletAdapter,
  createPrivacyEthereumAdapter,
} from '../../../src/wallet/ethereum/privacy-adapter'

// Use local HexString type to avoid package resolution issues
type HexString = `0x${string}`
interface StealthAddress {
  address: HexString
  ephemeralPublicKey: HexString
  viewTag: number
}

// Mock the Ethereum stealth module
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

// Mock EIP-1193 provider
const createMockProvider = () => ({
  request: vi.fn().mockImplementation(async ({ method }) => {
    switch (method) {
      case 'eth_requestAccounts':
        return ['0x1234567890123456789012345678901234567890']
      case 'eth_chainId':
        return '0x1'
      case 'eth_getBalance':
        return '0x1000000000000000000' // 1 ETH
      case 'personal_sign':
        return '0x' + 'ab'.repeat(65)
      case 'eth_signTypedData_v4':
        return '0x' + 'cd'.repeat(65)
      case 'eth_sendTransaction':
        return '0x' + 'ef'.repeat(32)
      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }),
  on: vi.fn(),
  removeListener: vi.fn(),
})

describe('PrivacyEthereumWalletAdapter', () => {
  let mockProvider: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    mockProvider = createMockProvider()
    vi.clearAllMocks()
  })

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('Constructor', () => {
    it('should create adapter with default config', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(adapter).toBeInstanceOf(PrivacyEthereumWalletAdapter)
      expect(adapter.isPrivacyInitialized()).toBe(false)
    })

    it('should accept pre-existing stealth keys', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
        metaAddress: {
          chain: 'ethereum',
          spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
          viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
        },
        spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
        viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
      })

      expect(adapter.isPrivacyInitialized()).toBe(true)
      expect(adapter.getMetaAddress().spendingKey).toBe('0x02' + 'aa'.repeat(32))
    })

    it('should throw if metaAddress provided without private keys', () => {
      expect(() => {
        new PrivacyEthereumWalletAdapter({
          provider: mockProvider as any,
          metaAddress: {
            chain: 'ethereum',
            spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
            viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
          },
        })
      }).toThrow('spendingPrivateKey and viewingPrivateKey required when metaAddress provided')
    })

    it('should configure deriveFromWallet option', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
        deriveFromWallet: true,
        derivationDomain: 'test-domain.com',
      })

      expect(adapter).toBeInstanceOf(PrivacyEthereumWalletAdapter)
    })
  })

  // ─── Factory Function ─────────────────────────────────────────────────────────

  describe('Factory Function', () => {
    it('should create adapter with createPrivacyEthereumAdapter', () => {
      const adapter = createPrivacyEthereumAdapter({
        provider: mockProvider as any,
      })

      expect(adapter).toBeInstanceOf(PrivacyEthereumWalletAdapter)
    })

    it('should pass config options through factory', () => {
      const adapter = createPrivacyEthereumAdapter({
        provider: mockProvider as any,
        chainId: 11155111,
        deriveFromWallet: true,
      })

      expect(adapter).toBeInstanceOf(PrivacyEthereumWalletAdapter)
    })
  })

  // ─── Privacy Initialization ─────────────────────────────────────────────────

  describe('Privacy Initialization', () => {
    it('should initialize privacy with random keys after connect', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      expect(adapter.isPrivacyInitialized()).toBe(true)
      expect(adapter.getMetaAddress()).toBeDefined()
    })

    it('should return meta address only after initialization', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(() => adapter.getMetaAddress()).toThrow('Privacy not initialized')

      await adapter.connect()
      await adapter.initializePrivacy()

      expect(adapter.getMetaAddress()).toBeDefined()
    })

    it('should not reinitialize if already initialized', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
        metaAddress: {
          chain: 'ethereum',
          spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
          viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
        },
        spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
        viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      // Should still have original keys
      expect(adapter.getMetaAddress().spendingKey).toBe('0x02' + 'aa'.repeat(32))
    })
  })

  // ─── Key Access ─────────────────────────────────────────────────────────────

  describe('Key Access', () => {
    it('should return viewing private key', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
        metaAddress: {
          chain: 'ethereum',
          spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
          viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
        },
        spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
        viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
      })

      await adapter.connect()
      expect(adapter.getViewingPrivateKey()).toBe('0x' + 'dd'.repeat(32))
    })

    it('should return spending private key', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
        metaAddress: {
          chain: 'ethereum',
          spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
          viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
        },
        spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
        viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
      })

      await adapter.connect()
      expect(adapter.getSpendingPrivateKey()).toBe('0x' + 'cc'.repeat(32))
    })

    it('should throw when accessing keys before initialization', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(() => adapter.getViewingPrivateKey()).toThrow('Privacy not initialized')
      expect(() => adapter.getSpendingPrivateKey()).toThrow('Privacy not initialized')
    })
  })

  // ─── Encoded Meta-Address ────────────────────────────────────────────────────

  describe('Encoded Meta-Address', () => {
    it('should return EIP-5564 encoded meta-address', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const encoded = adapter.getEncodedMetaAddress()
      expect(encoded).toContain('st:eth:')
    })
  })

  // ─── Stealth Address Generation ─────────────────────────────────────────────

  describe('Stealth Address Generation', () => {
    it('should generate stealth address for recipient', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const recipientMeta = {
        chain: 'ethereum' as const,
        spendingKey: ('0x02' + 'ff'.repeat(32)) as HexString,
        viewingKey: ('0x02' + 'ee'.repeat(32)) as HexString,
      }

      const result = adapter.generateStealthAddressFor(recipientMeta)

      expect(result.stealthAddress).toBeDefined()
      expect(result.ethAddress).toBeDefined()
      expect(result.sharedSecret).toBeDefined()
    })
  })

  // ─── Payment Scanning ───────────────────────────────────────────────────────

  describe('Payment Scanning', () => {
    it('should scan payments and identify owned addresses', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const announcements: StealthAddress[] = [
        {
          address: ('0x02' + 'ab'.repeat(32)) as HexString,
          ephemeralPublicKey: ('0x02' + 'cd'.repeat(32)) as HexString,
          viewTag: 42,
        },
      ]

      const results = adapter.scanPayments(announcements)

      expect(results).toHaveLength(1)
      expect(results[0].isOwned).toBe(true)
      expect(results[0].ethAddress).toBeDefined()
    })

    it('should throw when scanning before initialization', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(() => adapter.scanPayments([])).toThrow('Privacy not initialized')
    })
  })

  // ─── Fast View Tag Scanning ─────────────────────────────────────────────────

  describe('Fast View Tag Scanning', () => {
    it('should filter by view tag', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const announcements: StealthAddress[] = [
        {
          address: ('0x02' + 'ab'.repeat(32)) as HexString,
          ephemeralPublicKey: ('0x02' + 'cd'.repeat(32)) as HexString,
          viewTag: 42,
        },
        {
          address: ('0x02' + 'ef'.repeat(32)) as HexString,
          ephemeralPublicKey: ('0x02' + '12'.repeat(32)) as HexString,
          viewTag: 100,
        },
      ]

      const filtered = adapter.fastScanByViewTag(announcements)

      // Results depend on actual view tag computation
      expect(filtered).toBeDefined()
      expect(Array.isArray(filtered)).toBe(true)
    })
  })

  // ─── Key Export/Import ──────────────────────────────────────────────────────

  describe('Key Export/Import', () => {
    it('should export stealth keys', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const exported = adapter.exportStealthKeys()

      expect(exported).toBeDefined()
      expect(exported!.metaAddress).toBeDefined()
      expect(exported!.spendingPrivateKey).toBeDefined()
      expect(exported!.viewingPrivateKey).toBeDefined()
      expect(exported!.encodedMetaAddress).toBeDefined()
    })

    it('should import stealth keys', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      const keys = {
        metaAddress: {
          chain: 'ethereum' as const,
          spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
          viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
        },
        spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
        viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
        encodedMetaAddress: 'st:eth:0x...',
      }

      adapter.importStealthKeys(keys)

      expect(adapter.isPrivacyInitialized()).toBe(true)
      expect(adapter.getMetaAddress().spendingKey).toBe('0x02' + 'aa'.repeat(32))
    })

    it('should return undefined when exporting without initialization', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(adapter.exportStealthKeys()).toBeUndefined()
    })
  })

  // ─── Privacy Context ────────────────────────────────────────────────────────

  describe('Privacy Context', () => {
    it('should get privacy context', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const context = adapter.getPrivacyContext()

      expect(context).toBeDefined()
      expect(context!.keys).toBeDefined()
      expect(context!.derivedFromWallet).toBe(false)
    })

    it('should set privacy context', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()

      const context = {
        keys: {
          metaAddress: {
            chain: 'ethereum' as const,
            spendingKey: ('0x02' + 'aa'.repeat(32)) as HexString,
            viewingKey: ('0x02' + 'bb'.repeat(32)) as HexString,
          },
          spendingPrivateKey: ('0x' + 'cc'.repeat(32)) as HexString,
          viewingPrivateKey: ('0x' + 'dd'.repeat(32)) as HexString,
          encodedMetaAddress: 'st:eth:0x...',
        },
        derivedFromWallet: false,
      }

      adapter.setPrivacyContext(context)
      expect(adapter.isPrivacyInitialized()).toBe(true)
    })

    it('should clear privacy', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      expect(adapter.isPrivacyInitialized()).toBe(true)

      adapter.clearPrivacy()

      expect(adapter.isPrivacyInitialized()).toBe(false)
    })
  })

  // ─── Claim Key Derivation ───────────────────────────────────────────────────

  describe('Claim Key Derivation', () => {
    it('should derive claim key from ephemeral public key', async () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      await adapter.connect()
      await adapter.initializePrivacy()

      const result = adapter.deriveClaimKey(
        ('0x02' + 'cd'.repeat(32)) as HexString,
        42
      )

      expect(result.privateKey).toBeDefined()
      expect(result.publicKey).toBeDefined()
      expect(result.ethAddress).toBeDefined()
    })

    it('should throw when deriving claim key before initialization', () => {
      const adapter = new PrivacyEthereumWalletAdapter({
        provider: mockProvider as any,
      })

      expect(() => {
        adapter.deriveClaimKey(('0x02' + 'cd'.repeat(32)) as HexString, 42)
      }).toThrow('Privacy not initialized')
    })
  })
})
