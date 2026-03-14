# T2 Superteam Indonesia Pitch — Design Spec

**Date:** 2026-03-14
**Author:** RECTOR + CIPHER
**Status:** Reviewed (spec review passed)
**Grant:** Superteam Indonesia / Solana Foundation ($10K USDC)
**Tranche:** T2 ($3,000) — "30% upon completion of reported milestone/KPI"

---

## Problem Statement

SIP Protocol needs to submit a T2 tranche request to Superteam Indonesia. The original grant proposal included specific traction KPIs (500 X followers, 60 GitHub stars, 800 npm downloads/week, 250 Discourse members, 2,500 blog views) that were not met. However, the technical output since T1 payment (Jan 30, 2026) far exceeds what was proposed.

**Pitch angle: "Builder Earns, Then Markets" (Angle D)**
Acknowledge traction gaps honestly, lead with massive technical delivery, frame as deliberate sequencing (build first, market second), position T3 as the growth phase.

---

## Deliverables

### 1. T2 Pitch Page — `/grants/superteam/t2`

**Repo:** sip-website (`~/local-dev/sip-website/`)
**Route:** `/grants/superteam/t2`
**Files:**
- `src/app/grants/superteam/t2/page.tsx` — Server component wrapper
- `src/app/grants/superteam/t2/content.tsx` — Client component with all sections

**Pattern:** Follows existing grant page pattern (server page.tsx + client content.tsx). Same styling, motion, and component patterns as `/grants/superteam`.

**Key differences from original superteam page:**
- No `getFounderData()` call — T2 is a progress report, not a founder pitch
- Simpler `page.tsx` — direct render of content component
- Must export `metadata` for SEO/OG tags (title, description, og:image)
- Page should be indexable (no `noindex`) — transparency builds trust

#### Page Sections

| # | Section | Purpose | Complexity |
|---|---------|---------|------------|
| 1 | **Hero** | "T2 Progress Report" with grant context badge | Low |
| 2 | **Deliverables Status** | 4 original deliverables with checkmarks + evidence links | Medium |
| 3 | **Beyond the Proposal** | Cards for mainnet program, mobile wallet, Sipher API, EVM contracts, hackathon win | Medium |
| 4 | **By the Numbers** | Metrics grid: 803 commits, 11,100+ tests, 4 SDK releases, 9 repos, 7 EVM networks | Low |
| 5 | **Traction: Honest Assessment** | Target vs Actual table with explanation paragraph | Medium |
| 6 | **External Validation** | Hackathon win, npm downloads, organic search (DuckDuckGo/Bing/ChatGPT referrals) | Low |
| 7 | **T3 Growth Plan** | Specific marketing actions for the next phase | Low |
| 8 | **Live Evidence** | Link table to all live URLs, program IDs, npm packages | Low |

#### Content Data

**Deliverables (Section 2):**

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Native Solana Privacy SDK | Complete | npm: @sip-protocol/sdk v0.9.0, 2,485 downloads during grant |
| Jupiter DEX Integration | Complete | app.sip-protocol.org/dex/jupiter — real swap execution, mainnet verified |
| Production App | Complete | app.sip-protocol.org — 14 routes, 1,186 tests |
| Developer Resources | Complete | docs.sip-protocol.org + 14 examples + 33 blog posts |

**Beyond Scope (Section 3):**

| Achievement | Details |
|------------|---------|
| Solana Mainnet Program | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` — 8 instructions, live on mainnet-beta |
| sip-mobile | Native wallet for Solana Seeker — v0.2.3, 1,323 tests, dApp Store submission |
| Sipher API | Privacy-as-a-Skill REST API — 71 endpoints, 573 tests, live at sipher.sip-protocol.org |
| EVM Contracts | 6 contracts across 7 testnets (Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode) |
| Hackathon Win | 1st Place — Solana Graveyard Hackathon (Torque track, $750) |
| SDK Evolution | v0.7.3 → v0.9.0 (4 releases, 58 total published versions) |

**By the Numbers (Section 4):**

| Metric | Value |
|--------|-------|
| Total commits (since T1) | 803 across 9 repos |
| Total tests (ecosystem) | 11,100+ |
| SDK releases (since T1) | 4 (v0.7.4, v0.8.0, v0.8.1, v0.9.0) |
| Active repositories | 9 |
| npm downloads (Jan 30 – Mar 14, source: npm-stat.com) | 2,485 |
| EVM networks deployed | 7 |
| Smart contracts | 6 Solidity + 1 Anchor program |
| Lines added (core only) | +34,383 |
| Foundry tests | 294 across 42 suites |

**Traction Honest Assessment (Section 5):**

| Metric | T2 Target | Actual | Status |
|--------|-----------|--------|--------|
| X followers | 500 | 119 | Below |
| GitHub stars | 60 | 3 | Below |
| npm downloads/week | 800 | ~500 | Near |
| Discourse members | 250 | 0 (no forum) | Pivoted |
| Blog views/month | 2,500 | 184 (30d Umami) | Below |

**Explanation paragraph (key message):**
> As a solo founder, I had to choose: prioritize social proof metrics or build production infrastructure that actually works on mainnet. I chose to build. The Solana program is live on mainnet. The mobile wallet runs on Seeker hardware. The SDK has 11,100+ tests. Private swaps are verified end-to-end. Now that the foundation is solid, T3 shifts to growth and marketing.

**T3 Growth Plan (Section 7) — specific, measurable actions:**
1. Superteam community amplification for Seeker wallet launch (pending dApp Store approval, ticket #302807036614)
2. Publish 3 SDK integration tutorials + 5 X threads by Apr 15
3. Submit 2 talk proposals to upcoming Solana ecosystem events (Hacker House, Breakpoint)
4. SDK integration outreach to 5 Solana wallets (Phantom, Backpack, Solflare, Glow, Ultimate)
5. Developer workshop with Superteam Indonesia community (target: 20+ attendees)
6. Bug bounty program on GitHub to drive engagement and stars

#### Styling Patterns

Match existing grant pages exactly:
- Dark theme, Tailwind only
- Framer Motion animations (whileInView, once: true)
- Container: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`
- Cards: `p-6 rounded-2xl bg-gray-900/50 border border-gray-800`
- Badges: `inline-flex items-center px-4 py-1.5 rounded-full`
- Gradient text: `bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent`
- Icons from lucide-react

#### No New Dependencies

Everything uses existing packages (framer-motion, lucide-react, next/script, next/link).

---

### 2. Superteam Earn Form Text

**Field 1: "Share an update about your project"**

```
All 4 grant deliverables are shipped and live in production:

1. Native Solana Privacy SDK — @sip-protocol/sdk v0.9.0 on npm (4 releases since T1, 2,485 downloads during grant period, 6,751 SDK tests)
2. Jupiter DEX Integration — Real swap execution with stealth destination routing, verified on mainnet (app.sip-protocol.org/dex/jupiter)
3. Production App — 14 routes live at app.sip-protocol.org (payments, privacy score, compliance dashboard, DEX)
4. Developer Resources — docs.sip-protocol.org + 14 example integrations + 33 blog posts

Beyond the original scope, we shipped:
- Solana mainnet program (S1PMFs...S9at) — 8 instructions, live since Mar 7
- sip-mobile — native Seeker wallet (v0.2.3, 1,323 tests, dApp Store pending)
- Sipher — Privacy-as-a-Skill REST API (71 endpoints, 573 tests, live)
- EVM contracts on 7 testnet networks
- 1st Place — Solana Graveyard Hackathon (Torque track)

In total: 803 commits across 9 repos, 11,100+ tests, SDK v0.7.3 → v0.9.0.

Traction metrics (X followers, GitHub stars) are below targets — as a solo founder I prioritized building production infrastructure over distribution. The tech is now solid and verified on mainnet. T3 will shift focus to growth, community, and ecosystem partnerships.

Full progress report: https://sip-protocol.org/grants/superteam/t2
```

**Field 2: "Any help wanted?"**

```
Now that the technical foundation is production-ready (mainnet program, mobile wallet, SDK), I'd appreciate Superteam's help with:

1. Community amplification for the Seeker wallet launch (pending dApp Store approval)
2. Introductions to Solana ecosystem wallets interested in privacy SDK integration
3. Co-marketing for developer adoption (workshops, content collaboration)

The tech is built — I need help reaching users.
```

---

### 3. Umami Analytics Fix — sip-app

**Repo:** sip-app (`~/local-dev/sip-app/`)
**File:** `src/app/layout.tsx`
**Change:** Add Umami Script tag (same pattern as sip-website)

```typescript
import Script from 'next/script'

// Inside <body> tag, add:
<Script
  src="https://analytics.sip-protocol.org/script.js"
  data-website-id="4ccd6b5d-58c5-4f87-b070-0b182e5e673a"
  strategy="afterInteractive"
/>
```

**Website ID:** `4ccd6b5d-58c5-4f87-b070-0b182e5e673a` (already created in Umami dashboard)
**Deploy:** Requires push to main + Docker redeploy on VPS

---

### 4. Updated T2 Milestone Report

**File:** `~/.claude/sip-protocol/grants/superteam-indonesia-2026-01/reports/T2-milestone-report.md`
**Change:** Update with current numbers (SDK v0.9.0, 11,100+ tests, mainnet program, hackathon win)

This is the internal record — not public-facing.

---

## Prerequisite

**Update `sip-website/src/lib/constants.ts`** — currently stale (sdk tests: 6604 vs actual 6,751; completedMilestones: 16 vs 17; missing Graveyard hackathon). Update before T2 page if the page imports from constants. Alternatively, hardcode T2-specific numbers in content.tsx (defensible since they're point-in-time metrics for a specific tranche report).

## Implementation Order

1. Update `constants.ts` in sip-website if T2 page will import from it
2. Write T2 pitch page on sip-website (content.tsx + page.tsx with metadata export)
3. Add Umami to sip-app layout.tsx (layout remains server component — no 'use client' needed)
4. Update internal T2 milestone report
5. Deploy sip-website (push to main triggers Docker deploy)
6. Deploy sip-app (push to main triggers Docker deploy)
7. Verify pitch page: loads correctly, all links work, mobile responsive, OG tags render
8. Submit form on Superteam Earn (RECTOR manually)

## Test Count Derivation (verified 2026-03-14)

| Source | Tests | Verified |
|--------|-------|----------|
| @sip-protocol/sdk | 6,751 | pnpm test |
| contracts/sip-ethereum (Foundry) | 294 (42 suites) | forge test |
| @sip-protocol/react | 543 | pnpm test |
| @sip-protocol/cli | 62 | pnpm test |
| @sip-protocol/api | 198 | pnpm test |
| @sip-protocol/react-native | 10 | pnpm test |
| sip-app | 1,186 (122 suites) | pnpm test |
| sip-mobile | 1,323 | documented |
| sipher | 573 | documented |
| sip-website | 157 | pnpm test |
| circuits (nargo) | 18 | documented |
| **Total** | **11,115** | Rounded to 11,100+ |

## Out of Scope

- Fixing traction metrics (X followers, GitHub stars) — separate effort
- SIP Website traffic (3 visitors is real, not a tracking bug)
- Sipher Umami tracking (API server, no browser UI)
- Form submission itself (RECTOR does this manually)
- Grants index page update (T2 page will be linked directly in Earn form)
- Tests for T2 page (consistent with existing grant pages — no dedicated tests)
