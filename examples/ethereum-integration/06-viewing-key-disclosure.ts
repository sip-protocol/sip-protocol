/**
 * 06-viewing-key-disclosure.ts
 *
 * Demonstrates selective disclosure for compliance using viewing keys.
 *
 * This example shows:
 * 1. Generating viewing keys for auditors
 * 2. Encrypting transaction data
 * 3. Selective disclosure workflows
 * 4. Hierarchical viewing key delegation
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/06-viewing-key-disclosure.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionRecord {
  txHash: HexString
  timestamp: number
  stealthAddress: string
  ephemeralPublicKey: HexString
  viewTag: number
  amount: string
  token: string
  metadata?: string
}

interface DisclosureReport {
  period: string
  totalTransactions: number
  totalVolume: string
  transactions: TransactionRecord[]
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: VIEWING KEY DISCLOSURE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: UNDERSTAND VIEWING KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Understanding viewing keys')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
What are viewing keys?

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEALTH META-ADDRESS STRUCTURE                                             │
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │   Spending Key      │    │   Viewing Key       │                         │
│  │   (secp256k1)       │    │   (secp256k1)       │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
│           │                          │                                      │
│           │                          │                                      │
│           ▼                          ▼                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │   Spending Private  │    │   Viewing Private   │                         │
│  │   - CRITICAL        │    │   - Can share with  │                         │
│  │   - Controls funds  │    │     auditors        │                         │
│  │   - Never share     │    │   - Cannot spend    │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘

Viewing key allows:
  ✓ Identify incoming payments
  ✓ See transaction amounts
  ✓ Verify transaction history
  ✗ Cannot spend funds (requires spending key)
  ✗ Cannot sign transactions
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE MASTER VIEWING KEY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate master viewing key')
  console.log('─────────────────────────────────────────────────────────────────')

  // User's stealth meta-address
  const user = generateStealthMetaAddress('ethereum', 'Treasury Wallet')

  // The viewingPrivateKey can be shared with auditors
  console.log('User setup:')
  console.log(`  Stealth Meta-Address: ${truncate(user.metaAddress.spendingKey)}...`)
  console.log(`  Spending Key (SECRET): ${truncate(user.spendingPrivateKey)}`)
  console.log(`  Viewing Key (shareable): ${truncate(user.viewingPrivateKey)}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: HIERARCHICAL VIEWING KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Hierarchical viewing key delegation')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Using hierarchical derivation for scoped access:

  import { generateViewingKey, deriveViewingKey } from '@sip-protocol/sdk'

  // Master viewing key (full access)
  const masterKey = generateViewingKey('m/treasury')

  // Derive scoped keys for different purposes
  const auditorKey2024 = deriveViewingKey(masterKey, 'auditor/2024')
  const taxKey = deriveViewingKey(masterKey, 'tax/quarterly')
  const complianceKey = deriveViewingKey(masterKey, 'compliance/aml')

Key hierarchy:
  m/treasury (master)
  ├── auditor/2024 (annual audit)
  │   ├── auditor/2024/Q1
  │   ├── auditor/2024/Q2
  │   ├── auditor/2024/Q3
  │   └── auditor/2024/Q4
  ├── tax/quarterly (tax reporting)
  └── compliance/aml (AML monitoring)

Each derived key can only decrypt data encrypted for its scope.
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: ENCRYPT TRANSACTION DATA
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Encrypt transaction data for auditors')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate transaction records
  const transactions: TransactionRecord[] = []
  for (let i = 0; i < 3; i++) {
    const { stealthAddress } = generateStealthAddress(user.metaAddress)

    transactions.push({
      txHash: `0x${randomHex(64)}` as HexString,
      timestamp: Date.now() - i * 86400000,
      stealthAddress: `0x${randomHex(40)}`,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      amount: (Math.random() * 10).toFixed(4),
      token: 'ETH',
    })
  }

  console.log('Transaction records to encrypt:')
  for (const tx of transactions) {
    console.log(`  ${tx.txHash.slice(0, 18)}... | ${tx.amount} ETH | ${new Date(tx.timestamp).toISOString().split('T')[0]}`)
  }
  console.log('')

  console.log(`
Encrypting for auditor:

  import { encryptForViewing } from '@sip-protocol/sdk'

  const transactionData = {
    txHash: '${transactions[0].txHash}',
    amount: '${transactions[0].amount}',
    token: 'ETH',
    timestamp: ${transactions[0].timestamp},
  }

  // Encrypt using auditor's viewing key
  const encrypted = encryptForViewing(
    JSON.stringify(transactionData),
    auditorViewingKey
  )

  // Store encrypted blob (can be public)
  await storeEncryptedRecord(encrypted)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: AUDITOR DECRYPTION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Auditor decrypts transaction data')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Auditor decryption workflow:

  import { decryptWithViewing } from '@sip-protocol/sdk'

  // Auditor receives encrypted records
  const encryptedRecords = await fetchEncryptedRecords(userId, '2024')

  // Decrypt with their viewing key
  const decryptedRecords = []
  for (const encrypted of encryptedRecords) {
    try {
      const decrypted = decryptWithViewing(encrypted, auditorViewingKey)
      decryptedRecords.push(JSON.parse(decrypted))
    } catch (error) {
      // Cannot decrypt - not authorized for this record
      console.log('Skipping unauthorized record')
    }
  }

  // Generate audit report
  const report = generateAuditReport(decryptedRecords)
  console.log('Audit Report:', report)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: COMPLIANCE REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Generate compliance report')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate report generation
  const report: DisclosureReport = {
    period: '2024-Q4',
    totalTransactions: transactions.length,
    totalVolume: transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0).toFixed(4) + ' ETH',
    transactions: transactions,
  }

  console.log('Compliance Report:')
  console.log(`  Period:            ${report.period}`)
  console.log(`  Total Transactions: ${report.totalTransactions}`)
  console.log(`  Total Volume:      ${report.totalVolume}`)
  console.log('')

  console.log(`
Example compliance report structure:

{
  "period": "${report.period}",
  "entity": "Treasury DAO",
  "preparedBy": "External Auditor",
  "summary": {
    "totalTransactions": ${report.totalTransactions},
    "totalVolume": "${report.totalVolume}",
    "uniqueRecipients": 3,
  },
  "transactions": [
    {
      "date": "${new Date(transactions[0].timestamp).toISOString()}",
      "txHash": "${transactions[0].txHash}",
      "amount": "${transactions[0].amount} ETH",
      "category": "Operations",
      "verified": true
    },
    // ... more transactions
  ],
  "attestation": {
    "auditor": "Ernst & Young LLP",
    "date": "${new Date().toISOString().split('T')[0]}",
    "opinion": "Unqualified"
  }
}
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: REAL-TIME COMPLIANCE MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 7: Real-time compliance monitoring')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Setting up real-time AML monitoring:

  import { ComplianceManager } from '@sip-protocol/sdk'

  const compliance = new ComplianceManager({
    viewingKey: complianceViewingKey,
    rules: [
      // Large transaction threshold
      {
        type: 'THRESHOLD',
        amount: 10000, // USD equivalent
        currency: 'USD',
        action: 'ALERT',
      },
      // Velocity check
      {
        type: 'VELOCITY',
        maxTransactions: 10,
        period: 3600, // 1 hour
        action: 'FLAG',
      },
      // Sanctioned address check
      {
        type: 'SANCTIONS',
        lists: ['OFAC', 'UN'],
        action: 'BLOCK',
      },
    ],
  })

  // Monitor incoming transactions
  compliance.on('alert', (event) => {
    console.log('Compliance Alert:', event)
    // Send notification to compliance team
  })

  compliance.on('block', (event) => {
    console.log('Transaction Blocked:', event)
    // Escalate to legal
  })

  // Start monitoring
  await compliance.startMonitoring()
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: PRIVACY LEVELS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 8: Privacy levels comparison')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
SIP Protocol Privacy Levels:

┌────────────────┬──────────────┬──────────────┬──────────────┐
│ Feature        │ TRANSPARENT  │ SHIELDED     │ COMPLIANT    │
├────────────────┼──────────────┼──────────────┼──────────────┤
│ Sender Hidden  │ ✗            │ ✓            │ ✓            │
│ Amount Hidden  │ ✗            │ ✓            │ ✓*           │
│ Recipient Hide │ ✗            │ ✓            │ ✓            │
│ Viewing Key    │ N/A          │ Optional     │ Required     │
│ Audit Trail    │ On-chain     │ None         │ Encrypted    │
│ Compliance     │ Full         │ None         │ Selective    │
└────────────────┴──────────────┴──────────────┴──────────────┘

* Amount visible to viewing key holders

Use cases:
  - TRANSPARENT: Public treasury operations
  - SHIELDED: Personal privacy, no compliance needs
  - COMPLIANT: Institutional/DAO treasury, regulatory compliance

Example selection:

  import { PrivacyLevel, createShieldedIntent } from '@sip-protocol/sdk'

  // For DAOs with compliance requirements
  const intent = await createShieldedIntent({
    input: { chain: 'ethereum', token: 'ETH', amount: 1_000_000_000_000_000_000n },
    output: { chain: 'ethereum', token: 'ETH' },
    privacy: PrivacyLevel.COMPLIANT,
    viewingKeyRecipients: [
      auditorKey,
      complianceOfficerKey,
    ],
  })
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Viewing key disclosure:')
  console.log('  ✓ Selective disclosure (share what you want)')
  console.log('  ✓ Hierarchical keys (scoped access)')
  console.log('  ✓ Cannot spend (safe to share)')
  console.log('  ✓ Regulatory compliance ready')
  console.log('')
  console.log('Use cases:')
  console.log('  - Annual audits')
  console.log('  - Tax reporting')
  console.log('  - AML monitoring')
  console.log('  - DAO transparency')
  console.log('  - Institutional compliance')
  console.log('')
  console.log('Key benefits:')
  console.log('  - Privacy by default')
  console.log('  - Compliance when needed')
  console.log('  - Granular access control')
  console.log('  - Cryptographic enforcement')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function randomHex(length: number): string {
  return Array.from({ length: length / 2 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('')
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
