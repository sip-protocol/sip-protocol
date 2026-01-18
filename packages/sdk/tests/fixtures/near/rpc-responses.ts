/**
 * NEAR RPC Response Fixtures
 *
 * Mock responses for NEAR JSON-RPC API endpoints.
 * Matches real NEAR RPC response formats for deterministic testing.
 */

import type { HexString } from '@sip-protocol/types'
import { aliceAccount, bobAccount, charlieAccount } from './accounts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NEARAccountView {
  amount: string
  locked: string
  code_hash: string
  storage_usage: number
  storage_paid_at: number
  block_height: number
  block_hash: string
}

export interface NEARAccessKey {
  nonce: number
  permission: 'FullAccess' | { FunctionCall: { allowance: string; receiver_id: string; method_names: string[] } }
}

export interface NEARAccessKeyView {
  access_key: NEARAccessKey
  public_key: string
  block_height: number
  block_hash: string
}

export interface NEARTransactionResult {
  status: { SuccessValue: string } | { Failure: unknown }
  transaction: {
    signer_id: string
    public_key: string
    nonce: number
    receiver_id: string
    actions: NEARAction[]
    signature: string
    hash: string
  }
  transaction_outcome: NEARExecutionOutcome
  receipts_outcome: NEARExecutionOutcome[]
}

export interface NEARAction {
  Transfer?: { deposit: string }
  FunctionCall?: { method_name: string; args: string; gas: string; deposit: string }
  CreateAccount?: Record<string, never>
  DeployContract?: { code: string }
  AddKey?: { public_key: string; access_key: NEARAccessKey }
  DeleteKey?: { public_key: string }
  DeleteAccount?: { beneficiary_id: string }
}

export interface NEARExecutionOutcome {
  proof: unknown[]
  block_hash: string
  id: string
  outcome: {
    logs: string[]
    receipt_ids: string[]
    gas_burnt: number
    tokens_burnt: string
    executor_id: string
    status: { SuccessValue: string } | { SuccessReceiptId: string } | { Failure: unknown }
  }
}

export interface NEARBlockView {
  author: string
  header: {
    height: number
    epoch_id: string
    next_epoch_id: string
    hash: string
    prev_hash: string
    timestamp: number
    timestamp_nanosec: string
    gas_price: string
    total_supply: string
  }
  chunks: unknown[]
}

// ─── Mock Account Responses ───────────────────────────────────────────────────

export const mockAccountViews: Record<string, NEARAccountView> = {
  [aliceAccount.accountId]: {
    amount: aliceAccount.balance,
    locked: '0',
    code_hash: '11111111111111111111111111111111',
    storage_usage: 182,
    storage_paid_at: 0,
    block_height: 100000000,
    block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
  },
  [bobAccount.accountId]: {
    amount: bobAccount.balance,
    locked: '0',
    code_hash: '11111111111111111111111111111111',
    storage_usage: 182,
    storage_paid_at: 0,
    block_height: 100000000,
    block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
  },
  [charlieAccount.accountId]: {
    amount: charlieAccount.balance,
    locked: '0',
    code_hash: '11111111111111111111111111111111',
    storage_usage: 64,
    storage_paid_at: 0,
    block_height: 100000000,
    block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
  },
}

// ─── Mock Transaction Responses ───────────────────────────────────────────────

export const mockTransferTransaction: NEARTransactionResult = {
  status: { SuccessValue: '' },
  transaction: {
    signer_id: aliceAccount.accountId,
    public_key: aliceAccount.nearPublicKey,
    nonce: 1,
    receiver_id: bobAccount.accountId,
    actions: [{ Transfer: { deposit: '1000000000000000000000000' } }],
    signature: 'ed25519:mock_signature_alice_to_bob',
    hash: 'Hx2QZXC9skTR9PAy9mJKnVvJLFTY4xN5bM4ZwpCdKhRk',
  },
  transaction_outcome: {
    proof: [],
    block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
    id: 'Hx2QZXC9skTR9PAy9mJKnVvJLFTY4xN5bM4ZwpCdKhRk',
    outcome: {
      logs: [],
      receipt_ids: ['receipt_123'],
      gas_burnt: 424555062500,
      tokens_burnt: '42455506250000000000',
      executor_id: aliceAccount.accountId,
      status: { SuccessReceiptId: 'receipt_123' },
    },
  },
  receipts_outcome: [
    {
      proof: [],
      block_hash: 'FBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz5678',
      id: 'receipt_123',
      outcome: {
        logs: [],
        receipt_ids: [],
        gas_burnt: 424555062500,
        tokens_burnt: '42455506250000000000',
        executor_id: bobAccount.accountId,
        status: { SuccessValue: '' },
      },
    },
  ],
}

// ─── Mock NEP-141 Token Responses ─────────────────────────────────────────────

export const mockNEP141Responses = {
  ft_balance_of: {
    [aliceAccount.accountId]: '1000000000', // 1000 USDC (6 decimals)
    [bobAccount.accountId]: '500000000', // 500 USDC
    [charlieAccount.accountId]: '100000000', // 100 USDC
  },
  ft_metadata: {
    spec: 'ft-1.0.0',
    name: 'USD Coin',
    symbol: 'USDC',
    icon: null,
    reference: null,
    reference_hash: null,
    decimals: 6,
  },
  ft_total_supply: '1000000000000000', // 1B USDC
}

// ─── Mock Block Responses ─────────────────────────────────────────────────────

export const mockBlockResponse: NEARBlockView = {
  author: 'validator.poolv1.near',
  header: {
    height: 100000000,
    epoch_id: 'epoch_123',
    next_epoch_id: 'epoch_124',
    hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
    prev_hash: 'DBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1233',
    timestamp: 1700000000000000000,
    timestamp_nanosec: '1700000000000000000',
    gas_price: '100000000',
    total_supply: '1000000000000000000000000000000000',
  },
  chunks: [],
}

// ─── Stealth Payment Fixtures ─────────────────────────────────────────────────

export interface MockStealthPaymentAnnouncement {
  /** Transaction hash containing the announcement */
  txHash: string
  /** Stealth address (NEAR implicit account) */
  stealthAddress: string
  /** Ephemeral public key (hex) */
  ephemeralPublicKey: HexString
  /** Encrypted amount/metadata */
  encryptedPayload: string
  /** Block height */
  blockHeight: number
  /** Timestamp (nanoseconds) */
  timestamp: string
  /** Token (native NEAR or NEP-141) */
  token: string
  /** Amount in smallest units */
  amount: string
}

export const mockStealthAnnouncements: MockStealthPaymentAnnouncement[] = [
  {
    txHash: 'Stealth1QZXC9skTR9PAy9mJKnVvJLFTY4xN5bM4ZwpCdKhRk',
    stealthAddress: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    ephemeralPublicKey: '0xf1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2' as HexString,
    encryptedPayload: 'base64_encrypted_data_here',
    blockHeight: 100000001,
    timestamp: '1700000001000000000',
    token: 'NEAR',
    amount: '1000000000000000000000000', // 1 NEAR
  },
  {
    txHash: 'Stealth2QZXC9skTR9PAy9mJKnVvJLFTY4xN5bM4ZwpCdKhRk',
    stealthAddress: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    ephemeralPublicKey: '0xe2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3' as HexString,
    encryptedPayload: 'base64_encrypted_usdc_data',
    blockHeight: 100000002,
    timestamp: '1700000002000000000',
    token: 'usdc.near',
    amount: '5000000', // 5 USDC
  },
]

// ─── Mock RPC Handler ─────────────────────────────────────────────────────────

export interface MockRPCRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params: unknown
}

export interface MockRPCResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * Create a mock RPC handler for testing
 */
export function createMockRPCHandler(overrides?: Record<string, unknown>) {
  return async (request: MockRPCRequest): Promise<MockRPCResponse> => {
    const { method, params, id } = request

    // Check for overrides first
    if (overrides?.[method]) {
      return { jsonrpc: '2.0', id, result: overrides[method] }
    }

    switch (method) {
      case 'query': {
        const queryParams = params as { request_type: string; account_id?: string; finality?: string }

        if (queryParams.request_type === 'view_account') {
          const accountView = mockAccountViews[queryParams.account_id || '']
          if (accountView) {
            return { jsonrpc: '2.0', id, result: accountView }
          }
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: `account ${queryParams.account_id} does not exist` },
          }
        }

        if (queryParams.request_type === 'view_access_key') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              access_key: { nonce: 1, permission: 'FullAccess' },
              block_height: 100000000,
              block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
            },
          }
        }

        return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown request_type' } }
      }

      case 'block': {
        return { jsonrpc: '2.0', id, result: mockBlockResponse }
      }

      case 'broadcast_tx_commit': {
        return { jsonrpc: '2.0', id, result: mockTransferTransaction }
      }

      case 'broadcast_tx_async': {
        return { jsonrpc: '2.0', id, result: mockTransferTransaction.transaction.hash }
      }

      case 'tx': {
        return { jsonrpc: '2.0', id, result: mockTransferTransaction }
      }

      case 'gas_price': {
        return { jsonrpc: '2.0', id, result: { gas_price: '100000000' } }
      }

      case 'status': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            chain_id: 'testnet',
            sync_info: {
              latest_block_height: 100000000,
              latest_block_hash: 'EBkJ9Pc2cMBDCBxvT6iNF5sLhZiZXp7GztBCcKCz1234',
              latest_block_time: '2023-11-15T00:00:00.000000000Z',
              syncing: false,
            },
          },
        }
      }

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
    }
  }
}

// ─── Error Fixtures ───────────────────────────────────────────────────────────

export const mockRPCErrors = {
  accountNotFound: (accountId: string) => ({
    code: -32000,
    message: `account ${accountId} does not exist while viewing`,
    data: 'AccountDoesNotExist',
  }),
  invalidTransaction: {
    code: -32000,
    message: 'Invalid transaction',
    data: { TxExecutionError: { InvalidTxError: 'InvalidNonce' } },
  },
  timeout: {
    code: -32000,
    message: 'Timeout',
    data: 'Timeout',
  },
  insufficientFunds: {
    code: -32000,
    message: 'Insufficient funds',
    data: { TxExecutionError: { InvalidTxError: 'NotEnoughBalance' } },
  },
}
