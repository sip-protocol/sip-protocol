# CLAUDE.md - SIP Protocol Ecosystem

**Organization:** https://github.com/sip-protocol
**Website:** https://sip-protocol.org
**Purpose:** This file contains ecosystem-wide context for AI assistants working across all SIP Protocol repositories

---

## ECOSYSTEM OVERVIEW

**SIP (Shielded Intents Protocol)** is a privacy layer for cross-chain transactions via NEAR Intents + Zcash. One toggle to shield sender, amount, and recipient using stealth addresses, Pedersen commitments, and viewing keys for compliance.

### Related Repositories

| Repo | Purpose | Tech Stack | Version |
|------|---------|------------|---------|
| `sip-protocol/sip-protocol` | **Core** - SDK, React, CLI, API packages | TypeScript, Vitest | v0.6.0 |
| `sip-protocol/sip-website` | Demo app + Marketing site | Next.js 14, Tailwind | v0.1.0 |
| `sip-protocol/docs-sip` | Documentation (Astro Starlight) | Astro, MDX | v0.0.1 |
| `sip-protocol/circuits` | Noir ZK circuits | Noir, Barretenberg | - |
| `sip-protocol/.github` | Org configs, profile | YAML | - |

**Organization Mission:** Become the privacy standard for cross-chain intents

---

## CROSS-REPO STANDARDS

These standards apply to ALL repositories under sip-protocol organization.

### Shared Coding Standards

**Formatting:**
- TypeScript: 2-space indentation, no semicolons
- Markdown: Consistent headers, code blocks with language tags

**Quality Gates:**
- All tests passing before merge
- Type checking passes (`pnpm typecheck` or `npm run typecheck`)
- No security vulnerabilities

**Git Workflow:**
- Feature branches from `dev` or `main`
- Descriptive commit messages
- Squash commits on PR merge when sensible

**Documentation:**
- Keep README.md synchronized with code
- Maintain repo-specific CLAUDE.md (references this file)

### Shared AI Assistant Guidelines

**DO:**
- Read repo-specific CLAUDE.md for unique details
- Run tests after code changes
- Reference file:line when discussing code (e.g., `stealth.ts:123`)
- Update documentation when changing behavior

**DON'T:**
- Create files without checking existing structure
- Use bash echo for communication (output directly)
- Proceed with ambiguous or unclear instructions
- Skip validation in public APIs
- Commit anything in `.strategy/` folder

### Licenses

All SIP Protocol projects are MIT licensed.

---

## REPOSITORY INDEX

Quick reference for navigating between SIP Protocol repositories.

### 1. sip-protocol (Core) - **YOU ARE HERE**

**Purpose:** Core SDK for shielded intents + TypeScript types
**Tech Stack:** TypeScript, @noble/curves, @noble/hashes, Vitest
**Key Commands:**
```bash
pnpm install                    # Install dependencies
pnpm test -- --run              # Run all tests (2,757 tests)
pnpm typecheck                  # Type check
pnpm build                      # Build all packages
```
**Key Files:**
- `packages/sdk/src/stealth.ts` - Stealth address generation (EIP-5564)
- `packages/sdk/src/crypto.ts` - Pedersen commitments, hashing
- `packages/sdk/src/privacy.ts` - Viewing keys, encryption
- `packages/sdk/src/intent.ts` - IntentBuilder, createShieldedIntent
- `packages/sdk/src/sip.ts` - Main SIP client class

**Full details:** See "SIP CORE REPOSITORY" section below

---

### 2. sip-website

**Purpose:** Demo application + Marketing website
**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Zustand, Vitest
**Key Commands:**
```bash
pnpm dev                        # Dev server (localhost:3000)
pnpm test -- --run              # Run tests (126 tests)
pnpm build                      # Build for production
pnpm typecheck                  # Type check
```
**Key Files:**
- `src/app/` - Next.js app router pages
- `src/components/` - React components
- `src/hooks/` - Custom hooks (useSwap, useQuote)
- `src/stores/` - Zustand stores (wallet, toast)
- `tests/` - Test suites

**Features:** Wallet connection, quote fetching, swap execution, privacy toggle, SDK showcase, grants pitch pages
**Deployment:** sip-protocol.org (Docker + GHCR)
**CLAUDE.md:** [sip-website/CLAUDE.md](https://github.com/sip-protocol/sip-website/blob/main/CLAUDE.md)

---

### 3. docs-sip

**Purpose:** Official documentation website
**Tech Stack:** Astro 5, Starlight, MDX
**Key Commands:**
```bash
npm run dev                     # Dev server (localhost:4321)
npm run build                   # Build for production
npm run preview                 # Preview build
```
**Key Files:**
- `src/content/docs/` - Documentation pages (MDX)
- `src/content/config.ts` - Content collections config
- `astro.config.mjs` - Astro configuration

**Deployment:** docs.sip-protocol.org (Docker + GHCR)
**CLAUDE.md:** [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md)

---

### 4. circuits

**Purpose:** Noir ZK circuits for privacy proofs
**Tech Stack:** Noir, Barretenberg, Nargo CLI
**Key Commands:**
```bash
nargo compile                   # Compile circuit
nargo test                      # Run tests
nargo prove                     # Generate proof
nargo verify                    # Verify proof
```
**Circuits (Planned):**
- Funding Proof - Prove balance >= minimum without revealing balance
- Validity Proof - Prove intent authorization without revealing sender
- Fulfillment Proof - Prove fulfillment correctness

**Specs:** See `docs/specs/` in sip-protocol repo
**CLAUDE.md:** [circuits/CLAUDE.md](https://github.com/sip-protocol/circuits/blob/main/CLAUDE.md)

---

### 5. .github

**Purpose:** Organization-wide GitHub configuration
**Key Files:**
- `profile/README.md` - Organization profile page
- `ISSUE_TEMPLATE/` - Default issue templates (planned)
- `FUNDING.yml` - Sponsorship configuration (planned)

**CLAUDE.md:** [.github/CLAUDE.md](https://github.com/sip-protocol/.github/blob/main/CLAUDE.md)

---

## CURRENT FOCUS

See [ROADMAP.md](ROADMAP.md) for detailed milestone tracking and priorities.

**Cross-Repo Coordination:**
- Changes to `@sip-protocol/sdk` may require updates to sip-website
- All repos follow semantic versioning
- Check repo-specific CLAUDE.md files for individual development notes

---

# SIP CORE REPOSITORY

> **Note:** The sections below are specific to the `sip-protocol/sip-protocol` repository (core SDK monorepo). For other repos, see their respective CLAUDE.md files linked above.

---

## What is SIP?

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3 — like HTTPS for the internet. One toggle to shield sender, amount, and recipient using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Status:** M15 Complete | 2,757 tests (SDK: 2,474, React: 57, CLI: 33, API: 67, Website: 126) | Live at sip-protocol.org

**Endgame:** Privacy middleware between applications and blockchains. Chain-agnostic. Settlement-agnostic. The universal privacy layer.

---

## Architecture (C+B Hybrid Strategy)

SIP combines **Settlement Aggregation (C)** for standardization with **Proof Composition (B)** for technical moat.

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
│  │ PROOF COMPOSITION (Technical Moat) [Future M16-M17]                   │ │
│  │ • Zcash → Privacy execution     • Mina → Succinct verification        │ │
│  │ • Noir  → Validity proofs       • Compose proofs from multiple systems│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ "Settle anywhere"
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT LAYER (Pluggable)                                               │
│  • NEAR Intents  • Mina Protocol [Future]  • Direct Chain [Future]         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER                                                           │
│  • Ethereum  • Solana  • NEAR  • Bitcoin  • Cosmos  • Move chains  • More  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**One-liner**: SIP is privacy middleware — we sit between apps and chains, making any transaction private.

**Key Files:**
- `packages/sdk/src/stealth.ts` - Stealth address generation (EIP-5564, secp256k1)
- `packages/sdk/src/crypto.ts` - Pedersen commitments, cryptographic primitives
- `packages/sdk/src/privacy.ts` - Viewing keys, XChaCha20-Poly1305 encryption
- `packages/sdk/src/intent.ts` - IntentBuilder, createShieldedIntent
- `packages/sdk/src/sip.ts` - Main SIP client class
- `packages/sdk/src/proofs/` - ProofProvider interface, Mock/Noir providers
- `packages/sdk/src/adapters/` - NEAR Intents, wallet adapters

---

## Current Features

| Feature | Status | Notes |
|---------|--------|-------|
| Stealth addresses | Done | EIP-5564 style, secp256k1 |
| Pedersen commitments | Done | Homomorphic, hiding amounts |
| Viewing keys | Done | Selective disclosure for compliance |
| Privacy levels | Done | transparent, shielded, compliant |
| NEAR Intents adapter | Done | 1Click API integration |
| Zcash RPC client | Done | Shielded transaction support |
| Wallet adapters | Done | Abstract interface + Solana/Ethereum |
| E2E test suite | Done | 128 tests covering all flows |
| ZK proof specs | Done | Funding, Validity, Fulfillment |
| Noir circuits | Done | BrowserNoirProvider for browser, compiled circuits |

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Run all tests (2,757 tests)
pnpm test -- --run

# Run E2E tests only (128 tests)
pnpm test -- tests/e2e --run

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build all packages
pnpm build
```

---

## Test Suite (2,757 total tests)

### Package Test Counts

| Package | Tests | Location |
|---------|-------|----------|
| @sip-protocol/sdk | 2,474 | `packages/sdk/tests/` |
| @sip-protocol/react | 57 | `packages/react/tests/` |
| @sip-protocol/cli | 33 | `packages/cli/tests/` |
| @sip-protocol/api | 67 | `packages/api/tests/` |
| sip-website | 126 | `tests/` (in sip-website repo) |

### SDK Test Breakdown

| Suite | Count | Location |
|-------|-------|----------|
| Crypto unit tests | ~50 | `packages/sdk/tests/crypto.test.ts` |
| Stealth address tests | ~40 | `packages/sdk/tests/stealth.test.ts` |
| Privacy/encryption tests | ~30 | `packages/sdk/tests/privacy.test.ts` |
| Validation tests | ~60 | `packages/sdk/tests/validation.test.ts` |
| Integration tests | ~100 | `packages/sdk/tests/integration/` |
| E2E tests | 128 | `packages/sdk/tests/e2e/` |
| Multi-curve/chain tests | ~200 | `packages/sdk/tests/multi-*.test.ts` |

### React Package Tests

| Suite | Count | Location |
|-------|-------|----------|
| useSIP hook | 12 | `packages/react/tests/hooks/use-sip.test.tsx` |
| useStealthAddress hook | 15 | `packages/react/tests/hooks/use-stealth-address.test.tsx` |
| usePrivateSwap hook | 18 | `packages/react/tests/hooks/use-private-swap.test.tsx` |
| useViewingKey hook | 12 | `packages/react/tests/hooks/use-viewing-key.test.tsx` |

---

## Critical Design Decisions

### 1. Application Layer (Not Infrastructure)
- **Complement, don't compete** with NEAR Intents, Zcash
- Leverage existing chain infrastructure
- Focus on privacy UX, not consensus

### 2. Privacy Levels
```typescript
'transparent' → No privacy, public transaction
'shielded'    → Full privacy, hidden sender/amount/recipient
'compliant'   → Privacy + viewing key for auditors
```

### 3. Stealth Address Format
```
sip:<chain>:<spendingKey>:<viewingKey>
Example: sip:solana:0x02abc...123:0x03def...456
```

### 4. Viewing Key Hash Computation
```typescript
// Hash raw key bytes, not hex string
const keyBytes = hexToBytes(viewingKey.slice(2))
const hash = sha256(keyBytes)
```

### 5. Commitment Structure
```typescript
interface Commitment {
  value: HexString      // The commitment point
  blindingFactor: HexString  // Random blinding
}
```

---

## Strategic Direction

**Vision:** THE privacy standard for Web3 — like HTTPS for the internet
**Positioning:** Privacy middleware (chain-agnostic, settlement-agnostic)
**Target users:** DAOs, institutions, wallets, DEXs needing compliant privacy
**Strategy:** C+B Hybrid
- **Option C (Core):** Settlement Aggregator — one privacy layer, settle anywhere
- **Option B (Moat):** Proof Composition — compose proofs from Zcash + Mina + Noir

**Expansion Path:**
1. Phase 1 (M1-M8): Foundation — Core tech, NEAR Intents ✅
2. Phase 2 (M9-M12): Standard — Multi-backend, multi-chain ✅
3. Phase 3 (M13-M15): Ecosystem — Compliance, DX, Applications ✅
4. Phase 4 (M16-M18): Future — Proof composition, SIP-EIP 🔲

**Multi-Foundation Approach:** Chain-agnostic = loved by all = funded by all
- NEAR Foundation (Intents privacy)
- Zcash Foundation (privacy expertise)
- Mina Foundation (succinct verification)
- Ethereum Foundation (EVM privacy)
- Solana Foundation (SOL users)

See `.strategy/ROADMAP-INTERNAL.md` for detailed strategy (private).

---

## Core-Specific AI Guidelines

### DO (Core Repository):
- Run `pnpm test -- --run` after code changes
- Check E2E tests for integration changes
- Use existing patterns from codebase

### DON'T (Core Repository):
- Change commitment/stealth formats without updating all usages
- Skip validation in public APIs

---

## Project Structure

```
sip-protocol/sip-protocol     # This repo (core SDK monorepo)
├── packages/
│   ├── sdk/                  # @sip-protocol/sdk - Core SDK (2,474 tests)
│   │   ├── src/
│   │   │   ├── adapters/     # NEAR, wallet, settlement adapters
│   │   │   ├── proofs/       # ZK proof providers (Mock, Noir, Browser)
│   │   │   ├── stealth.ts    # Stealth addresses (secp256k1, ed25519)
│   │   │   ├── crypto.ts     # Commitments, hashing
│   │   │   ├── privacy.ts    # Viewing keys, encryption
│   │   │   ├── intent.ts     # Intent builder
│   │   │   └── sip.ts        # Main client
│   │   └── tests/            # Test suites
│   ├── types/                # @sip-protocol/types
│   ├── react/                # @sip-protocol/react - React hooks (57 tests)
│   ├── cli/                  # @sip-protocol/cli - CLI tool (33 tests)
│   └── api/                  # @sip-protocol/api - REST API (67 tests)
├── docs/                     # Documentation
└── .strategy/                # Private strategy (gitignored)
```

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **ShieldedIntent** | Intent with hidden sender/amount, visible output |
| **Stealth Address** | One-time recipient address (prevents linkability) |
| **Viewing Key** | Selective disclosure key for compliance/audit |
| **Pedersen Commitment** | `value * G + blinding * H` (hides amounts) |
| **Privacy Level** | transparent \| shielded \| compliant |

---

## Milestones

### Phase 1: Foundation (2024-2025) ✅
| Milestone | Focus | Status |
|-----------|-------|--------|
| M1: Architecture & Specification | Specs, proofs design | ✅ |
| M2: Cryptographic Core | Real crypto primitives | ✅ |
| M3: SDK Production | Production SDK | ✅ |
| M4: Network Integration | NEAR, Zcash, wallets | ✅ |
| M5: Documentation & Launch | Docs, whitepaper | ✅ |
| M6: Launch & Publish | npm publish, docs site | ✅ |
| M7: Real Demo Integration | Live demo | ✅ |
| M8: Production Hardening | Noir circuits, multi-curve | ✅ |

### Phase 2: Standard (2025) ✅
| Milestone | Focus | Status |
|-----------|-------|--------|
| M9: Stable Core | 100% tests, CI validation | ✅ |
| M10: ZK Production | Noir/WASM, browser proving | ✅ |
| M11: Multi-Settlement | 3 backends, SmartRouter | ✅ |
| M12: Multi-Chain | 15+ chains, Bitcoin/Cosmos/Move | ✅ |

### Phase 3: Ecosystem (2025) ✅
| Milestone | Focus | Status |
|-----------|-------|--------|
| M13: Compliance Layer | Viewing keys, audit trails | ✅ |
| M14: Developer Experience | React, CLI, API packages | ✅ |
| M15: Application Layer | Hardware wallets, WalletConnect | ✅ |

### Phase 4: Future (2026+) 🔲
| Milestone | Focus | Status |
|-----------|-------|--------|
| M16: Proof Composition Research | Halo2 + Kimchi feasibility | 🔲 |
| M17: Technical Moat | Proof composition v1, multi-lang SDK | 🔲 |
| M18: Standard Proposal | SIP-EIP, industry working group | 🔲 |

---

## Tech Stack

- **Language:** TypeScript (strict)
- **Monorepo:** pnpm + Turborepo
- **Crypto:** @noble/curves (secp256k1), @noble/hashes, @noble/ciphers
- **Testing:** Vitest
- **CI/CD:** GitHub Actions
- **Publish:** npm registry

---

## VPS Deployment (176.222.53.185)

### SIP Services on VPS

| Service | Port | Container | Domain |
|---------|------|-----------|--------|
| sip-website (blue) | 5000 | sip-website-blue | sip-protocol.org |
| sip-website (green) | 5001 | sip-website-green | - |
| sip-website (staging) | 5002 | sip-website-staging | - |
| sip-docs | 5003 | sip-docs | docs.sip-protocol.org |

### Deployment Flow

```
Push to main → GitHub Actions → Build Docker → Push to GHCR → SSH deploy → docker compose up
```

### Docker Compose Isolation

**CRITICAL:** All users share the same Docker daemon. Use `name:` in docker-compose.yml to isolate projects:

```yaml
name: sip  # Prevents conflicts with other projects

services:
  docs:
    image: ghcr.io/sip-protocol/docs-sip:latest
    container_name: sip-docs
    ...
```

### SSH Access

```bash
ssh sip   # User: sip, has sudo
ssh core  # Admin user for nginx/system config
```

### Key Files on VPS

- `~/app/docker-compose.yml` - Service definitions
- `/etc/nginx/sites-enabled/sip-docs.conf` - Nginx reverse proxy
- `/etc/letsencrypt/live/docs.sip-protocol.org/` - SSL certs (auto-renew)

---

## Code Style

- 2-space indent, no semicolons
- Explicit types for public APIs
- JSDoc for public functions
- Use enum values (`PrivacyLevel.SHIELDED`) not string literals
- Validation at system boundaries

---

**Last Updated:** 2025-12-04
**Status:** M15 Complete | 2,757 Tests | 6 Packages | C+B Hybrid Strategy
