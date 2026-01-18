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
• SDK ✅                • Stable Core ✅       • Compliance ✅       • Narrative       • Zcash route
• NEAR adapter ✅       • ZK Production ✅     • React/CLI/API ✅      Capture         • Proof compo
• App ✅                • Multi-Settlement ✅  • Hardware wallets ✅ • Solana Anchor   • SIP-EIP
• Noir circuits ✅      • Multi-Chain ✅       • WalletConnect ✅    • ETH Solidity    • $5B vol
• 2,757 tests ✅        • 15+ chains ✅        • 157 new tests ✅    • Full privacy    • Industry std
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
| [#384-391](../../issues?q=is%3Aissue+M16+article) | Content Campaign (8 articles + 15 threads) | $4,500 (45%) | ✅ Done |
| [#392-395](../../issues?q=is%3Aissue+M16+community) | Community Building (Discord + Twitter) | $3,500 (35%) | ✅ Done |
| [#396](../../issues/396) | Ecosystem Presentations (3 events) | $2,000 (20%) | ✅ Done |

**Deliverables:**
- **Content:** 8 technical articles (Medium, Mirror, dev.to) + 15 Twitter threads
- **Community:** Discord launch → 500+ members, developer support channels
- **Events:** 3 Superteam ecosystem presentations + 5 dApp partnership LOIs

**Success Metrics (KPIs):**

| Metric | Month 1 Target | Month 2 Target |
|--------|---------------|----------------|
| Twitter Impressions | 25K | 50K total |
| Discord Members | 200 | 500 |
| Article Reads | 1K | 3K total |
| dApp LOIs | 2 | 5 |

**Alignment:** Superteam Microgrant ($10K) deliverables

---

#### M17: Solana Same-Chain Privacy (Anchor Program) 🔲 Q1-Q2 2026

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
| [#401](../../issues/401) | [EPIC] SIP Solana Program (Anchor) | - | 🔲 Planned |
| [#399](../../issues/399) | Anchor program: shielded_transfer instruction | Critical | 🔲 Planned |
| [#400](../../issues/400) | Anchor program: claim_transfer instruction | Critical | 🔲 Planned |
| [#402](../../issues/402) | On-chain Pedersen commitment verification | Critical | 🔲 Planned |
| [#403](../../issues/403) | On-chain ZK proof verifier (Noir→Solana) | Critical | 🔲 Planned |
| [#262](../../issues/262) | Ed25519 stealth address scanning | Critical | 🔲 Planned |
| [#479](../../issues/479) | Viewing key disclosure mechanism | High | 🔲 Planned |
| [#374](../../issues/374) | SDK API: `sip.shieldedTransfer(solana, ...)` | High | 🔲 Planned |
| [#454](../../issues/454) | Jupiter DEX integration (private swaps via Dark AMMs) | High | 🔲 Planned |
| [#421](../../issues/421) | **Jito relayer integration** (gas abstraction) | High | 🔲 Planned |
| [#404](../../issues/404) | Anchor program audit preparation | High | 🔲 Planned |
| [#379](../../issues/379) | Same-chain test suite (100+ tests) | High | 🔲 Planned |
| [#377](../../issues/377) | Developer documentation | Medium | 🔲 Planned |
| [#441](../../issues/441) | **[OPT] Winternitz Vault integration** (quantum-resistant storage) | Medium | 🔲 Planned |
| [#493](../../issues/493) | **SolanaRPCProvider interface** (unified provider abstraction) | High | 🔲 Planned |
| [#446](../../issues/446) | **Helius DAS adapter** (token queries via DAS API) | High | 🔲 Planned |
| [#494](../../issues/494) | **QuickNode adapter** (Yellowstone gRPC streams) | Medium | 🔲 Planned |
| [#495](../../issues/495) | **Triton adapter** (Geyser plugin integration) | Medium | 🔲 Planned |
| [#496](../../issues/496) | **Generic RPC adapter** (standard RPC fallback) | High | 🔲 Planned |
| [#456](../../issues/456) | **Helius Enhanced Transactions** (better UX) | Medium | 🔲 Planned |
| [#447](../../issues/447) | **Helius Webhooks** (real-time payment notifications) | Medium | 🔲 Planned |
| [#457](../../issues/457) | **Sunspot pipeline** (Noir → ACIR → Groth16 → Solana verifier) | Critical | 🔲 Planned |
| [#445](../../issues/445) | **Devnet deployment** (verifier.so + reference app) | Critical | 🔲 Planned |
| [#480](../../issues/480) | **PrivacyCash Adapter** (pool mixing backend) | High | 🔲 Planned |
| [#481](../../issues/481) | **Arcium Adapter** (MPC compute privacy) | Medium | 🔲 Planned |
| [#482](../../issues/482) | **Inco Adapter** (FHE compute privacy) | Medium | 🔲 Planned |
| [#483](../../issues/483) | **PrivacyBackend interface** (unified backend abstraction) | High | 🔲 Planned |
| [#487](../../issues/487) | **SmartRouter v2** (backend selection logic) | Medium | 🔲 Planned |
| [#489](../../issues/489) | **Network Privacy** (Tor/SOCKS5 proxy support) | Medium | 🔲 Planned |
| [#472](../../issues/472) | **app.sip-protocol.org** (dedicated app subdomain) | High | 🔲 Planned |

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
│   • PrivacyCash — Pool mixing (integrated as backend)                       │
│                                                                             │
│   COMPUTE PRIVACY (What happens inside contracts):                          │
│   ────────────────────────────────────────────────                          │
│   • Arcium — MPC (Multi-Party Computation)                                  │
│   • Inco — FHE (Fully Homomorphic Encryption)                               │
│                                                                             │
│   COMPLETE PRIVACY = Transaction Privacy + Compute Privacy                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Privacy Backend Comparison:**

| Backend | Type | Amount Hidden | Sender Hidden | Compute Hidden | Compliance | Best For |
|---------|------|---------------|---------------|----------------|------------|----------|
| **SIP Native** | ZK + Stealth | ✅ Pedersen | ✅ Stealth | ❌ | ✅ Viewing keys | Compliant payments |
| **PrivacyCash** | Pool Mixing | ❌ Visible | ✅ Pool | ❌ | ❌ | Anonymity set |
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
- Anchor program deployed to devnet
- 100+ test cases passing
- Developer preview released
- 3 dApp integration POCs

**Alignment:** Solana Foundation Grant ($100K) primary deliverable

---

#### M18: Ethereum Same-Chain Privacy (Solidity Contract) 🔲 Q2 2026

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
| [#405](../../issues/405) | [EPIC] SIP Ethereum Contract (Solidity) | - | 🔲 Planned |
| [#406](../../issues/406) | Solidity contract: shieldedTransfer function | Critical | 🔲 Planned |
| [#407](../../issues/407) | Solidity contract: claimTransfer function | Critical | 🔲 Planned |
| [#408](../../issues/408) | On-chain Pedersen commitment verification | Critical | 🔲 Planned |
| [#409](../../issues/409) | On-chain ZK proof verifier (Noir→EVM) | Critical | 🔲 Planned |
| [#410](../../issues/410) | EIP-5564 stealth address implementation | Critical | 🔲 Planned |
| [#382](../../issues/382) | Viewing key disclosure mechanism | High | 🔲 Planned |
| [#382](../../issues/382) | SDK API: `sip.shieldedTransfer(ethereum, ...)` | High | 🔲 Planned |
| [#422](../../issues/422) | **Gelato/ERC-4337 relayer** (gas abstraction) | High | 🔲 Planned |
| [#458](../../issues/458) | **L2 Tier 1: Base, Arbitrum, Optimism** | Critical | 🔲 Planned |
| - | L2 Tier 2: Polygon, zkSync (if survives) | Medium | 🔲 Planned |
| - | Gas optimization (batching, storage packing) | Medium | 🔲 Planned |
| [#459](../../issues/459) | Integration examples (Uniswap, 1inch) | Medium | 🔲 Planned |

**L2 Strategy (Based on Dec 2025 Market Data):**
- **Base** (60%+ tx share), **Arbitrum** (44% TVL), **Optimism** (6% TVL) = 90%+ of L2 market
- Same Solidity contract deploys to all EVM L2s (just different RPC endpoints)
- Per 21Shares analysis: most other L2s may not survive 2026 consolidation

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

#### M19: Mina Integration & Proof Research 🔲 Q3 2026

**Why Mina?** Mina sponsored Zypherpunk hackathon (where SIP won). Privacy-native ZK. Kimchi proof system aligns with our proof composition plans.

Three parallel tracks: **Mina integration** (relationship leverage), **Zcash cross-chain route** (immediate value), and **proof composition research** (long-term moat).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      M19: MINA + CROSS-CHAIN FULL PRIVACY                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Track A: Mina Protocol Integration (Relationship Leverage)                │
│   ──────────────────────────────────────────────────────────                │
│   • Mina Kimchi proofs for succinct verification                            │
│   • Explore SIP as native Mina zkApp                                        │
│   • Mina Foundation grant opportunity ($50-100K)                            │
│                                                                             │
│   Track B: Zcash Cross-Chain Route (Immediate Value)                        │
│   ─────────────────────────────────────────────────                         │
│   For users who need FULL cross-chain privacy (not just stealth addresses) │
│                                                                             │
│   Flow: SOL → ZEC (shielded) → NEAR                                         │
│   Trade-off: Slower (2 hops) but FULL privacy (sender, amount, recipient)   │
│                                                                             │
│   Track C: Proof Composition Research (Long-term Moat)                      │
│   ────────────────────────────────────────────────────                      │
│   • Zcash Halo2 → Privacy execution                                         │
│   • Mina Kimchi → Succinct verification                                     │
│   • Noir → Validity proofs                                                  │
│                                                                             │
│   Target: Single proof that combines privacy + light client verification   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Track | Status |
|-------|-------------|-------|--------|
| - | [EPIC] Mina + Cross-Chain Full Privacy | - | 🔲 Future |
| - | **Mina Kimchi integration** | A | 🔲 Future |
| - | **Mina zkApp exploration** | A | 🔲 Future |
| - | Zcash shielded pool integration | B | 🔲 Future |
| - | SOL → ZEC → NEAR routing | B | 🔲 Future |
| - | Cross-chain bridge selection (LayerZero) | B | 🔲 Future |
| - | SDK API: `sip.crossChainPrivate(...)` | B | 🔲 Future |
| - | Halo2 + Kimchi compatibility analysis | C | 🔲 Future |
| - | **Halo2 IPA Verifier Research** (Tachyon-informed) | C | 🔲 Future |
| - | **PCD Wallet State Architecture** (Tachyon-informed) | C | 🔲 Future |
| - | Proof composition architecture design | C | 🔲 Future |
| - | Prototype: Zcash privacy + Mina verification | C | 🔲 Future |

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

#### M20: Technical Moat Building 🔲 Q4 2026

Build unique capabilities that create defensible advantage.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Technical Moat Building | 🔲 Future |
| - | Proof composition v1 (if feasible) | 🔲 Future |
| - | **Oblivious Sync Service** (Tachyon-inspired privacy during sync) | 🔲 Future |
| - | **Quantum-Resistant Storage** (Winternitz WOTS vaults) | 🔲 Future |
| [#491](../../issues/491) | **WOTS+ Post-Quantum Signatures** (stealth address signing) | 🔲 Future |
| - | **BNB Chain support** (4.32M daily wallets, Asia market) | 🔲 Future |
| - | Multi-language SDK (Python, Rust) | 🔲 Future |
| - | Chain-specific optimizations | 🔲 Future |
| - | NEAR fee contract (protocol revenue) | 🔲 Future |
| - | Governance token design | 🔲 Future |

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
| - | [EPIC] Standard Proposal | 🔲 Future |
| - | SIP-EIP formal specification | 🔲 Future |
| - | Cross-chain privacy standard proposal | 🔲 Future |
| - | Compliance framework documentation | 🔲 Future |
| - | Industry working group formation | 🔲 Future |

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

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Institutional + Agent Custody | 🔲 Future |
| - | Fireblocks viewing key API integration | 🔲 Future |
| - | Anchorage compliance dashboard | 🔲 Future |
| - | BitGo multi-sig + viewing keys | 🔲 Future |
| - | Coinbase Prime exploration | 🔲 Future |
| - | Compliance REST API | 🔲 Future |
| - | Time-bound viewing key delegation | 🔲 Future |
| - | **Agent viewing key delegation API** | 🔲 Future |
| - | **Agent credential standard ("Know Your Agent")** | 🔲 Future |

**Target**: Viewing key integration with top 3 institutional custodians + agent compliance framework.

---

## Competitive Positioning

### External Validation: a16z Big Ideas 2026

> **"Bridging tokens is easy, bridging secrets is hard."**
> — Andreessen Horowitz, [Big Ideas: Things We're Excited About in 2026](https://a16zcrypto.com/posts/article/big-ideas-things-excited-about-crypto-2026/)

a16z's December 2025 "17 Big Ideas for Crypto in 2026" directly validates SIP's core thesis:

| # | a16z Big Idea | SIP Alignment | Roadmap |
|---|---------------|---------------|---------|
| **9** | **Privacy as Chain Moat** — "Privacy creates network effects and lock-in" | SIP = multi-chain privacy standard (the moat) | Core thesis |
| **11** | **Secrets-as-a-Service** — Programmable data access + client-side encryption + decentralized key management | Viewing keys = selective disclosure for compliance | M13 ✅ |
| **6** | **Know Your Agent (KYA)** — Non-human identities need cryptographic credentials linking agents to principals | Agent viewing key delegation + credential standard | M22 🔲 |
| **15** | **SNARKs for Verifiable Cloud** — Proving overhead dropped from 1M× to ~10K× | Noir circuits + browser proving already working | M10 ✅ |
| **4** | **Internet Becomes the Bank** — AI agents need programmable payments | Private agent treasury management | M22 🔲 |
| **12** | **Spec is Law** — Formal verification + runtime invariants | ZK proofs = cryptographic guarantees | M8-M10 ✅ |

**Key Insight #9 (Privacy as Chain Moat):**
> "Privacy is the one feature most blockchains lack but that could differentiate them fundamentally... Privacy creates network effects and lock-in, potentially enabling a handful of privacy chains to own most of crypto's activity."

This is exactly SIP's thesis — we ARE the privacy layer that creates this moat for ANY chain.

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
| **Superteam Microgrant** | Jan 2026 | $10K | Community + Narrative | 🎯 First |
| **Solana Foundation** | Feb-Mar 2026 | $100K | Solana Same-Chain Privacy | 🔲 Second |
| **Mina Foundation** | Q2 2026 | $50-100K | Proof composition (Zypherpunk relationship) | 🔲 Planned |
| NEAR Foundation | Q2 2026 | $50-100K | Cross-chain enhancement | 🔲 Planned |
| Zcash Foundation | Q2 2026 | $25-50K | Viewing keys showcase | 🔲 Planned |
| Ethereum ESP | Q3 2026 | $100K+ | ETH Same-Chain Privacy | 🔲 Planned |
| **Seed Round** | Q3-Q4 2026 | $1-2M | Scale operations | 🔲 Future |

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
| @sip-protocol/sdk | 2,474 | ✅ |
| @sip-protocol/react | 57 | ✅ |
| @sip-protocol/cli | 33 | ✅ |
| @sip-protocol/api | 67 | ✅ |
| sip-website | 126 | ✅ |
| **Total** | **2,757** | ✅ |

### Achievements

- 🏆 **Zypherpunk Hackathon NEAR Track Winner** ($4,000) — Dec 2025
- 📦 **npm packages published** — @sip-protocol/sdk v0.6.0
- 🌐 **Live sites** — sip-protocol.org, docs.sip-protocol.org
- ✅ **Phase 1-3 complete** — M1-M15 done (2,757 tests)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Current focus areas:**
- M17: Solana same-chain privacy module (30 issues)
- Solana Privacy Hack (Jan 12 - Feb 1, 2026)
- External security audit (M8 completion)
- Foundation grant applications

---

*Last updated: January 18, 2026*
*M16 Narrative Capture completed*
*Hackathon sprint active: Solana Privacy Hack (Jan 12 - Feb 1, 2026)*
