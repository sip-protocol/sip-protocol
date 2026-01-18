/**
 * Solana Test Fixtures
 *
 * Centralized exports for all Solana testing fixtures.
 * Import from this file for consistent test setup.
 *
 * @example
 * ```typescript
 * import {
 *   aliceKeypair,
 *   bobKeypair,
 *   createMockConnection,
 *   stealthSolTransfer,
 *   USDC,
 * } from '../fixtures/solana'
 * ```
 */

// ── Keypairs ───────────────────────────────────────────────────────────────

export {
  // Pre-generated keypairs
  aliceKeypair,
  bobKeypair,
  charlieKeypair,
  auditorKeypair,
  solverKeypair,
  testKeypairs,
  ephemeralKeypairs,
  // Types
  type TestKeypair,
  type TestStealthKeypair,
  // Factories
  generateEphemeralKeypair,
  deriveStealthAddress,
  generateTestKeypairs,
  generateStealthKeypairs,
  // Utilities
  getPrivateKeyBytes,
  getPublicKeyBytes,
  signWithKeypair,
  verifyWithKeypair,
} from './keypairs'

// ── RPC Responses ──────────────────────────────────────────────────────────

export {
  // Account info
  mockAccountInfoResponses,
  type MockAccountInfo,
  // Transactions
  mockTransactionResponses,
  type MockTransactionMeta,
  type MockParsedTransaction,
  // Signatures
  mockSignatureResponses,
  type MockSignatureInfo,
  // Blocks
  mockBlockResponses,
  // Stealth-specific
  mockStealthResponses,
  type MockStealthPaymentInfo,
  // Factories
  createMockRpcHandler,
  createMockConnection,
} from './rpc-responses'

// ── Transactions ───────────────────────────────────────────────────────────

export {
  // Types
  type MockTransactionData,
  type MockStealthTransactionData,
  type MockStealthAnnouncementData,
  // Pre-built transactions
  solTransferAliceToBob,
  splTransferAliceToBob,
  stealthSolTransfer,
  stealthSplTransfer,
  bobMetaAddressAnnouncement,
  // Sequences
  sendFlowSequence,
  receiveFlowSequence,
  viewingKeyDisclosureSequence,
  // Factories
  createSolTransfer,
  createSplTransfer,
  createStealthTransfer,
  generateTransactionBatch,
} from './transactions'

// ── Tokens ─────────────────────────────────────────────────────────────────

export {
  // Types
  type MockTokenMint,
  type MockTokenAccount,
  // Well-known tokens
  USDC,
  USDT,
  WSOL,
  BONK,
  // Test tokens
  TEST_USDC,
  TEST_TOKEN_9,
  TEST_TOKEN_0,
  TEST_TOKEN_18,
  // Collections
  mainnetTokens,
  testTokens,
  allTokens,
  // Account factories
  createMockTokenAccount,
  createWalletTokenAccounts,
  // Pre-built accounts
  aliceTokenAccounts,
  bobTokenAccounts,
  charlieTokenAccounts,
  // Utilities
  toRawAmount,
  fromRawAmount,
  formatTokenAmount,
  parseTokenAmount,
  isKnownMint,
  getTokenByAddress,
  getTokenBySymbol,
} from './tokens'

// ── Composite Fixtures ─────────────────────────────────────────────────────

import { aliceKeypair, bobKeypair, charlieKeypair } from './keypairs'
import { createMockConnection, createMockRpcHandler } from './rpc-responses'
import { aliceTokenAccounts, bobTokenAccounts, USDC, TEST_USDC } from './tokens'

/**
 * Complete test environment setup
 * Returns all commonly needed fixtures in one call
 */
export function createTestEnvironment() {
  const rpcHandler = createMockRpcHandler()
  const connection = createMockConnection(rpcHandler)

  return {
    // Connection
    connection,
    rpcHandler,

    // Users
    alice: {
      keypair: aliceKeypair,
      tokenAccounts: aliceTokenAccounts,
      solBalance: 10_000_000_000n, // 10 SOL
    },
    bob: {
      keypair: bobKeypair,
      tokenAccounts: bobTokenAccounts,
      solBalance: 5_000_000_000n, // 5 SOL
    },
    charlie: {
      keypair: charlieKeypair,
      tokenAccounts: [],
      solBalance: 1_000_000_000n, // 1 SOL
    },

    // Common tokens
    tokens: {
      usdc: USDC,
      testUsdc: TEST_USDC,
    },
  }
}

/**
 * Minimal test setup for quick unit tests
 */
export function createMinimalTestEnvironment() {
  return {
    connection: createMockConnection(),
    sender: aliceKeypair,
    receiver: bobKeypair,
  }
}
