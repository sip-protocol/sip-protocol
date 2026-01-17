# Quick Start: DAO Treasury with Viewing Keys

**Time to read: 8 minutes**

Manage DAO treasury with privacy + selective disclosure for governance transparency.

## The Challenge

DAOs need:
- **Privacy**: Hide treasury movements from front-runners
- **Transparency**: Members can audit spending
- **Compliance**: Regulators can verify when required

SIP's viewing keys solve this with selective disclosure.

## Installation

```bash
pnpm add @sip-protocol/sdk
```

## 1. Create Treasury with Viewing Keys

```typescript
import {
  Treasury,
  generateViewingKey,
  deriveViewingKey,
  PrivacyLevel,
} from '@sip-protocol/sdk'

// Master viewing key for the DAO
const masterViewingKey = generateViewingKey()

// Create treasury
const treasury = new Treasury({
  network: 'mainnet',
  multisigThreshold: 3, // 3-of-5 signers
  multisigSigners: [signer1, signer2, signer3, signer4, signer5],
  viewingKey: masterViewingKey.publicKey,
})

console.log('Treasury address:', treasury.address)
console.log('Master viewing key:', masterViewingKey.publicKey)
```

## 2. Derive Role-Based Viewing Keys

Different stakeholders get different access:

```typescript
import { AuditorKeyDerivation, AuditorType } from '@sip-protocol/sdk'

const keyDerivation = new AuditorKeyDerivation({
  masterKey: masterViewingKey.privateKey,
})

// Derive keys for different roles
const treasurerKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'treasurer',
  scope: 'all', // See all transactions
})

const memberKey = keyDerivation.derive({
  type: AuditorType.INTERNAL,
  role: 'member',
  scope: 'proposals', // Only see approved proposals
})

const auditorKey = keyDerivation.derive({
  type: AuditorType.EXTERNAL,
  role: 'auditor',
  scope: 'quarterly', // Quarterly reports only
  validFrom: new Date('2026-01-01'),
  validUntil: new Date('2026-03-31'),
})

console.log('Treasurer can see: all transactions')
console.log('Members can see: proposal-linked transactions')
console.log('Auditor can see: Q1 2026 transactions only')
```

## 3. Create Private Treasury Payment

```typescript
// Create a payment proposal
const proposal = await treasury.createPaymentProposal({
  recipient: vendorStealthAddress,
  amount: 50000n * 10n**6n, // 50,000 USDC
  token: 'USDC',
  memo: 'Q1 Development Grant',
  privacy: PrivacyLevel.COMPLIANT,
})

console.log('Proposal ID:', proposal.id)

// Signers approve
await treasury.sign(proposal.id, signer1)
await treasury.sign(proposal.id, signer2)
await treasury.sign(proposal.id, signer3) // Threshold met

// Execute the payment
const result = await treasury.execute(proposal.id)
console.log('Payment TX:', result.signature)
// On-chain: hidden amount, hidden recipient
// With viewing key: full details visible
```

## 4. View Transactions with Role Key

```typescript
import { decryptWithViewing } from '@sip-protocol/sdk'

// Treasurer views all transactions
const treasuryTxs = await treasury.getTransactions({
  viewingKey: treasurerKey,
})

for (const tx of treasuryTxs) {
  console.log(`${tx.date}: ${tx.amount} ${tx.token} → ${tx.recipient}`)
  console.log(`  Memo: ${tx.memo}`)
  console.log(`  Approved by: ${tx.signers.join(', ')}`)
}

// Member views only proposal-linked
const memberTxs = await treasury.getTransactions({
  viewingKey: memberKey,
  filter: 'proposals',
})
// Returns: only transactions linked to governance proposals
```

## 5. Generate Compliance Reports

```typescript
import {
  ComplianceReporter,
  generatePdfReport,
} from '@sip-protocol/sdk'

const reporter = new ComplianceReporter({
  treasury,
  viewingKey: auditorKey,
})

// Generate quarterly report
const report = await reporter.generateReport({
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-03-31'),
  format: 'detailed',
})

console.log('Total outflows:', report.summary.totalOutflow)
console.log('Transactions:', report.transactions.length)
console.log('By category:', report.summary.byCategory)

// Export as PDF
const pdf = await generatePdfReport(report, {
  title: 'DAO Treasury Q1 2026',
  includeSignatures: true,
})
await Bun.write('q1-report.pdf', pdf)
```

## 6. Time-Locked Viewing Keys

For audits that expire:

```typescript
import { ThresholdViewingKey } from '@sip-protocol/sdk'

// Create time-locked key for external audit
const auditKey = await ThresholdViewingKey.createTimeLocked({
  masterKey: masterViewingKey,
  unlocksAt: new Date('2026-02-01'),
  expiresAt: new Date('2026-02-28'),
  scope: 'full',
})

// Key cannot decrypt before Feb 1
// Key automatically invalidates after Feb 28

console.log('Audit key valid: Feb 1-28, 2026')
console.log('Share with auditor:', auditKey.publicKey)
```

## 7. Batch Payments with Privacy

Pay multiple recipients in one transaction:

```typescript
const batchProposal = await treasury.createBatchProposal({
  recipients: [
    { address: dev1Stealth, amount: 5000n * 10n**6n, memo: 'Dev 1' },
    { address: dev2Stealth, amount: 5000n * 10n**6n, memo: 'Dev 2' },
    { address: dev3Stealth, amount: 5000n * 10n**6n, memo: 'Dev 3' },
  ],
  token: 'USDC',
  title: 'March Developer Payments',
  privacy: PrivacyLevel.COMPLIANT,
})

// On-chain: single transaction, amounts hidden
// With viewing key: each recipient visible
```

## Complete Treasury Example

```typescript
import {
  Treasury,
  generateViewingKey,
  AuditorKeyDerivation,
  AuditorType,
  PrivacyLevel,
  ComplianceReporter,
} from '@sip-protocol/sdk'

class DAOTreasury {
  private treasury: Treasury
  private masterKey: ReturnType<typeof generateViewingKey>
  private keyDerivation: AuditorKeyDerivation

  constructor(signers: string[], threshold: number) {
    this.masterKey = generateViewingKey()
    this.treasury = new Treasury({
      network: 'mainnet',
      multisigThreshold: threshold,
      multisigSigners: signers,
      viewingKey: this.masterKey.publicKey,
    })
    this.keyDerivation = new AuditorKeyDerivation({
      masterKey: this.masterKey.privateKey,
    })
  }

  // Issue viewing key to member
  issueMemberKey(memberId: string) {
    return this.keyDerivation.derive({
      type: AuditorType.INTERNAL,
      role: 'member',
      userId: memberId,
      scope: 'proposals',
    })
  }

  // Issue time-limited auditor key
  issueAuditorKey(auditorName: string, validDays: number) {
    const now = new Date()
    const expires = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000)

    return this.keyDerivation.derive({
      type: AuditorType.EXTERNAL,
      role: 'auditor',
      userId: auditorName,
      scope: 'full',
      validFrom: now,
      validUntil: expires,
    })
  }

  // Create payment with governance link
  async pay(params: {
    recipient: string
    amount: bigint
    token: string
    proposalId: string
  }) {
    const proposal = await this.treasury.createPaymentProposal({
      ...params,
      privacy: PrivacyLevel.COMPLIANT,
      governanceRef: params.proposalId,
    })

    return proposal
  }

  // Generate report for viewing key holder
  async generateReport(viewingKey: string, startDate: Date, endDate: Date) {
    const reporter = new ComplianceReporter({
      treasury: this.treasury,
      viewingKey,
    })

    return reporter.generateReport({
      startDate,
      endDate,
      format: 'detailed',
    })
  }
}
```

## Viewing Key Hierarchy

```
Master Viewing Key (DAO multisig holds)
├── Treasurer Key (all transactions)
├── Council Key (proposals + large payments)
├── Member Key (proposals only)
└── Auditor Key (time-limited, full access)
```

## Security Considerations

1. **Master key storage** - Use multisig or MPC for master key
2. **Key rotation** - Rotate derived keys quarterly
3. **Scope limiting** - Always use minimum required scope
4. **Expiration** - Set expiration on external auditor keys
5. **Revocation** - Maintain revocation list for compromised keys

## Next Steps

- [NFT Marketplace Privacy](./QUICK-START-NFT.md)
- [Payment App Integration](./QUICK-START-PAYMENTS.md)
- [Enterprise Compliance](./QUICK-START-COMPLIANCE.md)

---

Built with SIP Protocol - The Privacy Standard for Web3
