# Thread 1: Why Pool Mixing is Broken

**Hook:** Tornado Cash is dead. But the real question: was pool mixing ever the right approach?

---

**1/**
Tornado Cash is dead. But the real question: was pool mixing ever the right approach?

Here's why pool-based privacy was always fundamentally flawed 🧵

**2/**
Pool mixing works like this:

→ Deposit exact amount (0.1, 1, 10 ETH)
→ Wait in anonymous pool
→ Withdraw to new address

Sounds private, right? Wrong.

**3/**
Problem #1: Fixed denominations

You can only deposit fixed amounts. Want to send 0.73 ETH? You can't.

This creates artificial constraints that limit real-world usability.

**4/**
Problem #2: Timing analysis

Researchers tracked 90%+ of Tornado Cash transactions using deposit/withdraw timing.

Even with perfect anonymity set, your behavior is a fingerprint.

**5/**
Problem #3: Amount correlation

Need to send 7 ETH? That's 10 + 1 - 1 - 1 - 1 - 1 = 7

The combination of deposits/withdrawals can be statistically linked.

**6/**
Problem #4: No compliance path

Pool mixing is binary: fully anonymous or fully public.

No way to prove legitimacy to auditors without breaking privacy completely.

**7/**
Problem #5: Regulatory target

Because there's no compliance mechanism, pool mixers become prime targets for sanctions.

See: OFAC sanctions on Tornado Cash (Aug 2022)

**8/**
The fundamental flaw: Pool mixing treats privacy as a destination, not a feature.

You have to "go to" a mixer. It's not built into normal transactions.

**9/**
Better approach: Privacy as middleware

Instead of separate privacy pools, what if every transaction could be private by default?

That's what cryptographic privacy enables.

**10/**
Stealth addresses: Every recipient gets a unique, one-time address.

Pedersen commitments: Amounts are hidden but verifiable.

Viewing keys: Selective disclosure for compliance.

**11/**
With cryptographic privacy:

✓ Any amount (not fixed)
✓ No timing analysis (instant)
✓ No amount correlation (amounts hidden)
✓ Compliance-ready (viewing keys)
✓ Built into transactions (not a separate service)

**12/**
Tornado Cash showed there's massive demand for privacy.

But the architecture was always a band-aid, not a solution.

The future is privacy built into the transaction layer, not bolted on top.

**13/**
Want to see cryptographic privacy in action?

@sipprotocol is building this for Solana and beyond.

Same privacy properties, but compliance-ready and built for real-world use.

docs.sip-protocol.org

---

**Engagement CTA:** "What's stopping you from using privacy in your dApp? Reply below 👇"

**Hashtags:** #Solana #Web3Privacy #DeFi
