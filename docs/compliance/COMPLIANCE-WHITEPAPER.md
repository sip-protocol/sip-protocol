# SIP Compliance Whitepaper

**Privacy with Accountability: A Regulatory Framework for Shielded Transactions**

**Version:** 1.0.0
**Date:** January 2026
**Authors:** SIP Protocol Team
**Audience:** Regulators, Compliance Officers, Legal Counsel

---

## Executive Summary

The Shielded Intents Protocol (SIP) represents a new paradigm in blockchain privacy: **privacy by default, disclosure by choice**. Unlike mixing services that obscure transactions permanently, SIP provides cryptographic privacy with built-in compliance mechanisms through viewing keys.

**Key Differentiators from Mixing Services:**

| Feature | SIP Protocol | Mixers (e.g., Tornado Cash) |
|---------|--------------|----------------------------|
| Selective disclosure | Yes (viewing keys) | No |
| Regulatory compliance | Built-in | Impossible |
| Audit trail capability | Full | None |
| Sanctions screening | Supported | Circumvented |
| Amount privacy | Any amount | Fixed denominations |
| Identity linkage | Optional (compliance) | Severed permanently |

**Bottom Line:** SIP enables legitimate financial privacy while preserving law enforcement and regulatory access when legally required.

---

## Table of Contents

1. [The Privacy-Compliance Balance](#1-the-privacy-compliance-balance)
2. [How SIP Enables Compliance](#2-how-sip-enables-compliance)
3. [Viewing Keys Explained](#3-viewing-keys-explained)
4. [Audit Trail Capabilities](#4-audit-trail-capabilities)
5. [Regulatory Use Cases](#5-regulatory-use-cases)
6. [Sanctions Screening Integration](#6-sanctions-screening-integration)
7. [Comparison with Prohibited Technologies](#7-comparison-with-prohibited-technologies)
8. [Legal Framework Compatibility](#8-legal-framework-compatibility)
9. [Technical Appendix](#9-technical-appendix)

---

## 1. The Privacy-Compliance Balance

### 1.1 The Problem with Transparent Blockchains

Current blockchain transparency creates legitimate privacy concerns:

- **Personal Financial Exposure**: Anyone can see account balances and transaction history
- **Commercial Disadvantage**: Competitors can monitor business transactions
- **Security Risks**: Wealthy accounts become targets for hackers and criminals
- **GDPR Conflicts**: Permanent public records violate right to be forgotten

### 1.2 The Problem with Total Anonymity

Complete anonymity enables:

- Money laundering
- Sanctions evasion
- Tax evasion
- Terrorist financing

### 1.3 SIP's Solution: Selective Privacy

SIP provides a middle ground:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE PRIVACY-COMPLIANCE SPECTRUM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FULL TRANSPARENCY          SELECTIVE PRIVACY           FULL ANONYMITY     │
│  (Current Blockchains)      (SIP Protocol)              (Mixers)           │
│                                                                             │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐ │
│  │ Everyone sees   │        │ Private by      │        │ No one can      │ │
│  │ everything      │        │ default,        │        │ see anything    │ │
│  │                 │        │ disclosed when  │        │ ever            │ │
│  │ Privacy: None   │        │ required        │        │ Compliance:     │ │
│  │ Compliance: Easy│        │                 │        │ Impossible      │ │
│  └─────────────────┘        │ Privacy: High   │        └─────────────────┘ │
│                             │ Compliance:     │                             │
│         ✗                   │ Preserved       │              ✗              │
│                             └─────────────────┘                             │
│                                    ✓                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. How SIP Enables Compliance

### 2.1 Three Privacy Levels

SIP transactions can operate at three privacy levels:

| Level | Privacy | Compliance | Use Case |
|-------|---------|------------|----------|
| **Transparent** | None | Full visibility | Standard transactions |
| **Shielded** | Full | Via viewing key | Personal privacy |
| **Compliant** | Full + disclosure | Built-in audit | Institutional use |

### 2.2 The Viewing Key Mechanism

Every SIP transaction includes a **viewing key hash** that:

1. Does NOT reveal transaction details publicly
2. Allows the account holder to prove they control disclosure capability
3. Enables authorized parties to request and receive viewing access

```
TRANSACTION VISIBILITY

Without Viewing Key:          With Viewing Key:
┌────────────────────┐        ┌────────────────────┐
│ Sender: [HIDDEN]   │        │ Sender: 0x1234...  │
│ Recipient: [HIDDEN]│   ──▶  │ Recipient: 0x5678..│
│ Amount: [HIDDEN]   │        │ Amount: $50,000    │
│ Time: 2026-01-15   │        │ Time: 2026-01-15   │
└────────────────────┘        └────────────────────┘
   Public View                   Authorized View
```

### 2.3 Compliance Flow

```
STEP 1: Transaction Occurs
┌────────────────────────────────────────────────────────────────┐
│ User sends shielded transaction                                │
│ Viewing key hash: 0xabc123...                                  │
│ Transaction details: encrypted                                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
STEP 2: Regulatory Request (if needed)
┌────────────────────────────────────────────────────────────────┐
│ Regulator identifies viewing key hash in investigation        │
│ Issues legal request for disclosure                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
STEP 3: Authorized Disclosure
┌────────────────────────────────────────────────────────────────┐
│ User provides viewing key to authorized party                 │
│ Viewing key is encrypted to regulator's public key            │
│ Only the specific regulator can decrypt                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
STEP 4: Transaction Revealed
┌────────────────────────────────────────────────────────────────┐
│ Regulator decrypts and views:                                  │
│ - Sender identity                                              │
│ - Recipient identity                                           │
│ - Transaction amount                                           │
│ - Timestamp and metadata                                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Viewing Keys Explained

### 3.1 What Are Viewing Keys?

Viewing keys are cryptographic keys that unlock transaction visibility without granting spending authority.

**Key Properties:**

| Property | Description |
|----------|-------------|
| **Read-only** | Cannot spend funds, only view |
| **Scopable** | Can be limited to time ranges or specific transactions |
| **Revocable** | Time-bounded keys automatically expire |
| **Auditable** | Key usage can be logged |
| **Shareable** | Can be securely shared with multiple parties |

### 3.2 Types of Viewing Keys

| Type | Reveals | Use Case |
|------|---------|----------|
| **Incoming** | Payments received | Tax reporting (income) |
| **Outgoing** | Payments sent | Expense auditing |
| **Full** | All transactions | Complete audit |
| **Time-bounded** | Transactions in date range | Annual tax audit |
| **Transaction-specific** | Single transaction | Legal discovery |

### 3.3 Viewing Key Security

Viewing keys are protected by:

1. **Encryption in transit**: XChaCha20-Poly1305 encryption
2. **Access control**: Only encrypted to authorized party's public key
3. **Expiration**: Time-bounded keys auto-expire
4. **Audit logging**: All key usage is tracked

### 3.4 Legal Comparison

| Concept | Traditional Finance | SIP Protocol |
|---------|---------------------|--------------|
| Account records | Bank maintains, provides on subpoena | User maintains, provides viewing key on legal request |
| Privacy default | Bank sees everything | No one sees by default |
| Disclosure mechanism | Legal process to bank | Legal process to user |
| Third-party access | Bank can comply without user | User must provide key |

---

## 4. Audit Trail Capabilities

### 4.1 What SIP Can Provide to Auditors

With appropriate viewing key access, auditors can obtain:

```
AUDIT REPORT EXAMPLE
═══════════════════════════════════════════════════════════════════

Account: 0x1234...5678
Audit Period: January 1, 2025 - December 31, 2025
Report Generated: January 15, 2026
Viewing Key Hash: 0xabc...123

───────────────────────────────────────────────────────────────────
TRANSACTION SUMMARY
───────────────────────────────────────────────────────────────────

Total Incoming:     $1,234,567.89
Total Outgoing:     $987,654.32
Net Position:       +$246,913.57
Transaction Count:  1,847

───────────────────────────────────────────────────────────────────
TRANSACTION DETAIL
───────────────────────────────────────────────────────────────────

Date        Type    Counterparty      Amount        Balance
2025-01-03  IN      0xaaaa...1111    $50,000.00    $50,000.00
2025-01-05  OUT     0xbbbb...2222    -$15,000.00   $35,000.00
2025-01-12  IN      0xcccc...3333    $100,000.00   $135,000.00
...

───────────────────────────────────────────────────────────────────
VERIFICATION
───────────────────────────────────────────────────────────────────

Cryptographic Proof: All transactions verified against blockchain
Auditor Signature: [Digitally signed by authorized auditor]

═══════════════════════════════════════════════════════════════════
```

### 4.2 Audit Trail Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Completeness** | All transactions in scope are revealed |
| **Authenticity** | Transactions are cryptographically verified |
| **Non-repudiation** | User cannot deny transactions |
| **Integrity** | Data cannot be altered without detection |

### 4.3 Audit Process

```
INSTITUTIONAL AUDIT WORKFLOW

1. SCOPE DEFINITION
   └─▶ Define audit period and transaction types

2. KEY REQUEST
   └─▶ Formal request for time-bounded viewing key

3. KEY PROVISION
   └─▶ User provides encrypted viewing key to auditor

4. DATA EXTRACTION
   └─▶ Auditor scans blockchain with viewing key

5. VERIFICATION
   └─▶ Cross-reference with other records

6. REPORT GENERATION
   └─▶ Produce cryptographically-signed audit report

7. KEY DESTRUCTION
   └─▶ Time-bounded key expires, access ends
```

---

## 5. Regulatory Use Cases

### 5.1 Tax Authority Audits

**Scenario:** Tax authority requests transaction records for annual audit.

**SIP Solution:**
1. Authority identifies taxpayer's viewing key hash from registration
2. Issues legal request for viewing key disclosure
3. Taxpayer provides time-bounded viewing key (Jan 1 - Dec 31)
4. Authority scans blockchain, generates transaction report
5. Key expires after audit period

**Privacy Preserved:** Transactions outside audit period remain private.

### 5.2 AML Investigation

**Scenario:** Law enforcement investigating suspected money laundering.

**SIP Solution:**
1. Investigators identify suspect's transactions via viewing key hash
2. Obtain court order for viewing key disclosure
3. Suspect provides viewing key (or court compels disclosure)
4. Full transaction history revealed to investigators
5. Evidence admissible in court (cryptographically verified)

**Advantage over Mixers:** Transaction history exists and can be revealed.

### 5.3 Sanctions Compliance

**Scenario:** Financial institution must screen transactions against OFAC list.

**SIP Solution:**
1. Institution maintains viewing keys for all customer accounts
2. Real-time or batch screening of transactions
3. Suspicious patterns flagged for review
4. Full audit trail for compliance reporting

**See Section 6 for detailed sanctions screening integration.**

### 5.4 Travel Rule Compliance

**Scenario:** Virtual Asset Service Provider (VASP) must share originator/beneficiary info for transactions over $3,000.

**SIP Solution:**
1. VASP includes Travel Rule payload in encrypted memo
2. Receiving VASP decrypts with viewing key
3. Both VASPs maintain compliance records
4. Regulators can audit via viewing key access

```
TRAVEL RULE PAYLOAD (Encrypted in Transaction)

{
  "originator": {
    "name": "John Smith",
    "account": "0x1234...5678",
    "address": "123 Main St, New York, NY",
    "dateOfBirth": "1985-03-15"
  },
  "beneficiary": {
    "name": "Jane Doe",
    "account": "0xabcd...efgh",
    "vasp": "Example Exchange Inc."
  },
  "amount": "$50,000",
  "purpose": "Investment"
}
```

---

## 6. Sanctions Screening Integration

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SANCTIONS SCREENING INTEGRATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐         ┌───────────────────────────────────┐   │
│  │   SIP Transaction     │         │   Sanctions Screening Service     │   │
│  │   ┌───────────────┐   │         │   ┌───────────────────────────┐   │   │
│  │   │ Viewing Key   │───┼────────▶│   │ OFAC SDN List             │   │   │
│  │   │ Hash          │   │         │   │ EU Sanctions              │   │   │
│  │   └───────────────┘   │         │   │ UN Sanctions              │   │   │
│  │   ┌───────────────┐   │         │   │ Custom Watchlists         │   │   │
│  │   │ Encrypted     │   │         │   └───────────────────────────┘   │   │
│  │   │ Details       │   │         │                │                  │   │
│  │   └───────────────┘   │         │                ▼                  │   │
│  └───────────────────────┘         │   ┌───────────────────────────┐   │   │
│             │                      │   │ SCREEN RESULT              │   │   │
│             │                      │   │ • CLEAR: Proceed           │   │   │
│             ▼                      │   │ • REVIEW: Manual check     │   │   │
│  ┌───────────────────────┐         │   │ • BLOCK: Reject tx         │   │   │
│  │ Compliance Officer    │◀────────│   └───────────────────────────┘   │   │
│  │ Reviews with viewing  │         │                                   │   │
│  │ key if flagged        │         │                                   │   │
│  └───────────────────────┘         └───────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Screening Approaches

**Approach 1: Pre-Transaction Screening (Institutional)**

Institutions screen before transaction execution:

1. User initiates transaction
2. Institution decrypts recipient using viewing key
3. Screen recipient against sanctions lists
4. Approve or reject transaction

**Approach 2: Post-Transaction Monitoring**

Monitor completed transactions:

1. Transaction completes on blockchain
2. Compliance system scans with viewing key
3. Flag suspicious patterns for review
4. Generate compliance reports

**Approach 3: Real-Time Screening API**

```typescript
// Example: Real-time sanctions check
const screeningResult = await sanctionsService.screen({
  viewingKey: institutionViewingKey,
  transaction: sipTransaction,
  lists: ['OFAC_SDN', 'EU_SANCTIONS', 'UN_SANCTIONS']
})

if (screeningResult.status === 'BLOCKED') {
  await rejectTransaction(sipTransaction)
  await fileSTR(sipTransaction, screeningResult)  // Suspicious Transaction Report
}
```

### 6.3 Integration with Existing Systems

SIP integrates with existing compliance infrastructure:

| System | Integration Point |
|--------|-------------------|
| **Chainalysis** | Viewing key → address resolution → risk scoring |
| **Elliptic** | Transaction data export for analysis |
| **TRM Labs** | API integration for real-time screening |
| **ComplyAdvantage** | Watchlist screening with decrypted identities |

---

## 7. Comparison with Prohibited Technologies

### 7.1 Why SIP is NOT Like Tornado Cash

| Aspect | Tornado Cash | SIP Protocol |
|--------|--------------|--------------|
| **Design Goal** | Sever transaction links permanently | Privacy with disclosure option |
| **Regulatory Access** | Impossible | Built-in via viewing keys |
| **Sanctions Compliance** | Cannot comply | Full compliance capability |
| **Audit Trail** | Destroyed | Preserved and accessible |
| **Identity Recovery** | Cannot recover | Always recoverable with key |
| **Legal Status** | OFAC sanctioned | Compliant by design |

### 7.2 Technical Differences

**Tornado Cash Architecture:**
```
Deposit → Fixed Pool → Withdraw
         (Link broken permanently)

NO mechanism to recover link
NO viewing key exists
NO compliance possible
```

**SIP Architecture:**
```
Send → Shielded Transaction → Receive
       (Link encrypted, NOT broken)

Viewing key ALWAYS exists
Link can be revealed when required
Full compliance capability
```

### 7.3 Regulatory Position

SIP's position under OFAC guidance:

1. **Not a mixer**: Does not pool funds or break transaction links
2. **Compliance tools**: Built-in mechanisms for regulatory access
3. **Identity preservation**: Counterparty information always recoverable
4. **Audit capability**: Full transaction history available

**Legal Opinion Summary:** SIP provides privacy technology analogous to encrypted communications (legal) rather than money laundering tools (illegal).

---

## 8. Legal Framework Compatibility

### 8.1 United States

| Regulation | SIP Compatibility |
|------------|-------------------|
| **Bank Secrecy Act** | Viewing keys enable CTR/SAR filing |
| **OFAC Sanctions** | Sanctions screening supported |
| **FinCEN Travel Rule** | Encrypted Travel Rule payloads |
| **SEC Requirements** | Audit trail for securities transactions |

### 8.2 European Union

| Regulation | SIP Compatibility |
|------------|-------------------|
| **GDPR** | Privacy by design, right to be forgotten supported |
| **MiCA** | Full traceability via viewing keys |
| **AMLD5/6** | Customer due diligence supported |
| **Travel Rule (TFR)** | Compliant data sharing |

### 8.3 Asia-Pacific

| Jurisdiction | SIP Compatibility |
|--------------|-------------------|
| **Singapore (MAS)** | Risk-based approach supported |
| **Hong Kong (SFC)** | Licensing requirements compatible |
| **Japan (JFSA)** | Travel Rule compliant |
| **Australia (AUSTRAC)** | AML/CTF reporting supported |

### 8.4 Compliance Certification Path

```
COMPLIANCE CERTIFICATION ROADMAP

Phase 1: Self-Assessment
├── Internal compliance review
├── Legal opinion from qualified counsel
└── Documentation of compliance controls

Phase 2: Third-Party Audit
├── SOC 2 Type II certification
├── Security audit (smart contracts)
└── Compliance framework assessment

Phase 3: Regulatory Engagement
├── FinCEN consultation (US)
├── FCA sandbox application (UK)
└── MAS consultation (Singapore)

Phase 4: Industry Recognition
├── FATF guidance alignment
├── Industry working group participation
└── Standard-setting body engagement
```

---

## 9. Technical Appendix

### 9.1 Cryptographic Foundations

**Viewing Key Derivation:**
```
masterKey = HKDF(seed, "sip-viewing", 32)
incomingKey = HKDF(masterKey, "incoming", 32)
outgoingKey = HKDF(masterKey, "outgoing", 32)
```

**Viewing Key Hash (On-Chain):**
```
viewingKeyHash = SHA256(viewingPublicKey)
```

**Encrypted Viewing Key Sharing:**
```
1. Generate ephemeral key pair
2. ECDH with recipient's public key
3. Derive encryption key via HKDF
4. Encrypt viewing key with XChaCha20-Poly1305
5. Share (ephemeralPubKey, nonce, ciphertext)
```

### 9.2 Viewing Key API

```typescript
// Generate viewing keys
const keys = sip.generateViewingKeys(seed)
// Returns: { incoming, outgoing, full }

// Create time-bounded key
const auditKey = sip.createTimeBoundedKey({
  masterKey: keys.full,
  startTime: new Date('2025-01-01'),
  endTime: new Date('2025-12-31')
})

// Share with auditor
const encryptedKey = sip.shareViewingKey({
  viewingKey: auditKey,
  recipientPublicKey: auditorPublicKey
})

// Auditor decrypts and scans
const transactions = await sip.scanWithViewingKey({
  viewingKey: decryptedKey,
  chains: ['ethereum', 'solana'],
  startBlock: 19000000,
  endBlock: 21000000
})

// Generate audit report
const report = sip.generateAuditReport({
  transactions,
  format: 'PDF',
  includeProofs: true
})
```

### 9.3 Compliance Event Types

```typescript
enum ComplianceEventType {
  VIEWING_KEY_CREATED = 'viewing_key.created',
  VIEWING_KEY_SHARED = 'viewing_key.shared',
  VIEWING_KEY_USED = 'viewing_key.used',
  VIEWING_KEY_EXPIRED = 'viewing_key.expired',
  VIEWING_KEY_REVOKED = 'viewing_key.revoked',
  AUDIT_REPORT_GENERATED = 'audit_report.generated',
  SANCTIONS_CHECK_PERFORMED = 'sanctions.checked',
  SUSPICIOUS_ACTIVITY_FLAGGED = 'suspicious.flagged'
}
```

### 9.4 Compliance Webhook Integration

```typescript
// Configure compliance webhooks
sip.compliance.configureWebhooks({
  endpoint: 'https://compliance.example.com/webhook',
  events: [
    'viewing_key.shared',
    'sanctions.checked',
    'suspicious.flagged'
  ],
  secret: process.env.WEBHOOK_SECRET
})

// Webhook payload example
{
  "event": "viewing_key.shared",
  "timestamp": "2026-01-15T14:30:00Z",
  "data": {
    "keyHash": "0xabc123...",
    "recipientType": "regulator",
    "scope": "time_bounded",
    "validUntil": "2026-12-31T23:59:59Z"
  }
}
```

---

## Conclusion

SIP represents a fundamental advancement in blockchain privacy technology: the ability to have both strong privacy AND regulatory compliance. Through viewing keys, SIP enables:

1. **Privacy by default** for legitimate users
2. **Disclosure when legally required** for compliance
3. **Full audit capability** for institutions
4. **Sanctions screening integration** for VASPs
5. **Cross-border compliance** for global operations

We welcome engagement with regulators, compliance professionals, and legal experts to further develop this framework.

---

## Contact

- **Regulatory Inquiries:** compliance@sip-protocol.org
- **Technical Questions:** dev@sip-protocol.org
- **Documentation:** https://docs.sip-protocol.org/compliance

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
**Next Review:** April 2026
