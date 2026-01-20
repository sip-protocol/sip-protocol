/**
 * Oblivious Sync Module
 *
 * Provides oblivious synchronization where third-party sync services
 * learn NOTHING about user transactions.
 *
 * ## Key Features
 *
 * - **Oblivious Queries**: Service cannot see what you're querying for
 * - **Sync Randomness**: Nullifiers cannot be correlated to notes
 * - **Time-Windowed Disclosure**: Viewing keys limited to specific periods
 * - **Multi-Chain Support**: Sync across multiple chains
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   createMockSyncProvider,
 *   createSyncState,
 *   deriveObliviousNullifier,
 *   generateSyncRandomness,
 * } from '@sip-protocol/sdk'
 *
 * // Initialize sync provider
 * const provider = createMockSyncProvider()
 * await provider.initialize()
 *
 * // Create sync state
 * const state = createSyncState(['ethereum', 'solana'])
 *
 * // Generate oblivious nullifier
 * const randomness = state.syncRandomness.get('ethereum')!
 * const nullifier = deriveObliviousNullifier(
 *   noteCommitment,
 *   spendingKey,
 *   randomness
 * )
 *
 * // Check if spent (service learns nothing)
 * const spent = await provider.checkNullifiers([nullifier])
 * ```
 *
 * @module sync
 */

// Core oblivious sync types and functions
export {
  // Types
  type ChainId,
  type BlockRange,
  type EncryptedNote,
  type MerkleProof,
  type SyncRandomness,
  type ObliviousNullifier,
  type ObliviousSyncQuery,
  type ObliviousSyncResponse,
  type SyncServiceHealth,
  type ObliviousSyncConfig,
  type ObliviousSyncProvider,
  type WalletSyncState,
  type TimeWindowedViewingKey,

  // Constants
  DEFAULT_SYNC_CONFIG,

  // Sync randomness functions
  generateSyncRandomness,
  isSyncRandomnessValid,
  getCurrentEpoch,

  // Nullifier functions
  deriveObliviousNullifier,
  deriveTraditionalNullifier,

  // Sync state management
  createSyncState,
  updateSyncState,

  // Viewing key integration
  createTimeWindowedKey,
  isNoteInWindow,

  // Errors
  ObliviousSyncError,
  ObliviousSyncErrorCode,
} from './oblivious'

// Mock provider for testing
export {
  MockObliviousSyncProvider,
  createMockSyncProvider,
  DEFAULT_MOCK_CONFIG,
  type MockSyncProviderConfig,
} from './mock-provider'

// Sync manager for orchestration
export {
  SyncManager,
  createSyncManager,
  DEFAULT_MANAGER_CONFIG,
  type SyncManagerConfig,
  type SyncProgressEvent,
  type SyncCompletionEvent,
  type SyncEventListener,
  type SyncOptions,
} from './manager'
