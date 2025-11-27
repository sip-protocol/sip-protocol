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

## Future Roadmap (Post-Launch)

### Horizontal Expansion (New Use Cases)

| Use Case | Description | Priority |
|----------|-------------|----------|
| Private Payments | Stablecoin transfers with privacy | High |
| DAO Treasury | Private treasury operations | High |
| Private Payroll | Salary payments with privacy | Medium |

### Vertical Expansion (Deeper Integration)

| Feature | Description | Priority |
|---------|-------------|----------|
| More Chains | All NEAR-supported chains | Automatic |
| Enterprise Compliance | Dashboard for auditors | High |
| Hardware Wallets | Ledger/Trezor support | Medium |

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
- SDK integrations
- Wallet support
- Documentation
- Security review

---

*Last updated: November 27, 2025*
