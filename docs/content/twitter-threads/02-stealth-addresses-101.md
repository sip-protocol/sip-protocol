# Thread 2: Stealth Addresses 101

**Hook:** You share your Venmo. Why not your Solana address? Because every payment is public forever.

---

**1/**
You share your Venmo with friends.

Why not your Solana address?

Because every payment you receive is public. Forever. Linked to your identity.

Stealth addresses fix this 🧵

**2/**
The problem:

Share your address once → anyone can see:
- Every payment you've received
- Your total balance
- Who sent you money
- Where you sent money

Your wallet is a public diary.

**3/**
Stealth addresses: a new address for every payment.

Instead of one address for all payments, each sender generates a unique one-time address just for their payment.

**4/**
How it works (simple version):

You share a "meta-address" (like a master key)

Sender uses it to generate a unique address

Only you can spend from that address

No one can link payments together

**5/**
Analogy: Think of it like a P.O. Box that auto-forwards.

You publish one P.O. Box number.

Each letter arrives at a different physical location.

Only you know how to collect them all.

**6/**
The math (simplified):

Your meta-address = spending key + viewing key

Sender generates random "ephemeral key"

Stealth address = your key + hash(their ephemeral key)

Only you can derive the private key.

**7/**
What the sender sees:
→ Your meta-address
→ The stealth address they generated

What the public sees:
→ Payment to random address

What you see:
→ Incoming payment (using viewing key)
→ Ability to spend (using spending key)

**8/**
Why two keys (spending + viewing)?

Spending key: actually move the funds
Viewing key: just see incoming payments

This separation enables auditors to view without spending.

**9/**
Real-world use cases:

💰 Payroll: Employees receive salary privately
🏦 Treasury: DAO payments without front-running
🛒 Commerce: Merchant receipts without exposing revenue
🎁 Donations: Give without publicizing

**10/**
EIP-5564 standardized this for Ethereum.

SIP implements it for Solana (and cross-chain).

Same concept, optimized for each chain's architecture.

**11/**
Code is simple:

```typescript
// Generate your meta-address (once)
const meta = generateStealthMetaAddress()

// Sender generates payment address
const stealth = generateStealthAddress(meta)
// Send to stealth.stealthAddress
```

**12/**
Scanning for payments:

Your viewing key lets you identify incoming payments without exposing your spending key.

```typescript
const payments = await scanForPayments({
  viewingKey: meta.viewingKey,
  spendingPublicKey: meta.spendingKey.publicKey,
})
```

**13/**
The future: Stealth addresses become the default.

Just like HTTPS became default for web browsing.

Every wallet, every payment, every chain.

Privacy as a standard feature, not an option.

**14/**
Want to add stealth addresses to your dApp?

SIP SDK makes it 3 lines of code.

Check out docs.sip-protocol.org for the quick-start guide.

Privacy shouldn't require a PhD.

---

**Engagement CTA:** "If stealth addresses were default, would you share your wallet address more freely? 🤔"

**Hashtags:** #Solana #Web3Privacy #BuildOnSolana
