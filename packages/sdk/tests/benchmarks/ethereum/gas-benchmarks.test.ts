/**
 * Ethereum Gas Benchmarks for Privacy Operations
 *
 * Measures and tracks gas consumption for stealth transfers,
 * announcements, claims, and other privacy operations.
 *
 * Issue: #378 - [M18-25] Gas optimization benchmarks for privacy ops
 *
 * @module tests/benchmarks/ethereum
 */

import { describe, it, expect } from 'vitest'
import {
  estimateEthTransferGas,
  estimateTokenTransferGas,
  estimateClaimGas,
  estimateRegistryGas,
  getGasPriceSuggestion,
  DEFAULT_GAS_LIMITS,
  ONE_GWEI,
  ONE_ETH,
  type EthereumNetwork,
  type DetailedGasEstimate,
} from '../../../src/chains/ethereum'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Gas baseline for regular transfers (non-privacy)
 */
const BASELINE_GAS = {
  ethTransfer: 21000n,
  erc20Transfer: 65000n,
  erc20Approve: 46000n,
} as const

/**
 * L2 networks for comparison
 */
const L2_NETWORKS: EthereumNetwork[] = ['arbitrum', 'optimism', 'base']

/**
 * L1 networks for comparison
 */
const L1_NETWORKS: EthereumNetwork[] = ['mainnet', 'polygon']

/**
 * Assumed ETH price for USD calculations
 */
const ETH_PRICE_USD = 3500

// ─── Types ────────────────────────────────────────────────────────────────────

interface GasBenchmarkResult {
  operation: string
  network: EthereumNetwork
  gasUsed: bigint
  costWei: bigint
  costEth: string
  costUsd: string
  overheadVsBaseline: number // percentage
}

interface GasComparisonResult {
  operation: string
  privacyGas: bigint
  baselineGas: bigint
  overhead: bigint
  overheadPercent: number
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function calculateOverhead(privacyGas: bigint, baselineGas: bigint): number {
  if (baselineGas === 0n) return 0
  return Number(((privacyGas - baselineGas) * 10000n) / baselineGas) / 100
}

function estimateCostUsd(gasEstimate: DetailedGasEstimate): number {
  const ethValue = Number(gasEstimate.estimatedCostWei) / Number(ONE_ETH)
  return ethValue * ETH_PRICE_USD
}

function formatBenchmarkRow(result: GasBenchmarkResult): string {
  return `| ${result.operation.padEnd(25)} | ${result.network.padEnd(12)} | ${result.gasUsed.toString().padStart(10)} | ${result.costEth.padStart(12)} | $${result.costUsd.padStart(8)} | ${(result.overheadVsBaseline >= 0 ? '+' : '') + result.overheadVsBaseline.toFixed(1)}% |`
}

function formatComparisonRow(result: GasComparisonResult): string {
  return `| ${result.operation.padEnd(25)} | ${result.privacyGas.toString().padStart(10)} | ${result.baselineGas.toString().padStart(10)} | ${result.overhead.toString().padStart(10)} | ${(result.overheadPercent >= 0 ? '+' : '') + result.overheadPercent.toFixed(1)}% |`
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Ethereum Gas Benchmarks', () => {
  describe('Gas Consumption by Operation', () => {
    describe('ETH Stealth Transfer', () => {
      it('should benchmark ETH stealth transfer gas', () => {
        const estimate = estimateEthTransferGas('mainnet')

        // Verify breakdown
        expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.ethTransfer)
        expect(estimate.breakdown.announcementGas).toBe(DEFAULT_GAS_LIMITS.announcement)
        expect(estimate.breakdown.totalGas).toBe(
          DEFAULT_GAS_LIMITS.ethTransfer + DEFAULT_GAS_LIMITS.announcement
        )

        // Log benchmark result
        console.log('\n=== ETH Stealth Transfer Gas ===')
        console.log(`Transfer Gas: ${estimate.breakdown.transferGas}`)
        console.log(`Announcement Gas: ${estimate.breakdown.announcementGas}`)
        console.log(`Total Gas: ${estimate.breakdown.totalGas}`)
        console.log(`Estimated Cost: ${estimate.estimatedCostEth} ETH`)
      })

      it('should calculate correct overhead vs regular ETH transfer', () => {
        const estimate = estimateEthTransferGas('mainnet')
        const overhead = calculateOverhead(
          estimate.breakdown.totalGas,
          BASELINE_GAS.ethTransfer
        )

        // Privacy adds ~380% overhead for ETH (21000 -> 101000)
        expect(overhead).toBeGreaterThan(350)
        expect(overhead).toBeLessThan(500)

        console.log(`\nOverhead vs regular ETH transfer: +${overhead.toFixed(1)}%`)
      })
    })

    describe('ERC-20 Stealth Transfer', () => {
      it('should benchmark ERC-20 stealth transfer gas (without approval)', () => {
        const estimate = estimateTokenTransferGas('mainnet', false)

        expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.erc20Transfer)
        expect(estimate.breakdown.announcementGas).toBe(DEFAULT_GAS_LIMITS.announcement)

        console.log('\n=== ERC-20 Stealth Transfer Gas (No Approval) ===')
        console.log(`Transfer Gas: ${estimate.breakdown.transferGas}`)
        console.log(`Announcement Gas: ${estimate.breakdown.announcementGas}`)
        console.log(`Total Gas: ${estimate.breakdown.totalGas}`)
      })

      it('should benchmark ERC-20 stealth transfer gas (with approval)', () => {
        const estimate = estimateTokenTransferGas('mainnet', true)

        const expectedTransferGas =
          DEFAULT_GAS_LIMITS.erc20Transfer + DEFAULT_GAS_LIMITS.erc20Approve

        expect(estimate.breakdown.transferGas).toBe(expectedTransferGas)
        expect(estimate.breakdown.announcementGas).toBe(DEFAULT_GAS_LIMITS.announcement)

        console.log('\n=== ERC-20 Stealth Transfer Gas (With Approval) ===')
        console.log(`Transfer + Approve Gas: ${estimate.breakdown.transferGas}`)
        console.log(`Announcement Gas: ${estimate.breakdown.announcementGas}`)
        console.log(`Total Gas: ${estimate.breakdown.totalGas}`)
      })

      it('should calculate correct overhead vs regular ERC-20 transfer', () => {
        const estimate = estimateTokenTransferGas('mainnet', false)
        const overhead = calculateOverhead(
          estimate.breakdown.totalGas,
          BASELINE_GAS.erc20Transfer
        )

        // Privacy adds ~123% overhead for ERC-20 (65000 -> 145000)
        expect(overhead).toBeGreaterThan(100)
        expect(overhead).toBeLessThan(150)

        console.log(`\nOverhead vs regular ERC-20 transfer: +${overhead.toFixed(1)}%`)
      })
    })

    describe('Announcement Emission', () => {
      it('should benchmark announcement-only gas cost', () => {
        const announcementGas = DEFAULT_GAS_LIMITS.announcement

        // Announcement is always 80,000 gas
        expect(announcementGas).toBe(80000n)

        console.log('\n=== Announcement Emission Gas ===')
        console.log(`Announcement Gas: ${announcementGas}`)
        console.log('This is the stealth metadata publication cost')
      })

      it('should identify announcement as major overhead component', () => {
        const ethTransfer = estimateEthTransferGas('mainnet')
        const announcementPercent =
          Number((ethTransfer.breakdown.announcementGas * 100n) / ethTransfer.breakdown.totalGas)

        // Announcement is ~79% of total ETH stealth transfer gas
        expect(announcementPercent).toBeGreaterThan(70)

        console.log(`\nAnnouncement is ${announcementPercent}% of total ETH stealth gas`)
      })
    })

    describe('Stealth Address Claim', () => {
      it('should benchmark ETH claim gas', () => {
        const estimate = estimateClaimGas('mainnet', false)

        expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.ethTransfer)
        expect(estimate.breakdown.announcementGas).toBe(0n)

        console.log('\n=== ETH Claim Gas ===')
        console.log(`Claim Gas: ${estimate.breakdown.totalGas}`)
        console.log('(Same as regular ETH transfer - no announcement needed)')
      })

      it('should benchmark ERC-20 claim gas', () => {
        const estimate = estimateClaimGas('mainnet', true)

        expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.erc20Transfer)

        console.log('\n=== ERC-20 Claim Gas ===')
        console.log(`Claim Gas: ${estimate.breakdown.totalGas}`)
      })
    })

    describe('Registry Operations', () => {
      it('should benchmark registry registration gas', () => {
        const estimate = estimateRegistryGas('mainnet', 'register')

        expect(estimate.breakdown.totalGas).toBe(DEFAULT_GAS_LIMITS.registryRegister)

        console.log('\n=== Registry Registration Gas ===')
        console.log(`Registration Gas: ${estimate.breakdown.totalGas}`)
      })

      it('should benchmark registry update gas', () => {
        const estimate = estimateRegistryGas('mainnet', 'update')

        expect(estimate.breakdown.totalGas).toBe(DEFAULT_GAS_LIMITS.registryUpdate)

        console.log('\n=== Registry Update Gas ===')
        console.log(`Update Gas: ${estimate.breakdown.totalGas}`)
      })

      it('should verify registry query is free (view call)', () => {
        const estimate = estimateRegistryGas('mainnet', 'query')

        expect(estimate.breakdown.totalGas).toBe(0n)

        console.log('\n=== Registry Query Gas ===')
        console.log('Query Gas: 0 (view call)')
      })
    })
  })

  describe('Privacy vs Regular Transfer Comparison', () => {
    it('should produce comparison table', () => {
      const comparisons: GasComparisonResult[] = [
        {
          operation: 'ETH Transfer',
          privacyGas: estimateEthTransferGas('mainnet').breakdown.totalGas,
          baselineGas: BASELINE_GAS.ethTransfer,
          overhead: 0n,
          overheadPercent: 0,
        },
        {
          operation: 'ERC-20 Transfer',
          privacyGas: estimateTokenTransferGas('mainnet', false).breakdown.totalGas,
          baselineGas: BASELINE_GAS.erc20Transfer,
          overhead: 0n,
          overheadPercent: 0,
        },
        {
          operation: 'ERC-20 + Approval',
          privacyGas: estimateTokenTransferGas('mainnet', true).breakdown.totalGas,
          baselineGas: BASELINE_GAS.erc20Transfer + BASELINE_GAS.erc20Approve,
          overhead: 0n,
          overheadPercent: 0,
        },
      ]

      // Calculate overhead
      for (const comp of comparisons) {
        comp.overhead = comp.privacyGas - comp.baselineGas
        comp.overheadPercent = calculateOverhead(comp.privacyGas, comp.baselineGas)
      }

      console.log('\n=== Privacy vs Regular Transfer Comparison ===')
      console.log('| Operation                 | Privacy Gas |  Baseline  |   Overhead  | Overhead % |')
      console.log('|---------------------------|-------------|------------|-------------|------------|')
      for (const comp of comparisons) {
        console.log(formatComparisonRow(comp))
      }

      // Verify expected overhead
      expect(comparisons[0].overheadPercent).toBeGreaterThan(350) // ETH: ~380%
      expect(comparisons[1].overheadPercent).toBeGreaterThan(100) // ERC-20: ~123%
    })
  })

  describe('Network Gas Cost Comparison', () => {
    it('should benchmark across L1 networks', () => {
      const results: GasBenchmarkResult[] = []

      for (const network of L1_NETWORKS) {
        const estimate = estimateEthTransferGas(network)
        const costUsd = estimateCostUsd(estimate)

        results.push({
          operation: 'ETH Stealth Transfer',
          network,
          gasUsed: estimate.breakdown.totalGas,
          costWei: estimate.estimatedCostWei,
          costEth: estimate.estimatedCostEth,
          costUsd: costUsd.toFixed(2),
          overheadVsBaseline: calculateOverhead(
            estimate.breakdown.totalGas,
            BASELINE_GAS.ethTransfer
          ),
        })
      }

      console.log('\n=== L1 Network Gas Costs (ETH Stealth Transfer) ===')
      console.log('| Operation                 | Network      |    Gas    |      ETH    |    USD    | Overhead |')
      console.log('|---------------------------|--------------|-----------|-------------|-----------|----------|')
      for (const result of results) {
        console.log(formatBenchmarkRow(result))
      }
    })

    it('should benchmark across L2 networks', () => {
      const results: GasBenchmarkResult[] = []

      for (const network of L2_NETWORKS) {
        const estimate = estimateEthTransferGas(network)
        const costUsd = estimateCostUsd(estimate)

        results.push({
          operation: 'ETH Stealth Transfer',
          network,
          gasUsed: estimate.breakdown.totalGas,
          costWei: estimate.estimatedCostWei,
          costEth: estimate.estimatedCostEth,
          costUsd: costUsd.toFixed(2),
          overheadVsBaseline: calculateOverhead(
            estimate.breakdown.totalGas,
            BASELINE_GAS.ethTransfer
          ),
        })
      }

      console.log('\n=== L2 Network Gas Costs (ETH Stealth Transfer) ===')
      console.log('| Operation                 | Network      |    Gas    |      ETH    |    USD    | Overhead |')
      console.log('|---------------------------|--------------|-----------|-------------|-----------|----------|')
      for (const result of results) {
        console.log(formatBenchmarkRow(result))
      }
    })

    it('should compare L1 vs L2 average costs', () => {
      // Calculate L1 average
      const l1Costs = L1_NETWORKS.map(n => {
        const estimate = estimateEthTransferGas(n)
        return estimateCostUsd(estimate)
      })
      const l1Avg = l1Costs.reduce((a, b) => a + b, 0) / l1Costs.length

      // Calculate L2 average
      const l2Costs = L2_NETWORKS.map(n => {
        const estimate = estimateEthTransferGas(n)
        return estimateCostUsd(estimate)
      })
      const l2Avg = l2Costs.reduce((a, b) => a + b, 0) / l2Costs.length

      const savings = ((l1Avg - l2Avg) / l1Avg) * 100

      console.log('\n=== L1 vs L2 Cost Comparison ===')
      console.log(`L1 Average Cost: $${l1Avg.toFixed(2)}`)
      console.log(`L2 Average Cost: $${l2Avg.toFixed(2)}`)
      console.log(`L2 Savings: ${savings.toFixed(1)}%`)

      // L2 should be significantly cheaper
      expect(savings).toBeGreaterThan(90) // >90% cheaper on L2
    })
  })

  describe('High Gas Operations Identification', () => {
    it('should identify highest gas operations', () => {
      const operations = [
        {
          name: 'ETH Stealth Transfer',
          gas: estimateEthTransferGas('mainnet').breakdown.totalGas,
        },
        {
          name: 'ERC-20 Stealth Transfer',
          gas: estimateTokenTransferGas('mainnet', false).breakdown.totalGas,
        },
        {
          name: 'ERC-20 + Approval',
          gas: estimateTokenTransferGas('mainnet', true).breakdown.totalGas,
        },
        { name: 'ETH Claim', gas: estimateClaimGas('mainnet', false).breakdown.totalGas },
        {
          name: 'ERC-20 Claim',
          gas: estimateClaimGas('mainnet', true).breakdown.totalGas,
        },
        {
          name: 'Registry Register',
          gas: estimateRegistryGas('mainnet', 'register').breakdown.totalGas,
        },
        {
          name: 'Registry Update',
          gas: estimateRegistryGas('mainnet', 'update').breakdown.totalGas,
        },
        { name: 'Announcement Only', gas: DEFAULT_GAS_LIMITS.announcement },
      ]

      // Sort by gas usage descending
      operations.sort((a, b) => (a.gas > b.gas ? -1 : 1))

      console.log('\n=== Operations Ranked by Gas Usage ===')
      console.log('| Rank | Operation                      |    Gas    |')
      console.log('|------|--------------------------------|-----------|')
      operations.forEach((op, i) => {
        console.log(`|  ${(i + 1).toString().padStart(2)}  | ${op.name.padEnd(30)} | ${op.gas.toString().padStart(9)} |`)
      })

      // Top gas consumers
      expect(operations[0].name).toContain('ERC-20') // ERC-20 with approval is most expensive
      expect(operations[1].name).toContain('Registry') // Registry register is next
    })

    it('should identify announcement as primary overhead source', () => {
      const announcement = DEFAULT_GAS_LIMITS.announcement
      const ethTransfer = DEFAULT_GAS_LIMITS.ethTransfer
      const erc20Transfer = DEFAULT_GAS_LIMITS.erc20Transfer

      console.log('\n=== Announcement Overhead Analysis ===')
      console.log(`Announcement Gas: ${announcement}`)
      console.log(`ETH Transfer Base: ${ethTransfer}`)
      console.log(`ERC-20 Transfer Base: ${erc20Transfer}`)
      console.log(`Announcement as % of ETH stealth: ${Number((announcement * 100n) / (announcement + ethTransfer))}%`)
      console.log(`Announcement as % of ERC-20 stealth: ${Number((announcement * 100n) / (announcement + erc20Transfer))}%`)

      // Announcement is the primary overhead
      expect(announcement).toBeGreaterThan(ethTransfer) // 80k > 21k
    })
  })

  describe('Optimization Recommendations', () => {
    it('should document optimization opportunities', () => {
      console.log('\n=== Gas Optimization Recommendations ===\n')

      console.log('1. **Use L2 Networks**')
      console.log('   - Arbitrum, Optimism, Base offer 90%+ gas savings')
      console.log('   - Same security guarantees via fraud/validity proofs\n')

      console.log('2. **Batch Announcements**')
      console.log('   - Current: 80,000 gas per announcement')
      console.log('   - Opportunity: Batch multiple announcements in one tx')
      console.log('   - Potential savings: ~40% per transfer in batch\n')

      console.log('3. **Off-chain Metadata**')
      console.log('   - Store metadata off-chain (IPFS, Arweave)')
      console.log('   - Publish only hash on-chain')
      console.log('   - Tradeoff: Adds dependency on off-chain storage\n')

      console.log('4. **ERC-20 Permit (EIP-2612)**')
      console.log('   - Avoid separate approval transaction')
      console.log('   - Savings: ~46,000 gas per first transfer')
      console.log('   - Requires token support\n')

      console.log('5. **View Tag Optimization**')
      console.log('   - Current: Recipients scan all announcements')
      console.log('   - With view tag: Filter 99.6% of announcements')
      console.log('   - Already implemented in SIP SDK\n')

      // This test just documents recommendations
      expect(true).toBe(true)
    })
  })

  describe('Gas Cost Tracking Over Time', () => {
    it('should produce versioned gas report', () => {
      const version = '0.6.0'
      const timestamp = new Date().toISOString()

      // Convert BigInt values to strings for JSON serialization
      const gasLimitsString = {
        ethTransfer: DEFAULT_GAS_LIMITS.ethTransfer.toString(),
        erc20Transfer: DEFAULT_GAS_LIMITS.erc20Transfer.toString(),
        erc20Approve: DEFAULT_GAS_LIMITS.erc20Approve.toString(),
        announcement: DEFAULT_GAS_LIMITS.announcement.toString(),
        claim: DEFAULT_GAS_LIMITS.claim.toString(),
        registryRegister: DEFAULT_GAS_LIMITS.registryRegister.toString(),
        registryUpdate: DEFAULT_GAS_LIMITS.registryUpdate.toString(),
        registryQuery: DEFAULT_GAS_LIMITS.registryQuery.toString(),
      }

      const report = {
        version,
        timestamp,
        network: 'mainnet' as EthereumNetwork,
        gasLimits: gasLimitsString,
        estimates: {
          ethStealthTransfer: estimateEthTransferGas('mainnet').breakdown.totalGas.toString(),
          erc20StealthTransfer: estimateTokenTransferGas('mainnet', false).breakdown.totalGas.toString(),
          erc20WithApproval: estimateTokenTransferGas('mainnet', true).breakdown.totalGas.toString(),
          ethClaim: estimateClaimGas('mainnet', false).breakdown.totalGas.toString(),
          erc20Claim: estimateClaimGas('mainnet', true).breakdown.totalGas.toString(),
          registryRegister: estimateRegistryGas('mainnet', 'register').breakdown.totalGas.toString(),
        },
        overheads: {
          ethVsBaseline: calculateOverhead(
            estimateEthTransferGas('mainnet').breakdown.totalGas,
            BASELINE_GAS.ethTransfer
          ),
          erc20VsBaseline: calculateOverhead(
            estimateTokenTransferGas('mainnet', false).breakdown.totalGas,
            BASELINE_GAS.erc20Transfer
          ),
        },
      }

      console.log('\n=== Gas Report v' + version + ' ===')
      console.log(JSON.stringify(report, null, 2))

      // Store for regression tracking
      expect(DEFAULT_GAS_LIMITS.ethTransfer).toBe(21000n)
      expect(DEFAULT_GAS_LIMITS.erc20Transfer).toBe(65000n)
      expect(DEFAULT_GAS_LIMITS.announcement).toBe(80000n)
    })

    it('should verify gas limits have not regressed', () => {
      // Baseline gas limits that should not increase without good reason
      const EXPECTED_GAS_LIMITS = {
        ethTransfer: 21000n,
        erc20Transfer: 65000n,
        erc20Approve: 46000n,
        announcement: 80000n,
        claim: 100000n,
        registryRegister: 150000n,
        registryUpdate: 100000n,
      }

      // Verify no regression
      expect(DEFAULT_GAS_LIMITS.ethTransfer).toBe(EXPECTED_GAS_LIMITS.ethTransfer)
      expect(DEFAULT_GAS_LIMITS.erc20Transfer).toBe(EXPECTED_GAS_LIMITS.erc20Transfer)
      expect(DEFAULT_GAS_LIMITS.erc20Approve).toBe(EXPECTED_GAS_LIMITS.erc20Approve)
      expect(DEFAULT_GAS_LIMITS.announcement).toBe(EXPECTED_GAS_LIMITS.announcement)
      expect(DEFAULT_GAS_LIMITS.claim).toBe(EXPECTED_GAS_LIMITS.claim)
      expect(DEFAULT_GAS_LIMITS.registryRegister).toBe(EXPECTED_GAS_LIMITS.registryRegister)
      expect(DEFAULT_GAS_LIMITS.registryUpdate).toBe(EXPECTED_GAS_LIMITS.registryUpdate)
    })
  })

  describe('Gas Price Suggestions', () => {
    it('should provide speed-based gas price suggestions', () => {
      const baseFee = 30n * ONE_GWEI

      const slow = getGasPriceSuggestion(baseFee, 'slow')
      const standard = getGasPriceSuggestion(baseFee, 'standard')
      const fast = getGasPriceSuggestion(baseFee, 'fast')

      console.log('\n=== Gas Price Suggestions (Base Fee: 30 gwei) ===')
      console.log(`Slow:     Priority ${slow.maxPriorityFeePerGas / ONE_GWEI} gwei, Max ${slow.maxFeePerGas / ONE_GWEI} gwei`)
      console.log(`Standard: Priority ${standard.maxPriorityFeePerGas / ONE_GWEI} gwei, Max ${standard.maxFeePerGas / ONE_GWEI} gwei`)
      console.log(`Fast:     Priority ${fast.maxPriorityFeePerGas / ONE_GWEI} gwei, Max ${fast.maxFeePerGas / ONE_GWEI} gwei`)

      // Priority fees should increase with speed
      expect(slow.maxPriorityFeePerGas).toBeLessThan(standard.maxPriorityFeePerGas)
      expect(standard.maxPriorityFeePerGas).toBeLessThan(fast.maxPriorityFeePerGas)
    })
  })

  describe('Full Benchmark Report', () => {
    it('should generate comprehensive benchmark summary', () => {
      console.log('\n')
      console.log('╔═══════════════════════════════════════════════════════════════════════════════╗')
      console.log('║                    ETHEREUM GAS BENCHMARK SUMMARY                             ║')
      console.log('╠═══════════════════════════════════════════════════════════════════════════════╣')

      // Gas Limits
      console.log('║ GAS LIMITS                                                                    ║')
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      console.log(`║ ETH Transfer:          ${DEFAULT_GAS_LIMITS.ethTransfer.toString().padStart(10)}                                        ║`)
      console.log(`║ ERC-20 Transfer:       ${DEFAULT_GAS_LIMITS.erc20Transfer.toString().padStart(10)}                                        ║`)
      console.log(`║ ERC-20 Approve:        ${DEFAULT_GAS_LIMITS.erc20Approve.toString().padStart(10)}                                        ║`)
      console.log(`║ Announcement:          ${DEFAULT_GAS_LIMITS.announcement.toString().padStart(10)}                                        ║`)
      console.log(`║ Claim:                 ${DEFAULT_GAS_LIMITS.claim.toString().padStart(10)}                                        ║`)
      console.log(`║ Registry Register:     ${DEFAULT_GAS_LIMITS.registryRegister.toString().padStart(10)}                                        ║`)

      // Total Gas for Operations
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      console.log('║ TOTAL GAS BY OPERATION                                                        ║')
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      const ethTotal = DEFAULT_GAS_LIMITS.ethTransfer + DEFAULT_GAS_LIMITS.announcement
      const erc20Total = DEFAULT_GAS_LIMITS.erc20Transfer + DEFAULT_GAS_LIMITS.announcement
      console.log(`║ ETH Stealth Transfer:  ${ethTotal.toString().padStart(10)} (21k + 80k)                            ║`)
      console.log(`║ ERC-20 Stealth:        ${erc20Total.toString().padStart(10)} (65k + 80k)                            ║`)

      // Overhead
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      console.log('║ PRIVACY OVERHEAD                                                              ║')
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      const ethOverhead = calculateOverhead(ethTotal, BASELINE_GAS.ethTransfer)
      const erc20Overhead = calculateOverhead(erc20Total, BASELINE_GAS.erc20Transfer)
      console.log(`║ ETH Transfer Overhead:   +${ethOverhead.toFixed(1).padStart(6)}% (primarily announcement cost)      ║`)
      console.log(`║ ERC-20 Transfer Overhead:+${erc20Overhead.toFixed(1).padStart(6)}% (announcement is ~55% of total)    ║`)

      // Key Insight
      console.log('╟───────────────────────────────────────────────────────────────────────────────╢')
      console.log('║ KEY INSIGHT: Announcement (80k gas) is the primary privacy cost.             ║')
      console.log('║ Consider L2 networks for 90%+ cost reduction.                                ║')
      console.log('╚═══════════════════════════════════════════════════════════════════════════════╝')
      console.log('\n')

      // Verify the report values
      expect(ethOverhead).toBeGreaterThan(380)
      expect(erc20Overhead).toBeGreaterThan(120)
    })
  })
})
