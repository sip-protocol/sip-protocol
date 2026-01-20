# SIP Developer Compliance Checklist

**Building Compliant Privacy Applications**

**Version:** 1.0.0
**Audience:** Developers integrating SIP into applications
**Format:** Actionable checklist with code examples

---

## Quick Reference

This checklist ensures your SIP integration meets regulatory requirements. Each section includes:
- Checkbox items to complete
- Code examples
- Common mistakes to avoid

---

## 1. Privacy Level Selection

### Checklist

- [ ] Default to `compliant` mode for regulated applications
- [ ] Provide clear UI for privacy level selection
- [ ] Store viewing keys for all compliant transactions
- [ ] Document privacy level in transaction metadata

### Code Example

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// CORRECT: Default to compliant for regulated apps
const sip = new SIP({
  defaultPrivacyLevel: PrivacyLevel.COMPLIANT
})

// CORRECT: Allow user selection with appropriate defaults
function createTransaction(params: TransactionParams) {
  return sip.createShieldedIntent({
    ...params,
    privacyLevel: params.privacyLevel ?? PrivacyLevel.COMPLIANT
  })
}
```

### Mistakes to Avoid

```typescript
// WRONG: Defaulting to shielded without viewing keys
const sip = new SIP({
  defaultPrivacyLevel: PrivacyLevel.SHIELDED  // No compliance capability!
})

// WRONG: Not storing viewing keys
const intent = await sip.createShieldedIntent(params)
await sip.submit(intent)
// Missing: viewingKey storage for compliance
```

---

## 2. Viewing Key Management

### Checklist

- [ ] Generate viewing keys for all user accounts
- [ ] Store viewing keys securely (encrypted at rest)
- [ ] Implement key rotation procedures
- [ ] Enable time-bounded key generation for audits
- [ ] Log all viewing key access

### Code Example

```typescript
import { ViewingKeyManager } from '@sip-protocol/sdk'

class ComplianceKeyManager {
  private keyManager: ViewingKeyManager
  private storage: SecureStorage

  // Generate and store keys on account creation
  async onAccountCreated(account: Account): Promise<void> {
    const viewingKeys = this.keyManager.generateViewingKeys(account.seed)

    // Store encrypted viewing keys
    await this.storage.secureStore({
      accountId: account.id,
      incomingKey: viewingKeys.incoming,
      outgoingKey: viewingKeys.outgoing,
      fullKey: viewingKeys.full,
      createdAt: new Date()
    })

    // Log key creation
    await this.auditLog.record({
      event: 'viewing_key.created',
      accountId: account.id,
      timestamp: new Date()
    })
  }

  // Generate time-bounded key for auditor
  async generateAuditKey(
    accountId: string,
    auditPeriod: { start: Date; end: Date },
    auditorPublicKey: string
  ): Promise<EncryptedViewingKey> {
    const masterKey = await this.storage.retrieve(accountId, 'fullKey')

    // Create time-bounded key
    const auditKey = this.keyManager.createTimeBoundedKey({
      masterKey,
      startTime: auditPeriod.start,
      endTime: auditPeriod.end
    })

    // Encrypt to auditor's key
    const encryptedKey = this.keyManager.encryptTo(auditKey, auditorPublicKey)

    // Log key sharing
    await this.auditLog.record({
      event: 'viewing_key.shared',
      accountId,
      recipientType: 'auditor',
      scope: 'time_bounded',
      validFrom: auditPeriod.start,
      validUntil: auditPeriod.end
    })

    return encryptedKey
  }
}
```

### Mistakes to Avoid

```typescript
// WRONG: Storing viewing keys in plaintext
localStorage.setItem('viewingKey', viewingKey)  // Never do this!

// WRONG: Not logging key access
const key = await getViewingKey(accountId)
// Missing: audit log entry

// WRONG: Creating permanent audit keys
const auditKey = masterKey  // Should be time-bounded!
```

---

## 3. Transaction Recording

### Checklist

- [ ] Record viewing key hash for every compliant transaction
- [ ] Store transaction metadata for reporting
- [ ] Implement transaction search by viewing key hash
- [ ] Enable transaction export for audits

### Code Example

```typescript
interface TransactionRecord {
  txHash: string
  viewingKeyHash: string
  privacyLevel: PrivacyLevel
  timestamp: Date
  chain: string
  // Encrypted fields (only accessible with viewing key)
  encryptedDetails: {
    sender: string
    recipient: string
    amount: string
    memo?: string
  }
}

class TransactionRecordingService {
  async recordTransaction(
    intent: ShieldedIntent,
    result: TransactionResult
  ): Promise<void> {
    const record: TransactionRecord = {
      txHash: result.txHash,
      viewingKeyHash: intent.viewingKeyHash,
      privacyLevel: intent.privacyLevel,
      timestamp: new Date(),
      chain: intent.chain,
      encryptedDetails: intent.encryptedPayload
    }

    await this.database.transactions.insert(record)

    // Index by viewing key hash for compliance lookups
    await this.index.add({
      key: intent.viewingKeyHash,
      txHash: result.txHash
    })
  }

  // Compliance lookup by viewing key hash
  async findByViewingKeyHash(
    viewingKeyHash: string
  ): Promise<TransactionRecord[]> {
    return this.database.transactions.findAll({
      viewingKeyHash
    })
  }

  // Export for audit
  async exportForAudit(
    accountId: string,
    period: { start: Date; end: Date },
    viewingKey: ViewingKey
  ): Promise<AuditExport> {
    const records = await this.database.transactions.findAll({
      accountId,
      timestamp: { $gte: period.start, $lte: period.end }
    })

    return records.map(record => ({
      ...record,
      decryptedDetails: this.decrypt(record.encryptedDetails, viewingKey)
    }))
  }
}
```

---

## 4. Sanctions Screening

### Checklist

- [ ] Screen all transactions before execution
- [ ] Integrate with sanctions list provider
- [ ] Block transactions to sanctioned addresses
- [ ] Log all screening results
- [ ] Implement alert workflow for hits

### Code Example

```typescript
import { SanctionsScreener } from '@sip-protocol/compliance'

class TransactionScreeningService {
  private screener: SanctionsScreener

  constructor() {
    this.screener = new SanctionsScreener({
      provider: 'chainalysis',
      apiKey: process.env.CHAINALYSIS_API_KEY,
      lists: ['OFAC_SDN', 'EU_SANCTIONS', 'UN_SANCTIONS']
    })
  }

  async screenTransaction(
    intent: ShieldedIntent,
    viewingKey: ViewingKey
  ): Promise<ScreeningResult> {
    // Decrypt recipient for screening
    const recipient = this.decryptRecipient(intent, viewingKey)

    // Screen against sanctions lists
    const result = await this.screener.screen({
      address: recipient.address,
      chain: intent.chain
    })

    // Log screening
    await this.auditLog.record({
      event: 'sanctions.screened',
      txHash: intent.hash,
      result: result.status,
      lists: result.matchedLists
    })

    // Handle hits
    if (result.status === 'HIT') {
      await this.handleSanctionsHit(intent, result)
    }

    return result
  }

  private async handleSanctionsHit(
    intent: ShieldedIntent,
    result: ScreeningResult
  ): Promise<void> {
    // Block transaction
    await this.transactionService.block(intent.hash)

    // Create compliance alert
    await this.alertService.create({
      type: 'SANCTIONS_HIT',
      severity: 'CRITICAL',
      transaction: intent,
      matchDetails: result.matches
    })

    // Notify compliance team
    await this.notifications.send({
      channel: 'compliance',
      message: `Sanctions hit: ${intent.hash}`,
      priority: 'immediate'
    })
  }
}
```

---

## 5. Travel Rule Compliance

### Checklist

- [ ] Identify transactions over threshold ($3,000 USD)
- [ ] Collect originator information
- [ ] Collect beneficiary information
- [ ] Include Travel Rule payload in transaction
- [ ] Enable payload decryption by receiving VASP

### Code Example

```typescript
interface TravelRulePayload {
  originator: {
    name: string
    accountNumber: string
    address?: string
    dateOfBirth?: string
  }
  beneficiary: {
    name: string
    accountNumber: string
    vaspName?: string
  }
  transactionDetails: {
    amount: number
    currency: string
  }
}

class TravelRuleService {
  private readonly THRESHOLD_USD = 3000

  async processTransaction(
    intent: ShieldedIntent,
    customer: Customer
  ): Promise<ShieldedIntent> {
    const amountUSD = await this.convertToUSD(intent.amount, intent.token)

    // Check threshold
    if (amountUSD < this.THRESHOLD_USD) {
      return intent  // No Travel Rule required
    }

    // Build Travel Rule payload
    const travelRulePayload: TravelRulePayload = {
      originator: {
        name: customer.fullName,
        accountNumber: customer.accountId,
        address: customer.address,
        dateOfBirth: customer.dateOfBirth
      },
      beneficiary: await this.resolveBeneficiary(intent.recipient),
      transactionDetails: {
        amount: amountUSD,
        currency: 'USD'
      }
    }

    // Encrypt and attach to intent
    const encryptedPayload = await this.encryptTravelRulePayload(
      travelRulePayload,
      intent.recipient
    )

    return {
      ...intent,
      travelRulePayload: encryptedPayload
    }
  }

  private async resolveBeneficiary(
    recipientMetaAddress: string
  ): Promise<TravelRulePayload['beneficiary']> {
    // Lookup beneficiary VASP
    const vaspInfo = await this.vaspDirectory.lookup(recipientMetaAddress)

    return {
      name: vaspInfo.beneficiaryName ?? 'Unknown',
      accountNumber: recipientMetaAddress,
      vaspName: vaspInfo.vaspName
    }
  }
}
```

---

## 6. Audit Log Generation

### Checklist

- [ ] Log all compliance-relevant events
- [ ] Include timestamps, user IDs, and context
- [ ] Store logs securely (immutable)
- [ ] Enable log export for auditors
- [ ] Retain logs per regulatory requirements

### Code Example

```typescript
enum AuditEventType {
  // Viewing Key Events
  VIEWING_KEY_CREATED = 'viewing_key.created',
  VIEWING_KEY_ACCESSED = 'viewing_key.accessed',
  VIEWING_KEY_SHARED = 'viewing_key.shared',
  VIEWING_KEY_REVOKED = 'viewing_key.revoked',

  // Transaction Events
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_SCREENED = 'transaction.screened',
  TRANSACTION_BLOCKED = 'transaction.blocked',
  TRANSACTION_SUBMITTED = 'transaction.submitted',

  // Compliance Events
  ALERT_CREATED = 'alert.created',
  ALERT_RESOLVED = 'alert.resolved',
  REPORT_GENERATED = 'report.generated',
  FILING_SUBMITTED = 'filing.submitted'
}

interface AuditLogEntry {
  id: string
  eventType: AuditEventType
  timestamp: Date
  userId: string
  ipAddress?: string
  userAgent?: string
  resourceType: string
  resourceId: string
  action: string
  details: Record<string, any>
  hash: string  // For integrity verification
}

class AuditLogger {
  private storage: ImmutableLogStorage

  async log(event: Omit<AuditLogEntry, 'id' | 'timestamp' | 'hash'>): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
      hash: ''  // Calculated below
    }

    // Calculate hash for integrity
    entry.hash = this.calculateHash(entry)

    // Store immutably
    await this.storage.append(entry)
  }

  private calculateHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const data = JSON.stringify(entry)
    return sha256(data).toString('hex')
  }

  async exportForAudit(
    startDate: Date,
    endDate: Date
  ): Promise<AuditLogEntry[]> {
    const logs = await this.storage.query({
      timestamp: { $gte: startDate, $lte: endDate }
    })

    // Verify integrity
    for (const log of logs) {
      const expectedHash = this.calculateHash({
        ...log,
        hash: undefined
      })
      if (expectedHash !== log.hash) {
        throw new Error(`Log integrity violation: ${log.id}`)
      }
    }

    return logs
  }
}
```

---

## 7. Compliance Testing

### Checklist

- [ ] Unit tests for viewing key operations
- [ ] Integration tests for sanctions screening
- [ ] E2E tests for compliance workflows
- [ ] Test audit report generation
- [ ] Verify log immutability

### Code Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceService } from './compliance-service'
import { MockSanctionsProvider } from './test-utils'

describe('ComplianceService', () => {
  let service: ComplianceService
  let mockSanctions: MockSanctionsProvider

  beforeEach(() => {
    mockSanctions = new MockSanctionsProvider()
    service = new ComplianceService({
      sanctionsProvider: mockSanctions
    })
  })

  describe('Viewing Key Management', () => {
    it('should generate all three viewing key types', async () => {
      const keys = await service.generateViewingKeys(testSeed)

      expect(keys.incoming).toBeDefined()
      expect(keys.outgoing).toBeDefined()
      expect(keys.full).toBeDefined()
    })

    it('should create time-bounded keys', async () => {
      const auditKey = await service.createTimeBoundedKey({
        masterKey: testMasterKey,
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-12-31')
      })

      expect(auditKey.validFrom).toEqual(new Date('2025-01-01'))
      expect(auditKey.validUntil).toEqual(new Date('2025-12-31'))
    })

    it('should log viewing key access', async () => {
      await service.accessViewingKey('account-123', 'audit')

      const logs = await service.getAuditLogs('account-123')
      expect(logs).toContainEqual(
        expect.objectContaining({
          eventType: 'viewing_key.accessed',
          resourceId: 'account-123'
        })
      )
    })
  })

  describe('Sanctions Screening', () => {
    it('should block sanctioned addresses', async () => {
      mockSanctions.addSanctionedAddress('0xBAD...')

      const result = await service.screenTransaction({
        recipient: '0xBAD...',
        amount: 1000
      })

      expect(result.status).toBe('BLOCKED')
      expect(result.reason).toContain('OFAC')
    })

    it('should pass clean addresses', async () => {
      const result = await service.screenTransaction({
        recipient: '0xGOOD...',
        amount: 1000
      })

      expect(result.status).toBe('CLEAR')
    })

    it('should log all screening results', async () => {
      await service.screenTransaction({
        recipient: '0xTEST...',
        amount: 1000
      })

      const logs = await service.getAuditLogs()
      expect(logs).toContainEqual(
        expect.objectContaining({
          eventType: 'transaction.screened'
        })
      )
    })
  })

  describe('Travel Rule', () => {
    it('should require Travel Rule for transactions over threshold', async () => {
      const result = await service.checkTravelRuleRequired({
        amount: 5000,
        currency: 'USD'
      })

      expect(result.required).toBe(true)
    })

    it('should not require Travel Rule below threshold', async () => {
      const result = await service.checkTravelRuleRequired({
        amount: 2000,
        currency: 'USD'
      })

      expect(result.required).toBe(false)
    })
  })

  describe('Audit Reports', () => {
    it('should generate complete audit report', async () => {
      // Create test transactions
      await service.createTransaction({ amount: 1000 })
      await service.createTransaction({ amount: 2000 })

      const report = await service.generateAuditReport({
        accountId: 'test-account',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31')
      })

      expect(report.transactions).toHaveLength(2)
      expect(report.summary.totalVolume).toBe(3000)
    })

    it('should include cryptographic proofs', async () => {
      await service.createTransaction({ amount: 1000 })

      const report = await service.generateAuditReport({
        accountId: 'test-account',
        includeProofs: true
      })

      expect(report.transactions[0].cryptographicProof).toBeDefined()
    })
  })
})
```

---

## 8. Pre-Launch Compliance Checklist

### Before Going Live

```
COMPLIANCE READINESS CHECKLIST

LEGAL & REGULATORY
□ Legal opinion obtained
□ Regulatory requirements documented
□ Licenses/registrations in place
□ Terms of service include compliance language

VIEWING KEY MANAGEMENT
□ Key generation implemented
□ Secure storage configured
□ Key rotation procedures documented
□ Access controls in place
□ Audit logging enabled

SANCTIONS SCREENING
□ Provider integrated
□ All lists configured
□ Alert workflow implemented
□ Testing completed
□ Escalation procedures documented

TRAVEL RULE
□ Threshold checking implemented
□ Data collection flows built
□ VASP directory integrated
□ Payload encryption working
□ Testing completed

REPORTING
□ Transaction recording implemented
□ Report generation working
□ Export functionality tested
□ Retention policies configured

AUDIT TRAIL
□ All events logged
□ Log integrity verified
□ Export functionality tested
□ Retention period configured

TESTING
□ Unit tests passing
□ Integration tests passing
□ E2E compliance tests passing
□ Penetration testing completed
□ Compliance review completed

DOCUMENTATION
□ Compliance procedures documented
□ Incident response plan ready
□ Staff training completed
□ Audit preparation package ready
```

---

## Quick Reference Card

### Privacy Levels

| Level | Use When | Viewing Key |
|-------|----------|-------------|
| `transparent` | Testing, debugging | Not needed |
| `shielded` | Maximum privacy | Optional |
| `compliant` | Regulated use (default) | Required |

### Key API Methods

```typescript
// Generate viewing keys
sip.generateViewingKeys(seed)

// Create compliant transaction
sip.createShieldedIntent({ privacyLevel: 'compliant' })

// Screen transaction
sip.compliance.screen(transaction)

// Generate audit key
sip.viewingKeys.createTimeBounded({ start, end })

// Export audit report
sip.compliance.generateAuditReport({ accountId, period })
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `VIEWING_KEY_NOT_STORED` | Forgot to store key | Call `viewingKeys.store()` |
| `SANCTIONS_HIT` | Sanctioned address | Block transaction, file SAR |
| `TRAVEL_RULE_REQUIRED` | Over threshold | Include Travel Rule payload |
| `AUDIT_LOG_INTEGRITY` | Tampered logs | Restore from backup |

---

## Support

- **Developer Docs:** https://docs.sip-protocol.org/developers
- **Compliance SDK:** `npm install @sip-protocol/compliance`
- **Discord:** https://discord.gg/sip-protocol (#developers)
- **Email:** dev@sip-protocol.org

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
