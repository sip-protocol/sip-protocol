/**
 * Ethereum Test Fixtures
 *
 * Centralized exports for all Ethereum testing fixtures.
 * Import from this file for consistent test setup.
 *
 * @example
 * ```typescript
 * import {
 *   aliceAccount,
 *   bobAccount,
 *   createMockRpcHandler,
 *   USDC,
 *   ANVIL_CONFIG,
 * } from '../fixtures/ethereum'
 * ```
 */

// ── Accounts ──────────────────────────────────────────────────────────────────

export {
  // Types
  type EthereumTestAccount,
  type EthereumStealthTestAccount,
  type EphemeralKeypair,
  type DerivedStealthAddress,
  // Pre-generated accounts
  aliceAccount,
  bobAccount,
  charlieAccount,
  auditorAccount,
  solverAccount,
  deployerAccount,
  testAccounts,
  stealthAccounts,
  // Ephemeral keys
  ephemeralKeypairs,
  generateEphemeralKeypair,
  // Stealth derivation
  deriveStealthAddress,
  computeViewTag,
  // Batch generation
  generateTestAccounts,
  generateStealthAccounts,
  // Utilities
  getPrivateKeyBytes,
  getPublicKeyBytes,
  signWithAccount,
  verifyWithAccount,
  // Constants
  WEI,
  GWEI,
  ETH,
  MIN_BALANCE,
  STANDARD_GAS_PRICE,
  ETH_TRANSFER_GAS,
  ERC20_TRANSFER_GAS,
  STEALTH_ANNOUNCE_GAS,
} from './accounts'

// ── Contracts ─────────────────────────────────────────────────────────────────

export {
  // Types
  type MockERC20Token,
  type MockTokenBalance,
  type StealthAnnouncerContract,
  type StealthAnnouncement,
  // Mainnet tokens
  USDC,
  USDT,
  DAI,
  WETH,
  UNI,
  // Test tokens
  TEST_USDC,
  TEST_TOKEN_18,
  TEST_TOKEN_0,
  TEST_TOKEN_8,
  // Token collections
  mainnetTokens,
  testTokens,
  allTokens,
  // Announcer contracts
  MAINNET_ANNOUNCER,
  SEPOLIA_ANNOUNCER,
  LOCAL_ANNOUNCER,
  ARBITRUM_ANNOUNCER,
  OPTIMISM_ANNOUNCER,
  BASE_ANNOUNCER,
  POLYGON_ANNOUNCER,
  announcerContracts,
  // Announcement factories
  createMockAnnouncement,
  createMockAnnouncementBatch,
  // Token balance utilities
  createMockTokenBalances,
  aliceTokenBalances,
  bobTokenBalances,
  // Amount utilities
  toRawAmount,
  fromRawAmount,
  formatTokenAmount,
  parseTokenAmount,
  // ABI
  ANNOUNCER_ABI,
  ERC20_ABI,
} from './contracts'

// ── Network ───────────────────────────────────────────────────────────────────

export {
  // Types
  type NetworkConfig,
  type AnvilConfig,
  type HardhatConfig,
  type MockRpcResponse,
  type SyncMockRpcHandler,
  type AsyncMockRpcHandler,
  type MockRpcHandler,
  type MockBlock,
  type MockTransaction,
  type MockTransactionReceipt,
  type MockLog,
  type TestEnvironmentConfig,
  // Network configs
  ANVIL_CONFIG,
  HARDHAT_CONFIG,
  SEPOLIA_CONFIG,
  MAINNET_CONFIG,
  ARBITRUM_CONFIG,
  OPTIMISM_CONFIG,
  BASE_CONFIG,
  POLYGON_CONFIG,
  networkConfigs,
  // RPC handlers
  defaultMockResponses,
  createMockRpcHandler,
  createMockRpcHandlerWithLatency,
  // Block fixtures
  createMockBlock,
  // Transaction fixtures
  createMockEthTransfer,
  createMockReceipt,
  // Announcement log fixtures
  ANNOUNCEMENT_EVENT_TOPIC,
  createMockAnnouncementLog,
  // Test environment
  defaultTestEnvironment,
  isNetworkAvailable,
  describeIfNetwork,
} from './network'

// ── Composite Fixtures ────────────────────────────────────────────────────────

import { aliceAccount, bobAccount, charlieAccount, ephemeralKeypairs, deriveStealthAddress } from './accounts'
import { TEST_USDC, aliceTokenBalances, bobTokenBalances, LOCAL_ANNOUNCER } from './contracts'
import { ANVIL_CONFIG, createMockRpcHandler } from './network'

/**
 * Complete test environment setup
 * Returns all commonly needed fixtures in one call
 */
export function createTestEnvironment() {
  const rpcHandler = createMockRpcHandler()

  return {
    // Network
    network: ANVIL_CONFIG,
    rpcHandler,

    // Users
    alice: {
      account: aliceAccount,
      tokenBalances: aliceTokenBalances,
      ethBalance: aliceAccount.balance,
    },
    bob: {
      account: bobAccount,
      tokenBalances: bobTokenBalances,
      ethBalance: bobAccount.balance,
    },
    charlie: {
      account: charlieAccount,
      tokenBalances: [],
      ethBalance: charlieAccount.balance,
    },

    // Common tokens
    tokens: {
      usdc: TEST_USDC,
    },

    // Contracts
    announcer: LOCAL_ANNOUNCER,

    // Ephemeral keys
    ephemeralKeys: ephemeralKeypairs,
  }
}

/**
 * Minimal test setup for quick unit tests
 */
export function createMinimalTestEnvironment() {
  return {
    sender: aliceAccount,
    receiver: bobAccount,
    ephemeralKey: ephemeralKeypairs.tx1,
  }
}

/**
 * Create a stealth payment scenario between Alice and Bob
 */
export function createStealthPaymentScenario() {
  const sender = aliceAccount
  const receiver = bobAccount
  const ephemeral = ephemeralKeypairs.tx1

  const stealthResult = deriveStealthAddress(
    ephemeral.privateKey,
    receiver.spendingPublicKey,
    receiver.viewingPublicKey
  )

  return {
    sender,
    receiver,
    ephemeral,
    stealthAddress: stealthResult.stealthAddress,
    ephemeralPublicKey: stealthResult.ephemeralPublicKey,
    viewTag: stealthResult.viewTag,
  }
}
