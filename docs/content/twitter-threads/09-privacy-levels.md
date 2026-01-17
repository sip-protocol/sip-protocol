# Thread 9: Privacy Levels Explained

**Hook:** One-size-fits-all privacy doesn't exist. Here's how SIP handles different needs.

---

**1/**
One-size-fits-all privacy doesn't exist.

Donations need different privacy than payroll.
Personal transfers need different privacy than DAO treasury.

Here's how SIP handles different needs 🧵

**2/**
Three privacy levels:

🔓 TRANSPARENT: Everything public
🔒 SHIELDED: Everything hidden
📋 COMPLIANT: Hidden + auditable

Each serves different use cases.

**3/**
TRANSPARENT (🔓)

When: Public accountability required
Examples:
- Charity donations (tax receipts)
- Public grant distributions
- Proof of payment to public entities

On-chain: Everything visible, like normal transactions.

**4/**
SHIELDED (🔒)

When: Maximum privacy needed
Examples:
- Personal transfers
- Competitive business payments
- Sensitive purchases

On-chain: Hidden sender, hidden amount, hidden recipient.

**5/**
COMPLIANT (📋)

When: Privacy + audit trail
Examples:
- DAO treasury operations
- Institutional payments
- Business-to-business
- Payroll

On-chain: Hidden, but viewable with key.

**6/**
The key difference:

SHIELDED: No one can ever see (except recipient)
COMPLIANT: You CHOOSE who can see

Compliance isn't surveillance. It's controlled disclosure.

**7/**
How viewing keys work with COMPLIANT:

```typescript
const viewingKey = generateViewingKey()

await sip.createIntent({
  privacy: PrivacyLevel.COMPLIANT,
  viewingKey: viewingKey.publicKey,
})
```

Share `viewingKey.privateKey` with auditors.

**8/**
Role-based access with COMPLIANT:

```typescript
// Full access for treasurer
const treasurerKey = derive({ scope: 'all' })

// Proposals only for members
const memberKey = derive({ scope: 'proposals' })

// Time-limited for auditor
const auditorKey = derive({
  scope: 'full',
  validUntil: Q1_END,
})
```

**9/**
Decision tree:

```
Need public proof? → TRANSPARENT
Need max privacy? → SHIELDED
Need privacy + accountability? → COMPLIANT
```

**10/**
Real examples:

Alice pays Bob for freelance work:
→ SHIELDED (personal transaction)

DAO pays Alice for dev grant:
→ COMPLIANT (governance accountability)

DAO publicly announces grant winner:
→ TRANSPARENT (public record)

**11/**
Mixing levels in one app:

```typescript
// User-facing payments: shielded
userPayment.privacy = PrivacyLevel.SHIELDED

// Treasury payments: compliant
treasuryPayment.privacy = PrivacyLevel.COMPLIANT

// Public announcements: transparent
grantAnnouncement.privacy = PrivacyLevel.TRANSPARENT
```

**12/**
Why not always SHIELDED?

Sometimes you WANT proof of payment.
Sometimes auditors NEED to verify.
Sometimes compliance IS the feature.

Flexibility > dogma.

**13/**
Why not always COMPLIANT?

Viewing keys add complexity.
Not everyone needs audit trails.
Some users want zero disclosure.

Right tool for the job.

**14/**
Summary:

🔓 TRANSPARENT: Public by design
🔒 SHIELDED: Private, period
📋 COMPLIANT: Private, but provable

SIP supports all three. You choose.

docs.sip-protocol.org/privacy-levels

---

**Engagement CTA:** "Which privacy level would you use for your main use case?"

**Hashtags:** #Privacy #DeFi #Web3
