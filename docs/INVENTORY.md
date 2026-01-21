# SIP Protocol Ecosystem Inventory

> **Source of Truth** for all SIP Protocol repositories and components.
> Update this file when code structure changes.

---

## Quick Verification

```bash
# Run from sip-protocol/ root
ls packages/                              # NPM packages (7)
ls programs/                              # Solana programs
ls contracts/                             # Ethereum contracts
ls examples/                              # Integration examples (11)
pnpm turbo test -- --run 2>&1 | grep "Tests"  # Test counts
gh issue list --search "EPIC" --state open    # Active milestones
```

---

## 1. sip-protocol/sip-protocol (Core Monorepo)

### NPM Packages

| Package | Version | Description | Tests |
|---------|---------|-------------|-------|
| `@sip-protocol/sdk` | 0.7.3 | Core SDK for shielded intents | 6,603 |
| `@sip-protocol/types` | 0.2.1 | TypeScript type definitions | - |
| `@sip-protocol/react` | 0.1.0 | React hooks | 82 |
| `@sip-protocol/cli` | 0.2.0 | CLI tool | 10 |
| `@sip-protocol/api` | 0.1.0 | REST API wrapper | 18 |
| `@sip-protocol/react-native` | 0.1.1 | iOS/Android SDK | 10 |
| `circuits` | - | Noir ZK circuits (external repo) | 19 |

**Total tests: 6,661+ (monorepo) + 19 (circuits)**

### Solana Programs

| Location | Description | Language |
|----------|-------------|----------|
| `programs/sip-privacy/` | Privacy program | Rust (Anchor) |

**Structure:**
```
programs/sip-privacy/programs/sip-privacy/src/
├── lib.rs              # Main program entry
├── commitment/         # Pedersen commitment logic
└── zk_verifier/        # ZK proof verification
```

### Ethereum Contracts

| Location | Description | Language |
|----------|-------------|----------|
| `contracts/sip-ethereum/` | Privacy contracts | Solidity 0.8.24 (Foundry) |

**Contracts:**
```
contracts/sip-ethereum/src/
├── SIPPrivacy.sol              # Main privacy contract
├── StealthAddressRegistry.sol  # Stealth address management
├── ZKVerifier.sol              # ZK proof verification
├── PedersenVerifier.sol        # Commitment verification
├── interfaces/                 # Contract interfaces
└── utils/                      # Utility libraries
```

### Examples

| Directory | Description |
|-----------|-------------|
| `noir-solana-demo` | Noir circuits + Solana integration |
| `compliance` | Viewing key compliance demo |
| `private-payment` | Private payment flow |
| `private-swap` | Private swap implementation |
| `wallet-integration` | Wallet adapter examples |
| `zcash-connection` | Zcash RPC integration |
| `near-integration` | NEAR Intents integration |
| `range-sas` | Range proofs with stealth addresses |
| `react-hooks` | React hooks usage |
| `solana-integration` | Solana same-chain privacy |
| `ethereum-integration` | Ethereum same-chain privacy |

### Documentation

| Location | Description |
|----------|-------------|
| `docs/specs/` | Protocol specifications (17 files) |
| `docs/security/` | Security docs, audit prep (7 files) |
| `docs/research/` | Feasibility studies (2 files) |
| `docs/workshops/` | Developer materials (4 files) |
| `docs/content/` | M16 content campaign (4 files) |
| `docs/community/` | Discord, DevRel, LOI templates (4 files) |
| `docs/bounties/` | Hackathon submissions (2 files) |
| `docs/circuits/` | Constraint analysis (1 file) |
| `docs/runbooks/` | Incident response (1 file) |

---

## 2. sip-protocol/sip-app

**Version:** 0.1.0
**Stack:** Next.js 16, React 19, Tailwind 4, Zustand 5
**Deployment:** app.sip-protocol.org (port 5004 blue / 5005 green)
**Tests:** 25 test suites

### App Routes (14 total)

| Route | Description | Status |
|-------|-------------|--------|
| `/` | Hub dashboard | Live |
| `/(payments)/payments/*` | Private payments (send, receive, scan, history, disclose) | Live |
| `/(tools)/privacy-score` | Wallet surveillance analyzer | Live |
| `/(wallet)/wallet/*` | Wallet interface | Scaffolded |
| `/(dex)/dex/*` | Private DEX with Jupiter | Scaffolded |
| `/(enterprise)/enterprise/*` | Compliance dashboard | Scaffolded |

---

## 3. sip-protocol/sip-website

**Version:** 0.0.1
**Stack:** Next.js 15, React 19, Tailwind 4
**Deployment:** sip-protocol.org (port 5000)
**Tests:** 157 tests

### Active Pages (13)

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/about` | About page |
| `/features` | Feature showcase |
| `/sdk` | SDK documentation |
| `/roadmap` | Public roadmap |
| `/pitch-deck` | Investor pitch |
| `/grants/*` | Superteam & Solana Foundation grants |
| `/privacy`, `/terms`, `/license`, `/security` | Legal pages |

**Note:** Demo pages removed with 301 redirects to sip-app.

---

## 4. sip-protocol/docs-sip

**Version:** 0.0.0
**Stack:** Astro Starlight, MDX
**Deployment:** docs.sip-protocol.org (port 5003)

### Documentation Sections

| Section | Description |
|---------|-------------|
| `concepts/` | Core concepts |
| `guides/` | How-to guides |
| `specs/` | Technical specs |
| `integrations/` | Integration guides |
| `reference/` | API reference |
| `security/` | Security documentation |
| `cookbook/` | Code recipes |

---

## 5. sip-protocol/blog-sip

**Version:** 0.0.1
**Stack:** Astro 5, MDX, Tailwind 4
**Deployment:** blog.sip-protocol.org (port 5004)

**Posts:** 25 published articles (M16 target: 12 — exceeded)

### Topics

- Privacy architecture (Pedersen, stealth addresses)
- Competitor analysis (PrivacyCash, pool mixing)
- Integration tutorials (Arcium, Inco)
- Regulatory landscape
- SDK getting started

---

## 6. sip-protocol/circuits

**Stack:** Noir 1.0.0-beta.15, Barretenberg (UltraHonk), Nargo CLI
**Tests:** 19 tests passing

### Circuits (Implemented)

| Circuit | Purpose | ACIR Opcodes | Tests |
|---------|---------|--------------|-------|
| funding_proof | Prove balance >= minimum | 972 | 5 |
| validity_proof | Prove intent authorization | 1113 | 6 |
| fulfillment_proof | Prove fulfillment correctness | 1691 | 8 |

---

## 7. sip-protocol/.github

### Contents

| File | Description |
|------|-------------|
| `profile/README.md` | Organization profile page |
| `ISSUE_TEMPLATE/` | Default issue templates |
| `workflows/` | Shared GitHub Actions |

---

## VPS Deployment

| Service | Port | Container | Domain |
|---------|------|-----------|--------|
| sip-website | 5000 | sip-website | sip-protocol.org |
| sip-docs | 5003 | sip-docs | docs.sip-protocol.org |
| sip-blog | 5004 | sip-blog | blog.sip-protocol.org |
| sip-app | 5004/5005 | sip-app-blue/green | app.sip-protocol.org |

---

## Milestone Status

| Phase | Milestones | Status |
|-------|------------|--------|
| Phase 1-3 | M1-M15 | ✅ Complete |
| Phase 4 | M16 Narrative | ✅ Complete |
| Phase 4 | M17 Solana Same-Chain | 🎯 Active (30 issues) |
| Phase 4 | M18 Ethereum Same-Chain | 🔲 Planned |
| Phase 5 | M19-M22 | 🔲 Planned |

---

## Update Log

| Date | Change |
|------|--------|
| 2026-01-21 | Updated test counts (6,661+), circuits status, app routes |
| 2026-01-18 | Initial inventory, M16 complete |

---

*Last updated: January 21, 2026*
