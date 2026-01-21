# Announcing SIP-EIP: The Privacy Standard for Web3

**Published:** January 2026
**Author:** SIP Protocol Team
**Reading Time:** 12 minutes

---

## TL;DR

Today we're announcing **SIP-EIP**, a proposed Ethereum Improvement Proposal that establishes a universal privacy standard for Web3. SIP enables any blockchain application to add privacy with a single toggle — hiding sender, amount, and recipient — while maintaining compliance through viewing keys.

**Key highlights:**
- 🔒 **Complete privacy**: Stealth addresses + Pedersen commitments + viewing keys
- ⚖️ **Compliance-ready**: Selective disclosure for auditors and regulators
- 🔗 **Chain-agnostic**: Works on Ethereum, Solana, NEAR, and 15+ chains
- 📦 **Production-ready**: 5,584+ tests, TypeScript SDK, React hooks
- 🏆 **Battle-tested**: Zypherpunk Hackathon winner ($6,500, 3 tracks)

[Read the full SIP-EIP specification →](#)

---

## The Problem: Privacy in Web3 is Broken

Let's be honest: blockchain privacy is a mess.

On one side, you have **complete transparency**. Every transaction on Ethereum, Solana, and most major chains is permanently visible. Your salary payments, your medical expenses, your political donations — all public. Forever.

On the other side, you have **total anonymity**. Protocols like Tornado Cash offer privacy but at a cost: they're non-compliant, have been sanctioned, and offer no way to prove legitimacy when needed.

```
THE CURRENT LANDSCAPE

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Full Transparency          │         Total Anonymity     │
│   (Ethereum, Solana)         │         (Tornado Cash)      │
│                              │                             │
│   ✓ Compliant                │         ✗ Sanctioned        │
│   ✗ No privacy               │         ✓ Full privacy      │
│   ✗ Front-running            │         ✗ No compliance     │
│   ✗ Address tracking         │         ✗ Fixed amounts     │
│                              │                             │
└─────────────────────────────────────────────────────────────┘

                    WHERE'S THE MIDDLE GROUND?
```

Users shouldn't have to choose between privacy and compliance. Businesses shouldn't have to expose their operations to competitors. DAOs shouldn't have to reveal their treasury to the world.

**We need a standard that provides privacy AND compliance.**

---

## Introducing SIP-EIP: Privacy That Complies

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3. Think of it as **HTTPS for blockchain** — a protocol that makes transactions private by default while enabling authorized access when needed.

### The HTTPS Analogy

Remember when the web was all HTTP? Every page request, every form submission, every password — sent in plain text. Anyone could intercept it.

Then HTTPS became the standard. Now, your data is encrypted in transit, but your bank can still see your transactions, and law enforcement can still get a warrant.

**SIP does the same for blockchain:**

```
HTTP  → HTTPS                    Public Chain → SIP
─────────────────                ─────────────────────────
Plaintext data                   Public transactions
Anyone can read                  Anyone can see
No encryption                    No privacy

       ↓                                ↓

Encrypted in transit             Hidden sender/amount/recipient
Only endpoints can read          Only authorized viewers can see
Still auditable with warrant     Still auditable with viewing key
```

### Three Privacy Primitives

SIP combines three proven cryptographic techniques:

#### 1. Stealth Addresses (Hide the Recipient)

Every payment goes to a fresh, one-time address. No one can link multiple payments to the same person.

```
Traditional:
  Payment 1 → 0xAlice
  Payment 2 → 0xAlice    ← Same address, linkable!
  Payment 3 → 0xAlice

With SIP:
  Payment 1 → 0x7a8b...  ← Unique stealth address
  Payment 2 → 0x9c2d...  ← Different address
  Payment 3 → 0x4e1f...  ← No linkability

Only Alice can spend from all three.
```

**How it works:** Alice publishes a "meta-address" (two public keys). When Bob sends a payment, he generates a random key and derives a unique stealth address. Only Alice can compute the private key for this address using her secret keys.

#### 2. Pedersen Commitments (Hide the Amount)

The transaction amount is replaced with a cryptographic commitment. It proves the math is correct without revealing the actual value.

```
Commitment: C = amount × G + blinding × H

Properties:
✓ HIDING: Can't extract 'amount' from C
✓ BINDING: Can't change 'amount' after committing
✓ HOMOMORPHIC: C(a) + C(b) = C(a+b)
```

**Example:** Alice has 100 tokens (committed). She sends 30 to Bob. The network verifies that C(100) = C(30) + C(70) without knowing the actual amounts.

#### 3. Viewing Keys (Enable Compliance)

Viewing keys provide selective disclosure. The owner can generate keys that reveal specific information to specific parties.

```
VIEWING KEY TYPES

┌────────────────┬─────────────────────┬────────────────────┐
│ Key Type       │ Can See             │ Use Case           │
├────────────────┼─────────────────────┼────────────────────┤
│ Incoming       │ Deposits to me      │ Tax reporting      │
│ Outgoing       │ My withdrawals      │ Expense tracking   │
│ Full           │ Everything          │ Full audit         │
└────────────────┴─────────────────────┴────────────────────┘
```

**Example:** A company gives its tax authority an "incoming" viewing key for 2025. The authority can see all deposits that year, but not outgoing transactions or other years.

---

## Why Standards Matter

You might ask: "Why make this a standard? Why not just a product?"

### The Problem with Proprietary Privacy

Every protocol has tried to solve privacy their own way:
- Zcash: Shielded pools (Zcash-only)
- Monero: Ring signatures (Monero-only)
- Tornado Cash: Mixer pools (Ethereum-only, sanctioned)
- Secret Network: Encrypted contracts (Secret-only)

**Result:** Privacy is fragmented. Users are stuck in silos. Wallets have to implement different solutions for each chain.

### The Power of Standards

Standards change everything:
- **ERC-20** made tokens interoperable across all Ethereum apps
- **ERC-721** made NFTs work in every marketplace
- **WalletConnect** made wallets work with every dApp

**SIP-EIP aims to do the same for privacy:**

```
WITHOUT STANDARD              WITH SIP-EIP STANDARD
───────────────────           ────────────────────────────
Zcash privacy                 Universal privacy
Monero privacy         →      One implementation
Tornado privacy               Works everywhere
Secret privacy                Wallet support built-in
```

### What SIP-EIP Standardizes

The SIP-EIP specification defines:

1. **Stealth Meta-Address Format**
   ```
   sip:<chain>:<spending_public_key>:<viewing_public_key>
   ```

2. **Commitment Format**
   - Curve parameters (secp256k1)
   - Generator point H derivation
   - Serialization format

3. **Viewing Key Derivation**
   - HKDF-based derivation
   - Key type encoding
   - Hash computation

4. **Privacy Levels**
   - `transparent`: No privacy
   - `shielded`: Full privacy
   - `compliant`: Privacy + viewing keys

5. **Error Codes**
   - Standardized error responses
   - Cross-implementation compatibility

---

## Technical Deep Dive

For developers who want to understand the internals.

### Stealth Address Generation

```
SENDER (Bob sending to Alice):

1. Parse Alice's meta-address: (P_spend, P_view)
2. Generate random scalar: r
3. Compute shared secret: S = r × P_view
4. Derive stealth address:
   stealth_pub = P_spend + H(S || P_spend) × G
5. Publish ephemeral key: R = r × G

RECIPIENT (Alice scanning):

1. For each announcement (stealth_addr, R):
2. Compute shared secret: S = v_priv × R
3. Derive expected address:
   expected = P_spend + H(S || P_spend) × G
4. If expected == stealth_addr:
   This payment is mine!
   priv_key = s_priv + H(S || P_spend)
```

### Pedersen Commitment Scheme

```
PARAMETERS:
- Curve: secp256k1
- G: Standard generator point
- H: SHA256("SIP-PEDERSEN-GENERATOR-H-v1") → point

COMMITMENT:
C(v, r) = v × G + r × H

Where:
- v = value (hidden)
- r = blinding factor (random)
- C = commitment point (33 bytes compressed)

VERIFICATION:
Given C, v, r:
Verify: C == v × G + r × H

HOMOMORPHIC ADDITION:
C(a, r₁) + C(b, r₂) = C(a+b, r₁+r₂)
```

### Viewing Key Encryption

```
ALGORITHM: XChaCha20-Poly1305

ENCRYPTION:
1. Generate nonce (24 bytes)
2. Derive symmetric key from viewing public key (ECDH)
3. Encrypt plaintext with XChaCha20-Poly1305
4. Output: nonce || ciphertext || tag

DECRYPTION:
1. Parse nonce, ciphertext, tag
2. Derive symmetric key from viewing private key
3. Decrypt and verify tag
4. Output: plaintext
```

---

## For Developers: Getting Started

### Installation

```bash
npm install @sip-protocol/sdk
```

### Basic Usage

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  createCommitment,
  PrivacyLevel,
} from '@sip-protocol/sdk'

// Generate receivable address
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('ethereum')

// Create private payment
const { stealthAddress, ephemeralPublicKey } =
  generateStealthAddress(metaAddress)

// Hide amount
const commitment = createCommitment(1000000000n) // 1 ETH in wei
```

### React Integration

```tsx
import { SIPProvider, PrivacyToggle, useSIP } from '@sip-protocol/react'

function App() {
  return (
    <SIPProvider network="mainnet">
      <SwapForm />
    </SIPProvider>
  )
}

function SwapForm() {
  const { privacyLevel, setPrivacyLevel, execute } = useSIP()

  return (
    <>
      <PrivacyToggle value={privacyLevel} onChange={setPrivacyLevel} />
      <button onClick={() => execute(swapParams)}>
        Swap {privacyLevel === 'shielded' ? 'Privately' : 'Publicly'}
      </button>
    </>
  )
}
```

### SDK Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `@sip-protocol/sdk` | Core cryptography | `npm i @sip-protocol/sdk` |
| `@sip-protocol/react` | React hooks | `npm i @sip-protocol/react` |
| `@sip-protocol/cli` | Command line | `npm i -g @sip-protocol/cli` |
| `@sip-protocol/api` | REST server | `npm i @sip-protocol/api` |

---

## What Makes SIP Different

### vs. Tornado Cash (Pool Mixing)

| Aspect | Tornado Cash | SIP |
|--------|--------------|-----|
| Technique | Pool mixing | Cryptographic |
| Amounts | Fixed (0.1, 1, 10 ETH) | Any amount |
| Compliance | None | Viewing keys |
| Linkability | Statistical attacks | Cryptographically unlinkable |
| Regulatory status | Sanctioned | Compliance-ready |

### vs. Zcash (Shielded Pools)

| Aspect | Zcash | SIP |
|--------|-------|-----|
| Chains | Zcash only | Any chain |
| Integration | Full node | SDK/API |
| Compliance | Limited | Full viewing key support |
| Adoption | Requires Zcash | Works with existing infra |

### vs. Secret Network (Encrypted Contracts)

| Aspect | Secret Network | SIP |
|--------|----------------|-----|
| Architecture | New L1 | Middleware |
| Migration | Move everything | Add to existing |
| Composability | Secret ecosystem | Any chain |
| Complexity | TEE dependency | Pure cryptography |

---

## The Road to Standardization

### Timeline

```
2025 Q4: ✅ Core development complete
         ✅ Zypherpunk Hackathon win
         ✅ 5,584+ tests

2026 Q1: ✅ SIP-EIP draft specification
         ✅ Reference implementations (TypeScript, Rust)
         🔄 Working group formation

2026 Q2: → EIP submission
         → EIP editor review
         → Community feedback period

2026 Q3: → Address feedback
         → Security audit
         → Wallet integration pilots

2026 Q4: → EIP Last Call
         → Ecosystem adoption
         → Conference presentations

2027:    → EIP Final status
         → Industry standard
```

### Working Group

We're forming a working group to guide SIP-EIP through standardization:

**Current Members:**
- SIP Protocol core team
- Privacy researchers
- Wallet developers
- Compliance experts

**Seeking:**
- EIP editors and authors
- Major wallet representatives
- Enterprise compliance teams
- Academic cryptographers

[Join the working group →](#)

---

## Get Involved

### For Developers

1. **Try the SDK**
   ```bash
   npm install @sip-protocol/sdk
   ```

2. **Read the spec**
   [SIP-EIP Specification](https://docs.sip-protocol.org/specs/sip-eip)

3. **Run test vectors**
   [Compliance Test Suite](https://github.com/sip-protocol/sip-protocol/tree/main/tests/spec-compliance)

### For Wallet Teams

We're seeking integration partners:

- **MetaMask**: Native stealth address support
- **Phantom**: Solana stealth addresses
- **Rainbow**: Privacy-first mobile experience
- **Hardware wallets**: Ledger, Trezor integration

[Contact us about integration →](#)

### For Researchers

Review our cryptographic approach:

- [Stealth Address Security Analysis](#)
- [Commitment Scheme Proof](#)
- [Viewing Key Protocol](#)

### For Everyone

- ⭐ Star on GitHub: [github.com/sip-protocol](https://github.com/sip-protocol)
- 🐦 Follow updates: [@sip_protocol](https://twitter.com/sip_protocol)
- 💬 Join Discord: [discord.gg/sip-protocol](https://discord.gg/sip-protocol)

---

## FAQ

### Is SIP legal?

Yes. SIP with viewing keys is more compliant than cash transactions. Authorized parties (auditors, regulators) can access full transaction details with appropriate viewing keys. This is similar to how banks operate — private by default, auditable when required.

### What about quantum computing?

Current cryptography (secp256k1) is quantum-vulnerable long-term. We've designed SIP for pluggable curves and have a specification for quantum-resistant alternatives using lattice-based schemes. Migration path is documented.

### How does this affect gas costs?

Minimal overhead. Pedersen commitments are 33 bytes (vs 32 for raw amounts). Stealth addresses are standard addresses. The main cost is client-side computation for key derivation.

### Can I use SIP without viewing keys?

Yes. `PrivacyLevel.SHIELDED` provides full privacy without viewing keys. Compliance features are optional.

### Which chains are supported?

Currently: Ethereum, Solana, NEAR, Arbitrum, Optimism, Polygon, Base, BSC, Avalanche, and more. Any chain with elliptic curve cryptography support can implement SIP.

---

## Conclusion

Privacy is a fundamental right. The next billion users won't onboard to Web3 until transactions are as private as WhatsApp messages.

**SIP-EIP makes this possible:**

- **For users**: One toggle to shield your transactions
- **For developers**: 50 lines to add privacy to any app
- **For enterprises**: Compliance without exposure
- **For the ecosystem**: A universal standard that works everywhere

The future of Web3 is private by default. Let's build it together.

---

**Links:**
- 📄 [SIP-EIP Specification](https://docs.sip-protocol.org/specs/sip-eip)
- 💻 [GitHub Repository](https://github.com/sip-protocol/sip-protocol)
- 📚 [Documentation](https://docs.sip-protocol.org)
- 🐦 [Twitter](https://twitter.com/sip_protocol)
- 💬 [Discord](https://discord.gg/sip-protocol)

---

## Social Media Thread

### Twitter/X Thread (15 tweets)

**1/15**
🚀 Announcing SIP-EIP: The Privacy Standard for Web3

Today we're proposing an Ethereum Improvement Proposal that makes privacy as easy as HTTPS.

One toggle. Any chain. Fully compliant.

Here's everything you need to know 🧵

**2/15**
The problem: Web3 privacy is all-or-nothing.

Public chains = everyone sees everything
Mixers = sanctioned, no compliance

Users shouldn't have to choose between privacy and following the rules.

**3/15**
SIP = Shielded Intents Protocol

Think HTTPS for blockchain:
- Data encrypted in transit → Tx details hidden
- Endpoints can read → Authorized viewers can see
- Auditable with warrant → Auditable with viewing key

**4/15**
Three privacy primitives:

🔒 Stealth Addresses → Hide recipient
🔢 Pedersen Commitments → Hide amount
🔑 Viewing Keys → Enable compliance

Combined = complete privacy + full compliance

**5/15**
Stealth Addresses explained:

Every payment goes to a unique, one-time address.

Payment 1 → 0x7a8b...
Payment 2 → 0x9c2d...
Payment 3 → 0x4e1f...

No one can link them. Only the recipient can spend.

**6/15**
Pedersen Commitments explained:

Instead of "Send 100 USDC", you send:
"Send C where C proves I have enough"

The network verifies math without seeing amounts.
Zero-knowledge balance proofs.

**7/15**
Viewing Keys explained:

Create keys that reveal specific info:
- Incoming only (for taxes)
- Outgoing only (for expenses)
- Full access (for audits)

Like giving your accountant read-only access to one folder.

**8/15**
Why a standard?

Without standard: Every chain has different privacy
With SIP-EIP: Universal privacy that wallets support natively

ERC-20 standardized tokens.
ERC-721 standardized NFTs.
SIP-EIP standardizes privacy.

**9/15**
For developers, it's 50 lines of code:

```typescript
import { SIPProvider, PrivacyToggle } from '@sip-protocol/react'

// Wrap your app
<SIPProvider>
  <PrivacyToggle />
  <YourExistingApp />
</SIPProvider>
```

That's it.

**10/15**
Production ready:

✅ 5,584+ tests
✅ TypeScript + Rust SDKs
✅ React hooks
✅ 15+ chains supported
✅ EIP-5564 compatible

Not vaporware. Working code.

**11/15**
Battle tested:

🏆 Zypherpunk Hackathon Winner (3 tracks)
💰 $6,500 prize
📊 #14 of 88 projects

Judges included @zoaborake @aaborakeMoney @balaboraaji and more.

**12/15**
What's next:

Q2 2026: EIP submission
Q3 2026: Security audit
Q4 2026: Wallet integrations
2027: EIP Final status

Join the working group to help shape the standard.

**13/15**
Get started today:

```bash
npm install @sip-protocol/sdk
```

Full docs: docs.sip-protocol.org
GitHub: github.com/sip-protocol

**14/15**
We're seeking:

🔧 Wallet integration partners
🔬 Security researchers
📋 Standards contributors
🏢 Enterprise pilots

DM us or join Discord to get involved.

**15/15**
Privacy is a fundamental right.

The next billion users won't onboard until transactions are as private as messages.

SIP-EIP makes this possible.

The future of Web3 is private by default. Let's build it.

🔗 sip-protocol.org

---

*Cross-post to: Medium, Mirror, dev.to, Hashnode*
