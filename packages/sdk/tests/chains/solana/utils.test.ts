/**
 * Solana Shared Utilities Tests
 *
 * Tests for shared utility functions extracted from scan.ts and webhook.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  getTokenSymbol,
  parseTokenTransferFromBalances,
  type TokenBalanceEntry,
} from '../../../src/chains/solana/utils'
import { SOLANA_TOKEN_MINTS } from '../../../src/chains/solana/constants'

describe('Solana Shared Utilities', () => {
  describe('getTokenSymbol', () => {
    it('should return USDC for USDC mint address', () => {
      const symbol = getTokenSymbol(SOLANA_TOKEN_MINTS.USDC)
      expect(symbol).toBe('USDC')
    })

    it('should return USDT for USDT mint address', () => {
      const symbol = getTokenSymbol(SOLANA_TOKEN_MINTS.USDT)
      expect(symbol).toBe('USDT')
    })

    it('should return WSOL for WSOL mint address', () => {
      const symbol = getTokenSymbol(SOLANA_TOKEN_MINTS.WSOL)
      expect(symbol).toBe('WSOL')
    })

    it('should return undefined for unknown mint address', () => {
      const symbol = getTokenSymbol('unknown-mint-address')
      expect(symbol).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const symbol = getTokenSymbol('')
      expect(symbol).toBeUndefined()
    })
  })

  describe('parseTokenTransferFromBalances', () => {
    it('should parse a token transfer from balance changes', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '0', decimals: 6 } },
      ]
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toEqual({
        mint: 'USDC',
        amount: 1000000n,
      })
    })

    it('should return null when balances are unchanged', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toBeNull()
    })

    it('should return null when balance decreases (outgoing transfer)', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '500000', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toBeNull()
    })

    it('should handle new token account (no pre-balance entry)', () => {
      const preBalances: TokenBalanceEntry[] = []
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toEqual({
        mint: 'USDC',
        amount: 1000000n,
      })
    })

    it('should return null for null preBalances', () => {
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000000', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(null, postBalances)

      expect(result).toBeNull()
    })

    it('should return null for null postBalances', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '0', decimals: 6 } },
      ]

      const result = parseTokenTransferFromBalances(preBalances, null)

      expect(result).toBeNull()
    })

    it('should return null for undefined balances', () => {
      const result = parseTokenTransferFromBalances(undefined, undefined)
      expect(result).toBeNull()
    })

    it('should find the first increased balance among multiple accounts', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '1000', decimals: 6 } },
        { accountIndex: 1, mint: 'USDT', uiTokenAmount: { amount: '0', decimals: 6 } },
      ]
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '500', decimals: 6 } },  // decreased
        { accountIndex: 1, mint: 'USDT', uiTokenAmount: { amount: '2000', decimals: 6 } }, // increased
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toEqual({
        mint: 'USDT',
        amount: 2000n,
      })
    })

    it('should handle large token amounts (bigint)', () => {
      const preBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '0', decimals: 6 } },
      ]
      const postBalances: TokenBalanceEntry[] = [
        { accountIndex: 0, mint: 'USDC', uiTokenAmount: { amount: '9007199254740992', decimals: 6 } }, // > MAX_SAFE_INTEGER
      ]

      const result = parseTokenTransferFromBalances(preBalances, postBalances)

      expect(result).toEqual({
        mint: 'USDC',
        amount: 9007199254740992n,
      })
    })
  })
})
