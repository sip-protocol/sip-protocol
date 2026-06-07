/**
 * Solana scanForPayments end-to-end view-only test
 *
 * Drives the REAL `scanForPayments` against a mocked RPC connection — the path
 * the CI gap left uncovered. The existing scan-canonical.test.ts exercises only
 * the `checkEd25519StealthAddress` PRIMITIVE, and the @sip-protocol/react test
 * MOCKS `scanForPayments`, so neither would catch a future re-swap of the 2nd/3rd
 * args (viewingPrivateKey <-> spendingPublicKey) inside scan.ts.
 *
 * Detection here is canonical EIP-5564 VIEW-ONLY: viewing PRIVATE key + spending
 * PUBLIC key only — no spending private key — which was cryptographically
 * impossible under the pre-flip swapped scheme.
 */

import { describe, it, expect } from 'vitest'
import type { Connection } from '@solana/web3.js'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import { scanForPayments } from '../../../src/chains/solana'
import { createAnnouncementMemo, parseAnnouncement } from '../../../src/chains/solana/types'
import type { TokenBalanceEntry } from '../../../src/chains/solana/utils'
import { SOLANA_TOKEN_MINTS } from '../../../src/chains/solana/constants'
import type { ChainId } from '@sip-protocol/types'

// USDC mint — chosen so getTokenSymbol() resolves to 'USDC' for an extra assertion.
const USDC_MINT = SOLANA_TOKEN_MINTS.USDC
const DEPOSIT_AMOUNT = 1_500_000n // 1.5 USDC (6 decimals)

const TEST_SIGNATURE =
  '5wHu1qwD4kT3zr8nF2sZ9q7vXpYbN6cM1aE4dR7tG9hJ2kL3mP8qS5vT6wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR'
const TEST_SLOT = 250_000_123
const TEST_BLOCK_TIME = 1_717_000_000

/**
 * Build a mock Solana Connection that returns exactly one announcement tx.
 *
 * Mirrors the two RPC calls scanForPayments makes:
 *   getSignaturesForAddress(memoProgram, { limit, minContextSlot }) -> [{ signature, slot, blockTime }]
 *   getTransaction(sig, { maxSupportedTransactionVersion: 0 })      -> { meta: { logMessages, pre/postTokenBalances } }
 */
function createMockConnection(
  memo: string,
  preTokenBalances: TokenBalanceEntry[],
  postTokenBalances: TokenBalanceEntry[],
): Connection {
  return {
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    getSignaturesForAddress: async () => [
      { signature: TEST_SIGNATURE, slot: TEST_SLOT, blockTime: TEST_BLOCK_TIME },
    ],
    getTransaction: async () => ({
      meta: {
        logMessages: ['Program log: ' + memo],
        preTokenBalances,
        postTokenBalances,
      },
    }),
  } as unknown as Connection
}

/**
 * Construct a recipient meta-address + a canonical (SIP:2) stealth address and the
 * matching announcement memo / token-balance pair representing a deposit to it.
 */
function buildScenario() {
  const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
  const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

  // base58 forms for the on-chain announcement
  const stealthAddressB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)
  const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')

  const memo = createAnnouncementMemo(ephemeralB58, viewTagHex, stealthAddressB58)

  // Sanity: memo is canonical SIP:2 and round-trips through parseAnnouncement
  expect(memo.startsWith('SIP:2:')).toBe(true)
  const parsed = parseAnnouncement(memo)
  expect(parsed).not.toBeNull()
  expect(parsed!.version).toBe('2')
  expect(parsed!.stealthAddress).toBe(stealthAddressB58)

  // Token balances: the stealth ATA (accountIndex 1) goes 0 -> DEPOSIT_AMOUNT.
  // The sender ATA (accountIndex 0) decreases, but parseTokenTransferFromBalances
  // returns the first account whose post-balance increased — the stealth ATA.
  const preTokenBalances: TokenBalanceEntry[] = [
    {
      accountIndex: 0,
      mint: USDC_MINT,
      uiTokenAmount: { amount: '5000000', decimals: 6 },
    },
    {
      accountIndex: 1,
      mint: USDC_MINT,
      uiTokenAmount: { amount: '0', decimals: 6 },
    },
  ]
  const postTokenBalances: TokenBalanceEntry[] = [
    {
      accountIndex: 0,
      mint: USDC_MINT,
      uiTokenAmount: { amount: (5_000_000n - DEPOSIT_AMOUNT).toString(), decimals: 6 },
    },
    {
      accountIndex: 1,
      mint: USDC_MINT,
      uiTokenAmount: { amount: DEPOSIT_AMOUNT.toString(), decimals: 6 },
    },
  ]

  return {
    recipient,
    stealthAddress,
    stealthAddressB58,
    ephemeralB58,
    memo,
    preTokenBalances,
    postTokenBalances,
  }
}

describe('scanForPayments end-to-end (view-only, canonical SIP:2)', () => {
  it('detects the deposit with viewing PRIVATE + spending PUBLIC only', async () => {
    const s = buildScenario()
    const connection = createMockConnection(s.memo, s.preTokenBalances, s.postTokenBalances)

    const results = await scanForPayments({
      connection,
      viewingPrivateKey: s.recipient.viewingPrivateKey,
      spendingPublicKey: s.recipient.metaAddress.spendingKey,
    })

    expect(results).toHaveLength(1)
    const [payment] = results
    expect(payment.stealthAddress).toBe(s.stealthAddressB58)
    expect(payment.ephemeralPublicKey).toBe(s.ephemeralB58)
    expect(payment.amount).toBe(DEPOSIT_AMOUNT)
    expect(payment.mint).toBe(USDC_MINT)
    expect(payment.tokenSymbol).toBe('USDC')
    expect(payment.txSignature).toBe(TEST_SIGNATURE)
    expect(payment.slot).toBe(TEST_SLOT)
    expect(payment.timestamp).toBe(TEST_BLOCK_TIME)
  })

  it('returns no results for a DIFFERENT (wrong) viewing private key', async () => {
    const s = buildScenario()
    const connection = createMockConnection(s.memo, s.preTokenBalances, s.postTokenBalances)

    // A different recipient — wrong viewing key, scanning the same on-chain tx.
    const wrong = generateEd25519StealthMetaAddress('solana' as ChainId)

    const results = await scanForPayments({
      connection,
      viewingPrivateKey: wrong.viewingPrivateKey,
      spendingPublicKey: s.recipient.metaAddress.spendingKey,
    })

    expect(results).toEqual([])
  })
})
