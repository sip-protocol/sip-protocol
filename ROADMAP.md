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

### M6: Launch & Publish 🔲 Planned

Publish SDK to npm and integrate into website.

| Issue | Description | Status |
|-------|-------------|--------|
| [#48](../../issues/48) | [EPIC] Launch & Publish | 🔲 Open |
| [#49](../../issues/49) | Configure NPM_TOKEN secret | 🔲 Open |
| [#50](../../issues/50) | Create GitHub release v0.1.0 | 🔲 Open |
| [#51](../../issues/51) | Verify npm packages work | 🔲 Open |
| [#52](../../issues/52) | Update sip-website to use npm packages | 🔲 Open |
| [#53](../../issues/53) | Build docs-sip with Astro + Starlight | 🔲 Open |

---

### M7: Real Demo Integration 🔲 Planned

Connect demo UI to real SDK with actual blockchain transactions.

| Issue | Description | Status |
|-------|-------------|--------|
| [#54](../../issues/54) | [EPIC] Real Demo Integration | 🔲 Open |
| [#55](../../issues/55) | Wallet connection component (Phantom, MetaMask) | 🔲 Open |
| [#56](../../issues/56) | SDK client initialization | 🔲 Open |
| [#57](../../issues/57) | Testnet configuration (Solana Devnet, Sepolia) | 🔲 Open |
| [#58](../../issues/58) | Quote flow integration (1Click API) | 🔲 Open |
| [#59](../../issues/59) | Transaction execution flow | 🔲 Open |
| [#60](../../issues/60) | Explorer links and tx status | 🔲 Open |
| [#61](../../issues/61) | Error handling and edge cases | 🔲 Open |

---

### M8: Production Hardening 🔲 Planned

Replace mock proofs with real ZK circuits and security hardening.

| Issue | Description | Status |
|-------|-------------|--------|
| [#62](../../issues/62) | [EPIC] Production Hardening | 🔲 Open |
| [#63](../../issues/63) | Noir Funding Proof circuit | 🔲 Open |
| [#64](../../issues/64) | Noir Validity Proof circuit | 🔲 Open |
| [#65](../../issues/65) | Noir Fulfillment Proof circuit | 🔲 Open |
| [#66](../../issues/66) | Memory zeroization for secrets | 🔲 Open |
| [#67](../../issues/67) | External security audit | 🔲 Open |

---

### M9: Horizontal Expansion 🔲 Future

New use cases and deeper integration.

| Issue | Description | Status |
|-------|-------------|--------|
| [#68](../../issues/68) | [EPIC] Horizontal Expansion | 🔲 Open |
| [#69](../../issues/69) | Private Payments (stablecoin transfers) | 🔲 Open |
| [#70](../../issues/70) | DAO Treasury operations | 🔲 Open |
| [#71](../../issues/71) | Enterprise Compliance dashboard | 🔲 Open |
| [#72](../../issues/72) | Hardware wallet support (Ledger/Trezor) | 🔲 Open |

---

## Design Principles

1. **Complement, Don't Compete**: Leverage NEAR Intents, Zcash primitives
2. **Application Layer**: Fast to ship, easy to integrate
3. **Privacy + Compliance**: Viewing keys for regulatory compatibility
4. **Real Cryptography**: No mocked proofs or simulated security

---

## Status

| Component | Status |
|-----------|--------|
| TypeScript Types | ✅ Complete |
| Stealth Addresses | ✅ Complete |
| Pedersen Commitments | ✅ Complete |
| ZK Proof Specs | ✅ Complete |
| ProofProvider Interface | ✅ Complete |
| SDK Core | ✅ Complete |
| Input Validation | ✅ Complete |
| Error Handling | ✅ Complete |
| Unit Tests (741 tests) | ✅ Complete |
| Integration Tests | ✅ Complete |
| E2E Tests (128 tests) | ✅ Complete |
| Performance Benchmarks | ✅ Complete |
| NEAR Intents Adapter | ✅ Complete |
| Zcash RPC Client | ✅ Complete |
| Wallet Adapters | ✅ Complete |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- M6: npm publishing and integration
- M7: Real demo with wallet connections
- M8: Noir ZK circuit implementation
- Security review and audit preparation

---

*Last updated: November 27, 2025*
