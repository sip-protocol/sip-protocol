/**
 * Cluster Detection Algorithm (Common Input Ownership Heuristic)
 *
 * Identifies addresses that are likely owned by the same entity
 * by analyzing transaction patterns:
 *
 * 1. Common Input Heuristic: Multiple inputs in same tx = same owner
 * 2. Change Address Detection: Change outputs likely go to owner
 * 3. Consolidation Patterns: Merging funds indicates ownership
 *
 * @packageDocumentation
 */

import type { AnalyzableTransaction, ClusterResult } from '../types'

/**
 * Maximum score deduction for cluster exposure (out of 25)
 */
const MAX_DEDUCTION = 25

/**
 * Deduction per linked address
 */
const DEDUCTION_PER_LINK = 3

/**
 * Minimum transactions between addresses to consider linked
 */
const MIN_LINK_THRESHOLD = 2

/**
 * Union-Find data structure for efficient cluster management
 */
class UnionFind {
  private parent: Map<string, string>
  private rank: Map<string, number>

  constructor() {
    this.parent = new Map()
    this.rank = new Map()
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
    }

    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!))
    }

    return this.parent.get(x)!
  }

  union(x: string, y: string): void {
    const rootX = this.find(x)
    const rootY = this.find(y)

    if (rootX === rootY) return

    const rankX = this.rank.get(rootX) ?? 0
    const rankY = this.rank.get(rootY) ?? 0

    if (rankX < rankY) {
      this.parent.set(rootX, rootY)
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX)
    } else {
      this.parent.set(rootY, rootX)
      this.rank.set(rootX, rankX + 1)
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>()

    for (const addr of Array.from(this.parent.keys())) {
      const root = this.find(addr)
      if (!clusters.has(root)) {
        clusters.set(root, [])
      }
      clusters.get(root)!.push(addr)
    }

    return clusters
  }
}

/**
 * Detect address clusters using Common Input Ownership Heuristic
 *
 * @param transactions - Transaction history to analyze
 * @param walletAddress - The wallet being analyzed
 * @returns Cluster detection result
 *
 * @example
 * ```typescript
 * const result = detectClusters(transactions, 'abc123...')
 * console.log(result.linkedAddressCount) // 5
 * console.log(result.clusters[0].linkType) // 'common-input'
 * ```
 */
export function detectClusters(
  transactions: AnalyzableTransaction[],
  walletAddress: string
): ClusterResult {
  const uf = new UnionFind()
  const linkCounts = new Map<string, number>()
  const linkTypes = new Map<string, 'common-input' | 'change-address' | 'consolidation'>()
  const txCountPerPair = new Map<string, number>()

  // Always include the wallet address
  uf.find(walletAddress)

  for (const tx of transactions) {
    if (!tx.success) continue

    const involvedWithWallet = tx.involvedAddresses.filter(
      (addr) => addr !== walletAddress
    )

    // Common Input Heuristic: If wallet sends with other inputs,
    // those inputs are likely controlled by same entity
    if (tx.sender === walletAddress && involvedWithWallet.length > 0) {
      for (const addr of involvedWithWallet) {
        // Count how many times we see this relationship
        const pairKey = [walletAddress, addr].sort().join(':')
        const count = (txCountPerPair.get(pairKey) ?? 0) + 1
        txCountPerPair.set(pairKey, count)

        if (count >= MIN_LINK_THRESHOLD) {
          uf.union(walletAddress, addr)
          linkCounts.set(addr, count)
          linkTypes.set(addr, 'common-input')
        }
      }
    }

    // Change Address Detection: Small outputs after a large tx
    // often go to change addresses owned by the sender
    if (tx.sender === walletAddress && tx.recipient !== walletAddress) {
      // Look for other outputs in the same transaction to the wallet
      // This is a simplified heuristic
      const otherRecipients = involvedWithWallet.filter(
        (addr) => addr !== tx.recipient
      )

      for (const addr of otherRecipients) {
        const pairKey = [walletAddress, addr].sort().join(':')
        const count = (txCountPerPair.get(pairKey) ?? 0) + 1
        txCountPerPair.set(pairKey, count)

        if (count >= MIN_LINK_THRESHOLD) {
          uf.union(walletAddress, addr)
          if (!linkTypes.has(addr)) {
            linkTypes.set(addr, 'change-address')
          }
          linkCounts.set(addr, count)
        }
      }
    }

    // Consolidation Pattern: Multiple inputs merged into one output
    // All inputs likely owned by same entity
    if (tx.recipient === walletAddress && involvedWithWallet.length > 1) {
      // Multiple addresses sent to this wallet in same tx = consolidation
      for (let i = 0; i < involvedWithWallet.length; i++) {
        for (let j = i + 1; j < involvedWithWallet.length; j++) {
          const addr1 = involvedWithWallet[i]
          const addr2 = involvedWithWallet[j]
          const pairKey = [addr1, addr2].sort().join(':')
          const count = (txCountPerPair.get(pairKey) ?? 0) + 1
          txCountPerPair.set(pairKey, count)

          if (count >= MIN_LINK_THRESHOLD) {
            uf.union(addr1, addr2)
            linkTypes.set(addr1, 'consolidation')
            linkTypes.set(addr2, 'consolidation')
          }
        }

        // Also link to wallet
        const pairKey = [walletAddress, involvedWithWallet[i]].sort().join(':')
        const count = (txCountPerPair.get(pairKey) ?? 0) + 1
        txCountPerPair.set(pairKey, count)

        if (count >= MIN_LINK_THRESHOLD) {
          uf.union(walletAddress, involvedWithWallet[i])
          linkCounts.set(involvedWithWallet[i], count)
        }
      }
    }
  }

  // Get clusters containing the wallet
  const allClusters = uf.getClusters()
  const walletRoot = uf.find(walletAddress)
  const walletCluster = allClusters.get(walletRoot) ?? [walletAddress]

  // Count linked addresses (excluding the wallet itself)
  const linkedAddresses = walletCluster.filter((addr) => addr !== walletAddress)
  const linkedAddressCount = linkedAddresses.length

  // Calculate confidence based on transaction counts
  const totalLinkTxs = Array.from(linkCounts.values()).reduce((a, b) => a + b, 0)
  const confidence = Math.min(totalLinkTxs / (linkedAddressCount * 5), 1)

  // Calculate score deduction
  const rawDeduction = linkedAddressCount * DEDUCTION_PER_LINK
  const scoreDeduction = Math.min(rawDeduction, MAX_DEDUCTION)

  // Build cluster details
  const clusters: ClusterResult['clusters'] = []

  if (linkedAddressCount > 0) {
    // Group by link type
    const byType = new Map<string, string[]>()
    for (const addr of linkedAddresses) {
      const type = linkTypes.get(addr) ?? 'common-input'
      if (!byType.has(type)) {
        byType.set(type, [])
      }
      byType.get(type)!.push(addr)
    }

    for (const [type, addresses] of Array.from(byType.entries())) {
      const txCount = addresses.reduce(
        (sum, addr) => sum + (linkCounts.get(addr) ?? 0),
        0
      )

      clusters.push({
        addresses: [walletAddress, ...addresses],
        linkType: type as 'common-input' | 'change-address' | 'consolidation',
        transactionCount: txCount,
      })
    }
  }

  return {
    linkedAddressCount,
    confidence,
    scoreDeduction,
    clusters,
  }
}
