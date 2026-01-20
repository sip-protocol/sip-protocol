/**
 * Sync Manager
 *
 * Orchestrates oblivious synchronization across multiple providers and chains.
 * Integrates with SIP client for seamless sync experience.
 *
 * @module sync/manager
 */

import type { HexString, ViewingKey } from '@sip-protocol/types'
import type {
  ObliviousSyncProvider,
  ChainId,
  BlockRange,
  EncryptedNote,
  WalletSyncState,
  ObliviousSyncConfig,
  SyncServiceHealth,
  ObliviousNullifier,
} from './oblivious'
import {
  createSyncState,
  updateSyncState,
  deriveObliviousNullifier,
  generateSyncRandomness,
  getCurrentEpoch,
  DEFAULT_SYNC_CONFIG,
  ObliviousSyncError,
  ObliviousSyncErrorCode,
} from './oblivious'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Sync progress event
 */
export interface SyncProgressEvent {
  /** Chain being synced */
  chainId: ChainId
  /** Current block being processed */
  currentBlock: bigint
  /** Target block */
  targetBlock: bigint
  /** Percentage complete (0-100) */
  percentComplete: number
  /** Notes found so far */
  notesFound: number
}

/**
 * Sync completion event
 */
export interface SyncCompletionEvent {
  /** Chains that were synced */
  chains: ChainId[]
  /** Total notes found */
  totalNotes: number
  /** Time taken (ms) */
  durationMs: number
  /** Final sync heights */
  syncHeights: Map<ChainId, bigint>
}

/**
 * Sync event listener
 */
export type SyncEventListener = {
  onProgress?: (event: SyncProgressEvent) => void
  onComplete?: (event: SyncCompletionEvent) => void
  onError?: (error: Error, chainId: ChainId) => void
  onNotesFound?: (notes: EncryptedNote[], chainId: ChainId) => void
}

/**
 * Sync options for a single sync operation
 */
export interface SyncOptions {
  /** Chains to sync (default: all) */
  chains?: ChainId[]
  /** Maximum blocks to sync per batch */
  batchSize?: number
  /** Event listener */
  listener?: SyncEventListener
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig extends ObliviousSyncConfig {
  /** Auto-rotate sync randomness on epoch change */
  autoRotateRandomness: boolean
  /** Enable background sync */
  backgroundSync: boolean
  /** Background sync interval (ms) */
  backgroundSyncIntervalMs: number
}

/**
 * Default sync manager config
 */
export const DEFAULT_MANAGER_CONFIG: SyncManagerConfig = {
  ...DEFAULT_SYNC_CONFIG,
  autoRotateRandomness: true,
  backgroundSync: false,
  backgroundSyncIntervalMs: 60_000, // 1 minute
}

// ─── Sync Manager ─────────────────────────────────────────────────────────────

/**
 * Sync Manager
 *
 * Coordinates oblivious synchronization across providers and chains.
 *
 * ## Features
 *
 * - Multi-provider support (fallback on failure)
 * - Multi-chain parallel sync
 * - Automatic randomness rotation
 * - Background sync option
 * - Event-driven progress updates
 *
 * ## Usage
 *
 * ```typescript
 * const manager = new SyncManager(provider)
 * await manager.initialize()
 *
 * // Sync all chains
 * const result = await manager.sync(viewingKey, spendingKey, {
 *   listener: {
 *     onProgress: (e) => console.log(`${e.percentComplete}%`),
 *     onNotesFound: (notes) => console.log(`Found ${notes.length} notes`),
 *   }
 * })
 * ```
 */
export class SyncManager {
  private providers: ObliviousSyncProvider[]
  private state: WalletSyncState | null = null
  private config: SyncManagerConfig
  private backgroundSyncInterval: ReturnType<typeof setInterval> | null = null
  private initialized = false

  constructor(
    providers: ObliviousSyncProvider | ObliviousSyncProvider[],
    config: Partial<SyncManagerConfig> = {}
  ) {
    this.providers = Array.isArray(providers) ? providers : [providers]
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config }

    if (this.providers.length === 0) {
      throw new Error('At least one provider is required')
    }
  }

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    // Initialize all providers
    await Promise.all(this.providers.map(p => p.initialize()))

    // Collect all supported chains
    const chains = new Set<ChainId>()
    for (const provider of this.providers) {
      for (const chain of provider.supportedChains) {
        chains.add(chain)
      }
    }

    // Initialize sync state
    this.state = createSyncState(Array.from(chains))
    this.initialized = true
  }

  /**
   * Get current sync state
   */
  getState(): WalletSyncState | null {
    return this.state
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): ChainId[] {
    return this.state ? Array.from(this.state.syncHeights.keys()) : []
  }

  /**
   * Check health of all providers for a chain
   */
  async getHealth(chainId: ChainId): Promise<SyncServiceHealth[]> {
    this.checkInitialized()

    const healths: SyncServiceHealth[] = []
    for (const provider of this.providers) {
      if (provider.supportedChains.includes(chainId)) {
        try {
          const health = await provider.getHealth(chainId)
          healths.push(health)
        } catch {
          healths.push({
            available: false,
            currentHeight: 0n,
            chainId,
            latencyMs: 0,
          })
        }
      }
    }

    return healths
  }

  /**
   * Sync obliviously
   *
   * Main method for oblivious synchronization. The sync service learns
   * nothing about which notes belong to you or your spending patterns.
   *
   * @param viewingKey - Viewing key for note detection
   * @param spendingKey - Spending key for nullifier derivation
   * @param options - Sync options
   * @returns Notes found during sync
   */
  async sync(
    viewingKey: ViewingKey,
    spendingKey: HexString,
    options: SyncOptions = {}
  ): Promise<EncryptedNote[]> {
    this.checkInitialized()

    const startTime = Date.now()
    const allNotes: EncryptedNote[] = []
    const chains = options.chains ?? this.getSupportedChains()

    // Check for abort signal
    if (options.signal?.aborted) {
      throw new Error('Sync aborted')
    }

    try {
      if (this.config.parallelSync) {
        // Parallel sync across chains
        const results = await Promise.all(
          chains.map(chainId =>
            this.syncChain(chainId, viewingKey, spendingKey, options)
          )
        )
        for (const notes of results) {
          // Use concat to avoid stack overflow with large arrays
          for (const note of notes) {
            allNotes.push(note)
          }
        }
      } else {
        // Sequential sync
        for (const chainId of chains) {
          if (options.signal?.aborted) {
            throw new Error('Sync aborted')
          }
          const notes = await this.syncChain(chainId, viewingKey, spendingKey, options)
          // Use loop to avoid stack overflow with large arrays
          for (const note of notes) {
            allNotes.push(note)
          }
        }
      }

      // Emit completion event
      options.listener?.onComplete?.({
        chains,
        totalNotes: allNotes.length,
        durationMs: Date.now() - startTime,
        syncHeights: this.state!.syncHeights,
      })

      return allNotes
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      options.listener?.onError?.(err, chains[0] ?? 'unknown')
      throw error
    }
  }

  /**
   * Check if nullifiers have been spent (obliviously)
   *
   * @param nullifiers - Oblivious nullifiers to check
   * @returns Map of nullifier → spent status
   */
  async checkNullifiersSpent(
    nullifiers: ObliviousNullifier[]
  ): Promise<Map<HexString, boolean>> {
    this.checkInitialized()

    // Group nullifiers by chain
    const byChain = new Map<ChainId, ObliviousNullifier[]>()
    for (const nullifier of nullifiers) {
      if (!byChain.has(nullifier.chainId)) {
        byChain.set(nullifier.chainId, [])
      }
      byChain.get(nullifier.chainId)!.push(nullifier)
    }

    // Check each chain with appropriate provider
    const results = new Map<HexString, boolean>()

    for (const [chainId, chainNullifiers] of byChain) {
      const provider = this.getProviderForChain(chainId)
      if (!provider) {
        throw new ObliviousSyncError(
          `No provider available for chain: ${chainId}`,
          ObliviousSyncErrorCode.CHAIN_NOT_SUPPORTED,
          { chainId }
        )
      }

      const chainResults = await provider.checkNullifiers(chainNullifiers)
      for (const [nullifier, spent] of chainResults) {
        results.set(nullifier, spent)
      }
    }

    return results
  }

  /**
   * Derive oblivious nullifier for a note
   *
   * @param noteCommitment - Note commitment
   * @param spendingKey - Spending key
   * @param chainId - Chain ID
   * @returns Oblivious nullifier
   */
  deriveNullifier(
    noteCommitment: HexString,
    spendingKey: HexString,
    chainId: ChainId
  ): ObliviousNullifier {
    this.checkInitialized()

    // Get or generate sync randomness for this chain
    let randomness = this.state!.syncRandomness.get(chainId)
    const currentEpoch = getCurrentEpoch(this.config.epochDurationSeconds)

    if (!randomness || randomness.epoch !== currentEpoch) {
      randomness = generateSyncRandomness(currentEpoch, this.config.epochDurationSeconds)
      this.state!.syncRandomness.set(chainId, randomness)
    }

    const nullifier = deriveObliviousNullifier(noteCommitment, spendingKey, randomness)
    return { ...nullifier, chainId }
  }

  /**
   * Start background sync
   *
   * @param viewingKey - Viewing key
   * @param spendingKey - Spending key
   * @param options - Sync options
   */
  startBackgroundSync(
    viewingKey: ViewingKey,
    spendingKey: HexString,
    options: SyncOptions = {}
  ): void {
    this.checkInitialized()

    if (this.backgroundSyncInterval) {
      this.stopBackgroundSync()
    }

    this.backgroundSyncInterval = setInterval(
      () => {
        this.sync(viewingKey, spendingKey, options).catch(err => {
          options.listener?.onError?.(err, 'background')
        })
      },
      this.config.backgroundSyncIntervalMs
    )
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval)
      this.backgroundSyncInterval = null
    }
  }

  /**
   * Shutdown the sync manager
   */
  async shutdown(): Promise<void> {
    this.stopBackgroundSync()
    await Promise.all(this.providers.map(p => p.shutdown()))
    this.initialized = false
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private checkInitialized(): void {
    if (!this.initialized || !this.state) {
      throw new Error('SyncManager not initialized. Call initialize() first.')
    }
  }

  private getProviderForChain(chainId: ChainId): ObliviousSyncProvider | null {
    // Find first available provider for this chain
    for (const provider of this.providers) {
      if (provider.supportedChains.includes(chainId)) {
        return provider
      }
    }
    return null
  }

  private async syncChain(
    chainId: ChainId,
    viewingKey: ViewingKey,
    _spendingKey: HexString,
    options: SyncOptions
  ): Promise<EncryptedNote[]> {
    const provider = this.getProviderForChain(chainId)
    if (!provider) {
      throw new ObliviousSyncError(
        `No provider available for chain: ${chainId}`,
        ObliviousSyncErrorCode.CHAIN_NOT_SUPPORTED,
        { chainId }
      )
    }

    // Get current height
    const currentHeight = await provider.getCurrentHeight(chainId)
    const startHeight = this.state!.syncHeights.get(chainId) ?? 0n
    const batchSize = BigInt(options.batchSize ?? this.config.maxBatchSize)

    const allNotes: EncryptedNote[] = []
    let syncedHeight = startHeight

    // Sync in batches
    while (syncedHeight < currentHeight) {
      if (options.signal?.aborted) {
        throw new Error('Sync aborted')
      }

      const endHeight = syncedHeight + batchSize > currentHeight
        ? currentHeight
        : syncedHeight + batchSize

      const blockRange: BlockRange = {
        startBlock: syncedHeight + 1n,
        endBlock: endHeight,
        chainId,
      }

      // Scan for notes (obliviously)
      const notes = await provider.scanForNotes(viewingKey.key, blockRange)
      // Use loop to avoid stack overflow with large arrays
      for (const note of notes) {
        allNotes.push(note)
      }

      // Emit progress
      const percentComplete = Number((endHeight * 100n) / currentHeight)
      options.listener?.onProgress?.({
        chainId,
        currentBlock: endHeight,
        targetBlock: currentHeight,
        percentComplete,
        notesFound: allNotes.length,
      })

      // Emit notes found
      if (notes.length > 0) {
        options.listener?.onNotesFound?.(notes, chainId)
      }

      syncedHeight = endHeight
    }

    // Update state
    this.state = updateSyncState(this.state!, chainId, syncedHeight, allNotes)

    return allNotes
  }
}

/**
 * Create a sync manager with default configuration
 */
export function createSyncManager(
  providers: ObliviousSyncProvider | ObliviousSyncProvider[],
  config?: Partial<SyncManagerConfig>
): SyncManager {
  return new SyncManager(providers, config)
}
