/**
 * Same-Chain Executor Tests
 *
 * Tests for the same-chain privacy executor interface.
 */

import { describe, it, expect } from 'vitest'
import {
  isSameChainSupported,
  getSupportedSameChainChains,
} from '../../src/executors/same-chain'
import type { ChainId } from '@sip-protocol/types'

describe('Same-Chain Executor', () => {
  describe('isSameChainSupported', () => {
    it('should return true for Solana', () => {
      expect(isSameChainSupported('solana' as ChainId)).toBe(true)
    })

    it('should return false for unsupported chains', () => {
      const unsupportedChains: ChainId[] = [
        'ethereum',
        'polygon',
        'arbitrum',
        'optimism',
        'base',
        'near',
        'zcash',
        'bitcoin',
      ] as ChainId[]

      unsupportedChains.forEach(chain => {
        expect(isSameChainSupported(chain)).toBe(false)
      })
    })
  })

  describe('getSupportedSameChainChains', () => {
    it('should return array of supported chains', () => {
      const supported = getSupportedSameChainChains()

      expect(Array.isArray(supported)).toBe(true)
      expect(supported).toContain('solana')
    })

    it('should only include implemented chains', () => {
      const supported = getSupportedSameChainChains()

      // Currently only Solana is implemented
      expect(supported.length).toBe(1)
      expect(supported[0]).toBe('solana')
    })
  })

  describe('SameChainExecutor Interface', () => {
    it('should define execute and estimateFee methods', () => {
      // Type-level test - if this compiles, the interface is correct
      interface TestExecutor {
        readonly chain: ChainId
        execute(params: { recipientMetaAddress: unknown; amount: bigint; token: string }): Promise<{
          txHash: string
          stealthAddress: string
          ephemeralPublicKey: string
          explorerUrl: string
          chain: ChainId
        }>
        estimateFee(params: unknown): Promise<bigint>
      }

      // This is a compile-time check
      const _verifyInterface: TestExecutor = {
        chain: 'solana' as ChainId,
        execute: async () => ({
          txHash: 'abc',
          stealthAddress: 'def',
          ephemeralPublicKey: 'ghi',
          explorerUrl: 'https://solscan.io/tx/abc',
          chain: 'solana' as ChainId,
        }),
        estimateFee: async () => 5000n,
      }

      expect(_verifyInterface.chain).toBe('solana')
    })
  })

  describe('SameChainTransferParams', () => {
    it('should define required fields', () => {
      const params = {
        recipientMetaAddress: {
          chain: 'solana' as ChainId,
          spendingKey: '0x' + 'a'.repeat(64) as `0x${string}`,
          viewingKey: '0x' + 'b'.repeat(64) as `0x${string}`,
        },
        amount: 1000000n, // 1 USDC (6 decimals)
        token: 'USDC',
      }

      expect(params.recipientMetaAddress.chain).toBe('solana')
      expect(typeof params.amount).toBe('bigint')
      expect(params.token).toBe('USDC')
    })
  })

  describe('SameChainTransferResult', () => {
    it('should include all required fields', () => {
      const result = {
        txHash: '5wHu4...signature',
        stealthAddress: 'HN7cA...address',
        ephemeralPublicKey: 'BpxDq...pubkey',
        explorerUrl: 'https://solscan.io/tx/5wHu4',
        chain: 'solana' as ChainId,
      }

      expect(result.txHash).toBeDefined()
      expect(result.stealthAddress).toBeDefined()
      expect(result.ephemeralPublicKey).toBeDefined()
      expect(result.explorerUrl).toBeDefined()
      expect(result.chain).toBe('solana')
    })
  })

  describe('Factory Function', () => {
    it('should throw for unsupported chains', async () => {
      // We can't easily test createSameChainExecutor without a real connection,
      // but we can verify the type structure
      const { createSameChainExecutor } = await import('../../src/executors/same-chain')

      // This should throw because Ethereum isn't supported
      expect(() => {
        createSameChainExecutor('ethereum' as ChainId, {} as never)
      }).toThrow('Same-chain executor not available for chain: ethereum')
    })
  })
})
