/**
 * Example: Conditional Amount Threshold Disclosure
 *
 * This example demonstrates automatic disclosure based on transaction amounts.
 * Use case: Regulatory requirement to report transactions over $10,000.
 */

import {
  createAmountThreshold,
  proveExceedsThreshold,
  verifyThresholdProof,
  shouldDisclose,
} from '../src/compliance/conditional-threshold'
import { commit } from '../src/commitment'

async function main() {
  console.log('=== Conditional Amount Threshold Disclosure Example ===\n')

  // Regulatory threshold: $10,000 USDC (6 decimals)
  const REGULATORY_THRESHOLD = 10000_000000n

  // Scenario 1: Transaction below threshold ($5,000)
  console.log('Scenario 1: Transaction below threshold')
  const amount1 = 5000_000000n
  const { commitment: commitment1 } = commit(amount1)

  const threshold1 = createAmountThreshold({
    viewingKey: 'auditor-viewing-key-abc123',
    threshold: REGULATORY_THRESHOLD,
    commitment: commitment1,
  })

  console.log(`  Amount: $${Number(amount1) / 1_000000}`)
  console.log(`  Threshold: $${Number(REGULATORY_THRESHOLD) / 1_000000}`)
  console.log(`  Should disclose: ${shouldDisclose(amount1, threshold1)}`)
  console.log(`  Privacy preserved: Exact amount remains hidden\n`)

  // Scenario 2: Transaction above threshold ($15,000)
  console.log('Scenario 2: Transaction above threshold')
  const amount2 = 15000_000000n
  const { commitment: commitment2 } = commit(amount2)

  const threshold2 = createAmountThreshold({
    viewingKey: 'auditor-viewing-key-abc123',
    threshold: REGULATORY_THRESHOLD,
    commitment: commitment2,
  })

  console.log(`  Amount: $${Number(amount2) / 1_000000}`)
  console.log(`  Threshold: $${Number(REGULATORY_THRESHOLD) / 1_000000}`)
  console.log(`  Should disclose: ${shouldDisclose(amount2, threshold2)}`)

  // Create range proof (proves amount > threshold without revealing exact amount)
  const proof = proveExceedsThreshold(amount2, REGULATORY_THRESHOLD)
  console.log(`  Range proof generated: ${proof.metadata.proofId}`)
  console.log(`  Proof has ${proof.bitCommitments.length} bit commitments`)

  // Verify the proof
  const isValid = verifyThresholdProof(proof, threshold2)
  console.log(`  Proof valid: ${isValid}`)
  console.log(`  Disclosure required for regulatory compliance\n`)

  // Scenario 3: Edge case - exactly at threshold ($10,000)
  console.log('Scenario 3: Exactly at threshold')
  const amount3 = 10000_000000n
  const { commitment: commitment3 } = commit(amount3)

  const threshold3 = createAmountThreshold({
    viewingKey: 'auditor-viewing-key-abc123',
    threshold: REGULATORY_THRESHOLD,
    commitment: commitment3,
  })

  console.log(`  Amount: $${Number(amount3) / 1_000000}`)
  console.log(`  Threshold: $${Number(REGULATORY_THRESHOLD) / 1_000000}`)
  console.log(`  Should disclose: ${shouldDisclose(amount3, threshold3)}`)

  const proof3 = proveExceedsThreshold(amount3, REGULATORY_THRESHOLD)
  const isValid3 = verifyThresholdProof(proof3, threshold3)
  console.log(`  Proof valid: ${isValid3}\n`)

  // Scenario 4: Multiple jurisdiction thresholds
  console.log('Scenario 4: Multiple jurisdiction thresholds')
  const amount4 = 12000_000000n
  const { commitment: commitment4 } = commit(amount4)

  // US: $10,000 threshold
  const usThreshold = createAmountThreshold({
    viewingKey: 'us-auditor-key',
    threshold: 10000_000000n,
    commitment: commitment4,
  })

  // EU: €15,000 threshold (assume 1:1 for example)
  const euThreshold = createAmountThreshold({
    viewingKey: 'eu-auditor-key',
    threshold: 15000_000000n,
    commitment: commitment4,
  })

  console.log(`  Amount: $${Number(amount4) / 1_000000}`)
  console.log(`  US threshold ($10,000): ${shouldDisclose(amount4, usThreshold)}`)
  console.log(`  EU threshold (€15,000): ${shouldDisclose(amount4, euThreshold)}`)
  console.log(`  Selective disclosure based on jurisdiction\n`)

  console.log('=== Example Complete ===')
}

main().catch(console.error)
