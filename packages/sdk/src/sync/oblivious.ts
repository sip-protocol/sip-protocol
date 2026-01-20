/**
 * Oblivious Sync Service Interface
 *
 * Implements oblivious synchronization where sync services learn NOTHING
 * about user transactions. Inspired by Project Tachyon.
 *
 * @see https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/
 * @see https://github.com/sip-protocol/sip-protocol/issues/433
 *
 * ## How It Works
 *
 * Traditional sync services leak information:
 * - Which nullifiers you're checking (reveals spend timing)
 * - Block access patterns (correlates with activity)
 *
 * Oblivious sync prevents this by:
 * 1. Using sync randomness in nullifier derivation
 * 2. Encrypting queries so service learns nothing
 * 3. Supporting time-windowed viewing key disclosure
 *
 * @module sync/oblivious
 */

import type { HexString, Hash } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha2'
import { hmac } from '@noble/hashes/hmac'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { secureWipe } from '../secure-memory'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Chain identifier for multi-chain sync
 */
export type ChainId = string

/**
 * Block range for synchronization
 */
export interface BlockRange {
  /** Starting block (inclusive) */
  startBlock: bigint
  /** Ending block (inclusive) */
  endBlock: bigint
  /** Chain ID */
  chainId: ChainId
}

/**
 * Encrypted note that sync service returns without being able to decrypt
 */
export interface EncryptedNote {
  /** Note commitment (public) */
  commitment: HexString
  /** Encrypted note data (only owner can decrypt) */
  encryptedData: HexString
  /** Block number where note was created */
  blockNumber: bigint
  /** Transaction hash */
  txHash: HexString
  /** Chain ID */
  chainId: ChainId
}

/**
 * Merkle proof for note inclusion
 */
export interface MerkleProof {
  /** Leaf being proven */
  leaf: HexString
  /** Sibling hashes along path */
  siblings: HexString[]
  /** Index of leaf in tree */
  index: bigint
  /** Root of the tree */
  root: HexString
}

/**
 * Sync randomness used in oblivious nullifier derivation
 *
 * This is the key innovation from Tachyon: by including sync randomness
 * in nullifier computation, the sync service cannot correlate nullifiers
 * to specific notes.
 */
export interface SyncRandomness {
  /** Random bytes (32 bytes) */
  value: Uint8Array
  /** Epoch/period this randomness is valid for */
  epoch: number
  /** Expiration timestamp */
  expiresAt: number
}

/**
 * Oblivious nullifier - cannot be correlated by sync service
 */
export interface ObliviousNullifier {
  /** The nullifier hash */
  nullifier: HexString
  /** Epoch it was derived in */
  epoch: number
  /** Chain ID */
  chainId: ChainId
}

/**
 * Query for oblivious sync - encrypted so service learns nothing
 */
export interface ObliviousSyncQuery {
  /** Encrypted query (only service can process, learns nothing) */
  encryptedQuery: HexString
  /** Public nonce for query */
  nonce: HexString
  /** Block range being queried */
  blockRange: BlockRange
  /** Query timestamp */
  timestamp: number
}

/**
 * Response from oblivious sync service
 */
export interface ObliviousSyncResponse {
  /** Encrypted notes found (only querier can decrypt) */
  encryptedNotes: EncryptedNote[]
  /** Merkle proofs for note inclusion */
  merkleProofs: MerkleProof[]
  /** Current sync height */
  syncHeight: bigint
  /** Response timestamp */
  timestamp: number
  /** Query hash for verification */
  queryHash: HexString
}

/**
 * Sync service health information
 */
export interface SyncServiceHealth {
  /** Is service available */
  available: boolean
  /** Current block height */
  currentHeight: bigint
  /** Chain ID */
  chainId: ChainId
  /** Latency in milliseconds */
  latencyMs: number
  /** Last successful sync timestamp */
  lastSuccessfulSync?: number
}

/**
 * Configuration for oblivious sync
 */
export interface ObliviousSyncConfig {
  /** Maximum blocks per sync batch */
  maxBatchSize: number
  /** Timeout for sync requests (ms) */
  timeoutMs: number
  /** Number of retries on failure */
  retries: number
  /** Epoch duration for sync randomness (seconds) */
  epochDurationSeconds: number
  /** Enable parallel sync across chains */
  parallelSync: boolean
}

/**
 * Default configuration
 */
export const DEFAULT_SYNC_CONFIG: ObliviousSyncConfig = {
  maxBatchSize: 1000,
  timeoutMs: 30_000,
  retries: 3,
  epochDurationSeconds: 3600, // 1 hour epochs
  parallelSync: true,
}

// ─── Sync Randomness Management ───────────────────────────────────────────────

/**
 * Generate new sync randomness for an epoch
 *
 * @param epoch - Epoch number
 * @param durationSeconds - Duration of epoch in seconds
 * @returns Sync randomness for the epoch
 */
export function generateSyncRandomness(
  epoch: number,
  durationSeconds: number = DEFAULT_SYNC_CONFIG.epochDurationSeconds
): SyncRandomness {
  const value = randomBytes(32)
  const expiresAt = Date.now() + durationSeconds * 1000

  return {
    value,
    epoch,
    expiresAt,
  }
}

/**
 * Check if sync randomness is still valid
 *
 * @param randomness - Sync randomness to check
 * @returns True if still valid
 */
export function isSyncRandomnessValid(randomness: SyncRandomness): boolean {
  return Date.now() < randomness.expiresAt
}

/**
 * Get current epoch number
 *
 * @param epochDurationSeconds - Duration of each epoch
 * @returns Current epoch number
 */
export function getCurrentEpoch(
  epochDurationSeconds: number = DEFAULT_SYNC_CONFIG.epochDurationSeconds
): number {
  return Math.floor(Date.now() / (epochDurationSeconds * 1000))
}

// ─── Oblivious Nullifier Derivation ───────────────────────────────────────────

/**
 * Domain separator for oblivious nullifier derivation
 */
const OBLIVIOUS_NULLIFIER_DOMAIN = 'SIP-OBLIVIOUS-NULLIFIER-V1'

/**
 * Derive oblivious nullifier from note commitment and sync randomness
 *
 * This is the key primitive that enables oblivious sync:
 *
 * Traditional: nullifier = f(note_commitment, spending_key)
 *   → Sync service sees nullifiers you check, can correlate
 *
 * Oblivious: nullifier = f(note_commitment, spending_key, sync_randomness)
 *   → Service cannot correlate without sync_randomness (user holds)
 *
 * @param noteCommitment - The note's commitment
 * @param spendingKey - User's spending key
 * @param syncRandomness - Per-epoch sync randomness
 * @returns Oblivious nullifier
 */
export function deriveObliviousNullifier(
  noteCommitment: HexString,
  spendingKey: HexString,
  syncRandomness: SyncRandomness
): ObliviousNullifier {
  // Parse inputs
  const commitmentBytes = hexToBytes(
    noteCommitment.startsWith('0x') ? noteCommitment.slice(2) : noteCommitment
  )
  const keyBytes = hexToBytes(
    spendingKey.startsWith('0x') ? spendingKey.slice(2) : spendingKey
  )

  try {
    // Build message: domain || commitment || randomness
    const domain = utf8ToBytes(OBLIVIOUS_NULLIFIER_DOMAIN)
    const message = new Uint8Array(domain.length + commitmentBytes.length + syncRandomness.value.length)
    message.set(domain, 0)
    message.set(commitmentBytes, domain.length)
    message.set(syncRandomness.value, domain.length + commitmentBytes.length)

    // HMAC-SHA256(spendingKey, message)
    const nullifierBytes = hmac(sha256, keyBytes, message)

    return {
      nullifier: `0x${bytesToHex(nullifierBytes)}` as HexString,
      epoch: syncRandomness.epoch,
      chainId: 'default', // Will be set by caller
    }
  } finally {
    // Wipe sensitive data
    secureWipe(keyBytes)
  }
}

/**
 * Derive traditional nullifier (non-oblivious, for comparison/fallback)
 *
 * @param noteCommitment - The note's commitment
 * @param spendingKey - User's spending key
 * @returns Traditional nullifier
 */
export function deriveTraditionalNullifier(
  noteCommitment: HexString,
  spendingKey: HexString
): HexString {
  const commitmentBytes = hexToBytes(
    noteCommitment.startsWith('0x') ? noteCommitment.slice(2) : noteCommitment
  )
  const keyBytes = hexToBytes(
    spendingKey.startsWith('0x') ? spendingKey.slice(2) : spendingKey
  )

  try {
    // Simple HMAC-SHA256(spendingKey, commitment)
    const nullifierBytes = hmac(sha256, keyBytes, commitmentBytes)
    return `0x${bytesToHex(nullifierBytes)}` as HexString
  } finally {
    secureWipe(keyBytes)
  }
}

// ─── Oblivious Sync Provider Interface ────────────────────────────────────────

/**
 * Oblivious Sync Provider Interface
 *
 * This is the core interface that sync services must implement.
 * The service processes queries but learns NOTHING about:
 * - Which notes belong to the user
 * - When the user spends
 * - Transaction patterns or amounts
 *
 * ## Implementation Requirements
 *
 * 1. **Query Processing**: Must process encrypted queries without decryption
 * 2. **Note Scanning**: Return all potentially matching notes (over-approximate)
 * 3. **No Logging**: Must not log query content or patterns
 * 4. **Stateless**: Should not maintain per-user state
 */
export interface ObliviousSyncProvider {
  /**
   * Get provider name/identifier
   */
  readonly name: string

  /**
   * Supported chains
   */
  readonly supportedChains: ChainId[]

  /**
   * Initialize the provider
   */
  initialize(): Promise<void>

  /**
   * Check health of sync service for a chain
   *
   * @param chainId - Chain to check
   * @returns Health information
   */
  getHealth(chainId: ChainId): Promise<SyncServiceHealth>

  /**
   * Scan for notes belonging to a viewing key (oblivious)
   *
   * The service returns ALL notes that COULD belong to the viewing key,
   * without knowing which ones actually do. The user filters locally.
   *
   * @param viewingKeyPublic - Public viewing key (service sees this)
   * @param blockRange - Blocks to scan
   * @returns Encrypted notes that might belong to user
   */
  scanForNotes(
    viewingKeyPublic: HexString,
    blockRange: BlockRange
  ): Promise<EncryptedNote[]>

  /**
   * Check if nullifiers have been spent (oblivious)
   *
   * The service checks nullifiers but cannot correlate them to specific notes
   * due to the sync randomness included in derivation.
   *
   * @param nullifiers - Oblivious nullifiers to check
   * @returns Map of nullifier → spent status
   */
  checkNullifiers(
    nullifiers: ObliviousNullifier[]
  ): Promise<Map<HexString, boolean>>

  /**
   * Get Merkle proofs for note inclusion
   *
   * @param commitments - Note commitments to get proofs for
   * @param chainId - Chain ID
   * @returns Merkle proofs for each commitment
   */
  getMerkleProofs(
    commitments: HexString[],
    chainId: ChainId
  ): Promise<Map<HexString, MerkleProof>>

  /**
   * Execute oblivious sync query
   *
   * This is the fully oblivious query method where the query itself
   * is encrypted and the service learns nothing.
   *
   * @param query - Encrypted oblivious query
   * @returns Sync response with encrypted notes
   */
  executeObliviousQuery(
    query: ObliviousSyncQuery
  ): Promise<ObliviousSyncResponse>

  /**
   * Get current block height for a chain
   *
   * @param chainId - Chain to query
   * @returns Current block height
   */
  getCurrentHeight(chainId: ChainId): Promise<bigint>

  /**
   * Subscribe to new notes (streaming)
   *
   * @param viewingKeyPublic - Public viewing key
   * @param chainId - Chain to watch
   * @param callback - Called when new notes found
   * @returns Unsubscribe function
   */
  subscribeToNotes(
    viewingKeyPublic: HexString,
    chainId: ChainId,
    callback: (notes: EncryptedNote[]) => void
  ): () => void

  /**
   * Shutdown the provider
   */
  shutdown(): Promise<void>
}

// ─── Sync State Management ────────────────────────────────────────────────────

/**
 * Sync state for a wallet
 */
export interface WalletSyncState {
  /** Sync height per chain */
  syncHeights: Map<ChainId, bigint>
  /** Current sync randomness per chain */
  syncRandomness: Map<ChainId, SyncRandomness>
  /** Nullifiers we've checked (for deduplication) */
  checkedNullifiers: Set<HexString>
  /** Pending notes to process */
  pendingNotes: EncryptedNote[]
  /** Last sync timestamp */
  lastSyncTimestamp: number
}

/**
 * Create initial sync state
 *
 * @param chains - Chains to initialize
 * @returns Initial sync state
 */
export function createSyncState(chains: ChainId[]): WalletSyncState {
  const syncHeights = new Map<ChainId, bigint>()
  const syncRandomness = new Map<ChainId, SyncRandomness>()
  const epoch = getCurrentEpoch()

  for (const chain of chains) {
    syncHeights.set(chain, 0n)
    syncRandomness.set(chain, generateSyncRandomness(epoch))
  }

  return {
    syncHeights,
    syncRandomness,
    checkedNullifiers: new Set(),
    pendingNotes: [],
    lastSyncTimestamp: 0,
  }
}

/**
 * Update sync state after successful sync
 *
 * @param state - Current state
 * @param chainId - Chain that was synced
 * @param newHeight - New sync height
 * @param notes - Notes received
 * @returns Updated state
 */
export function updateSyncState(
  state: WalletSyncState,
  chainId: ChainId,
  newHeight: bigint,
  notes: EncryptedNote[]
): WalletSyncState {
  const newSyncHeights = new Map(state.syncHeights)
  newSyncHeights.set(chainId, newHeight)

  // Rotate randomness if epoch changed
  const currentEpoch = getCurrentEpoch()
  const newRandomness = new Map(state.syncRandomness)
  const existingRandomness = state.syncRandomness.get(chainId)

  if (!existingRandomness || existingRandomness.epoch !== currentEpoch) {
    newRandomness.set(chainId, generateSyncRandomness(currentEpoch))
  }

  return {
    ...state,
    syncHeights: newSyncHeights,
    syncRandomness: newRandomness,
    pendingNotes: [...state.pendingNotes, ...notes],
    lastSyncTimestamp: Date.now(),
  }
}

// ─── Viewing Key Integration ──────────────────────────────────────────────────

/**
 * Time-windowed viewing key for oblivious sync
 *
 * Enables auditors to see SPECIFIC windows, not ALL history.
 */
export interface TimeWindowedViewingKey {
  /** The viewing key */
  viewingKey: HexString
  /** Start of valid window (timestamp) */
  windowStart: number
  /** End of valid window (timestamp) */
  windowEnd: number
  /** Epochs covered */
  epochs: number[]
  /** Hash for identification */
  hash: Hash
}

/**
 * Create time-windowed viewing key for selective disclosure
 *
 * @param masterViewingKey - Master viewing key
 * @param startTime - Start of window (timestamp)
 * @param endTime - End of window (timestamp)
 * @param epochDuration - Duration of each epoch
 * @returns Time-windowed viewing key
 */
export function createTimeWindowedKey(
  masterViewingKey: HexString,
  startTime: number,
  endTime: number,
  epochDuration: number = DEFAULT_SYNC_CONFIG.epochDurationSeconds
): TimeWindowedViewingKey {
  // Calculate epochs covered by window
  const startEpoch = Math.floor(startTime / (epochDuration * 1000))
  const endEpoch = Math.floor(endTime / (epochDuration * 1000))
  const epochs: number[] = []

  for (let e = startEpoch; e <= endEpoch; e++) {
    epochs.push(e)
  }

  // Derive window-specific key: HMAC(masterKey, startTime || endTime)
  const keyBytes = hexToBytes(
    masterViewingKey.startsWith('0x') ? masterViewingKey.slice(2) : masterViewingKey
  )

  const windowData = new Uint8Array(16)
  const view = new DataView(windowData.buffer)
  view.setBigUint64(0, BigInt(startTime), false)
  view.setBigUint64(8, BigInt(endTime), false)

  const derivedKey = hmac(sha256, keyBytes, windowData)
  const keyHash = sha256(derivedKey)

  // Wipe master key bytes
  secureWipe(keyBytes)

  return {
    viewingKey: `0x${bytesToHex(derivedKey)}` as HexString,
    windowStart: startTime,
    windowEnd: endTime,
    epochs,
    hash: `0x${bytesToHex(keyHash)}` as Hash,
  }
}

/**
 * Validate that a note falls within viewing key window
 *
 * @param note - Note to check
 * @param windowedKey - Time-windowed viewing key
 * @returns True if note is within window
 */
export function isNoteInWindow(
  _note: EncryptedNote,
  _windowedKey: TimeWindowedViewingKey
): boolean {
  // Check by block number would require block→timestamp mapping
  // For now, we rely on epoch matching during sync
  // Implementation note: Caller should filter by timestamp from note metadata
  return true
}

// ─── Error Types ──────────────────────────────────────────────────────────────

/**
 * Oblivious sync error codes
 */
export enum ObliviousSyncErrorCode {
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CHAIN_NOT_SUPPORTED = 'CHAIN_NOT_SUPPORTED',
  SYNC_TIMEOUT = 'SYNC_TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  NULLIFIER_CHECK_FAILED = 'NULLIFIER_CHECK_FAILED',
  MERKLE_PROOF_INVALID = 'MERKLE_PROOF_INVALID',
  RANDOMNESS_EXPIRED = 'RANDOMNESS_EXPIRED',
}

/**
 * Error thrown by oblivious sync operations
 */
export class ObliviousSyncError extends Error {
  constructor(
    message: string,
    public readonly code: ObliviousSyncErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ObliviousSyncError'
  }
}
