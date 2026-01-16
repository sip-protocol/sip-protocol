# Viewing Keys for Compliance: Privacy That Institutions Can Trust

*How SIP enables regulatory-ready privacy without compromising security*

---

## Introduction

Privacy and compliance seem like opposites:
- **Privacy:** Hide everything from everyone
- **Compliance:** Show everything to regulators

But this is a false dichotomy. What institutions actually need is **selective disclosure** — privacy by default, transparency when required.

**Viewing keys** solve this:

```
Default state:     Transaction encrypted, nobody can see
With viewing key:  Authorized party can decrypt and audit
```

This article explains:
1. What viewing keys are and how they work
2. Why institutions need them
3. Use cases: DAOs, treasuries, payroll, audits
4. How to implement viewing keys with SIP SDK
5. Best practices for key management

---

## The Compliance Challenge

### Traditional Privacy: All or Nothing

Most privacy solutions offer binary privacy:

```
┌─────────────────────────────────────────────────────────────┐
│  TORNADO CASH / PRIVACYCASH                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Transaction → [MIXER] → Output                             │
│                                                             │
│  Visibility:                                                │
│    ✗ Sender cannot prove they sent                          │
│    ✗ Recipient cannot prove they received                   │
│    ✗ No audit trail possible                                │
│    ✗ Regulator requests = dead end                          │
│                                                             │
│  Result: Useful for privacy, useless for compliance         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this fails for institutions:**
- DAOs need treasury transparency for members
- Companies need audit trails for taxes
- Institutions need to satisfy regulatory requests
- Compliance teams can't approve "black box" transactions

### SIP's Approach: Selective Disclosure

```
┌─────────────────────────────────────────────────────────────┐
│  SIP PROTOCOL                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Transaction → [ENCRYPTED] → Output                         │
│                    │                                        │
│                    ├── Public: sees encrypted blob          │
│                    ├── Viewing key holder: sees details     │
│                    └── Spending key holder: can spend       │
│                                                             │
│  Visibility:                                                │
│    ✓ Sender can prove they sent (with key)                  │
│    ✓ Recipient can prove they received (with key)           │
│    ✓ Auditor can verify (with delegated key)                │
│    ✓ Regulator can audit (with time-limited key)            │
│                                                             │
│  Result: Privacy by default, transparency when needed       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## How Viewing Keys Work

### Key Separation

SIP uses three types of keys:

| Key Type | Can See Transactions | Can Spend Funds | Share With |
|----------|---------------------|-----------------|------------|
| **Spending Key** | Yes | Yes | Nobody |
| **Viewing Key** | Yes | No | Auditors |
| **Public Address** | No | No | Everyone |

### The Cryptography

When you create a stealth meta-address:

```typescript
import { generateStealthMetaAddress } from '@sip-protocol/sdk'

const metaAddress = generateStealthMetaAddress()

// Two separate key pairs:
metaAddress.spendingKey.privateKey  // Required to spend
metaAddress.viewingKey.privateKey   // Required to see
```

The viewing key is derived independently — knowing it doesn't help you spend.

### Encryption Scheme

Transaction details are encrypted using the viewing key:

```typescript
// Simplified encryption flow
function encryptTransactionDetails(
  details: TransactionDetails,
  viewingPublicKey: string
): EncryptedData {
  // Derive shared secret (sender's ephemeral key + recipient's viewing key)
  const sharedSecret = ecdh(ephemeralPrivate, viewingPublicKey)

  // Encrypt with XChaCha20-Poly1305
  const encrypted = xchacha20poly1305(
    sharedSecret,
    serialize(details)
  )

  return encrypted
}
```

Only the viewing key holder can decrypt:

```typescript
function decryptTransactionDetails(
  encrypted: EncryptedData,
  viewingPrivateKey: string,
  ephemeralPublicKey: string
): TransactionDetails {
  // Same shared secret (recipient's viewing key + sender's ephemeral key)
  const sharedSecret = ecdh(viewingPrivateKey, ephemeralPublicKey)

  // Decrypt
  const details = xchacha20poly1305.decrypt(sharedSecret, encrypted)

  return deserialize(details)
}
```

---

## Use Case 1: DAO Treasury

### The Problem

DAOs face a dilemma:
- **Public treasury:** Competitors see strategy, front-runners exploit
- **Private treasury:** Members can't verify funds aren't misused

### The Solution

Treasury with role-based viewing keys:

```typescript
import {
  generateViewingKey,
  AuditorKeyDerivation,
  AuditorType,
} from '@sip-protocol/sdk'

// Generate master viewing key for treasury
const masterViewingKey = generateViewingKey()

// Derive role-based keys
const keyDerivation = new AuditorKeyDerivation({
  masterKey: masterViewingKey.privateKey,
})

// Different scopes for different roles
const treasurerKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'treasurer',
  scope: 'all', // Sees everything
})

const councilKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'council',
  scope: 'proposals', // Sees approved proposals only
})

const memberKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'member',
  scope: 'summary', // Sees summaries, not details
})
```

### Visibility Matrix

| Role | Individual Txs | Amounts | Recipients | Memos |
|------|---------------|---------|------------|-------|
| Public | No | No | No | No |
| Member | Summaries | Totals | No | No |
| Council | Approved only | Yes | Yes | Yes |
| Treasurer | All | Yes | Yes | Yes |

### Implementation

```typescript
// Treasury transaction with viewing key
const payment = await treasury.createPayment({
  recipient: granteeAddress,
  amount: 50_000n * 10n**6n, // 50,000 USDC
  memo: 'Q1 Developer Grant - Project Alpha',
  privacy: PrivacyLevel.COMPLIANT, // Not SHIELDED
  viewingKey: masterViewingKey.publicKey,
})

// Council member viewing
const councilView = decryptWithViewing(
  payment.encryptedData,
  councilKey
)

if (councilView) {
  console.log('Amount:', councilView.amount)
  console.log('Recipient:', councilView.recipient)
  console.log('Memo:', councilView.memo)
} else {
  console.log('This transaction is outside your scope')
}
```

---

## Use Case 2: External Audits

### Time-Limited Access

Auditors need temporary access, not permanent:

```typescript
import { ThresholdViewingKey } from '@sip-protocol/sdk'

// Create time-locked key for Q1 audit
const auditorKey = await ThresholdViewingKey.createTimeLocked({
  masterKey: treasuryMasterKey,
  unlocksAt: new Date('2026-01-15'), // Audit starts
  expiresAt: new Date('2026-02-28'), // Audit ends
  scope: 'full',
  auditorId: 'deloitte-2026-q1',
})

// Before Jan 15: Key cannot decrypt anything
// Jan 15 - Feb 28: Key decrypts all COMPLIANT transactions
// After Feb 28: Key stops working automatically

// Share with auditor
console.log('Auditor key:', auditorKey.export())
```

### Audit Trail

Every key usage can be logged:

```typescript
// Log key derivation for audit trail
await logKeyDerivation({
  derivedKeyHash: hash(auditorKey),
  purpose: 'Q1 2026 Financial Audit',
  scope: 'full',
  validFrom: new Date('2026-01-15'),
  validUntil: new Date('2026-02-28'),
  derivedBy: treasuryMultisig,
  derivedAt: new Date(),
})
```

---

## Use Case 3: Institutional Compliance

### Regulatory Requests

When a regulator requests information:

```typescript
// Create scope-limited key for specific request
const regulatoryKey = keyDerivation.derive({
  type: AuditorType.REGULATORY,
  requestId: 'SEC-2026-0042',
  scope: 'specific-transactions',
  transactionHashes: [
    '0xabc...', // Only these transactions
    '0xdef...',
    '0x123...',
  ],
  validUntil: new Date('2026-03-31'),
})

// Key can ONLY decrypt the specified transactions
// Not a general fishing expedition
```

### Compliance Reports

Generate audit reports from decrypted data:

```typescript
import { ComplianceReporter, exportForRegulator } from '@sip-protocol/sdk'

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

// Export in regulatory format
const fincenExport = await exportForRegulator({
  report,
  format: 'fincen',
  jurisdiction: 'us',
})

// Or CSV for custom processing
const csvExport = await exportForRegulator({
  report,
  format: 'csv',
})
```

---

## Use Case 4: Private Payroll

### The Problem

Companies paying employees in crypto face:
- Salary visibility to all coworkers
- Competitor intelligence on compensation
- Privacy concerns from employees

### The Solution

```typescript
// Company treasury with payroll viewing key
const payrollKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'payroll-admin',
  scope: 'payroll',
})

// Individual employee salary payment
const salary = await treasury.createPayment({
  recipient: employee.stealthAddress,
  amount: employee.monthlySalary,
  memo: `Salary ${month} - ${employee.id}`,
  privacy: PrivacyLevel.COMPLIANT,
  viewingKey: payrollKey.publicKey,
  category: 'payroll',
})

// Public sees: encrypted transaction
// Employee sees: their payment details
// Payroll admin sees: all payroll transactions
// Other employees see: nothing about colleagues
```

### Tax Reporting

Employees can generate their own tax reports:

```typescript
// Employee generates their income report
const incomeReport = await employee.generateIncomeReport({
  year: 2026,
  viewingKey: employee.personalViewingKey,
})

// Contains: all payments received with amounts, dates
// Suitable for: tax filing, proof of income
```

---

## Key Hierarchy Best Practices

### Recommended Structure

```
Master Viewing Key
│   (Multi-sig: 3-of-5 signers)
│   (Cold storage, hardware wallets)
│
├── Internal Keys
│   ├── Treasurer Key (scope: all)
│   │   └── Daily operations, full visibility
│   │
│   ├── Council Key (scope: proposals)
│   │   └── Governance oversight
│   │
│   └── Member Key (scope: summary)
│       └── Basic transparency
│
└── External Keys
    ├── Auditor Q1-2026 (time-limited: Jan-Mar)
    ├── Auditor Q2-2026 (time-limited: Apr-Jun)
    └── Regulatory Request #42 (tx-specific)
```

### Security Recommendations

1. **Master Key Protection**
```typescript
// Use multi-sig or MPC for master key
const masterKeyShares = await splitKey(masterKey, {
  threshold: 3,
  shares: 5,
})

// Distribute shares to different signers
// Reconstruct only when needed
```

2. **Key Rotation**
```typescript
// Rotate derived keys quarterly
const Q1Key = derive({ ...config, quarter: 'Q1-2026' })
const Q2Key = derive({ ...config, quarter: 'Q2-2026' })

// Old keys still work for historical data
// New transactions use new keys
```

3. **Revocation List**
```typescript
// Maintain list of compromised keys
const revokedKeys = new Set(['auditor-2025-compromised'])

function canDecrypt(keyId: string) {
  return !revokedKeys.has(keyId)
}
```

4. **Audit Logging**
```typescript
// Log all key operations
await logKeyOperation({
  operation: 'derive',
  keyHash: hash(derivedKey),
  role: 'auditor',
  scope: 'full',
  derivedBy: adminAddress,
  timestamp: new Date(),
})
```

---

## Privacy Levels Explained

SIP offers three privacy levels:

```typescript
import { PrivacyLevel } from '@sip-protocol/sdk'

// Public transaction (like traditional crypto)
PrivacyLevel.TRANSPARENT
// Everyone sees: sender, recipient, amount

// Fully private (no viewing key)
PrivacyLevel.SHIELDED
// Nobody sees: sender, recipient, amount
// Not even with viewing key

// Private but auditable
PrivacyLevel.COMPLIANT
// Public sees: encrypted blob
// Viewing key holder sees: all details
```

### When to Use Each

| Level | Use Case |
|-------|----------|
| `TRANSPARENT` | Public grants, donations, open-source funding |
| `SHIELDED` | Personal privacy, no audit requirement |
| `COMPLIANT` | Business operations, treasury, payroll |

---

## Comparison: SIP vs Alternatives

| Feature | SIP | Tornado/PrivacyCash | Zcash |
|---------|-----|---------------------|-------|
| **Privacy by default** | Yes | Yes | Yes |
| **Viewing keys** | Yes | No | Yes |
| **Role-based access** | Yes | No | No |
| **Time-limited keys** | Yes | No | No |
| **Scope-limited keys** | Yes | No | No |
| **Compliance reports** | Yes | No | Manual |
| **Regulatory format export** | Yes | No | No |

---

## Getting Started

### 1. Generate Treasury Keys

```typescript
import { generateViewingKey } from '@sip-protocol/sdk'

const treasuryKeys = generateViewingKey()

// Store master key securely (multi-sig recommended)
console.log('Master private key:', treasuryKeys.privateKey)
console.log('Master public key:', treasuryKeys.publicKey)
```

### 2. Create Compliant Transaction

```typescript
const payment = await sip.send({
  to: recipientMetaAddress,
  amount: 10_000n * 10n**6n,
  token: 'USDC',
  privacy: PrivacyLevel.COMPLIANT,
  viewingKey: treasuryKeys.publicKey,
  memo: 'Grant payment - Project X',
})
```

### 3. Derive Auditor Key

```typescript
const auditorKey = keyDerivation.derive({
  type: AuditorType.EXTERNAL,
  role: 'auditor',
  validUntil: new Date('2026-03-31'),
})
```

### 4. View Transaction

```typescript
const details = decryptWithViewing(
  payment.encryptedData,
  auditorKey
)

console.log('Amount:', details.amount)
console.log('Recipient:', details.recipient)
console.log('Memo:', details.memo)
```

---

## Conclusion

Viewing keys resolve the privacy-compliance tension:

- **For DAOs:** Member transparency without competitor intelligence
- **For Institutions:** Audit capability without public exposure
- **For Individuals:** Tax reporting without broadcasting wealth
- **For Regulators:** Targeted access without mass surveillance

Privacy and compliance aren't opposites — they're layers of the same system.

With SIP's viewing keys, you choose who sees what, when. Privacy by default, transparency when required.

---

## Further Reading

- [Implementing Viewing Keys (Tutorial)](./03-viewing-keys-compliance.md)
- [SIP Treasury API Reference](https://docs.sip-protocol.org/treasury)
- [Key Derivation Specifications](https://docs.sip-protocol.org/specs/viewing-keys)
- [Compliance Report Formats](https://docs.sip-protocol.org/compliance)

---

*Published by SIP Protocol | The Privacy Standard for Web3*
