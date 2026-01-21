# Anchorage Digital Integration Specification

**SIP Viewing Key Integration for Anchorage Custody**

**Version:** 1.0.0
**Status:** Draft
**Priority:** Critical
**Target:** Q2 2026

---

## Executive Summary

This specification defines the integration of SIP viewing keys with Anchorage Digital's institutional custody platform. The integration enables institutional clients to maintain cryptographic privacy for their digital asset transactions while providing full compliance visibility to Anchorage's regulated custody infrastructure.

---

## 1. Anchorage Platform Overview

### 1.1 About Anchorage Digital

Anchorage Digital is a federally chartered digital asset bank regulated by the OCC (Office of the Comptroller of the Currency). Key characteristics:

| Attribute | Details |
|-----------|---------|
| **Regulation** | OCC-chartered, SOC 2 Type II |
| **Clients** | Institutions, DAOs, family offices |
| **Assets** | $50B+ in custody |
| **Compliance** | AML/KYC, BSA, Travel Rule |
| **Platform** | Anchorage Digital Bank, Anchorage Access |

### 1.2 Anchorage Product Suite

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ANCHORAGE PRODUCT ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANCHORAGE DIGITAL BANK (Qualified Custody)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Institutional custody                                             │   │
│  │ • Regulatory compliance                                             │   │
│  │ • Staking services                                                  │   │
│  │ • Trading integration                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ANCHORAGE ACCESS (Self-Custody with Compliance)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Key management infrastructure                                     │   │
│  │ • Policy engine                                                     │   │
│  │ • Compliance reporting                                              │   │
│  │ • Multi-chain support                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  COMPLIANCE DASHBOARD                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Transaction monitoring                                            │   │
│  │ • Risk scoring                                                      │   │
│  │ • Regulatory reporting                                              │   │
│  │ • Audit trail generation                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Integration Opportunity

SIP viewing keys enable Anchorage to offer:

- **Private transactions** with full compliance visibility
- **Selective disclosure** for regulatory requests
- **Audit trails** without public blockchain exposure
- **Competitive differentiation** from custody-only providers

---

## 2. Anchorage API Research

### 2.1 API Architecture

Anchorage provides REST APIs for institutional integrations:

```
Base URL: https://api.anchorage.com/v1
Authentication: OAuth 2.0 + API Key
Rate Limits: 100 req/sec (enterprise tier)
```

### 2.2 Relevant API Endpoints

| Endpoint | Purpose | SIP Integration |
|----------|---------|-----------------|
| `/accounts` | Account management | Associate viewing keys |
| `/transactions` | Transaction history | Enrich with decrypted data |
| `/compliance/reports` | Compliance reporting | Include SIP transactions |
| `/webhooks` | Event notifications | Transaction alerts |
| `/policies` | Access policies | Viewing key permissions |

### 2.3 Compliance API (Key Integration Point)

```typescript
// Anchorage Compliance API (Documented)
interface AnchorageComplianceAPI {
  // Transaction monitoring
  getTransactionRisk(txHash: string): Promise<RiskAssessment>
  screenAddress(address: string): Promise<ScreeningResult>

  // Reporting
  generateAuditReport(params: ReportParams): Promise<AuditReport>
  exportTransactions(params: ExportParams): Promise<TransactionExport>

  // Policies
  createCompliancePolicy(policy: Policy): Promise<PolicyResult>
  validateTransaction(tx: Transaction): Promise<ValidationResult>
}
```

### 2.4 Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIP-ANCHORAGE INTEGRATION POINTS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT APPLICATION                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ User initiates shielded transaction via Anchorage-integrated app   │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  SIP PROTOCOL LAYER          ────────────────────                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Create shielded intent                                          │   │
│  │ 2. Generate viewing key                                            │   │
│  │ 3. Encrypt transaction details                                     │   │
│  │ 4. Store viewing key hash on-chain                                 │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│            ┌──────────────────────────┴──────────────────────────┐         │
│            │                                                      │         │
│            ▼                                                      ▼         │
│  BLOCKCHAIN                                         ANCHORAGE INTEGRATION   │
│  ┌─────────────────────┐              ┌─────────────────────────────────┐  │
│  │ • Transaction       │              │ VIEWING KEY ESCROW SERVICE      │  │
│  │   submitted         │              │ ┌─────────────────────────────┐ │  │
│  │ • Viewing key hash  │              │ │ • Store encrypted VK        │ │  │
│  │   recorded          │              │ │ • Register with Anchorage   │ │  │
│  └─────────────────────┘              │ │ • Enable compliance access  │ │  │
│                                       │ └─────────────────────────────┘ │  │
│                                       │                                 │  │
│                                       │ COMPLIANCE DASHBOARD WIDGET     │  │
│                                       │ ┌─────────────────────────────┐ │  │
│                                       │ │ • Decrypt transactions      │ │  │
│                                       │ │ • Display in dashboard      │ │  │
│                                       │ │ • Generate reports          │ │  │
│                                       │ └─────────────────────────────┘ │  │
│                                       └─────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Viewing Key Integration Flow

### 3.1 Account Onboarding

```
VIEWING KEY ONBOARDING FLOW

1. CLIENT SETUP
   ┌─────────────────────────────────────────────────────────────────────┐
   │ a. Client creates Anchorage custody account                        │
   │ b. Client opts into SIP privacy features                           │
   │ c. Anchorage generates custody-specific viewing key pair           │
   └───────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
2. KEY REGISTRATION
   ┌─────────────────────────────────────────────────────────────────────┐
   │ a. Viewing public key registered with SIP network                  │
   │ b. Viewing private key stored in Anchorage HSM                     │
   │ c. Key hash recorded for compliance discovery                      │
   └───────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
3. CLIENT AUTHORIZATION
   ┌─────────────────────────────────────────────────────────────────────┐
   │ a. Client grants viewing key access to Anchorage                   │
   │ b. Delegation scope defined (full, time-bounded, etc.)             │
   │ c. Authorization recorded in Anchorage policy engine               │
   └─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Transaction Flow

```
SHIELDED TRANSACTION WITH ANCHORAGE COMPLIANCE

1. TRANSACTION INITIATION
   Client ──▶ Create shielded transaction via Anchorage interface
              │
              ▼
2. PRE-TRANSACTION COMPLIANCE
   Anchorage ──▶ Screen recipient address
              ──▶ Validate against policies
              ──▶ Approve or reject
              │
              ▼
3. TRANSACTION EXECUTION
   SIP SDK ──▶ Generate stealth address for recipient
           ──▶ Create Pedersen commitment for amount
           ──▶ Encrypt transaction details with viewing key
           ──▶ Submit to blockchain
              │
              ▼
4. COMPLIANCE LOGGING
   Anchorage ──▶ Decrypt transaction with viewing key
             ──▶ Log to compliance dashboard
             ──▶ Store audit trail
             ──▶ Update risk scoring
              │
              ▼
5. CONFIRMATION
   Client ──▶ Receives confirmation with compliance status
```

### 3.3 API Integration Specification

```typescript
// SIP-Anchorage Integration API

interface SIPAnchorageIntegration {
  // Viewing Key Management
  registerViewingKey(params: {
    accountId: string
    viewingPublicKey: string
    delegationScope: DelegationScope
  }): Promise<RegistrationResult>

  revokeViewingKey(params: {
    accountId: string
    keyHash: string
    reason: string
  }): Promise<RevocationResult>

  // Transaction Processing
  createShieldedTransaction(params: {
    accountId: string
    recipient: StealthMetaAddress
    amount: bigint
    token: string
    privacyLevel: PrivacyLevel
  }): Promise<TransactionResult>

  // Compliance Access
  getDecryptedTransactions(params: {
    accountId: string
    startDate: Date
    endDate: Date
    viewingKey: ViewingKey
  }): Promise<DecryptedTransaction[]>

  // Audit Trail
  generateComplianceReport(params: {
    accountId: string
    reportType: ReportType
    period: DateRange
  }): Promise<ComplianceReport>
}

interface DelegationScope {
  type: 'full' | 'incoming' | 'outgoing' | 'time_bounded'
  validFrom?: Date
  validUntil?: Date
  transactionTypes?: TransactionType[]
}

interface DecryptedTransaction {
  txHash: string
  timestamp: Date
  sender: string
  recipient: string
  amount: string
  token: string
  chain: string
  privacyLevel: PrivacyLevel
  complianceStatus: ComplianceStatus
  riskScore: number
}
```

---

## 4. Compliance Dashboard Widget

### 4.1 Widget Overview

Embeddable React component for Anchorage's compliance dashboard:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PRIVACY TRANSACTIONS                                    [⚙️] [📊] [↗️] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SUMMARY                                           PRIVACY METRICS          │
│  ┌─────────────────────────────────┐              ┌─────────────────────┐  │
│  │ Total Transactions: 1,247       │              │ Shielded: 68%       │  │
│  │ Total Volume: $45.6M            │              │ Compliant: 30%      │  │
│  │ Active Addresses: 156           │              │ Transparent: 2%     │  │
│  └─────────────────────────────────┘              └─────────────────────┘  │
│                                                                             │
│  RECENT TRANSACTIONS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Time     │ Type │ Amount      │ Counterparty │ Status  │ Risk      │   │
│  ├──────────┼──────┼─────────────┼──────────────┼─────────┼───────────┤   │
│  │ 14:32:05 │ OUT  │ $50,000.00  │ 0x7a3f...    │ ✓ Clear │ Low       │   │
│  │ 14:28:17 │ IN   │ $125,000.00 │ 0x9b2c...    │ ✓ Clear │ Low       │   │
│  │ 14:15:42 │ OUT  │ $75,000.00  │ 0x4d8e...    │ ⚠ Review│ Medium    │   │
│  │ 13:58:01 │ IN   │ $200,000.00 │ 0x1f6a...    │ ✓ Clear │ Low       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [View All] [Export Report] [Configure Alerts]                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Widget Component Specification

```typescript
// SIP Compliance Dashboard Widget

interface SIPDashboardWidgetProps {
  // Authentication
  anchorageApiKey: string
  accountId: string

  // Viewing Key Access
  viewingKeyProvider: ViewingKeyProvider

  // Display Options
  theme?: 'light' | 'dark'
  locale?: string
  currency?: string

  // Event Handlers
  onTransactionClick?: (tx: DecryptedTransaction) => void
  onAlertTriggered?: (alert: ComplianceAlert) => void
  onExportRequested?: (format: ExportFormat) => void
}

interface ViewingKeyProvider {
  getViewingKey(accountId: string): Promise<ViewingKey>
  validateAccess(accountId: string): Promise<boolean>
}

// React Component
const SIPComplianceWidget: React.FC<SIPDashboardWidgetProps> = ({
  anchorageApiKey,
  accountId,
  viewingKeyProvider,
  theme = 'light',
  ...props
}) => {
  const [transactions, setTransactions] = useState<DecryptedTransaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const viewingKey = await viewingKeyProvider.getViewingKey(accountId)
      const api = new SIPAnchorageAPI(anchorageApiKey)

      const [txs, sum] = await Promise.all([
        api.getDecryptedTransactions({ accountId, viewingKey }),
        api.getTransactionSummary({ accountId, viewingKey })
      ])

      setTransactions(txs)
      setSummary(sum)
      setLoading(false)
    }
    loadData()
  }, [accountId])

  return (
    <WidgetContainer theme={theme}>
      <WidgetHeader title="SIP Privacy Transactions" />
      <SummaryCards summary={summary} />
      <TransactionTable
        transactions={transactions}
        onRowClick={props.onTransactionClick}
      />
      <WidgetFooter
        onExport={props.onExportRequested}
        onConfigure={() => {/* open settings */}}
      />
    </WidgetContainer>
  )
}
```

### 4.3 Widget Features

| Feature | Description |
|---------|-------------|
| **Real-time Updates** | WebSocket connection for live transaction feed |
| **Filtering** | By date, amount, risk level, counterparty |
| **Search** | Full-text search across decrypted transactions |
| **Drill-down** | Click to view full transaction details |
| **Alerts** | Configurable alerts for high-risk transactions |
| **Export** | CSV, PDF, JSON export options |
| **Theming** | Match Anchorage dashboard styling |

### 4.4 Embed Integration

```html
<!-- Anchorage Dashboard Integration -->
<div id="sip-compliance-widget"></div>

<script src="https://cdn.sip-protocol.org/widgets/anchorage/v1.js"></script>
<script>
  SIPWidget.init({
    container: '#sip-compliance-widget',
    apiKey: 'anch_xxx_yyy',
    accountId: 'acct_123',
    viewingKeyEndpoint: '/api/viewing-keys',
    theme: 'dark'
  })
</script>
```

---

## 5. Audit Trail Export

### 5.1 Export Formats

| Format | Use Case | Contents |
|--------|----------|----------|
| **CSV** | Spreadsheet analysis | Flat transaction data |
| **PDF** | Regulatory submission | Formatted report with signatures |
| **JSON** | System integration | Structured data with proofs |
| **XML** | Legacy systems | XBRL-compatible format |

### 5.2 Audit Report Structure

```typescript
interface AuditTrailExport {
  // Report Metadata
  metadata: {
    reportId: string
    generatedAt: Date
    generatedBy: string
    accountId: string
    period: DateRange
    format: ExportFormat
  }

  // Account Summary
  accountSummary: {
    totalTransactions: number
    totalVolumeIn: string
    totalVolumeOut: string
    netPosition: string
    uniqueCounterparties: number
    chainsUsed: string[]
  }

  // Transaction Details
  transactions: AuditedTransaction[]

  // Compliance Attestation
  compliance: {
    sanctionsScreened: boolean
    alertsTriggered: number
    alertsResolved: number
    riskDistribution: RiskDistribution
  }

  // Cryptographic Verification
  verification: {
    viewingKeyHash: string
    merkleRoot: string
    transactionProofs: TransactionProof[]
  }

  // Digital Signature
  signature: {
    signer: string
    algorithm: string
    value: string
    timestamp: Date
  }
}

interface AuditedTransaction {
  // On-chain data
  txHash: string
  blockNumber: number
  chain: string
  timestamp: Date

  // Decrypted data (via viewing key)
  sender: string
  recipient: string
  amount: string
  token: string
  memo?: string

  // Compliance data
  privacyLevel: PrivacyLevel
  sanctionsStatus: ScreeningStatus
  riskScore: number
  alertIds: string[]

  // Proof of inclusion
  proof: {
    viewingKeyHash: string
    decryptionProof: string
  }
}
```

### 5.3 Export API

```typescript
// Audit Trail Export API

interface AuditExportAPI {
  // Generate export
  createExport(params: {
    accountId: string
    period: DateRange
    format: ExportFormat
    options: ExportOptions
  }): Promise<ExportJob>

  // Check export status
  getExportStatus(jobId: string): Promise<ExportStatus>

  // Download completed export
  downloadExport(jobId: string): Promise<ExportFile>

  // Schedule recurring export
  scheduleExport(params: {
    accountId: string
    schedule: CronExpression
    format: ExportFormat
    recipients: string[]
  }): Promise<ScheduledExport>
}

interface ExportOptions {
  includeTransactionProofs: boolean
  includeRiskDetails: boolean
  includeMemos: boolean
  digitalSignature: boolean
  encryptOutput: boolean
  recipientPublicKey?: string
}

// Example usage
const exportJob = await auditAPI.createExport({
  accountId: 'acct_123',
  period: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31')
  },
  format: 'PDF',
  options: {
    includeTransactionProofs: true,
    includeRiskDetails: true,
    digitalSignature: true
  }
})

// Poll for completion
while (exportJob.status === 'processing') {
  await sleep(5000)
  exportJob = await auditAPI.getExportStatus(exportJob.id)
}

// Download
const file = await auditAPI.downloadExport(exportJob.id)
```

### 5.4 PDF Report Template

```
═══════════════════════════════════════════════════════════════════════════════
                         ANCHORAGE DIGITAL BANK
                    SIP PRIVACY TRANSACTION AUDIT REPORT
═══════════════════════════════════════════════════════════════════════════════

Report ID:        RPT-2025-12345
Account ID:       acct_institution_xyz
Report Period:    January 1, 2025 - December 31, 2025
Generated:        January 15, 2026 14:32:05 UTC
Generated By:     Anchorage Compliance System

───────────────────────────────────────────────────────────────────────────────
EXECUTIVE SUMMARY
───────────────────────────────────────────────────────────────────────────────

Total Transactions:              1,847
Total Volume (Inbound):          $45,678,901.23
Total Volume (Outbound):         $42,345,678.90
Net Position Change:             +$3,333,222.33

Privacy Level Distribution:
  • Shielded:                    1,256 (68.0%)
  • Compliant:                     554 (30.0%)
  • Transparent:                    37 (2.0%)

Compliance Status:
  • Sanctions Screened:          100%
  • Alerts Triggered:            12
  • Alerts Resolved:             12
  • Risk Score (Avg):            2.3 / 10 (Low)

───────────────────────────────────────────────────────────────────────────────
TRANSACTION DETAIL
───────────────────────────────────────────────────────────────────────────────

[Page 2-45: Full transaction listing with cryptographic proofs]

───────────────────────────────────────────────────────────────────────────────
CRYPTOGRAPHIC VERIFICATION
───────────────────────────────────────────────────────────────────────────────

Viewing Key Hash:    0x7a3f9b2c...4d8e1f6a
Merkle Root:         0x4d8e1f6a...7a3f9b2c
Verification URL:    https://verify.sip-protocol.org/report/RPT-2025-12345

To verify this report:
1. Visit verification URL above
2. Upload this PDF file
3. System will cryptographically verify all transaction proofs

───────────────────────────────────────────────────────────────────────────────
ATTESTATION
───────────────────────────────────────────────────────────────────────────────

This report has been generated from decrypted SIP privacy transactions using
viewing key access authorized by the account holder. All transactions have
been screened against applicable sanctions lists and comply with Anchorage
Digital Bank's compliance policies.

Digital Signature:
  Signer:            Anchorage Compliance System
  Algorithm:         ECDSA-secp256k1
  Signature:         0x304402...
  Timestamp:         2026-01-15T14:32:05Z

═══════════════════════════════════════════════════════════════════════════════
                         CONFIDENTIAL - FOR AUTHORIZED USE ONLY
═══════════════════════════════════════════════════════════════════════════════
```

---

## 6. Security Considerations

### 6.1 Viewing Key Protection

| Requirement | Implementation |
|-------------|----------------|
| Storage | Anchorage HSM (FIPS 140-2 Level 3) |
| Access Control | Multi-party authorization |
| Audit Logging | All access logged immutably |
| Rotation | Annual rotation with overlap period |
| Revocation | Immediate revocation capability |

### 6.2 Data Protection

| Data Type | Protection |
|-----------|------------|
| Viewing keys | HSM storage, never exported |
| Decrypted transactions | Memory-only, not persisted |
| Audit reports | Encrypted at rest, signed |
| API traffic | TLS 1.3, mutual authentication |

### 6.3 Access Control Matrix

```
ACCESS CONTROL MATRIX

                        View    Decrypt   Export    Admin
                        Keys    TXs       Reports   Config
                        ─────   ─────────  ──────   ──────
Compliance Officer       ✓         ✓         ✓        ✗
Account Manager          ✗         ✓         ✗        ✗
System Admin             ✓         ✗         ✗        ✓
Auditor (External)       ✗         ✓*        ✓*       ✗
Regulator                ✗         ✓*        ✓*       ✗

* = Requires explicit client authorization
```

---

## 7. Implementation Plan

### 7.1 Phase 1: Foundation (Week 1-4)

| Task | Owner | Deliverable |
|------|-------|-------------|
| API authentication setup | SIP + Anchorage | OAuth integration |
| Viewing key escrow service | SIP | Hosted service |
| SDK extension for Anchorage | SIP | npm package |
| Sandbox environment | Anchorage | Test credentials |

### 7.2 Phase 2: Core Integration (Week 5-8)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Transaction flow implementation | SIP | Working demo |
| Compliance API integration | Joint | API endpoints |
| Dashboard widget MVP | SIP | React component |
| Test coverage | Joint | 80%+ coverage |

### 7.3 Phase 3: Production (Week 9-12)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Security audit | Third-party | Audit report |
| Performance testing | Joint | Load test results |
| Documentation | SIP | Integration guide |
| Production deployment | Anchorage | Live integration |

### 7.4 Success Criteria

- [ ] Viewing key registration and delegation working
- [ ] Shielded transactions visible in compliance dashboard
- [ ] Audit trail export generating valid reports
- [ ] Security audit passed with no critical findings
- [ ] Performance: <100ms latency for transaction decryption
- [ ] At least 1 pilot client live

---

## 8. Testing Strategy

### 8.1 Test Scenarios

```typescript
describe('Anchorage Integration', () => {
  describe('Viewing Key Management', () => {
    it('should register viewing key with Anchorage', async () => {
      const result = await integration.registerViewingKey({
        accountId: 'acct_123',
        viewingPublicKey: testKey.publicKey,
        delegationScope: { type: 'full' }
      })
      expect(result.status).toBe('registered')
    })

    it('should revoke viewing key access', async () => {
      const result = await integration.revokeViewingKey({
        accountId: 'acct_123',
        keyHash: testKeyHash,
        reason: 'Account closed'
      })
      expect(result.status).toBe('revoked')
    })
  })

  describe('Transaction Processing', () => {
    it('should create shielded transaction with compliance logging', async () => {
      const tx = await integration.createShieldedTransaction({
        accountId: 'acct_123',
        recipient: testRecipient,
        amount: 50000_000000n,
        token: 'USDC',
        privacyLevel: 'compliant'
      })

      expect(tx.status).toBe('completed')
      expect(tx.complianceLogged).toBe(true)
    })

    it('should block transaction to sanctioned address', async () => {
      await expect(
        integration.createShieldedTransaction({
          accountId: 'acct_123',
          recipient: sanctionedAddress,
          amount: 50000_000000n,
          token: 'USDC',
          privacyLevel: 'compliant'
        })
      ).rejects.toThrow('Sanctions screening failed')
    })
  })

  describe('Audit Trail', () => {
    it('should generate valid PDF audit report', async () => {
      const report = await integration.generateComplianceReport({
        accountId: 'acct_123',
        reportType: 'annual_audit',
        period: { start: new Date('2025-01-01'), end: new Date('2025-12-31') }
      })

      expect(report.format).toBe('PDF')
      expect(report.digitalSignature).toBeDefined()
      expect(report.transactionCount).toBeGreaterThan(0)
    })
  })
})
```

---

## 9. API Reference

### 9.1 Endpoints

```
POST   /v1/anchorage/viewing-keys          Register viewing key
DELETE /v1/anchorage/viewing-keys/:hash    Revoke viewing key
POST   /v1/anchorage/transactions          Create shielded transaction
GET    /v1/anchorage/transactions          Get decrypted transactions
POST   /v1/anchorage/reports               Generate audit report
GET    /v1/anchorage/reports/:id           Get report status/download
POST   /v1/anchorage/webhooks              Register webhook
```

### 9.2 Error Codes

| Code | Description |
|------|-------------|
| `ANCH_001` | Invalid Anchorage API key |
| `ANCH_002` | Account not found |
| `ANCH_003` | Viewing key not registered |
| `ANCH_004` | Delegation expired |
| `ANCH_005` | Sanctions screening failed |
| `ANCH_006` | Policy violation |
| `ANCH_007` | Report generation failed |

---

## Appendix A: Anchorage API Documentation Links

- Anchorage API Docs: https://docs.anchorage.com/api
- Compliance API: https://docs.anchorage.com/compliance
- Webhook Reference: https://docs.anchorage.com/webhooks
- SDKs: https://github.com/AnchorageDigital

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
**Contact:** integrations@sip-protocol.org
