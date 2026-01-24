# Example: Compliance & Viewing Key Disclosure

How to disclose transaction details for tax, audit, or regulatory purposes.

## Overview

SIP Protocol's viewing keys enable **selective disclosure**:

- Privacy by default
- Disclose when required (tax, audit, regulation)
- Granular control (specific transactions, not all)

## Viewing Key Architecture

```
Viewing Key (can share)
├── Decrypt transaction amounts
├── Identify payments addressed to you
├── Cannot spend funds
└── Can share with auditors

Spending Key (never share)
├── Claim received payments
├── Sign transactions
└── Full control of funds
```

## Basic Disclosure

### Export Viewing Key

```typescript
import { exportViewingKey } from '@sip-protocol/sdk'

// Export for auditor
const viewingKeyExport = exportViewingKey(viewingPrivateKey, {
  format: 'json',
  purpose: 'Tax audit 2025',
})

console.log(viewingKeyExport)
// {
//   type: 'sip-viewing-key',
//   chain: 'solana',
//   publicKey: '0x03...',
//   privateKey: '0x...',  // Only if sharing private
//   exportedAt: '2025-01-24T...',
//   purpose: 'Tax audit 2025'
// }
```

### Share Only Public Key (Read-Only for Indexer)

```typescript
// Auditor can verify payments TO you, but not decrypt amounts
const publicKeyOnly = {
  viewingPublicKey: viewingKey.publicKey,
  // No private key - cannot decrypt amounts
}
```

### Share Private Key (Full Disclosure)

```typescript
// Auditor can decrypt amounts and verify payments
const fullDisclosure = exportViewingKey(viewingPrivateKey, {
  format: 'json',
  includePrivateKey: true,
  purpose: 'IRS audit request #12345',
})
```

## Transaction-Specific Disclosure

Disclose only specific transactions, not entire history.

```typescript
import { createTransactionDisclosure } from '@sip-protocol/sdk'

// Disclose specific transactions
const disclosure = await createTransactionDisclosure({
  connection,
  viewingPrivateKey,
  transactionIds: [
    'tx_abc123...',
    'tx_def456...',
  ],
})

console.log(disclosure)
// {
//   transactions: [
//     {
//       id: 'tx_abc123...',
//       amount: 1000000000n,  // 1 SOL
//       timestamp: '2025-01-15T...',
//       sender: '7xyz...',
//       commitment: '0x02...',
//       proof: '0x...'  // Proof that amount matches commitment
//     },
//     ...
//   ],
//   viewingKeyHash: '0x...',  // Verifiable
//   signedBy: 'owner pubkey',
//   signature: '0x...'
// }
```

## Audit Report Generation

Generate comprehensive audit report for regulators.

```typescript
import {
  scanForPayments,
  generateAuditReport,
} from '@sip-protocol/sdk'

async function generateTaxReport(year: number) {
  // Scan all payments in time range
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)

  const payments = await scanForPayments({
    connection,
    viewingPrivateKey,
    spendingPublicKey,
    fromTimestamp: startDate.getTime() / 1000,
    toTimestamp: endDate.getTime() / 1000,
  })

  // Generate report
  const report = generateAuditReport({
    payments,
    viewingKey: viewingPrivateKey,
    format: 'pdf', // or 'json', 'csv'
    includeProofs: true,
  })

  return report
}

// Usage
const report = await generateTaxReport(2025)
await report.save('sip-tax-report-2025.pdf')
```

## Auditor Verification

Auditors can verify disclosures without trusting the user.

```typescript
import { verifyDisclosure } from '@sip-protocol/sdk'

// Auditor receives disclosure
const disclosure = receiveFromUser()

// Verify on-chain
const verification = await verifyDisclosure({
  connection,
  disclosure,
})

console.log(verification)
// {
//   valid: true,
//   transactionsVerified: 5,
//   totalAmount: 5000000000n,  // 5 SOL
//   viewingKeyMatchesHash: true,
//   commitmentsValid: true,
// }
```

## Compliance Levels

| Level | What's Disclosed | Use Case |
|-------|------------------|----------|
| **None** | Nothing | Default privacy |
| **Aggregate** | Total in/out | Annual summary |
| **Transaction** | Specific txs | Audit request |
| **Full** | Viewing key | Complete transparency |

## Regulatory Frameworks

### Tax Reporting

```typescript
// Generate IRS-compatible report
const taxReport = await generateAuditReport({
  payments,
  viewingKey,
  format: 'irs-8949', // Capital gains form
  costBasis: 'fifo',
})
```

### AML/KYC

```typescript
// For exchange compliance
const kycDisclosure = await createKYCDisclosure({
  viewingKey,
  exchangePublicKey: exchangePubkey,
  scope: 'last-90-days',
})

// Exchange can verify but not see other transactions
```

### Subpoena Response

```typescript
// Legal request handling
const legalDisclosure = await createLegalDisclosure({
  viewingPrivateKey,
  transactionIds: subpoenaedTxIds,
  caseNumber: 'CASE-2025-12345',
  court: 'US District Court',
  signWithNotary: true,
})
```

## Best Practices

### 1. Minimize Disclosure

```typescript
// DON'T: Share full viewing key for one transaction
const bad = exportViewingKey(viewingPrivateKey, { includePrivateKey: true })

// DO: Disclose only specific transactions
const good = await createTransactionDisclosure({
  viewingPrivateKey,
  transactionIds: [specificTxId],
})
```

### 2. Document Everything

```typescript
const disclosure = await createTransactionDisclosure({
  viewingPrivateKey,
  transactionIds,
  metadata: {
    requestedBy: 'IRS',
    requestDate: '2025-01-20',
    caseNumber: '12345',
    retainUntil: '2032-01-20', // 7 years
  },
})
```

### 3. Rotate Keys After Major Disclosure

```typescript
// After sharing viewing key, generate new identity
const newIdentity = generateStealthMetaAddress('solana')

// Update receiving address with contacts
await notifyContactsOfNewAddress(newIdentity.metaAddress)
```

## Code Example: Full Compliance Flow

```typescript
import {
  exportViewingKey,
  scanForPayments,
  createTransactionDisclosure,
  verifyDisclosure,
} from '@sip-protocol/sdk'

async function handleAuditRequest(
  auditRequest: AuditRequest,
  viewingPrivateKey: string
) {
  // 1. Validate request
  if (!auditRequest.legalBasis) {
    throw new Error('Audit request must have legal basis')
  }

  // 2. Determine scope
  const payments = await scanForPayments({
    connection,
    viewingPrivateKey,
    spendingPublicKey,
    fromTimestamp: auditRequest.startDate,
    toTimestamp: auditRequest.endDate,
  })

  // 3. Create disclosure
  const disclosure = await createTransactionDisclosure({
    connection,
    viewingPrivateKey,
    transactionIds: payments.map(p => p.noteId),
    metadata: {
      requestedBy: auditRequest.requester,
      legalBasis: auditRequest.legalBasis,
      caseNumber: auditRequest.caseNumber,
    },
  })

  // 4. Self-verify before sending
  const verification = await verifyDisclosure({ connection, disclosure })
  if (!verification.valid) {
    throw new Error('Disclosure verification failed')
  }

  // 5. Log disclosure (for your records)
  await logDisclosure({
    disclosure,
    sentTo: auditRequest.requester,
    sentAt: new Date(),
  })

  return disclosure
}
```

## Next Steps

- [Basic Transfer](./basic-transfer.md) - Private payment basics
- [Security Guide](../security.md) - Key management
