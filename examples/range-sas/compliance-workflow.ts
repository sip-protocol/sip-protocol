/**
 * compliance-workflow.ts
 *
 * Complete compliance workflow example demonstrating:
 * 1. Auditor requesting access via attestation
 * 2. User verifying attestation and granting viewing key
 * 3. Auditor scanning and generating compliance report
 *
 * @packageDocumentation
 */

import { Connection } from '@solana/web3.js'
import {
  verifyAttestation,
  deriveAuditorViewingKey,
  createComplianceRecord,
} from './viewing-key-delegation'
import type { SASAttestation, ComplianceReport, DerivedViewingKey } from './types'
import type { HexString } from '@sip-protocol/types'

// =============================================================================
// MOCK DATA (In production, these would come from Range SAS and SIP Protocol)
// =============================================================================

/**
 * Mock: Fetch attestation from Range SAS
 */
async function fetchAttestationFromSAS(
  _connection: Connection,
  subject: string,
  schema: string
): Promise<SASAttestation | null> {
  // In production, this would query Range SAS on-chain
  // For demo, return mock attestation
  return {
    id: `attest_${Date.now()}`,
    attester: 'TRUSTED_KYC_PROVIDER_ADDRESS',
    subject,
    schema,
    data: {
      name: 'Deloitte Auditor',
      certification: 'CPA',
      jurisdiction: 'US',
    },
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    createdAt: new Date(),
    revoked: false,
    signature: '0x...mock_signature...',
  }
}

/**
 * Mock: Scan transactions with viewing key
 */
async function scanTransactionsWithViewingKey(
  _connection: Connection,
  _viewingKey: HexString,
  _userAddress: string
): Promise<Array<{
  id: string
  type: 'inflow' | 'outflow'
  amount: bigint
  tokenSymbol: string
  timestamp: Date
  counterparty: string
  memo?: string
}>> {
  // In production, this would use scanForPayments from @sip-protocol/sdk
  // with the derived viewing key
  return [
    {
      id: 'tx_001',
      type: 'inflow',
      amount: 50000000000n, // 50,000 USDC
      tokenSymbol: 'USDC',
      timestamp: new Date('2026-01-10'),
      counterparty: 'stealth_addr_1',
      memo: 'Q4 Grant Payment',
    },
    {
      id: 'tx_002',
      type: 'outflow',
      amount: 10000000000n, // 10,000 USDC
      tokenSymbol: 'USDC',
      timestamp: new Date('2026-01-12'),
      counterparty: 'stealth_addr_2',
      memo: 'Developer Payment - Alice',
    },
    {
      id: 'tx_003',
      type: 'outflow',
      amount: 15000000000n, // 15,000 USDC
      tokenSymbol: 'USDC',
      timestamp: new Date('2026-01-15'),
      counterparty: 'stealth_addr_3',
      memo: 'Infrastructure Costs',
    },
  ]
}

// =============================================================================
// COMPLIANCE WORKFLOW
// =============================================================================

/**
 * Complete compliance workflow
 *
 * This example shows the full flow:
 * 1. Auditor presents attestation
 * 2. User (or DAO) verifies attestation
 * 3. User derives time-limited viewing key
 * 4. Auditor uses key to scan transactions
 * 5. Auditor generates compliance report
 */
export async function runComplianceWorkflow(): Promise<void> {
  console.log('='.repeat(60))
  console.log('SIP PROTOCOL + RANGE SAS COMPLIANCE WORKFLOW')
  console.log('='.repeat(60))
  console.log()

  // Setup connection (devnet for demo)
  const connection = new Connection('https://api.devnet.solana.com')

  // Configuration
  const AUDITOR_ADDRESS = 'DELOITTE_AUDITOR_ADDRESS'
  const USER_ADDRESS = 'DAO_TREASURY_ADDRESS'
  const MASTER_VIEWING_KEY = '0x' + '1'.repeat(64) as HexString // Mock master key

  // ==========================================================================
  // STEP 1: Auditor presents attestation
  // ==========================================================================
  console.log('STEP 1: Auditor presents attestation')
  console.log('-'.repeat(40))

  const attestation = await fetchAttestationFromSAS(
    connection,
    AUDITOR_ADDRESS,
    'certified-auditor-v1'
  )

  if (!attestation) {
    console.error('No attestation found for auditor')
    return
  }

  console.log(`Attestation ID: ${attestation.id}`)
  console.log(`Attester: ${attestation.attester}`)
  console.log(`Subject: ${attestation.subject}`)
  console.log(`Schema: ${attestation.schema}`)
  console.log(`Expires: ${attestation.expiresAt.toISOString()}`)
  console.log()

  // ==========================================================================
  // STEP 2: User verifies attestation
  // ==========================================================================
  console.log('STEP 2: User verifies attestation')
  console.log('-'.repeat(40))

  const verificationResult = await verifyAttestation(connection, {
    attestation,
    expectedSchema: 'certified-auditor-v1',
    minValidityDays: 30,
    trustedAttesters: ['TRUSTED_KYC_PROVIDER_ADDRESS'],
  })

  if (!verificationResult.isValid) {
    console.error(`Attestation invalid: ${verificationResult.invalidReason}`)
    return
  }

  console.log('Attestation verification: PASSED')
  console.log('- Not revoked: ✓')
  console.log('- Not expired: ✓')
  console.log('- Schema matches: ✓')
  console.log('- Attester trusted: ✓')
  console.log()

  // ==========================================================================
  // STEP 3: User derives viewing key for auditor
  // ==========================================================================
  console.log('STEP 3: User derives viewing key for auditor')
  console.log('-'.repeat(40))

  // Q1 2026 audit window
  const auditStartDate = new Date('2026-01-01')
  const auditEndDate = new Date('2026-03-31')

  const derivedKey: DerivedViewingKey = deriveAuditorViewingKey({
    masterViewingKey: MASTER_VIEWING_KEY,
    auditorAddress: AUDITOR_ADDRESS,
    attestationId: attestation.id,
    validUntil: auditEndDate,
    scope: 'full',
    metadata: {
      purpose: 'Q1 2026 Financial Audit',
      requestId: 'AUDIT-2026-Q1-001',
    },
  })

  console.log(`Viewing key derived: ${derivedKey.key.slice(0, 20)}...`)
  console.log(`Key hash (for audit log): ${derivedKey.keyHash.slice(0, 20)}...`)
  console.log(`Scope: ${derivedKey.scope}`)
  console.log(`Valid until: ${derivedKey.expiresAt?.toISOString()}`)
  console.log()

  // Create compliance record
  const complianceRecord = createComplianceRecord(derivedKey, attestation)
  console.log('Compliance Record:')
  console.log(complianceRecord)
  console.log()

  // ==========================================================================
  // STEP 4: Auditor scans transactions
  // ==========================================================================
  console.log('STEP 4: Auditor scans transactions')
  console.log('-'.repeat(40))

  const transactions = await scanTransactionsWithViewingKey(
    connection,
    derivedKey.key,
    USER_ADDRESS
  )

  console.log(`Found ${transactions.length} transactions:`)
  for (const tx of transactions) {
    const amountFormatted = (Number(tx.amount) / 1e6).toLocaleString()
    console.log(`  ${tx.type === 'inflow' ? '+' : '-'}${amountFormatted} ${tx.tokenSymbol}`)
    console.log(`    Date: ${tx.timestamp.toISOString().split('T')[0]}`)
    console.log(`    Memo: ${tx.memo || 'N/A'}`)
    console.log()
  }

  // ==========================================================================
  // STEP 5: Generate compliance report
  // ==========================================================================
  console.log('STEP 5: Generate compliance report')
  console.log('-'.repeat(40))

  const report: ComplianceReport = {
    id: `report_${Date.now()}`,
    auditorAddress: AUDITOR_ADDRESS,
    viewingKeyHash: derivedKey.keyHash,
    startDate: auditStartDate,
    endDate: auditEndDate,
    summary: {
      totalTransactions: transactions.length,
      totalInflow: transactions
        .filter((t) => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0n),
      totalOutflow: transactions
        .filter((t) => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0n),
      uniqueCounterparties: new Set(transactions.map((t) => t.counterparty)).size,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      tokenSymbol: t.tokenSymbol,
      timestamp: t.timestamp,
      memo: t.memo,
    })),
    generatedAt: new Date(),
  }

  console.log('COMPLIANCE REPORT')
  console.log('='.repeat(40))
  console.log(`Report ID: ${report.id}`)
  console.log(`Period: ${report.startDate.toISOString().split('T')[0]} to ${report.endDate.toISOString().split('T')[0]}`)
  console.log()
  console.log('Summary:')
  console.log(`  Total Transactions: ${report.summary.totalTransactions}`)
  console.log(`  Total Inflow: ${(Number(report.summary.totalInflow) / 1e6).toLocaleString()} USDC`)
  console.log(`  Total Outflow: ${(Number(report.summary.totalOutflow) / 1e6).toLocaleString()} USDC`)
  console.log(`  Net Change: ${(Number(report.summary.totalInflow - report.summary.totalOutflow) / 1e6).toLocaleString()} USDC`)
  console.log(`  Unique Counterparties: ${report.summary.uniqueCounterparties}`)
  console.log()
  console.log(`Generated: ${report.generatedAt.toISOString()}`)
  console.log(`Viewing Key Hash: ${report.viewingKeyHash.slice(0, 20)}...`)
  console.log()

  console.log('='.repeat(60))
  console.log('WORKFLOW COMPLETE')
  console.log('='.repeat(60))
  console.log()
  console.log('Key takeaways:')
  console.log('1. Privacy was maintained for all transactions')
  console.log('2. Auditor access was time-limited (Q1 only)')
  console.log('3. Full audit trail exists (attestation + key derivation logs)')
  console.log('4. Compliance report can be generated without breaking privacy')
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runComplianceWorkflow().catch(console.error)
}

export default runComplianceWorkflow
