# Thread 5: Viewing Keys for DAOs

**Hook:** DAO treasuries hold billions. Every move is public. Competitors watch. Front-runners extract value.

---

**1/**
DAO treasuries hold billions.

Every move is public. Competitors watch. Front-runners extract value.

But what if treasury could be private AND auditable?

Viewing keys make this possible 🧵

**2/**
The DAO treasury problem:

MakerDAO moves $100M → everyone sees
Uniswap buys insurance → competitors front-run
Gitcoin grants → recipients tracked

Transparency is good. Forced transparency is not.

**3/**
What DAOs need:

✓ Privacy from public (hide moves from competitors)
✓ Transparency to members (governance accountability)
✓ Compliance for auditors (regulatory requirements)

These seem contradictory. They're not.

**4/**
Enter: Viewing Keys

A viewing key lets someone SEE transactions without being able to SPEND.

Like giving your accountant read-only access to your bank account.

**5/**
How it works:

Master key: DAO multisig holds
↓
Derived keys: Different access levels
- Treasurer: see all transactions
- Council: see proposals + large payments
- Members: see proposal-linked only
- Auditor: time-limited full access

**6/**
On-chain: Transactions are encrypted

With viewing key: Full details visible
- Amount
- Recipient
- Memo
- Timestamp

Without viewing key: Just encrypted data

**7/**
Real scenario:

DAO pays developer $50K USDC

On-chain: encrypted payment
Treasury team: sees $50K to dev
Members: sees "Dev Grant #47 executed"
Public: sees nothing

**8/**
Time-locked viewing keys:

Need to audit Q1 2024?

Issue key that:
- Activates Jan 1
- Expires Mar 31
- Only sees Q1 transactions

Auditor can't see Q2+, can't see Q4 2023.

**9/**
Compliance reports:

```typescript
const reporter = new ComplianceReporter({
  treasury,
  viewingKey: auditorKey,
})

const report = await reporter.generateReport({
  startDate: Q1_START,
  endDate: Q1_END,
})
// Detailed report, only for Q1
```

**10/**
Why this matters for governance:

Members can verify: "Did treasury actually pay what was approved?"

Without seeing: Every other payment, salary info, strategic moves

Accountability without surveillance.

**11/**
Front-running protection:

Large swap planned? Hidden until executed.
Strategic acquisition? Competitors don't see coming.
Payroll batch? Recipients stay private.

**12/**
Implementation in SIP:

```typescript
const treasury = new Treasury({
  multisigSigners: [s1, s2, s3],
  threshold: 2,
  viewingKey: masterKey.publicKey,
})

// Issue member key
const memberKey = keyDerivation.derive({
  role: 'member',
  scope: 'proposals',
})
```

**13/**
The hierarchy:

```
Master Key (multisig)
├── Treasurer (all)
├── Council (proposals + large)
├── Members (proposals only)
└── Auditor (time-limited)
```

Each level sees only what they need.

**14/**
DAOs that should consider this:

- Protocol treasuries ($10M+)
- Grant programs (recipient privacy)
- Payroll DAOs (salary privacy)
- Investment DAOs (strategy privacy)

docs.sip-protocol.org/treasury

---

**Engagement CTA:** "Would your DAO use private treasury with viewing keys? What's the main concern?"

**Hashtags:** #DAOs #DeFi #Governance
