# ETH Denver 2026 Presentation Materials

**Event:** ETH Denver 2026
**Track:** Privacy / Standards / Developer Tooling
**Duration:** 25 minutes + 5 min Q&A
**Speaker:** [Your Name]

---

## 1. Speaker Proposal (CFP Submission)

### 1.1 Talk Title

**"SIP: The Privacy Standard for Web3 — One Toggle to Shield Them All"**

Alternative titles:
- "Building HTTPS for Web3: The Shielded Intents Protocol"
- "Privacy That Complies: How SIP Makes Private Transactions Auditable"

### 1.2 Abstract (300 words)

Privacy in Web3 is broken. Users must choose between complete transparency (Ethereum, Solana) or total anonymity (Tornado Cash). There's no middle ground — until now.

Introducing SIP (Shielded Intents Protocol), the privacy standard for Web3. Think HTTPS for the blockchain: one toggle to shield sender, amount, and recipient while maintaining regulatory compliance through viewing keys.

In this talk, I'll demonstrate how SIP enables:

**For Users:**
- Private transactions with a single toggle
- Stealth addresses that prevent address linkability
- Hidden amounts using Pedersen commitments
- Optional disclosure for tax compliance via viewing keys

**For Developers:**
- Drop-in SDK (`npm install @sip-protocol/sdk`)
- React hooks for instant integration
- Chain-agnostic design (Ethereum, Solana, NEAR, and more)
- EIP-5564 compatible stealth addresses

**For Compliance Teams:**
- Viewing keys for selective disclosure
- Audit trails without compromising privacy
- Hierarchical key delegation for organizations

I'll show a live demo of integrating SIP into a DEX in under 10 minutes, transforming a public swap into a private one. We'll walk through the cryptography (don't worry, it's visual!), the SDK architecture, and the path to becoming an Ethereum standard (SIP-EIP).

SIP won the Zypherpunk Hackathon ($6,500, #14 of 88 projects, 3 tracks) by solving the "privacy vs compliance" dilemma. With 5,500+ tests and production-ready SDKs, it's ready for prime time.

Whether you're building a wallet, DEX, DAO, or enterprise application, you'll leave with practical knowledge to add privacy to your stack. The future of Web3 is private by default — let's build it together.

### 1.3 Speaker Bio (150 words)

[Your Name] is a senior engineer and the creator of SIP (Shielded Intents Protocol), the privacy standard for Web3. With a background in cryptography and distributed systems, they've spent the past two years building privacy infrastructure that bridges the gap between anonymity and compliance.

SIP won the Zypherpunk Hackathon (Dec 2025, $6,500, ranked #14 of 88, 3 tracks), earning recognition from judges including Zooko Wilcox-O'Hearn (Zcash founder), Anatoly Yakovenko (Solana co-founder), and Balaji Srinivasan.

Previously, [they] contributed to [previous work/projects]. [They] believe privacy is a fundamental right and that the next billion users won't onboard to Web3 until transactions are as private as WhatsApp messages.

When not writing cryptographic code, [they] can be found [hobby/interest].

### 1.4 Talk Format

- **Type:** Technical talk with live demo
- **Level:** Intermediate (assumes basic blockchain knowledge)
- **Track:** Privacy / Standards / Developer Experience
- **Duration:** 25 minutes presentation + 5 minutes Q&A

### 1.5 Key Takeaways

1. Privacy and compliance are not mutually exclusive
2. Stealth addresses + Pedersen commitments + viewing keys = complete solution
3. SIP is ready for production with 5,500+ tests
4. Integrating privacy takes <100 lines of code
5. The path to SIP-EIP standardization

### 1.6 Technical Requirements

- Laptop with HDMI/USB-C output
- Internet connection for live demo
- Backup video recording of demo (in case of connectivity issues)

---

## 2. Presentation Deck Outline

### Slide 1: Title
**SIP: The Privacy Standard for Web3**
*One Toggle to Shield Them All*

[Visual: Lock icon transforming into an open padlock with a key]

### Slide 2: The Problem
**Web3 Privacy is All or Nothing**

| Current State | Result |
|---------------|--------|
| Public chains | Everyone sees everything |
| Mixer protocols | Sanctions, no compliance |
| ZK L2s | Siloed, not composable |

"Users shouldn't have to choose between privacy and compliance."

### Slide 3: Introducing SIP
**SIP = HTTPS for Web3**

```
Before: http://bank.com/transfer?to=alice&amount=1000
After:  https://bank.com/transfer (encrypted)

Before: 0xBob sends 1.5 ETH to 0xAlice (public)
After:  [Hidden] sends [Hidden] to [Stealth Address] (private)
```

### Slide 4: How It Works (Overview)
**Three Privacy Primitives**

1. **Stealth Addresses** → Hide recipient
2. **Pedersen Commitments** → Hide amount
3. **Viewing Keys** → Enable compliance

[Visual: Three pillars supporting a "Privacy" roof]

### Slide 5: Stealth Addresses
**Every Payment, New Address**

```
Meta-Address (public):  sip:ethereum:0x02abc...:0x03def...
                              ↓
Payment 1 →  0x7a8b... (one-time)
Payment 2 →  0x9c2d... (one-time)
Payment 3 →  0x4e1f... (one-time)
```

"Like giving everyone a unique email address that only you can read."

[Visual: Envelope going to different mailboxes, all forwarding to one inbox]

### Slide 6: Stealth Address Math
**EIP-5564 Compatible**

```
Recipient publishes: (P_spend, P_view)
Sender generates:    r (random)
Stealth address:     S = P_spend + H(r·P_view) · G
Ephemeral key:       R = r · G (published)

Only recipient can derive private key for S
```

[Visual: Elliptic curve with points labeled]

### Slide 7: Pedersen Commitments
**Hide the Amount, Prove the Math**

```
Commitment: C = amount × G + blinding × H

Properties:
✓ Hiding: Can't extract amount from C
✓ Binding: Can't change amount after commit
✓ Homomorphic: C(a) + C(b) = C(a+b)
```

"I can prove my balance covers the transfer without revealing either."

### Slide 8: Commitment Visual
**Zero-Knowledge Balance Proof**

```
Alice has: C(100) = 100·G + r₁·H
Alice sends: C(30) = 30·G + r₂·H
Alice keeps: C(70) = 70·G + r₃·H

Verifier checks: C(100) = C(30) + C(70) ✓
Verifier learns: Nothing about actual amounts
```

[Visual: Balance scale with question marks]

### Slide 9: Viewing Keys
**Privacy + Compliance**

| Key Type | Can See | Use Case |
|----------|---------|----------|
| Incoming | Deposits to me | Tax reporting |
| Outgoing | My withdrawals | Expense tracking |
| Full | Everything | Full audit |

"Like giving your accountant read-only access to one folder."

### Slide 10: Viewing Key Architecture
**Hierarchical Delegation**

```
Master Key (Organization)
    ├── Finance Team (Full)
    ├── Tax Authority (Incoming, 2024)
    └── External Auditor (Full, Q4 2024)
```

[Visual: Tree structure with lock icons]

### Slide 11: The Complete Picture
**Privacy Levels**

| Level | Sender | Amount | Recipient | Auditable |
|-------|--------|--------|-----------|-----------|
| Transparent | Public | Public | Public | Yes |
| Shielded | Hidden | Hidden | Hidden | No |
| **Compliant** | Hidden | Hidden | Hidden | **Yes** |

"Compliant mode: Private to the public, visible to authorized parties."

### Slide 12: Live Demo Introduction
**Let's Build a Private Swap**

What we'll do:
1. Install SIP SDK
2. Add privacy toggle to existing DEX
3. Execute private swap
4. Verify with viewing key

[Visual: Code editor screenshot]

### Slide 13: Demo Step 1 - Install
**30 Seconds to Privacy**

```bash
npm install @sip-protocol/sdk @sip-protocol/react
```

```typescript
import { SIPProvider } from '@sip-protocol/react'

function App() {
  return (
    <SIPProvider network="mainnet">
      <YourDEX />
    </SIPProvider>
  )
}
```

### Slide 14: Demo Step 2 - Add Privacy Toggle
**One Component**

```tsx
import { PrivacyToggle, useSIP } from '@sip-protocol/react'

function SwapForm() {
  const { privacyLevel, setPrivacyLevel } = useSIP()

  return (
    <>
      <PrivacyToggle
        value={privacyLevel}
        onChange={setPrivacyLevel}
      />
      {/* Your existing swap form */}
    </>
  )
}
```

### Slide 15: Demo Step 3 - Execute Private Swap
**Same API, Private Execution**

```typescript
const { execute } = useSIP()

const handleSwap = async () => {
  const result = await execute({
    input: { token: 'SOL', amount: 1_000_000_000n },
    output: { token: 'USDC', recipient: recipientMetaAddress },
    // Privacy level from toggle
  })
}
```

### Slide 16: Demo Step 4 - Verify with Viewing Key
**Auditor Experience**

```typescript
import { decryptWithViewing } from '@sip-protocol/sdk'

// Auditor decrypts transaction details
const txData = decryptWithViewing(
  encryptedMetadata,
  auditorViewingKey
)

console.log(txData)
// { amount: "1000000000", sender: "...", recipient: "..." }
```

### Slide 17: Demo Results
**Before & After**

| Aspect | Before SIP | After SIP |
|--------|------------|-----------|
| On-chain visibility | Everything public | Commitments only |
| Recipient linkability | Easy to track | Stealth addresses |
| Compliance | Full exposure | Viewing keys |
| Code changes | N/A | ~50 lines |

### Slide 18: Architecture
**Chain-Agnostic Design**

```
┌─────────────────────────────────────┐
│  Your Application                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  SIP Protocol (Privacy Layer)       │
│  • Stealth Addresses                │
│  • Pedersen Commitments             │
│  • Viewing Keys                     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Any Chain / Settlement             │
│  Ethereum │ Solana │ NEAR │ L2s    │
└─────────────────────────────────────┘
```

### Slide 19: SDK Packages
**Production-Ready**

| Package | Purpose | Tests |
|---------|---------|-------|
| `@sip-protocol/sdk` | Core cryptography | 5,076 |
| `@sip-protocol/react` | React hooks & components | 291 |
| `@sip-protocol/cli` | Command-line tool | 45 |
| `@sip-protocol/api` | REST API server | 162 |

**Total: 5,584+ tests**

### Slide 20: Security
**Battle-Tested Cryptography**

- **Curves:** secp256k1, ed25519 (chain-specific)
- **Libraries:** @noble/curves, @noble/hashes (audited)
- **Encryption:** XChaCha20-Poly1305 (viewing keys)
- **Standards:** EIP-5564, ERC-6538 compatible

"No novel cryptography. Proven primitives, new composition."

### Slide 21: Use Cases
**Who's Using SIP?**

| Use Case | Privacy Benefit |
|----------|-----------------|
| **DEXs** | Trade without front-running |
| **Wallets** | Receive without address tracking |
| **DAOs** | Anonymous voting, hidden treasury |
| **Payroll** | Private salary payments |
| **Bridges** | Cross-chain without trail |

### Slide 22: Business Case
**Why Adopt SIP?**

**For Users:**
- Privacy as a feature, not friction
- Compliance when needed

**For Builders:**
- Differentiation in crowded market
- Ready-made SDK

**For Enterprises:**
- Meet compliance requirements
- Protect business intelligence

### Slide 23: Traction
**Momentum**

- 🏆 **Zypherpunk Hackathon Winner** ($6,500, #14/88, 3 tracks)
- 📦 **5,584+ tests** across 5 packages
- 🌐 **Multi-chain** (Ethereum, Solana, NEAR, 15+ chains)
- 📄 **SIP-EIP Draft** in preparation
- 🤝 **Wallet partnerships** in progress

### Slide 24: Roadmap to Standard
**Path to SIP-EIP**

```
Q1 2026: Draft specification complete ✓
Q2 2026: Reference implementations (TS, Rust) ✓
Q3 2026: EIP submission & review
Q4 2026: Ecosystem adoption
2027:    EIP finalization
```

### Slide 25: Call to Action
**Join the Movement**

**Builders:**
```bash
npm install @sip-protocol/sdk
```

**Standards Contributors:**
- Review SIP-EIP draft
- Join working group

**Everyone:**
- Star on GitHub: github.com/sip-protocol
- Follow: @sip_protocol

### Slide 26: Q&A
**Questions?**

[Contact info]
- GitHub: github.com/sip-protocol
- Docs: docs.sip-protocol.org
- Twitter: @sip_protocol

[QR code to sip-protocol.org]

---

## 3. Live Demo Script

### 3.1 Setup (Before Talk)

```bash
# Pre-configured demo environment
cd ~/demo/sip-dex-example
npm install
npm run dev
# Browser open to localhost:3000
```

### 3.2 Demo Flow (5 minutes)

**Step 1: Show existing DEX (30s)**
- "Here's a standard DEX swap interface"
- Point out public transaction flow
- "Every swap is visible on-chain"

**Step 2: Install SIP (30s)**
```bash
npm install @sip-protocol/sdk @sip-protocol/react
```
- "One command to add privacy"

**Step 3: Add SIPProvider (1m)**
- Open `_app.tsx`
- Wrap app with `SIPProvider`
- "This initializes the privacy layer"

**Step 4: Add Privacy Toggle (1m)**
- Open swap component
- Import `PrivacyToggle`
- Add to form
- "Users can now choose their privacy level"

**Step 5: Execute Private Swap (1m)**
- Enter swap details
- Toggle to "Shielded"
- Execute swap
- Show transaction on explorer
- "Notice: no amount, no recipient visible"

**Step 6: Verify with Viewing Key (1m)**
- Switch to "auditor" view
- Enter viewing key
- Show decrypted transaction
- "Compliance teams see full details"

### 3.3 Backup Video

Record the demo in advance (1080p, 60fps) as backup.
Store at: `demo/backup-recording.mp4`

---

## 4. Q&A Preparation

### 4.1 Technical Questions

**Q: How does SIP compare to Tornado Cash?**
A: Tornado Cash uses fixed-amount pools and mixing. SIP uses cryptographic commitments — any amount, no mixing required, and viewing keys for compliance. Tornado was sanctioned because it couldn't provide compliance. SIP solves this with viewing keys.

**Q: What about front-running if amounts are hidden?**
A: Great question! Hidden amounts actually prevent front-running better than public orders. Solvers see commitments, not values. They can verify the commitment is valid without knowing the amount, making sandwich attacks impossible.

**Q: How do stealth addresses scale?**
A: Each payment creates one new address, but scanning is O(n) where n is announcements. We use bloom filters and batched scanning. For high-volume use cases, we support scanning services that do the work off-chain.

**Q: What happens if I lose my viewing key?**
A: Viewing keys are derived from your spending key using HKDF. As long as you have your seed phrase, you can regenerate viewing keys. We recommend backing up master viewing keys separately for audit continuity.

**Q: Is the cryptography audited?**
A: We use audited libraries (@noble/curves, @noble/hashes) and standard primitives (secp256k1, XChaCha20-Poly1305). The composition is novel but follows established patterns from Zcash and Monero. Full audit planned for Q2 2026.

**Q: How does compliance actually work?**
A: Organizations generate a master viewing key and derive scoped keys for auditors. Each auditor gets a key with specific permissions (incoming only, specific time range, etc.). The key hash is registered on-chain, but the key itself is transmitted securely off-band.

### 4.2 Business Questions

**Q: Who pays for the privacy?**
A: Privacy adds minimal overhead. Commitments are 33 bytes vs 32 bytes for raw amounts. Stealth addresses are standard addresses. The main cost is the one-time computation for key derivation, which is client-side.

**Q: Why would regulators accept this?**
A: Viewing keys provide the same audit capability as current systems, just with user consent. It's like encrypted messaging with lawful intercept capability. We're working with compliance experts to ensure SIP meets regulatory requirements.

**Q: What's your business model?**
A: SIP is open source and free to use. Revenue comes from: (1) Enterprise support contracts, (2) Hosted compliance infrastructure, (3) Protocol integrations. The goal is adoption first, monetization second.

### 4.3 Skeptical Questions

**Q: Why hasn't this been done before?**
A: Pieces exist (stealth addresses in EIP-5564, commitments in Zcash) but weren't composed into a developer-friendly standard. We're standing on the shoulders of giants — our innovation is the packaging and compliance layer.

**Q: What about quantum computing?**
A: Current cryptography (secp256k1) is quantum-vulnerable long-term. We've designed for pluggable curves and have a spec for quantum-resistant alternatives using lattice-based schemes. Migration path is documented.

**Q: Can't governments just ban this?**
A: SIP with viewing keys is more compliant than cash. You can't audit $100 bills. With SIP, authorized parties can see everything. We believe this makes SIP more regulatorily defensible than current public blockchains.

---

## 5. Leave-Behind Materials

### 5.1 One-Pager (Print Ready)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   [SIP LOGO]    SIP: The Privacy Standard for Web3         │
│                                                            │
│   ─────────────────────────────────────────────────────    │
│                                                            │
│   THE PROBLEM                                              │
│   Web3 transactions are public by default. Users face a   │
│   choice between full transparency or non-compliant        │
│   anonymity. Neither works for mainstream adoption.        │
│                                                            │
│   THE SOLUTION                                             │
│   SIP adds privacy to any blockchain with three proven     │
│   primitives:                                              │
│                                                            │
│   🔒 Stealth Addresses — Hide recipient identity           │
│   🔢 Pedersen Commitments — Hide transaction amounts       │
│   🔑 Viewing Keys — Enable selective compliance            │
│                                                            │
│   ─────────────────────────────────────────────────────    │
│                                                            │
│   FOR DEVELOPERS                    FOR ENTERPRISES        │
│   npm install @sip-protocol/sdk    Viewing keys for audit  │
│   50 lines to integrate            Meet compliance needs   │
│   5,584+ tests                     Protect business intel  │
│   Multi-chain support              Hierarchical access     │
│                                                            │
│   ─────────────────────────────────────────────────────    │
│                                                            │
│   🏆 Zypherpunk Hackathon Winner ($6,500, 3 tracks)        │
│   📊 5,584+ Tests | 15+ Chains | Production Ready          │
│                                                            │
│   [QR CODE]                                                │
│   sip-protocol.org                                         │
│   github.com/sip-protocol                                  │
│   @sip_protocol                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Sticker Designs

**Design 1: Logo Sticker**
- SIP logo
- "Privacy Standard for Web3"
- 2" x 2" die-cut

**Design 2: Code Sticker**
- `npm install @sip-protocol/sdk`
- "Add privacy in 50 lines"
- 3" x 1" rectangle

**Design 3: Statement Sticker**
- "I 🔒 my transactions"
- sip-protocol.org
- 2" x 2" circle

### 5.3 Business Card

```
┌────────────────────────────────────────┐
│                                        │
│  [Your Name]                           │
│  Creator, SIP Protocol                 │
│                                        │
│  📧 [email]                            │
│  🐦 @[twitter]                         │
│  💻 github.com/sip-protocol            │
│                                        │
│  ───────────────────────────────────   │
│                                        │
│  "Privacy that complies"               │
│                                        │
│  [QR to sip-protocol.org]              │
│                                        │
└────────────────────────────────────────┘
```

---

## 6. Conference Networking Strategy

### 6.1 Target Contacts

| Category | Targets | Goal |
|----------|---------|------|
| Wallets | MetaMask, Phantom, Rainbow | Integration partnership |
| DEXs | Jupiter, Uniswap, dYdX | Feature adoption |
| L2s | Arbitrum, Optimism, Base | Native support |
| Compliance | Chainalysis, TRM | Technical collaboration |
| Standards | EIP editors, ERC authors | SIP-EIP review |

### 6.2 Elevator Pitch (30 seconds)

"I'm building SIP, the privacy standard for Web3. Think HTTPS for blockchain — one toggle to hide sender, amount, and recipient while staying compliant via viewing keys. We won Zypherpunk, have 5,500+ tests, and are preparing an EIP. Would love to chat about [wallet/DEX/L2] integration."

### 6.3 Follow-Up Template

```
Subject: SIP Privacy Integration — Following up from ETH Denver

Hi [Name],

Great meeting you at ETH Denver! As discussed, SIP can add privacy
to [their product] with minimal integration effort.

Quick recap:
- Stealth addresses for recipient privacy
- Hidden amounts via Pedersen commitments
- Viewing keys for your compliance needs

Next steps I'd suggest:
1. Quick 30-min technical call to assess fit
2. Share integration guide (attached)
3. Pilot on testnet

Would [date/time] work for a call?

Best,
[Your name]

P.S. Here's the integration guide: [link]
```

---

## 7. Presentation Checklist

### 7.1 Before Conference

- [ ] Submit CFP by deadline
- [ ] Book travel and accommodation
- [ ] Print one-pagers (100 copies)
- [ ] Order stickers (500 pieces)
- [ ] Print business cards (200)
- [ ] Test demo on backup laptop
- [ ] Record backup demo video
- [ ] Practice presentation (3x minimum)

### 7.2 Day Before

- [ ] Charge all devices
- [ ] Download demo dependencies offline
- [ ] Test projector connection
- [ ] Review Q&A responses
- [ ] Prepare water bottle
- [ ] Set phone to silent

### 7.3 Presentation Day

- [ ] Arrive 30 min early
- [ ] Test A/V setup
- [ ] Place leave-behinds on chairs (if allowed)
- [ ] Deep breath, you've got this

### 7.4 After Presentation

- [ ] Collect business cards
- [ ] Send follow-up emails within 24 hours
- [ ] Post slides to Twitter/LinkedIn
- [ ] Share recording when available
- [ ] Document learnings for next time

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial presentation materials |

---

*Prepared for ETH Denver 2026. Adapt for other conferences as needed.*
