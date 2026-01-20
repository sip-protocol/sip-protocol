/**
 * Oblivious Sync Tests
 *
 * Tests for oblivious synchronization where sync services learn
 * NOTHING about user transactions.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/433
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'

// Import directly from source to avoid circular dependencies
import {
  generateSyncRandomness,
  isSyncRandomnessValid,
  getCurrentEpoch,
  deriveObliviousNullifier,
  deriveTraditionalNullifier,
  createSyncState,
  updateSyncState,
  createTimeWindowedKey,
  ObliviousSyncError,
  ObliviousSyncErrorCode,
  type SyncRandomness,
  type ObliviousNullifier,
  type EncryptedNote,
  type BlockRange,
} from '../../src/sync/oblivious'

import {
  MockObliviousSyncProvider,
  createMockSyncProvider,
} from '../../src/sync/mock-provider'

import {
  SyncManager,
  createSyncManager,
} from '../../src/sync/manager'

import { generateViewingKey } from '../../src/privacy'

// ─── Sync Randomness Tests ────────────────────────────────────────────────────

describe('Sync Randomness', () => {
  describe('generateSyncRandomness', () => {
    it('should generate 32-byte randomness', () => {
      const randomness = generateSyncRandomness(1)

      expect(randomness.value).toBeInstanceOf(Uint8Array)
      expect(randomness.value.length).toBe(32)
    })

    it('should set correct epoch', () => {
      const epoch = 42
      const randomness = generateSyncRandomness(epoch)

      expect(randomness.epoch).toBe(epoch)
    })

    it('should set expiration based on duration', () => {
      const now = Date.now()
      const durationSeconds = 3600 // 1 hour
      const randomness = generateSyncRandomness(1, durationSeconds)

      expect(randomness.expiresAt).toBeGreaterThan(now)
      expect(randomness.expiresAt).toBeLessThanOrEqual(now + durationSeconds * 1000 + 1000)
    })

    it('should generate unique randomness each time', () => {
      const r1 = generateSyncRandomness(1)
      const r2 = generateSyncRandomness(1)

      expect(bytesToHex(r1.value)).not.toBe(bytesToHex(r2.value))
    })
  })

  describe('isSyncRandomnessValid', () => {
    it('should return true for valid randomness', () => {
      const randomness = generateSyncRandomness(1, 3600)
      expect(isSyncRandomnessValid(randomness)).toBe(true)
    })

    it('should return false for expired randomness', () => {
      const randomness: SyncRandomness = {
        value: randomBytes(32),
        epoch: 1,
        expiresAt: Date.now() - 1000,
      }
      expect(isSyncRandomnessValid(randomness)).toBe(false)
    })
  })

  describe('getCurrentEpoch', () => {
    it('should return a positive integer', () => {
      const epoch = getCurrentEpoch()

      expect(epoch).toBeGreaterThan(0)
      expect(Number.isInteger(epoch)).toBe(true)
    })
  })
})

// ─── Oblivious Nullifier Tests ────────────────────────────────────────────────

describe('Oblivious Nullifier Derivation', () => {
  const mockCommitment = `0x${bytesToHex(randomBytes(32))}` as HexString
  const mockSpendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString

  describe('deriveObliviousNullifier', () => {
    it('should derive a 32-byte nullifier', () => {
      const randomness = generateSyncRandomness(1)
      const nullifier = deriveObliviousNullifier(mockCommitment, mockSpendingKey, randomness)

      expect(nullifier.nullifier).toMatch(/^0x[a-f0-9]{64}$/i)
    })

    it('should set correct epoch', () => {
      const randomness = generateSyncRandomness(42)
      const nullifier = deriveObliviousNullifier(mockCommitment, mockSpendingKey, randomness)

      expect(nullifier.epoch).toBe(42)
    })

    it('should produce different nullifiers with different randomness', () => {
      const r1 = generateSyncRandomness(1)
      const r2 = generateSyncRandomness(1)

      const n1 = deriveObliviousNullifier(mockCommitment, mockSpendingKey, r1)
      const n2 = deriveObliviousNullifier(mockCommitment, mockSpendingKey, r2)

      expect(n1.nullifier).not.toBe(n2.nullifier)
    })

    it('should produce same nullifier with same inputs', () => {
      const randomness = generateSyncRandomness(1)

      const n1 = deriveObliviousNullifier(mockCommitment, mockSpendingKey, randomness)
      const n2 = deriveObliviousNullifier(mockCommitment, mockSpendingKey, randomness)

      expect(n1.nullifier).toBe(n2.nullifier)
    })
  })

  describe('deriveTraditionalNullifier', () => {
    it('should derive a 32-byte nullifier', () => {
      const nullifier = deriveTraditionalNullifier(mockCommitment, mockSpendingKey)

      expect(nullifier).toMatch(/^0x[a-f0-9]{64}$/i)
    })

    it('should be deterministic', () => {
      const n1 = deriveTraditionalNullifier(mockCommitment, mockSpendingKey)
      const n2 = deriveTraditionalNullifier(mockCommitment, mockSpendingKey)

      expect(n1).toBe(n2)
    })
  })
})

// ─── Sync State Tests ─────────────────────────────────────────────────────────

describe('Sync State Management', () => {
  const chains = ['ethereum', 'solana']

  describe('createSyncState', () => {
    it('should initialize sync heights to 0', () => {
      const state = createSyncState(chains)

      for (const chain of chains) {
        expect(state.syncHeights.get(chain)).toBe(0n)
      }
    })

    it('should generate sync randomness for each chain', () => {
      const state = createSyncState(chains)

      for (const chain of chains) {
        const randomness = state.syncRandomness.get(chain)
        expect(randomness).toBeDefined()
        expect(randomness!.value.length).toBe(32)
      }
    })
  })

  describe('updateSyncState', () => {
    it('should update sync height for chain', () => {
      const state = createSyncState(chains)
      const newState = updateSyncState(state, 'ethereum', 1000n, [])

      expect(newState.syncHeights.get('ethereum')).toBe(1000n)
    })

    it('should add notes to pending', () => {
      const state = createSyncState(chains)
      const mockNote: EncryptedNote = {
        commitment: '0x1234' as HexString,
        encryptedData: '0x5678' as HexString,
        blockNumber: 100n,
        txHash: '0xabcd' as HexString,
        chainId: 'ethereum',
      }

      const newState = updateSyncState(state, 'ethereum', 100n, [mockNote])

      expect(newState.pendingNotes.length).toBe(1)
    })
  })
})

// ─── Time-Windowed Viewing Key Tests ──────────────────────────────────────────

describe('Time-Windowed Viewing Key', () => {
  const mockMasterKey = `0x${bytesToHex(randomBytes(32))}` as HexString

  describe('createTimeWindowedKey', () => {
    it('should create a valid viewing key', () => {
      const now = Date.now()
      const windowedKey = createTimeWindowedKey(
        mockMasterKey,
        now,
        now + 3600000
      )

      expect(windowedKey.viewingKey).toMatch(/^0x[a-f0-9]{64}$/i)
    })

    it('should set correct window boundaries', () => {
      const start = 1000000
      const end = 2000000
      const windowedKey = createTimeWindowedKey(mockMasterKey, start, end)

      expect(windowedKey.windowStart).toBe(start)
      expect(windowedKey.windowEnd).toBe(end)
    })

    it('should produce different keys for different windows', () => {
      const k1 = createTimeWindowedKey(mockMasterKey, 0, 1000)
      const k2 = createTimeWindowedKey(mockMasterKey, 1000, 2000)

      expect(k1.viewingKey).not.toBe(k2.viewingKey)
    })
  })
})

// ─── Mock Provider Tests ──────────────────────────────────────────────────────

describe('MockObliviousSyncProvider', () => {
  let provider: MockObliviousSyncProvider

  beforeEach(async () => {
    provider = createMockSyncProvider({ latencyMs: 0 })
    await provider.initialize()
  })

  afterEach(async () => {
    await provider.shutdown()
  })

  describe('initialization', () => {
    it('should have name', () => {
      expect(provider.name).toBe('mock-oblivious-sync')
    })

    it('should support default chains', () => {
      expect(provider.supportedChains).toContain('ethereum')
      expect(provider.supportedChains).toContain('solana')
    })
  })

  describe('getHealth', () => {
    it('should return healthy for supported chain', async () => {
      const health = await provider.getHealth('ethereum')

      expect(health.available).toBe(true)
      expect(health.chainId).toBe('ethereum')
    })

    it('should return unhealthy for unsupported chain', async () => {
      const health = await provider.getHealth('unknown-chain')

      expect(health.available).toBe(false)
    })
  })

  describe('scanForNotes', () => {
    it('should return encrypted notes array', async () => {
      const blockRange: BlockRange = {
        startBlock: 0n,
        endBlock: 1000n,
        chainId: 'ethereum',
      }

      const notes = await provider.scanForNotes('0x1234' as HexString, blockRange)

      expect(Array.isArray(notes)).toBe(true)
    })
  })

  describe('checkNullifiers', () => {
    it('should return spent status', async () => {
      const nullifiers: ObliviousNullifier[] = [
        { nullifier: '0x1234' as HexString, epoch: 1, chainId: 'ethereum' },
      ]

      const results = await provider.checkNullifiers(nullifiers)

      expect(results.get('0x1234')).toBe(false)
    })

    it('should return true for marked spent', async () => {
      provider.markNullifierSpent('0x1234' as HexString)

      const nullifiers: ObliviousNullifier[] = [
        { nullifier: '0x1234' as HexString, epoch: 1, chainId: 'ethereum' },
      ]

      const results = await provider.checkNullifiers(nullifiers)

      expect(results.get('0x1234')).toBe(true)
    })
  })

  describe('getCurrentHeight', () => {
    it('should return block height', async () => {
      const height = await provider.getCurrentHeight('ethereum')

      expect(height).toBeGreaterThan(0n)
    })
  })

  describe('subscriptions', () => {
    it('should call callback on new notes', () => {
      const callback = vi.fn()
      const unsubscribe = provider.subscribeToNotes('0x1234' as HexString, 'ethereum', callback)

      provider.simulateNewNotes('ethereum', '0x1234' as HexString)

      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()
    })
  })
})

// ─── Sync Manager Tests ───────────────────────────────────────────────────────

describe('SyncManager', () => {
  let manager: SyncManager
  let provider: MockObliviousSyncProvider

  beforeEach(async () => {
    provider = createMockSyncProvider({ latencyMs: 0, noteProbability: 0.5 })
    manager = createSyncManager(provider)
    await manager.initialize()
  })

  afterEach(async () => {
    await manager.shutdown()
  })

  describe('initialization', () => {
    it('should initialize with provider chains', () => {
      const chains = manager.getSupportedChains()

      expect(chains).toContain('ethereum')
      expect(chains).toContain('solana')
    })

    it('should have sync state', () => {
      const state = manager.getState()

      expect(state).not.toBeNull()
    })
  })

  describe('sync', () => {
    it('should sync and return notes', async () => {
      const viewingKey = generateViewingKey()
      const spendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString

      const notes = await manager.sync(viewingKey, spendingKey, { chains: ['ethereum'] })

      expect(Array.isArray(notes)).toBe(true)
    })

    it('should emit progress events', async () => {
      const viewingKey = generateViewingKey()
      const spendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString
      const progressEvents: unknown[] = []

      await manager.sync(viewingKey, spendingKey, {
        chains: ['ethereum'],
        listener: {
          onProgress: (e) => progressEvents.push(e),
        },
      })

      expect(progressEvents.length).toBeGreaterThan(0)
    })
  })

  describe('deriveNullifier', () => {
    it('should derive oblivious nullifier', () => {
      const noteCommitment = `0x${bytesToHex(randomBytes(32))}` as HexString
      const spendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString

      const nullifier = manager.deriveNullifier(noteCommitment, spendingKey, 'ethereum')

      expect(nullifier.nullifier).toMatch(/^0x[a-f0-9]{64}$/i)
      expect(nullifier.chainId).toBe('ethereum')
    })
  })
})

// ─── Error Tests ──────────────────────────────────────────────────────────────

describe('ObliviousSyncError', () => {
  it('should create error with code and context', () => {
    const error = new ObliviousSyncError(
      'Test error',
      ObliviousSyncErrorCode.CHAIN_NOT_SUPPORTED,
      { chainId: 'unknown' }
    )

    expect(error.message).toBe('Test error')
    expect(error.code).toBe(ObliviousSyncErrorCode.CHAIN_NOT_SUPPORTED)
    expect(error.name).toBe('ObliviousSyncError')
  })
})

// ─── Privacy Preservation Test ────────────────────────────────────────────────

describe('Privacy Preservation', () => {
  it('oblivious nullifiers should change each epoch', async () => {
    const provider = createMockSyncProvider({ latencyMs: 0 })
    const manager = createSyncManager(provider)
    await manager.initialize()

    const spendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString
    const noteCommitment = `0x${bytesToHex(randomBytes(32))}` as HexString

    // Traditional nullifier (leaks correlation)
    const traditionalNullifier = deriveTraditionalNullifier(noteCommitment, spendingKey)

    // Oblivious nullifiers with different epochs
    const n1 = manager.deriveNullifier(noteCommitment, spendingKey, 'ethereum')

    // Force epoch change
    const state = manager.getState()!
    const oldRandomness = state.syncRandomness.get('ethereum')!
    state.syncRandomness.set('ethereum', generateSyncRandomness(oldRandomness.epoch + 1))

    const n2 = manager.deriveNullifier(noteCommitment, spendingKey, 'ethereum')

    // KEY: Oblivious nullifiers change each epoch - service cannot correlate
    expect(n1.nullifier).not.toBe(n2.nullifier)
    expect(n1.nullifier).not.toBe(traditionalNullifier)

    await manager.shutdown()
  })
})
