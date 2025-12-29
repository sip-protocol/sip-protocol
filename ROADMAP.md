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
│   • Discord community (500+ developers) + Twitter presence (50K impressions)│
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

## Strategic Architecture: C+B Hybrid

SIP combines two complementary strategies:

### Option C: Settlement Aggregator (Core Value)

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

### Option B: Proof Aggregator (Technical Moat)

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
| Privacy | Option C | Core value, standardization | Network effects |
| Proofs | Option B | Technical differentiation | Innovation |
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
• Demo ✅               • Multi-Settlement ✅  • Hardware wallets ✅ • Solana Anchor   • SIP-EIP
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
| [#40](../../issues/40) | Demo application polish | ✅ Done |
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

#### M7: Real Demo Integration ✅ Complete

Connect demo UI to real SDK with actual blockchain transactions.

| Issue | Description | Status |
|-------|-------------|--------|
| [#54](../../issues/54) | [EPIC] Real Demo Integration | ✅ Done |
| [#55](../../issues/55) | Wallet connection component (Phantom, MetaMask) | ✅ Done |
| [#56](../../issues/56) | SDK client initialization | ✅ Done |
| [#57](../../issues/57) | Testnet configuration (Solana Devnet, Sepolia) | ✅ Done |
| [#58](../../issues/58) | Quote flow integration (1Click API) | ✅ Done |
| [#59](../../issues/59) | Transaction execution flow | ✅ Done |
| [#60](../../issues/60) | Explorer links and tx status | ✅ Done |
| [#61](../../issues/61) | Error handling and edge cases | ✅ Done |

**Achievement**: Full demo with wallet connection, quote fetching, transaction execution. 122 tests in sip-website.

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

#### M16: Narrative Capture & Positioning 🔲 Q1 2026

Establish SIP as "the right way to do privacy" before competitors solidify.

| Issue | Description | Budget | Status |
|-------|-------------|--------|--------|
| [#229](../../issues/229) | [EPIC] Narrative Capture | $10K total | 🎯 Starting |
| - | Content Campaign (8 articles + 15 threads) | $4,500 (45%) | 🔲 Planned |
| - | Community Building (Discord + Twitter) | $3,500 (35%) | 🔲 Planned |
| - | Ecosystem Presentations (3 events) | $2,000 (20%) | 🔲 Planned |

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
| - | [EPIC] SIP Solana Program (Anchor) | - | 🔲 Planned |
| - | Anchor program: shielded_transfer instruction | Critical | 🔲 Planned |
| - | Anchor program: claim_transfer instruction | Critical | 🔲 Planned |
| - | On-chain Pedersen commitment verification | Critical | 🔲 Planned |
| - | On-chain ZK proof verifier (Noir→Solana) | Critical | 🔲 Planned |
| - | Ed25519 stealth address scanning | Critical | 🔲 Planned |
| - | Viewing key disclosure mechanism | High | 🔲 Planned |
| - | SDK API: `sip.shieldedTransfer(solana, ...)` | High | 🔲 Planned |
| - | Jupiter DEX integration (private swaps) | High | 🔲 Planned |
| - | **Jito relayer integration** (gas abstraction) | High | 🔲 Planned |
| - | Anchor program audit preparation | High | 🔲 Planned |
| - | Same-chain test suite (100+ tests) | High | 🔲 Planned |
| - | Developer documentation | Medium | 🔲 Planned |

**Relayer Strategy:** Use Jito for gas abstraction — no dedicated infrastructure needed. User signs shielded tx → Jito relayer submits → Pays gas → Gets fee from commitment. Relayer is gas-only (not asset movement) = lower regulatory risk.

**Why SIP beats PrivacyCash:**

| Feature | PrivacyCash (Mixer) | SIP Anchor (Cryptographic) |
|---------|---------------------|----------------------------|
| Privacy method | Pool mixing | Pedersen + Stealth |
| Amount privacy | ❌ Visible on-chain | ✅ Hidden (Pedersen commitment) |
| Any amount | ✅ Arbitrary amounts | ✅ Arbitrary amounts |
| Amount correlation | ❌ Vulnerable (amounts visible) | ✅ Protected (amounts hidden) |
| Speed | ⚡ Instant | ⚡ Instant |
| Compliance | ❌ None | ✅ Viewing keys |
| Regulatory risk | 🔴 HIGH (mixer) | 🟢 LOW (cryptographic) |
| Gas abstraction | ❌ No relayer | ✅ Jito relayer integration |
| On-chain code | Circom ZK circuits | Noir + Anchor |

> **Note:** PrivacyCash supports arbitrary amounts, but amounts are VISIBLE on-chain. This enables correlation attacks — if Alice deposits 1.337 SOL (unique amount), tracking that withdrawal is trivial. SIP hides amounts cryptographically via Pedersen commitments.

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
| - | [EPIC] SIP Ethereum Contract (Solidity) | - | 🔲 Planned |
| - | Solidity contract: shieldedTransfer function | Critical | 🔲 Planned |
| - | Solidity contract: claimTransfer function | Critical | 🔲 Planned |
| - | On-chain Pedersen commitment verification | Critical | 🔲 Planned |
| - | On-chain ZK proof verifier (Noir→EVM) | Critical | 🔲 Planned |
| - | EIP-5564 stealth address implementation | Critical | 🔲 Planned |
| - | Viewing key disclosure mechanism | High | 🔲 Planned |
| - | SDK API: `sip.shieldedTransfer(ethereum, ...)` | High | 🔲 Planned |
| - | **Gelato/ERC-4337 relayer** (gas abstraction) | High | 🔲 Planned |
| - | **L2 Tier 1: Base, Arbitrum, Optimism** | Critical | 🔲 Planned |
| - | L2 Tier 2: Polygon, zkSync (if survives) | Medium | 🔲 Planned |
| - | Gas optimization (batching, storage packing) | Medium | 🔲 Planned |
| - | Integration examples (Uniswap, 1inch) | Medium | 🔲 Planned |

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
| - | **BNB Chain support** (4.32M daily wallets, Asia market) | 🔲 Future |
| - | Multi-language SDK (Python, Rust) | 🔲 Future |
| - | Chain-specific optimizations | 🔲 Future |
| - | NEAR fee contract (protocol revenue) | 🔲 Future |
| - | Governance token design | 🔲 Future |

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

#### M22: Institutional Custody 🔲 2027 (NEW)

Enterprise adoption through custody integration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      M22: INSTITUTIONAL CUSTODY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Viewing Key APIs for Institutional Custodians                              │
│   ───────────────────────────────────────────────                            │
│   • Fireblocks, Anchorage, BitGo, Coinbase Prime                            │
│   • Custodian generates viewing key pair                                    │
│   • User grants viewing key access to custodian                             │
│   • Custodian can: view tx history, generate reports, prove balances       │
│   • Custodian CANNOT: spend funds or see other users' transactions         │
│                                                                             │
│   Why This Matters:                                                          │
│   • DAOs need compliant treasury privacy                                    │
│   • Institutions require audit trails for regulators                        │
│   • Enterprise = recurring revenue + credibility                            │
│   • Required for Series A fundraising story                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Institutional Custody | 🔲 Future |
| - | Fireblocks viewing key API integration | 🔲 Future |
| - | Anchorage compliance dashboard | 🔲 Future |
| - | BitGo multi-sig + viewing keys | 🔲 Future |
| - | Coinbase Prime exploration | 🔲 Future |
| - | Compliance REST API | 🔲 Future |
| - | Time-bound viewing key delegation | 🔲 Future |

**Target**: Viewing key integration with top 3 institutional custodians.

---

## Competitive Positioning

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
- M16: Narrative capture and competitive positioning
- M17: Solana same-chain privacy module
- External security audit (M8 completion)
- Foundation grant applications

---

*Last updated: December 29, 2025*
