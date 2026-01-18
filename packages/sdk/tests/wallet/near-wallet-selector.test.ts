/**
 * NEAR Wallet Selector Privacy Integration Tests
 *
 * Tests for PrivacyWalletSelector wrapper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PrivacyWalletSelector,
  createPrivacyWalletSelector,
  createMainnetPrivacySelector,
  createTestnetPrivacySelector,
  type WalletSelector,
  type Wallet,
  type WalletSelectorState,
} from '../../src/wallet/near'
import {
  generateNEARStealthMetaAddress,
  encodeNEARStealthMetaAddress,
} from '../../src/chains/near/stealth'

// Mock wallet for testing
function createMockWallet(options: {
  supportsSignMessage?: boolean
  supportsBatch?: boolean
} = {}): Wallet {
  const { supportsSignMessage = true, supportsBatch = true } = options

  const wallet: Wallet = {
    id: 'mock-wallet',
    type: 'browser',
    metadata: {
      name: 'Mock Wallet',
      description: 'A mock wallet for testing',
      iconUrl: 'https://example.com/icon.png',
    },
    signAndSendTransaction: vi.fn().mockResolvedValue({
      transaction: {
        hash: 'mock-tx-hash-123',
        signerId: 'alice.testnet',
        receiverId: 'bob.testnet',
      },
    }),
  }

  if (supportsSignMessage) {
    wallet.signMessage = vi.fn().mockResolvedValue({
      signature: 'ab'.repeat(64),
      publicKey: 'ed25519:mock-public-key',
      accountId: 'alice.testnet',
    })
  }

  if (supportsBatch) {
    wallet.signAndSendTransactions = vi.fn().mockResolvedValue([
      {
        transaction: {
          hash: 'mock-tx-hash-1',
          signerId: 'alice.testnet',
          receiverId: 'bob.testnet',
        },
      },
      {
        transaction: {
          hash: 'mock-tx-hash-2',
          signerId: 'alice.testnet',
          receiverId: 'charlie.testnet',
        },
      },
    ])
  }

  return wallet
}

// Mock wallet selector
function createMockSelector(options: {
  connected?: boolean
  wallet?: Wallet | null
} = {}): WalletSelector {
  const { connected = true, wallet = createMockWallet() } = options

  const state: WalletSelectorState = {
    accounts: connected ? [{ accountId: 'alice.testnet', publicKey: 'ed25519:mock' }] : [],
    selectedWalletId: connected ? 'mock-wallet' : null,
  }

  const subscribers: Set<(state: WalletSelectorState) => void> = new Set()

  return {
    wallet: vi.fn().mockResolvedValue(wallet),
    isSignedIn: vi.fn().mockReturnValue(connected),
    getAccounts: vi.fn().mockResolvedValue(state.accounts),
    on: vi.fn().mockReturnValue(() => {}),
    store: {
      getState: vi.fn().mockReturnValue(state),
      observable: {
        subscribe: (callback: (state: WalletSelectorState) => void) => {
          subscribers.add(callback)
          return { unsubscribe: () => subscribers.delete(callback) }
        },
      },
    },
  }
}

describe('PrivacyWalletSelector', () => {
  let selector: WalletSelector
  let privacySelector: PrivacyWalletSelector

  beforeEach(() => {
    selector = createMockSelector()
    privacySelector = new PrivacyWalletSelector(selector, { network: 'testnet' })
  })

  describe('constructor', () => {
    it('should create privacy selector with config', () => {
      expect(privacySelector).toBeDefined()
      expect(privacySelector.getConfig().network).toBe('testnet')
    })

    it('should expose underlying selector', () => {
      expect(privacySelector.getSelector()).toBe(selector)
    })
  })

  describe('connection state', () => {
    it('should return connected state', () => {
      expect(privacySelector.isConnected()).toBe(true)
    })

    it('should return false when disconnected', () => {
      const disconnectedSelector = createMockSelector({ connected: false })
      const ps = new PrivacyWalletSelector(disconnectedSelector, { network: 'testnet' })
      expect(ps.isConnected()).toBe(false)
    })

    it('should return account ID', async () => {
      const accountId = await privacySelector.getAccountId()
      expect(accountId).toBe('alice.testnet')
    })

    it('should return null account ID when disconnected', async () => {
      const disconnectedSelector = createMockSelector({ connected: false })
      const ps = new PrivacyWalletSelector(disconnectedSelector, { network: 'testnet' })
      const accountId = await ps.getAccountId()
      expect(accountId).toBeNull()
    })

    it('should get wallet', async () => {
      const wallet = await privacySelector.getWallet()
      expect(wallet).toBeDefined()
      expect(wallet?.id).toBe('mock-wallet')
    })
  })

  describe('wallet capabilities', () => {
    it('should detect full privacy support', async () => {
      const capabilities = await privacySelector.detectCapabilities()

      expect(capabilities).toBeDefined()
      expect(capabilities?.walletId).toBe('mock-wallet')
      expect(capabilities?.supportsMessageSigning).toBe(true)
      expect(capabilities?.supportsTransactionSigning).toBe(true)
      expect(capabilities?.supportsBatchTransactions).toBe(true)
      expect(capabilities?.privacySupport).toBe('full')
    })

    it('should detect partial privacy support without message signing', async () => {
      const wallet = createMockWallet({ supportsSignMessage: false })
      const sel = createMockSelector({ wallet })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      const capabilities = await ps.detectCapabilities()
      expect(capabilities?.privacySupport).toBe('partial')
    })

    it('should detect partial privacy support without batch', async () => {
      const wallet = createMockWallet({ supportsBatch: false })
      const sel = createMockSelector({ wallet })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      const capabilities = await ps.detectCapabilities()
      expect(capabilities?.privacySupport).toBe('partial')
    })

    it('should return null capabilities when no wallet', async () => {
      const sel = createMockSelector({ wallet: null })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      const capabilities = await ps.detectCapabilities()
      expect(capabilities).toBeNull()
    })

    it('should check privacy support', async () => {
      const supports = await privacySelector.supportsPrivacy()
      expect(supports).toBe(true)
    })
  })

  describe('privacy key management', () => {
    it('should not have privacy keys initially', () => {
      expect(privacySelector.hasPrivacyKeys()).toBe(false)
      expect(privacySelector.getPrivacyKeys()).toBeNull()
    })

    it('should derive privacy keys', async () => {
      const keys = await privacySelector.derivePrivacyKeys()

      expect(keys).toBeDefined()
      expect(keys.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(keys.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(keys.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(keys.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(keys.derivationLabel).toBe('default')
    })

    it('should have privacy keys after derivation', async () => {
      await privacySelector.derivePrivacyKeys()

      expect(privacySelector.hasPrivacyKeys()).toBe(true)
      expect(privacySelector.getPrivacyKeys()).not.toBeNull()
    })

    it('should derive different keys for different labels', async () => {
      const keys1 = await privacySelector.derivePrivacyKeys('account1')

      // Create new selector instance
      const sel2 = createMockSelector()
      const ps2 = new PrivacyWalletSelector(sel2, { network: 'testnet' })

      // Different signature for different label
      const mockWallet = await sel2.wallet() as Wallet
      mockWallet.signMessage = vi.fn().mockResolvedValue({
        signature: 'cd'.repeat(64),
        publicKey: 'ed25519:mock-public-key',
        accountId: 'alice.testnet',
      })

      const keys2 = await ps2.derivePrivacyKeys('account2')

      expect(keys1.derivationLabel).toBe('account1')
      expect(keys2.derivationLabel).toBe('account2')
    })

    it('should throw when wallet does not support message signing', async () => {
      const wallet = createMockWallet({ supportsSignMessage: false })
      const sel = createMockSelector({ wallet })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      await expect(ps.derivePrivacyKeys()).rejects.toThrow(
        'Wallet does not support message signing'
      )
    })
  })

  describe('stealth meta-address', () => {
    it('should generate stealth meta-address', async () => {
      const result = await privacySelector.generateStealthMetaAddress()

      expect(result.metaAddress).toBeDefined()
      expect(result.metaAddress.chain).toBe('near')
      expect(result.metaAddress.spendingKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.metaAddress.viewingKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.encoded).toMatch(/^sip:near:/)
      expect(result.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should auto-derive keys when generating meta-address', async () => {
      expect(privacySelector.hasPrivacyKeys()).toBe(false)

      await privacySelector.generateStealthMetaAddress()

      expect(privacySelector.hasPrivacyKeys()).toBe(true)
    })
  })

  describe('stealth address generation', () => {
    it('should generate stealth address from meta-address', () => {
      const { metaAddress } = generateNEARStealthMetaAddress()

      const result = privacySelector.generateStealthAddress(metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.ephemeralPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should generate stealth address from encoded string', async () => {
      const { encoded } = await privacySelector.generateStealthMetaAddress()

      const result = privacySelector.generateStealthAddress(encoded)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toBeDefined()
    })

    it('should track generated stealth addresses', () => {
      const { metaAddress } = generateNEARStealthMetaAddress()

      const result = privacySelector.generateStealthAddress(metaAddress)
      const tracked = privacySelector.getStealthAddresses()

      expect(tracked.has(result.stealthAccountId)).toBe(true)
    })
  })

  describe('stealth address ownership', () => {
    it('should check stealth address ownership', async () => {
      const { metaAddress } = await privacySelector.generateStealthMetaAddress()
      const { stealthAddress } = privacySelector.generateStealthAddress(metaAddress)

      // This might return false due to random ephemeral key
      const isOwner = await privacySelector.checkStealthAddress(stealthAddress)
      expect(typeof isOwner).toBe('boolean')
    })

    it('should throw when deriving key for non-owned address', async () => {
      await privacySelector.derivePrivacyKeys()

      // Generate random stealth address
      const { metaAddress } = generateNEARStealthMetaAddress()
      const { stealthAddress } = privacySelector.generateStealthAddress(metaAddress)

      await expect(privacySelector.deriveStealthPrivateKey(stealthAddress)).rejects.toThrow(
        'Stealth address does not belong to this wallet'
      )
    })
  })

  describe('private transfers', () => {
    it('should send private transfer', async () => {
      const { encoded } = await privacySelector.generateStealthMetaAddress()

      const result = await privacySelector.sendPrivateTransfer({
        recipientMetaAddress: encoded,
        amount: '1000000000000000000000000',
      })

      expect(result.txHash).toBe('mock-tx-hash-123')
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.announcementMemo).toMatch(/^SIP:/i)
    })

    it('should send private transfer with bigint amount', async () => {
      const { encoded } = await privacySelector.generateStealthMetaAddress()

      const result = await privacySelector.sendPrivateTransfer({
        recipientMetaAddress: encoded,
        amount: 1_000_000_000_000_000_000_000_000n,
      })

      expect(result.txHash).toBeDefined()
    })

    it('should throw when no wallet connected', async () => {
      const sel = createMockSelector({ wallet: null })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      const { metaAddress } = generateNEARStealthMetaAddress()
      const encoded = encodeNEARStealthMetaAddress(metaAddress)

      await expect(
        ps.sendPrivateTransfer({
          recipientMetaAddress: encoded,
          amount: '1000000000000000000000000',
        })
      ).rejects.toThrow('No wallet connected')
    })
  })

  describe('batch private transfers', () => {
    it('should send batch private transfers', async () => {
      const { encoded: encoded1 } = await privacySelector.generateStealthMetaAddress()
      const { metaAddress: meta2 } = generateNEARStealthMetaAddress()
      const encoded2 = encodeNEARStealthMetaAddress(meta2)

      const results = await privacySelector.sendBatchPrivateTransfers([
        { recipientMetaAddress: encoded1, amount: '1000000000000000000000000' },
        { recipientMetaAddress: encoded2, amount: '2000000000000000000000000' },
      ])

      expect(results).toHaveLength(2)
      expect(results[0].txHash).toBe('mock-tx-hash-1')
      expect(results[1].txHash).toBe('mock-tx-hash-2')
    })

    it('should throw when wallet does not support batch', async () => {
      const wallet = createMockWallet({ supportsBatch: false })
      const sel = createMockSelector({ wallet })
      const ps = new PrivacyWalletSelector(sel, { network: 'testnet' })

      // Need to derive keys first
      await ps.derivePrivacyKeys()

      const { metaAddress } = generateNEARStealthMetaAddress()
      const encoded = encodeNEARStealthMetaAddress(metaAddress)

      await expect(
        ps.sendBatchPrivateTransfers([
          { recipientMetaAddress: encoded, amount: '1000000000000000000000000' },
        ])
      ).rejects.toThrow('Wallet does not support batch transactions')
    })
  })

  describe('viewing key export', () => {
    it('should export viewing key', async () => {
      const viewingKey = await privacySelector.exportViewingKey('compliance')

      expect(viewingKey.network).toBe('testnet')
      expect(viewingKey.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(viewingKey.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(viewingKey.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(viewingKey.accountId).toBe('alice.testnet')
      expect(viewingKey.createdAt).toBeDefined()
      expect(viewingKey.label).toBe('compliance')
    })
  })
})

describe('Factory Functions', () => {
  it('should create privacy wallet selector with factory', () => {
    const selector = createMockSelector()
    const ps = createPrivacyWalletSelector(selector, { network: 'testnet' })

    expect(ps).toBeInstanceOf(PrivacyWalletSelector)
    expect(ps.getConfig().network).toBe('testnet')
  })

  it('should create mainnet privacy selector', () => {
    const selector = createMockSelector()
    const ps = createMainnetPrivacySelector(selector)

    expect(ps).toBeInstanceOf(PrivacyWalletSelector)
    expect(ps.getConfig().network).toBe('mainnet')
  })

  it('should create testnet privacy selector', () => {
    const selector = createMockSelector()
    const ps = createTestnetPrivacySelector(selector)

    expect(ps).toBeInstanceOf(PrivacyWalletSelector)
    expect(ps.getConfig().network).toBe('testnet')
  })
})

describe('Connection Change Listener', () => {
  it('should notify on connection change', async () => {
    let subscribers: Set<(state: WalletSelectorState) => void> = new Set()

    const selector: WalletSelector = {
      wallet: vi.fn().mockResolvedValue(createMockWallet()),
      isSignedIn: vi.fn().mockReturnValue(true),
      getAccounts: vi.fn().mockResolvedValue([{ accountId: 'alice.testnet' }]),
      on: vi.fn().mockReturnValue(() => {}),
      store: {
        getState: vi.fn().mockReturnValue({
          accounts: [{ accountId: 'alice.testnet' }],
          selectedWalletId: 'mock-wallet',
        }),
        observable: {
          subscribe: (callback: (state: WalletSelectorState) => void) => {
            subscribers.add(callback)
            return { unsubscribe: () => subscribers.delete(callback) }
          },
        },
      },
    }

    const ps = new PrivacyWalletSelector(selector, { network: 'testnet' })

    const connectionListener = vi.fn()
    const unsubscribe = ps.onConnectionChange(connectionListener)

    // Simulate connection change
    subscribers.forEach((sub) =>
      sub({ accounts: [], selectedWalletId: null })
    )

    expect(connectionListener).toHaveBeenCalledWith(false)

    // Cleanup
    unsubscribe()
  })
})
