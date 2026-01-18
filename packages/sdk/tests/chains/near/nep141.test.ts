/**
 * Tests for NEAR NEP-141 Token Privacy Module
 *
 * @module tests/chains/near/nep141
 */

import { describe, it, expect } from 'vitest'
import {
  // Privacy-wrapped transfers
  buildPrivateTokenTransferWithCommitment,
  buildPrivateTokenTransferCall,
  // Batch transfers
  buildBatchPrivateTokenTransfer,
  buildBatchStorageDeposit,
  // Storage management
  buildStorageWithdraw,
  buildStorageUnregister,
  // Token utilities
  parseTokenMetadata,
  formatTokenAmount,
  parseTokenAmount,
  // Commitment utilities
  extractCommitmentFromMemo,
  verifyCommitmentInMemo,
  // Constants
  FT_TRANSFER_CALL_GAS,
  FT_TRANSFER_CALL_TOTAL_GAS,
  // Dependencies
  generateNEARStealthMetaAddress,
  encodeNEARStealthMetaAddress,
  verifyNEP141TokenCommitment,
} from '../../../src/chains/near'

describe('NEP-141 Token Privacy', () => {
  // Generate test meta-address
  const { metaAddress } = generateNEARStealthMetaAddress()
  const encoded = encodeNEARStealthMetaAddress(metaAddress)

  describe('buildPrivateTokenTransferWithCommitment', () => {
    it('should build token transfer with amount commitment', () => {
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n, // 100 USDC
        decimals: 6,
        hideAmount: true,
      })

      expect(result.transfer).toBeDefined()
      expect(result.commitment).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)

      // Verify commitment can be opened
      expect(result.commitment?.tokenContract).toBe('usdc.near')
      expect(result.commitment?.decimals).toBe(6)
      expect(
        verifyNEP141TokenCommitment(result.commitment!, 100_000_000n)
      ).toBe(true)
    })

    it('should build token transfer without commitment', () => {
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        decimals: 6,
        hideAmount: false,
      })

      expect(result.transfer).toBeDefined()
      expect(result.commitment).toBeUndefined()
      expect(result.stealthAddress).toBeDefined()
    })

    it('should accept encoded meta-address string', () => {
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: encoded,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        decimals: 6,
      })

      expect(result.transfer).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should include commitment prefix in memo', () => {
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        decimals: 6,
        hideAmount: true,
      })

      // Check that the action includes commitment in memo
      const action = result.transfer.actions[0]
      expect(action.type).toBe('FunctionCall')

      const params = action.params as { methodName: string; args: string }
      expect(params.methodName).toBe('ft_transfer')

      const args = JSON.parse(params.args)
      expect(args.memo).toContain('|c:')
    })

    it('should include custom memo', () => {
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        decimals: 6,
        memo: 'payment for invoice #123',
      })

      const params = result.transfer.actions[0].params as { args: string }
      const args = JSON.parse(params.args)
      expect(args.memo).toContain('payment for invoice #123')
    })

    it('should throw for invalid token contract', () => {
      expect(() =>
        buildPrivateTokenTransferWithCommitment({
          recipientMetaAddress: metaAddress,
          tokenContract: 'X', // Too short
          amount: 100_000_000n,
          decimals: 6,
        })
      ).toThrow('Invalid token contract')
    })

    it('should throw for zero amount', () => {
      expect(() =>
        buildPrivateTokenTransferWithCommitment({
          recipientMetaAddress: metaAddress,
          tokenContract: 'usdc.near',
          amount: 0n,
          decimals: 6,
        })
      ).toThrow('amount must be greater than 0')
    })

    it('should throw for wrong chain in meta-address', () => {
      const wrongChain = {
        chain: 'solana' as const,
        spendingKey: metaAddress.spendingKey,
        viewingKey: metaAddress.viewingKey,
      }

      expect(() =>
        buildPrivateTokenTransferWithCommitment({
          recipientMetaAddress: wrongChain,
          tokenContract: 'usdc.near',
          amount: 100_000_000n,
          decimals: 6,
        })
      ).toThrow("Expected NEAR meta-address, got chain 'solana'")
    })
  })

  describe('buildPrivateTokenTransferCall', () => {
    it('should build ft_transfer_call with privacy', () => {
      const result = buildPrivateTokenTransferCall({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        msg: JSON.stringify({ action: 'deposit' }),
      })

      expect(result.actions).toBeDefined()
      expect(result.actions.length).toBe(1)
      expect(result.receiverId).toBe('usdc.near')
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.announcementMemo).toBeDefined()

      // Check function call
      const action = result.actions[0]
      expect(action.type).toBe('FunctionCall')

      const params = action.params as { methodName: string; args: string; gas: bigint }
      expect(params.methodName).toBe('ft_transfer_call')
      expect(params.gas).toBeGreaterThanOrEqual(FT_TRANSFER_CALL_TOTAL_GAS)

      const args = JSON.parse(params.args)
      expect(args.receiver_id).toBe(result.stealthAccountId)
      expect(args.amount).toBe('100000000')
      expect(args.msg).toBe('{"action":"deposit"}')
    })

    it('should include custom memo', () => {
      const result = buildPrivateTokenTransferCall({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        msg: '{}',
        memo: 'DEX deposit',
      })

      const params = result.actions[0].params as { args: string }
      const args = JSON.parse(params.args)
      expect(args.memo).toContain('DEX deposit')
    })

    it('should use custom receiver gas', () => {
      const customGas = 50_000_000_000_000n

      const result = buildPrivateTokenTransferCall({
        recipientMetaAddress: metaAddress,
        tokenContract: 'usdc.near',
        amount: 100_000_000n,
        msg: '{}',
        receiverGas: customGas,
      })

      const params = result.actions[0].params as { gas: bigint }
      expect(params.gas).toBeGreaterThanOrEqual(customGas)
    })

    it('should throw for invalid JSON msg', () => {
      expect(() =>
        buildPrivateTokenTransferCall({
          recipientMetaAddress: metaAddress,
          tokenContract: 'usdc.near',
          amount: 100_000_000n,
          msg: 'not valid json',
        })
      ).toThrow('msg must be valid JSON')
    })
  })

  describe('buildBatchPrivateTokenTransfer', () => {
    it('should build batch transfers', () => {
      const meta1 = generateNEARStealthMetaAddress()
      const meta2 = generateNEARStealthMetaAddress()
      const meta3 = generateNEARStealthMetaAddress()

      const result = buildBatchPrivateTokenTransfer({
        tokenContract: 'usdc.near',
        transfers: [
          { recipientMetaAddress: meta1.metaAddress, amount: 100_000_000n },
          { recipientMetaAddress: meta2.metaAddress, amount: 50_000_000n },
          { recipientMetaAddress: meta3.metaAddress, amount: 25_000_000n },
        ],
      })

      expect(result.transfers.length).toBe(3)
      expect(result.actions.length).toBe(3)
      expect(result.totalAmount).toBe(175_000_000n)
      expect(result.receiverId).toBe('usdc.near')

      // Each transfer should have unique stealth address
      const accountIds = result.transfers.map(t => t.stealthAccountId)
      expect(new Set(accountIds).size).toBe(3)
    })

    it('should build batch transfers with commitments', () => {
      const meta1 = generateNEARStealthMetaAddress()
      const meta2 = generateNEARStealthMetaAddress()

      const result = buildBatchPrivateTokenTransfer({
        tokenContract: 'usdc.near',
        transfers: [
          { recipientMetaAddress: meta1.metaAddress, amount: 100_000_000n },
          { recipientMetaAddress: meta2.metaAddress, amount: 50_000_000n },
        ],
        decimals: 6,
        hideAmounts: true,
      })

      expect(result.transfers[0].commitment).toBeDefined()
      expect(result.transfers[1].commitment).toBeDefined()

      // Verify commitments
      expect(
        verifyNEP141TokenCommitment(result.transfers[0].commitment!, 100_000_000n)
      ).toBe(true)
      expect(
        verifyNEP141TokenCommitment(result.transfers[1].commitment!, 50_000_000n)
      ).toBe(true)
    })

    it('should throw for empty transfers', () => {
      expect(() =>
        buildBatchPrivateTokenTransfer({
          tokenContract: 'usdc.near',
          transfers: [],
        })
      ).toThrow('At least one transfer is required')
    })

    it('should throw for too many transfers', () => {
      const transfers = Array(11).fill(null).map(() => ({
        recipientMetaAddress: generateNEARStealthMetaAddress().metaAddress,
        amount: 1_000_000n,
      }))

      expect(() =>
        buildBatchPrivateTokenTransfer({
          tokenContract: 'usdc.near',
          transfers,
        })
      ).toThrow('Maximum 10 transfers per batch')
    })

    it('should require decimals when hideAmounts is true', () => {
      const meta1 = generateNEARStealthMetaAddress()

      expect(() =>
        buildBatchPrivateTokenTransfer({
          tokenContract: 'usdc.near',
          transfers: [
            { recipientMetaAddress: meta1.metaAddress, amount: 100_000_000n },
          ],
          hideAmounts: true,
          // decimals not provided
        })
      ).toThrow('decimals is required when hideAmounts is true')
    })
  })

  describe('buildBatchStorageDeposit', () => {
    it('should build batch storage deposits', () => {
      const accountIds = [
        'a'.repeat(64),
        'b'.repeat(64),
        'c'.repeat(64),
      ]

      const actions = buildBatchStorageDeposit(accountIds, 'usdc.near')

      expect(actions.length).toBe(3)

      for (let i = 0; i < 3; i++) {
        expect(actions[i].type).toBe('FunctionCall')
        const params = actions[i].params as { methodName: string; args: string }
        expect(params.methodName).toBe('storage_deposit')

        const args = JSON.parse(params.args)
        expect(args.account_id).toBe(accountIds[i])
      }
    })

    it('should use custom deposit amount', () => {
      const accountIds = ['a'.repeat(64)]
      const customAmount = 5_000_000_000_000_000_000_000n

      const actions = buildBatchStorageDeposit(accountIds, 'usdc.near', customAmount)

      const params = actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(customAmount)
    })

    it('should throw for empty account IDs', () => {
      expect(() =>
        buildBatchStorageDeposit([], 'usdc.near')
      ).toThrow('At least one account ID is required')
    })

    it('should throw for too many accounts', () => {
      const accountIds = Array(21).fill('a'.repeat(64))

      expect(() =>
        buildBatchStorageDeposit(accountIds, 'usdc.near')
      ).toThrow('Maximum 20 storage deposits per batch')
    })
  })

  describe('buildStorageWithdraw', () => {
    it('should build storage withdraw with amount', () => {
      const action = buildStorageWithdraw(1_000_000_000_000_000_000_000n)

      expect(action.type).toBe('FunctionCall')
      const params = action.params as { methodName: string; args: string }
      expect(params.methodName).toBe('storage_withdraw')

      const args = JSON.parse(params.args)
      expect(args.amount).toBe('1000000000000000000000')
    })

    it('should build storage withdraw all', () => {
      const action = buildStorageWithdraw()

      expect(action.type).toBe('FunctionCall')
      const params = action.params as { methodName: string; args: string }
      expect(params.methodName).toBe('storage_withdraw')
      expect(params.args).toBe('{}')
    })
  })

  describe('buildStorageUnregister', () => {
    it('should build storage unregister without force', () => {
      const action = buildStorageUnregister()

      expect(action.type).toBe('FunctionCall')
      const params = action.params as { methodName: string; args: string }
      expect(params.methodName).toBe('storage_unregister')

      const args = JSON.parse(params.args)
      expect(args.force).toBe(false)
    })

    it('should build storage unregister with force', () => {
      const action = buildStorageUnregister(true)

      const params = action.params as { args: string }
      const args = JSON.parse(params.args)
      expect(args.force).toBe(true)
    })
  })

  describe('parseTokenMetadata', () => {
    it('should parse valid metadata', () => {
      const raw = {
        spec: 'ft-1.0.0',
        name: 'USD Coin',
        symbol: 'USDC',
        icon: 'data:image/svg+xml,...',
        reference: 'https://example.com/usdc.json',
        reference_hash: 'abc123',
        decimals: 6,
      }

      const parsed = parseTokenMetadata(raw)

      expect(parsed.spec).toBe('ft-1.0.0')
      expect(parsed.name).toBe('USD Coin')
      expect(parsed.symbol).toBe('USDC')
      expect(parsed.icon).toBe('data:image/svg+xml,...')
      expect(parsed.reference).toBe('https://example.com/usdc.json')
      expect(parsed.referenceHash).toBe('abc123')
      expect(parsed.decimals).toBe(6)
    })

    it('should handle minimal metadata', () => {
      const raw = {
        name: 'Token',
        symbol: 'TKN',
        decimals: 18,
      }

      const parsed = parseTokenMetadata(raw)

      expect(parsed.spec).toBe('ft-1.0.0') // Default
      expect(parsed.name).toBe('Token')
      expect(parsed.symbol).toBe('TKN')
      expect(parsed.icon).toBeUndefined()
      expect(parsed.decimals).toBe(18)
    })

    it('should handle empty metadata', () => {
      const parsed = parseTokenMetadata({})

      expect(parsed.name).toBe('Unknown Token')
      expect(parsed.symbol).toBe('???')
      expect(parsed.decimals).toBe(0)
    })

    it('should throw for invalid response', () => {
      expect(() => parseTokenMetadata(null)).toThrow('Invalid metadata response')
      expect(() => parseTokenMetadata(undefined)).toThrow('Invalid metadata response')
    })
  })

  describe('formatTokenAmount', () => {
    it('should format whole numbers', () => {
      expect(formatTokenAmount(100_000_000n, 6)).toBe('100')
      expect(formatTokenAmount(1_000_000_000_000_000_000_000_000n, 24)).toBe('1')
    })

    it('should format decimals', () => {
      expect(formatTokenAmount(100_500_000n, 6)).toBe('100.5')
      expect(formatTokenAmount(123_456_789n, 6)).toBe('123.456789')
    })

    it('should format with symbol', () => {
      expect(formatTokenAmount(100_000_000n, 6, 'USDC')).toBe('100 USDC')
      expect(formatTokenAmount(1_500_000n, 6, 'USDC')).toBe('1.5 USDC')
    })

    it('should handle zero', () => {
      expect(formatTokenAmount(0n, 6)).toBe('0')
    })

    it('should handle small amounts', () => {
      expect(formatTokenAmount(1n, 6)).toBe('0.000001')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse whole numbers', () => {
      expect(parseTokenAmount('100', 6)).toBe(100_000_000n)
      expect(parseTokenAmount('1', 24)).toBe(1_000_000_000_000_000_000_000_000n)
    })

    it('should parse decimals', () => {
      expect(parseTokenAmount('100.5', 6)).toBe(100_500_000n)
      expect(parseTokenAmount('0.000001', 6)).toBe(1n)
    })

    it('should handle amounts with symbol suffix', () => {
      expect(parseTokenAmount('100 USDC', 6)).toBe(100_000_000n)
      expect(parseTokenAmount('1.5 NEAR', 24)).toBe(1_500_000_000_000_000_000_000_000n)
    })

    it('should truncate excess decimals', () => {
      expect(parseTokenAmount('100.1234567', 6)).toBe(100_123_456n)
    })
  })

  describe('extractCommitmentFromMemo', () => {
    it('should extract commitment hash from memo', () => {
      const memo = 'sip:e:abc123:ff|c:1234567890abcdef|custom memo'
      const hash = extractCommitmentFromMemo(memo)

      expect(hash).toBe('1234567890abcdef')
    })

    it('should return null if no commitment', () => {
      const memo = 'sip:e:abc123:ff|custom memo'
      const hash = extractCommitmentFromMemo(memo)

      expect(hash).toBeNull()
    })
  })

  describe('verifyCommitmentInMemo', () => {
    it('should verify matching commitment', () => {
      const commitment = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const memo = 'sip:e:abc:ff|c:1234567890abcdef'

      expect(verifyCommitmentInMemo(commitment, memo)).toBe(true)
    })

    it('should reject non-matching commitment', () => {
      const commitment = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678'
      const memo = 'sip:e:abc:ff|c:1234567890abcdef'

      expect(verifyCommitmentInMemo(commitment, memo)).toBe(false)
    })

    it('should return false for memo without commitment', () => {
      const commitment = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const memo = 'sip:e:abc:ff'

      expect(verifyCommitmentInMemo(commitment, memo)).toBe(false)
    })
  })

  describe('constants', () => {
    it('should have expected gas values', () => {
      expect(FT_TRANSFER_CALL_GAS).toBe(30_000_000_000_000n)
      expect(FT_TRANSFER_CALL_TOTAL_GAS).toBe(100_000_000_000_000n)
    })
  })

  describe('integration: full token privacy flow', () => {
    it('should complete send with commitment flow', () => {
      // 1. Recipient generates meta-address
      const recipient = generateNEARStealthMetaAddress('Recipient')

      // 2. Sender builds private transfer with commitment
      const result = buildPrivateTokenTransferWithCommitment({
        recipientMetaAddress: recipient.metaAddress,
        tokenContract: 'usdc.near',
        amount: 1_000_000_000n, // 1000 USDC
        decimals: 6,
        hideAmount: true,
      })

      // 3. Verify transfer build
      expect(result.transfer.receiverId).toBe('usdc.near')
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)

      // 4. Verify commitment can be opened with correct amount
      expect(result.commitment).toBeDefined()
      expect(
        verifyNEP141TokenCommitment(result.commitment!, 1_000_000_000n)
      ).toBe(true)

      // 5. Verify commitment cannot be opened with wrong amount
      expect(
        verifyNEP141TokenCommitment(result.commitment!, 999_999_999n)
      ).toBe(false)

      // 6. Verify commitment prefix in memo
      const params = result.transfer.actions[0].params as { args: string }
      const args = JSON.parse(params.args)
      expect(
        verifyCommitmentInMemo(result.commitment!.commitment, args.memo)
      ).toBe(true)
    })

    it('should complete batch transfer flow', () => {
      // 1. Multiple recipients generate meta-addresses
      const recipient1 = generateNEARStealthMetaAddress('Recipient 1')
      const recipient2 = generateNEARStealthMetaAddress('Recipient 2')

      // 2. Sender builds batch transfer
      const result = buildBatchPrivateTokenTransfer({
        tokenContract: 'usdc.near',
        transfers: [
          { recipientMetaAddress: recipient1.metaAddress, amount: 100_000_000n },
          { recipientMetaAddress: recipient2.metaAddress, amount: 200_000_000n },
        ],
        decimals: 6,
        hideAmounts: true,
      })

      // 3. Verify batch
      expect(result.totalAmount).toBe(300_000_000n)
      expect(result.transfers.length).toBe(2)

      // 4. Each transfer has unique stealth address and valid commitment
      expect(result.transfers[0].stealthAccountId).not.toBe(
        result.transfers[1].stealthAccountId
      )

      expect(
        verifyNEP141TokenCommitment(result.transfers[0].commitment!, 100_000_000n)
      ).toBe(true)
      expect(
        verifyNEP141TokenCommitment(result.transfers[1].commitment!, 200_000_000n)
      ).toBe(true)
    })
  })
})
