/**
 * Multi-Wallet Privacy Adapter Tests
 *
 * Tests for Rabby, Rainbow, and other wallet detection and integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MultiWalletPrivacyAdapter,
  createMultiWalletAdapter,
  createRabbyPrivacyAdapter,
  createRainbowPrivacyAdapter,
  detectWallets,
  isWalletInstalled,
  getWalletProvider,
  type DetectedWallet,
  type EIP1193Provider,
  type WalletType,
} from '../../src/wallet/ethereum/multi-wallet'

// Mock EIP-1193 provider
function createMockProvider(flags: Partial<EIP1193Provider> = {}): EIP1193Provider {
  return {
    request: vi.fn().mockImplementation(async ({ method }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return ['0x1234567890abcdef1234567890abcdef12345678']
        case 'eth_chainId':
          return '0x1'
        default:
          return null
      }
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
    ...flags,
  }
}

describe('Multi-Wallet Privacy Adapter', () => {
  let originalWindow: Window & typeof globalThis
  let mockEthereum: EIP1193Provider

  beforeEach(() => {
    originalWindow = global.window
    mockEthereum = createMockProvider({ isMetaMask: true })

    // Mock window.ethereum
    global.window = {
      ethereum: mockEthereum,
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    global.window = originalWindow
    vi.clearAllMocks()
  })

  describe('detectWallets', () => {
    it('detects single MetaMask wallet', () => {
      const wallets = detectWallets()

      expect(wallets).toHaveLength(1)
      expect(wallets[0].type).toBe('metamask')
      expect(wallets[0].name).toBe('MetaMask')
      expect(wallets[0].isDefault).toBe(true)
    })

    it('detects Rabby wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isRabby: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets).toHaveLength(1)
      expect(wallets[0].type).toBe('rabby')
      expect(wallets[0].name).toBe('Rabby')
    })

    it('detects Rainbow wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isRainbow: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets).toHaveLength(1)
      expect(wallets[0].type).toBe('rainbow')
      expect(wallets[0].name).toBe('Rainbow')
    })

    it('detects multiple wallets from providers array', () => {
      const metamaskProvider = createMockProvider({ isMetaMask: true })
      const rabbyProvider = createMockProvider({ isRabby: true })

      global.window = {
        ethereum: {
          ...createMockProvider({ isMetaMask: true }),
          providers: [metamaskProvider, rabbyProvider],
        },
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets).toHaveLength(2)
      expect(wallets.map(w => w.type)).toContain('metamask')
      expect(wallets.map(w => w.type)).toContain('rabby')
    })

    it('returns empty array when no ethereum provider', () => {
      global.window = {} as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets).toHaveLength(0)
    })

    it('detects Coinbase Wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isCoinbaseWallet: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('coinbase')
      expect(wallets[0].name).toBe('Coinbase Wallet')
    })

    it('detects Trust Wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isTrust: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('trust')
      expect(wallets[0].name).toBe('Trust Wallet')
    })

    it('detects Brave Wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isBraveWallet: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('brave')
      expect(wallets[0].name).toBe('Brave Wallet')
    })

    it('detects Frame wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isFrame: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('frame')
      expect(wallets[0].name).toBe('Frame')
    })

    it('detects Phantom wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isPhantom: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('phantom')
      expect(wallets[0].name).toBe('Phantom')
    })

    it('detects OKX wallet', () => {
      global.window = {
        ethereum: createMockProvider({ isOKExWallet: true }),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('okx')
      expect(wallets[0].name).toBe('OKX Wallet')
    })

    it('returns unknown for unrecognized wallet', () => {
      global.window = {
        ethereum: createMockProvider({}),
      } as unknown as Window & typeof globalThis

      const wallets = detectWallets()

      expect(wallets[0].type).toBe('unknown')
      expect(wallets[0].name).toBe('Unknown Wallet')
    })
  })

  describe('isWalletInstalled', () => {
    it('returns true when wallet is installed', () => {
      expect(isWalletInstalled('metamask')).toBe(true)
    })

    it('returns false when wallet is not installed', () => {
      expect(isWalletInstalled('rabby')).toBe(false)
    })
  })

  describe('getWalletProvider', () => {
    it('returns provider for installed wallet', () => {
      const provider = getWalletProvider('metamask')

      expect(provider).toBeDefined()
      expect(provider?.isMetaMask).toBe(true)
    })

    it('returns undefined for uninstalled wallet', () => {
      const provider = getWalletProvider('rabby')

      expect(provider).toBeUndefined()
    })
  })

  describe('MultiWalletPrivacyAdapter', () => {
    it('creates adapter with default configuration', () => {
      const adapter = new MultiWalletPrivacyAdapter()

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
    })

    it('creates adapter with preferred wallet', () => {
      const adapter = new MultiWalletPrivacyAdapter({
        preferredWallet: 'metamask',
      })

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
      expect(adapter.getCurrentWallet()?.type).toBe('metamask')
    })

    it('getAvailableWallets returns detected wallets', () => {
      const adapter = new MultiWalletPrivacyAdapter()
      const wallets = adapter.getAvailableWallets()

      expect(wallets).toHaveLength(1)
      expect(wallets[0].type).toBe('metamask')
    })

    it('getCurrentWallet returns connected wallet', () => {
      const adapter = new MultiWalletPrivacyAdapter({
        preferredWallet: 'metamask',
      })

      const wallet = adapter.getCurrentWallet()

      expect(wallet).toBeDefined()
      expect(wallet?.type).toBe('metamask')
    })

    it('isWalletAvailable checks wallet installation', () => {
      const adapter = new MultiWalletPrivacyAdapter()

      expect(adapter.isWalletAvailable('metamask')).toBe(true)
      expect(adapter.isWalletAvailable('rabby')).toBe(false)
    })

    describe('connectWallet', () => {
      it('connects to specified wallet', async () => {
        const adapter = new MultiWalletPrivacyAdapter()

        const address = await adapter.connectWallet('metamask')

        expect(address).toBe('0x1234567890abcdef1234567890abcdef12345678')
        expect(adapter.getCurrentWallet()?.type).toBe('metamask')
      })

      it('throws when wallet not installed', async () => {
        const adapter = new MultiWalletPrivacyAdapter()

        await expect(adapter.connectWallet('rabby')).rejects.toThrow(
          'Wallet rabby is not installed'
        )
      })

      it('handles user rejection', async () => {
        const rejectingProvider = createMockProvider()
        ;(rejectingProvider.request as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 4001,
          message: 'User rejected',
        })

        global.window = {
          ethereum: { ...rejectingProvider, isMetaMask: true },
        } as unknown as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()

        await expect(adapter.connectWallet('metamask')).rejects.toThrow(
          'User rejected connection request'
        )
      })

      it('supports silent connection', async () => {
        const adapter = new MultiWalletPrivacyAdapter()

        await adapter.connectWallet('metamask', { silent: true })

        expect(mockEthereum.request).toHaveBeenCalledWith({
          method: 'eth_accounts',
        })
      })
    })

    describe('disconnectWallet', () => {
      it('disconnects current wallet', async () => {
        const adapter = new MultiWalletPrivacyAdapter({
          preferredWallet: 'metamask',
        })

        await adapter.connectWallet('metamask')
        await adapter.disconnectWallet()

        expect(adapter.getCurrentWallet()).toBeNull()
      })

      it('removes event listeners', async () => {
        const adapter = new MultiWalletPrivacyAdapter({
          preferredWallet: 'metamask',
        })

        await adapter.connectWallet('metamask')
        await adapter.disconnectWallet()

        expect(mockEthereum.removeListener).toHaveBeenCalled()
      })
    })

    describe('switchChainForProvider', () => {
      it('switches chain successfully', async () => {
        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')

        await adapter.switchChainForProvider(mockEthereum, 42161)

        expect(mockEthereum.request).toHaveBeenCalledWith({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4b1' }],
        })
      })

      it('adds chain when not found', async () => {
        const provider = createMockProvider()
        let switchAttempts = 0
        ;(provider.request as ReturnType<typeof vi.fn>).mockImplementation(
          async ({ method }) => {
            if (method === 'wallet_switchEthereumChain') {
              switchAttempts++
              if (switchAttempts === 1) {
                throw { code: 4902, message: 'Chain not found' }
              }
            }
            if (method === 'wallet_addEthereumChain') {
              return null
            }
            if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
              return ['0x1234567890abcdef1234567890abcdef12345678']
            }
            return null
          }
        )

        global.window = {
          ethereum: { ...provider, isMetaMask: true },
        } as unknown as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')

        await adapter.switchChainForProvider(provider, 42161)

        expect(provider.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'wallet_addEthereumChain',
          })
        )
      })
    })

    describe('signPersonalMessage', () => {
      it('signs message with connected wallet', async () => {
        const signatureResult = '0xsignature'
        const provider = createMockProvider()
        ;(provider.request as ReturnType<typeof vi.fn>).mockImplementation(
          async ({ method }) => {
            if (method === 'personal_sign') {
              return signatureResult
            }
            if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
              return ['0x1234567890abcdef1234567890abcdef12345678']
            }
            return null
          }
        )

        global.window = {
          ethereum: { ...provider, isMetaMask: true },
        } as unknown as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')

        const signature = await adapter.signPersonalMessage('Hello, World!')

        expect(signature).toBe(signatureResult)
        expect(provider.request).toHaveBeenCalledWith({
          method: 'personal_sign',
          params: ['Hello, World!', '0x1234567890abcdef1234567890abcdef12345678'],
        })
      })

      it('throws when no wallet connected', async () => {
        // Simulate environment with no ethereum provider
        global.window = {} as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()

        await expect(adapter.signPersonalMessage('test')).rejects.toThrow(
          'No wallet connected'
        )
      })
    })

    describe('signTypedDataV4', () => {
      it('signs typed data with connected wallet', async () => {
        const signatureResult = '0xtypedsignature'
        const provider = createMockProvider()
        ;(provider.request as ReturnType<typeof vi.fn>).mockImplementation(
          async ({ method }) => {
            if (method === 'eth_signTypedData_v4') {
              return signatureResult
            }
            if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
              return ['0x1234567890abcdef1234567890abcdef12345678']
            }
            return null
          }
        )

        global.window = {
          ethereum: { ...provider, isMetaMask: true },
        } as unknown as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')

        const typedData = {
          domain: { name: 'Test' },
          types: { Message: [{ name: 'content', type: 'string' }] },
          primaryType: 'Message',
          message: { content: 'Hello' },
        }

        const signature = await adapter.signTypedDataV4(typedData)

        expect(signature).toBe(signatureResult)
      })

      it('throws when no wallet connected', async () => {
        // Simulate environment with no ethereum provider
        global.window = {} as Window & typeof globalThis

        const adapter = new MultiWalletPrivacyAdapter()

        await expect(adapter.signTypedDataV4({})).rejects.toThrow(
          'No wallet connected'
        )
      })
    })

    describe('wallet preference persistence', () => {
      it('persists wallet preference', async () => {
        const mockStorage: Record<string, string> = {}
        global.localStorage = {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, value: string) => { mockStorage[key] = value },
          removeItem: (key: string) => { delete mockStorage[key] },
        } as Storage

        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')

        expect(mockStorage['sip-preferred-wallet']).toBe('metamask')
      })

      it('clears preference on disconnect', async () => {
        const mockStorage: Record<string, string> = {
          'sip-preferred-wallet': 'metamask',
        }
        global.localStorage = {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, value: string) => { mockStorage[key] = value },
          removeItem: (key: string) => { delete mockStorage[key] },
        } as Storage

        const adapter = new MultiWalletPrivacyAdapter()
        await adapter.connectWallet('metamask')
        await adapter.disconnectWallet()

        expect(mockStorage['sip-preferred-wallet']).toBeUndefined()
      })

      it('loads persisted preference', () => {
        const mockStorage: Record<string, string> = {
          'sip-preferred-wallet': 'metamask',
        }
        global.localStorage = {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, value: string) => { mockStorage[key] = value },
          removeItem: (key: string) => { delete mockStorage[key] },
        } as Storage

        const adapter = new MultiWalletPrivacyAdapter()

        expect(adapter.getPersistedWalletPreference()).toBe('metamask')
      })
    })
  })

  describe('Factory Functions', () => {
    it('createMultiWalletAdapter creates adapter', () => {
      const adapter = createMultiWalletAdapter()

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
    })

    it('createMultiWalletAdapter accepts config', () => {
      const adapter = createMultiWalletAdapter({
        preferredWallet: 'metamask',
        chainId: 42161,
      })

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
    })

    it('createRabbyPrivacyAdapter creates Rabby adapter', () => {
      const adapter = createRabbyPrivacyAdapter()

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
    })

    it('createRainbowPrivacyAdapter creates Rainbow adapter', () => {
      const adapter = createRainbowPrivacyAdapter()

      expect(adapter).toBeInstanceOf(MultiWalletPrivacyAdapter)
    })
  })

  describe('Event Handling', () => {
    it('sets up event listeners on connect', async () => {
      const adapter = new MultiWalletPrivacyAdapter()
      await adapter.connectWallet('metamask')

      expect(mockEthereum.on).toHaveBeenCalledWith(
        'accountsChanged',
        expect.any(Function)
      )
      expect(mockEthereum.on).toHaveBeenCalledWith(
        'chainChanged',
        expect.any(Function)
      )
    })

    it('handles accounts changed event', async () => {
      let accountsHandler: ((accounts: unknown) => void) | undefined
      const provider = createMockProvider()
      ;(provider.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event, handler) => {
          if (event === 'accountsChanged') {
            accountsHandler = handler
          }
        }
      )

      global.window = {
        ethereum: { ...provider, isMetaMask: true },
      } as unknown as Window & typeof globalThis

      const adapter = new MultiWalletPrivacyAdapter()
      await adapter.connectWallet('metamask')

      // Simulate accounts changed (disconnect)
      accountsHandler?.([])

      expect(adapter.getCurrentWallet()).toBeNull()
    })

    it('handles chain changed event', async () => {
      let chainHandler: ((chainId: unknown) => void) | undefined
      const provider = createMockProvider()
      ;(provider.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event, handler) => {
          if (event === 'chainChanged') {
            chainHandler = handler
          }
        }
      )

      global.window = {
        ethereum: { ...provider, isMetaMask: true },
      } as unknown as Window & typeof globalThis

      const adapter = new MultiWalletPrivacyAdapter()
      await adapter.connectWallet('metamask')

      // Simulate chain changed
      chainHandler?.('0xa4b1')

      expect(adapter.getCurrentWallet()?.chainId).toBe(42161)
    })
  })
})
