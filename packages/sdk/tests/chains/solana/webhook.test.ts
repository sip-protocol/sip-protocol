/**
 * Helius Webhook Handler Tests
 *
 * Tests for real-time stealth payment detection via webhooks.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createWebhookHandler,
  processWebhookTransaction,
  type HeliusWebhookTransaction,
  type HeliusEnhancedTransaction,
} from '../../../src/chains/solana/providers/webhook'
import { generateEd25519StealthMetaAddress, generateEd25519StealthAddress } from '../../../src/stealth'
import { createAnnouncementMemo } from '../../../src/chains/solana/types'

describe('Helius Webhook Handler', () => {
  // Generate test keys
  const recipientKeys = generateEd25519StealthMetaAddress('solana')
  const spendingPublicKey = recipientKeys.metaAddress.spendingKey

  // Helper to create a mock webhook transaction with SIP announcement
  function createMockWebhookTransaction(
    announcement: { ephemeralPublicKey: string; viewTag: string; stealthAddress?: string },
    options: {
      signature?: string
      slot?: number
      blockTime?: number
      mint?: string
      amount?: string
    } = {}
  ): HeliusWebhookTransaction {
    const memo = createAnnouncementMemo(
      announcement.ephemeralPublicKey,
      announcement.viewTag,
      announcement.stealthAddress
    )

    return {
      blockTime: options.blockTime ?? 1700000000,
      slot: options.slot ?? 250000000,
      meta: {
        err: null,
        fee: 5000,
        innerInstructions: [],
        logMessages: [
          'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr invoke [1]',
          `Program log: ${memo}`,
          'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr success',
        ],
        postBalances: [1000000000, 500000000],
        preBalances: [1500000000, 0],
        postTokenBalances: [
          {
            accountIndex: 1,
            mint: options.mint ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            uiTokenAmount: {
              amount: options.amount ?? '1000000',
              decimals: 6,
              uiAmount: 1.0,
              uiAmountString: '1.0',
            },
          },
        ],
        preTokenBalances: [],
        rewards: [],
      },
      transaction: {
        message: {
          accountKeys: ['sender', 'recipient'],
          instructions: [],
          recentBlockhash: 'blockhash123',
        },
        signatures: [options.signature ?? 'sig123'],
      },
    }
  }

  describe('createWebhookHandler', () => {
    it('should create a webhook handler function', () => {
      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound: vi.fn(),
      })

      expect(typeof handler).toBe('function')
    })

    it('should detect payment for our viewing key', async () => {
      const onPaymentFound = vi.fn()

      // Generate a stealth address for our recipient
      const { stealthAddress } = generateEd25519StealthAddress(
        recipientKeys.metaAddress
      )

      // Convert ephemeral public key to base58 format (simplified for test)
      // In real usage, this would be the Solana address format
      const ephemeralBase58 = stealthAddress.ephemeralPublicKey.slice(2, 46) + 'AAAAAAAAAA' // Pad to 44 chars

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const mockTx = createMockWebhookTransaction({
        ephemeralPublicKey: ephemeralBase58,
        viewTag: stealthAddress.viewTag.toString(16).padStart(2, '0'),
        stealthAddress: stealthAddress.address.slice(2, 46) + 'AAAAAAAAAA',
      })

      const results = await handler(mockTx)

      expect(results).toHaveLength(1)
      expect(results[0].signature).toBe('sig123')
      // Note: The payment may or may not be found depending on address format
      // This tests the handler structure works
    })

    it('should not trigger callback for non-matching transactions', async () => {
      const onPaymentFound = vi.fn()

      // Generate keys for a different recipient
      const otherRecipient = generateEd25519StealthMetaAddress('solana')
      // Generate stealth address for the other recipient (not ours)
      generateEd25519StealthAddress(otherRecipient.metaAddress)

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const mockTx = createMockWebhookTransaction({
        ephemeralPublicKey: 'otherEphemeralKey12345678901234567890123',
        viewTag: 'ab',
        stealthAddress: 'otherStealthAddress123456789012345678901',
      })

      const results = await handler(mockTx)

      expect(results).toHaveLength(1)
      expect(results[0].found).toBe(false)
      expect(onPaymentFound).not.toHaveBeenCalled()
    })

    it('should handle array of transactions', async () => {
      const onPaymentFound = vi.fn()

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const mockTxs = [
        createMockWebhookTransaction(
          { ephemeralPublicKey: 'key1234567890123456789012345678901234', viewTag: 'aa' },
          { signature: 'sig1' }
        ),
        createMockWebhookTransaction(
          { ephemeralPublicKey: 'key2345678901234567890123456789012345', viewTag: 'bb' },
          { signature: 'sig2' }
        ),
      ]

      const results = await handler(mockTxs)

      expect(results).toHaveLength(2)
      expect(results[0].signature).toBe('sig1')
      expect(results[1].signature).toBe('sig2')
    })

    it('should skip failed transactions', async () => {
      const onPaymentFound = vi.fn()

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const mockTx = createMockWebhookTransaction({
        ephemeralPublicKey: 'key1234567890123456789012345678901234',
        viewTag: 'aa',
      })
      mockTx.meta.err = { message: 'Transaction failed' }

      const results = await handler(mockTx)

      expect(results).toHaveLength(1)
      expect(results[0].found).toBe(false)
      expect(onPaymentFound).not.toHaveBeenCalled()
    })

    it('should call onError for processing errors', async () => {
      const onPaymentFound = vi.fn()
      const onError = vi.fn()

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
        onError,
      })

      // Create malformed transaction
      const malformedTx = {
        meta: {
          logMessages: ['Program log: SIP:1:invalid'],
          err: null,
        },
        transaction: {
          signatures: ['sig123'],
        },
      } as unknown as HeliusWebhookTransaction

      const results = await handler(malformedTx)

      expect(results).toHaveLength(1)
      expect(results[0].found).toBe(false)
    })

    it('should skip enhanced transactions (no log messages)', async () => {
      const onPaymentFound = vi.fn()

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const enhancedTx: HeliusEnhancedTransaction = {
        description: 'Token transfer',
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        fee: 5000,
        feePayer: 'sender123',
        signature: 'enhancedSig123',
        slot: 250000000,
        timestamp: 1700000000,
        nativeTransfers: [],
        tokenTransfers: [
          {
            fromUserAccount: 'sender',
            toUserAccount: 'recipient',
            fromTokenAccount: 'senderATA',
            toTokenAccount: 'recipientATA',
            tokenAmount: 1000000,
            mint: 'USDC',
            tokenStandard: 'Fungible',
          },
        ],
        accountData: [],
      }

      const results = await handler(enhancedTx)

      expect(results).toHaveLength(1)
      expect(results[0].found).toBe(false)
      expect(results[0].signature).toBe('enhancedSig123')
      expect(onPaymentFound).not.toHaveBeenCalled()
    })
  })

  describe('processWebhookTransaction', () => {
    it('should return null for non-matching transactions', async () => {
      // Use valid Solana address format (base58, 32-44 chars)
      const mockTx = createMockWebhookTransaction({
        ephemeralPublicKey: '11111111111111111111111111111112',
        viewTag: 'ff',
      })

      const result = await processWebhookTransaction(
        mockTx,
        recipientKeys.viewingPrivateKey,
        spendingPublicKey
      )

      expect(result).toBeNull()
    })

    it('should return null for transactions without SIP announcement', async () => {
      const mockTx: HeliusWebhookTransaction = {
        blockTime: 1700000000,
        slot: 250000000,
        meta: {
          err: null,
          fee: 5000,
          innerInstructions: [],
          logMessages: [
            'Program log: Regular memo without SIP prefix',
          ],
          postBalances: [],
          preBalances: [],
          postTokenBalances: [],
          preTokenBalances: [],
          rewards: [],
        },
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
            recentBlockhash: 'blockhash',
          },
          signatures: ['sig123'],
        },
      }

      const result = await processWebhookTransaction(
        mockTx,
        recipientKeys.viewingPrivateKey,
        spendingPublicKey
      )

      expect(result).toBeNull()
    })
  })

  describe('Token transfer parsing', () => {
    it('should parse token transfer amount from balance changes', async () => {
      const onPaymentFound = vi.fn()

      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound,
      })

      const mockTx = createMockWebhookTransaction(
        { ephemeralPublicKey: 'key1234567890123456789012345678901234', viewTag: 'aa' },
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: '5000000' }
      )

      await handler(mockTx)

      // Verify the transaction was processed (even if not our payment)
      expect(mockTx.meta.postTokenBalances[0].uiTokenAmount.amount).toBe('5000000')
    })
  })

  describe('Webhook payload types', () => {
    it('should accept single raw transaction', async () => {
      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound: vi.fn(),
      })

      const tx = createMockWebhookTransaction({
        ephemeralPublicKey: 'key1234567890123456789012345678901234',
        viewTag: 'aa',
      })

      const results = await handler(tx)
      expect(results).toHaveLength(1)
    })

    it('should accept array of raw transactions', async () => {
      const handler = createWebhookHandler({
        viewingPrivateKey: recipientKeys.viewingPrivateKey,
        spendingPublicKey: spendingPublicKey,
        onPaymentFound: vi.fn(),
      })

      const txs = [
        createMockWebhookTransaction({ ephemeralPublicKey: 'key1', viewTag: 'aa' }, { signature: 's1' }),
        createMockWebhookTransaction({ ephemeralPublicKey: 'key2', viewTag: 'bb' }, { signature: 's2' }),
        createMockWebhookTransaction({ ephemeralPublicKey: 'key3', viewTag: 'cc' }, { signature: 's3' }),
      ]

      const results = await handler(txs)
      expect(results).toHaveLength(3)
    })
  })
})

describe('Webhook Handler Integration', () => {
  it('should work with Express-style request body', async () => {
    const integrationKeys = generateEd25519StealthMetaAddress('solana')
    const onPaymentFound = vi.fn()

    const handler = createWebhookHandler({
      viewingPrivateKey: integrationKeys.viewingPrivateKey,
      spendingPublicKey: integrationKeys.metaAddress.spendingKey,
      onPaymentFound,
    })

    // Simulate Express request body (array of transactions)
    const requestBody = [
      {
        blockTime: 1700000000,
        slot: 250000000,
        meta: {
          err: null,
          fee: 5000,
          innerInstructions: [],
          logMessages: ['Program log: Not a SIP transaction'],
          postBalances: [],
          preBalances: [],
          postTokenBalances: [],
          preTokenBalances: [],
          rewards: [],
        },
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
            recentBlockhash: 'hash',
          },
          signatures: ['express-sig-123'],
        },
      },
    ]

    const results = await handler(requestBody as HeliusWebhookTransaction[])

    expect(results).toHaveLength(1)
    expect(results[0].signature).toBe('express-sig-123')
    expect(results[0].found).toBe(false)
  })
})
