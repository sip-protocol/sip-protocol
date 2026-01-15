/**
 * Example: Arcium + SIP Combined Privacy Demo
 *
 * This example demonstrates the synergy between SIP Protocol and Arcium:
 * - SIP Native: Transaction privacy (stealth addresses hide recipient/sender)
 * - Arcium: Compute privacy (C-SPL tokens hide amounts via encryption)
 * - Combined: Maximum privacy (hidden sender, recipient, AND amounts)
 *
 * Use case: Private payments with regulatory compliance support via viewing keys.
 *
 * Bounty: Solana Privacy Hack - Arcium Track ($10,000)
 * Issue: https://github.com/sip-protocol/sip-protocol/issues/484
 *
 * IMPORTANT: This demo shows the CORRECT pattern for handling result types.
 * Always check result.success BEFORE accessing result fields like csplMint.
 *
 * Issue #527: This example demonstrates proper wrapResult.success checks.
 */

import { PrivacyLevel } from '@sip-protocol/types'
import {
  // Arcium Backend (compute privacy)
  ArciumBackend,
  // C-SPL Token Service (encrypted balances)
  CSPLTokenService,
  // Combined Privacy Service (SIP Native + C-SPL)
  createCombinedPrivacyServiceDevnet,
  // C-SPL Types
  CSPL_TOKENS,
  type CSPLToken,
} from '../src/privacy-backends'

// Demo addresses
const ALICE = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const BOB_META_ADDRESS = 'sip:solana:0x02abc123def456789012345678901234567890123456:0x03def456abc789012345678901234567890123456789'

// Token mints
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║     SIP Protocol + Arcium: Combined Privacy Demo              ║')
  console.log('║     Demonstrating proper wrapResult.success checks (#527)     ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 1: Arcium Backend Overview
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 1: Arcium Backend Overview ━━━\n')

  const arcium = new ArciumBackend({
    rpcUrl: 'https://api.devnet.solana.com',
    network: 'devnet',
  })

  console.log('Arcium Backend:')
  console.log(`  Name: ${arcium.name}`)
  console.log(`  Type: ${arcium.type} (MPC compute privacy)`)
  console.log(`  Chains: ${arcium.chains.join(', ')}`)

  const caps = arcium.getCapabilities()
  console.log('\nCapabilities:')
  console.log(`  Hidden Amount: ${caps.hiddenAmount}`)
  console.log(`  Hidden Sender: ${caps.hiddenSender}`)
  console.log(`  Hidden Recipient: ${caps.hiddenRecipient}`)
  console.log(`  Hidden Compute: ${caps.hiddenCompute} ← Arcium's unique value`)
  console.log(`  Compliance Support: ${caps.complianceSupport}`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 2: C-SPL Token Support
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 2: C-SPL Token Support ━━━\n')

  console.log('Supported C-SPL Tokens:')
  for (const [symbol, token] of Object.entries(CSPL_TOKENS)) {
    const t = token as Partial<CSPLToken>
    console.log(`  ${symbol}:`)
    console.log(`    Mint: ${t.mint?.slice(0, 20)}...`)
    console.log(`    Decimals: ${t.decimals}`)
    console.log(`    Native Wrap: ${t.isNativeWrap ?? false}`)
  }
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 3: C-SPL Token Service - Proper Result Handling (#527)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 3: C-SPL Token Service - Proper Result Handling (#527) ━━━\n')

  const csplService = new CSPLTokenService({
    rpcUrl: 'https://api.devnet.solana.com',
  })
  await csplService.initialize()

  // Wrap SPL to C-SPL with PROPER error handling
  console.log('Step 1: Wrap SPL → C-SPL (with proper success checks)')
  console.log('  ⚠️  IMPORTANT: Always check wrapResult.success BEFORE accessing fields!\n')

  const wrapResult = await csplService.wrap({
    mint: USDC_MINT,
    amount: 1000_000000n, // 1000 USDC
    owner: ALICE,
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // CRITICAL: Check wrapResult.success BEFORE accessing csplMint or other fields!
  // This is the FIX for Issue #527 - never use wrapResult.csplMint! directly
  // ══════════════════════════════════════════════════════════════════════════════
  if (!wrapResult.success) {
    console.log('  ❌ Wrap failed!')
    console.log(`  Error: ${wrapResult.error}`)
    console.log('  Exiting demo - cannot proceed without wrapped tokens.\n')
    return
  }

  // NOW it's safe to access wrapResult fields
  console.log('  ✅ Wrap succeeded!')
  console.log(`  C-SPL Mint: ${wrapResult.csplMint?.slice(0, 20)}...`)
  console.log(`  Amount: 1000 USDC (now encrypted on-chain)`)
  console.log(`  Signature: ${wrapResult.signature?.slice(0, 20)}...`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Show the WRONG way (what we're fixing with issue #527)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ WRONG vs RIGHT Pattern (Issue #527) ━━━\n')

  console.log('❌ WRONG (what we fixed):')
  console.log('   // Using non-null assertion without checking success')
  console.log('   const balance = await cspl.getBalance(wrapResult.csplMint!, ALICE)')
  console.log('   // This could crash if wrapResult.success was false!')
  console.log()

  console.log('✅ RIGHT (what we do now):')
  console.log('   // Check success FIRST')
  console.log('   if (!wrapResult.success) {')
  console.log('     console.error(wrapResult.error)')
  console.log('     return')
  console.log('   }')
  console.log('   // NOW safe to access fields')
  console.log('   const balance = await cspl.getBalance(wrapResult.csplMint, ALICE)')
  console.log()

  // Check balance (using the safe pattern)
  if (wrapResult.csplMint) {
    console.log('Step 2: Check Confidential Balance (safe pattern)')
    const balance = await csplService.getBalance(wrapResult.csplMint, ALICE)
    if (balance) {
      console.log(`  Token: ${balance.token.symbol || 'Unknown'}`)
      console.log(`  Encrypted Balance: [stored on-chain, hidden from public]`)
      console.log(`  Owner can decrypt with their private key`)
    } else {
      console.log('  Balance not available (simulated environment)')
    }
    console.log()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 4: Combined Privacy Service - Full Integration
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 4: Combined Privacy Service ━━━\n')

  const combined = createCombinedPrivacyServiceDevnet()
  await combined.initialize()

  // Show privacy comparison
  const comparison = combined.getPrivacyComparison()
  console.log('Privacy Comparison:')
  console.log('┌─────────────────┬────────────┬─────────┬──────────┐')
  console.log('│ Feature         │ SIP Native │ Arcium  │ Combined │')
  console.log('├─────────────────┼────────────┼─────────┼──────────┤')
  console.log(`│ Hidden Sender   │     ${comparison.sipNative.hiddenSender ? '✓' : '✗'}      │    ${comparison.arciumCSPL.hiddenSender ? '✓' : '✗'}    │    ${comparison.combined.hiddenSender ? '✓' : '✗'}     │`)
  console.log(`│ Hidden Recipient│     ${comparison.sipNative.hiddenRecipient ? '✓' : '✗'}      │    ${comparison.arciumCSPL.hiddenRecipient ? '✓' : '✗'}    │    ${comparison.combined.hiddenRecipient ? '✓' : '✗'}     │`)
  console.log(`│ Hidden Amount   │     ${comparison.sipNative.hiddenAmount ? '✓' : '✗'}      │    ${comparison.arciumCSPL.hiddenAmount ? '✓' : '✗'}    │    ${comparison.combined.hiddenAmount ? '✓' : '✗'}     │`)
  console.log(`│ Hidden Compute  │     ${comparison.sipNative.hiddenCompute ? '✓' : '✗'}      │    ${comparison.arciumCSPL.hiddenCompute ? '✓' : '✗'}    │    ${comparison.combined.hiddenCompute ? '✓' : '✗'}     │`)
  console.log(`│ Compliance      │     ${comparison.sipNative.compliance ? '✓' : '✗'}      │    ${comparison.arciumCSPL.compliance ? '✓' : '✗'}    │    ${comparison.combined.compliance ? '✓' : '✗'}     │`)
  console.log('└─────────────────┴────────────┴─────────┴──────────┘')
  console.log()

  console.log('Key Insight:')
  console.log('  → SIP Native provides transaction privacy (stealth addresses)')
  console.log('  → Arcium provides compute privacy (encrypted balances via MPC)')
  console.log('  → Combined = Complete privacy with compliance support!')
  console.log()

  // Execute combined private transfer
  console.log('Executing Combined Private Transfer:')
  console.log(`  From: ${ALICE.slice(0, 16)}...`)
  console.log(`  To: ${BOB_META_ADDRESS.slice(0, 30)}... (SIP meta-address)`)
  console.log(`  Amount: 100 USDC (will be hidden)`)
  console.log()

  const result = await combined.executePrivateTransfer({
    sender: ALICE,
    recipientMetaAddress: BOB_META_ADDRESS,
    amount: 100_000000n, // 100 USDC
    token: USDC_MINT,
    privacyLevel: PrivacyLevel.SHIELDED,
    memo: 'Combined privacy payment',
  })

  // Again - always check success FIRST!
  if (!result.success) {
    console.log('❌ Combined transfer failed!')
    console.log(`Error: ${result.error}`)
    return
  }

  console.log('✅ Transfer Result:')
  console.log(`  Stealth Address: ${result.stealthAddress?.slice(0, 20)}...`)
  console.log(`  C-SPL Mint: ${result.csplMint?.slice(0, 20)}...`)
  console.log(`  Total Time: ${result.metadata?.totalDuration}ms`)
  console.log()

  console.log('Steps Completed:')
  console.log(`  1. Wrap: SPL → C-SPL ✓`)
  console.log(`     Signature: ${result.wrapSignature?.slice(0, 20)}...`)
  console.log(`  2. Stealth: Generated one-time address ✓`)
  console.log(`     Address: ${result.stealthAddress?.slice(0, 20)}...`)
  console.log(`  3. Transfer: C-SPL to stealth address ✓`)
  console.log(`     Signature: ${result.transferSignature?.slice(0, 20)}...`)
  console.log()

  console.log('Privacy Achieved:')
  console.log(`  Hidden Recipient: ✓ (stealth address)`)
  console.log(`  Hidden Amount: ✓ (C-SPL encryption)`)
  console.log(`  Hidden Sender: ✓ (no linkability)`)
  console.log(`  Compliance Support: ${result.metadata?.hasViewingKey ? '✓' : '✗'} (viewing key)`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 5: Cost Estimation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 5: Cost Estimation ━━━\n')

  const costEstimate = await combined.estimateCost({
    sender: ALICE,
    recipientMetaAddress: BOB_META_ADDRESS,
    amount: 100_000000n,
    token: USDC_MINT,
    privacyLevel: PrivacyLevel.SHIELDED,
  })

  console.log('Estimated Costs:')
  console.log(`  Wrap (SPL → C-SPL): ${costEstimate.wrapCost} lamports`)
  console.log(`  Stealth address: ${costEstimate.stealthCost} lamports`)
  console.log(`  Transfer: ${costEstimate.transferCost} lamports`)
  console.log(`  ─────────────────────`)
  console.log(`  Total: ${costEstimate.totalCost} ${costEstimate.currency}`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 6: Recipient Claim Flow
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 6: Recipient Claim Flow ━━━\n')

  if (result.stealthAddress) {
    console.log('Bob receives the stealth announcement...')
    console.log(`  Stealth Address: ${result.stealthAddress.slice(0, 20)}...`)
    console.log()

    console.log('Bob derives his stealth private key:')
    const claimResult = await combined.claimFromStealth({
      stealthAddress: result.stealthAddress,
      ephemeralPubkey: 'simulated-ephemeral-pubkey',
      spendingPrivateKey: '0x02abc123def456789012345678901234567890123456',
      viewingPrivateKey: '0x03def456abc789012345678901234567890123456789',
      csplMint: result.csplMint || '',
    })

    // Check success first!
    if (!claimResult.success) {
      console.log(`  ❌ Claim failed: ${claimResult.error}`)
    } else {
      console.log(`  ✅ Claim succeeded!`)
      console.log(`  Amount: ${claimResult.amount} (decrypted)`)
      console.log(`  Signature: ${claimResult.signature?.slice(0, 20)}...`)
    }
    console.log()

    console.log('Bob can now:')
    console.log('  1. Hold C-SPL tokens (balance remains private)')
    console.log('  2. Transfer to another stealth address')
    console.log('  3. Unwrap to SPL when ready to use publicly')
  }
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                         Summary                                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log('Issue #527 Fix Demonstrated:')
  console.log()
  console.log('  The key fix is to ALWAYS check result.success BEFORE accessing')
  console.log('  result fields like csplMint, stealthAddress, signature, etc.')
  console.log()
  console.log('  ❌ Wrong:  wrapResult.csplMint!  (non-null assertion)')
  console.log('  ✅ Right:  if (!wrapResult.success) { return } // then access')
  console.log()

  console.log('SIP Protocol + Arcium Integration:')
  console.log()
  console.log('  ┌──────────────────┐     ┌──────────────────┐')
  console.log('  │   SIP Native     │     │    Arcium        │')
  console.log('  │                  │     │                  │')
  console.log('  │ • Stealth Addr   │  +  │ • C-SPL Tokens   │')
  console.log('  │ • Viewing Keys   │     │ • MPC Compute    │')
  console.log('  │ • Compliance     │     │ • Encrypted Bal  │')
  console.log('  └────────┬─────────┘     └────────┬─────────┘')
  console.log('           │                        │')
  console.log('           └───────────┬────────────┘')
  console.log('                       ▼')
  console.log('           ┌──────────────────────┐')
  console.log('           │   Complete Privacy   │')
  console.log('           │                      │')
  console.log('           │ • Hidden Sender      │')
  console.log('           │ • Hidden Recipient   │')
  console.log('           │ • Hidden Amount      │')
  console.log('           │ • Hidden Compute     │')
  console.log('           │ • Audit Support      │')
  console.log('           └──────────────────────┘')
  console.log()

  console.log('━━━ Demo Complete ━━━')

  // Cleanup
  await csplService.disconnect()
  await combined.disconnect()
}

main().catch(console.error)
