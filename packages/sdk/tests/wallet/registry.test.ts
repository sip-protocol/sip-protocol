/**
 * Tests for Wallet Registry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  walletRegistry,
  MockWalletAdapter,
  isPrivateWalletAdapter,
} from '../../src/wallet'
import type { WalletRegistryEntry, WalletInfo } from '@sip-protocol/types'

describe('WalletRegistry', () => {
  // Save initial state and restore after each test
  beforeEach(() => {
    walletRegistry.clear()
  })

  afterEach(() => {
    walletRegistry.clear()
  })

  const createMockEntry = (
    id: string,
    chains: ('solana' | 'ethereum' | 'near')[] = ['solana'],
    detected: boolean = true,
    supportsPrivacy: boolean = false
  ): WalletRegistryEntry => ({
    info: {
      id,
      name: `${id.charAt(0).toUpperCase()}${id.slice(1)} Wallet`,
      chains,
      supportsPrivacy,
    },
    factory: () =>
      new MockWalletAdapter({
        chain: chains[0],
        address: `${id}-address`,
      }),
    detect: () => detected,
  })

  describe('registration', () => {
    it('should register a wallet', () => {
      const entry = createMockEntry('phantom')
      walletRegistry.register(entry)

      expect(walletRegistry.getInfo('phantom')).toEqual(entry.info)
    })

    it('should unregister a wallet', () => {
      const entry = createMockEntry('phantom')
      walletRegistry.register(entry)
      expect(walletRegistry.getInfo('phantom')).toBeDefined()

      walletRegistry.unregister('phantom')
      expect(walletRegistry.getInfo('phantom')).toBeUndefined()
    })

    it('should overwrite existing registration', () => {
      const entry1 = createMockEntry('phantom')
      const entry2 = createMockEntry('phantom')
      entry2.info.name = 'Updated Phantom'

      walletRegistry.register(entry1)
      walletRegistry.register(entry2)

      expect(walletRegistry.getInfo('phantom')?.name).toBe('Updated Phantom')
    })
  })

  describe('getAllWallets', () => {
    it('should return all registered wallets', () => {
      walletRegistry.register(createMockEntry('phantom', ['solana']))
      walletRegistry.register(createMockEntry('metamask', ['ethereum']))
      walletRegistry.register(createMockEntry('near-wallet', ['near']))

      const wallets = walletRegistry.getAllWallets()
      expect(wallets).toHaveLength(3)
      expect(wallets.map((w) => w.id)).toEqual(
        expect.arrayContaining(['phantom', 'metamask', 'near-wallet'])
      )
    })

    it('should return empty array when no wallets registered', () => {
      expect(walletRegistry.getAllWallets()).toEqual([])
    })
  })

  describe('getWalletsForChain', () => {
    beforeEach(() => {
      walletRegistry.register(createMockEntry('phantom', ['solana']))
      walletRegistry.register(createMockEntry('metamask', ['ethereum']))
      walletRegistry.register(createMockEntry('multi', ['solana', 'ethereum']))
    })

    it('should return wallets for solana', () => {
      const wallets = walletRegistry.getWalletsForChain('solana')
      expect(wallets).toHaveLength(2)
      expect(wallets.map((w) => w.id)).toEqual(
        expect.arrayContaining(['phantom', 'multi'])
      )
    })

    it('should return wallets for ethereum', () => {
      const wallets = walletRegistry.getWalletsForChain('ethereum')
      expect(wallets).toHaveLength(2)
      expect(wallets.map((w) => w.id)).toEqual(
        expect.arrayContaining(['metamask', 'multi'])
      )
    })

    it('should return empty array for unsupported chain', () => {
      const wallets = walletRegistry.getWalletsForChain('zcash')
      expect(wallets).toEqual([])
    })
  })

  describe('getAvailableWallets', () => {
    beforeEach(() => {
      walletRegistry.register(createMockEntry('detected', ['solana'], true))
      walletRegistry.register(createMockEntry('not-detected', ['solana'], false))
      walletRegistry.register(createMockEntry('eth-wallet', ['ethereum'], true))
    })

    it('should return only detected wallets', () => {
      const wallets = walletRegistry.getAvailableWallets()
      expect(wallets).toHaveLength(2)
      expect(wallets.map((w) => w.id)).toEqual(
        expect.arrayContaining(['detected', 'eth-wallet'])
      )
    })

    it('should filter by chain', () => {
      const wallets = walletRegistry.getAvailableWallets('solana')
      expect(wallets).toHaveLength(1)
      expect(wallets[0].id).toBe('detected')
    })

    it('should return empty if no detected wallets', () => {
      walletRegistry.clear()
      walletRegistry.register(createMockEntry('phantom', ['solana'], false))

      const wallets = walletRegistry.getAvailableWallets()
      expect(wallets).toEqual([])
    })
  })

  describe('getPrivacyWallets', () => {
    beforeEach(() => {
      walletRegistry.register(createMockEntry('basic', ['solana'], true, false))
      walletRegistry.register(createMockEntry('private', ['solana'], true, true))
      walletRegistry.register(createMockEntry('eth-private', ['ethereum'], true, true))
    })

    it('should return only privacy-supporting wallets', () => {
      const wallets = walletRegistry.getPrivacyWallets()
      expect(wallets).toHaveLength(2)
      expect(wallets.map((w) => w.id)).toEqual(
        expect.arrayContaining(['private', 'eth-private'])
      )
    })

    it('should filter by chain', () => {
      const wallets = walletRegistry.getPrivacyWallets('solana')
      expect(wallets).toHaveLength(1)
      expect(wallets[0].id).toBe('private')
    })
  })

  describe('isAvailable', () => {
    it('should return true for detected wallet', () => {
      walletRegistry.register(createMockEntry('phantom', ['solana'], true))
      expect(walletRegistry.isAvailable('phantom')).toBe(true)
    })

    it('should return false for non-detected wallet', () => {
      walletRegistry.register(createMockEntry('phantom', ['solana'], false))
      expect(walletRegistry.isAvailable('phantom')).toBe(false)
    })

    it('should return false for unregistered wallet', () => {
      expect(walletRegistry.isAvailable('nonexistent')).toBe(false)
    })
  })

  describe('create', () => {
    it('should create a wallet adapter', () => {
      walletRegistry.register(createMockEntry('phantom', ['solana']))

      const adapter = walletRegistry.create('phantom')
      expect(adapter).toBeInstanceOf(MockWalletAdapter)
      expect(adapter.chain).toBe('solana')
    })

    it('should throw for unregistered wallet', () => {
      expect(() => walletRegistry.create('nonexistent')).toThrow(
        "Wallet 'nonexistent' is not registered"
      )
    })
  })

  describe('connect', () => {
    it('should create and connect wallet adapter', async () => {
      walletRegistry.register(createMockEntry('phantom', ['solana']))

      const adapter = await walletRegistry.connect('phantom')
      expect(adapter.isConnected()).toBe(true)
    })

    it('should throw for unregistered wallet', async () => {
      await expect(walletRegistry.connect('nonexistent')).rejects.toThrow(
        "Wallet 'nonexistent' is not registered"
      )
    })
  })

  describe('clear', () => {
    it('should remove all registered wallets', () => {
      walletRegistry.register(createMockEntry('phantom', ['solana']))
      walletRegistry.register(createMockEntry('metamask', ['ethereum']))
      expect(walletRegistry.getAllWallets()).toHaveLength(2)

      walletRegistry.clear()
      expect(walletRegistry.getAllWallets()).toHaveLength(0)
    })
  })
})

describe('isPrivateWalletAdapter', () => {
  it('should return false for basic adapter', () => {
    const adapter = new MockWalletAdapter({ chain: 'solana' })
    expect(isPrivateWalletAdapter(adapter)).toBe(false)
  })

  it('should return true for adapter with stealth support', () => {
    // Create a mock that looks like a PrivateWalletAdapter
    const privateAdapter = {
      ...new MockWalletAdapter({ chain: 'solana' }),
      supportsStealthAddresses: () => true,
      getStealthMetaAddress: () => ({
        spendingKey: '0x01' as `0x${string}`,
        viewingKey: '0x02' as `0x${string}`,
        chain: 'solana' as const,
      }),
    }

    expect(isPrivateWalletAdapter(privateAdapter as unknown as PrivateWalletAdapter)).toBe(true)
  })
})
