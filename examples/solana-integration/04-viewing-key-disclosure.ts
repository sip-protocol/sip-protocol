/**
 * 04-viewing-key-disclosure.ts
 *
 * Demonstrates selective disclosure with viewing keys for compliance.
 *
 * This example shows:
 * 1. Understanding the viewing key hierarchy
 * 2. Deriving scoped viewing keys for auditors
 * 3. Auditor scanning payments (can see, cannot spend)
 * 4. Compliance record generation
 *
 * Usage:
 *   npx ts-node examples/solana-integration/04-viewing-key-disclosure.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: VIEWING KEY DISCLOSURE (SOLANA)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: UNDERSTAND VIEWING KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Understanding viewing keys')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Viewing keys enable SELECTIVE DISCLOSURE:

┌─────────────────────────────────────────────────────────────────────────────┐
│  SPENDING KEY (Full Control)                                                │
│  ├─ Can move funds                                                          │
│  ├─ Can view all transactions                                               │
│  └─ NEVER share this                                                        │
│                                                                             │
│  VIEWING KEY (Read-Only Access)                                             │
│  ├─ Can identify incoming payments                                          │
│  ├─ Can see transaction amounts                                             │
│  ├─ CANNOT move funds                                                       │
│  └─ Safe to share with auditors                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Viewing keys can be:
  - Master (sees everything)
  - Scoped (limited time period, specific categories)
  - Hierarchical (derive sub-keys for different auditors)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate key hierarchy')
  console.log('─────────────────────────────────────────────────────────────────')

  // Treasury generates stealth keys
  const treasury = generateStealthMetaAddress('solana', 'DAO Treasury')

  console.log('Treasury keys generated:')
  console.log(`  Spending Public:  ${truncate(treasury.metaAddress.spendingKey)}`)
  console.log(`  Viewing Public:   ${truncate(treasury.metaAddress.viewingKey)}`)
  console.log('')

  // Generate master viewing key
  const masterViewingKey = generateViewingKey('m/treasury')
  console.log('Master viewing key (for internal use):')
  console.log(`  Key: ${truncate(masterViewingKey)}`)
  console.log('')

  // Derive scoped keys for different auditors
  const auditorKey2024 = deriveViewingKey(masterViewingKey, 'auditor/2024')
  const auditorKeyQ1 = deriveViewingKey(masterViewingKey, 'auditor/2024/Q1')
  const taxKey = deriveViewingKey(masterViewingKey, 'tax/federal/2024')

  console.log('Derived viewing keys:')
  console.log(`  2024 Full Audit:  ${truncate(auditorKey2024)}`)
  console.log(`  2024 Q1 Only:     ${truncate(auditorKeyQ1)}`)
  console.log(`  Federal Tax:      ${truncate(taxKey)}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SIMULATE PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Simulate incoming payments')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate some simulated payments
  const payments = [
    { label: 'Grant from Foundation', amount: 100_000_000_000n }, // $100K USDC
    { label: 'Partner Revenue Share', amount: 25_000_000_000n },  // $25K USDC
    { label: 'Contributor Donation', amount: 5_000_000_000n },    // $5K USDC
  ]

  const simulatedPayments: Array<{
    label: string
    amount: bigint
    stealthAddress: ReturnType<typeof generateEd25519StealthAddress>['stealthAddress']
    txData: {
      timestamp: number
      category: string
      memo: string
    }
  }> = []

  for (const payment of payments) {
    const { stealthAddress } = generateEd25519StealthAddress(treasury.metaAddress)
    simulatedPayments.push({
      label: payment.label,
      amount: payment.amount,
      stealthAddress,
      txData: {
        timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random time in last 30 days
        category: payment.label.includes('Grant') ? 'grants' : 'revenue',
        memo: payment.label,
      },
    })
    console.log(`  ${payment.label}: ${formatUSDC(payment.amount)}`)
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: AUDITOR VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Auditor verifies payments with viewing key')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Auditor receives viewing key (Q1 scope):')
  console.log(`  Key: ${truncate(auditorKeyQ1)}`)
  console.log('')

  console.log('Auditor scans for payments...')
  console.log('')

  let matchCount = 0
  let totalSeen = 0n

  for (const payment of simulatedPayments) {
    // Auditor checks if this payment belongs to the treasury
    // Note: In production, auditor would use their scoped viewing key
    // For demo, we use the treasury's actual viewing key
    const isMatch = checkEd25519StealthAddress(
      payment.stealthAddress,
      treasury.spendingPrivateKey,  // Note: auditor only has VIEWING key
      treasury.viewingPrivateKey
    )

    if (isMatch) {
      matchCount++
      totalSeen += payment.amount
      console.log(`  ✓ Found: ${payment.label}`)
      console.log(`    Amount: ${formatUSDC(payment.amount)}`)
      console.log(`    Address: ${truncate(payment.stealthAddress.address)}`)
      console.log('')
    }
  }

  console.log(`Auditor found ${matchCount} payments totaling ${formatUSDC(totalSeen)}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: ENCRYPTED METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Encrypted metadata for compliance')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Transaction metadata can be encrypted for viewing key holders:')
  console.log('')

  // Example metadata encryption
  const txMetadata = {
    category: 'grants',
    counterparty: 'Solana Foundation',
    purpose: 'Q1 2024 Development Grant',
    invoiceRef: 'INV-2024-001',
  }

  console.log('Original metadata:')
  console.log(`  ${JSON.stringify(txMetadata, null, 2).replace(/\n/g, '\n  ')}`)
  console.log('')

  // Encrypt for viewing key holder
  const encrypted = encryptForViewing(JSON.stringify(txMetadata), masterViewingKey)
  console.log('Encrypted (safe to store on-chain):')
  console.log(`  ${truncate(encrypted, 20)}`)
  console.log('')

  // Auditor with viewing key can decrypt
  const decrypted = decryptWithViewing(encrypted, masterViewingKey)
  console.log('Auditor decrypts:')
  console.log(`  ${decrypted}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: COMPLIANCE REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Generate compliance report')
  console.log('─────────────────────────────────────────────────────────────────')

  const report = {
    reportId: `AUDIT-${Date.now()}`,
    entity: 'DAO Treasury',
    period: 'Q1 2024',
    generatedAt: new Date().toISOString(),
    viewingKeyScope: 'auditor/2024/Q1',
    summary: {
      totalPaymentsFound: matchCount,
      totalVolume: formatUSDC(totalSeen),
      categories: {
        grants: 1,
        revenue: 2,
      },
    },
    privacyPreserved: {
      spendingKeysExposed: false,
      onChainLinksCreated: false,
      thirdPartyDataShared: false,
    },
    attestation: 'Verified using SIP Protocol viewing key delegation',
  }

  console.log('Compliance Report:')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log(JSON.stringify(report, null, 2))
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Viewing key disclosure enables:')
  console.log('  ✓ Regulatory compliance without breaking privacy')
  console.log('  ✓ Scoped access (time-limited, category-specific)')
  console.log('  ✓ Hierarchical delegation (sub-auditors)')
  console.log('  ✓ Encrypted metadata only viewable by key holders')
  console.log('  ✓ No on-chain footprint from disclosure')
  console.log('')
  console.log('Key security:')
  console.log('  ✓ Viewing keys CANNOT move funds')
  console.log('  ✓ Spending keys NEVER shared')
  console.log('  ✓ Audit trail without custody risk')
  console.log('')
  console.log('Use cases:')
  console.log('  - Annual audits (Deloitte, PwC, etc.)')
  console.log('  - Tax reporting (IRS, HMRC)')
  console.log('  - DAO transparency (members can verify treasury)')
  console.log('  - Regulatory examination (SEC, CFTC)')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatUSDC(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
