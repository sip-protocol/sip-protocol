/**
 * Address Reuse Detection Algorithm
 *
 * Detects when the same address is used multiple times for receiving
 * or sending transactions, which degrades privacy by creating linkability.
 *
 * @packageDocumentation
 */

import type { AnalyzableTransaction, AddressReuseResult } from '../types'

/**
 * Maximum score deduction for address reuse (out of 25)
 */
const MAX_DEDUCTION = 25

/**
 * Deduction per reuse instance
 */
const DEDUCTION_PER_REUSE = 2

/**
 * Threshold before counting as reuse (first use is free)
 */
const REUSE_THRESHOLD = 1

/**
 * Analyze address reuse patterns in transaction history
 *
 * @param transactions - Transaction history to analyze
 * @param walletAddress - The wallet being analyzed
 * @returns Address reuse analysis result
 *
 * @example
 * ```typescript
 * const result = analyzeAddressReuse(transactions, 'abc123...')
 * console.log(result.totalReuseCount) // 12
 * console.log(result.scoreDeduction)  // 24 (capped at 25)
 * ```
 */
export function analyzeAddressReuse(
  transactions: AnalyzableTransaction[],
  walletAddress: string
): AddressReuseResult {
  // Track address usage counts
  const receiveAddresses = new Map<string, number>()
  const sendAddresses = new Map<string, number>()

  for (const tx of transactions) {
    if (!tx.success) continue

    // Count receives (wallet is recipient)
    if (tx.recipient === walletAddress) {
      const count = receiveAddresses.get(walletAddress) ?? 0
      receiveAddresses.set(walletAddress, count + 1)
    }

    // Count sends (wallet is sender)
    if (tx.sender === walletAddress) {
      const count = sendAddresses.get(walletAddress) ?? 0
      sendAddresses.set(walletAddress, count + 1)
    }

    // Also track any other addresses the wallet has used
    // (e.g., associated token accounts, derived addresses)
    for (const addr of tx.involvedAddresses) {
      if (addr === walletAddress) continue

      // If this address appears multiple times with the wallet,
      // it might indicate reuse of derived addresses
      if (tx.sender === walletAddress) {
        const count = sendAddresses.get(addr) ?? 0
        sendAddresses.set(addr, count + 1)
      }
      if (tx.recipient === walletAddress) {
        const count = receiveAddresses.get(addr) ?? 0
        receiveAddresses.set(addr, count + 1)
      }
    }
  }

  // Calculate reuse counts
  let receiveReuseCount = 0
  let sendReuseCount = 0
  const reusedAddresses: AddressReuseResult['reusedAddresses'] = []

  // Process receive addresses
  for (const [address, count] of Array.from(receiveAddresses.entries())) {
    if (count > REUSE_THRESHOLD) {
      const reuseCount = count - REUSE_THRESHOLD
      receiveReuseCount += reuseCount

      const existing = reusedAddresses.find((r) => r.address === address)
      if (existing) {
        existing.useCount = Math.max(existing.useCount, count)
        existing.type = 'both'
      } else {
        reusedAddresses.push({
          address,
          useCount: count,
          type: 'receive',
        })
      }
    }
  }

  // Process send addresses
  for (const [address, count] of Array.from(sendAddresses.entries())) {
    if (count > REUSE_THRESHOLD) {
      const reuseCount = count - REUSE_THRESHOLD
      sendReuseCount += reuseCount

      const existing = reusedAddresses.find((r) => r.address === address)
      if (existing) {
        existing.useCount = Math.max(existing.useCount, count)
        existing.type = 'both'
      } else {
        reusedAddresses.push({
          address,
          useCount: count,
          type: 'send',
        })
      }
    }
  }

  const totalReuseCount = receiveReuseCount + sendReuseCount

  // Calculate score deduction
  const rawDeduction = totalReuseCount * DEDUCTION_PER_REUSE
  const scoreDeduction = Math.min(rawDeduction, MAX_DEDUCTION)

  // Sort reused addresses by use count (most reused first)
  reusedAddresses.sort((a, b) => b.useCount - a.useCount)

  return {
    receiveReuseCount,
    sendReuseCount,
    totalReuseCount,
    scoreDeduction,
    reusedAddresses: reusedAddresses.slice(0, 10), // Top 10 most reused
  }
}
