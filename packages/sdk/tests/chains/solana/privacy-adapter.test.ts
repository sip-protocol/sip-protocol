/**
 * Solana Privacy Adapter Tests
 *
 * Tests for the unified privacy adapter interface.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  SolanaPrivacyAdapter,
  createSolanaPrivacyAdapter,
  type SolanaPrivacyAdapterConfig,
} from '../../../src/chains/solana/privacy-adapter'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'

// Mock connection
const createMockConnection = () => {
  const mockGetSignaturesForAddress = vi.fn().mockResolvedValue([])
  const mockGetTransaction = vi.fn().mockResolvedValue(null)
  const mockOnLogs = vi.fn().mockReturnValue(1)
  const mockRemoveOnLogsListener = vi.fn().mockResolvedValue(undefined)
  const mockGetMinimumBalanceForRentExemption = vi.fn().mockResolvedValue(2039280)
  const mockGetLatestBlockhash = vi.fn().mockResolvedValue({
    blockhash: 'mockBlockhash123456789012345678901234567890123',
    lastValidBlockHeight: 1000,
  })

  return {
    getSignaturesForAddress: mockGetSignaturesForAddress,
    getTransaction: mockGetTransaction,
    onLogs: mockOnLogs,
    removeOnLogsListener: mockRemoveOnLogsListener,
    getMinimumBalanceForRentExemption: mockGetMinimumBalanceForRentExemption,
    getLatestBlockhash: mockGetLatestBlockhash,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  } as unknown as Connection
}

describe('Solana Privacy Adapter', () => {
  let mockConnection: Connection
  let adapter: SolanaPrivacyAdapter

  beforeEach(() => {
    mockConnection = createMockConnection()
    adapter = new SolanaPrivacyAdapter({ connection: mockConnection })
  })

  afterEach(async () => {
    await adapter.dispose()
    vi.clearAllMocks()
  })

  // ─── Construction ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create adapter with minimal config', () => {
      const adapter = new SolanaPrivacyAdapter({ connection: mockConnection })

      expect(adapter).toBeInstanceOf(SolanaPrivacyAdapter)
      expect(adapter.getState().isInitialized).toBe(true)
      expect(adapter.getCluster()).toBe('mainnet-beta')
    })

    it('should accept custom cluster', () => {
      const adapter = new SolanaPrivacyAdapter({
        connection: mockConnection,
        cluster: 'devnet',
      })

      expect(adapter.getCluster()).toBe('devnet')
    })

    it('should accept provider directly', () => {
      const mockProvider = { getAssetsByOwner: vi.fn() } as any
      const adapter = new SolanaPrivacyAdapter({
        connection: mockConnection,
        provider: mockProvider,
      })

      expect(adapter.getProvider()).toBe(mockProvider)
      expect(adapter.getState().hasProvider).toBe(true)
    })
  })

  describe('createSolanaPrivacyAdapter', () => {
    it('should create adapter via factory function', () => {
      const adapter = createSolanaPrivacyAdapter({ connection: mockConnection })

      expect(adapter).toBeInstanceOf(SolanaPrivacyAdapter)
    })
  })

  // ─── Meta-Address Generation ──────────────────────────────────────────────

  describe('generateMetaAddress', () => {
    it('should generate valid meta-address', () => {
      const result = adapter.generateMetaAddress()

      expect(result.metaAddress).toHaveProperty('chain', 'solana')
      expect(result.metaAddress).toHaveProperty('spendingKey')
      expect(result.metaAddress).toHaveProperty('viewingKey')
      expect(result.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should accept optional label', () => {
      const result = adapter.generateMetaAddress('My Wallet')

      expect(result.metaAddress.label).toBe('My Wallet')
    })

    it('should generate unique addresses', () => {
      const result1 = adapter.generateMetaAddress()
      const result2 = adapter.generateMetaAddress()

      expect(result1.metaAddress.spendingKey).not.toBe(result2.metaAddress.spendingKey)
    })
  })

  describe('parseMetaAddress', () => {
    it('should parse encoded meta-address', () => {
      const generated = adapter.generateMetaAddress()
      const encoded = `sip:solana:${generated.metaAddress.spendingKey}:${generated.metaAddress.viewingKey}`

      const parsed = adapter.parseMetaAddress(encoded)

      expect(parsed.chain).toBe('solana')
      expect(parsed.spendingKey).toBe(generated.metaAddress.spendingKey)
      expect(parsed.viewingKey).toBe(generated.metaAddress.viewingKey)
    })
  })

  // ─── Ephemeral Keys ───────────────────────────────────────────────────────

  describe('generateEphemeralKeypair', () => {
    it('should generate ephemeral keypair', () => {
      const keypair = adapter.generateEphemeralKeypair()

      expect(keypair.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(keypair.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(keypair.publicKeyBase58.length).toBeGreaterThanOrEqual(32)
    })
  })

  describe('generateManagedEphemeralKeypair', () => {
    it('should generate managed keypair', () => {
      const managed = adapter.generateManagedEphemeralKeypair()

      expect(managed.isDisposed).toBe(false)
      expect(typeof managed.dispose).toBe('function')
    })
  })

  // ─── Stealth Address Resolution ───────────────────────────────────────────

  describe('resolveStealthAddress', () => {
    it('should resolve meta-address to stealth address', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      const resolved = adapter.resolveStealthAddress(metaAddress)

      expect(resolved.stealthAddress).toBeDefined()
      expect(resolved.stealthAddressHex).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(resolved.ephemeralPublicKey).toBeDefined()
      expect(resolved.ephemeralPublicKeyHex).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(resolved.viewTag).toBeGreaterThanOrEqual(0)
      expect(resolved.viewTag).toBeLessThanOrEqual(255)
    })

    it('should generate unique stealth addresses each time', () => {
      const { metaAddress } = adapter.generateMetaAddress()

      const resolved1 = adapter.resolveStealthAddress(metaAddress)
      const resolved2 = adapter.resolveStealthAddress(metaAddress)

      expect(resolved1.stealthAddress).not.toBe(resolved2.stealthAddress)
    })

    it('should accept encoded string', () => {
      const { metaAddress } = adapter.generateMetaAddress()
      const encoded = `sip:solana:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

      const resolved = adapter.resolveStealthAddress(encoded)

      expect(resolved.stealthAddress).toBeDefined()
    })
  })

  // ─── Scanner Management ───────────────────────────────────────────────────

  describe('scanner management', () => {
    const testRecipient = {
      viewingPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as HexString,
      spendingPublicKey: '0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' as HexString,
      label: 'Test Wallet',
    }

    it('should add scan recipient', () => {
      adapter.addScanRecipient(testRecipient)

      expect(adapter.getScanRecipients()).toHaveLength(1)
      expect(adapter.getState().scannerRecipientCount).toBe(1)
    })

    it('should remove scan recipient', () => {
      adapter.addScanRecipient(testRecipient)
      adapter.removeScanRecipient('Test Wallet')

      expect(adapter.getScanRecipients()).toHaveLength(0)
    })

    it('should clear all recipients', () => {
      adapter.addScanRecipient({ ...testRecipient, label: 'A' })
      adapter.addScanRecipient({ ...testRecipient, label: 'B' })

      adapter.clearScanRecipients()

      expect(adapter.getScanRecipients()).toHaveLength(0)
    })
  })

  describe('scanHistorical', () => {
    it('should return empty result with no recipients', async () => {
      const result = await adapter.scanHistorical()

      expect(result.payments).toHaveLength(0)
      expect(result.scannedCount).toBe(0)
    })
  })

  describe('subscribeToPayments', () => {
    const testRecipient = {
      viewingPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as HexString,
      spendingPublicKey: '0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' as HexString,
      label: 'Test Wallet',
    }

    it('should subscribe to real-time payments', () => {
      adapter.addScanRecipient(testRecipient)
      const onPayment = vi.fn()

      adapter.subscribeToPayments(onPayment)

      expect(adapter.isSubscribedToPayments()).toBe(true)
      expect(adapter.getState().isScanning).toBe(true)
    })

    it('should unsubscribe from payments', async () => {
      adapter.addScanRecipient(testRecipient)
      adapter.subscribeToPayments(vi.fn())

      await adapter.unsubscribeFromPayments()

      expect(adapter.isSubscribedToPayments()).toBe(false)
    })
  })

  // ─── State & Utilities ────────────────────────────────────────────────────

  describe('getState', () => {
    it('should return current state', () => {
      const state = adapter.getState()

      expect(state.isInitialized).toBe(true)
      expect(state.cluster).toBe('mainnet-beta')
      expect(state.hasProvider).toBe(false)
      expect(state.scannerRecipientCount).toBe(0)
      expect(state.isScanning).toBe(false)
    })
  })

  describe('getConnection', () => {
    it('should return the connection', () => {
      expect(adapter.getConnection()).toBe(mockConnection)
    })
  })

  describe('dispose', () => {
    it('should clean up resources', async () => {
      const testRecipient = {
        viewingPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as HexString,
        spendingPublicKey: '0x02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' as HexString,
        label: 'Test',
      }

      adapter.addScanRecipient(testRecipient)
      adapter.subscribeToPayments(vi.fn())

      await adapter.dispose()

      expect(adapter.getState().isInitialized).toBe(false)
      expect(adapter.getState().scannerRecipientCount).toBe(0)
      expect(adapter.getState().isScanning).toBe(false)
    })
  })

  // ─── Integration ──────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should support full workflow: generate, resolve, add recipient', () => {
      // Generate meta-address
      const { metaAddress, viewingPrivateKey } = adapter.generateMetaAddress('My Wallet')

      // Resolve to stealth address
      const resolved = adapter.resolveStealthAddress(metaAddress)
      expect(resolved.stealthAddress).toBeDefined()

      // Add as scan recipient
      adapter.addScanRecipient({
        viewingPrivateKey,
        spendingPublicKey: metaAddress.spendingKey,
        label: 'My Wallet',
      })

      expect(adapter.getScanRecipients()).toHaveLength(1)
    })

    it('should work with mainnet and devnet configs', () => {
      const mainnetAdapter = createSolanaPrivacyAdapter({
        connection: mockConnection,
        cluster: 'mainnet-beta',
      })

      const devnetAdapter = createSolanaPrivacyAdapter({
        connection: mockConnection,
        cluster: 'devnet',
      })

      expect(mainnetAdapter.getCluster()).toBe('mainnet-beta')
      expect(devnetAdapter.getCluster()).toBe('devnet')
    })
  })

  // ─── Fee Estimation ───────────────────────────────────────────────────────

  describe('estimateTransferFee', () => {
    it('should estimate fee with ATA creation', async () => {
      const fee = await adapter.estimateTransferFee(true)

      expect(fee).toBeGreaterThan(0n)
    })

    it('should estimate fee without ATA creation', async () => {
      const feeWithATA = await adapter.estimateTransferFee(true)
      const feeWithoutATA = await adapter.estimateTransferFee(false)

      expect(feeWithoutATA).toBeLessThan(feeWithATA)
    })
  })
})
