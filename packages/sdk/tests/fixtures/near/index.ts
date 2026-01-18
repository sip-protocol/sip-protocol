/**
 * NEAR Test Fixtures
 *
 * Centralized exports for all NEAR testing fixtures.
 * Import from this file for consistent test setup.
 *
 * @example
 * ```typescript
 * import {
 *   aliceAccount,
 *   bobAccount,
 *   createMockRPCHandler,
 *   mockStealthAnnouncements,
 * } from '../fixtures/near'
 * ```
 */

// ── Accounts ──────────────────────────────────────────────────────────────────

export {
  // Test accounts
  aliceAccount,
  bobAccount,
  charlieAccount,
  auditorAccount,
  solverAccount,
  testAccounts,
  // Stealth accounts
  aliceStealthAccount,
  bobStealthAccount,
  stealthAccounts,
  // Factory functions
  generateStealthTestAccount,
  generateTestAccounts,
  generateStealthAddressForRecipient,
  // Constants
  YOCTO_NEAR,
  ONE_NEAR,
  STORAGE_COST_PER_BYTE,
  MIN_ACCOUNT_BALANCE,
  BASIC_GAS,
  CONTRACT_CALL_GAS,
  // Types
  type NEARTestAccount,
  type NEARStealthTestAccount,
} from './accounts'

// ── RPC Responses ─────────────────────────────────────────────────────────────

export {
  // Account views
  mockAccountViews,
  // Transaction responses
  mockTransferTransaction,
  // NEP-141 token responses
  mockNEP141Responses,
  // Block responses
  mockBlockResponse,
  // Stealth payment fixtures
  mockStealthAnnouncements,
  // Mock RPC handler
  createMockRPCHandler,
  // Error fixtures
  mockRPCErrors,
  // Types
  type NEARAccountView,
  type NEARAccessKey,
  type NEARAccessKeyView,
  type NEARTransactionResult,
  type NEARAction,
  type NEARExecutionOutcome,
  type NEARBlockView,
  type MockStealthPaymentAnnouncement,
  type MockRPCRequest,
  type MockRPCResponse,
} from './rpc-responses'
