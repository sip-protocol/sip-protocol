/**
 * NEAR Fixtures Tests
 *
 * Validates that NEAR test fixtures are correctly structured and usable.
 */

import { describe, it, expect } from 'vitest'
import {
  // Accounts
  aliceAccount,
  bobAccount,
  charlieAccount,
  aliceStealthAccount,
  bobStealthAccount,
  generateStealthTestAccount,
  generateTestAccounts,
  generateStealthAddressForRecipient,
  ONE_NEAR,
  BASIC_GAS,
  // RPC Responses
  mockAccountViews,
  mockTransferTransaction,
  mockNEP141Responses,
  mockBlockResponse,
  mockStealthAnnouncements,
  createMockRPCHandler,
  mockRPCErrors,
} from './index'
import { isValidNearImplicitAddress, isValidNearAccountId } from '../../../src/stealth'

describe('NEAR Test Fixtures', () => {
  // ─── Account Fixtures ───────────────────────────────────────────────────────

  describe('Test Accounts', () => {
    it('should have valid named accounts', () => {
      expect(aliceAccount.accountId).toBe('alice.testnet')
      expect(bobAccount.accountId).toBe('bob.testnet')
      expect(isValidNearAccountId(aliceAccount.accountId)).toBe(true)
      expect(isValidNearAccountId(bobAccount.accountId)).toBe(true)
    })

    it('should have valid implicit account', () => {
      expect(charlieAccount.accountId.length).toBe(64)
      expect(isValidNearImplicitAddress(charlieAccount.accountId)).toBe(true)
    })

    it('should have consistent key formats', () => {
      expect(aliceAccount.publicKey.startsWith('0x')).toBe(true)
      expect(aliceAccount.privateKey.startsWith('0x')).toBe(true)
      expect(aliceAccount.nearPublicKey.startsWith('ed25519:')).toBe(true)
    })

    it('should have valid balances', () => {
      expect(BigInt(aliceAccount.balance)).toBeGreaterThan(0n)
      expect(BigInt(bobAccount.balance)).toBeGreaterThan(0n)
    })
  })

  describe('Stealth Accounts', () => {
    it('should have valid stealth meta-addresses', () => {
      expect(aliceStealthAccount.metaAddress).toBeDefined()
      expect(aliceStealthAccount.metaAddress.spendingKey).toBeDefined()
      expect(aliceStealthAccount.metaAddress.viewingKey).toBeDefined()
    })

    it('should have matching public keys', () => {
      expect(aliceStealthAccount.spendingPublicKey).toBe(aliceStealthAccount.metaAddress.spendingKey)
      expect(aliceStealthAccount.viewingPublicKey).toBe(aliceStealthAccount.metaAddress.viewingKey)
    })

    it('should derive valid implicit addresses', () => {
      expect(isValidNearImplicitAddress(aliceStealthAccount.accountId)).toBe(true)
      expect(isValidNearImplicitAddress(bobStealthAccount.accountId)).toBe(true)
    })
  })

  describe('Account Generators', () => {
    it('should generate stealth test accounts', () => {
      const account = generateStealthTestAccount('test-account')

      expect(account.metaAddress).toBeDefined()
      expect(account.spendingPrivateKey).toBeDefined()
      expect(account.viewingPrivateKey).toBeDefined()
      expect(isValidNearImplicitAddress(account.accountId)).toBe(true)
    })

    it('should generate batch of test accounts', () => {
      const accounts = generateTestAccounts(5)

      expect(accounts).toHaveLength(5)
      accounts.forEach(acc => {
        expect(isValidNearImplicitAddress(acc.accountId)).toBe(true)
      })
    })

    it('should generate stealth addresses for recipients', () => {
      const result = generateStealthAddressForRecipient(bobStealthAccount.metaAddress)

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.address).toBeDefined()
      expect(result.stealthAddress.ephemeralPublicKey).toBeDefined()
      expect(result.sharedSecret).toBeDefined()
    })
  })

  // ─── RPC Response Fixtures ──────────────────────────────────────────────────

  describe('Mock Account Views', () => {
    it('should have account views for all test accounts', () => {
      expect(mockAccountViews[aliceAccount.accountId]).toBeDefined()
      expect(mockAccountViews[bobAccount.accountId]).toBeDefined()
      expect(mockAccountViews[charlieAccount.accountId]).toBeDefined()
    })

    it('should have correct account structure', () => {
      const aliceView = mockAccountViews[aliceAccount.accountId]

      expect(aliceView.amount).toBe(aliceAccount.balance)
      expect(aliceView.locked).toBe('0')
      expect(aliceView.storage_usage).toBeGreaterThan(0)
      expect(aliceView.block_height).toBeGreaterThan(0)
    })
  })

  describe('Mock Transaction', () => {
    it('should have valid transaction structure', () => {
      expect(mockTransferTransaction.transaction).toBeDefined()
      expect(mockTransferTransaction.transaction_outcome).toBeDefined()
      expect(mockTransferTransaction.receipts_outcome).toHaveLength(1)
    })

    it('should have transfer action', () => {
      const action = mockTransferTransaction.transaction.actions[0]
      expect(action.Transfer).toBeDefined()
      expect(BigInt(action.Transfer!.deposit)).toBeGreaterThan(0n)
    })

    it('should show success status', () => {
      expect(mockTransferTransaction.status).toHaveProperty('SuccessValue')
    })
  })

  describe('Mock NEP-141 Responses', () => {
    it('should have token balances', () => {
      expect(mockNEP141Responses.ft_balance_of[aliceAccount.accountId]).toBeDefined()
      expect(BigInt(mockNEP141Responses.ft_balance_of[aliceAccount.accountId])).toBeGreaterThan(0n)
    })

    it('should have token metadata', () => {
      expect(mockNEP141Responses.ft_metadata.symbol).toBe('USDC')
      expect(mockNEP141Responses.ft_metadata.decimals).toBe(6)
    })
  })

  describe('Mock Block Response', () => {
    it('should have valid block structure', () => {
      expect(mockBlockResponse.header.height).toBeGreaterThan(0)
      expect(mockBlockResponse.header.hash).toBeDefined()
      expect(mockBlockResponse.header.gas_price).toBeDefined()
    })
  })

  describe('Stealth Announcements', () => {
    it('should have mock stealth announcements', () => {
      expect(mockStealthAnnouncements).toHaveLength(2)
    })

    it('should have valid announcement structure', () => {
      const announcement = mockStealthAnnouncements[0]

      expect(announcement.txHash).toBeDefined()
      expect(isValidNearImplicitAddress(announcement.stealthAddress)).toBe(true)
      expect(announcement.ephemeralPublicKey.startsWith('0x')).toBe(true)
      expect(BigInt(announcement.amount)).toBeGreaterThan(0n)
    })

    it('should have both NEAR and token announcements', () => {
      const tokens = mockStealthAnnouncements.map(a => a.token)
      expect(tokens).toContain('NEAR')
      expect(tokens).toContain('usdc.near')
    })
  })

  // ─── Mock RPC Handler ───────────────────────────────────────────────────────

  describe('Mock RPC Handler', () => {
    it('should handle view_account requests', async () => {
      const handler = createMockRPCHandler()
      const response = await handler({
        jsonrpc: '2.0',
        id: 1,
        method: 'query',
        params: { request_type: 'view_account', account_id: aliceAccount.accountId },
      })

      expect(response.result).toBeDefined()
      expect(response.error).toBeUndefined()
    })

    it('should return error for non-existent account', async () => {
      const handler = createMockRPCHandler()
      const response = await handler({
        jsonrpc: '2.0',
        id: 1,
        method: 'query',
        params: { request_type: 'view_account', account_id: 'nonexistent.testnet' },
      })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('does not exist')
    })

    it('should handle block requests', async () => {
      const handler = createMockRPCHandler()
      const response = await handler({
        jsonrpc: '2.0',
        id: 1,
        method: 'block',
        params: { finality: 'final' },
      })

      expect(response.result).toBeDefined()
    })

    it('should handle broadcast_tx_commit', async () => {
      const handler = createMockRPCHandler()
      const response = await handler({
        jsonrpc: '2.0',
        id: 1,
        method: 'broadcast_tx_commit',
        params: ['signed_tx_base64'],
      })

      expect(response.result).toBeDefined()
    })

    it('should support custom overrides', async () => {
      const customBalance = '999999999999999999999999999'
      const handler = createMockRPCHandler({
        query: { amount: customBalance, locked: '0' },
      })

      const response = await handler({
        jsonrpc: '2.0',
        id: 1,
        method: 'query',
        params: { request_type: 'view_account', account_id: 'any.testnet' },
      })

      expect((response.result as { amount: string }).amount).toBe(customBalance)
    })
  })

  // ─── Error Fixtures ─────────────────────────────────────────────────────────

  describe('Error Fixtures', () => {
    it('should generate account not found error', () => {
      const error = mockRPCErrors.accountNotFound('missing.testnet')

      expect(error.code).toBe(-32000)
      expect(error.message).toContain('missing.testnet')
      expect(error.message).toContain('does not exist')
    })

    it('should have invalid transaction error', () => {
      expect(mockRPCErrors.invalidTransaction.code).toBe(-32000)
      expect(mockRPCErrors.invalidTransaction.data).toBeDefined()
    })

    it('should have insufficient funds error', () => {
      expect(mockRPCErrors.insufficientFunds.message).toContain('Insufficient')
    })
  })

  // ─── Constants ──────────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have correct ONE_NEAR value', () => {
      expect(ONE_NEAR).toBe('1000000000000000000000000')
      expect(BigInt(ONE_NEAR)).toBe(10n ** 24n)
    })

    it('should have reasonable gas values', () => {
      expect(BigInt(BASIC_GAS)).toBeGreaterThan(0n)
      expect(BigInt(BASIC_GAS)).toBeLessThan(10n ** 15n) // Less than 1 PGas
    })
  })
})
