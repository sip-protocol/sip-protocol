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
 */

import {
  // Arcium Backend
  ArciumBackend,
  createArciumDevnetBackend,
  // C-SPL Token Service
  CSPLTokenService,
  createCSPLServiceDevnet,
  // Combined Privacy Service
  CombinedPrivacyService,
  createCombinedPrivacyServiceDevnet,
  // Types
  CSPL_TOKEN_REGISTRY,
  hasCSPLSupport,
  getCSPLToken,
} from '../src/privacy-backends'

// Token mints
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

// Demo addresses
const ALICE = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const BOB_META_ADDRESS = 'sip:solana:0x02abc123def456789012345678901234567890123456:0x03def456abc789012345678901234567890123456789'
const AUDITOR_VIEWING_KEY = '0x04audit123456789compliance987654321viewkey'

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║     SIP Protocol + Arcium: Combined Privacy Demo              ║')
  console.log('║     Solana Privacy Hack - Arcium Track ($10,000)              ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 1: Arcium Backend Overview
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 1: Arcium Backend Overview ━━━\n')

  const arcium = createArciumDevnetBackend()
  await arcium.initialize()

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
  for (const [mint, token] of Object.entries(CSPL_TOKEN_REGISTRY)) {
    console.log(`  ${token.symbol}:`)
    console.log(`    SPL Mint: ${mint.slice(0, 20)}...`)
    console.log(`    C-SPL Mint: ${token.csplMint.slice(0, 20)}...`)
    console.log(`    Decimals: ${token.decimals}`)
    console.log(`    Wrap Enabled: ${token.wrapEnabled}`)
  }
  console.log()

  // Check token support
  console.log('Token Support Check:')
  console.log(`  USDC: ${hasCSPLSupport(USDC_MINT) ? '✓ Supported' : '✗ Not supported'}`)
  console.log(`  SOL: ${hasCSPLSupport(SOL_MINT) ? '✓ Supported' : '✗ Not supported'}`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 3: C-SPL Token Service Operations
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 3: C-SPL Token Service Operations ━━━\n')

  const cspl = createCSPLServiceDevnet({ verbose: false })
  await cspl.initialize()

  // Wrap SPL to C-SPL
  console.log('Step 1: Wrap SPL → C-SPL (hide balance)')
  const wrapResult = await cspl.wrap({
    splMint: USDC_MINT,
    owner: ALICE,
    amount: 1000_000000n, // 1000 USDC
  })
  console.log(`  Success: ${wrapResult.success}`)
  console.log(`  C-SPL Mint: ${wrapResult.csplMint?.slice(0, 20)}...`)
  console.log(`  Amount: 1000 USDC (now encrypted)`)
  console.log()

  // Check balance
  console.log('Step 2: Check Confidential Balance')
  const balance = await cspl.getBalance(wrapResult.csplMint!, ALICE)
  console.log(`  Encrypted Balance: [encrypted on-chain]`)
  console.log(`  Decrypted (owner only): ${balance?.decryptedBalance} lamports`)
  console.log(`  Symbol: ${balance?.symbol}`)
  console.log()

  // Confidential transfer
  console.log('Step 3: Confidential Transfer')
  const transferResult = await cspl.transfer({
    csplMint: wrapResult.csplMint!,
    sender: ALICE,
    recipient: 'BobsAddress123456789012345678901234567890123',
    amount: 500_000000n, // 500 USDC
    auditorKey: AUDITOR_VIEWING_KEY,
    memo: 'Private payment',
  })
  console.log(`  Success: ${transferResult.success}`)
  console.log(`  Signature: ${transferResult.signature?.slice(0, 20)}...`)
  console.log(`  Amount: Hidden from public (encrypted)`)
  console.log(`  Auditor: Can decrypt with viewing key`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 4: Combined Privacy (SIP + Arcium Synergy)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 4: Combined Privacy (SIP + Arcium Synergy) ━━━\n')

  const combined = createCombinedPrivacyServiceDevnet()
  await combined.initialize()

  // Show privacy comparison
  const comparison = combined.getPrivacyComparison()
  console.log('Privacy Comparison:')
  console.log('┌─────────────────┬────────────┬─────────┬──────────┐')
  console.log('│ Feature         │ SIP Native │ Arcium  │ Combined │')
  console.log('├─────────────────┼────────────┼─────────┼──────────┤')
  console.log(`│ Hidden Sender   │     ${comparison.sipNative.hiddenSender ? '✓' : '✗'}      │    ${comparison.arcium.hiddenCompute ? '✗' : '✗'}    │    ✓     │`)
  console.log(`│ Hidden Recipient│     ${comparison.sipNative.hiddenRecipient ? '✓' : '✗'}      │    ✗    │    ✓     │`)
  console.log(`│ Hidden Amount   │     ${comparison.sipNative.hiddenAmount ? '✓' : '✗'}      │    ${comparison.arcium.hiddenAmount ? '✓' : '✗'}    │    ✓     │`)
  console.log(`│ Hidden Compute  │     ✗      │    ${comparison.arcium.hiddenCompute ? '✓' : '✗'}    │    ✓     │`)
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
    splMint: USDC_MINT,
    sender: ALICE,
    recipientMetaAddress: BOB_META_ADDRESS,
    amount: 100_000000n, // 100 USDC
    decimals: 6,
    viewingKey: AUDITOR_VIEWING_KEY,
    memo: 'Combined privacy payment',
  })

  console.log('Transfer Result:')
  console.log(`  Success: ${result.success}`)
  console.log(`  Total Time: ${result.totalTime}ms`)
  console.log()

  if (result.success) {
    console.log('Steps Completed:')
    console.log(`  1. Wrap: SPL → C-SPL ✓`)
    console.log(`     C-SPL Mint: ${result.wrap?.csplMint?.slice(0, 20)}...`)
    console.log(`  2. Stealth: Generated one-time address ✓`)
    console.log(`     Stealth Address: ${result.stealth?.stealthAddress?.slice(0, 20)}...`)
    console.log(`     Ephemeral Key: ${result.stealth?.ephemeralPubKey}`)
    console.log(`  3. Transfer: C-SPL to stealth address ✓`)
    console.log(`     Signature: ${result.transfer?.signature?.slice(0, 20)}...`)
    console.log()

    console.log('Privacy Achieved:')
    console.log(`  Hidden Recipient: ${result.privacyAchieved.hiddenRecipient ? '✓' : '✗'} (stealth address)`)
    console.log(`  Hidden Amount: ${result.privacyAchieved.hiddenAmount ? '✓' : '✗'} (C-SPL encryption)`)
    console.log(`  Hidden Sender: ${result.privacyAchieved.hiddenSender ? '✓' : '✗'} (no linkability)`)
    console.log(`  Compliance Support: ${result.privacyAchieved.complianceSupport ? '✓' : '✗'} (viewing key)`)
  }
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 5: Cost Estimation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 5: Cost Estimation ━━━\n')

  const costEstimate = await combined.estimateCost({
    splMint: USDC_MINT,
    sender: ALICE,
    recipientMetaAddress: BOB_META_ADDRESS,
    amount: 100_000000n,
    decimals: 6,
  })

  console.log('Estimated Costs:')
  console.log(`  Wrap (SPL → C-SPL): ${costEstimate.breakdown.wrap} lamports`)
  console.log(`  Stealth address: ${costEstimate.breakdown.stealth} lamports`)
  console.log(`  Transfer: ${costEstimate.breakdown.transfer} lamports`)
  console.log(`  ─────────────────────`)
  console.log(`  Total: ${costEstimate.totalCost} lamports`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────────────
  // Part 6: Recipient Claim Flow
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('━━━ Part 6: Recipient Claim Flow ━━━\n')

  if (result.success && result.stealth) {
    console.log('Bob receives the stealth announcement...')
    console.log(`  Stealth Address: ${result.stealth.stealthAddress.slice(0, 20)}...`)
    console.log(`  Ephemeral Key: ${result.stealth.ephemeralPubKey}`)
    console.log()

    console.log('Bob derives his stealth private key:')
    const claimResult = await combined.claimFromStealth({
      stealthAddress: result.stealth.stealthAddress,
      ephemeralPubKey: result.stealth.ephemeralPubKey,
      recipientSpendingKey: '0x02abc123def456789012345678901234567890123456',
      recipientViewingKey: '0x03def456abc789012345678901234567890123456789',
      unwrapToSPL: false,
    })

    console.log(`  Success: ${claimResult.success}`)
    console.log(`  Stealth Private Key: ${claimResult.stealthPrivateKey?.slice(0, 20)}...`)
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

  console.log('Value Proposition:')
  console.log('  SIP Protocol acts as a Privacy Aggregator, combining multiple')
  console.log('  privacy backends for superior protection. Users get:')
  console.log()
  console.log('  1. Transaction Privacy (SIP Native)')
  console.log('     - Stealth addresses prevent recipient tracking')
  console.log('     - Pedersen commitments hide amounts')
  console.log()
  console.log('  2. Compute Privacy (Arcium)')
  console.log('     - C-SPL tokens encrypt balances on-chain')
  console.log('     - MPC ensures private computation')
  console.log()
  console.log('  3. Regulatory Compliance')
  console.log('     - Viewing keys allow selective disclosure')
  console.log('     - Auditors can verify without public exposure')
  console.log()

  console.log('━━━ Demo Complete ━━━')
}

main().catch(console.error)
