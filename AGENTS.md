<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# SIP Protocol Ecosystem

**Organization:** https://github.com/sip-protocol
**Website:** https://sip-protocol.org

This file holds ecosystem-wide context for AI agents working across all SIP
Protocol repositories, plus core-repository detail (the `sip-protocol/sip-protocol`
repo is the core SDK monorepo).

## Ecosystem Overview

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3. Privacy middleware for same-chain and cross-chain transactions using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Current focus:** Ethereum Same-Chain Privacy (M18) — M17 Solana implementation complete.

**Progress tracker:** `~/.claude/sip-protocol/M17-MOBILE-TRACKER.md` (14-week M17 + Mobile EPIC plan)

### Related Repositories

| Repo | Purpose | Tech Stack | Version |
|------|---------|------------|---------|
| `sip-protocol/sip-protocol` | **Core** — SDK, React, CLI, API packages | TypeScript, Vitest | v0.11.0 |
| `sip-protocol/sip-app` | **App** — privacy applications (payments, wallet, DEX) | Next.js 16, Tailwind | v0.1.0 |
| `sip-protocol/sip-mobile` | **Mobile** — native iOS/Android/Seeker privacy wallet | Expo 52, NativeWind | v0.1.0 |
| `sip-protocol/sip-arcium-program` | **Arcium** — MPC program for confidential DeFi | Rust, Anchor, Arcium SDK | - |
| `sip-protocol/sip-website` | Marketing site (demo deprecated → sip-app) | Next.js 15, Tailwind | v0.0.1 |
| `sip-protocol/docs-sip` | Documentation (Astro Starlight) | Astro 5, MDX | v0.0.0 |
| `sip-protocol/blog-sip` | **Blog** — technical deep-dives, ecosystem updates | Astro 5, MDX, Tailwind | v0.0.1 |
| `sip-protocol/circuits` | Noir ZK circuits (3 circuits, 18 tests) | Noir 1.0.0-beta.15 | - |
| `sip-protocol/sipher` | **Sipher** — privacy-as-a-skill REST API for Solana agents | Express 5, TypeScript | v0.1.0 |
| `sip-protocol/sip-community` | Open-source community platform (spec/pre-MVP) | Next.js, Drizzle | - |
| `sip-protocol/.github` | Org configs, profile | YAML | - |

**Organization mission:** Become THE privacy standard for Web3 — same-chain and cross-chain.

## Cross-Repo Standards

### Shared coding standards
- TypeScript: 2-space indentation, no semicolons
- Markdown: consistent headers, code blocks with language tags

### Quality gates
- All tests passing before merge
- Type checking passes (`pnpm typecheck`)
- No security vulnerabilities

### Git workflow
- Feature branches from `dev` or `main`; descriptive commit messages; squash on PR merge when sensible

### Documentation
- Keep README.md synchronized with code
- Maintain repo-specific AGENTS.md (CLAUDE.md retained for compat, references this file)

### Licenses
All SIP Protocol projects are MIT licensed.

## Repository Index

### 1. sip-protocol (Core) — **YOU ARE HERE**
Core SDK for shielded intents. **Key commands:**
```bash
pnpm install
pnpm test -- --run      # 7,504+ tests
pnpm typecheck
pnpm build
```
**Key files:** `packages/sdk/src/{stealth,crypto,privacy,intent,sip}.ts`. Full details in "SIP Core Repository" below.

### 2. sip-app
World-class privacy applications. **Key commands:**
```bash
pnpm dev                # localhost:3000
pnpm test -- --run      # 1,184 unit tests
pnpm test:e2e           # 27 Playwright E2E
pnpm build · pnpm typecheck
```
**App routes (14):** `/` hub · `/payments/*` private payments · `/privacy-score` · `/wallet/*` · `/dex/*` (Jupiter, stealth routing) · `/enterprise/*` compliance.
**Deployment:** app.sip-protocol.org (Docker + GHCR, port 5004 blue / 5005 green).

### 3. sip-mobile
Privacy-first Solana wallet — native key management + shielded payments on iOS, Android & Seeker. **Key commands:**
```bash
pnpm install
npx expo start          # iOS + Android
pnpm test -- --run      # 1,323 tests
pnpm typecheck
eas build --platform android --profile production --local
```
**Tabs (5):** Home · Send · Receive · Swap · Settings. **Wallet strategy:** native key storage (SecureStore + Seed Vault), optional external wallet (MWA, Phantom). **Targets:** iOS App Store, Google Play, Solana dApp Store (Seeker).

### 4. sip-website
Marketing website (demo pages removed → 301 redirects to sip-app). Next.js 16, React 19, Tailwind 4, Zustand, Vitest. **Key commands:** `pnpm dev` · `pnpm test -- --run` (157 tests) · `pnpm build` · `pnpm typecheck`. Active pages (13): `/`, `/about`, `/features`, `/roadmap`, `/sdk`, `/pitch-deck`→301 `/showcase/zypherpunk-2025`, `/grants/*`, `/privacy`, `/terms`, `/license`, `/security`. **Deployment:** sip-protocol.org (Vercel, Git auto-deploy; Docker/GHCR retained as VPS rollback).

### 5. docs-sip
Official docs. Astro 5, Starlight, MDX. **Key commands:** `npm run dev` (localhost:4321) · `npm run build` · `npm run preview`. **Deployment:** docs.sip-protocol.org (Vercel; migrated off VPS 2026-05-31).

### 6. circuits
Noir ZK circuits. **Key commands:** `nargo compile` · `nargo test` · `nargo prove` · `nargo verify`. 3 circuits (funding_proof 972 opcodes, validity_proof 1113, fulfillment_proof 1691) — 18 tests.

### 7. blog-sip
Technical blog. Astro 5, MDX, Tailwind 4. **Key commands:** `npm run dev` (localhost:4321) · `npm run build` · `npm run preview`. 33 published posts (M16 target 12 — exceeded). **Deployment:** blog.sip-protocol.org (Vercel; migrated off VPS 2026-05-31).

### 8. sip-arcium-program
Arcium MPC program for confidential DeFi. Rust, Anchor 1.0.2, Arcium SDK 0.10.4. **Key commands:** `arcium build` · `arcium test` · `anchor deploy --provider.cluster devnet` · `npx ts-node scripts/init-comp-defs.ts`. Program ID `S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9`, MXE `5qy4Njk4jCJE4QgZ5dsg8uye3vzFypFTV7o7RRSQ8vr4`, cluster offset 456 (Arcium devnet v0.6.3).

### 9. sipher
Privacy agent + REST API for Solana — HERALD (X agent), SENTINEL (LLM security analyst), web chat, real Jupiter swaps. Express 5, TypeScript. **Key commands:** `pnpm dev` (localhost:5006) · `pnpm test -- --run` (497 tests) · `cd packages/agent && pnpm test` (905) · `pnpm build` · `pnpm typecheck`. 66 REST endpoints, 22 agent tools. **Deployment:** sipher.sip-protocol.org (Docker + GHCR, port 5006).

### 10. sip-community
Open-source community platform (spec / pre-MVP — no app code yet, holds product design). Next.js, Drizzle. PRD at `docs/superpowers/specs/2026-07-04-sip-community-design.md`.

### 11. .github
Org-wide config + profile. Key files: `profile/README.md`, `ISSUE_TEMPLATE/` (planned), `FUNDING.yml` (planned).

## Sources of Truth

> **Code is truth. Docs are derived.** Before updating documentation, verify against code.

See [docs/INVENTORY.md](docs/INVENTORY.md) for full ecosystem inventory.

**Quick verification (from repo root):**
```bash
ls packages/ programs/ contracts/ examples/   # Component inventory
pnpm turbo test -- --run 2>&1 | grep "Tests"  # Test counts
gh issue list --search "EPIC" --state open    # Active milestones
```

**Update triggers:** new package, version bump, test count change (>10%), new program/contract.

## Current Focus

See [ROADMAP.md](ROADMAP.md) for milestone tracking. Cross-repo coordination: changes to `@sip-protocol/sdk` may require updates to sip-website; all repos follow semantic versioning.

---

# SIP Core Repository

> The sections below are specific to the `sip-protocol/sip-protocol` repo (core SDK monorepo).

## What is SIP?

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3 — like HTTPS for the internet. One toggle to shield sender, amount, and recipient using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Status:** M16 Complete | 7,504+ tests (SDK 6,691, React 543, CLI 62, API 198, RN 10) | Live at sip-protocol.org

**🏆 Zypherpunk Hackathon Winner** ($6,500: NEAR $4,000 + Tachyon $500 + pumpfun $2,000) | Dec 2025 | #9 of 93 | 3 Tracks
**🥇 1st Place — Solana Graveyard Hackathon** | Torque Sponsor Track ($750) | Mar 2026

**Endgame:** Privacy middleware between applications and blockchains. Chain-agnostic. Settlement-agnostic. The universal privacy layer.

## Architecture (Dual Moat Strategy)

SIP combines **Settlement Aggregation** for standardization with **Proof Composition** for technical moat.

```
APPLICATIONS (Wallets, DEXs, DAOs, Payments, NFT, Gaming, Enterprise)
        │ "Add privacy with one toggle"
        ▼
SIP PROTOCOL — THE PRIVACY STANDARD  ◄═══ WE ARE HERE
  PRIVACY LAYER (Core Value): Stealth Addresses · Pedersen Commitments · Viewing Keys · Privacy Levels · Unified API · Compliance Ready
  INFRASTRUCTURE AGNOSTIC: Settlement backends (NEAR, Zcash, Direct Chain, Mina) · Privacy backends (SIP Native, PrivacyCash, Arcium, Inco) · RPC providers (Helius, QuickNode, Triton, Generic) [M17]
  PROOF COMPOSITION (Technical Moat) [Phase 5: M19-M21]: Zcash privacy execution · Mina succinct verification · Noir validity proofs · Compose proofs from multiple systems
        │ "Settle anywhere, use any provider"
        ▼
SETTLEMENT LAYER (Pluggable): NEAR Intents [Now] · Solana Same-Chain [M17] · Ethereum [M18]
        ▼
BLOCKCHAIN LAYER (Ethereum, Solana, NEAR, Bitcoin, Cosmos, Move chains, …)
```

**One-liner:** SIP is privacy middleware — we sit between apps and chains, making any transaction private.

### Infrastructure Agnostic Philosophy

SIP is pluggable at every layer — developers choose their preferred backends:

| Layer | Options | Philosophy |
|-------|---------|------------|
| Settlement | NEAR Intents, Zcash, Direct Chain, Mina | Settle anywhere |
| Privacy | SIP Native, PrivacyCash, Arcium, Inco | Choose your privacy model |
| RPC Provider | Helius, QuickNode, Triton, Generic | Use your preferred infra |

```typescript
// Same API, different backends — developer choice
const payments = await scanForPayments({
  provider: createProvider('helius', { apiKey }),  // or 'quicknode', 'triton', 'generic'
  viewingPrivateKey,
  spendingPublicKey,
})
```

## Current Features

| Feature | Status |
|---------|--------|
| Stealth addresses (EIP-5564, secp256k1) | ✅ |
| Pedersen commitments (homomorphic, hiding amounts) | ✅ |
| Viewing keys (selective disclosure for compliance) | ✅ |
| Privacy levels (transparent, shielded, compliant) | ✅ |
| NEAR Intents adapter (1Click API) | ✅ |
| Zcash RPC client (shielded tx) | ✅ |
| Wallet adapters (abstract + Solana/Ethereum) | ✅ |
| E2E test suite (128 tests) | ✅ |
| ZK proof specs (Funding, Validity, Fulfillment) | ✅ |
| Noir circuits (BrowserNoirProvider, compiled) | ✅ |
| EVM ZK verifier (BB-generated UltraHonk FundingVerifier on Sepolia) | ✅ |
| EVM privacy contracts (SIPPrivacy, PedersenVerifier, StealthAddressRegistry) | ✅ |
| Uniswap private swaps (SIPSwapRouter — stealth output via Uniswap V3) | ✅ |
| 1inch aggregator swaps (SIPSwapRouter v2 — whitelisted router + calldata validation) | ✅ |
| Gelato gasless relayer (SIPRelayer — deposit mode + Gelato callWithSyncFee) | ✅ |

## Common Commands

```bash
pnpm install
pnpm test -- --run       # 7,504+ tests
pnpm test -- tests/e2e --run   # E2E only (30 tests)
pnpm typecheck
pnpm lint
pnpm build
```

## Test Suite (7,624+ total)

| Package | Version | Tests |
|---------|---------|-------|
| @sip-protocol/sdk | 0.11.0 | 6,716 |
| contracts/sip-ethereum | - | 294 |
| @sip-protocol/react | 0.1.1 | 543 |
| @sip-protocol/cli | 0.2.1 | 62 |
| @sip-protocol/api | 0.1.1 | 198 |
| @sip-protocol/react-native | 0.1.2 | 10 |

## Critical Design Decisions

1. **Application layer (not infrastructure):** Complement, don't compete with NEAR Intents/Zcash. Leverage existing chain infra. Focus on privacy UX.
2. **Privacy levels:** `'transparent'` (public) · `'shielded'` (hidden sender/amount/recipient) · `'compliant'` (privacy + viewing key for auditors).
3. **Stealth address format:** `sip:<chain>:<spendingKey>:<viewingKey>` (e.g. `sip:solana:0x02abc...123:0x03def...456`).
4. **Viewing key hash:** hash raw key bytes, not hex string (`sha256(hexToBytes(viewingKey.slice(2)))`).
5. **Commitment structure:** `{ value: HexString, blindingFactor: HexString }` — Pedersen `value*G + blinding*H`.

## Project Structure

```
sip-protocol/sip-protocol
├── packages/
│   ├── sdk/          # @sip-protocol/sdk v0.11.0 (6,691 tests)
│   │   ├── src/{adapters,proofs,stealth.ts,crypto.ts,privacy.ts,intent.ts,sip.ts}
│   │   └── tests/
│   ├── types/        # @sip-protocol/types v0.2.2
│   ├── react/        # @sip-protocol/react v0.1.0 (543 tests)
│   ├── cli/          # @sip-protocol/cli v0.2.0 (62 tests)
│   ├── api/          # @sip-protocol/api v0.1.0 (198 tests)
│   └── react-native/ # @sip-protocol/react-native v0.1.1 (10 tests)
├── programs/         # Solana Anchor program
├── contracts/        # Ethereum Solidity contracts
├── examples/         # 11 integration examples
└── docs/             # Documentation & specs
```

## Strategic Direction

**Vision:** THE privacy standard for Web3 — like HTTPS for the internet.
**Positioning:** Privacy middleware (chain-agnostic, settlement-agnostic).
**Mental model:** "OpenRouter for privacy" — single API wrapping multiple settlement/privacy backends; the unique value-add is the cryptographic privacy layer applied before routing.

**Expansion path:**
1. Phase 1 (M1-M8): Foundation — Core tech, NEAR Intents ✅
2. Phase 2 (M9-M12): Standard — Multi-backend, multi-chain ✅
3. Phase 3 (M13-M15): Ecosystem — Compliance, DX, Applications ✅
4. Phase 4 (M16-M18): Same-Chain Expansion — Solana + Ethereum same-chain 🎯
5. Phase 5 (M19-M21): Technical Moat — Proof composition, SIP-EIP 🔲

**Competitive advantage vs PrivacyCash (Tornado Cash clone):** Cryptographic privacy (Pedersen) vs pool mixing; any amount hidden vs fixed pool sizes; viewing keys (compliance) vs none; no amount correlation attacks.

**Grant status:** Superteam Indonesia $10K USDC (T1+T2 paid $6K; T3 $4K pending) ✅ · Solana Audit Subsidy V (pending) · Solana Foundation $100K (planned). **Grants tracking:** `~/.claude/sip-protocol/grants/` (private). See `~/.claude/sip-protocol/STRATEGY.md` (private).

## Milestones

- **Phase 1 (Foundation, 2024-2025) ✅** M1-M8
- **Phase 2 (Standard, 2025) ✅** M9-M12
- **Phase 3 (Ecosystem, 2025) ✅** M13-M15
- **Phase 4 (Same-Chain Expansion, Q1-Q2 2026) 🎯** M16 ✅ · M17 (Solana) ✅ · M18 (Ethereum) 🔄
- **Phase 5 (Technical Moat, Q3-Q4 2026) 🔲** M19-M21

## Deployment Topology

> **VPS → Vercel migration COMPLETE + decommissioned (2026-06-14).** All 5 web properties (docs, blog, cdn, sip-app, sip-website) serve from **Vercel** (Git-integration auto-deploy). Only **sipher** + **sip-umami** remain on the VPS.

### On Vercel (scope `rectors-projects` — push to `main` auto-deploys)

| Service | Vercel project | Domain |
|---------|----------------|--------|
| docs | `sip-docs` | docs.sip-protocol.org |
| blog | `sip-blog` | blog.sip-protocol.org |
| cdn | `sip-cdn` | cdn.sip-protocol.org |
| sip-app | `sip-app` | app.sip-protocol.org |
| sip-website | `sip-website` | sip-protocol.org |

### On VPS (151.245.137.75 — reclabs3 — Docker + GHCR + SSH)

| Service | Port | Container | Domain |
|---------|------|-----------|--------|
| sipher | 5006 | sipher + sipher-redis | sipher.sip-protocol.org |
| sip-umami | 5010 | sip-umami + sip-umami-db | analytics.sip-protocol.org |

**Docker compose isolation:** all users share the Docker daemon — use `name:` in docker-compose.yml to isolate projects.

**SSH:** `ssh reclabs3` (root) · `ssh sip` (SIP services user) · `ssh core` (admin/nginx/system).

**Key files on VPS:** `~/app/docker-compose.yml`, `/etc/nginx/sites-enabled/`, `/etc/letsencrypt/live/*/`.

## Keypair Storage & Deployments

Keypairs in `~/Documents/secret/` (iCloud encrypted, Bitwarden backup). Never commit keypairs to git.

**Solana program deployments:**

| Network | Program ID | Config PDA |
|---------|------------|------------|
| Mainnet-Beta | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | `BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ` |
| Devnet | (same) | (same) |

Config: Fee 50 bps, Authority `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd`. 10 instructions (`initialize`, `shielded_transfer`, `shielded_token_transfer`, `create_transfer_announcement`, `claim_transfer`, `claim_token_transfer`, `verify_commitment`, `verify_zk_proof`, `set_paused`, `update_fee`).

**Privacy model (current — verified 2026-06-12):** same-tx sender→stealth. `actual_amount` is a **plaintext instruction arg** (amount visible on-chain + balance deltas) and `TransferRecord.sender` is recorded — the sender↔stealth graph is public. The Pedersen commitment is stored for claim/compliance; it does **not** hide the settlement amount. On-chain ZK verification is stubbed (format-checked, verified off-chain). `claim_transfer` requires the stealth account + recipient as co-signers.

**Sipher Vault (devnet only):** Program `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`, Config PDA `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u`. Fee 7.5 bps (`fee_tenths_bps=75`), refund timeout 86400s. 9 instructions. Privacy model: deposit-first commingling vault — `withdraw_private` requires the **depositor as signer** (`DepositRecord` keyed by depositor); per-depositor debit-first ledger, **not** a trustless ZK/nullifier mixer. Integrator unlinkability holds **only when the depositor is a shared/aggregating wallet**. Trustless nullifier-authorized withdrawal is the M19 co-build. `withdraw_private` CPIs `create_transfer_announcement` so the payout is scannable + carries a Pedersen commitment.

**EVM contract deployments (M18):** Deployer `0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46`, Fee 50 bps. Sepolia v2 (SIPPrivacy `0x1FED19684dC108304960db2818CF5a961d28405E`, PedersenVerifier, ZKVerifier, StealthAddressRegistry, ZKTranscriptLib, FundingVerifier HonkVerifier, SIPSwapRouter v2, SIPRelayer). Also Arbitrum Sepolia v2, Base/OP/Scroll/Linea/Mode Sepolia. See `contracts/sip-ethereum/DEPLOYMENT.md` for full guide + gas report.

## Code Style

- 2-space indent, no semicolons
- Explicit types for public APIs; JSDoc for public functions
- Use enum values (`PrivacyLevel.SHIELDED`) not string literals
- Validation at system boundaries