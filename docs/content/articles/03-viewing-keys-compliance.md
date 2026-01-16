# Implementing Viewing Keys for Compliance

*A practical guide to selective disclosure for institutional and DAO applications*

---

## Introduction

Privacy is great, but some applications need accountability. DAOs need treasury transparency. Institutions need audit trails. Payroll systems need tax reporting.

**Viewing keys** solve this: Privacy by default, disclosure when needed.

This guide shows you how to implement viewing key systems for:
- DAO treasuries with member visibility
- Time-limited auditor access
- Role-based disclosure
- Compliance reporting

**Time:** ~40 minutes

**Prerequisites:**
- Understanding of SIP basics (see [Getting Started](./01-getting-started-sdk.md))
- Familiarity with key derivation concepts

---

## How Viewing Keys Work

A **viewing key** is a separate key that can:
- ✅ See transaction details (amount, recipient, memo)
- ❌ Spend funds

Think of it like giving your accountant read-only access to your bank account.

```
┌─────────────────────────────────────────────────────┐
│  Transaction (on-chain)                             │
│  └─ Encrypted data                                  │
│                                                     │
│  With Spending Key:                                 │
│  └─ Can spend funds + see details                   │
│                                                     │
│  With Viewing Key:                                  │
│  └─ Can see details only                            │
│                                                     │
│  Without any key:                                   │
│  └─ Sees encrypted blob                             │
└─────────────────────────────────────────────────────┘
```

---

## Privacy Levels Recap

SIP has three privacy levels:

```typescript
import { PrivacyLevel } from '@sip-protocol/sdk'

// Everything public (like normal transactions)
PrivacyLevel.TRANSPARENT

// Everything hidden (no viewing key)
PrivacyLevel.SHIELDED

// Hidden but viewable with key (compliance-ready)
PrivacyLevel.COMPLIANT
```

Viewing keys only apply to `COMPLIANT` level.

---

## Step 1: Generate Master Viewing Key

Create a master viewing key for your treasury/application:

```typescript
import { generateViewingKey } from '@sip-protocol/sdk'

// Generate master key (keep this very secure!)
const masterViewingKey = generateViewingKey()

console.log('Public (shareable):', masterViewingKey.publicKey)
console.log('Private (keep secret):', masterViewingKey.privateKey)
```

**Storage:**
- Multi-sig or MPC for the master private key
- Public key can be embedded in smart contracts or stored openly

---

## Step 2: Create Compliant Transactions

When creating transactions, use the `COMPLIANT` privacy level:

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'mainnet' })

const intent = await sip.createIntent({
  input: { chain: 'solana', token: 'USDC', amount: 50000n * 10n**6n },
  output: { chain: 'solana', token: 'USDC' },
  privacy: PrivacyLevel.COMPLIANT,
  viewingKey: masterViewingKey.publicKey,
  memo: 'Q1 Developer Grant - Alice',
})
```

The transaction is encrypted but decryptable with the viewing key.

---

## Step 3: Derive Role-Based Keys

Don't give everyone the master key. Derive scoped keys for different roles:

```typescript
import { AuditorKeyDerivation, AuditorType } from '@sip-protocol/sdk'

const keyDerivation = new AuditorKeyDerivation({
  masterKey: masterViewingKey.privateKey,
})

// Treasurer: sees all transactions
const treasurerKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'treasurer',
  scope: 'all',
})

// Council member: sees proposals + large payments (>$10K)
const councilKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'council',
  scope: 'proposals',
})

// Regular member: sees only approved proposals
const memberKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'member',
  scope: 'proposals-approved',
})

// External auditor: time-limited full access
const auditorKey = keyDerivation.derive({
  type: AuditorType.EXTERNAL,
  role: 'auditor',
  userId: 'deloitte-2026',
  scope: 'full',
  validFrom: new Date('2026-01-01'),
  validUntil: new Date('2026-03-31'),
})
```

Each derived key can only see what its scope allows.

---

## Step 4: Decrypt Transactions

Use a viewing key to decrypt transaction details:

```typescript
import { decryptWithViewing } from '@sip-protocol/sdk'

// Encrypted transaction data from blockchain
const encryptedTx = await fetchTransaction(txSignature)

// Decrypt with viewing key
const decrypted = decryptWithViewing(
  encryptedTx.encryptedData,
  treasurerKey
)

if (decrypted) {
  console.log('Amount:', decrypted.amount)
  console.log('Recipient:', decrypted.recipient)
  console.log('Memo:', decrypted.memo)
  console.log('Timestamp:', decrypted.timestamp)
} else {
  console.log('This key cannot decrypt this transaction')
}
```

---

## Step 5: Build a Treasury Dashboard

Here's a complete treasury component with role-based viewing:

```typescript
// src/components/TreasuryDashboard.tsx
import { useState, useEffect } from 'react'
import {
  Treasury,
  AuditorKeyDerivation,
  AuditorType,
  decryptWithViewing,
} from '@sip-protocol/sdk'

interface TreasuryConfig {
  masterPublicKey: string
  treasurerPrivateKey?: string // Only for treasurer role
  memberPrivateKey?: string    // Only for member role
}

export function TreasuryDashboard({ config, role }: {
  config: TreasuryConfig
  role: 'treasurer' | 'council' | 'member'
}) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Get the appropriate viewing key for this role
  const getViewingKey = () => {
    const keyDerivation = new AuditorKeyDerivation({
      masterKey: config.treasurerPrivateKey!, // Would need master in real app
    })

    return keyDerivation.derive({
      type: AuditorType.INTERNAL,
      role,
      scope: role === 'treasurer' ? 'all' : 'proposals',
    })
  }

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true)

      // Fetch encrypted transactions
      const encryptedTxs = await fetchTreasuryTransactions()
      const viewingKey = getViewingKey()

      // Decrypt what we can see
      const decrypted = encryptedTxs
        .map(tx => {
          const result = decryptWithViewing(tx.encryptedData, viewingKey)
          if (result) {
            return { ...tx, ...result, visible: true }
          }
          return { ...tx, visible: false }
        })

      setTransactions(decrypted)
      setLoading(false)
    }

    loadTransactions()
  }, [role])

  if (loading) return <div>Loading treasury...</div>

  const visible = transactions.filter(t => t.visible)
  const hidden = transactions.filter(t => !t.visible)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Treasury ({role})</h2>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-green-50 rounded">
          <div className="font-medium">Visible to you</div>
          <div className="text-2xl">{visible.length}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded">
          <div className="font-medium">Hidden from you</div>
          <div className="text-2xl">{hidden.length}</div>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Amount</th>
            <th className="text-left p-2">Recipient</th>
            <th className="text-left p-2">Memo</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.signature} className="border-b">
              <td className="p-2">
                {tx.visible ? tx.timestamp : '---'}
              </td>
              <td className="p-2">
                {tx.visible ? `$${tx.amount}` : '🔒'}
              </td>
              <td className="p-2">
                {tx.visible ? tx.recipient.slice(0, 8) + '...' : '🔒'}
              </td>
              <td className="p-2">
                {tx.visible ? tx.memo : '🔒 Hidden from your role'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Step 6: Time-Limited Auditor Keys

For external audits, create keys that expire:

```typescript
import { ThresholdViewingKey } from '@sip-protocol/sdk'

// Create time-locked key for Q1 audit
const auditKey = await ThresholdViewingKey.createTimeLocked({
  masterKey: masterViewingKey,
  unlocksAt: new Date('2026-01-15'), // Audit starts
  expiresAt: new Date('2026-02-28'), // Audit ends
  scope: 'full',
})

// Before Jan 15: Key cannot decrypt anything
// Jan 15 - Feb 28: Key decrypts all COMPLIANT transactions
// After Feb 28: Key stops working

console.log('Share with auditor:', auditKey.publicKey)
```

---

## Step 7: Generate Compliance Reports

Create audit reports from decrypted transactions:

```typescript
import {
  ComplianceReporter,
  generatePdfReport,
} from '@sip-protocol/sdk'

const reporter = new ComplianceReporter({
  treasury,
  viewingKey: auditorKey,
})

// Generate detailed report
const report = await reporter.generateReport({
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-03-31'),
  format: 'detailed',
})

console.log('Total outflows:', report.summary.totalOutflow)
console.log('Transaction count:', report.transactions.length)
console.log('Categories:', report.summary.byCategory)

// Export as PDF
const pdf = await generatePdfReport(report, {
  title: 'DAO Treasury Q1 2026 Audit Report',
  includeSignatures: true,
  includeTransactionHashes: true,
})

// Save or send
await Bun.write('q1-2026-audit.pdf', pdf)
```

---

## Step 8: Regulatory Format Export

Export in standard regulatory formats:

```typescript
import { exportForRegulator } from '@sip-protocol/sdk'

// FATF format (international)
const fatfExport = await exportForRegulator({
  report,
  format: 'fatf',
  jurisdiction: 'international',
})

// FINCEN format (US)
const fincenExport = await exportForRegulator({
  report,
  format: 'fincen',
  jurisdiction: 'us',
})

// CSV for custom processing
const csvExport = await exportForRegulator({
  report,
  format: 'csv',
})
```

---

## Architecture: Key Hierarchy

Recommended key hierarchy for organizations:

```
Master Viewing Key
│   (Multi-sig: 3-of-5 signers)
│
├── Internal Keys
│   ├── Treasurer Key (scope: all)
│   ├── Council Key (scope: proposals + >$10K)
│   └── Member Key (scope: approved-proposals)
│
└── External Keys
    ├── Auditor 2026-Q1 (time-limited: Jan-Mar)
    ├── Auditor 2026-Q2 (time-limited: Apr-Jun)
    └── Regulator Request #123 (time-limited: specific dates)
```

Each level can only derive keys with equal or lesser scope.

---

## Security Best Practices

### 1. Master Key Protection

```typescript
// Use multi-sig or MPC for master key
const masterKeyShares = await splitKey(masterKey, {
  threshold: 3,
  shares: 5,
})

// Distribute shares to different signers
// Reconstruct only when needed
```

### 2. Key Rotation

```typescript
// Rotate derived keys quarterly
const Q1Key = derive({ ...config, quarter: 'Q1-2026' })
const Q2Key = derive({ ...config, quarter: 'Q2-2026' })

// Old keys still work for historical data
// New transactions use new keys
```

### 3. Revocation List

```typescript
// Maintain list of compromised keys
const revokedKeys = new Set(['auditor-2025-compromised'])

function canDecrypt(key: string) {
  return !revokedKeys.has(key)
}
```

### 4. Audit Trail

```typescript
// Log all key derivations
await logKeyDerivation({
  derivedKeyHash: hash(derivedKey),
  role: 'auditor',
  scope: 'full',
  validUntil: expiry,
  derivedBy: adminAddress,
  derivedAt: new Date(),
})
```

---

## Summary

You've learned to:
- ✅ Generate master viewing keys
- ✅ Create compliant (auditable) transactions
- ✅ Derive role-based keys with limited scope
- ✅ Decrypt transactions for authorized viewers
- ✅ Create time-limited auditor keys
- ✅ Generate compliance reports

Viewing keys enable privacy AND accountability — the combination institutions need.

---

## Further Reading

- [Full Treasury API Reference](https://docs.sip-protocol.org/treasury)
- [Compliance Report Formats](https://docs.sip-protocol.org/compliance)
- [Key Derivation Specifications](https://docs.sip-protocol.org/specs/viewing-keys)

---

*Published by SIP Protocol | The Privacy Standard for Web3*
