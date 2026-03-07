# SIP Protocol Roadmap

> **Shielded Intents Protocol** — The Privacy Standard for Web3

---

## ENDGAME

**SIP becomes THE privacy standard for Web3 — like HTTPS for the internet.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THE ENDGAME                                    │
│                                                                             │
│   "Every Web3 transaction can be private. SIP makes it happen."            │
│                                                                             │
│   We are PRIVACY MIDDLEWARE — between applications and blockchains.        │
│   Chain-agnostic. Settlement-agnostic. The universal privacy layer.        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Success Metrics (2028):                                                   │
│   • $5B+ monthly volume across all chains                                   │
│   • Privacy toggle in top 10 wallets globally                               │
│   • 3+ settlement backends (NEAR, Mina, direct chain)                       │
│   • 5+ foundation grants/partnerships                                       │
│   • Protocol revenue: $500K+/month                                          │
│   • SIP-EIP: Formal standard proposal accepted                              │
│   • "Privacy by SIP" recognized like "Secured by SSL"                       │
│                                                                             │
│   NEW 2026 Targets:                                                         │
│   • Same-chain privacy on Solana + Ethereum                                 │
│   • Direct competitor to pool-based mixers (PrivacyCash, etc)               │
│   • Superior tech: stealth + hidden amounts vs pool mixing                  │
│   • Discourse forum (500+ members, self-hosted) + Twitter presence (50K imp)│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Privacy Architecture: Why SIP Wins

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO APPROACHES TO BLOCKCHAIN PRIVACY                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   POOL MIXING (PrivacyCash, Tornado Cash)                                   │
│   ─────────────────────────────────────────                                 │
│   • How: Pool funds with strangers                                          │
│   • Privacy from: Hiding in the crowd                                       │
│   • Weakness: Amount correlation attacks                                    │
│   • Weakness: Fixed denominations needed                                    │
│   • Weakness: Anonymity set = pool size                                     │
│   • Regulatory: HIGH RISK (mixer = money laundering concern)                │
│                                                                             │
│   CRYPTOGRAPHIC PRIVACY (SIP Protocol, Zcash-style)     ◄═══ OUR APPROACH  │
│   ───────────────────────────────────────────────────                       │
│   • How: Stealth addresses + hidden amounts                                 │
│   • Privacy from: Cryptographic encryption                                  │
│   • Strength: ANY amount, instant, no pool needed                           │
│   • Strength: Viewing keys for compliance                                   │
│   • Strength: Your funds stay yours (no commingling)                        │
│   • Regulatory: LOWER RISK (not a mixer, compliance-ready)                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Full Privacy Architecture: The Path to 100% Privacy

**Current State (M17):** ~30% Privacy Score

SIP's current implementation provides partial privacy due to the **claim linkability problem**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CURRENT PRIVACY ANALYSIS (M17 Complete)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SEND PHASE (~60% Private):                                                │
│   ├── ✅ Recipient: Hidden (stealth address)                                │
│   ├── ✅ Amount: Hidden (Pedersen commitment + encrypted)                   │
│   ├── ❌ Sender: VISIBLE (transaction signer)                               │
│   └── ❌ Intent: VISIBLE (shielded_transfer instruction)                    │
│                                                                             │
│   CLAIM PHASE (~0% Private):                                                │
│   ├── ❌ Stealth→Recipient link: VISIBLE (CPI transfer on-chain)            │
│   ├── ❌ Amount: VISIBLE (transfer amount in CPI)                           │
│   ├── ❌ Timing: Correlatable (deposit→claim timing analysis)               │
│   └── ❌ Complete trace: Observer can link entire flow                      │
│                                                                             │
│   OVERALL: ~30% PRIVATE                                                     │
│   An observer can trace: Sender → Stealth → Recipient → Full amount         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why Current Claim is Linkable:**

```
Current Architecture (M17):
═══════════════════════════════════════════════════════════════════════════════
Alice → [shielded_transfer] → Stealth PDA (unique per payment)
                                    │
                                    │  ON-CHAIN CPI (visible!)
                                    │  "Transfer 1.5 SOL from 9ZdZ...ipCB to 68tL...oD9h"
                                    ▼
                               Bob's Wallet

Observer sees: "9ZdZ...ipCB sent 1.5 SOL to 68tL...oD9h" — FULLY LINKABLE
═══════════════════════════════════════════════════════════════════════════════
```

### Target Architecture (M19-M20): 100% Privacy

The solution requires **Pool PDA + ZK Claim Proofs**:

```
Target Architecture (M19-M20):
═══════════════════════════════════════════════════════════════════════════════

SEND PHASE (unchanged):
Alice ─┬─> Pool PDA ◄── Central escrow (like Tornado Cash pool)
Bob   ─┤                 All deposits blend together
Carol ─┘

CLAIM PHASE (ZK proof required):
                    ┌─────────────────────────────────────┐
                    │         ZK CLAIM PROOF              │
                    │  "I know a nullifier that:          │
                    │   1. Corresponds to a valid deposit │
                    │   2. Has not been spent before      │
                    │   3. I own the stealth private key" │
                    │                                     │
                    │  REVEALS: Nothing about which       │
                    │           deposit is being claimed  │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
Pool PDA ───────────────────────> Bob's Wallet
         "Transfer from Pool to Recipient"
         (No link to specific deposit!)

Observer sees: "Pool sent X SOL to 68tL...oD9h"
Observer CANNOT determine: Which deposit? Who was the sender?
═══════════════════════════════════════════════════════════════════════════════
```

### Privacy Score Progression

| Phase | Privacy Score | What's Hidden | What's Exposed |
|-------|--------------|---------------|----------------|
| **M17 (Done)** | ~30% | Recipient (send), Amount (send) | Sender, Claim link, Claim amount |
| **M17.1 (Done)** | ~40% | + Swap output (stealth ATA) | Sender visible, swap TX linkable |
| **M17.2 (Private Swap C)** | ~55% | + Sender hidden (stealth-as-signer) | Deposit→stealth link (timing) |
| **M19 (Pool PDA)** | ~60% | + Deposit blending | Sender still visible |
| **M20 (ZK Claims)** | ~90% | + Claim unlinkability | Timing correlation (weak) |
| **M21 (Full)** | ~100% | + Batched claims + Delays | Nothing meaningful |

### Private Swap Evolution (M17.1 → M17.2)

**M17.1 — Stealth Output (Option B) ✅ Shipped (Mar 7, 2026):** Jupiter swap output routed to a one-time stealth ATA via `destinationTokenAccount`. On-chain announcement via `create_transfer_announcement` instruction (announcement-only, no CPI transfer). User claims via existing scan flow. Balance hiding + recipient unlinkability. Sender still visible (signs swap TX). Program upgraded on devnet + mainnet. Design: `sip-mobile/docs/plans/2026-03-07-private-swap-design.md`

**M17.2 — Stealth-as-Signer (Option C):** Full sender privacy. User deposits SOL to stealth address A, then stealth A executes the Jupiter swap (signed with `signWithScalar()`), output to stealth B. User's wallet never appears in the swap TX. Requires: (1) verify scalar signing with VersionedTransaction V0, (2) gas management for stealth signer, (3) two-stealth coordination. ~4-5 days after M17.1 ships.

### ZK Claim Circuit (Noir)

```noir
// circuits/claim_proof/src/main.nr
fn main(
    // Public inputs
    nullifier: pub Field,           // Unique per deposit (prevents double-spend)
    pool_root: pub Field,           // Merkle root of all deposits
    recipient: pub Field,           // Where funds go

    // Private inputs (never revealed)
    stealth_private_key: Field,     // Proves ownership
    deposit_commitment: Field,       // Which deposit (hidden)
    merkle_path: [Field; 20],       // Path in deposit tree
    amount: Field,                  // How much (hidden)
) {
    // 1. Verify deposit exists in pool
    let computed_root = compute_merkle_root(deposit_commitment, merkle_path);
    assert(computed_root == pool_root);

    // 2. Verify nullifier is correctly derived (prevents double-spend)
    let expected_nullifier = hash([stealth_private_key, deposit_commitment]);
    assert(nullifier == expected_nullifier);

    // 3. Verify ownership (stealth key matches deposit)
    let stealth_pubkey = derive_public_key(stealth_private_key);
    let expected_commitment = pedersen_commit(amount, stealth_pubkey);
    assert(deposit_commitment == expected_commitment);
}
```

### Protocol Neutrality Principle

> **SIP Protocol is neutral infrastructure — like TCP/IP or HTTPS.**
> The protocol itself does NOT screen, block, or filter transactions.
> Users choose their own compliance strategy.

This is the **Zcash regulatory moat**: Zcash has operated 8+ years without OFAC sanctions because:
1. **Protocol is neutral** — Blockchain infrastructure, not a mixer application
2. **Viewing keys enable compliance** — Users CAN prove transaction history (their choice)
3. **Active regulatory dialogue** — Zcash Foundation engages with regulators

Tornado Cash was sanctioned because it was an **application** (smart contract mixer) with **no compliance mechanism**. SIP is **infrastructure** (privacy middleware) with **viewing keys for user-choice compliance**.

### Compliance: Viewing Keys (The Zcash Model)

**Q: Does SIP's approach solve Tornado Cash regulatory risk?**

**A: Yes, viewing keys fundamentally change the regulatory calculus.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              TORNADO CASH vs SIP: REGULATORY COMPARISON                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TORNADO CASH (SANCTIONED)                                                 │
│   ─────────────────────────                                                 │
│   • Application layer (smart contract mixer)                                │
│   • No compliance mechanism — operators CANNOT help                         │
│   • Cannot prove funds are clean                                            │
│   • OFAC rationale: "Facilitates money laundering without safeguards"       │
│                                                                             │
│   SIP PROTOCOL (COMPLIANCE-READY)                                           │
│   ───────────────────────────────                                           │
│   • Infrastructure layer (privacy middleware)                               │
│   • Viewing keys = user-choice selective disclosure                         │
│   • Users CAN prove transaction history to regulators                       │
│   • Protocol is neutral; compliance is user's choice                        │
│                                                                             │
│   KEY DIFFERENCE:                                                           │
│   Tornado Cash: "We CAN'T help you trace this" (no mechanism exists)        │
│   SIP Protocol: "Users CAN prove anything IF they choose to" (viewing keys) │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Viewing Keys Solve:**
1. **User compliance** — Users can prove their transaction history to auditors/regulators
2. **Institutional adoption** — Custodians can monitor client activity
3. **Legal defense** — "I can prove where these funds came from"
4. **Voluntary disclosure** — Privacy by default, transparency by choice

**Range SAS Integration (Attestation-Gated Disclosure):**
- Users can grant viewing key access to **verified auditors** via Range SAS attestations
- Auditor identity verified on-chain before receiving viewing key
- Creates trust anchor for institutional compliance workflows

**Example: Compliant Shielded Transfer**
```typescript
// User sends shielded transfer with viewing key for compliance
const result = await sip.shieldedTransfer({
  recipient: stealthAddress,
  amount: '1.5',
  privacyLevel: 'compliant',  // Generates viewing key disclosure
})

// Result includes:
// - Shielded transfer (private)
// - Viewing key disclosure record (auditable by user's chosen parties)
```

**Protocol Philosophy:**
- **Privacy is a right** — Users deserve financial privacy
- **Compliance is user's choice** — Protocol doesn't enforce, users decide
- **Not a mixer** — Funds are cryptographically hidden, not pooled with strangers
- **Auditability preserved** — With viewing keys, full transparency is possible

> **This is the Zcash model** — privacy by default, viewing keys for compliance. Zcash has operated for 8+ years without sanctions because viewing keys make compliance POSSIBLE (not mandatory).

**Third-Party Compliance Tools (NOT Protocol-Level):**
Institutions who need sanctions screening can use external oracles like CipherOwl on their own systems:
- These are **user/institution-side tools**, not protocol integrations
- SIP protocol remains neutral — doesn't block or screen transactions
- Institutions can build whatever compliance layer they need on top of SIP

---

## Privacy Paths & Trade-offs

Understanding what privacy SIP provides in each settlement path:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRIVACY LEVEL BY PATH                               │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │  Sender │ Amount │ Recipient │ Compliance │  Speed  │
├──────────────────────┼─────────┼────────┼───────────┼────────────┼─────────┤
│ NEAR Intents         │   ❌    │   ❌   │    ✅     │     ✅     │   ⚡    │
│ (Cross-chain fast)   │ Visible │Visible │  Stealth  │ Viewing    │  Fast   │
│                      │         │        │           │ Keys Work  │         │
├──────────────────────┼─────────┼────────┼───────────┼────────────┼─────────┤
│ Same-Chain Programs  │   ✅    │   ✅   │    ✅     │     ✅     │   ⚡    │
│ (Solana/ETH native)  │ Hidden  │ Hidden │  Stealth  │ Viewing    │  Fast   │
│                      │Pedersen │Pedersen│           │ Keys Work  │         │
├──────────────────────┼─────────┼────────┼───────────┼────────────┼─────────┤
│ Zcash Shielded Pool  │   ✅    │   ✅   │    ✅     │     ✅     │   🐢    │
│ (Cross-chain full)   │ Hidden  │ Hidden │  Hidden   │ Viewing    │  Slow   │
│                      │Encrypted│Encrypted│Encrypted │ Keys Work  │(2 hops) │
└──────────────────────┴─────────┴────────┴───────────┴────────────┴─────────┘

Legend:
• ✅ Hidden/Protected    • ❌ Visible to settlement layer
• ⚡ Fast (seconds)      • 🐢 Slow (minutes, requires 2 cross-chain hops)
```

### Settlement Decision Tree

```
                        ┌─────────────────────────┐
                        │  What kind of privacy   │
                        │     do you need?        │
                        └───────────┬─────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │   Same-chain    │   │   Cross-chain   │   │   Cross-chain   │
    │   Full Privacy  │   │   Fast + Partial│   │   Full Privacy  │
    └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
             │                     │                     │
             ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │ SIP Native      │   │ NEAR Intents    │   │ Zcash Shielded  │
    │ Programs        │   │                 │   │ Pool Route      │
    │                 │   │                 │   │                 │
    │ • Solana Anchor │   │ • Stealth only  │   │ • SOL→ZEC→NEAR  │
    │ • ETH Solidity  │   │ • Sender visible│   │ • Full privacy  │
    │ • Pedersen+ZK   │   │ • Amount visible│   │ • Slow (2 hops) │
    │ • Full privacy  │   │ • Fast + cheap  │   │ • ZEC required  │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
         [M17-M18]             [Current]             [M19]
```

### Why Partial Privacy (NEAR Intents)?

Current SOL-NEAR swaps via NEAR Intents provide **partial privacy**:

- **What works:** Stealth addresses for recipient (unlinkable destination)
- **What's exposed:** Sender address and amount visible to 1Click API
- **Why:** NEAR Intents is a settlement layer, not a privacy layer. The swap is public on-chain.

**This is still valuable because:**
1. Recipient cannot be linked to sender (stealth address)
2. Transaction destination is hidden from on-chain observers
3. Viewing keys work for compliance/audit
4. Fast, cheap cross-chain swaps

**For full cross-chain privacy**, route through Zcash shielded pool (M19).

---

## Where We Sit in the Web3 Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  APPLICATIONS                                                               │
│  • Wallets  • DEXs  • DAOs  • Payments  • NFT  • Gaming  • Enterprise      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ "Add privacy with one toggle"
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PROTOCOL — THE PRIVACY STANDARD                    ◄═══ WE ARE HERE   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PRIVACY LAYER (Core Value)                                            │ │
│  │ • Stealth Addresses    • Pedersen Commitments   • Viewing Keys        │ │
│  │ • Privacy Levels       • Unified API            • Compliance Ready    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ SAME-CHAIN + CROSS-CHAIN (Market Expansion)              [NEW Q1 2026]│ │
│  │ • Solana same-chain    • Ethereum same-chain   • Cross-chain swaps    │ │
│  │ • Compete with mixers  • Superior compliance   • 10x bigger market    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PROOF COMPOSITION (Technical Moat)                       [Future 2026]│ │
│  │ • Zcash → Privacy execution     • Mina → Succinct verification        │ │
│  │ • Noir  → Validity proofs       • Compose proofs from multiple systems│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ "Settle anywhere"
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT LAYER (Pluggable)                                               │
│  • NEAR Intents  • Direct Chain [NEW]  • Mina Protocol  • Future backends  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER                                                           │
│  • Ethereum  • Solana  • NEAR  • Bitcoin  • Aptos  • Sui  • L2s  • More    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**One-liner**: SIP is privacy middleware — we sit between apps and chains, making any transaction private.

---

## Full Stack Privacy (NEW Jan 2026)

SIP provides **on-chain privacy**. Dark/Prop AMMs (GoonFi, HumidiFi, SolFi) provide **execution privacy**. Combined = **Full Stack Privacy**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRIVACY LAYERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EXECUTION PRIVACY (Dark AMMs)                                              │
│  ────────────────────────────────                                           │
│  ✅ MEV protection (private quotes, no mempool exposure)                    │
│  ✅ Better execution prices (tighter spreads)                               │
│  ❌ Wallet address visible on-chain                                         │
│  ❌ Transaction amounts visible after execution                             │
│  ❌ No compliance tooling                                                   │
│                                                                             │
│  ON-CHAIN PRIVACY (SIP)                                                     │
│  ─────────────────────────                                                  │
│  ✅ Stealth addresses (unlinkable recipients)                               │
│  ✅ Pedersen commitments (hidden amounts)                                   │
│  ✅ Viewing keys (selective disclosure for compliance)                      │
│  ✅ Transaction graph protection                                            │
│                                                                             │
│  FULL STACK PRIVACY = Execution Privacy + On-Chain Privacy                  │
│  ─────────────────────────────────────────────────────────                  │
│  Dark AMM + SIP = MEV protection + hidden sender/amount/recipient           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER: "Swap 100 SOL → USDC with full privacy"                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PROTOCOL                                     ◄═══ ON-CHAIN PRIVACY    │
│  • Stealth address for output    • Pedersen commitment for amount          │
│  • Viewing key for compliance    • Shielded intent wrapper                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  JUPITER AGGREGATOR                                                         │
│  Routes to best price across all DEXs (public + dark)                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DARK AMM (GoonFi, HumidiFi, etc.)             ◄═══ EXECUTION PRIVACY      │
│  • Private RFQ (MEV protection)  • Atomic execution  • Tighter spreads     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT: USDC at stealth address — unlinkable, amount hidden, MEV-free     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comparison

| Solution | MEV Protection | Amount Hidden | Wallet Hidden | Compliance |
|----------|---------------|---------------|---------------|------------|
| Public AMM (Raydium) | ❌ | ❌ | ❌ | ❌ |
| Dark AMM only | ✅ | ❌ | ❌ | ❌ |
| PrivacyCash | ❌ | ❌ | ✅ Pool mixing | ❌ |
| **SIP + Dark AMM** | ✅ | ✅ Pedersen | ✅ Stealth | ✅ Viewing keys |

> **Note:** Jupiter DEX integration (#454) naturally routes through Dark AMMs when they offer best prices. SIP adds the privacy layer on top.

---

## Strategic Architecture: Dual Moat

SIP combines two complementary strategies:

### Settlement Aggregation (Core Value)

```
"One privacy layer, settle anywhere"

┌──────────────────────────────────────────────────────────────┐
│  SIP PRIVACY LAYER (Unified)                                 │
│  • Same API regardless of settlement                         │
│  • Privacy is the core value, settlement is utility          │
│  • Users see one interface, we handle routing                │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │  NEAR  │  │  Mina  │  │ Direct │
         │Intents │  │Protocol│  │ Chain  │
         └────────┘  └────────┘  └────────┘
```

**Why**: Creates switching costs, standardization, network effects.

### Proof Composition (Technical Moat)

```
"Compose proofs for unique capabilities"

┌──────────────────────────────────────────────────────────────┐
│  PROOF COMPOSITION                                           │
│  • Zcash proof (privacy) + Mina proof (verification)         │
│  • Single output: privacy + light client verification        │
│  • Enables what no single system can do alone                │
└──────────────────────────────────────────────────────────────┘
```

**Why**: Technical innovation creates deep moat, hard to replicate.

### Combined Value Proposition

| Layer | Strategy | Role | Moat Type |
|-------|----------|------|-----------|
| Privacy | Settlement Aggregation | Core value, standardization | Network effects |
| Proofs | Proof Composition | Technical differentiation | Innovation |
| Settlement | Utility | Pluggable, not core | Flexibility |

---

## The Path to Endgame

```
PHASE 1: FOUNDATION     PHASE 2: STANDARD      PHASE 3: ECOSYSTEM     PHASE 4: EXPANSION    PHASE 5: MOAT
(2024-2025) ✅          (2025) ✅              (2025) ✅              (Q1-Q2 2026) 🎯       (Q3-Q4 2026)
     │                       │                      │                      │                    │
     ▼                       ▼                      ▼                      ▼                    ▼
┌─────────┐            ┌─────────┐            ┌─────────┐            ┌─────────┐          ┌─────────┐
│ M1-M8   │            │ M9-M12  │            │ M13-M15 │            │ M16-M18 │          │ M19-M21 │
│ Core    │ ─────────► │ Multi-  │ ─────────► │ DX &    │ ─────────► │ Same-   │ ───────► │ Cross-  │
│ Tech    │            │ Backend │            │ Apps    │            │ Chain   │          │ Chain++ │
└─────────┘            └─────────┘            └─────────┘            └─────────┘          └─────────┘
     │                      │                      │                      │                    │
• SDK ✅                • Stable Core ✅       • Compliance ✅       • M16 Complete ✅  • Zcash route
• NEAR adapter ✅       • ZK Production ✅     • React/CLI/API ✅    • M17 Complete ✅  • Proof compo
• App ✅                • Multi-Settlement ✅  • Hardware wallets ✅ • M18 Active 🎯   • SIP-EIP
• Noir circuits ✅      • Multi-Chain ✅       • WalletConnect ✅    • ETH Contracts ✅ • $5B vol
• 6,661+ tests ✅       • 15+ chains ✅        • 157 new tests ✅    • L2 Deployed ✅   • Industry std
```

---

## Milestones

### PHASE 1: FOUNDATION (M1-M8) ✅ Complete

<details>
<summary>Click to expand Phase 1 details</summary>

#### M1: Architecture & Specification ✅ Complete

Foundational decisions and formal protocol specifications.

| Issue | Description | Status |
|-------|-------------|--------|
| [#1](../../issues/1) | [EPIC] Architecture & Specification | ✅ Done |
| [#2](../../issues/2) | ZK proof architecture selection (Noir) | ✅ Done |
| [#3](../../issues/3) | Funding Proof specification | ✅ Done |
| [#4](../../issues/4) | Validity Proof specification | ✅ Done |
| [#5](../../issues/5) | Fulfillment Proof specification | ✅ Done |
| [#6](../../issues/6) | SIP-SPEC.md production update | ✅ Done |
| [#7](../../issues/7) | Stealth address protocol spec | ✅ Done |
| [#8](../../issues/8) | Viewing key specification | ✅ Done |
| [#9](../../issues/9) | Privacy levels formal spec | ✅ Done |

#### M2: Cryptographic Core ✅ Complete

Real cryptographic implementations, no mocks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#10](../../issues/10) | [EPIC] Cryptographic Core | ✅ Done |
| [#11](../../issues/11) | Remove mocked proofs from SDK | ✅ Done |
| [#12](../../issues/12) | Define ProofProvider interface | ✅ Done |
| [#13](../../issues/13) | Implement real Pedersen commitments | ✅ Done |
| [#14](../../issues/14) | Implement Funding Proof circuit | ✅ Done |
| [#15](../../issues/15) | Implement Validity Proof circuit | ✅ Done |
| [#16](../../issues/16) | Implement Fulfillment Proof circuit | ✅ Done |
| [#17](../../issues/17) | Cryptographic test suite | ✅ Done |
| [#18](../../issues/18) | Security audit preparation | ✅ Done |

#### M3: SDK Production ✅ Complete

Production-quality SDK refactoring.

| Issue | Description | Status |
|-------|-------------|--------|
| [#19](../../issues/19) | [EPIC] SDK Production Refactoring | ✅ Done |
| [#20](../../issues/20) | Refactor crypto.ts with real primitives | ✅ Done |
| [#21](../../issues/21) | Refactor intent.ts to use proof interface | ✅ Done |
| [#22](../../issues/22) | Refactor privacy.ts with real encryption | ✅ Done |
| [#23](../../issues/23) | Add comprehensive input validation | ✅ Done |
| [#24](../../issues/24) | Implement proper error handling | ✅ Done |
| [#25](../../issues/25) | Add SDK unit tests (90%+ coverage) | ✅ Done |
| [#26](../../issues/26) | Add SDK integration tests | ✅ Done |
| [#27](../../issues/27) | Performance benchmarking and optimization | ✅ Done |

#### M4: Network Integration ✅ Complete

Connect to real blockchain networks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#28](../../issues/28) | [EPIC] Network Integration | ✅ Done |
| [#29](../../issues/29) | Research and document NEAR 1Click API | ✅ Done |
| [#30](../../issues/30) | Implement NEAR Intents adapter | ✅ Done |
| [#31](../../issues/31) | Implement solver interface | ✅ Done |
| [#32](../../issues/32) | Zcash testnet RPC client | ✅ Done |
| [#33](../../issues/33) | Zcash shielded transaction support | ✅ Done |
| [#34](../../issues/34) | Evaluate Zcash proving system | ✅ Done |
| [#35](../../issues/35) | Abstract wallet interface design | ✅ Done |
| [#36](../../issues/36) | Solana wallet adapter | ✅ Done |
| [#37](../../issues/37) | Ethereum wallet adapter | ✅ Done |
| [#38](../../issues/38) | End-to-end testnet integration | ✅ Done |

**Achievement**: 745 tests passing, comprehensive E2E coverage.

#### M5: Documentation & Launch ✅ Complete

Polish and publish.

| Issue | Description | Status |
|-------|-------------|--------|
| [#39](../../issues/39) | [EPIC] Documentation & Launch | ✅ Done |
| [#40](../../issues/40) | Reference application polish | ✅ Done |
| [#41](../../issues/41) | Deploy to production | ✅ Done |
| [#42](../../issues/42) | Internal security review | ✅ Done |
| [#43](../../issues/43) | Security audit preparation | ✅ Done |
| [#44](../../issues/44) | Auto-generated API documentation | ✅ Done |
| [#45](../../issues/45) | Developer integration guide | ✅ Done |
| [#46](../../issues/46) | Protocol whitepaper | ✅ Done |
| [#47](../../issues/47) | Architecture diagrams | ✅ Done |

#### M6: Launch & Publish ✅ Complete

Publish SDK to npm and integrate into website.

| Issue | Description | Status |
|-------|-------------|--------|
| [#48](../../issues/48) | [EPIC] Launch & Publish | ✅ Done |
| [#49](../../issues/49) | Configure NPM_TOKEN secret | ✅ Done |
| [#50](../../issues/50) | Create GitHub release v0.1.0 | ✅ Done |
| [#51](../../issues/51) | Verify npm packages work | ✅ Done |
| [#52](../../issues/52) | Update sip-website to use npm packages | ✅ Done |
| [#53](../../issues/53) | Build docs-sip with Astro + Starlight | ✅ Done |

**Achievement**: @sip-protocol/sdk and @sip-protocol/types published to npm. docs.sip-protocol.org live.

#### M7: Real Integration ✅ Complete

Connect application UI to real SDK with actual blockchain transactions.

| Issue | Description | Status |
|-------|-------------|--------|
| [#54](../../issues/54) | [EPIC] Real Integration | ✅ Done |
| [#55](../../issues/55) | Wallet connection component (Phantom, MetaMask) | ✅ Done |
| [#56](../../issues/56) | SDK client initialization | ✅ Done |
| [#57](../../issues/57) | Testnet configuration (Solana Devnet, Sepolia) | ✅ Done |
| [#58](../../issues/58) | Quote flow integration (1Click API) | ✅ Done |
| [#59](../../issues/59) | Transaction execution flow | ✅ Done |
| [#60](../../issues/60) | Explorer links and tx status | ✅ Done |
| [#61](../../issues/61) | Error handling and edge cases | ✅ Done |

**Achievement**: Full application with wallet connection, quote fetching, transaction execution. 122 tests in sip-website.

#### M8: Production Hardening ✅ Complete

Real ZK circuits, security hardening, multi-curve support.

| Issue | Description | Status |
|-------|-------------|--------|
| [#62](../../issues/62) | [EPIC] Production Hardening | ✅ Done |
| [#63](../../issues/63) | Noir Funding Proof circuit | ✅ Done |
| [#64](../../issues/64) | Noir Validity Proof circuit | ✅ Done |
| [#65](../../issues/65) | Noir Fulfillment Proof circuit | ✅ Done |
| [#66](../../issues/66) | Memory zeroization for secrets | ✅ Done |
| [#67](../../issues/67) | External security audit | 🔲 Pending |
| [#91](../../issues/91) | [EPIC] Multi-Curve Stealth Addresses | ✅ Done |
| [#92](../../issues/92) | ed25519 stealth address implementation | ✅ Done |
| [#93](../../issues/93) | Solana address derivation from ed25519 | ✅ Done |
| [#94](../../issues/94) | NEAR address derivation from ed25519 | ✅ Done |
| [#95](../../issues/95) | Multi-curve meta-address format | ✅ Done |
| [#96](../../issues/96) | Update NEAR Intents adapter for multi-curve | ✅ Done |
| [#97](../../issues/97) | Cross-chain stealth integration tests | ✅ Done |

**Achievement**: Noir circuits compiled. Secure memory handling. Multi-curve stealth complete.

</details>

---

### PHASE 2: STANDARD (M9-M12) ✅ Complete

<details>
<summary>Click to expand Phase 2 details</summary>

#### M9: Stable Core ✅ Complete

100% test coverage, Zcash swaps, CI validation.

| Description | Status |
|-------------|--------|
| [EPIC] Stable Core | ✅ Done |
| 100% passing test suite | ✅ Done |
| Zcash swap integration | ✅ Done |
| CI/CD validation pipeline | ✅ Done |

**Achievement**: Rock-solid foundation with comprehensive testing.

#### M10: ZK Production ✅ Complete

Noir wired to SDK, WASM browser proving, Web Worker support.

| Description | Status |
|-------------|--------|
| [EPIC] ZK Production | ✅ Done |
| Noir circuits wired to SDK | ✅ Done |
| WASM browser proving | ✅ Done |
| Web Worker proof generation | ✅ Done |
| BrowserNoirProvider implementation | ✅ Done |

**Achievement**: Zero-knowledge proofs working in browser environments.

#### M11: Multi-Settlement ✅ Complete

SettlementBackend interface, SmartRouter, 3 backends.

| Description | Status |
|-------------|--------|
| [EPIC] Multi-Settlement | ✅ Done |
| SettlementBackend interface | ✅ Done |
| SmartRouter implementation | ✅ Done |
| NEAR Intents backend | ✅ Done |
| Zcash backend | ✅ Done |
| Direct chain backend | ✅ Done |

**Achievement**: Pluggable settlement layer with 3 backends.

#### M12: Multi-Chain ✅ Complete

Bitcoin Silent Payments, Cosmos IBC, Aptos/Sui support.

| Description | Status |
|-------------|--------|
| [EPIC] Multi-Chain | ✅ Done |
| Bitcoin Silent Payments | ✅ Done |
| Cosmos IBC stealth addresses | ✅ Done |
| Aptos address derivation | ✅ Done |
| Sui address derivation | ✅ Done |
| Ed25519 chain support | ✅ Done |

**Achievement**: Support for 15+ chains across multiple curves.

</details>

---

### PHASE 3: ECOSYSTEM (M13-M15) ✅ Complete

<details>
<summary>Click to expand Phase 3 details</summary>

#### M13: Compliance Layer ✅ Complete

Enterprise-ready compliance features.

| Issue | Description | Status |
|-------|-------------|--------|
| [#157](../../issues/157) | [EPIC] Compliance Layer | ✅ Done |
| [#158](../../issues/158) | Selective disclosure viewing keys | ✅ Done |
| [#159](../../issues/159) | Audit trail generation | ✅ Done |
| [#160](../../issues/160) | Compliance proof system | ✅ Done |
| [#161](../../issues/161) | Regulatory reporting helpers | ✅ Done |

**Achievement**: Full compliance toolkit for institutional adoption.

#### M14: Developer Experience ✅ Complete

Production-ready developer tools and packages.

| Issue | Description | Status |
|-------|-------------|--------|
| [#169](../../issues/169) | [EPIC] Developer Experience | ✅ Done |
| [#170](../../issues/170) | @sip-protocol/react package | ✅ Done |
| [#171](../../issues/171) | @sip-protocol/cli package | ✅ Done |
| [#172](../../issues/172) | @sip-protocol/api package | ✅ Done |
| [#173](../../issues/173) | React hooks (useSIP, useStealthAddress, usePrivateSwap, useViewingKey) | ✅ Done |
| [#174](../../issues/174) | CLI commands (generate, verify, quote, swap) | ✅ Done |
| [#175](../../issues/175) | REST API with OpenAPI spec | ✅ Done |

**Achievement**: 4 new packages, 157 tests (React: 57, CLI: 33, API: 67).

#### M15: Application Layer ✅ Complete

Multi-wallet support and hardware wallet integration.

| Issue | Description | Status |
|-------|-------------|--------|
| [#181](../../issues/181) | [EPIC] Application Layer | ✅ Done |
| [#182](../../issues/182) | Universal wallet adapter | ✅ Done |
| [#183](../../issues/183) | Multi-wallet session management | ✅ Done |
| [#184](../../issues/184) | Hardware wallet support (Ledger, Trezor) | ✅ Done |
| [#185](../../issues/185) | WalletConnect v2 integration | ✅ Done |
| [#186](../../issues/186) | Social recovery system | ✅ Done |

**Achievement**: Enterprise-grade wallet infrastructure.

</details>

---

### PHASE 4: SAME-CHAIN EXPANSION (Q1-Q2 2026) 🎯 NEW

**Goal:** Capture the same-chain privacy market — 10-20x bigger than cross-chain only.

**Strategic Context:** PrivacyCash (pool-based mixer) is getting traction on Solana. SIP's cryptographic approach is architecturally superior. This is the window to establish market leadership.

---

### Solana Privacy Hack Sprint (Jan 12 - Feb 1, 2026) 🎯

**Hackathon:** [solana.com/privacyhack](https://solana.com/privacyhack) — **$150K+ prize pool** (updated Jan 13)

**Epic Issue:** [#443 - HACK-EPIC: Solana Privacy Hack](../../issues/443)

> **⚠️ IMPORTANT:** The hackathon is a BONUS, not our primary goal. We are building SIP to become THE privacy standard for Web3. The hackathon deadline should NOT rush our architecture decisions. If we miss the submission deadline but build something excellent, that's still a win. Quality over prizes. The real prize is market leadership.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SOLANA PRIVACY HACK STRATEGY (Updated Jan 13)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TRACKS (3) — $48K:                                                        │
│   • Private Payments ($15K) — Devnet deploy + app.sip-protocol.org/payments │
│   • Privacy Tooling ($15K) — SDK + React hooks (STRONGEST)                  │
│   • Open Track ($18K) — Privacy Aggregator narrative                        │
│                                                                             │
│   SPONSOR BOUNTIES (12) — $101.5K+:                                         │
│   • ShadowWire ($15K) — PARTNER! Same crypto, add viewing keys [NEW]        │
│   • PrivacyCash ($15K) — Pool mixing backend integration [TRIPLED]          │
│   • Arcium ($10K) — MPC + C-SPL token standard                              │
│   • Aztec/Noir ($10K) — Already using Noir! Just showcase                   │
│   • Inco ($6K) — FHE compute privacy adapter                                │
│   • Helius ($5K) — DAS API + Webhooks for stealth scanning                  │
│   • MagicBlock ($5K) — TEE-based privacy (INTEGRATE) [NEW]                  │
│   • QuickNode ($3K) — Open-source tooling                                   │
│   • Hacken ($2K voucher) — Security audit [NEW]                             │
│   • Range ($1.5K+) — Viewing keys = selective disclosure (SWEET SPOT)       │
│   • Encrypt.trade ($1K) — Surveillance tool + privacy explainer             │
│   • Starpay — ❌ SKIPPED (no public API)                                    │
│                                                                             │
│   PHILOSOPHY: "No competitors, only integration partners"                   │
│                                                                             │
│   TOTAL AVAILABLE: $111.5K cash + $2K voucher                               │
│   REALISTIC TARGET: $55-75K                                                 │
│   STRETCH GOAL: $100K+                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**ShadowWire Partner Strategy (NEW - $15K):**

ShadowWire uses **Pedersen Commitments + Bulletproofs** (same crypto as SIP!) but has **NO viewing keys**.

**Integration:** Build `ShadowWireAdapter`, add viewing keys, support USD1 stablecoin ($2.5K bonus).
**Value Prop:** "ShadowWire hides amounts. SIP adds compliance = privacy institutions can use."

**Hackathon Sprint Issues:**

| Issue | Description | Priority | Target Track/Bounty |
|-------|-------------|----------|---------------------|
| [#444](../../issues/444) | Showcase video (3 min) | 🔴 Critical | All tracks |
| [#445](../../issues/445) | Devnet deployment | 🔴 Critical | Private Payments $15K |
| [#446](../../issues/446) | Helius DAS integration | 🟡 High | Helius $5K |
| [#447](../../issues/447) | Helius webhook scanning | 🟡 High | Helius $5K |
| [#448](../../issues/448) | Range SAS example | 🟡 High | Range $1.5K+ |
| [#449](../../issues/449) | React hooks examples | 🟢 Medium | Tooling $15K |
| [#450](../../issues/450) | Submission materials | 🔴 Critical | All tracks |
| [#480](../../issues/480) | PrivacyCash Adapter | 🟡 High | PrivacyCash $6K |
| [#481](../../issues/481) | Arcium Adapter | 🟡 High | Arcium $10K |
| [#482](../../issues/482) | Inco Adapter | 🟡 High | Inco $6K |
| [#484](../../issues/484) | C-SPL Token Standard | 🟡 High | Arcium $10K |
| [#485](../../issues/485) | Wallet Surveillance Tool | 🟡 High | Encrypt.trade $1K |
| [#486](../../issues/486) | Aztec/Noir Bounty Strategy | 🟡 High | Aztec/Noir $10K |
| [#488](../../issues/488) | D3.js Privacy Dashboard | 🟡 High | Privacy UX |
| [#490](../../issues/490) | Privacy Advisor Agent | 🟢 Medium | User guidance |
| [blog#80](https://github.com/sip-protocol/blog-sip/issues/80) | Privacy Explainer Content | 🟢 Medium | Encrypt.trade $500 |

**Hackathon Sprint Timeline:**

| Week | Deliverables | Issues | Target Bounties |
|------|--------------|--------|-----------------|
| Week 1 (Jan 12-18) | Devnet deploy, Helius DAS, Noir showcase | #445, #446, #486 | Tooling, Helius, Aztec |
| Week 2 (Jan 19-25) | Video, React examples, Range integration, Surveillance + D3.js | #444, #449, #448, #485, #488 | All tracks, Range, Encrypt |
| Week 3 (Jan 26-Feb 1) | Adapters (PrivacyCash/Arcium/Inco), Polish, Submissions | #480, #481, #482, #484, #450 | Sponsor bounties |

**Bounty Coverage Matrix (Updated Jan 13):**

| Bounty | Prize | Key Requirement | Our Solution | Issue | Priority |
|--------|-------|-----------------|--------------|-------|----------|
| **Tooling Track** | $15K | Dev tools for privacy | SDK + React hooks + CLI | #449 | 🔴 P0 |
| **Aztec/Noir** | $10K | ZK apps with Noir | Already using Noir! | #486 | 🔴 P0 |
| **ShadowWire** | $15K | SDK integration | ShadowWire + viewing keys | TBD | 🔴 P0 |
| **Range** | $1.5K+ | Selective disclosure | Viewing keys (core!) | #448 | 🔴 P0 |
| **QuickNode** | $3K | Open-source tooling | SDK is open-source | - | 🟡 P1 |
| **Helius** | $5K | DAS + Webhooks | Stealth scanning | #446, #447 | 🟡 P1 |
| **PrivacyCash** | $15K | SDK integration | PrivacyCash Adapter | #480 | 🟢 P2 |
| **Arcium** | $10K | MPC + C-SPL tokens | Arcium Adapter + C-SPL | #481, #484 | 🟢 P2 |
| **Inco** | $6K | FHE compute privacy | Inco Adapter | #482 | 🟢 P2 |
| **MagicBlock** | $5K | TEE-based privacy | MagicBlockAdapter + viewing keys | TBD | 🟡 P1 |
| **Encrypt.trade** | $1K | Surveillance tool + explainer | Privacy score + blog | #485, blog#80 | 🟢 P2 |
| ~~**Starpay**~~ | ~~$3.5K~~ | ~~Privacy payments~~ | ~~-~~ | - | ❌ No API |

**Integration Partner Philosophy:**

> "No competitors, only integration partners" — We integrate ALL privacy tech and add viewing keys.

| Partner | Tech | SIP Adds | Bounty |
|---------|------|----------|--------|
| **ShadowWire** | Pedersen + Bulletproofs | Viewing keys | $15K |
| **PrivacyCash** | Pool mixing + ZK | Viewing keys + stealth | $15K |
| **MagicBlock** | TEE (Intel TDX) | Viewing keys | $5K |
| **Arcium** | MPC | Viewing keys | $10K |
| **Inco** | FHE | Viewing keys | $6K |
| **Light Protocol** | ZK Compression | Privacy layer | Open Track |
| ~~**Starpay**~~ | ~~Cards~~ | ~~-~~ | ❌ No API |

**Critical Path (Blockers):**
1. **Showcase video (#444)** — Required for ALL submissions
2. **Devnet deployment (#445)** — Required for Private Payments track
3. **Noir showcase (#486)** — Low-hanging $10K (already built!)

See private strategy docs: `~/.claude/sip-protocol/SOLANA-PRIVACY-HACK.md`

---

#### M16: Narrative Capture & Positioning ✅ Complete

Established SIP as "the right way to do privacy" — cryptographic vs pool mixing narrative.

| Issue | Description | Budget | Status |
|-------|-------------|--------|--------|
| [#451](../../issues/451) | [EPIC] Narrative Capture | $10K total | ✅ Done |
| [#384-391](../../issues?q=is%3Aissue+M16+article) | Content Campaign (25 blog posts) | $4,500 (45%) | ✅ **Exceeded** |
| [#392-395](../../issues?q=is%3Aissue+M16+community) | Community Building (Discord + Twitter) | $3,500 (35%) | ✅ Done |
| [#396](../../issues/396) | Ecosystem Presentations (3 events) | $2,000 (20%) | ✅ Done |

**Deliverables (Achieved):**
- **Content:** 25 blog posts at blog.sip-protocol.org (exceeded 12 target)
- **Apps:** app.sip-protocol.org launched (payments, wallet, DEX scaffolded)
- **Mobile:** sip-mobile scaffolded (Expo 52, NativeWind)
- **Grant:** Superteam Indonesia $10K APPROVED

**Success Metrics (Results):**

| Metric | Target | Achieved |
|--------|--------|----------|
| Blog posts | 12 | ✅ **25** |
| sip-app | MVP | ✅ **Launched** |
| Superteam grant | $10K | ✅ **APPROVED** |
| Zypherpunk placement | Top 20 | ✅ **#9/93** |

**Alignment:** Superteam Microgrant ($10K) secured — T1 payment expected Jan 30

---

#### M17: Solana Same-Chain Privacy (Anchor Program) ✅ Complete (Jan 2026)

**SIP Solana Program** — On-chain privacy using Anchor smart contracts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        M17: SOLANA PRIVACY PROGRAM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Technology Stack:                                                         │
│   • Anchor Framework (Rust) → On-chain program                              │
│   • Pedersen Commitments → Hidden amounts                                   │
│   • Ed25519 Stealth Addresses → Unlinkable recipients                       │
│   • ZK Proof Verification → On-chain validity proofs                        │
│   • Viewing Keys → Compliance/audit disclosure                              │
│                                                                             │
│   How It Works:                                                             │
│   1. User creates shielded transfer (SDK generates commitment + proof)      │
│   2. Anchor program verifies ZK proof on-chain                              │
│   3. Funds transfer with hidden amount (only commitment visible)            │
│   4. Recipient scans for stealth addresses, claims with viewing key         │
│                                                                             │
│   This is "Zcash-style privacy on Solana" — no shielded pool needed.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Priority | Status |
|-------|-------------|----------|--------|
| [#401](../../issues/401) | [EPIC] SIP Solana Program (Anchor) | - | ✅ Complete |
| [#399](../../issues/399) | Anchor program: shielded_transfer instruction | Critical | ✅ Complete |
| [#400](../../issues/400) | Anchor program: claim_transfer instruction | Critical | ✅ Complete |
| [#402](../../issues/402) | On-chain Pedersen commitment verification | Critical | ✅ Complete |
| [#403](../../issues/403) | On-chain ZK proof verifier (Noir→Solana) | Critical | ✅ Complete |
| [#262](../../issues/262) | Ed25519 stealth address scanning | Critical | ✅ Complete |
| [#479](../../issues/479) | Viewing key disclosure mechanism | High | ✅ Complete |
| [#374](../../issues/374) | SDK API: `sip.shieldedTransfer(solana, ...)` | High | ✅ Complete |
| [#454](../../issues/454) | Jupiter DEX integration (private swaps via Dark AMMs) | High | ✅ Complete |
| [#421](../../issues/421) | **Jito relayer integration** (gas abstraction) | High | ✅ Complete |
| [#404](../../issues/404) | Anchor program audit preparation | High | ✅ Complete |
| [#379](../../issues/379) | Same-chain test suite (100+ tests) | High | ✅ Complete |
| [#377](../../issues/377) | Developer documentation | Medium | ✅ Complete |
| [#441](../../issues/441) | **[OPT] Winternitz Vault integration** (quantum-resistant storage) | Medium | ✅ Complete |
| [#493](../../issues/493) | **SolanaRPCProvider interface** (unified provider abstraction) | High | ✅ Complete |
| [#446](../../issues/446) | **Helius DAS adapter** (token queries via DAS API) | High | ✅ Complete |
| [#494](../../issues/494) | **QuickNode adapter** (Yellowstone gRPC streams) | Medium | ✅ Complete |
| [#495](../../issues/495) | **Triton adapter** (Geyser plugin integration) | Medium | ✅ Complete |
| [#496](../../issues/496) | **Generic RPC adapter** (standard RPC fallback) | High | ✅ Complete |
| [#456](../../issues/456) | **Helius Enhanced Transactions** (better UX) | Medium | ✅ Complete |
| [#447](../../issues/447) | **Helius Webhooks** (real-time payment notifications) | Medium | ✅ Complete |
| [#457](../../issues/457) | **Sunspot pipeline** (Noir → ACIR → Groth16 → Solana verifier) | Critical | ✅ Complete |
| [#445](../../issues/445) | **Devnet deployment** (verifier.so + reference app) | Critical | ✅ Complete |
| [#480](../../issues/480) | **PrivacyCash Adapter** (pool mixing backend) | High | ✅ Complete |
| [#481](../../issues/481) | **Arcium Adapter** (MPC compute privacy) | Medium | ✅ Complete |
| [#482](../../issues/482) | **Inco Adapter** (FHE compute privacy) | Medium | ✅ Complete |
| [#483](../../issues/483) | **PrivacyBackend interface** (unified backend abstraction) | High | ✅ Complete |
| [#487](../../issues/487) | **SmartRouter v2** (backend selection logic) | Medium | ✅ Complete |
| [#489](../../issues/489) | **Network Privacy** (Tor/SOCKS5 proxy support) | Medium | ✅ Complete |
| [#472](../../issues/472) | **app.sip-protocol.org** (dedicated app subdomain) | High | ✅ Complete |

**Relayer Strategy:** Use Jito for gas abstraction — no dedicated infrastructure needed. User signs shielded tx → Jito relayer submits → Pays gas → Gets fee from commitment. Relayer is gas-only (not asset movement) = lower regulatory risk.

**Privacy Backend Aggregation Strategy:**

SIP is a **Privacy Aggregator** — one SDK that integrates ALL privacy approaches. Users choose what fits their needs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIP PRIVACY BACKEND ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TRANSACTION PRIVACY (Who sends what to whom):                             │
│   ──────────────────────────────────────────────                            │
│   • SIP Native — Stealth addresses + Pedersen commitments                   │
│   • PrivacyCash — Pool mixing (break tx links)                              │
│   • ShadowWire — Bulletproofs (sender anonymity)                            │
│                                                                             │
│   COMPUTE PRIVACY (What happens inside contracts):                          │
│   ────────────────────────────────────────────────                          │
│   • MagicBlock — TEE (Intel TDX, fast + composable)                         │
│   • Arcium — MPC (Multi-Party Computation)                                  │
│   • Inco — FHE (Fully Homomorphic Encryption)                               │
│                                                                             │
│   COMPLETE PRIVACY = Transaction Privacy + Compute Privacy                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Privacy Backend Comparison (6 Providers):**

| Backend | Type | Amount Hidden | Sender Hidden | Compute Hidden | Compliance | Best For |
|---------|------|---------------|---------------|----------------|------------|----------|
| **SIP Native** | ZK + Stealth | ✅ Pedersen | ✅ Stealth | ❌ | ✅ Viewing keys | Compliant payments |
| **PrivacyCash** | Pool Mixing | ❌ Visible | ✅ Pool | ❌ | ❌ | Anonymity set |
| **ShadowWire** | Bulletproofs | ✅ ZK proof | ✅ Anon | ❌ | ❌ | Sender anonymity |
| **MagicBlock** | TEE (TDX) | ✅ In TEE | ✅ In TEE | ✅ TEE | ⚠️ Limited | Fast + composable |
| **Arcium** | MPC | ✅ In compute | ❌ | ✅ MPC | ⚠️ Limited | Private DeFi logic |
| **Inco** | FHE | ✅ Encrypted | ❌ | ✅ FHE | ⚠️ Limited | Encrypted state |

**User Choice API:**

```typescript
const sip = new SIPClient({ chain: 'solana' })

// SIP Native — cryptographic privacy with compliance
await sip.shieldedTransfer({ backend: 'sip-native', ... })

// PrivacyCash — pool mixing for anonymity set
await sip.shieldedTransfer({ backend: 'privacycash', ... })

// Auto — SmartRouter chooses based on amount, compliance needs
await sip.shieldedTransfer({ backend: 'auto', ... })

// SIP + Arcium — transaction privacy + compute privacy
await sip.privateSwap({ txBackend: 'sip-native', computeBackend: 'arcium', ... })
```

> **Philosophy:** SIP doesn't compete with PrivacyCash, Arcium, or Inco — we INTEGRATE them. One standard, all approaches.

**RPC Provider Abstraction (Infrastructure Agnostic):**

SIP is **RPC-provider-agnostic** — developers choose their preferred Solana RPC provider. Each provider has unique moats we leverage through a unified interface.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SIP RPC PROVIDER ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  SolanaRPCProvider Interface (Unified API)                          │   │
│   │  • getAssetsByOwner()    — Token balance queries                    │   │
│   │  • getTokenBalance()     — Specific mint balance                    │   │
│   │  • subscribeToTransfers() — Real-time notifications (if supported)  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│              ┌─────────────────────┼─────────────────────┐                  │
│              ▼                     ▼                     ▼                  │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│   │  Helius Adapter  │  │ QuickNode Adapter│  │  Triton Adapter  │         │
│   │  • DAS API       │  │  • Yellowstone   │  │  • Geyser plugins│         │
│   │  • Webhooks      │  │  • Functions     │  │  • High-throughput│        │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│              │                     │                     │                  │
│              └─────────────────────┼─────────────────────┘                  │
│                                    ▼                                        │
│                         ┌──────────────────┐                                │
│                         │  Generic Adapter │                                │
│                         │  • Standard RPC  │                                │
│                         │  • Self-hosted   │                                │
│                         │  • Fallback      │                                │
│                         └──────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**RPC Provider Comparison:**

| Provider | Moat API | Best For | Issue |
|----------|----------|----------|-------|
| **Helius** | DAS (Digital Asset Standard) | Token balances, NFT metadata | [#446](../../issues/446) |
| **QuickNode** | Yellowstone gRPC, Functions | Real-time streams, custom logic | [#494](../../issues/494) |
| **Triton** | Geyser plugins | High-throughput indexing | [#495](../../issues/495) |
| **Generic** | Standard RPC | Self-hosted, fallback | [#496](../../issues/496) |

**Provider Interface:** [#493](../../issues/493)

**Developer Choice API:**

```typescript
import { scanForPayments, createProvider } from '@sip-protocol/sdk'

// Helius — efficient DAS queries (recommended for production)
const helius = createProvider('helius', { apiKey: process.env.HELIUS_API_KEY })

// QuickNode — real-time streams
const quicknode = createProvider('quicknode', { apiKey: process.env.QUICKNODE_API_KEY })

// Generic — standard RPC, no API key needed
const generic = createProvider('generic', { connection })

// Same API, different backends — developer choice
const payments = await scanForPayments({
  provider: helius, // or quicknode, triton, generic
  viewingPrivateKey,
  spendingPublicKey,
})
```

> **Philosophy:** SIP doesn't lock developers to one RPC provider — we provide a unified interface that leverages each provider's unique moats. Use Helius DAS for efficient queries, QuickNode for real-time streams, or your own node.

**Success Metrics:**
- **Program:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (devnet + mainnet-beta)
- **Mainnet TX:** [`2akhczwV...iFe8R`](https://solscan.io/tx/2akhczwV94LJ8HL3xbAmNddBSACZTbYMAoow4LmgjkeVS1hu1H7DTKHFfZrm8DHZ6BBrVn93AjiAQUZjg78iFe8R) (Jan 31, 2026)
- 100+ test cases passing
- Developer preview released
- 3 dApp integration POCs

**Alignment:** Solana Foundation Grant ($100K) primary deliverable

---

#### M18: Ethereum Same-Chain Privacy (Solidity Contract) 🔄 Q1 2026

**SIP Ethereum Contract** — On-chain privacy using Solidity smart contracts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        M18: ETHEREUM PRIVACY CONTRACT                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Technology Stack:                                                         │
│   • Solidity → On-chain smart contract                                      │
│   • Pedersen Commitments → Hidden amounts (EVM precompiles)                 │
│   • Secp256k1 Stealth Addresses → EIP-5564 compatible                       │
│   • ZK Proof Verification → On-chain Noir verifier                          │
│   • Viewing Keys → Compliance/audit disclosure                              │
│                                                                             │
│   How It Works:                                                             │
│   1. User creates shielded transfer (SDK generates commitment + proof)      │
│   2. Solidity contract verifies ZK proof on-chain                           │
│   3. Funds transfer with hidden amount (only commitment visible)            │
│   4. Recipient scans for stealth addresses, claims with viewing key         │
│                                                                             │
│   Same architecture as M17 but for EVM chains (ETH + L2s).                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Priority | Status |
|-------|-------------|----------|--------|
| [#800](../../issues/800) | [EPIC] Ethereum Same-Chain Privacy Implementation | - | 🔄 In Progress |
| [#801](../../issues/801) | Solidity contract scaffolding | Critical | ✅ Complete |
| [#802](../../issues/802) | shieldedTransfer function (Solidity) | Critical | ✅ Complete |
| [#803](../../issues/803) | claimTransfer function (Solidity) | Critical | ✅ Complete |
| [#804](../../issues/804) | On-chain Pedersen verification (EVM) | Critical | ✅ Complete |
| [#805](../../issues/805) | Noir→EVM ZK verifier deployment | Critical | ✅ Complete (Phase A) |
| [#806](../../issues/806) | EIP-5564 stealth address implementation | Critical | ✅ Complete |
| [#807](../../issues/807) | SDK shieldedTransfer API for Ethereum | High | ✅ Complete |
| [#808](../../issues/808) | Secp256k1 stealth address scanning (EVM) | High | ✅ Complete |
| [#809](../../issues/809) | EVM viewing key disclosure mechanism | High | ✅ Complete |
| [#810](../../issues/810) | **Gelato relayer integration** (gasless withdrawals) | High | ✅ Complete |
| [#811](../../issues/811) | Uniswap integration for private swaps | Medium | ✅ Complete |
| [#812](../../issues/812) | 1inch aggregator integration | Medium | ✅ Complete |
| [#813](../../issues/813) | **Base L2 deployment** (Coinbase compliance alignment) | Critical | ✅ Complete |
| [#814](../../issues/814) | **Arbitrum deployment** (largest TVL, DeFi) | Critical | ✅ Complete |
| [#815](../../issues/815) | **Optimism deployment** (OP Stack reuse) | High | ✅ Complete |
| [#816](../../issues/816) | Sepolia testnet deployment | Critical | ✅ Complete |
| [#817](../../issues/817) | E2E test suite for EVM (80+ tests) | High | ✅ Complete (294 tests) |
| [#818](../../issues/818) | Solidity audit preparation | High | ✅ Complete |
| [#819](../../issues/819) | Gas optimization (target < 200K) | Medium | ✅ Profiled |
| [#820](../../issues/820) | EVM developer documentation | Medium | ✅ Complete |
| [#821](../../issues/821) | zkSync Era deployment | Medium | 🔄 Blocked (needs foundry-zksync) |
| [#822](../../issues/822) | Linea deployment | Medium | ✅ Complete |
| [#823](../../issues/823) | Scroll deployment | Medium | ✅ Complete |
| [#824](../../issues/824) | Long-tail L2 deployments (Blast, Mantle, Mode) | Low | 🔄 In Progress (Mode ✅, Blast/Mantle pending) |
| [#944](../../issues/944) | EVM Claim Verifier — Solidity ZK proof verification (M19 cross-ref) | Critical | 🔲 Deferred (M19) |

**L2 Prioritization Strategy (Jan 2026):**

| Priority | L2 | Type | TVL | Score | Rationale |
|----------|-----|------|-----|-------|-----------|
| 🥇 **#1** | **Base** | Optimistic | ~$14B | 92 | Coinbase compliance alignment, fastest growth, viewing keys narrative fit |
| 🥈 **#2** | **Arbitrum** | Optimistic | ~$18B | 90 | Largest TVL, mature DeFi ecosystem, institutional presence |
| 🥉 **#3** | **Optimism** | Optimistic | ~$8B | 85 | OP Stack (code reuse from Base), Superchain vision |
| 4 | zkSync Era | ZK | ~$1B | 78 | ZK narrative, native account abstraction |
| 5 | Linea | ZK | ~$1.2B | 75 | ConsenSys backing, MetaMask integration |
| 6 | Scroll | ZK | ~$900M | 73 | EVM equivalence, growing ecosystem |
| 7-10 | Blast, Mantle, Mode, Taiko | Mixed | Various | 62-70 | Long-tail coverage |

*Score based on: TVL (25%), EVM compatibility (20%), dev ecosystem (15%), grant opportunity (15%), tx cost (10%), growth (10%), privacy stance (5%)*

**Why Base First:**
- **Compliance narrative** — Coinbase = regulated, SIP viewing keys = compliant privacy. Perfect match.
- **Growth trajectory** — 60%+ tx share and accelerating
- **Distribution** — Coinbase app funnels millions of users to Base
- **Grant story** — "Privacy infrastructure for Base" is compelling pitch
- **First-mover** — Less privacy competition on Base

**Rollout Plan:**
```
Phase 1: Base        → Coinbase compliance narrative, prove product-market fit
Phase 2: Arbitrum    → Largest TVL, DeFi integrations (Uniswap, GMX, Aave)
Phase 3: Optimism    → OP Stack code reuse, Superchain distribution
Phase 4: ZK Rollups  → zkSync, Linea, Scroll (if resources allow)
Phase 5: Long-tail   → Blast, Mantle, Mode, Taiko (completeness)
```

**Implementation Notes:**
- Base + Optimism share OP Stack — ~80% code reuse between them
- Same Solidity contract deploys to all EVM L2s (different RPC endpoints only)
- Per 21Shares analysis: L2 consolidation expected in 2026, focus on survivors

**Relayer Strategy:** Use Gelato Network or ERC-4337 Paymasters for EVM chains — no dedicated infrastructure needed. Account abstraction enables native gas sponsorship.

**Success Metrics:**
- Solidity contract deployed to Sepolia testnet
- 3 Tier 1 L2 chains supported (Base, Arbitrum, Optimism)
- Integration guide published
- Gas benchmarks under 200K per shielded transfer

---

### PHASE 5: TECHNICAL MOAT (Q3 2026 - 2027) 🔲 Future

**Goal:** Build defensible technical advantages that competitors cannot easily replicate.

---

#### M19: Full Privacy Architecture & Mina Integration 🔲 Q3 2026

**Primary Goal:** Solve the **claim linkability problem** — the #1 privacy gap in current implementation.

**Why This Matters:** Current M17 implementation is ~30% private. Claims are fully linkable on-chain. This milestone delivers **true unlinkability** via Pool PDA + ZK claim proofs.

Four parallel tracks: **ZK Claim Proofs** (critical path), **Pool PDA Architecture** (foundation), **Mina integration** (relationship leverage), and **proof composition research** (long-term moat).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               M19: FULL PRIVACY ARCHITECTURE + MINA INTEGRATION              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Track A: ZK Claim Proofs (CRITICAL PATH — Solves Claim Linkability)       │
│   ─────────────────────────────────────────────────────────────────         │
│   • Noir circuit: claim_proof (nullifier + merkle proof + ownership)        │
│   • On-chain verifier (Solana + EVM)                                        │
│   • SDK integration: sip.privateClaim({ proof: ... })                       │
│   • Privacy score: 30% → 90%                                                │
│                                                                             │
│   Track B: Pool PDA Architecture (Foundation for Unlinkability)             │
│   ──────────────────────────────────────────────────────────────            │
│   • Single Pool PDA for all shielded transfers (deposit blending)           │
│   • Merkle tree of deposits (nullifier tracking)                            │
│   • Deposit/withdrawal accounting (prevents pool drain attacks)             │
│   • Migration path from per-payment stealth PDAs                            │
│                                                                             │
│   Track C: Mina Protocol Integration (Relationship Leverage)                │
│   ──────────────────────────────────────────────────────────                │
│   • Mina Kimchi proofs for succinct verification                            │
│   • Explore SIP as native Mina zkApp                                        │
│   • Mina Foundation grant opportunity ($50-100K)                            │
│                                                                             │
│   Track D: Zcash Cross-Chain Route (Full Cross-Chain Privacy)               │
│   ─────────────────────────────────────────────────────────                 │
│   • Flow: SOL → ZEC (shielded) → NEAR                                       │
│   • Trade-off: Slower (2 hops) but FULL privacy                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Track | Status |
|-------|-------------|-------|--------|
| [#825](../../issues/825) | [EPIC] Full Privacy Architecture + Mina Integration | - | 🔲 Planned |
| [#940](../../issues/940) | **ZK claim_proof circuit (Noir)** — Nullifier + Merkle + ownership | A | 🔲 **CRITICAL** |
| [#943](../../issues/943) | **Solana claim verifier** — On-chain ZK proof verification | A | 🔲 **CRITICAL** |
| [#944](../../issues/944) | **EVM claim verifier** — Solidity verifier contract | A | 🔲 **CRITICAL** |
| [#941](../../issues/941) | **Pool PDA architecture** — Single escrow for all deposits | B | 🔲 **CRITICAL** |
| [#942](../../issues/942) | **Merkle tree for deposits** — Tracking nullifiers + commitments | B | 🔲 **CRITICAL** |
| [#945](../../issues/945) | **SDK privateClaim API** — `sip.privateClaim({ proof })` | A | 🔲 Planned |
| [#827](../../issues/827) | Mina zkApp exploration | C | 🔲 Planned |
| [#828](../../issues/828) | Mina Foundation grant application | C | 🔲 Planned |
| [#829](../../issues/829) | Zcash shielded pool integration | D | 🔲 Planned |
| [#830](../../issues/830) | SOL → ZEC → NEAR routing | D | 🔲 Planned |
| [#831](../../issues/831) | Cross-chain bridge selection (LayerZero) | D | 🔲 Planned |
| [#832](../../issues/832) | SDK API: `sip.crossChainPrivate(...)` | D | 🔲 Planned |
| [#833](../../issues/833) | Halo2 + Kimchi compatibility analysis | C | 🔲 Research |
| [#834](../../issues/834) | Halo2 IPA Verifier Research (Tachyon-informed) | C | 🔲 Research |
| [#835](../../issues/835) | PCD Wallet State Architecture (Tachyon-informed) | C | 🔲 Research |
| [#836](../../issues/836) | Proof composition architecture design | C | 🔲 Research |
| [#837](../../issues/837) | Prototype: Zcash privacy + Mina verification | C | 🔲 Research |

> **Note:** Track C items informed by [Project Tachyon](https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/) — Zcash's scaling roadmap by Sean Bowe. Tachyon's Proof-Carrying Data (PCD) model and oblivious synchronization approach align with SIP's architecture and validate our stealth address design.

**Intent Network Strategy:**

| System | Role | Priority |
|--------|------|----------|
| **NEAR Intents** | Fast cross-chain settlement | Tier 1 (current) |
| **Mina Protocol** | ZK privacy + proof composition | Tier 1 (M19) |
| **Zcash Pool** | Full privacy cross-chain route | Tier 1 (M19) |
| Anoma | Watch for FHE/MPC delivery | Tier 2 (future) |

**Target**: Mina Kimchi integration + Zcash route working for full cross-chain privacy.

---

#### M20: Technical Moat Building + Privacy Hardening 🔲 Q4 2026

Build unique capabilities that create defensible advantage. Complete the **100% privacy** implementation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    M20: PRIVACY HARDENING + TECHNICAL MOAT                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Privacy Hardening (90% → 100%):                                           │
│   ──────────────────────────────                                            │
│   • Batched claim aggregation (multiple claims in one tx)                   │
│   • Randomized claim delays (break timing correlation)                      │
│   • Fixed denomination pools (optional, stronger anonymity)                 │
│   • Relayer network (hide claimer IP + wallet)                              │
│                                                                             │
│   Technical Moat:                                                           │
│   ─────────────                                                             │
│   • Proof composition v1 (Zcash + Mina)                                     │
│   • **Inco custom FHE program** (complex encrypted operations)              │
│   • Quantum-resistant storage (Winternitz vaults)                           │
│   • Multi-language SDKs (Python, Rust, Go)                                  │
│   • Protocol revenue (NEAR fee contract)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Status |
|-------|-------------|--------|
| [#839](../../issues/839) | [EPIC] Technical Moat Building | 🔲 Planned |
| [#840](../../issues/840) | Proof composition v1 implementation | 🔲 Research |
| [#841](../../issues/841) | Composed proof benchmarks | 🔲 Planned |
| [#842](../../issues/842) | **Oblivious Sync Service** (Tachyon-inspired) | 🔲 Planned |
| [#843](../../issues/843) | **Quantum-Resistant Storage** (Winternitz Vaults) | 🔲 Planned |
| [#844](../../issues/844) | **WOTS+ Post-Quantum Signatures** for stealth addresses | 🔲 Planned |
| [#845](../../issues/845) | **BNB Chain support** (4.32M daily wallets, Asia market) | 🔲 Planned |
| [#846](../../issues/846) | PancakeSwap integration | 🔲 Planned |
| [#847](../../issues/847) | Chain-specific optimizations | 🔲 Planned |
| [#848](../../issues/848) | Python SDK | 🔲 Planned |
| [#849](../../issues/849) | Rust SDK | 🔲 Planned |
| [#850](../../issues/850) | Go SDK | 🔲 Planned |
| [#851](../../issues/851) | NEAR fee contract (protocol revenue) | 🔲 Planned |
| [#852](../../issues/852) | Governance token design | 🔲 Planned |
| [#853](../../issues/853) | Fee distribution mechanism | 🔲 Planned |
| [#946](../../issues/946) | **Batched Claim Aggregation** — Multiple claims in one tx | 🔲 Planned |
| [#947](../../issues/947) | **Randomized Claim Delays** — Break timing correlation | 🔲 Planned |
| [#948](../../issues/948) | **Fixed Denomination Pools** — Stronger anonymity sets | 🔲 Planned |
| [#949](../../issues/949) | **Relayer Network** — Hide claimer IP + wallet | 🔲 Planned |

**Quantum-Resistant Storage (Winternitz Vaults):**

SIP + Winternitz Vault integration provides post-quantum security for Solana storage.

| Layer | Technology | Protection |
|-------|------------|------------|
| Privacy | SIP (Stealth + Pedersen) | Hidden sender/amount/recipient |
| Quantum | Winternitz WOTS | 128-bit post-quantum security |
| Compliance | Viewing Keys | Audit trail for regulators |

See [QUANTUM-RESISTANT-STORAGE.md](docs/specs/QUANTUM-RESISTANT-STORAGE.md) for technical specification.

**BNB Chain Strategy:** Highest daily active wallets (4.32M). EVM-compatible = reuse M18 Solidity contract. Integrate with PancakeSwap. Gelato relayer works on BSC.

**Target**: Unique capabilities that competitors cannot easily replicate.

---

#### M21: Standard Proposal 🔲 Q4 2026

Formalize SIP as an industry standard.

| Issue | Description | Status |
|-------|-------------|--------|
| [#854](../../issues/854) | [EPIC] Standard Proposal (SIP-EIP) | 🔲 Planned |
| [#855](../../issues/855) | SIP-EIP formal specification | 🔲 Planned |
| [#856](../../issues/856) | Cross-chain privacy standard proposal | 🔲 Planned |
| [#857](../../issues/857) | Reference implementation documentation | 🔲 Planned |
| [#858](../../issues/858) | Compliance framework documentation | 🔲 Planned |
| [#859](../../issues/859) | Audit trail specification | 🔲 Planned |
| [#860](../../issues/860) | Viewing key disclosure standard | 🔲 Planned |
| [#861](../../issues/861) | Industry working group formation | 🔲 Planned |
| [#862](../../issues/862) | Ethereum Magicians forum submission | 🔲 Planned |
| [#863](../../issues/863) | ETH Denver 2026 presentation | 🔲 Planned |
| [#864](../../issues/864) | Wallet provider outreach | 🔲 Planned |
| [#865](../../issues/865) | DEX partnership strategy | 🔲 Planned |
| [#866](../../issues/866) | SIP standard announcement blog post | 🔲 Planned |
| [#867](../../issues/867) | SIP-EIP explainer video | 🔲 Planned |
| [#868](../../issues/868) | Adoption metrics framework | 🔲 Planned |
| [#869](../../issues/869) | Wallet SDK integration specification | 🔲 Planned |

**Target**: SIP recognized as the privacy standard for Web3.

---

#### M22: Institutional + Agent Custody 🔲 2027 (NEW)

Enterprise adoption through custody integration + AI agent compliance (a16z "Know Your Agent").

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   M22: INSTITUTIONAL + AGENT CUSTODY                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Viewing Key APIs for Institutional Custodians + AI Agents                  │
│   ───────────────────────────────────────────────────────────                │
│   • Fireblocks, Anchorage, BitGo, Coinbase Prime                            │
│   • Custodian generates viewing key pair                                    │
│   • User grants viewing key access to custodian OR AI agent                 │
│   • Custodian/Agent can: view tx history, generate reports, prove balances  │
│   • Custodian/Agent CANNOT: spend funds or see other users' transactions    │
│                                                                             │
│   NEW: Agent Privacy (a16z "Know Your Agent")                                │
│   ─────────────────────────────────────────────                              │
│   • AI treasury managers get scoped viewing keys                            │
│   • Time-bound + permission-scoped delegation                               │
│   • Cryptographic credentials for agent compliance                          │
│   • First-mover on agent compliance = market leadership                     │
│                                                                             │
│   Why This Matters:                                                          │
│   • DAOs need compliant treasury privacy                                    │
│   • Institutions require audit trails for regulators                        │
│   • Enterprise = recurring revenue + credibility                            │
│   • Required for Series A fundraising story                                 │
│   • 2026+: AI agents will manage significant treasury operations            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Category | Status |
|-------|-------------|----------|--------|
| [#870](../../issues/870) | [EPIC] Institutional + Agent Custody | - | 🔲 Planned |
| [#871](../../issues/871) | Fireblocks viewing key API integration | Institutional | 🔲 Planned |
| [#872](../../issues/872) | Anchorage compliance dashboard integration | Institutional | 🔲 Planned |
| [#873](../../issues/873) | BitGo multi-sig + viewing keys integration | Institutional | 🔲 Planned |
| [#874](../../issues/874) | Coinbase Prime exploration | Institutional | 🔲 Planned |
| [#875](../../issues/875) | Compliance REST API | Institutional | 🔲 Planned |
| [#876](../../issues/876) | Time-bound viewing key delegation | Institutional | 🔲 Planned |
| [#877](../../issues/877) | Audit report generation | Institutional | 🔲 Planned |
| [#878](../../issues/878) | Compliance dashboard UI | Institutional | 🔲 Planned |
| [#879](../../issues/879) | **Agent viewing key delegation API** | Agent | 🔲 Planned |
| [#880](../../issues/880) | **Agent credential standard (Know Your Agent)** | Agent | 🔲 Planned |
| [#881](../../issues/881) | Scoped agent permissions | Agent | 🔲 Planned |
| [#882](../../issues/882) | Agent audit trail | Agent | 🔲 Planned |
| [#883](../../issues/883) | Agent identity verification | Agent | 🔲 Planned |
| [#884](../../issues/884) | Enterprise SSO integration | Enterprise | 🔲 Planned |
| [#885](../../issues/885) | Multi-tenant architecture | Enterprise | 🔲 Planned |
| [#886](../../issues/886) | SLA & support documentation | Enterprise | 🔲 Planned |

**Target**: Viewing key integration with top 3 institutional custodians + agent compliance framework.

---

## Competitive Positioning

### External Validation: a16z Big Ideas 2026

> **"Bridging tokens is easy, bridging secrets is hard."**
> **"Privacy will form the most important moat in future crypto architecture."**
> — Andreessen Horowitz, [8 Big Ideas for 2026](https://a16zcrypto.substack.com/p/8-big-ideas-for-2026-and-more-trends)

a16z's January 2026 "8 Big Ideas for Crypto in 2026" directly validates SIP's core thesis. **Big Idea #6: "Privacy as the Ultimate Moat"** is essentially a thesis statement FOR SIP:

| # | a16z Big Idea | SIP Alignment | Roadmap |
|---|---------------|---------------|---------|
| **9** | **Privacy as Chain Moat** — "Privacy creates network effects and lock-in" | SIP = multi-chain privacy standard (the moat) | Core thesis |
| **11** | **Secrets-as-a-Service** — Programmable data access + client-side encryption + decentralized key management | Viewing keys = selective disclosure for compliance | M13 ✅ |
| **6** | **Know Your Agent (KYA)** — Non-human identities need cryptographic credentials linking agents to principals | Agent viewing key delegation + credential standard | M22 🔲 |
| **15** | **SNARKs for Verifiable Cloud** — Proving overhead dropped from 1M× to ~10K× | Noir circuits + browser proving already working | M10 ✅ |
| **4** | **Internet Becomes the Bank** — AI agents need programmable payments | Private agent treasury management | M22 🔲 |
| **12** | **Spec is Law** — Formal verification + runtime invariants | ZK proofs = cryptographic guarantees | M8-M10 ✅ |

**Key Insight #6 (Privacy as the Ultimate Moat):**
> "Privacy is the one feature most blockchains lack but that could differentiate them fundamentally... Privacy creates network effects and lock-in, potentially enabling a handful of privacy chains to own most of crypto's activity."

**SIP's Chain-Agnostic Advantage:**

a16z argues private chains win via lock-in. SIP flips this — we provide the privacy moat at the **middleware layer**, not the chain layer:

```
a16z model:  Private Chain A ←→ (hard to bridge) ←→ Private Chain B
SIP model:   Any Chain → SIP Privacy Layer → Settle Anywhere
```

- Users get privacy benefits without chain lock-in
- SIP itself becomes the moat (not the chain)
- "OpenRouter for privacy" — single API, multiple backends

**Key Insight #11 (Secrets-as-a-Service):**
> "New technologies offering programmable data access rules, client-side encryption, and decentralized key management—enforced on-chain—can make privacy core infrastructure rather than an afterthought."

SIP's viewing keys = programmable disclosure. This is our competitive advantage vs mixers.

**Implication**: a16z is signaling to the market that privacy infrastructure is the next major investment thesis. SIP is positioned exactly for this — not as a "privacy feature" but as **the privacy standard**.

---

### The Privacy Landscape (Updated Dec 2025)

| Solution | Same-Chain | Cross-Chain | Privacy Type | Amount Hidden | Compliance | Risk Level |
|----------|------------|-------------|--------------|---------------|------------|------------|
| **PrivacyCash** | ✅ Solana | ❌ | Pool mixing | ❌ Visible | ❌ | 🔴 HIGH |
| Tornado Cash | ✅ ETH | ❌ | Pool mixing | ❌ Visible | ❌ | ✅ Delisted |
| Aztec | ✅ ETH L2 | ❌ | ZK native | ✅ Hidden | ⚠️ Limited | 🟡 MEDIUM |
| Railgun | ✅ ETH | ❌ | ZK shielded | ✅ Hidden | ❌ | 🔴 HIGH |
| Arcium | ⚠️ Testnet | ❌ | MPC compute | ✅ Hidden | ⚠️ Limited | 🟡 MEDIUM |
| Zcash | ✅ ZEC | ❌ | Native shielded | ✅ Hidden | ✅ Viewing keys | 🟢 LOW |
| **SIP Protocol** | ✅ Multi | ✅ Multi | Stealth + Pedersen | ✅ Hidden | ✅ Viewing keys | 🟢 LOW |
| **SIP + Winternitz** | ✅ Solana | - | Stealth + WOTS | ✅ Hidden | ✅ Viewing keys | 🟢 LOW + QR* |

*QR = Quantum Resistant (128-bit post-quantum security via Winternitz One-Time Signatures)

> **Key insight:** PrivacyCash's main weakness isn't fixed pools (they support arbitrary amounts) — it's that amounts are VISIBLE on-chain, enabling correlation attacks. SIP hides amounts via Pedersen commitments.

### SIP's Unique Position

```
                    COMPLIANT
                        │
                        │
     ZCASH              │           SIP PROTOCOL ★
     (native privacy    │           (stealth + viewing keys
      but single chain) │            cross-chain + same-chain)
                        │
                        │
SINGLE-CHAIN ───────────┼─────────── MULTI-CHAIN
                        │
                        │
     PRIVACY CASH       │           ???
     (pool mixer        │           (no one here yet)
      Solana only)      │
                        │
                        │
                   NON-COMPLIANT
```

**SIP occupies the most valuable quadrant: Multi-chain + Compliant.**

### Our Moats

| Moat Type | Description | Timeline |
|-----------|-------------|----------|
| **Standardization** | One API, many backends | M9-M12 ✅ |
| **Network Effects** | Solver liquidity, user volume | M12+ |
| **Same-Chain Expansion** | Bigger market, better product | M16-M18 🎯 |
| **Compliance** | Viewing keys for institutions | Built-in ✅ |
| **Proof Composition** | Unique technical capabilities | M19-M20 |
| **Multi-Foundation** | Supported by multiple ecosystems | M10+ |

---

## Multi-Foundation Strategy

SIP is **chain-agnostic** — we enhance every chain, compete with none.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SIP MULTI-FOUNDATION APPROACH                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SUPERTEAM       SOLANA        ZCASH         NEAR          ETHEREUM       │
│   Microgrant      Foundation    Foundation    Foundation    Foundation     │
│      │               │             │             │              │          │
│      │  "Community"  │  "SOL       │  "Privacy   │  "Intents    │  "EVM   │
│      │               │   privacy"  │   expert"   │   privacy"   │  privacy"│
│      │               │             │             │              │          │
│      └───────────────┴──────┬──────┴─────────────┴──────────────┘          │
│                             │                                               │
│                             ▼                                               │
│                      ┌─────────────┐                                        │
│                      │ SIP PROTOCOL│                                        │
│                      │  "Privacy   │                                        │
│                      │   for ALL"  │                                        │
│                      └─────────────┘                                        │
│                                                                             │
│   Value to each foundation:                                                 │
│   • We showcase THEIR technology                                            │
│   • We bring privacy to THEIR users                                         │
│   • We DON'T compete with their native solutions                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Grant & Funding Roadmap

| Milestone | Timeline | Amount | Purpose | Status |
|-----------|----------|--------|---------|--------|
| **Superteam Indonesia** | Jan 2026 | $10K | Community + Narrative | ✅ **APPROVED** |
| **Solana Audit Subsidy V** | Feb 2026 | Up to $50K | Security audit funding | ⏳ Pending (Feb 7) |
| **Solana Foundation** | Feb-Mar 2026 | $100K | Solana Same-Chain Privacy | 📋 Planned |
| **Mina Foundation** | H2 2026 | $50-100K | Proof composition (Zypherpunk relationship) | 🔲 Planned |
| NEAR Foundation | H2 2026 | $50K | Cross-chain enhancement (hackathon leverage) | 🔲 Planned |
| Ethereum ESP | Q3 2026 | $100K+ | ETH Same-Chain Privacy | 🔲 Planned |
| **Seed Round** | Q3-Q4 2026 | $1-2M | Scale operations | 🔲 Future |

**Total Pipeline:** $260K-$310K

---

## Design Principles

1. **Privacy is a Right**: Not a feature, a fundamental capability
2. **Chain-Agnostic**: Enhance every chain, compete with none
3. **Complement, Don't Compete**: Leverage Zcash, Mina, NEAR — don't rebuild
4. **Standardization First**: One API, many backends
5. **Compliance-Ready**: Viewing keys for regulatory compatibility
6. **Technical Moat**: Proof composition creates defensible advantage
7. **Same-Chain + Cross-Chain**: Complete privacy solution

---

## Status Summary

### Test Suite

| Package | Tests | Status |
|---------|-------|--------|
| @sip-protocol/sdk | 6,603 | ✅ |
| @sip-protocol/react | 82 | ✅ |
| @sip-protocol/cli | 10 | ✅ |
| @sip-protocol/api | 18 | ✅ |
| @sip-protocol/react-native | 10 | ✅ |
| **Total** | **6,661+** | ✅ |

### Achievements

- 🏆 **Zypherpunk Hackathon Winner — #9/93, 3 Tracks** ($6,500: NEAR $4,000 + Tachyon $500 + pumpfun $2,000) — Dec 2025
- 💰 **Superteam Indonesia Grant — APPROVED** ($10,000 USDC) — Jan 2026
- 📦 **npm packages published** — @sip-protocol/sdk v0.9.0 (7 packages total)
- 🌐 **Live sites** — sip-protocol.org, docs.sip-protocol.org, app.sip-protocol.org, blog.sip-protocol.org, sipher.sip-protocol.org
- ✅ **Phase 1-3 complete** — M1-M17 done (7,504+ tests)
- 🚀 **Mainnet deployed** — `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (Jan 31, 2026)
- 📝 **M16 Narrative Capture** — 25 blog posts (exceeded 12 target)
- 🔐 **M17 Solana Privacy** — Full SDK implementation, 25 issues closed

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Current focus areas:**
- M18: Ethereum same-chain privacy module — Active development
- Base L2 deployment (highest priority)
- Superteam T1-T3 deliverables (deadline: Mar 31, 2026)
- Solana Foundation grant application (Feb-Mar 2026)
- Production hardening & audit preparation

---

*Last updated: March 1, 2026*
*M16-M17 Complete | M18 In Progress (22/24 issues done) | Superteam Grant APPROVED ($10K)*
*7,624+ tests | 7 packages | Full Privacy Architecture documented (M19-M20)*
*M18: 294 Foundry tests, deployed on 7 testnets (Sepolia, Base, OP, Arbitrum, Scroll, Linea, Mode). SIPRelayer on 4 chains. GelatoRelayAdapter in SDK (23 tests). Blast/Mantle/zkSync pending.*
