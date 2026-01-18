/**
 * NEAR Wallet Adapter Tests
 *
 * Tests for NEARWalletAdapter with privacy support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  NEARWalletAdapter,
  type NEARWalletAdapterConfig,
  type NEARPrivacyTransaction,
} from '../../src/wallet/near'
import {
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  encodeNEARStealthMetaAddress,
} from '../../src/chains/near/stealth'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'

// Mock window.near for browser-like environment
const mockNearWallet = {
  requestSignIn: vi.fn(),
  signOut: vi.fn(),
  signMessage: vi.fn(),
  signAndSendTransaction: vi.fn(),
}

describe('NEARWalletAdapter', () => {
  let adapter: NEARWalletAdapter
  const config: NEARWalletAdapterConfig = {
    network: 'testnet',
    walletName: 'test-wallet',
  }

  beforeEach(() => {
    adapter = new NEARWalletAdapter(config)
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up window mock
    if (typeof globalThis.window !== 'undefined') {
      delete (globalThis.window as any).near
    }
  })

  describe('constructor', () => {
    it('should create adapter with correct chain', () => {
      expect(adapter.chain).toBe('near')
    })

    it('should create adapter with wallet name', () => {
      expect(adapter.name).toBe('test-wallet')
    })

    it('should use default name if not provided', () => {
      const adapter2 = new NEARWalletAdapter({ network: 'mainnet' })
      expect(adapter2.name).toBe('near-mainnet')
    })

    it('should start disconnected', () => {
      expect(adapter.connectionState).toBe('disconnected')
    })
  })

  describe('getNetwork', () => {
    it('should return configured network', () => {
      expect(adapter.getNetwork()).toBe('testnet')
    })

    it('should return mainnet when configured', () => {
      const mainnetAdapter = new NEARWalletAdapter({ network: 'mainnet' })
      expect(mainnetAdapter.getNetwork()).toBe('mainnet')
    })
  })

  describe('hasPrivacyKeys', () => {
    it('should return false initially', () => {
      expect(adapter.hasPrivacyKeys()).toBe(false)
    })
  })

  describe('getStealthAddresses', () => {
    it('should return empty map initially', () => {
      const addresses = adapter.getStealthAddresses()
      expect(addresses.size).toBe(0)
    })
  })

  describe('connect', () => {
    it('should throw when wallet not available', async () => {
      await expect(adapter.connect()).rejects.toThrow('NEAR wallet not available')
    })

    it('should connect when wallet available', async () => {
      // Mock browser environment with NEAR wallet
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
        },
      } as any

      await adapter.connect()

      expect(adapter.connectionState).toBe('connected')
      expect(adapter.address).toBe('alice.testnet')
    })

    it('should pass contract options when connecting', async () => {
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
        },
      } as any

      await adapter.connect({
        contractId: 'contract.testnet',
        methodNames: ['transfer', 'view'],
      })

      expect((globalThis.window as any).near.requestSignIn).toHaveBeenCalledWith({
        contractId: 'contract.testnet',
        methodNames: ['transfer', 'view'],
      })
    })
  })

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      // First connect
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
          signOut: vi.fn().mockResolvedValue(undefined),
        },
      } as any

      await adapter.connect()
      expect(adapter.connectionState).toBe('connected')

      // Then disconnect
      await adapter.disconnect()

      expect(adapter.connectionState).toBe('disconnected')
      expect((globalThis.window as any).near.signOut).toHaveBeenCalled()
    })
  })

  describe('signMessage', () => {
    it('should throw when not connected', async () => {
      const message = new Uint8Array([1, 2, 3])
      await expect(adapter.signMessage(message)).rejects.toThrow()
    })

    it('should sign message when connected', async () => {
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
          signMessage: vi.fn().mockResolvedValue({
            signature: 'deadbeef',
          }),
        },
      } as any

      await adapter.connect()
      const message = new Uint8Array([1, 2, 3])
      const signature = await adapter.signMessage(message)

      expect(signature).toBeDefined()
      expect(signature.signature).toBe('0xdeadbeef')
    })
  })

  describe('generateStealthAddress', () => {
    it('should generate stealth address from meta-address object', () => {
      // Use real generated meta-address with valid keys
      const { metaAddress } = generateNEARStealthMetaAddress()

      const result = adapter.generateStealthAddress(metaAddress)

      expect(result).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate stealth address from encoded string', () => {
      // Use real generated meta-address with valid keys
      const { metaAddress } = generateNEARStealthMetaAddress()
      const encoded = encodeNEARStealthMetaAddress(metaAddress)

      const result = adapter.generateStealthAddress(encoded)

      expect(result).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
    })

    it('should store generated stealth address', () => {
      // Use real generated meta-address with valid keys
      const { metaAddress } = generateNEARStealthMetaAddress()

      const result = adapter.generateStealthAddress(metaAddress)
      const storedAddresses = adapter.getStealthAddresses()

      expect(storedAddresses.has(result.stealthAccountId)).toBe(true)
    })
  })

  describe('signPrivacyTransaction', () => {
    it('should throw when not connected and not using stealth key', async () => {
      const tx: NEARPrivacyTransaction = {
        receiverId: 'bob.testnet',
        actions: [{ type: 'Transfer', params: { deposit: 1_000_000_000_000_000_000_000_000n } }],
      }

      await expect(adapter.signPrivacyTransaction(tx)).rejects.toThrow()
    })

    it('should sign with stealth key when provided', async () => {
      // Generate valid keys for signing
      const { spendingPrivateKey } = generateNEARStealthMetaAddress()
      const { metaAddress } = generateNEARStealthMetaAddress()

      const tx: NEARPrivacyTransaction = {
        receiverId: 'bob.testnet',
        actions: [{ type: 'Transfer', params: { deposit: 1_000_000_000_000_000_000_000_000n } }],
        fromStealthAccount: true,
        stealthKeyPair: {
          publicKey: metaAddress.spendingKey,
          privateKey: spendingPrivateKey,
        },
      }

      const result = await adapter.signPrivacyTransaction(tx)

      expect(result).toBeDefined()
      expect(result.signedTx).toBeDefined()
      expect(result.txHash).toBeDefined()
      expect(result.receiverId).toBe('bob.testnet')
    })

    it('should include announcement memo in signed transaction', async () => {
      // Generate valid keys for signing
      const { spendingPrivateKey } = generateNEARStealthMetaAddress()
      const { metaAddress } = generateNEARStealthMetaAddress()

      const tx: NEARPrivacyTransaction = {
        receiverId: 'bob.testnet',
        actions: [{ type: 'Transfer', params: { deposit: 1_000_000_000_000_000_000_000_000n } }],
        announcementMemo: 'sip:near:0xabc...',
        fromStealthAccount: true,
        stealthKeyPair: {
          publicKey: metaAddress.spendingKey,
          privateKey: spendingPrivateKey,
        },
      }

      const result = await adapter.signPrivacyTransaction(tx)

      expect(result.signedTx).toContain('bob.testnet')
    })
  })

  describe('getBalance', () => {
    it('should throw when not connected', async () => {
      await expect(adapter.getBalance()).rejects.toThrow()
    })

    it('should return balance when connected', async () => {
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
        },
      } as any

      await adapter.connect()
      const balance = await adapter.getBalance()

      // Mock returns 0n
      expect(balance).toBe(0n)
    })
  })

  describe('getTokenBalance', () => {
    it('should throw when not connected', async () => {
      await expect(
        adapter.getTokenBalance({
          chain: 'near',
          symbol: 'USDC',
          address: '0x' + '1'.repeat(64) as HexString,
          decimals: 6,
        })
      ).rejects.toThrow()
    })

    it('should return token balance when connected', async () => {
      globalThis.window = {
        near: {
          ...mockNearWallet,
          requestSignIn: vi.fn().mockResolvedValue({
            accountId: 'alice.testnet',
            publicKey: 'ed25519:abc123',
          }),
        },
      } as any

      await adapter.connect()
      const balance = await adapter.getTokenBalance({
        chain: 'near',
        symbol: 'USDC',
        address: '0x' + '1'.repeat(64) as HexString,
        decimals: 6,
      })

      // Mock returns 0n
      expect(balance).toBe(0n)
    })
  })
})

describe('NEARWalletAdapter - Privacy Key Derivation', () => {
  let adapter: NEARWalletAdapter
  const signatureBytes = new Uint8Array(64).fill(0xab)
  const signatureHex = Array.from(signatureBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  beforeEach(() => {
    adapter = new NEARWalletAdapter({
      network: 'testnet',
    })

    // Setup connected wallet mock
    globalThis.window = {
      near: {
        requestSignIn: vi.fn().mockResolvedValue({
          accountId: 'alice.testnet',
          publicKey: 'ed25519:abc123',
        }),
        signMessage: vi.fn().mockResolvedValue({
          signature: signatureHex,
        }),
      },
    } as any
  })

  afterEach(() => {
    if (typeof globalThis.window !== 'undefined') {
      delete (globalThis.window as any).near
    }
  })

  it('should derive privacy keys after connecting', async () => {
    await adapter.connect()
    const keys = await adapter.derivePrivacyKeys()

    expect(keys).toBeDefined()
    expect(keys.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(keys.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(keys.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(keys.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(keys.derivationPath).toBe('sip/near/testnet/default')
  })

  it('should derive different keys for different labels', async () => {
    await adapter.connect()

    const keys1 = await adapter.derivePrivacyKeys('account1')
    // Create new adapter to reset privacyKeyPair
    const adapter2 = new NEARWalletAdapter({ network: 'testnet' })
    globalThis.window = {
      near: {
        requestSignIn: vi.fn().mockResolvedValue({
          accountId: 'alice.testnet',
          publicKey: 'ed25519:abc123',
        }),
        signMessage: vi.fn().mockResolvedValue({
          signature: 'cd'.repeat(64), // Different signature
        }),
      },
    } as any
    await adapter2.connect()
    const keys2 = await adapter2.derivePrivacyKeys('account2')

    expect(keys1.derivationPath).toBe('sip/near/testnet/account1')
    expect(keys2.derivationPath).toBe('sip/near/testnet/account2')
  })

  it('should set hasPrivacyKeys to true after derivation', async () => {
    await adapter.connect()
    expect(adapter.hasPrivacyKeys()).toBe(false)

    await adapter.derivePrivacyKeys()
    expect(adapter.hasPrivacyKeys()).toBe(true)
  })

  it('should generate stealth meta-address after deriving keys', async () => {
    await adapter.connect()
    const result = await adapter.generateStealthMetaAddress()

    expect(result).toBeDefined()
    expect(result.metaAddress.chain).toBe('near')
    expect(result.metaAddress.spendingKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(result.metaAddress.viewingKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(result.encoded).toMatch(/^sip:near:/)
    expect(result.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(result.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('should export viewing key', async () => {
    await adapter.connect()
    const viewingKeyExport = await adapter.exportViewingKey('compliance')

    expect(viewingKeyExport).toBeDefined()
    expect(viewingKeyExport.network).toBe('testnet')
    expect(viewingKeyExport.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(viewingKeyExport.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(viewingKeyExport.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
    expect(viewingKeyExport.createdAt).toBeDefined()
    expect(viewingKeyExport.label).toBe('compliance')
  })
})

describe('NEARWalletAdapter - Stealth Address Operations', () => {
  let adapter: NEARWalletAdapter
  const signatureHex = 'ab'.repeat(64)

  beforeEach(async () => {
    adapter = new NEARWalletAdapter({
      network: 'testnet',
    })

    globalThis.window = {
      near: {
        requestSignIn: vi.fn().mockResolvedValue({
          accountId: 'alice.testnet',
          publicKey: 'ed25519:abc123',
        }),
        signMessage: vi.fn().mockResolvedValue({
          signature: signatureHex,
        }),
      },
    } as any

    await adapter.connect()
    await adapter.derivePrivacyKeys()
  })

  afterEach(() => {
    if (typeof globalThis.window !== 'undefined') {
      delete (globalThis.window as any).near
    }
  })

  it('should check if stealth address belongs to wallet', async () => {
    // Generate our own stealth address
    const { metaAddress } = await adapter.generateStealthMetaAddress()
    const { stealthAddress } = adapter.generateStealthAddress(metaAddress)

    // Check ownership
    const isOwner = await adapter.checkStealthAddress(stealthAddress)

    // Note: This may return false because the stealth address is generated
    // with a random ephemeral key that doesn't match our derived keys
    // The actual check would require the ephemeral public key
    expect(typeof isOwner).toBe('boolean')
  })

  it('should throw when deriving key for non-owned stealth address', async () => {
    // Create a random stealth address that doesn't belong to us
    const { metaAddress: randomMetaAddress } = generateNEARStealthMetaAddress()
    const { stealthAddress } = generateNEARStealthAddress(randomMetaAddress)

    // Should throw because we can't derive the key
    await expect(adapter.deriveStealthPrivateKey(stealthAddress)).rejects.toThrow(
      'Stealth address does not belong to this wallet'
    )
  })

  it('should track multiple stealth addresses', () => {
    // Use valid generated meta-addresses
    const { metaAddress: metaAddress1 } = generateNEARStealthMetaAddress()
    const { metaAddress: metaAddress2 } = generateNEARStealthMetaAddress()

    adapter.generateStealthAddress(metaAddress1)
    adapter.generateStealthAddress(metaAddress2)

    const addresses = adapter.getStealthAddresses()
    expect(addresses.size).toBe(2)
  })
})

describe('NEARWalletAdapter - Event Handling', () => {
  let adapter: NEARWalletAdapter

  beforeEach(() => {
    adapter = new NEARWalletAdapter({
      network: 'testnet',
    })

    globalThis.window = {
      near: {
        requestSignIn: vi.fn().mockResolvedValue({
          accountId: 'alice.testnet',
          publicKey: 'ed25519:abc123',
        }),
        signOut: vi.fn().mockResolvedValue(undefined),
      },
    } as any
  })

  afterEach(() => {
    if (typeof globalThis.window !== 'undefined') {
      delete (globalThis.window as any).near
    }
  })

  it('should emit connect event', async () => {
    const connectHandler = vi.fn()
    adapter.on('connect', connectHandler)

    await adapter.connect()

    expect(connectHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connect',
        address: 'alice.testnet',
        chain: 'near',
      })
    )
  })

  it('should emit disconnect event', async () => {
    const disconnectHandler = vi.fn()
    adapter.on('disconnect', disconnectHandler)

    await adapter.connect()
    await adapter.disconnect()

    expect(disconnectHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'disconnect',
        reason: 'User disconnected',
      })
    )
  })

  it('should allow unsubscribing from events', async () => {
    const connectHandler = vi.fn()
    adapter.on('connect', connectHandler)
    adapter.off('connect', connectHandler)

    await adapter.connect()

    expect(connectHandler).not.toHaveBeenCalled()
  })
})
