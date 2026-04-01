# CLAUDE.md - SIP Protocol Ecosystem

**Organization:** https://github.com/sip-protocol
**Website:** https://sip-protocol.org
**Purpose:** This file contains ecosystem-wide context for AI assistants working across all SIP Protocol repositories

---

## ECOSYSTEM OVERVIEW

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3. Privacy middleware for same-chain and cross-chain transactions using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Current Focus:** Ethereum Same-Chain Privacy (M18) — M17 Solana implementation complete.

**Progress Tracker:** `~/.claude/sip-protocol/M17-MOBILE-TRACKER.md` (14-week M17 + Mobile EPIC implementation plan)

### Related Repositories

| Repo | Purpose | Tech Stack | Version |
|------|---------|------------|---------|
| `sip-protocol/sip-protocol` | **Core** - SDK, React, CLI, API packages | TypeScript, Vitest | v0.9.0 |
| `sip-protocol/sip-app` | **App** - Privacy applications (payments, wallet, DEX) | Next.js 16, Tailwind | v0.1.0 |
| `sip-protocol/sip-mobile` | **Mobile** - Native iOS/Android/Seeker privacy wallet | Expo 52, NativeWind | v0.1.0 |
| `sip-protocol/sip-arcium-program` | **Arcium** - MPC program for confidential DeFi | Rust, Anchor, Arcium SDK | - |
| `sip-protocol/sip-website` | Marketing site (demo deprecated → sip-app) | Next.js 15, Tailwind | v0.0.1 |
| `sip-protocol/docs-sip` | Documentation (Astro Starlight) | Astro 5, MDX | v0.0.0 |
| `sip-protocol/blog-sip` | **Blog** - Technical deep-dives, ecosystem updates | Astro 5, MDX, Tailwind | v0.0.1 |
| `sip-protocol/circuits` | Noir ZK circuits (3 circuits, 18 tests) | Noir 1.0.0-beta.15 | - |
| `sip-protocol/sipher` | **Sipher** - Privacy-as-a-Skill REST API for Solana Agents | Express 5, TypeScript | v0.1.0 |
| `sip-protocol/.github` | Org configs, profile | YAML | - |

**Organization Mission:** Become THE privacy standard for Web3 — same-chain and cross-chain

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
- Commit anything in `~/.claude/sip-protocol/` folder

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
pnpm test -- --run              # Run all tests (7,504+ tests)
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

### 2. sip-app

**Purpose:** World-class privacy applications (payments, wallet, DEX, enterprise)
**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Zustand 5, Vitest
**Key Commands:**
```bash
pnpm dev                        # Dev server (localhost:3000)
pnpm test -- --run              # Run unit tests (122 test suites, 1,184 tests)
pnpm test:e2e                   # Run E2E tests (27 Playwright tests, 13 tracks + showcase)
pnpm build                      # Build for production
pnpm typecheck                  # Type check
```
**App Routes (14 total):**
- `/` - Hub dashboard with app cards
- `/payments/*` - Private payments (send, receive, scan, history, disclose)
- `/privacy-score` - Wallet surveillance analyzer
- `/wallet/*` - Wallet interface (scaffolded)
- `/dex/*` - Private DEX with Jupiter (real swap execution, stealth routing)
- `/enterprise/*` - Compliance dashboard (audit trail, viewing keys, export)

**Deployment:** app.sip-protocol.org (Docker + GHCR, port 5004 blue / 5005 green)
**CLAUDE.md:** [sip-app/CLAUDE.md](https://github.com/sip-protocol/sip-app/blob/main/CLAUDE.md)

---

### 3. sip-mobile

**Purpose:** Privacy-first Solana wallet — native key management + shielded payments on iOS, Android & Seeker
**Tech Stack:** Expo SDK 54, React Native 0.81, NativeWind 4.0, Zustand 5
**Key Commands:**
```bash
pnpm install              # Install dependencies
npx expo start            # Dev server (iOS + Android)
pnpm test -- --run        # Run tests (60 suites, 1,323 tests)
pnpm typecheck            # Type check
eas build --platform android --profile production --local  # Build Android APK
```
**Tab Structure (5 tabs):**
- Home - Dashboard, balances, quick actions
- Send - Send shielded payments
- Receive - Generate stealth addresses, QR
- Swap - Jupiter DEX with privacy toggle
- Settings - Wallet, keys, privacy, network config

**Wallet Strategy:** Native key storage (SecureStore + Seed Vault), optional external wallet integration (MWA, Phantom)
**Positioning:** Standalone privacy wallet (not a layer on top of other wallets)
**Target Stores:** iOS App Store, Google Play, Solana dApp Store (Seeker)
**CLAUDE.md:** [sip-mobile/CLAUDE.md](https://github.com/sip-protocol/sip-mobile/blob/main/CLAUDE.md)

---

### 4. sip-website

**Purpose:** Marketing website (demo pages removed, redirects to sip-app)
**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, Zustand, Vitest
**Key Commands:**
```bash
pnpm dev                        # Dev server (localhost:3000)
pnpm test -- --run              # Run tests (157 tests)
pnpm build                      # Build for production
pnpm typecheck                  # Type check
```
**Active Pages (13):**
- `/` - Landing page
- `/about`, `/features`, `/roadmap` - Marketing pages
- `/sdk`, `/pitch-deck` - SDK showcase, investor deck
- `/grants/*` - Superteam & Solana Foundation grant pitches
- `/privacy`, `/terms`, `/license`, `/security` - Legal pages

**Features:** SDK showcase, grants pitch pages, about, roadmap
**Deployment:** sip-protocol.org (Docker + GHCR, port 5000)
**CLAUDE.md:** [sip-website/CLAUDE.md](https://github.com/sip-protocol/sip-website/blob/main/CLAUDE.md)

**DEPRECATED PAGES (removed, 301 redirects active):**
- `/demo` → `app.sip-protocol.org/dex`
- `/claim` → `app.sip-protocol.org/payments/receive`
- `/phantom-poc` → `app.sip-protocol.org/wallet`
- `/jupiter-poc` → `app.sip-protocol.org/dex/jupiter`
- `/compliance-dashboard` → `app.sip-protocol.org/enterprise/compliance`

---

### 5. docs-sip

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

### 6. circuits

**Purpose:** Noir ZK circuits for privacy proofs
**Tech Stack:** Noir 1.0.0-beta.15, Barretenberg (UltraHonk), Nargo CLI
**Key Commands:**
```bash
nargo compile                   # Compile circuit
nargo test                      # Run tests (18 tests total)
nargo prove                     # Generate proof
nargo verify                    # Verify proof
```
**Circuits (Implemented):**
| Circuit | Purpose | ACIR Opcodes | Tests |
|---------|---------|--------------|-------|
| funding_proof | Prove balance >= minimum | 972 | 4 |
| validity_proof | Prove intent authorization | 1113 | 6 |
| fulfillment_proof | Prove fulfillment correctness | 1691 | 8 |

**Specs:** See `docs/specs/` in sip-protocol repo
**CLAUDE.md:** [circuits/CLAUDE.md](https://github.com/sip-protocol/circuits/blob/main/CLAUDE.md)

---

### 7. blog-sip

**Purpose:** Official blog for technical deep-dives and ecosystem updates
**Tech Stack:** Astro 5, MDX, Tailwind CSS 4
**Key Commands:**
```bash
pnpm dev                        # Dev server (localhost:4321)
pnpm build                      # Build for production
pnpm preview                    # Preview build
```
**Key Files:**
- `src/content/blog/` - MDX blog posts (25 published)
- `src/components/` - Astro components (TLDRBox, Callout, CodeBlock)
- `src/layouts/` - Page layouts (BaseLayout, PostLayout)

**Features:** SEO optimization, LLMO (LLM discoverability), RSS feed, JSON-LD structured data
**Content:** 25 published posts (M16 target: 12 — exceeded)
**Deployment:** blog.sip-protocol.org (Docker + GHCR, port 5004)
**CLAUDE.md:** [blog-sip/CLAUDE.md](https://github.com/sip-protocol/blog-sip/blob/main/CLAUDE.md)

---

### 8. sip-arcium-program

**Purpose:** Arcium MPC program for confidential DeFi on Solana
**Tech Stack:** Rust, Anchor, Arcium SDK (Arcis circuits)
**Key Commands:**
```bash
anchor build                    # Build program + circuits
anchor test                     # Run tests
anchor deploy --provider.cluster devnet  # Deploy to devnet
npx ts-node scripts/init-comp-defs.ts    # Initialize computation definitions
```
**Key Files:**
- `programs/sip_arcium_transfer/src/lib.rs` - Anchor program (queue computations, callbacks)
- `encrypted-ixs/src/lib.rs` - Arcis MPC circuits

**MPC Circuits:**
| Circuit | Purpose | Inputs | Outputs |
|---------|---------|--------|---------|
| `private_transfer` | Validate encrypted balance transfer | sender_balance, amount, min_balance | is_valid, new_balance |
| `check_balance` | Threshold check without revealing | balance, minimum | meets_minimum |
| `validate_swap` | Confidential DEX swap validation | input_balance, input_amount, min_output, actual_output | is_valid, new_balance, slippage_ok |

**Deployment (Devnet):**
- Program ID: `S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9`
- MXE Account: `5qy4Njk4jCJE4QgZ5dsg8uye3vzFypFTV7o7RRSQ8vr4`
- Cluster Offset: 456 (Arcium devnet v0.6.3)

**CLAUDE.md:** [sip-arcium-program/CLAUDE.md](https://github.com/sip-protocol/sip-arcium-program/blob/main/CLAUDE.md)

---

### 9. sipher

**Purpose:** Privacy-as-a-Skill REST API for Solana Agents (Colosseum Agent Hackathon)
**Tech Stack:** Express 5, TypeScript, @sip-protocol/sdk, Vitest
**Key Commands:**
```bash
pnpm install                    # Install dependencies
pnpm dev                        # Dev server (localhost:5006)
pnpm test -- --run              # Run tests (36 suites, 573 tests)
pnpm build                      # Build for production
pnpm typecheck                  # Type check
```
**Endpoints (71):** Stealth, Transfer, Commitment, Viewing Key, Multi-chain (17 chains), Demo, Meta

**Deployment:** sipher.sip-protocol.org (Docker + GHCR, port 5006)
**CLAUDE.md:** [sipher/CLAUDE.md](https://github.com/sip-protocol/sipher/blob/main/CLAUDE.md)

---

### 10. .github

**Purpose:** Organization-wide GitHub configuration
**Key Files:**
- `profile/README.md` - Organization profile page
- `ISSUE_TEMPLATE/` - Default issue templates (planned)
- `FUNDING.yml` - Sponsorship configuration (planned)

**CLAUDE.md:** [.github/CLAUDE.md](https://github.com/sip-protocol/.github/blob/main/CLAUDE.md)

---

## SOURCES OF TRUTH

> **Code is truth. Docs are derived.** Before updating documentation, verify against code.

See **[docs/INVENTORY.md](docs/INVENTORY.md)** for full ecosystem inventory.

**Quick verification (run from repo root):**
```bash
ls packages/ programs/ contracts/ examples/   # Component inventory
pnpm turbo test -- --run 2>&1 | grep "Tests"  # Test counts
gh issue list --search "EPIC" --state open    # Active milestones
```

**Update triggers:** New package, version bump, test count change (>10%), new program/contract.

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

**Status:** M16 Complete | 7,504+ tests (SDK: 6,691, React: 543, CLI: 62, API: 198, RN: 10) | Live at sip-protocol.org

**🏆 Achievement:** Winner — [Zypherpunk Hackathon](https://zypherpunk.xyz) ($6,500: NEAR $4,000 + Tachyon $500 + pumpfun $2,000) | Dec 2025 | #9 of 93 | 3 Tracks | [Devfolio](https://devfolio.co/projects/sip-protocol-2026)
**🥇 Achievement:** 1st Place — [Solana Graveyard Hackathon](https://solana.com/graveyard-hack) | Torque Sponsor Track ($750) | Mar 2026 | Privacy middleware + Torque SDK integration

**Endgame:** Privacy middleware between applications and blockchains. Chain-agnostic. Settlement-agnostic. The universal privacy layer.

---

## Architecture (Dual Moat Strategy)

SIP combines **Settlement Aggregation** for standardization with **Proof Composition** for technical moat.

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
│  │ INFRASTRUCTURE AGNOSTIC (Pluggable Everything)                        │ │
│  │ • Settlement backends  → NEAR, Zcash, Direct Chain, Mina              │ │
│  │ • Privacy backends     → SIP Native, PrivacyCash, Arcium, Inco        │ │
│  │ • RPC providers        → Helius, QuickNode, Triton, Generic   [M17]   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PROOF COMPOSITION (Technical Moat) [Phase 5: M19-M21]                 │ │
│  │ • Zcash → Privacy execution     • Mina → Succinct verification        │ │
│  │ • Noir  → Validity proofs       • Compose proofs from multiple systems│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ "Settle anywhere, use any provider"
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT LAYER (Pluggable)                                               │
│  • NEAR Intents [Now]  • Solana Same-Chain [M17]  • Ethereum [M18]         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER                                                           │
│  • Ethereum  • Solana  • NEAR  • Bitcoin  • Cosmos  • Move chains  • More  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**One-liner**: SIP is privacy middleware — we sit between apps and chains, making any transaction private.

### Infrastructure Agnostic Philosophy

SIP is **pluggable at every layer** — developers choose their preferred backends:

| Layer | Options | Philosophy |
|-------|---------|------------|
| **Settlement** | NEAR Intents, Zcash, Direct Chain, Mina | Settle anywhere |
| **Privacy** | SIP Native, PrivacyCash, Arcium, Inco | Choose your privacy model |
| **RPC Provider** | Helius, QuickNode, Triton, Generic | Use your preferred infra |

```typescript
// Same API, different backends — developer choice
const payments = await scanForPayments({
  provider: createProvider('helius', { apiKey }),  // or 'quicknode', 'triton', 'generic'
  viewingPrivateKey,
  spendingPublicKey,
})
```

**Key Files:**
- `packages/sdk/src/stealth.ts` - Stealth address generation (EIP-5564, secp256k1)
- `packages/sdk/src/crypto.ts` - Pedersen commitments, cryptographic primitives
- `packages/sdk/src/privacy.ts` - Viewing keys, XChaCha20-Poly1305 encryption
- `packages/sdk/src/intent.ts` - IntentBuilder, createShieldedIntent
- `packages/sdk/src/sip.ts` - Main SIP client class
- `packages/sdk/src/proofs/` - ProofProvider interface, Mock/Noir providers
- `packages/sdk/src/adapters/` - NEAR Intents, wallet adapters
- `docs/specs/QUANTUM-RESISTANT-STORAGE.md` - Winternitz vault integration spec (M17/M20)

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
| EVM ZK verifier | Done | BB-generated UltraHonk FundingVerifier on Sepolia |
| EVM privacy contracts | Done | SIPPrivacy, PedersenVerifier, StealthAddressRegistry |
| Uniswap private swaps | Done | SIPSwapRouter — stealth output via Uniswap V3 |
| 1inch aggregator swaps | Done | SIPSwapRouter v2 — whitelisted router + calldata validation |
| Gelato gasless relayer | Done | SIPRelayer — deposit mode + Gelato callWithSyncFee for gasless withdrawals |

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Run all tests (7,504+ tests)
pnpm test -- --run

# Run E2E tests only (30 tests)
pnpm test -- tests/e2e --run

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build all packages
pnpm build
```

---

## Test Suite (7,624+ total tests)

### Package Test Counts

| Package | Version | Tests | Location |
|---------|---------|-------|----------|
| @sip-protocol/sdk | 0.9.0 | 6,716 | `packages/sdk/tests/` |
| contracts/sip-ethereum | - | 294 | `contracts/sip-ethereum/test/` |
| @sip-protocol/react | 0.1.0 | 543 | `packages/react/tests/` |
| @sip-protocol/cli | 0.2.0 | 62 | `packages/cli/tests/` |
| @sip-protocol/api | 0.1.0 | 198 | `packages/api/tests/` |
| @sip-protocol/react-native | 0.1.1 | 10 | `packages/react-native/tests/` |

### SDK Test Categories

| Category | Description |
|----------|-------------|
| Crypto unit tests | Pedersen commitments, hashing, encryption |
| Stealth address tests | EIP-5564, secp256k1, ed25519 |
| Privacy/encryption tests | Viewing keys, XChaCha20-Poly1305 |
| Validation tests | Input validation, error handling |
| Integration tests | Multi-component flows |
| E2E tests | Cross-chain swap flows |
| Multi-curve/chain tests | 15+ chain support |
| Solana privacy tests | Same-chain privacy, Helius integration |
| NEAR privacy tests | Intents, wallet adapters |

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
**Strategy:** Dual Moat
- **Settlement Aggregation (Core):** One privacy layer, settle anywhere
- **Proof Composition (Moat):** Compose proofs from Zcash + Mina + Noir

**Mental Model:** "OpenRouter for privacy" — single API wrapping multiple settlement/privacy backends, like OpenRouter wraps LLM providers. The unique value-add is the cryptographic privacy layer (stealth addresses, Pedersen commitments, viewing keys) applied before routing to any backend.

**Expansion Path:**
1. Phase 1 (M1-M8): Foundation — Core tech, NEAR Intents ✅
2. Phase 2 (M9-M12): Standard — Multi-backend, multi-chain ✅
3. Phase 3 (M13-M15): Ecosystem — Compliance, DX, Applications ✅
4. Phase 4 (M16-M18): Same-Chain Expansion — Solana + Ethereum same-chain 🎯
5. Phase 5 (M19-M21): Technical Moat — Proof composition, SIP-EIP 🔲

**Competitive Advantage vs PrivacyCash (Tornado Cash clone):**
- Cryptographic privacy (Pedersen) vs Pool mixing (fixed amounts)
- Any amount hidden vs Fixed pool sizes only
- Viewing keys (compliance) vs No compliance option
- No amount correlation attacks vs Vulnerable to statistical analysis

**Grant Status:**
| Grant | Amount | Status | Date |
|-------|--------|--------|------|
| Superteam Indonesia | $10,000 USDC | ✅ **APPROVED** | Jan 22, 2026 |
| Solana Audit Subsidy V | Up to $50K | ⏳ Pending | Feb 7, 2026 deadline |
| SIP Labs, Inc. | — | 📋 Planned | Feb 2026 |
| Solana Foundation | $100K | 📋 Planned | Feb-Mar 2026 |

**Superteam Deliverables:** Native Solana Privacy SDK, Jupiter DEX Integration, Production App, Developer Resources
**Tranches:** T1 $3,000 (KYC done, payment by Jan 30) → T2 $3,000 → T3 $4,000 | Deadline: Mar 31, 2026

**Multi-Foundation Approach:** Chain-agnostic = loved by all = funded by all
- Solana Foundation (same-chain privacy for SOL users)
- NEAR Foundation (Intents privacy)
- Ethereum Foundation (EVM privacy)
- Zcash Foundation (privacy expertise)
- Mina Foundation (succinct verification)

See `~/.claude/sip-protocol/STRATEGY.md` for detailed strategy (private).

**Grants Tracking:** `~/.claude/sip-protocol/grants/` (private)
- `GRANTS.md` — Dashboard (all grants overview)
- `{grant-name}/TRACKER.md` — Weekly progress, KPIs
- `{grant-name}/reports/` — Milestone completion reports

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
│   ├── sdk/                  # @sip-protocol/sdk v0.9.0 - Core SDK (6,691 tests)
│   │   ├── src/
│   │   │   ├── adapters/     # NEAR, wallet, settlement adapters
│   │   │   ├── proofs/       # ZK proof providers (Mock, Noir, Browser)
│   │   │   ├── stealth.ts    # Stealth addresses (secp256k1, ed25519)
│   │   │   ├── crypto.ts     # Commitments, hashing
│   │   │   ├── privacy.ts    # Viewing keys, encryption
│   │   │   ├── intent.ts     # Intent builder
│   │   │   └── sip.ts        # Main client
│   │   └── tests/            # Test suites
│   ├── types/                # @sip-protocol/types v0.2.2
│   ├── react/                # @sip-protocol/react v0.1.0 - React hooks (543 tests)
│   ├── cli/                  # @sip-protocol/cli v0.2.0 - CLI tool (62 tests)
│   ├── api/                  # @sip-protocol/api v0.1.0 - REST API (198 tests)
│   └── react-native/         # @sip-protocol/react-native v0.1.1 (10 tests)
├── programs/                 # Solana Anchor program
├── contracts/                # Ethereum Solidity contracts
├── examples/                 # 11 integration examples
└── docs/                     # Documentation & specs
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
| M7: Real Integration | Live application | ✅ |
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

### Phase 4: Same-Chain Expansion (Q1-Q2 2026) 🎯 ACTIVE
| Milestone | Focus | Status |
|-----------|-------|--------|
| M16: Narrative Capture | Content, community, position vs PrivacyCash | ✅ |
| M17: Solana Same-Chain | Native Solana privacy SDK + Jupiter DEX | ✅ |
| M18: Ethereum Same-Chain | EVM privacy + L2 support | 🔄 In Progress |

### Phase 5: Technical Moat (Q3-Q4 2026) 🔲
| Milestone | Focus | Status |
|-----------|-------|--------|
| M19: Proof Composition Research | Halo2 + Kimchi feasibility | 🔲 |
| M20: Technical Moat | Proof composition v1, multi-lang SDK | 🔲 |
| M21: Standard Proposal | SIP-EIP, industry working group | 🔲 |

---

## Tech Stack

- **Language:** TypeScript (strict)
- **Monorepo:** pnpm + Turborepo
- **Crypto:** @noble/curves (secp256k1), @noble/hashes, @noble/ciphers
- **Testing:** Vitest
- **CI/CD:** GitHub Actions
- **Publish:** npm registry

---

## VPS Deployment (151.245.137.75 — reclabs3)

### SIP Services on VPS

| Service | Port | Container | Domain |
|---------|------|-----------|--------|
| sip-website | 5000 | sip-website | sip-protocol.org |
| sip-docs | 5003 | sip-docs | docs.sip-protocol.org |
| sip-blog | 5004 | sip-blog | blog.sip-protocol.org |
| sip-app | 5005 | sip-app-blue | app.sip-protocol.org |
| sipher | 5006 | sipher + sipher-redis | sipher.sip-protocol.org |
| sip-umami | 5010 | sip-umami + sip-umami-db | analytics.sip-protocol.org |

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
ssh reclabs3  # Root access
ssh sip       # SIP services user
ssh core      # Admin user for nginx/system config
```

### Key Files on VPS

- `~/app/docker-compose.yml` - Service definitions
- `/etc/nginx/sites-enabled/sip-docs.conf` - Nginx reverse proxy
- `/etc/letsencrypt/live/docs.sip-protocol.org/` - SSL certs (auto-renew)

---

## Keypair Storage & Deployments

**Location:** `~/Documents/secret/` (iCloud encrypted, Bitwarden backup). Never commit keypairs to git.

| File | Address | Usage |
|------|---------|-------|
| `sip-native-program-id.json` | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | SIP Privacy program |
| `authority.json` | `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd` | Deploy authority |
| `treasury.json` | `S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q` | Treasury |
| `solana-dapp-store.json` | `S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie` | Solana dApp Store |
| `sipher-vault-program-id.json` | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` | Sipher Vault program |
| `solana-devnet.json` | `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` | Shared devnet wallet |
| `evm-deployer.json` | `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` | ETH/Base/Arb/OP |

### Solana Program Deployments

| Network | Program ID | Config PDA | Date |
|---------|------------|------------|------|
| **Mainnet-Beta** | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | `BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ` | 2026-03-07 |
| **Devnet** | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | `BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ` | 2026-03-07 |

**Config:** Fee 50 bps, Authority `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd`

**Instructions (8):** `initialize`, `shielded_transfer`, `shielded_token_transfer`, `create_transfer_announcement`, `claim_transfer`, `claim_token_transfer`, `verify_commitment`, `verify_zk_proof`, `set_paused`, `update_fee`

**Latest Mainnet Deploy TX:** [`m5oJybe...qVwv`](https://solscan.io/tx/m5oJybeGj3GVMr8GxCKz817nr28NugasFDduyLHqW74kQTZcWXTWYgRH7VbNCKjezdeXaQDiVqFsqg3LHxdqVwv) (Mar 7, 2026 — added `create_transfer_announcement` for private swaps)

```bash
# Deploy (keys in ~/Documents/secret/)
solana program deploy target/deploy/sip_privacy.so \
  --program-id secrets/sip-native-program-id.json \
  --keypair secrets/authority.json \
  --url mainnet-beta \
  --with-compute-unit-price 10000
```

### Sipher Vault Deployments

| Network | Program ID | Config PDA | Date |
|---------|------------|------------|------|
| **Devnet** | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` | `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u` | 2026-03-31 |

**Config:** Fee 10 bps, Refund timeout 86400s (24h), Authority `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (devnet wallet)

**Instructions (7):** `initialize`, `create_vault_token`, `create_fee_token`, `deposit`, `withdraw_private`, `refund`, `collect_fee`

**Tests:** 14 passing, 1 pending | **Binary:** 353KB

```bash
# Deploy sipher_vault
cd programs/sipher-vault
solana program deploy target/deploy/sipher_vault.so \
  --program-id ~/Documents/secret/sipher-vault-program-id.json \
  --keypair ~/Documents/secret/solana-devnet.json \
  --url devnet \
  --with-compute-unit-price 10000

# Initialize vault config
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/init-devnet.ts
```

### EVM Contract Deployments (M18)

Deployer: `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46` | Fee: 50 bps

**Sepolia v2** (ZKVerifier router rewrite + FundingVerifier, 2026-02-28):

| Contract | Address |
|----------|---------|
| SIPPrivacy | `0x1FED19684dC108304960db2818CF5a961d28405E` |
| PedersenVerifier | `0x9AbdaBdaFdc4c0E2eFa389E6C375cdB890b919e2` |
| ZKVerifier | `0x4994c799dF5B47C564cAafe7FdF415c2c2c66436` |
| StealthAddressRegistry | `0xD62daC6f30541DE477c40B0Fcd7CD43e2248418E` |
| ZKTranscriptLib | `0x588849033F79F3b13f8BF696c1f61C27dE056df4` |
| FundingVerifier (HonkVerifier) | `0x8Ee5F3FC477C308224f58766540A5E7E049B0ECf` |
| SIPSwapRouter (v2) | `0xB05c2126bFfB9904DA36cDe1816a4902DEc9BEe5` |
| SIPRelayer | `0xC71725BCD9D20a58823128f331F64443B194D85A` |

**SIPSwapRouter v2:** Uniswap V3 + 1inch aggregator | 1inch Router `0x111111125421cA6dc452d289314280a0f8842A65` (approved) | Deployed 2026-03-01
**SIPRelayer:** Gelato gasless withdrawals via deposit mode | SIPPrivacy `0x1FED19684dC108304960db2818CF5a961d28405E` | Gelato Relay V1 `0xaBcC9b596420A9E9172FD5938620E265a0f9Df92` | Deployed 2026-03-01

**Arbitrum Sepolia v2** (full deployment + FundingVerifier, 2026-03-01):

| Contract | Address |
|----------|---------|
| SIPPrivacy | `0x0B0d06D6B5136d63Bd0817414E2D318999e50339` |
| PedersenVerifier | `0xEB14E9022A4c3DEED072DeC6b3858c19a00C87Db` |
| ZKVerifier | `0x26988D988684627084e6ae113e0354f6bc56b126` |
| StealthAddressRegistry | `0x1f7f3edD264Cf255dD99Fd433eD9FADE427dEF99` |
| ZKTranscriptLib | `0x4994c799dF5B47C564cAafe7FdF415c2c2c66436` |
| FundingVerifier (HonkVerifier) | `0xD62daC6f30541DE477c40B0Fcd7CD43e2248418E` |

**Base Sepolia + OP Sepolia** (v1 addresses, pre-ZKVerifier rewrite):

| Contract | Address |
|----------|---------|
| SIPPrivacy | `0x0B0d06D6B5136d63Bd0817414E2D318999e50339` |
| PedersenVerifier | `0xEB14E9022A4c3DEED072DeC6b3858c19a00C87Db` |
| ZKVerifier | `0x26988D988684627084e6ae113e0354f6bc56b126` |
| StealthAddressRegistry | `0x1f7f3edD264Cf255dD99Fd433eD9FADE427dEF99` |

| Network | Status | Date |
|---------|--------|------|
| Sepolia (11155111) | ✅ v2 Deployed (router + FundingVerifier) | 2026-02-28 |
| Arbitrum Sepolia (421614) | ✅ v2 Deployed (router + FundingVerifier) | 2026-03-01 |
| Base Sepolia (84532) | ✅ v1 Deployed | 2026-02-27 |
| OP Sepolia (11155420) | ✅ v1 Deployed | 2026-02-27 |
| Scroll Sepolia (534351) | ✅ v1 Deployed + SIPRelayer | 2026-03-01 |
| Linea Sepolia (59141) | ✅ v2 Deployed + SIPRelayer | 2026-03-01 |
| Mode Sepolia (919) | ✅ v1 Deployed + SIPRelayer | 2026-03-01 |
| Blast Sepolia (168587773) | 🔲 Pending (bridge in transit) | — |
| Mantle Sepolia (5003) | 🔲 Pending (needs MNT faucet) | — |
| zkSync Era Sepolia (300) | 🔲 Pending (needs foundry-zksync) | — |
| Mainnets | 🔲 Planned | — |

See `contracts/sip-ethereum/DEPLOYMENT.md` for full deployment guide and gas report.

---

## Code Style

- 2-space indent, no semicolons
- Explicit types for public APIs
- JSDoc for public functions
- Use enum values (`PrivacyLevel.SHIELDED`) not string literals
- Validation at system boundaries

---

**Last Updated:** 2026-03-01
**Status:** M17 Complete (Mainnet Live) | M18 In Progress (20/24 done) | 7,552+ Tests + 294 Foundry | 7 Packages | 🏆 Zypherpunk Winner ($6,500, #9/93, 3 tracks) | 💰 $10K Grant Approved
