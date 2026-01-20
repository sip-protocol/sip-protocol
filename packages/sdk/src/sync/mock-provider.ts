/**
 * Mock Oblivious Sync Provider
 *
 * Reference implementation for testing oblivious sync.
 * NOT for production use - provides no actual blockchain data.
 *
 * @module sync/mock-provider
 */

import type { HexString } from '@sip-protocol/types'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import type {
  ObliviousSyncProvider,
  ChainId,
  BlockRange,
  EncryptedNote,
  ObliviousNullifier,
  MerkleProof,
  ObliviousSyncQuery,
  ObliviousSyncResponse,
  SyncServiceHealth,
} from './oblivious'

/**
 * Configuration for mock provider
 */
export interface MockSyncProviderConfig {
  /** Chains to simulate */
  chains: ChainId[]
  /** Simulated latency (ms) */
  latencyMs: number
  /** Probability of returning notes (0-1) */
  noteProbability: number
  /** Simulated block height */
  blockHeight: bigint
  /** Fail probability for testing error handling */
  failProbability: number
}

/**
 * Default mock configuration
 */
export const DEFAULT_MOCK_CONFIG: MockSyncProviderConfig = {
  chains: ['ethereum', 'solana', 'near'],
  latencyMs: 100,
  noteProbability: 0.3,
  blockHeight: 10_000n, // Reasonable default for testing (not 1M blocks)
  failProbability: 0,
}

/**
 * Mock Oblivious Sync Provider
 *
 * Simulates an oblivious sync service for testing.
 * Demonstrates the interface contract without real blockchain data.
 */
export class MockObliviousSyncProvider implements ObliviousSyncProvider {
  readonly name = 'mock-oblivious-sync'
  readonly supportedChains: ChainId[]

  private config: MockSyncProviderConfig
  private initialized = false
  private subscriptions = new Map<string, Set<(notes: EncryptedNote[]) => void>>()
  private mockNullifierSpentStatus = new Map<HexString, boolean>()

  constructor(config: Partial<MockSyncProviderConfig> = {}) {
    this.config = { ...DEFAULT_MOCK_CONFIG, ...config }
    this.supportedChains = this.config.chains
  }

  async initialize(): Promise<void> {
    await this.simulateLatency()
    this.initialized = true
  }

  async getHealth(chainId: ChainId): Promise<SyncServiceHealth> {
    this.checkInitialized()
    await this.simulateLatency()

    if (!this.supportedChains.includes(chainId)) {
      return {
        available: false,
        currentHeight: 0n,
        chainId,
        latencyMs: 0,
      }
    }

    return {
      available: true,
      currentHeight: this.config.blockHeight,
      chainId,
      latencyMs: this.config.latencyMs,
      lastSuccessfulSync: Date.now(),
    }
  }

  async scanForNotes(
    _viewingKeyPublic: HexString,
    blockRange: BlockRange
  ): Promise<EncryptedNote[]> {
    this.checkInitialized()
    await this.simulateLatency()
    this.maybeSimulateFail()

    if (!this.supportedChains.includes(blockRange.chainId)) {
      throw new Error(`Chain ${blockRange.chainId} not supported`)
    }

    // Simulate finding some notes probabilistically
    const notes: EncryptedNote[] = []
    const numBlocks = Number(blockRange.endBlock - blockRange.startBlock)
    const expectedNotes = Math.floor(numBlocks * this.config.noteProbability)

    for (let i = 0; i < expectedNotes; i++) {
      notes.push(this.generateMockNote(blockRange))
    }

    return notes
  }

  async checkNullifiers(
    nullifiers: ObliviousNullifier[]
  ): Promise<Map<HexString, boolean>> {
    this.checkInitialized()
    await this.simulateLatency()
    this.maybeSimulateFail()

    const results = new Map<HexString, boolean>()

    for (const nullifier of nullifiers) {
      // Check mock spent status, default to not spent
      const spent = this.mockNullifierSpentStatus.get(nullifier.nullifier) ?? false
      results.set(nullifier.nullifier, spent)
    }

    return results
  }

  async getMerkleProofs(
    commitments: HexString[],
    _chainId: ChainId
  ): Promise<Map<HexString, MerkleProof>> {
    this.checkInitialized()
    await this.simulateLatency()
    this.maybeSimulateFail()

    const proofs = new Map<HexString, MerkleProof>()

    for (const commitment of commitments) {
      proofs.set(commitment, this.generateMockMerkleProof(commitment))
    }

    return proofs
  }

  async executeObliviousQuery(
    query: ObliviousSyncQuery
  ): Promise<ObliviousSyncResponse> {
    this.checkInitialized()
    await this.simulateLatency()
    this.maybeSimulateFail()

    // Simulate scanning for notes
    const notes = await this.scanForNotes(
      '0x00' as HexString, // Query is encrypted, we can't read it
      query.blockRange
    )

    // Get merkle proofs for found notes
    const merkleProofs: MerkleProof[] = []
    for (const note of notes) {
      merkleProofs.push(this.generateMockMerkleProof(note.commitment))
    }

    return {
      encryptedNotes: notes,
      merkleProofs,
      syncHeight: this.config.blockHeight,
      timestamp: Date.now(),
      queryHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
    }
  }

  async getCurrentHeight(chainId: ChainId): Promise<bigint> {
    this.checkInitialized()
    await this.simulateLatency()

    if (!this.supportedChains.includes(chainId)) {
      throw new Error(`Chain ${chainId} not supported`)
    }

    return this.config.blockHeight
  }

  subscribeToNotes(
    viewingKeyPublic: HexString,
    chainId: ChainId,
    callback: (notes: EncryptedNote[]) => void
  ): () => void {
    this.checkInitialized()

    const key = `${chainId}:${viewingKeyPublic}`
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    this.subscriptions.get(key)!.add(callback)

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscriptions.delete(key)
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    this.subscriptions.clear()
    this.initialized = false
  }

  // ─── Test Helpers ─────────────────────────────────────────────────────────────

  /**
   * Simulate a nullifier being spent (for testing)
   */
  markNullifierSpent(nullifier: HexString): void {
    this.mockNullifierSpentStatus.set(nullifier, true)
  }

  /**
   * Simulate new notes arriving (for testing subscriptions)
   */
  simulateNewNotes(chainId: ChainId, viewingKeyPublic: HexString): void {
    const key = `${chainId}:${viewingKeyPublic}`
    const subscribers = this.subscriptions.get(key)

    if (subscribers && subscribers.size > 0) {
      const mockNote = this.generateMockNote({
        startBlock: this.config.blockHeight,
        endBlock: this.config.blockHeight + 1n,
        chainId,
      })

      for (const callback of subscribers) {
        callback([mockNote])
      }
    }
  }

  /**
   * Set simulated block height
   */
  setBlockHeight(height: bigint): void {
    this.config.blockHeight = height
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('Provider not initialized. Call initialize() first.')
    }
  }

  private async simulateLatency(): Promise<void> {
    if (this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs))
    }
  }

  private maybeSimulateFail(): void {
    if (this.config.failProbability > 0 && Math.random() < this.config.failProbability) {
      throw new Error('Simulated failure')
    }
  }

  private generateMockNote(blockRange: BlockRange): EncryptedNote {
    const blockNumber = blockRange.startBlock +
      BigInt(Math.floor(Math.random() * Number(blockRange.endBlock - blockRange.startBlock)))

    return {
      commitment: `0x${bytesToHex(randomBytes(32))}` as HexString,
      encryptedData: `0x${bytesToHex(randomBytes(128))}` as HexString,
      blockNumber,
      txHash: `0x${bytesToHex(randomBytes(32))}` as HexString,
      chainId: blockRange.chainId,
    }
  }

  private generateMockMerkleProof(leaf: HexString): MerkleProof {
    // Generate mock 20-level Merkle proof
    const siblings: HexString[] = []
    for (let i = 0; i < 20; i++) {
      siblings.push(`0x${bytesToHex(randomBytes(32))}` as HexString)
    }

    return {
      leaf,
      siblings,
      index: BigInt(Math.floor(Math.random() * 1_000_000)),
      root: `0x${bytesToHex(randomBytes(32))}` as HexString,
    }
  }
}

/**
 * Create a mock oblivious sync provider for testing
 */
export function createMockSyncProvider(
  config?: Partial<MockSyncProviderConfig>
): MockObliviousSyncProvider {
  return new MockObliviousSyncProvider(config)
}
