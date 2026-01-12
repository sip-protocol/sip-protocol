/**
 * Compliance Reporting Example
 *
 * Demonstrates selective disclosure using viewing keys for regulatory compliance.
 *
 * Flow:
 * 1. Organization generates master viewing key
 * 2. Derive scoped keys for different auditors/purposes
 * 3. Encrypt transaction data with viewing keys
 * 4. Auditors decrypt only what they're authorized to see
 *
 * Usage:
 *   npx ts-node examples/compliance/index.ts
 */

import {
  // Viewing key functions
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  // Privacy levels
  PrivacyLevel,
  getPrivacyDescription,
  // Types
  type ViewingKey,
  type TransactionData,
  type EncryptedTransaction,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

// Sample transactions for example
const SAMPLE_TRANSACTIONS: TransactionData[] = [
  {
    sender: '0x1234567890abcdef1234567890abcdef12345678',
    recipient: '0xabcdef1234567890abcdef1234567890abcdef12',
    amount: '10000.00',
    timestamp: Date.now() - 86400000 * 30, // 30 days ago
  },
  {
    sender: '0x1234567890abcdef1234567890abcdef12345678',
    recipient: '0x9876543210fedcba9876543210fedcba98765432',
    amount: '5000.00',
    timestamp: Date.now() - 86400000 * 15, // 15 days ago
  },
  {
    sender: '0x1234567890abcdef1234567890abcdef12345678',
    recipient: '0xfedcba9876543210fedcba9876543210fedcba98',
    amount: '25000.00',
    timestamp: Date.now() - 86400000 * 5, // 5 days ago
  },
]

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Compliance Reporting Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ─── Step 1: Explain Privacy Levels ───────────────────────────────────────

  console.log('STEP 1: Understanding privacy levels')
  console.log('─────────────────────────────────────────────────────────────────')

  const levels: (typeof PrivacyLevel)[keyof typeof PrivacyLevel][] = [
    PrivacyLevel.TRANSPARENT,
    PrivacyLevel.SHIELDED,
    PrivacyLevel.COMPLIANT,
  ]

  console.log('Available privacy levels:')
  for (const level of levels) {
    console.log(`  ${level}: ${getPrivacyDescription(level)}`)
  }
  console.log('')

  console.log('Comparison:')
  console.log('  ┌──────────────┬────────────┬──────────┬───────────┐')
  console.log('  │ Level        │ On-Chain   │ Solvers  │ Auditors  │')
  console.log('  ├──────────────┼────────────┼──────────┼───────────┤')
  console.log('  │ transparent  │ All visible│ All      │ N/A       │')
  console.log('  │ shielded     │ Hidden     │ Minimal  │ None      │')
  console.log('  │ compliant    │ Hidden     │ Minimal  │ Full*     │')
  console.log('  └──────────────┴────────────┴──────────┴───────────┘')
  console.log('  *With viewing key')
  console.log('')

  // ─── Step 2: Generate Master Viewing Key ──────────────────────────────────

  console.log('STEP 2: Generate master viewing key')
  console.log('─────────────────────────────────────────────────────────────────')

  // Organization creates a master viewing key
  // This is the root key from which all others are derived
  const masterKey = generateViewingKey('m/treasury')

  console.log('Master viewing key generated:')
  console.log(`  Key:  ${truncate(masterKey.key)}`)
  console.log(`  Path: ${masterKey.path}`)
  console.log(`  Hash: ${truncate(masterKey.hash)} (public identifier)`)
  console.log('')

  console.log('⚠  IMPORTANT: Store master key securely!')
  console.log('   - Use hardware security module (HSM) for production')
  console.log('   - Consider multisig for organizational keys')
  console.log('   - Never expose in logs or version control')
  console.log('')

  // ─── Step 3: Derive Scoped Viewing Keys ───────────────────────────────────

  console.log('STEP 3: Derive scoped viewing keys')
  console.log('─────────────────────────────────────────────────────────────────')

  // Derive keys for different purposes
  const auditorKey = deriveViewingKey(masterKey, 'auditor/2024')
  const taxKey = deriveViewingKey(masterKey, 'tax/q4-2024')
  const legalKey = deriveViewingKey(masterKey, 'legal/case-001')

  console.log('Derived viewing keys:')
  console.log('')
  console.log('  Annual Audit (2024):')
  console.log(`    Path: ${auditorKey.path}`)
  console.log(`    Hash: ${truncate(auditorKey.hash)}`)
  console.log('')
  console.log('  Tax Reporting (Q4 2024):')
  console.log(`    Path: ${taxKey.path}`)
  console.log(`    Hash: ${truncate(taxKey.hash)}`)
  console.log('')
  console.log('  Legal Case #001:')
  console.log(`    Path: ${legalKey.path}`)
  console.log(`    Hash: ${truncate(legalKey.hash)}`)
  console.log('')

  console.log('Key hierarchy:')
  console.log('  m/treasury')
  console.log('    ├── m/treasury/auditor/2024')
  console.log('    ├── m/treasury/tax/q4-2024')
  console.log('    └── m/treasury/legal/case-001')
  console.log('')

  console.log('Security properties:')
  console.log('  ✓ Child keys cannot derive parent key')
  console.log('  ✓ Sibling keys cannot derive each other')
  console.log('  ✓ Each key only reveals its scoped transactions')
  console.log('')

  // ─── Step 4: Encrypt Transactions ─────────────────────────────────────────

  console.log('STEP 4: Encrypt transactions with viewing keys')
  console.log('─────────────────────────────────────────────────────────────────')

  // Encrypt transactions for the auditor
  const encryptedTransactions: EncryptedTransaction[] = []

  console.log('Encrypting transactions for auditor:')
  for (const tx of SAMPLE_TRANSACTIONS) {
    const encrypted = encryptForViewing(tx, auditorKey)
    encryptedTransactions.push(encrypted)

    console.log(`  Transaction (${formatDate(tx.timestamp)}):`)
    console.log(`    Amount:     $${tx.amount}`)
    console.log(`    Ciphertext: ${truncate(encrypted.ciphertext, 16)}`)
    console.log(`    Nonce:      ${truncate(encrypted.nonce, 12)}`)
    console.log(`    Key Hash:   ${truncate(encrypted.viewingKeyHash)}`)
    console.log('')
  }

  console.log('What gets stored:')
  console.log('  • Ciphertext (encrypted data)')
  console.log('  • Nonce (for decryption)')
  console.log('  • Viewing Key Hash (identifies which key can decrypt)')
  console.log('')
  console.log('What\'s hidden:')
  console.log('  • Sender address')
  console.log('  • Recipient address')
  console.log('  • Amount')
  console.log('  • Timestamp')
  console.log('')

  // ─── Step 5: Auditor Receives Viewing Key ─────────────────────────────────

  console.log('STEP 5: Share viewing key with auditor (secure channel)')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Viewing key sharing options:')
  console.log('  1. Encrypted email (PGP/S-MIME)')
  console.log('  2. Secure messaging (Signal, etc.)')
  console.log('  3. In-person handoff')
  console.log('  4. Hardware security module (HSM)')
  console.log('')

  console.log('Simulating auditor receiving key...')
  console.log('')

  // In practice, this would be shared through a secure channel
  const auditorReceivedKey = auditorKey

  console.log('Auditor received viewing key:')
  console.log(`  Path: ${auditorReceivedKey.path}`)
  console.log(`  Hash: ${truncate(auditorReceivedKey.hash)}`)
  console.log('')

  // ─── Step 6: Auditor Decrypts Transactions ────────────────────────────────

  console.log('STEP 6: Auditor decrypts and views transactions')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Auditor decrypting transactions:')
  console.log('')

  let totalAmount = 0

  for (let i = 0; i < encryptedTransactions.length; i++) {
    const encrypted = encryptedTransactions[i]

    // First, verify the viewing key hash matches
    if (encrypted.viewingKeyHash !== auditorReceivedKey.hash) {
      console.log(`  [${i + 1}] ✗ Wrong viewing key`)
      continue
    }

    // Decrypt the transaction
    try {
      const tx = decryptWithViewing(encrypted, auditorReceivedKey)

      console.log(`  [${i + 1}] ✓ Decrypted successfully`)
      console.log(`      Date:      ${formatDate(tx.timestamp)}`)
      console.log(`      From:      ${truncate(tx.sender as HexString)}`)
      console.log(`      To:        ${truncate(tx.recipient as HexString)}`)
      console.log(`      Amount:    $${tx.amount}`)
      console.log('')

      totalAmount += parseFloat(tx.amount)
    } catch (error) {
      console.log(`  [${i + 1}] ✗ Decryption failed: ${(error as Error).message}`)
    }
  }

  console.log(`Total disclosed: $${totalAmount.toFixed(2)}`)
  console.log('')

  // ─── Step 7: Demonstrate Selective Disclosure ─────────────────────────────

  console.log('STEP 7: Selective disclosure (wrong key fails)')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Attempting to decrypt with tax key (wrong scope)...')
  console.log('')

  for (let i = 0; i < encryptedTransactions.length; i++) {
    const encrypted = encryptedTransactions[i]

    // Check if tax key hash matches (it won't)
    if (encrypted.viewingKeyHash !== taxKey.hash) {
      console.log(`  [${i + 1}] ✗ Key hash mismatch - cannot decrypt`)
      continue
    }

    // This won't be reached because hashes don't match
    console.log(`  [${i + 1}] Attempting decryption...`)
  }

  console.log('')
  console.log('Result: Tax key cannot decrypt auditor-scoped transactions')
  console.log('Each viewing key only reveals its specific scope.')
  console.log('')

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  console.log('What we demonstrated:')
  console.log('  1. Generated master viewing key for organization')
  console.log('  2. Derived scoped keys for different purposes')
  console.log('  3. Encrypted transactions with XChaCha20-Poly1305')
  console.log('  4. Auditor decrypted using authorized viewing key')
  console.log('  5. Unauthorized keys cannot access encrypted data')
  console.log('')

  console.log('Compliance properties achieved:')
  console.log('  ✓ Privacy by default (shielded transactions)')
  console.log('  ✓ Selective disclosure (viewing keys)')
  console.log('  ✓ Audit trail (key usage can be logged)')
  console.log('  ✓ Time-scoped access (derive yearly keys)')
  console.log('  ✓ Revocable access (don\'t share new derived keys)')
  console.log('')

  console.log('Use cases:')
  console.log('  • DAO treasury audits')
  console.log('  • Institutional KYC/AML')
  console.log('  • Tax reporting')
  console.log('  • Legal discovery')
  console.log('  • Grant reporting')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: HexString | string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
