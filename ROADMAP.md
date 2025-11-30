# SIP Protocol Roadmap

> **Shielded Intents Protocol** — The privacy layer for NEAR Intents ecosystem

---

## Vision

SIP is an **application layer** that brings privacy to intent-based cross-chain systems. We complement existing infrastructure (NEAR Intents, Zcash) rather than compete with it.

### What We Provide

- **Stealth Addresses**: One-time recipient addresses preventing linkability
- **Shielded Intents**: Hidden sender/amount with verifiable output requirements
- **Viewing Keys**: Selective disclosure for compliance and auditing
- **Multi-Chain Privacy**: Privacy across any NEAR-connected chain

### Strategic Positioning

```
┌─────────────────────────────────────────────────────────────┐
│                    SIP PROTOCOL STACK                       │
├─────────────────────────────────────────────────────────────┤
│  PRIVACY LAYER (SIP)          ← We build this               │
│  • Pedersen Commitments  • Stealth Addresses                │
│  • Viewing Keys          • Shielded Intents                 │
├─────────────────────────────────────────────────────────────┤
│  SETTLEMENT LAYER             ← We leverage this            │
│  • NEAR Intents         • Chain Signatures                  │
├─────────────────────────────────────────────────────────────┤
│  BLOCKCHAIN LAYER             ← We connect to this          │
│  • NEAR  • Ethereum  • Solana  • Bitcoin  • More...         │
└─────────────────────────────────────────────────────────────┘
```

---

## Milestones

### M1: Architecture & Specification ✅ Complete

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

### M2: Cryptographic Core ✅ Complete

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
| [#18](../../issues/18) | Security audit preparation - document assumptions | ✅ Done |

---

### M3: SDK Production ✅ Complete

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

### M4: Network Integration ✅ Complete

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

**Achievement**: 741 tests passing, comprehensive E2E coverage.

---

### M5: Documentation & Launch ✅ Complete

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

**Achievement**: All milestones complete. SDK ready for npm publish.

---

### M6: Launch & Publish ✅ Complete

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

### M7: Real Demo Integration ✅ Complete

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

**Achievement**: Full demo with wallet connection, quote fetching, transaction execution, chain-specific explorers, toast notifications. 92 tests in sip-website.

---

### M8: Production Hardening 🔄 In Progress

Real ZK circuits, multi-curve stealth addresses, and security hardening.

| Issue | Description | Status |
|-------|-------------|--------|
| [#62](../../issues/62) | [EPIC] Production Hardening | 🔄 In Progress |
| [#63](../../issues/63) | Noir Funding Proof circuit | ✅ Done |
| [#64](../../issues/64) | Noir Validity Proof circuit | ✅ Done |
| [#65](../../issues/65) | Noir Fulfillment Proof circuit | ✅ Done |
| [#66](../../issues/66) | Memory zeroization for secrets | ✅ Done |
| [#91](../../issues/91) | [EPIC] Multi-Curve Stealth Addresses | 🔲 Planned |
| [#92](../../issues/92) | ed25519 stealth address implementation | 🔲 Planned |
| [#93](../../issues/93) | Solana address derivation from ed25519 stealth | 🔲 Planned |
| [#94](../../issues/94) | NEAR address derivation from ed25519 stealth | 🔲 Planned |
| [#95](../../issues/95) | Multi-curve meta-address format | 🔲 Planned |
| [#96](../../issues/96) | Update NEAR Intents adapter for multi-curve | 🔲 Planned |
| [#97](../../issues/97) | Cross-chain stealth integration tests | 🔲 Planned |
| [#67](../../issues/67) | External security audit | 🔲 Pending |

**Progress**: Noir circuits complete. Multi-curve stealth addresses needed for true cross-chain privacy (Solana, NEAR output chains).

---

### M9: Horizontal Expansion ✅ Complete

New use cases and deeper integration.

| Issue | Description | Status |
|-------|-------------|--------|
| [#68](../../issues/68) | [EPIC] Horizontal Expansion | ✅ Done |
| [#69](../../issues/69) | Private Payments (stablecoin transfers) | ✅ Done |
| [#70](../../issues/70) | DAO Treasury operations | ✅ Done |
| [#71](../../issues/71) | Enterprise Compliance dashboard | ✅ Done |
| [#72](../../issues/72) | Hardware wallet support (Ledger/Trezor) | ✅ Done |

**Achievement**: 203 new tests across 4 modules: Private Payments (58), DAO Treasury (45), Enterprise Compliance (51), Hardware Wallets (49).

---

## Design Principles

1. **Complement, Don't Compete**: Leverage NEAR Intents, Zcash primitives
2. **Application Layer**: Fast to ship, easy to integrate
3. **Privacy + Compliance**: Viewing keys for regulatory compatibility
4. **Real Cryptography**: No mocked proofs or simulated security
5. **Cross-Chain First**: Only private cross-chain solution in the market

---

## Status

### Core Infrastructure (M1-M9) 🔄 In Progress

| Component | Status |
|-----------|--------|
| TypeScript Types | ✅ Complete |
| Stealth Addresses (secp256k1/EVM) | ✅ Complete |
| Stealth Addresses (ed25519/Solana/NEAR) | 🔲 Planned |
| Pedersen Commitments | ✅ Complete |
| ZK Proof Specs | ✅ Complete |
| ProofProvider Interface | ✅ Complete |
| SDK Core | ✅ Complete |
| Input Validation | ✅ Complete |
| Error Handling | ✅ Complete |
| SDK Unit Tests (965 tests) | ✅ Complete |
| Integration Tests | ✅ Complete |
| E2E Tests (128 tests) | ✅ Complete |
| Performance Benchmarks | ✅ Complete |
| NEAR Intents Adapter | ✅ Complete |
| Zcash RPC Client | ✅ Complete |
| Wallet Adapters | ✅ Complete |
| npm Publish | ✅ Complete |
| Documentation Site | ✅ Complete |
| Demo UI Tests (92 tests) | ✅ Complete |
| Wallet Connection | ✅ Complete |
| Quote Flow | ✅ Complete |
| Transaction Execution | ✅ Complete |
| Noir ZK Circuits | ✅ Complete |
| Secure Memory Handling | ✅ Complete |
| Private Payments Module | ✅ Complete |
| Stablecoin Registry | ✅ Complete |
| DAO Treasury Module | ✅ Complete |
| Enterprise Compliance | ✅ Complete |
| Hardware Wallet Support | ✅ Complete |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Current focus areas:**
- M8: Multi-curve stealth addresses for true cross-chain privacy
- ed25519 support for Solana/NEAR output chains

**Future areas of interest:**
- Additional chain integrations
- Mobile wallet support
- Advanced ZK optimizations

---

*Last updated: November 30, 2025*
