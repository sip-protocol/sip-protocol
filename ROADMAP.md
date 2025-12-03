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
└─────────────────────────────────────────────────────────────────────────────┘
```

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
│  │ PROOF COMPOSITION (Technical Moat)                                    │ │
│  │ • Zcash → Privacy execution     • Mina → Succinct verification        │ │
│  │ • Noir  → Validity proofs       • Compose proofs from multiple systems│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ "Settle anywhere"
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT LAYER (Pluggable)                                               │
│  • NEAR Intents  • Mina Protocol  • Direct Chain  • Future backends...     │
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
PHASE 1: FOUNDATION     PHASE 2: STANDARD      PHASE 3: ECOSYSTEM     ENDGAME
(2024-2025) ✅          (2026)                 (2027)                 (2028+)
     │                       │                      │                      │
     ▼                       ▼                      ▼                      ▼
┌─────────┐            ┌─────────┐            ┌─────────┐           ┌─────────┐
│ M1-M8   │            │ M9-M12  │            │ M13-M15 │           │ Privacy │
│ Core    │ ─────────► │ Multi-  │ ─────────► │ Proof   │ ────────► │Standard │
│ Tech    │            │ Backend │            │ Compose │           │ for Web3│
└─────────┘            └─────────┘            └─────────┘           └─────────┘
     │                      │                      │                      │
• SDK ✅                • Mina research        • Proof composition   • Industry
• NEAR adapter ✅       • Multi-foundation     • Technical moat       standard
• Demo ✅                 grants               • Enterprise          • SIP-EIP
• Noir circuits 🔄      • Settlement routing   • Governance           proposal
• Audit 🔲              • Use case expansion   • Chain optimization  • $5B vol
```

---

## Milestones

### PHASE 1: FOUNDATION (M1-M8) — Build Core Technology

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

---

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

---

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

---

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

---

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

---

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

---

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

---

#### M8: Production Hardening 🔄 In Progress

Real ZK circuits, security hardening, multi-curve support.

| Issue | Description | Status |
|-------|-------------|--------|
| [#62](../../issues/62) | [EPIC] Production Hardening | ✅ Done |
| [#63](../../issues/63) | Noir Funding Proof circuit | ✅ Done |
| [#64](../../issues/64) | Noir Validity Proof circuit | ✅ Done |
| [#65](../../issues/65) | Noir Fulfillment Proof circuit | ✅ Done |
| [#66](../../issues/66) | Memory zeroization for secrets | ✅ Done |
| [#67](../../issues/67) | External security audit | 🔲 Pending |
| [#91](../../issues/91) | [EPIC] Multi-Curve Stealth Addresses | 🔄 In Progress |
| [#92](../../issues/92) | ed25519 stealth address implementation | ✅ Done |
| [#93](../../issues/93) | Solana address derivation from ed25519 | ✅ Done |
| [#94](../../issues/94) | NEAR address derivation from ed25519 | ✅ Done |
| [#95](../../issues/95) | Multi-curve meta-address format | 🔲 Planned |
| [#96](../../issues/96) | Update NEAR Intents adapter for multi-curve | ✅ Done |
| [#97](../../issues/97) | Cross-chain stealth integration tests | ✅ Done |

**Achievement**: Noir circuits compiled. Secure memory handling. Multi-curve stealth in progress.

---

### PHASE 2: STANDARD (M9-M12) — Multi-Backend & Adoption

#### M9: Horizontal Expansion 🔲 Planned

New use cases beyond swaps.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Horizontal Expansion | 🔲 Planned |
| - | Private Payments (stablecoin transfers) | 🔲 Planned |
| - | DAO Treasury operations | 🔲 Planned |
| - | Enterprise Compliance dashboard | 🔲 Planned |
| - | Hardware wallet support (Ledger/Trezor) | 🔲 Planned |

**Target**: Expand beyond swaps to payments, treasury ops, enterprise.

---

#### M10: Multi-Foundation Grants 🔲 Planned

Diversify funding and partnerships across ecosystems.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Multi-Foundation Strategy | 🔲 Planned |
| - | NEAR Foundation grant application | 🔲 Planned |
| - | Zcash Community grant application | 🔲 Planned |
| - | Mina Foundation grant application | 🔲 Planned |
| - | Ethereum Foundation ESP application | 🔲 Planned |
| - | Partnership announcements (co-marketing) | 🔲 Planned |

**Target**: 3+ foundation grants, chain-agnostic positioning established.

---

#### M11: Settlement Abstraction 🔲 Planned

Abstract settlement layer for multi-backend support.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Settlement Abstraction | 🔲 Planned |
| - | Settlement router interface design | 🔲 Planned |
| - | Mina Protocol research & feasibility | 🔲 Planned |
| - | Mina settlement adapter (prototype) | 🔲 Planned |
| - | Direct chain settlement option | 🔲 Planned |
| - | Settlement selection logic | 🔲 Planned |

**Target**: Architecture supports multiple settlement backends.

---

#### M12: Partnership & Distribution 🔲 Planned

Build network effects through strategic partnerships.

| Issue | Description | Priority |
|-------|-------------|----------|
| - | Wallet integration (Phantom, Solflare native) | Critical |
| - | DEX partnership (Jupiter, Raydium) | Critical |
| - | Solver partnerships (exclusive/preferred terms) | High |
| - | Institutional onboarding program | High |
| - | Developer SDK adoption program | Medium |

**Target**: Become the default privacy option in major wallets and DEXes.

---

### PHASE 3: ECOSYSTEM (M13-M15) — Proof Composition & Moat

#### M13: Proof Composition Research 🔲 Future

Research feasibility of composing proofs from multiple systems.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Proof Composition Research | 🔲 Future |
| - | Halo2 + Kimchi compatibility analysis | 🔲 Future |
| - | Proof composition architecture design | 🔲 Future |
| - | Prototype: Zcash privacy + Mina verification | 🔲 Future |
| - | Performance benchmarks for composed proofs | 🔲 Future |

**Target**: Validate proof composition feasibility, create prototype.

---

#### M14: Technical Moat 🔲 Future

Build defensible technical advantages.

| Issue | Description | Status |
|-------|-------------|--------|
| - | [EPIC] Technical Moat Building | 🔲 Future |
| - | Proof composition v1 (if feasible) | 🔲 Future |
| - | Multi-language SDK (Python, Rust) | 🔲 Future |
| - | Chain-specific optimizations | 🔲 Future |
| - | NEAR fee contract (protocol revenue) | 🔲 Future |
| - | Governance token design | 🔲 Future |

**Target**: Unique capabilities that competitors cannot easily replicate.

---

#### M15: Standard Proposal 🔲 Future

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

## Multi-Foundation Strategy

SIP is **chain-agnostic** — we enhance every chain, compete with none.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SIP MULTI-FOUNDATION APPROACH                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ZCASH         MINA          NEAR          ETHEREUM       SOLANA          │
│   Foundation    Foundation    Foundation    Foundation     Foundation      │
│      │             │             │              │              │           │
│      │  "Privacy   │  "Succinct  │  "Intents    │  "EVM        │  "SOL     │
│      │   expert"   │   proofs"   │   privacy"   │   privacy"   │   users"  │
│      │             │             │              │              │           │
│      └─────────────┴──────┬──────┴──────────────┴──────────────┘           │
│                           │                                                 │
│                           ▼                                                 │
│                    ┌─────────────┐                                          │
│                    │ SIP PROTOCOL│                                          │
│                    │  "Privacy   │                                          │
│                    │   for ALL"  │                                          │
│                    └─────────────┘                                          │
│                                                                             │
│   Value to each foundation:                                                 │
│   • We showcase THEIR technology                                            │
│   • We bring privacy to THEIR users                                         │
│   • We DON'T compete with their native solutions                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Grant Roadmap

| Foundation | Timeline | Amount | Pitch Angle |
|------------|----------|--------|-------------|
| NEAR Foundation | Q1 2026 | $50-100K | "Privacy layer for Intents ecosystem" |
| Zcash Foundation | Q1 2026 | $25-50K | "Viewing keys showcase, cross-chain Zcash" |
| Mina Foundation | Q2 2026 | $50-100K | "Succinct verification for privacy proofs" |
| Ethereum ESP | Q2 2026 | $100K+ | "Cross-chain privacy standard for EVM" |
| Solana Foundation | Q3 2026 | $50-100K | "Privacy for Solana users" |

---

## Competitive Positioning

### The Market Gap

**No one offers private cross-chain transactions as a standard.**

| Solution | Cross-Chain | Private | Standard | Status |
|----------|-------------|---------|----------|--------|
| Wormhole/Portal | ✅ | ❌ | ❌ | Transparent only |
| deBridge | ✅ | ❌ | ❌ | Transparent only |
| Arcium | ❌ | ✅ | ❌ | Solana-only |
| Aztec | ❌ | ✅ | ❌ | Ethereum L2 only |
| Railgun | ❌ | ✅ | ❌ | Ethereum only |
| Penumbra | ❌ | ✅ | ❌ | Cosmos only |
| **SIP Protocol** | ✅ | ✅ | ✅ | **Privacy Standard** |

### Our Moats

| Moat Type | Description | Timeline |
|-----------|-------------|----------|
| **Standardization** | One API, many backends | M9-M12 |
| **Network Effects** | Solver liquidity, user volume | M12+ |
| **Proof Composition** | Unique technical capabilities | M13-M14 |
| **Compliance** | Viewing keys for institutions | Built-in |
| **Multi-Foundation** | Supported by multiple ecosystems | M10+ |

---

## Design Principles

1. **Privacy is a Right**: Not a feature, a fundamental capability
2. **Chain-Agnostic**: Enhance every chain, compete with none
3. **Complement, Don't Compete**: Leverage Zcash, Mina, NEAR — don't rebuild
4. **Standardization First**: One API, many backends
5. **Compliance-Ready**: Viewing keys for regulatory compatibility
6. **Technical Moat**: Proof composition creates defensible advantage

---

## Status Summary

### Phase 1: Foundation (M1-M8) 🔄 95% Complete

| Component | Status |
|-----------|--------|
| TypeScript SDK | ✅ Complete |
| Stealth Addresses (secp256k1) | ✅ Complete |
| Stealth Addresses (ed25519) | ✅ Complete |
| Pedersen Commitments | ✅ Complete |
| ZK Proof Specs | ✅ Complete |
| Noir ZK Circuits | ✅ Complete |
| NEAR Intents Adapter | ✅ Complete |
| Zcash RPC Client | ✅ Complete |
| Wallet Adapters | ✅ Complete |
| npm Publish | ✅ Complete |
| Documentation Site | ✅ Complete |
| Demo UI (122 tests) | ✅ Complete |
| SDK Tests (1,293 tests) | ✅ Complete |
| Multi-curve Stealth | ✅ Complete |
| External Security Audit | 🔲 Pending |

### Phase 2: Standard (M9-M12) 🔲 Planned

| Component | Status |
|-----------|--------|
| Private Payments Module | 🔲 Planned |
| DAO Treasury Module | 🔲 Planned |
| Multi-Foundation Grants | 🔲 Planned |
| Settlement Abstraction | 🔲 Planned |
| Mina Integration Research | 🔲 Planned |
| Wallet Partnerships | 🔲 Planned |

### Phase 3: Ecosystem (M13-M15) 🔲 Future

| Component | Status |
|-----------|--------|
| Proof Composition Research | 🔲 Future |
| Technical Moat Building | 🔲 Future |
| Standard Proposal (SIP-EIP) | 🔲 Future |
| Governance Token | 🔲 Future |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Current focus areas:**
- M8: Security audit, multi-curve completion
- M9: Horizontal expansion (payments, treasury)
- M10: Multi-foundation grant applications

---

*Last updated: December 1, 2025*
