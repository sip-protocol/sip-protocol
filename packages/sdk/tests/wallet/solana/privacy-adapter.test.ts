/**
 * Privacy-Extended Solana Wallet Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrivacySolanaWalletAdapter,
  createPrivacySolanaAdapter,
} from '../../../src/wallet/solana/privacy-adapter'

// Use local HexString type to avoid package resolution issues
type HexString = `0x${string}`
interface StealthAddress {
  address: HexString
  ephemeralPublicKey: HexString
  viewTag: number
}

// Mock the stealth module
vi.mock('../../../src/stealth', () => ({
  generateEd25519StealthMetaAddress: vi.fn().mockReturnValue({
    metaAddress: {
      chain: 'solana',
      spendingKey: '0x' + '01'.repeat(32),
      viewingKey: '0x' + '02'.repeat(32),
    },
    spendingPrivateKey: '0x' + '03'.repeat(32),
    viewingPrivateKey: '0x' + '04'.repeat(32),
  }),
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'ab'.repeat(32),
      ephemeralPublicKey: '0x' + 'cd'.repeat(32),
      viewTag: 42,
    },
    sharedSecret: '0x' + 'ef'.repeat(32),
  }),
  deriveEd25519StealthPrivateKey: vi.fn().mockReturnValue({
    stealthAddress: '0x' + 'ab'.repeat(32),
    ephemeralPublicKey: '0x' + 'cd'.repeat(32),
    privateKey: '0x' + '99'.repeat(32),
  }),
  checkEd25519StealthAddress: vi.fn().mockReturnValue(true),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('7777777777777777777777777777777777777777777'),
}))

// Mock Solana provider
const createMockProvider = () => ({
  isConnected: true,
  publicKey: {
    toBase58: () => 'DemoWallet111111111111111111111111111111111',
    toBytes: () => new Uint8Array(32),
    toString: () => 'DemoWallet111111111111111111111111111111111',
  },
  connect: vi.fn().mockResolvedValue({
    publicKey: {
      toBase58: () => 'DemoWallet111111111111111111111111111111111',
      toBytes: () => new Uint8Array(32),
      toString: () => 'DemoWallet111111111111111111111111111111111',
    },
  }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  signMessage: vi.fn().mockResolvedValue({
    signature: new Uint8Array(64).fill(1),
  }),
  signTransaction: vi.fn().mockImplementation(async (tx) => tx),
  signAndSendTransaction: vi.fn().mockResolvedValue({
    signature: 'mockTxSignature123456789',
  }),
  signAllTransactions: vi.fn().mockImplementation(async (txs) => txs),
  on: vi.fn(),
  off: vi.fn(),
})

describe('PrivacySolanaWalletAdapter', () => {
  let mockProvider: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    mockProvider = createMockProvider()
    vi.clearAllMocks()
  })

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('Constructor', () => {
    it('should create adapter with default config', () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })

      expect(adapter).toBeInstanceOf(PrivacySolanaWalletAdapter)
      expect(adapter.isPrivacyInitialized()).toBe(false)
    })

    it('should accept pre-existing stealth keys', () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
        metaAddress: {
          chain: 'solana',
          spendingKey: '0x' + 'aa'.repeat(32) as HexString,
          viewingKey: '0x' + 'bb'.repeat(32) as HexString,
        },
        spendingPrivateKey: '0x' + 'cc'.repeat(32) as HexString,
        viewingPrivateKey: '0x' + 'dd'.repeat(32) as HexString,
      })

      expect(adapter.isPrivacyInitialized()).toBe(true)
    })

    it('should throw if metaAddress provided without private keys', () => {
      expect(() => new PrivacySolanaWalletAdapter({
        provider: mockProvider,
        metaAddress: {
          chain: 'solana',
          spendingKey: '0x' + 'aa'.repeat(32) as HexString,
          viewingKey: '0x' + 'bb'.repeat(32) as HexString,
        },
      })).toThrow('spendingPrivateKey and viewingPrivateKey required')
    })

    it('should support deriveFromWallet option', () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
        deriveFromWallet: true,
        derivationDomain: 'test.com',
      })

      expect(adapter).toBeInstanceOf(PrivacySolanaWalletAdapter)
    })
  })

  // ─── Factory ────────────────────────────────────────────────────────────────

  describe('createPrivacySolanaAdapter', () => {
    it('should create adapter via factory', () => {
      const adapter = createPrivacySolanaAdapter({
        provider: mockProvider,
      })

      expect(adapter).toBeInstanceOf(PrivacySolanaWalletAdapter)
    })
  })

  // ─── Privacy Initialization ─────────────────────────────────────────────────

  describe('initializePrivacy', () => {
    it('should generate random stealth keys', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      expect(adapter.isPrivacyInitialized()).toBe(true)
      expect(adapter.getMetaAddress()).toBeDefined()
      expect(adapter.getMetaAddress().chain).toBe('solana')
    })

    it('should derive keys from wallet signature when deriveFromWallet is true', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
        deriveFromWallet: true,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      expect(mockProvider.signMessage).toHaveBeenCalled()
      expect(adapter.isPrivacyInitialized()).toBe(true)
    })

    it('should be idempotent', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const metaAddress1 = adapter.getMetaAddress()
      await adapter.initializePrivacy() // Second call
      const metaAddress2 = adapter.getMetaAddress()

      expect(metaAddress1).toEqual(metaAddress2)
    })

    it('should throw if not connected', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })

      await expect(adapter.initializePrivacy()).rejects.toThrow()
    })
  })

  // ─── Key Access ─────────────────────────────────────────────────────────────

  describe('Key Access', () => {
    it('should return meta-address', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const metaAddress = adapter.getMetaAddress()

      expect(metaAddress).toBeDefined()
      expect(metaAddress.chain).toBe('solana')
      expect(metaAddress.spendingKey).toBeDefined()
      expect(metaAddress.viewingKey).toBeDefined()
    })

    it('should return viewing private key', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const viewingKey = adapter.getViewingPrivateKey()

      expect(viewingKey).toBeDefined()
      expect(viewingKey.startsWith('0x')).toBe(true)
    })

    it('should return spending private key', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const spendingKey = adapter.getSpendingPrivateKey()

      expect(spendingKey).toBeDefined()
      expect(spendingKey.startsWith('0x')).toBe(true)
    })

    it('should throw when accessing keys before initialization', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()

      expect(() => adapter.getMetaAddress()).toThrow('Privacy not initialized')
      expect(() => adapter.getViewingPrivateKey()).toThrow('Privacy not initialized')
      expect(() => adapter.getSpendingPrivateKey()).toThrow('Privacy not initialized')
    })
  })

  // ─── Stealth Address Generation ─────────────────────────────────────────────

  describe('generateStealthAddressFor', () => {
    it('should generate stealth address for recipient', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const recipientMeta = {
        chain: 'solana' as const,
        spendingKey: '0x' + 'ff'.repeat(32) as HexString,
        viewingKey: '0x' + 'ee'.repeat(32) as HexString,
      }

      const result = adapter.generateStealthAddressFor(recipientMeta)

      expect(result.stealthAddress).toBeDefined()
      expect(result.solanaAddress).toBeDefined()
      expect(result.sharedSecret).toBeDefined()
    })
  })

  // ─── Payment Scanning ───────────────────────────────────────────────────────

  describe('scanPayments', () => {
    it('should scan announcements and identify owned payments', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const announcements: StealthAddress[] = [
        {
          address: '0x' + 'aa'.repeat(32) as HexString,
          ephemeralPublicKey: '0x' + 'bb'.repeat(32) as HexString,
          viewTag: 42,
        },
        {
          address: '0x' + 'cc'.repeat(32) as HexString,
          ephemeralPublicKey: '0x' + 'dd'.repeat(32) as HexString,
          viewTag: 100,
        },
      ]

      const results = adapter.scanPayments(announcements)

      expect(results).toHaveLength(2)
      expect(results[0].stealthAddress).toBe('0x' + 'aa'.repeat(32))
      expect(results[0].isOwned).toBe(true) // Mocked to return true
    })

    it('should throw if privacy not initialized', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()

      const announcements: StealthAddress[] = []

      expect(() => adapter.scanPayments(announcements)).toThrow('Privacy not initialized')
    })
  })

  // ─── Claim Key Derivation ───────────────────────────────────────────────────

  describe('deriveClaimKey', () => {
    // Note: deriveClaimKey with real ed25519 keys is tested in integration tests
    // These unit tests verify error handling and require mocked crypto

    it('should throw if privacy not initialized', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()

      expect(() => adapter.deriveClaimKey('0x' + 'aa'.repeat(32) as HexString, 42))
        .toThrow('Privacy not initialized')
    })
  })

  // ─── Key Export/Import ──────────────────────────────────────────────────────

  describe('Key Export/Import', () => {
    it('should export stealth keys', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()
      await adapter.initializePrivacy()

      const exported = adapter.exportStealthKeys()

      expect(exported).toBeDefined()
      expect(exported!.metaAddress).toBeDefined()
      expect(exported!.spendingPrivateKey).toBeDefined()
      expect(exported!.viewingPrivateKey).toBeDefined()
    })

    it('should return undefined if not initialized', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()

      const exported = adapter.exportStealthKeys()

      expect(exported).toBeUndefined()
    })

    it('should import stealth keys', async () => {
      const adapter = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter.connect()

      const keys = {
        metaAddress: {
          chain: 'solana' as const,
          spendingKey: '0x' + 'aa'.repeat(32) as HexString,
          viewingKey: '0x' + 'bb'.repeat(32) as HexString,
        },
        spendingPrivateKey: '0x' + 'cc'.repeat(32) as HexString,
        viewingPrivateKey: '0x' + 'dd'.repeat(32) as HexString,
      }

      adapter.importStealthKeys(keys)

      expect(adapter.isPrivacyInitialized()).toBe(true)
      expect(adapter.getMetaAddress().spendingKey).toBe(keys.metaAddress.spendingKey)
    })
  })

  // ─── Integration ────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support send/receive workflow (mocked)', async () => {
      // Sender adapter
      const sender = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await sender.connect()
      await sender.initializePrivacy()

      // Receiver adapter
      const receiver = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await receiver.connect()
      await receiver.initializePrivacy()

      // 1. Receiver shares meta-address
      const receiverMeta = receiver.getMetaAddress()
      expect(receiverMeta.chain).toBe('solana')

      // 2. Sender generates stealth address
      const { stealthAddress, solanaAddress } = sender.generateStealthAddressFor(receiverMeta)

      expect(stealthAddress).toBeDefined()
      expect(solanaAddress).toBeDefined()
      expect(stealthAddress.viewTag).toBeDefined()

      // 3. Receiver scans for payments
      const payments = receiver.scanPayments([stealthAddress])
      expect(payments[0].isOwned).toBe(true) // Mocked to return true

      // Note: deriveClaimKey requires valid ed25519 keys and is tested
      // in e2e tests with real cryptography
    })

    it('should support key backup and restore', async () => {
      // Create and initialize adapter
      const adapter1 = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter1.connect()
      await adapter1.initializePrivacy()

      // Export keys
      const exported = adapter1.exportStealthKeys()!

      // Create new adapter and import keys
      const adapter2 = new PrivacySolanaWalletAdapter({
        provider: mockProvider,
      })
      await adapter2.connect()
      adapter2.importStealthKeys(exported)

      // Should have same meta-address
      expect(adapter2.getMetaAddress().spendingKey).toBe(adapter1.getMetaAddress().spendingKey)
      expect(adapter2.getMetaAddress().viewingKey).toBe(adapter1.getMetaAddress().viewingKey)
    })
  })
})
